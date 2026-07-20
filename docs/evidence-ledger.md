# Registre de preuves — contrat, statuts et révisions

## Objet

Le registre de preuves transforme la sortie ponctuelle d’une évaluation en dossier maintenable. Chaque ligne représente un contrôle à étayer, une observation technique ou une pièce attendue. Elle possède un identifiant stable, un état, une source, un détail et, lorsque disponible, des métadonnées d’intégrité et de revue.

Le registre est le lieu où Preuvance sépare explicitement :

- ce qui est **déclaré** par l’utilisateur ;
- ce qui est **détecté** par une source technique ;
- ce qui est **documenté** par une pièce référencée ;
- ce qui est **attesté** après une revue humaine déclarée.

Le terme interne du dernier statut est `verified`, mais l’interface l’affiche comme « Attesté · relecteur et date renseignés ». Cette formulation est volontaire : elle n’implique ni audit indépendant, ni signature qualifiée, ni certification.

## Contrat d’une ligne

Le schéma de référence se trouve dans `lib/evidence/evidence-ledger.ts`. Une ligne persistable comporte :

| Champ | Obligatoire | Limite | Sens |
|---|---:|---:|---|
| `id` | oui | 100 caractères | Identifiant unique dans un assessment |
| `control` | oui | 500 | Contrôle, observation ou pièce attendue |
| `status` | oui | enum | État courant |
| `detail` | oui | 1 500 | Contexte honnête de l’état |
| `gapId` | non | 80 | Lien vers l’écart d’origine |
| `articleReferences` | non | 12 valeurs de 100 | Articles hydratés depuis le référentiel |
| `owner` | non | 160 | Responsable déclaré |
| `sourceType` | oui dans le registre | enum | Nature de la source |
| `sourceLabel` | non | 240 | Libellé lisible de provenance |
| `fileName` | non | 240 | Nom local, sans fichier téléversé |
| `fileSizeBytes` | non | 25 000 000 | Taille du fichier pointé |
| `sha256` | conditionnel | 64 hex minuscules | Empreinte du fichier local |
| `collectedAt` | non | ISO 8601 | Date de collecte ou d’observation |
| `validUntil` | non | `AAAA-MM-JJ` | Échéance documentaire déclarée |
| `reviewedBy` | conditionnel | 160 | Relecteur déclaré |
| `reviewedAt` | conditionnel | ISO 8601 | Date de revue déclarée |
| `updatedAt` | oui dans le registre | ISO 8601 | Dernière modification de la ligne |

Le registre complet contient au maximum 120 lignes et interdit les doublons d’identifiant.

## Statuts complets

| Statut interne | Libellé produit | Interprétation autorisée | Couche de synthèse | Poids documentaire |
|---|---|---|---|---:|
| `missing` | Pièce manquante | Preuve attendue et absente | À fournir | 0,00 |
| `unverified` | Non vérifié | Situation insuffisamment vérifiée ; ne compte pas comme déclaration étayée | À fournir | 0,12 |
| `declared` | Déclaré · non vérifié | Contrôle mentionné par l’utilisateur, sans pièce vérifiée | Déclaré | 0,22 |
| `partial` | Partiellement étayé | Plusieurs éléments attendus, couverture incomplète | Détecté/étayé | 0,42 |
| `detected` | Détecté techniquement | Observation issue d’un scan ou d’un manifeste | Détecté/étayé | 0,50 |
| `documented` | Pièce disponible · à revoir | Métadonnées de document disponibles, revue non attestée | Détecté/étayé | 0,72 |
| `verified` | Attesté · relecteur et date renseignés | Revue humaine déclarée dans Preuvance | Prouvé/attesté | 1,00 |
| `not-applicable` | Non applicable | Contrôle explicitement hors périmètre | Hors périmètre | exclu |

La couche simplifiée affichée dans l’échelle est donc :

```text
À fournir ──> Déclaré ──> Détecté / documenté ──> Attesté
```

Cette flèche aide à lire la maturité documentaire ; elle n’autorise pas une transition automatique. Un package détecté ne devient pas une politique documentée. Une politique documentée ne devient pas attestée tant qu’un humain n’a pas renseigné sa revue.

## Invariants de confiance

### Attestation

Une ligne `verified` est rejetée si `reviewedBy` ou `reviewedAt` manque. La règle existe à trois niveaux :

- validation Zod dans le navigateur et sur l’API ;
- contrôle dans la fonction SQL d’écriture ;
- contrainte `assessment_evidence_verified_review_check` en base.

Changer le statut depuis `verified` vers un autre état efface les métadonnées de revue dans l’interface. Cette précaution évite de laisser croire qu’une attestation reste active après déclassement.

Le nom du relecteur reste une déclaration textuelle. Il ne prouve pas l’identité réelle, le mandat, l’indépendance ou la compétence du relecteur.

### Fichier local et empreinte

Si `fileName` ou `fileSizeBytes` est présent, un SHA-256 de 64 caractères hexadécimaux minuscules est obligatoire. L’interface :

1. lit le fichier avec `File.arrayBuffer()` ;
2. calcule l’empreinte avec `window.crypto.subtle.digest("SHA-256", ...)` ;
3. conserve uniquement nom, taille, hash et date de collecte ;
4. positionne l’état à `documented` ;
5. retire toute ancienne revue, car une nouvelle pièce doit être relue.

Le fichier est limité à 25 Mo côté interface et schéma. Son contenu ne quitte pas le navigateur. Le hash sert à la reconnaissance d’intégrité, pas à prouver l’authenticité, la date certaine, l’auteur ou la pertinence.

### Identifiants et déterminisme

Les lignes initiales utilisent `stableEvidenceId(assessmentId, control, index)`, une empreinte FNV-1a courte combinée à la position. Cet identifiant est stable pour une même entrée, mais n’est ni un identifiant cryptographique ni une preuve d’intégrité.

Les lignes ajoutées manuellement utilisent `crypto.randomUUID()` lorsqu’il est disponible. L’unicité dans un même registre est validée par Zod et par la clé primaire composée `(assessment_id, id)`.

## Construction initiale

Le constructeur `buildReportEvidence` ne dépend pas de l’état de l’interface. Il reçoit la requête, les faits structurés, les écarts hydratés, l’identifiant et la date de l’assessment, puis produit :

```ts
{
  items: ReportEvidence[];
  inventory: {
    sourceItemCount: number;
    includedItemCount: number;
    truncatedItemCount: number;
    methodVersion: "preuvance-evidence-builder-v1";
  };
}
```

Règles :

- un contrôle de `existingControls[]` devient une ligne `declared` ;
- une dépendance reconnue devient `detected`, avec package, version, catégorie, caractère direct/transitif et référence au manifeste ;
- le digest local crée une observation de concordance et une ligne par fournisseur non déclaré ;
- chaque chaîne de `evidenceNeeded[]` crée sa propre ligne ;
- si `evidenceNeeded[]` est vide, le titre de l’écart devient la pièce attendue ;
- l’état initial d’un écart reste `missing`, `partial` ou `unverified` ;
- aucune branche ne crée `verified` ;
- les références d’articles viennent des obligations hydratées ;
- les 120 premières lignes sont incluses et toute troncature est comptée.

## Couverture documentaire

`calculateEvidenceCoverage` exclut `not-applicable` du dénominateur, additionne les poids de la table ci-dessus, divise par le nombre de lignes considérées et arrondit à l’entier le plus proche.

Formellement :

```text
couverture = arrondi(100 × somme_des_poids / nombre_de_lignes_considérées)
```

Le résultat contient aussi les compteurs `declared`, `detected`, `proven`, `missing` et `excluded`. `unverified` rejoint la couche `missing`, même si son faible poids de 0,12 reconnaît qu’une question a été identifiée. `documented`, `detected` et `partial` rejoignent la couche intermédiaire.

Cette couverture :

- ne change pas le score réglementaire ;
- ne mesure pas la qualité substantielle d’un document ;
- ne certifie pas la conformité ;
- sert à visualiser la densité d’étayage du dossier.

## Édition dans l’interface

`EvidenceWorkbench` permet de :

- changer l’état et le type de source ;
- préciser le propriétaire, la validité et le détail ;
- référencer un fichier local sans le téléverser ;
- renseigner le relecteur et la date pour une attestation ;
- ajouter ou retirer une ligne ;
- enregistrer le registre ;
- exporter un manifeste JSON local.

Le manifeste exporté contient `schemaVersion: "preuvance-evidence-manifest-v1"`, l’identifiant du dossier, la date d’export, la couverture, une notice de confidentialité et les lignes validées. Il ne contient aucun octet des fichiers pointés.

Avant de demander un PDF, `AssessmentResults` appelle la sauvegarde du registre. Un registre invalide bloque donc le téléchargement. En mode local, le payload PDF est enrichi avec l’état courant. En mode persistant, le registre est d’abord synchronisé en base, puis le PDF est généré depuis le rapport relu sous RLS.

## Persistance Supabase

### État courant

`assessment_evidence` contient une ligne par pièce et assessment. La clé étrangère composite `(assessment_id, organization_id)` empêche de rattacher une preuve à un dossier d’une autre organisation. Les colonnes reflètent le schéma Zod et ajoutent :

- `created_by`, `updated_by` ;
- `reviewed_by_user_id`, qui relie une attestation persistée à l’utilisateur authentifié ayant enregistré la revue ;
- `sort_order`, qui conserve l’ordre canonique du registre ;
- `created_at`, `updated_at` ;
- les contraintes d’attestation et de hash.

Un trigger applique `set_updated_at`. Un second trigger interdit la réaffectation du tenant.

### Historique

`assessment_evidence_events` enregistre :

- `event_type` : `created`, `updated` ou `removed` ;
- `previous_status` et `next_status` ;
- `previous_snapshot` et `after_snapshot`, afin de reconstruire précisément le changement ;
- `actor_user_id` ;
- `created_at`.

Les clients authentifiés ont un droit de lecture RLS sur les événements de leur organisation, mais aucune route applicative ne les expose encore. Le journal est donc un socle de traçabilité, pas encore une fonctionnalité d’audit navigable.

### Amorçage et synchronisation

Le trigger `assessments_seed_evidence`, exécuté après insertion d’un assessment, lit `report_payload.evidence` et crée les lignes initiales et événements `created`.

La RPC `sync_assessment_evidence(p_assessment_id uuid, p_evidence jsonb, p_expected_revision bigint)` :

1. exige `auth.uid()` ;
2. refuse `null`, plus de 120 lignes, plus de 512 Kio et les identifiants dupliqués ;
3. verrouille l’assessment terminé et vérifie l’appartenance à l’organisation ;
4. compare `p_expected_revision` à `assessments.evidence_revision` ;
5. rejette un client obsolète avec le code PostgreSQL `40001` ;
6. normalise strictement chaque clé et chaque invariant avant toute mutation ;
7. journalise les créations, changements et suppressions avec leurs deux snapshots ;
8. reconstruit le tableau canonique, `report_payload.evidence` et `evidenceInventory` ;
9. incrémente la révision seulement si l’ensemble canonique a réellement changé ;
10. retourne `{ evidence, revision }`.

La fonction est `SECURITY DEFINER` avec `search_path` vide. Les tables n’accordent aux comptes `authenticated` que `SELECT`; la mutation passe exclusivement par la RPC. `service_role` conserve les droits administratifs.

Cette synchronisation reste un remplacement d’ensemble, mais elle n’est plus « dernier enregistrement gagnant ». Le client recharge la révision courante, l’envoie avec le `PUT` et met à jour son état depuis la réponse canonique. Deux onglets concurrents ne peuvent donc pas s’écraser silencieusement. Un enregistrement strictement identique est idempotent : aucune révision ni aucun événement artificiel n’est ajouté.

## Mode local

Sans évaluation persistée, `EvidenceWorkbench` utilise `localStorage` :

```text
preuvance:evidence:<assessmentId>
```

La valeur est l’ensemble Zod-validé. Elle reste dans le navigateur, mais elle n’est pas chiffrée par l’application et ne dispose ni d’événement, ni de verrou de concurrence, ni d’identité authentifiée. Le mode local convient à une démonstration ou à un travail exploratoire, pas à une conservation probatoire durable.

## API de registre

### Lecture

```http
GET /api/assessments/{assessmentId}/evidence
Accept: application/json
```

Réponse :

```json
{
  "assessmentId": "00000000-0000-0000-0000-000000000000",
  "evidence": [],
  "revision": 0
}
```

La route valide l’UUID, exige Supabase et une session, vérifie que l’assessment est terminé, lit les lignes visibles par RLS, les convertit en camelCase puis revalide l’ensemble. Les réponses sont `private, no-store`.

### Remplacement validé

```http
PUT /api/assessments/{assessmentId}/evidence
Content-Type: application/json

{
  "revision": 0,
  "evidence": [
    {
      "id": "ev-review",
      "control": "Procès-verbal de revue humaine",
      "status": "verified",
      "detail": "Version 3 relue avant mise en production.",
      "sourceType": "document",
      "reviewedBy": "Responsable conformité",
      "reviewedAt": "2026-07-20T10:00:00.000Z",
      "updatedAt": "2026-07-20T10:00:00.000Z"
    }
  ]
}
```

La réponse renvoie le registre canonique et sa nouvelle `revision`. Le corps est limité à 512 000 octets. Le média doit être JSON. La validation Zod intervient avant l’appel RPC. Les erreurs utilisent `application/problem+json` : 401 sans session, 404 pour un dossier absent ou inaccessible, 409 si la révision est périmée, 413 trop volumineux, 415 mauvais média, 422 contrat invalide, 500 échec interne.

## Source types

Les valeurs autorisées sont :

- `model-extraction` : élément proposé à partir de l’analyse structurée ;
- `user-declaration` : déclaration de l’utilisateur ;
- `local-scan` : digest agrégé du scanner Preuvance ;
- `dependency-scan` : observation issue d’un manifeste ;
- `document` : document local référencé ;
- `policy` : politique ou procédure ;
- `test` : test, journal ou sortie technique ;
- `contract` : contrat ou engagement d’un tiers ;
- `other` : source ne relevant pas des catégories précédentes.

Un type de source décrit la provenance, pas sa force probante. Par exemple, un `contract` peut rester `documented` tant qu’il n’a pas été relu.

## Vérifications à maintenir

`tests/evidence-ledger.test.ts` verrouille :

- `missing` et `unverified` hors de la couche déclarée ;
- le calcul de couverture ;
- l’obligation de relecteur et date pour `verified` ;
- l’obligation de hash pour un fichier local ;
- la stabilité des identifiants et l’absence de promotion d’une déclaration.

`tests/evidence-dossier.test.ts` verrouille :

- une ligne par élément de `evidenceNeeded[]` ;
- la conservation du statut `declared` des contrôles mentionnés ;
- l’absence totale de `verified` créé par la synthèse.

À ajouter avant un déploiement critique : exécution PostgreSQL de la migration sur une base de staging, tests RLS/RPC réels, concurrence à deux onglets, reprise d’une évaluation antérieure, consultation des événements et test de rollback sur une base isolée. Le contrat TypeScript et l’interface gèrent déjà la révision, mais cela ne remplace pas ce test d’intégration Supabase.

## Limites et langage autorisé

À dire :

- « pièce attestée dans Preuvance par un relecteur déclaré » ;
- « empreinte SHA-256 calculée localement » ;
- « couverture documentaire » ;
- « source reliée au contrôle ».

À ne pas dire sans mécanisme supplémentaire :

- « preuve certifiée » ;
- « document authentique » ;
- « revue indépendante » ;
- « signature horodatée » ;
- « conformité garantie » ;
- « dossier infalsifiable ».

Rédigé et préparé le 20 juillet 2026 par ChatGPT 5.6, OpenAI.
