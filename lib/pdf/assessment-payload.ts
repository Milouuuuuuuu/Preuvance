import { z } from "zod";

export const PDF_REQUEST_LIMIT_BYTES = 512_000;

export const assessmentTiers = ["A+", "A", "B", "C", "D"] as const;
export const riskLevels = [
  "minimal",
  "limited",
  "high",
  "prohibited",
  "undetermined",
] as const;
export const gapPriorities = ["critical", "high", "medium", "low"] as const;
export const evidenceStatuses = [
  "documented",
  "declared",
  "partial",
  "missing",
  "unverified",
  "not-applicable",
] as const;

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
  .refine(isRealCalendarDate, "doit être une date calendaire valide");

const httpUrl = boundedString(500)
  .url("doit être une URL valide")
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  }, "doit utiliser le protocole HTTP(S)");

const articleSchema = z
  .object({
    reference: boundedString(100),
    title: boundedString(200).optional(),
    finding: boundedString(2_000),
    deadline: boundedString(500).optional(),
    deadlineStatus: boundedString(400).optional(),
    sourceUrl: httpUrl.optional(),
  })
  .strict();

const dimensionSchema = z
  .object({
    name: boundedString(120),
    score: z.number().int().min(0).max(100),
    finding: boundedString(1_000),
  })
  .strict();

const gapSchema = z
  .object({
    priority: z.enum(gapPriorities),
    title: boundedString(240),
    finding: boundedString(1_600),
    recommendedAction: boundedString(1_600),
    articleReferences: z.array(boundedString(100)).max(12),
    dueDate: boundedString(500).optional(),
    owner: boundedString(120).optional(),
  })
  .strict();

const evidenceSchema = z
  .object({
    control: boundedString(500),
    status: z.enum(evidenceStatuses),
    detail: boundedString(1_500),
  })
  .strict();

export const crossCheckStatuses = [
  "concordant",
  "attention",
  "divergent",
] as const;

const appliedCapSchema = z
  .object({
    cap: z.number().int().min(0).max(100),
    reason: boundedString(300),
  })
  .strict();

const crossCheckSchema = z
  .object({
    status: z.enum(crossCheckStatuses),
    version: boundedString(60),
    note: boundedString(1_200),
  })
  .strict();

const decisionLogEntrySchema = z
  .object({
    title: boundedString(160),
    decision: boundedString(300),
    score: z.number().int().min(0).max(100).nullable(),
    rationale: boundedString(2_000),
  })
  .strict();

export const preuvanceAssessmentSchema = z
  .object({
    assessmentId: boundedString(100),
    generatedAt: isoDateTime,
    lastRegulatoryVerification: calendarDate,
    organization: z
      .object({
        name: boundedString(160),
        registrationCountry: boundedString(80).optional(),
        employeeCount: z.number().int().min(0).max(10_000_000).optional(),
        annualRevenueEur: z.number().min(0).max(1_000_000_000_000_000).optional(),
        balanceSheetTotalEur: z
          .number()
          .min(0)
          .max(1_000_000_000_000_000)
          .optional(),
        smcEligible: z.boolean().optional(),
      })
      .strict(),
    system: z
      .object({
        name: boundedString(160),
        description: boundedString(5_000),
        sector: boundedString(120).optional(),
        intendedUse: boundedString(1_500).optional(),
        affectedPeople: boundedString(1_000).optional(),
        operatorRole: boundedString(80).optional(),
      })
      .strict(),
    result: z
      .object({
        score: z.number().int().min(0).max(100),
        tier: z.enum(assessmentTiers),
        riskLevel: z.enum(riskLevels),
        confidence: z.number().min(0).max(1),
        executiveSummary: boundedString(1_600),
        appliedCaps: z.array(appliedCapSchema).max(8).optional(),
      })
      .strict(),
    crossCheck: crossCheckSchema.optional(),
    decisionLog: z.array(decisionLogEntrySchema).max(12).optional(),
    classification: z
      .object({
        rationale: boundedString(4_000),
        articles: z.array(articleSchema).min(1).max(20),
      })
      .strict(),
    dimensions: z.array(dimensionSchema).min(1).max(10),
    gaps: z.array(gapSchema).max(25),
    evidence: z.array(evidenceSchema).max(30).optional(),
    brokerContext: z
      .object({
        requestedCoverage: boundedString(1_000).optional(),
        annualAiRevenueEur: z.number().min(0).max(1_000_000_000_000).optional(),
        incidentHistory: boundedString(1_500).optional(),
        contactName: boundedString(160).optional(),
      })
      .strict()
      .optional(),
    methodology: z
      .object({
        model: boundedString(120).optional(),
        version: boundedString(120).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type AssessmentTier = (typeof assessmentTiers)[number];
export type PdfCrossCheckStatus = (typeof crossCheckStatuses)[number];
export type RiskLevel = (typeof riskLevels)[number];
export type GapPriority = (typeof gapPriorities)[number];
export type EvidenceStatus = (typeof evidenceStatuses)[number];
export type PreuvanceAssessment = z.infer<typeof preuvanceAssessmentSchema>;

export function decisionScoreLabel(score: number | null): string {
  return score === null ? "non noté" : `${score}/100`;
}

export type AssessmentValidationResult =
  | { success: true; data: PreuvanceAssessment }
  | { success: false; errors: string[] };

export function validatePreuvanceAssessment(
  input: unknown,
): AssessmentValidationResult {
  const result = preuvanceAssessmentSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };

  return {
    success: false,
    errors: result.error.issues
      .slice(0, 50)
      .map((issue) => `${formatPath(issue.path)}: ${issue.message}`),
  };
}

function isRealCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function formatPath(path: PropertyKey[]) {
  return path.reduce<string>((result, segment) => {
    if (typeof segment === "number") return `${result}[${segment}]`;
    return `${result}.${String(segment)}`;
  }, "$input");
}
