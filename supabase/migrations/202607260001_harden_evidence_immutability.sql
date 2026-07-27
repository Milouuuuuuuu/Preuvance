begin;

-- Durcissement de l'immuabilité de la preuve (audit du 26/07/2026).
--
-- La migration 202607200001 a rendu `assessments` en lecture seule pour le
-- client, mais deux portes parentes restaient ouvertes : DELETE sur
-- `ai_systems` (FK on delete cascade → l'évaluation, son registre de preuves
-- ET son journal d'audit disparaissaient sans événement) et DELETE sur
-- `organizations` (même cascade, un cran plus haut). `reasoning_steps` restait
-- de plus réinscriptible par le client — la trace de raisonnement qui fonde le
-- dossier pouvait être réécrite sans journal.
--
-- Aucun flux applicatif n'écrit directement sur ces tables (vérifié : zéro
-- .from("ai_systems"|"organizations"|"reasoning_steps") côté client) : toutes
-- les écritures passent par les RPC SECURITY DEFINER, qui ne dépendent pas des
-- droits du rôle `authenticated`. On peut donc fermer sans rien casser.

-- Patron systématique : `revoke all` puis re-grant du strict nécessaire —
-- comme la migration 202607200001 l'avait fait pour `assessments`. Les
-- privilèges par défaut de Supabase (ALL, y compris TRUNCATE qui n'est pas
-- soumis à la RLS) restaient sinon accrochés aux tables de la migration 1.

-- 1. ai_systems : lecture seule pour le client. Créations et mises à jour
-- restent le fait de persist_completed_assessment (definer) ; la suppression
-- devient une opération service_role.
drop policy if exists ai_systems_member_access on public.ai_systems;

create policy ai_systems_select_member
on public.ai_systems
for select
to authenticated
using (public.is_organization_member(organization_id));

revoke all on table public.ai_systems from authenticated;
grant select on table public.ai_systems to authenticated;

-- 2. organizations : plus de suppression par appel PostgREST direct.
-- L'effacement d'une organisation (droit RGPD) devient une opération de
-- support outillée par service_role, avec journal — pas un DELETE silencieux
-- qui emporte les preuves et leur journal d'audit dans la cascade.
drop policy if exists organizations_delete_owner on public.organizations;

revoke all on table public.organizations from authenticated;
grant select, insert, update on table public.organizations to authenticated;

-- 2 bis. organization_members : les politiques n'autorisent que la lecture
-- (les mutations d'appartenance sont service-role, cf. migration 1) — les
-- droits de table doivent dire la même chose.
revoke all on table public.organization_members from authenticated;
grant select on table public.organization_members to authenticated;

-- 3. reasoning_steps : la trace de raisonnement est en lecture seule pour le
-- client. L'écriture reste réservée au pipeline (RPC definer).
drop policy if exists reasoning_steps_member_access on public.reasoning_steps;

create policy reasoning_steps_select_member
on public.reasoning_steps
for select
to authenticated
using (public.is_organization_member(organization_id));

revoke all on table public.reasoning_steps from authenticated;
grant select on table public.reasoning_steps to authenticated;

-- 4. persist_completed_assessment est exposée à `authenticated` : un client
-- pouvait l'appeler en direct et créer des dossiers sans passer par le quota
-- de la route HTTP. Le plafond est désormais appliqué au niveau de la donnée :
-- au plus 5 évaluations créées par utilisateur par heure glissante, quel que
-- soit le chemin d'écriture. Aligné sur consume_assessment_quota (5/heure) :
-- le parcours légitime (quota consommé par la route avant le pipeline) ne peut
-- pas atteindre ce plafond ; seul un appel direct de la RPC le déclenche.
-- Les écritures service_role (auth.uid() absent) ne sont pas concernées.
create function public.enforce_assessment_creation_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  recent_count integer;
begin
  if current_user_id is null then
    return new;
  end if;

  select count(*)
  into recent_count
  from public.assessments
  where created_by = current_user_id
    and created_at > (clock_timestamp() - interval '1 hour');

  if recent_count >= 5 then
    raise exception 'assessment creation rate exceeded'
      using errcode = '54000',
        hint = 'Au plus 5 évaluations par utilisateur et par heure, tous chemins confondus.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_assessment_creation_rate() from public;
revoke all on function public.enforce_assessment_creation_rate() from anon;
revoke all on function public.enforce_assessment_creation_rate() from authenticated;

create trigger assessments_creation_rate
before insert on public.assessments
for each row
execute function public.enforce_assessment_creation_rate();

commit;
