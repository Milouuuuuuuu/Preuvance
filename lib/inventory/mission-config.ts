import { z } from "zod";

import { COLLECTION_MODES, SOURCE_SYSTEMS } from "./catalogue-contract";
import { parseCsvLine, sniffDelimiter, splitCsvRecords } from "./file-inventory";
import { SQL_DIALECTS } from "./sql-introspection";

/**
 * Fichier de mission : la seule chose que l'opérateur écrit à la main.
 *
 * Règle non négociable : AUCUN secret dans ce fichier. Les identifiants sont
 * nommés (`tokenEnv`, `apiKeyEnv`, `passwordEnv`) et lus dans l'environnement
 * du poste. Le fichier de mission peut donc être versionné et relu sans
 * exposer d'identifiant.
 *
 * En revanche il DÉCLENCHE des exécutions : un exécuteur `command` lance un
 * programme sur le poste de l'opérateur, celui qui détient les accès en
 * lecture de tous les clients. Un fichier de mission reçu d'un tiers est donc
 * traité comme du code, pas comme de la donnée : seuls les clients SQL de la
 * liste blanche ci-dessous peuvent être invoqués, par leur nom nu, sans
 * chemin. Un `powershell -c ...` glissé dans un mission.json est refusé à la
 * validation (audit du 26/07/2026).
 */
export const MISSION_CONFIG_VERSION = "preuvance-mission-v1";

/**
 * Clients SQL en ligne de commande admis comme exécuteurs. Volontairement
 * court : ce sont les binaires que le mode « commande locale » documente
 * (docs/preuvance-v2-diagnostic.md §5). Élargir cette liste est une décision
 * consciente, pas un effet de bord d'un fichier reçu par courriel.
 */
export const ALLOWED_EXECUTOR_COMMANDS = [
  "psql",
  "mysql",
  "mariadb",
  "sqlcmd",
  "bcp",
  "sqlite3",
] as const;

/**
 * Accepte `psql` ou `psql.exe`, refuse tout chemin (`/`, `\`, `..`, lettre de
 * lecteur) et toute variante non listée. Le nom nu est ensuite résolu par le
 * PATH du poste de l'opérateur, sous sa responsabilité.
 */
export function isAllowedExecutorCommand(command: string): boolean {
  const trimmed = command.trim();
  if (trimmed === "" || /[\\/]/.test(trimmed) || trimmed.includes("..")) return false;
  const bare = trimmed.toLowerCase().replace(/\.exe$/, "");
  return (ALLOWED_EXECUTOR_COMMANDS as readonly string[]).includes(bare);
}

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9._-]*$/i, "identifiant invalide (a-z, 0-9, . _ -)");

const envName = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Z][A-Z0-9_]*$/, "nom de variable d’environnement invalide (MAJUSCULES)");

const commandExecutorSchema = z
  .object({
    type: z.literal("command"),
    /**
     * Exécutable appelé sans shell (pas d'interpolation), et restreint à la
     * liste blanche des clients SQL : l'absence de shell empêche l'injection
     * DANS une commande, elle n'empêche pas de choisir une autre commande.
     */
    command: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine(isAllowedExecutorCommand, {
        message: `exécuteur non autorisé : seuls ${ALLOWED_EXECUTOR_COMMANDS.join(", ")} sont admis, par leur nom nu et sans chemin`,
      }),
    /** `{{sql}}` est remplacé par la requête ; tout autre argument est passé tel quel. */
    args: z.array(z.string().max(2_000)).max(40),
    format: z.enum(["csv", "tsv", "json"]).default("csv"),
    /** Requête passée sur l'entrée standard plutôt qu'en argument. */
    sqlOnStdin: z.boolean().default(false),
    timeoutMs: z.number().int().min(1_000).max(600_000).default(120_000),
  })
  .strict();

const resultsExecutorSchema = z
  .object({
    type: z.literal("results"),
    /**
     * Dossier contenant les résultats déjà produits par le DBA du client :
     * `tables.csv`, `columns.csv`, `primary_keys.csv`, `foreign_keys.csv`.
     * Ce mode permet un diagnostic sans aucun accès direct à la base.
     */
    directory: z.string().trim().min(1).max(500),
    format: z.enum(["csv", "tsv", "json"]).default("csv"),
  })
  .strict();

const sqlSourceSchema = z
  .object({
    id: identifier,
    kind: z.literal("sql"),
    system: z.enum(SOURCE_SYSTEMS),
    dialect: z.enum(SQL_DIALECTS),
    label: z.string().trim().min(1).max(200),
    location: z.string().trim().max(300).optional(),
    readOnlyAccount: z.string().trim().max(200).optional(),
    executor: z.discriminatedUnion("type", [commandExecutorSchema, resultsExecutorSchema]),
    collectFreshness: z.boolean().default(false),
  })
  .strict();

const fileSourceSchema = z
  .object({
    id: identifier,
    kind: z.literal("file"),
    system: z.enum(["csv", "xlsx", "other"]),
    label: z.string().trim().min(1).max(200),
    /** Fichiers explicites, ou dossier parcouru récursivement. */
    files: z.array(z.string().trim().min(1).max(500)).max(500).optional(),
    directory: z.string().trim().max(500).optional(),
    extensions: z.array(z.string().trim().min(2).max(10)).max(10).default([".csv", ".xlsx"]),
    maxFiles: z.number().int().min(1).max(5_000).default(200),
  })
  .strict();

const salesforceSourceSchema = z
  .object({
    id: identifier,
    kind: z.literal("api"),
    system: z.literal("salesforce"),
    label: z.string().trim().min(1).max(200),
    instanceUrl: z.string().trim().url(),
    tokenEnv: envName,
    apiVersion: z.string().trim().regex(/^\d+\.\d+$/).optional(),
    objects: z.array(z.string().trim().min(1).max(120)).max(500).optional(),
    maxObjects: z.number().int().min(1).max(1_000).default(200),
  })
  .strict();

const dolibarrSourceSchema = z
  .object({
    id: identifier,
    kind: z.literal("api"),
    system: z.literal("dolibarr"),
    label: z.string().trim().min(1).max(200),
    baseUrl: z.string().trim().url(),
    apiKeyEnv: envName,
    entity: z.string().trim().max(20).optional(),
    resources: z.array(z.string().trim().min(1).max(120)).max(200).optional(),
    maxResources: z.number().int().min(1).max(500).default(60),
    /** Lecture d'une fiche réelle pour retrouver des noms de champs : opt-in. */
    allowRecordProbe: z.boolean().default(false),
  })
  .strict();

const toolSchema = z
  .object({
    id: identifier,
    name: z.string().trim().min(1).max(200),
    category: z.enum([
      "erp",
      "crm",
      "bureautique",
      "bi",
      "messagerie",
      "stockage",
      "ia",
      "metier",
      "autre",
    ]),
    hosting: z.enum(["cloud", "on_premise", "unknown"]).default("unknown"),
    aiProviders: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    sourceIds: z.array(identifier).max(50).optional(),
    evidence: z.enum(["declared", "observed_connector", "observed_scan"]).default("declared"),
  })
  .strict();

const flowSchema = z
  .object({
    id: identifier,
    from: z
      .object({
        kind: z.enum(["source", "tool", "ai_provider", "person", "external"]),
        ref: z.string().trim().min(1).max(200),
      })
      .strict(),
    to: z
      .object({
        kind: z.enum(["source", "tool", "ai_provider", "person", "external"]),
        ref: z.string().trim().min(1).max(200),
      })
      .strict(),
    medium: z
      .enum(["api", "export_fichier", "synchronisation", "saisie_manuelle", "courriel", "inconnu"])
      .default("inconnu"),
    frequency: z
      .enum(["temps_reel", "quotidien", "hebdomadaire", "mensuel", "ponctuel", "inconnu"])
      .default("inconnu"),
    personalData: z.enum(["yes", "no", "unknown"]).default("unknown"),
    transfersOutsideEu: z.enum(["yes", "no", "unknown"]).default("unknown"),
    evidence: z.enum(["declared", "observed_connector", "observed_scan"]).default("declared"),
    label: z.string().trim().max(200).optional(),
  })
  .strict();

export const missionConfigSchema = z
  .object({
    configVersion: z.literal(MISSION_CONFIG_VERSION),
    mission: z
      .object({
        client: z.string().trim().min(1).max(200),
        reference: z.string().trim().min(1).max(80),
        operator: z.string().trim().max(200).optional(),
        mode: z.enum(COLLECTION_MODES).default("metadata_only"),
        scope: z.array(z.string().trim().min(1).max(200)).max(40).optional(),
        dpaReference: z.string().trim().max(120).optional(),
      })
      .strict(),
    sources: z
      .array(
        z.union([
          sqlSourceSchema,
          fileSourceSchema,
          salesforceSourceSchema,
          dolibarrSourceSchema,
        ]),
      )
      .max(100),
    tools: z.array(toolSchema).max(200).default([]),
    flows: z.array(flowSchema).max(500).default([]),
    /** Rapport du scan local v1 : seul son digest agrégé entre au catalogue. */
    aiScanReportPath: z.string().trim().max(500).optional(),
  })
  .strict();

export type MissionConfig = z.infer<typeof missionConfigSchema>;
export type MissionSource = MissionConfig["sources"][number];
export type SqlMissionSource = z.infer<typeof sqlSourceSchema>;
export type FileMissionSource = z.infer<typeof fileSourceSchema>;
export type SalesforceMissionSource = z.infer<typeof salesforceSourceSchema>;
export type DolibarrMissionSource = z.infer<typeof dolibarrSourceSchema>;

export type MissionConfigResult =
  | { success: true; data: MissionConfig }
  | { success: false; errors: string[] };

export function parseMissionConfig(input: unknown): MissionConfigResult {
  const result = missionConfigSchema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues
        .slice(0, 30)
        .map((issue) => `${issue.path.join(".") || "mission"}: ${issue.message}`),
    };
  }

  const ids = new Set<string>();
  const duplicates: string[] = [];
  for (const source of result.data.sources) {
    if (ids.has(source.id)) duplicates.push(source.id);
    ids.add(source.id);
  }
  if (duplicates.length > 0) {
    return {
      success: false,
      errors: [`sources: identifiant(s) en double (${duplicates.join(", ")})`],
    };
  }

  const unknownToolSources = result.data.tools
    .flatMap((tool) => (tool.sourceIds ?? []).map((sourceId) => ({ tool: tool.id, sourceId })))
    .filter((entry) => !ids.has(entry.sourceId));
  if (unknownToolSources.length > 0) {
    return {
      success: false,
      errors: unknownToolSources.map(
        (entry) => `tools.${entry.tool}: source inconnue « ${entry.sourceId} »`,
      ),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Lit un secret dans l'environnement. Le message d'erreur nomme la variable
 * attendue mais n'affiche jamais de valeur.
 */
export function resolveSecret(
  variableName: string,
  environment: Record<string, string | undefined>,
): { ok: true; value: string } | { ok: false; message: string } {
  const value = environment[variableName];
  if (!value || value.trim() === "") {
    return {
      ok: false,
      message: `Variable d’environnement « ${variableName} » absente ou vide : la source correspondante n’a pas été interrogée.`,
    };
  }
  return { ok: true, value: value.trim() };
}

export type TabularFormat = "csv" | "tsv" | "json";

/**
 * Convertit la sortie d'un client SQL en lignes exploitables. Les trois
 * formats couvrent `psql --csv`, `mysql --batch` (TSV) et les pilotes qui
 * savent rendre du JSON.
 */
export function parseTabular(text: string, format: TabularFormat): Record<string, unknown>[] {
  if (format === "json") {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (row): row is Record<string, unknown> =>
          typeof row === "object" && row !== null && !Array.isArray(row),
      );
    }
    return [];
  }

  const records = splitCsvRecords(text.replace(/^\uFEFF/, "")).filter(
    (record) => record.trim() !== "",
  );
  if (records.length === 0) return [];

  const delimiter = format === "tsv" ? "\t" : sniffDelimiter(records[0]);
  const header = parseCsvLine(records[0], delimiter).map((cell) => cell.trim());

  return records.slice(1).map((record) => {
    const cells = parseCsvLine(record, delimiter);
    const row: Record<string, unknown> = {};
    header.forEach((name, index) => {
      row[name] = cells[index] ?? "";
    });
    return row;
  });
}
