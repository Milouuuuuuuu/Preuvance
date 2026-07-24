/**
 * Générateur de documents administratifs de mission Preuvance.
 *
 * Une mission produit six documents : lettre de mission, facture, contrat de
 * sous-traitance (art. 28 RGPD), registre des traitements (art. 30.2),
 * checklist du pack d'accès et attestation de fin de mission. Ils sont tous
 * dérivés du même profil administratif et du même fichier de mission : ils ne
 * peuvent donc pas se contredire, et un changement d'entité émettrice (par
 * exemple le passage à une société suisse) se répercute partout.
 *
 * Usage :
 *   node --import tsx scripts/preuvance-admin.ts --profil profil.json --out sortie
 *   node --import tsx scripts/preuvance-admin.ts --profil profil.json --mission mission.json \
 *     --emettre lettre,pack,dpa
 *   node --import tsx scripts/preuvance-admin.ts --profil profil.json --mission mission.json \
 *     --emettre attestation --journal-purge sortie/journal-suppression.json \
 *     --catalogue sortie/preuvance-catalogue.json
 *   node --import tsx scripts/preuvance-admin.ts --self-test
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  buildAccessPackChecklist,
  buildCompletionCertificate,
  buildEngagementLetter,
  buildInvoice,
  buildProcessingAgreement,
  buildProcessingRecord,
} from "../lib/admin/documents";
import {
  formatMoney,
  parseAdminInput,
  type AdminInput,
} from "../lib/admin/entity-profile";
import {
  accessPackItemsFromMission,
  accountsToRevokeFromMission,
  completionContextFromArtefacts,
  processingContextFromMission,
} from "../lib/admin/from-mission";
import {
  computeTotals,
  nextInvoiceNumber,
  resolveVatTreatment,
} from "../lib/admin/invoicing";
import {
  renderDocumentHtml,
  renderDocumentMarkdown,
  type DocumentModel,
} from "../lib/documents/render";
import { validateCatalogue } from "../lib/inventory/catalogue-contract";
import { computeDiagnostic } from "../lib/inventory/diagnostic";
import { parseMissionConfig, type MissionConfig } from "../lib/inventory/mission-config";
import { purgeLogSchema, type PurgeLog } from "../lib/inventory/mission-log";

const DOCUMENTS = ["lettre", "facture", "dpa", "registre", "pack", "attestation"] as const;
type DocumentKey = (typeof DOCUMENTS)[number];

const FILE_NAMES: Record<DocumentKey, string> = {
  lettre: "lettre-de-mission",
  facture: "facture",
  dpa: "contrat-sous-traitance-rgpd",
  registre: "registre-traitements-sous-traitant",
  pack: "pack-acces-checklist",
  attestation: "attestation-fin-de-mission",
};

const NEEDS_MISSION: DocumentKey[] = ["dpa", "registre", "pack", "attestation"];

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/**
 * Les chemins passés en ligne de commande sont relatifs au dossier courant :
 * c'est ce que l'opérateur tape, donc ce qu'il attend. Seuls les chemins
 * écrits DANS un fichier de mission se lisent depuis ce fichier.
 */
async function readJson(path: string, label: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(resolve(path), "utf8")) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "erreur inconnue";
    return fail(`${label} illisible (${resolve(path)}) : ${detail}`);
  }
}

async function emit(
  model: DocumentModel,
  outDirectory: string,
  baseName: string,
): Promise<string[]> {
  await mkdir(outDirectory, { recursive: true });
  const markdownPath = join(outDirectory, `${baseName}.md`);
  const htmlPath = join(outDirectory, `${baseName}.html`);
  await writeFile(markdownPath, renderDocumentMarkdown(model), "utf8");
  await writeFile(htmlPath, renderDocumentHtml(model), "utf8");
  return [markdownPath, htmlPath];
}

async function runSelfTest(): Promise<void> {
  const failures: string[] = [];
  let count = 0;
  const check = (condition: boolean, name: string) => {
    count += 1;
    if (!condition) failures.push(name);
  };

  const input: AdminInput = sampleInput();

  const franchise = resolveVatTreatment(input.entity, input.client);
  check(franchise.ratePercent === 0, "franchise en base : aucun taux appliqué");
  check(
    franchise.mentions.some((mention) => mention.includes("293 B")),
    "franchise en base : mention de l’article 293 B",
  );

  const suisse = resolveVatTreatment(
    { ...input.entity, country: "CH", vatRegime: "assujetti_ch", currency: "CHF" },
    input.client,
  );
  check(suisse.ratePercent === 0, "société suisse vers client français : pas de TVA suisse");
  check(
    suisse.mentions.some((mention) => mention.includes("283, 2")),
    "société suisse vers client français : autoliquidation mentionnée",
  );
  check(
    suisse.warnings.some((warning) => warning.includes("182 B")),
    "société suisse vers client français : retenue à la source signalée",
  );

  const totals = computeTotals(input.engagement.lines, franchise, 0);
  check(totals.subtotalCents === 450_000, "total HT calculé en centimes entiers");
  check(totals.totalCents === totals.subtotalCents, "sans TVA, le TTC égale le HT");

  check(
    nextInvoiceNumber("PV", 2026, 41) === "PV-2026-0042",
    "numérotation séquentielle sans rupture",
  );

  check(formatMoney(450_000, "EUR") === "4 500,00 €", "formatage monétaire français");

  const lettre = buildEngagementLetter(input);
  check(lettre.sections.length >= 6, "lettre de mission complète");
  check(
    renderDocumentHtml(lettre).includes("<!doctype html>") &&
      !renderDocumentHtml(lettre).includes("<script"),
    "rendu HTML autonome et sans script",
  );

  const rejected = parseAdminInput({ entity: { legalName: "X" } });
  check(!rejected.success, "profil incomplet refusé");

  if (failures.length === 0) {
    log(`AUTOTEST OK (${count} assertions)`);
    return;
  }
  fail(`AUTOTEST ÉCHEC (${failures.length}/${count}) : ${failures.join(" | ")}`);
}

/** Profil d'exemple utilisé par les autotests — volontairement fictif. */
function sampleInput(): AdminInput {
  const parsed = parseAdminInput({
    entity: {
      profileVersion: "preuvance-admin-profile-v1",
      legalName: "Exemple Conseil",
      form: "micro_entreprise_fr",
      country: "FR",
      registrationLabel: "SIRET",
      registrationValue: "000 000 000 00000",
      vatRegime: "franchise_en_base_fr",
      address: {
        line1: "1 rue de l’Exemple",
        postalCode: "79000",
        city: "Niort",
        country: "France",
      },
      email: "contact@exemple.test",
      representative: "Prénom Nom",
      currency: "EUR",
      paymentTermsDays: 30,
    },
    client: {
      legalName: "Client de test",
      isBusiness: true,
      address: {
        line1: "2 avenue du Test",
        postalCode: "75000",
        city: "Paris",
        country: "France",
      },
      country: "FR",
    },
    engagement: {
      reference: "TEST-001",
      subject: "Diagnostic complet des sources de données",
      issuedOn: "2026-07-25T09:00:00.000Z",
      workingDays: 10,
      lines: [
        {
          label: "Diagnostic complet — inventaire, cartographie, plan de transition",
          quantity: 1,
          unit: "forfait",
          unitPriceCents: 450_000,
        },
      ],
      scope: [],
      exclusions: [],
      depositCents: 0,
    },
  });
  if (!parsed.success) {
    throw new Error(`profil d’exemple invalide : ${parsed.errors.join(" | ")}`);
  }
  return parsed.data;
}

const HELP = `Preuvance — documents administratifs de mission

  --profil <fichier>        profil administratif JSON (entité, client, engagement)
  --mission <fichier>       fichier de mission de l’agent (pack d’accès, DPA, registre)
  --emettre <liste>         documents à produire parmi : ${DOCUMENTS.join(", ")} (défaut : tous ceux possibles)
  --out <dossier>           dossier de sortie (défaut : à côté du profil)
  --journal-purge <fichier> journal de suppression, pour l’attestation
  --catalogue <fichier>     catalogue de la mission, pour reporter le score dans l’attestation
  --numero <valeur>         numéro de facture à porter sur la facture
  --self-test               vérifie les fonctions pures puis sort
  --help                    affiche cette aide

Le profil ne contient aucun secret : identité, adresse, régime de TVA et IBAN
sont des informations déjà imprimées sur une facture.`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      profil: { type: "string" },
      mission: { type: "string" },
      emettre: { type: "string" },
      out: { type: "string" },
      "journal-purge": { type: "string" },
      catalogue: { type: "string" },
      numero: { type: "string" },
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
  if (!values.profil) fail(`Aucun profil administratif : utiliser --profil <fichier>.\n\n${HELP}`);

  const profilePath = resolve(values.profil);
  const parsedProfile = parseAdminInput(await readJson(profilePath, "Profil administratif"));
  if (!parsedProfile.success) {
    fail(`Profil non conforme :\n  - ${parsedProfile.errors.join("\n  - ")}`);
  }
  const input: AdminInput = values.numero
    ? {
        ...parsedProfile.data,
        engagement: { ...parsedProfile.data.engagement, invoiceNumber: values.numero },
      }
    : parsedProfile.data;

  let mission: MissionConfig | null = null;
  if (values.mission) {
    const parsedMission = parseMissionConfig(
      await readJson(values.mission, "Fichier de mission"),
    );
    if (!parsedMission.success) {
      fail(`Fichier de mission non conforme :\n  - ${parsedMission.errors.join("\n  - ")}`);
    }
    mission = parsedMission.data;
  }

  const requested = (values.emettre ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const unknown = requested.filter((item) => !DOCUMENTS.includes(item as DocumentKey));
  if (unknown.length > 0) {
    fail(`Document inconnu : ${unknown.join(", ")}. Valeurs acceptées : ${DOCUMENTS.join(", ")}.`);
  }

  const selected: DocumentKey[] = (
    requested.length > 0 ? (requested as DocumentKey[]) : [...DOCUMENTS]
  ).filter((key) => {
    if (!NEEDS_MISSION.includes(key)) return true;
    if (mission) return true;
    if (requested.length > 0) {
      fail(`Le document « ${key} » exige --mission <fichier>.`);
    }
    return false;
  });

  const outDirectory = resolve(values.out ?? join(dirname(profilePath), "documents"));

  let purgeLog: PurgeLog | undefined;
  if (values["journal-purge"]) {
    const parsed = purgeLogSchema.safeParse(
      await readJson(values["journal-purge"], "Journal de suppression"),
    );
    if (!parsed.success) fail("Journal de suppression non conforme au contrat de purge.");
    purgeLog = parsed.data;
  }

  let score: { value: number; tier: string; summary: string } | undefined;
  if (values.catalogue) {
    const validation = validateCatalogue(
      await readJson(values.catalogue, "Catalogue"),
    );
    if (!validation.success) {
      fail(`Catalogue non conforme : ${validation.errors[0] ?? "format inattendu"}`);
    }
    const diagnostic = computeDiagnostic(validation.data);
    score = { value: diagnostic.score, tier: diagnostic.tier, summary: diagnostic.summary };
  }

  const written: string[] = [];
  for (const key of selected) {
    let model: DocumentModel;
    if (key === "lettre") model = buildEngagementLetter(input);
    else if (key === "facture") model = buildInvoice(input);
    else if (key === "dpa") {
      model = buildProcessingAgreement(input, processingContextFromMission(mission!));
    } else if (key === "registre") {
      model = buildProcessingRecord(input, processingContextFromMission(mission!));
    } else if (key === "pack") {
      model = buildAccessPackChecklist(input, accessPackItemsFromMission(mission!));
    } else {
      model = buildCompletionCertificate(
        input,
        completionContextFromArtefacts({
          mission: mission!,
          completedOn: new Date().toISOString(),
          purgeLog,
          score,
        }),
      );
    }
    written.push(...(await emit(model, outDirectory, FILE_NAMES[key])));
  }

  const treatment = resolveVatTreatment(input.entity, input.client);
  const totals = computeTotals(input.engagement.lines, treatment, input.engagement.depositCents);

  log("");
  log(`Mission ${input.engagement.reference} — ${input.client.legalName}`);
  log(
    `Montant : ${formatMoney(totals.totalCents, input.entity.currency)} (règle de TVA « ${treatment.ruleId} »)`,
  );
  for (const mention of treatment.mentions) log(`  · ${mention}`);
  for (const obligation of treatment.obligations) log(`  ⚑ ${obligation}`);
  for (const warning of treatment.warnings) log(`  ⚠ ${warning}`);
  if (mission) {
    const comptes = accountsToRevokeFromMission(mission);
    if (comptes.length > 0) {
      log(`  ⚑ ${comptes.length} accès à révoquer en fin de mission (repris dans l’attestation)`);
    }
  }
  log("");
  log(`Documents écrits dans ${outDirectory} :`);
  for (const path of written) log(`  - ${path.slice(outDirectory.length + 1)}`);
}

await main();
