import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CatalogueLoader } from "../app/components/CatalogueLoader";
import { SiteHeader } from "../app/components/SiteHeader";
import { computeDiagnostic } from "../lib/inventory/diagnostic";
import { annotateCatalogue } from "../lib/inventory/sensitive-fields";
import { renderDiagnosticHtml } from "../lib/inventory/report";
import { baseCatalogue } from "./inventory-catalogue.test";

/**
 * Le parcours « je charge mon catalogue dans le navigateur » est le cœur de la
 * promesse locale et n'avait aucun test (audit du 26/07/2026, DT-09). Ces
 * tests couvrent ce qui est vérifiable sans navigateur : le rendu initial du
 * composant, ses invariants de confidentialité, et le fait que la restitution
 * produite côté client reste autonome.
 */

test("le chargeur de catalogue s’affiche sans catalogue et annonce la lecture locale", () => {
  const markup = renderToStaticMarkup(<CatalogueLoader />);

  assert.match(markup, /Lecture 100 % locale/);
  assert.match(markup, /preuvance-catalogue\.json/);
  assert.match(markup, /sans aucun envoi/);
  assert.match(markup, /type="file"/);
  assert.match(markup, /accept="application\/json,\.json"/);
});

test("aucun résultat n’est affiché tant qu’aucun catalogue n’est chargé", () => {
  const markup = renderToStaticMarkup(<CatalogueLoader />);

  // Ni score, ni constat, ni bouton d’export ne doivent apparaître à vide :
  // un écran qui montrerait un score sans donnée serait une invention.
  assert.doesNotMatch(markup, /Constats \(/);
  assert.doesNotMatch(markup, /Rapport Markdown/);
  assert.doesNotMatch(markup, /Réversibilité par outil/);
  assert.doesNotMatch(markup, /Plan de transition/);
});

test("la restitution produite pour le navigateur reste autonome et sans valeur métier", () => {
  // Ce que le composant téléchargerait après chargement d’un catalogue.
  const catalogue = annotateCatalogue(baseCatalogue());
  const html = renderDiagnosticHtml(catalogue, computeDiagnostic(catalogue));

  assert.match(html, /^<!doctype html>/);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /src="https?:/i);
  assert.doesNotMatch(html, /@example\.fr/);
});

test("l’en-tête partagé porte la navigation complète et retire la page courante", () => {
  const markup = renderToStaticMarkup(<SiteHeader current="/scan" />);

  assert.match(markup, /Diagnostic complet/);
  assert.match(markup, /En clair/);
  assert.match(markup, /Retour à l’accueil/);
  // La page courante ne se pointe pas elle-même dans sa propre navigation.
  assert.doesNotMatch(markup, /href="\/scan"/);
});

test("l’en-tête partagé rend toutes les entrées quand aucune page n’est courante", () => {
  const markup = renderToStaticMarkup(<SiteHeader />);

  for (const href of ["/scan", "/diagnostic", "/#methode", "/en-clair", "/auth/sign-in"]) {
    assert.ok(markup.includes(`href="${href}"`), `entrée manquante : ${href}`);
  }
});
