"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  FileText,
  Landmark,
  LockKeyhole,
  Scale,
  ShieldCheck,
} from "lucide-react";
import {
  AnalysisProgress,
  type AnalysisStage,
} from "./components/AnalysisProgress";
import { AssessmentForm } from "./components/AssessmentForm";
import { AssessmentResults } from "./components/AssessmentResults";
import { Brand } from "./components/Brand";
import {
  isRecord,
  unwrapAssessment,
  type Assessment,
  type AssessmentRequest,
} from "./components/assessment-types";

type RequestStatus = "idle" | "loading" | "success" | "error";

function apiErrorMessage(payload: unknown) {
  if (!isRecord(payload)) return null;

  if (typeof payload.detail === "string") return payload.detail;
  if (typeof payload.error === "string") return payload.error;
  if (typeof payload.message === "string") return payload.message;

  if (isRecord(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }

  return null;
}

function isAnalysisStage(value: unknown): value is AnalysisStage {
  return (
    value === "extraction" ||
    value === "classification" ||
    value === "gap_analysis" ||
    value === "synthesis"
  );
}

async function readAssessmentResponse(
  response: Response,
  onProgress: (stage: AnalysisStage) => void,
): Promise<Assessment> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!response.ok || !contentType.includes("application/x-ndjson")) {
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        apiErrorMessage(payload) ??
          "L’évaluation n’a pas pu être produite. Réessayez dans quelques instants.",
      );
    }
    return unwrapAssessment(payload);
  }

  if (!response.body) {
    throw new Error("Le flux d’évaluation n’est pas disponible.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assessment: Assessment | null = null;

  const consumeLine = (line: string) => {
    if (!line.trim()) return;
    let event: unknown;
    try {
      event = JSON.parse(line) as unknown;
    } catch {
      throw new Error("Le flux d’évaluation reçu est invalide.");
    }
    if (!isRecord(event)) return;

    if (event.type === "progress" && isAnalysisStage(event.stage)) {
      onProgress(event.stage);
      return;
    }
    if (event.type === "error") {
      throw new Error(
        apiErrorMessage(event) ?? "L’évaluation n’a pas pu être terminée.",
      );
    }
    if (event.type === "result") {
      assessment = unwrapAssessment(event);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(consumeLine);
    if (done) break;
  }
  consumeLine(buffer);

  if (!assessment) {
    throw new Error("Le flux s’est terminé sans résultat d’évaluation.");
  }
  return assessment;
}

export default function Home() {
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [analysisStage, setAnalysisStage] =
    useState<AnalysisStage>("extraction");
  const [lastRequest, setLastRequest] = useState<AssessmentRequest | null>(null);
  const [formVersion, setFormVersion] = useState(0);

  useEffect(() => {
    if (!assessment) return;

    const frame = window.requestAnimationFrame(() => {
      const resultSection = document.getElementById("resultats");
      if (!resultSection) return;

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      resultSection.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
      resultSection.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [assessment]);

  async function submitAssessment(payload: AssessmentRequest) {
    setStatus("loading");
    setError(null);
    setAssessment(null);
    setAnalysisStage("extraction");
    setLastRequest(payload);

    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson, application/json",
        },
        body: JSON.stringify(payload),
      });

      const completedAssessment = await readAssessmentResponse(
        response,
        setAnalysisStage,
      );
      setAssessment(completedAssessment);
      setStatus("success");
    } catch (requestError) {
      setStatus("error");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Une erreur inattendue a interrompu l’évaluation.",
      );
    }
  }

  function resetAssessment() {
    setAssessment(null);
    setError(null);
    setLastRequest(null);
    setStatus("idle");
    setFormVersion((version) => version + 1);
    window.requestAnimationFrame(() => {
      document.getElementById("evaluation")?.scrollIntoView({ block: "start" });
    });
  }

  const isLoading = status === "loading";

  return (
    <div className="pv-app-shell" id="accueil">
      <a className="pv-skip-link" href="#contenu">
        Aller au contenu
      </a>

      <header className="pv-site-header">
        <div className="pv-header-inner">
          <a className="pv-brand-link" href="#accueil">
            <Brand />
          </a>
          <nav className="pv-main-nav" aria-label="Navigation principale">
            <a href="#methode">Méthode</a>
            <a href="#referentiel">Référentiel</a>
            {assessment ? <a href="#resultats">Rapport</a> : null}
            <a href="/auth/sign-in">Espace</a>
          </nav>
          <a className="pv-header-action" href="#evaluation">
            Lancer une évaluation
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </header>

      <main id="contenu">
        <section className="pv-hero" aria-labelledby="hero-title">
          <div className="pv-hero-copy">
            <div className="pv-hero-eyebrow">
              <span aria-hidden="true" />
              Référentiel EU AI Act vérifié le 13 juillet 2026
            </div>
            <h1 id="hero-title">
              Maîtrisez votre risque IA.<br />
              <span>Prouvez-le.</span>
            </h1>
            <p className="pv-hero-lede">
              Décrivez votre système en français courant. Preuvance transforme
              ce contexte en classification réglementaire, plan d’action et
              rapport de préparation partageable avec votre courtier, assureur
              ou investisseur.
            </p>

            <ul className="pv-proof-list" aria-label="Bénéfices de Preuvance">
              <li>
                <Scale size={17} aria-hidden="true" />
                Raisonnement contextuel, pas un arbre de décision
              </li>
              <li>
                <ShieldCheck size={17} aria-hidden="true" />
                Score explicable et décisions notées sur 100
              </li>
              <li>
                <Landmark size={17} aria-hidden="true" />
                Rapport pensé pour le dialogue assurantiel
              </li>
            </ul>

            <div className="pv-deadline-callout">
              <div className="pv-deadline-date" aria-label="2 août 2026">
                <strong>02</strong>
                <span>AOÛT<br />2026</span>
              </div>
              <div>
                <p className="pv-kicker">Prochaine échéance ferme</p>
                <strong>Transparence — Article 50</strong>
                <p>
                  Divulgation des chatbots, contenus générés et usages
                  d’émotion ou de biométrie.
                </p>
              </div>
            </div>
          </div>

          <div className="pv-evaluation-panel" id="evaluation">
            <div className="pv-panel-topline">
              <span>Analyse 01</span>
              <span>
                <LockKeyhole size={14} aria-hidden="true" />
                Données minimales
              </span>
            </div>
            {isLoading ? (
              <AnalysisProgress stage={analysisStage} />
            ) : (
              <AssessmentForm
                key={formVersion}
                error={error}
                initialValue={lastRequest}
                isSubmitting={isLoading}
                onSubmit={submitAssessment}
              />
            )}
          </div>
        </section>

        {assessment ? (
          <AssessmentResults assessment={assessment} onReset={resetAssessment} />
        ) : null}

        <section className="pv-method" id="methode" aria-labelledby="method-title">
          <div className="pv-section-intro">
            <p className="pv-kicker">Une preuve, pas une checklist</p>
            <h2 id="method-title">Du contexte métier à une décision traçable.</h2>
            <p>
              Chaque conclusion reste reliée aux faits extraits, au texte
              réglementaire applicable et à une action vérifiable.
            </p>
          </div>
          <ol className="pv-method-steps">
            <li>
              <span className="pv-method-number">01</span>
              <FileText size={22} aria-hidden="true" />
              <h3>Décrire</h3>
              <p>
                Votre équipe explique l’usage réel, les personnes concernées et
                les décisions produites, sans jargon juridique.
              </p>
            </li>
            <li>
              <span className="pv-method-number">02</span>
              <Scale size={22} aria-hidden="true" />
              <h3>Qualifier</h3>
              <p>
                Le système rapproche ces faits d’un référentiel daté, puis
                expose sa classification et son niveau de confiance.
              </p>
            </li>
            <li>
              <span className="pv-method-number">03</span>
              <ShieldCheck size={22} aria-hidden="true" />
              <h3>Prouver</h3>
              <p>
                Le score, les écarts prioritaires et le journal des décisions
                forment un dossier partageable avec un tiers.
              </p>
            </li>
          </ol>
        </section>

        <section className="pv-reference-band" id="referentiel" aria-labelledby="reference-title">
          <div className="pv-reference-heading">
            <CalendarDays size={22} aria-hidden="true" />
            <div>
              <p className="pv-kicker">Référentiel réglementaire figé</p>
              <h2 id="reference-title">Des dates contrôlées, pas improvisées.</h2>
            </div>
          </div>
          <div className="pv-reference-dates">
            <div>
              <span>02.08.2026</span>
              <strong>Article 50</strong>
              <small>Transparence</small>
            </div>
            <div>
              <span>02.12.2026</span>
              <strong>Systèmes antérieurs</strong>
              <small>Transition Art. 50(2), si l’Omnibus entre en vigueur</small>
            </div>
            <div>
              <span>02.12.2027</span>
              <strong>Annexe III</strong>
              <small>Sous réserve de publication formelle au JO</small>
            </div>
            <div>
              <span>02.08.2028</span>
              <strong>Annexe I</strong>
              <small>Sous réserve de publication formelle au JO</small>
            </div>
          </div>
        </section>
      </main>

      <footer className="pv-site-footer">
        <div className="pv-footer-main">
          <Brand compact />
          <p>Maîtrisez votre risque IA, prouvez-le à votre assureur.</p>
          <a href="#evaluation">
            Évaluer un système
            <ArrowRight size={15} aria-hidden="true" />
          </a>
        </div>
        <div className="pv-footer-legal">
          <p>
            Référentiel réglementaire vérifié le 13 juillet 2026. Les reports
            des Annexes III et I restent indiqués sous réserve de publication
            formelle au Journal officiel de l’Union européenne.
          </p>
          <p>
            Preuvance fournit une aide à la préparation et à la décision. Ce
            service ne constitue pas un conseil juridique.
          </p>
        </div>
      </footer>
    </div>
  );
}
