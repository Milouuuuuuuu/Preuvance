import assert from "node:assert/strict";
import test from "node:test";

import type { JsonFetch } from "../lib/inventory/connectors/http";
import { redactUrl } from "../lib/inventory/connectors/http";
import {
  inventoryDolibarr,
  readSwaggerFields,
  readSwaggerResources,
} from "../lib/inventory/connectors/dolibarr";
import {
  inventorySalesforce,
  isBusinessObject,
  mapDescribeToFields,
  pickLatestApiVersion,
} from "../lib/inventory/connectors/salesforce";

type Route = { match: RegExp; status?: number; body: unknown };

function fakeFetch(routes: Route[], calls: string[] = []): JsonFetch {
  return async (url) => {
    calls.push(url);
    const route = routes.find((candidate) => candidate.match.test(url));
    if (!route) return { ok: false, status: 404, json: async () => ({}) };
    const status = route.status ?? 200;
    return { ok: status < 400, status, json: async () => route.body };
  };
}

const SALESFORCE_ROUTES: Route[] = [
  {
    match: /\/services\/data\/$/,
    body: [
      { version: "58.0", url: "/services/data/v58.0" },
      { version: "61.0", url: "/services/data/v61.0" },
    ],
  },
  {
    match: /\/sobjects\/$/,
    body: {
      sobjects: [
        { name: "Account", queryable: true, deprecatedAndHidden: false },
        { name: "Contact", queryable: true, deprecatedAndHidden: false },
        { name: "Account__History", queryable: true, deprecatedAndHidden: false },
        { name: "ObsoleteObject", queryable: true, deprecatedAndHidden: true },
        { name: "NonQueryable", queryable: false, deprecatedAndHidden: false },
      ],
    },
  },
  {
    match: /\/sobjects\/Account\/describe$/,
    body: {
      name: "Account",
      fields: [
        { name: "Id", type: "id", nillable: false },
        { name: "Name", type: "string", nillable: true },
        { name: "OwnerId", type: "reference", nillable: true, referenceTo: ["User"] },
      ],
    },
  },
  {
    match: /\/sobjects\/Contact\/describe$/,
    body: {
      name: "Contact",
      fields: [
        { name: "Id", type: "id", nillable: false },
        { name: "Email", type: "email", nillable: true },
      ],
    },
  },
  {
    match: /\/limits\/recordCount/,
    body: {
      sObjects: [
        { name: "Account", count: 1240 },
        { name: "Contact", count: 8300 },
      ],
    },
  },
];

test("la version d’API retenue est la plus récente annoncée par l’organisation", () => {
  assert.equal(pickLatestApiVersion([{ version: "58.0" }, { version: "61.0" }]), "61.0");
  assert.equal(pickLatestApiVersion([]), null);
  assert.equal(pickLatestApiVersion({ nope: true }), null);
});

test("les objets techniques et non interrogeables sont écartés", () => {
  assert.equal(isBusinessObject({ name: "Account", queryable: true }), true);
  assert.equal(isBusinessObject({ name: "Account__History", queryable: true }), false);
  assert.equal(isBusinessObject({ name: "Truc", queryable: false }), false);
  assert.equal(
    isBusinessObject({ name: "Truc", queryable: true, deprecatedAndHidden: true }),
    false,
  );
});

test("le describe Salesforce devient des champs typés et référencés", () => {
  const fields = mapDescribeToFields({
    fields: [
      { name: "Id", type: "id", nillable: false },
      { name: "OwnerId", type: "reference", nillable: true, referenceTo: ["User"] },
    ],
  });
  assert.equal(fields[0].isPrimaryKey, true);
  assert.equal(fields[1].references, "User");
  assert.equal(fields[1].nullable, true);
});

test("l’inventaire Salesforce n’émet que des GET de métadonnées, jamais de SOQL", async () => {
  const calls: string[] = [];
  const outcome = await inventorySalesforce({
    instanceUrl: "https://exemple.my.salesforce.com",
    accessToken: "jeton-de-test",
    sourceId: "sf",
    fetchJson: fakeFetch(SALESFORCE_ROUTES, calls),
  });

  assert.equal(outcome.status, "collected");
  assert.deepEqual(
    outcome.datasets.map((dataset) => dataset.name),
    ["Account", "Contact"],
  );
  const account = outcome.datasets[0];
  assert.equal(account.rowCount.value, 1240);
  assert.equal(account.rowCount.kind, "estimate");
  assert.match(account.rowCount.method, /approximatif/);

  assert.ok(calls.every((url) => !/query\?q=|\/query\//.test(url)), "aucune requête SOQL");
  assert.ok(calls.some((url) => url.includes("/services/data/v61.0/sobjects/")));
});

test("sans droit sur la volumétrie, Salesforce reste inventorié mais la limite est écrite", async () => {
  const outcome = await inventorySalesforce({
    instanceUrl: "https://exemple.my.salesforce.com",
    accessToken: "jeton-de-test",
    sourceId: "sf",
    fetchJson: fakeFetch(
      SALESFORCE_ROUTES.map((route) =>
        /recordCount/.test(route.match.source) ? { ...route, status: 403 } : route,
      ),
    ),
  });

  assert.equal(outcome.status, "partial");
  assert.equal(outcome.datasets[0].rowCount.value, null);
  assert.match(outcome.notes.join(" "), /View Setup and Configuration/);
});

test("une instance Salesforce injoignable ne produit aucun jeu de données", async () => {
  const outcome = await inventorySalesforce({
    instanceUrl: "https://exemple.my.salesforce.com",
    accessToken: "jeton-de-test",
    sourceId: "sf",
    fetchJson: fakeFetch([]),
  });
  assert.equal(outcome.status, "unreachable");
  assert.deepEqual(outcome.datasets, []);
});

const DOLIBARR_SWAGGER = {
  swagger: "2.0",
  paths: {
    "/thirdparties": {
      get: {
        responses: {
          "200": { schema: { type: "array", items: { $ref: "#/definitions/thirdparty" } } },
        },
      },
    },
    "/thirdparties/{id}": { get: { responses: { "200": {} } } },
    "/invoices": { get: { responses: { "200": { schema: { $ref: "#/definitions/invoice" } } } } },
    "/explorer": { get: { responses: { "200": {} } } },
    "/status": { get: { responses: { "200": {} } } },
  },
  definitions: {
    thirdparty: {
      required: ["name"],
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
        email: { type: "string", format: "email" },
      },
    },
    invoice: { properties: { id: { type: "integer" }, total_ttc: { type: "number" } } },
  },
};

test("les ressources Dolibarr sont découvertes par le descripteur, pas supposées", () => {
  const resources = readSwaggerResources(DOLIBARR_SWAGGER);
  assert.deepEqual(
    resources.map((resource) => resource.resource),
    ["invoices", "thirdparties"],
  );
  assert.equal(
    resources.find((resource) => resource.resource === "thirdparties")?.definition,
    "thirdparty",
  );
});

test("les champs Dolibarr viennent des définitions, avec type et nullabilité", () => {
  const fields = readSwaggerFields(DOLIBARR_SWAGGER, "thirdparty", "thirdparties");
  assert.deepEqual(
    fields.map((field) => field.name),
    ["id", "name", "email"],
  );
  assert.equal(fields[1].nullable, false);
  assert.equal(fields[2].dataType, "string (email)");

  /* Repli sur le singulier quand la définition n’est pas nommée par le chemin. */
  assert.equal(readSwaggerFields(DOLIBARR_SWAGGER, null, "invoices").length, 2);
  assert.deepEqual(readSwaggerFields(DOLIBARR_SWAGGER, null, "inconnu"), []);
});

test("l’inventaire Dolibarr reste en lecture et annonce l’absence de volumétrie", async () => {
  const calls: string[] = [];
  const outcome = await inventoryDolibarr({
    baseUrl: "https://erp.exemple.fr",
    apiKey: "cle-de-test",
    sourceId: "doli",
    fetchJson: fakeFetch([{ match: /swagger\.json$/, body: DOLIBARR_SWAGGER }], calls),
  });

  assert.equal(outcome.status, "collected");
  assert.deepEqual(
    outcome.datasets.map((dataset) => dataset.name),
    ["invoices", "thirdparties"],
  );
  assert.equal(outcome.datasets[0].rowCount.kind, "unknown");
  assert.match(outcome.datasets[0].rowCount.method, /llx_/);
  assert.deepEqual(calls, ["https://erp.exemple.fr/api/index.php/explorer/swagger.json"]);
});

test("sans descripteur et sans sondage autorisé, Dolibarr est déclaré injoignable", async () => {
  const outcome = await inventoryDolibarr({
    baseUrl: "https://erp.exemple.fr",
    apiKey: "cle-de-test",
    sourceId: "doli",
    fetchJson: fakeFetch([]),
  });
  assert.equal(outcome.status, "unreachable");
  assert.match(outcome.notes.join(" "), /Swagger indisponible|module « API REST »/);
});

test("le sondage d’une fiche n’a lieu que s’il est explicitement autorisé", async () => {
  const routes: Route[] = [
    { match: /thirdparties\?limit=1/, body: [{ id: 1, name: "Client", email: "x@y.fr" }] },
  ];

  const withoutProbe = await inventoryDolibarr({
    baseUrl: "https://erp.exemple.fr",
    apiKey: "cle",
    sourceId: "doli",
    resources: ["thirdparties"],
    fetchJson: fakeFetch(routes),
  });
  assert.deepEqual(withoutProbe.datasets[0].fields, []);

  const withProbe = await inventoryDolibarr({
    baseUrl: "https://erp.exemple.fr",
    apiKey: "cle",
    sourceId: "doli",
    resources: ["thirdparties"],
    allowRecordProbe: true,
    fetchJson: fakeFetch(routes),
  });
  assert.deepEqual(
    withProbe.datasets[0].fields.map((field) => field.name),
    ["id", "name", "email"],
  );
  assert.match(withProbe.datasets[0].notes?.join(" ") ?? "", /abandonnée/);
  /* Seules les clés sont retenues : aucune valeur de la fiche sondée. */
  assert.doesNotMatch(JSON.stringify(withProbe.datasets[0]), /x@y\.fr|"Client"/);
});

test("une URL journalisée est expurgée de ses identifiants et paramètres", () => {
  assert.equal(
    redactUrl("https://user:motdepasse@erp.exemple.fr/api/index.php/thirdparties?api_key=abc"),
    "https://erp.exemple.fr/api/index.php/thirdparties",
  );
});
