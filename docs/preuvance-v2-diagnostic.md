# Preuvance v2 — du scan IA local au diagnostic complet

Ce document décrit le module **diagnostic complet** : l'inventaire des sources de
données du client, la cartographie de ses flux et le plan de transition chiffré.
Il complète le module 1 (scan de dépendances IA, voir
[`docs/preuvance-scan.md`](preuvance-scan.md)) sans le remplacer.

La promesse commerciale est un **diagnostic complet en 10 jours ouvrés**. Elle ne
tient que si l'inventaire est machine : c'est l'objet de ce module.

## 1. Ce que le module fait, et ce qu'il ne fait pas

| Il fait | Il ne fait pas |
| --- | --- |
| Lire les catalogues système (tables, colonnes, types, clés) | Lire une ligne de donnée métier |
| Compter les lignes via les statistiques du moteur | Garantir un comptage exact sans `COUNT(*)` explicite |
| Dater la dernière écriture (mode explicite, `MAX()` sur une colonne de date) | Lire une valeur métier pour deviner une date |
| Classer les champs sensibles d'après leur **nom** | Prouver qu'une colonne contient réellement des données personnelles |
| Distinguer flux observés et flux déclarés | Inventer un flux vraisemblable |
| Produire un score, des constats et un plan déterministes | Rendre un avis juridique ou une certification |

Règle héritée de la v1, non négociable : **la détection est déterministe, le
modèle de langage interprète**. Aucun constat, aucun score, aucune source
n'existe parce qu'un modèle l'a supposé.

## 2. Chaîne de traitement

```text
[fichier de mission]  (aucun secret : uniquement des noms de variables d'environnement)
        │
        ▼
[agent local]  scripts/preuvance-inventory.ts
        ├── connecteur SQL générique      lib/inventory/sql-introspection.ts
        ├── connecteur fichiers CSV/XLSX  lib/inventory/file-inventory.ts
        ├── connecteur Dolibarr           lib/inventory/connectors/dolibarr.ts
        ├── connecteur Salesforce         lib/inventory/connectors/salesforce.ts
        └── digest du scan IA v1          lib/scan/scan-handoff.ts
        │
        ▼
[catalogue client]  preuvance-catalogue.json   (contrat strict, validé)
        │
        ├── classification des champs sensibles   lib/inventory/sensitive-fields.ts
        ├── moteur de diagnostic déterministe     lib/inventory/diagnostic.ts
        ├── fiches de réversibilité par outil     lib/inventory/reversibility-playbooks.ts
        ├── cartographie des flux (Mermaid)       lib/inventory/flow-map.ts
        └── digest agrégé pour un modèle          lib/inventory/catalogue-digest.ts
        │
        ▼
[restitution]  diagnostic-preuvance.md · diagnostic-preuvance.html · page /diagnostic
```

Tout s'exécute sur le poste de l'opérateur ou du client. Rien n'est transmis à un
serveur Preuvance, à aucune étape — y compris la page `/diagnostic`, qui lit le
catalogue dans le navigateur.

## 3. Le catalogue client

Contrat : [`lib/inventory/catalogue-contract.ts`](../lib/inventory/catalogue-contract.ts),
version `preuvance-catalogue-v1`. Un catalogue invalide est rejeté, jamais
« réparé ».

- `mission` : client, référence, opérateur, mode de collecte, périmètre, DPA.
- `sources` : identité, type, emplacement expurgé, état de collecte
  (`collected` / `partial` / `unreachable`), notes de limite.
- `datasets` : tables, vues, feuilles, objets d'API. Chacun porte sa volumétrie
  **avec son origine** (`exact`, `estimate`, `unknown`) et la méthode utilisée.
- `datasets[].fields` : nom, type, nullabilité, clé primaire, référence, et
  l'étiquette de sensibilité produite par le classifieur.
- `tools` et `flows` : les outils en place et les circulations de données,
  chacun avec son **niveau de preuve** (`declared`, `observed_connector`,
  `observed_scan`).
- `aiScan` : le digest agrégé du scan de dépendances IA, quand il existe.
- `privacy` : mention littérale rappelant qu'aucune valeur métier n'y figure.

Deux garde-fous sont vérifiés à la validation : l'unicité des identifiants et
l'intégrité référentielle (un jeu de données ne peut pas citer une source
absente, un flux ne peut pas citer un outil absent).

## 4. Matrice des connecteurs

| Priorité | Source | Méthode | Volumétrie | Fraîcheur |
| --- | --- | --- | --- | --- |
| P0 | PostgreSQL | `pg_class` + `information_schema` | estimation `reltuples` | `MAX()` sur colonne de date (mode explicite) |
| P0 | MySQL / MariaDB | `information_schema` | estimation `TABLE_ROWS` | `UPDATE_TIME`, sinon `MAX()` |
| P0 | SQL Server | `sys.tables`, `sys.partitions`, `INFORMATION_SCHEMA` | `sys.partitions.rows` (approchée) | `MAX()` sur colonne de date |
| P0 | CSV / TSV | analyse locale | comptage exact des enregistrements | date de modification du fichier |
| P0 | XLSX / XLSM | lecture de l'archive (ZIP + XML) | lignes déclarées par la feuille | date de modification du fichier |
| P1 | Dolibarr | descripteur Swagger de l'explorateur d'API | non exposée par l'API → passer par SQL | non exposée |
| P1 | Salesforce | `describe global`, `describe`, `limits/recordCount` | approchée (calcul asynchrone Salesforce) | non exposée |

Les volumétries des moteurs SQL sont des **estimations** documentées comme
telles : `reltuples` dépend du dernier `VACUUM`/`ANALYZE`, `TABLE_ROWS` d'InnoDB
peut s'écarter fortement du réel. Le rapport le dit à chaque fois ; un chiffre
exact demande un `COUNT(*)` ciblé, décidé explicitement.

Discipline de périmètre : **un connecteur dédié ne se code que pour un client
signé.** P0 plus les exports couvrent la grande majorité des cas.

## 5. Trois façons de collecter, par ordre de friction croissante

1. **Résultats remis par le client** (`executor.type = "results"`) — l'agent
   imprime les requêtes (`--dry-run`), l'équipe du client les exécute, rend des
   fichiers CSV, l'agent les lit. *Aucune connexion, aucun compte à créer.*
   C'est souvent le chemin le plus rapide vers un premier diagnostic.
2. **Commande locale** (`executor.type = "command"`) — l'agent appelle le client
   en ligne de commande déjà présent chez le client (`psql`, `mysql`, `sqlcmd`)
   avec un compte de lecture seule. Aucun shell n'est utilisé : la commande et
   ses arguments sont passés tels quels, la requête remplace `{{sql}}` ou passe
   par l'entrée standard.
3. **API métier** (Dolibarr, Salesforce) — jeton de lecture fourni par une
   variable d'environnement, jamais écrit dans le fichier de mission.

Exemples d'exécuteurs :

```jsonc
// PostgreSQL, sortie CSV
{ "type": "command", "command": "psql",
  "args": ["-X", "--csv", "-h", "srv-erp", "-U", "preuvance_ro", "-d", "erp", "-c", "{{sql}}"],
  "format": "csv" }

// MySQL, sortie tabulée
{ "type": "command", "command": "mysql",
  "args": ["-h", "srv-erp", "-u", "preuvance_ro", "--batch", "--raw", "-D", "erp", "-e", "{{sql}}"],
  "format": "tsv" }
```

Le mot de passe n'apparaît jamais dans la mission : il est fourni par
l'environnement du poste (`PGPASSWORD`, `MYSQL_PWD`, fichier `.pgpass`…), sous
la responsabilité de l'opérateur.

**Un fichier de mission est du code, pas de la donnée** (D-109). Il déclenche
l'exécution d'un programme sur le poste de l'opérateur — celui qui détient les
accès en lecture de tous les clients. Depuis l'audit du 26 juillet 2026, seuls
les clients SQL de la liste blanche sont admis comme exécuteurs : `psql`,
`mysql`, `mariadb`, `sqlcmd`, `bcp`, `sqlite3`, par leur nom nu, sans chemin.
Un `powershell -c …` glissé dans un `mission.json` reçu par courriel est refusé
à la validation, avant toute exécution.

## 6. Classification des champs sensibles

[`lib/inventory/sensitive-fields.ts`](../lib/inventory/sensitive-fields.ts) —
version `preuvance-sensitivity-v1`.

Chaque règle a un identifiant, une catégorie, un niveau de confiance et un
fondement cité dans le rapport : identité, coordonnées, identifiant national,
données bancaires, gestion du personnel, catégories particulières (art. 9),
mineurs, secrets d'authentification, localisation.

Deux mécanismes évitent le rapport gonflé qui décrédibilise tout :

- **exclusions** — `nom_fichier`, `nom_produit`, `raison_sociale`,
  `empreinte_fichier`, `id_facture`… ne sont jamais comptés comme personnels ;
- **contexte du jeu de données** — un champ `nom` dans une table de produits ou
  de paramètres garde le signalement mais voit sa confiance abaissée, avec la
  raison écrite dans le rapport.

Limite assumée, imprimée dans chaque restitution : *un champ nommé `champ1`
contenant des NIR ne sera pas détecté.* La liste sert à cadrer l'entretien
métier, pas à le remplacer.

## 7. Score, plafonds et plan

[`lib/inventory/diagnostic.ts`](../lib/inventory/diagnostic.ts) — version
`preuvance-diagnostic-v1`.

Six axes pondérés : connaissance des sources (20), données personnelles (25),
sécurité et accès (20), dépendances IA (15), réversibilité (10), qualité et
fraîcheur (10). Chaque constat retire une pénalité fixe de son axe.

Le score pondéré est ensuite **plafonné**, comme le dossier de la v1 :

| Situation | Plafond |
| --- | --- |
| Au moins un constat critique | 59 |
| Trois constats majeurs ou plus | 74 |
| Aucun jeu de données inventorié malgré des sources déclarées | 35 |
| Objets connus mais aucune structure lue | 60 |
| Sources injoignables (≥ 50 % du périmètre) | 55 |
| Sources injoignables (moins de la moitié) | 75 |
| Aucun scan de dépendances IA rattaché | 85 |

Un plafond n'est pas une punition : c'est le refus de transformer une absence
d'observation en bonne nouvelle. Le rapport affiche toujours le calcul pondéré
avant plafonds, le plafond appliqué et son motif.

Le plan de transition découle mécaniquement des constats : gravité et charge
décident de la fenêtre (mise en sécurité S+0 à S+2, conformité documentaire
S+2 à S+6, transition et réversibilité S+6 à S+13). Les charges sont exprimées
en jours de travail, jamais en euros — le prix reste une décision commerciale.

## 8. Fiches de réversibilité par outil

[`lib/inventory/reversibility-playbooks.ts`](../lib/inventory/reversibility-playbooks.ts) —
version `preuvance-reversibility-v1`.

Le diagnostic sait dire « la donnée dépend d'un éditeur » ; le registre des
fiches dit **quoi faire, outil par outil** : le mécanisme d'export documenté
publiquement par l'éditeur, la procédure de suppression en fin de contrat
(art. 28-3-g RGPD) et le chemin de remise en local en formats relisibles.
Première version du registre : Salesforce, Dolibarr, HubSpot, Google Workspace,
Microsoft 365, Notion — les outils les plus fréquents en PME.

Trois règles, héritées du reste du produit :

- **une fiche ne cite que des mécanismes documentés par l'éditeur** — jamais
  une procédure supposée (même discipline que D-081) ;
- **la reconnaissance préfère la sous-couverture au faux positif** : un nom
  ambigu (`SharePoint Server 2019`, `Tableur d'équipe`) ne matche pas et
  produit un constat « procédure à établir avec l'éditeur » plutôt qu'une
  fiche fausse ;
- **une fiche est de la donnée, pas du code** : ajouter un outil au registre
  n'ouvre aucun accès et ne code aucun connecteur (la discipline D-100 reste
  entière).

Dans le diagnostic, une fiche reconnue produit un constat **à pénalité
nulle** — une sortie documentée n'est pas un défaut — dont la recommandation
est nominative : exécuter un export réel, chronométrer la restauration locale,
exiger la confirmation écrite de suppression. Un outil en ligne sans fiche
produit un constat pénalisé (art. 28-3-g) : l'absence de procédure de sortie
établie est, elle, un vrai risque. Le tout entre mécaniquement au plan de
transition et dans la section « Réversibilité par outil » des rapports.

## 9. Restitution

- `diagnostic-preuvance.md` : rapport Markdown, cartographie Mermaid incluse.
- `diagnostic-preuvance.html` : page autonome, sans script ni ressource externe,
  imprimable en PDF depuis le navigateur.
- Page [`/diagnostic`](../app/diagnostic/page.tsx) : le catalogue est chargé dans
  le navigateur, le diagnostic est recalculé côté client, les deux exports sont
  générés localement.
- `preuvance-catalogue-digest.json` : agrégats anonymes (compteurs, catégories,
  identifiants de règles) destinés à une interprétation par un modèle. Ni nom de
  client, ni nom de source, ni nom de table, ni emplacement.

Markdown et HTML sont rendus depuis un **modèle de rapport unique** : la version
commerciale ne peut pas diverger de la version technique.

## 10. Fin de mission

`--purge` calcule l'empreinte SHA-256 de chaque artefact **avant** de le
supprimer, puis écrit `journal-suppression.txt` et `journal-suppression.json`.
Le client peut ainsi vérifier ce qui a été produit, ce qui a été supprimé, et
qu'aucune copie ne subsiste ailleurs — une promesse de réversibilité qui se
vérifie plutôt qu'une promesse qui se répète.

## 11. Commandes

```bash
npm run inventaire -- --mission chemin/mission.json --out chemin/sortie
npm run inventaire -- --mission chemin/mission.json --dry-run   # requêtes à remettre au client
npm run inventaire -- --mission chemin/mission.json --out chemin/sortie --purge
npm run inventaire -- --self-test
npm run inventaire:demo                                          # mission fictive versionnée
```

La mission de démonstration ([`demo/diagnostic/`](../demo/diagnostic/)) est
entièrement fictive : elle sert aux essais, aux démonstrations commerciales et
aux tests, jamais à illustrer un client réel.
