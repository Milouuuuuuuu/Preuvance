import { accessPackItemsFromMission } from "@/lib/admin/from-mission";
import {
  MISSION_CONFIG_VERSION,
  missionConfigSchema,
  type MissionConfig,
} from "@/lib/inventory/mission-config";

/**
 * Brouillon de mission édité dans la console interne.
 *
 * Le fichier de mission était jusqu'ici « la seule chose que l'opérateur écrit
 * à la main ». C'était vrai, et c'était le point qui empêchait quelqu'un
 * d'autre d'opérer l'outil : il fallait connaître la forme d'un schéma Zod
 * discriminé pour lancer une mission.
 *
 * Ce module ne redéfinit rien : il fournit des gabarits qui produisent des
 * objets déjà conformes à `missionConfigSchema`, et délègue la validation au
 * schéma réel. Une copie approximative du schéma aurait divergé au premier
 * changement.
 */

export type SourceKindId = "sql" | "file" | "salesforce" | "dolibarr";

export type SourceKindMeta = {
  id: SourceKindId;
  label: string;
  hint: string;
  /** Ce que le client doit fournir pour cette source : sert l'écran de préparation. */
  needs: string;
};

export const SOURCE_KINDS: readonly SourceKindMeta[] = [
  {
    id: "sql",
    label: "Base de données",
    hint: "PostgreSQL, MySQL ou SQL Server, en lecture seule ou par remise des résultats au DBA.",
    needs: "Un compte de lecture seule, ou les fichiers de résultats produits par le DBA.",
  },
  {
    id: "file",
    label: "Fichiers partagés",
    hint: "Dossier d’exports CSV ou Excel, parcouru sans ouvrir le contenu métier.",
    needs: "Le chemin du dossier et un droit de lecture.",
  },
  {
    id: "salesforce",
    label: "Salesforce",
    hint: "Objets et champs lus par l’API, jeton stocké dans une variable d’environnement.",
    needs: "Un jeton d’API en lecture et l’URL de l’instance.",
  },
  {
    id: "dolibarr",
    label: "Dolibarr",
    hint: "Ressources de l’ERP lues par l’API REST, clé stockée dans une variable.",
    needs: "Une clé d’API en lecture et le module API REST actif.",
  },
] as const;

export function emptyMission(): MissionConfig {
  return {
    configVersion: MISSION_CONFIG_VERSION,
    mission: { client: "", reference: "", mode: "metadata_only" },
    sources: [],
    tools: [],
    flows: [],
  } as MissionConfig;
}

/** Identifiant lisible dérivé d'un libellé, unique dans la mission. */
export function slugify(label: string, taken: readonly string[] = []): string {
  const base =
    label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "source";
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * Gabarit conforme au schéma pour chaque type de source. Les valeurs par
 * défaut sont celles que la validation accepte : on ne crée jamais un objet
 * qu'il faudrait ensuite réparer.
 */
export function newSource(kind: SourceKindId, id: string): MissionConfig["sources"][number] {
  if (kind === "sql") {
    return {
      id,
      kind: "sql",
      system: "postgresql",
      dialect: "postgresql",
      label: "",
      executor: { type: "results", directory: "", format: "csv" },
      collectFreshness: false,
    } as MissionConfig["sources"][number];
  }
  if (kind === "file") {
    return {
      id,
      kind: "file",
      system: "csv",
      label: "",
      directory: "",
      extensions: [".csv", ".xlsx"],
      maxFiles: 200,
    } as MissionConfig["sources"][number];
  }
  if (kind === "salesforce") {
    return {
      id,
      kind: "api",
      system: "salesforce",
      label: "",
      instanceUrl: "https://exemple.my.salesforce.com",
      tokenEnv: "SALESFORCE_TOKEN",
      maxObjects: 200,
    } as MissionConfig["sources"][number];
  }
  return {
    id,
    kind: "api",
    system: "dolibarr",
    label: "",
    baseUrl: "https://exemple.fr/api/index.php",
    apiKeyEnv: "DOLIBARR_API_KEY",
    maxResources: 60,
    allowRecordProbe: false,
  } as MissionConfig["sources"][number];
}

export function sourceKindOf(source: MissionConfig["sources"][number]): SourceKindId {
  if (source.kind === "sql") return "sql";
  if (source.kind === "file") return "file";
  return source.system === "salesforce" ? "salesforce" : "dolibarr";
}

export type MissionCheck =
  | { valid: true; mission: MissionConfig }
  | { valid: false; problems: { where: string; message: string }[] };

/**
 * Valide le brouillon avec le schéma réel et rend les problèmes en clair.
 * Aucun repli : un brouillon incomplet n'est jamais « réparé » en silence, il
 * est décrit.
 */
export function checkMission(draft: unknown): MissionCheck {
  const parsed = missionConfigSchema.safeParse(draft);
  if (parsed.success) return { valid: true, mission: parsed.data };

  const seen = new Set<string>();
  const problems: { where: string; message: string }[] = [];
  for (const issue of parsed.error.issues) {
    const where = describePath(issue.path, draft);
    const message = frenchMessage(issue);
    const key = `${where}::${message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    problems.push({ where, message });
  }
  return { valid: false, problems: problems.slice(0, 12) };
}

/**
 * Zod rend ses messages en anglais. L'interface est en français : les laisser
 * passer tels quels afficherait « Too small: expected string to have >=1
 * characters » à un opérateur. Les messages que le schéma écrit lui-même (ceux
 * des `refine`, déjà en français) sont conservés intacts.
 */
function frenchMessage(issue: { code?: string; message: string; minimum?: unknown; maximum?: unknown }): string {
  const brut = issue.message;
  // Un message déjà rédigé par le schéma contient des accents ou du français.
  if (/[àâäéèêëîïôöùûüç]/i.test(brut) || brut.includes("autorisé") || brut.includes("invalide")) {
    return brut;
  }
  if (issue.code === "invalid_type" && /received undefined|expected .* received undefined/i.test(brut)) {
    return "à renseigner";
  }
  if (issue.code === "too_small") {
    return issue.minimum === 1 || /have >=1/.test(brut) ? "à renseigner" : `valeur trop petite (minimum ${String(issue.minimum ?? "")})`;
  }
  if (issue.code === "too_big") {
    return `valeur trop grande (maximum ${String(issue.maximum ?? "")})`;
  }
  if (issue.code === "invalid_format" || /invalid url/i.test(brut)) {
    return /url/i.test(brut) ? "adresse web attendue (https://…)" : "format inattendu";
  }
  if (issue.code === "invalid_value" || issue.code === "invalid_union") {
    return "valeur non admise pour ce champ";
  }
  if (issue.code === "unrecognized_keys") return "champ inconnu dans ce type de source";
  if (issue.code === "invalid_type") return "type inattendu";
  return brut;
}

/** Noms de champs de source, tels qu'ils apparaissent dans le formulaire. */
const SOURCE_FIELD_LABELS: Record<string, string> = {
  label: "Nom",
  "executor.directory": "Dossier des résultats",
  "executor.command": "Client SQL",
  "executor.args": "Arguments",
  directory: "Dossier",
  extensions: "Extensions",
  maxFiles: "Plafond de fichiers",
  instanceUrl: "URL de l’instance",
  tokenEnv: "Variable du jeton",
  maxObjects: "Plafond d’objets",
  baseUrl: "URL de l’API",
  apiKeyEnv: "Variable de la clé",
  maxResources: "Plafond de ressources",
  readOnlyAccount: "Compte de lecture",
  dialect: "Moteur",
  id: "Identifiant",
};

/**
 * Traduit un chemin Zod en repère lisible par un opérateur.
 *
 * Zod type ses chemins en `PropertyKey[]`, donc symboles compris ; aucun ne
 * peut apparaître ici puisque le schéma ne contient que des clés littérales,
 * mais le type doit l'accepter.
 */
function describePath(path: readonly PropertyKey[], draft: unknown): string {
  if (path.length === 0) return "Mission";
  if (path[0] === "mission") {
    const champs: Record<string, string> = {
      client: "Client",
      reference: "Référence",
      operator: "Opérateur",
      mode: "Mode de collecte",
      scope: "Périmètre",
      dpaReference: "Référence du DPA",
    };
    return champs[String(path[1])] ?? "Mission";
  }
  if (path[0] === "sources" && typeof path[1] === "number") {
    const sources = (draft as { sources?: unknown[] })?.sources;
    const source = Array.isArray(sources) ? sources[path[1]] : undefined;
    const label = (source as { label?: string } | undefined)?.label?.trim();
    const nom = label || `source ${path[1] + 1}`;
    const reste = path.slice(2).map(String).join(".");
    return reste ? `${nom} → ${SOURCE_FIELD_LABELS[reste] ?? reste}` : nom;
  }
  return path.join(".");
}

export type MissionSummary = {
  sources: number;
  parKind: { kind: SourceKindMeta; count: number }[];
  /** Un élément d'accès à obtenir par source déclarée. */
  acces: { id: string; label: string; method: string; owner: string }[];
};

export function summarize(mission: MissionConfig): MissionSummary {
  const parKind = SOURCE_KINDS.map((kind) => ({
    kind,
    count: mission.sources.filter((source) => sourceKindOf(source) === kind.id).length,
  })).filter((entry) => entry.count > 0);

  const acces = accessPackItemsFromMission(mission).map((item, index) => ({
    id: mission.sources[index]?.id ?? `source-${index}`,
    label: item.system,
    method: item.method,
    owner: item.owner,
  }));

  return { sources: mission.sources.length, parKind, acces };
}
