import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

// One assessment runs several model calls. Five starts per one-hour window leave
// room for normal retries while bounding the maximum per-user model spend.
// The database RPC is authoritative and mirrors both constants atomically.
export const ASSESSMENT_QUOTA_LIMIT = 5;
export const ASSESSMENT_QUOTA_WINDOW_SECONDS = 60 * 60;

export type AssessmentQuotaDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
  windowSeconds: number;
};

export class AssessmentQuotaUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AssessmentQuotaUnavailableError";
  }
}

export async function consumeAssessmentQuota(
  supabase: SupabaseClient<Database>,
): Promise<AssessmentQuotaDecision> {
  const { data, error } = await supabase.rpc("consume_assessment_quota");

  if (error) {
    throw new AssessmentQuotaUnavailableError(
      "Le quota d’évaluations n’a pas pu être vérifié.",
      { cause: error },
    );
  }

  const row = data?.[0];
  if (!isQuotaRow(row)) {
    throw new AssessmentQuotaUnavailableError(
      "La réponse du quota d’évaluations est invalide.",
    );
  }

  if (
    row.request_limit !== ASSESSMENT_QUOTA_LIMIT ||
    row.window_seconds !== ASSESSMENT_QUOTA_WINDOW_SECONDS
  ) {
    throw new AssessmentQuotaUnavailableError(
      "La configuration du quota d’évaluations est désynchronisée.",
    );
  }

  return {
    allowed: row.allowed,
    remaining: row.remaining,
    retryAfterSeconds: row.allowed
      ? 0
      : Math.max(1, row.retry_after_seconds),
    limit: row.request_limit,
    windowSeconds: row.window_seconds,
  };
}

type QuotaRow = Database["public"]["Functions"]["consume_assessment_quota"]["Returns"][number];

function isQuotaRow(value: unknown): value is QuotaRow {
  if (!value || typeof value !== "object") return false;

  const row = value as Record<string, unknown>;
  if (typeof row.allowed !== "boolean") return false;

  return (
    isNonNegativeInteger(row.remaining) &&
    isNonNegativeInteger(row.retry_after_seconds) &&
    isPositiveInteger(row.request_limit) &&
    isPositiveInteger(row.window_seconds) &&
    row.remaining <= row.request_limit
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}
