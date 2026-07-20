import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { computeScanExposure } from "../app/lib/assessment/scan-scoring";
import { validateScanReport } from "../lib/scan/scan-contract";
import { createScanDigest, scanDigestSchema } from "../lib/scan/scan-handoff";

const fixturePath = fileURLToPath(
  new URL("./fixtures/scan-sample.json", import.meta.url),
);
const raw: unknown = JSON.parse(readFileSync(fixturePath, "utf8"));

test("le handoff du scan ne contient aucune donnée machine sensible", () => {
  const validation = validateScanReport(raw);
  assert.equal(validation.success, true);
  if (!validation.success) return;

  const digest = createScanDigest(
    validation.data,
    computeScanExposure(validation.data),
  );
  assert.equal(scanDigestSchema.safeParse(digest).success, true);

  const serialized = JSON.stringify(digest).toLowerCase();
  assert.equal(serialized.includes("c:\\users\\"), false);
  assert.equal(serialized.includes("remoteaddresses"), false);
  assert.equal(serialized.includes("processes"), false);
  assert.equal(serialized.includes("7ea80915230eef204ee74d928e2848146"), false);
  assert.equal(serialized.includes("scratchpad"), false);
  assert.match(digest.privacy, /sans chemin, IP, processus, contenu/i);
});

