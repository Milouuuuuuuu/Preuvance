"use client";

import { useCallback, useState } from "react";
import {
  AlertTriangle,
  FileSearch,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { validateScanReport, type ScanReport } from "@/lib/scan/scan-contract";
import {
  computeScanExposure,
  type ScanExposure,
} from "@/app/lib/assessment/scan-scoring";

type LoadState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ready"; report: ScanReport; exposure: ScanExposure };

function toneForScore(score: number) {
  if (score >= 85) return "is-pass";
  if (score >= 65) return "is-caution";
  return "is-risk";
}

function toneForSeverity(severity: string) {
  if (severity === "critical" || severity === "major") return "is-risk";
  if (severity === "moderate") return "is-caution";
  return "is-neutral";
}

export function ScanReportLoader() {
  const [state, setState] = useState<LoadState>({ status: "idle" });

  const handleFile = useCallback(async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setState({
          status: "error",
          message: "Ce fichier n’est pas un JSON valide.",
        });
        return;
      }
      const validation = validateScanReport(parsed);
      if (!validation.success) {
        setState({
          status: "error",
          message: `Rapport de scan non conforme : ${validation.errors[0] ?? "format inattendu"}.`,
        });
        return;
      }
      setState({
        status: "ready",
        report: validation.data,
        exposure: computeScanExposure(validation.data),
      });
    } catch {
      setState({
        status: "error",
        message: "Le fichier n’a pas pu être lu dans le navigateur.",
      });
    }
  }, []);

  return (
    <section className="pv-scan" aria-labelledby="scan-title">
      <div className="pv-scan-intro">
        <p className="pv-kicker">Analyse 100 % locale</p>
        <h2 id="scan-title">Chargez le rapport de votre scan local</h2>
        <p>
          Le fichier <code>preuvance-scan.json</code> produit par le scan reste sur
          votre poste : il est lu ici dans votre navigateur, sans aucun envoi. Il
          révèle les appels d’IA non déclarés (« shadow AI ») et les fichiers
          sensibles exposés, qui font baisser votre préparation.
        </p>
      </div>

      <label className="pv-scan-drop">
        <input
          type="file"
          accept="application/json,.json"
          onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
        />
        <Upload size={22} aria-hidden="true" />
        <span>Choisir le fichier preuvance-scan.json</span>
      </label>

      {state.status === "error" ? (
        <div className="pv-scan-error" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          {state.message}
        </div>
      ) : null}

      {state.status === "ready" ? (
        <div className="pv-scan-result">
          <article className={`pv-scan-score ${toneForScore(state.exposure.exposureScore)}`}>
            <div className="pv-scan-score-readout">
              {state.exposure.exposureScore >= 85 ? (
                <ShieldCheck size={26} aria-hidden="true" />
              ) : (
                <ShieldAlert size={26} aria-hidden="true" />
              )}
              <strong>{state.exposure.exposureScore}</strong>
              <span>/100</span>
            </div>
            <p>{state.exposure.summary}</p>
            <dl className="pv-scan-observed">
              <div>
                <dt>Appels d’IA non déclarés</dt>
                <dd>{state.exposure.observed.undeclaredAiEndpoints}</dd>
              </div>
              <div>
                <dt>Secrets exposés</dt>
                <dd>{state.exposure.observed.secretFiles}</dd>
              </div>
              <div>
                <dt>Poste</dt>
                <dd>
                  {state.report.host.profile === "professional"
                    ? "professionnel"
                    : state.report.host.profile === "personal"
                      ? "personnel"
                      : "non déterminé"}
                </dd>
              </div>
            </dl>
          </article>

          <div className="pv-scan-findings">
            <div className="pv-scan-findings-head">
              <FileSearch size={18} aria-hidden="true" />
              <h3>Constats ({state.exposure.findings.length})</h3>
            </div>
            {state.exposure.findings.length ? (
              <ul>
                {state.exposure.findings.map((finding) => (
                  <li key={finding.id}>
                    <div className="pv-scan-finding-head">
                      <span className={`pv-scan-badge ${toneForSeverity(finding.severity)}`}>
                        {finding.severity}
                      </span>
                      <strong>{finding.title}</strong>
                    </div>
                    <p>{finding.detail}</p>
                    {finding.article ? (
                      <span className="pv-scan-article">{finding.article}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pv-empty-state">
                Aucun signal d’exposition dans le périmètre observé.
              </p>
            )}
          </div>

          {state.report.notes.length ? (
            <div className="pv-scan-notes">
              <h3>Limites déclarées du scan</h3>
              <ul>
                {state.report.notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
