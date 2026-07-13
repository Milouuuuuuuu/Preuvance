import { renderToBuffer } from "@react-pdf/renderer";
import { z } from "zod";

import {
  PDF_REQUEST_LIMIT_BYTES,
  type PreuvanceAssessment,
  validatePreuvanceAssessment,
} from "@/lib/pdf/assessment-payload";
import { createPreuvanceReportDocument } from "@/lib/pdf/preuvance-report";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const persistedReportRequestSchema = z
  .object({ assessmentId: z.string().uuid() })
  .strict();
const localDevelopmentReportRequestSchema = z
  .object({ localPayload: z.unknown() })
  .strict();
const pdfReportRequestSchema = z.union([
  persistedReportRequestSchema,
  localDevelopmentReportRequestSchema,
]);

type ServerSupabaseClient = NonNullable<
  Awaited<ReturnType<typeof createServerSupabaseClient>>
>;

type PdfAccess =
  | { mode: "authenticated"; supabase: ServerSupabaseClient }
  | { mode: "local-development" }
  | { mode: "denied"; response: Response };

export async function POST(request: Request) {
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

  const requestValidation = pdfReportRequestSchema.safeParse(input);
  if (!requestValidation.success) {
    return problem(
      422,
      "invalid_report_request",
      "La demande doit contenir soit un assessmentId, soit un localPayload de développement.",
      requestValidation.error.issues.map(formatValidationIssue),
    );
  }

  const access = await resolvePdfAccess(request);
  if (access.mode === "denied") return access.response;

  let assessment: PreuvanceAssessment | Response;
  if ("assessmentId" in requestValidation.data) {
    if (access.mode !== "authenticated") {
      return problem(
        503,
        "report_storage_unavailable",
        "Le stockage des rapports n’est pas configuré sur cet environnement.",
      );
    }
    assessment = await loadPersistedAssessment(
      access.supabase,
      requestValidation.data.assessmentId,
    );
  } else {
    if (access.mode !== "local-development") {
      return problem(
        403,
        "local_payload_forbidden",
        "Un rapport persistant doit être demandé par son assessmentId.",
      );
    }
    const localValidation = validatePreuvanceAssessment(
      requestValidation.data.localPayload,
    );
    if (!localValidation.success) {
      return problem(
        422,
        "invalid_assessment",
        "L’évaluation ne respecte pas le contrat du rapport.",
        localValidation.errors,
      );
    }
    assessment = localValidation.data;
  }

  if (assessment instanceof Response) return assessment;

  try {
    const pdf = await renderToBuffer(
      createPreuvanceReportDocument(assessment),
    );
    const body = new Uint8Array(pdf);
    const safeId = assessment.assessmentId
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

async function resolvePdfAccess(request: Request): Promise<PdfAccess> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    if (!isLoopbackDevelopmentRequest(request)) {
      return {
        mode: "denied",
        response: problem(
          503,
          "auth_configuration_required",
          "L’authentification doit être configurée pour générer un rapport hors développement local.",
        ),
      };
    }
    return { mode: "local-development" };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      mode: "denied",
      response: problem(401, "authentication_required", "Une session est requise."),
    };
  }
  return { mode: "authenticated", supabase };
}

function isLoopbackDevelopmentRequest(request: Request): boolean {
  if (process.env.NODE_ENV !== "development") return false;

  const hostname = new URL(request.url).hostname.toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

async function loadPersistedAssessment(
  supabase: ServerSupabaseClient,
  assessmentId: string,
): Promise<PreuvanceAssessment | Response> {
  const { data, error } = await supabase
    .from("assessments")
    .select("report_payload")
    .eq("id", assessmentId)
    .eq("status", "completed")
    .maybeSingle();

  if (error) {
    console.error(
      "[PREUVANCE] report.lookup_failed",
      JSON.stringify({ code: error.code }),
    );
    return problem(
      500,
      "report_lookup_failed",
      "Le rapport n’a pas pu être chargé.",
    );
  }

  // A missing row and a row hidden by RLS deliberately share the same response.
  if (!data?.report_payload) {
    return problem(404, "report_not_found", "Le rapport demandé est introuvable.");
  }

  const validation = validatePreuvanceAssessment(data.report_payload);
  if (
    !validation.success ||
    validation.data.assessmentId !== assessmentId
  ) {
    console.error(
      "[PREUVANCE] report.persisted_payload_invalid",
      JSON.stringify({ assessmentId }),
    );
    return problem(
      500,
      "stored_report_invalid",
      "Le rapport enregistré ne respecte pas le contrat attendu.",
    );
  }

  return validation.data;
}

function formatValidationIssue(issue: z.core.$ZodIssue): string {
  const path = issue.path.length > 0 ? issue.path.join(".") : "request";
  return `${path}: ${issue.message}`;
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
