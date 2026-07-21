# Preuvance

[![CI](https://github.com/Milouuuuuuuu/Preuvance/actions/workflows/ci.yml/badge.svg)](https://github.com/Milouuuuuuuu/Preuvance/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-informational.svg)](LICENSE)

**Décrivez votre IA. Preuvance bâtit le dossier — preuve par preuve.**

> **L’article 50 de l’EU AI Act devient applicable le 2 août 2026.** Preuvance transforme chaque déclaration d’usage de l’IA en **preuve révisable** — et repère le « shadow AI » que vous avez oublié de déclarer. Là où les outils GRC déclarent sans vérifier et les scanners observent sans cadre déclaratif (Armilla, Munich Re, Insured AI souscrivent encore sur simple déclaration), Preuvance **mesure l’écart entre le déclaré et l’observé** — une déclaration corroborée, pas une déclaration sur l’honneur.

Preuvance est un environnement français de préparation au règlement européen sur l’IA pour PME et small mid-caps. À partir d’une description en langage courant — enrichie facultativement par un digest de dépendances et un scan local expurgé — il construit un **dossier de maîtrise IA instantané, vivant et traçable** : faits structurés, classification, écarts, score déterministe, registre de preuves et PDF destiné à une première conversation avec un courtier ou un investisseur.

Preuvance ne délivre ni avis juridique, ni certification, ni décision d’assurabilité.

## Décision Step 0

Le nom initial **Aplomb** a été rejeté après recherche : les trois domaines visés sont enregistrés et une entreprise homonyme intervient déjà en gouvernance IA et réglementaire. **Preuvance** a été retenu à **86/100**. Les contrôles RDAP sont favorables mais l’achat du domaine et la recherche EUIPO/TMview restent à effectuer avant lancement public.

Le détail des sources est dans [`docs/research.md`](docs/research.md). Toutes les décisions et leur note sur 100 sont consignées dans [`BEHAVIOR.md`](BEHAVIOR.md). Pour une présentation simple, sans jargon technique, de tout ce que fait Preuvance : [`docs/preuvance-en-clair.md`](docs/preuvance-en-clair.md).

Le cadrage de démonstration, la note hackathon et les hypothèses de valorisation sont dans [`docs/HACKATHON_2026_VALORISATION.md`](docs/HACKATHON_2026_VALORISATION.md).

## Vision livrée : « dossier instantané »

1. l’utilisateur identifie l’organisation et le système, puis le décrit librement ;
2. il peut joindre des manifestes connus (`package.json`, `package-lock.json`, `requirements*.txt`) : ils sont lus dans le navigateur et seul un digest IA borné est transmis ;
3. un scan local peut aussi être relié, après consentement, sous forme de compteurs et de verdict agrégés — jamais avec les chemins, IP ou noms de processus ;
4. GPT-5.6 extrait les faits, classe le risque et propose les écarts dans des schémas stricts ; les identifiants de modèles réellement retournés sont conservés ;
5. un moteur de règles contre-vérifie la classification, puis calcule le score et ses plafonds de façon déterministe ;
6. chaque élément de `evidenceNeeded[]` devient une ligne propre du registre : **manquante → déclarée → détectée/documentée → attestée** ;
7. une pièce n’est jamais promue automatiquement : l’état attesté exige un relecteur et une date, et reste explicitement distinct d’une certification externe ;
8. le dossier peut être repris, enrichi, exporté en manifeste JSON et rendu en PDF ; Supabase ajoute RLS, historique d’événements et contrôle de concurrence lorsque les variables sont configurées.

La **couverture documentaire** affichée par le registre est indépendante du score réglementaire. Le SHA-256 d’un fichier démontre son intégrité, pas sa véracité.

Documentation détaillée : [`docs/dossier-instantane.md`](docs/dossier-instantane.md), [`docs/evidence-ledger.md`](docs/evidence-ledger.md) et [`docs/dependency-scan.md`](docs/dependency-scan.md).

## Contrainte réglementaire importante

Au **13 juillet 2026**, l’Omnibus IA est adopté et signé, mais encore en attente de publication au Journal officiel de l’Union européenne. L’application sépare donc :

- le droit actuellement contraignant issu du règlement (UE) 2024/1689 ;
- les dates futures prévues par l’Omnibus, clairement marquées comme non encore en vigueur.

La référence structurée, et non la mémoire du modèle, est injectée dans chaque classification.

## Configuration locale

Prérequis : Node.js 22.13 ou plus récent.

```bash
cp .env.example .env.local
npm install
npm run dev
```

En développement, renseigner au minimum `OPENAI_API_KEY`. Sans cette clé, l’interface reste accessible mais refuse explicitement de produire une évaluation ; aucun résultat fictif n’est généré. En production, Supabase doit aussi être configuré afin d’éviter un endpoint OpenAI anonyme.

Supabase est activé lorsque `NEXT_PUBLIC_SUPABASE_URL` et une clé publique (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, ou l’ancienne `NEXT_PUBLIC_SUPABASE_ANON_KEY`) sont présentes. Dans ce mode, une session est requise et l’évaluation, son rapport et son journal de raisonnement sont enregistrés ensemble. Les secrets ne doivent jamais être commités.

### Démonstration locale

Après `npm run dev` :

- `http://localhost:3000/` — produit complet ;
- `http://localhost:3000/build-week` — diaporama interactif 16:9, navigable au clavier avec `←`, `→`, `Home` et `End` ;
- `http://localhost:3000/scan` — lecture locale d’un rapport de scan et handoff expurgé vers le dossier.

Le mode présentation utilise le film procédural propre dans `public/media/preuvance-proof-film.mp4`. Les clips Veo trouvés dans les téléchargements sont volontairement exclus : ils portent un filigrane visible et des artefacts textuels incompatibles avec une soumission crédible. Voir [`docs/animation-review.md`](docs/animation-review.md).

### Migration du registre vivant

Pour la persistance cloud, appliquer les migrations Supabase dans l’ordre, dont :

```text
supabase/migrations/202607200001_evidence_dossier.sql
```

Cette migration crée le registre canonique, reprend les preuves historiques, ajoute l’historique d’événements et la révision optimiste, puis ferme les mutations directes sensibles sur `assessments`. Tant qu’elle n’est pas appliquée, le registre fonctionne localement dans le navigateur mais l’historique cloud n’est pas annoncé comme actif. Procédure : [`docs/backend-setup.md`](docs/backend-setup.md).

## Téléchargement Windows one shot

Le bouton « Télécharger la version locale » sert `public/downloads/preuvance-local.zip`. Après extraction, trois points d’entrée :

- **`LANCER_PREUVANCE.cmd`** — lance l’application web locale : vérifie PowerShell et Node.js `22.13.0+`, demande la clé OpenAI sans l’afficher, exécute `npm ci` puis le build, démarre Vinext sur `127.0.0.1` et ouvre le navigateur ;
- **`SCANNER_PREUVANCE.cmd`** — lance le scan local (aucune clé API requise) : scan rapide ou surveillance réseau d’une heure ;
- **`DESINSTALLER_PREUVANCE.cmd`** — nettoyage propre (clé API, caches, dépendances, rapports) ou suppression complète.

Aucun de ces scripts ne demande les droits administrateur. Détail du lancement dans [`docs/local-launch.md`](docs/local-launch.md), du scan dans [`docs/preuvance-scan.md`](docs/preuvance-scan.md).

## Scan local complémentaire et concordance déclaré / observé

Le scan local (`scripts/preuvance-scan.ps1`) tourne entièrement sur le poste, avec consentement, sans rien envoyer sur Internet :

- **déclaration d’usage d’IA** recueillie avant le scan (interactif ou `-DeclaredProviders openai,anthropic`) ;
- **profil** personnel ou professionnel (domaine / Entra ID) ;
- **inventaire des fichiers sensibles** par nom/extension, avec empreinte SHA-256, **sans copier ni lire le contenu** ;
- **détection « shadow AI »** : appels réseau vers des API d’IA connues, par nom d’hôte (jamais par plage d’IP, qui donnerait des faux positifs), avec un mode surveillance d’une heure ;
- **concordance déclaré / observé** : l’observation corrobore ou contredit la déclaration — une déclaration corroborée plutôt qu’une déclaration sur l’honneur (esprit de l’art. L113-2 du Code des assurances). Un usage observé hors déclaration est un écart de sincérité, critique.

Le rapport `preuvance-scan.json` se charge dans la page **« Scanner en local »**, lue dans le navigateur (aucun upload), qui affiche le verdict de concordance et un **score d’exposition déterministe**. Les fonctions pures du script sont couvertes par des autotests (`-SelfTest`) intégrés à la chaîne de tests, avec un garde-fou qui interdit toute dérive entre le catalogue PowerShell et `lib/scan/scan-contract.ts`. Détail et limites dans [`docs/preuvance-scan.md`](docs/preuvance-scan.md).

## Boîte à outils de portabilité des données

La page **« Portabilité »** présente `sqlite-postgres-bridge`, un outil MIT séparé
qui traduit SQL dans les deux sens et convertit une base `.sqlite` en dump
PostgreSQL, entièrement hors ligne. Son mode `--dry-run` ne produit aucun SQL et
renvoie le code 2 dès qu’une action manuelle reste nécessaire. Les dumps sont
chargés en CI dans de vrais PostgreSQL 14 et 18.

Cette brique reste volontairement distincte du cœur réglementaire de Preuvance :
elle ne déduit ni le sens métier, ni les permissions, ni les politiques RLS et
n’importe jamais automatiquement une base arbitraire dans Supabase. Code source :
[`sqlite-postgres-bridge`](https://github.com/Milouuuuuuuu/sqlite-postgres-bridge).

## Construit avec Codex & GPT-5.6

Preuvance combine un raisonnement génératif borné et des garde-fous déterministes ; les deux technologies imposées par la Build Week ont un rôle réel et distinct.

**GPT-5.6 (runtime de l’évaluation).** Chaque évaluation appelle l’API Responses d’OpenAI avec un JSON Schema strict (`strict: true`, généré depuis Zod) pour l’extraction factuelle, la classification et l’analyse des écarts. Les modèles utilisés sont `gpt-5.6-sol` (raisonnement, décisions réglementaires) et `gpt-5.6-luna` (tâches économiques), sans substitution silencieuse. Le modèle **réellement retourné** est enregistré par étape dans la méthodologie du rapport (`resolvedModels`) — l’interface n’affiche jamais un simple libellé codé en dur. Le LLM ne rend jamais seul le verdict : un moteur de règles déterministe (`app/lib/assessment/rules.ts`) contre-vérifie chaque classification et plafonne le score en cas de contradiction.

**Codex (environnement d’ingénierie de la Build Week).** Le workstream « dossier instantané » a été construit et vérifié dans Codex : audit de l’architecture existante, implémentation du registre de preuves vivant et de ses invariants d’intégrité (`lib/evidence/`), scan borné des manifestes de dépendances et handoff de scan expurgé (`lib/scan/`), persistance canonique sous RLS (`supabase/migrations/202607200001_evidence_dossier.sql`), tests ciblés, documentation et préparation de la candidature. L’intégration de la portabilité SQLite/PostgreSQL (décisions **D-069** et **D-070** du registre, rédigées via Codex/GPT-5) et la branche `codex/hackathon-remotion` en font partie ; les conventions d’agents sont dans [`AGENTS.md`](AGENTS.md).

**Codex Session ID** (thread principal, via `/feedback`) : `019f7c5f-4963-7413-8675-dd19e35c25fd`. La séparation vérifiable entre le socle antérieur et les ajouts Build Week est dans [`docs/build-week-change-log.md`](docs/build-week-change-log.md).

## OpenAI Build Week 2026

Le paquet de candidature est préparé pour la catégorie **Work & Productivity** sous le titre :

> **Preuvance — Instant AI Assurance, Evidence by Evidence**

Livrables :

- guide de soumission et checklist propriétaire : [`docs/OPENAI_BUILD_WEEK_2026.md`](docs/OPENAI_BUILD_WEEK_2026.md) ;
- copie Devpost anglaise prête à adapter : [`docs/BUILD_WEEK_SUBMISSION_COPY.md`](docs/BUILD_WEEK_SUBMISSION_COPY.md) ;
- narration et plan de tournage de 2 min 45 s : [`docs/DEMO_SCRIPT_BUILD_WEEK.md`](docs/DEMO_SCRIPT_BUILD_WEEK.md) ;
- séparation vérifiable entre socle antérieur et ajouts Build Week : [`docs/build-week-change-log.md`](docs/build-week-change-log.md) ;
- deck PowerPoint : [`outputs/preuvance-openai-build-week.pptx`](outputs/preuvance-openai-build-week.pptx) (régénérable via `scripts/build-week-deck.mjs`) ;
- diaporama exécutable : `/build-week`.

Échéance officielle : **mardi 21 juillet 2026 à 17:00 PT**, soit **mercredi 22 juillet 2026 à 02:00 à Paris**. Les actions qui restent nécessairement au propriétaire sont : rejoindre le Devpost, confirmer équipe/éligibilité, choisir dépôt public + licence ou partage privé, récupérer le Session ID via `/feedback`, enregistrer et publier la vidéo YouTube avec audio, puis valider la soumission finale. Aucune de ces actions externes n’est simulée par le dépôt.

## Vérification

```bash
npm test
```

`npm test` enchaîne lint, `tsc --noEmit`, tests unitaires, build de production et tests HTTP sous Workerd. La même chaîne s’exécute en CI (`.github/workflows/ci.yml`) sur chaque push et pull request. Les étapes restent disponibles séparément : `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`.

## Architecture

- Next App Router, React, TypeScript strict, Tailwind ;
- page d’accueil rendue côté serveur, interactions isolées dans un îlot client ;
- dates réglementaires de la page dérivées du référentiel JSON, sans duplication (test anti-dérive) ;
- API Responses OpenAI avec JSON Schema strict ;
- registre de preuves partagé entre UI, rapport PDF et persistance ;
- scan navigateur borné des dépendances IA et handoff local expurgé ;
- moteur de règles déterministe (`preuvance-crosscheck-v1`) en contre-vérification de chaque classification ;
- score et tiers calculés de façon déterministe ;
- PDF serveur via `@react-pdf/renderer` ;
- Supabase Auth/Postgres/RLS ;
- quota atomique de cinq démarrages d’évaluation par utilisateur et par heure ;
- PDF persistant relu sous RLS à partir de son identifiant, jamais forgé depuis le navigateur ;
- registre cloud canonique avec événements, normalisation serveur et révision optimiste ;
- runtime Sites/Vinext compatible Cloudflare Worker.

## Extension locale « System Exposure »

Le prompt d’extension machine suppose un autre socle qui n’est pas présent dans ce workspace : un CLI Python/Typer/Rich avec une commande `aplomb scan` déjà validée trois fois. Preuvance ne simule donc aucun accès PowerShell depuis le navigateur. Le gate, la vérification des cmdlets Windows et la stratégie de reprise sont consignés dans [`docs/preuvance-machine-gate.md`](docs/preuvance-machine-gate.md).

## Périmètre volontairement exclu

Pas d’intégration assureur réelle, de tarification, de paiement, de générateur Annexe IV complet, de monitoring continu ni de promesse de couverture. Le scan des manifestes n’est pas un SCA exhaustif ; le statut « Prouvé / attesté » n’est pas une certification ; la migration Supabase doit être appliquée et testée sur une instance de staging avant toute annonce de persistance cloud en production.

---

Corrections, scan local et durcissement qualité des 13-14 juillet 2026 (D-042 à D-062 de [`BEHAVIOR.md`](BEHAVIOR.md)) rédigés par **Claude (Fable 5), Anthropic**. La revue de l’audit externe **ChatGPT 5.6** figure dans [`docs/revue-audit-externe.md`](docs/revue-audit-externe.md) : son analyse est attribuée à son auteur, et la documentation n’est pas signée sous une autre identité que celle qui l’a rédigée.

Vision « dossier instantané », registre preuve par preuve et paquet OpenAI Build Week du 20 juillet 2026 : **ChatGPT 5.6, OpenAI**.
