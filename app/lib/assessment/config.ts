import { AssessmentError } from "./errors";

export type AssessmentModels = {
  reasoning: string;
  ancillary: string;
};

export type OpenAIConfig = {
  apiKey: string;
  baseUrl: string;
  models: AssessmentModels;
  reasoningEffort: "low" | "medium" | "high" | "xhigh" | "max";
  requestTimeoutMs: number;
};

const REASONING_EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);

export function getOpenAIConfig(): OpenAIConfig {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AssessmentError({
      code: "CONFIGURATION_ERROR",
      message:
        "Le service d’évaluation n’est pas configuré : OPENAI_API_KEY est absente.",
      httpStatus: 503,
      retryable: false,
    });
  }

  const baseUrl = normalizeBaseUrl(
    process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
  );
  const reasoning = process.env.OPENAI_REASONING_MODEL?.trim() || "gpt-5.6-sol";
  const ancillary = process.env.OPENAI_ANCILLARY_MODEL?.trim() || "gpt-5.6-luna";
  const configuredEffort = process.env.OPENAI_REASONING_EFFORT?.trim() || "high";
  const reasoningEffort = REASONING_EFFORTS.has(configuredEffort)
    ? (configuredEffort as OpenAIConfig["reasoningEffort"])
    : "high";
  const configuredTimeout = Number(process.env.OPENAI_REQUEST_TIMEOUT_MS);
  const requestTimeoutMs =
    Number.isFinite(configuredTimeout) &&
    configuredTimeout >= 5_000 &&
    configuredTimeout <= 300_000
      ? Math.round(configuredTimeout)
      : 90_000;

  return {
    apiKey,
    baseUrl,
    models: { reasoning, ancillary },
    reasoningEffort,
    requestTimeoutMs,
  };
}

function normalizeBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch (cause) {
    throw new AssessmentError({
      code: "CONFIGURATION_ERROR",
      message: "OPENAI_BASE_URL n’est pas une URL valide.",
      httpStatus: 503,
      cause,
    });
  }

  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new AssessmentError({
      code: "CONFIGURATION_ERROR",
      message: "OPENAI_BASE_URL doit utiliser HTTPS.",
      httpStatus: 503,
    });
  }

  return url.toString().replace(/\/$/, "");
}

