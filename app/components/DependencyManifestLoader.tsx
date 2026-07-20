"use client";

import { useId, useState } from "react";
import {
  Braces,
  CheckCircle2,
  FileSearch,
  PackageSearch,
  ShieldCheck,
  X,
} from "lucide-react";

import {
  dependencyDigestSchema,
  type DependencyDigest,
  type DependencyFinding,
  type DependencyManifest,
} from "@/lib/scan/dependency-contract";
import {
  deduplicateDependencyFindings,
  DEPENDENCY_MANIFEST_MAX_BYTES,
  scanDependencyManifest,
} from "@/lib/scan/dependency-scanner";

type DependencyManifestLoaderProps = {
  value?: DependencyDigest;
  onChange: (value: DependencyDigest | undefined) => void;
};

export function DependencyManifestLoader({
  value,
  onChange,
}: DependencyManifestLoaderProps) {
  const inputId = useId();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function scanFiles(files: FileList | null) {
    if (!files?.length) return;
    if (files.length > 10) {
      setError("Sélectionnez au maximum dix manifestes à la fois.");
      return;
    }
    setIsScanning(true);
    setError(null);

    try {
      const manifests: DependencyManifest[] = [];
      const dependencies: DependencyFinding[] = [];
      const warnings: string[] = [];

      for (const file of Array.from(files)) {
        if (file.size > DEPENDENCY_MANIFEST_MAX_BYTES) {
          throw new Error(`${file.name} dépasse la limite de 1 Mo.`);
        }
        const content = await file.text();
        const result = scanDependencyManifest(file.name, content);
        const sha256 = await hashFile(file);
        manifests.push({
          name: file.name.slice(0, 240),
          kind: result.kind,
          sha256,
          byteSize: file.size,
        });
        dependencies.push(...result.dependencies);
        warnings.push(...result.warnings);
      }

      const digest: DependencyDigest = {
        schemaVersion: "preuvance-dependency-digest-v1",
        scannedAt: new Date().toISOString(),
        manifests,
        dependencies: deduplicateDependencyFindings(dependencies),
        warnings: [...new Set(warnings)].slice(0, 20),
        coverage: {
          supportedManifestTypes: [
            "package-json",
            "package-lock",
            "requirements",
          ],
          statement:
            "Détection bornée aux packages IA reconnus dans package.json, package-lock.json et requirements*.txt ; ce résultat n’est pas un inventaire exhaustif du code ou du réseau.",
        },
      };
      onChange(dependencyDigestSchema.parse(digest));
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : "Les manifestes n’ont pas pu être analysés.",
      );
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <section className="pv-dependency-loader" aria-labelledby={`${inputId}-title`}>
      <div className="pv-dependency-heading">
        <span aria-hidden="true"><PackageSearch size={20} /></span>
        <div>
          <p className="pv-kicker">Source technique facultative</p>
          <h3 id={`${inputId}-title`}>Scanner les dépendances IA du projet</h3>
          <p>
            Ajoutez les manifestes pris en charge. L’analyse et les empreintes sont calculées dans le navigateur ; seul le digest expurgé rejoint l’évaluation.
          </p>
        </div>
      </div>

      {!value ? (
        <label className="pv-dependency-drop" htmlFor={inputId}>
          <FileSearch size={22} aria-hidden="true" />
          <span>
            <strong>{isScanning ? "Analyse en cours…" : "Choisir les manifestes"}</strong>
            <small>package.json · package-lock.json · requirements*.txt · 1 Mo maximum par fichier</small>
          </span>
          <input
            id={inputId}
            type="file"
            multiple
            accept=".json,.txt,application/json,text/plain"
            disabled={isScanning}
            onChange={(event) => void scanFiles(event.target.files)}
          />
        </label>
      ) : (
        <div className="pv-dependency-result">
          <div className="pv-dependency-result-head">
            <CheckCircle2 size={18} aria-hidden="true" />
            <div>
              <strong>{value.dependencies.length} dépendance{value.dependencies.length === 1 ? "" : "s"} IA reconnue{value.dependencies.length === 1 ? "" : "s"}</strong>
              <span>{value.manifests.length} manifeste{value.manifests.length === 1 ? "" : "s"} · contenu non transmis</span>
            </div>
            <button type="button" onClick={() => onChange(undefined)} aria-label="Retirer le digest de dépendances">
              <X size={17} aria-hidden="true" />
            </button>
          </div>
          {value.dependencies.length ? (
            <ul className="pv-dependency-list">
              {value.dependencies.slice(0, 12).map((dependency) => (
                <li key={`${dependency.packageName}-${dependency.manifestName}`}>
                  <Braces size={15} aria-hidden="true" />
                  <span><strong>{dependency.packageName}</strong>{dependency.version ? ` ${dependency.version}` : ""}</span>
                  <small>{dependency.provider ?? dependency.category} · {dependency.direct ? "directe" : "transitive"}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pv-dependency-empty">
              Aucun package du catalogue n’a été reconnu. Cela ne prouve pas l’absence d’IA : le code source et le trafic réseau ne sont pas analysés ici.
            </p>
          )}
          <p className="pv-dependency-safety">
            <ShieldCheck size={15} aria-hidden="true" />
            Le digest contient seulement noms de packages, versions, caractère direct/transitif, nom et empreinte du manifeste.
          </p>
        </div>
      )}

      {error ? <p className="pv-field-error" role="alert">{error}</p> : null}
    </section>
  );
}

async function hashFile(file: File) {
  const digest = await window.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
