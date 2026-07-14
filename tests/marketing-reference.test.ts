import assert from "node:assert/strict";
import test from "node:test";

import {
  getDeadline,
  getRegulatoryReference,
} from "../app/lib/assessment/regulatory";
import { getMarketingReference } from "../app/lib/marketing";

test("les dates marketing proviennent du référentiel réglementaire, sans duplication", () => {
  const marketing = getMarketingReference();

  assert.equal(marketing.band[0]?.date, "02.08.2026");
  assert.equal(marketing.band[1]?.date, "02.12.2026");
  assert.equal(marketing.band[2]?.date, "02.12.2027");
  assert.equal(marketing.band[3]?.date, "02.08.2028");
  assert.equal(marketing.deadlineCallout.day, "02");
  assert.equal(marketing.deadlineCallout.monthLabel, "AOÛT");
  assert.equal(marketing.deadlineCallout.year, "2026");
  assert.equal(marketing.deadlineCallout.ariaLabel, "2 août 2026");
  assert.equal(marketing.verifiedAtDisplay, "13 juillet 2026");
});

test("toute évolution du référentiel se propage automatiquement au marketing", () => {
  const marketing = getMarketingReference();
  const annexIII = getDeadline("high-risk-annex-iii");
  const expected = (
    annexIII.signedAmendmentPosition?.date ?? annexIII.bindingPosition.date
  )
    .split("-")
    .reverse()
    .join(".");

  assert.equal(marketing.band[2]?.date, expected);
});

test("le référentiel couvre le seuil GPAI de risque systémique", () => {
  const reference = getRegulatoryReference();
  assert.match(
    reference.classificationRules.gpai.systemicRiskThresholdFr,
    /10\^25 FLOP/,
  );
  assert.match(getDeadline("gpai-provider-obligations").noteFr, /10\^25 FLOP/);
  assert.match(
    reference.classificationRules.prohibitedPracticeSignedAmendment[0]
      ?.noteFr ?? "",
    /2 décembre 2026/,
  );
});
