import assert from "node:assert/strict";
import test from "node:test";

import {
  clampPercentage,
  ratioToPercentage,
  toPercentage,
} from "../app/lib/assessment/percentages";
import { decisionScoreLabel } from "../lib/pdf/assessment-payload";

test("un score entier de 1/100 reste 1 et n’est jamais réinterprété comme 100 %", () => {
  assert.equal(toPercentage(1), 1);
  assert.equal(toPercentage(0), 0);
  assert.equal(toPercentage(2), 2);
});

test("seules les fractions strictement entre 0 et 1 sont converties en pourcentage", () => {
  assert.equal(toPercentage(0.85), 85);
  assert.equal(toPercentage(0.004), 0);
  assert.equal(toPercentage(100), 100);
});

test("les valeurs hors bornes sont plafonnées et les valeurs invalides écartées", () => {
  assert.equal(toPercentage(150), 100);
  assert.equal(toPercentage(-3), 0);
  assert.equal(toPercentage(null), null);
  assert.equal(toPercentage(Number.NaN), null);
});

test("un ratio explicite score/maxScore se convertit sans heuristique", () => {
  assert.equal(ratioToPercentage(1, 1), 100);
  assert.equal(ratioToPercentage(3, 4), 75);
  assert.equal(ratioToPercentage(1, 100), 1);
  assert.equal(ratioToPercentage(5, 0), null);
});

test("clampPercentage arrondit et borne sur 0-100", () => {
  assert.equal(clampPercentage(99.6), 100);
  assert.equal(clampPercentage(-1), 0);
});

test("le journal du PDF affiche « non noté » pour un score absent, jamais un chiffre inventé", () => {
  assert.equal(decisionScoreLabel(null), "non noté");
  assert.equal(decisionScoreLabel(1), "1/100");
  assert.equal(decisionScoreLabel(95), "95/100");
});
