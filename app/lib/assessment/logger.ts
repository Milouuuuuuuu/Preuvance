import { isAssessmentError } from "./errors";

export type PipelineStepId =
  | "extraction"
  | "classification"
  | "gap_analysis"
  | "synthesis";

export type PipelineTraceEntry = {
  step: PipelineStepId;
  status: "started" | "completed" | "failed";
  at: string;
  model: string | null;
  durationMs: number | null;
  responseId: string | null;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  } | null;
  summary: Record<string, string | number | boolean | null> | null;
  errorCode: string | null;
};

export class AssessmentLogger {
  readonly assessmentId: string;
  readonly entries: PipelineTraceEntry[] = [];

  constructor(assessmentId: string) {
    this.assessmentId = assessmentId;
  }

  start(step: PipelineStepId, model: string | null): StepTimer {
    const startedAt = Date.now();
    this.record({
      step,
      status: "started",
      at: new Date(startedAt).toISOString(),
      model,
      durationMs: null,
      responseId: null,
      usage: null,
      summary: null,
      errorCode: null,
    });
    return { step, model, startedAt };
  }

  complete(
    timer: StepTimer,
    metadata?: {
      responseId?: string | null;
      usage?: PipelineTraceEntry["usage"];
      summary?: PipelineTraceEntry["summary"];
    },
  ): void {
    this.record({
      step: timer.step,
      status: "completed",
      at: new Date().toISOString(),
      model: timer.model,
      durationMs: Date.now() - timer.startedAt,
      responseId: metadata?.responseId ?? null,
      usage: metadata?.usage ?? null,
      summary: metadata?.summary ?? null,
      errorCode: null,
    });
  }

  fail(timer: StepTimer, error: unknown): void {
    this.record({
      step: timer.step,
      status: "failed",
      at: new Date().toISOString(),
      model: timer.model,
      durationMs: Date.now() - timer.startedAt,
      responseId: null,
      usage: null,
      summary: null,
      errorCode: isAssessmentError(error) ? error.code : "UNEXPECTED_ERROR",
    });
  }

  private record(entry: PipelineTraceEntry): void {
    this.entries.push(entry);
    const level = entry.status === "failed" ? "error" : "info";
    console[level](
      "[PREUVANCE]",
      JSON.stringify({
        assessmentId: this.assessmentId,
        event: `pipeline.step.${entry.status}`,
        ...entry,
      }),
    );
  }
}

export type StepTimer = {
  step: PipelineStepId;
  model: string | null;
  startedAt: number;
};
