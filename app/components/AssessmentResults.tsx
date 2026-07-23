"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Download,
  FileCheck2,
  FolderOpen,
  RotateCcw,
  Scale,
  ShieldCheck,
} from "lucide-react";
import type { Assessment, JsonRecord } from "./assessment-types";
import { isRecord } from "./assessment-types";
import { ratioToPercentage, toPercentage } from "../lib/assessment/percentages";
import {
  normalizeEvidenceLedger,
  toReportEvidence,
  type EvidenceLedgerItem,
} from "@/lib/evidence/evidence-ledger";
import {
  EvidenceWorkbench,
  type EvidenceWorkbenchHandle,
} from "./EvidenceWorkbench";
import { trackEvent } from "@/lib/analytics/posthog";

type AssessmentResultsProps = {
  assessment: Assessment;
  onReset: () => void;
  staticPdfHref?: string;
  // false pour les relectures (démo Northstar, réouverture d'un dossier) :
  // seul un run terminé en direct doit compter comme assessment_completed.
  trackCompletion?: boolean;
};

type Dimension = {
  label: string;
  score: number | null;
  detail: string | null;
};

type Obligation = {
  title: string;
  article: string | null;
  deadline: string | null;
  detail: string | null;
  status: string | null;
};

type Gap = {
  title: string;
  priority: string | null;
  article: string | null;
  detail: string | null;
  action: string | null;
};

type Decision = {
  title: string;
  score: number | null;
  rationale: string | null;
  decision: string | null;
};

const LABELS: Record<string, string> = {
  affectedPeople: "Personnes concernées",
  annualRevenue: "Chiffre d’affaires annuel",
  balanceSheetTotal: "Total du bilan",
  decisions: "Décisions produites",
  employees: "Effectif",
  foundationModel: "Modèle de fondation",
  intendedPurpose: "Finalité prévue",
  modelType: "Type de modèle",
  outputs: "Sorties produites",
  providerRole: "Rôle dans la chaîne IA",
  sector: "Secteur",
  systemPurpose: "Finalité du système",
  targetUsers: "Utilisateurs cibles",
};

function firstValue(record: JsonRecord | null, keys: string[]): unknown {
  if (!record) return undefined;

  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }

  return undefined;
}

function textValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "Oui" : "Non";
  }

  return null;
}

function firstText(record: JsonRecord | null, keys: string[]): string | null {
  return textValue(firstValue(record, keys));
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function firstNumber(record: JsonRecord | null, keys: string[]): number | null {
  return numericValue(firstValue(record, keys));
}

function humanizeKey(key: string) {
  if (LABELS[key]) return LABELS[key];

  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-zà-ÿ])([A-Z])/g, "$1 $2")
    .trim();

  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "Information";
}

function readableValue(value: unknown): string | null {
  const direct = textValue(value);
  if (direct !== null) return direct;

  if (Array.isArray(value)) {
    const parts = value.map(readableValue).filter((item): item is string => Boolean(item));
    return parts.length ? parts.join(" · ") : null;
  }

  if (isRecord(value)) {
    return firstText(value, ["label", "name", "title", "value", "summary"]);
  }

  return null;
}

function normalizeCollection(value: unknown, nestedKeys: string[]) {
  if (Array.isArray(value)) return value;

  if (isRecord(value)) {
    const nested = firstValue(value, nestedKeys);
    if (Array.isArray(nested)) return nested;
  }

  return [];
}

function normalizeDimensions(value: unknown): Dimension[] {
  const items: Array<[string, unknown]> = Array.isArray(value)
    ? value.map((item, index) => [String(index + 1), item])
    : isRecord(value)
      ? Object.entries(value)
      : [];

  return items
    .map(([key, item]): Dimension | null => {
      if (typeof item === "number" || typeof item === "string") {
        const numeric = numericValue(item);
        return numeric === null
          ? null
          : { label: humanizeKey(key), score: toPercentage(numeric), detail: null };
      }

      if (!isRecord(item)) return null;

      const rawScore = firstNumber(item, ["score", "value", "rating", "percentage"]);
      const maxScore = firstNumber(item, ["maxScore", "maximum", "max"]);
      const score =
        rawScore !== null && maxScore !== null && maxScore > 0
          ? ratioToPercentage(rawScore, maxScore)
          : toPercentage(rawScore);

      return {
        label: firstText(item, ["label", "name", "dimension", "title"]) ?? humanizeKey(key),
        score,
        detail: firstText(item, ["detail", "description", "rationale", "summary"]),
      };
    })
    .filter((item): item is Dimension => item !== null);
}

function normalizeReferences(value: unknown): string[] {
  const items = Array.isArray(value) ? value : value === undefined ? [] : [value];

  return items
    .map((item) => {
      const direct = textValue(item);
      if (direct) return direct;
      if (!isRecord(item)) return null;

      const article = firstText(item, ["article", "citation", "reference", "id"]);
      const title = firstText(item, ["title", "label", "name"]);
      if (article && title && !title.includes(article)) return `${article} · ${title}`;
      return article ?? title;
    })
    .filter((item): item is string => Boolean(item));
}

function normalizeObligations(value: unknown): Obligation[] {
  const source = normalizeCollection(value, ["items", "obligations", "deadlines"]);
  const entries: Array<[string, unknown]> = source.length
    ? source.map((item, index) => [String(index + 1), item])
    : isRecord(value)
      ? Object.entries(value)
      : [];

  return entries
    .map(([key, item]): Obligation | null => {
      const direct = textValue(item);
      if (direct) {
        return {
          title: humanizeKey(key),
          article: null,
          deadline: direct,
          detail: null,
          status: null,
        };
      }

      if (!isRecord(item)) return null;

      const title = firstText(item, ["title", "name", "label", "obligation", "requirement"]);
      const article = firstText(item, ["article", "citation", "reference"]);
      const deadline = firstText(item, ["deadline", "date", "dueDate", "appliesFrom"]);
      const detail = firstText(item, ["detail", "description", "explanation", "action"]);
      const status = firstText(item, ["status", "state"]);

      if (!title && !article && !deadline && !detail) return null;

      return {
        title: title ?? article ?? humanizeKey(key),
        article,
        deadline,
        detail,
        status,
      };
    })
    .filter((item): item is Obligation => item !== null);
}

function normalizeGaps(value: unknown): Gap[] {
  const items = normalizeCollection(value, ["items", "gaps", "actions"]);

  return items
    .map((item, index): Gap | null => {
      const direct = textValue(item);
      if (direct) {
        return {
          title: direct,
          priority: null,
          article: null,
          detail: null,
          action: null,
        };
      }

      if (!isRecord(item)) return null;

      const title = firstText(item, ["title", "name", "gap", "label"]);
      const action = firstText(item, ["action", "fix", "recommendation", "remediation"]);
      const detail = firstText(item, ["detail", "description", "rationale", "impact"]);

      if (!title && !action && !detail) return null;

      return {
        title: title ?? action ?? `Écart ${index + 1}`,
        priority: gapPriorityLabel(
          firstText(item, ["priority", "level"]),
          firstText(item, ["severity"]),
        ),
        article: firstText(item, ["article", "citation", "reference"]),
        detail,
        action: action && action !== title ? action : null,
      };
    })
    .filter((item): item is Gap => item !== null);
}

function gapPriorityLabel(
  priority: string | null,
  severity: string | null,
): string | null {
  const normalized = (severity ?? priority)?.toLowerCase();
  if (!normalized) return null;

  const labels: Record<string, string> = {
    critical: "Critique",
    major: "Haute",
    moderate: "Moyenne",
    minor: "Faible",
    immediate: "Critique",
    before_next_release: "Haute",
    before_applicable_deadline: "Moyenne",
    strengthen_for_insurance: "Faible",
  };

  return labels[normalized] ?? severity ?? priority;
}

function normalizeDecisions(value: unknown): Decision[] {
  const items = normalizeCollection(value, ["items", "steps", "decisions", "entries"]);

  return items
    .map((item, index): Decision | null => {
      const direct = textValue(item);
      if (direct) {
        return {
          title: `Décision ${index + 1}`,
          score: null,
          rationale: direct,
          decision: null,
        };
      }

      if (!isRecord(item)) return null;

      const title = firstText(item, ["step", "title", "name", "label"]);
      const rationale = firstText(item, ["rationale", "reason", "explanation", "description"]);
      const decision = firstText(item, ["decision", "outcome", "result"]);
      const score = toPercentage(
        firstNumber(item, ["score", "rating", "confidence", "decisionScore"]),
      );

      if (!title && !rationale && !decision && score === null) return null;

      return {
        title: title ?? `Décision ${index + 1}`,
        score,
        rationale,
        decision,
      };
    })
    .filter((item): item is Decision => item !== null);
}

function useCountUp(target: number | null) {
  const [displayValue, setDisplayValue] = useState(target === null ? null : 0);

  useEffect(() => {
    if (target === null) {
      setDisplayValue(null);
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(target);
      return;
    }

    const start = window.performance.now();
    const duration = 850;
    let frame = 0;

    const animate = (time: number) => {
      const progress = Math.min((time - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(target * eased));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);

  return displayValue;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function priorityTone(priority: string | null) {
  const normalized = priority?.toLowerCase() ?? "";
  if (/critique|urgent|haute|high|p0|p1/.test(normalized)) return "is-risk";
  if (/moyenne|medium|modérée|p2/.test(normalized)) return "is-caution";
  return "is-neutral";
}

function scoreTone(score: number | null) {
  if (score === null) return "is-neutral";
  if (score >= 80) return "is-pass";
  if (score >= 55) return "is-caution";
  return "is-risk";
}

function needsJournalDisclaimer(obligation: Obligation) {
  const searchable = [
    obligation.title,
    obligation.article,
    obligation.deadline,
    obligation.detail,
    obligation.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    /annexe iii|annex iii|haut risque autonome|standalone/.test(searchable) &&
    /2027|publication|journal officiel|official journal/.test(searchable)
  );
}

export function AssessmentResults({
  assessment,
  onReset,
  staticPdfHref,
  trackCompletion = true,
}: AssessmentResultsProps) {
  const [pdfStatus, setPdfStatus] = useState<"idle" | "loading" | "error">("idle");
  const [pdfError, setPdfError] = useState<string | null>(null);
  const reportRecord = isRecord(assessment.report) ? assessment.report : null;
  const assessmentId = textValue(assessment.id) ?? firstText(reportRecord, ["assessmentId"]);
  const initialEvidence = useMemo(
    () =>
      normalizeEvidenceLedger(
        firstValue(reportRecord, ["evidence"]) ?? firstValue(assessment, ["evidence"]),
        assessmentId ?? "local-assessment",
      ),
    [assessment, assessmentId, reportRecord],
  );
  const [evidence, setEvidence] = useState<EvidenceLedgerItem[]>(initialEvidence);
  const evidenceWorkbenchRef = useRef<EvidenceWorkbenchHandle>(null);

  const lastLedgerCountsRef = useRef<string | null>(null);
  function handleEvidenceChange(next: EvidenceLedgerItem[]) {
    setEvidence(next);
    const verifiedCount = next.filter((item) => item.status === "verified").length;
    // Les propriétés suivies sont des compteurs : ne tracer que lorsqu'ils
    // changent, pas à chaque frappe dans un champ texte du registre.
    const counts = `${next.length}:${verifiedCount}`;
    if (lastLedgerCountsRef.current === counts) return;
    lastLedgerCountsRef.current = counts;
    trackEvent("evidence_ledger_updated", {
      itemCount: next.length,
      verifiedCount,
    });
  }

  useEffect(() => {
    setEvidence(initialEvidence);
  }, [initialEvidence]);

  const scoreRecord = isRecord(assessment.score) ? assessment.score : null;
  const classificationRecord = isRecord(assessment.classification)
    ? assessment.classification
    : null;

  const score = toPercentage(
    numericValue(assessment.score) ??
      firstNumber(scoreRecord, ["overall", "total", "value", "score"]) ??
      firstNumber(assessment, ["overallScore", "totalScore"]),
  );
  const displayedScore = useCountUp(score);
  const tier =
    firstText(scoreRecord, ["tier", "grade", "letter", "level"]) ??
    firstText(assessment, ["tier", "grade"]);
  const dimensions = useMemo(
    () =>
      normalizeDimensions(
        firstValue(scoreRecord, ["dimensions", "subScores", "breakdown"]) ??
          firstValue(assessment, ["dimensions", "subScores"]),
      ),
    [assessment, scoreRecord],
  );

  const classificationTitle =
    textValue(assessment.classification) ??
    firstText(classificationRecord, [
      "riskTier",
      "category",
      "level",
      "status",
      "label",
      "classification",
    ]) ??
    "Classification non renseignée";
  const classificationSummary = firstText(classificationRecord, [
    "summary",
    "explanation",
    "rationale",
    "reasoning",
  ]);
  const confidence = toPercentage(
    firstNumber(classificationRecord, ["confidence", "confidenceScore"]),
  );

  const trackedAssessmentIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!trackCompletion) return;
    if (!assessmentId || trackedAssessmentIdRef.current === assessmentId) return;
    trackedAssessmentIdRef.current = assessmentId;
    trackEvent("assessment_completed", {
      score,
      tier: tier ?? null,
      confidence,
      evidenceCount: initialEvidence.length,
    });
  }, [trackCompletion, assessmentId, score, tier, confidence, initialEvidence.length]);
  const smcStatus = readableValue(
    firstValue(classificationRecord, [
      "smcEligibility",
      "smcEligible",
      "smeStatus",
      "companyRegime",
    ]),
  );
  const references = normalizeReferences(
    firstValue(classificationRecord, ["applicableArticles", "articles", "citations", "references"]),
  );

  const obligationsSource =
    firstValue(classificationRecord, ["obligations", "deadlines", "requirements"]) ??
    firstValue(assessment, ["obligations", "deadlines"]);
  let obligations = normalizeObligations(obligationsSource);
  if (!obligations.length) {
    const articleSource = firstValue(classificationRecord, ["applicableArticles", "articles"]);
    obligations = normalizeObligations(articleSource).filter(
      (obligation) => obligation.deadline || obligation.detail,
    );
  }

  const gaps = normalizeGaps(assessment.gaps);
  const decisions = normalizeDecisions(
    assessment.decisionLog ?? firstValue(assessment, ["reasoningLog", "reasoningSteps"]),
  );
  const generatedAt = formatDate(
    textValue(assessment.generatedAt) ??
      firstText(assessment, ["createdAt", "completedAt", "timestamp"]),
  );
  const persistence = isRecord(assessment.persistence)
    ? assessment.persistence
    : null;
  const persistenceStatus = textValue(persistence?.status);
  const persistedAssessmentId =
    textValue(persistence?.assessmentId) ?? assessmentId;

  const crossCheck = isRecord(assessment.crossCheck) ? assessment.crossCheck : null;
  const crossCheckStatus = textValue(crossCheck?.status);
  const crossCheckNote = textValue(crossCheck?.noteFr);
  const metadataRecord = isRecord(assessment.metadata) ? assessment.metadata : null;
  const referenceVerifiedAt = textValue(
    metadataRecord?.regulatoryReferenceVerifiedAt,
  );
  const methodVersion = firstText(scoreRecord, ["methodVersion"]);

  const reportSummary =
    textValue(assessment.report) ??
    firstText(reportRecord, ["executiveSummary", "summary", "narrative", "overview"]);
  const evidenceInventory = isRecord(reportRecord?.evidenceInventory)
    ? reportRecord.evidenceInventory
    : null;
  const truncatedEvidenceCount = firstNumber(evidenceInventory, [
    "truncatedItemCount",
  ]);
  const methodology = isRecord(reportRecord?.methodology)
    ? reportRecord.methodology
    : null;
  const resolvedModel = firstText(methodology, ["model"]);

  const facts = isRecord(assessment.facts)
    ? Object.entries(assessment.facts)
        .map(([key, value]) => ({ label: humanizeKey(key), value: readableValue(value) }))
        .filter((item): item is { label: string; value: string } => item.value !== null)
    : [];

  async function downloadPdf() {
    if (!assessmentId || pdfStatus === "loading") return;

    setPdfStatus("loading");
    setPdfError(null);

    try {
      const evidenceSaved = await evidenceWorkbenchRef.current?.save();
      if (evidenceSaved === false) {
        throw new Error("Enregistrez un registre de preuves valide avant de générer le PDF.");
      }
      const pdfPayload =
        reportRecord &&
        (typeof reportRecord.assessmentId === "string" || isRecord(reportRecord.organization))
          ? {
              ...reportRecord,
              evidence: evidence.map(toReportEvidence),
            }
          : assessment;
      let reportRequest: { assessmentId: string } | { localPayload: unknown };
      if (persistenceStatus === "persisted") {
        if (!persistedAssessmentId) {
          throw new Error("La référence du rapport enregistré est absente.");
        }
        reportRequest = { assessmentId: persistedAssessmentId };
      } else {
        reportRequest = { localPayload: pdfPayload };
      }

      const response = await fetch("/api/reports/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/pdf, application/problem+json",
        },
        body: JSON.stringify(reportRequest),
      });

      if (!response.ok) {
        const problem: unknown = await response.json().catch(() => null);
        const message = isRecord(problem)
          ? textValue(problem.detail) ?? textValue(problem.message)
          : null;
        throw new Error(message ?? "Le rapport PDF n’a pas pu être généré.");
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("application/pdf")) {
        throw new Error("Le serveur n’a pas retourné un document PDF valide.");
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const disposition = response.headers.get("content-disposition") ?? "";
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const filename = filenameMatch?.[1] ?? `preuvance-${assessmentId}.pdf`;
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1_000);
      setPdfStatus("idle");
      trackEvent("report_pdf_downloaded", {
        persistenceStatus,
      });
    } catch (downloadError) {
      setPdfStatus("error");
      setPdfError(
        downloadError instanceof Error
          ? downloadError.message
          : "Le téléchargement du rapport a échoué.",
      );
      // D-087 : jamais le message d'erreur, uniquement le statut de persistance.
      trackEvent("report_pdf_failed", {
        persistenceStatus,
      });
    }
  }

  return (
    <section className="pv-results" id="resultats" tabIndex={-1} aria-labelledby="results-title">
      <header className="pv-results-header">
        <div>
          <p className="pv-kicker">Dossier instantané · vivant et traçable</p>
          <h2 id="results-title">Votre dossier de maîtrise IA est prêt</h2>
          <p className="pv-results-meta">
            {generatedAt ? `Générée le ${generatedAt}` : "Évaluation générée"}
            {assessmentId ? ` · Référence ${assessmentId}` : ""}
            {referenceVerifiedAt
              ? ` · Référentiel vérifié le ${referenceVerifiedAt.split("-").reverse().join(".")}`
              : ""}
            {methodVersion ? ` · Méthode ${methodVersion}` : ""}
            {resolvedModel ? ` · Analysé avec ${resolvedModel}` : ""}
          </p>
        </div>
        <div className="pv-results-actions">
          {persistenceStatus === "persisted" && persistedAssessmentId ? (
            <a className="pv-secondary-button" href={`/dossiers/${persistedAssessmentId}`}>
              <FolderOpen size={16} aria-hidden="true" />
              Ouvrir le dossier enregistré
            </a>
          ) : null}
          {staticPdfHref ? (
            <a className="pv-primary-button" href={staticPdfHref} download>
              <Download size={17} aria-hidden="true" />
              Télécharger le dossier d’exemple PDF
            </a>
          ) : assessmentId ? (
            <button
              className="pv-primary-button"
              type="button"
              onClick={downloadPdf}
              disabled={pdfStatus === "loading"}
            >
              <Download size={17} aria-hidden="true" />
              {pdfStatus === "loading" ? "Génération du PDF…" : "Télécharger le rapport PDF"}
            </button>
          ) : null}
          <button className="pv-secondary-button" type="button" onClick={onReset}>
            <RotateCcw size={16} aria-hidden="true" />
            Nouvelle évaluation
          </button>
        </div>
      </header>

      {pdfError ? (
        <div className="pv-pdf-error" role="alert">
          <AlertTriangle size={17} aria-hidden="true" />
          {pdfError}
        </div>
      ) : null}

      {crossCheckNote &&
      (crossCheckStatus === "divergent" || crossCheckStatus === "attention") ? (
        <div
          className={`pv-crosscheck-banner ${crossCheckStatus === "divergent" ? "is-risk" : "is-caution"}`}
          role="status"
        >
          <AlertTriangle size={17} aria-hidden="true" />
          <div>
            <strong>
              {crossCheckStatus === "divergent"
                ? "Contre-vérification déterministe : contradiction détectée"
                : "Contre-vérification déterministe : points à examiner"}
            </strong>
            <p>{crossCheckNote}</p>
          </div>
        </div>
      ) : null}

      <article className={`pv-score-hero ${scoreTone(score)}`}>
        <div className="pv-score-main">
          <div className="pv-score-label">
            <ShieldCheck size={19} aria-hidden="true" />
            Score de préparation à la pré-souscription
          </div>
          <div className="pv-score-readout" aria-label={score === null ? "Score non fourni" : `Score ${score} sur 100`}>
            <strong>{displayedScore ?? "—"}</strong>
            <span>/100</span>
            <em>{tier ? `Tier ${tier}` : "Tier non fourni"}</em>
          </div>
          {reportSummary ? <p className="pv-score-summary">{reportSummary}</p> : null}
        </div>
        <dl className="pv-score-context">
          <div>
            <dt>Classification principale</dt>
            <dd>{classificationTitle}</dd>
          </div>
          {smcStatus ? (
            <div>
              <dt>Régime d’entreprise</dt>
              <dd>{smcStatus}</dd>
            </div>
          ) : null}
          {confidence !== null ? (
            <div>
              <dt>Confiance de classification</dt>
              <dd>{confidence}/100</dd>
            </div>
          ) : null}
        </dl>
      </article>

      <div className="pv-results-grid">
        <article className="pv-report-card" aria-labelledby="dimensions-title">
          <div className="pv-card-heading">
            <span className="pv-card-icon" aria-hidden="true">
              <FileCheck2 size={19} />
            </span>
            <div>
              <p className="pv-section-index">01</p>
              <h3 id="dimensions-title">Dimensions du score</h3>
            </div>
          </div>
          {dimensions.length ? (
            <ul className="pv-dimensions-list">
              {dimensions.map((dimension) => (
                <li key={dimension.label}>
                  <div className="pv-dimension-heading">
                    <span>{dimension.label}</span>
                    <strong>{dimension.score === null ? "—" : `${dimension.score}/100`}</strong>
                  </div>
                  <div
                    className="pv-dimension-track"
                    role="progressbar"
                    aria-label={dimension.label}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={dimension.score ?? undefined}
                  >
                    <span style={{ width: `${dimension.score ?? 0}%` }} />
                  </div>
                  {dimension.detail ? <p>{dimension.detail}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="pv-empty-state">Aucune ventilation du score n’a été retournée.</p>
          )}
        </article>

        <article className="pv-report-card" aria-labelledby="classification-title">
          <div className="pv-card-heading">
            <span className="pv-card-icon" aria-hidden="true">
              <Scale size={19} />
            </span>
            <div>
              <p className="pv-section-index">02</p>
              <h3 id="classification-title">Classification et fondement</h3>
            </div>
          </div>
          <p className="pv-classification-title">{classificationTitle}</p>
          {classificationSummary ? <p className="pv-card-copy">{classificationSummary}</p> : null}
          {references.length ? (
            <div className="pv-reference-list" aria-label="Références réglementaires">
              {references.map((reference) => (
                <span key={reference}>{reference}</span>
              ))}
            </div>
          ) : (
            <p className="pv-empty-state">Aucune référence réglementaire n’a été retournée.</p>
          )}
          {facts.length ? (
            <dl className="pv-facts-list">
              {facts.slice(0, 8).map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </article>
      </div>

      <article className="pv-report-card pv-full-card" aria-labelledby="obligations-title">
        <div className="pv-card-heading pv-card-heading-split">
          <div className="pv-heading-cluster">
            <span className="pv-card-icon" aria-hidden="true">
              <CalendarClock size={19} />
            </span>
            <div>
              <p className="pv-section-index">03</p>
              <h3 id="obligations-title">Obligations et échéances</h3>
            </div>
          </div>
          <span className="pv-count-badge">{obligations.length} identifiée{obligations.length === 1 ? "" : "s"}</span>
        </div>
        {obligations.length ? (
          <div className="pv-obligations-table" role="table" aria-label="Obligations applicables">
            <div className="pv-table-header" role="row">
              <span role="columnheader">Obligation</span>
              <span role="columnheader">Fondement</span>
              <span role="columnheader">Échéance</span>
            </div>
            {obligations.map((obligation, index) => (
              <div className="pv-obligation-row" role="row" key={`${obligation.title}-${index}`}>
                <div role="cell">
                  <strong>{obligation.title}</strong>
                  {obligation.detail ? <p>{obligation.detail}</p> : null}
                </div>
                <div role="cell">
                  {obligation.article ? <span className="pv-reference-chip">{obligation.article}</span> : "—"}
                </div>
                <div role="cell">
                  <strong>{obligation.deadline ?? obligation.status ?? "À confirmer"}</strong>
                  {needsJournalDisclaimer(obligation) ? (
                    <small>Sous réserve de publication formelle au Journal officiel.</small>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="pv-empty-state">Aucune obligation datée n’a été retournée.</p>
        )}
      </article>

      <article className="pv-report-card pv-full-card pv-evidence-dossier" aria-labelledby="evidence-dossier-title">
        <div className="pv-card-heading pv-card-heading-split">
          <div className="pv-heading-cluster">
            <span className="pv-card-icon" aria-hidden="true">
              <FileCheck2 size={19} />
            </span>
            <div>
              <p className="pv-section-index">04</p>
              <h3 id="evidence-dossier-title">Preuve par preuve</h3>
            </div>
          </div>
          <span className="pv-audit-label">Déclaré → détecté → prouvé</span>
        </div>
        <p className="pv-card-copy pv-evidence-intro">
          Chaque pièce attendue conserve sa provenance, son responsable, son empreinte et sa revue humaine. Une simple déclaration ou détection ne devient jamais automatiquement une preuve vérifiée.
        </p>
        {truncatedEvidenceCount && truncatedEvidenceCount > 0 ? (
          <div className="pv-evidence-truncation" role="status">
            <AlertTriangle size={17} aria-hidden="true" />
            {truncatedEvidenceCount} pièce(s) attendue(s) supplémentaire(s) dépassent la capacité de ce dossier. Elles restent signalées et doivent être regroupées ou traitées dans un registre étendu.
          </div>
        ) : null}
        {assessmentId ? (
          <EvidenceWorkbench
            ref={evidenceWorkbenchRef}
            assessmentId={assessmentId}
            evidence={evidence}
            onChange={handleEvidenceChange}
            persistenceStatus={persistenceStatus}
          />
        ) : (
          <p className="pv-empty-state">Le registre ne peut pas être initialisé sans référence d’évaluation.</p>
        )}
      </article>

      <article className="pv-report-card pv-full-card" aria-labelledby="gaps-title">
        <div className="pv-card-heading pv-card-heading-split">
          <div className="pv-heading-cluster">
            <span className="pv-card-icon" aria-hidden="true">
              <ClipboardCheck size={19} />
            </span>
            <div>
              <p className="pv-section-index">05</p>
              <h3 id="gaps-title">Écarts prioritaires</h3>
            </div>
          </div>
          <span className="pv-count-badge">{gaps.length} action{gaps.length === 1 ? "" : "s"}</span>
        </div>
        {gaps.length ? (
          <ol className="pv-gaps-list">
            {gaps.map((gap, index) => (
              <li key={`${gap.title}-${index}`}>
                <span className="pv-gap-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="pv-gap-content">
                  <div className="pv-gap-heading">
                    <h4>{gap.title}</h4>
                    {gap.priority ? (
                      <span className={`pv-priority-badge ${priorityTone(gap.priority)}`}>
                        {gap.priority}
                      </span>
                    ) : null}
                  </div>
                  {gap.detail ? <p>{gap.detail}</p> : null}
                  {gap.action ? (
                    <div className="pv-gap-action">
                      <CheckCircle2 size={16} aria-hidden="true" />
                      <span><strong>Action attendue :</strong> {gap.action}</span>
                    </div>
                  ) : null}
                </div>
                <div className="pv-gap-reference">
                  {gap.article ? <span>{gap.article}</span> : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="pv-empty-state">Aucun écart priorisé n’a été retourné.</p>
        )}
      </article>

      <article className="pv-report-card pv-full-card" aria-labelledby="decision-log-title">
        <div className="pv-card-heading pv-card-heading-split">
          <div className="pv-heading-cluster">
            <span className="pv-card-icon" aria-hidden="true">
              <ShieldCheck size={19} />
            </span>
            <div>
              <p className="pv-section-index">06</p>
              <h3 id="decision-log-title">Journal des décisions</h3>
            </div>
          </div>
          <span className="pv-audit-label">Traçabilité du raisonnement</span>
        </div>
        {decisions.length ? (
          <ol className="pv-decision-list">
            {decisions.map((decision, index) => (
              <li key={`${decision.title}-${index}`}>
                <div className="pv-decision-index">{String(index + 1).padStart(2, "0")}</div>
                <div className="pv-decision-copy">
                  <h4>{decision.title}</h4>
                  {decision.decision ? <strong>{decision.decision}</strong> : null}
                  {decision.rationale ? <p>{decision.rationale}</p> : null}
                </div>
                <div className={`pv-decision-score ${scoreTone(decision.score)}`}>
                  <span>{decision.score ?? "—"}</span>
                  <small>{decision.score === null ? "non noté" : "/100"}</small>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="pv-empty-state">Aucune étape de décision n’a été retournée.</p>
        )}
      </article>

      <details className="pv-raw-json">
        <summary>
          <span>
            <AlertTriangle size={16} aria-hidden="true" />
            Afficher la réponse JSON brute
          </span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div>
          <div className="pv-json-note">
            <span>Donnée technique complète</span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </div>
          <pre>{JSON.stringify(assessment, null, 2)}</pre>
        </div>
      </details>
    </section>
  );
}
