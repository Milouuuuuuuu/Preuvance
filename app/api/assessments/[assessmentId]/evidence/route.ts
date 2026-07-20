import { z } from "zod";

import {
  evidenceLedgerSchema,
  type EvidenceLedgerItem,
} from "@/lib/evidence/evidence-ledger";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ assessmentId: z.string().uuid() }).strict();
const revisionSchema = z.number().int().nonnegative();
const updateSchema = z
  .object({ evidence: evidenceLedgerSchema, revision: revisionSchema })
  .strict();
const syncResultSchema = z
  .object({ evidence: evidenceLedgerSchema, revision: revisionSchema })
  .strict();
const MAX_REQUEST_BYTES = 512_000;

type RouteContext = {
  params: Promise<{ assessmentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const access = await resolveAccess(context);
  if (access instanceof Response) return access;

  const { data: assessment, error: assessmentError } = await access.supabase
    .from("assessments")
    .select("id, evidence_revision")
    .eq("id", access.assessmentId)
    .eq("status", "completed")
    .maybeSingle();

  if (assessmentError) {
    console.error("[PREUVANCE] evidence.assessment_lookup_failed", assessmentError.code);
    return problem(500, "EVIDENCE_LOOKUP_FAILED", "Le dossier de preuves n’a pas pu être chargé.");
  }
  if (!assessment) {
    return problem(404, "ASSESSMENT_NOT_FOUND", "Le dossier demandé est introuvable.");
  }

  const { data, error } = await access.supabase
    .from("assessment_evidence")
    .select("*")
    .eq("assessment_id", access.assessmentId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[PREUVANCE] evidence.lookup_failed", error.code);
    return problem(500, "EVIDENCE_LOOKUP_FAILED", "Le registre de preuves n’a pas pu être chargé.");
  }

  const evidence = (data ?? []).map(mapEvidenceRow);
  const validation = evidenceLedgerSchema.safeParse(evidence);
  if (!validation.success) {
    console.error(
      "[PREUVANCE] evidence.persisted_payload_invalid",
      JSON.stringify({ assessmentId: access.assessmentId }),
    );
    return problem(500, "EVIDENCE_INVALID", "Le registre enregistré ne respecte pas le contrat attendu.");
  }

  return Response.json(
    {
      assessmentId: access.assessmentId,
      evidence: validation.data,
      revision: assessment.evidence_revision,
    },
    { headers: privateJsonHeaders() },
  );
}

export async function PUT(request: Request, context: RouteContext) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return problem(413, "PAYLOAD_TOO_LARGE", "Le registre dépasse la taille autorisée.");
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return problem(415, "UNSUPPORTED_MEDIA_TYPE", "Le corps doit être du JSON.");
  }

  const access = await resolveAccess(context);
  if (access instanceof Response) return access;

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return problem(400, "INVALID_BODY", "Le registre est illisible.");
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    return problem(413, "PAYLOAD_TOO_LARGE", "Le registre dépasse la taille autorisée.");
  }

  let input: unknown;
  try {
    input = JSON.parse(rawBody) as unknown;
  } catch {
    return problem(400, "INVALID_JSON", "Le corps JSON est invalide.");
  }
  const validation = updateSchema.safeParse(input);
  if (!validation.success) {
    return problem(
      422,
      "INVALID_EVIDENCE",
      validation.error.issues[0]?.message ?? "Le registre est invalide.",
    );
  }

  const { data, error } = await access.supabase.rpc("sync_assessment_evidence", {
    p_assessment_id: access.assessmentId,
    p_evidence: toJson(validation.data.evidence),
    p_expected_revision: validation.data.revision,
  });

  if (error) {
    if (error.code === "P0002") {
      return problem(404, "ASSESSMENT_NOT_FOUND", "Le dossier demandé est introuvable.");
    }
    if (error.code === "40001") {
      return problem(
        409,
        "EVIDENCE_REVISION_CONFLICT",
        "Le registre a été modifié dans un autre onglet. Rechargez le dossier avant de réessayer.",
      );
    }
    if (["22007", "22008", "22023"].includes(error.code)) {
      return problem(
        422,
        "INVALID_EVIDENCE",
        "Le registre ne respecte pas les invariants de persistance.",
      );
    }
    console.error("[PREUVANCE] evidence.sync_failed", error.code);
    return problem(500, "EVIDENCE_SYNC_FAILED", "Le registre n’a pas pu être enregistré.");
  }

  const persisted = syncResultSchema.safeParse(data);
  if (!persisted.success) {
    return problem(500, "EVIDENCE_SYNC_INVALID", "Le registre enregistré est invalide.");
  }

  return Response.json(
    { assessmentId: access.assessmentId, ...persisted.data },
    { headers: privateJsonHeaders() },
  );
}

async function resolveAccess(context: RouteContext) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return problem(404, "ASSESSMENT_NOT_FOUND", "Le dossier demandé est introuvable.");
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return problem(503, "AUTH_CONFIGURATION_REQUIRED", "La persistance Supabase n’est pas configurée.");
  }
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return problem(401, "AUTHENTICATION_REQUIRED", "Une session est requise.");
  }
  return { supabase, assessmentId: params.data.assessmentId };
}

function mapEvidenceRow(row: {
  id: string;
  control: string;
  status: EvidenceLedgerItem["status"];
  detail: string;
  gap_id: string | null;
  article_references: string[];
  owner: string | null;
  source_type: string;
  source_label: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  sha256: string | null;
  collected_at: string | null;
  valid_until: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  updated_at: string;
}): EvidenceLedgerItem {
  return {
    id: row.id,
    control: row.control,
    status: row.status,
    detail: row.detail,
    ...(row.gap_id ? { gapId: row.gap_id } : {}),
    ...(row.article_references.length ? { articleReferences: row.article_references } : {}),
    ...(row.owner ? { owner: row.owner } : {}),
    sourceType: row.source_type as EvidenceLedgerItem["sourceType"],
    ...(row.source_label ? { sourceLabel: row.source_label } : {}),
    ...(row.file_name ? { fileName: row.file_name } : {}),
    ...(row.file_size_bytes !== null ? { fileSizeBytes: row.file_size_bytes } : {}),
    ...(row.sha256 ? { sha256: row.sha256 } : {}),
    ...(row.collected_at ? { collectedAt: row.collected_at } : {}),
    ...(row.valid_until ? { validUntil: row.valid_until } : {}),
    ...(row.reviewed_by ? { reviewedBy: row.reviewed_by } : {}),
    ...(row.reviewed_at ? { reviewedAt: row.reviewed_at } : {}),
    updatedAt: row.updated_at,
  };
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function privateJsonHeaders() {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  };
}

function problem(status: number, code: string, detail: string) {
  return Response.json(
    { type: `/problems/${code.toLowerCase()}`, title: code, status, detail },
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
