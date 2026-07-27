import assert from "node:assert/strict";
import test from "node:test";

import { redactPath, sanitizeUrlProperties } from "../lib/analytics/posthog";

/**
 * Verrous du contrat de confidentialité : aucun identifiant de dossier ne doit franchir
 * `before_send`, quelle que soit la propriété qui le porte. L'audit du
 * 26/07/2026 avait trouvé la fuite par `$prev_pageview_pathname`, ajouté par
 * le SDK lui-même et absent de l'ancienne liste de clés.
 */

const UUID = "9f3c2b1a-4d5e-4f60-8a71-2c3d4e5f6a7b";

test("redactPath remplace l’identifiant de dossier, quelle que soit la suite", () => {
  assert.equal(redactPath(`/dossiers/${UUID}`), "/dossiers/[id]");
  assert.equal(redactPath(`/dossiers/${UUID}?onglet=preuves`), "/dossiers/[id]?onglet=preuves");
  assert.equal(redactPath(`/dossiers/${UUID}#registre`), "/dossiers/[id]#registre");
  assert.equal(
    redactPath(`https://preuvance.fr/dossiers/${UUID}`),
    "https://preuvance.fr/dossiers/[id]",
  );
  assert.equal(redactPath("/diagnostic"), "/diagnostic");
});

test("sanitizeUrlProperties expurge les propriétés ajoutées par le SDK, pas seulement $current_url", () => {
  const event = sanitizeUrlProperties({
    properties: {
      $current_url: `https://preuvance.fr/dossiers/${UUID}`,
      $pathname: `/dossiers/${UUID}`,
      // Ajoutées par posthog-js sans que le code les nomme : c’était la fuite.
      $prev_pageview_pathname: `/dossiers/${UUID}`,
      $referrer: `https://preuvance.fr/dossiers/${UUID}?onglet=preuves`,
      $initial_current_url: `https://preuvance.fr/dossiers/${UUID}`,
    },
  });

  const serialized = JSON.stringify(event);
  assert.doesNotMatch(serialized, new RegExp(UUID));
  assert.equal(event.properties.$prev_pageview_pathname, "/dossiers/[id]");
  assert.equal(event.properties.$referrer, "https://preuvance.fr/dossiers/[id]?onglet=preuves");
});

test("sanitizeUrlProperties laisse intactes les valeurs non concernées", () => {
  const event = sanitizeUrlProperties({
    properties: {
      $current_url: "https://preuvance.fr/diagnostic",
      score: 72,
      tier: "B",
      persisted: true,
      theme: "nuit",
    },
  });

  assert.equal(event.properties.$current_url, "https://preuvance.fr/diagnostic");
  assert.equal(event.properties.score, 72);
  assert.equal(event.properties.tier, "B");
  assert.equal(event.properties.persisted, true);
});

test("sanitizeUrlProperties tolère un événement nul ou sans propriétés", () => {
  assert.equal(sanitizeUrlProperties(null), null);
  assert.deepEqual(sanitizeUrlProperties({}), {});
});
