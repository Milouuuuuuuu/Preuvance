import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  northstarDemoAssessment,
  northstarDemoReport,
} from "../demo/build-week/northstar-demo";
import { preuvanceAssessmentSchema } from "../lib/pdf/assessment-payload";

test("le dossier Northstar respecte le contrat PDF strict", () => {
  const validation = preuvanceAssessmentSchema.safeParse(northstarDemoReport);
  assert.equal(validation.success, true);
});

test("la démo reste fictive et n’invente aucune provenance modèle", () => {
  assert.equal(northstarDemoAssessment.demoMode, true);
  assert.equal(northstarDemoReport.methodology?.model, undefined);
  assert.equal(northstarDemoReport.methodology?.modelRuns, undefined);
  assert.match(northstarDemoReport.result.executiveSummary, /Exemple figé et fictif/i);
});

test("la démo expose les quatre couches sans promouvoir la déclaration humaine", () => {
  const statuses = new Set(
    (northstarDemoReport.evidence ?? []).map((item) => item.status),
  );
  assert.ok(statuses.has("declared"));
  assert.ok(statuses.has("detected"));
  assert.ok(statuses.has("verified"));
  assert.ok(statuses.has("missing"));

  const humanReview = northstarDemoReport.evidence?.find(
    (item) => item.id === "ev-northstar-human-review",
  );
  assert.equal(humanReview?.status, "declared");
});

test("le dossier PDF public est un artefact matériel", () => {
  const bytes = readFileSync("public/downloads/preuvance-northstar-demo.pdf");
  assert.ok(bytes.byteLength > 5_000);
  assert.equal(bytes.subarray(0, 5).toString("utf8"), "%PDF-");
});
