import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateEvidenceCoverage,
  evidenceLayer,
  evidenceLedgerSchema,
  evidenceLedgerItemSchema,
  normalizeEvidenceLedger,
  reportEvidenceSchema,
  stableEvidenceId,
} from "../lib/evidence/evidence-ledger";

const now = "2026-07-20T10:00:00.000Z";

test("les preuves manquantes ne gonflent jamais le compteur déclaré", () => {
  assert.equal(evidenceLayer("missing"), "missing");
  assert.equal(evidenceLayer("unverified"), "missing");
  const coverage = calculateEvidenceCoverage([
    { status: "missing" },
    { status: "declared" },
    { status: "detected" },
    { status: "verified" },
  ]);

  assert.equal(coverage.missing, 1);
  assert.equal(coverage.declared, 1);
  assert.equal(coverage.detected, 1);
  assert.equal(coverage.proven, 1);
  assert.equal(coverage.score, 43);
});

test("seule une pièce revue par un humain peut être marquée prouvée", () => {
  const invalid = reportEvidenceSchema.safeParse({
    control: "Journal de revue humaine",
    status: "verified",
    detail: "Pièce déclarée comme relue.",
  });
  assert.equal(invalid.success, false);

  const valid = evidenceLedgerItemSchema.safeParse({
    id: "ev-review",
    control: "Journal de revue humaine",
    status: "verified",
    detail: "Revue effectuée sur la version 3.",
    sourceType: "document",
    reviewedBy: "Responsable conformité",
    reviewedAt: now,
    updatedAt: now,
  });
  assert.equal(valid.success, true);
});

test("une pièce locale sans empreinte SHA-256 est rejetée", () => {
  const validation = evidenceLedgerItemSchema.safeParse({
    id: "ev-file",
    control: "Politique IA",
    status: "documented",
    detail: "Document pointé localement.",
    sourceType: "document",
    fileName: "politique-ia.pdf",
    fileSizeBytes: 1234,
    updatedAt: now,
  });
  assert.equal(validation.success, false);
});

test("la normalisation ajoute des identifiants stables sans promouvoir une déclaration", () => {
  const source = [
    {
      control: "Registre des usages",
      status: "declared",
      detail: "Contrôle mentionné dans la description.",
    },
  ];
  const first = normalizeEvidenceLedger(source, "assessment-1");
  const second = normalizeEvidenceLedger(source, "assessment-1");

  assert.equal(first.length, 1);
  assert.equal(first[0]?.id, second[0]?.id);
  assert.equal(first[0]?.status, "declared");
  assert.equal(first[0]?.sourceType, "user-declaration");
  assert.equal(
    stableEvidenceId("assessment-1", "Registre des usages", 0),
    first[0]?.id,
  );
});

test("le registre refuse deux preuves portant le même identifiant", () => {
  const item = {
    id: "ev-duplicate",
    control: "Politique IA",
    status: "documented" as const,
    detail: "Document pointé localement.",
    sourceType: "document" as const,
    updatedAt: now,
  };

  const validation = evidenceLedgerSchema.safeParse([item, { ...item }]);
  assert.equal(validation.success, false);
});
