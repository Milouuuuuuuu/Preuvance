import assert from "node:assert/strict";
import test from "node:test";

import {
  CATALOGUE_PRIVACY_STATEMENT,
  CATALOGUE_SCHEMA_VERSION,
  createEmptyCatalogue,
  toIdentifier,
  validateCatalogue,
  type Catalogue,
} from "../lib/inventory/catalogue-contract";

export function baseCatalogue(overrides: Partial<Catalogue> = {}): Catalogue {
  return {
    schemaVersion: CATALOGUE_SCHEMA_VERSION,
    generatedAt: "2026-07-24T09:00:00.000Z",
    mission: {
      client: "Client de démonstration",
      reference: "PVD-2026-001",
      operator: "Équipe terrain",
      startedAt: "2026-07-24T08:00:00.000Z",
      mode: "metadata_only",
    },
    sources: [
      {
        id: "erp-sql",
        kind: "sql",
        system: "postgresql",
        label: "Base ERP",
        location: "srv-erp:5432/erp",
        collectedAt: "2026-07-24T08:10:00.000Z",
        status: "collected",
        notes: [],
      },
    ],
    datasets: [
      {
        id: "erp-sql-public-clients",
        sourceId: "erp-sql",
        name: "clients",
        namespace: "public",
        kind: "table",
        rowCount: { value: 4213, kind: "estimate", method: "pg_class.reltuples" },
        sizeBytes: 8_388_608,
        lastChangeAt: "2026-07-20T10:00:00.000Z",
        lastChangeSource: "table_metadata",
        fields: [
          { name: "rowid", dataType: "integer", nullable: false, isPrimaryKey: true },
          { name: "email", dataType: "varchar", nullable: true },
        ],
        notes: [],
      },
    ],
    tools: [],
    flows: [],
    privacy: CATALOGUE_PRIVACY_STATEMENT,
    notes: [],
    ...overrides,
  };
}

test("le contrat accepte un catalogue bien formé et refuse une valeur métier", () => {
  assert.equal(validateCatalogue(baseCatalogue()).success, true);

  const withCellValue = validateCatalogue({
    ...baseCatalogue(),
    datasets: [
      {
        ...baseCatalogue().datasets[0],
        fields: [{ name: "email", dataType: "varchar", sampleValue: "marie@example.fr" }],
      },
    ],
  });
  assert.equal(withCellValue.success, false);
  if (!withCellValue.success) {
    assert.match(withCellValue.errors.join(" "), /sampleValue|unrecognized|reconnu/i);
  }
});

test("l’intégrité référentielle est vérifiée : une source inconnue est refusée", () => {
  const result = validateCatalogue({
    ...baseCatalogue(),
    datasets: [{ ...baseCatalogue().datasets[0], sourceId: "source-fantome" }],
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.errors.join(" "), /source inconnue/);
  }
});

test("les identifiants dupliqués de sources, jeux de données et outils sont refusés", () => {
  const catalogue = baseCatalogue();
  const duplicated = validateCatalogue({
    ...catalogue,
    sources: [catalogue.sources[0], { ...catalogue.sources[0] }],
  });
  assert.equal(duplicated.success, false);
  if (!duplicated.success) {
    assert.match(duplicated.errors.join(" "), /identifiant dupliqué/);
  }
});

test("un flux qui référence un outil absent est refusé", () => {
  const result = validateCatalogue({
    ...baseCatalogue(),
    flows: [
      {
        id: "flux-1",
        from: { kind: "source", ref: "erp-sql" },
        to: { kind: "tool", ref: "outil-absent" },
        medium: "api",
        frequency: "quotidien",
        personalData: "unknown",
        transfersOutsideEu: "unknown",
        evidence: "declared",
      },
    ],
  });
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.errors.join(" "), /outil inconnu/);
});

test("le catalogue vide reste valide et porte la mention de confidentialité", () => {
  const catalogue = createEmptyCatalogue(
    {
      client: "Client",
      reference: "M-1",
      startedAt: "2026-07-24T08:00:00.000Z",
      mode: "metadata_only",
    },
    "2026-07-24T09:00:00.000Z",
  );
  assert.equal(catalogue.privacy, CATALOGUE_PRIVACY_STATEMENT);
  assert.equal(validateCatalogue(catalogue).success, true);
});

test("toIdentifier produit un identifiant stable, sans accent ni espace", () => {
  assert.equal(toIdentifier("Base ERP", "Public", "Sociétés"), "base-erp-public-societes");
  assert.equal(toIdentifier("---"), "objet");
  assert.equal(toIdentifier("llx_société"), "llx_societe");
  assert.equal(toIdentifier("A".repeat(200)).length, 120);
});
