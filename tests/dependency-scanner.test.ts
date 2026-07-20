import assert from "node:assert/strict";
import test from "node:test";

import {
  deduplicateDependencyFindings,
  scanDependencyManifest,
} from "../lib/scan/dependency-scanner";

test("package.json identifie uniquement les dépendances IA reconnues", () => {
  const result = scanDependencyManifest(
    "package.json",
    JSON.stringify({
      dependencies: {
        openai: "^6.0.0",
        "@langchain/core": "^1.0.0",
        react: "^19.0.0",
      },
      devDependencies: { typescript: "^5.9.0" },
    }),
  );

  assert.equal(result.kind, "package-json");
  assert.deepEqual(
    result.dependencies.map((item) => item.packageName),
    ["@langchain/core", "openai"],
  );
  assert.equal(result.dependencies.every((item) => item.direct), true);
});

test("package-lock distingue les dépendances directes et transitives", () => {
  const result = scanDependencyManifest(
    "package-lock.json",
    JSON.stringify({
      packages: {
        "": { dependencies: { openai: "^6.0.0" } },
        "node_modules/openai": { version: "6.0.1" },
        "node_modules/langfuse": { version: "3.0.0" },
        "node_modules/react": { version: "19.0.0" },
      },
    }),
  );

  const openai = result.dependencies.find((item) => item.packageName === "openai");
  const langfuse = result.dependencies.find((item) => item.packageName === "langfuse");
  assert.equal(openai?.direct, true);
  assert.equal(langfuse?.direct, false);
});

test("requirements reconnaît les noms Python normalisés", () => {
  const result = scanDependencyManifest(
    "requirements-prod.txt",
    "# production\nopenai==2.4.0\nqdrant_client>=1.12\nrequests==2.0\n",
  );

  assert.deepEqual(
    result.dependencies.map((item) => item.packageName),
    ["openai", "qdrant_client"],
  );
});

test("la déduplication conserve la preuve directe la plus forte", () => {
  const result = deduplicateDependencyFindings([
    {
      packageName: "OpenAI",
      category: "provider-sdk",
      direct: false,
      manifestName: "package-lock.json",
      confidence: 100,
    },
    {
      packageName: "openai",
      category: "provider-sdk",
      direct: true,
      manifestName: "package.json",
      confidence: 100,
    },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.direct, true);
  assert.equal(result[0]?.manifestName, "package.json");
});

test("un manifeste non pris en charge échoue explicitement", () => {
  assert.throws(
    () => scanDependencyManifest("poetry.lock", ""),
    /Format non pris en charge/,
  );
});
