import { renderToBuffer } from "@react-pdf/renderer";

import {
  PDF_REQUEST_LIMIT_BYTES,
  validatePreuvanceAssessment,
} from "@/lib/pdf/assessment-payload";
import { createPreuvanceReportDocument } from "@/lib/pdf/preuvance-report";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = await rejectUnauthenticatedRequestWhenConfigured();
  if (unauthorized) return unauthorized;

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return problem(415, "unsupported_media_type", "Le corps doit être du JSON.");
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > PDF_REQUEST_LIMIT_BYTES) {
    return problem(413, "payload_too_large", "Le rapport dépasse la taille autorisée.");
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return problem(400, "invalid_body", "Le corps de la requête est illisible.");
  }

  if (new TextEncoder().encode(rawBody).byteLength > PDF_REQUEST_LIMIT_BYTES) {
    return problem(413, "payload_too_large", "Le rapport dépasse la taille autorisée.");
  }

  let input: unknown;
  try {
    input = JSON.parse(rawBody) as unknown;
  } catch {
    return problem(400, "invalid_json", "Le corps JSON est invalide.");
  }

  const validation = validatePreuvanceAssessment(input);
  if (!validation.success) {
    return problem(
      422,
      "invalid_assessment",
      "L’évaluation ne respecte pas le contrat du rapport.",
      validation.errors,
    );
  }

  try {
    const pdf = await renderToBuffer(
      createPreuvanceReportDocument(validation.data),
    );
    const body = new Uint8Array(pdf);
    const safeId = validation.data.assessmentId
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .slice(0, 64);

    return new Response(body, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="preuvance-${safeId || "rapport"}.pdf"`,
        "Content-Length": String(body.byteLength),
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("PREUVANCE PDF generation failed", error);
    return problem(
      500,
      "pdf_generation_failed",
      "Le rapport PDF n’a pas pu être généré.",
      process.env.NODE_ENV === "development" && error instanceof Error
        ? [error.stack ?? error.message]
        : undefined,
    );
  }
}

async function rejectUnauthenticatedRequestWhenConfigured() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return problem(401, "authentication_required", "Une session est requise.");
  }
  return null;
}

function problem(
  status: number,
  code: string,
  detail: string,
  errors?: string[],
) {
  return Response.json(
    {
      type: `/problems/${code}`,
      title: code,
      status,
      detail,
      ...(errors ? { errors } : {}),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/problem+json; charset=utf-8",
      },
    },
  );
}
