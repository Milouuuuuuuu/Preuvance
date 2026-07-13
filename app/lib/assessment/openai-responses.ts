import { z } from "zod";
import type { OpenAIConfig } from "./config";
import { AssessmentError } from "./errors";

type ResponseContent =
  | { type: "output_text"; text: string }
  | { type: "refusal"; refusal: string }
  | { type: string; [key: string]: unknown };

type ResponsesApiPayload = {
  id?: string;
  model?: string;
  status?: string;
  error?: { code?: string; message?: string } | null;
  incomplete_details?: { reason?: string } | null;
  output?: Array<{
    type?: string;
    content?: ResponseContent[];
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    [key: string]: unknown;
  };
};

export type StructuredResponse<T> = {
  data: T;
  responseId: string | null;
  model: string;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
};

export async function createStructuredResponse<T>(options: {
  config: OpenAIConfig;
  model: string;
  schemaName: string;
  schema: z.ZodType<T>;
  instructions: string;
  input: string;
  maxOutputTokens: number;
  signal?: AbortSignal;
}): Promise<StructuredResponse<T>> {
  const jsonSchema = z.toJSONSchema(options.schema, { target: "draft-7" }) as Record<
    string,
    unknown
  >;
  delete jsonSchema.$schema;

  const requestControl = createRequestControl(
    options.signal,
    options.config.requestTimeoutMs,
  );
  let response: Response;

  try {
    response = await fetch(`${options.config.baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        instructions: options.instructions,
        input: options.input,
        reasoning: { effort: options.config.reasoningEffort },
        text: {
          format: {
            type: "json_schema",
            name: options.schemaName,
            strict: true,
            schema: jsonSchema,
          },
        },
        max_output_tokens: options.maxOutputTokens,
        store: false,
      }),
      signal: requestControl.signal,
    });
  } catch (cause) {
    if (options.signal?.aborted) {
      throw new AssessmentError({
        code: "REQUEST_ABORTED",
        message: "La requête d’évaluation a été interrompue.",
        httpStatus: 499,
        cause,
      });
    }
    if (requestControl.didTimeout()) {
      throw new AssessmentError({
        code: "UPSTREAM_TIMEOUT",
        message: "Le modèle a dépassé le délai maximal de réponse.",
        httpStatus: 504,
        retryable: true,
        cause,
      });
    }
    throw new AssessmentError({
      code: "UPSTREAM_ERROR",
      message: "Impossible de joindre le service de raisonnement.",
      httpStatus: 502,
      retryable: true,
      cause,
    });
  } finally {
    requestControl.cleanup();
  }

  const requestId = response.headers.get("x-request-id");
  const payload = await readJsonPayload(response);

  if (!response.ok) {
    throw mapHttpError(response.status, payload, requestId, response.headers);
  }

  const apiResponse = payload as ResponsesApiPayload;
  if (apiResponse.status === "incomplete") {
    throw new AssessmentError({
      code: "MODEL_INCOMPLETE",
      message: "Le modèle n’a pas terminé sa sortie structurée.",
      httpStatus: 502,
      retryable: true,
      details: {
        reason: apiResponse.incomplete_details?.reason ?? "unknown",
        responseId: apiResponse.id ?? requestId,
      },
    });
  }

  if (apiResponse.status && apiResponse.status !== "completed") {
    throw new AssessmentError({
      code: "UPSTREAM_ERROR",
      message: "Le service de raisonnement n’a pas terminé la requête.",
      httpStatus: 502,
      retryable: apiResponse.status !== "failed",
      details: {
        status: apiResponse.status,
        upstreamCode: apiResponse.error?.code,
        responseId: apiResponse.id ?? requestId,
      },
    });
  }

  const content = (apiResponse.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? []);
  const refusal = content.find(
    (item): item is Extract<ResponseContent, { type: "refusal" }> =>
      item.type === "refusal",
  );
  if (refusal) {
    throw new AssessmentError({
      code: "MODEL_REFUSAL",
      message: "Le modèle a refusé d’analyser cette description.",
      httpStatus: 422,
      retryable: false,
      details: {
        refusal: refusal.refusal,
        responseId: apiResponse.id ?? requestId,
      },
    });
  }

  const text = content
    .filter(
      (item): item is Extract<ResponseContent, { type: "output_text" }> =>
        item.type === "output_text",
    )
    .map((item) => item.text)
    .join("");

  if (!text) {
    throw new AssessmentError({
      code: "MODEL_OUTPUT_INVALID",
      message: "Le modèle n’a retourné aucune sortie structurée exploitable.",
      httpStatus: 502,
      retryable: true,
      details: { responseId: apiResponse.id ?? requestId },
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new AssessmentError({
      code: "MODEL_OUTPUT_INVALID",
      message: "La sortie structurée du modèle n’est pas un JSON valide.",
      httpStatus: 502,
      retryable: true,
      details: { responseId: apiResponse.id ?? requestId },
      cause,
    });
  }

  const validated = options.schema.safeParse(parsed);
  if (!validated.success) {
    throw new AssessmentError({
      code: "MODEL_OUTPUT_INVALID",
      message: "La sortie du modèle ne respecte pas le schéma attendu.",
      httpStatus: 502,
      retryable: true,
      details: {
        responseId: apiResponse.id ?? requestId,
        issues: validated.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
  }

  return {
    data: validated.data,
    responseId: apiResponse.id ?? requestId,
    model: apiResponse.model ?? options.model,
    usage: {
      inputTokens: apiResponse.usage?.input_tokens ?? null,
      outputTokens: apiResponse.usage?.output_tokens ?? null,
      totalTokens: apiResponse.usage?.total_tokens ?? null,
    },
  };
}

function createRequestControl(parent: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromParent = () => controller.abort(parent?.reason);
  if (parent?.aborted) abortFromParent();
  else parent?.addEventListener("abort", abortFromParent, { once: true });

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error("OpenAI request timeout"));
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", abortFromParent);
    },
  };
}

async function readJsonPayload(response: Response): Promise<Record<string, unknown>> {
  try {
    const payload: unknown = await response.json();
    return typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function mapHttpError(
  status: number,
  payload: Record<string, unknown>,
  requestId: string | null,
  headers: Headers,
): AssessmentError {
  const upstreamError =
    typeof payload.error === "object" && payload.error !== null
      ? (payload.error as Record<string, unknown>)
      : {};
  const upstreamCode =
    typeof upstreamError.code === "string" ? upstreamError.code : undefined;
  const details = {
    upstreamStatus: status,
    upstreamCode,
    requestId,
    retryAfter: headers.get("retry-after"),
  };

  if (status === 401 || status === 403) {
    return new AssessmentError({
      code: "UPSTREAM_AUTHENTICATION_ERROR",
      message: "Le service d’évaluation est mal configuré côté serveur.",
      httpStatus: 503,
      retryable: false,
      details,
    });
  }

  if (status === 429) {
    return new AssessmentError({
      code: "UPSTREAM_RATE_LIMITED",
      message: "Le service de raisonnement est temporairement saturé.",
      httpStatus: 503,
      retryable: true,
      details,
    });
  }

  return new AssessmentError({
    code: "UPSTREAM_ERROR",
    message: "Le service de raisonnement a retourné une erreur.",
    httpStatus: 502,
    retryable: status >= 500,
    details,
  });
}

