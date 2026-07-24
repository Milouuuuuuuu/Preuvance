import assert from "node:assert/strict";
import test from "node:test";

import {
  annotateCatalogue,
  annotateField,
  classifyFieldName,
  normalizeFieldName,
  summariseSensitivity,
} from "../lib/inventory/sensitive-fields";
import { baseCatalogue } from "./inventory-catalogue.test";

test("la normalisation sépare le camelCase, les chiffres et retire les accents", () => {
  assert.equal(normalizeFieldName("dateNaissance"), "_date_naissance_");
  assert.equal(normalizeFieldName("Téléphone1"), "_telephone_1_");
  assert.equal(normalizeFieldName("  email  "), "_email_");
  assert.equal(normalizeFieldName("__"), "_");
});

test("les catégories personnelles usuelles sont détectées", () => {
  const cases: Array<[string, string]> = [
    ["nom", "identifiant_direct"],
    ["date_naissance", "identifiant_direct"],
    ["email", "contact"],
    ["telephone", "contact"],
    ["code_postal", "contact"],
    ["numero_secu", "identifiant_national"],
    ["iban", "donnee_bancaire"],
    ["salaire_brut", "donnee_rh"],
    ["arret_maladie", "donnee_sensible_art9"],
    ["appartenance_syndicale", "donnee_sensible_art9"],
    ["empreinte_digitale", "donnee_sensible_art9"],
    ["mot_de_passe", "secret_technique"],
    ["api_key", "secret_technique"],
    ["adresse_ip", "localisation"],
  ];
  for (const [name, category] of cases) {
    const result = classifyFieldName(name);
    assert.ok(result, `« ${name} » aurait dû être classé`);
    assert.ok(
      result.categories.includes(category as never),
      `« ${name} » attendu en ${category}, obtenu ${result.categories.join(", ")}`,
    );
  }
});

test("les faux positifs classiques sont exclus", () => {
  for (const name of [
    "nom_fichier",
    "file_name",
    "nom_table",
    "nom_produit",
    "product_name",
    "raison_sociale",
    "nom_societe",
    "empreinte_fichier",
    "id_facture",
    "date_creation",
    "total_ttc",
    "quantite",
  ]) {
    assert.equal(classifyFieldName(name), null, `« ${name} » ne devrait pas être signalé`);
  }
});

test("un champ art. 9 conserve la confiance haute et cite son fondement", () => {
  const result = classifyFieldName("donnee_genetique");
  assert.ok(result);
  assert.equal(result.confidence, "high");
  assert.match(result.basis, /art\. 9/i);
  assert.ok(result.ruleIds.length > 0);
});

test("un « nom » porté par une table d’objets voit sa confiance abaissée et motivée", () => {
  const inPeople = annotateField({ name: "nom", dataType: "varchar" }, "contacts");
  assert.equal(inPeople.sensitivity?.confidence, "high");

  const inProducts = annotateField({ name: "nom", dataType: "varchar" }, "llx_product");
  assert.equal(inProducts.sensitivity?.confidence, "medium");
  assert.match(inProducts.sensitivity?.basis ?? "", /ne décrit pas des personnes/);
});

test("l’annotation d’un catalogue alimente des agrégats cohérents", () => {
  const catalogue = annotateCatalogue(baseCatalogue());
  const summary = summariseSensitivity(catalogue);

  assert.equal(summary.fieldsTotal, 2);
  assert.equal(summary.fieldsSensitive, 1);
  assert.equal(summary.datasetsWithPersonalData, 1);
  assert.equal(summary.datasetsWithSpecialCategories, 0);
  assert.equal(summary.byCategory[0].category, "contact");
});

test("la classification est déterministe : deux appels rendent le même verdict", () => {
  const first = classifyFieldName("numero_carte");
  const second = classifyFieldName("numero_carte");
  assert.deepEqual(first, second);
});
