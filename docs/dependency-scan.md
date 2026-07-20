# Scan des dépendances IA — périmètre, digest et limites

## But

Le scan de dépendances donne au dossier instantané une source technique supplémentaire sans demander l’accès au dépôt ni téléverser les manifestes. Il reconnaît localement certains SDK de fournisseurs, frameworks d’agents, runtimes de modèles, bases vectorielles, outils d’observabilité IA et bibliothèques ML.

Le résultat est une **observation bornée**. Il répond à « quels composants IA connus apparaissent dans les manifestes fournis ? », pas à « ce projet utilise-t-il toute ou partie de ces fonctions en production ? ».

## Parcours utilisateur

1. L’utilisateur ouvre le formulaire du dossier instantané.
2. Il sélectionne jusqu’à dix manifestes pris en charge.
3. Le navigateur lit chaque fichier, refuse ceux de plus de 1 Mo, analyse le texte et calcule SHA-256.
4. Le composant déduplique les dépendances reconnues et affiche le résultat.
5. La soumission joint un `preuvance-dependency-digest-v1` à l’assessment.
6. Le pipeline traite les packages comme observations techniques, jamais comme qualifications juridiques.
7. La synthèse crée une ligne `detected` par dépendance reconnue dans le registre de preuves.

Aucun contenu brut de manifeste n’est envoyé au serveur ou à OpenAI.

## Formats pris en charge

| Format | Détection | Direct/transitif | Limites particulières |
|---|---|---|---|
| `package.json` | `dependencies`, `devDependencies`, `optionalDependencies`, `peerDependencies` | Toutes les entrées sont considérées directes | Ne suit pas les workspaces ni les imports réels |
| `package-lock.json` | Entrées de premier niveau sous `node_modules/` | Compare au paquet racine dans `packages[""]` | Si le paquet racine manque, un avertissement signale que la distinction peut être incomplète |
| `requirements*.txt` | Lignes simples avec version et extras facultatifs | Toutes les entrées sont considérées directes | Ignore les lignes d’option et ne résout pas les fichiers inclus ou l’arbre transitif |

Les fichiers `poetry.lock`, `pyproject.toml`, `uv.lock`, `pnpm-lock.yaml`, `yarn.lock`, `Gemfile.lock`, `Cargo.lock`, images de conteneur et SBOM ne sont pas pris en charge dans cette version. Un format non pris en charge échoue explicitement.

## Catalogue de reconnaissance

Le catalogue de `lib/scan/dependency-scanner.ts` classe notamment :

- **SDK fournisseurs** : OpenAI, Anthropic, Google, Mistral AI, Cohere, Groq ;
- **frameworks d’agents** : LangChain/LangGraph, LlamaIndex, Semantic Kernel, AutoGen, CrewAI ;
- **runtimes de modèles** : Transformers, ONNX Runtime, Ollama ;
- **bases vectorielles** : Pinecone, Chroma, Weaviate, Qdrant, pgvector ;
- **observabilité IA** : Langfuse, Braintrust, Phoenix, OpenInference ;
- **bibliothèques ML** : PyTorch, TensorFlow, JAX, scikit-learn.

Chaque correspondance fournit une catégorie, un fournisseur éventuel et une confiance entière. La confiance mesure la certitude de la correspondance de nom dans le catalogue, pas la probabilité que le composant soit exécuté.

La normalisation minuscule et remplace `_` par `-`. Les préfixes de packages sont utilisés pour certaines familles. Un package absent du catalogue est ignoré ; cette absence n’est jamais interprétée comme absence d’IA.

## Contrat du digest

Le schéma strict `dependencyDigestSchema` contient :

```ts
{
  schemaVersion: "preuvance-dependency-digest-v1";
  scannedAt: string;
  manifests: Array<{
    name: string;
    kind: "package-json" | "package-lock" | "requirements";
    sha256: string;
    byteSize: number;
  }>;
  dependencies: Array<{
    packageName: string;
    version?: string;
    category:
      | "provider-sdk"
      | "agent-framework"
      | "model-runtime"
      | "vector-database"
      | "ai-observability"
      | "ml-library";
    provider?: string;
    direct: boolean;
    manifestName: string;
    confidence: number;
  }>;
  warnings: string[];
  coverage: {
    supportedManifestTypes: Array<"package-json" | "package-lock" | "requirements">;
    statement: string;
  };
}
```

Bornes :

- dix manifestes au maximum ;
- 1 000 000 octets par manifeste ;
- 120 dépendances reconnues après déduplication ;
- vingt avertissements ;
- identifiants, noms, versions et libellés bornés par Zod ;
- empreinte SHA-256 stricte en hexadécimal minuscule.

## Déduplication

La clé de déduplication est le nom de package normalisé. Entre deux occurrences, l’algorithme préfère :

1. une dépendance directe à une dépendance transitive ;
2. à caractère direct identique, la confiance la plus élevée ;
3. sinon la première occurrence retenue.

Le résultat place les dépendances directes avant les transitives, trie les noms puis coupe à 120. À la différence du registre de preuves global, ce découpage ne possède pas encore de compteur explicite de troncature. Le plafond du schéma protège le pipeline mais le scanner devrait à terme exposer un compteur « trouvées/incluses ».

## Données qui circulent

### Restent dans le navigateur

- contenu brut de `package.json`, `package-lock.json` ou `requirements*.txt` ;
- lignes inconnues du catalogue ;
- octets utilisés pour calculer les empreintes.

### Rejoignent l’API Preuvance

- nom, type, taille et SHA-256 des manifestes ;
- packages reconnus, versions, catégories, fournisseur, direct/transitif, manifeste d’origine et confiance ;
- date, avertissements et déclaration de couverture.

Ces métadonnées peuvent révéler des choix d’architecture ou des noms de fichiers internes. L’utilisateur ne doit donc pas joindre un manifeste dont le nom lui-même contient un secret.

### Rejoignent le premier appel OpenAI

`buildExtractionInput` transmet :

- `schemaVersion` et `scannedAt` ;
- `dependencies` ;
- `coverage` ;
- `warnings`.

Le tableau `manifests` n’est pas inclus en tant que tel : le hash et la taille ne sont donc pas envoyés au modèle. `manifestName` reste présent sur chaque dépendance reconnue. Le prompt ordonne au modèle de ne pas déduire la finalité métier, le rôle juridique ou les personnes concernées depuis les packages.

### Rejoignent le registre et le PDF

Chaque dépendance reconnue crée une ligne `detected`. Le détail contient le package, sa version éventuelle, sa catégorie et son caractère direct/transitif. `sourceLabel` contient le nom du manifeste et le préfixe du hash SHA-256. Cette présentation aide à relier l’observation à une source sans exposer le contenu du fichier.

## Ce qu’une détection signifie

Une détection permet d’affirmer :

- qu’un nom de package reconnu figure dans le manifeste sélectionné ;
- quelle version ou contrainte de version était écrite lorsqu’elle a été extraite ;
- si le lockfile permet de l’interpréter comme direct ou transitif ;
- quel fichier local a produit l’observation ;
- quelle empreinte possédait ce fichier au moment du scan.

Elle ne permet pas d’affirmer :

- que le package est importé, appelé, déployé ou accessible en production ;
- qu’une clé ou un compte fournisseur est actif ;
- qu’un modèle précis est utilisé ;
- que le trafic passe effectivement vers ce fournisseur ;
- que le package n’est pas une dépendance de test ou morte ;
- que l’application respecte le droit ou une politique interne ;
- que les composants non reconnus ne contiennent aucune capacité IA.

## Différence avec le scan local du poste

| Scan de dépendances | Scan local du poste |
|---|---|
| Lit des manifestes choisis dans le navigateur | Rapport produit par le script PowerShell local |
| Observe des composants déclarés par le projet | Observe exposition locale, fichiers sensibles et certains hôtes IA |
| Produit `preuvance-dependency-digest-v1` | Produit d’abord un rapport complet, puis éventuellement `preuvance-scan-digest-v1` |
| Aucun consentement distinct au-delà de la sélection et de la soumission | Consentement explicite requis avant le handoff du digest |
| Peut révéler noms de packages et versions | Peut révéler des fournisseurs agrégés et compteurs, jamais le détail machine dans le digest |

Les deux sources sont complémentaires. Aucune n’est exhaustive et aucune ne doit être élevée seule au rang de preuve attestée.

## Sécurité de parsing

- La taille est vérifiée avant parsing.
- Le JSON doit être un objet ; les erreurs n’incluent pas le contenu fourni.
- Le parser de requirements ignore commentaires et options commençant par `-`.
- Le contrat final est validé par Zod avant d’être joint à la requête.
- `AssessmentRequestSchema` revalide le digest côté serveur.
- Le corps global de l’assessment reste limité à 96 Ko.
- Aucune exécution de script, installation de package ou résolution réseau n’est effectuée.

Le scanner ne protège pas contre toutes les complexités d’un JSON très dense sous 1 Mo. La limite de taille et les plafonds de sortie bornent la charge, mais un budget de temps de parsing explicite n’existe pas encore.

## Tests

`tests/dependency-scanner.test.ts` couvre :

- la reconnaissance dans `package.json` sans faux positif sur React ou TypeScript ;
- la distinction directe/transitive dans `package-lock.json` ;
- la normalisation des noms Python dans `requirements*.txt` ;
- la préférence pour une occurrence directe lors de la déduplication ;
- l’échec explicite d’un format non pris en charge.

`tests/evidence-dossier.test.ts` complète cette vérification en s’assurant que la synthèse ne crée jamais de preuve attestée automatiquement. Le chemin de confidentialité du scan local est couvert séparément par `tests/scan-handoff.test.ts`.

Commandes :

```bash
npm run test:unit
npm run typecheck
npm run lint
```

## Extensions envisagées, non livrées

- prise en charge de `pyproject.toml`, `poetry.lock`, `uv.lock`, pnpm et Yarn ;
- import d’un SBOM CycloneDX ou SPDX ;
- distinction production/développement plus fine ;
- compteur de résultats tronqués avant le plafond de 120 ;
- catalogue versionné et daté dans le digest ;
- règles de monorepo et workspaces ;
- corrélation avec imports, image de conteneur ou télémétrie de production ;
- signature du manifeste ou horodatage externe.

Ces extensions devront conserver le principe de minimisation et ne pas transformer un indice technique en conclusion juridique automatique.

Rédigé et préparé le 20 juillet 2026 par ChatGPT 5.6, OpenAI.
