import type { EnterpriseAssessment } from "./enterprise";
import type { PipelineTraceEntry } from "./logger";
import {
  hydrateObligations,
  type HydratedObligation,
  type RegulatoryReference,
} from "./regulatory";
import type { CrossCheckResult } from "./rules";
import { compareGapPriority, type ReadinessScore } from "./scoring";
import type {
  AssessmentRequest,
  ExtractedFacts,
  GapAnalysisModel,
  GapItemModel,
  ModelClassification,
} from "./schemas";
import type { AssessmentModels } from "./config";
import type {
  EvidenceStatus,
  GapPriority,
  PreuvanceAssessment,
  RiskLevel,
} from "@/lib/pdf/assessment-payload";

const RISK_LABELS: Record<ModelClassification["riskTier"], string> = {
  prohibited: "Pratique interdite ou très probablement interdite",
  high_risk_annex_iii: "Système à haut risque — annexe III",
  high_risk_annex_i: "Système à haut risque — annexe I / produit réglementé",
  limited_transparency_risk: "Risque limité — obligations de transparence",
  minimal_risk: "Risque minimal selon les faits disponibles",
  undetermined: "Classification à confirmer",
};

const OUTCOME_LABELS: Record<
  ModelClassification["article50"]["outcome"],
  string
> = {
  applies: "Applicable",
  likely_applies: "Probablement applicable",
  does_not_apply: "Non applicable selon les faits disponibles",
  insufficient_information: "Informations insuffisantes",
};

export type HydratedGap = GapItemModel & {
  article: string | null;
  deadline: string | null;
  references: HydratedObligation[];
};

export function buildAssessment(options: {
  id: string;
  generatedAt: string;
  request: AssessmentRequest;
  facts: ExtractedFacts;
  modelClassification: ModelClassification;
  enterprise: EnterpriseAssessment;
  gapAnalysis: GapAnalysisModel;
  score: ReadinessScore;
  crossCheck: CrossCheckResult;
  trace: PipelineTraceEntry[];
  models: AssessmentModels;
  reference: RegulatoryReference;
}) {
  const obligations = hydrateObligations(options.modelClassification.obligationIds);
  const gaps = options.gapAnalysis.gaps
    .map(hydrateGap)
    .sort(compareGapPriority);
  const riskLabel = RISK_LABELS[options.modelClassification.riskTier];
  const decisionLog = buildDecisionLog(
    options.modelClassification,
    options.enterprise,
    options.crossCheck,
  );
  const executiveSummary = `${buildExecutiveSummary(
    options.score,
    riskLabel,
    gaps.length,
  )} ${buildInsuranceNarrative(
    options.score,
    options.enterprise,
    options.gapAnalysis,
  )}`.slice(0, 1_600);
  const report: PreuvanceAssessment = {
    assessmentId: options.id,
    generatedAt: options.generatedAt,
    lastRegulatoryVerification: options.reference.metadata.verifiedAt,
    organization: {
      name: options.request.organizationName,
      employeeCount: options.request.company.employees,
      annualRevenueEur: options.request.company.annualRevenue,
      balanceSheetTotalEur: options.request.company.balanceSheetTotal,
      smcEligible: options.enterprise.isSmallMidCap,
    },
    system: {
      name: options.request.systemName,
      description: options.request.description,
      sector: options.facts.sector,
      intendedUse: options.facts.intendedPurpose,
      affectedPeople: options.facts.affectedPeople.length
        ? options.facts.affectedPeople.join(" · ").slice(0, 1_000)
        : undefined,
      operatorRole: options.facts.actorRole,
    },
    result: {
      score: options.score.overall,
      tier: options.score.tier,
      riskLevel: reportRiskLevel(options.modelClassification.riskTier),
      confidence: options.modelClassification.overallConfidence / 100,
      executiveSummary,
      appliedCaps: options.score.appliedCaps.slice(0, 8).map((appliedCap) => ({
        cap: appliedCap.cap,
        reason: appliedCap.reason.slice(0, 300),
      })),
    },
    crossCheck: {
      status: options.crossCheck.status,
      version: options.crossCheck.version,
      note: options.crossCheck.noteFr.slice(0, 1_200),
    },
    decisionLog: decisionLog.slice(0, 12).map((entry) => ({
      title: entry.title.slice(0, 160),
      decision: entry.decision.slice(0, 300),
      score: entry.score,
      rationale: entry.rationale.slice(0, 2_000),
    })),
    classification: {
      rationale: options.modelClassification.summary,
      articles: obligations.map((obligation) => ({
        reference: obligation.article,
        title: obligation.title,
        finding: obligation.detail,
        deadline: obligation.deadline,
        deadlineStatus:
          obligation.signedAmendmentDeadline
            ? "Omnibus signé, publication au JOUE en attente"
            : obligation.status === "active"
              ? "Droit publié — actif"
              : "Droit publié — échéance programmée",
      })),
    },
    dimensions: options.score.dimensions.map((dimension) => ({
      name: dimension.label,
      score: dimension.score,
      finding: dimension.detail,
    })),
    // Le schéma amont borne déjà gaps à 18 ; la borne du contrat PDF (25) est
    // réappliquée ici pour ne pas dépendre d'un plafond maintenu ailleurs.
    gaps: gaps.slice(0, 25).map((gap) => ({
      priority: reportGapPriority(gap.severity),
      title: gap.title,
      finding: gap.rationale,
      recommendedAction: gap.action,
      articleReferences: [
        ...new Set(gap.references.flatMap((reference) => reference.articles)),
      ].slice(0, 12),
      dueDate: gap.deadline?.slice(0, 500) ?? undefined,
    })),
    evidence: buildReportEvidence(options.facts, gaps),
    methodology: {
      model: options.models.reasoning,
      version: options.score.methodVersion,
    },
  };

  return {
    id: options.id,
    generatedAt: options.generatedAt,
    status: "completed" as const,
    product: "PREUVANCE" as const,
    input: options.request,
    facts: options.facts,
    classification: {
      ...options.modelClassification,
      riskCode: options.modelClassification.riskTier,
      riskTier: riskLabel,
      category: riskLabel,
      confidence: options.modelClassification.overallConfidence,
      companyRegime: options.enterprise.label,
      smcEligibility: {
        label: options.enterprise.label,
        eligible: options.enterprise.isSmallMidCap,
        legalStatus: options.enterprise.aiActSmcRelief.legalStatus,
        detail: options.enterprise.aiActSmcRelief.display,
        rationale: options.enterprise.rationale,
      },
      enterprise: options.enterprise,
      obligations,
    },
    gaps,
    gapAnalysis: {
      summary: options.gapAnalysis.summary,
      demonstratedStrengths: options.gapAnalysis.demonstratedStrengths,
      insuranceConcerns: options.gapAnalysis.insuranceConcerns,
    },
    score: options.score,
    crossCheck: options.crossCheck,
    decisionLog,
    trace: options.trace,
    report,
    metadata: {
      regulatoryReferenceVerifiedAt: options.reference.metadata.verifiedAt,
      crossCheckVersion: options.crossCheck.version,
      models: options.models,
      llmCalls: 3,
      synthesis: "deterministic" as const,
      responseStorageRequested: false,
    },
  };
}

function reportRiskLevel(
  riskTier: ModelClassification["riskTier"],
): RiskLevel {
  if (riskTier === "prohibited") return "prohibited";
  if (riskTier === "high_risk_annex_i" || riskTier === "high_risk_annex_iii") {
    return "high";
  }
  if (riskTier === "limited_transparency_risk") return "limited";
  if (riskTier === "undetermined") return "undetermined";
  return "minimal";
}

const GAP_PRIORITY_BY_SEVERITY: Record<GapItemModel["severity"], GapPriority> = {
  critical: "critical",
  major: "high",
  moderate: "medium",
  minor: "low",
};

function reportGapPriority(severity: GapItemModel["severity"]): GapPriority {
  return GAP_PRIORITY_BY_SEVERITY[severity];
}

function buildReportEvidence(
  facts: ExtractedFacts,
  gaps: readonly HydratedGap[],
): PreuvanceAssessment["evidence"] {
  const declared = facts.existingControls.map((control) => ({
    control,
    // « déclaré, non vérifié » : un contrôle mentionné dans la description
    // n'est jamais présenté comme documenté tant qu'aucune pièce n'est fournie.
    status: "declared" as EvidenceStatus,
    detail: "Contrôle déclaré dans la description ; aucune pièce justificative vérifiée.",
  }));
  const findings = gaps.map((gap) => ({
    control: gap.title,
    status: gap.status satisfies EvidenceStatus,
    detail:
      gap.currentEvidence ??
      "Aucune preuve exploitable n’a été décrite pour ce contrôle.",
  }));

  return [...declared, ...findings].slice(0, 30);
}

function hydrateGap(gap: GapItemModel): HydratedGap {
  const references = hydrateObligations(gap.referenceIds);
  return {
    ...gap,
    article: references.length
      ? [...new Set(references.flatMap((reference) => reference.articles))].join(
          " · ",
        )
      : null,
    deadline: references.length
      ? references.map((reference) => reference.deadline).join(" | ")
      : null,
    references,
  };
}

const CROSSCHECK_DECISION_LABELS: Record<CrossCheckResult["status"], string> = {
  concordant: "Concordante avec la classification",
  attention: "Signaux lexicaux à examiner",
  divergent: "Contradiction détectée — revue humaine requise",
};

const CROSSCHECK_DECISION_SCORES: Record<CrossCheckResult["status"], number> = {
  concordant: 95,
  attention: 60,
  divergent: 20,
};

function buildDecisionLog(
  classification: ModelClassification,
  enterprise: EnterpriseAssessment,
  crossCheck: CrossCheckResult,
) {
  return [
    {
      step: "Pratiques interdites — droit publié",
      title: "Pratiques interdites — droit publié",
      decision: OUTCOME_LABELS[classification.prohibitedPractices.outcome],
      score: classification.prohibitedPractices.confidence,
      rationale: classification.prohibitedPractices.rationale,
    },
    {
      step: "Nouvelle interdiction — Omnibus signé",
      title: "Nouvelle interdiction — Omnibus signé",
      decision: `${OUTCOME_LABELS[classification.signedAmendmentProhibitedPractices.outcome]} · JOUE en attente`,
      score: classification.signedAmendmentProhibitedPractices.confidence,
      rationale: classification.signedAmendmentProhibitedPractices.rationale,
    },
    {
      step: "Qualification annexe III",
      title: "Qualification annexe III",
      decision: OUTCOME_LABELS[classification.annexIII.outcome],
      score: classification.annexIII.confidence,
      rationale: classification.annexIII.rationale,
    },
    {
      step: "Qualification annexe I",
      title: "Qualification annexe I",
      decision: OUTCOME_LABELS[classification.annexI.outcome],
      score: classification.annexI.confidence,
      rationale: classification.annexI.rationale,
    },
    {
      step: "Transparence — article 50",
      title: "Transparence — article 50",
      decision: OUTCOME_LABELS[classification.article50.outcome],
      score: classification.article50.confidence,
      rationale: classification.article50.rationale,
    },
    {
      step: "Obligations fournisseur GPAI",
      title: "Obligations fournisseur GPAI",
      decision: OUTCOME_LABELS[classification.gpaiProviderObligations.outcome],
      score: classification.gpaiProviderObligations.confidence,
      rationale: classification.gpaiProviderObligations.rationale,
    },
    {
      step: "Statut d’entreprise",
      title: "Statut d’entreprise",
      decision: enterprise.label,
      score: 80,
      rationale: `${enterprise.rationale} Préqualification arithmétique sur les chiffres déclarés ; ${enterprise.aggregationWarning}`,
    },
    {
      step: "Contre-vérification déterministe",
      title: "Contre-vérification déterministe",
      decision: CROSSCHECK_DECISION_LABELS[crossCheck.status],
      score: CROSSCHECK_DECISION_SCORES[crossCheck.status],
      rationale: crossCheck.noteFr,
    },
  ];
}

function buildExecutiveSummary(
  score: ReadinessScore,
  riskLabel: string,
  gapCount: number,
): string {
  const capNotice = score.appliedCaps.length
    ? ` Plafond(s) prudentiel(s) appliqué(s) : ${score.appliedCaps
        .map((appliedCap) => `${appliedCap.cap}/100 — ${appliedCap.reason}`)
        .join(" · ")}`
    : "";
  return `PREUVANCE attribue un score de ${score.overall}/100 (tier ${score.tier}). Préqualification principale : ${riskLabel}. ${gapCount} écart(s) ont été priorisés.${capNotice}`.slice(0, 1_100);
}

function buildInsuranceNarrative(
  score: ReadinessScore,
  enterprise: EnterpriseAssessment,
  gapAnalysis: GapAnalysisModel,
): string {
  const posture =
    score.overall >= 80
      ? "Le dossier est structuré pour soutenir une première discussion de pré-souscription, sous réserve de vérification documentaire."
      : score.overall >= 65
        ? "Le dossier peut soutenir une première discussion de pré-souscription après consolidation des preuves et mesures complémentaires."
        : "Le dossier nécessite une remédiation prioritaire avant sa présentation à un courtier ou à un assureur.";
  const concern = gapAnalysis.insuranceConcerns[0]
    ? ` Point de vigilance principal : ${gapAnalysis.insuranceConcerns[0]}`
    : "";
  return `${posture} Régime préqualifié : ${enterprise.label}.${concern}`;
}
