---
name: supabase-local-verify
description: Procédure D-088 — vérifier les migrations et le RLS Supabase en local sur ce poste Windows : démarrage Docker Desktop, npx supabase start, test d'isolation deux tenants (persist_completed_assessment, sync_assessment_evidence, révisions optimistes), pièges connus (db reset, certificat pg-delta, Docker qui fait échouer les tests Vite) et teardown complet.
---

# supabase-local-verify — procédure D-088

Vérification locale des 4 migrations et de l'isolation RLS multi-tenant.
À dérouler après toute modification sous `supabase/migrations/`.

## 1. Prérequis : Docker Desktop

Docker Desktop doit tourner. Sinon :

```powershell
Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
docker info
```

Relancer `docker info` jusqu'à obtenir une réponse sans erreur
(compter 30 à 60 s de démarrage du démon).

## 2. Démarrage et migrations

```powershell
npx supabase start
```

Applique les 4 migrations dans l'ordre : `202607130001_preuvance_core`,
`202607130002_persist_assessment`, `202607130003_assessment_rate_limit`,
`202607200001_evidence_dossier`.

- L'avertissement pg-delta « invalid peer certificate » au démarrage est
  **bénin** — l'ignorer.
- **PIÈGE** : `npx supabase db reset` peut casser la liaison de port du
  conteneur. Pour repartir de zéro, toujours :

```powershell
npx supabase stop --no-backup
npx supabase start
```

## 3. Test RLS deux tenants

Tout passe par psql dans le conteneur :

```powershell
docker exec -i supabase_db_aplomb-app psql -U postgres
```

(ou `Get-Content .\verif.sql -Raw | docker exec -i supabase_db_aplomb-app psql -U postgres`).

### 3a. Deux comptes, provisioning d'organisations

```sql
insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', 'tenant-a@test.local',
   '{"organization_name":"Tenant A"}'),
  ('22222222-2222-2222-2222-222222222222', 'tenant-b@test.local',
   '{"organization_name":"Tenant B"}');

select count(*) from public.organizations;
select count(*) from public.organization_members;
```

Attendu : 2 organisations et 2 memberships — le trigger
`auth_users_provision_preuvance` provisionne chaque compte.

### 3b. Persistance sous le tenant A

Le rôle et les claims JWT se posent **dans la transaction** :

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true);
select * from public.persist_completed_assessment(
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Tenant A', 'Système test', 'Description de test', 'industrie', 'form',
  '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, '{}'::jsonb,
  50, 'limited', '[]'::jsonb
);
commit;
```

Attendu : une ligne `(assessment_id, ai_system_id)`. Les erreurs `22023`
nomment précisément le champ rejeté si un payload doit être ajusté.

### 3c. Isolation : lecture et sync cross-tenant

Sous le tenant B (mêmes `set local` avec le sub `22222222-…`) :

```sql
select count(*) from public.assessments;
select public.sync_assessment_evidence(
  'aaaaaaaa-0000-0000-0000-000000000001', '[]'::jsonb, 0);
```

Attendu : `count = 0` (RLS masque tout), puis erreur
**`assessment not found`** — jamais une fuite de données ni un succès.

### 3d. Révisions optimistes (tenant A)

Les items d'evidence exigent **`id`, `sourceType` ET `updatedAt`** (en plus
de `control`, `status`, `detail`) :

```sql
select public.sync_assessment_evidence(
  'aaaaaaaa-0000-0000-0000-000000000001',
  '[{"id":"ev-verif-1","control":"Contrôle de test","status":"declared",
     "detail":"Vérification RLS locale","sourceType":"user-declaration",
     "updatedAt":"2026-07-23T00:00:00Z"}]'::jsonb,
  0);
```

Attendu : succès, la révision passe de 0 à 1 dans le JSON retourné.
Rejouer le même appel avec `p_expected_revision = 0` (désormais périmée) :

Attendu : erreur **`40001`** « evidence revision conflict ».

## 4. Teardown — obligatoire

```powershell
npx supabase stop --no-backup
taskkill /IM "Docker Desktop.exe" /F
```

Docker qui tourne ralentit les tests Vite au point de les faire échouer
(« Network connection lost ») : ne **jamais** relancer `npm test` avec
Docker Desktop ouvert. Avant de relancer la chaîne, tuer aussi les
processus node orphelins — en épargnant le processus Claude :

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -notmatch 'claude' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```
