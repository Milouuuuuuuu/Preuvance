import { z } from "zod";

/**
 * Plan de préparation d'une mission : la liste de ce qu'il faut obtenir, les
 * notes prises en chemin, et le prompt qui en découle.
 *
 * Ce module n'importe rien de Node : il tourne dans le navigateur comme dans un
 * script. C'est la raison pour laquelle il ne dépend pas de
 * `lib/inventory/mission-config`, dont la chaîne d’imports atteint `node:fs`.
 *
 * Les sept éléments ci-dessous n'existaient que sous forme de tableau dans un
 * document. Un tableau ne se coche pas, ne se compte pas et ne génère rien : en
 * faire des données permet à l'interface et aux documents de mission de dire la
 * même chose sans que personne ne recopie quoi que ce soit.
 */

export const PREPARATION_VERSION = "preuvance-preparation-v1";

export type PreparationItem = {
  /** Identifiant stable : il est écrit dans le plan enregistré, il ne change pas. */
  id: string;
  label: string;
  /** À qui l'élément incombe. `conjoint` = responsabilité partagée client/prestataire. */
  owner: "client" | "dsi" | "metier" | "direction" | "prestataire" | "conjoint";
  /** Jour visé, relatif au démarrage : J-5 signifie cinq jours avant J1. */
  deadline: string;
  /** Ce que l'absence de cet élément coûte concrètement. */
  consequence: string;
};

export const OWNER_LABELS: Record<PreparationItem["owner"], string> = {
  client: "Client",
  dsi: "DSI / DBA",
  metier: "Métier",
  direction: "Direction",
  prestataire: "Prestataire",
  conjoint: "Client et prestataire",
};

export const PREPARATION_ITEMS: readonly PreparationItem[] = [
  {
    id: "perimetre",
    label: "Liste des systèmes au périmètre (nom, éditeur, hébergement, référent)",
    owner: "client",
    deadline: "J-5",
    consequence: "Sans elle, le périmètre se découvre pendant la mission et le délai glisse.",
  },
  {
    id: "compte-lecture",
    label: "Compte de lecture seule par base, ou accord pour la remise au DBA",
    owner: "dsi",
    deadline: "J-3",
    consequence: "La base devient une source injoignable : elle plafonne le score, écrite comme telle.",
  },
  {
    id: "jeton-api",
    label: "Jeton d’API en lecture pour les outils métier retenus",
    owner: "dsi",
    deadline: "J-3",
    consequence: "L’outil n’est pas inventorié ; son absence d’observation ne vaut pas absence de risque.",
  },
  {
    id: "exports",
    label: "Chemin des dossiers d’exports (CSV/Excel) et droit de lecture",
    owner: "metier",
    deadline: "J-3",
    consequence: "Les fichiers partagés restent hors cartographie, alors qu’ils portent souvent le plus de données personnelles.",
  },
  {
    id: "dpa",
    label: "DPA signé et périmètre écrit",
    owner: "direction",
    deadline: "J-3",
    consequence: "Bloquant réel : sans base contractuelle, la collecte ne commence pas.",
  },
  {
    id: "creneaux",
    label: "Deux créneaux d’une heure avec les métiers, posés au calendrier",
    owner: "client",
    deadline: "J-1",
    consequence: "Le diagnostic reste technique et ne se confronte jamais à l’usage réel.",
  },
  {
    id: "poste-agent",
    label: "Poste d’exécution de l’agent (poste opérateur ou VM du client)",
    owner: "conjoint",
    deadline: "J-1",
    consequence: "Rien ne peut être collecté : l’agent doit tourner quelque part.",
  },
] as const;

const ITEM_IDS = PREPARATION_ITEMS.map((item) => item.id);

/** État d'un élément : coché ou non, avec la note prise à son sujet. */
export const preparationEntrySchema = z
  .object({
    id: z.enum(ITEM_IDS as [string, ...string[]]),
    done: z.boolean(),
    note: z.string().max(2000).default(""),
  })
  .strict();

export const preparationPlanSchema = z
  .object({
    version: z.literal(PREPARATION_VERSION),
    client: z.string().trim().max(200).default(""),
    reference: z.string().trim().max(80).default(""),
    entries: z.array(preparationEntrySchema).max(PREPARATION_ITEMS.length),
    notes: z.string().max(20000).default(""),
  })
  .strict();

export type PreparationPlan = z.infer<typeof preparationPlanSchema>;

export function emptyPlan(): PreparationPlan {
  return {
    version: PREPARATION_VERSION,
    client: "",
    reference: "",
    entries: PREPARATION_ITEMS.map((item) => ({ id: item.id, done: false, note: "" })),
    notes: "",
  };
}

export type PreparationParseResult =
  | { success: true; data: PreparationPlan }
  | { success: false; error: string };

/**
 * Un plan relu depuis un fichier peut avoir été écrit par une version
 * antérieure du catalogue : on complète les éléments absents plutôt que de
 * rejeter le fichier, mais on refuse tout ce qui n'est pas au schéma. Aucun
 * repli silencieux : un fichier invalide renvoie une erreur nommée.
 */
export function parsePreparationPlan(input: unknown): PreparationParseResult {
  const parsed = preparationPlanSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join(".") ?? "";
    return {
      success: false,
      error: path ? `${path} : ${first?.message}` : (first?.message ?? "format inattendu"),
    };
  }

  const known = new Map(parsed.data.entries.map((entry) => [entry.id, entry]));
  return {
    success: true,
    data: {
      ...parsed.data,
      entries: PREPARATION_ITEMS.map(
        (item) => known.get(item.id) ?? { id: item.id, done: false, note: "" },
      ),
    },
  };
}

export type PreparationProgress = {
  done: number;
  total: number;
  missing: PreparationItem[];
  blocking: PreparationItem[];
};

export function preparationProgress(plan: PreparationPlan): PreparationProgress {
  const done = new Set(plan.entries.filter((entry) => entry.done).map((entry) => entry.id));
  const missing = PREPARATION_ITEMS.filter((item) => !done.has(item.id));
  return {
    done: PREPARATION_ITEMS.length - missing.length,
    total: PREPARATION_ITEMS.length,
    missing,
    // Le DPA est le seul élément dont l'absence interdit de commencer ; les
    // autres dégradent le résultat sans bloquer, et c'est écrit au client.
    blocking: missing.filter((item) => item.id === "dpa"),
  };
}

function noteFor(plan: PreparationPlan, id: string): string {
  return plan.entries.find((entry) => entry.id === id)?.note.trim() ?? "";
}

/**
 * Rend un prompt prêt à coller à partir du plan. Purement déterministe : les
 * mêmes entrées donnent toujours le même texte, ce qui le rend testable et
 * évite qu'un prompt « bouge » d'une session à l'autre sans qu'on sache
 * pourquoi.
 */
export function buildPreparationPrompt(plan: PreparationPlan): string {
  const progress = preparationProgress(plan);
  const client = plan.client.trim() || "le client";
  const reference = plan.reference.trim();

  const lignes: string[] = [];
  lignes.push(
    `Tu prépares une mission de diagnostic des sources de données pour ${client}${
      reference ? ` (référence ${reference})` : ""
    }.`,
  );
  lignes.push("");
  lignes.push(
    `Avancement du pack d’accès : ${progress.done} ${
      progress.done > 1 ? "éléments obtenus" : "élément obtenu"
    } sur ${progress.total}.`,
  );

  const obtenus = PREPARATION_ITEMS.filter((item) =>
    plan.entries.some((entry) => entry.id === item.id && entry.done),
  );
  if (obtenus.length) {
    lignes.push("");
    lignes.push("OBTENU :");
    for (const item of obtenus) {
      const note = noteFor(plan, item.id);
      lignes.push(`- ${item.label}${note ? ` — ${note}` : ""}`);
    }
  }

  if (progress.missing.length) {
    lignes.push("");
    lignes.push("MANQUANT :");
    for (const item of progress.missing) {
      const note = noteFor(plan, item.id);
      lignes.push(
        `- ${item.label} (${OWNER_LABELS[item.owner]}, ${item.deadline}) — ${item.consequence}${
          note ? ` Note : ${note}` : ""
        }`,
      );
    }
  }

  if (plan.notes.trim()) {
    lignes.push("");
    lignes.push("NOTES DE MISSION :");
    lignes.push(plan.notes.trim());
  }

  lignes.push("");
  lignes.push("CE QUE J’ATTENDS DE TOI :");
  lignes.push(
    "1. Rédige la relance à envoyer au client pour les éléments manquants, en une seule fois, en indiquant pour chacun à qui il incombe et ce que son absence coûte.",
  );
  lignes.push(
    "2. Dis ce qu’il est déjà possible de commencer avec ce qui est obtenu, et ce qui doit attendre.",
  );
  if (progress.blocking.length) {
    lignes.push(
      "3. Rappelle que la collecte ne peut pas démarrer tant que le DPA n’est pas signé : c’est le seul élément réellement bloquant.",
    );
  } else {
    lignes.push(
      "3. Signale tout risque de glissement du délai de 10 jours ouvrés au vu de ce qui manque.",
    );
  }
  lignes.push("");
  lignes.push(
    "Contraintes : réponds en français, sans promettre de conformité, de certification ni de décision d’assurabilité. Une absence d’observation n’est jamais un point positif.",
  );

  return lignes.join("\n");
}
