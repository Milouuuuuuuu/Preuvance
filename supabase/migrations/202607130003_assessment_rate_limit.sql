begin;

-- Bounded to one row per user, so the limiter does not grow with every request.
create table public.assessment_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count smallint not null default 0
    check (request_count >= 0)
);

comment on table public.assessment_rate_limits is
  'Atomic per-user assessment starts for the production OpenAI spend guard.';

alter table public.assessment_rate_limits enable row level security;

-- There is deliberately no client policy: authenticated users consume quota
-- only through the security-definer RPC and cannot reset their own counter.
revoke all on table public.assessment_rate_limits from public;
revoke all on table public.assessment_rate_limits from anon;
revoke all on table public.assessment_rate_limits from authenticated;
grant all on table public.assessment_rate_limits to service_role;

create function public.consume_assessment_quota()
returns table (
  allowed boolean,
  remaining smallint,
  retry_after_seconds integer,
  request_limit smallint,
  window_seconds integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- Keep these values aligned with lib/supabase/assessment-quota.ts.
  quota_limit constant smallint := 5;
  quota_window constant interval := interval '1 hour';
  quota_window_seconds constant integer := 3600;
  current_user_id uuid := auth.uid();
  request_time timestamptz;
  quota_window_started_at timestamptz;
  quota_request_count smallint;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  insert into public.assessment_rate_limits (
    user_id,
    window_started_at,
    request_count
  )
  values (current_user_id, clock_timestamp(), 0)
  on conflict (user_id) do nothing;

  -- The row lock serializes concurrent requests for the same user. Requests
  -- from different users retain full concurrency.
  select limits.window_started_at, limits.request_count
  into quota_window_started_at, quota_request_count
  from public.assessment_rate_limits as limits
  where limits.user_id = current_user_id
  for update;

  request_time := clock_timestamp();

  if quota_window_started_at <= request_time - quota_window then
    quota_window_started_at := request_time;
    quota_request_count := 1;

    update public.assessment_rate_limits as limits
    set
      window_started_at = quota_window_started_at,
      request_count = quota_request_count
    where limits.user_id = current_user_id;
  elsif quota_request_count < quota_limit then
    quota_request_count := quota_request_count + 1;

    update public.assessment_rate_limits as limits
    set request_count = quota_request_count
    where limits.user_id = current_user_id;
  else
    return query select
      false,
      0::smallint,
      greatest(
        1,
        ceil(
          extract(epoch from (
            quota_window_started_at + quota_window - request_time
          ))
        )::integer
      ),
      quota_limit,
      quota_window_seconds;
    return;
  end if;

  return query select
    true,
    (quota_limit - quota_request_count)::smallint,
    0,
    quota_limit,
    quota_window_seconds;
end;
$$;

revoke all on function public.consume_assessment_quota() from public;
revoke all on function public.consume_assessment_quota() from anon;
grant execute on function public.consume_assessment_quota() to authenticated;

commit;
