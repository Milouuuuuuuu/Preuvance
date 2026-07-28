import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Garde-fou de complétude de la suite (audit du 26/07/2026).
 *
 * `test:unit` énumère ses fichiers à la main : un test ajouté puis oublié dans
 * cette liste ne tournerait jamais, ni en local ni en CI. C'est un angle mort
 * qui ne fait aucun bruit. Ce test compare la liste au contenu du dossier.
 */
const testsDirectory = fileURLToPath(new URL("./", import.meta.url));
const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));

/** Fichiers lancés par une autre étape de `npm test` que `test:unit`. */
const RUN_BY_OTHER_STEPS = new Set([
  "production-start.test.mjs",
  "rendered-html.test.mjs",
]);

test("chaque fichier de test du dossier est lancé par npm test", () => {
  const scripts = JSON.parse(readFileSync(packageJsonPath, "utf8")).scripts as Record<
    string,
    string
  >;
  const declared = new Set(
    [...scripts["test:unit"].matchAll(/tests\/([\w.-]+\.test\.[cm]?tsx?)/g)].map(
      (match) => match[1],
    ),
  );

  const onDisk = readdirSync(testsDirectory).filter((name) => /\.test\.[cm]?tsx?$/.test(name));
  const forgotten = onDisk.filter((name) => !declared.has(name) && !RUN_BY_OTHER_STEPS.has(name));

  assert.deepEqual(
    forgotten,
    [],
    `Fichiers de test jamais exécutés, à ajouter au script test:unit de package.json : ${forgotten.join(", ")}`,
  );
});

test("la liste test:unit ne référence aucun fichier disparu", () => {
  const scripts = JSON.parse(readFileSync(packageJsonPath, "utf8")).scripts as Record<
    string,
    string
  >;
  const declared = [...scripts["test:unit"].matchAll(/tests\/([\w.-]+\.test\.[cm]?tsx?)/g)].map(
    (match) => match[1],
  );
  const onDisk = new Set(readdirSync(testsDirectory));
  const missing = declared.filter((name) => !onDisk.has(name));

  assert.deepEqual(missing, [], `Fichiers listés mais absents du disque : ${missing.join(", ")}`);
});

test("les tests lancés hors test:unit le sont bien par une autre étape", () => {
  const scripts = JSON.parse(readFileSync(packageJsonPath, "utf8")).scripts as Record<
    string,
    string
  >;
  for (const name of RUN_BY_OTHER_STEPS) {
    assert.ok(
      scripts.test.includes(`tests/${name}`),
      `${name} n'est lancé par aucune étape de npm test`,
    );
  }
});
