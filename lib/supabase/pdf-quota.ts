import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * Quota de rendu PDF, distinct de celui des évaluations.
 *
 * Télécharger plusieurs fois son propre dossier est légitime ; lancer une
 * analyse coûte des appels modèle. La limite est donc large : elle ne gêne pas
 * un usage normal et borne le CPU du Worker face à une boucle. La fonction SQL
 * `consume_pdf_render_quota` est l'autorité et reprend ces deux constantes.
 */
export const PDF_QUOTA_LIMIT = 30;
export const PDF_QUOTA_WINDOW_SECONDS = 60 * 60;

export type PdfQuotaDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export class PdfQuotaUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PdfQuotaUnavailableError";
  }
}

type QuotaRow = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
  request_limit: number;
  window_seconds: number;
};

function isQuotaRow(value: unknown): value is QuotaRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const integer = (candidate: unknown): candidate is number =>
    typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 0;
  return (
    typeof row.allowed === "boolean" &&
    integer(row.remaining) &&
    integer(row.retry_after_seconds) &&
    integer(row.request_limit) &&
    integer(row.window_seconds)
  );
}

export async function consumePdfRenderQuota(
  supabase: SupabaseClient<Database>,
): Promise<PdfQuotaDecision> {
  const { data, error } = await supabase.rpc("consume_pdf_render_quota");

  if (error) {
    throw new PdfQuotaUnavailableError("Le quota de rendu PDF n’a pas pu être vérifié.", {
      cause: error,
    });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!isQuotaRow(row)) {
    throw new PdfQuotaUnavailableError("La réponse du quota de rendu PDF est invalide.");
  }

  if (row.request_limit !== PDF_QUOTA_LIMIT || row.window_seconds !== PDF_QUOTA_WINDOW_SECONDS) {
    throw new PdfQuotaUnavailableError("La configuration du quota de rendu PDF est désynchronisée.");
  }

  return {
    allowed: row.allowed,
    remaining: row.remaining,
    retryAfterSeconds: row.allowed ? 0 : Math.max(1, row.retry_after_seconds),
  };
}
