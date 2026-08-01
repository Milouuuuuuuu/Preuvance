"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ClipboardCopy, Download, Upload } from "lucide-react";

import {
  OWNER_LABELS,
  PREPARATION_ITEMS,
  buildPreparationPrompt,
  emptyPlan,
  parsePreparationPlan,
  preparationProgress,
  type PreparationPlan,
} from "@/lib/admin/preparation";

/**
 * Plan de préparation d'une mission, tenu par les deux administrateurs.
 *
 * Deux choix assumés, pour ne pas alourdir les procédés :
 *
 * 1. **Rien ne part sur un serveur.** Le plan vit dans le navigateur et
 *    s'exporte en un fichier. C'est la même mécanique que le scan et le
 *    catalogue, et cela évite d'ajouter une table, une migration et un contrôle
 *    d'accès pour deux personnes.
 * 2. **La liste n'est pas saisie.** Les sept éléments viennent du catalogue
 *    `lib/admin/preparation`. On coche, on annote ; on ne retape rien.
 */
const STORAGE_KEY = "preuvance.preparation.v1";

export function PreparationWorkbench() {
  const [plan, setPlan] = useState<PreparationPlan>(() => emptyPlan());
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Relecture au montage seulement : le rendu serveur ne connaît pas le
  // stockage local, l'écrire pendant le rendu produirait une divergence.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = parsePreparationPlan(JSON.parse(raw));
      if (parsed.success) setPlan(parsed.data);
    } catch {
      // Un stockage illisible ne doit pas empêcher de travailler : on repart
      // d'un plan vide plutôt que de bloquer l'écran.
    }
  }, []);

  const persist = useCallback((next: PreparationPlan) => {
    setPlan(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setMessage("Le plan n'a pas pu être enregistré dans ce navigateur. Exportez-le pour ne rien perdre.");
    }
  }, []);

  const progress = useMemo(() => preparationProgress(plan), [plan]);
  const prompt = useMemo(() => buildPreparationPrompt(plan), [plan]);

  function toggle(id: string) {
    persist({
      ...plan,
      entries: plan.entries.map((entry) =>
        entry.id === id ? { ...entry, done: !entry.done } : entry,
      ),
    });
  }

  function setNote(id: string, note: string) {
    persist({
      ...plan,
      entries: plan.entries.map((entry) => (entry.id === id ? { ...entry, note } : entry)),
    });
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setMessage(null);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage("Copie refusée par le navigateur. Sélectionnez le texte et copiez-le à la main.");
    }
  }

  function exportPlan() {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `preparation-${plan.reference.trim() || "mission"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importPlan(file: File | null) {
    if (!file) return;
    try {
      const parsed = parsePreparationPlan(JSON.parse(await file.text()));
      if (!parsed.success) {
        setMessage(`Fichier refusé : ${parsed.error}`);
        return;
      }
      persist(parsed.data);
      setMessage("Plan repris depuis le fichier.");
    } catch {
      setMessage("Ce fichier n'est pas un JSON lisible.");
    }
  }

  return (
    <section className="ops-panel" aria-labelledby="ops-preparation">
      <h2 id="ops-preparation">Préparation de mission</h2>

      <div className="ops-prep-head">
        <label>
          <span>Client</span>
          <input
            type="text"
            value={plan.client}
            placeholder="Nom du client"
            onChange={(event) => persist({ ...plan, client: event.target.value })}
          />
        </label>
        <label>
          <span>Référence</span>
          <input
            type="text"
            value={plan.reference}
            placeholder="PV-2026-0001"
            onChange={(event) => persist({ ...plan, reference: event.target.value })}
          />
        </label>
      </div>

      <p className="ops-note" role="status">
        {progress.done} sur {progress.total} obtenus
        {progress.blocking.length > 0
          ? " · le DPA manque : la collecte ne peut pas démarrer"
          : progress.missing.length > 0
            ? " · rien de bloquant, mais chaque manque plafonne le score"
            : " · pack d’accès complet"}
      </p>

      <ul className="ops-prep-list">
        {PREPARATION_ITEMS.map((item) => {
          const entry = plan.entries.find((candidate) => candidate.id === item.id);
          const done = entry?.done ?? false;
          return (
            <li key={item.id} className={done ? "is-done" : undefined}>
              <label className="ops-prep-check">
                <input type="checkbox" checked={done} onChange={() => toggle(item.id)} />
                <span>{item.label}</span>
              </label>
              <p className="ops-note">
                {OWNER_LABELS[item.owner]} · {item.deadline} — {item.consequence}
              </p>
              <label className="ops-prep-note">
                <span className="ops-visually-hidden">Note sur : {item.label}</span>
                <input
                  type="text"
                  value={entry?.note ?? ""}
                  placeholder="Note (qui, quand, où ça bloque)"
                  onChange={(event) => setNote(item.id, event.target.value)}
                />
              </label>
            </li>
          );
        })}
      </ul>

      <label className="ops-prep-notes">
        <span>Notes libres</span>
        <textarea
          rows={5}
          value={plan.notes}
          placeholder="Ce qu’on a appris, ce qui coince, qui rappeler."
          onChange={(event) => persist({ ...plan, notes: event.target.value })}
        />
      </label>

      <div className="ops-prep-actions">
        <button type="button" onClick={copyPrompt}>
          {copied ? <Check size={15} aria-hidden="true" /> : <ClipboardCopy size={15} aria-hidden="true" />}
          {copied ? "Prompt copié" : "Copier le prompt"}
        </button>
        <button type="button" onClick={exportPlan}>
          <Download size={15} aria-hidden="true" />
          Exporter le plan
        </button>
        <label className="ops-prep-import">
          <Upload size={15} aria-hidden="true" />
          <span>Reprendre un plan</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              void importPlan(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {message ? (
        <p className="ops-note" role="alert">
          {message}
        </p>
      ) : null}

      <details className="ops-prep-prompt">
        <summary>Prompt généré</summary>
        <pre>{prompt}</pre>
      </details>
    </section>
  );
}
