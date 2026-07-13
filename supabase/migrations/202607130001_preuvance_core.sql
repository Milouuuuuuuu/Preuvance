begin;

create type public.organization_role as enum ('owner', 'member');
create type public.assessment_status as enum ('draft', 'running', 'completed', 'failed');
create type public.reasoning_stage as enum (
  'extraction',
  'classification',
  'gap_analysis',
  'synthesis'
);
create type public.reasoning_status as enum ('pending', 'running', 'completed', 'failed');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  owner_user_id uuid not null unique default auth.uid()
    references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role public.organization_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.ai_systems (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  description text not null check (char_length(description) between 1 and 12000),
  sector text check (sector is null or char_length(sector) <= 160),
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('planned', 'active', 'paused', 'retired')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_systems_id_organization_unique unique (id, organization_id)
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ai_system_id uuid not null,
  status public.assessment_status not null default 'draft',
  source_description text not null check (char_length(source_description) between 20 and 30000),
  structured_facts jsonb,
  classification jsonb,
  gaps jsonb,
  report_payload jsonb,
  score smallint check (score is null or score between 0 and 100),
  tier text check (tier is null or tier in ('A+', 'A', 'B', 'C', 'D')),
  error_message text check (error_message is null or char_length(error_message) <= 4000),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint assessments_system_organization_fk
    foreign key (ai_system_id, organization_id)
    references public.ai_systems(id, organization_id)
    on delete cascade,
  constraint assessments_id_organization_unique unique (id, organization_id)
);

create table public.reasoning_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assessment_id uuid not null,
  sequence smallint not null check (sequence > 0),
  stage public.reasoning_stage not null,
  status public.reasoning_status not null default 'pending',
  model text not null check (char_length(model) between 1 and 120),
  input jsonb,
  output jsonb,
  error_message text check (error_message is null or char_length(error_message) <= 4000),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reasoning_steps_assessment_organization_fk
    foreign key (assessment_id, organization_id)
    references public.assessments(id, organization_id)
    on delete cascade,
  constraint reasoning_steps_sequence_unique unique (assessment_id, sequence)
);

create index ai_systems_organization_idx
  on public.ai_systems (organization_id, updated_at desc);
create index assessments_system_idx
  on public.assessments (ai_system_id, created_at desc);
create index assessments_organization_status_idx
  on public.assessments (organization_id, status, created_at desc);
create index reasoning_steps_assessment_idx
  on public.reasoning_steps (assessment_id, sequence);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger ai_systems_set_updated_at
before update on public.ai_systems
for each row execute function public.set_updated_at();

create trigger assessments_set_updated_at
before update on public.assessments
for each row execute function public.set_updated_at();

create function public.prevent_tenant_reassignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if to_jsonb(new) ->> 'organization_id'
    is distinct from to_jsonb(old) ->> 'organization_id' then
    raise exception 'organization_id is immutable';
  end if;

  if tg_nargs > 0 and to_jsonb(new) ->> tg_argv[0]
    is distinct from to_jsonb(old) ->> tg_argv[0] then
    raise exception '% is immutable', tg_argv[0];
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_tenant_reassignment() from public;

create trigger ai_systems_prevent_tenant_reassignment
before update on public.ai_systems
for each row execute function public.prevent_tenant_reassignment();

create trigger assessments_prevent_tenant_reassignment
before update on public.assessments
for each row execute function public.prevent_tenant_reassignment('ai_system_id');

create trigger reasoning_steps_prevent_tenant_reassignment
before update on public.reasoning_steps
for each row execute function public.prevent_tenant_reassignment('assessment_id');

create function public.add_organization_owner_as_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.owner_user_id, 'owner');
  return new;
end;
$$;

revoke all on function public.add_organization_owner_as_member() from public;

create trigger organizations_add_owner_member
after insert on public.organizations
for each row execute function public.add_organization_owner_as_member();

create function public.provision_preuvance_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization_name text;
begin
  if exists (
    select 1
    from public.organization_members
    where user_id = new.id
  ) then
    return new;
  end if;

  organization_name := left(
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'organization_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Mon organisation'
    ),
    160
  );

  insert into public.organizations (name, owner_user_id)
  values (organization_name, new.id);

  return new;
end;
$$;

revoke all on function public.provision_preuvance_user() from public;

create trigger auth_users_provision_preuvance
after insert on auth.users
for each row execute function public.provision_preuvance_user();

-- Provision accounts that existed before this migration. The organization insert
-- trigger creates the matching owner membership atomically.
insert into public.organizations (name, owner_user_id)
select
  left(
    coalesce(
      nullif(trim(users.raw_user_meta_data ->> 'organization_name'), ''),
      nullif(trim(users.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
      'Mon organisation'
    ),
    160
  ),
  users.id
from auth.users as users
where not exists (
  select 1
  from public.organization_members as members
  where members.user_id = users.id
)
on conflict (owner_user_id) do nothing;

create function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
      and user_id = (select auth.uid())
  );
$$;

create function public.is_organization_owner(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organizations
    where id = target_organization_id
      and owner_user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_organization_member(uuid) from public;
revoke all on function public.is_organization_owner(uuid) from public;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.is_organization_owner(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.ai_systems enable row level security;
alter table public.assessments enable row level security;
alter table public.reasoning_steps enable row level security;

create policy organizations_select_member
on public.organizations
for select
to authenticated
using (public.is_organization_member(id));

create policy organizations_insert_self
on public.organizations
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and not exists (
    select 1
    from public.organization_members
    where user_id = (select auth.uid())
  )
);

create policy organizations_update_owner
on public.organizations
for update
to authenticated
using (public.is_organization_owner(id))
with check (
  public.is_organization_owner(id)
  and owner_user_id = (select auth.uid())
);

create policy organizations_delete_owner
on public.organizations
for delete
to authenticated
using (public.is_organization_owner(id));

-- Membership mutations remain service-role-only in the MVP. This prevents a
-- client from changing its organization or granting itself access to another.
create policy organization_members_select_same_organization
on public.organization_members
for select
to authenticated
using (public.is_organization_member(organization_id));

create policy ai_systems_member_access
on public.ai_systems
for all
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy assessments_member_access
on public.assessments
for all
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy reasoning_steps_member_access
on public.reasoning_steps
for all
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

revoke all on table public.organizations from anon;
revoke all on table public.organization_members from anon;
revoke all on table public.ai_systems from anon;
revoke all on table public.assessments from anon;
revoke all on table public.reasoning_steps from anon;

grant select, insert, update, delete on table public.organizations to authenticated;
grant select, insert, update, delete on table public.organization_members to authenticated;
grant select, insert, update, delete on table public.ai_systems to authenticated;
grant select, insert, update, delete on table public.assessments to authenticated;
grant select, insert, update, delete on table public.reasoning_steps to authenticated;

grant all on table public.organizations to service_role;
grant all on table public.organization_members to service_role;
grant all on table public.ai_systems to service_role;
grant all on table public.assessments to service_role;
grant all on table public.reasoning_steps to service_role;

commit;
