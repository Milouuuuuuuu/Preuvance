begin;

-- Quota de rendu PDF (audit du 26/07/2026, S-09).
--
-- La route d'évaluation consomme un quota avant d'appeler le modèle ; la route
-- PDF, elle, déclenchait un rendu react-pdf complet côté Worker sans aucune
-- limite pour un compte authentifié. Un compte gratuit pouvait donc boucler
-- sur un assessmentId valide et faire brûler du CPU indéfiniment.
--
-- Compteur distinct de celui des évaluations : télécharger plusieurs fois son
-- dossier est légitime, lancer plusieurs analyses coûte des appels modèle. La
-- limite est donc large (30/heure) : elle ne gêne pas un usage normal et coupe
-- l'abus. Même patron que assessment_rate_limits : une ligne par utilisateur,
-- table inaccessible au client, remise à zéro impossible sans la RPC definer.
create table public.pdf_render_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count smallint not null default 0
    check (request_count >= 0)
);

comment on table public.pdf_render_limits is
  'Per-user PDF rendering quota. Bounds Worker CPU spend on report generation.';

alter table public.pdf_render_limits enable row level security;

revoke all on table public.pdf_render_limits from public;
revoke all on table public.pdf_render_limits from anon;
revoke all on table public.pdf_render_limits from authenticated;
grant all on table public.pdf_render_limits to service_role;

create function public.consume_pdf_render_quota()
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
  -- À garder alignés avec lib/supabase/pdf-quota.ts.
  quota_limit constant smallint := 30;
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

  insert into public.pdf_render_limits (user_id, window_started_at, request_count)
  values (current_user_id, clock_timestamp(), 0)
  on conflict (user_id) do nothing;

  select limits.window_started_at, limits.request_count
  into quota_window_started_at, quota_request_count
  from public.pdf_render_limits as limits
  where limits.user_id = current_user_id
  for update;

  request_time := clock_timestamp();

  if quota_window_started_at <= request_time - quota_window then
    quota_window_started_at := request_time;
    quota_request_count := 1;

    update public.pdf_render_limits as limits
    set window_started_at = quota_window_started_at,
        request_count = quota_request_count
    where limits.user_id = current_user_id;
  elsif quota_request_count < quota_limit then
    quota_request_count := quota_request_count + 1;

    update public.pdf_render_limits as limits
    set request_count = quota_request_count
    where limits.user_id = current_user_id;
  else
    return query select
      false,
      0::smallint,
      greatest(
        1,
        ceil(
          extract(epoch from (quota_window_started_at + quota_window - request_time))
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

revoke all on function public.consume_pdf_render_quota() from public;
revoke all on function public.consume_pdf_render_quota() from anon;
grant execute on function public.consume_pdf_render_quota() to authenticated;

commit;
