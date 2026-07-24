import type { MissionConfig } from "@/lib/inventory/mission-config";
import type { PurgeLog } from "@/lib/inventory/mission-log";

import type {
  AccessPackItem,
  CompletionContext,
  ProcessingContext,
} from "./documents";

/**
 * Passerelle entre le fichier de mission de l'agent et les documents
 * administratifs.
 *
 * Le périmètre annoncé au client, celui écrit au contrat de sous-traitance et
 * celui réellement collecté par l'agent proviennent ainsi de la même source.
 * Une source ajoutée au fichier de mission apparaît automatiquement dans le
 * pack d'accès et dans le registre : c'est ce qui empêche le contrat de
 * décrire une mission différente de celle qui est exécutée.
 */
export const ADMIN_FROM_MISSION_VERSION = "preuvance-admin-from-mission-v1";

/** Libellé du mode d'accès, dérivé du type de source et de son exécuteur. */
export function accessMethodFor(source: MissionConfig["sources"][number]): string {
  if (source.kind === "sql") {
    if (source.executor.type === "results") {
      return "Requêtes de lecture seule remises au DBA du client, résultats rendus en CSV (aucun accès direct)";
    }
    return source.readOnlyAccount
      ? `Compte de lecture seule « ${source.readOnlyAccount} » sur les catalogues système`
      : "Compte de lecture seule à créer sur les catalogues système";
  }
  if (source.kind === "file") {
    return source.directory
      ? `Accès en lecture au dossier « ${source.directory} »`
      : "Accès en lecture aux fichiers d’export désignés";
  }
  if (source.system === "salesforce") {
    return `Jeton d’API en lecture (variable ${source.tokenEnv}) ; le droit « View Setup and Configuration » conditionne la volumétrie`;
  }
  return `Clé d’API d’un utilisateur en lecture (variable ${source.apiKeyEnv}), module API REST actif`;
}

function ownerFor(source: MissionConfig["sources"][number]): string {
  if (source.kind === "sql") return "DSI / administrateur de base de données";
  if (source.kind === "file") return "Référent métier";
  return "Administrateur de l’outil";
}

export function accessPackItemsFromMission(mission: MissionConfig): AccessPackItem[] {
  return mission.sources.map((source) => ({
    system: source.label,
    kind: source.kind,
    method: accessMethodFor(source),
    owner: ownerFor(source),
  }));
}

export function processingContextFromMission(
  mission: MissionConfig,
  options: {
    retentionDays?: number;
    hosting?: string;
    dataSubjects?: string[];
    subProcessors?: string[];
  } = {},
): ProcessingContext {
  return {
    systems: mission.sources.map((source) => source.label),
    collectionMode: mission.mission.mode,
    retentionDays: options.retentionDays ?? 30,
    hosting:
      options.hosting ??
      "poste de travail désigné par le client, sans hébergement distant ni service tiers",
    subProcessors: options.subProcessors ?? [],
    dataSubjects: options.dataSubjects ?? [],
  };
}

/**
 * Comptes et jetons à révoquer en fin de mission. Ce qui a été ouvert doit
 * être refermé, et la liste doit exister pour que ce soit vérifiable.
 */
export function accountsToRevokeFromMission(mission: MissionConfig): string[] {
  const accounts: string[] = [];
  for (const source of mission.sources) {
    if (source.kind === "sql" && source.executor.type === "command") {
      accounts.push(
        source.readOnlyAccount
          ? `Compte de lecture « ${source.readOnlyAccount} » sur ${source.label}`
          : `Compte de lecture créé pour ${source.label}`,
      );
    }
    if (source.kind === "api") {
      const variable = source.system === "salesforce" ? source.tokenEnv : source.apiKeyEnv;
      accounts.push(`Jeton d’API de ${source.label} (fourni via ${variable})`);
    }
  }
  return accounts;
}

export function completionContextFromArtefacts(options: {
  mission: MissionConfig;
  completedOn: string;
  purgeLog?: PurgeLog;
  score?: { value: number; tier: string; summary: string };
  deliverables?: string[];
}): CompletionContext {
  const purged = (options.purgeLog?.artefacts ?? [])
    .filter((artefact) => artefact.outcome !== "missing")
    .map((artefact) => ({
      name: artefact.name,
      sha256: artefact.sha256,
      outcome:
        artefact.outcome === "deleted"
          ? "supprimé"
          : "conservé à la demande de l’opérateur",
    }));

  return {
    completedOn: options.completedOn,
    deliverables:
      options.deliverables ?? [
        "Catalogue des sources (preuvance-catalogue.json), propriété du client",
        "Rapport de diagnostic (Markdown)",
        "Rapport de diagnostic (HTML imprimable en PDF)",
        "Journal de suppression des artefacts",
      ],
    purged,
    score: options.score,
    accountsToRevoke: accountsToRevokeFromMission(options.mission),
  };
}
