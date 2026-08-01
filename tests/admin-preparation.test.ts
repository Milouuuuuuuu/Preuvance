import assert from "node:assert/strict";
import test from "node:test";

import {
  OWNER_LABELS,
  PREPARATION_ITEMS,
  PREPARATION_VERSION,
  buildPreparationPrompt,
  emptyPlan,
  parsePreparationPlan,
  preparationProgress,
} from "../lib/admin/preparation";

test("le catalogue de préparation est cohérent et sans doublon", () => {
  const ids = PREPARATION_ITEMS.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, "identifiants dupliqués");
  for (const item of PREPARATION_ITEMS) {
    assert.ok(item.label.length > 10, `libellé trop court : ${item.id}`);
    assert.ok(item.consequence.length > 10, `conséquence non écrite : ${item.id}`);
    assert.match(item.deadline, /^J[-+]?\d+$/, `délai mal formé : ${item.deadline}`);
    assert.ok(OWNER_LABELS[item.owner], `responsable sans libellé : ${item.owner}`);
  }
});

test("un plan vide couvre tous les éléments et n’en coche aucun", () => {
  const plan = emptyPlan();
  assert.equal(plan.version, PREPARATION_VERSION);
  assert.equal(plan.entries.length, PREPARATION_ITEMS.length);
  const progress = preparationProgress(plan);
  assert.equal(progress.done, 0);
  assert.equal(progress.missing.length, PREPARATION_ITEMS.length);
});

test("le DPA est le seul élément dont l’absence bloque la collecte", () => {
  const plan = emptyPlan();
  assert.deepEqual(
    preparationProgress(plan).blocking.map((item) => item.id),
    ["dpa"],
  );

  const avecDpa = {
    ...plan,
    entries: plan.entries.map((entry) =>
      entry.id === "dpa" ? { ...entry, done: true } : entry,
    ),
  };
  assert.deepEqual(preparationProgress(avecDpa).blocking, []);
  assert.equal(preparationProgress(avecDpa).done, 1);
});

test("un plan écrit par une version antérieure est complété, jamais rejeté", () => {
  const partiel = {
    version: PREPARATION_VERSION,
    client: "Client",
    reference: "PV-2026-0001",
    entries: [{ id: "dpa", done: true, note: "signé le 12" }],
    notes: "",
  };
  const parsed = parsePreparationPlan(partiel);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.entries.length, PREPARATION_ITEMS.length);
  assert.equal(parsed.data.entries.find((e) => e.id === "dpa")?.note, "signé le 12");
  assert.equal(parsed.data.entries.find((e) => e.id === "perimetre")?.done, false);
});

test("un plan non conforme est refusé avec un motif, sans repli silencieux", () => {
  for (const invalide of [
    { version: "autre-version", client: "", reference: "", entries: [], notes: "" },
    { version: PREPARATION_VERSION, client: "", reference: "", entries: [{ id: "inconnu", done: true, note: "" }], notes: "" },
    { version: PREPARATION_VERSION, client: "", reference: "", entries: [{ id: "dpa", done: "oui", note: "" }], notes: "" },
    null,
    "texte",
  ]) {
    const parsed = parsePreparationPlan(invalide);
    assert.equal(parsed.success, false, `aurait dû être refusé : ${JSON.stringify(invalide)}`);
    if (!parsed.success) assert.ok(parsed.error.length > 0, "motif de refus vide");
  }
});

test("le prompt est déterministe et distingue obtenu et manquant", () => {
  const plan = {
    ...emptyPlan(),
    client: "Société Alpha",
    reference: "PV-2026-0007",
    entries: emptyPlan().entries.map((entry) =>
      entry.id === "dpa" ? { ...entry, done: true, note: "signé le 12/07" } : entry,
    ),
    notes: "Le DBA part en congés vendredi.",
  };

  const prompt = buildPreparationPrompt(plan);
  assert.equal(prompt, buildPreparationPrompt(plan), "deux appels donnent des textes différents");

  assert.match(prompt, /Société Alpha/);
  assert.match(prompt, /PV-2026-0007/);
  assert.match(prompt, /1 élément obtenu sur 7/);
  assert.match(prompt, /OBTENU :/);
  assert.match(prompt, /signé le 12\/07/);
  assert.match(prompt, /MANQUANT :/);
  assert.match(prompt, /Le DBA part en congés vendredi\./);

  // Le DPA étant obtenu, le rappel de blocage ne doit pas apparaître.
  assert.doesNotMatch(prompt, /ne peut pas démarrer tant que le DPA/);
});

test("le prompt rappelle le blocage quand le DPA manque", () => {
  const prompt = buildPreparationPrompt(emptyPlan());
  assert.match(prompt, /ne peut pas démarrer tant que le DPA/);
  assert.doesNotMatch(prompt, /OBTENU :/);
});

test("le prompt n’autorise aucune promesse de conformité", () => {
  const complet = {
    ...emptyPlan(),
    entries: emptyPlan().entries.map((entry) => ({ ...entry, done: true })),
  };
  for (const prompt of [buildPreparationPrompt(emptyPlan()), buildPreparationPrompt(complet)]) {
    assert.match(prompt, /sans promettre de conformité, de certification ni de décision d’assurabilité/);
    assert.match(prompt, /Une absence d’observation n’est jamais un point positif/);
  }
  assert.match(buildPreparationPrompt(complet), /7 éléments obtenus sur 7/);
  assert.match(buildPreparationPrompt(emptyPlan()), /0 élément obtenu sur 7/);
});
