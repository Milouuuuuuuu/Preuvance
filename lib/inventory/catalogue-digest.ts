import { z } from "zod";

import { SENSITIVE_CATEGORIES, type Catalogue } from "./catalogue-contract";
import { DIAGNOSTIC_AXES, type Diagnostic } from "./diagnostic";

/**
 * Digest de catalogue destiné à l'interprétation par un modèle de langage.
 *
 * Même principe que le digest de scan de la v1 : ce qui part vers un modèle
 * est agrégé et anonyme. Aucun nom de client, de source, de table, de colonne
 * ni d'emplacement. Le modèle reçoit des compteurs et des identifiants de
 * règles ; il rédige et hiérarchise, il ne découvre rien.
 */
export const CATALOGUE_DIGEST_VERSION = "preuvance-catalogue-digest-v1";

export const CATALOGUE_DIGEST_PRIVACY =
  "Digest agrégé : aucun nom de client, de source, de table, de colonne, ni emplacement. Compteurs et identifiants de règles uniquement.";

export const catalogueDigestSchema = z
  .object({
    schemaVersion: z.literal(CATALOGUE_DIGEST_VERSION),
    createdAt: z.string().trim().max(40),
    mode: z.enum(["metadata_only", "metadata_and_freshness"]),
    score: z.number().int().min(0).max(100),
    tier: z.enum(["A", "B", "C", "D"]),
    coverage: z
      .object({
        sources: z.number().int().min(0),
        sourcesCollected: z.number().int().min(0),
        sourcesPartial: z.number().int().min(0),
        sourcesUnreachable: z.number().int().min(0),
        datasets: z.number().int().min(0),
        fields: z.number().int().min(0),
        datasetsWithoutRowCount: z.number().int().min(0),
        datasetsWithoutFreshness: z.number().int().min(0),
      })
      .strict(),
    sourceSystems: z
      .array(
        z
          .object({
            system: z.string().trim().min(1).max(40),
            count: z.number().int().min(0),
          })
          .strict(),
      )
      .max(40),
    sensitivity: z
      .object({
        fieldsSensitive: z.number().int().min(0),
        datasetsWithPersonalData: z.number().int().min(0),
        datasetsWithSpecialCategories: z.number().int().min(0),
        byCategory: z
          .array(
            z
              .object({
                category: z.enum(SENSITIVE_CATEGORIES),
                fields: z.number().int().min(0),
                datasets: z.number().int().min(0),
              })
              .strict(),
          )
          .max(20),
      })
      .strict(),
    findings: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(80),
            axis: z.enum(DIAGNOSTIC_AXES),
            severity: z.enum(["critical", "major", "moderate", "minor"]),
          })
          .strict(),
      )
      .max(200),
    aiConcordance: z
      .enum(["concordant", "uncorroborated", "divergent", "no_declaration", "absent"])
      .default("absent"),
    privacy: z.literal(CATALOGUE_DIGEST_PRIVACY),
  })
  .strict();

export type CatalogueDigest = z.infer<typeof catalogueDigestSchema>;

/**
 * Les identifiants de constat contiennent parfois l'identifiant d'une source
 * (`inventaire-source-injoignable-erp-client`). Le digest ne garde que le
 * préfixe de règle : le modèle sait qu'une source est injoignable, pas
 * laquelle.
 */
function ruleIdOf(findingId: string): string {
  const known = [
    "inventaire-source-injoignable",
    "inventaire-source-partielle",
  ];
  const prefix = known.find((candidate) => findingId.startsWith(candidate));
  return prefix ?? findingId;
}

export function createCatalogueDigest(
  catalogue: Catalogue,
  diagnostic: Diagnostic,
  createdAt: string,
): CatalogueDigest {
  const systems = new Map<string, number>();
  for (const source of catalogue.sources) {
    systems.set(source.system, (systems.get(source.system) ?? 0) + 1);
  }

  const findings = new Map<string, { id: string; axis: string; severity: string }>();
  for (const finding of diagnostic.findings) {
    const id = ruleIdOf(finding.id);
    if (!findings.has(id)) {
      findings.set(id, { id, axis: finding.axis, severity: finding.severity });
    }
  }

  return catalogueDigestSchema.parse({
    schemaVersion: CATALOGUE_DIGEST_VERSION,
    createdAt,
    mode: catalogue.mission.mode,
    score: diagnostic.score,
    tier: diagnostic.tier,
    coverage: {
      sources: diagnostic.coverage.sources,
      sourcesCollected: diagnostic.coverage.sourcesCollected,
      sourcesPartial: diagnostic.coverage.sourcesPartial,
      sourcesUnreachable: diagnostic.coverage.sourcesUnreachable,
      datasets: diagnostic.coverage.datasets,
      fields: diagnostic.coverage.fields,
      datasetsWithoutRowCount: diagnostic.coverage.datasetsWithoutRowCount,
      datasetsWithoutFreshness: diagnostic.coverage.datasetsWithoutFreshness,
    },
    sourceSystems: [...systems.entries()]
      .map(([system, count]) => ({ system, count }))
      .sort((a, b) => b.count - a.count || a.system.localeCompare(b.system)),
    sensitivity: {
      fieldsSensitive: diagnostic.sensitivity.fieldsSensitive,
      datasetsWithPersonalData: diagnostic.sensitivity.datasetsWithPersonalData,
      datasetsWithSpecialCategories: diagnostic.sensitivity.datasetsWithSpecialCategories,
      byCategory: diagnostic.sensitivity.byCategory,
    },
    findings: [...findings.values()],
    aiConcordance: catalogue.aiScan?.concordance ?? "absent",
    privacy: CATALOGUE_DIGEST_PRIVACY,
  });
}
