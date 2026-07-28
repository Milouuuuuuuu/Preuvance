# Pack d'accès : le livrable qui tient le délai de 10 jours

Le facteur limitant d'un diagnostic n'est pas la technique : c'est l'attente des
accès. Identifiants à créer, validations internes, interlocuteur en congés : c'est
là que deux semaines deviennent deux mois.

Le pack d'accès est donc traité comme un **livrable commercial à part entière**,
remis et signé **avant** le kickoff. Ce document en est le gabarit.

## 1. Ce que le client doit préparer avant J1

| # | Élément | Qui | Délai visé |
| --- | --- | --- | --- |
| 1 | Liste des systèmes au périmètre (nom, éditeur, hébergement, référent) | Client | J-5 |
| 2 | Compte de lecture seule par base, ou accord pour le mode « remise au DBA » | DSI / DBA | J-3 |
| 3 | Jeton d'API en lecture pour les outils métier retenus | Administrateur de l'outil | J-3 |
| 4 | Chemin des dossiers d'exports (CSV/Excel) et droit de lecture | Métier | J-3 |
| 5 | DPA signé et périmètre écrit | Direction | J-3 |
| 6 | Deux créneaux d'1 h avec les métiers, posés au calendrier | Client | J-1 |
| 7 | Poste d'exécution de l'agent (poste opérateur ou VM du client) | Conjoint | J-1 |

Un élément manquant ne bloque pas la mission : il devient une **source
injoignable**, écrite comme telle dans le rapport et plafonnant le score. C'est
la manière la plus efficace de rendre l'attente visible.

## 2. Périmètre de lecture, en clair pour un non-technicien

L'agent lit :

- les **catalogues système** des bases : noms de tables, de colonnes, types,
  clés, statistiques de volumétrie ;
- les **en-têtes** des fichiers d'export, leur nombre de lignes et leur date ;
- les **descripteurs d'API** des outils métier (liste des objets et de leurs
  champs) ;
- éventuellement, si le mode « métadonnées et fraîcheur » est explicitement
  retenu, une valeur agrégée `MAX(colonne_de_date)` par table, pour dater la
  dernière écriture.

L'agent ne lit pas :

- aucune ligne de donnée métier, aucune valeur de cellule ;
- aucun contenu de document ;
- aucun secret : les mots de passe et jetons restent dans l'environnement du
  poste, jamais dans le fichier de mission, jamais dans le catalogue.

Cette liste est vérifiée par des tests automatisés : les plans de requêtes ne
contiennent que des `SELECT` sur les catalogues système, et le catalogue produit
est comparé aux valeurs des fichiers inventoriés pour vérifier qu'aucune n'y
figure.

## 3. Comptes de lecture seule à créer

Scripts générés par l'agent (`--dry-run`), à exécuter par le DBA du client. Le
mot de passe est choisi par le client et n'est jamais transmis dans un document.

**PostgreSQL**

```sql
CREATE ROLE preuvance_ro LOGIN PASSWORD '<mot_de_passe_genere_par_le_client>';
GRANT CONNECT ON DATABASE <base> TO preuvance_ro;
GRANT USAGE ON SCHEMA public TO preuvance_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO preuvance_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO preuvance_ro;
```

**MySQL / MariaDB**

```sql
CREATE USER 'preuvance_ro'@'%' IDENTIFIED BY '<mot_de_passe_genere_par_le_client>';
GRANT SELECT ON <base>.* TO 'preuvance_ro'@'%';
```

**SQL Server**

```sql
CREATE LOGIN preuvance_ro WITH PASSWORD = '<mot_de_passe_genere_par_le_client>';
USE <base>;
CREATE USER preuvance_ro FOR LOGIN preuvance_ro;
ALTER ROLE db_datareader ADD MEMBER preuvance_ro;
GRANT VIEW DEFINITION TO preuvance_ro;
```

Révocation en fin de mission : les ordres correspondants figurent en commentaire
dans le fichier généré. **La révocation fait partie de la mission**, elle n'est
pas laissée à l'initiative du client.

### Outils métier

- **Dolibarr** : utilisateur dédié en lecture, clé d'API générée depuis sa fiche
  (en-tête `DOLAPIKEY`), module « API REST » activé.
- **Salesforce** : profil en lecture seule ; la volumétrie approchée exige le
  droit « View Setup and Configuration ». Commencer par une sandbox quand elle
  existe.

## 4. Si le client ne veut ouvrir aucun accès

Mode **remise au DBA**, prévu nativement :

1. l'opérateur lance `npm run inventaire -- --mission mission.json --dry-run` ;
2. le fichier `requetes-lecture-seule.sql` est remis au DBA du client : il ne
   contient que des `SELECT` sur les catalogues système, lisibles et vérifiables ;
3. le DBA les exécute et rend un fichier par étape (`tables.csv`, `columns.csv`,
   `primary_keys.csv`, `foreign_keys.csv`) ;
4. l'agent les lit avec `executor.type = "results"` : aucune connexion n'est
   ouverte, le diagnostic est produit normalement.

C'est souvent le chemin le plus court : il supprime la création de compte, donc
la validation interne qui coûte des semaines.

## 5. Clauses à faire figurer au contrat

- **Finalité** : établir l'inventaire des sources de données et des dépendances
  IA en vue d'un plan de transition. Aucune autre exploitation.
- **Périmètre** : liste nominative des systèmes (annexe 1), modifiable par avenant
  écrit uniquement.
- **Nature des données traitées** : métadonnées techniques. Le catalogue peut
  contenir des noms de colonnes évoquant des données personnelles ; il ne
  contient aucune donnée personnelle elle-même.
- **Localisation** : exécution sur un poste désigné, sous contrôle du client.
  Aucun transfert vers un serveur de l'opérateur, aucun sous-traitant.
- **Durée de conservation** : les artefacts sont supprimés à la restitution ;
  le journal de suppression horodaté et empreinté est remis au client.
- **Réversibilité** : le catalogue et le rapport sont remis en formats ouverts
  (JSON, Markdown, HTML). Aucun format propriétaire, aucune dépendance à un
  service pour les relire.
- **Sous-traitance** : si un opérateur tiers exécute l'agent, il est désigné
  nommément et soumis aux mêmes obligations (art. 28 RGPD).

## 6. Vérification en fin de mission

À la restitution, l'opérateur remet :

1. le rapport de diagnostic (Markdown et HTML imprimable) ;
2. le catalogue JSON, propriété du client ;
3. le journal de suppression, avec pour chaque artefact sa taille, son empreinte
   SHA-256 et son sort ;
4. la preuve de révocation des comptes de lecture seule.

Le client peut recalculer l'empreinte d'un fichier qu'il détient et la comparer
au journal. Une promesse d'effacement qui ne se vérifie pas ne vaut rien.
