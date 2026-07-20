import { z } from "zod";

import type { ScanReport } from "./scan-contract";
import type { ScanExposure } from "@/app/lib/assessment/scan-scoring";

const providerId = z.string().trim().min(1).max(80);

export const scanDigestSchema = z
  .object({
    schemaVersion: z.literal("preuvance-scan-digest-v1"),
    createdAt: z.string().trim().max(40).refine(
      (value) => Number.isFinite(Date.parse(value)),
      "date invalide",
    ),
    hostProfile: z.enum(["personal", "professional", "unknown"]),
    exposureScore: z.number().int().min(0).max(100),
    concordance: z.enum([
      "concordant",
      "uncorroborated",
      "divergent",
      "no_declaration",
    ]),
    declaredProviders: z.array(providerId).max(20),
    corroboratedProviders: z.array(providerId).max(20),
    undeclaredProviders: z.array(providerId).max(20),
    findingCounts: z
      .object({
        critical: z.number().int().min(0).max(10_000),
        major: z.number().int().min(0).max(10_000),
        moderate: z.number().int().min(0).max(10_000),
        minor: z.number().int().min(0).max(10_000),
      })
      .strict(),
    observation: z
      .object({
        undeclaredAiEndpoints: z.number().int().min(0).max(10_000),
        declaredAiEndpoints: z.number().int().min(0).max(10_000),
        secretFiles: z.number().int().min(0).max(100_000),
        personalDataFiles: z.number().int().min(0).max(100_000),
        networkObservationAvailable: z.boolean(),
      })
      .strict(),
    privacy: z.literal(
      "Digest agrégé sans chemin, IP, processus, contenu de fichier ni empreinte de fichier sensible.",
    ),
  })
  .strict();

export type ScanDigest = z.infer<typeof scanDigestSchema>;

export function createScanDigest(
  report: ScanReport,
  exposure: ScanExposure,
): ScanDigest {
  const findingCounts = {
    critical: exposure.findings.filter((item) => item.severity === "critical").length,
    major: exposure.findings.filter((item) => item.severity === "major").length,
    moderate: exposure.findings.filter((item) => item.severity === "moderate").length,
    minor: exposure.findings.filter((item) => item.severity === "minor").length,
  };
  const networkObservationAvailable =
    report.capabilities.dnsClientLog || report.capabilities.connectionSampling;

  return scanDigestSchema.parse({
    schemaVersion: "preuvance-scan-digest-v1",
    createdAt: new Date().toISOString(),
    hostProfile: report.host.profile,
    exposureScore: exposure.exposureScore,
    concordance: exposure.concordance.status,
    declaredProviders: exposure.concordance.declaredProviders,
    corroboratedProviders: exposure.concordance.corroborated,
    undeclaredProviders: exposure.concordance.undeclaredObserved,
    findingCounts,
    observation: {
      undeclaredAiEndpoints: exposure.observed.undeclaredAiEndpoints,
      declaredAiEndpoints: exposure.observed.declaredAiEndpoints,
      secretFiles: exposure.observed.secretFiles,
      personalDataFiles: exposure.observed.personalDataFiles,
      networkObservationAvailable,
    },
    privacy:
      "Digest agrégé sans chemin, IP, processus, contenu de fichier ni empreinte de fichier sensible.",
  });
}
