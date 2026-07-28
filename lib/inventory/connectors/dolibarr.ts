import {
  toIdentifier,
  type CatalogueDataset,
  type CatalogueField,
} from "../catalogue-contract";
import {
  asArray,
  asRecord,
  getJson,
  readText,
  type JsonFetch,
} from "./http";
import type { ApiConnectorOutcome } from "./salesforce";

/**
 * Connecteur Dolibarr (P1) : métadonnées seulement.
 *
 * La liste des ressources exposées dépend des modules activés : elle est donc
 * DÉCOUVERTE, jamais supposée. La source d'autorité est le descripteur Swagger
 * de l'explorateur d'API (`/api/index.php/explorer/swagger.json`), qui décrit
 * les chemins et les définitions d'objets sans lire un seul enregistrement.
 *
 * Le sondage d'un enregistrement (`allowRecordProbe`) est désactivé par
 * défaut : il ne sert qu'à retrouver des noms de champs quand le descripteur
 * est indisponible, et il lit alors une fiche réelle. Seules les CLÉS sont
 * conservées ; c'est une décision explicite de l'opérateur, pas un défaut.
 */
export const DOLIBARR_CONNECTOR_VERSION = "preuvance-dolibarr-v1";

export type DolibarrOptions = {
  baseUrl: string;
  apiKey: string;
  sourceId: string;
  fetchJson: JsonFetch;
  /** Entité en multi-société. */
  entity?: string;
  resources?: string[];
  maxResources?: number;
  allowRecordProbe?: boolean;
};

/** Chemins de l'explorateur qui ne décrivent pas des données métier. */
const NON_BUSINESS_PATHS = new Set([
  "explorer",
  "login",
  "status",
  "documents",
  "setup",
  "index.php",
]);

function headersFor(options: DolibarrOptions): Record<string, string> {
  const headers: Record<string, string> = {
    DOLAPIKEY: options.apiKey,
    Accept: "application/json",
  };
  if (options.entity) headers.DOLAPIENTITY = options.entity;
  return headers;
}

function apiRoot(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/api/index.php") ? trimmed : `${trimmed}/api/index.php`;
}

export type SwaggerResource = { resource: string; definition: string | null };

/** Extrait les ressources métier et leur définition depuis un descripteur Swagger 2.0. */
export function readSwaggerResources(payload: unknown): SwaggerResource[] {
  const document = asRecord(payload);
  const paths = asRecord(document?.paths);
  if (!paths) return [];

  const found = new Map<string, string | null>();
  for (const [path, value] of Object.entries(paths)) {
    const segment = path.replace(/^\//, "").split("/")[0];
    if (!segment || NON_BUSINESS_PATHS.has(segment)) continue;
    if (segment.includes("{")) continue;
    const operation = asRecord(asRecord(value)?.get);
    const responses = asRecord(operation?.responses);
    const success = asRecord(responses?.["200"]);
    const schema = asRecord(success?.schema);
    const items = asRecord(schema?.items);
    const reference =
      readText(items ?? {}, "$ref") || readText(schema ?? {}, "$ref") || "";
    const definition = reference.startsWith("#/definitions/")
      ? reference.slice("#/definitions/".length)
      : null;
    const previous = found.get(segment);
    if (previous === undefined || (previous === null && definition !== null)) {
      found.set(segment, definition);
    }
  }

  return [...found.entries()]
    .map(([resource, definition]) => ({ resource, definition }))
    .sort((a, b) => a.resource.localeCompare(b.resource));
}

/** Champs déclarés par une définition Swagger, sans aucune valeur. */
export function readSwaggerFields(
  payload: unknown,
  definitionName: string | null,
  resource: string,
): CatalogueField[] {
  const document = asRecord(payload);
  const definitions = asRecord(document?.definitions);
  if (!definitions) return [];

  const singular = resource.replace(/ies$/, "y").replace(/s$/, "");
  const candidates = [definitionName, resource, singular].filter(
    (name): name is string => typeof name === "string" && name.length > 0,
  );

  let definition: Record<string, unknown> | null = null;
  for (const candidate of candidates) {
    const direct = asRecord(definitions[candidate]);
    if (direct) {
      definition = direct;
      break;
    }
    const insensitive = Object.keys(definitions).find(
      (key) => key.toLowerCase() === candidate.toLowerCase(),
    );
    if (insensitive) {
      definition = asRecord(definitions[insensitive]);
      if (definition) break;
    }
  }
  if (!definition) return [];

  const properties = asRecord(definition.properties);
  if (!properties) return [];

  const required = new Set(
    asArray(definition.required).filter((item): item is string => typeof item === "string"),
  );

  return Object.entries(properties).map(([name, value]) => {
    const property = asRecord(value) ?? {};
    const type = readText(property, "type") || readText(property, "$ref") || "inconnu";
    const format = readText(property, "format");
    return {
      name,
      dataType: format ? `${type} (${format})` : type,
      nullable: !required.has(name),
    } satisfies CatalogueField;
  });
}

export async function inventoryDolibarr(
  options: DolibarrOptions,
): Promise<ApiConnectorOutcome> {
  const root = apiRoot(options.baseUrl);
  const headers = headersFor(options);
  const notes: string[] = [];
  const maxResources = options.maxResources ?? 60;

  const swagger = await getJson(
    options.fetchJson,
    `${root}/explorer/swagger.json`,
    headers,
  );

  let resources: SwaggerResource[] = [];
  let swaggerPayload: unknown = null;
  if (swagger.ok) {
    swaggerPayload = swagger.data;
    resources = readSwaggerResources(swagger.data);
  } else {
    notes.push(
      `Descripteur Swagger indisponible (${swagger.message}) : la liste des ressources ne peut pas être découverte. Les versions 15 à 18 de Dolibarr sont connues pour renvoyer une erreur sur ce point ; utiliser alors le connecteur SQL sur la base llx_.`,
    );
  }

  if (options.resources?.length) {
    const requested = new Set(options.resources);
    const known = new Map(resources.map((item) => [item.resource, item.definition]));
    resources = [...requested].map((resource) => ({
      resource,
      definition: known.get(resource) ?? null,
    }));
  }

  if (resources.length === 0) {
    return {
      datasets: [],
      notes: [
        ...notes,
        "Aucune ressource Dolibarr exploitable : vérifier que le module « API REST » est actif et que la clé DOLAPIKEY appartient à un utilisateur en lecture.",
      ],
      status: "unreachable",
    };
  }

  const selected = resources.slice(0, maxResources);
  if (resources.length > selected.length) {
    notes.push(
      `${resources.length} ressources exposées, ${selected.length} retenues (plafond de ${maxResources}) : ${resources.slice(maxResources).map((item) => item.resource).join(", ")} non inventoriées.`,
    );
  }

  const datasets: CatalogueDataset[] = [];
  let withoutFields = 0;
  for (const entry of selected) {
    let fields = readSwaggerFields(swaggerPayload, entry.definition, entry.resource);
    const datasetNotes: string[] = [];

    if (fields.length === 0 && options.allowRecordProbe) {
      const probe = await getJson(
        options.fetchJson,
        `${root}/${entry.resource}?limit=1`,
        headers,
      );
      if (probe.ok) {
        const first = asRecord(asArray(probe.data)[0]) ?? asRecord(probe.data);
        if (first) {
          fields = Object.keys(first).map((name) => ({
            name,
            dataType: typeof first[name] === "number" ? "number" : "inconnu",
          }));
          datasetNotes.push(
            "Champs déduits d’une fiche réelle lue puis abandonnée (sondage autorisé par l’opérateur) : seuls les noms de champs sont conservés.",
          );
        }
      }
    }

    if (fields.length === 0) withoutFields += 1;

    datasets.push({
      id: toIdentifier(options.sourceId, entry.resource),
      sourceId: options.sourceId,
      name: entry.resource,
      namespace: "api",
      kind: "object",
      rowCount: {
        value: null,
        kind: "unknown",
        method:
          "L’API REST de Dolibarr n’expose pas de compteur : la volumétrie se prend sur la base SQL (tables llx_).",
      },
      sizeBytes: null,
      lastChangeAt: null,
      lastChangeSource: "unknown",
      fields,
      notes: datasetNotes,
    });
  }

  if (withoutFields > 0) {
    notes.push(
      `${withoutFields} ressource(s) sans définition de champs exploitable : le diagnostic les compte comme sources existantes, sans détail de champs.`,
    );
  }

  notes.push(
    "Inventaire Dolibarr en lecture seule : descripteur d’API et définitions d’objets. Aucun écrit, aucune suppression, aucune fiche conservée.",
  );

  return {
    datasets,
    notes,
    status: withoutFields > 0 || !swagger.ok ? "partial" : "collected",
  };
}
