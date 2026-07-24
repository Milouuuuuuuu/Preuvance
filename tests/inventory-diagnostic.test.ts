import assert from "node:assert/strict";
import test from "node:test";

import type { Catalogue } from "../lib/inventory/catalogue-contract";
import { createCatalogueDigest } from "../lib/inventory/catalogue-digest";
import { computeDiagnostic } from "../lib/inventory/diagnostic";
import { annotateCatalogue } from "../lib/inventory/sensitive-fields";
import { baseCatalogue } from "./inventory-catalogue.test";

function catalogueWith(overrides: Partial<Catalogue>): Catalogue {
  return annotateCatalogue({ ...baseCatalogue(), ...overrides });
}

test("le diagnostic est déterministe : deux calculs rendent le même résultat", () => {
  const catalogue = catalogueWith({});
  assert.deepEqual(computeDiagnostic(catalogue), computeDiagnostic(catalogue));
});

test("une collecte vide ne peut pas produire un bon score", () => {
  const diagnostic = computeDiagnostic(catalogueWith({ datasets: [] }));
  assert.equal(diagnostic.score, 35);
  assert.equal(diagnostic.tier, "D");
  assert.ok(diagnostic.rawScore > diagnostic.score);
  assert.match(diagnostic.appliedCaps[0].reason, /Aucun jeu de données/);
  assert.ok(
    diagnostic.findings.some((finding) => finding.id === "inventaire-aucun-jeu-de-donnees"),
  );
});

test("aucune source du tout produit un constat critique explicite", () => {
  const diagnostic = computeDiagnostic(catalogueWith({ sources: [], datasets: [] }));
  assert.ok(diagnostic.findings.some((finding) => finding.id === "inventaire-aucune-source"));
});

test("une source injoignable plafonne le score et n’est jamais comptée comme un point positif", () => {
  const catalogue = baseCatalogue();
  const diagnostic = computeDiagnostic(
    catalogueWith({
      sources: [
        catalogue.sources[0],
        {
          id: "crm-api",
          kind: "api",
          system: "salesforce",
          label: "CRM",
          collectedAt: "2026-07-24T08:20:00.000Z",
          status: "unreachable",
          notes: ["jeton absent"],
        },
      ],
    }),
  );

  assert.ok(diagnostic.appliedCaps.some((cap) => cap.reason.includes("injoignables")));
  assert.ok(
    diagnostic.findings.some((finding) => finding.id === "inventaire-source-injoignable-crm-api"),
  );
});

test("des champs de catégorie particulière et des secrets remontent en constats gradués", () => {
  const catalogue = baseCatalogue();
  const diagnostic = computeDiagnostic(
    catalogueWith({
      datasets: [
        {
          ...catalogue.datasets[0],
          fields: [
            { name: "arret_maladie", dataType: "varchar" },
            { name: "mot_de_passe", dataType: "varchar" },
            { name: "iban", dataType: "varchar" },
          ],
        },
      ],
    }),
  );

  const ids = diagnostic.findings.map((finding) => finding.id);
  assert.ok(ids.includes("dcp-categories-particulieres"));
  assert.ok(ids.includes("securite-secrets-en-base"));
  assert.ok(ids.includes("dcp-donnees-bancaires"));

  const critical = diagnostic.findings.find((finding) => finding.severity === "critical");
  assert.ok(critical);
  assert.ok(diagnostic.appliedCaps.some((cap) => cap.cap === 59));
  assert.ok(diagnostic.score <= 59);
});

test("un transfert hors UE déclaré est signalé comme déclaré, pas comme observé", () => {
  const diagnostic = computeDiagnostic(
    catalogueWith({
      flows: [
        {
          id: "flux-1",
          from: { kind: "source", ref: "erp-sql" },
          to: { kind: "external", ref: "prestataire-us" },
          medium: "api",
          frequency: "quotidien",
          personalData: "yes",
          transfersOutsideEu: "yes",
          evidence: "declared",
        },
      ],
    }),
  );

  const finding = diagnostic.findings.find(
    (item) => item.id === "securite-transferts-hors-ue",
  );
  assert.ok(finding);
  assert.equal(finding.evidence, "declared");
  assert.match(finding.basis ?? "", /Chapitre V/);
});

test("un digest de scan IA divergent déclenche le constat de shadow AI et lève le plafond IA", () => {
  const diagnostic = computeDiagnostic(
    catalogueWith({
      aiScan: {
        schemaVersion: "preuvance-scan-digest-v1",
        createdAt: "2026-07-24T08:00:00.000Z",
        hostProfile: "professional",
        exposureScore: 40,
        concordance: "divergent",
        declaredProviders: ["openai"],
        corroboratedProviders: ["openai"],
        undeclaredProviders: ["anthropic"],
        findingCounts: { critical: 1, major: 0, moderate: 0, minor: 0 },
        observation: {
          undeclaredAiEndpoints: 1,
          declaredAiEndpoints: 1,
          secretFiles: 0,
          personalDataFiles: 0,
          networkObservationAvailable: true,
        },
        privacy:
          "Digest agrégé sans chemin, IP, processus, contenu de fichier ni empreinte de fichier sensible.",
      },
    }),
  );

  assert.ok(diagnostic.findings.some((finding) => finding.id === "ia-shadow-ai"));
  assert.ok(!diagnostic.appliedCaps.some((cap) => cap.reason.includes("scan de dépendances IA")));
});

test("sans scan IA, un plafond et un constat signalent l’angle mort", () => {
  const diagnostic = computeDiagnostic(catalogueWith({}));
  assert.ok(diagnostic.findings.some((finding) => finding.id === "ia-scan-absent"));
  assert.ok(diagnostic.appliedCaps.some((cap) => cap.cap === 85));
});

test("les données dormantes se mesurent par rapport à une date de référence fournie", () => {
  const catalogue = baseCatalogue();
  const dormant = catalogueWith({
    datasets: [
      { ...catalogue.datasets[0], lastChangeAt: "2020-01-01T00:00:00.000Z" },
    ],
  });

  const recent = computeDiagnostic(dormant, { referenceDate: "2020-02-01T00:00:00.000Z" });
  assert.ok(!recent.findings.some((finding) => finding.id === "qualite-donnees-dormantes"));

  const later = computeDiagnostic(dormant, { referenceDate: "2026-07-24T00:00:00.000Z" });
  assert.ok(later.findings.some((finding) => finding.id === "qualite-donnees-dormantes"));
});

test("le plan de transition classe les actions par urgence et chiffre la charge", () => {
  const catalogue = baseCatalogue();
  const diagnostic = computeDiagnostic(
    catalogueWith({
      datasets: [
        {
          ...catalogue.datasets[0],
          fields: [{ name: "mot_de_passe", dataType: "varchar" }],
        },
      ],
    }),
  );

  const [immediate] = diagnostic.plan;
  assert.equal(immediate.id, "phase-immediate");
  assert.ok(immediate.actions.length > 0);
  assert.ok(immediate.effortDays > 0);

  const planned = diagnostic.plan.flatMap((phase) => phase.actions.map((action) => action.id));
  const expected = diagnostic.findings.map((finding) => `action-${finding.id}`);
  assert.deepEqual([...planned].sort(), [...expected].sort());
});

test("le digest transmis à un modèle ne contient aucun nom de client, de source ni de table", () => {
  const catalogue = catalogueWith({});
  const diagnostic = computeDiagnostic(catalogue);
  const digest = createCatalogueDigest(catalogue, diagnostic, "2026-07-24T09:00:00.000Z");
  const serialized = JSON.stringify(digest);

  assert.doesNotMatch(serialized, /Client de démonstration/);
  assert.doesNotMatch(serialized, /Base ERP/);
  assert.doesNotMatch(serialized, /clients/);
  assert.doesNotMatch(serialized, /srv-erp/);
  assert.equal(digest.score, diagnostic.score);
  assert.equal(digest.aiConcordance, "absent");
});

test("le digest anonymise l’identifiant d’une source injoignable", () => {
  const catalogue = catalogueWith({
    sources: [
      {
        id: "crm-confidentiel",
        kind: "api",
        system: "salesforce",
        label: "CRM confidentiel",
        collectedAt: "2026-07-24T08:20:00.000Z",
        status: "unreachable",
        notes: [],
      },
    ],
    datasets: [],
  });
  const digest = createCatalogueDigest(
    catalogue,
    computeDiagnostic(catalogue),
    "2026-07-24T09:00:00.000Z",
  );

  assert.doesNotMatch(JSON.stringify(digest), /crm-confidentiel/);
  assert.ok(digest.findings.some((finding) => finding.id === "inventaire-source-injoignable"));
});
