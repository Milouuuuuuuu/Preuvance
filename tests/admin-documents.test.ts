import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  buildAccessPackChecklist,
  buildCompletionCertificate,
  buildEngagementLetter,
  buildInvoice,
  buildProcessingAgreement,
  buildProcessingRecord,
  type ProcessingContext,
} from "../lib/admin/documents";
import {
  accessMethodFor,
  accessPackItemsFromMission,
  accountsToRevokeFromMission,
  completionContextFromArtefacts,
  processingContextFromMission,
} from "../lib/admin/from-mission";
import { renderDocumentHtml, renderDocumentMarkdown } from "../lib/documents/render";
import { parseMissionConfig, type MissionConfig } from "../lib/inventory/mission-config";
import { sampleAdminInput } from "./admin-invoicing.test";

const execFileAsync = promisify(execFile);
const scriptPath = join(process.cwd(), "scripts", "preuvance-admin.ts");

function sampleMission(): MissionConfig {
  const parsed = parseMissionConfig({
    configVersion: "preuvance-mission-v1",
    mission: { client: "Client de test", reference: "TEST-001", mode: "metadata_only" },
    sources: [
      {
        id: "erp",
        kind: "sql",
        system: "postgresql",
        dialect: "postgresql",
        label: "ERP interne",
        readOnlyAccount: "preuvance_ro",
        executor: { type: "command", command: "psql", args: ["--csv", "-c", "{{sql}}"] },
      },
      {
        id: "erp-dba",
        kind: "sql",
        system: "mysql",
        dialect: "mysql",
        label: "Base facturation",
        executor: { type: "results", directory: "resultats" },
      },
      {
        id: "exports",
        kind: "file",
        system: "csv",
        label: "Exports commerciaux",
        directory: "exports",
      },
      {
        id: "crm",
        kind: "api",
        system: "salesforce",
        label: "CRM",
        instanceUrl: "https://exemple.my.salesforce.com",
        tokenEnv: "PREUVANCE_SF_TOKEN",
      },
    ],
  });
  if (!parsed.success) throw new Error(parsed.errors.join(" | "));
  return parsed.data;
}

const CONTEXT: ProcessingContext = {
  systems: ["ERP interne", "Exports commerciaux"],
  collectionMode: "metadata_only",
  retentionDays: 30,
  hosting: "poste de travail du client",
  subProcessors: [],
  dataSubjects: ["clients", "salariés"],
};

test("la lettre de mission porte le périmètre, le délai et le prix, et se signe", () => {
  const model = buildEngagementLetter(sampleAdminInput());
  const markdown = renderDocumentMarkdown(model);

  assert.match(markdown, /Lettre de mission/);
  assert.match(markdown, /10 jours ouvrés/);
  assert.match(markdown, /1 000,00 €/);
  assert.match(markdown, /293 B/);
  assert.match(markdown, /bon pour accord/);
  assert.match(markdown, /Aucune valeur métier/);
  assert.ok(model.sections.some((section) => section.id === "limites"));
});

test("la facture porte les mentions obligatoires et l’échéance calculée", () => {
  const input = sampleAdminInput();
  const model = buildInvoice({
    ...input,
    engagement: { ...input.engagement, invoiceNumber: "PV-2026-0001" },
  });
  const markdown = renderDocumentMarkdown(model);

  assert.match(markdown, /Facture PV-2026-0001/);
  assert.match(markdown, /25\/07\/2026/);
  assert.match(markdown, /24\/08\/2026/);
  assert.match(markdown, /Total HT/);
  assert.match(markdown, /indemnité forfaitaire de recouvrement de 40 €/);
  assert.match(markdown, /FR7630006000011234567890189/);
  assert.match(markdown, /legifrance\.gouv\.fr/);
});

test("un acompte apparaît en déduction et le net à payer suit", () => {
  const input = sampleAdminInput();
  const model = buildInvoice({
    ...input,
    engagement: { ...input.engagement, invoiceNumber: "PV-2026-0002", depositCents: 40_000 },
  });
  const markdown = renderDocumentMarkdown(model);
  assert.match(markdown, /Acompte déjà réglé/);
  assert.match(markdown, /- 400,00 €/);
  assert.match(markdown, /Net à payer/);
  assert.equal(model.headline?.value, "600,00 €");
});

test("une facture émise depuis la Suisse vers la France porte l’autoliquidation et l’alerte de retenue", () => {
  const input = sampleAdminInput();
  const model = buildInvoice({
    ...input,
    entity: {
      ...input.entity,
      country: "CH",
      vatRegime: "assujetti_ch",
      currency: "CHF",
      registrationLabel: "IDE",
      registrationValue: "CHE-000.000.000",
    },
  });
  const markdown = renderDocumentMarkdown(model);

  assert.match(markdown, /8 al\. 1 LTVA/);
  assert.match(markdown, /283, 2 du CGI/);
  assert.match(markdown, /182 B/);
  assert.match(markdown, /CHF/);
});

test("le contrat de sous-traitance couvre les huit obligations de l’article 28.3", () => {
  const markdown = renderDocumentMarkdown(
    buildProcessingAgreement(sampleAdminInput(), CONTEXT),
  );

  for (const reference of [
    "28.3 a",
    "28.3 b",
    "28.3 c",
    "28.2 et 28.4",
    "28.3 e",
    "28.3 f",
    "28.3 g",
    "28.3 h",
  ]) {
    assert.ok(markdown.includes(reference), `obligation manquante : ${reference}`);
  }
  assert.match(markdown, /responsable du traitement/);
  assert.match(markdown, /48 heures/);
  assert.match(markdown, /journal de suppression/i);
});

test("un sous-traitant suisse cite la LPD et la décision d’adéquation", () => {
  const input = sampleAdminInput();
  const markdown = renderDocumentMarkdown(
    buildProcessingAgreement(
      {
        ...input,
        entity: { ...input.entity, country: "CH", vatRegime: "assujetti_ch", currency: "CHF" },
      },
      CONTEXT,
    ),
  );
  assert.match(markdown, /loi fédérale suisse sur la protection des données/);
  assert.match(markdown, /décision d’adéquation/);
});

test("le registre du sous-traitant remplit les mentions de l’article 30.2", () => {
  const markdown = renderDocumentMarkdown(buildProcessingRecord(sampleAdminInput(), CONTEXT));
  assert.match(markdown, /article 30\.2/);
  assert.match(markdown, /Responsable du traitement/);
  assert.match(markdown, /Transferts hors UE/);
  assert.match(markdown, /Durée de conservation/);
  assert.match(markdown, /Mesures de sécurité/);
  assert.match(markdown, /n’est pas occasionnel/);
});

test("le pack d’accès reprend chaque source de la mission avec son mode d’accès", () => {
  const mission = sampleMission();
  const items = accessPackItemsFromMission(mission);
  const markdown = renderDocumentMarkdown(buildAccessPackChecklist(sampleAdminInput(), items));

  assert.equal(items.length, 4);
  assert.match(markdown, /ERP interne/);
  assert.match(markdown, /Base facturation/);
  assert.match(markdown, /aucun accès direct/);
  assert.match(markdown, /PREUVANCE_SF_TOKEN/);
  assert.match(markdown, /☐/);
});

test("le mode d’accès est déduit du type de source, sans supposition", () => {
  const mission = sampleMission();
  assert.match(accessMethodFor(mission.sources[0]), /preuvance_ro/);
  assert.match(accessMethodFor(mission.sources[1]), /remises au DBA/);
  assert.match(accessMethodFor(mission.sources[2]), /exports/);
  assert.match(accessMethodFor(mission.sources[3]), /View Setup and Configuration/);
});

test("les accès à révoquer excluent le mode remise au DBA, qui n’ouvre rien", () => {
  const comptes = accountsToRevokeFromMission(sampleMission());
  assert.equal(comptes.length, 2);
  assert.match(comptes.join(" "), /preuvance_ro/);
  assert.match(comptes.join(" "), /PREUVANCE_SF_TOKEN/);
  assert.doesNotMatch(comptes.join(" "), /Base facturation/);
});

test("le contexte de traitement hérite du périmètre et du mode de la mission", () => {
  const context = processingContextFromMission(sampleMission(), { retentionDays: 15 });
  assert.equal(context.collectionMode, "metadata_only");
  assert.equal(context.retentionDays, 15);
  assert.equal(context.systems.length, 4);
  assert.deepEqual(context.subProcessors, []);
});

test("l’attestation reprend les empreintes du journal de purge", () => {
  const context = completionContextFromArtefacts({
    mission: sampleMission(),
    completedOn: "2026-08-05T10:00:00.000Z",
    purgeLog: {
      schemaVersion: "preuvance-purge-v1",
      missionReference: "TEST-001",
      client: "Client de test",
      purgedAt: "2026-08-05T09:30:00.000Z",
      artefacts: [
        {
          name: "preuvance-catalogue.json",
          sizeBytes: 1024,
          sha256: "a".repeat(64),
          outcome: "deleted",
        },
        { name: "absent.json", sizeBytes: 0, sha256: "0".repeat(64), outcome: "missing" },
      ],
      statement:
        "Chaque artefact listé a été supprimé du poste d’exécution après calcul de son empreinte. Preuvance ne conserve aucune copie ailleurs : le catalogue et le rapport n’ont jamais quitté ce poste.",
    },
    score: { value: 59, tier: "C", summary: "Score de préparation : 59/100." },
  });

  const markdown = renderDocumentMarkdown(
    buildCompletionCertificate(sampleAdminInput(), context),
  );
  assert.equal(context.purged.length, 1, "un artefact absent n’est pas présenté comme supprimé");
  assert.match(markdown, /59\/100/);
  assert.match(markdown, new RegExp("a".repeat(64)));
  assert.match(markdown, /05\/08\/2026/);
  assert.match(markdown, /preuvance_ro/);
});

test("sans journal de purge, l’attestation le signale au lieu de rester muette", () => {
  const context = completionContextFromArtefacts({
    mission: sampleMission(),
    completedOn: "2026-08-05T10:00:00.000Z",
  });
  const markdown = renderDocumentMarkdown(
    buildCompletionCertificate(sampleAdminInput(), context),
  );
  assert.match(markdown, /Journal de suppression manquant/);
});

test("le rendu HTML des documents reste autonome et échappe le contenu hostile", () => {
  const input = sampleAdminInput();
  const html = renderDocumentHtml(
    buildInvoice({
      ...input,
      client: { ...input.client, legalName: '<img src=x onerror="alert(1)">' },
    }),
  );

  assert.match(html, /^<!doctype html>/);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /src="https?:/i);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
  /* Les cellules multilignes deviennent des sauts de ligne HTML, pas du texte collé. */
  assert.match(html, /<br \/>/);
});

test("les autotests du générateur administratif passent", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--import", "tsx", scriptPath, "--self-test"],
    { cwd: process.cwd(), maxBuffer: 4 * 1024 * 1024 },
  );
  assert.match(stdout, /AUTOTEST OK/);
});

test("le générateur produit les six documents en Markdown et en HTML", async () => {
  const root = await mkdtemp(join(tmpdir(), "preuvance-admin-"));
  try {
    const input = sampleAdminInput();
    const profilePath = join(root, "profil.json");
    const missionPath = join(root, "mission.json");
    await writeFile(profilePath, JSON.stringify(input, null, 2), "utf8");
    await writeFile(missionPath, JSON.stringify(sampleMission(), null, 2), "utf8");

    const out = join(root, "documents");
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "--import",
        "tsx",
        scriptPath,
        "--profil",
        profilePath,
        "--mission",
        missionPath,
        "--out",
        out,
        "--numero",
        "PV-2026-0007",
      ],
      { cwd: process.cwd(), maxBuffer: 8 * 1024 * 1024 },
    );

    assert.match(stdout, /fr-franchise-domestique/);
    assert.match(stdout, /accès à révoquer/);

    for (const name of [
      "lettre-de-mission",
      "facture",
      "contrat-sous-traitance-rgpd",
      "registre-traitements-sous-traitant",
      "pack-acces-checklist",
      "attestation-fin-de-mission",
    ]) {
      const markdown = await readFile(join(out, `${name}.md`), "utf8");
      const html = await readFile(join(out, `${name}.html`), "utf8");
      assert.ok(markdown.startsWith("# "), `${name} : titre Markdown manquant`);
      assert.match(html, /^<!doctype html>/, `${name} : HTML non autonome`);
    }

    const facture = await readFile(join(out, "facture.md"), "utf8");
    assert.match(facture, /PV-2026-0007/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("un document exigeant la mission échoue proprement quand elle manque", async () => {
  const root = await mkdtemp(join(tmpdir(), "preuvance-admin-"));
  try {
    const profilePath = join(root, "profil.json");
    await writeFile(profilePath, JSON.stringify(sampleAdminInput(), null, 2), "utf8");

    await assert.rejects(
      () =>
        execFileAsync(
          process.execPath,
          ["--import", "tsx", scriptPath, "--profil", profilePath, "--emettre", "pack"],
          { cwd: process.cwd() },
        ),
      (error: Error & { stderr?: string }) => {
        assert.match(error.stderr ?? "", /exige --mission/);
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
