import assert from "node:assert/strict";
import test from "node:test";

import {
  formatMoney,
  parseAdminInput,
  type AdminInput,
  type ClientProfile,
  type EntityProfile,
} from "../lib/admin/entity-profile";
import {
  computeTotals,
  isEuCountry,
  nextInvoiceNumber,
  resolveVatTreatment,
} from "../lib/admin/invoicing";

export function sampleAdminInput(overrides: Partial<AdminInput> = {}): AdminInput {
  const parsed = parseAdminInput({
    entity: {
      profileVersion: "preuvance-admin-profile-v1",
      legalName: "Exemple Conseil",
      form: "micro_entreprise_fr",
      country: "FR",
      registrationLabel: "SIRET",
      registrationValue: "000 000 000 00000",
      vatRegime: "franchise_en_base_fr",
      address: {
        line1: "1 rue de l’Exemple",
        postalCode: "00000",
        city: "Villeneuve",
        country: "France",
      },
      email: "contact@exemple.test",
      representative: "Prénom Nom",
      currency: "EUR",
      paymentTermsDays: 30,
      bank: { holder: "Exemple Conseil", iban: "FR7630006000011234567890189" },
      ...(overrides.entity ?? {}),
    },
    client: {
      legalName: "Client de test",
      isBusiness: true,
      address: {
        line1: "2 avenue du Test",
        postalCode: "75000",
        city: "Paris",
        country: "France",
      },
      country: "FR",
      contactName: "Direction générale",
      ...(overrides.client ?? {}),
    },
    engagement: {
      reference: "TEST-001",
      subject: "Diagnostic complet des sources de données",
      issuedOn: "2026-07-25T09:00:00.000Z",
      workingDays: 10,
      lines: [
        {
          label: "Diagnostic complet",
          quantity: 1,
          unit: "forfait",
          unitPriceCents: 100_000,
        },
      ],
      scope: ["ERP Dolibarr"],
      exclusions: [],
      depositCents: 0,
      ...(overrides.engagement ?? {}),
    },
  });
  if (!parsed.success) throw new Error(parsed.errors.join(" | "));
  return parsed.data;
}

function entityWith(changes: Partial<EntityProfile>): EntityProfile {
  return { ...sampleAdminInput().entity, ...changes };
}

function clientWith(changes: Partial<ClientProfile>): ClientProfile {
  return { ...sampleAdminInput().client, ...changes };
}

test("la liste des États membres sert à distinguer l’Union du reste du monde", () => {
  assert.equal(isEuCountry("FR"), true);
  assert.equal(isEuCountry("de"), true);
  assert.equal(isEuCountry("CH"), false);
  assert.equal(isEuCountry("GB"), false);
  assert.equal(isEuCountry("US"), false);
});

test("franchise en base vers un client français : aucune TVA, mention de l’article 293 B", () => {
  const treatment = resolveVatTreatment(
    entityWith({ vatRegime: "franchise_en_base_fr" }),
    clientWith({ country: "FR" }),
  );
  assert.equal(treatment.ruleId, "fr-franchise-domestique");
  assert.equal(treatment.ratePercent, 0);
  assert.equal(treatment.reverseCharge, false);
  assert.match(treatment.mentions.join(" "), /293 B/);
  assert.ok(treatment.warnings.length > 0, "le seuil de franchise doit être rappelé");
});

test("franchise en base vers un assujetti d’un autre État membre : autoliquidation et DES", () => {
  const treatment = resolveVatTreatment(
    entityWith({ vatRegime: "franchise_en_base_fr" }),
    clientWith({ country: "DE", isBusiness: true }),
  );
  assert.equal(treatment.reverseCharge, true);
  assert.match(treatment.mentions.join(" "), /283, 2/);
  assert.match(treatment.obligations.join(" "), /déclaration européenne de services/i);
  assert.match(treatment.obligations.join(" "), /numéro de TVA intracommunautaire/i);
  assert.match(treatment.warnings.join(" "), /VIES/);
});

test("franchise en base vers un client suisse : hors champ, sans déclaration européenne", () => {
  const treatment = resolveVatTreatment(
    entityWith({ vatRegime: "franchise_en_base_fr" }),
    clientWith({ country: "CH", isBusiness: true }),
  );
  assert.equal(treatment.ruleId, "fr-franchise-hors-ue");
  assert.match(treatment.mentions.join(" "), /259, 1°/);
  assert.equal(treatment.obligations.length, 0);
});

test("régime réel français : 20 % en interne, autoliquidation dans l’Union, hors champ ailleurs", () => {
  const domestique = resolveVatTreatment(
    entityWith({ vatRegime: "assujetti_fr" }),
    clientWith({ country: "FR" }),
  );
  assert.equal(domestique.ratePercent, 20);
  assert.match(domestique.mentions.join(" "), /278/);

  const europe = resolveVatTreatment(
    entityWith({ vatRegime: "assujetti_fr" }),
    clientWith({ country: "BE", isBusiness: true }),
  );
  assert.equal(europe.ratePercent, 0);
  assert.equal(europe.reverseCharge, true);

  const suisse = resolveVatTreatment(
    entityWith({ vatRegime: "assujetti_fr" }),
    clientWith({ country: "CH", isBusiness: true }),
  );
  assert.equal(suisse.ratePercent, 0);
  assert.equal(suisse.reverseCharge, false);
});

test("un client européen non assujetti déclenche un avertissement plutôt qu’un taux deviné", () => {
  const treatment = resolveVatTreatment(
    entityWith({ vatRegime: "assujetti_fr" }),
    clientWith({ country: "ES", isBusiness: false }),
  );
  assert.match(treatment.warnings.join(" "), /guichet unique OSS/i);
});

test("société suisse assujettie : 8,1 % en Suisse, hors champ vers la France", () => {
  const interne = resolveVatTreatment(
    entityWith({ country: "CH", vatRegime: "assujetti_ch", currency: "CHF" }),
    clientWith({ country: "CH" }),
  );
  assert.equal(interne.ratePercent, 8.1);
  assert.match(interne.mentions.join(" "), /25 LTVA/);

  const versFrance = resolveVatTreatment(
    entityWith({ country: "CH", vatRegime: "assujetti_ch", currency: "CHF" }),
    clientWith({ country: "FR", isBusiness: true }),
  );
  assert.equal(versFrance.ratePercent, 0);
  assert.equal(versFrance.reverseCharge, true);
  assert.match(versFrance.mentions.join(" "), /8 al\. 1 LTVA/);
  assert.match(versFrance.mentions.join(" "), /283, 2/);
  assert.match(versFrance.warnings.join(" "), /182 B/);
  assert.ok(versFrance.basis.some((basis) => basis.url.includes("fedlex")));
});

test("société suisse non assujettie : aucune TVA, seuil mondial rappelé", () => {
  const treatment = resolveVatTreatment(
    entityWith({ country: "CH", vatRegime: "non_assujetti_ch", currency: "CHF" }),
    clientWith({ country: "FR", isBusiness: true }),
  );
  assert.equal(treatment.ratePercent, 0);
  assert.match(treatment.mentions.join(" "), /10 LTVA/);
  assert.match(treatment.warnings.join(" "), /chiffre d’affaires mondial/);
});

test("chaque règle cite au moins un fondement vérifiable", () => {
  const combinations: Array<[EntityProfile, ClientProfile]> = [
    [entityWith({ vatRegime: "franchise_en_base_fr" }), clientWith({ country: "FR" })],
    [entityWith({ vatRegime: "franchise_en_base_fr" }), clientWith({ country: "DE" })],
    [entityWith({ vatRegime: "assujetti_fr" }), clientWith({ country: "FR" })],
    [entityWith({ country: "CH", vatRegime: "assujetti_ch" }), clientWith({ country: "FR" })],
  ];
  for (const [entity, client] of combinations) {
    const treatment = resolveVatTreatment(entity, client);
    assert.ok(treatment.basis.length > 0, `règle ${treatment.ruleId} sans fondement`);
    for (const basis of treatment.basis) {
      assert.match(basis.url, /^https:\/\//, `fondement sans source : ${basis.label}`);
    }
  }
});

test("les totaux se calculent en centimes entiers, TVA arrondie explicitement", () => {
  const lines = [
    { label: "A", quantity: 2, unit: "jour", unitPriceCents: 65_000 },
    { label: "B", quantity: 1, unit: "forfait", unitPriceCents: 12_345 },
  ];
  const treatment = resolveVatTreatment(
    entityWith({ vatRegime: "assujetti_fr" }),
    clientWith({ country: "FR" }),
  );
  const totals = computeTotals(lines, treatment, 50_000);

  assert.equal(totals.subtotalCents, 142_345);
  assert.equal(totals.vatCents, 28_469);
  assert.equal(totals.totalCents, 170_814);
  assert.equal(totals.dueCents, 120_814);
});

test("un acompte supérieur au total ne produit jamais un net à payer négatif", () => {
  const treatment = resolveVatTreatment(
    entityWith({ vatRegime: "franchise_en_base_fr" }),
    clientWith({ country: "FR" }),
  );
  const totals = computeTotals(
    [{ label: "A", quantity: 1, unit: "forfait", unitPriceCents: 10_000 }],
    treatment,
    30_000,
  );
  assert.equal(totals.dueCents, 0);
});

test("la numérotation des factures est séquentielle et à largeur fixe", () => {
  assert.equal(nextInvoiceNumber("PV", 2026, 0), "PV-2026-0001");
  assert.equal(nextInvoiceNumber("PV", 2026, 41), "PV-2026-0042");
  assert.equal(nextInvoiceNumber("PV", 2026, 9_999), "PV-2026-10000");
});

test("le formatage monétaire groupe les milliers et porte le bon symbole", () => {
  assert.equal(formatMoney(100_000, "EUR"), "1 000,00 €");
  assert.equal(formatMoney(1_234_567, "CHF"), "12 345,67 CHF");
  assert.equal(formatMoney(5, "EUR"), "0,05 €");
  assert.equal(formatMoney(0, "EUR"), "0,00 €");
});
