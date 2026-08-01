"use client";

import { useMemo, useState } from "react";
import { Database, Download, FolderOpen, Plug, Plus, Trash2, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  SOURCE_KINDS,
  checkMission,
  emptyMission,
  newSource,
  slugify,
  sourceKindOf,
  summarize,
  type SourceKindId,
} from "@/lib/admin/mission-draft";
import type { MissionConfig } from "@/lib/inventory/mission-config";

/**
 * Éditeur du fichier de mission.
 *
 * Le fichier de mission était « la seule chose que l'opérateur écrit à la
 * main » : il fallait connaître la forme d'une union discriminée Zod pour
 * lancer une collecte. Cet écran produit le même fichier, validé par le même
 * schéma, sans qu'on ait à écrire une accolade.
 *
 * Rien n'est envoyé nulle part : le brouillon vit dans la page et s'exporte.
 * Aucun secret n'entre ici — les identifiants restent nommés (`tokenEnv`,
 * `apiKeyEnv`) et lus dans l'environnement du poste, comme l'exige le schéma.
 */

const KIND_ICONS: Record<SourceKindId, LucideIcon> = {
  sql: Database,
  file: FolderOpen,
  salesforce: Plug,
  dolibarr: Plug,
};

type Props = {
  mission: MissionConfig;
  onChange: (mission: MissionConfig) => void;
};

export function MissionEditor({ mission, onChange }: Props) {
  const [message, setMessage] = useState<string | null>(null);

  const check = useMemo(() => checkMission(mission), [mission]);
  const resume = useMemo(() => summarize(mission), [mission]);

  function patchMission(patch: Partial<MissionConfig["mission"]>) {
    onChange({ ...mission, mission: { ...mission.mission, ...patch } });
  }

  function patchSource(index: number, patch: Record<string, unknown>) {
    onChange({
      ...mission,
      sources: mission.sources.map((source, i) =>
        i === index ? ({ ...source, ...patch } as MissionConfig["sources"][number]) : source,
      ),
    });
  }

  function addSource(kind: SourceKindId) {
    const id = slugify(SOURCE_KINDS.find((k) => k.id === kind)?.label ?? kind, mission.sources.map((s) => s.id));
    onChange({ ...mission, sources: [...mission.sources, newSource(kind, id)] });
  }

  function removeSource(index: number) {
    onChange({ ...mission, sources: mission.sources.filter((_, i) => i !== index) });
  }

  function exportMission() {
    if (!check.valid) {
      setMessage("Complétez la mission avant de l’exporter : un fichier invalide serait refusé par l’agent.");
      return;
    }
    const blob = new Blob([JSON.stringify(check.mission, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mission-${mission.mission.reference.trim() || "brouillon"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("mission.json exporté. Lancez « npm run inventaire -- --mission mission.json --out sortie ».");
  }

  async function importMission(file: File | null) {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const verdict = checkMission(parsed);
      if (!verdict.valid) {
        setMessage(`Fichier refusé : ${verdict.problems[0]?.where} — ${verdict.problems[0]?.message}`);
        return;
      }
      onChange(verdict.mission);
      setMessage("Mission reprise depuis le fichier.");
    } catch {
      setMessage("Ce fichier n’est pas un JSON lisible.");
    }
  }

  const scopeText = (mission.mission.scope ?? []).join("\n");

  return (
    <section className="ops-panel" aria-labelledby="ops-mission-editor">
      <h2 id="ops-mission-editor">Mission</h2>

      <div className="ops-prep-head">
        <label>
          <span>Client</span>
          <input
            type="text"
            value={mission.mission.client}
            placeholder="Nom du client"
            onChange={(event) => patchMission({ client: event.target.value })}
          />
        </label>
        <label>
          <span>Référence</span>
          <input
            type="text"
            value={mission.mission.reference}
            placeholder="PVD-2026-001"
            onChange={(event) => patchMission({ reference: event.target.value })}
          />
        </label>
        <label>
          <span>Opérateur</span>
          <input
            type="text"
            value={mission.mission.operator ?? ""}
            placeholder="Équipe terrain"
            onChange={(event) =>
              patchMission({ operator: event.target.value || undefined })
            }
          />
        </label>
        <label>
          <span>Référence DPA</span>
          <input
            type="text"
            value={mission.mission.dpaReference ?? ""}
            placeholder="DPA-2026-001"
            onChange={(event) =>
              patchMission({ dpaReference: event.target.value || undefined })
            }
          />
        </label>
      </div>

      <fieldset className="ops-mode">
        <legend>Mode de collecte</legend>
        {(
          [
            ["metadata_only", "Métadonnées seules", "Structures, volumétries, types. Aucune date de dernière écriture."],
            ["metadata_and_freshness", "Métadonnées et fraîcheur", "Ajoute un MAX sur les colonnes de date pour dater la dernière écriture."],
          ] as const
        ).map(([value, label, hint]) => (
          <label key={value} className={mission.mission.mode === value ? "is-active" : undefined}>
            <input
              type="radio"
              name="collection-mode"
              checked={mission.mission.mode === value}
              onChange={() => patchMission({ mode: value })}
            />
            <span>
              <strong>{label}</strong>
              <small>{hint}</small>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="ops-prep-notes">
        <span>Périmètre (une ligne par système annoncé)</span>
        <textarea
          rows={3}
          value={scopeText}
          placeholder={"ERP Dolibarr (PostgreSQL, lecture seule)\nExports commerciaux du dossier partagé"}
          onChange={(event) => {
            const scope = event.target.value
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean);
            patchMission({ scope: scope.length ? scope : undefined });
          }}
        />
      </label>

      <div className="ops-sources-head">
        <h3>Sources ({resume.sources})</h3>
        <div className="ops-source-add">
          {SOURCE_KINDS.map((kind) => {
            const Icon = KIND_ICONS[kind.id];
            return (
              <button key={kind.id} type="button" onClick={() => addSource(kind.id)} title={kind.hint}>
                <Plus size={13} aria-hidden="true" />
                <Icon size={13} aria-hidden="true" />
                {kind.label}
              </button>
            );
          })}
        </div>
      </div>

      {mission.sources.length === 0 ? (
        <p className="ops-note">
          Aucune source déclarée. Ajoutez-en une : chaque source devient une ligne du pack
          d’accès à obtenir du client, et une entrée du catalogue.
        </p>
      ) : (
        <ul className="ops-sources">
          {mission.sources.map((source, index) => {
            const kind = sourceKindOf(source);
            const Icon = KIND_ICONS[kind];
            return (
              <li key={`${source.id}-${index}`} data-kind={kind}>
                <div className="ops-source-top">
                  <Icon size={15} aria-hidden="true" />
                  <input
                    type="text"
                    className="ops-source-label"
                    value={source.label}
                    placeholder={`Nom lisible (${SOURCE_KINDS.find((k) => k.id === kind)?.label})`}
                    onChange={(event) => {
                      const label = event.target.value;
                      patchSource(index, {
                        label,
                        id: slugify(
                          label,
                          mission.sources.filter((_, i) => i !== index).map((s) => s.id),
                        ),
                      });
                    }}
                  />
                  <button
                    type="button"
                    className="ops-source-remove"
                    onClick={() => removeSource(index)}
                    aria-label={`Retirer ${source.label || "cette source"}`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
                <SourceFields
                  kind={kind}
                  source={source as Record<string, unknown>}
                  onPatch={(patch) => patchSource(index, patch)}
                />
              </li>
            );
          })}
        </ul>
      )}

      <div className={`ops-verdict ${check.valid ? "is-ok" : "is-ko"}`} role="status">
        {check.valid ? (
          <span>Mission valide — {resume.sources} source(s), prête à exporter.</span>
        ) : (
          <>
            <span>À compléter :</span>
            <ul>
              {check.problems.map((problem) => (
                <li key={`${problem.where}-${problem.message}`}>
                  <b>{problem.where}</b> — {problem.message}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="ops-prep-actions">
        <button type="button" onClick={exportMission}>
          <Download size={15} aria-hidden="true" />
          Exporter mission.json
        </button>
        <label className="ops-prep-import">
          <Upload size={15} aria-hidden="true" />
          <span>Reprendre une mission</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              void importMission(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            onChange(emptyMission());
            setMessage("Nouvelle mission vierge.");
          }}
        >
          <Plus size={15} aria-hidden="true" />
          Nouvelle mission
        </button>
      </div>

      {message ? (
        <p className="ops-note" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------
 * Champs propres à chaque type de source
 * ---------------------------------------------------------------------- */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="ops-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function SourceFields({
  kind,
  source,
  onPatch,
}: {
  kind: SourceKindId;
  source: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const text = (key: string) => String(source[key] ?? "");

  if (kind === "sql") {
    const executor = (source.executor ?? {}) as Record<string, unknown>;
    const mode = String(executor.type ?? "results");
    return (
      <div className="ops-source-fields">
        <Field label="Moteur">
          <select
            value={text("dialect")}
            onChange={(event) =>
              onPatch({ dialect: event.target.value, system: event.target.value })
            }
          >
            <option value="postgresql">PostgreSQL</option>
            <option value="mysql">MySQL / MariaDB</option>
            <option value="sqlserver">SQL Server</option>
          </select>
        </Field>

        <Field label="Accès" hint="La remise au DBA évite tout accès direct à la base.">
          <select
            value={mode}
            onChange={(event) =>
              onPatch(
                event.target.value === "results"
                  ? { executor: { type: "results", directory: "", format: "csv" } }
                  : {
                      executor: {
                        type: "command",
                        command: "psql",
                        args: ["-A", "--csv", "-c", "{{sql}}"],
                        format: "csv",
                        sqlOnStdin: false,
                        timeoutMs: 120_000,
                      },
                    },
              )
            }
          >
            <option value="results">Résultats remis par le DBA</option>
            <option value="command">Client SQL local (psql, mysql…)</option>
          </select>
        </Field>

        {mode === "results" ? (
          <Field label="Dossier des résultats" hint="Contient tables.csv, columns.csv, primary_keys.csv, foreign_keys.csv.">
            <input
              type="text"
              value={String(executor.directory ?? "")}
              placeholder="C:\\missions\\client\\resultats"
              onChange={(event) =>
                onPatch({ executor: { ...executor, directory: event.target.value } })
              }
            />
          </Field>
        ) : (
          <Field label="Client SQL" hint="Nom nu, sans chemin. Seuls psql, mysql, mariadb, sqlcmd, bcp et sqlite3 sont admis.">
            <input
              type="text"
              value={String(executor.command ?? "")}
              placeholder="psql"
              onChange={(event) =>
                onPatch({ executor: { ...executor, command: event.target.value } })
              }
            />
          </Field>
        )}

        <Field label="Compte de lecture" hint="Nom du compte, jamais son mot de passe.">
          <input
            type="text"
            value={text("readOnlyAccount")}
            placeholder="preuvance_ro"
            onChange={(event) => onPatch({ readOnlyAccount: event.target.value || undefined })}
          />
        </Field>
      </div>
    );
  }

  if (kind === "file") {
    return (
      <div className="ops-source-fields">
        <Field label="Dossier" hint="Parcouru récursivement. Le contenu métier n’est jamais ouvert.">
          <input
            type="text"
            value={text("directory")}
            placeholder="\\\\serveur\\partage\\exports"
            onChange={(event) => onPatch({ directory: event.target.value })}
          />
        </Field>
        <Field label="Extensions" hint="Séparées par une virgule.">
          <input
            type="text"
            value={(source.extensions as string[] | undefined)?.join(", ") ?? ""}
            placeholder=".csv, .xlsx"
            onChange={(event) =>
              onPatch({
                extensions: event.target.value
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field>
        <Field label="Plafond de fichiers">
          <input
            type="number"
            min={1}
            max={5000}
            value={Number(source.maxFiles ?? 200)}
            onChange={(event) => onPatch({ maxFiles: Number(event.target.value) })}
          />
        </Field>
      </div>
    );
  }

  if (kind === "salesforce") {
    return (
      <div className="ops-source-fields">
        <Field label="URL de l’instance">
          <input
            type="url"
            value={text("instanceUrl")}
            placeholder="https://client.my.salesforce.com"
            onChange={(event) => onPatch({ instanceUrl: event.target.value })}
          />
        </Field>
        <Field label="Variable du jeton" hint="Le jeton lui-même reste dans l’environnement du poste.">
          <input
            type="text"
            value={text("tokenEnv")}
            placeholder="SALESFORCE_TOKEN"
            onChange={(event) => onPatch({ tokenEnv: event.target.value.toUpperCase() })}
          />
        </Field>
        <Field label="Plafond d’objets">
          <input
            type="number"
            min={1}
            max={1000}
            value={Number(source.maxObjects ?? 200)}
            onChange={(event) => onPatch({ maxObjects: Number(event.target.value) })}
          />
        </Field>
      </div>
    );
  }

  return (
    <div className="ops-source-fields">
      <Field label="URL de l’API">
        <input
          type="url"
          value={text("baseUrl")}
          placeholder="https://client.fr/api/index.php"
          onChange={(event) => onPatch({ baseUrl: event.target.value })}
        />
      </Field>
      <Field label="Variable de la clé" hint="La clé elle-même reste dans l’environnement du poste.">
        <input
          type="text"
          value={text("apiKeyEnv")}
          placeholder="DOLIBARR_API_KEY"
          onChange={(event) => onPatch({ apiKeyEnv: event.target.value.toUpperCase() })}
        />
      </Field>
      <Field label="Plafond de ressources">
        <input
          type="number"
          min={1}
          max={500}
          value={Number(source.maxResources ?? 60)}
          onChange={(event) => onPatch({ maxResources: Number(event.target.value) })}
        />
      </Field>
      <Field label="Lecture d’une fiche réelle" hint="Opt-in : retrouve des noms de champs, lit une fiche.">
        <select
          value={source.allowRecordProbe ? "oui" : "non"}
          onChange={(event) => onPatch({ allowRecordProbe: event.target.value === "oui" })}
        >
          <option value="non">Non</option>
          <option value="oui">Oui</option>
        </select>
      </Field>
    </div>
  );
}
