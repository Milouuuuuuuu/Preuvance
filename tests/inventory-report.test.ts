import assert from "node:assert/strict";
import test from "node:test";

import type { Catalogue } from "../lib/inventory/catalogue-contract";
import { computeDiagnostic } from "../lib/inventory/diagnostic";
import { buildFlowGraph, toMermaid } from "../lib/inventory/flow-map";
import {
  buildReportModel,
  renderDiagnosticHtml,
  renderDiagnosticMarkdown,
} from "../lib/inventory/report";
import { annotateCatalogue } from "../lib/inventory/sensitive-fields";
import { baseCatalogue } from "./inventory-catalogue.test";

function richCatalogue(): Catalogue {
  const base = baseCatalogue();
  return annotateCatalogue({
    ...base,
    tools: [
      {
        id: "assistant-ia",
        name: "Assistant de rédaction",
        category: "ia",
        hosting: "cloud",
        aiProviders: ["openai"],
        sourceIds: ["erp-sql"],
        evidence: "declared",
      },
    ],
    flows: [
      {
        id: "flux-export",
        from: { kind: "source", ref: "erp-sql" },
        to: { kind: "tool", ref: "assistant-ia" },
        medium: "export_fichier",
        frequency: "hebdomadaire",
        personalData: "yes",
        transfersOutsideEu: "unknown",
        evidence: "declared",
        label: "export clients",
      },
    ],
  });
}

test("le graphe distingue sources, outils et fournisseurs d’IA", () => {
  const graph = buildFlowGraph(richCatalogue());
  const kinds = graph.nodes.map((node) => node.kind);
  assert.ok(kinds.includes("source"));
  assert.ok(kinds.includes("tool"));
  assert.ok(kinds.includes("ai_provider"));

  const provider = graph.nodes.find((node) => node.kind === "ai_provider");
  assert.equal(provider?.label, "OpenAI");

  const edge = graph.edges.find((item) => item.id === "edge-flux-export");
  assert.equal(edge?.personalData, "yes");
  assert.equal(edge?.evidence, "declared");
});

test("un catalogue sans flux le dit au lieu d’en inventer", () => {
  const graph = buildFlowGraph(baseCatalogue());
  assert.deepEqual(graph.edges, []);
  assert.match(graph.notes.join(" "), /Aucun flux/);
});

test("le rendu Mermaid marque le déclaré en pointillés et échappe les libellés", () => {
  const catalogue = richCatalogue();
  const mermaid = toMermaid(buildFlowGraph(catalogue));
  assert.match(mermaid, /^flowchart LR/);
  assert.match(mermaid, /-\.->/);
  assert.match(mermaid, /données personnelles · export clients/);

  const hostile = buildFlowGraph({
    ...catalogue,
    tools: [
      {
        id: "outil-hostile",
        name: 'Outil "avec" <balises>',
        category: "autre",
        hosting: "unknown",
        evidence: "declared",
      },
    ],
    flows: [],
  });
  const rendered = toMermaid(hostile);
  assert.doesNotMatch(rendered, /<balises>/);
  assert.doesNotMatch(rendered, /Outil "avec"/);
});

test("le rapport Markdown contient les sections attendues et la cartographie", () => {
  const catalogue = richCatalogue();
  const markdown = renderDiagnosticMarkdown(catalogue, computeDiagnostic(catalogue));

  for (const title of [
    "## 1. Synthèse",
    "## 2. Couverture de la collecte",
    "## 3. Constats",
    "## 4. Données personnelles repérées",
    "## 5. Cartographie des flux",
    "## 6. Plan de transition",
    "## 7. Réversibilité par outil",
    "## 8. Portée et limites",
  ]) {
    assert.ok(markdown.includes(title), `section manquante : ${title}`);
  }

  assert.match(markdown, /```mermaid/);
  assert.match(markdown, /Client de démonstration/);
  assert.match(markdown, /ni un avis juridique/);
});

test("le rapport HTML est autonome : aucune ressource externe, aucun script", () => {
  const catalogue = richCatalogue();
  const html = renderDiagnosticHtml(catalogue, computeDiagnostic(catalogue));

  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<html lang="fr">/);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /src="https?:/i);
  assert.doesNotMatch(html, /<link\b/i);
  assert.match(html, /@media print/);
});

test("le HTML échappe le contenu hostile d’un catalogue", () => {
  const catalogue = richCatalogue();
  const hostile: Catalogue = {
    ...catalogue,
    mission: { ...catalogue.mission, client: '<img src=x onerror="alert(1)">' },
  };
  const html = renderDiagnosticHtml(hostile, computeDiagnostic(hostile));

  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
});

test("Markdown et HTML sont rendus depuis le même modèle de rapport", () => {
  const catalogue = richCatalogue();
  const diagnostic = computeDiagnostic(catalogue);
  const model = buildReportModel(catalogue, diagnostic);

  assert.equal(model.score, diagnostic.score);
  assert.equal(model.sections.length, 8);

  const markdown = renderDiagnosticMarkdown(catalogue, diagnostic);
  const html = renderDiagnosticHtml(catalogue, diagnostic);
  for (const section of model.sections) {
    assert.ok(markdown.includes(section.title), `Markdown : ${section.title}`);
    assert.ok(html.includes(section.title), `HTML : ${section.title}`);
  }
});

test("les plafonds appliqués sont écrits dans le rapport, pas seulement dans le score", () => {
  const catalogue = richCatalogue();
  const diagnostic = computeDiagnostic(catalogue);
  const markdown = renderDiagnosticMarkdown(catalogue, diagnostic);

  assert.ok(diagnostic.appliedCaps.length > 0);
  assert.match(markdown, /Plafond appliqué/);
  assert.match(markdown, new RegExp(`Calcul pondéré avant plafonds : ${diagnostic.rawScore}`));
});

test("le rapport ne contient aucune valeur métier issue des jeux de données", () => {
  const catalogue = richCatalogue();
  const markdown = renderDiagnosticMarkdown(catalogue, computeDiagnostic(catalogue));
  assert.doesNotMatch(markdown, /@example\.fr|FR76300060/);
});
