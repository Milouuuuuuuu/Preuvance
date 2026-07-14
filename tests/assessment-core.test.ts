import assert from "node:assert/strict";
import test from "node:test";

import { classifyEnterprise } from "../app/lib/assessment/enterprise";
import {
  getDeadline,
  getRegulatoryReference,
  hydrateObligations,
} from "../app/lib/assessment/regulatory";
import { runDeterministicCrossCheck } from "../app/lib/assessment/rules";
import {
  computeReadinessScore,
  DIMENSION_WEIGHTS,
  tierForScore,
} from "../app/lib/assessment/scoring";
import {
  AssessmentRequestSchema,
  type ExtractedFacts,
  type GapItemModel,
  type ModelClassification,
} from "../app/lib/assessment/schemas";
import { buildAssessment } from "../app/lib/assessment/synthesis";
import { validatePreuvanceAssessment } from "../lib/pdf/assessment-payload";

const reference = getRegulatoryReference();

test("la requête exige l’identification réelle du dossier", () => {
  assert.equal(
    AssessmentRequestSchema.safeParse({
      organizationName: "Atelier Horizon",
      systemName: "Assistant clients",
      description:
        "Un assistant répond aux questions des clients à partir de la documentation validée par notre équipe.",
      company: {
        employees: 40,
        annualRevenue: 8_000_000,
        balanceSheetTotal: 5_000_000,
      },
    }).success,
    true,
  );
  assert.equal(
    AssessmentRequestSchema.safeParse({
      description: "x".repeat(80),
      company: { employees: 40, annualRevenue: 1, balanceSheetTotal: 1 },
    }).success,
    false,
  );
});

test("le contrat PDF accepte une classification à confirmer sans faux résultat", () => {
  const validation = validatePreuvanceAssessment({
    assessmentId: "assessment_01",
    generatedAt: "2026-07-13T14:30:00.000Z",
    lastRegulatoryVerification: "2026-07-13",
    organization: { name: "Atelier Horizon", employeeCount: 40 },
    system: {
      name: "Assistant clients",
      description:
        "Un assistant répond aux questions des clients à partir de la documentation validée.",
    },
    result: {
      score: 59,
      tier: "C",
      riskLevel: "undetermined",
      confidence: 0.42,
      executiveSummary: "La qualification reste à confirmer faute d’informations suffisantes.",
    },
    classification: {
      rationale: "Les faits disponibles ne permettent pas encore de trancher.",
      articles: [
        {
          reference: "Article 4",
          finding: "L’obligation de maîtrise de l’IA reste applicable.",
        },
      ],
    },
    dimensions: [
      {
        name: "Gouvernance",
        score: 59,
        finding: "Les preuves déclarées restent à vérifier.",
      },
    ],
    gaps: [],
  });

  assert.equal(validation.success, true);
});

test("la synthèse Art. 50(2) produit directement un rapport PDF valide", () => {
  const classification = baseClassification();
  classification.riskTier = "limited_transparency_risk";
  classification.article50 = {
    outcome: "applies",
    confidence: 91,
    rationale: "Le fournisseur génère du texte destiné à être diffusé au public.",
    evidence: ["Génération de texte déclarée"],
    missingInformation: [],
    applicableParagraphs: ["50(2)"],
  };
  classification.obligationIds = [
    "ai-literacy",
    "art50-2-machine-readable-marking",
  ];
  classification.applicableArticles = [
    {
      article: "Article 50(2)",
      relevance: "Marquage technique du contenu généré.",
      confidence: 91,
    },
  ];

  const gap: GapItemModel = {
    ...baseGap(),
    id: "machine-readable-marking",
    title: "Formaliser le marquage lisible par machine",
    severity: "major",
    priority: "before_applicable_deadline",
    rationale: "Aucune preuve de marquage n’est fournie.",
    action: "Documenter et tester le mécanisme de marquage avant diffusion.",
    referenceIds: ["art50-2-machine-readable-marking"],
  };
  const company = {
    employees: 120,
    annualRevenue: 24_000_000,
    balanceSheetTotal: 18_000_000,
  };
  const enterprise = classifyEnterprise(
    company,
    reference.enterpriseThresholds,
  );
  const description =
    "Le système génère des textes destinés à être publiés après validation par une équipe éditoriale.";
  const crossCheck = runDeterministicCrossCheck({
    description,
    facts: baseFacts(),
    classification,
  });
  const score = computeReadinessScore([gap], classification, crossCheck);
  const assessment = buildAssessment({
    id: "c4029e04-0ecf-4d10-8de1-dd34898d631f",
    generatedAt: "2026-07-13T14:30:00.000Z",
    request: {
      organizationName: "Atelier Horizon",
      systemName: "Générateur éditorial",
      description,
      company,
    },
    facts: baseFacts(),
    modelClassification: classification,
    enterprise,
    gapAnalysis: {
      summary: "Le mécanisme de marquage reste à prouver.",
      gaps: [gap],
      demonstratedStrengths: ["Validation humaine déclarée"],
      insuranceConcerns: ["Traçabilité technique non démontrée"],
    },
    score,
    crossCheck,
    trace: [],
    models: { reasoning: "gpt-5.6-sol", ancillary: "gpt-5.6-luna" },
    reference,
  });
  const validation = validatePreuvanceAssessment(assessment.report);

  assert.equal(validation.success, true);
  if (validation.success) {
    assert.match(validation.data.gaps[0]?.dueDate ?? "", /2 décembre 2026/);
  }
});

test("un cross-check divergent est propagé jusqu’au contrat PDF", () => {
  const classification = baseClassification();
  const facts = baseFacts();
  facts.prohibitedPracticeSignals = ["social-scoring"];
  const description =
    "Le système attribue une note de comportement global aux usagers pour moduler leur accès aux services.";
  const crossCheck = runDeterministicCrossCheck({
    description,
    facts,
    classification,
  });
  assert.equal(crossCheck.status, "divergent");

  const company = {
    employees: 120,
    annualRevenue: 24_000_000,
    balanceSheetTotal: 18_000_000,
  };
  const enterprise = classifyEnterprise(company, reference.enterpriseThresholds);
  const score = computeReadinessScore([], classification, crossCheck);
  const assessment = buildAssessment({
    id: "c4029e04-0ecf-4d10-8de1-dd34898d631e",
    generatedAt: "2026-07-13T14:30:00.000Z",
    request: {
      organizationName: "Atelier Horizon",
      systemName: "Notation clients",
      description,
      company,
    },
    facts,
    modelClassification: classification,
    enterprise,
    gapAnalysis: {
      summary: "Écarts à instruire après revue humaine.",
      gaps: [],
      demonstratedStrengths: [],
      insuranceConcerns: [],
    },
    score,
    crossCheck,
    trace: [],
    models: { reasoning: "gpt-5.6-sol", ancillary: "gpt-5.6-luna" },
    reference,
  });

  const validation = validatePreuvanceAssessment(assessment.report);
  assert.equal(validation.success, true);
  if (validation.success) {
    assert.equal(validation.data.crossCheck?.status, "divergent");
    assert.ok(
      validation.data.result.appliedCaps?.some(
        (appliedCap) =>
          appliedCap.cap === 59 && /contre-vérification/i.test(appliedCap.reason),
      ),
    );
    assert.ok(
      validation.data.decisionLog?.some(
        (entry) => entry.title === "Contre-vérification déterministe",
      ),
    );
    assert.match(validation.data.result.executiveSummary, /contre-vérification/i);
    assert.ok(validation.data.result.score <= 59);
  }
});

test("le référentiel sépare droit publié et Omnibus signé", () => {
  assert.equal(reference.metadata.verifiedAt, "2026-07-13");
  assert.equal(
    reference.legalLayers[1]?.status,
    "signed_pending_official_journal",
  );
  assert.equal(reference.legalLayers[1]?.signedAt, "2026-07-08");

  const annexI = getDeadline("high-risk-annex-i");
  assert.equal(annexI.bindingPosition.date, "2027-08-02");
  assert.equal(annexI.signedAmendmentPosition?.date, "2028-08-02");

  const annexIII = getDeadline("high-risk-annex-iii");
  assert.equal(annexIII.bindingPosition.date, "2026-08-02");
  assert.equal(annexIII.signedAmendmentPosition?.date, "2027-12-02");
});

test("la nuance de l’article 50 ne reporte que le marquage technique", () => {
  assert.equal(
    getDeadline("art50-2-machine-readable-marking").signedAmendmentPosition
      ?.date,
    "2026-12-02",
  );
  assert.equal(
    getDeadline("art50-1-human-interaction-disclosure")
      .signedAmendmentPosition,
    null,
  );
  assert.equal(
    getDeadline("art50-3-emotion-biometric-notice")
      .signedAmendmentPosition,
    null,
  );
  assert.equal(
    getDeadline("art50-4-deepfake-disclosure").signedAmendmentPosition,
    null,
  );
});

test("les obligations hydratées montrent les deux couches juridiques", () => {
  const [obligation] = hydrateObligations(["high-risk-annex-iii"]);
  assert.ok(obligation);
  assert.match(obligation.deadline, /Droit publié/);
  assert.match(obligation.deadline, /Omnibus signé/);
  assert.equal(
    obligation.signedAmendmentDeadline?.legalStatus,
    "signed_pending_official_journal",
  );
});

test("la préqualification PME applique effectif ET chiffre d’affaires OU bilan", () => {
  const medium = classifyEnterprise(
    { employees: 120, annualRevenue: 24_000_000, balanceSheetTotal: 18_000_000 },
    reference.enterpriseThresholds,
  );
  assert.equal(medium.category, "medium");
  assert.equal(medium.isSme, true);

  const mediumByRevenueOnly = classifyEnterprise(
    {
      employees: 249,
      annualRevenue: 49_000_000,
      balanceSheetTotal: 100_000_000,
    },
    reference.enterpriseThresholds,
  );
  assert.equal(mediumByRevenueOnly.category, "medium");
  assert.equal(mediumByRevenueOnly.financialTest, "revenue");
});

test("la SMC exige de ne pas être PME et accepte le plafond de bilan alternatif", () => {
  const smc = classifyEnterprise(
    {
      employees: 500,
      annualRevenue: 200_000_000,
      balanceSheetTotal: 100_000_000,
    },
    reference.enterpriseThresholds,
  );
  assert.equal(smc.category, "small_mid_cap");
  assert.equal(smc.isSme, false);
  assert.equal(smc.financialTest, "balance_sheet");
  assert.equal(
    smc.aiActSmcRelief.legalStatus,
    "signed_pending_official_journal",
  );

  const exactEmployeeCeiling = classifyEnterprise(
    {
      employees: 750,
      annualRevenue: 100_000_000,
      balanceSheetTotal: 100_000_000,
    },
    reference.enterpriseThresholds,
  );
  assert.equal(exactEmployeeCeiling.category, "large");
});

test("les poids du score totalisent exactement 100 %", () => {
  const total = Object.values(DIMENSION_WEIGHTS).reduce(
    (sum, weight) => sum + weight,
    0,
  );
  assert.ok(Math.abs(total - 1) < Number.EPSILON * 10);
});

test("les seuils de tier sont déterministes", () => {
  assert.equal(tierForScore(90), "A+");
  assert.equal(tierForScore(89), "A");
  assert.equal(tierForScore(80), "A");
  assert.equal(tierForScore(79), "B");
  assert.equal(tierForScore(65), "B");
  assert.equal(tierForScore(64), "C");
  assert.equal(tierForScore(45), "C");
  assert.equal(tierForScore(44), "D");
});

test("une pratique interdite applicable plafonne le score à 15", () => {
  const classification = baseClassification();
  classification.prohibitedPractices.outcome = "applies";
  classification.riskTier = "prohibited";

  const score = computeReadinessScore([], classification);
  assert.equal(score.overall, 15);
  assert.equal(score.tier, "D");
  assert.equal(score.appliedCaps[0]?.cap, 15);
});

test("un contrôle critique manquant et immédiat plafonne le score à 49", () => {
  const gap = baseGap();
  const score = computeReadinessScore([gap], baseClassification());
  assert.equal(score.overall, 49);
  assert.equal(score.tier, "C");
  assert.ok(score.appliedCaps.some((cap) => cap.cap === 49));
});

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
    signedAmendmentProhibitedPractices: {
      ...decision,
      matchedPracticeIds: [],
    },
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

function baseGap(): GapItemModel {
  return {
    id: "critical-control",
    title: "Contrôle critique absent",
    priority: "immediate",
    severity: "critical",
    dimension: "governance",
    status: "missing",
    currentEvidence: null,
    rationale: "Le contrôle est explicitement absent.",
    action: "Mettre en place et documenter le contrôle.",
    evidenceNeeded: ["Politique approuvée"],
    referenceIds: ["art5-prohibited-practices"],
    implementationEffort: "medium",
  };
}

function baseFacts(): ExtractedFacts {
  return {
    systemName: "Générateur éditorial",
    intendedPurpose: "Produire des brouillons de contenus éditoriaux.",
    sector: "media_creative",
    actorRole: "provider_and_deployer",
    affectedPeople: ["Lecteurs"],
    targetUsers: ["Équipe éditoriale"],
    decisions: ["Proposer un brouillon"],
    outputs: ["Texte"],
    modelType: "third_party_general_purpose_model",
    trainingComputeAboveGpaiThreshold: null,
    deploymentContext: "Application interne avec publication après validation.",
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
    existingControls: ["Validation humaine avant publication"],
    prohibitedPracticeSignals: [],
    signedAmendmentProhibitedPracticeSignals: [],
    missingInformation: [],
  };
}
