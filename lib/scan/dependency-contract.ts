import { z } from "zod";

export const dependencyCategories = [
  "provider-sdk",
  "agent-framework",
  "model-runtime",
  "vector-database",
  "ai-observability",
  "ml-library",
] as const;

export const manifestKinds = [
  "package-json",
  "package-lock",
  "requirements",
] as const;

const isoDateTime = z.string().trim().max(40).refine(
  (value) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) &&
    Number.isFinite(Date.parse(value)),
  "date ISO 8601 invalide",
);

export const dependencyFindingSchema = z
  .object({
    packageName: z.string().trim().min(1).max(160),
    version: z.string().trim().min(1).max(120).optional(),
    category: z.enum(dependencyCategories),
    provider: z.string().trim().min(1).max(120).optional(),
    direct: z.boolean(),
    manifestName: z.string().trim().min(1).max(240),
    confidence: z.number().int().min(0).max(100),
  })
  .strict();

export const dependencyManifestSchema = z
  .object({
    name: z.string().trim().min(1).max(240),
    kind: z.enum(manifestKinds),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    byteSize: z.number().int().min(0).max(1_000_000),
  })
  .strict();

export const dependencyDigestSchema = z
  .object({
    schemaVersion: z.literal("preuvance-dependency-digest-v1"),
    scannedAt: isoDateTime,
    manifests: z.array(dependencyManifestSchema).max(10),
    dependencies: z.array(dependencyFindingSchema).max(120),
    warnings: z.array(z.string().trim().min(1).max(500)).max(20),
    coverage: z
      .object({
        supportedManifestTypes: z.array(z.enum(manifestKinds)).min(1).max(3),
        statement: z.string().trim().min(1).max(500),
      })
      .strict(),
  })
  .strict();

export type DependencyCategory = (typeof dependencyCategories)[number];
export type ManifestKind = (typeof manifestKinds)[number];
export type DependencyFinding = z.infer<typeof dependencyFindingSchema>;
export type DependencyManifest = z.infer<typeof dependencyManifestSchema>;
export type DependencyDigest = z.infer<typeof dependencyDigestSchema>;

