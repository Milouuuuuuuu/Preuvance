import { z } from "zod";
import rawReference from "@/app/data/eu-ai-act-reference.json";
import { DEADLINE_IDS, type DeadlineId } from "./schemas";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const SourceSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    url: z.string().url(),
  })
  .strict();

const LegalLayerSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    status: z.enum(["binding_in_force", "signed_pending_official_journal"]),
    entryIntoForce: isoDate.optional(),
    signedAt: isoDate.optional(),
    sourceIds: z.array(z.string().min(1)).min(1),
    displayFr: z.string().min(1),
  })
  .strict();

const DeadlinePositionSchema = z
  .object({
    date: isoDate,
    status: z.enum(["active", "scheduled"]),
    legalLayerId: z.string().min(1),
  })
  .strict();

const SignedDeadlinePositionSchema = z
  .object({
    date: isoDate,
    status: z.literal("signed_pending_official_journal"),
    legalLayerId: z.string().min(1),
    conditionFr: z.string().min(1).optional(),
    displayFr: z.string().min(1),
  })
  .strict();

const DeadlineSchema = z
  .object({
    id: z.enum(DEADLINE_IDS),
    labelFr: z.string().min(1),
    articles: z.array(z.string().min(1)).min(1),
    bindingPosition: DeadlinePositionSchema,
    signedAmendmentPosition: SignedDeadlinePositionSchema.nullable(),
    noteFr: z.string().min(1),
  })
  .strict();

const ThresholdSchema = z
  .object({
    maxEmployeesExclusive: z.number().int().positive(),
    maxAnnualRevenueInclusive: z.number().positive(),
    maxBalanceSheetInclusive: z.number().positive(),
    mustNotBeCategory: z.enum(["sme"]).nullable(),
    sourceIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

const EnterpriseThresholdsSchema = z
  .object({
    currency: z.literal("EUR"),
    aggregationWarningFr: z.string().min(1),
    categories: z
      .object({
        micro: ThresholdSchema,
        small: ThresholdSchema,
        medium: ThresholdSchema,
        smallMidCap: ThresholdSchema,
      })
      .strict(),
    financialTestFr: z.string().min(1),
    aiActSmcRelief: z
      .object({
        legalStatus: z.literal("signed_pending_official_journal"),
        displayFr: z.string().min(1),
      })
      .strict(),
  })
  .strict();

const PracticeSchema = z
  .object({
    id: z.string().min(1),
    article: z.string().min(1),
    labelFr: z.string().min(1),
  })
  .strict();

const SignedPracticeSchema = PracticeSchema.extend({
  legalStatus: z.literal("signed_pending_official_journal"),
}).strict();

const FineSchema = z
  .object({
    id: z.string().min(1),
    articles: z.array(z.string().min(1)).min(1),
    fixedMaximumEur: z.number().positive(),
    turnoverMaximumPercent: z.number().positive(),
    standardUndertakingRule: z.literal("higher_of_fixed_or_percentage"),
    bindingSmeRule: z.literal("lower_of_fixed_or_percentage"),
    signedSmcRule: z.enum([
      "lower_of_fixed_or_percentage_pending_official_journal",
      "not_extended_to_smc",
    ]),
    labelFr: z.string().min(1),
  })
  .strict();

export const RegulatoryReferenceSchema = z
  .object({
    metadata: z
      .object({
        product: z.literal("PREUVANCE"),
        jurisdiction: z.string().min(1),
        verifiedAt: isoDate,
        language: z.literal("fr"),
        legalAdviceDisclaimerFr: z.string().min(1),
        verificationNoteFr: z.string().min(1),
      })
      .strict(),
    sources: z.array(SourceSchema).min(1),
    legalLayers: z.array(LegalLayerSchema).min(2),
    classificationRules: z
      .object({
        prohibitedPracticesBinding: z.array(PracticeSchema).min(1),
        prohibitedPracticeSignedAmendment: z.array(SignedPracticeSchema),
        annexIII: z
          .object({
            article: z.string().min(1),
            areas: z.array(z.string().min(1)).min(1),
            importantQualificationFr: z.string().min(1),
          })
          .strict(),
        annexI: z
          .object({
            article: z.string().min(1),
            testFr: z.string().min(1),
          })
          .strict(),
      })
      .strict(),
    deadlines: z.array(DeadlineSchema).length(DEADLINE_IDS.length),
    enterpriseThresholds: EnterpriseThresholdsSchema,
    fines: z.array(FineSchema).min(3),
  })
  .strict();

export type RegulatoryReference = z.infer<typeof RegulatoryReferenceSchema>;
export type EnterpriseThresholds = z.infer<typeof EnterpriseThresholdsSchema>;
export type RegulatoryDeadline = z.infer<typeof DeadlineSchema>;

const regulatoryReference = RegulatoryReferenceSchema.parse(rawReference);
const deadlineById = new Map(
  regulatoryReference.deadlines.map((deadline) => [deadline.id, deadline]),
);

export function getRegulatoryReference(): RegulatoryReference {
  return regulatoryReference;
}

export function getDeadline(id: DeadlineId): RegulatoryDeadline {
  const deadline = deadlineById.get(id);
  if (!deadline) {
    throw new Error(`Référence réglementaire inconnue : ${id}`);
  }
  return deadline;
}

export type HydratedObligation = {
  id: DeadlineId;
  title: string;
  article: string;
  articles: string[];
  detail: string;
  deadline: string;
  status: "active" | "scheduled";
  bindingDeadline: {
    date: string;
    displayDate: string;
    legalStatus: "binding";
  };
  signedAmendmentDeadline: {
    date: string;
    displayDate: string;
    legalStatus: "signed_pending_official_journal";
    condition: string | null;
    disclaimer: string;
  } | null;
};

export function hydrateObligations(
  ids: readonly DeadlineId[],
): HydratedObligation[] {
  return [...new Set(ids)].map((id) => {
    const deadline = getDeadline(id);
    const bindingDate = formatFrenchDate(deadline.bindingPosition.date);
    const amendment = deadline.signedAmendmentPosition;
    const deadlineDisplay = amendment
      ? `Droit publié : ${bindingDate} · Omnibus signé : ${formatFrenchDate(amendment.date)}${amendment.conditionFr ? ` — ${amendment.conditionFr}` : ""} (JOUE en attente)`
      : bindingDate;

    return {
      id,
      title: deadline.labelFr,
      article: deadline.articles.join(" · "),
      articles: deadline.articles,
      detail: deadline.noteFr,
      deadline: deadlineDisplay,
      status: deadline.bindingPosition.status,
      bindingDeadline: {
        date: deadline.bindingPosition.date,
        displayDate: bindingDate,
        legalStatus: "binding",
      },
      signedAmendmentDeadline: amendment
        ? {
            date: amendment.date,
            displayDate: formatFrenchDate(amendment.date),
            legalStatus: amendment.status,
            condition: amendment.conditionFr ?? null,
            disclaimer: amendment.displayFr,
          }
        : null,
    };
  });
}

export function formatFrenchDate(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
