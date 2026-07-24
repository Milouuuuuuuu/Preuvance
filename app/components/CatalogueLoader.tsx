"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  FileSearch,
  Gauge,
  Network,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from "lucide-react";

import { validateCatalogue, type Catalogue } from "@/lib/inventory/catalogue-contract";
import {
  computeDiagnostic,
  SEVERITY_LABELS,
  type Diagnostic,
  type DiagnosticSeverity,
} from "@/lib/inventory/diagnostic";
import {
  renderDiagnosticHtml,
  renderDiagnosticMarkdown,
} from "@/lib/inventory/report";
import { SENSITIVE_CATEGORY_LABELS } from "@/lib/inventory/sensitive-fields";
import { trackEvent } from "@/lib/analytics/posthog";

type LoadState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ready"; catalogue: Catalogue; diagnostic: Diagnostic };

function toneForScore(score: number) {
  if (score >= 85) return "is-pass";
  if (score >= 65) return "is-caution";
  return "is-risk";
}

function toneForSeverity(severity: DiagnosticSeverity) {
  if (severity === "critical" || severity === "major") return "is-risk";
  if (severity === "moderate") return "is-caution";
  return "is-neutral";
}

function downloadLocalFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function CatalogueLoader() {
  const [state, setState] = useState<LoadState>({ status: "idle" });

  const handleFile = useCallback(async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setState({ status: "error", message: "Ce fichier n’est pas un JSON valide." });
        return;
      }
      const validation = validateCatalogue(parsed);
      if (!validation.success) {
        setState({
          status: "error",
          message: `Catalogue non conforme : ${validation.errors[0] ?? "format inattendu"}.`,
        });
        return;
      }
      const diagnostic = computeDiagnostic(validation.data);
      setState({ status: "ready", catalogue: validation.data, diagnostic });
      trackEvent("catalogue_loaded", {
        score: diagnostic.score,
        sources: diagnostic.coverage.sources,
        datasets: diagnostic.coverage.datasets,
      });
    } catch {
      setState({
        status: "error",
        message: "Le fichier n’a pas pu être lu dans le navigateur.",
      });
    }
  }, []);

  const reference = state.status === "ready" ? state.catalogue.mission.reference : "";

  const exports = useMemo(() => {
    if (state.status !== "ready") return null;
    return {
      markdown: renderDiagnosticMarkdown(state.catalogue, state.diagnostic),
      html: renderDiagnosticHtml(state.catalogue, state.diagnostic),
    };
  }, [state]);

  return (
    <section className="pv-scan" aria-labelledby="diagnostic-title">
      <div className="pv-scan-intro">
        <p className="pv-kicker">Lecture 100 % locale</p>
        <h2 id="diagnostic-title">Chargez le catalogue produit par l’agent</h2>
        <p>
          Le fichier <code>preuvance-catalogue.json</code> reste sur votre poste : il
          est lu ici, dans votre navigateur, sans aucun envoi. Il ne contient que
          des métadonnées — structures, volumétries, dates — jamais une valeur
          métier.
        </p>
      </div>

      <label className="pv-scan-drop">
        <input
          type="file"
          accept="application/json,.json"
          onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
        />
        <Upload size={22} aria-hidden="true" />
        <span>Choisir le fichier preuvance-catalogue.json</span>
      </label>

      {state.status === "error" ? (
        <div className="pv-scan-error" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          {state.message}
        </div>
      ) : null}

      {state.status === "ready" ? (
        <div className="pv-scan-result">
          <article className={`pv-scan-score ${toneForScore(state.diagnostic.score)}`}>
            <div className="pv-scan-score-readout">
              {state.diagnostic.score >= 85 ? (
                <ShieldCheck size={26} aria-hidden="true" />
              ) : (
                <ShieldAlert size={26} aria-hidden="true" />
              )}
              <strong>{state.diagnostic.score}</strong>
              <span>/100</span>
            </div>
            <p>{state.diagnostic.summary}</p>
            <dl className="pv-scan-observed">
              <div>
                <dt>Sources</dt>
                <dd>{state.diagnostic.coverage.sources}</dd>
              </div>
              <div>
                <dt>Jeux de données</dt>
                <dd>{state.diagnostic.coverage.datasets}</dd>
              </div>
              <div>
                <dt>Champs sensibles</dt>
                <dd>{state.diagnostic.sensitivity.fieldsSensitive}</dd>
              </div>
            </dl>
          </article>

          <div className="pv-diag-axes">
            <div className="pv-scan-findings-head">
              <Gauge size={18} aria-hidden="true" />
              <h3>Axes du diagnostic</h3>
            </div>
            <ul>
              {state.diagnostic.axes.map((axis) => (
                <li key={axis.id}>
                  <span className="pv-diag-axis-label">{axis.label}</span>
                  <span className="pv-diag-axis-bar" aria-hidden="true">
                    <span style={{ width: `${axis.score}%` }} />
                  </span>
                  <span className="pv-diag-axis-score">
                    {axis.score}/100 · poids {axis.weight} %
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {state.diagnostic.appliedCaps.length > 0 ? (
            <div className="pv-diag-caps">
              <h3>Plafonds appliqués</h3>
              <p>
                Calcul pondéré avant plafonds : {state.diagnostic.rawScore}/100. Un
                plafond traduit une observation manquante ou un constat critique.
              </p>
              <ul>
                {state.diagnostic.appliedCaps.map((cap) => (
                  <li key={cap.reason}>
                    <strong>{cap.cap}/100</strong> — {cap.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="pv-scan-findings">
            <div className="pv-scan-findings-head">
              <FileSearch size={18} aria-hidden="true" />
              <h3>Constats ({state.diagnostic.findings.length})</h3>
            </div>
            {state.diagnostic.findings.length ? (
              <ul>
                {state.diagnostic.findings.map((item) => (
                  <li key={item.id}>
                    <div className="pv-scan-finding-head">
                      <span className={`pv-scan-badge ${toneForSeverity(item.severity)}`}>
                        {SEVERITY_LABELS[item.severity]}
                      </span>
                      <strong>{item.title}</strong>
                    </div>
                    <p>{item.detail}</p>
                    <p className="pv-diag-reco">
                      <strong>Action :</strong> {item.recommendation} ({item.effortDays} j)
                    </p>
                    {item.basis ? <span className="pv-scan-article">{item.basis}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pv-empty-state">
                Aucun constat sur le périmètre observé. Ce résultat n’est probant
                que si la couverture de collecte est complète.
              </p>
            )}
          </div>

          {state.diagnostic.sensitivity.byCategory.length > 0 ? (
            <div className="pv-diag-table-wrap">
              <h3>Champs sensibles par catégorie</h3>
              <table className="pv-diag-table">
                <thead>
                  <tr>
                    <th scope="col">Catégorie</th>
                    <th scope="col">Champs</th>
                    <th scope="col">Jeux de données</th>
                  </tr>
                </thead>
                <tbody>
                  {state.diagnostic.sensitivity.byCategory.map((entry) => (
                    <tr key={entry.category}>
                      <td>{SENSITIVE_CATEGORY_LABELS[entry.category]}</td>
                      <td>{entry.fields}</td>
                      <td>{entry.datasets}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="pv-diag-table-wrap">
            <div className="pv-scan-findings-head">
              <Network size={18} aria-hidden="true" />
              <h3>Plan de transition</h3>
            </div>
            <table className="pv-diag-table">
              <thead>
                <tr>
                  <th scope="col">Phase</th>
                  <th scope="col">Fenêtre</th>
                  <th scope="col">Actions</th>
                  <th scope="col">Charge</th>
                </tr>
              </thead>
              <tbody>
                {state.diagnostic.plan.map((phase) => (
                  <tr key={phase.id}>
                    <td>{phase.label}</td>
                    <td>{phase.window}</td>
                    <td>{phase.actions.length}</td>
                    <td>{phase.effortDays} j</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pv-scan-next">
            <p>
              Les deux exports sont générés dans votre navigateur à partir du
              catalogue chargé : rien n’est transmis. Le HTML s’imprime en PDF
              depuis le navigateur.
            </p>
            <div className="pv-diag-actions">
              <button
                type="button"
                className="pv-scan-next-cta"
                onClick={() => {
                  if (!exports) return;
                  downloadLocalFile(
                    `diagnostic-preuvance-${reference}.md`,
                    exports.markdown,
                    "text/markdown",
                  );
                  trackEvent("diagnostic_export", { format: "markdown" });
                }}
              >
                <Download size={16} aria-hidden="true" />
                Rapport Markdown
              </button>
              <button
                type="button"
                className="pv-scan-next-cta"
                onClick={() => {
                  if (!exports) return;
                  downloadLocalFile(
                    `diagnostic-preuvance-${reference}.html`,
                    exports.html,
                    "text/html",
                  );
                  trackEvent("diagnostic_export", { format: "html" });
                }}
              >
                <Download size={16} aria-hidden="true" />
                Rapport HTML imprimable
              </button>
            </div>
          </div>

          <div className="pv-scan-notes">
            <h3>Portée et limites</h3>
            <ul>
              {state.diagnostic.limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
