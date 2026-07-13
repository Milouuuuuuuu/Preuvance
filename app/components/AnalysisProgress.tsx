"use client";

import {
  Check,
  FileSearch,
  ListChecks,
  LoaderCircle,
  Scale,
  ShieldCheck,
} from "lucide-react";
import * as Progress from "@radix-ui/react-progress";

const STEPS = [
  {
    id: "extraction",
    label: "Extraction des faits",
    description: "Lecture du produit, des usages et des personnes concernées.",
    icon: FileSearch,
  },
  {
    id: "classification",
    label: "Classification réglementaire",
    description: "Mise en regard avec le référentiel EU AI Act daté.",
    icon: Scale,
  },
  {
    id: "gap_analysis",
    label: "Analyse des écarts",
    description: "Priorisation des mesures de préparation à la pré-souscription.",
    icon: ListChecks,
  },
  {
    id: "synthesis",
    label: "Synthèse de préparation",
    description: "Calcul du score et rédaction du dossier de préparation.",
    icon: ShieldCheck,
  },
] as const;

export type AnalysisStage = (typeof STEPS)[number]["id"];

export function AnalysisProgress({ stage }: { stage: AnalysisStage }) {
  const activeStep = Math.max(
    0,
    STEPS.findIndex((step) => step.id === stage),
  );

  const ActiveIcon = STEPS[activeStep].icon;

  return (
    <section
      className="pv-progress-card"
      aria-busy="true"
      aria-live="polite"
      aria-label="Évaluation en cours"
      role="status"
    >
      <div className="pv-progress-status">
        <span className="pv-progress-live-icon" aria-hidden="true">
          <ActiveIcon size={23} />
        </span>
        <div>
          <p className="pv-kicker">Raisonnement en cours</p>
          <h2>{STEPS[activeStep].label}</h2>
        </div>
        <LoaderCircle className="pv-loader" size={22} aria-hidden="true" />
      </div>

      <Progress.Root
        className="pv-progress-line"
        value={((activeStep + 1) / STEPS.length) * 100}
        aria-label="Progression du pipeline d’évaluation"
      >
        <Progress.Indicator
          style={{ width: `${((activeStep + 1) / STEPS.length) * 100}%` }}
        />
      </Progress.Root>

      <ol className="pv-progress-steps">
        {STEPS.map((step, index) => {
          const isComplete = index < activeStep;
          const isActive = index === activeStep;
          const StepIcon = step.icon;

          return (
            <li
              key={step.label}
              className={isActive ? "is-active" : isComplete ? "is-complete" : ""}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="pv-step-marker" aria-hidden="true">
                {isComplete ? <Check size={16} /> : <StepIcon size={16} />}
              </span>
              <span>
                <strong>{step.label}</strong>
                <small>{step.description}</small>
              </span>
            </li>
          );
        })}
      </ol>

      <p className="pv-progress-footnote">
        L’état affiché vient du pipeline serveur. Chaque étape terminée est
        conservée dans le journal de décision, sans exposer de chaîne de pensée.
      </p>
    </section>
  );
}
