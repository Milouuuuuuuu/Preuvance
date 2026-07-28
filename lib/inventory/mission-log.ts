import { z } from "zod";

/**
 * Journal de fin de mission : la preuve vérifiable de la suppression.
 *
 * Le pack juridique promet la réversibilité et l'effacement des caches en fin
 * de mission. Une promesse non vérifiable ne vaut rien : ce journal liste
 * chaque artefact produit par l'agent, son empreinte SHA-256 calculée AVANT
 * suppression, sa taille et son sort. Le client peut donc vérifier a posteriori
 * qu'un fichier qu'il détient est bien celui qui a été supprimé, et qu'aucun
 * autre n'a été conservé.
 */
export const PURGE_LOG_VERSION = "preuvance-purge-v1";

export const PURGE_STATEMENT =
  "Chaque artefact listé a été supprimé du poste d’exécution après calcul de son empreinte. Preuvance ne conserve aucune copie ailleurs : le catalogue et le rapport n’ont jamais quitté ce poste.";

const isoDateTime = z
  .string()
  .trim()
  .max(40)
  .refine((value) => Number.isFinite(Date.parse(value)), "date ISO invalide");

export const purgeArtefactSchema = z
  .object({
    /** Nom de fichier seul : le chemin complet reste sur le poste. */
    name: z.string().trim().min(1).max(200),
    sizeBytes: z.number().int().min(0),
    sha256: z
      .string()
      .trim()
      .regex(/^[0-9a-f]{64}$/i, "empreinte SHA-256 invalide"),
    outcome: z.enum(["deleted", "kept_by_operator", "missing"]),
    reason: z.string().trim().max(300).optional(),
  })
  .strict();

export const purgeLogSchema = z
  .object({
    schemaVersion: z.literal(PURGE_LOG_VERSION),
    missionReference: z.string().trim().min(1).max(80),
    client: z.string().trim().min(1).max(200),
    operator: z.string().trim().max(200).optional(),
    purgedAt: isoDateTime,
    artefacts: z.array(purgeArtefactSchema).max(500),
    statement: z.literal(PURGE_STATEMENT),
  })
  .strict();

export type PurgeArtefact = z.infer<typeof purgeArtefactSchema>;
export type PurgeLog = z.infer<typeof purgeLogSchema>;

export function buildPurgeLog(input: {
  missionReference: string;
  client: string;
  operator?: string;
  purgedAt: string;
  artefacts: PurgeArtefact[];
}): PurgeLog {
  return purgeLogSchema.parse({
    schemaVersion: PURGE_LOG_VERSION,
    missionReference: input.missionReference,
    client: input.client,
    operator: input.operator,
    purgedAt: input.purgedAt,
    artefacts: [...input.artefacts].sort((a, b) => a.name.localeCompare(b.name)),
    statement: PURGE_STATEMENT,
  });
}

/** Rendu texte remis au client, lisible sans outil. */
export function renderPurgeLog(log: PurgeLog): string {
  const lines = [
    `PREUVANCE : journal de suppression de fin de mission`,
    `Mission   : ${log.missionReference}`,
    `Client    : ${log.client}`,
    log.operator ? `Opérateur : ${log.operator}` : null,
    `Date      : ${log.purgedAt}`,
    "",
    "Artefacts :",
  ].filter((line): line is string => line !== null);

  for (const artefact of log.artefacts) {
    const outcome =
      artefact.outcome === "deleted"
        ? "supprimé"
        : artefact.outcome === "kept_by_operator"
          ? "conservé à la demande de l’opérateur"
          : "introuvable au moment de la purge";
    lines.push(
      `  - ${artefact.name} (${artefact.sizeBytes} octets), ${outcome}`,
      `    sha256 ${artefact.sha256}`,
    );
    if (artefact.reason) lines.push(`    motif : ${artefact.reason}`);
  }

  lines.push("", log.statement);
  return lines.join("\n");
}
