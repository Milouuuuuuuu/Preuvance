import { isAssessmentError } from "@/app/lib/assessment/errors";
import {
  runAssessmentPipeline,
  type AssessmentProgressEvent,
} from "@/app/lib/assessment/pipeline";
import {
  AssessmentRequestSchema,
  type AssessmentRequest,
} from "@/app/lib/assessment/schemas";
import {
  AssessmentPersistenceError,
  persistCompletedAssessment,
} from "@/lib/supabase/persist-assessment";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_REQUEST_BYTES = 16_384;

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return problem(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Le corps de la requête doit être du JSON.",
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return problem(
      413,
      "PAYLOAD_TOO_LARGE",
      "La description dépasse la taille autorisée.",
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return problem(400, "INVALID_BODY", "Le corps de la requête est illisible.");
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    return problem(
      413,
      "PAYLOAD_TOO_LARGE",
      "La description dépasse la taille autorisée.",
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return problem(400, "INVALID_JSON", "Le corps JSON est invalide.");
  }

  const validation = AssessmentRequestSchema.safeParse(payload);
  if (!validation.success) {
    return problem(
      422,
      "INVALID_REQUEST",
      "Les données de l’évaluation sont invalides.",
      {
        issues: validation.error.issues.map((issue) => ({
          path: issue.path.join("."),
          code: issue.code,
          message: issue.message,
        })),
      },
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase && process.env.NODE_ENV === "production") {
    return problem(
      503,
      "AUTH_CONFIGURATION_REQUIRED",
      "L’authentification Supabase doit être configurée en production.",
      { retryable: false },
    );
  }
  if (supabase) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("[PREUVANCE] auth.validation_failed", error.message);
      return problem(
        503,
        "AUTH_UNAVAILABLE",
        "La session n’a pas pu être vérifiée. Réessayez dans un instant.",
        { retryable: true },
      );
    }
    if (!user) {
      return problem(
        401,
        "AUTHENTICATION_REQUIRED",
        "Une session est requise pour enregistrer l’évaluation.",
        { retryable: false },
      );
    }
  }

  if (
    request.headers
      .get("accept")
      ?.toLowerCase()
      .includes("application/x-ndjson")
  ) {
    return streamAssessment(validation.data, supabase, request.signal);
  }

  try {
    const assessment = await executeAssessment(
      validation.data,
      supabase,
      request.signal,
    );
    return Response.json(
      { assessment },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    const issue = describeAssessmentError(error);
    return problem(issue.status, issue.code, issue.detail, issue.extra);
  }
}

type ServerSupabaseClient = NonNullable<
  Awaited<ReturnType<typeof createServerSupabaseClient>>
>;

async function executeAssessment(
  input: AssessmentRequest,
  supabase: ServerSupabaseClient | null,
  signal: AbortSignal,
  onProgress?: (event: AssessmentProgressEvent) => void | Promise<void>,
) {
  const assessment = await runAssessmentPipeline(input, {
    signal,
    onProgress,
  });
  let persistence:
    | { status: "disabled" }
    | { status: "persisted"; assessmentId: string; aiSystemId: string } = {
    status: "disabled",
  };

  if (supabase) {
    const persisted = await persistCompletedAssessment(supabase, assessment);
    persistence = { status: "persisted", ...persisted };
  }

  return { ...assessment, persistence };
}

function streamAssessment(
  input: AssessmentRequest,
  supabase: ServerSupabaseClient | null,
  signal: AbortSignal,
) {
  const encoder = new TextEncoder();
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: Record<string, unknown>) => {
        if (!cancelled) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      };

      void (async () => {
        try {
          const assessment = await executeAssessment(
            input,
            supabase,
            signal,
            (event) => send({ type: "progress", ...event }),
          );
          send({ type: "result", assessment });
        } catch (error) {
          const issue = describeAssessmentError(error);
          send({ type: "error", ...issue });
        } finally {
          if (!cancelled) controller.close();
        }
      })();
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function describeAssessmentError(error: unknown) {
  if (error instanceof AssessmentPersistenceError) {
    console.error("[PREUVANCE] assessment.persistence_failed", error);
    return {
      status: 500,
      code: "PERSISTENCE_ERROR",
      detail: "L’évaluation a été calculée mais n’a pas pu être enregistrée.",
      extra: { retryable: true },
    };
  }

  if (isAssessmentError(error)) {
    if (error.code !== "MODEL_REFUSAL") {
      console.error(
        "[PREUVANCE] assessment.failed",
        JSON.stringify({
          code: error.code,
          retryable: error.retryable,
          details: error.details,
        }),
      );
    }
    return {
      status: error.httpStatus,
      code: error.code,
      detail: error.message,
      extra: {
        retryable: error.retryable,
        ...(publicErrorDetails(error.code, error.details) ?? {}),
      },
    };
  }

  console.error("[PREUVANCE] assessment.failed", error);
  return {
    status: 500,
    code: "INTERNAL_ERROR",
    detail: "L’évaluation n’a pas pu être terminée.",
    extra: { retryable: false },
  };
}

function problem(
  status: number,
  code: string,
  detail: string,
  extra?: Record<string, unknown>,
): Response {
  return Response.json(
    {
      type: `/problems/${code.toLowerCase()}`,
      title: code,
      status,
      detail,
      ...extra,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/problem+json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function publicErrorDetails(
  code: string,
  details: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!details) return null;
  if (code === "MODEL_REFUSAL") {
    return {
      refusal:
        typeof details.refusal === "string" ? details.refusal : undefined,
      responseId: details.responseId,
    };
  }
  if (code === "MODEL_INCOMPLETE") {
    return { reason: details.reason, responseId: details.responseId };
  }
  return null;
}
