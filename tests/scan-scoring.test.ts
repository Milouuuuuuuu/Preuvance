import assert from "node:assert/strict";
import test from "node:test";

import {
  SCAN_SCHEMA_VERSION,
  providerLabelForHost,
  validateScanReport,
  type ScanReport,
} from "../lib/scan/scan-contract";
import { computeScanExposure } from "../app/lib/assessment/scan-scoring";

function baseReport(overrides: Partial<ScanReport> = {}): ScanReport {
  return {
    schemaVersion: SCAN_SCHEMA_VERSION,
    generatedAt: "2026-07-14T09:00:00.000Z",
    host: {
      profile: "professional",
      domainJoined: true,
      osCaption: "Windows 11 Pro",
      elevated: false,
    },
    capabilities: {
      dnsClientLog: true,
      connectionSampling: true,
      fileInventory: true,
    },
    network: {
      mode: "watch",
      durationSeconds: 3_600,
      samples: 720,
      aiEndpoints: [],
      otherExternalEndpoints: 42,
    },
    files: { rootsScanned: ["C:/Users/demo/Documents"], sensitive: [], truncated: false },
    notes: [],
    ...overrides,
  };
}

test("le catalogue reconnaît les hôtes d’API d’IA connus", () => {
  assert.equal(providerLabelForHost("api.openai.com"), "OpenAI");
  assert.equal(providerLabelForHost("mon-tenant.openai.azure.com"), "Azure OpenAI");
  assert.equal(providerLabelForHost("api.anthropic.com"), "Anthropic");
  assert.equal(providerLabelForHost("exemple.com"), null);
});

test("le contrat de scan valide un rapport bien formé et rejette un contenu de fichier", () => {
  assert.equal(validateScanReport(baseReport()).success, true);

  const withFileContent = validateScanReport({
    ...baseReport(),
    files: {
      rootsScanned: [],
      truncated: false,
      sensitive: [
        {
          path: "C:/secret.env",
          category: "secret",
          sizeBytes: 10,
          content: "OPENAI_API_KEY=sk-...",
        },
      ],
    },
  });
  assert.equal(withFileContent.success, false);
});

test("aucun signal détecté donne un score d’exposition parfait", () => {
  const exposure = computeScanExposure(baseReport());
  assert.equal(exposure.exposureScore, 100);
  assert.equal(exposure.tier, "A");
  assert.equal(exposure.observed.undeclaredAiEndpoints, 0);
  assert.match(exposure.summary, /Aucun usage d’IA non déclaré/);
});

test("un appel d’IA non déclaré est critique et abaisse fortement le score", () => {
  const exposure = computeScanExposure(
    baseReport({
      network: {
        mode: "watch",
        durationSeconds: 3_600,
        samples: 720,
        otherExternalEndpoints: 10,
        aiEndpoints: [
          {
            host: "api.openai.com",
            provider: "OpenAI",
            hitCount: 12,
            processes: ["python.exe"],
            remoteAddresses: ["203.0.113.4"],
            declared: false,
          },
        ],
      },
    }),
  );

  assert.ok(exposure.exposureScore <= 55);
  assert.equal(exposure.observed.undeclaredAiEndpoints, 1);
  const finding = exposure.findings.find((item) => item.id === "ai-endpoint-api.openai.com");
  assert.equal(finding?.severity, "critical");
  assert.match(exposure.summary, /1 appel\(s\) d’IA non déclaré/);
});

test("un appel d’IA déclaré n’est que mineur", () => {
  const exposure = computeScanExposure(
    baseReport({
      network: {
        mode: "watch",
        durationSeconds: 3_600,
        samples: 720,
        otherExternalEndpoints: 10,
        aiEndpoints: [
          {
            host: "api.openai.com",
            provider: "OpenAI",
            hitCount: 12,
            processes: [],
            remoteAddresses: [],
            declared: true,
          },
        ],
      },
    }),
  );

  assert.ok(exposure.exposureScore >= 90);
  assert.equal(exposure.observed.undeclaredAiEndpoints, 0);
});

test("des secrets exposés en clair pénalisent le score", () => {
  const exposure = computeScanExposure(
    baseReport({
      files: {
        rootsScanned: ["C:/Users/demo"],
        truncated: false,
        sensitive: [
          { path: "C:/Users/demo/.env", category: "secret", sizeBytes: 200 },
          { path: "C:/Users/demo/id_rsa", category: "credential", sizeBytes: 1_600 },
          { path: "C:/Users/demo/key.pem", category: "secret", sizeBytes: 3_200 },
        ],
      },
    }),
  );

  assert.ok(exposure.exposureScore <= 55);
  assert.equal(exposure.observed.secretFiles, 3);
  const finding = exposure.findings.find((item) => item.id === "exposed-secrets");
  assert.equal(finding?.severity, "critical");
});

test("une observation réseau limitée est signalée comme angle mort", () => {
  const exposure = computeScanExposure(
    baseReport({
      capabilities: {
        dnsClientLog: false,
        connectionSampling: false,
        fileInventory: true,
      },
    }),
  );

  assert.equal(exposure.observed.limitedObservation, true);
  assert.ok(
    exposure.findings.some((finding) => finding.id === "limited-network-observation"),
  );
});

test("le titre du constat de secrets reflète la composition réelle (credential seul)", () => {
  const exposure = computeScanExposure(
    baseReport({
      files: {
        rootsScanned: ["C:/Users/demo"],
        truncated: false,
        sensitive: [
          { path: "C:/Users/demo/.npmrc", category: "credential", sizeBytes: 120 },
        ],
      },
    }),
  );

  const finding = exposure.findings.find((item) => item.id === "exposed-secrets");
  assert.ok(finding, "constat exposed-secrets attendu");
  assert.match(finding.title, /identifiant \/ certificat/);
  assert.doesNotMatch(finding.title, /secret ou clé d’API/);
});

test("la catégorie « other » est comptée et produit un constat mineur", () => {
  const exposure = computeScanExposure(
    baseReport({
      files: {
        rootsScanned: ["C:/Users/demo"],
        truncated: false,
        sensitive: [
          { path: "C:/Users/demo/divers.bin", category: "other", sizeBytes: 64 },
        ],
      },
    }),
  );

  assert.equal(exposure.observed.otherSensitiveFiles, 1);
  const finding = exposure.findings.find((item) => item.id === "other-sensitive-files");
  assert.equal(finding?.severity, "minor");
  assert.ok(exposure.exposureScore < 100);
});

test("concordance : déclaration corroborée par l’observation → concordant", () => {
  const exposure = computeScanExposure(
    baseReport({
      network: {
        mode: "watch",
        durationSeconds: 3_600,
        samples: 720,
        otherExternalEndpoints: 10,
        aiEndpoints: [
          {
            host: "api.anthropic.com",
            provider: "Anthropic",
            hitCount: 4,
            processes: ["claude"],
            remoteAddresses: [],
            // Le champ écrit par le scanner est volontairement contredit :
            // la déclaration fait foi, indépendamment de ce champ.
            declared: false,
          },
        ],
      },
      declaration: {
        providers: ["anthropic"],
        method: "interactive",
        collectedAt: "2026-07-14T08:59:00.000Z",
      },
    }),
  );

  assert.equal(exposure.concordance.status, "concordant");
  assert.deepEqual(exposure.concordance.corroborated, ["Anthropic"]);
  assert.equal(exposure.observed.undeclaredAiEndpoints, 0);
  assert.ok(exposure.exposureScore >= 90, "un usage déclaré et corroboré reste mineur");
});

test("concordance : usage observé hors déclaration → divergent et critique", () => {
  const exposure = computeScanExposure(
    baseReport({
      network: {
        mode: "watch",
        durationSeconds: 3_600,
        samples: 720,
        otherExternalEndpoints: 10,
        aiEndpoints: [
          {
            host: "api.mistral.ai",
            provider: "Mistral",
            hitCount: 2,
            processes: [],
            remoteAddresses: [],
            declared: false,
          },
        ],
      },
      declaration: {
        providers: ["openai"],
        method: "parameter",
      },
    }),
  );

  assert.equal(exposure.concordance.status, "divergent");
  assert.deepEqual(exposure.concordance.undeclaredObserved, ["Mistral"]);
  assert.deepEqual(exposure.concordance.declaredNotObserved, ["OpenAI"]);
  assert.ok(exposure.exposureScore <= 55);
});

test("concordance : déclaration sans observation → non corroborée, sans pénalité", () => {
  const exposure = computeScanExposure(
    baseReport({
      declaration: {
        providers: ["openai"],
        method: "interactive",
      },
    }),
  );

  assert.equal(exposure.concordance.status, "uncorroborated");
  assert.deepEqual(exposure.concordance.declaredProviders, ["OpenAI"]);
  assert.equal(exposure.exposureScore, 100);
});

test("concordance : rapport sans bloc de déclaration → no_declaration (rétrocompatibilité)", () => {
  const exposure = computeScanExposure(baseReport());
  assert.equal(exposure.concordance.status, "no_declaration");
});

test("le contrat rejette une empreinte sha256 mal formée", () => {
  const invalid = validateScanReport({
    ...baseReport(),
    files: {
      rootsScanned: [],
      truncated: false,
      sensitive: [
        {
          path: "C:/Users/demo/.env",
          category: "secret",
          sizeBytes: 10,
          sha256: "pas-un-hash",
        },
      ],
    },
  });
  assert.equal(invalid.success, false);
});
