import { z } from "zod";

export const DEADLINE_IDS = [
  "ai-literacy",
  "art5-prohibited-practices",
  "gpai-provider-obligations",
  "art50-1-human-interaction-disclosure",
  "art50-2-machine-readable-marking",
  "art50-3-emotion-biometric-notice",
  "art50-4-deepfake-disclosure",
  "art50-4-public-interest-text-disclosure",
  "high-risk-annex-iii",
  "high-risk-annex-i",
] as const;

export const PROHIBITED_PRACTICE_IDS = [
  "manipulation",
  "social-scoring",
  "criminal-risk-profiling-only",
  "untargeted-facial-scraping",
  "work-education-emotion",
  "sensitive-biometric-categorisation",
  "real-time-remote-biometric-law-enforcement",
] as const;

export const SIGNED_PROHIBITED_PRACTICE_IDS = [
  "non-consensual-intimate-or-csam-generation",
] as const;

export const ANNEX_III_AREAS = [
  "biometrics",
  "critical_infrastructure",
  "education_and_vocational_training",
  "employment_and_workers",
  "essential_services_and_benefits",
  "law_enforcement",
  "migration_asylum_and_border_control",
  "justice_and_democratic_processes",
] as const;

export const SCORE_DIMENSIONS = [
  "governance",
  "risk_management",
  "data_and_documentation",
  "transparency_and_human_oversight",
  "technical_resilience",
  "insurance_readiness",
] as const;

const nullableBoolean = z.boolean().nullable();

export const CompanyInputSchema = z
  .object({
    employees: z.number().int().min(0).max(10_000_000),
    annualRevenue: z.number().finite().min(0).max(1_000_000_000_000_000),
    balanceSheetTotal: z.number().finite().min(0).max(1_000_000_000_000_000),
  })
  .strict();

export const AssessmentRequestSchema = z
  .object({
    organizationName: z.string().trim().min(2).max(160),
    systemName: z.string().trim().min(2).max(160),
    description: z.string().trim().min(50).max(5_000),
    company: CompanyInputSchema,
  })
  .strict();

export const ExtractedFactsSchema = z
  .object({
    systemName: z.string().min(1).max(160).nullable(),
    intendedPurpose: z.string().min(1).max(1_500),
    sector: z.enum([
      "biometrics",
      "critical_infrastructure",
      "education",
      "employment",
      "essential_services",
      "law_enforcement",
      "migration_asylum_border",
      "justice_democracy",
      "healthcare",
      "regulated_product",
      "general_business",
      "media_creative",
      "other",
      "unknown",
    ]),
    actorRole: z.enum([
      "provider",
      "deployer",
      "provider_and_deployer",
      "importer",
      "distributor",
      "product_manufacturer",
      "authorised_representative",
      "unknown",
    ]),
    affectedPeople: z.array(z.string().min(1).max(300)).max(20),
    targetUsers: z.array(z.string().min(1).max(300)).max(20),
    decisions: z.array(z.string().min(1).max(500)).max(20),
    outputs: z.array(z.string().min(1).max(500)).max(20),
    modelType: z.enum([
      "general_purpose_model_provider",
      "third_party_general_purpose_model",
      "fine_tuned_model",
      "narrow_ai_system",
      "procedural_or_rules_based_tool",
      "unknown",
    ]),
    trainingComputeAboveGpaiThreshold: nullableBoolean,
    deploymentContext: z.string().min(1).max(1_000),
    directlyInteractsWithPeople: nullableBoolean,
    generatesText: nullableBoolean,
    generatesImages: nullableBoolean,
    generatesAudio: nullableBoolean,
    generatesVideo: nullableBoolean,
    createsDeepfakes: nullableBoolean,
    publishesPublicInterestText: nullableBoolean,
    usesEmotionRecognition: nullableBoolean,
    usesBiometricCategorisation: nullableBoolean,
    usesRemoteBiometricIdentification: nullableBoolean,
    profilesNaturalPersons: nullableBoolean,
    materiallyInfluencesDecisionsAboutPeople: nullableBoolean,
    isSafetyComponentOfRegulatedProduct: nullableBoolean,
    regulatedProductRequiresThirdPartyConformityAssessment: nullableBoolean,
    existingControls: z.array(z.string().min(1).max(500)).max(30),
    prohibitedPracticeSignals: z.array(z.enum(PROHIBITED_PRACTICE_IDS)).max(7),
    signedAmendmentProhibitedPracticeSignals: z
      .array(z.enum(SIGNED_PROHIBITED_PRACTICE_IDS))
      .max(1),
    missingInformation: z.array(z.string().min(1).max(500)).max(20),
  })
  .strict();

const DecisionSchema = z
  .object({
    outcome: z.enum([
      "applies",
      "likely_applies",
      "does_not_apply",
      "insufficient_information",
    ]),
    confidence: z.number().int().min(0).max(100),
    rationale: z.string().min(1).max(2_000),
    evidence: z.array(z.string().min(1).max(500)).max(12),
    missingInformation: z.array(z.string().min(1).max(500)).max(12),
  })
  .strict();

const AnnexIIIDecisionSchema = DecisionSchema.extend({
  matchedAreas: z.array(z.enum(ANNEX_III_AREAS)).max(8),
  article6_3Exception: z.enum([
    "not_available",
    "potentially_available",
    "clearly_available",
    "insufficient_information",
  ]),
}).strict();

const AnnexIDecisionSchema = DecisionSchema.extend({
  regulatedProductFamily: z.string().min(1).max(500).nullable(),
  bothArticle6_1ConditionsMet: z.enum(["yes", "no", "unknown"]),
}).strict();

const Article50DecisionSchema = DecisionSchema.extend({
  applicableParagraphs: z
    .array(z.enum(["50(1)", "50(2)", "50(3)", "50(4)"]))
    .max(4),
}).strict();

export const ModelClassificationSchema = z
  .object({
    riskTier: z.enum([
      "prohibited",
      "high_risk_annex_iii",
      "high_risk_annex_i",
      "limited_transparency_risk",
      "minimal_risk",
      "undetermined",
    ]),
    summary: z.string().min(1).max(2_000),
    prohibitedPractices: DecisionSchema.extend({
      matchedPracticeIds: z.array(z.enum(PROHIBITED_PRACTICE_IDS)).max(7),
    }).strict(),
    signedAmendmentProhibitedPractices: DecisionSchema.extend({
      matchedPracticeIds: z.array(z.enum(SIGNED_PROHIBITED_PRACTICE_IDS)).max(1),
    }).strict(),
    annexIII: AnnexIIIDecisionSchema,
    annexI: AnnexIDecisionSchema,
    article50: Article50DecisionSchema,
    gpaiProviderObligations: DecisionSchema,
    obligationIds: z.array(z.enum(DEADLINE_IDS)).max(DEADLINE_IDS.length),
    applicableArticles: z
      .array(
        z
          .object({
            article: z.string().min(1).max(160),
            relevance: z.string().min(1).max(800),
            confidence: z.number().int().min(0).max(100),
          })
          .strict(),
      )
      .max(30),
    overallConfidence: z.number().int().min(0).max(100),
    missingInformation: z.array(z.string().min(1).max(500)).max(20),
  })
  .strict();

export const GapItemModelSchema = z
  .object({
    id: z.string().min(1).max(80),
    title: z.string().min(1).max(240),
    priority: z.enum([
      "immediate",
      "before_next_release",
      "before_applicable_deadline",
      "strengthen_for_insurance",
    ]),
    severity: z.enum(["critical", "major", "moderate", "minor"]),
    dimension: z.enum(SCORE_DIMENSIONS),
    status: z.enum(["missing", "partial", "unverified"]),
    currentEvidence: z.string().min(1).max(1_000).nullable(),
    rationale: z.string().min(1).max(1_500),
    action: z.string().min(1).max(1_500),
    evidenceNeeded: z.array(z.string().min(1).max(500)).max(12),
    referenceIds: z.array(z.enum(DEADLINE_IDS)).max(DEADLINE_IDS.length),
    implementationEffort: z.enum(["small", "medium", "large"]),
  })
  .strict();

export const GapAnalysisModelSchema = z
  .object({
    summary: z.string().min(1).max(2_000),
    gaps: z.array(GapItemModelSchema).max(18),
    demonstratedStrengths: z.array(z.string().min(1).max(500)).max(12),
    insuranceConcerns: z.array(z.string().min(1).max(500)).max(12),
  })
  .strict();

export const EnterpriseCategorySchema = z.enum([
  "micro",
  "small",
  "medium",
  "small_mid_cap",
  "large",
]);

export const ScoreTierSchema = z.enum(["A+", "A", "B", "C", "D"]);

export type CompanyInput = z.infer<typeof CompanyInputSchema>;
export type AssessmentRequest = z.infer<typeof AssessmentRequestSchema>;
export type ExtractedFacts = z.infer<typeof ExtractedFactsSchema>;
export type ModelClassification = z.infer<typeof ModelClassificationSchema>;
export type GapItemModel = z.infer<typeof GapItemModelSchema>;
export type GapAnalysisModel = z.infer<typeof GapAnalysisModelSchema>;
export type EnterpriseCategory = z.infer<typeof EnterpriseCategorySchema>;
export type ScoreTier = z.infer<typeof ScoreTierSchema>;
export type ScoreDimensionId = (typeof SCORE_DIMENSIONS)[number];
export type DeadlineId = (typeof DEADLINE_IDS)[number];
