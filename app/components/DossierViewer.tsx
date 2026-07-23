"use client";

import { AssessmentResults } from "./AssessmentResults";
import type { Assessment } from "./assessment-types";

export function DossierViewer({
  assessment,
  resetHref = "/#evaluation",
  staticPdfHref,
}: {
  assessment: Assessment;
  resetHref?: string;
  staticPdfHref?: string;
}) {
  return (
    <AssessmentResults
      assessment={assessment}
      staticPdfHref={staticPdfHref}
      trackCompletion={false}
      onReset={() => {
        window.location.assign(resetHref);
      }}
    />
  );
}

