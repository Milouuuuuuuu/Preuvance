import { z } from "zod";

export const evidenceStatuses = [
  "verified",
  "documented",
  "detected",
  "declared",
  "partial",
  "missing",
  "unverified",
  "not-applicable",
] as const;

export const evidenceSourceTypes = [
  "model-extraction",
  "user-declaration",
  "local-scan",
  "dependency-scan",
  "document",
  "policy",
  "test",
  "contract",
  "other",
] as const;

export const evidenceLayers = [
  "missing",
  "declared",
  "detected",
  "proven",
  "not-applicable",
] as const;

export const EVIDENCE_LEDGER_LIMIT = 120;

const boundedString = (max: number, min = 1) =>
  z.string().trim().min(min).max(max);

const isoDateTime = boundedString(40).refine(
  (value) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) &&
    Number.isFinite(Date.parse(value)),
  "doit être une date ISO 8601 valide",
);

const calendarDate = boundedString(10)
  .regex(/^\d{4}-\d{2}-\d{2}$/, "doit être au format AAAA-MM-JJ")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "doit être une date calendaire valide");

const reportEvidenceObjectSchema = z
  .object({
    id: boundedString(100).optional(),
    control: boundedString(500),
    status: z.enum(evidenceStatuses),
    detail: boundedString(1_500),
    gapId: boundedString(80).optional(),
    articleReferences: z.array(boundedString(100)).max(12).optional(),
    owner: boundedString(160).optional(),
    sourceType: z.enum(evidenceSourceTypes).optional(),
    sourceLabel: boundedString(240).optional(),
    fileName: boundedString(240).optional(),
    fileSizeBytes: z.number().int().min(0).max(25_000_000).optional(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    collectedAt: isoDateTime.optional(),
    validUntil: calendarDate.optional(),
    reviewedBy: boundedString(160).optional(),
    reviewedAt: isoDateTime.optional(),
    updatedAt: isoDateTime.optional(),
  })
  .strict();

export const reportEvidenceSchema = reportEvidenceObjectSchema.superRefine(
  validateEvidenceIntegrity,
);

export const evidenceLedgerItemSchema = reportEvidenceObjectSchema
  .extend({
    id: boundedString(100),
    sourceType: z.enum(evidenceSourceTypes),
    updatedAt: isoDateTime,
  })
  .superRefine(validateEvidenceIntegrity);

export const evidenceLedgerSchema = z
  .array(evidenceLedgerItemSchema)
  .max(EVIDENCE_LEDGER_LIMIT)
  .superRefine((items, context) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (seen.has(item.id)) {
        context.addIssue({
          code: "custom",
          message: "chaque preuve doit avoir un identifiant unique",
          path: [index, "id"],
        });
      }
      seen.add(item.id);
    });
  });

export type EvidenceStatus = (typeof evidenceStatuses)[number];
export type EvidenceSourceType = (typeof evidenceSourceTypes)[number];
export type EvidenceLayer = (typeof evidenceLayers)[number];
export type ReportEvidence = z.infer<typeof reportEvidenceSchema>;
export type EvidenceLedgerItem = z.infer<typeof evidenceLedgerItemSchema>;

export type EvidenceCoverage = {
  score: number;
  considered: number;
  excluded: number;
  declared: number;
  detected: number;
  proven: number;
  missing: number;
};

const COVERAGE_WEIGHTS: Record<EvidenceStatus, number | null> = {
  verified: 1,
  documented: 0.72,
  detected: 0.5,
  declared: 0.22,
  partial: 0.42,
  missing: 0,
  unverified: 0.12,
  "not-applicable": null,
};

export function evidenceLayer(status: EvidenceStatus): EvidenceLayer {
  if (status === "verified") return "proven";
  if (status === "documented" || status === "detected" || status === "partial") {
    return "detected";
  }
  if (status === "not-applicable") return "not-applicable";
  if (status === "declared") return "declared";
  return "missing";
}

export function calculateEvidenceCoverage(
  items: readonly Pick<EvidenceLedgerItem, "status">[],
): EvidenceCoverage {
  const considered = items.filter((item) => COVERAGE_WEIGHTS[item.status] !== null);
  const rawScore = considered.reduce(
    (total, item) => total + (COVERAGE_WEIGHTS[item.status] ?? 0),
    0,
  );

  return {
    score: considered.length ? Math.round((rawScore / considered.length) * 100) : 0,
    considered: considered.length,
    excluded: items.length - considered.length,
    declared: items.filter((item) => evidenceLayer(item.status) === "declared").length,
    detected: items.filter((item) => evidenceLayer(item.status) === "detected").length,
    proven: items.filter((item) => evidenceLayer(item.status) === "proven").length,
    missing: items.filter((item) => evidenceLayer(item.status) === "missing").length,
  };
}

export function normalizeEvidenceLedger(
  value: unknown,
  assessmentId = "assessment",
): EvidenceLedgerItem[] {
  if (!Array.isArray(value)) return [];
  const now = new Date().toISOString();

  return value.slice(0, EVIDENCE_LEDGER_LIMIT).flatMap((candidate, index) => {
    const validation = reportEvidenceSchema.safeParse(candidate);
    if (!validation.success) return [];
    const item = validation.data;
    const sourceType = item.sourceType ?? inferSourceType(item.status);
    const normalized: EvidenceLedgerItem = {
      ...item,
      id: item.id ?? stableEvidenceId(assessmentId, item.control, index),
      sourceType,
      updatedAt: item.updatedAt ?? now,
    };
    const strictValidation = evidenceLedgerItemSchema.safeParse(normalized);
    return strictValidation.success ? [strictValidation.data] : [];
  });
}

export function toReportEvidence(item: EvidenceLedgerItem): ReportEvidence {
  return reportEvidenceSchema.parse(item);
}

export function stableEvidenceId(
  assessmentId: string,
  control: string,
  index: number,
): string {
  const input = `${assessmentId}:${index}:${control}`;
  let hash = 0x811c9dc5;
  for (let cursor = 0; cursor < input.length; cursor += 1) {
    hash ^= input.charCodeAt(cursor);
    hash = Math.imul(hash, 0x01000193);
  }
  return `ev-${(hash >>> 0).toString(16).padStart(8, "0")}-${index + 1}`;
}

function inferSourceType(status: EvidenceStatus): EvidenceSourceType {
  if (status === "detected") return "local-scan";
  if (status === "documented" || status === "verified") return "document";
  return "user-declaration";
}

function validateEvidenceIntegrity(
  item: z.infer<typeof reportEvidenceObjectSchema>,
  context: z.RefinementCtx,
) {
  if (item.status === "verified" && (!item.reviewedBy || !item.reviewedAt)) {
    context.addIssue({
      code: "custom",
      message: "une pièce vérifiée doit indiquer le relecteur et la date de revue",
      path: ["reviewedBy"],
    });
  }
  if ((item.fileName || item.fileSizeBytes !== undefined) && !item.sha256) {
    context.addIssue({
      code: "custom",
      message: "une pièce locale doit conserver son empreinte SHA-256",
      path: ["sha256"],
    });
  }
}
