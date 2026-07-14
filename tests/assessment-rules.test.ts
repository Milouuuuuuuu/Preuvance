import assert from "node:assert/strict";
import test from "node:test";

import {
  CROSSCHECK_VERSION,
  normalizeForScreening,
  runDeterministicCrossCheck,
} from "../app/lib/assessment/rules";
import { computeReadinessScore } from "../app/lib/assessment/scoring";
import type {
  ExtractedFacts,
  ModelClassification,
} from "../app/lib/assessment/schemas";

function baseClassification(): ModelClassification {
  const decision = {
    outcome: "does_not_apply" as const,
    confidence: 90,
    rationale: "Aucun signal dans les faits fournis.",
    evidence: [],
    missingInformation: [],
  };
  return {
    riskTier: "minimal_risk",
    summary: "Risque minimal selon les faits fournis.",
    prohibitedPractices: { ...decision, matchedPracticeIds: [] },
    signedAmendmentProhibitedPractices: { ...decision, matchedPracticeIds: [] },
    annexIII: {
      ...decision,
      matchedAreas: [],
      article6_3Exception: "not_available",
    },
    annexI: {
      ...decision,
      regulatedProductFamily: null,
      bothArticle6_1ConditionsMet: "no",
    },
    article50: { ...decision, applicableParagraphs: [] },
    gpaiProviderObligations: { ...decision },
    obligationIds: ["ai-literacy"],
    applicableArticles: [],
    overallConfidence: 90,
    missingInformation: [],
  };
}

function baseFacts(): ExtractedFacts {
  return {
    systemName: "Assistant interne",
    intendedPurpose: "Aider une équipe métier.",
    sector: "general_business",
    actorRole: "deployer",
    affectedPeople: [],
    targetUsers: ["Équipe interne"],
    decisions: [],
    outputs: ["Texte"],
    modelType: "third_party_general_purpose_model",
    trainingComputeAboveGpaiThreshold: null,
    deploymentContext: "Outil interne.",
    directlyInteractsWithPeople: false,
    generatesText: true,
    generatesImages: false,
    generatesAudio: false,
    generatesVideo: false,
    createsDeepfakes: false,
    publishesPublicInterestText: false,
    usesEmotionRecognition: false,
    usesBiometricCategorisation: false,
    usesRemoteBiometricIdentification: false,
    profilesNaturalPersons: false,
    materiallyInfluencesDecisionsAboutPeople: false,
    isSafetyComponentOfRegulatedProduct: false,
    regulatedProductRequiresThirdPartyConformityAssessment: false,
    existingControls: [],
    prohibitedPracticeSignals: [],
    signedAmendmentProhibitedPracticeSignals: [],
    missingInformation: [],
  };
}

test("la normalisation retire les accents pour l’analyse lexicale", () => {
  assert.equal(
    normalizeForScreening("Présélection des CANDIDATS à l’embauche"),
    "preselection des candidats a l’embauche",
  );
});

test("une description neutre reste concordante", () => {
  const result = runDeterministicCrossCheck({
    description:
      "Un assistant répond aux questions internes à partir de la documentation validée par notre équipe support.",
    facts: baseFacts(),
    classification: baseClassification(),
  });

  assert.equal(result.version, CROSSCHECK_VERSION);
  assert.equal(result.status, "concordant");
  assert.equal(result.divergences.length, 0);
  assert.equal(result.alertes.length, 0);
});

test("un signal art. 5 extrait mais ignoré par la classification est une divergence qui plafonne le score", () => {
  const facts = baseFacts();
  facts.prohibitedPracticeSignals = ["social-scoring"];

  const result = runDeterministicCrossCheck({
    description:
      "Le système attribue une note de comportement global aux usagers pour moduler leur accès aux services.",
    facts,
    classification: baseClassification(),
  });

  assert.equal(result.status, "divergent");
  assert.ok(result.divergences.some((item) => item.article === "Article 5"));

  const score = computeReadinessScore([], baseClassification(), result);
  assert.ok(score.overall <= 59);
  assert.ok(score.appliedCaps.some((cap) => cap.cap === 59));
});

test("des mots-clés annexe III non traités déclenchent une alerte sans plafonner", () => {
  const result = runDeterministicCrossCheck({
    description:
      "Notre outil effectue un tri de CV et une présélection de candidats avant l’entretien d’embauche.",
    facts: baseFacts(),
    classification: baseClassification(),
  });

  assert.equal(result.status, "attention");
  assert.ok(
    result.alertes.some((item) => item.article.includes("Annexe III")),
  );

  const score = computeReadinessScore([], baseClassification(), result);
  assert.ok(!score.appliedCaps.some((cap) => cap.cap === 59));
});

test("les mots-clés annexe III déjà traités par la classification ne déclenchent rien", () => {
  const classification = baseClassification();
  classification.riskTier = "high_risk_annex_iii";
  classification.annexIII.outcome = "applies";
  classification.annexIII.matchedAreas = ["employment_and_workers"];

  const result = runDeterministicCrossCheck({
    description:
      "Notre outil effectue un tri de CV et une présélection de candidats avant l’entretien d’embauche.",
    facts: baseFacts(),
    classification,
  });

  assert.equal(result.status, "concordant");
});

test("le profilage interdit l’exemption 6(3) jugée clairement disponible", () => {
  const facts = baseFacts();
  facts.profilesNaturalPersons = true;
  const classification = baseClassification();
  classification.annexIII.article6_3Exception = "clearly_available";

  const result = runDeterministicCrossCheck({
    description: "Le système établit des profils individuels des clients.",
    facts,
    classification,
  });

  assert.equal(result.status, "divergent");
  assert.ok(
    result.divergences.some((item) => item.article === "Article 6(3)"),
  );
});

test("un fournisseur GPAI extrait sans obligations GPAI conclues est une divergence", () => {
  const facts = baseFacts();
  facts.modelType = "general_purpose_model_provider";

  const result = runDeterministicCrossCheck({
    description:
      "Nous entraînons notre propre modèle de fondation et le proposons par API à des clients.",
    facts,
    classification: baseClassification(),
  });

  assert.equal(result.status, "divergent");
  assert.ok(
    result.divergences.some((item) => item.article === "Articles 51 à 56"),
  );
});

test("un calcul d’entraînement au-delà de 10^25 FLOP sans obligations GPAI est une divergence", () => {
  const facts = baseFacts();
  facts.trainingComputeAboveGpaiThreshold = true;

  const result = runDeterministicCrossCheck({
    description:
      "Nous avons entraîné notre modèle avec un calcul cumulé dépassant 10^25 FLOP.",
    facts,
    classification: baseClassification(),
  });

  assert.equal(result.status, "divergent");
  assert.ok(
    result.divergences.some((item) => item.article === "Articles 51 et 55"),
  );
});

test("un seuil GPAI explicitement déclaré sous 10^25 FLOP ne crée pas de divergence", () => {
  const facts = baseFacts();
  facts.trainingComputeAboveGpaiThreshold = false;

  const result = runDeterministicCrossCheck({
    description:
      "Nous affinons un petit modèle spécialisé, très loin du seuil de 10^25 FLOP.",
    facts,
    classification: baseClassification(),
  });

  assert.equal(result.status, "concordant");
});

test("un tableau de bord « temps réel » sans biométrie ne déclenche aucune alerte", () => {
  const result = runDeterministicCrossCheck({
    description:
      "Un tableau de bord affiche en temps réel les indicateurs de ventes par région pour les responsables commerciaux.",
    facts: baseFacts(),
    classification: baseClassification(),
  });

  assert.equal(result.status, "concordant");
});

test("une « classe » de produit hors contexte scolaire ne déclenche aucune alerte", () => {
  const result = runDeterministicCrossCheck({
    description:
      "L’outil regroupe les articles du catalogue par classe de produit et anticipe la demande logistique.",
    facts: baseFacts(),
    classification: baseClassification(),
  });

  assert.equal(result.status, "concordant");
});

test("un « examen » trimestriel financier ne déclenche aucune alerte", () => {
  const result = runDeterministicCrossCheck({
    description:
      "Le système prépare l’examen trimestriel des résultats financiers présenté au comité de direction.",
    facts: baseFacts(),
    classification: baseClassification(),
  });

  assert.equal(result.status, "concordant");
});

test("la reconnaissance des émotions au travail non traitée est une divergence art. 5(1)(f)", () => {
  const facts = baseFacts();
  facts.usesEmotionRecognition = true;
  facts.sector = "employment";

  const result = runDeterministicCrossCheck({
    description:
      "Le système analyse les émotions des salariés pendant leurs appels pour évaluer leur engagement au travail.",
    facts,
    classification: baseClassification(),
  });

  assert.equal(result.status, "divergent");
  assert.ok(
    result.divergences.some((item) => item.article === "Article 5(1)(f)"),
  );
});
