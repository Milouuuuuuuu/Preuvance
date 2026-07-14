import type { ExtractedFacts, ModelClassification } from "./schemas";

export const CROSSCHECK_VERSION = "preuvance-crosscheck-v1";

export type CrossCheckSignal = {
  topic: string;
  origin: "faits_structures" | "analyse_lexicale";
  article: string;
  detail: string;
};

export type CrossCheckStatus = "concordant" | "attention" | "divergent";

export type CrossCheckResult = {
  version: string;
  status: CrossCheckStatus;
  divergences: CrossCheckSignal[];
  alertes: CrossCheckSignal[];
  noteFr: string;
};

type LexicalRule = {
  topic: string;
  article: string;
  all: RegExp[];
  practiceId?: ModelClassification["prohibitedPractices"]["matchedPracticeIds"][number];
  area?: ModelClassification["annexIII"]["matchedAreas"][number];
  kind: "art5" | "annex_iii";
};

/**
 * Analyse lexicale volontairement conservatrice : chaque règle exige des
 * termes explicites dans la description. Elle ne classe jamais seule — elle
 * signale uniquement un point que la classification LLM n’a pas traité.
 */
const LEXICAL_RULES: LexicalRule[] = [
  {
    topic: "Notation sociale",
    article: "Article 5(1)(c)",
    all: [/\b(notation|score|credit|scoring)\s+social/],
    practiceId: "social-scoring",
    kind: "art5",
  },
  {
    topic: "Collecte non ciblée d’images faciales",
    article: "Article 5(1)(e)",
    all: [/(scraping|moissonnage|collecte non ciblee)/, /(visage|facial)/],
    practiceId: "untargeted-facial-scraping",
    kind: "art5",
  },
  {
    topic: "Inférence des émotions au travail ou dans l’enseignement",
    article: "Article 5(1)(f)",
    all: [
      /emotions?.{0,90}(travail|employes?|salaries?|eleves?|etudiants?|scolaire|ecole)|(travail|employes?|salaries?|eleves?|etudiants?|scolaire|ecole).{0,90}emotions?/,
    ],
    practiceId: "work-education-emotion",
    kind: "art5",
  },
  {
    topic: "Police prédictive individuelle",
    article: "Article 5(1)(d)",
    all: [/(recidive|police predictive|predire (un|le) (delit|crime))/],
    practiceId: "criminal-risk-profiling-only",
    kind: "art5",
  },
  {
    topic: "Identification biométrique à distance en temps réel",
    article: "Article 5(1)(h)",
    all: [
      /(identification biometrique|reconnaissance faciale|identification faciale)/,
      /(temps reel|espace public|videosurveillance)/,
    ],
    practiceId: "real-time-remote-biometric-law-enforcement",
    kind: "art5",
  },
  {
    topic: "Recrutement et gestion des travailleurs",
    article: "Annexe III — emploi",
    all: [/(recrutement|tri de cv|candidature|embauche|preselection de candidat|licenciement|promotion interne)/],
    area: "employment_and_workers",
    kind: "annex_iii",
  },
  {
    topic: "Éducation et évaluation des apprenants",
    article: "Annexe III — éducation",
    all: [/(admission|notation d.examen|correction de copies|evaluation des eleves|orientation scolaire)/],
    area: "education_and_vocational_training",
    kind: "annex_iii",
  },
  {
    topic: "Accès au crédit ou aux prestations essentielles",
    article: "Annexe III — services essentiels",
    all: [/(solvabilite|octroi de credit|scoring bancaire|prestation sociale|aide sociale|tarification.{0,40}(vie|sante))/],
    area: "essential_services_and_benefits",
    kind: "annex_iii",
  },
  {
    topic: "Migration, asile et frontières",
    article: "Annexe III — migration",
    all: [/(asile|visa|frontiere|migration)/],
    area: "migration_asylum_and_border_control",
    kind: "annex_iii",
  },
  {
    topic: "Justice et processus démocratiques",
    article: "Annexe III — justice",
    all: [/(decision de justice|juridiction|tribunal|magistrat|election)/],
    area: "justice_and_democratic_processes",
    kind: "annex_iii",
  },
  {
    topic: "Infrastructures critiques",
    article: "Annexe III — infrastructures critiques",
    all: [/(reseau electrique|distribution d.eau|reseau de gaz|trafic routier|infrastructure critique)/],
    area: "critical_infrastructure",
    kind: "annex_iii",
  },
];

const CLEARED_OUTCOMES: ReadonlyArray<
  ModelClassification["prohibitedPractices"]["outcome"]
> = ["does_not_apply"];

export function normalizeForScreening(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function runDeterministicCrossCheck(options: {
  description: string;
  facts: ExtractedFacts;
  classification: ModelClassification;
}): CrossCheckResult {
  const { facts, classification } = options;
  const divergences: CrossCheckSignal[] = [];
  const alertes: CrossCheckSignal[] = [];
  const normalizedDescription = normalizeForScreening(options.description);

  if (
    facts.prohibitedPracticeSignals.length > 0 &&
    CLEARED_OUTCOMES.includes(classification.prohibitedPractices.outcome)
  ) {
    divergences.push({
      topic: "Pratiques interdites",
      origin: "faits_structures",
      article: "Article 5",
      detail: `L’extraction signale ${facts.prohibitedPracticeSignals.join(", ")} mais la classification conclut « non applicable ».`,
    });
  }

  if (
    facts.signedAmendmentProhibitedPracticeSignals.length > 0 &&
    CLEARED_OUTCOMES.includes(
      classification.signedAmendmentProhibitedPractices.outcome,
    )
  ) {
    divergences.push({
      topic: "Nouvelle interdiction (Omnibus signé)",
      origin: "faits_structures",
      article: "Modification signée de l’article 5",
      detail:
        "L’extraction signale un risque de contenus intimes non consentis ou CSAM mais la classification conclut « non applicable ».",
    });
  }

  if (
    facts.usesEmotionRecognition === true &&
    (facts.sector === "employment" || facts.sector === "education") &&
    CLEARED_OUTCOMES.includes(classification.prohibitedPractices.outcome)
  ) {
    divergences.push({
      topic: "Émotions au travail ou dans l’enseignement",
      origin: "faits_structures",
      article: "Article 5(1)(f)",
      detail:
        "Reconnaissance des émotions déclarée dans un contexte emploi/éducation, non reflétée dans la conclusion sur les pratiques interdites.",
    });
  }

  if (
    facts.profilesNaturalPersons === true &&
    classification.annexIII.article6_3Exception === "clearly_available"
  ) {
    divergences.push({
      topic: "Exemption article 6(3) incompatible avec le profilage",
      origin: "faits_structures",
      article: "Article 6(3)",
      detail:
        "Le référentiel exclut l’exemption 6(3) pour un système qui profile des personnes physiques ; la classification la juge pourtant clairement disponible.",
    });
  }

  if (
    facts.usesRemoteBiometricIdentification === true &&
    classification.riskTier === "minimal_risk"
  ) {
    divergences.push({
      topic: "Identification biométrique à distance",
      origin: "faits_structures",
      article: "Article 5(1)(h) / Annexe III — biométrie",
      detail:
        "Identification biométrique à distance déclarée mais classification en risque minimal.",
    });
  }

  if (
    facts.modelType === "general_purpose_model_provider" &&
    CLEARED_OUTCOMES.includes(classification.gpaiProviderObligations.outcome)
  ) {
    divergences.push({
      topic: "Fournisseur de modèle GPAI",
      origin: "faits_structures",
      article: "Articles 51 à 56",
      detail:
        "Le rôle de fournisseur de modèle à usage général est extrait mais les obligations GPAI sont conclues « non applicables ».",
    });
  }

  if (
    facts.trainingComputeAboveGpaiThreshold === true &&
    CLEARED_OUTCOMES.includes(classification.gpaiProviderObligations.outcome)
  ) {
    divergences.push({
      topic: "Seuil de calcul GPAI dépassé",
      origin: "faits_structures",
      article: "Articles 51 et 55",
      detail:
        "Un calcul cumulé d’entraînement supérieur à 10^25 FLOP est déclaré (présomption de risque systémique) mais les obligations GPAI sont conclues « non applicables ».",
    });
  }

  if (
    facts.createsDeepfakes === true &&
    CLEARED_OUTCOMES.includes(classification.article50.outcome)
  ) {
    divergences.push({
      topic: "Deepfakes sans obligation de transparence",
      origin: "faits_structures",
      article: "Article 50(4)",
      detail:
        "La génération de deepfakes est extraite mais l’article 50 est conclu « non applicable ».",
    });
  }

  for (const rule of LEXICAL_RULES) {
    if (!rule.all.every((pattern) => pattern.test(normalizedDescription))) {
      continue;
    }

    if (rule.kind === "art5") {
      const treated =
        !CLEARED_OUTCOMES.includes(classification.prohibitedPractices.outcome) ||
        (rule.practiceId !== undefined &&
          classification.prohibitedPractices.matchedPracticeIds.includes(
            rule.practiceId,
          ));
      if (!treated) {
        alertes.push({
          topic: rule.topic,
          origin: "analyse_lexicale",
          article: rule.article,
          detail: `La description évoque « ${rule.topic.toLowerCase()} » sans que la classification ne traite ce point.`,
        });
      }
    } else {
      const treated =
        classification.riskTier === "high_risk_annex_iii" ||
        !CLEARED_OUTCOMES.includes(classification.annexIII.outcome) ||
        (rule.area !== undefined &&
          classification.annexIII.matchedAreas.includes(rule.area));
      if (!treated) {
        alertes.push({
          topic: rule.topic,
          origin: "analyse_lexicale",
          article: rule.article,
          detail: `La description évoque « ${rule.topic.toLowerCase()} » sans que la qualification annexe III ne traite ce point.`,
        });
      }
    }
  }

  const status: CrossCheckStatus = divergences.length
    ? "divergent"
    : alertes.length
      ? "attention"
      : "concordant";

  return {
    version: CROSSCHECK_VERSION,
    status,
    divergences,
    alertes,
    noteFr: buildNote(status, divergences, alertes),
  };
}

function buildNote(
  status: CrossCheckStatus,
  divergences: CrossCheckSignal[],
  alertes: CrossCheckSignal[],
): string {
  if (status === "concordant") {
    return "Le moteur de règles déterministe (faits structurés et analyse lexicale du référentiel) n’a relevé aucune contradiction avec la classification proposée.";
  }
  if (status === "attention") {
    return `L’analyse lexicale a relevé ${alertes.length} signal(aux) non traité(s) par la classification : ${alertes
      .map((alerte) => `${alerte.topic} (${alerte.article})`)
      .join(" ; ")}. Une revue humaine de ces points est recommandée.`;
  }
  return `La contre-vérification déterministe contredit la classification sur ${divergences.length} point(s) structurant(s) : ${divergences
    .map((divergence) => `${divergence.topic} (${divergence.article})`)
    .join(" ; ")}. Le score est plafonné et une revue humaine est requise.`;
}
