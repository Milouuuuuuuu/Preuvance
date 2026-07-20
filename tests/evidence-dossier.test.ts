import assert from "node:assert/strict";
import test from "node:test";

import type {
  AssessmentRequest,
  ExtractedFacts,
} from "../app/lib/assessment/schemas";
import {
  buildReportEvidence,
  type HydratedGap,
} from "../app/lib/assessment/synthesis";

const request: AssessmentRequest = {
  organizationName: "Atelier Horizon",
  systemName: "Assistant clients",
  description:
    "Un assistant répond aux questions à partir de contenus internes validés par une équipe humaine.",
  company: {
    employees: 40,
    annualRevenue: 8_000_000,
    balanceSheetTotal: 5_000_000,
  },
};

const facts: ExtractedFacts = {
  systemName: "Assistant clients",
  intendedPurpose: "Répondre aux questions des clients.",
  sector: "general_business",
  actorRole: "deployer",
  affectedPeople: ["Clients"],
  targetUsers: ["Support"],
  decisions: [],
  outputs: ["Réponses textuelles"],
  modelType: "third_party_general_purpose_model",
  trainingComputeAboveGpaiThreshold: null,
  deploymentContext: "Application web avec validation humaine.",
  directlyInteractsWithPeople: true,
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
  existingControls: ["Validation humaine déclarée"],
  prohibitedPracticeSignals: [],
  signedAmendmentProhibitedPracticeSignals: [],
  missingInformation: [],
};

const gap: HydratedGap = {
  id: "traceability-gap",
  title: "Traçabilité à démontrer",
  priority: "before_next_release",
  severity: "major",
  dimension: "data_and_documentation",
  status: "missing",
  currentEvidence: null,
  rationale: "Aucune preuve contrôlable n'est fournie.",
  action: "Rassembler les pièces et les faire relire.",
  evidenceNeeded: ["Journal des versions", "Procès-verbal de revue"],
  referenceIds: ["ai-literacy"],
  implementationEffort: "medium",
  article: null,
  deadline: null,
  references: [],
};

test("le dossier crée une ligne distincte pour chaque preuve attendue", () => {
  const result = buildReportEvidence(
    request,
    facts,
    [gap],
    "assessment-evidence-test",
    "2026-07-20T12:00:00.000Z",
  );

  assert.deepEqual(
    result.items.map((item) => item.control),
    [
      "Validation humaine déclarée",
      "Journal des versions",
      "Procès-verbal de revue",
    ],
  );
  assert.equal(result.items[0]?.status, "declared");
  assert.deepEqual(
    result.items.slice(1).map((item) => item.status),
    ["missing", "missing"],
  );
  assert.equal(result.inventory.truncatedItemCount, 0);
});

test("le constructeur déterministe ne promeut jamais une déclaration en preuve", () => {
  const result = buildReportEvidence(
    request,
    facts,
    [],
    "assessment-no-auto-proof",
    "2026-07-20T12:00:00.000Z",
  );

  assert.equal(result.items.some((item) => item.status === "verified"), false);
  assert.equal(result.items[0]?.sourceType, "user-declaration");
});
