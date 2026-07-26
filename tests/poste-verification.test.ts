import assert from "node:assert/strict";
import test from "node:test";

import {
  checkNodeVersion,
  EXPECTED_KEYS,
  parseEnvNames,
} from "../scripts/verifier-poste.mjs";

test("parseEnvNames extrait les noms et ignore commentaires, vides et lignes invalides", () => {
  const content = [
    "# commentaire",
    "",
    "OPENAI_API_KEY=sk-secret-value",
    "export NEXT_PUBLIC_APP_URL=http://localhost:3000",
    "  POSTHOG_PROJECT_ID = 123",
    "PAS UNE LIGNE VALIDE",
    "=orphelin",
    "CLEF_DECLAREE_MAIS_VIDE=",
    "OPENAI_API_KEY=doublon",
  ].join("\n");

  assert.deepEqual(parseEnvNames(content), [
    "OPENAI_API_KEY",
    "NEXT_PUBLIC_APP_URL",
    "POSTHOG_PROJECT_ID",
  ]);
});

test("parseEnvNames ne retourne jamais une valeur, seulement des noms", () => {
  const names = parseEnvNames("SECRET_KEY=phx_une_valeur_tres_secrete\nAUTRE=phc_aussi");
  assert.deepEqual(names, ["SECRET_KEY", "AUTRE"]);
  assert.ok(!JSON.stringify(names).includes("phx_"));
  assert.ok(!JSON.stringify(names).includes("phc_"));
});

test("checkNodeVersion applique le minimum du package.json (>= 22.13)", () => {
  assert.equal(checkNodeVersion("22.13.0"), true);
  assert.equal(checkNodeVersion("22.19.1"), true);
  assert.equal(checkNodeVersion("23.0.0"), true);
  assert.equal(checkNodeVersion("22.12.9"), false);
  assert.equal(checkNodeVersion("20.11.0"), false);
});

test("le catalogue de clés attendues nomme des variables, jamais des valeurs", () => {
  for (const key of EXPECTED_KEYS) {
    assert.match(key.name, /^[A-Z][A-Z0-9_]*$/);
    assert.ok(key.module.length > 0);
  }
});
