import { getOpenAIConfig } from "./config";
import { classifyEnterprise } from "./enterprise";
import { AssessmentLogger, type StepTimer } from "./logger";
import { createStructuredResponse, type StructuredResponse } from "./openai-responses";
import {
  buildClassificationInput,
  buildExtractionInput,
  buildGapInput,
  CLASSIFICATION_INSTRUCTIONS,
  EXTRACTION_INSTRUCTIONS,
  GAP_INSTRUCTIONS,
} from "./prompts";
import { getRegulatoryReference } from "./regulatory";
import { runDeterministicCrossCheck } from "./rules";
import { computeReadinessScore } from "./scoring";
import {
  ExtractedFactsSchema,
  GapAnalysisModelSchema,
  ModelClassificationSchema,
  type AssessmentRequest,
  type DeadlineId,
  type ExtractedFacts,
  type ModelClassification,
} from "./schemas";
import { buildAssessment } from "./synthesis";

export type AssessmentProgressStage =
  | "extraction"
  | "classification"
  | "gap_analysis"
  | "synthesis";

export type AssessmentProgressEvent = {
  stage: AssessmentProgressStage;
  status: "running" | "completed";
};

export async function runAssessmentPipeline(
  request: AssessmentRequest,
  options?: {
    signal?: AbortSignal;
    onProgress?: (
      event: AssessmentProgressEvent,
    ) => void | Promise<void>;
  },
) {
  const id = crypto.randomUUID();
  const generatedAt = new Date().toISOString();
  const logger = new AssessmentLogger(id);
  const config = getOpenAIConfig();
  const reference = getRegulatoryReference();
  const enterprise = classifyEnterprise(
    request.company,
    reference.enterpriseThresholds,
  );

  await options?.onProgress?.({ stage: "extraction", status: "running" });
  const extraction = await runLoggedModelStep(
    logger,
    logger.start("extraction", config.models.reasoning),
    () =>
      createStructuredResponse({
        config,
        model: config.models.reasoning,
        schemaName: "preuvance_extracted_facts",
        schema: ExtractedFactsSchema,
        instructions: EXTRACTION_INSTRUCTIONS,
        input: buildExtractionInput(request),
        maxOutputTokens: 6_000,
        signal: options?.signal,
      }),
    (data) => ({
      sector: data.sector,
      actorRole: data.actorRole,
      modelType: data.modelType,
      missingInformationCount: data.missingInformation.length,
    }),
  );
  await options?.onProgress?.({ stage: "extraction", status: "completed" });

  await options?.onProgress?.({ stage: "classification", status: "running" });
  const classificationResponse = await runLoggedModelStep(
    logger,
    logger.start("classification", config.models.reasoning),
    () =>
      createStructuredResponse({
        config,
        model: config.models.reasoning,
        schemaName: "preuvance_regulatory_classification",
        schema: ModelClassificationSchema,
        instructions: CLASSIFICATION_INSTRUCTIONS,
        input: buildClassificationInput({
          facts: extraction.data,
          enterprise,
          reference,
        }),
        maxOutputTokens: 8_000,
        signal: options?.signal,
      }),
    (data) => ({
      riskTier: data.riskTier,
      overallConfidence: data.overallConfidence,
      obligationCount: data.obligationIds.length,
    }),
  );
  await options?.onProgress?.({ stage: "classification", status: "completed" });
  const classification = normalizeObligationIds(
    classificationResponse.data,
    extraction.data,
  );

  await options?.onProgress?.({ stage: "gap_analysis", status: "running" });
  const gapAnalysis = await runLoggedModelStep(
    logger,
    logger.start("gap_analysis", config.models.reasoning),
    () =>
      createStructuredResponse({
        config,
        model: config.models.reasoning,
        schemaName: "preuvance_gap_analysis",
        schema: GapAnalysisModelSchema,
        instructions: GAP_INSTRUCTIONS,
        input: buildGapInput({
          facts: extraction.data,
          classification,
          enterprise,
          reference,
        }),
        maxOutputTokens: 12_000,
        signal: options?.signal,
      }),
    (data) => ({
      gapCount: data.gaps.length,
      criticalGapCount: data.gaps.filter((gap) => gap.severity === "critical")
        .length,
      missingControlCount: data.gaps.filter((gap) => gap.status === "missing")
        .length,
    }),
  );
  await options?.onProgress?.({ stage: "gap_analysis", status: "completed" });

  await options?.onProgress?.({ stage: "synthesis", status: "running" });
  const synthesisTimer = logger.start("synthesis", null);
  try {
    const crossCheck = runDeterministicCrossCheck({
      description: request.description,
      facts: extraction.data,
      classification,
    });
    const score = computeReadinessScore(
      gapAnalysis.data.gaps,
      classification,
      crossCheck,
    );
    logger.complete(synthesisTimer, {
      summary: {
        score: score.overall,
        tier: score.tier,
        appliedCapCount: score.appliedCaps.length,
        crossCheckStatus: crossCheck.status,
      },
    });
    const assessment = buildAssessment({
      id,
      generatedAt,
      request,
      facts: extraction.data,
      modelClassification: classification,
      enterprise,
      gapAnalysis: gapAnalysis.data,
      score,
      crossCheck,
      trace: logger.entries,
      models: config.models,
      resolvedModels: {
        extraction: extraction.model,
        classification: classificationResponse.model,
        gapAnalysis: gapAnalysis.model,
      },
      reference,
    });
    await options?.onProgress?.({ stage: "synthesis", status: "completed" });
    return assessment;
  } catch (error) {
    logger.fail(synthesisTimer, error);
    throw error;
  }
}

async function runLoggedModelStep<T>(
  logger: AssessmentLogger,
  timer: StepTimer,
  action: () => Promise<StructuredResponse<T>>,
  summarize: (
    data: T,
  ) => Record<string, string | number | boolean | null>,
): Promise<StructuredResponse<T>> {
  try {
    const response = await action();
    logger.complete(timer, {
      responseId: response.responseId,
      usage: response.usage,
      summary: summarize(response.data),
    });
    return response;
  } catch (error) {
    logger.fail(timer, error);
    throw error;
  }
}

function normalizeObligationIds(
  classification: ModelClassification,
  facts: ExtractedFacts,
): ModelClassification {
  const ids = new Set<DeadlineId>(classification.obligationIds);
  ids.add("ai-literacy");

  if (
    classification.prohibitedPractices.outcome === "applies" ||
    classification.prohibitedPractices.outcome === "likely_applies"
  ) {
    ids.add("art5-prohibited-practices");
  }
  if (
    classification.gpaiProviderObligations.outcome === "applies" ||
    classification.gpaiProviderObligations.outcome === "likely_applies"
  ) {
    ids.add("gpai-provider-obligations");
  }
  if (
    classification.annexIII.outcome === "applies" ||
    classification.annexIII.outcome === "likely_applies"
  ) {
    ids.add("high-risk-annex-iii");
  }
  if (
    classification.annexI.outcome === "applies" ||
    classification.annexI.outcome === "likely_applies"
  ) {
    ids.add("high-risk-annex-i");
  }

  for (const paragraph of classification.article50.applicableParagraphs) {
    if (paragraph === "50(1)") ids.add("art50-1-human-interaction-disclosure");
    if (paragraph === "50(2)") ids.add("art50-2-machine-readable-marking");
    if (paragraph === "50(3)") ids.add("art50-3-emotion-biometric-notice");
    if (paragraph === "50(4)") {
      if (facts.createsDeepfakes !== false) {
        ids.add("art50-4-deepfake-disclosure");
      }
      if (facts.publishesPublicInterestText !== false) {
        ids.add("art50-4-public-interest-text-disclosure");
      }
    }
  }

  return { ...classification, obligationIds: [...ids] };
}
