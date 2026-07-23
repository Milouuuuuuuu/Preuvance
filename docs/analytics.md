# Analytics produit (PostHog)

Preuvance mesure l'usage du produit avec PostHog pour répondre à trois questions : où les visiteurs abandonnent-ils avant d'obtenir un dossier, le scan local amène-t-il des évaluations complètes, et où le pipeline échoue-t-il. L'instrumentation est optionnelle : sans `NEXT_PUBLIC_POSTHOG_KEY`, tout appel du module [`lib/analytics/posthog.ts`](../lib/analytics/posthog.ts) est un no-op, côté serveur comme côté client (même logique que `OPENAI_API_KEY` et Supabase — cf. D-020, D-024).

## Contrat de confidentialité (D-087)

Aucun texte libre saisi par l'utilisateur ne quitte le navigateur via l'analytics. Jamais :

- la description du système à évaluer ;
- le nom de l'organisation ;
- le contenu, les titres ou les noms de fichiers des preuves ;
- le contenu des manifestes de dépendances ou du rapport de scan.

Ce qui **est** envoyé, exclusivement : des noms d'événements fixes et des métadonnées structurées ou agrégées — compteurs (`itemCount`, `descriptionLength` : une longueur, pas le texte), scores numériques, statuts et codes issus d'énumérations internes (`code`, `stage`, `tier`, `persistenceStatus`), booléens (`hasScanDigest`, `persisted`) et le chemin de la route pour `$pageview`.

La configuration du client renforce ce contrat : `autocapture` désactivé (aucune capture automatique de clics ou de champs de formulaire), `disable_session_recording`, `respect_dnt`, `person_profiles: "identified_only"`. Les captures pilotables à distance (`capture_heatmaps`, `capture_dead_clicks`, `rageclick`, `capture_exceptions`) sont épinglées à `false` dans le code : la configuration distante du projet PostHog ne peut pas les réactiver à notre insu. Enfin, un hook `before_send` expurge les identifiants de dossier de toute URL transmise (`/dossiers/<uuid>` devient `/dossiers/[id]`), y compris dans le `$pageleave` émis automatiquement par le SDK.

## Catalogue des événements

| Événement | Propriétés | Déclencheur | Fichier source |
| --- | --- | --- | --- |
| `$pageview` | `$current_url` (expurgé : `/dossiers/[id]`) | Chaque changement de route (capture manuelle, `capture_pageview: false`) | `app/components/PostHogProvider.tsx` |
| `$pageleave` | `$current_url` (expurgé via `before_send`) | Départ de page, émis par le SDK (`capture_pageleave: true`) | `lib/analytics/posthog.ts` |
| `assessment_form_started` | — | Première interaction avec le formulaire d'évaluation | `app/components/AssessmentForm.tsx` |
| `assessment_started` | `hasDependencyDigest`, `hasScanDigest`, `descriptionLength` | Soumission du formulaire, avant l'appel au pipeline | `app/components/AssessmentExperience.tsx` |
| `assessment_stage_reached` | `stage` | Progression du pipeline d'analyse (extraction, classification, …) | `app/components/AssessmentExperience.tsx` |
| `assessment_failed` | `code`, `status` | Échec du pipeline (code d'erreur interne + statut HTTP) | `app/components/AssessmentExperience.tsx` |
| `assessment_completed` | `score`, `tier`, `confidence`, `evidenceCount` | Affichage des résultats d'une évaluation aboutie | `app/components/AssessmentResults.tsx` |
| `evidence_ledger_updated` | `itemCount`, `verifiedCount` | Modification d'un élément du registre de preuves | `app/components/AssessmentResults.tsx` |
| `evidence_saved` | `itemCount`, `verifiedCount`, `persisted` | Enregistrement du registre de preuves | `app/components/AssessmentResults.tsx` |
| `report_pdf_downloaded` | `persistenceStatus` | Téléchargement réussi du rapport PDF | `app/components/AssessmentResults.tsx` |
| `report_pdf_failed` | `persistenceStatus` | Échec de génération ou de téléchargement du PDF | `app/components/AssessmentResults.tsx` |
| `dependency_manifest_attached` | `manifestCount`, `aiPackageCount` | Manifestes de dépendances analysés et rattachés | `app/components/DependencyManifestLoader.tsx` |
| `scan_report_loaded` | `exposureScore` | Chargement d'un rapport de scan local valide | `app/components/ScanReportLoader.tsx` |
| `scan_digest_handoff` | `exposureScore` | Transmission du digest de scan vers l'évaluation | `app/components/ScanReportLoader.tsx` |
| `local_zip_download_clicked` | — | Clic sur le téléchargement du `.zip` Preuvance Local (en-tête et pied de l'accueil, étape 01 du scan) | `app/page.tsx`, `app/scan/page.tsx` |
| `demo_pdf_download_clicked` | — | Clic sur le dossier d'exemple (démo) | `app/demo/page.tsx` |

Toute nouvelle propriété doit passer le filtre D-087 : nombre, booléen, ou valeur issue d'une énumération contrôlée par le code — jamais une chaîne construite à partir d'une saisie utilisateur.

## Hôtes : ingestion vs API privée

PostHog expose deux familles d'hôtes qu'il ne faut jamais confondre :

- **Ingestion** (`us.i.posthog.com` / `eu.i.posthog.com`) : reçoit les événements du SDK navigateur avec la clé projet `phc_...`. C'est la valeur de `NEXT_PUBLIC_POSTHOG_HOST` (défaut du code : `https://us.i.posthog.com`, la région du projet Preuvance).
- **API privée** (`us.posthog.com` / `eu.posthog.com`) : sert l'API REST authentifiée par une clé personnelle `phx_...` — c'est elle qu'utilise le script de provisionnement (`POSTHOG_API_HOST`, défaut : `https://us.posthog.com`).

Pointer le SDK vers l'API privée (ou le script vers un hôte d'ingestion) échoue. Choisir la région de son projet PostHog et rester cohérent : projet EU → `eu.i.posthog.com` pour l'ingestion **et** `POSTHOG_API_HOST=https://eu.posthog.com` pour le script.

## Configuration d'environnement

Dans `.env.local` — jamais commitée (cf. `AGENTS.md` : les secrets restent dans `.env.local`) :

```dotenv
# Exposées au navigateur : la clé phc_ n'est pas un secret, elle n'autorise que l'ingestion.
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Réservées au script de provisionnement : jamais de préfixe NEXT_PUBLIC_.
POSTHOG_PERSONAL_API_KEY=phx_...
POSTHOG_PROJECT_ID=12345                 # optionnel : sinon le premier projet accessible est utilisé
POSTHOG_API_HOST=https://us.posthog.com  # ou https://eu.posthog.com selon la région du projet
```

La clé personnelle `phx_...` se crée dans PostHog → Settings → Personal API Keys ; elle donne accès en écriture aux tableaux de bord et ne doit jamais atteindre le navigateur ni le dépôt.

## Provisionner les tableaux de bord

```bash
node --env-file=.env.local scripts/posthog-setup.mjs
```

Le script [`scripts/posthog-setup.mjs`](../scripts/posthog-setup.mjs) (Node 22, aucune dépendance) est **idempotent** : il recherche chaque tableau de bord et chaque insight par nom et ne crée que ce qui manque — le relancer ne produit aucun doublon. Il refuse une clé `phc_` avec un message explicite, affiche le projet détecté si `POSTHOG_PROJECT_ID` est absent, imprime l'URL de chaque tableau de bord à la fin, et sort en code 1 en affichant statut HTTP et corps de réponse à la moindre erreur d'API.

## Vérifier l'ingestion avec curl

Envoyer un événement de test directement à l'hôte d'ingestion (clé projet `phc_...`, pas la clé personnelle) :

```bash
curl --ssl-no-revoke -s -X POST "https://us.i.posthog.com/i/v0/e/" \
  -H "Content-Type: application/json" \
  -d '{"api_key":"phc_VOTRE_CLE","event":"ingestion_check","distinct_id":"setup-verification","properties":{"source":"curl"}}'
```

Réponse attendue : `{"status": 1}`. L'événement apparaît ensuite dans PostHog → Activity (délai de quelques secondes). Adapter l'hôte à la région du projet (`eu.i.posthog.com` pour un projet EU).

Note Windows : dans le bac à sable de Claude Code, la vérification de révocation des certificats échoue — l'option `--ssl-no-revoke` est nécessaire pour que `curl` aboutisse. Elle est propre à `curl` sous Windows (Schannel) et sans objet sous Linux/macOS.

## Les quatre tableaux de bord

Créés par le script, tous sur une fenêtre de 30 jours :

### 1. Preuvance — Vue d'ensemble

Quatre courbes de tendance : visiteurs uniques (`$pageview`, utilisateurs uniques), évaluations lancées (`assessment_started`), évaluations terminées (`assessment_completed`), PDF téléchargés (`report_pdf_downloaded`).

### 2. Preuvance — Funnel dossier

Funnel en cinq étapes ordonnées, fenêtre de conversion de 14 jours :

`$pageview` → `assessment_form_started` → `assessment_started` → `assessment_completed` → `report_pdf_downloaded`

Il mesure le parcours complet, de la première visite au rapport téléchargé, et localise l'étape d'abandon dominante.

### 3. Preuvance — Source scan local

Funnel en quatre étapes, fenêtre de 14 jours :

`scan_report_loaded` → `scan_digest_handoff` → `assessment_started` → `assessment_completed`

Il isole la conversion propre au parcours scan local : combien de rapports chargés deviennent des digests transmis, puis des évaluations complètes.

### 4. Preuvance — Qualité & risques

Quatre tendances : `assessment_failed` ventilé par propriété `code` ; `assessment_stage_reached` ventilé par `stage` (où le pipeline s'arrête) ; `assessment_completed` ventilé par `tier` ; moyenne de la propriété `score` sur `assessment_completed`.
