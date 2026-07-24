import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { validateCatalogue } from "../lib/inventory/catalogue-contract";
import { parseMissionConfig, parseTabular } from "../lib/inventory/mission-config";
import { buildPurgeLog, renderPurgeLog } from "../lib/inventory/mission-log";

const execFileAsync = promisify(execFile);
const scriptPath = join(process.cwd(), "scripts", "preuvance-inventory.ts");

async function runAgent(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(process.execPath, ["--import", "tsx", scriptPath, ...args], {
    cwd: process.cwd(),
    maxBuffer: 8 * 1024 * 1024,
  });
}

async function buildMission(root: string): Promise<string> {
  await mkdir(join(root, "sql"), { recursive: true });
  await mkdir(join(root, "exports"), { recursive: true });

  await writeFile(
    join(root, "sql", "tables.csv"),
    [
      "table_schema,table_name,object_kind,approx_rows,size_bytes",
      "public,llx_societe,table,4213,8388608",
      "public,llx_user,table,37,262144",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "sql", "columns.csv"),
    [
      "table_schema,table_name,column_name,data_type,is_nullable,ordinal_position",
      "public,llx_societe,rowid,integer,NO,1",
      "public,llx_societe,email,varchar,YES,2",
      "public,llx_user,login,varchar,NO,1",
      "public,llx_user,pass_crypted,varchar,YES,2",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(root, "exports", "clients.csv"),
    [
      "nom;email;iban",
      "Durand;marie@example.fr;FR7630006000011234567890189",
      "Martin;paul@example.fr;FR7630006000011234567890190",
      "",
    ].join("\n"),
    "utf8",
  );

  const mission = {
    configVersion: "preuvance-mission-v1",
    mission: {
      client: "Client de test",
      reference: "TEST-001",
      operator: "Tests automatisés",
      mode: "metadata_only",
    },
    sources: [
      {
        id: "erp-sql",
        kind: "sql",
        system: "postgresql",
        dialect: "postgresql",
        label: "Base ERP",
        location: "srv-erp:5432/erp",
        executor: { type: "results", directory: "sql", format: "csv" },
      },
      {
        id: "exports",
        kind: "file",
        system: "csv",
        label: "Exports commerciaux",
        directory: "exports",
      },
    ],
  };

  const missionPath = join(root, "mission.json");
  await writeFile(missionPath, JSON.stringify(mission, null, 2), "utf8");
  return missionPath;
}

test("les autotests internes de l’agent passent", async () => {
  const { stdout } = await runAgent(["--self-test"]);
  assert.match(stdout, /AUTOTEST OK/);
});

test("le fichier de mission refuse un secret en clair et accepte un nom de variable", () => {
  const withSecret = parseMissionConfig({
    configVersion: "preuvance-mission-v1",
    mission: { client: "C", reference: "R" },
    sources: [
      {
        id: "sf",
        kind: "api",
        system: "salesforce",
        label: "CRM",
        instanceUrl: "https://exemple.my.salesforce.com",
        accessToken: "00D000000000000",
      },
    ],
  });
  assert.equal(withSecret.success, false);

  const withEnv = parseMissionConfig({
    configVersion: "preuvance-mission-v1",
    mission: { client: "C", reference: "R" },
    sources: [
      {
        id: "sf",
        kind: "api",
        system: "salesforce",
        label: "CRM",
        instanceUrl: "https://exemple.my.salesforce.com",
        tokenEnv: "PREUVANCE_SF_TOKEN",
      },
    ],
  });
  assert.equal(withEnv.success, true);
});

test("deux sources de même identifiant sont refusées", () => {
  const result = parseMissionConfig({
    configVersion: "preuvance-mission-v1",
    mission: { client: "C", reference: "R" },
    sources: [
      { id: "a", kind: "file", system: "csv", label: "A", directory: "." },
      { id: "a", kind: "file", system: "csv", label: "B", directory: "." },
    ],
  });
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.errors.join(" "), /double/);
});

test("la lecture tabulaire couvre CSV, TSV et JSON", () => {
  assert.deepEqual(parseTabular("a,b\n1,2\n", "csv"), [{ a: "1", b: "2" }]);
  assert.deepEqual(parseTabular("a\tb\n1\t2\n", "tsv"), [{ a: "1", b: "2" }]);
  assert.deepEqual(parseTabular('[{"a":1}]', "json"), [{ a: 1 }]);
  assert.deepEqual(parseTabular("", "csv"), []);
});

test("le mode --dry-run écrit les requêtes du pack d’accès sans ouvrir de connexion", async () => {
  const root = await mkdtemp(join(tmpdir(), "preuvance-agent-"));
  try {
    const missionPath = await buildMission(root);
    const out = join(root, "sortie");
    const { stdout } = await runAgent(["--mission", missionPath, "--out", out, "--dry-run"]);

    assert.match(stdout, /Aucune connexion n’a été ouverte/);
    const sql = await readFile(join(out, "requetes-lecture-seule.sql"), "utf8");
    assert.match(sql, /information_schema\.columns/);
    assert.match(sql, /GRANT SELECT ON ALL TABLES/);

    /* Les requêtes d’introspection (après le premier marqueur d’étape) ne
     * contiennent aucun ordre d’écriture. Le script de compte, lui, crée bien
     * un rôle : c’est le geste que le client exécute lui-même. */
    const queries = sql.slice(sql.indexOf("-- [tables]"));
    assert.doesNotMatch(
      queries,
      /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|GRANT|REVOKE)\b/i,
    );
    assert.ok(!existsSync(join(out, "preuvance-catalogue.json")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("la collecte complète produit un catalogue conforme et un rapport, sans valeur métier", async () => {
  const root = await mkdtemp(join(tmpdir(), "preuvance-agent-"));
  try {
    const missionPath = await buildMission(root);
    const out = join(root, "sortie");
    const { stdout } = await runAgent(["--mission", missionPath, "--out", out]);
    assert.match(stdout, /Score de préparation/);

    const catalogueText = await readFile(join(out, "preuvance-catalogue.json"), "utf8");
    const validation = validateCatalogue(JSON.parse(catalogueText));
    assert.equal(validation.success, true);
    if (!validation.success) return;

    const catalogue = validation.data;
    assert.equal(catalogue.sources.length, 2);
    assert.equal(catalogue.datasets.length, 3);

    const societe = catalogue.datasets.find((dataset) => dataset.name === "llx_societe");
    assert.equal(societe?.rowCount.value, 4213);
    assert.equal(societe?.rowCount.kind, "estimate");

    const emailField = societe?.fields.find((field) => field.name === "email");
    assert.ok(emailField?.sensitivity?.categories.includes("contact"));

    /* Le catalogue ne doit contenir aucune valeur des fichiers inventoriés. */
    assert.doesNotMatch(catalogueText, /marie@example\.fr|FR7630006|Durand/);

    const markdown = await readFile(join(out, "diagnostic-preuvance.md"), "utf8");
    assert.match(markdown, /Client de test/);
    assert.match(markdown, /```mermaid/);

    const html = await readFile(join(out, "diagnostic-preuvance.html"), "utf8");
    assert.doesNotMatch(html, /<script/i);

    const digest = JSON.parse(
      await readFile(join(out, "preuvance-catalogue-digest.json"), "utf8"),
    );
    assert.equal(JSON.stringify(digest).includes("Client de test"), false);
    assert.equal(JSON.stringify(digest).includes("llx_societe"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("la purge supprime les artefacts et laisse un journal vérifiable", async () => {
  const root = await mkdtemp(join(tmpdir(), "preuvance-agent-"));
  try {
    const missionPath = await buildMission(root);
    const out = join(root, "sortie");
    await runAgent(["--mission", missionPath, "--out", out]);
    assert.ok(existsSync(join(out, "preuvance-catalogue.json")));

    const { stdout } = await runAgent(["--mission", missionPath, "--out", out, "--purge"]);
    assert.match(stdout, /journal de suppression/);
    assert.ok(!existsSync(join(out, "preuvance-catalogue.json")));
    assert.ok(!existsSync(join(out, "diagnostic-preuvance.md")));

    const log = JSON.parse(await readFile(join(out, "journal-suppression.json"), "utf8"));
    const catalogueEntry = log.artefacts.find(
      (artefact: { name: string }) => artefact.name === "preuvance-catalogue.json",
    );
    assert.equal(catalogueEntry.outcome, "deleted");
    assert.match(catalogueEntry.sha256, /^[0-9a-f]{64}$/);
    assert.ok(catalogueEntry.sizeBytes > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("un fichier de mission non conforme fait échouer l’agent avec un message utile", async () => {
  const root = await mkdtemp(join(tmpdir(), "preuvance-agent-"));
  try {
    const missionPath = join(root, "mission.json");
    await writeFile(missionPath, JSON.stringify({ configVersion: "autre" }), "utf8");
    await assert.rejects(
      () => runAgent(["--mission", missionPath, "--out", join(root, "sortie")]),
      (error: Error & { stderr?: string }) => {
        assert.match(error.stderr ?? "", /non conforme/);
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("le journal de purge se rend en texte lisible sans outil", () => {
  const log = buildPurgeLog({
    missionReference: "TEST-001",
    client: "Client de test",
    purgedAt: "2026-07-24T18:00:00.000Z",
    artefacts: [
      { name: "b.json", sizeBytes: 10, sha256: "b".repeat(64), outcome: "deleted" },
      { name: "a.json", sizeBytes: 20, sha256: "a".repeat(64), outcome: "missing" },
    ],
  });

  assert.deepEqual(
    log.artefacts.map((artefact) => artefact.name),
    ["a.json", "b.json"],
  );
  const rendered = renderPurgeLog(log);
  assert.match(rendered, /TEST-001/);
  assert.match(rendered, /supprimé/);
  assert.match(rendered, /introuvable/);
});
