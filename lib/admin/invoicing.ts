import {
  formatMoney,
  type ClientProfile,
  type Currency,
  type EntityProfile,
  type OfferLine,
} from "./entity-profile";

/**
 * Traitement de TVA d'une prestation de services immatérielle, déterminé par
 * le couple (régime de l'émetteur, établissement du client).
 *
 * Le tableau ci-dessous est la seule source de vérité des mentions portées sur
 * les documents. Chaque règle cite son fondement : quand le régime change
 * (passage en TVA, changement de pays d'établissement), c'est ici qu'on
 * corrige, et tous les documents suivent.
 *
 * Ces mentions sont un point de départ vérifié sur les textes cités, pas un
 * avis fiscal : la première facture émise sous un nouveau régime doit être
 * relue par un expert-comptable ou une fiduciaire.
 */
export const INVOICING_RULES_VERSION = "preuvance-invoicing-v1";

export const INVOICING_DISCLAIMER =
  "Mentions fiscales générées automatiquement à partir du régime déclaré dans le profil administratif. Elles citent les textes applicables mais ne valent pas avis fiscal : faire relire la première facture émise sous un nouveau régime.";

export type LegalBasis = { label: string; url: string };

export type VatTreatment = {
  ruleId: string;
  /** Taux appliqué aux lignes, en points de pourcentage. */
  ratePercent: number;
  /** La TVA est due par le preneur (autoliquidation). */
  reverseCharge: boolean;
  /** Mentions à imprimer sur la facture, dans l'ordre. */
  mentions: string[];
  basis: LegalBasis[];
  /** Obligations connexes déclenchées par ce cas (déclarations, formalités). */
  obligations: string[];
  /** Pièges à traiter avant émission, jamais silencieux. */
  warnings: string[];
};

const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR",
  "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI",
  "SK",
]);

export function isEuCountry(country: string): boolean {
  return EU_COUNTRIES.has(country.trim().toUpperCase());
}

const CGI_293B: LegalBasis = {
  label: "Art. 293 B du CGI (franchise en base de TVA)",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047982348",
};
const CGI_259: LegalBasis = {
  label: "Art. 259, 1° du CGI (lieu des prestations de services entre assujettis)",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000021658108",
};
const CGI_283_2: LegalBasis = {
  label: "Art. 283, 2 du CGI (autoliquidation par le preneur)",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041471124",
};
const CGI_278: LegalBasis = {
  label: "Art. 278 du CGI (taux normal de TVA)",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006309735",
};
const CGI_182B: LegalBasis = {
  label: "Art. 182 B du CGI (retenue à la source sur sommes versées à un bénéficiaire étranger)",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044983182",
};
const LTVA_8: LegalBasis = {
  label: "Art. 8 al. 1 LTVA (lieu de la prestation de services : siège du destinataire)",
  url: "https://www.fedlex.admin.ch/eli/cc/2009/615/fr",
};
const LTVA_10: LegalBasis = {
  label: "Art. 10 LTVA (assujettissement) et art. 10 al. 2 let. a (seuil de chiffre d’affaires)",
  url: "https://www.fedlex.admin.ch/eli/cc/2009/615/fr",
};
const LTVA_25: LegalBasis = {
  label: "Art. 25 LTVA (taux de l’impôt)",
  url: "https://www.fedlex.admin.ch/eli/cc/2009/615/fr",
};
const LTVA_26: LegalBasis = {
  label: "Art. 26 LTVA (mentions obligatoires de la facture)",
  url: "https://www.fedlex.admin.ch/eli/cc/2009/615/fr",
};

const FRENCH_CLIENT_REVERSE_CHARGE =
  "Autoliquidation de la TVA par le preneur (art. 283, 2 du CGI).";

/**
 * Détermine le traitement applicable. Aucun cas n'est laissé implicite : si la
 * combinaison n'est pas couverte, une règle « à instruire » est rendue, avec
 * l'avertissement correspondant, plutôt qu'un taux deviné.
 */
export function resolveVatTreatment(
  entity: EntityProfile,
  client: ClientProfile,
): VatTreatment {
  const emitterCountry = entity.country.toUpperCase();
  const clientCountry = client.country.toUpperCase();
  const sameCountry = emitterCountry === clientCountry;
  const clientInEu = isEuCountry(clientCountry);

  /* --- Émetteur français en franchise en base --- */
  if (entity.vatRegime === "franchise_en_base_fr") {
    if (sameCountry || !client.isBusiness) {
      return {
        ruleId: "fr-franchise-domestique",
        ratePercent: 0,
        reverseCharge: false,
        mentions: ["TVA non applicable, art. 293 B du CGI."],
        basis: [CGI_293B],
        obligations: [],
        warnings: [
          "Surveiller le seuil de la franchise en base : son dépassement rend la TVA exigible et change toutes les mentions.",
        ],
      };
    }
    if (clientInEu) {
      return {
        ruleId: "fr-franchise-ue-b2b",
        ratePercent: 0,
        reverseCharge: true,
        mentions: [
          "TVA non applicable, art. 293 B du CGI.",
          FRENCH_CLIENT_REVERSE_CHARGE,
        ],
        basis: [CGI_293B, CGI_259, CGI_283_2],
        obligations: [
          "Un numéro de TVA intracommunautaire est nécessaire pour facturer une prestation de services à un assujetti établi dans un autre État membre, même en franchise en base.",
          "Déclaration européenne de services (DES) à déposer pour chaque mois de facturation.",
        ],
        warnings: [
          "Vérifier la validité du numéro de TVA du client dans VIES avant émission, et conserver la preuve de la vérification.",
        ],
      };
    }
    return {
      ruleId: "fr-franchise-hors-ue",
      ratePercent: 0,
      reverseCharge: false,
      mentions: [
        "TVA non applicable, art. 293 B du CGI.",
        "Prestation de services située hors de France (art. 259, 1° du CGI).",
      ],
      basis: [CGI_293B, CGI_259],
      obligations: [],
      warnings: [
        "Client hors Union européenne : pas de déclaration européenne de services, mais la TVA du pays du client peut être due par lui.",
      ],
    };
  }

  /* --- Émetteur français assujetti au régime réel --- */
  if (entity.vatRegime === "assujetti_fr") {
    if (sameCountry) {
      return {
        ruleId: "fr-reel-domestique",
        ratePercent: 20,
        reverseCharge: false,
        mentions: ["TVA au taux normal de 20 % (art. 278 du CGI)."],
        basis: [CGI_278],
        obligations: [],
        warnings: [],
      };
    }
    if (clientInEu && client.isBusiness) {
      return {
        ruleId: "fr-reel-ue-b2b",
        ratePercent: 0,
        reverseCharge: true,
        mentions: [FRENCH_CLIENT_REVERSE_CHARGE],
        basis: [CGI_259, CGI_283_2],
        obligations: ["Déclaration européenne de services (DES) mensuelle."],
        warnings: [
          "Vérifier la validité du numéro de TVA du client dans VIES avant émission.",
        ],
      };
    }
    if (clientInEu && !client.isBusiness) {
      return {
        ruleId: "fr-reel-ue-b2c",
        ratePercent: 20,
        reverseCharge: false,
        mentions: ["TVA au taux normal de 20 % (art. 278 du CGI)."],
        basis: [CGI_278],
        obligations: [],
        warnings: [
          "Client non assujetti établi dans l’Union : selon la nature exacte du service (notamment s’il est fourni par voie électronique), la TVA peut être due dans le pays du client via le guichet unique OSS. À valider avant émission.",
        ],
      };
    }
    return {
      ruleId: "fr-reel-hors-ue",
      ratePercent: 0,
      reverseCharge: false,
      mentions: ["Prestation de services située hors de France (art. 259, 1° du CGI)."],
      basis: [CGI_259],
      obligations: [],
      warnings: [],
    };
  }

  /* --- Émetteur suisse assujetti à la TVA --- */
  if (entity.vatRegime === "assujetti_ch") {
    if (sameCountry) {
      return {
        ruleId: "ch-assujetti-domestique",
        ratePercent: 8.1,
        reverseCharge: false,
        mentions: ["TVA suisse au taux normal de 8,1 % (art. 25 LTVA)."],
        basis: [LTVA_25, LTVA_26],
        obligations: [],
        warnings: [],
      };
    }
    const mentions = [
      "Prestation fournie à un destinataire établi à l’étranger : lieu de la prestation au siège du destinataire, hors du champ de la TVA suisse (art. 8 al. 1 LTVA).",
    ];
    const warnings = [
      "Conserver la preuve que le destinataire est établi à l’étranger : sans elle, l’AFC peut réclamer la TVA suisse.",
    ];
    if (clientCountry === "FR") {
      mentions.push(FRENCH_CLIENT_REVERSE_CHARGE);
      warnings.push(
        "Retenue à la source française (art. 182 B du CGI) : un client français peut être tenu de retenir sur des rémunérations de prestations versées à une société sans établissement stable en France. Prévoir la formalité conventionnelle avant la première facture.",
      );
    }
    return {
      ruleId: clientCountry === "FR" ? "ch-assujetti-vers-france" : "ch-assujetti-export",
      ratePercent: 0,
      reverseCharge: client.isBusiness,
      mentions,
      basis: clientCountry === "FR" ? [LTVA_8, CGI_283_2, CGI_182B] : [LTVA_8],
      obligations: [
        "Déclarer la prestation dans le décompte TVA suisse comme prestation exclue du champ de l’impôt, avec droit à la déduction de l’impôt préalable.",
      ],
      warnings,
    };
  }

  /* --- Émetteur suisse sous le seuil d'assujettissement --- */
  if (entity.vatRegime === "non_assujetti_ch") {
    const warnings = [
      "Le seuil d’assujettissement à la TVA suisse se calcule sur le chiffre d’affaires mondial : les prestations facturées à l’étranger comptent. Surveiller le franchissement.",
    ];
    if (clientCountry === "FR") {
      warnings.push(
        "Retenue à la source française (art. 182 B du CGI) : vérifier la position du client français avant la première facture.",
      );
    }
    return {
      ruleId: "ch-non-assujetti",
      ratePercent: 0,
      reverseCharge: client.isBusiness && clientCountry === "FR",
      mentions: [
        "Émetteur non assujetti à la TVA suisse (art. 10 LTVA).",
        ...(clientCountry === "FR" ? [FRENCH_CLIENT_REVERSE_CHARGE] : []),
      ],
      basis: clientCountry === "FR" ? [LTVA_10, CGI_283_2, CGI_182B] : [LTVA_10],
      obligations: [],
      warnings,
    };
  }

  return {
    ruleId: "a-instruire",
    ratePercent: 0,
    reverseCharge: false,
    mentions: ["Régime de TVA à déterminer avant émission."],
    basis: [],
    obligations: [],
    warnings: [
      "Combinaison régime / pays non couverte par le moteur : ne pas émettre sans validation par un expert-comptable ou une fiduciaire.",
    ],
  };
}

export type InvoiceTotals = {
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  depositCents: number;
  dueCents: number;
};

/** Totaux calculés en centimes entiers ; l'arrondi TVA est explicite. */
export function computeTotals(
  lines: readonly OfferLine[],
  treatment: VatTreatment,
  depositCents = 0,
): InvoiceTotals {
  const subtotalCents = lines.reduce(
    (sum, line) => sum + Math.round(line.unitPriceCents * line.quantity),
    0,
  );
  const vatCents = Math.round((subtotalCents * treatment.ratePercent) / 100);
  const totalCents = subtotalCents + vatCents;
  return {
    subtotalCents,
    vatCents,
    totalCents,
    depositCents,
    dueCents: Math.max(totalCents - depositCents, 0),
  };
}

export function lineRows(
  lines: readonly OfferLine[],
  currency: Currency,
): string[][] {
  return lines.map((line) => [
    line.label,
    `${line.quantity} ${line.unit}`,
    formatMoney(line.unitPriceCents, currency),
    formatMoney(Math.round(line.unitPriceCents * line.quantity), currency),
  ]);
}

/**
 * Numérotation séquentielle sans rupture, exigée pour une facture française.
 * Le compteur est porté par l'appelant : la fonction est pure et testable.
 */
export function nextInvoiceNumber(
  prefix: string,
  year: number,
  lastSequence: number,
): string {
  const sequence = String(lastSequence + 1).padStart(4, "0");
  return `${prefix}-${year}-${sequence}`;
}
