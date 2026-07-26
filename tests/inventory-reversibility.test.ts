import assert from "node:assert/strict";
import test from "node:test";

import type { Catalogue, CatalogueTool } from "../lib/inventory/catalogue-contract";
import { createCatalogueDigest } from "../lib/inventory/catalogue-digest";
import { computeDiagnostic } from "../lib/inventory/diagnostic";
import {
  matchPlaybook,
  resolveReversibility,
  REVERSIBILITY_PLAYBOOKS,
} from "../lib/inventory/reversibility-playbooks";
import { renderDiagnosticMarkdown } from "../lib/inventory/report";
import { annotateCatalogue } from "../lib/inventory/sensitive-fields";
import { baseCatalogue } from "./inventory-catalogue.test";

function catalogueWith(overrides: Partial<Catalogue>): Catalogue {
  return annotateCatalogue({ ...baseCatalogue(), ...overrides });
}

function cloudTool(id: string, name: string): CatalogueTool {
  return { id, name, category: "crm", hosting: "cloud", evidence: "declared" };
}

test("le registre des fiches est intègre : identifiants uniques, contenu complet, fondement cité", () => {
  const ids = REVERSIBILITY_PLAYBOOKS.map((playbook) => playbook.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const playbook of REVERSIBILITY_PLAYBOOKS) {
    for (const field of [
      playbook.label,
      playbook.exportMethod,
      playbook.exportFormat,
      playbook.deletion,
      playbook.localMigration,
      playbook.basis,
    ]) {
      assert.ok(field.trim().length > 0, `${playbook.id}: champ vide`);
    }
    assert.ok(playbook.effortDays > 0, `${playbook.id}: charge nulle`);
    assert.match(playbook.basis, /[Aa]rt\./, `${playbook.id}: fondement sans article`);
  }
});

test("la reconnaissance par nom résiste à la casse, aux accents et aux variantes", () => {
  assert.equal(matchPlaybook("Salesforce Sales Cloud")?.id, "salesforce");
  assert.equal(matchPlaybook("SALESFORCE")?.id, "salesforce");
  assert.equal(matchPlaybook("HubSpot CRM")?.id, "hubspot");
  assert.equal(matchPlaybook("DoliCloud")?.id, "dolibarr");
  assert.equal(matchPlaybook("Google Workspace")?.id, "google-workspace");
  assert.equal(matchPlaybook("Office 365")?.id, "microsoft-365");
  assert.equal(matchPlaybook("OneDrive")?.id, "microsoft-365");
  assert.equal(matchPlaybook("Notion")?.id, "notion");
});

test("un nom ambigu ou inconnu ne matche pas : la sous-couverture est préférée au faux positif", () => {
  assert.equal(matchPlaybook("Outil métier interne"), null);
  assert.equal(matchPlaybook("Tableur d’équipe"), null);
  // « Notions » n'est pas « Notion », « SharePoint Server » on-premise n'est pas M365.
  assert.equal(matchPlaybook("Recueil de notions"), null);
  assert.equal(matchPlaybook("SharePoint Server 2019"), null);
});

test("un outil et une source du même éditeur ne produisent qu'une entrée, références cumulées", () => {
  const catalogue = catalogueWith({
    sources: [
      ...baseCatalogue().sources,
      {
        id: "crm-api",
        kind: "api",
        system: "salesforce",
        label: "CRM commercial",
        collectedAt: "2026-07-24T08:20:00.000Z",
        status: "collected",
        notes: [],
      },
    ],
    tools: [cloudTool("crm-salesforce", "Salesforce")],
  });

  const entries = resolveReversibility(catalogue);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].sheet?.id, "salesforce");
  assert.deepEqual(entries[0].toolIds, ["crm-salesforce"]);
  assert.deepEqual(entries[0].sourceIds, ["crm-api"]);
});

test("un outil cloud sans fiche produit une entrée sans prescription ; un outil on-premise, aucune", () => {
  const entries = resolveReversibility(
    catalogueWith({
      tools: [
        cloudTool("outil-inconnu", "Outil métier inconnu"),
        { ...cloudTool("erp-interne", "ERP interne"), hosting: "on_premise" },
      ],
    }),
  );

  assert.equal(entries.length, 1);
  assert.equal(entries[0].sheet, null);
  assert.equal(entries[0].label, "Outil métier inconnu");
});

test("une fiche reconnue produit un constat nominatif à pénalité nulle : documenté n'est pas pénalisé", () => {
  const diagnostic = computeDiagnostic(
    catalogueWith({ tools: [cloudTool("crm-salesforce", "Salesforce")] }),
  );

  const constat = diagnostic.findings.find(
    (item) => item.id === "reversibilite-sortie-a-tester-salesforce",
  );
  assert.ok(constat);
  assert.equal(constat.penalty, 0);
  assert.match(constat.detail, /Bulk API 2\.0/);
  assert.match(constat.recommendation, /restauration locale/);

  const axis = diagnostic.axes.find((item) => item.id === "reversibilite");
  assert.equal(axis?.score, 100);
  assert.equal(diagnostic.reversibility[0]?.sheet?.id, "salesforce");
});

test("un outil cloud sans fiche pénalise l'axe et renvoie à l'art. 28-3-g", () => {
  const diagnostic = computeDiagnostic(
    catalogueWith({ tools: [cloudTool("outil-inconnu", "Outil métier inconnu")] }),
  );

  const constat = diagnostic.findings.find(
    (item) => item.id === "reversibilite-sortie-non-documentee-outil-inconnu",
  );
  assert.ok(constat);
  assert.equal(constat.penalty, 5);
  assert.equal(constat.evidence, "absence_of_observation");
  assert.match(constat.basis ?? "", /28-3-g/);

  const axis = diagnostic.axes.find((item) => item.id === "reversibilite");
  assert.equal(axis?.score, 95);
});

test("le test d'export réel entre au plan de transition, dans la phase adaptée à sa charge", () => {
  const diagnostic = computeDiagnostic(
    catalogueWith({ tools: [cloudTool("crm-salesforce", "Salesforce")] }),
  );

  const structural = diagnostic.plan.find((phase) => phase.id === "phase-structurelle");
  assert.ok(
    structural?.actions.some(
      (action) => action.id === "action-reversibilite-sortie-a-tester-salesforce",
    ),
  );
});

test("le rapport porte la section « Réversibilité par outil » avec la fiche et les outils sans fiche", () => {
  const catalogue = catalogueWith({
    tools: [
      cloudTool("crm-salesforce", "Salesforce"),
      cloudTool("outil-inconnu", "Outil métier inconnu"),
    ],
  });
  const markdown = renderDiagnosticMarkdown(catalogue, computeDiagnostic(catalogue));

  assert.match(markdown, /## 7\. Réversibilité par outil/);
  assert.match(markdown, /## 8\. Portée et limites/);
  assert.match(markdown, /Data Export Service/);
  assert.match(markdown, /Sans fiche au registre preuvance-reversibility-v1 : Outil métier inconnu/);
  assert.match(markdown, /art\. 28-3-g/);
});

test("un catalogue sans outil en ligne le dit, au lieu d'inventer une dépendance", () => {
  const catalogue = catalogueWith({});
  const markdown = renderDiagnosticMarkdown(catalogue, computeDiagnostic(catalogue));
  assert.match(markdown, /Aucun outil hébergé en ligne n’a été repéré au catalogue/);
});

test("le digest anonymise l'identifiant d'un outil sans fiche, comme celui d'une source injoignable", () => {
  const catalogue = catalogueWith({
    tools: [cloudTool("outil-confidentiel", "Outil interne confidentiel")],
  });
  const digest = createCatalogueDigest(
    catalogue,
    computeDiagnostic(catalogue),
    "2026-07-24T09:00:00.000Z",
  );
  const serialized = JSON.stringify(digest);

  assert.doesNotMatch(serialized, /outil-confidentiel/);
  assert.ok(
    digest.findings.some((item) => item.id === "reversibilite-sortie-non-documentee"),
  );
});

test("le diagnostic reste déterministe avec des fiches résolues", () => {
  const catalogue = catalogueWith({
    tools: [cloudTool("crm-salesforce", "Salesforce"), cloudTool("notes", "Notion")],
  });
  assert.deepEqual(computeDiagnostic(catalogue), computeDiagnostic(catalogue));
});
