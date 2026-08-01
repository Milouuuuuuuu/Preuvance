/**
 * Agent local Preuvance v2 : inventaire des sources de données.
 *
 * Tout s'exécute sur le poste de l'opérateur ou du client : les connecteurs
 * lisent des métadonnées, l'agent écrit un catalogue, un diagnostic et un
 * rapport, puis sait effacer ses propres traces avec un journal vérifiable.
 * Rien n'est transmis à un serveur Preuvance, à aucun moment.
 *
 * Usage :
 *   node --import tsx scripts/preuvance-inventory.ts --mission mission.json
 *   node --import tsx scripts/preuvance-inventory.ts --mission mission.json --dry-run
 *   node --import tsx scripts/preuvance-inventory.ts --purge ./sortie --mission mission.json
 *   node --import tsx scripts/preuvance-inventory.ts --self-test
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  CATALOGUE_PRIVACY_STATEMENT,
  CATALOGUE_SCHEMA_VERSION,
  validateCatalogue,
  type Catalogue,
  type CatalogueDataset,
  type CatalogueSource,
} from "../lib/inventory/catalogue-contract";
import { createCatalogueDigest } from "../lib/inventory/catalogue-digest";
import { inventoryDolibarr } from "../lib/inventory/connectors/dolibarr";
import { inventorySalesforce } from "../lib/inventory/connectors/salesforce";
import type { JsonFetch } from "../lib/inventory/connectors/http";
import { computeDiagnostic } from "../lib/inventory/diagnostic";
import { inventoryFile } from "../lib/inventory/file-inventory";
import {
  ALLOWED_EXECUTOR_COMMANDS,
  isAllowedExecutorCommand,
  parseMissionConfig,
  resolveSecret,
  type FileMissionSource,
  type MissionConfig,
  type SqlMissionSource,
} from "../lib/inventory/mission-config";
import { parseTabular } from "../lib/inventory/tabular";
import { buildPurgeLog, renderPurgeLog, type PurgeArtefact } from "../lib/inventory/mission-log";
import { renderDiagnosticHtml, renderDiagnosticMarkdown } from "../lib/inventory/report";
import { annotateCatalogue } from "../lib/inventory/sensitive-fields";
import {
  introspectionPlan,
  introspectSqlSource,
  readOnlyGrantScript,
  type SqlExecutor,
} from "../lib/inventory/sql-introspection";
import { validateScanReport } from "../lib/scan/scan-contract";
import { createScanDigest } from "../lib/scan/scan-handoff";
import { computeScanExposure } from "../app/lib/assessment/scan-scoring";

const ARTEFACT_NAMES = {
  catalogue: "preuvance-catalogue.json",
  digest: "preuvance-catalogue-digest.json",
  markdown: "diagnostic-preuvance.md",
  html: "diagnostic-preuvance.html",
  queries: "requetes-lecture-seule.sql",
  purgeLog: "journal-suppression.txt",
  purgeJson: "journal-suppression.json",
} as const;

/** Les chemins du fichier de mission se lisent depuis le dossier de ce fichier. */
function resolveFrom(baseDirectory: string, path: string): string {
  return isAbsolute(path) ? path : resolve(baseDirectory, path);
}

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/* ---------------------------------------------------------------------- */
/* Exécution de commandes : jamais de shell, donc pas d'injection possible. */
/* ---------------------------------------------------------------------- */

function runCommand(
  command: string,
  args: string[],
  options: { input?: string; timeoutMs: number },
): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { shell: false });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      rejectPromise(new Error(`délai dépassé (${options.timeoutMs} ms)`));
    }, options.timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk.slice(0, 2_000);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      rejectPromise(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolvePromise(stdout);
      else rejectPromise(new Error(`code ${code} (${stderr.trim().slice(0, 300) || "sans détail"})`));
    });

    if (options.input !== undefined) {
      child.stdin.end(options.input);
    } else {
      child.stdin.end();
    }
  });
}

function commandExecutor(source: SqlMissionSource): SqlExecutor {
  const executor = source.executor;
  if (executor.type !== "command") {
    throw new Error("exécuteur de commande attendu");
  }
  // Deuxième verrou, indépendant du schéma : un appelant qui construirait une
  // configuration en mémoire (test, script tiers) sans passer par
  // parseMissionConfig ne doit pas pouvoir lancer un programme arbitraire.
  if (!isAllowedExecutorCommand(executor.command)) {
    throw new Error(
      `exécuteur « ${executor.command} » non autorisé : seuls ${ALLOWED_EXECUTOR_COMMANDS.join(", ")} sont admis`,
    );
  }
  return async (sql: string) => {
    const args = executor.sqlOnStdin
      ? executor.args
      : executor.args.map((arg) => arg.replace("{{sql}}", sql));
    const stdout = await runCommand(executor.command, args, {
      input: executor.sqlOnStdin ? sql : undefined,
      timeoutMs: executor.timeoutMs,
    });
    return parseTabular(stdout, executor.format);
  };
}

/**
 * Mode « remise au DBA » : les requêtes ont été exécutées par le client, qui
 * rend des fichiers de résultats. L'agent n'ouvre alors aucune connexion.
 */
function resultsExecutor(source: SqlMissionSource, baseDirectory: string): SqlExecutor {
  const executor = source.executor;
  if (executor.type !== "results") throw new Error("exécuteur de résultats attendu");
  const plan = introspectionPlan(source.dialect);
  const extension = executor.format === "json" ? ".json" : executor.format === "tsv" ? ".tsv" : ".csv";

  return async (sql: string) => {
    const step = plan.find((candidate) => candidate.sql === sql);
    if (!step) throw new Error("requête hors plan : aucun fichier de résultats correspondant");
    const path = join(resolveFrom(baseDirectory, executor.directory), `${step.id}${extension}`);
    const text = await readFile(path, "utf8");
    return parseTabular(text, executor.format);
  };
}

/* ---------------------------------------------------------------------- */
/* Collecte par type de source                                             */
/* ---------------------------------------------------------------------- */

type CollectedSource = {
  source: CatalogueSource;
  datasets: CatalogueDataset[];
};

async function collectSqlSource(
  source: SqlMissionSource,
  mission: MissionConfig["mission"],
  collectedAt: string,
  baseDirectory: string,
): Promise<CollectedSource> {
  const execute =
    source.executor.type === "command"
      ? commandExecutor(source)
      : resultsExecutor(source, baseDirectory);

  const outcome = await introspectSqlSource({
    dialect: source.dialect,
    sourceId: source.id,
    execute,
    collectFreshness:
      source.collectFreshness && mission.mode === "metadata_and_freshness",
  });

  const notes = [...outcome.notes];
  if (source.collectFreshness && mission.mode !== "metadata_and_freshness") {
    notes.push(
      "Fraîcheur demandée par la source mais refusée par le mode de mission « métadonnées seules » : aucune valeur de date n’a été lue.",
    );
  }
  if (source.executor.type === "results") {
    notes.push(
      "Résultats fournis par l’équipe du client (mode remise au DBA) : Preuvance n’a ouvert aucune connexion à cette base.",
    );
  }

  return {
    source: {
      id: source.id,
      kind: "sql",
      system: source.system,
      label: source.label,
      location: source.location,
      collectedAt,
      status: outcome.status,
      readOnlyAccount: source.readOnlyAccount,
      notes: notes.slice(0, 30),
    },
    datasets: outcome.datasets,
  };
}

async function listFiles(source: FileMissionSource, baseDirectory: string): Promise<string[]> {
  if (source.files?.length) return source.files.map((file) => resolveFrom(baseDirectory, file));
  if (!source.directory) return [];

  const root = resolveFrom(baseDirectory, source.directory);
  const wanted = new Set(source.extensions.map((extension) => extension.toLowerCase()));
  const found: string[] = [];

  async function walk(directory: string, depth: number): Promise<void> {
    if (found.length >= source.maxFiles || depth > 6) return;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (found.length >= source.maxFiles) return;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path, depth + 1);
      } else if (wanted.has(extname(entry.name).toLowerCase())) {
        found.push(path);
      }
    }
  }

  await walk(root, 0);
  return found;
}

async function collectFileSource(
  source: FileMissionSource,
  collectedAt: string,
  baseDirectory: string,
): Promise<CollectedSource> {
  const files = await listFiles(source, baseDirectory);
  const datasets: CatalogueDataset[] = [];
  const notes: string[] = [];

  if (files.length === 0) {
    notes.push("Aucun fichier trouvé au périmètre indiqué.");
  }
  if (files.length >= source.maxFiles) {
    notes.push(
      `Plafond de ${source.maxFiles} fichiers atteint : l’inventaire de cette source est incomplet et doit être relancé avec un périmètre plus étroit.`,
    );
  }

  let failures = 0;
  for (const file of files) {
    try {
      const outcome = await inventoryFile({ path: file, sourceId: source.id });
      datasets.push(...outcome.datasets);
      notes.push(...outcome.notes);
    } catch (error) {
      failures += 1;
      notes.push(
        `Fichier « ${basename(file)} » illisible : ${error instanceof Error ? error.message : "erreur inconnue"}.`,
      );
    }
  }

  return {
    source: {
      id: source.id,
      kind: "file",
      system: source.system,
      label: source.label,
      location: source.directory ? resolveFrom(baseDirectory, source.directory) : undefined,
      collectedAt,
      status: failures > 0 || files.length === 0 ? "partial" : "collected",
      notes: notes.slice(0, 30),
    },
    datasets,
  };
}

async function collectApiSource(
  source: Extract<MissionConfig["sources"][number], { kind: "api" }>,
  collectedAt: string,
  environment: Record<string, string | undefined>,
): Promise<CollectedSource> {
  const fetchJson = globalThis.fetch as unknown as JsonFetch;

  if (source.system === "salesforce") {
    const secret = resolveSecret(source.tokenEnv, environment);
    if (!secret.ok) {
      return unreachable(source.id, "api", "salesforce", source.label, collectedAt, secret.message);
    }
    const outcome = await inventorySalesforce({
      instanceUrl: source.instanceUrl,
      accessToken: secret.value,
      sourceId: source.id,
      fetchJson,
      apiVersion: source.apiVersion,
      objects: source.objects,
      maxObjects: source.maxObjects,
    });
    return {
      source: {
        id: source.id,
        kind: "api",
        system: "salesforce",
        label: source.label,
        location: source.instanceUrl,
        collectedAt,
        status: outcome.status,
        notes: outcome.notes.slice(0, 30),
      },
      datasets: outcome.datasets,
    };
  }

  const secret = resolveSecret(source.apiKeyEnv, environment);
  if (!secret.ok) {
    return unreachable(source.id, "api", "dolibarr", source.label, collectedAt, secret.message);
  }
  const outcome = await inventoryDolibarr({
    baseUrl: source.baseUrl,
    apiKey: secret.value,
    sourceId: source.id,
    fetchJson,
    entity: source.entity,
    resources: source.resources,
    maxResources: source.maxResources,
    allowRecordProbe: source.allowRecordProbe,
  });
  return {
    source: {
      id: source.id,
      kind: "api",
      system: "dolibarr",
      label: source.label,
      location: source.baseUrl,
      collectedAt,
      status: outcome.status,
      notes: outcome.notes.slice(0, 30),
    },
    datasets: outcome.datasets,
  };
}

function unreachable(
  id: string,
  kind: CatalogueSource["kind"],
  system: CatalogueSource["system"],
  label: string,
  collectedAt: string,
  message: string,
): CollectedSource {
  return {
    source: { id, kind, system, label, collectedAt, status: "unreachable", notes: [message] },
    datasets: [],
  };
}

async function readAiScanDigest(
  path: string,
  baseDirectory: string,
): Promise<{ digest: Catalogue["aiScan"]; note: string }> {
  try {
    const parsed: unknown = JSON.parse(await readFile(resolveFrom(baseDirectory, path), "utf8"));
    const validation = validateScanReport(parsed);
    if (!validation.success) {
      return {
        digest: undefined,
        note: `Rapport de scan IA ignoré (non conforme au contrat v1) : ${validation.errors[0] ?? "format inattendu"}.`,
      };
    }
    const exposure = computeScanExposure(validation.data);
    return {
      digest: createScanDigest(validation.data, exposure),
      note: "Digest agrégé du scan de dépendances IA rattaché au catalogue (aucun chemin, IP ni processus).",
    };
  } catch (error) {
    return {
      digest: undefined,
      note: `Rapport de scan IA illisible : ${error instanceof Error ? error.message : "erreur inconnue"}.`,
    };
  }
}

/* ---------------------------------------------------------------------- */
/* Commandes                                                               */
/* ---------------------------------------------------------------------- */

async function runCollect(
  config: MissionConfig,
  outDirectory: string,
  baseDirectory: string,
): Promise<void> {
  const collectedAt = new Date().toISOString();
  const sources: CatalogueSource[] = [];
  const datasets: CatalogueDataset[] = [];
  const notes: string[] = [];

  for (const source of config.sources) {
    log(`→ ${source.label} (${source.id})`);
    try {
      const collected =
        source.kind === "sql"
          ? await collectSqlSource(source, config.mission, collectedAt, baseDirectory)
          : source.kind === "file"
            ? await collectFileSource(source, collectedAt, baseDirectory)
            : await collectApiSource(source, collectedAt, process.env);
      sources.push(collected.source);
      datasets.push(...collected.datasets);
      log(
        `   ${collected.source.status} : ${collected.datasets.length} jeu(x) de données, ${collected.datasets.reduce((sum, dataset) => sum + dataset.fields.length, 0)} champ(s)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "erreur inconnue";
      sources.push({
        id: source.id,
        kind: source.kind,
        system: source.system,
        label: source.label,
        collectedAt,
        status: "unreachable",
        notes: [`Collecte interrompue : ${message}`],
      });
      log(`   injoignable : ${message}`);
    }
  }

  let aiScan: Catalogue["aiScan"];
  if (config.aiScanReportPath) {
    const result = await readAiScanDigest(config.aiScanReportPath, baseDirectory);
    aiScan = result.digest;
    notes.push(result.note);
  }

  const draft: Catalogue = {
    schemaVersion: CATALOGUE_SCHEMA_VERSION,
    generatedAt: collectedAt,
    mission: { ...config.mission, startedAt: collectedAt },
    sources,
    datasets,
    tools: config.tools,
    flows: config.flows,
    aiScan,
    privacy: CATALOGUE_PRIVACY_STATEMENT,
    notes,
  };

  const annotated = annotateCatalogue(draft);
  const validation = validateCatalogue(annotated);
  if (!validation.success) {
    fail(`Catalogue non conforme au contrat :\n  - ${validation.errors.join("\n  - ")}`);
  }

  const catalogue = validation.data;
  const diagnostic = computeDiagnostic(catalogue);
  const digest = createCatalogueDigest(catalogue, diagnostic, collectedAt);

  await mkdir(outDirectory, { recursive: true });
  await writeFile(
    join(outDirectory, ARTEFACT_NAMES.catalogue),
    `${JSON.stringify(catalogue, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    join(outDirectory, ARTEFACT_NAMES.digest),
    `${JSON.stringify(digest, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    join(outDirectory, ARTEFACT_NAMES.markdown),
    renderDiagnosticMarkdown(catalogue, diagnostic),
    "utf8",
  );
  await writeFile(
    join(outDirectory, ARTEFACT_NAMES.html),
    renderDiagnosticHtml(catalogue, diagnostic),
    "utf8",
  );

  log("");
  log(`Score de préparation : ${diagnostic.score}/100 (niveau ${diagnostic.tier})`);
  log(diagnostic.summary);
  log("");
  log(`Artefacts écrits dans ${resolve(outDirectory)} :`);
  for (const name of [
    ARTEFACT_NAMES.catalogue,
    ARTEFACT_NAMES.digest,
    ARTEFACT_NAMES.markdown,
    ARTEFACT_NAMES.html,
  ]) {
    log(`  - ${name}`);
  }
  log("");
  log("Fin de mission : relancer avec --purge pour supprimer ces fichiers et produire le journal.");
}

/**
 * Prépare le pack d'accès : les requêtes exactes que le client exécutera, et
 * le script de création du compte de lecture seule. Aucune connexion.
 */
async function runDryRun(config: MissionConfig, outDirectory: string): Promise<void> {
  const lines: string[] = [
    "-- PREUVANCE : requêtes de lecture seule du diagnostic",
    `-- Mission ${config.mission.reference} · client ${config.mission.client}`,
    "-- Ces requêtes ne lisent que les catalogues système. Aucune donnée métier.",
    "-- Exécutez-les et rendez un fichier CSV par étape (tables.csv, columns.csv, …).",
    "",
  ];

  for (const source of config.sources) {
    if (source.kind !== "sql") continue;
    lines.push(
      `-- =====================================================================`,
      `-- Source « ${source.label} » (${source.dialect})`,
      `-- =====================================================================`,
      "",
      "-- Compte de lecture seule à créer :",
      readOnlyGrantScript(source.dialect, {
        login: "preuvance_ro",
        database: databaseNameFor(source),
      }),
      "",
    );
    for (const step of introspectionPlan(source.dialect)) {
      lines.push(
        `-- [${step.id}] ${step.purpose}${step.optional ? " (facultatif)" : ""}`,
        `${step.sql};`,
        "",
      );
    }
  }

  const sqlSources = config.sources.filter((source) => source.kind === "sql").length;
  if (sqlSources === 0) {
    lines.push("-- Aucune source SQL dans ce fichier de mission.");
  }

  await mkdir(outDirectory, { recursive: true });
  const path = join(outDirectory, ARTEFACT_NAMES.queries);
  await writeFile(path, `${lines.join("\n")}\n`, "utf8");
  log(`Pack de requêtes écrit : ${path}`);
  log(`${sqlSources} source(s) SQL décrite(s). Aucune connexion n’a été ouverte.`);
}

function databaseNameFor(source: SqlMissionSource): string {
  const fromLocation = source.location?.split("/").pop()?.trim();
  if (fromLocation && /^[A-Za-z_][A-Za-z0-9_$]{0,62}$/.test(fromLocation)) return fromLocation;
  return "base_du_client";
}

async function runPurge(config: MissionConfig, directory: string, keep: boolean): Promise<void> {
  const target = resolve(directory);
  const artefacts: PurgeArtefact[] = [];
  const names = Object.values(ARTEFACT_NAMES).filter(
    (name) => name !== ARTEFACT_NAMES.purgeLog && name !== ARTEFACT_NAMES.purgeJson,
  );

  for (const name of names) {
    const path = join(target, name);
    try {
      const info = await stat(path);
      const content = await readFile(path);
      const sha256 = createHash("sha256").update(content).digest("hex");
      if (!keep) await rm(path);
      artefacts.push({
        name,
        sizeBytes: info.size,
        sha256,
        outcome: keep ? "kept_by_operator" : "deleted",
        reason: keep ? "conservation demandée par --keep" : undefined,
      });
    } catch {
      artefacts.push({
        name,
        sizeBytes: 0,
        sha256: "0".repeat(64),
        outcome: "missing",
        reason: "absent du dossier au moment de la purge",
      });
    }
  }

  const purgeLog = buildPurgeLog({
    missionReference: config.mission.reference,
    client: config.mission.client,
    operator: config.mission.operator,
    purgedAt: new Date().toISOString(),
    artefacts,
  });

  await mkdir(target, { recursive: true });
  await writeFile(join(target, ARTEFACT_NAMES.purgeLog), `${renderPurgeLog(purgeLog)}\n`, "utf8");
  await writeFile(
    join(target, ARTEFACT_NAMES.purgeJson),
    `${JSON.stringify(purgeLog, null, 2)}\n`,
    "utf8",
  );

  log(renderPurgeLog(purgeLog));
  log("");
  log(`Journal écrit : ${join(target, ARTEFACT_NAMES.purgeLog)}`);
}

/* ---------------------------------------------------------------------- */
/* Autotests : aucune écriture, aucun réseau, aucune base                   */
/* ---------------------------------------------------------------------- */

async function runSelfTest(): Promise<void> {
  const failures: string[] = [];
  let count = 0;
  const check = (condition: boolean, name: string) => {
    count += 1;
    if (!condition) failures.push(name);
  };

  const plan = introspectionPlan("postgresql");
  check(plan.length >= 3, "plan PostgreSQL non vide");
  check(
    plan.every((step) => step.readOnly && !/\b(insert|update|delete|drop|alter)\b/i.test(step.sql)),
    "aucune requête d’écriture dans le plan PostgreSQL",
  );
  for (const dialect of ["postgresql", "mysql", "sqlserver"] as const) {
    check(
      introspectionPlan(dialect).every(
        (step) => !/\b(insert|update|delete|drop|alter|truncate|grant)\b/i.test(step.sql),
      ),
      `aucune requête d’écriture dans le plan ${dialect}`,
    );
  }

  const rows = parseTabular("a,b\n1,2\n", "csv");
  check(rows.length === 1 && rows[0].a === "1" && rows[0].b === "2", "lecture CSV d’un résultat");

  const config = parseMissionConfig({
    configVersion: "preuvance-mission-v1",
    mission: { client: "Client", reference: "M-1" },
    sources: [],
  });
  check(config.success, "fichier de mission minimal accepté");

  const rejected = parseMissionConfig({
    configVersion: "preuvance-mission-v1",
    mission: { client: "Client", reference: "M-1" },
    sources: [
      {
        id: "a",
        kind: "sql",
        system: "postgresql",
        dialect: "postgresql",
        label: "A",
        executor: { type: "command", command: "psql", args: ["{{sql}}"], password: "secret" },
      },
    ],
  });
  check(!rejected.success, "secret en clair refusé dans le fichier de mission");

  const secret = resolveSecret("PREUVANCE_TEST_ABSENT", {});
  check(!secret.ok, "variable d’environnement absente signalée");

  if (failures.length === 0) {
    log(`AUTOTEST OK (${count} assertions)`);
    return;
  }
  fail(`AUTOTEST ÉCHEC (${failures.length}/${count}) : ${failures.join(" | ")}`);
}

/* ---------------------------------------------------------------------- */

const HELP = `Preuvance, agent d’inventaire local (v2)

  --mission <fichier>   fichier de mission JSON (obligatoire sauf --self-test)
  --out <dossier>       dossier de sortie (défaut : ./preuvance-mission)
  --dry-run             n’ouvre aucune connexion : écrit les requêtes à remettre au client
  --purge               calcule les empreintes, supprime les artefacts et écrit le journal
  --keep                avec --purge : conserve les fichiers mais journalise leurs empreintes
  --self-test           vérifie les fonctions pures puis sort
  --help                affiche cette aide

Les identifiants ne figurent jamais dans le fichier de mission : ils sont lus
dans les variables d’environnement nommées par « tokenEnv » / « apiKeyEnv ».`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      mission: { type: "string" },
      out: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      purge: { type: "boolean", default: false },
      keep: { type: "boolean", default: false },
      "self-test": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    log(HELP);
    return;
  }
  if (values["self-test"]) {
    await runSelfTest();
    return;
  }
  if (!values.mission) fail("Aucun fichier de mission : utiliser --mission <fichier>.\n\n" + HELP);

  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(resolve(values.mission), "utf8"));
  } catch (error) {
    fail(
      `Fichier de mission illisible : ${error instanceof Error ? error.message : "erreur inconnue"}`,
    );
  }

  const parsed = parseMissionConfig(raw);
  if (!parsed.success) {
    fail(`Fichier de mission non conforme :\n  - ${parsed.errors.join("\n  - ")}`);
  }

  const missionDirectory = dirname(resolve(values.mission));
  const outDirectory = resolve(values.out ?? join(missionDirectory, "preuvance-mission"));

  if (values.purge) {
    await runPurge(parsed.data, outDirectory, values.keep);
    return;
  }
  if (values["dry-run"]) {
    await runDryRun(parsed.data, outDirectory);
    return;
  }
  await runCollect(parsed.data, outDirectory, missionDirectory);
}

await main();
