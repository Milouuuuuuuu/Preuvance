import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSafeIdentifier,
  buildDatasetsFromIntrospection,
  freshnessQuery,
  introspectSqlSource,
  introspectionPlan,
  quoteIdentifier,
  readOnlyGrantScript,
  SQL_DIALECTS,
  type SqlRow,
} from "../lib/inventory/sql-introspection";

const WRITE_PATTERN =
  /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|merge|call|execute)\b/i;

test("aucun plan d’introspection ne contient d’ordre d’écriture", () => {
  for (const dialect of SQL_DIALECTS) {
    for (const step of introspectionPlan(dialect)) {
      assert.equal(step.readOnly, true);
      assert.doesNotMatch(step.sql, WRITE_PATTERN, `${dialect}/${step.id}`);
      assert.match(step.sql, /^SELECT/i);
    }
  }
});

test("chaque dialecte expose au minimum les tables et les colonnes en étapes obligatoires", () => {
  for (const dialect of SQL_DIALECTS) {
    const plan = introspectionPlan(dialect);
    const required = plan.filter((step) => !step.optional).map((step) => step.id);
    assert.ok(required.includes("tables"), `${dialect} : étape tables obligatoire`);
    assert.ok(required.includes("columns"), `${dialect} : étape columns obligatoire`);
  }
});

test("les lignes du catalogue système deviennent des jeux de données typés", () => {
  const tables: SqlRow[] = [
    {
      table_schema: "public",
      table_name: "clients",
      object_kind: "table",
      approx_rows: "4213",
      size_bytes: "8388608",
    },
    {
      table_schema: "public",
      table_name: "jamais_analysee",
      object_kind: "table",
      approx_rows: "-1",
      size_bytes: "0",
    },
  ];
  const columns: SqlRow[] = [
    {
      table_schema: "public",
      table_name: "clients",
      column_name: "rowid",
      data_type: "integer",
      is_nullable: "NO",
    },
    {
      table_schema: "public",
      table_name: "clients",
      column_name: "email",
      data_type: "varchar",
      is_nullable: "YES",
    },
    {
      table_schema: "public",
      table_name: "table_absente",
      column_name: "x",
      data_type: "integer",
      is_nullable: "YES",
    },
  ];

  const { datasets, notes } = buildDatasetsFromIntrospection({
    dialect: "postgresql",
    sourceId: "erp",
    results: {
      tables,
      columns,
      primaryKeys: [
        { table_schema: "public", table_name: "clients", column_name: "rowid" },
      ],
      foreignKeys: [],
    },
  });

  const clients = datasets.find((dataset) => dataset.name === "clients");
  assert.ok(clients);
  assert.equal(clients.rowCount.value, 4213);
  assert.equal(clients.rowCount.kind, "estimate");
  assert.match(clients.rowCount.method, /reltuples/);
  assert.equal(clients.fields.length, 2);
  assert.equal(clients.fields[0].isPrimaryKey, true);
  assert.equal(clients.fields[1].nullable, true);

  const neverAnalyzed = datasets.find((dataset) => dataset.name === "jamais_analysee");
  assert.equal(neverAnalyzed?.rowCount.value, null);
  assert.equal(neverAnalyzed?.rowCount.kind, "unknown");

  assert.match(notes.join(" "), /colonne\(s\) rattachée\(s\) à un objet absent/);
});

test("une clé étrangère devient une référence lisible entre jeux de données", () => {
  const { datasets } = buildDatasetsFromIntrospection({
    dialect: "mysql",
    sourceId: "erp",
    results: {
      tables: [
        {
          table_schema: "dolibarr",
          table_name: "llx_facture",
          object_kind: "table",
          approx_rows: "10",
        },
      ],
      columns: [
        {
          table_schema: "dolibarr",
          table_name: "llx_facture",
          column_name: "fk_soc",
          data_type: "int",
          is_nullable: "YES",
        },
      ],
      foreignKeys: [
        {
          table_schema: "dolibarr",
          table_name: "llx_facture",
          column_name: "fk_soc",
          foreign_table_schema: "dolibarr",
          foreign_table_name: "llx_societe",
          foreign_column_name: "rowid",
        },
      ],
    },
  });

  assert.equal(datasets[0].fields[0].references, "dolibarr.llx_societe.rowid");
});

test("la requête de fraîcheur cible une colonne de date et cite un MAX agrégé", () => {
  const query = freshnessQuery("postgresql", {
    namespace: "public",
    name: "clients",
    fields: [
      { name: "email", dataType: "varchar" },
      { name: "date_maj", dataType: "timestamp without time zone" },
    ],
  });
  assert.ok(query);
  assert.equal(query.column, "date_maj");
  assert.equal(
    query.sql,
    'SELECT MAX("date_maj") AS last_change_at FROM "public"."clients"',
  );

  assert.equal(
    freshnessQuery("postgresql", {
      name: "clients",
      fields: [{ name: "email", dataType: "varchar" }],
    }),
    null,
  );
});

test("un identifiant hostile est refusé plutôt qu’interpolé", () => {
  assert.throws(() => assertSafeIdentifier('clients"; DROP TABLE x; --', "objet"), /refusé/);
  assert.throws(() => quoteIdentifier("mysql", "table`; DROP"), /refusé/);
  assert.equal(quoteIdentifier("sqlserver", "clients"), "[clients]");
});

test("le script de compte de lecture seule n’accorde que la lecture", () => {
  const postgres = readOnlyGrantScript("postgresql", { login: "preuvance_ro", database: "erp" });
  assert.match(postgres, /GRANT SELECT ON ALL TABLES/);
  assert.doesNotMatch(postgres, /GRANT (INSERT|UPDATE|DELETE|ALL PRIVILEGES)/);

  const sqlserver = readOnlyGrantScript("sqlserver", { login: "preuvance_ro", database: "erp" });
  assert.match(sqlserver, /db_datareader/);
  assert.doesNotMatch(sqlserver, /db_datawriter|db_owner/);

  assert.throws(
    () => readOnlyGrantScript("mysql", { login: "ro'; DROP", database: "erp" }),
    /refusé/,
  );
});

test("une étape facultative en échec dégrade la couverture sans arrêter la collecte", async () => {
  const outcome = await introspectSqlSource({
    dialect: "postgresql",
    sourceId: "erp",
    execute: async (sql) => {
      if (/table_constraints/.test(sql)) throw new Error("permission denied");
      if (/pg_class/.test(sql)) {
        return [
          {
            table_schema: "public",
            table_name: "clients",
            object_kind: "table",
            approx_rows: 12,
          },
        ];
      }
      return [
        {
          table_schema: "public",
          table_name: "clients",
          column_name: "email",
          data_type: "varchar",
          is_nullable: "YES",
        },
      ];
    },
  });

  assert.equal(outcome.status, "partial");
  assert.equal(outcome.datasets.length, 1);
  assert.match(outcome.notes.join(" "), /facultative/);
});

test("une étape obligatoire en échec rend la source injoignable, sans jeu de données inventé", async () => {
  const outcome = await introspectSqlSource({
    dialect: "mysql",
    sourceId: "erp",
    execute: async () => {
      throw new Error("access denied for user");
    },
  });

  assert.equal(outcome.status, "unreachable");
  assert.deepEqual(outcome.datasets, []);
  assert.match(outcome.notes.join(" "), /catalogue système/);
});
