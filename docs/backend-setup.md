# Backend PREUVANCE

Cette couche ajoute trois briques isolées : génération du rapport PDF, session Supabase SSR et stockage multi-tenant protégé par RLS.

## Dépendances et runtime

Les modules utilisent les paquets officiels suivants, déjà épinglés dans `package.json` :

```bash
npm install @react-pdf/renderer @supabase/ssr @supabase/supabase-js
```

La route PDF n’utilise ni système de fichiers, ni processus enfant, ni API native exotique. Sous Node, elle fonctionne directement. Sous Cloudflare Workers, `@react-pdf/renderer@4.5.1` demande deux adaptations, car workerd interdit la compilation dynamique du WASM et Vinext applique par défaut la condition `react-server` au reconciler React.

Le projet contient le binaire Yoga statique et son loader dans `lib/pdf/yoga.wasm` et `lib/pdf/yoga-load-worker.ts`, avec l’alias `yoga-layout/load` correspondant dans Vite. Le plugin `build/react-pdf-worker-plugin.ts` résout aussi l’import `react` de `@react-pdf/reconciler` vers l’export client standard de React, uniquement pour cet importer. React ne doit jamais être aliasé globalement : cela casserait les Server Components. Cette configuration a été vérifiée sous le runtime local workerd avec une réponse PDF binaire réelle.

## Variables d’environnement

```dotenv
# Exposées au navigateur : la sécurité repose sur la RLS, pas sur le secret de cette clé.
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

# Repli accepté pour les anciens projets Supabase.
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Recommandé en production pour construire les redirections canoniques.
NEXT_PUBLIC_APP_URL=https://app.example.com
```

Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` dans une variable `NEXT_PUBLIC_*`. Le code applicatif livré ici n’a pas besoin de la clé service role.

Sans URL ou clé publique Supabase, les helpers retournent `null`, l’écran `/auth/sign-in` explique que l’authentification est indisponible et la route PDF reste utilisable en mode démonstration. Dès que Supabase est configuré, `POST /api/reports/pdf` exige une session valide.

## Base de données et Auth

Appliquer dans l’ordre [`supabase/migrations/202607130001_preuvance_core.sql`](../supabase/migrations/202607130001_preuvance_core.sql), [`supabase/migrations/202607130002_persist_assessment.sql`](../supabase/migrations/202607130002_persist_assessment.sql), puis [`supabase/migrations/202607200001_evidence_dossier.sql`](../supabase/migrations/202607200001_evidence_dossier.sql) avec le CLI Supabase ou depuis le SQL Editor :

```bash
supabase db push
```

Configurer ensuite dans Supabase Auth :

- l’URL du site (`NEXT_PUBLIC_APP_URL`) ;
- `http://localhost:3000/auth/callback` dans les URLs de redirection locales ;
- `https://VOTRE_DOMAINE/auth/callback` dans les URLs de redirection de production ;
- un fournisseur e-mail opérationnel pour les magic links.

Le trigger `auth_users_provision_preuvance` crée une organisation à chaque nouvel utilisateur. Le nom vient, dans l’ordre, de `organization_name`, de `full_name`, du préfixe e-mail, puis de « Mon organisation ». La contrainte unique sur `organization_members.user_id` impose une seule organisation par compte. Une organisation peut contenir plusieurs `ai_systems`.

Les clés étrangères composites imposent aussi en base qu’un assessment appartienne à la même organisation que son système IA, et qu’une étape de raisonnement appartienne à la même organisation que son assessment. La RLS filtre chaque lecture et mutation selon `auth.uid()`. Les clients authentifiés ne peuvent pas modifier directement les memberships ; cette opération reste réservée au service role pour une future fonctionnalité d’invitation administrée.

La migration du dossier de preuves ajoute un registre multi-tenant, un journal avant/après, un ordre canonique et `assessments.evidence_revision`. Les comptes `authenticated` n’ont qu’un accès direct en lecture aux tables concernées. La mutation du registre passe par `sync_assessment_evidence`, qui vérifie l’appartenance, les invariants, la taille, les doublons et la révision attendue. Un client obsolète reçoit un conflit HTTP 409 via l’API au lieu d’écraser une version plus récente.

Lorsque Supabase est configuré, `POST /api/assessments` vérifie la session avant d’appeler le modèle. Une fois le pipeline terminé, la fonction RPC `persist_completed_assessment` met à jour le nom de l’organisation, crée ou réutilise le système IA, puis écrit l’assessment, son payload PDF et les quatre étapes de raisonnement dans une seule transaction PostgreSQL. Si la transaction échoue, l’API renvoie `PERSISTENCE_ERROR` au lieu d’annoncer à tort que le dossier a été conservé. Sans variables Supabase, le même flux reste disponible en mode démonstration avec `persistence.status = "disabled"`.

Les types TypeScript correspondants sont dans [`lib/supabase/database.types.ts`](../lib/supabase/database.types.ts). Après toute évolution de la migration, les régénérer avec le CLI Supabase et remplacer ce snapshot.

> État de livraison au 20 juillet 2026 : la migration est écrite et le contrat applicatif est typé, mais elle n’a pas été exécutée contre un projet Supabase de staging dans ce workspace. Ne présenter la persistance cloud comme opérationnelle qu’après `supabase db push`, test RLS avec deux organisations et test de conflit à deux onglets.

## Contrat PDF

`POST /api/reports/pdf` accepte uniquement `application/json`, limite le corps à 512 Ko, valide les longueurs, nombres, dates, listes, enums et URLs avec Zod, puis renvoie un vrai fichier `application/pdf`. Le rapport ne fabrique aucun résultat : score, classification, citations, écarts et preuves viennent tous du payload validé.

Exemple minimal :

```json
{
  "assessmentId": "assessment_01",
  "generatedAt": "2026-07-13T14:30:00.000Z",
  "lastRegulatoryVerification": "2026-07-13",
  "organization": {
    "name": "Entreprise exemple",
    "registrationCountry": "France",
    "employeeCount": 85,
    "annualRevenueEur": 12000000,
    "smcEligible": true
  },
  "system": {
    "name": "Assistant relation client",
    "description": "Assistant conversationnel qui répond aux questions des clients à partir de la documentation de l’entreprise.",
    "sector": "Services",
    "intendedUse": "Information et orientation des clients",
    "affectedPeople": "Clients de l’entreprise",
    "operatorRole": "Déployeur"
  },
  "result": {
    "score": 72,
    "tier": "B",
    "riskLevel": "limited",
    "confidence": 0.88,
    "executiveSummary": "Le système présente une exposition de transparence identifiable et des contrôles partiellement documentés."
  },
  "classification": {
    "rationale": "Le système interagit directement avec des personnes et doit être présenté comme un système d’IA.",
    "articles": [
      {
        "reference": "Article 50",
        "title": "Obligations de transparence",
        "finding": "L’utilisateur doit être informé qu’il interagit avec un système d’IA.",
        "deadline": "2 août 2026",
        "deadlineStatus": "Confirmé"
      }
    ]
  },
  "dimensions": [
    {
      "name": "Transparence",
      "score": 65,
      "finding": "La mention IA existe mais sa preuve de déploiement doit être conservée."
    }
  ],
  "gaps": [
    {
      "priority": "high",
      "title": "Formaliser la disclosure IA",
      "finding": "La mention n’est pas incluse dans la procédure de mise en production.",
      "recommendedAction": "Ajouter la mention visible et archiver sa validation dans la checklist de release.",
      "articleReferences": ["Article 50"],
      "dueDate": "Avant mise en production",
      "owner": "Product"
    }
  ]
}
```

Réponse de validation en erreur : `application/problem+json`, statut `400`, `413`, `415` ou `422`. Une erreur interne de rendu renvoie `500` sans exposer sa stack.

## Comportement intégré

1. La synthèse construit le payload du rapport avec le même résultat structuré que celui affiché dans l’UI. Le template PDF ne recalcule jamais le score.
2. La RPC persiste ce payload dans `assessments.report_payload`; l’interface transmet ensuite le même objet à `/api/reports/pdf` avec les cookies de session.
3. Côté navigateur, lire la réponse comme `Blob`, vérifier `response.ok`, puis créer une URL objet pour le téléchargement.
4. En cas de middleware de rafraîchissement de session ajouté ultérieurement, réutiliser `createServerSupabaseClient` et ne pas dupliquer la logique de cookies.
5. Si le schéma structuré partagé du pipeline évolue, adapter `validatePreuvanceAssessment` et le snapshot `Database` dans la même modification.

---

Mise à jour « dossier instantané », registre canonique et concurrence optimiste du 20 juillet 2026 : **ChatGPT 5.6, OpenAI**.
