"use client";

import { AssessmentResults } from "./AssessmentResults";
import type { Assessment } from "./assessment-types";

export function DossierViewer({ assessment }: { assessment: Assessment }) {
  return (
    <AssessmentResults
      assessment={assessment}
      onReset={() => {
        window.location.assign("/#evaluation");
      }}
    />
  );
}

