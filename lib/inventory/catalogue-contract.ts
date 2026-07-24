import { z } from "zod";

import { scanDigestSchema } from "@/lib/scan/scan-handoff";

/**
 * Contrat de la « base unique client » de Preuvance v2.
 *
 * Un catalogue décrit ce qui EXISTE chez le client : sources de données,
 * jeux de données, champs, outils en place, flux entre eux et dépendances IA
 * observées. Il ne contient jamais de contenu métier : ni valeur de cellule,
 * ni extrait de fichier, ni identifiant de connexion. La règle héritée de la
 * v1 s'applique intégralement : la détection est déterministe, le modèle de
 * langage interprète un catalogue déjà constitué, il n'invente jamais
 * l'existence d'une source, d'une table ou d'un champ.
 */
export const CATALOGUE_SCHEMA_VERSION = "preuvance-catalogue-v1";

/**
 * Mode de collecte, opposable au client dans le pack d'accès.
 * - `metadata_only` : uniquement des structures (noms d'objets, types, volumétrie).
 * - `metadata_and_freshness` : ajoute la lecture d'agrégats de dates
 *   (`MAX(colonne_date)`) pour dater la dernière écriture. Aucune valeur
 *   métier n'est lue dans les deux cas.
 */
export const COLLECTION_MODES = ["metadata_only", "metadata_and_freshness"] as const;
export type CollectionMode = (typeof COLLECTION_MODES)[number];

export const SOURCE_SYSTEMS = [
  "postgresql",
  "mysql",
  "sqlserver",
  "sqlite",
  "csv",
  "xlsx",
  "dolibarr",
  "salesforce",
  "other",
] as const;
export type SourceSystem = (typeof SOURCE_SYSTEMS)[number];

export const SOURCE_KINDS = ["sql", "file", "api"] as const;

/** Origine de la volumétrie : un chiffre de catalogue système est une estimation. */
export const ROW_COUNT_KINDS = ["exact", "estimate", "unknown"] as const;
export type RowCountKind = (typeof ROW_COUNT_KINDS)[number];

export const LAST_CHANGE_SOURCES = [
  "table_metadata",
  "max_date_column",
  "file_mtime",
  "api_field",
  "unknown",
] as const;

export const SENSITIVE_CATEGORIES = [
  "identifiant_direct",
  "contact",
  "identifiant_national",
  "donnee_bancaire",
  "donnee_rh",
  "donnee_sensible_art9",
  "donnee_mineur",
  "secret_technique",
  "localisation",
  "autre",
] as const;
export type SensitiveCategory = (typeof SENSITIVE_CATEGORIES)[number];

export const TOOL_CATEGORIES = [
  "erp",
  "crm",
  "bureautique",
  "bi",
  "messagerie",
  "stockage",
  "ia",
  "metier",
  "autre",
] as const;

export const FLOW_MEDIA = [
  "api",
  "export_fichier",
  "synchronisation",
  "saisie_manuelle",
  "courriel",
  "inconnu",
] as const;

export const FLOW_FREQUENCIES = [
  "temps_reel",
  "quotidien",
  "hebdomadaire",
  "mensuel",
  "ponctuel",
  "inconnu",
] as const;

/**
 * Niveau de preuve d'un flux. `declared` vient d'un entretien, `observed_*`
 * d'une collecte machine. Le rapport de diagnostic ne présente jamais un flux
 * déclaré comme un flux observé.
 */
export const FLOW_EVIDENCE = ["declared", "observed_connector", "observed_scan"] as const;

export const TERNARY = ["yes", "no", "unknown"] as const;

const isoDateTime = z
  .string()
  .trim()
  .max(40)
  .refine((value) => Number.isFinite(Date.parse(value)), "date ISO invalide");

const boundedString = (max: number, min = 0) => z.string().trim().min(min).max(max);

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9._-]*$/i, "identifiant invalide (a-z, 0-9, . _ -)");

/**
 * Étiquette de sensibilité d'un champ. `ruleIds` rend le verdict auditable :
 * chaque catégorie renvoie à une règle nommée et testée, jamais à une
 * intuition du modèle.
 */
const sensitivitySchema = z
  .object({
    categories: z.array(z.enum(SENSITIVE_CATEGORIES)).min(1).max(6),
    ruleIds: z.array(boundedString(60, 1)).min(1).max(10),
    confidence: z.enum(["high", "medium"]),
    basis: boundedString(300),
  })
  .strict();

export const catalogueFieldSchema = z
  .object({
    name: boundedString(200, 1),
    dataType: boundedString(120),
    nullable: z.boolean().optional(),
    isPrimaryKey: z.boolean().optional(),
    /** Référence textuelle vers un autre jeu de données (`schema.table.colonne`). */
    references: boundedString(400).optional(),
    sensitivity: sensitivitySchema.nullable().optional(),
  })
  .strict();

export const catalogueDatasetSchema = z
  .object({
    id: identifier,
    sourceId: identifier,
    /** Nom de l'objet tel qu'il existe chez le client (table, feuille, sObject). */
    name: boundedString(300, 1),
    /** Schéma SQL, dossier, ou espace de noms d'API. */
    namespace: boundedString(300).optional(),
    kind: z.enum(["table", "view", "file", "object", "sheet"]),
    rowCount: z
      .object({
        value: z.number().int().min(0).max(1_000_000_000_000).nullable(),
        kind: z.enum(ROW_COUNT_KINDS),
        method: boundedString(200),
      })
      .strict(),
    sizeBytes: z.number().int().min(0).nullable().optional(),
    lastChangeAt: isoDateTime.nullable().optional(),
    lastChangeSource: z.enum(LAST_CHANGE_SOURCES).optional(),
    fields: z.array(catalogueFieldSchema).max(2_000),
    notes: z.array(boundedString(400)).max(20).optional(),
  })
  .strict();

export const catalogueSourceSchema = z
  .object({
    id: identifier,
    kind: z.enum(SOURCE_KINDS),
    system: z.enum(SOURCE_SYSTEMS),
    label: boundedString(200, 1),
    /**
     * Emplacement expurgé : hôte et base, jamais d'identifiant ni de mot de
     * passe. Le pack d'accès conserve les credentials hors du catalogue.
     */
    location: boundedString(300).optional(),
    collectedAt: isoDateTime,
    status: z.enum(["collected", "partial", "unreachable"]),
    /** Compte utilisé pour la lecture, à titre de traçabilité (nom seulement). */
    readOnlyAccount: boundedString(200).optional(),
    notes: z.array(boundedString(400)).max(30),
  })
  .strict();

export const catalogueToolSchema = z
  .object({
    id: identifier,
    name: boundedString(200, 1),
    category: z.enum(TOOL_CATEGORIES),
    hosting: z.enum(["cloud", "on_premise", "unknown"]),
    /** Identifiants du catalogue AI_PROVIDER_HOSTS, quand l'outil embarque de l'IA. */
    aiProviders: z.array(boundedString(60, 1)).max(20).optional(),
    sourceIds: z.array(identifier).max(50).optional(),
    evidence: z.enum(FLOW_EVIDENCE),
  })
  .strict();

const flowEndpointSchema = z
  .object({
    kind: z.enum(["source", "tool", "ai_provider", "person", "external"]),
    ref: boundedString(200, 1),
  })
  .strict();

export const catalogueFlowSchema = z
  .object({
    id: identifier,
    from: flowEndpointSchema,
    to: flowEndpointSchema,
    medium: z.enum(FLOW_MEDIA),
    frequency: z.enum(FLOW_FREQUENCIES),
    personalData: z.enum(TERNARY),
    transfersOutsideEu: z.enum(TERNARY),
    evidence: z.enum(FLOW_EVIDENCE),
    label: boundedString(200).optional(),
  })
  .strict();

export const catalogueMissionSchema = z
  .object({
    client: boundedString(200, 1),
    reference: boundedString(80, 1),
    operator: boundedString(200).optional(),
    startedAt: isoDateTime,
    mode: z.enum(COLLECTION_MODES),
    /** Périmètre contractuel énoncé dans le pack d'accès. */
    scope: z.array(boundedString(200)).max(40).optional(),
    dpaReference: boundedString(120).optional(),
  })
  .strict();

export const CATALOGUE_PRIVACY_STATEMENT =
  "Catalogue de métadonnées : structures, volumétries et dates seulement. Aucune valeur métier, aucun extrait de fichier, aucun identifiant de connexion.";

export const catalogueSchema = z
  .object({
    schemaVersion: z.literal(CATALOGUE_SCHEMA_VERSION),
    generatedAt: isoDateTime,
    mission: catalogueMissionSchema,
    sources: z.array(catalogueSourceSchema).max(200),
    datasets: z.array(catalogueDatasetSchema).max(20_000),
    tools: z.array(catalogueToolSchema).max(200),
    flows: z.array(catalogueFlowSchema).max(500),
    /** Digest agrégé du scan de dépendances IA (module 1), quand il existe. */
    aiScan: scanDigestSchema.optional(),
    privacy: z.literal(CATALOGUE_PRIVACY_STATEMENT),
    notes: z.array(boundedString(500)).max(100),
  })
  .strict();

export type Catalogue = z.infer<typeof catalogueSchema>;
export type CatalogueSource = z.infer<typeof catalogueSourceSchema>;
export type CatalogueDataset = z.infer<typeof catalogueDatasetSchema>;
export type CatalogueField = z.infer<typeof catalogueFieldSchema>;
export type CatalogueTool = z.infer<typeof catalogueToolSchema>;
export type CatalogueFlow = z.infer<typeof catalogueFlowSchema>;
export type CatalogueMission = z.infer<typeof catalogueMissionSchema>;
export type FieldSensitivity = z.infer<typeof sensitivitySchema>;

export type CatalogueValidationResult =
  | { success: true; data: Catalogue }
  | { success: false; errors: string[] };

export function validateCatalogue(input: unknown): CatalogueValidationResult {
  const result = catalogueSchema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues
        .slice(0, 50)
        .map((issue) => `${issue.path.join(".") || "catalogue"}: ${issue.message}`),
    };
  }
  const integrity = checkCatalogueIntegrity(result.data);
  if (integrity.length > 0) return { success: false, errors: integrity };
  return { success: true, data: result.data };
}

/**
 * Contrôles que le schéma seul ne peut pas exprimer : unicité des
 * identifiants et intégrité référentielle. Un catalogue qui référence une
 * source absente produirait une cartographie fausse ; il est rejeté.
 */
export function checkCatalogueIntegrity(catalogue: Catalogue): string[] {
  const errors: string[] = [];
  const sourceIds = new Set<string>();
  for (const source of catalogue.sources) {
    if (sourceIds.has(source.id)) errors.push(`sources: identifiant dupliqué « ${source.id} »`);
    sourceIds.add(source.id);
  }

  const datasetIds = new Set<string>();
  for (const dataset of catalogue.datasets) {
    if (datasetIds.has(dataset.id)) {
      errors.push(`datasets: identifiant dupliqué « ${dataset.id} »`);
    }
    datasetIds.add(dataset.id);
    if (!sourceIds.has(dataset.sourceId)) {
      errors.push(
        `datasets.${dataset.id}: source inconnue « ${dataset.sourceId} »`,
      );
    }
    const fieldNames = new Set<string>();
    for (const field of dataset.fields) {
      const key = field.name.toLowerCase();
      if (fieldNames.has(key)) {
        errors.push(`datasets.${dataset.id}: champ dupliqué « ${field.name} »`);
      }
      fieldNames.add(key);
    }
  }

  const toolIds = new Set<string>();
  for (const tool of catalogue.tools) {
    if (toolIds.has(tool.id)) errors.push(`tools: identifiant dupliqué « ${tool.id} »`);
    toolIds.add(tool.id);
    for (const sourceId of tool.sourceIds ?? []) {
      if (!sourceIds.has(sourceId)) {
        errors.push(`tools.${tool.id}: source inconnue « ${sourceId} »`);
      }
    }
  }

  const flowIds = new Set<string>();
  for (const flow of catalogue.flows) {
    if (flowIds.has(flow.id)) errors.push(`flows: identifiant dupliqué « ${flow.id} »`);
    flowIds.add(flow.id);
    for (const [side, endpoint] of [
      ["from", flow.from],
      ["to", flow.to],
    ] as const) {
      if (endpoint.kind === "source" && !sourceIds.has(endpoint.ref)) {
        errors.push(`flows.${flow.id}.${side}: source inconnue « ${endpoint.ref} »`);
      }
      if (endpoint.kind === "tool" && !toolIds.has(endpoint.ref)) {
        errors.push(`flows.${flow.id}.${side}: outil inconnu « ${endpoint.ref} »`);
      }
    }
  }

  return errors.slice(0, 50);
}

/** Catalogue vide mais valide : point de départ de l'agent local. */
export function createEmptyCatalogue(
  mission: CatalogueMission,
  generatedAt: string,
): Catalogue {
  return catalogueSchema.parse({
    schemaVersion: CATALOGUE_SCHEMA_VERSION,
    generatedAt,
    mission,
    sources: [],
    datasets: [],
    tools: [],
    flows: [],
    privacy: CATALOGUE_PRIVACY_STATEMENT,
    notes: [],
  });
}

/** Identifiant stable et lisible, dérivé d'un libellé technique. */
export function toIdentifier(...parts: Array<string | number>): string {
  const slug = parts
    .map((part) => String(part))
    .join("-")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+/, "")
    .replace(/[-.]+$/, "");
  const trimmed = slug.slice(0, 120);
  return trimmed.length > 0 ? trimmed : "objet";
}
