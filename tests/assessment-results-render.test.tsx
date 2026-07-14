import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AssessmentResults } from "../app/components/AssessmentResults";
import type { Assessment } from "../app/components/assessment-types";

const worstCase: Assessment = {
  id: "assessment-worst-case",
  generatedAt: "2026-07-13T14:30:00.000Z",
  score: {
    overall: 1,
    tier: "D",
    methodVersion: "preuvance-readiness-v1",
    dimensions: [
      { label: "Gouvernance", score: 1, detail: "Pénalité maximale appliquée." },
    ],
  },
  classification: {
    riskTier: "Pratique interdite ou très probablement interdite",
    summary: "Cas le plus défavorable possible.",
    confidence: 1,
    applicableArticles: [],
  },
  gaps: [],
  decisionLog: [
    {
      title: "Pratiques interdites — droit publié",
      decision: "Applicable",
      score: 1,
      rationale: "Signal fort dans la description.",
    },
  ],
  crossCheck: {
    status: "divergent",
    version: "preuvance-crosscheck-v1",
    noteFr:
      "La contre-vérification déterministe contredit la classification sur 1 point structurant.",
  },
  metadata: { regulatoryReferenceVerifiedAt: "2026-07-13" },
};

test("le rendu complet des résultats n’inverse jamais un score de 1/100", () => {
  const markup = renderToStaticMarkup(
    <AssessmentResults assessment={worstCase} onReset={() => {}} />,
  );

  assert.ok(markup.includes("Score 1 sur 100"), "le score hero doit annoncer 1/100");
  assert.ok(markup.includes("1/100"), "la dimension doit afficher 1/100");
  assert.ok(!markup.includes("100/100"), "aucun affichage ne doit montrer 100/100");
  assert.ok(!markup.includes("is-pass"), "le pire cas ne doit jamais être vert");
  assert.ok(markup.includes("is-risk"), "le pire cas doit être signalé en rouge");
});

test("la bannière de contre-vérification et la traçabilité apparaissent dans le rendu", () => {
  const markup = renderToStaticMarkup(
    <AssessmentResults assessment={worstCase} onReset={() => {}} />,
  );

  assert.ok(
    markup.includes("Contre-vérification déterministe : contradiction détectée"),
  );
  assert.ok(markup.includes("Référentiel vérifié le 13.07.2026"));
  assert.ok(markup.includes("Méthode preuvance-readiness-v1"));
});
