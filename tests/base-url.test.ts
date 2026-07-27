import assert from "node:assert/strict";
import test from "node:test";

import { resolveBaseUrlFromHeaders, resolveBaseUrlFromRequest } from "../lib/base-url";

/**
 * L'audit du 26/07/2026 a montré qu'un visiteur pouvait déplacer l'origine
 * absolue du sitemap, du JSON-LD et des images OpenGraph vers son domaine en
 * posant `x-forwarded-host` — avec une mise en cache publique d'une heure sur
 * robots.txt et sitemap.xml. Ces tests verrouillent le comportement.
 */

function headersOf(entries: Record<string, string>) {
  return new Headers(entries);
}

const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

test.afterEach(() => {
  if (ORIGINAL_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
});

test("x-forwarded-host ne peut pas déplacer l’origine quand l’URL publique est configurée", () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://preuvance.fr";
  const url = resolveBaseUrlFromHeaders(
    headersOf({
      host: "preuvance.fr",
      "x-forwarded-host": "attaquant.example",
      "x-forwarded-proto": "https",
    }),
  );
  assert.equal(url.origin, "https://preuvance.fr");
});

test("x-forwarded-host est ignoré même sans URL publique configurée", () => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  const url = resolveBaseUrlFromHeaders(
    headersOf({ host: "preuvance.fr", "x-forwarded-host": "attaquant.example" }),
  );
  assert.equal(url.origin, "https://preuvance.fr");
});

test("l’hôte de la requête sert de repli, en HTTPS par défaut", () => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  assert.equal(
    resolveBaseUrlFromHeaders(headersOf({ host: "preview.pages.dev" })).origin,
    "https://preview.pages.dev",
  );
});

test("le développement local reste en HTTP", () => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  assert.equal(
    resolveBaseUrlFromHeaders(headersOf({ host: "localhost:3000" })).origin,
    "http://localhost:3000",
  );
  assert.equal(
    resolveBaseUrlFromHeaders(
      headersOf({ host: "127.0.0.1:34000", "x-forwarded-proto": "http" }),
    ).origin,
    "http://127.0.0.1:34000",
  );
});

test("une URL publique mal formée ne fait pas tomber le rendu", () => {
  process.env.NEXT_PUBLIC_APP_URL = "pas une url";
  assert.equal(
    resolveBaseUrlFromHeaders(headersOf({ host: "preuvance.fr" })).origin,
    "https://preuvance.fr",
  );
});

test("sans en-tête ni configuration, le repli local s’applique", () => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  assert.equal(resolveBaseUrlFromHeaders(headersOf({})).origin, "http://localhost:3000");
});

test("resolveBaseUrlFromRequest lit les en-têtes de la requête", () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://preuvance.fr";
  const request = new Request("https://interne.invalid/robots.txt", {
    headers: { "x-forwarded-host": "attaquant.example" },
  });
  assert.equal(resolveBaseUrlFromRequest(request).origin, "https://preuvance.fr");
});
