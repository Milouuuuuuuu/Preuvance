"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LockKeyhole } from "lucide-react";
import {
  AnalysisProgress,
  type AnalysisStage,
} from "./AnalysisProgress";
import { AssessmentForm } from "./AssessmentForm";
import { AssessmentResults } from "./AssessmentResults";
import {
  isRecord,
  unwrapAssessment,
  type Assessment,
  type AssessmentRequest,
} from "./assessment-types";
import { scanDigestSchema, type ScanDigest } from "@/lib/scan/scan-handoff";

type RequestStatus = "idle" | "loading" | "success" | "error";

type ErrorAction = {
  href: string;
  label: string;
};

class AssessmentResponseError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "AssessmentResponseError";
  }
}

function apiErrorMessage(payload: unknown) {
  if (!isRecord(payload)) return null;

  if (typeof payload.detail === "string") return payload.detail;
  if (typeof payload.error === "string") return payload.error;
  if (typeof payload.message === "string") return payload.message;

  if (isRecord(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }

  return null;
}

function apiErrorCode(payload: unknown) {
  if (!isRecord(payload)) return null;
  if (typeof payload.code === "string") return payload.code;
  if (typeof payload.title === "string") return payload.title;
  if (isRecord(payload.error) && typeof payload.error.code === "string") {
    return payload.error.code;
  }
  return null;
}

function actionForAssessmentError(error: unknown): ErrorAction | null {
  if (!(error instanceof AssessmentResponseError)) return null;

  const next = encodeURIComponent("/#evaluation");
  if (error.code === "AUTHENTICATION_REQUIRED" || error.status === 401) {
    return {
      href: `/auth/sign-in?next=${next}`,
      label: "Se connecter puis reprendre l’évaluation",
    };
  }
  if (error.code === "AUTH_CONFIGURATION_REQUIRED") {
    return {
      href: `/auth/sign-in?error=configuration&next=${next}`,
      label: "Voir l’état de l’authentification",
    };
  }
  return null;
}

function isAnalysisStage(value: unknown): value is AnalysisStage {
  return (
    value === "extraction" ||
    value === "classification" ||
    value === "gap_analysis" ||
    value === "synthesis"
  );
}

async function readAssessmentResponse(
  response: Response,
  onProgress: (stage: AnalysisStage) => void,
): Promise<Assessment> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!response.ok || !contentType.includes("application/x-ndjson")) {
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new AssessmentResponseError(
        apiErrorMessage(payload) ??
          "L’évaluation n’a pas pu être produite. Réessayez dans quelques instants.",
        apiErrorCode(payload),
        response.status,
      );
    }
    return unwrapAssessment(payload);
  }

  if (!response.body) {
    throw new Error("Le flux d’évaluation n’est pas disponible.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assessment: Assessment | null = null;

  const consumeLine = (line: string) => {
    if (!line.trim()) return;
    let event: unknown;
    try {
      event = JSON.parse(line) as unknown;
    } catch {
      throw new Error("Le flux d’évaluation reçu est invalide.");
    }
    if (!isRecord(event)) return;

    if (event.type === "progress" && isAnalysisStage(event.stage)) {
      onProgress(event.stage);
      return;
    }
    if (event.type === "error") {
      throw new AssessmentResponseError(
        apiErrorMessage(event) ?? "L’évaluation n’a pas pu être terminée.",
        apiErrorCode(event),
        typeof event.status === "number" ? event.status : null,
      );
    }
    if (event.type === "result") {
      assessment = unwrapAssessment(event);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(consumeLine);
    if (done) break;
  }
  consumeLine(buffer);

  if (!assessment) {
    throw new Error("Le flux s’est terminé sans résultat d’évaluation.");
  }
  return assessment;
}

export function AssessmentExperience() {
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<ErrorAction | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [analysisStage, setAnalysisStage] =
    useState<AnalysisStage>("extraction");
  const [lastRequest, setLastRequest] = useState<AssessmentRequest | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [resultsSlot, setResultsSlot] = useState<HTMLElement | null>(null);
  const [scanDigest, setScanDigest] = useState<ScanDigest | undefined>();

  useEffect(() => {
    setResultsSlot(document.getElementById("pv-results-slot"));
    const storedDigest = window.sessionStorage.getItem("preuvance:scan-digest-v1");
    if (storedDigest) {
      try {
        const validation = scanDigestSchema.safeParse(JSON.parse(storedDigest) as unknown);
        if (validation.success) setScanDigest(validation.data);
      } catch {
        window.sessionStorage.removeItem("preuvance:scan-digest-v1");
      }
    }
  }, []);

  useEffect(() => {
    if (!assessment) return;

    const frame = window.requestAnimationFrame(() => {
      const resultSection = document.getElementById("resultats");
      if (!resultSection) return;

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      resultSection.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
      resultSection.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [assessment]);

  async function submitAssessment(payload: AssessmentRequest) {
    setStatus("loading");
    setError(null);
    setErrorAction(null);
    setAssessment(null);
    setAnalysisStage("extraction");
    setLastRequest(payload);

    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson, application/json",
        },
        body: JSON.stringify(payload),
      });

      const completedAssessment = await readAssessmentResponse(
        response,
        setAnalysisStage,
      );
      setAssessment(completedAssessment);
      setStatus("success");
      window.sessionStorage.removeItem("preuvance:scan-digest-v1");
    } catch (requestError) {
      setStatus("error");
      setErrorAction(actionForAssessmentError(requestError));
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Une erreur inattendue a interrompu l’évaluation.",
      );
    }
  }

  function resetAssessment() {
    setAssessment(null);
    setError(null);
    setErrorAction(null);
    setLastRequest(null);
    setStatus("idle");
    setScanDigest(undefined);
    setFormVersion((version) => version + 1);
    window.requestAnimationFrame(() => {
      document.getElementById("evaluation")?.scrollIntoView({ block: "start" });
    });
  }

  const isLoading = status === "loading";

  return (
    <>
      <div className="pv-panel-topline">
        <span>Analyse 01</span>
        <span>
          <LockKeyhole size={14} aria-hidden="true" />
          Données minimales
        </span>
      </div>
      {isLoading ? (
        <AnalysisProgress stage={analysisStage} />
      ) : (
        <AssessmentForm
          key={formVersion}
          error={error}
          errorAction={errorAction}
          initialValue={lastRequest}
          initialScanDigest={scanDigest}
          isSubmitting={isLoading}
          onSubmit={submitAssessment}
        />
      )}
      {assessment && resultsSlot
        ? createPortal(
            <AssessmentResults
              assessment={assessment}
              onReset={resetAssessment}
            />,
            resultsSlot,
          )
        : null}
    </>
  );
}
