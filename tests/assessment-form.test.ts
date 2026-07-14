import assert from "node:assert/strict";
import test from "node:test";

import {
  assessmentFormSchema,
  parseMillionsInput,
} from "../app/components/AssessmentForm";

const validForm = {
  organizationName: "Atelier Horizon",
  systemName: "Assistant clients",
  description:
    "Un assistant répond aux questions des clients à partir de la documentation validée par notre équipe.",
  employees: "40",
  annualRevenue: "8",
  balanceSheetTotal: "5",
};

test("le formulaire rejette chaque montant financier vide", () => {
  const emptyRevenue = assessmentFormSchema.safeParse({
    ...validForm,
    annualRevenue: "",
  });
  const emptyBalance = assessmentFormSchema.safeParse({
    ...validForm,
    balanceSheetTotal: "   ",
  });

  assert.equal(emptyRevenue.success, false);
  assert.equal(emptyBalance.success, false);
  if (!emptyRevenue.success) {
    assert.ok(
      emptyRevenue.error.issues.some(
        (issue) => issue.path.join(".") === "annualRevenue",
      ),
    );
  }
  if (!emptyBalance.success) {
    assert.ok(
      emptyBalance.error.issues.some(
        (issue) => issue.path.join(".") === "balanceSheetTotal",
      ),
    );
  }
});

test("le formulaire accepte un zéro financier explicite", () => {
  const result = assessmentFormSchema.safeParse({
    ...validForm,
    annualRevenue: "0",
    balanceSheetTotal: "0,0",
  });

  assert.equal(result.success, true);
});

test("les montants français avec espaces et virgule décimale sont compris", () => {
  assert.equal(parseMillionsInput("1 234,5"), 1234.5);
  assert.equal(parseMillionsInput("24"), 24);
  assert.equal(parseMillionsInput("0,75"), 0.75);
  assert.equal(parseMillionsInput("1 500"), 1500);
});

test("les montants ambigus à séparateurs multiples sont rejetés", () => {
  assert.equal(parseMillionsInput("1,234,567"), null);
  assert.equal(parseMillionsInput("1.2.3"), null);
  assert.equal(parseMillionsInput("-4"), null);
  assert.equal(parseMillionsInput("abc"), null);

  const result = assessmentFormSchema.safeParse({
    ...validForm,
    annualRevenue: "1,234,567",
  });
  assert.equal(result.success, false);
});
