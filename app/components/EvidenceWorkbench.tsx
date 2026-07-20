"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import {
  Check,
  Download,
  FileKey2,
  FilePlus2,
  Fingerprint,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import {
  calculateEvidenceCoverage,
  EVIDENCE_LEDGER_LIMIT,
  evidenceLayer,
  evidenceLedgerSchema,
  evidenceSourceTypes,
  evidenceStatuses,
  stableEvidenceId,
  type EvidenceLedgerItem,
  type EvidenceSourceType,
  type EvidenceStatus,
} from "@/lib/evidence/evidence-ledger";

type EvidenceWorkbenchProps = {
  assessmentId: string;
  evidence: EvidenceLedgerItem[];
  onChange: (items: EvidenceLedgerItem[]) => void;
  persistenceStatus: string | null;
};

export type EvidenceWorkbenchHandle = {
  save: () => Promise<boolean>;
};

type SaveState = "idle" | "loading" | "saved" | "error";

const STATUS_LABELS: Record<EvidenceStatus, string> = {
  verified: "Attesté · relecteur et date renseignés",
  documented: "Pièce disponible · à revoir",
  detected: "Détecté techniquement",
  declared: "Déclaré · non vérifié",
  partial: "Partiellement étayé",
  missing: "Pièce manquante",
  unverified: "Non vérifié",
  "not-applicable": "Non applicable",
};

const SOURCE_LABELS: Record<EvidenceSourceType, string> = {
  "model-extraction": "Analyse structurée du modèle",
  "user-declaration": "Déclaration utilisateur",
  "local-scan": "Scan local Preuvance",
  "dependency-scan": "Scan de manifestes du projet",
  document: "Document local",
  policy: "Politique ou procédure",
  test: "Test ou journal technique",
  contract: "Contrat ou engagement tiers",
  other: "Autre source",
};

const LAYER_LABELS = {
  missing: "À fournir",
  declared: "Déclaré",
  detected: "Détecté",
  proven: "Prouvé / attesté",
  "not-applicable": "Hors périmètre",
} as const;

const MAX_LOCAL_FILE_BYTES = 25_000_000;

export const EvidenceWorkbench = forwardRef<
  EvidenceWorkbenchHandle,
  EvidenceWorkbenchProps
>(function EvidenceWorkbench(
  { assessmentId, evidence, onChange, persistenceStatus },
  ref,
) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [newControl, setNewControl] = useState("");
  const coverage = useMemo(() => calculateEvidenceCoverage(evidence), [evidence]);
  const storageKey = `preuvance:evidence:${assessmentId}`;

  useEffect(() => {
    const controller = new AbortController();

    async function loadEvidence() {
      try {
        if (persistenceStatus === "persisted") {
          const response = await fetch(`/api/assessments/${assessmentId}/evidence`, {
            headers: { Accept: "application/json" },
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) return;
          const payload: unknown = await response.json();
          if (
            typeof payload === "object" &&
            payload !== null &&
            "evidence" in payload &&
            "revision" in payload &&
            typeof payload.revision === "number" &&
            Number.isInteger(payload.revision) &&
            payload.revision >= 0
          ) {
            const validation = evidenceLedgerSchema.safeParse(payload.evidence);
            if (validation.success) {
              onChange(validation.data);
              setRevision(payload.revision);
            }
          }
          return;
        }

        const stored = window.localStorage.getItem(storageKey);
        if (!stored) return;
        const validation = evidenceLedgerSchema.safeParse(JSON.parse(stored) as unknown);
        if (validation.success) onChange(validation.data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage("Le registre existant n’a pas pu être relu ; le dossier initial reste disponible.");
      }
    }

    void loadEvidence();
    return () => controller.abort();
  }, [assessmentId, onChange, persistenceStatus, storageKey]);

  async function save() {
    setSaveState("loading");
    setMessage(null);
    const validation = evidenceLedgerSchema.safeParse(evidence);
    if (!validation.success) {
      setSaveState("error");
      setMessage(
        validation.error.issues[0]?.message ??
          "Le registre contient une pièce incomplète.",
      );
      return false;
    }

    try {
      if (persistenceStatus === "persisted") {
        const response = await fetch(`/api/assessments/${assessmentId}/evidence`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ evidence: validation.data, revision }),
        });
        if (!response.ok) {
          const payload: unknown = await response.json().catch(() => null);
          const detail =
            typeof payload === "object" &&
            payload !== null &&
            "detail" in payload &&
            typeof payload.detail === "string"
              ? payload.detail
              : "Le registre n’a pas pu être enregistré.";
          throw new Error(detail);
        }
        const payload: unknown = await response.json();
        if (
          typeof payload !== "object" ||
          payload === null ||
          !("evidence" in payload) ||
          !("revision" in payload) ||
          typeof payload.revision !== "number" ||
          !Number.isInteger(payload.revision) ||
          payload.revision < 0
        ) {
          throw new Error("Le serveur a renvoyé une version de registre invalide.");
        }
        const persisted = evidenceLedgerSchema.safeParse(payload.evidence);
        if (!persisted.success) {
          throw new Error("Le serveur a renvoyé un registre invalide.");
        }
        setRevision(payload.revision);
        onChange(persisted.data);
      } else {
        window.localStorage.setItem(storageKey, JSON.stringify(validation.data));
      }

      setSaveState("saved");
      setMessage(
        persistenceStatus === "persisted"
          ? "Registre enregistré dans le dossier protégé. Le prochain PDF utilisera ces états."
          : "Registre conservé dans ce navigateur. Aucun contenu de fichier n’a été envoyé.",
      );
      return true;
    } catch (error) {
      setSaveState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Le registre n’a pas pu être enregistré.",
      );
      return false;
    }
  }

  useImperativeHandle(ref, () => ({ save }));

  function updateItem(id: string, patch: Partial<EvidenceLedgerItem>) {
    const updatedAt = new Date().toISOString();
    onChange(
      evidence.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt } : item,
      ),
    );
    setSaveState("idle");
    setMessage(null);
  }

  async function attachLocalFile(id: string, file: File | null) {
    if (!file) return;
    if (file.size > MAX_LOCAL_FILE_BYTES) {
      setSaveState("error");
      setMessage("La pièce dépasse 25 Mo. Ajoutez plutôt sa référence ou une version allégée.");
      return;
    }

    try {
      const digest = await window.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const sha256 = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      updateItem(id, {
        status: "documented",
        sourceType: "document",
        sourceLabel: "Pièce locale pointée dans le navigateur",
        fileName: file.name.slice(0, 240),
        fileSizeBytes: file.size,
        sha256,
        collectedAt: new Date().toISOString(),
        reviewedBy: undefined,
        reviewedAt: undefined,
      });
      setMessage(
        "Empreinte calculée localement. Le nom, la taille et le SHA-256 entrent dans le manifeste ; le contenu reste sur votre poste.",
      );
    } catch {
      setSaveState("error");
      setMessage("L’empreinte de cette pièce n’a pas pu être calculée.");
    }
  }

  function addEvidence() {
    const control = newControl.trim();
    if (!control || evidence.length >= EVIDENCE_LEDGER_LIMIT) return;
    const now = new Date().toISOString();
    const id =
      typeof window.crypto.randomUUID === "function"
        ? `ev-${window.crypto.randomUUID()}`
        : stableEvidenceId(assessmentId, control, evidence.length);
    onChange([
      ...evidence,
      {
        id,
        control: control.slice(0, 500),
        status: "missing",
        detail: "Pièce ajoutée au registre ; source et validation à compléter.",
        sourceType: "user-declaration",
        updatedAt: now,
      },
    ]);
    setNewControl("");
    setSaveState("idle");
  }

  function exportManifest() {
    const validation = evidenceLedgerSchema.safeParse(evidence);
    if (!validation.success) {
      setSaveState("error");
      setMessage("Corrigez les pièces incomplètes avant d’exporter le manifeste.");
      return;
    }
    const manifest = {
      schemaVersion: "preuvance-evidence-manifest-v1",
      assessmentId,
      exportedAt: new Date().toISOString(),
      coverage,
      privacy: "Métadonnées et empreintes uniquement ; aucun contenu de fichier inclus.",
      evidence: validation.data,
    };
    const objectUrl = window.URL.createObjectURL(
      new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `preuvance-manifeste-${assessmentId}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1_000);
  }

  return (
    <div className="pv-evidence-workbench">
      <div className="pv-evidence-overview">
        <div className="pv-proof-score" aria-label={`Couverture de preuve ${coverage.score} sur 100`}>
          <span>Couverture documentaire</span>
          <strong>{coverage.score}<small>/100</small></strong>
          <p>Indépendante du score réglementaire : elle mesure l’étayage disponible, pas une conformité certifiée.</p>
        </div>
        <ol className="pv-proof-ladder" aria-label="Déclaré, détecté, prouvé">
          <li>
            <span>01</span>
            <div><strong>Déclaré</strong><small>{coverage.declared} élément(s)</small></div>
          </li>
          <li>
            <span>02</span>
            <div><strong>Détecté</strong><small>{coverage.detected} élément(s)</small></div>
          </li>
          <li>
            <span>03</span>
            <div><strong>Prouvé</strong><small>{coverage.proven} élément(s)</small></div>
          </li>
        </ol>
        <p className="pv-proof-assurance-note">
          {persistenceStatus === "persisted"
            ? "« Prouvé » signifie ici qu’un membre connecté a enregistré un relecteur et une date ; ce n’est pas une certification externe."
            : "En mode local, « Prouvé » reste une attestation saisie dans ce navigateur ; l’identité du relecteur n’est pas authentifiée."}
        </p>
      </div>

      <div className="pv-evidence-toolbar">
        <div>
          <strong>{evidence.length} contrôle{evidence.length === 1 ? "" : "s"} dans le registre</strong>
          <span>{coverage.considered} pris en compte · {coverage.missing} à fournir · {coverage.excluded} hors périmètre</span>
        </div>
        <div className="pv-evidence-actions">
          <button className="pv-secondary-button" type="button" onClick={exportManifest}>
            <Download size={16} aria-hidden="true" />
            Exporter le manifeste
          </button>
          <button className="pv-primary-button" type="button" onClick={() => void save()} disabled={saveState === "loading"}>
            <Save size={16} aria-hidden="true" />
            {saveState === "loading" ? "Enregistrement…" : "Enregistrer le registre"}
          </button>
        </div>
      </div>

      {message ? (
        <p className={`pv-evidence-message ${saveState === "error" ? "is-error" : ""}`} role={saveState === "error" ? "alert" : "status"}>
          {saveState === "saved" ? <Check size={16} aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}
          {message}
        </p>
      ) : null}

      <div className="pv-evidence-items">
        {evidence.map((item, index) => {
          const layer = evidenceLayer(item.status);
          return (
            <details className="pv-evidence-item" key={item.id}>
              <summary>
                <span className={`pv-evidence-layer is-${layer}`}>{LAYER_LABELS[layer]}</span>
                <span className="pv-evidence-summary-copy">
                  <strong>{item.control}</strong>
                  <small>{STATUS_LABELS[item.status]} · {SOURCE_LABELS[item.sourceType]}</small>
                </span>
                <span className="pv-evidence-number">{String(index + 1).padStart(2, "0")}</span>
              </summary>
              <div className="pv-evidence-editor">
                <div className="pv-evidence-field-grid">
                  <label>
                    <span>État de la preuve</span>
                    <select value={item.status} onChange={(event) => {
                      const status = event.target.value as EvidenceStatus;
                      updateItem(item.id, {
                        status,
                        reviewedBy: status === "verified" ? item.reviewedBy : undefined,
                        reviewedAt: status === "verified" ? item.reviewedAt : undefined,
                      });
                    }}>
                      {evidenceStatuses.map((status) => (
                        <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Type de source</span>
                    <select value={item.sourceType} onChange={(event) => updateItem(item.id, { sourceType: event.target.value as EvidenceSourceType })}>
                      {evidenceSourceTypes.map((source) => (
                        <option key={source} value={source}>{SOURCE_LABELS[source]}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Responsable</span>
                    <input value={item.owner ?? ""} maxLength={160} placeholder="Ex. Responsable sécurité" onChange={(event) => updateItem(item.id, { owner: event.target.value || undefined })} />
                  </label>
                  <label>
                    <span>Valide jusqu’au</span>
                    <input type="date" value={item.validUntil ?? ""} onChange={(event) => updateItem(item.id, { validUntil: event.target.value || undefined })} />
                  </label>
                </div>

                <label className="pv-evidence-detail-field">
                  <span>Constat et portée</span>
                  <textarea value={item.detail} maxLength={1500} rows={3} onChange={(event) => updateItem(item.id, { detail: event.target.value })} />
                </label>

                {item.status === "verified" ? (
                  <div className="pv-evidence-review-fields">
                    <label>
                      <span>Relecteur humain requis</span>
                      <input value={item.reviewedBy ?? ""} maxLength={160} placeholder="Nom ou fonction" onChange={(event) => updateItem(item.id, { reviewedBy: event.target.value || undefined })} />
                    </label>
                    <label>
                      <span>Date de revue</span>
                      <input type="datetime-local" value={item.reviewedAt?.slice(0, 16) ?? ""} onChange={(event) => updateItem(item.id, { reviewedAt: event.target.value ? new Date(event.target.value).toISOString() : undefined })} />
                    </label>
                  </div>
                ) : null}

                {item.fileName && item.sha256 ? (
                  <div className="pv-file-fingerprint">
                    <FileKey2 size={18} aria-hidden="true" />
                    <div>
                      <strong>{item.fileName}</strong>
                      <span>{formatBytes(item.fileSizeBytes ?? 0)} · SHA-256 {item.sha256}</span>
                    </div>
                  </div>
                ) : null}

                <div className="pv-evidence-editor-actions">
                  <label className="pv-file-button">
                    <Fingerprint size={16} aria-hidden="true" />
                    Pointer une pièce locale
                    <input type="file" onChange={(event) => void attachLocalFile(item.id, event.target.files?.[0] ?? null)} />
                  </label>
                  <button className="pv-text-danger" type="button" onClick={() => onChange(evidence.filter((candidate) => candidate.id !== item.id))}>
                    <Trash2 size={15} aria-hidden="true" />
                    Retirer du registre
                  </button>
                </div>
              </div>
            </details>
          );
        })}
      </div>

      <div className="pv-evidence-add">
        <FilePlus2 size={18} aria-hidden="true" />
        <label>
          <span>Ajouter un contrôle ou une pièce attendue</span>
          <input value={newControl} maxLength={500} placeholder="Ex. Procédure de revue humaine" onChange={(event) => setNewControl(event.target.value)} />
        </label>
        <button type="button" onClick={addEvidence} disabled={!newControl.trim() || evidence.length >= EVIDENCE_LEDGER_LIMIT}>
          <Plus size={16} aria-hidden="true" />
          Ajouter
        </button>
      </div>

      <p className="pv-evidence-privacy">
        Le navigateur lit seulement le nom, la taille et l’empreinte SHA-256 des fichiers sélectionnés. Le contenu n’est ni copié dans le manifeste, ni téléversé par ce parcours.
      </p>
    </div>
  );
});

function formatBytes(bytes: number) {
  if (bytes < 1_000) return `${bytes} o`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1_000)} Ko`;
  return `${(bytes / 1_000_000).toFixed(1).replace(".", ",")} Mo`;
}
