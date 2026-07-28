# Preuvance

[![CI](https://github.com/Milouuuuuuuu/Preuvance/actions/workflows/ci.yml/badge.svg)](https://github.com/Milouuuuuuuu/Preuvance/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-informational.svg)](LICENSE)

**Décrivez votre IA. Preuvance bâtit le dossier, preuve par preuve.**

> **L’article 50 de l’EU AI Act devient applicable le 2 août 2026.** Preuvance transforme chaque déclaration d’usage de l’IA en **preuve révisable**, et repère le « shadow AI » que vous avez oublié de déclarer. Là où les outils GRC déclarent sans vérifier et les scanners observent sans cadre déclaratif (Armilla, Munich Re, Insured AI souscrivent encore sur simple déclaration), Preuvance **mesure l’écart entre le déclaré et l’observé** : une déclaration corroborée, pas une déclaration sur l’honneur.

Preuvance est un environnement français de préparation au règlement européen sur l’IA pour PME et small mid-caps. À partir d’une description en langage courant (enrichie facultativement par un digest de dépendances et un scan local expurgé), il construit un **dossier de maîtrise IA instantané, vivant et traçable** : faits structurés, classification, écarts, score déterministe, registre de preuves et PDF destiné à une première conversation avec un courtier ou un investisseur.

Preuvance ne délivre ni avis juridique, ni certification, ni décision d’assurabilité.

## Décision Step 0

Le nom initial **Aplomb** a été rejeté après recherche : les trois domaines visés sont enregistrés et une entreprise homonyme intervient déjà en gouvernance IA et réglementaire. **Preuvance** a été retenu à **86/100**. Les contrôles RDAP sont favorables mais l’achat du domaine et la recherche EUIPO/TMview restent à effectuer avant lancement public.

Le détail des sources est dans [`docs/research.md`](docs/research.md). Pour une présentation simple, sans jargon technique, de tout ce que fait Preuvance : [`docs/preuvance-en-clair.md`](docs/preuvance-en-clair.md).

Le cadrage de démonstration et les hypothèses de valorisation sont tenus dans le dossier interne du projet, hors du dépôt.

## Vision livrée : « dossier instantané »

1. l’utilisateur identifie l’organisation et le système, puis le décrit librement ;
2. il peut joindre des manifestes connus (`package.json`, `package-lock.json`, `requirements*.txt`) : ils sont lus dans le navigateur et seul un digest IA borné est transmis ;
3. un scan local peut aussi être relié, après consentement, sous forme de compteurs et de verdict agrégés, jamais avec les chemins, IP ou noms de processus ;
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
npm run poste:verifier   # état du poste : versions, clés présentes/absentes, pièges connus
npm run dev
```

La procédure de mise en ligne, les secrets à créer et les vérifications
d’après-déploiement sont dans [`docs/deploiement.md`](docs/deploiement.md).
Un thème nuit public, discret et opt-in, est disponible via la pastille en
bas de page.

En développement, renseigner au minimum `OPENAI_API_KEY`. Sans cette clé, l’interface reste accessible mais refuse explicitement de produire une évaluation ; aucun résultat fictif n’est généré. En production, Supabase doit aussi être configuré afin d’éviter un endpoint OpenAI anonyme.

Supabase est activé lorsque `NEXT_PUBLIC_SUPABASE_URL` et une clé publique (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, ou l’ancienne `NEXT_PUBLIC_SUPABASE_ANON_KEY`) sont présentes. Dans ce mode, une session est requise et l’évaluation, son rapport et son journal de raisonnement sont enregistrés ensemble. Les secrets ne doivent jamais être commités.

L’analyse produit (PostHog) est optionnelle et suit la même règle : sans `NEXT_PUBLIC_POSTHOG_KEY`, aucun script n’est chargé et aucun événement n’est envoyé. Lorsqu’elle est activée, seuls des événements nommés et des métadonnées agrégées (score, palier, nombre de manifestes ou de pièces vérifiées) sont transmis, jamais la description du système, le nom de l’organisation ni le contenu d’une preuve ; `autocapture` et l’enregistrement de session restent désactivés. Le catalogue des événements, les funnels et le provisionnement des tableaux de bord (`npm run analytics:setup`) sont documentés dans [`docs/analytics.md`](docs/analytics.md).

Le référencement technique est servi par l’application elle-même : `robots.txt` et `sitemap.xml` dynamiques, canonique et description par page publique, JSON-LD strictement factuel, sans note, avis ni décompte inventés.

### Démonstration locale

Après `npm run dev` :

- `http://localhost:3000/` : produit complet ;
- `http://localhost:3000/demo` : dossier Northstar fictif, sans compte, clé API ni appel modèle ;
- `http://localhost:3000/build-week` : diaporama interactif 16:9, navigable au clavier avec `←`, `→`, `Home` et `End` ;
- `http://localhost:3000/scan` : lecture locale d’un rapport de scan et handoff expurgé vers le dossier.

La route `/demo` sert aussi un [dossier PDF Northstar](public/downloads/preuvance-northstar-demo.pdf) généré depuis le même contrat strict. Cette démonstration est explicitement fictive : elle illustre les états du registre sans prétendre à un nouvel appel GPT-5.6 ni à une provenance modèle absente.

Le mode présentation utilise le film procédural propre dans `public/media/preuvance-proof-film.mp4`. Les clips Veo trouvés dans les téléchargements sont volontairement exclus : ils portent un filigrane visible et des artefacts textuels incompatibles avec une soumission crédible. Voir [`docs/animation-review.md`](docs/animation-review.md).

### Migration du registre vivant

Pour la persistance cloud, appliquer les migrations Supabase dans l’ordre, dont :

```text
supabase/migrations/202607200001_evidence_dossier.sql
```

Cette migration crée le registre canonique, reprend les preuves historiques, ajoute l’historique d’événements et la révision optimiste, puis ferme les mutations directes sensibles sur `assessments`. Tant qu’elle n’est pas appliquée, le registre fonctionne localement dans le navigateur mais l’historique cloud n’est pas annoncé comme actif. Procédure : [`docs/backend-setup.md`](docs/backend-setup.md).

## Téléchargements Windows

Deux archives distinctes sont servies depuis `public/downloads/`, toutes deux produites par `scripts/build-local-download.ps1` :

| Archive | Taille | Prérequis | Sert à |
| --- | --- | --- | --- |
| `preuvance-scan.zip` | ~10 Ko | Windows PowerShell 5.1+ | scanner le poste, rien d’autre |
| `preuvance-local.zip` | ~3 Mo | PowerShell + Node.js 22.13+ + clé API OpenAI | faire tourner l’application complète en local |

L’archive de scan est le téléchargement mis en avant (bouton d’en-tête, bande d’acquisition de l’accueil, étape 01 de `/scan`) : elle ne contient que `SCANNER_PREUVANCE.cmd`, `scripts/preuvance-scan.ps1` et son `LISEZ-MOI.txt`. Aucune installation, aucun compte, aucune clé, aucun droit administrateur. Le script de scan est autonome à l’exécution — son catalogue de fournisseurs est en dur, et son alignement avec `lib/scan/scan-contract.ts` est vérifié par les tests, pas au lancement.

Les deux archives sont couvertes par `tests/local-download.test.ts`, qui vérifie l’allowlist du packager, la nature réelle des ZIP et le plafond de taille de l’archive de scan : si elle se met à embarquer l’application, le test échoue avant la mise en ligne.

Après extraction de `preuvance-local.zip`, trois points d’entrée :

- **`LANCER_PREUVANCE.cmd`** lance l’application web locale : vérifie PowerShell et Node.js `22.13.0+`, demande la clé OpenAI sans l’afficher, exécute `npm ci` puis le build, démarre Vinext sur `127.0.0.1` et ouvre le navigateur ;
- **`SCANNER_PREUVANCE.cmd`** lance le scan local (aucune clé API requise) : scan rapide ou surveillance réseau d’une heure ;
- **`DESINSTALLER_PREUVANCE.cmd`** : nettoyage propre (clé API, caches, dépendances, rapports) ou suppression complète.

Aucun de ces scripts ne demande les droits administrateur. Détail du lancement dans [`docs/local-launch.md`](docs/local-launch.md), du scan dans [`docs/preuvance-scan.md`](docs/preuvance-scan.md).

## Scan local complémentaire et concordance déclaré / observé

Le scan local (`scripts/preuvance-scan.ps1`) se télécharge seul en 10 Ko (`preuvance-scan.zip`) et tourne entièrement sur le poste, avec consentement, sans rien envoyer sur Internet :

- **déclaration d’usage d’IA** recueillie avant le scan (interactif ou `-DeclaredProviders openai,anthropic`) ;
- **profil** personnel ou professionnel (domaine / Entra ID) ;
- **inventaire des fichiers sensibles** par nom/extension, avec empreinte SHA-256, **sans copier ni lire le contenu** ;
- **détection « shadow AI »** : appels réseau vers des API d’IA connues, par nom d’hôte (jamais par plage d’IP, qui donnerait des faux positifs), avec un mode surveillance d’une heure ;
- **concordance déclaré / observé** : l’observation corrobore ou contredit la déclaration ; on obtient ainsi une déclaration corroborée plutôt qu’une déclaration sur l’honneur (esprit de l’art. L113-2 du Code des assurances). Un usage observé hors déclaration est un écart de sincérité, critique.

Le rapport `preuvance-scan.json` se charge dans la page **« Scanner en local »**, lue dans le navigateur (aucun upload), qui affiche le verdict de concordance et un **score d’exposition déterministe**. Les fonctions pures du script sont couvertes par des autotests (`-SelfTest`) intégrés à la chaîne de tests, avec un garde-fou qui interdit toute dérive entre le catalogue PowerShell et `lib/scan/scan-contract.ts`. Détail et limites dans [`docs/preuvance-scan.md`](docs/preuvance-scan.md).

## Diagnostic complet des sources de données (v2)

Le scan répond à « quels outils d’IA tournent sur les postes ». Le **diagnostic
complet** répond à la question d’avant : *quelles données existent, dans quels
systèmes, avec quels champs sensibles, et par quels flux elles sortent*. C’est
l’inventaire manuel (des semaines d’allers-retours) remplacé par une collecte
machine, pour tenir une restitution en **10 jours ouvrés**.

- **Agent local** (`scripts/preuvance-inventory.ts`) : connecteurs en lecture
  seule vers SQL générique (PostgreSQL, MySQL, SQL Server), fichiers CSV/XLSX,
  Dolibarr et Salesforce. Métadonnées seulement (structures, volumétries,
  dates), **jamais une valeur métier**.
- **Mode « remise au DBA »** : `--dry-run` imprime les requêtes de lecture seule
  et le script de compte à créer. L’équipe du client les exécute, rend des CSV,
  et le diagnostic se produit **sans qu’aucun accès direct ne soit ouvert**.
- **Catalogue unique par client** (`preuvance-catalogue-v1`) : contrat strict,
  unicité et intégrité référentielle vérifiées, mention de confidentialité
  littérale.
- **Diagnostic déterministe** : six axes pondérés, constats gradués rattachés à
  un fondement (RGPD, AI Act), et des **plafonds de score** quand la collecte est
  incomplète ou qu’un constat critique existe ; une absence d’observation n’est
  jamais convertie en bonne nouvelle.
- **Cartographie des flux** en Mermaid, où le trait plein (observé) ne se
  confond jamais avec le pointillé (déclaré en entretien).
- **Fiches de réversibilité par outil** (`preuvance-reversibility-v1`) : pour
  Salesforce, Dolibarr, HubSpot, Google Workspace, Microsoft 365 et Notion, le
  rapport cite le mécanisme d’export documenté par l’éditeur, la procédure de
  suppression en fin de contrat (art. 28-3-g RGPD) et le chemin de remise en
  local. Un outil sans fiche produit un constat « à établir avec l’éditeur »,
  jamais une procédure supposée.
- **Restitution** : rapport Markdown et page HTML autonome imprimable en PDF,
  rendus depuis un modèle unique, générés dans le navigateur sur la page
  [`/diagnostic`](app/diagnostic/page.tsx), sans aucun envoi.
- **Fin de mission** : `--purge` calcule l’empreinte SHA-256 de chaque artefact
  avant suppression et remet un journal vérifiable par le client.

```bash
npm run inventaire:demo                                        # mission fictive versionnée
npm run inventaire -- --mission mission.json --dry-run         # pack de requêtes
npm run inventaire -- --mission mission.json --out sortie      # collecte et diagnostic
npm run inventaire -- --mission mission.json --out sortie --purge
```

Architecture et matrice des connecteurs :
[`docs/preuvance-v2-diagnostic.md`](docs/preuvance-v2-diagnostic.md). Pack
d’accès client (comptes de lecture seule, DPA, réversibilité) :
[`docs/pack-acces.md`](docs/pack-acces.md). Runbook des équipes terrain :
[`docs/operateur-diagnostic.md`](docs/operateur-diagnostic.md).

## Environnement administratif d’une mission

Une mission produit six documents : lettre de mission, checklist du pack
d’accès, contrat de sous-traitance (art. 28 RGPD), registre des traitements
(art. 30.2), facture et attestation de fin de mission. Ils sont **dérivés du
même profil administratif et du même fichier de mission**, donc ils ne peuvent
pas se contredire.

- Les mentions fiscales viennent d’un tableau de règles sourcé, indexé par le
  couple (régime de TVA de l’émetteur, pays du client) : franchise en base,
  régime réel français, TVA suisse. Chaque règle cite son article et son lien ;
  une combinaison non couverte rend un avertissement bloquant au lieu d’un taux
  deviné.
- Les montants sont tenus en centimes entiers : le devis et la facture ne
  peuvent pas diverger d’un centime.
- Le pack d’accès et le registre reprennent les sources réelles du fichier de
  mission ; l’attestation reprend les empreintes SHA-256 du journal de purge et
  la liste des accès à révoquer.
- Chaque document sort en Markdown et en HTML autonome imprimable en PDF, sans
  script ni ressource distante.

```bash
npm run admin:demo                                             # profil et mission fictifs
npm run admin -- --profil profil.json --mission mission.json   # les six documents
npm run admin -- --profil profil.json --emettre facture --numero PV-2026-0007
```

Détail des documents, du profil et du moteur de mentions :
[`docs/admin-mission.md`](docs/admin-mission.md).

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

**GPT-5.6 (runtime de l’évaluation).** Chaque évaluation appelle l’API Responses d’OpenAI avec un JSON Schema strict (`strict: true`, généré depuis Zod) pour l’extraction factuelle, la classification et l’analyse des écarts. Les modèles utilisés sont `gpt-5.6-sol` (raisonnement, décisions réglementaires) et `gpt-5.6-luna` (tâches économiques), sans substitution silencieuse. Le modèle **réellement retourné** est enregistré par étape dans la méthodologie du rapport (`resolvedModels`) ; l’interface n’affiche jamais un simple libellé codé en dur. Le LLM ne rend jamais seul le verdict : un moteur de règles déterministe (`app/lib/assessment/rules.ts`) contre-vérifie chaque classification et plafonne le score en cas de contradiction.

**Codex (environnement d’ingénierie de la Build Week).** Le workstream « dossier instantané » a été construit et vérifié dans Codex : audit de l’architecture existante, implémentation du registre de preuves vivant et de ses invariants d’intégrité (`lib/evidence/`), scan borné des manifestes de dépendances et handoff de scan expurgé (`lib/scan/`), persistance canonique sous RLS (`supabase/migrations/202607200001_evidence_dossier.sql`), tests ciblés, documentation et préparation de la candidature. L’intégration de la portabilité SQLite/PostgreSQL (rédigée via Codex/GPT-5) et la branche `codex/hackathon-remotion` en font partie ; les conventions d’agents sont dans [`AGENTS.md`](AGENTS.md).

**Codex Session ID** (thread principal, via `/feedback`) : `019f7c5f-4963-7413-8675-dd19e35c25fd`. La séparation vérifiable entre le socle antérieur et les ajouts Build Week est dans [`docs/build-week-change-log.md`](docs/build-week-change-log.md).

## OpenAI Build Week 2026

Le paquet de candidature est préparé pour la catégorie **Work & Productivity** sous le titre :

> **Preuvance: Instant AI Assurance, Evidence by Evidence**

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
- agent local d’inventaire (`lib/inventory/`) : plans de requêtes en lecture seule pilotés par un exécuteur injectable, connecteurs fichiers et API sans dépendance ajoutée, catalogue client sous contrat strict ;
- moteur de diagnostic déterministe à six axes, avec plafonds de score quand la collecte est incomplète ;
- documents administratifs de mission dérivés d’un profil unique, avec moteur de mentions fiscales sourcé (`lib/admin/`) ;
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

Corrections, scan local et durcissement qualité des 13-14 juillet 2026. La revue de l’audit externe **ChatGPT 5.6** figure dans [`docs/revue-audit-externe.md`](docs/revue-audit-externe.md) : son analyse est attribuée à son auteur.

Vision « dossier instantané », registre preuve par preuve et paquet OpenAI Build Week du 20 juillet 2026 : **ChatGPT 5.6, OpenAI**.
