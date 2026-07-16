import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { validateScanReport } from "../lib/scan/scan-contract";
import { computeScanExposure } from "../app/lib/assessment/scan-scoring";

// Rapport réellement produit par scripts/preuvance-scan.ps1 sur un poste Windows,
// gelé comme fixture pour verrouiller le contrat entre le CLI et l'application.
const fixturePath = fileURLToPath(
  new URL("./fixtures/scan-sample.json", import.meta.url),
);
const raw: unknown = JSON.parse(readFileSync(fixturePath, "utf8"));

test("le rapport produit par le scan PowerShell respecte le contrat strict", () => {
  const validation = validateScanReport(raw);
  assert.equal(validation.success, true);
});

test("le scoring d’exposition traite la fixture réelle sans erreur", () => {
  const validation = validateScanReport(raw);
  assert.equal(validation.success, true);
  if (!validation.success) return;

  const exposure = computeScanExposure(validation.data);
  assert.ok(exposure.exposureScore >= 0 && exposure.exposureScore <= 100);
  assert.ok(
    exposure.findings.some((finding) => finding.id.startsWith("ai-endpoint-")),
  );
});

test("la fixture réelle exerce la concordance : Anthropic déclaré et observé", () => {
  const validation = validateScanReport(raw);
  assert.equal(validation.success, true);
  if (!validation.success) return;

  assert.equal(validation.data.declaration?.providers.includes("anthropic"), true);

  const exposure = computeScanExposure(validation.data);
  // L'appel observé vers api.anthropic.com (Claude Code) était déclaré avant le
  // scan : il corrobore la déclaration au lieu d'être un faux positif critique.
  assert.equal(exposure.concordance.status, "concordant");
  assert.ok(exposure.concordance.corroborated.includes("Anthropic"));
  assert.equal(exposure.observed.undeclaredAiEndpoints, 0);
  const endpointFinding = exposure.findings.find((finding) =>
    finding.id.startsWith("ai-endpoint-"),
  );
  assert.equal(endpointFinding?.severity, "minor");
});
