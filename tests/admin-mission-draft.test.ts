import assert from "node:assert/strict";
import test from "node:test";

import {
  SOURCE_KINDS,
  checkMission,
  emptyMission,
  newSource,
  slugify,
  sourceKindOf,
  summarize,
} from "../lib/admin/mission-draft";
import { buildSourcePrompt, emptyPlan } from "../lib/admin/preparation";
import { MISSION_CONFIG_VERSION } from "../lib/inventory/mission-config";

/** Mission minimale valide, sur laquelle les tests ajoutent des sources. */
function missionBase() {
  return {
    ...emptyMission(),
    mission: {
      client: "Société Alpha",
      reference: "PVD-2026-001",
      mode: "metadata_only" as const,
    },
  };
}

test("une mission vierge porte la bonne version et n’est pas encore valide", () => {
  const mission = emptyMission();
  assert.equal(mission.configVersion, MISSION_CONFIG_VERSION);
  const verdict = checkMission(mission);
  assert.equal(verdict.valid, false, "client et référence vides devraient être refusés");
  if (verdict.valid) return;
  const cibles = verdict.problems.map((p) => p.where);
  assert.ok(cibles.includes("Client"), `attendait « Client », reçu ${cibles.join(", ")}`);
  assert.ok(cibles.includes("Référence"));
});

test("chaque gabarit de source produit un objet conforme une fois nommé", () => {
  for (const kind of SOURCE_KINDS) {
    const source = newSource(kind.id, `source-${kind.id}`) as Record<string, unknown>;
    source.label = `Source ${kind.label}`;
    if (kind.id === "sql") {
      (source.executor as Record<string, unknown>).directory = "C:\\resultats";
    }
    if (kind.id === "file") source.directory = "C:\\exports";

    const verdict = checkMission({ ...missionBase(), sources: [source] });
    assert.equal(
      verdict.valid,
      true,
      `gabarit ${kind.id} invalide : ${
        verdict.valid ? "" : verdict.problems.map((p) => `${p.where} ${p.message}`).join(" | ")
      }`,
    );
    assert.equal(sourceKindOf(source as never), kind.id);
  }
});

test("un exécuteur non autorisé est refusé, chemin compris", () => {
  const source = newSource("sql", "base") as Record<string, unknown>;
  source.label = "Base de production";
  source.executor = {
    type: "command",
    command: "powershell",
    args: ["-c", "{{sql}}"],
    format: "csv",
    sqlOnStdin: false,
    timeoutMs: 120_000,
  };
  const verdict = checkMission({ ...missionBase(), sources: [source] });
  assert.equal(verdict.valid, false, "powershell aurait dû être refusé");
  if (verdict.valid) return;
  assert.match(verdict.problems.map((p) => p.message).join(" "), /exécuteur non autorisé/);
});

test("les problèmes désignent la source par son nom, pas par son indice", () => {
  const source = newSource("file", "exports") as Record<string, unknown>;
  source.label = "Exports commerciaux";
  source.maxFiles = 99_999; // au-delà du plafond
  const verdict = checkMission({ ...missionBase(), sources: [source] });
  assert.equal(verdict.valid, false);
  if (verdict.valid) return;
  assert.ok(
    verdict.problems.some((p) => p.where.startsWith("Exports commerciaux")),
    `attendait le nom de la source, reçu : ${verdict.problems.map((p) => p.where).join(", ")}`,
  );
});

test("slugify produit des identifiants valides et sans collision", () => {
  assert.equal(slugify("Base de données Étoile"), "base-de-donnees-etoile");
  assert.equal(slugify("ERP", ["erp"]), "erp-2");
  assert.equal(slugify("ERP", ["erp", "erp-2"]), "erp-3");
  assert.equal(slugify("!!!"), "source");
  // L'identifiant doit rester accepté par le schéma.
  const source = newSource("file", slugify("Exports 2026 !")) as Record<string, unknown>;
  source.label = "Exports";
  source.directory = "C:\\exports";
  assert.equal(checkMission({ ...missionBase(), sources: [source] }).valid, true);
});

test("le résumé compte les sources par type et dérive un accès par source", () => {
  const sql = newSource("sql", "base") as Record<string, unknown>;
  sql.label = "ERP PostgreSQL";
  (sql.executor as Record<string, unknown>).directory = "C:\\resultats";
  const fichiers = newSource("file", "exports") as Record<string, unknown>;
  fichiers.label = "Exports commerciaux";
  fichiers.directory = "C:\\exports";

  const verdict = checkMission({ ...missionBase(), sources: [sql, fichiers] });
  assert.equal(verdict.valid, true);
  if (!verdict.valid) return;

  const resume = summarize(verdict.mission);
  assert.equal(resume.sources, 2);
  assert.deepEqual(
    resume.parKind.map((entry) => [entry.kind.id, entry.count]),
    [
      ["sql", 1],
      ["file", 1],
    ],
  );
  assert.deepEqual(
    resume.acces.map((a) => a.label),
    ["ERP PostgreSQL", "Exports commerciaux"],
  );
  assert.ok(resume.acces[0].owner.includes("DSI"));
  assert.ok(resume.acces[1].owner.includes("métier"));
});

test("le prompt intègre les accès par source avant les attentes", () => {
  const sources = [
    { id: "base", label: "ERP PostgreSQL", method: "Compte de lecture seule", owner: "DSI" },
    { id: "exports", label: "Exports commerciaux", method: "Droit de lecture", owner: "Métier" },
  ];
  const prompt = buildSourcePrompt(emptyPlan(), sources);

  assert.match(prompt, /ACCÈS À OBTENIR, SOURCE PAR SOURCE :/);
  assert.match(prompt, /ERP PostgreSQL : Compte de lecture seule \(DSI\)/);
  assert.ok(
    prompt.indexOf("ACCÈS À OBTENIR") < prompt.indexOf("CE QUE J’ATTENDS DE TOI"),
    "la demande doit précéder la consigne",
  );
  // Sans source, le prompt reste celui du plan seul.
  assert.doesNotMatch(buildSourcePrompt(emptyPlan(), []), /ACCÈS À OBTENIR/);
});

test("les problèmes de validation sont en français, jamais en anglais brut", () => {
  const sql = newSource("sql", "base") as Record<string, unknown>;
  sql.label = "ERP";
  const fichiers = newSource("file", "exports") as Record<string, unknown>;
  fichiers.label = "Exports";
  fichiers.maxFiles = 99_999;
  const salesforce = newSource("salesforce", "sf") as Record<string, unknown>;
  salesforce.label = "CRM";
  salesforce.instanceUrl = "pas-une-url";

  const verdict = checkMission({
    ...emptyMission(),
    mission: { client: "", reference: "", mode: "metadata_only" as const },
    sources: [sql, fichiers, salesforce],
  });
  assert.equal(verdict.valid, false);
  if (verdict.valid) return;

  const anglais = /\b(expected|received|Too small|Too big|Invalid|String must|characters)\b/;
  for (const problem of verdict.problems) {
    assert.doesNotMatch(
      problem.message,
      anglais,
      `message non traduit sur « ${problem.where} » : ${problem.message}`,
    );
    assert.doesNotMatch(
      problem.where,
      /executor\.|instanceUrl|maxFiles/,
      `chemin technique non traduit : ${problem.where}`,
    );
  }

  // Le champ vide est annoncé comme « à renseigner », pas comme une longueur.
  assert.ok(
    verdict.problems.some((p) => p.where === "Client" && p.message === "à renseigner"),
    `attendait « Client / à renseigner », reçu : ${verdict.problems
      .map((p) => `${p.where}=${p.message}`)
      .join(" | ")}`,
  );
  // Le nom de champ du formulaire est repris tel quel.
  assert.ok(
    verdict.problems.some((p) => p.where.includes("Dossier des résultats")),
    "le chemin executor.directory devrait devenir « Dossier des résultats »",
  );
});
