import type { SupabaseClient } from "@supabase/supabase-js";

import type { runAssessmentPipeline } from "@/app/lib/assessment/pipeline";
import { preuvanceAssessmentSchema } from "@/lib/pdf/assessment-payload";

import type { Database, Json } from "./database.types";

type CompletedAssessment = Awaited<ReturnType<typeof runAssessmentPipeline>>;

export type AssessmentPersistenceResult = {
  assessmentId: string;
  aiSystemId: string;
};

export class AssessmentPersistenceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AssessmentPersistenceError";
  }
}

export async function persistCompletedAssessment(
  supabase: SupabaseClient<Database>,
  assessment: CompletedAssessment,
): Promise<AssessmentPersistenceResult> {
  const reportPayload = preuvanceAssessmentSchema.parse(assessment.report);
  const reasoningSteps = buildReasoningSteps(assessment.trace);

  const { data, error } = await supabase
    .rpc("persist_completed_assessment", {
      p_assessment_id: assessment.id,
      p_organization_name: assessment.input.organizationName,
      p_system_name: assessment.input.systemName,
      p_system_description: assessment.input.description,
      p_sector: assessment.facts.sector,
      p_source_description: assessment.input.description,
      p_structured_facts: toJson(assessment.facts),
      p_classification: toJson(assessment.classification),
      p_gaps: toJson(assessment.gaps),
      p_report_payload: toJson(reportPayload),
      p_score: assessment.score.overall,
      p_tier: assessment.score.tier,
      p_reasoning_steps: toJson(reasoningSteps),
    })
    .single();

  if (error || !data) {
    throw new AssessmentPersistenceError(
      "L’évaluation terminée n’a pas pu être enregistrée.",
      { cause: error },
    );
  }

  return {
    assessmentId: data.assessment_id,
    aiSystemId: data.ai_system_id,
  };
}

function buildReasoningSteps(trace: CompletedAssessment["trace"]) {
  return trace
    .filter((entry) => entry.status !== "started")
    .map((entry, index) => {
      const completedAt = entry.at;
      const completedAtMs = Date.parse(completedAt);
      const startedAt =
        entry.durationMs !== null && Number.isFinite(completedAtMs)
          ? new Date(completedAtMs - entry.durationMs).toISOString()
          : null;

      return {
        sequence: index + 1,
        stage: entry.step,
        status: entry.status,
        model: entry.model ?? "deterministic",
        input: null,
        output: {
          responseId: entry.responseId,
          usage: entry.usage,
          summary: entry.summary,
        },
        error_message: entry.errorCode,
        started_at: startedAt,
        completed_at: completedAt,
      };
    });
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
