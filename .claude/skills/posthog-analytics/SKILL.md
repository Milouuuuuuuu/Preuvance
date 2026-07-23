---
name: posthog-analytics
description: Instrumenter et vérifier PostHog sur Preuvance — module lib/analytics/posthog.ts, contrat D-087 (jamais de texte libre utilisateur), catalogue des événements existants, hôtes ingestion/API privée, vérification curl (piège --ssl-no-revoke sous Windows) et provisionnement des dashboards via scripts/posthog-setup.mjs.
---

# posthog-analytics — instrumentation PostHog de Preuvance

Référence opérationnelle pour ajouter, modifier ou vérifier l'analytics de
ce dépôt. La documentation complète (dashboards, funnels) vit dans
`docs/analytics.md` — la tenir à jour à chaque événement ajouté.

## 1. Le module — un seul point d'entrée

`lib/analytics/posthog.ts` exporte `trackEvent(name, props)` et
`trackPageview(path)`. Tout appel est un **no-op** sans
`NEXT_PUBLIC_POSTHOG_KEY` et côté serveur (`typeof window` vérifié) — ne
jamais appeler `posthog-js` directement ailleurs.
`app/components/PostHogProvider.tsx` initialise le client dans
`app/layout.tsx` et capture `$pageview` à chaque changement de route.
Config verrouillée : `autocapture: false`, `disable_session_recording`,
`respect_dnt`, `person_profiles: "identified_only"`.

## 2. Règle D-087 — jamais de texte libre utilisateur

Aucune propriété d'événement ne doit contenir du texte saisi par
l'utilisateur : ni description de système, ni nom d'organisation, ni
contenu/titre/nom de fichier de preuve. Autorisé exclusivement :

- compteurs et longueurs (`itemCount`, `descriptionLength` — une longueur,
  pas le texte) ;
- scores numériques et booléens (`hasScanDigest`, `persisted`) ;
- valeurs d'énumérations contrôlées par le code (`code`, `stage`, `tier`,
  `persistenceStatus`).

Avant tout `trackEvent`, se demander : « cette valeur peut-elle contenir un
caractère tapé par l'utilisateur ? » Si oui, la remplacer par un compteur,
un booléen ou un enum.

## 3. Catalogue des événements — ne pas dupliquer

| Événement | Propriétés |
| --- | --- |
| `$pageview` | `$current_url` (route) |
| `assessment_form_started` | — |
| `assessment_started` | `hasDependencyDigest`, `hasScanDigest`, `descriptionLength` |
| `assessment_stage_reached` | `stage` |
| `assessment_failed` | `code`, `status` |
| `assessment_completed` | `score`, `tier`, `confidence`, `evidenceCount` |
| `evidence_ledger_updated` | `itemCount`, `verifiedCount` |
| `evidence_saved` | `itemCount`, `verifiedCount`, `persisted` |
| `report_pdf_downloaded` | `persistenceStatus` |
| `report_pdf_failed` | `persistenceStatus` |
| `dependency_manifest_attached` | `manifestCount`, `aiPackageCount` |
| `scan_report_loaded` | `exposureScore` |
| `scan_digest_handoff` | `exposureScore` |
| `local_zip_download_clicked` | — |
| `demo_pdf_download_clicked` | — |

Avant d'ajouter un événement : vérifier ce tableau **et**
`docs/analytics.md` ; réutiliser un événement existant plutôt qu'en créer
un quasi-doublon. Tout ajout se répercute dans `docs/analytics.md`.

## 4. Hôtes et clés

Deux familles d'hôtes, à ne jamais confondre (projet en région **US**) :

- **Ingestion** : `https://us.i.posthog.com` — clé projet `phc_...`
  (SDK navigateur). Le défaut du code étant `eu.i.posthog.com`,
  `NEXT_PUBLIC_POSTHOG_HOST` doit être explicite.
- **API privée** : `https://us.posthog.com` — clé personnelle `phx_...`
  (script de provisionnement uniquement, jamais côté navigateur).

Dans `.env.local` — **jamais commité** :

```dotenv
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
POSTHOG_PERSONAL_API_KEY=phx_...
POSTHOG_PROJECT_ID=12345
```

## 5. Vérifier l'ingestion (curl)

```bash
curl --ssl-no-revoke -s -X POST "https://us.i.posthog.com/capture/" \
  -H "Content-Type: application/json" \
  -d '{"api_key":"phc_VOTRE_CLE","event":"ingestion_check","distinct_id":"verif-locale"}'
```

Attendu : `{"status": 1}` ; l'événement apparaît dans PostHog → Activity
après quelques secondes.

**Piège Windows** : dans le bac à sable de Claude Code, la vérification de
révocation des certificats échoue (`CRYPT_E_REVOCATION_OFFLINE`) —
`--ssl-no-revoke` est obligatoire pour que `curl` aboutisse. Option propre
à curl/Schannel sous Windows, sans objet sous Linux/macOS.

## 6. Dashboards et funnels

```powershell
node --env-file=.env.local scripts/posthog-setup.mjs
```

Exige `POSTHOG_PERSONAL_API_KEY` (`phx_...` — le script **refuse** une clé
projet `phc_`) et utilise `POSTHOG_PROJECT_ID` (sinon premier projet
accessible). Idempotent : recherche par nom, ne crée que ce qui manque ;
sort en code 1 avec statut HTTP et corps de réponse en cas d'erreur.
