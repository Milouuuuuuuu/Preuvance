begin;

-- The row ledger is the canonical evidence source. report_payload.evidence is a
-- server-built compatibility projection and can no longer be edited directly by
-- authenticated clients.
alter table public.assessments
  add column evidence_revision bigint not null default 0
    check (evidence_revision >= 0);

create type public.evidence_status as enum (
  'verified',
  'documented',
  'detected',
  'declared',
  'partial',
  'missing',
  'unverified',
  'not-applicable'
);

create table public.assessment_evidence (
  assessment_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 100),
  sort_order smallint not null check (sort_order between 0 and 119),
  control text not null check (char_length(control) between 1 and 500),
  status public.evidence_status not null,
  detail text not null check (char_length(detail) between 1 and 1500),
  gap_id text check (gap_id is null or char_length(gap_id) between 1 and 80),
  article_references text[] not null default '{}'
    check (cardinality(article_references) <= 12),
  owner text check (owner is null or char_length(owner) between 1 and 160),
  source_type text not null check (
    source_type in (
      'model-extraction',
      'user-declaration',
      'local-scan',
      'dependency-scan',
      'document',
      'policy',
      'test',
      'contract',
      'other'
    )
  ),
  source_label text check (
    source_label is null or char_length(source_label) between 1 and 240
  ),
  file_name text check (
    file_name is null or char_length(file_name) between 1 and 240
  ),
  file_size_bytes integer check (
    file_size_bytes is null or file_size_bytes between 0 and 25000000
  ),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  collected_at timestamptz,
  valid_until date,
  reviewed_by text check (
    reviewed_by is null or char_length(reviewed_by) between 1 and 160
  ),
  reviewed_at timestamptz,
  -- This identity is never accepted from JSON. The definer function records the
  -- authenticated actor whenever a row becomes (or is materially changed as)
  -- verified. The human-readable reviewed_by field remains part of the dossier.
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (assessment_id, id),
  constraint assessment_evidence_assessment_organization_fk
    foreign key (assessment_id, organization_id)
    references public.assessments(id, organization_id)
    on delete cascade,
  constraint assessment_evidence_verified_review_check check (
    status <> 'verified' or (reviewed_by is not null and reviewed_at is not null)
  ),
  constraint assessment_evidence_file_hash_check check (
    (file_name is null and file_size_bytes is null) or sha256 is not null
  )
);

create table public.assessment_evidence_events (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evidence_id text not null check (char_length(evidence_id) between 1 and 100),
  event_type text not null check (event_type in ('created', 'updated', 'removed')),
  previous_status public.evidence_status,
  next_status public.evidence_status,
  previous_snapshot jsonb,
  after_snapshot jsonb,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint assessment_evidence_events_assessment_organization_fk
    foreign key (assessment_id, organization_id)
    references public.assessments(id, organization_id)
    on delete cascade,
  constraint assessment_evidence_event_snapshots_check check (
    (event_type = 'created' and previous_snapshot is null and after_snapshot is not null)
    or (event_type = 'updated' and previous_snapshot is not null and after_snapshot is not null)
    or (event_type = 'removed' and previous_snapshot is not null and after_snapshot is null)
  )
);

create index assessment_evidence_status_idx
  on public.assessment_evidence (assessment_id, status, updated_at desc);
create index assessment_evidence_order_idx
  on public.assessment_evidence (assessment_id, sort_order);
create index assessment_evidence_events_idx
  on public.assessment_evidence_events (assessment_id, created_at desc);

create trigger assessment_evidence_prevent_tenant_reassignment
before update on public.assessment_evidence
for each row execute function public.prevent_tenant_reassignment('assessment_id');

alter table public.assessment_evidence enable row level security;
alter table public.assessment_evidence_events enable row level security;

create policy assessment_evidence_select_member
on public.assessment_evidence
for select
to authenticated
using (public.is_organization_member(organization_id));

create policy assessment_evidence_events_select_member
on public.assessment_evidence_events
for select
to authenticated
using (public.is_organization_member(organization_id));

revoke all on table public.assessment_evidence from anon, authenticated;
revoke all on table public.assessment_evidence_events from anon, authenticated;
grant select on table public.assessment_evidence to authenticated;
grant select on table public.assessment_evidence_events to authenticated;
grant all on table public.assessment_evidence to service_role;
grant all on table public.assessment_evidence_events to service_role;

-- Return a complete audit snapshot. reviewedByUserId and sortOrder are kept in
-- events, but removed from the report projection because they are internal data.
create function public.assessment_evidence_snapshot(
  p_assessment_id uuid,
  p_evidence_id text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', evidence.id,
    'sortOrder', evidence.sort_order,
    'control', evidence.control,
    'status', evidence.status,
    'detail', evidence.detail,
    'gapId', evidence.gap_id,
    'articleReferences', to_jsonb(evidence.article_references),
    'owner', evidence.owner,
    'sourceType', evidence.source_type,
    'sourceLabel', evidence.source_label,
    'fileName', evidence.file_name,
    'fileSizeBytes', evidence.file_size_bytes,
    'sha256', evidence.sha256,
    'collectedAt', case
      when evidence.collected_at is null then null
      else to_char(
        evidence.collected_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    end,
    'validUntil', evidence.valid_until::text,
    'reviewedBy', evidence.reviewed_by,
    'reviewedAt', case
      when evidence.reviewed_at is null then null
      else to_char(
        evidence.reviewed_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    end,
    'reviewedByUserId', evidence.reviewed_by_user_id,
    'updatedAt', to_char(
      evidence.updated_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  ))
  from public.assessment_evidence as evidence
  where evidence.assessment_id = p_assessment_id
    and evidence.id = p_evidence_id;
$$;

revoke all on function public.assessment_evidence_snapshot(uuid, text) from public;
revoke all on function public.assessment_evidence_snapshot(uuid, text) from anon, authenticated;

create function public.assessment_evidence_public_array(p_assessment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      public.assessment_evidence_snapshot(evidence.assessment_id, evidence.id)
        - 'sortOrder'
        - 'reviewedByUserId'
      order by evidence.sort_order
    ),
    '[]'::jsonb
  )
  from public.assessment_evidence as evidence
  where evidence.assessment_id = p_assessment_id;
$$;

revoke all on function public.assessment_evidence_public_array(uuid) from public;
revoke all on function public.assessment_evidence_public_array(uuid) from anon, authenticated;

create function public.assessment_report_with_evidence(
  p_assessment_id uuid,
  p_report_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  base_report jsonb;
  canonical_evidence jsonb;
  evidence_count integer;
begin
  base_report := case
    when jsonb_typeof(p_report_payload) = 'object' then p_report_payload
    else '{}'::jsonb
  end;
  canonical_evidence := public.assessment_evidence_public_array(p_assessment_id);
  evidence_count := jsonb_array_length(canonical_evidence);

  return jsonb_set(
    jsonb_set(
      base_report,
      array['evidence'],
      canonical_evidence,
      true
    ),
    array['evidenceInventory'],
    jsonb_build_object(
      'sourceItemCount', evidence_count,
      'includedItemCount', evidence_count,
      'truncatedItemCount', 0,
      'methodVersion', 'preuvance-evidence-ledger-v2'
    ),
    true
  );
end;
$$;

revoke all on function public.assessment_report_with_evidence(uuid, jsonb) from public;
revoke all on function public.assessment_report_with_evidence(uuid, jsonb) from anon, authenticated;

-- Legacy report items may omit id, sourceType, and updatedAt. Only that legacy
-- compatibility is accepted; all other keys and values remain strict.
create function public.normalize_assessment_evidence_item(
  p_item jsonb,
  p_assessment_id uuid,
  p_sort_order integer,
  p_allow_legacy boolean,
  p_server_updated_at timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  allowed_keys constant text[] := array[
    'id',
    'control',
    'status',
    'detail',
    'gapId',
    'articleReferences',
    'owner',
    'sourceType',
    'sourceLabel',
    'fileName',
    'fileSizeBytes',
    'sha256',
    'collectedAt',
    'validUntil',
    'reviewedBy',
    'reviewedAt',
    'updatedAt'
  ];
  invalid_key text;
  evidence_id text;
  control_value text;
  status_value text;
  detail_value text;
  source_type_value text;
  optional_key text;
  optional_max integer;
  optional_value text;
  timestamp_value text;
  date_value text;
  file_size_value numeric;
  article jsonb;
  article_value text;
  articles jsonb := '[]'::jsonb;
  normalized jsonb;
begin
  if p_item is null or jsonb_typeof(p_item) <> 'object' then
    raise exception 'each evidence item must be a JSON object'
      using errcode = '22023';
  end if;
  if p_assessment_id is null
    or p_sort_order is null
    or p_sort_order not between 0 and 119
    or p_server_updated_at is null then
    raise exception 'invalid evidence normalization context'
      using errcode = '22023';
  end if;

  select keys.key
  into invalid_key
  from jsonb_object_keys(p_item) as keys(key)
  where not (keys.key = any (allowed_keys))
  limit 1;

  if invalid_key is not null then
    raise exception 'unknown evidence field: %', invalid_key
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_each(p_item) as fields(key, value)
    where fields.value = 'null'::jsonb
  ) then
    raise exception 'evidence fields must be omitted instead of set to null'
      using errcode = '22023';
  end if;

  if not (p_item ? 'control')
    or jsonb_typeof(p_item -> 'control') <> 'string' then
    raise exception 'evidence control must be a string'
      using errcode = '22023';
  end if;
  control_value := trim(p_item ->> 'control');
  if char_length(control_value) not between 1 and 500 then
    raise exception 'evidence control must contain 1 to 500 characters'
      using errcode = '22023';
  end if;

  if not (p_item ? 'status')
    or jsonb_typeof(p_item -> 'status') <> 'string' then
    raise exception 'evidence status must be a string'
      using errcode = '22023';
  end if;
  status_value := p_item ->> 'status';
  if not (status_value = any (array[
    'verified', 'documented', 'detected', 'declared', 'partial',
    'missing', 'unverified', 'not-applicable'
  ]::text[])) then
    raise exception 'unsupported evidence status: %', status_value
      using errcode = '22023';
  end if;

  if not (p_item ? 'detail')
    or jsonb_typeof(p_item -> 'detail') <> 'string' then
    raise exception 'evidence detail must be a string'
      using errcode = '22023';
  end if;
  detail_value := trim(p_item ->> 'detail');
  if char_length(detail_value) not between 1 and 1500 then
    raise exception 'evidence detail must contain 1 to 1500 characters'
      using errcode = '22023';
  end if;

  if p_item ? 'id' then
    if jsonb_typeof(p_item -> 'id') <> 'string' then
      raise exception 'evidence id must be a string' using errcode = '22023';
    end if;
    evidence_id := trim(p_item ->> 'id');
    if char_length(evidence_id) not between 1 and 100 then
      raise exception 'evidence id must contain 1 to 100 characters'
        using errcode = '22023';
    end if;
  elsif p_allow_legacy then
    evidence_id := format(
      'ev-%s-%s',
      substring(
        md5(p_assessment_id::text || ':' || p_sort_order::text || ':' || control_value),
        1,
        8
      ),
      p_sort_order + 1
    );
  else
    raise exception 'evidence id is required' using errcode = '22023';
  end if;

  if p_item ? 'sourceType' then
    if jsonb_typeof(p_item -> 'sourceType') <> 'string' then
      raise exception 'evidence sourceType must be a string'
        using errcode = '22023';
    end if;
    source_type_value := p_item ->> 'sourceType';
    if not (source_type_value = any (array[
      'model-extraction', 'user-declaration', 'local-scan', 'dependency-scan',
      'document', 'policy', 'test', 'contract', 'other'
    ]::text[])) then
      raise exception 'unsupported evidence sourceType: %', source_type_value
        using errcode = '22023';
    end if;
  elsif p_allow_legacy then
    source_type_value := case
      when status_value = 'detected' then 'local-scan'
      when status_value in ('documented', 'verified') then 'document'
      else 'user-declaration'
    end;
  else
    raise exception 'evidence sourceType is required' using errcode = '22023';
  end if;

  if p_item ? 'updatedAt' then
    if jsonb_typeof(p_item -> 'updatedAt') <> 'string' then
      raise exception 'evidence updatedAt must be a string'
        using errcode = '22023';
    end if;
    timestamp_value := p_item ->> 'updatedAt';
    if char_length(timestamp_value) not between 1 and 40
      or timestamp_value !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}' then
      raise exception 'evidence updatedAt must be an ISO 8601 timestamp'
        using errcode = '22023';
    end if;
    perform timestamp_value::timestamptz;
  elsif not p_allow_legacy then
    raise exception 'evidence updatedAt is required' using errcode = '22023';
  end if;

  normalized := jsonb_build_object(
    'id', evidence_id,
    'control', control_value,
    'status', status_value,
    'detail', detail_value,
    'articleReferences', articles,
    'sourceType', source_type_value,
    'updatedAt', to_char(
      p_server_updated_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  );

  for optional_key, optional_max in
    select limits.key_name, limits.max_length
    from (values
      ('gapId', 80),
      ('owner', 160),
      ('sourceLabel', 240),
      ('fileName', 240),
      ('reviewedBy', 160)
    ) as limits(key_name, max_length)
  loop
    if p_item ? optional_key then
      if jsonb_typeof(p_item -> optional_key) <> 'string' then
        raise exception 'evidence % must be a string', optional_key
          using errcode = '22023';
      end if;
      optional_value := trim(p_item ->> optional_key);
      if char_length(optional_value) not between 1 and optional_max then
        raise exception 'evidence % must contain 1 to % characters',
          optional_key,
          optional_max
          using errcode = '22023';
      end if;
      normalized := normalized || jsonb_build_object(optional_key, optional_value);
    end if;
  end loop;

  if p_item ? 'articleReferences' then
    if jsonb_typeof(p_item -> 'articleReferences') <> 'array'
      or jsonb_array_length(p_item -> 'articleReferences') > 12 then
      raise exception 'articleReferences must be an array of at most 12 strings'
        using errcode = '22023';
    end if;
    articles := '[]'::jsonb;
    for article in
      select value
      from jsonb_array_elements(p_item -> 'articleReferences')
    loop
      if jsonb_typeof(article) <> 'string' then
        raise exception 'each article reference must be a string'
          using errcode = '22023';
      end if;
      article_value := trim(article #>> '{}');
      if char_length(article_value) not between 1 and 100 then
        raise exception 'each article reference must contain 1 to 100 characters'
          using errcode = '22023';
      end if;
      articles := articles || jsonb_build_array(article_value);
    end loop;
    normalized := jsonb_set(
      normalized,
      array['articleReferences'],
      articles,
      false
    );
  end if;

  if p_item ? 'fileSizeBytes' then
    if jsonb_typeof(p_item -> 'fileSizeBytes') <> 'number' then
      raise exception 'fileSizeBytes must be an integer'
        using errcode = '22023';
    end if;
    file_size_value := (p_item ->> 'fileSizeBytes')::numeric;
    if file_size_value <> trunc(file_size_value)
      or file_size_value not between 0 and 25000000 then
      raise exception 'fileSizeBytes must be an integer from 0 to 25000000'
        using errcode = '22023';
    end if;
    normalized := normalized || jsonb_build_object(
      'fileSizeBytes',
      file_size_value::integer
    );
  end if;

  if p_item ? 'sha256' then
    if jsonb_typeof(p_item -> 'sha256') <> 'string'
      or (p_item ->> 'sha256') !~ '^[a-f0-9]{64}$' then
      raise exception 'sha256 must contain 64 lowercase hexadecimal characters'
        using errcode = '22023';
    end if;
    normalized := normalized || jsonb_build_object('sha256', p_item ->> 'sha256');
  end if;

  for optional_key in
    select datetime_key
    from (values ('collectedAt'), ('reviewedAt')) as datetimes(datetime_key)
  loop
    if p_item ? optional_key then
      if jsonb_typeof(p_item -> optional_key) <> 'string' then
        raise exception 'evidence % must be a string', optional_key
          using errcode = '22023';
      end if;
      timestamp_value := p_item ->> optional_key;
      if char_length(timestamp_value) not between 1 and 40
        or timestamp_value !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}' then
        raise exception 'evidence % must be an ISO 8601 timestamp', optional_key
          using errcode = '22023';
      end if;
      normalized := normalized || jsonb_build_object(
        optional_key,
        to_char(
          timestamp_value::timestamptz at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
      );
    end if;
  end loop;

  if p_item ? 'validUntil' then
    if jsonb_typeof(p_item -> 'validUntil') <> 'string' then
      raise exception 'validUntil must be a string' using errcode = '22023';
    end if;
    date_value := p_item ->> 'validUntil';
    if char_length(date_value) <> 10
      or date_value !~ '^\d{4}-\d{2}-\d{2}$'
      or to_char(date_value::date, 'YYYY-MM-DD') <> date_value then
      raise exception 'validUntil must use the YYYY-MM-DD format'
        using errcode = '22023';
    end if;
    normalized := normalized || jsonb_build_object('validUntil', date_value);
  end if;

  if status_value = 'verified'
    and (
      not (normalized ? 'reviewedBy')
      or not (normalized ? 'reviewedAt')
    ) then
    raise exception 'verified evidence requires reviewer and review date'
      using errcode = '22023';
  end if;

  if (
    (normalized ? 'fileName')
    or (normalized ? 'fileSizeBytes')
  ) and not (normalized ? 'sha256') then
    raise exception 'local evidence metadata requires sha256'
      using errcode = '22023';
  end if;

  return normalized;
end;
$$;

revoke all on function public.normalize_assessment_evidence_item(
  jsonb,
  uuid,
  integer,
  boolean,
  timestamptz
) from public;
revoke all on function public.normalize_assessment_evidence_item(
  jsonb,
  uuid,
  integer,
  boolean,
  timestamptz
) from anon, authenticated;

-- Apply one already-normalized item. Identical public data and order are a true
-- no-op: no row update, updatedAt change, or audit event is produced.
create function public.apply_assessment_evidence_item(
  p_assessment_id uuid,
  p_organization_id uuid,
  p_item jsonb,
  p_sort_order integer,
  p_actor_user_id uuid,
  p_operation_time timestamptz
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  existing_row public.assessment_evidence%rowtype;
  row_exists boolean;
  target_status public.evidence_status := (p_item ->> 'status')::public.evidence_status;
  previous_snapshot jsonb;
  after_snapshot jsonb;
  current_public_item jsonb;
  desired_public_item jsonb := p_item - 'updatedAt';
  target_reviewer_user_id uuid;
begin
  if p_actor_user_id is null or p_operation_time is null then
    raise exception 'evidence writes require a server actor and timestamp'
      using errcode = '22023';
  end if;

  select evidence.*
  into existing_row
  from public.assessment_evidence as evidence
  where evidence.assessment_id = p_assessment_id
    and evidence.id = p_item ->> 'id'
  for update;
  row_exists := found;

  if row_exists then
    previous_snapshot := public.assessment_evidence_snapshot(
      p_assessment_id,
      p_item ->> 'id'
    );
    current_public_item := previous_snapshot
      - 'sortOrder'
      - 'reviewedByUserId'
      - 'updatedAt';

    if existing_row.sort_order = p_sort_order
      and current_public_item = desired_public_item then
      return false;
    end if;
  end if;

  target_reviewer_user_id := case
    when target_status = 'verified' then p_actor_user_id
    else null
  end;

  if row_exists then
    update public.assessment_evidence as evidence
    set
      sort_order = p_sort_order,
      control = p_item ->> 'control',
      status = target_status,
      detail = p_item ->> 'detail',
      gap_id = nullif(p_item ->> 'gapId', ''),
      article_references = array(
        select jsonb_array_elements_text(p_item -> 'articleReferences')
      ),
      owner = nullif(p_item ->> 'owner', ''),
      source_type = p_item ->> 'sourceType',
      source_label = nullif(p_item ->> 'sourceLabel', ''),
      file_name = nullif(p_item ->> 'fileName', ''),
      file_size_bytes = nullif(p_item ->> 'fileSizeBytes', '')::integer,
      sha256 = nullif(p_item ->> 'sha256', ''),
      collected_at = nullif(p_item ->> 'collectedAt', '')::timestamptz,
      valid_until = nullif(p_item ->> 'validUntil', '')::date,
      reviewed_by = nullif(p_item ->> 'reviewedBy', ''),
      reviewed_at = nullif(p_item ->> 'reviewedAt', '')::timestamptz,
      reviewed_by_user_id = target_reviewer_user_id,
      updated_by = p_actor_user_id,
      updated_at = p_operation_time
    where evidence.assessment_id = p_assessment_id
      and evidence.id = p_item ->> 'id';
  else
    insert into public.assessment_evidence (
      assessment_id,
      organization_id,
      id,
      sort_order,
      control,
      status,
      detail,
      gap_id,
      article_references,
      owner,
      source_type,
      source_label,
      file_name,
      file_size_bytes,
      sha256,
      collected_at,
      valid_until,
      reviewed_by,
      reviewed_at,
      reviewed_by_user_id,
      created_by,
      updated_by,
      created_at,
      updated_at
    ) values (
      p_assessment_id,
      p_organization_id,
      p_item ->> 'id',
      p_sort_order,
      p_item ->> 'control',
      target_status,
      p_item ->> 'detail',
      nullif(p_item ->> 'gapId', ''),
      array(select jsonb_array_elements_text(p_item -> 'articleReferences')),
      nullif(p_item ->> 'owner', ''),
      p_item ->> 'sourceType',
      nullif(p_item ->> 'sourceLabel', ''),
      nullif(p_item ->> 'fileName', ''),
      nullif(p_item ->> 'fileSizeBytes', '')::integer,
      nullif(p_item ->> 'sha256', ''),
      nullif(p_item ->> 'collectedAt', '')::timestamptz,
      nullif(p_item ->> 'validUntil', '')::date,
      nullif(p_item ->> 'reviewedBy', ''),
      nullif(p_item ->> 'reviewedAt', '')::timestamptz,
      target_reviewer_user_id,
      p_actor_user_id,
      p_actor_user_id,
      p_operation_time,
      p_operation_time
    );
  end if;

  after_snapshot := public.assessment_evidence_snapshot(
    p_assessment_id,
    p_item ->> 'id'
  );

  insert into public.assessment_evidence_events (
    assessment_id,
    organization_id,
    evidence_id,
    event_type,
    previous_status,
    next_status,
    previous_snapshot,
    after_snapshot,
    actor_user_id,
    created_at
  ) values (
    p_assessment_id,
    p_organization_id,
    p_item ->> 'id',
    case when row_exists then 'updated' else 'created' end,
    case when row_exists then existing_row.status else null end,
    target_status,
    previous_snapshot,
    after_snapshot,
    p_actor_user_id,
    p_operation_time
  );

  return true;
end;
$$;

revoke all on function public.apply_assessment_evidence_item(
  uuid,
  uuid,
  jsonb,
  integer,
  uuid,
  timestamptz
) from public;
revoke all on function public.apply_assessment_evidence_item(
  uuid,
  uuid,
  jsonb,
  integer,
  uuid,
  timestamptz
) from anon, authenticated;

create function public.seed_assessment_evidence_from_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_evidence jsonb;
  incoming record;
  normalized_item jsonb;
  seen_ids text[] := '{}'::text[];
  actor_user_id uuid;
  operation_time timestamptz := clock_timestamp();
begin
  report_evidence := case
    when jsonb_typeof(new.report_payload) = 'object'
      and new.report_payload ? 'evidence'
      and jsonb_typeof(new.report_payload -> 'evidence') <> 'null'
    then new.report_payload -> 'evidence'
    else '[]'::jsonb
  end;

  if jsonb_typeof(report_evidence) <> 'array'
    or jsonb_array_length(report_evidence) > 120 then
    raise exception 'report evidence must be an array of at most 120 items'
      using errcode = '22023';
  end if;
  if octet_length(report_evidence::text) > 524288 then
    raise exception 'report evidence must not exceed 512 KiB'
      using errcode = '22023';
  end if;

  select coalesce(new.created_by, organizations.owner_user_id)
  into actor_user_id
  from public.organizations
  where organizations.id = new.organization_id;

  for incoming in
    select items.value, items.ordinality
    from jsonb_array_elements(report_evidence) with ordinality as items(value, ordinality)
  loop
    normalized_item := public.normalize_assessment_evidence_item(
      incoming.value,
      new.id,
      (incoming.ordinality - 1)::integer,
      true,
      operation_time
    );
    if normalized_item ->> 'id' = any (seen_ids) then
      raise exception 'duplicate evidence id: %', normalized_item ->> 'id'
        using errcode = '22023';
    end if;
    seen_ids := array_append(seen_ids, normalized_item ->> 'id');

    perform public.apply_assessment_evidence_item(
      new.id,
      new.organization_id,
      normalized_item,
      (incoming.ordinality - 1)::integer,
      actor_user_id,
      operation_time
    );
  end loop;

  update public.assessments as assessments
  set report_payload = public.assessment_report_with_evidence(
    new.id,
    new.report_payload
  )
  where assessments.id = new.id;

  return new;
end;
$$;

revoke all on function public.seed_assessment_evidence_from_report() from public;
revoke all on function public.seed_assessment_evidence_from_report() from anon, authenticated;

-- Normalize and seed assessments created before this migration. Missing legacy
-- id/sourceType/updatedAt fields receive deterministic/server-owned values.
do $$
declare
  assessment_row record;
  report_evidence jsonb;
  incoming record;
  normalized_item jsonb;
  seen_ids text[];
  operation_time timestamptz;
begin
  for assessment_row in
    select
      assessments.id,
      assessments.organization_id,
      assessments.created_by,
      assessments.report_payload,
      organizations.owner_user_id
    from public.assessments
    join public.organizations
      on organizations.id = assessments.organization_id
    where assessments.report_payload is not null
  loop
    operation_time := clock_timestamp();
    seen_ids := '{}'::text[];
    report_evidence := case
      when jsonb_typeof(assessment_row.report_payload) = 'object'
        and assessment_row.report_payload ? 'evidence'
        and jsonb_typeof(assessment_row.report_payload -> 'evidence') <> 'null'
      then assessment_row.report_payload -> 'evidence'
      else '[]'::jsonb
    end;

    if jsonb_typeof(report_evidence) <> 'array'
      or jsonb_array_length(report_evidence) > 120 then
      raise exception 'legacy report % has an invalid evidence array', assessment_row.id
        using errcode = '22023';
    end if;
    if octet_length(report_evidence::text) > 524288 then
      raise exception 'legacy report % evidence exceeds 512 KiB', assessment_row.id
        using errcode = '22023';
    end if;

    for incoming in
      select items.value, items.ordinality
      from jsonb_array_elements(report_evidence) with ordinality as items(value, ordinality)
    loop
      normalized_item := public.normalize_assessment_evidence_item(
        incoming.value,
        assessment_row.id,
        (incoming.ordinality - 1)::integer,
        true,
        operation_time
      );
      if normalized_item ->> 'id' = any (seen_ids) then
        raise exception 'legacy report % has duplicate evidence id %',
          assessment_row.id,
          normalized_item ->> 'id'
          using errcode = '22023';
      end if;
      seen_ids := array_append(seen_ids, normalized_item ->> 'id');

      perform public.apply_assessment_evidence_item(
        assessment_row.id,
        assessment_row.organization_id,
        normalized_item,
        (incoming.ordinality - 1)::integer,
        coalesce(assessment_row.created_by, assessment_row.owner_user_id),
        operation_time
      );
    end loop;

    update public.assessments as assessments
    set report_payload = public.assessment_report_with_evidence(
      assessment_row.id,
      assessment_row.report_payload
    )
    where assessments.id = assessment_row.id;
  end loop;
end;
$$;

create trigger assessments_seed_evidence
after insert on public.assessments
for each row execute function public.seed_assessment_evidence_from_report();

-- Authenticated users retain read access, while every assessment write is now
-- mediated by a reviewed definer RPC. The existing membership check inside
-- persist_completed_assessment remains the authorization boundary for creation.
drop policy if exists assessments_member_access on public.assessments;
create policy assessments_select_member
on public.assessments
for select
to authenticated
using (public.is_organization_member(organization_id));

revoke all on table public.assessments from authenticated;
grant select on table public.assessments to authenticated;

alter function public.persist_completed_assessment(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  smallint,
  text,
  jsonb
) security definer;
alter function public.persist_completed_assessment(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  smallint,
  text,
  jsonb
) set search_path = '';

create function public.sync_assessment_evidence(
  p_assessment_id uuid,
  p_evidence jsonb,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_organization_id uuid;
  current_revision bigint;
  current_report_payload jsonb;
  incoming record;
  normalized_item jsonb;
  normalized_evidence jsonb := '[]'::jsonb;
  seen_ids text[] := '{}'::text[];
  removed public.assessment_evidence%rowtype;
  previous_snapshot jsonb;
  operation_time timestamptz := clock_timestamp();
  changed boolean := false;
  item_changed boolean;
  canonical_evidence jsonb;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_assessment_id is null then
    raise exception 'assessment id is required' using errcode = '22023';
  end if;
  if p_evidence is null then
    raise exception 'evidence must not be SQL NULL' using errcode = '22023';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'expected evidence revision must be a non-negative integer'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_evidence) <> 'array' then
    raise exception 'evidence must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_evidence) > 120 then
    raise exception 'evidence must contain at most 120 items'
      using errcode = '22023';
  end if;
  if octet_length(p_evidence::text) > 524288 then
    raise exception 'evidence must not exceed 512 KiB'
      using errcode = '22023';
  end if;

  select
    assessments.organization_id,
    assessments.evidence_revision,
    assessments.report_payload
  into
    current_organization_id,
    current_revision,
    current_report_payload
  from public.assessments
  where assessments.id = p_assessment_id
    and assessments.status = 'completed'
    and public.is_organization_member(assessments.organization_id)
  for update;

  if current_organization_id is null then
    raise exception 'assessment not found' using errcode = 'P0002';
  end if;
  if current_revision <> p_expected_revision then
    raise exception 'evidence revision conflict'
      using
        errcode = '40001',
        detail = format(
          'Expected revision %s but current revision is %s.',
          p_expected_revision,
          current_revision
        );
  end if;

  -- Validate and normalize the complete document before performing any mutation.
  for incoming in
    select items.value, items.ordinality
    from jsonb_array_elements(p_evidence) with ordinality as items(value, ordinality)
  loop
    normalized_item := public.normalize_assessment_evidence_item(
      incoming.value,
      p_assessment_id,
      (incoming.ordinality - 1)::integer,
      false,
      operation_time
    );
    if normalized_item ->> 'id' = any (seen_ids) then
      raise exception 'duplicate evidence id: %', normalized_item ->> 'id'
        using errcode = '22023';
    end if;
    seen_ids := array_append(seen_ids, normalized_item ->> 'id');
    normalized_evidence := normalized_evidence || jsonb_build_array(normalized_item);
  end loop;

  for removed in
    select evidence.*
    from public.assessment_evidence as evidence
    where evidence.assessment_id = p_assessment_id
      and not (evidence.id = any (seen_ids))
    order by evidence.sort_order
    for update
  loop
    previous_snapshot := public.assessment_evidence_snapshot(
      p_assessment_id,
      removed.id
    );

    delete from public.assessment_evidence as evidence
    where evidence.assessment_id = p_assessment_id
      and evidence.id = removed.id;

    insert into public.assessment_evidence_events (
      assessment_id,
      organization_id,
      evidence_id,
      event_type,
      previous_status,
      next_status,
      previous_snapshot,
      after_snapshot,
      actor_user_id,
      created_at
    ) values (
      p_assessment_id,
      current_organization_id,
      removed.id,
      'removed',
      removed.status,
      null,
      previous_snapshot,
      null,
      current_user_id,
      operation_time
    );
    changed := true;
  end loop;

  for incoming in
    select items.value, items.ordinality
    from jsonb_array_elements(normalized_evidence) with ordinality
      as items(value, ordinality)
  loop
    item_changed := public.apply_assessment_evidence_item(
      p_assessment_id,
      current_organization_id,
      incoming.value,
      (incoming.ordinality - 1)::integer,
      current_user_id,
      operation_time
    );
    changed := changed or item_changed;
  end loop;

  canonical_evidence := public.assessment_evidence_public_array(p_assessment_id);

  if changed then
    current_revision := current_revision + 1;
    update public.assessments as assessments
    set
      report_payload = public.assessment_report_with_evidence(
        p_assessment_id,
        current_report_payload
      ),
      evidence_revision = current_revision
    where assessments.id = p_assessment_id;
  end if;

  return jsonb_build_object(
    'evidence', canonical_evidence,
    'revision', current_revision
  );
end;
$$;

revoke all on function public.sync_assessment_evidence(uuid, jsonb, bigint) from public;
revoke all on function public.sync_assessment_evidence(uuid, jsonb, bigint)
  from anon, authenticated;
grant execute on function public.sync_assessment_evidence(uuid, jsonb, bigint)
  to authenticated;

commit;
