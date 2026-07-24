# Runbook opérateur — diagnostic complet en 10 jours ouvrés

Ce document s'adresse à l'**équipe qui exécute la mission chez le client**, pas
à l'auteur du produit. Il doit suffire : si une étape exige d'appeler le
développeur, c'est un défaut à corriger dans l'outil, pas dans la procédure.

Prérequis sur le poste d'exécution : Node.js 22.13 ou plus récent, le dépôt
Preuvance installé (`npm ci`), et le pack d'accès rempli
([`docs/pack-acces.md`](pack-acces.md)).

## Vue d'ensemble

| Jours | Étape | Responsable |
| --- | --- | --- |
| J1-J2 | Kickoff, pack d'accès, checklist des systèmes | Commercial + client |
| J3-J5 | Déploiement de l'agent, scan IA + inventaire des sources | Équipe terrain |
| J6-J8 | Analyse, deux entretiens métier d'une heure | Expert + commercial |
| J9-J10 | Restitution : diagnostic, plan de transition, proposition | Commercial |

Le délai ne tient que si le pack d'accès est **prêt avant** le kickoff.

## J1-J2 — cadrage

1. Remplir la checklist des systèmes avec le client (annexe 1 du pack d'accès).
2. Faire signer le DPA et le périmètre.
3. Choisir le mode de collecte par source : accès direct, ou remise au DBA.
4. Poser les deux créneaux d'entretien métier au calendrier, tout de suite.

Sortie attendue : un fichier de mission rempli, sans aucun secret dedans.

```jsonc
{
  "configVersion": "preuvance-mission-v1",
  "mission": { "client": "…", "reference": "…", "mode": "metadata_only" },
  "sources": [ /* une entrée par système du périmètre */ ],
  "tools": [ /* les outils déclarés en entretien */ ],
  "flows": [ /* les circulations déclarées */ ]
}
```

Partir de [`demo/diagnostic/mission.json`](../demo/diagnostic/mission.json) et
remplacer. Les identifiants sont **toujours** des noms de variables
d'environnement (`tokenEnv`, `apiKeyEnv`), jamais des valeurs.

## J3-J5 — collecte

### 1. Scan de dépendances IA (module 1)

Sur un échantillon représentatif de postes, en recueillant la déclaration
d'usage **avant** le scan :

```powershell
powershell -ExecutionPolicy Bypass -File scripts/preuvance-scan.ps1 -WatchMinutes 60
```

Récupérer le `preuvance-scan.json` et le référencer dans la mission via
`aiScanReportPath`. Seul son digest agrégé rejoint le catalogue.

### 2. Vérifier le plan avant de toucher aux bases

```bash
npm run inventaire -- --mission mission.json --dry-run --out sortie
```

Le fichier `sortie/requetes-lecture-seule.sql` contient exactement ce qui sera
exécuté. Le montrer au DBA : c'est le meilleur argument pour obtenir l'accès —
ou pour qu'il exécute lui-même les requêtes.

### 3. Collecter

```bash
npm run inventaire -- --mission mission.json --out sortie
```

L'agent affiche, source par source, son état et le nombre d'objets lus. Lire
cette sortie : `unreachable` ou `partial` signale un accès à compléter **pendant**
J3-J5, pas à la restitution.

### 4. Contrôles avant analyse

- Le score est-il plafonné ? Le motif dit ce qui manque.
- Une source majeure est-elle `unreachable` ? La débloquer maintenant.
- Le nombre de champs sensibles est-il vraisemblable ? Un ERP sans aucun champ
  personnel détecté signale des noms de colonnes opaques — c'est un sujet
  d'entretien, pas un bon résultat.

## J6-J8 — analyse et entretiens

Ouvrir `sortie/diagnostic-preuvance.md` ou charger
`sortie/preuvance-catalogue.json` dans la page `/diagnostic`.

Deux entretiens d'une heure, avec un ordre du jour dicté par le diagnostic :

**Entretien 1 — métier (commercial, administratif)**

- confirmer les 10 jeux de données les plus volumineux : à quoi servent-ils ?
- valider ou infirmer les champs sensibles signalés en confiance moyenne ;
- recueillir les **flux** : qui exporte quoi, vers quel outil, à quelle
  fréquence, avec ou sans données personnelles ;
- lister les outils d'IA réellement utilisés, y compris les usages personnels
  tolérés.

**Entretien 2 — technique (DSI, prestataire, éditeur)**

- confirmer l'hébergement de chaque outil et l'existence d'un export complet ;
- vérifier le hachage des colonnes de secrets signalées ;
- statuer sur les données dormantes : purge, archivage, ou durée de conservation
  à inscrire au registre.

Chaque élément recueilli est ajouté aux `tools` et `flows` du fichier de
mission avec `"evidence": "declared"`, puis l'agent est relancé. Le rapport
distinguera toujours ce qui a été observé de ce qui a été déclaré.

## J9-J10 — restitution

1. Relancer l'agent une dernière fois après intégration des entretiens.
2. Ouvrir `diagnostic-preuvance.html` et l'imprimer en PDF depuis le navigateur.
3. Structurer la réunion dans l'ordre du rapport : score et plafonds, couverture,
   constats critiques, cartographie, plan de transition.
4. Remettre le catalogue JSON au client : c'est **sa** base, réutilisable pour
   personnaliser ses outils.
5. Lancer la purge et remettre le journal :

```bash
npm run inventaire -- --mission mission.json --out sortie --purge
```

6. Faire révoquer les comptes de lecture seule et archiver la preuve.

## Ce qu'il ne faut jamais faire

- Présenter un score sans son plafond et son motif : il serait faux.
- Transformer un constat déclaré en constat observé pour « faire plus solide ».
- Laisser une source injoignable disparaître de la restitution.
- Ajouter une valeur métier au catalogue, même « juste pour illustrer ».
- Écrire un mot de passe ou un jeton dans le fichier de mission.
- Promettre une mise en conformité : le diagnostic prépare, il ne certifie pas.

## Dépannage

| Symptôme | Cause fréquente | Geste |
| --- | --- | --- |
| `Étape « tables » impossible` | le compte ne voit pas le catalogue système | ajouter `VIEW DEFINITION` (SQL Server) ou `USAGE` sur le schéma (PostgreSQL) |
| `Étape facultative « foreign_keys » non exécutée` | droits partiels | acceptable : la cartographie interne sera moins fine, la note l'écrit |
| Dolibarr : `Descripteur Swagger indisponible` | versions 15 à 18 connues pour l'erreur | passer par le connecteur SQL sur les tables `llx_` |
| Salesforce : volumétrie absente | droit « View Setup and Configuration » manquant | demander le droit, ou assumer `unknown` dans le rapport |
| Fichier de mission refusé | un secret y a été écrit | le retirer, utiliser `tokenEnv` / `apiKeyEnv` |
| Aucun fichier trouvé pour une source fichier | chemin relatif mal résolu | les chemins sont relatifs **au fichier de mission** |
