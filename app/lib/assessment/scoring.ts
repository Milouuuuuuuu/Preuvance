import type { CrossCheckResult } from "./rules";
import type {
  GapItemModel,
  ModelClassification,
  ScoreDimensionId,
  ScoreTier,
} from "./schemas";

export const SCORE_METHOD_VERSION = "preuvance-readiness-v1";

export const DIMENSION_WEIGHTS: Record<ScoreDimensionId, number> = {
  governance: 0.18,
  risk_management: 0.2,
  data_and_documentation: 0.16,
  transparency_and_human_oversight: 0.18,
  technical_resilience: 0.13,
  insurance_readiness: 0.15,
};

const DIMENSION_LABELS: Record<ScoreDimensionId, string> = {
  governance: "Gouvernance",
  risk_management: "Gestion des risques",
  data_and_documentation: "Données et documentation",
  transparency_and_human_oversight: "Transparence et supervision humaine",
  technical_resilience: "Robustesse technique",
  insurance_readiness: "Préparation du dossier courtier",
};

const SEVERITY_PENALTY: Record<GapItemModel["severity"], number> = {
  critical: 42,
  major: 26,
  moderate: 14,
  minor: 7,
};

const STATUS_MULTIPLIER: Record<GapItemModel["status"], number> = {
  missing: 1,
  partial: 0.55,
  unverified: 0.35,
};

const PRIORITY_MULTIPLIER: Record<GapItemModel["priority"], number> = {
  immediate: 1.15,
  before_next_release: 1,
  before_applicable_deadline: 0.9,
  strengthen_for_insurance: 0.75,
};

export type DimensionScore = {
  id: ScoreDimensionId;
  label: string;
  score: number;
  weight: number;
  penalty: number;
  detail: string;
};

export type ReadinessScore = {
  overall: number;
  tier: ScoreTier;
  methodVersion: string;
  dimensions: DimensionScore[];
  appliedCaps: Array<{
    cap: number;
    reason: string;
  }>;
  explanation: string;
};

export function computeReadinessScore(
  gaps: readonly GapItemModel[],
  classification: ModelClassification,
  crossCheck?: CrossCheckResult,
): ReadinessScore {
  const dimensions = (Object.keys(DIMENSION_WEIGHTS) as ScoreDimensionId[]).map(
    (dimension): DimensionScore => {
      const relevantGaps = gaps.filter((gap) => gap.dimension === dimension);
      const rawPenalty = relevantGaps.reduce(
        (sum, gap) => sum + rawGapPenalty(gap),
        0,
      );
      const penalty = roundOneDecimal(rawPenalty);
      const score = Math.max(0, Math.round(100 - rawPenalty));
      const detail = relevantGaps.length
        ? `${relevantGaps.length} écart(s) pris en compte, pénalité ${penalty}/100.`
        : "Aucun écart identifié dans cette dimension à partir des éléments fournis.";

      return {
        id: dimension,
        label: DIMENSION_LABELS[dimension],
        score,
        weight: DIMENSION_WEIGHTS[dimension],
        penalty,
        detail,
      };
    },
  );

  const weightedScore = Math.round(
    dimensions.reduce(
      (sum, dimension) => sum + dimension.score * dimension.weight,
      0,
    ),
  );

  const appliedCaps = determineCaps(gaps, classification, crossCheck);
  const overall = appliedCaps.reduce(
    (score, appliedCap) => Math.min(score, appliedCap.cap),
    weightedScore,
  );

  return {
    overall,
    tier: tierForScore(overall),
    methodVersion: SCORE_METHOD_VERSION,
    dimensions,
    appliedCaps,
    explanation:
      "Score déterministe : chaque dimension part de 100, puis les écarts produisent une pénalité selon leur gravité, leur état et leur priorité. La moyenne pondérée peut ensuite être plafonnée par un signal réglementaire critique ou une classification trop incertaine.",
  };
}

export function tierForScore(score: number): ScoreTier {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 45) return "C";
  return "D";
}

/**
 * Formule de pénalité unique : gravité × état × priorité. Toute évolution
 * passe ici et s'applique donc à la fois au score par dimension et au tri
 * des écarts du rapport.
 */
function rawGapPenalty(gap: GapItemModel): number {
  return (
    SEVERITY_PENALTY[gap.severity] *
    STATUS_MULTIPLIER[gap.status] *
    PRIORITY_MULTIPLIER[gap.priority]
  );
}

export function gapPenalty(gap: GapItemModel): number {
  return roundOneDecimal(rawGapPenalty(gap));
}

export function compareGapPriority(a: GapItemModel, b: GapItemModel): number {
  return gapPenalty(b) - gapPenalty(a) || a.title.localeCompare(b.title, "fr");
}

function determineCaps(
  gaps: readonly GapItemModel[],
  classification: ModelClassification,
  crossCheck?: CrossCheckResult,
): ReadinessScore["appliedCaps"] {
  const caps: ReadinessScore["appliedCaps"] = [];
  const prohibited = classification.prohibitedPractices.outcome;

  if (crossCheck?.status === "divergent") {
    caps.push({
      cap: 59,
      reason:
        "La contre-vérification déterministe contredit la classification sur au moins un point structurant ; revue humaine requise.",
    });
  }

  if (prohibited === "applies") {
    caps.push({
      cap: 15,
      reason: "Une pratique interdite par le droit en vigueur est identifiée.",
    });
  } else if (prohibited === "likely_applies") {
    caps.push({
      cap: 30,
      reason: "Une pratique interdite est probablement applicable et exige une revue immédiate.",
    });
  }

  if (classification.riskTier === "undetermined") {
    caps.push({
      cap: 59,
      reason: "La classification réglementaire principale reste indéterminée.",
    });
  }

  if (classification.overallConfidence < 50) {
    caps.push({
      cap: 64,
      reason: "La confiance globale de classification est inférieure à 50/100.",
    });
  }

  if (
    gaps.some(
      (gap) =>
        gap.severity === "critical" &&
        gap.status === "missing" &&
        gap.priority === "immediate",
    )
  ) {
    caps.push({
      cap: 49,
      reason: "Au moins un contrôle critique et immédiat est manquant.",
    });
  }

  return caps;
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}
