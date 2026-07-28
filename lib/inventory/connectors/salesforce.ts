import {
  toIdentifier,
  type CatalogueDataset,
  type CatalogueField,
} from "../catalogue-contract";
import {
  asArray,
  asRecord,
  getJson,
  readBoolean,
  readNumber,
  readText,
  type JsonFetch,
} from "./http";

/**
 * Connecteur Salesforce (P1) : métadonnées seulement.
 *
 * Trois ressources REST documentées, toutes en lecture :
 * - `/services/data/` : versions disponibles ;
 * - `/services/data/vXX.X/sobjects/` : liste des objets (« describe global ») ;
 * - `/services/data/vXX.X/sobjects/{objet}/describe` : champs et types ;
 * - `/services/data/vXX.X/limits/recordCount?sObjects=...` : volumétrie
 *   approchée, disponible à partir de la v40.0 et soumise au droit « View
 *   Setup and Configuration ».
 *
 * Aucune requête SOQL n'est émise : aucun enregistrement n'est lu.
 */
export const SALESFORCE_CONNECTOR_VERSION = "preuvance-salesforce-v1";

export const SALESFORCE_FALLBACK_API_VERSION = "59.0";

/** Objets techniques exclus : ils décrivent l'historique et le partage, pas le métier. */
const EXCLUDED_SUFFIXES = [
  "__History",
  "__Share",
  "__Feed",
  "__ChangeEvent",
  "__Tag",
  "__OwnerSharingRule",
  "__ViewStat",
  "__VoteStat",
];

export type SalesforceOptions = {
  instanceUrl: string;
  accessToken: string;
  sourceId: string;
  fetchJson: JsonFetch;
  apiVersion?: string;
  /** Objets explicitement demandés ; sinon tous les objets interrogeables. */
  objects?: string[];
  maxObjects?: number;
};

export type ApiConnectorOutcome = {
  datasets: CatalogueDataset[];
  notes: string[];
  status: "collected" | "partial" | "unreachable";
};

function baseHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Sélectionne la version d'API la plus récente annoncée par l'organisation. */
export function pickLatestApiVersion(payload: unknown): string | null {
  const versions = asArray(payload)
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => readText(entry, "version"))
    .filter((version) => /^\d+\.\d+$/.test(version));
  if (versions.length === 0) return null;
  return versions.sort((a, b) => Number(a) - Number(b))[versions.length - 1];
}

export function isBusinessObject(record: Record<string, unknown>): boolean {
  const name = readText(record, "name");
  if (!name) return false;
  if (readBoolean(record, "deprecatedAndHidden")) return false;
  if (!readBoolean(record, "queryable")) return false;
  return !EXCLUDED_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

/** Transforme un `describe` d'objet en champs de catalogue (nom, type, référence). */
export function mapDescribeToFields(describe: unknown): CatalogueField[] {
  const record = asRecord(describe);
  if (!record) return [];
  const fields: CatalogueField[] = [];
  for (const entry of asArray(record.fields)) {
    const field = asRecord(entry);
    if (!field) continue;
    const name = readText(field, "name");
    if (!name) continue;
    const references = asArray(field.referenceTo)
      .map((value) => (typeof value === "string" ? value : ""))
      .filter((value) => value.length > 0);
    const mapped: CatalogueField = {
      name,
      dataType: readText(field, "type") || "inconnu",
      nullable: field.nillable === true,
    };
    if (readText(field, "name") === "Id") mapped.isPrimaryKey = true;
    if (references.length > 0) mapped.references = references.join(", ");
    fields.push(mapped);
  }
  return fields;
}

export async function inventorySalesforce(
  options: SalesforceOptions,
): Promise<ApiConnectorOutcome> {
  const { fetchJson, sourceId } = options;
  const instance = trimTrailingSlash(options.instanceUrl);
  const headers = baseHeaders(options.accessToken);
  const notes: string[] = [];
  const maxObjects = options.maxObjects ?? 200;

  let apiVersion = options.apiVersion ?? "";
  if (!apiVersion) {
    const versions = await getJson(fetchJson, `${instance}/services/data/`, headers);
    if (versions.ok) {
      apiVersion = pickLatestApiVersion(versions.data) ?? SALESFORCE_FALLBACK_API_VERSION;
    } else {
      apiVersion = SALESFORCE_FALLBACK_API_VERSION;
      notes.push(
        `Liste des versions d’API indisponible (${versions.message}) : version ${SALESFORCE_FALLBACK_API_VERSION} utilisée par défaut.`,
      );
    }
  }

  const root = `${instance}/services/data/v${apiVersion}`;
  const global = await getJson(fetchJson, `${root}/sobjects/`, headers);
  if (!global.ok) {
    return {
      datasets: [],
      notes: [
        ...notes,
        `Inventaire Salesforce impossible : ${global.message} sur /sobjects. Vérifier le jeton, l’URL d’instance et le profil en lecture seule.`,
      ],
      status: "unreachable",
    };
  }

  const globalRecord = asRecord(global.data);
  const candidates = asArray(globalRecord?.sobjects)
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .filter(isBusinessObject)
    .map((entry) => readText(entry, "name"));

  const requested = options.objects?.length
    ? candidates.filter((name) => options.objects?.includes(name))
    : candidates;

  const selected = requested.slice(0, maxObjects);
  if (requested.length > selected.length) {
    notes.push(
      `${requested.length} objets interrogeables détectés, ${selected.length} décrits (plafond de ${maxObjects}). Les objets suivants n’ont pas été décrits : ${requested.slice(maxObjects).slice(0, 20).join(", ")}${requested.length - maxObjects > 20 ? "…" : ""}.`,
    );
  }

  const datasets: CatalogueDataset[] = [];
  let describeFailures = 0;
  for (const name of selected) {
    const describe = await getJson(fetchJson, `${root}/sobjects/${name}/describe`, headers);
    if (!describe.ok) {
      describeFailures += 1;
      continue;
    }
    const fields = mapDescribeToFields(describe.data);
    datasets.push({
      id: toIdentifier(sourceId, name),
      sourceId,
      name,
      namespace: "sobjects",
      kind: "object",
      rowCount: {
        value: null,
        kind: "unknown",
        method: "Volumétrie non demandée ou non autorisée (ressource limits/recordCount).",
      },
      sizeBytes: null,
      lastChangeAt: null,
      lastChangeSource: "unknown",
      fields,
      notes: [],
    });
  }
  if (describeFailures > 0) {
    notes.push(
      `${describeFailures} objet(s) non décrit(s) : droit de lecture manquant sur ces objets. La couverture du diagnostic est donc partielle.`,
    );
  }

  const counts = await readRecordCounts(fetchJson, root, headers, selected);
  if (counts.available) {
    for (const dataset of datasets) {
      const value = counts.byObject.get(dataset.name);
      if (value === undefined) continue;
      dataset.rowCount = {
        value,
        kind: "estimate",
        method:
          "Ressource limits/recordCount (comptage asynchrone déclaré approximatif par Salesforce, hors corbeille et archives).",
      };
    }
  } else {
    notes.push(
      `Volumétrie Salesforce non collectée (${counts.reason}). La ressource limits/recordCount exige le droit « View Setup and Configuration » et l’API 40.0 ou supérieure.`,
    );
  }

  notes.push(
    `Inventaire Salesforce en lecture seule via l’API v${apiVersion} : describe global, describe par objet, volumétrie approchée. Aucune requête SOQL, aucun enregistrement lu.`,
  );

  return {
    datasets,
    notes,
    status: describeFailures > 0 || !counts.available ? "partial" : "collected",
  };
}

async function readRecordCounts(
  fetchJson: JsonFetch,
  root: string,
  headers: Record<string, string>,
  objects: readonly string[],
): Promise<
  | { available: true; byObject: Map<string, number> }
  | { available: false; reason: string; byObject: Map<string, number> }
> {
  const byObject = new Map<string, number>();
  if (objects.length === 0) return { available: false, reason: "aucun objet retenu", byObject };

  /* L'URL est découpée : une liste d'objets trop longue serait rejetée. */
  const batches: string[][] = [];
  for (let index = 0; index < objects.length; index += 40) {
    batches.push([...objects.slice(index, index + 40)]);
  }

  let firstFailure = "";
  for (const batch of batches) {
    const url = `${root}/limits/recordCount?sObjects=${batch.join(",")}`;
    const result = await getJson(fetchJson, url, headers);
    if (!result.ok) {
      if (!firstFailure) firstFailure = result.message;
      continue;
    }
    const record = asRecord(result.data);
    for (const entry of asArray(record?.sObjects)) {
      const item = asRecord(entry);
      if (!item) continue;
      const name = readText(item, "name");
      const count = readNumber(item, "count");
      if (name && count !== null && count >= 0) byObject.set(name, count);
    }
  }

  if (byObject.size === 0) {
    return { available: false, reason: firstFailure || "réponse vide", byObject };
  }
  return { available: true, byObject };
}
