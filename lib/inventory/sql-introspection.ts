import {
  toIdentifier,
  type CatalogueDataset,
  type CatalogueField,
} from "./catalogue-contract";

/**
 * Introspection SQL générique (connecteur P0).
 *
 * Le module ne parle à aucun pilote de base : il produit des REQUÊTES DE
 * LECTURE SEULE sur les catalogues système, et transforme les lignes
 * retournées en jeux de données du catalogue. Trois conséquences voulues :
 *
 * 1. l'agent local peut utiliser n'importe quel client (pilote Node, `psql`,
 *    `mysql`, `sqlcmd`, ODBC) sans que le moteur change ;
 * 2. le mode « remise au DBA » est possible : on imprime les requêtes, le DBA
 *    du client les exécute lui-même et rend les résultats — aucun accès direct
 *    n'est nécessaire pour produire un diagnostic ;
 * 3. tout est testable hors base, avec un exécuteur factice.
 */
export const SQL_DIALECTS = ["postgresql", "mysql", "sqlserver"] as const;
export type SqlDialect = (typeof SQL_DIALECTS)[number];

export const SQL_INTROSPECTION_VERSION = "preuvance-sql-introspection-v1";

export type IntrospectionStepId =
  | "tables"
  | "columns"
  | "primary_keys"
  | "foreign_keys";

export type IntrospectionStep = {
  id: IntrospectionStepId;
  purpose: string;
  sql: string;
  /** Toujours vrai : aucune étape n'écrit, ne verrouille ni ne lit de donnée métier. */
  readOnly: true;
  /** Une étape facultative qui échoue dégrade la couverture sans arrêter la collecte. */
  optional: boolean;
};

export type SqlRow = Record<string, unknown>;
export type SqlExecutor = (sql: string) => Promise<SqlRow[]>;

const PG_SYSTEM_FILTER =
  "n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\\_toast%'";

const MYSQL_SYSTEM_FILTER =
  "TABLE_SCHEMA NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')";

/**
 * Requêtes par dialecte. Elles ne lisent que des catalogues système :
 * `pg_class` / `information_schema` (PostgreSQL), `information_schema`
 * (MySQL), `sys.*` / `information_schema` (SQL Server).
 */
export function introspectionPlan(dialect: SqlDialect): IntrospectionStep[] {
  if (dialect === "postgresql") {
    return [
      {
        id: "tables",
        purpose:
          "Lister les tables et vues, avec volumétrie estimée (pg_class.reltuples) et taille disque.",
        readOnly: true,
        optional: false,
        sql: [
          "SELECT n.nspname AS table_schema,",
          "       c.relname AS table_name,",
          "       CASE WHEN c.relkind IN ('v', 'm') THEN 'view' ELSE 'table' END AS object_kind,",
          "       c.reltuples::bigint AS approx_rows,",
          "       pg_total_relation_size(c.oid) AS size_bytes",
          "FROM pg_class c",
          "JOIN pg_namespace n ON n.oid = c.relnamespace",
          "WHERE c.relkind IN ('r', 'p', 'v', 'm')",
          `  AND ${PG_SYSTEM_FILTER}`,
          "ORDER BY 1, 2",
        ].join("\n"),
      },
      {
        id: "columns",
        purpose: "Lister les colonnes, leur type et leur nullabilité.",
        readOnly: true,
        optional: false,
        sql: [
          "SELECT table_schema, table_name, column_name, data_type, is_nullable, ordinal_position",
          "FROM information_schema.columns",
          "WHERE table_schema NOT IN ('pg_catalog', 'information_schema')",
          "ORDER BY table_schema, table_name, ordinal_position",
        ].join("\n"),
      },
      {
        id: "primary_keys",
        purpose: "Identifier les clés primaires (structure, jamais de valeur).",
        readOnly: true,
        optional: true,
        sql: [
          "SELECT tc.table_schema, tc.table_name, kcu.column_name",
          "FROM information_schema.table_constraints tc",
          "JOIN information_schema.key_column_usage kcu",
          "  ON kcu.constraint_name = tc.constraint_name",
          " AND kcu.constraint_schema = tc.constraint_schema",
          "WHERE tc.constraint_type = 'PRIMARY KEY'",
          "  AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')",
          "ORDER BY 1, 2, 3",
        ].join("\n"),
      },
      {
        id: "foreign_keys",
        purpose: "Reconstituer les liens entre tables pour la cartographie des flux internes.",
        readOnly: true,
        optional: true,
        sql: [
          "SELECT tc.table_schema, tc.table_name, kcu.column_name,",
          "       ccu.table_schema AS foreign_table_schema,",
          "       ccu.table_name AS foreign_table_name,",
          "       ccu.column_name AS foreign_column_name",
          "FROM information_schema.table_constraints tc",
          "JOIN information_schema.key_column_usage kcu",
          "  ON kcu.constraint_name = tc.constraint_name",
          " AND kcu.constraint_schema = tc.constraint_schema",
          "JOIN information_schema.constraint_column_usage ccu",
          "  ON ccu.constraint_name = tc.constraint_name",
          " AND ccu.constraint_schema = tc.constraint_schema",
          "WHERE tc.constraint_type = 'FOREIGN KEY'",
          "  AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')",
          "ORDER BY 1, 2, 3",
        ].join("\n"),
      },
    ];
  }

  if (dialect === "mysql") {
    return [
      {
        id: "tables",
        purpose:
          "Lister les tables et vues, avec volumétrie estimée (TABLE_ROWS) et date de dernière écriture.",
        readOnly: true,
        optional: false,
        sql: [
          "SELECT TABLE_SCHEMA AS table_schema,",
          "       TABLE_NAME AS table_name,",
          "       CASE WHEN TABLE_TYPE = 'VIEW' THEN 'view' ELSE 'table' END AS object_kind,",
          "       TABLE_ROWS AS approx_rows,",
          "       (COALESCE(DATA_LENGTH, 0) + COALESCE(INDEX_LENGTH, 0)) AS size_bytes,",
          "       UPDATE_TIME AS last_change_at",
          "FROM information_schema.TABLES",
          `WHERE ${MYSQL_SYSTEM_FILTER}`,
          "ORDER BY 1, 2",
        ].join("\n"),
      },
      {
        id: "columns",
        purpose: "Lister les colonnes, leur type, leur nullabilité et leur clé.",
        readOnly: true,
        optional: false,
        sql: [
          "SELECT TABLE_SCHEMA AS table_schema,",
          "       TABLE_NAME AS table_name,",
          "       COLUMN_NAME AS column_name,",
          "       COLUMN_TYPE AS data_type,",
          "       IS_NULLABLE AS is_nullable,",
          "       COLUMN_KEY AS column_key,",
          "       ORDINAL_POSITION AS ordinal_position",
          "FROM information_schema.COLUMNS",
          `WHERE ${MYSQL_SYSTEM_FILTER}`,
          "ORDER BY 1, 2, 7",
        ].join("\n"),
      },
      {
        id: "foreign_keys",
        purpose: "Reconstituer les liens entre tables pour la cartographie des flux internes.",
        readOnly: true,
        optional: true,
        sql: [
          "SELECT TABLE_SCHEMA AS table_schema,",
          "       TABLE_NAME AS table_name,",
          "       COLUMN_NAME AS column_name,",
          "       REFERENCED_TABLE_SCHEMA AS foreign_table_schema,",
          "       REFERENCED_TABLE_NAME AS foreign_table_name,",
          "       REFERENCED_COLUMN_NAME AS foreign_column_name",
          "FROM information_schema.KEY_COLUMN_USAGE",
          `WHERE ${MYSQL_SYSTEM_FILTER}`,
          "  AND REFERENCED_TABLE_NAME IS NOT NULL",
          "ORDER BY 1, 2, 3",
        ].join("\n"),
      },
    ];
  }

  return [
    {
      id: "tables",
      purpose:
        "Lister les tables et vues, avec volumétrie approchée (sys.partitions, sans droit VIEW DATABASE STATE).",
      readOnly: true,
      optional: false,
      sql: [
        "SELECT s.name AS table_schema,",
        "       t.name AS table_name,",
        "       'table' AS object_kind,",
        "       SUM(p.rows) AS approx_rows,",
        "       CAST(NULL AS bigint) AS size_bytes",
        "FROM sys.tables t",
        "JOIN sys.schemas s ON s.schema_id = t.schema_id",
        "JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)",
        "GROUP BY s.name, t.name",
        "UNION ALL",
        "SELECT s.name, v.name, 'view', CAST(NULL AS bigint), CAST(NULL AS bigint)",
        "FROM sys.views v",
        "JOIN sys.schemas s ON s.schema_id = v.schema_id",
        "ORDER BY 1, 2",
      ].join("\n"),
    },
    {
      id: "columns",
      purpose: "Lister les colonnes, leur type et leur nullabilité.",
      readOnly: true,
      optional: false,
      sql: [
        "SELECT TABLE_SCHEMA AS table_schema,",
        "       TABLE_NAME AS table_name,",
        "       COLUMN_NAME AS column_name,",
        "       DATA_TYPE AS data_type,",
        "       IS_NULLABLE AS is_nullable,",
        "       ORDINAL_POSITION AS ordinal_position",
        "FROM INFORMATION_SCHEMA.COLUMNS",
        "ORDER BY 1, 2, 6",
      ].join("\n"),
    },
    {
      id: "primary_keys",
      purpose: "Identifier les clés primaires (structure, jamais de valeur).",
      readOnly: true,
      optional: true,
      sql: [
        "SELECT s.name AS table_schema, t.name AS table_name, c.name AS column_name",
        "FROM sys.indexes i",
        "JOIN sys.tables t ON t.object_id = i.object_id",
        "JOIN sys.schemas s ON s.schema_id = t.schema_id",
        "JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id",
        "JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id",
        "WHERE i.is_primary_key = 1",
        "ORDER BY 1, 2, 3",
      ].join("\n"),
    },
    {
      id: "foreign_keys",
      purpose: "Reconstituer les liens entre tables pour la cartographie des flux internes.",
      readOnly: true,
      optional: true,
      sql: [
        "SELECT ps.name AS table_schema,",
        "       pt.name AS table_name,",
        "       pc.name AS column_name,",
        "       rs.name AS foreign_table_schema,",
        "       rt.name AS foreign_table_name,",
        "       rc.name AS foreign_column_name",
        "FROM sys.foreign_key_columns fkc",
        "JOIN sys.tables pt ON pt.object_id = fkc.parent_object_id",
        "JOIN sys.schemas ps ON ps.schema_id = pt.schema_id",
        "JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id",
        "JOIN sys.tables rt ON rt.object_id = fkc.referenced_object_id",
        "JOIN sys.schemas rs ON rs.schema_id = rt.schema_id",
        "JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id",
        "ORDER BY 1, 2, 3",
      ].join("\n"),
    },
  ];
}

/**
 * Script de création du compte de lecture seule, remis au client dans le pack
 * d'accès. C'est le livrable qui débloque le délai de 10 jours : le client
 * sait exactement quoi exécuter, et ce qu'il n'accorde pas.
 */
export function readOnlyGrantScript(
  dialect: SqlDialect,
  options: { login: string; database: string },
): string {
  const login = assertSafeIdentifier(options.login, "login");
  const database = assertSafeIdentifier(options.database, "base");

  if (dialect === "postgresql") {
    return [
      "-- Compte de lecture seule Preuvance (mot de passe à définir par le client).",
      `CREATE ROLE ${login} LOGIN PASSWORD '<mot_de_passe_genere_par_le_client>';`,
      `GRANT CONNECT ON DATABASE ${database} TO ${login};`,
      `GRANT USAGE ON SCHEMA public TO ${login};`,
      `GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${login};`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${login};`,
      "-- Révocation en fin de mission :",
      `-- REVOKE ALL ON DATABASE ${database} FROM ${login}; DROP ROLE ${login};`,
    ].join("\n");
  }

  if (dialect === "mysql") {
    return [
      "-- Compte de lecture seule Preuvance (mot de passe à définir par le client).",
      `CREATE USER '${login}'@'%' IDENTIFIED BY '<mot_de_passe_genere_par_le_client>';`,
      `GRANT SELECT ON ${database}.* TO '${login}'@'%';`,
      "-- Révocation en fin de mission :",
      `-- DROP USER '${login}'@'%';`,
    ].join("\n");
  }

  return [
    "-- Compte de lecture seule Preuvance (mot de passe à définir par le client).",
    `CREATE LOGIN ${login} WITH PASSWORD = '<mot_de_passe_genere_par_le_client>';`,
    `USE ${database};`,
    `CREATE USER ${login} FOR LOGIN ${login};`,
    `ALTER ROLE db_datareader ADD MEMBER ${login};`,
    `GRANT VIEW DEFINITION TO ${login};`,
    "-- Révocation en fin de mission :",
    `-- DROP USER ${login}; DROP LOGIN ${login};`,
  ].join("\n");
}

const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_$]{0,62}$/;

/**
 * Un identifiant qui ne passe pas ce filtre n'est jamais interpolé dans du
 * SQL : la collecte refuse plutôt que de risquer une injection sur la base du
 * client.
 */
export function assertSafeIdentifier(value: string, label: string): string {
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new Error(
      `Identifiant ${label} refusé : « ${value} ». Seuls les caractères A-Z, 0-9 et _ sont acceptés, sans interpolation.`,
    );
  }
  return value;
}

export function quoteIdentifier(dialect: SqlDialect, value: string): string {
  const safe = assertSafeIdentifier(value, "objet");
  if (dialect === "postgresql") return `"${safe}"`;
  if (dialect === "mysql") return `\`${safe}\``;
  return `[${safe}]`;
}

/**
 * Colonnes de date candidates pour dater la dernière écriture. Le nom seul
 * décide : aucune valeur n'est lue pour choisir.
 */
const DATE_TYPE_PATTERN = /(timestamp|datetime|date|smalldatetime|datetimeoffset)/i;
const FRESHNESS_NAME_PATTERN =
  /(updated|modified|maj|modif|date_?maj|last_?change|tms|created|creation|date_?creation|inserted|import|horodat)/i;

/**
 * Requête de fraîcheur : un `MAX()` sur une colonne de date. C'est la seule
 * lecture de valeur autorisée, uniquement en mode `metadata_and_freshness`,
 * parce que la date de dernière écriture est justement la métadonnée
 * demandée. Aucune ligne, aucun champ métier n'est rapatrié.
 */
export function freshnessQuery(
  dialect: SqlDialect,
  dataset: { namespace?: string; name: string; fields: readonly CatalogueField[] },
): { sql: string; column: string } | null {
  const candidates = dataset.fields.filter(
    (field) =>
      DATE_TYPE_PATTERN.test(field.dataType) && FRESHNESS_NAME_PATTERN.test(field.name),
  );
  const column = candidates[0];
  if (!column) return null;

  const qualified = dataset.namespace
    ? `${quoteIdentifier(dialect, dataset.namespace)}.${quoteIdentifier(dialect, dataset.name)}`
    : quoteIdentifier(dialect, dataset.name);

  return {
    column: column.name,
    sql: `SELECT MAX(${quoteIdentifier(dialect, column.name)}) AS last_change_at FROM ${qualified}`,
  };
}

function lowerKeys(row: SqlRow): SqlRow {
  const output: SqlRow = {};
  for (const [key, value] of Object.entries(row)) {
    output[key.toLowerCase()] = value;
  }
  return output;
}

function readString(row: SqlRow, key: string): string {
  const value = row[key];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/** Les clients en ligne de commande rendent des nombres sous forme de texte. */
function readInteger(row: SqlRow, key: string): number | null {
  const value = row[key];
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "bigint") return Number(value);
  const parsed = Number(String(value).replace(/\s/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function readIsoDate(row: SqlRow, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }
  const raw = String(value).trim();
  if (!raw || raw.toUpperCase() === "NULL") return null;
  const parsed = Date.parse(raw.includes("T") ? raw : raw.replace(" ", "T") + "Z");
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export type IntrospectionResults = {
  tables: SqlRow[];
  columns: SqlRow[];
  primaryKeys?: SqlRow[];
  foreignKeys?: SqlRow[];
  /** Résultats de fraîcheur, indexés par identifiant de jeu de données. */
  freshness?: Array<{ datasetId: string; lastChangeAt: string | null; column: string }>;
};

export type RowCountMethod = { kind: "estimate" | "unknown"; method: string };

export function rowCountMethod(dialect: SqlDialect): RowCountMethod {
  if (dialect === "postgresql") {
    return {
      kind: "estimate",
      method:
        "pg_class.reltuples — estimation du planificateur, rafraîchie par VACUUM/ANALYZE ; peut être périmée sur une base à fortes écritures.",
    };
  }
  if (dialect === "mysql") {
    return {
      kind: "estimate",
      method:
        "information_schema.TABLES.TABLE_ROWS — estimation InnoDB, connue pour s’écarter fortement du réel ; à confirmer par un COUNT(*) ciblé si un chiffre exact est nécessaire.",
    };
  }
  return {
    kind: "estimate",
    method:
      "sys.partitions.rows (index 0/1) — nombre approché maintenu par le moteur, sans droit VIEW DATABASE STATE.",
  };
}

/**
 * Transforme les lignes des catalogues système en jeux de données du
 * catalogue client. Aucune inférence : ce qui n'a pas été retourné par la base
 * n'apparaît pas.
 */
export function buildDatasetsFromIntrospection(options: {
  dialect: SqlDialect;
  sourceId: string;
  results: IntrospectionResults;
}): { datasets: CatalogueDataset[]; notes: string[] } {
  const { dialect, sourceId, results } = options;
  const notes: string[] = [];
  const counting = rowCountMethod(dialect);

  const datasets = new Map<string, CatalogueDataset>();
  const keyOf = (schema: string, name: string) => `${schema} ${name}`;
  const idOf = (schema: string, name: string) =>
    toIdentifier(sourceId, schema || "default", name);

  for (const raw of results.tables) {
    const row = lowerKeys(raw);
    const schema = readString(row, "table_schema");
    const name = readString(row, "table_name");
    if (!name) continue;
    const kindValue = readString(row, "object_kind").toLowerCase();
    const approxRows = readInteger(row, "approx_rows");
    const sizeBytes = readInteger(row, "size_bytes");
    const lastChangeAt = readIsoDate(row, "last_change_at");

    /* PostgreSQL 14+ écrit -1 tant que la table n'a jamais été analysée. */
    const value = approxRows === null || approxRows < 0 ? null : approxRows;

    datasets.set(keyOf(schema, name), {
      id: idOf(schema, name),
      sourceId,
      name,
      namespace: schema || undefined,
      kind: kindValue === "view" ? "view" : "table",
      rowCount: {
        value,
        kind: value === null ? "unknown" : counting.kind,
        method: value === null
          ? "Volumétrie non exposée par le catalogue système (table jamais analysée ou vue)."
          : counting.method,
      },
      sizeBytes: sizeBytes !== null && sizeBytes >= 0 ? sizeBytes : null,
      lastChangeAt: lastChangeAt,
      lastChangeSource: lastChangeAt ? "table_metadata" : "unknown",
      fields: [],
      notes: [],
    });
  }

  let orphanColumns = 0;
  for (const raw of results.columns) {
    const row = lowerKeys(raw);
    const schema = readString(row, "table_schema");
    const name = readString(row, "table_name");
    const dataset = datasets.get(keyOf(schema, name));
    if (!dataset) {
      orphanColumns += 1;
      continue;
    }
    const columnName = readString(row, "column_name");
    if (!columnName) continue;
    const nullableRaw = readString(row, "is_nullable").toUpperCase();
    const field: CatalogueField = {
      name: columnName,
      dataType: readString(row, "data_type") || "inconnu",
      nullable: nullableRaw === "YES" ? true : nullableRaw === "NO" ? false : undefined,
    };
    if (readString(row, "column_key").toUpperCase() === "PRI") field.isPrimaryKey = true;
    dataset.fields.push(field);
  }
  if (orphanColumns > 0) {
    notes.push(
      `${orphanColumns} colonne(s) rattachée(s) à un objet absent de la liste des tables (droits partiels ou objet système) : ignorée(s).`,
    );
  }

  for (const raw of results.primaryKeys ?? []) {
    const row = lowerKeys(raw);
    const dataset = datasets.get(
      keyOf(readString(row, "table_schema"), readString(row, "table_name")),
    );
    if (!dataset) continue;
    const columnName = readString(row, "column_name").toLowerCase();
    const field = dataset.fields.find((item) => item.name.toLowerCase() === columnName);
    if (field) field.isPrimaryKey = true;
  }

  for (const raw of results.foreignKeys ?? []) {
    const row = lowerKeys(raw);
    const dataset = datasets.get(
      keyOf(readString(row, "table_schema"), readString(row, "table_name")),
    );
    if (!dataset) continue;
    const columnName = readString(row, "column_name").toLowerCase();
    const field = dataset.fields.find((item) => item.name.toLowerCase() === columnName);
    if (!field) continue;
    const foreignSchema = readString(row, "foreign_table_schema");
    const foreignTable = readString(row, "foreign_table_name");
    const foreignColumn = readString(row, "foreign_column_name");
    if (!foreignTable) continue;
    field.references = [foreignSchema, foreignTable, foreignColumn]
      .filter((part) => part.length > 0)
      .join(".");
  }

  for (const entry of results.freshness ?? []) {
    for (const dataset of datasets.values()) {
      if (dataset.id !== entry.datasetId) continue;
      if (!entry.lastChangeAt) continue;
      dataset.lastChangeAt = entry.lastChangeAt;
      dataset.lastChangeSource = "max_date_column";
      dataset.notes = [
        ...(dataset.notes ?? []),
        `Fraîcheur mesurée par MAX(${entry.column}) — seule valeur agrégée lue sur cette table.`,
      ];
    }
  }

  return { datasets: [...datasets.values()], notes };
}

export type SqlIntrospectionOutcome = {
  datasets: CatalogueDataset[];
  notes: string[];
  status: "collected" | "partial" | "unreachable";
  executedSteps: IntrospectionStepId[];
};

/**
 * Exécute le plan avec l'exécuteur fourni. Une étape facultative en échec
 * dégrade la couverture et laisse une note explicite : le rapport doit dire ce
 * qu'il n'a pas pu voir, jamais le passer sous silence.
 */
export async function introspectSqlSource(options: {
  dialect: SqlDialect;
  sourceId: string;
  execute: SqlExecutor;
  /** Fraîcheur : requêtes MAX() sur colonnes de date, uniquement si autorisé. */
  collectFreshness?: boolean;
  maxFreshnessQueries?: number;
}): Promise<SqlIntrospectionOutcome> {
  const { dialect, sourceId, execute } = options;
  const notes: string[] = [];
  const executedSteps: IntrospectionStepId[] = [];
  const results: IntrospectionResults = { tables: [], columns: [] };

  for (const step of introspectionPlan(dialect)) {
    try {
      const rows = await execute(step.sql);
      executedSteps.push(step.id);
      if (step.id === "tables") results.tables = rows;
      if (step.id === "columns") results.columns = rows;
      if (step.id === "primary_keys") results.primaryKeys = rows;
      if (step.id === "foreign_keys") results.foreignKeys = rows;
    } catch (error) {
      const message = error instanceof Error ? error.message : "erreur inconnue";
      if (!step.optional) {
        return {
          datasets: [],
          notes: [
            ...notes,
            `Étape « ${step.id} » impossible : ${message}. Le compte de lecture doit au minimum voir le catalogue système.`,
          ],
          status: "unreachable",
          executedSteps,
        };
      }
      notes.push(
        `Étape facultative « ${step.id} » non exécutée (${message}) : ${step.purpose.toLowerCase()} absent du catalogue.`,
      );
    }
  }

  const built = buildDatasetsFromIntrospection({ dialect, sourceId, results });
  notes.push(...built.notes);

  if (options.collectFreshness) {
    const limit = options.maxFreshnessQueries ?? 200;
    const freshness: NonNullable<IntrospectionResults["freshness"]> = [];
    let attempted = 0;
    let failed = 0;
    for (const dataset of built.datasets) {
      if (attempted >= limit) break;
      if (dataset.kind !== "table") continue;
      const query = freshnessQuery(dialect, dataset);
      if (!query) continue;
      attempted += 1;
      try {
        const rows = await execute(query.sql);
        const value = rows[0] ? readIsoDate(lowerKeys(rows[0]), "last_change_at") : null;
        freshness.push({ datasetId: dataset.id, lastChangeAt: value, column: query.column });
      } catch {
        failed += 1;
      }
    }
    if (freshness.length > 0) {
      const rebuilt = buildDatasetsFromIntrospection({
        dialect,
        sourceId,
        results: { ...results, freshness },
      });
      built.datasets = rebuilt.datasets;
    }
    notes.push(
      `Fraîcheur : ${freshness.length} table(s) datée(s) par MAX() sur une colonne de date${failed > 0 ? `, ${failed} refus de lecture` : ""}. Aucune valeur métier n’a été lue.`,
    );
  }

  const optionalMissing = executedSteps.length < introspectionPlan(dialect).length;

  return {
    datasets: built.datasets,
    notes,
    status: optionalMissing ? "partial" : "collected",
    executedSteps,
  };
}
