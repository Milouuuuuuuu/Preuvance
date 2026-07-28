import { z } from "zod";

/**
 * Profil administratif : qui facture, sous quel régime, avec quelles
 * coordonnées de paiement.
 *
 * Ce fichier est la seule chose à mettre à jour quand l'entité émettrice
 * change : passage d'une micro-entreprise française à une Sàrl suisse, par
 * exemple. Tous les documents de mission (lettre de mission, facture, contrat
 * de sous-traitance, registre, attestation) en découlent, ce qui évite qu'une
 * mention légale reste figée dans un modèle Word oublié.
 *
 * Il ne contient aucun secret : numéro d'entreprise, adresse et IBAN sont des
 * informations que l'on imprime déjà sur une facture.
 */
export const ADMIN_PROFILE_VERSION = "preuvance-admin-profile-v1";

export const ENTITY_FORMS = [
  "micro_entreprise_fr",
  "entreprise_individuelle_fr",
  "eurl_fr",
  "sasu_fr",
  "sarl_ch",
  "sa_ch",
  "raison_individuelle_ch",
  "autre",
] as const;
export type EntityForm = (typeof ENTITY_FORMS)[number];

export const ENTITY_FORM_LABELS: Record<EntityForm, string> = {
  micro_entreprise_fr: "micro-entreprise (France)",
  entreprise_individuelle_fr: "entreprise individuelle (France)",
  eurl_fr: "EURL (France)",
  sasu_fr: "SASU (France)",
  sarl_ch: "Sàrl (Suisse)",
  sa_ch: "SA (Suisse)",
  raison_individuelle_ch: "raison individuelle (Suisse)",
  autre: "autre forme",
};

/**
 * Régime de TVA de l'entité émettrice. Il détermine à lui seul les mentions
 * portées sur la facture (voir `lib/admin/invoicing.ts`).
 */
export const VAT_REGIMES = [
  /** France, franchise en base : aucune TVA facturée (art. 293 B du CGI). */
  "franchise_en_base_fr",
  /** France, régime réel : TVA facturée selon le lieu de la prestation. */
  "assujetti_fr",
  /** Suisse, assujetti à la TVA (inscrit au registre de l'AFC). */
  "assujetti_ch",
  /** Suisse, sous le seuil d'assujettissement : aucune TVA facturée. */
  "non_assujetti_ch",
] as const;
export type VatRegime = (typeof VAT_REGIMES)[number];

export const CURRENCIES = ["EUR", "CHF"] as const;
export type Currency = (typeof CURRENCIES)[number];

const addressSchema = z
  .object({
    line1: z.string().trim().min(1).max(200),
    line2: z.string().trim().max(200).optional(),
    postalCode: z.string().trim().min(1).max(20),
    city: z.string().trim().min(1).max(120),
    country: z.string().trim().min(2).max(60),
  })
  .strict();

export const entityProfileSchema = z
  .object({
    profileVersion: z.literal(ADMIN_PROFILE_VERSION),
    legalName: z.string().trim().min(1).max(200),
    tradeName: z.string().trim().max(200).optional(),
    form: z.enum(ENTITY_FORMS),
    /** Code pays ISO à deux lettres de l'établissement : FR, CH… */
    country: z.string().trim().length(2).toUpperCase(),
    /** SIREN/SIRET en France, IDE (CHE-…) en Suisse. */
    registrationLabel: z.string().trim().min(1).max(40),
    registrationValue: z.string().trim().min(1).max(60),
    vatNumber: z.string().trim().max(40).optional(),
    vatRegime: z.enum(VAT_REGIMES),
    address: addressSchema,
    email: z.string().trim().email(),
    phone: z.string().trim().max(40).optional(),
    website: z.string().trim().max(200).optional(),
    /** Représentant légal signataire des documents. */
    representative: z.string().trim().min(1).max(200),
    currency: z.enum(CURRENCIES),
    bank: z
      .object({
        holder: z.string().trim().min(1).max(200),
        iban: z.string().trim().min(5).max(40),
        bic: z.string().trim().max(20).optional(),
        bankName: z.string().trim().max(120).optional(),
      })
      .strict()
      .optional(),
    paymentTermsDays: z.number().int().min(0).max(120).default(30),
    /** Mention libre ajoutée en pied de chaque document (assurance RC, etc.). */
    footerNote: z.string().trim().max(400).optional(),
    /** Délégué à la protection des données ou point de contact vie privée. */
    privacyContact: z.string().trim().max(200).optional(),
  })
  .strict();

export type EntityProfile = z.infer<typeof entityProfileSchema>;

export const clientProfileSchema = z
  .object({
    legalName: z.string().trim().min(1).max(200),
    /** Personne morale assujettie : conditionne l'autoliquidation. */
    isBusiness: z.boolean().default(true),
    vatNumber: z.string().trim().max(40).optional(),
    registrationValue: z.string().trim().max(60).optional(),
    address: addressSchema,
    country: z.string().trim().length(2).toUpperCase(),
    contactName: z.string().trim().max(200).optional(),
    contactEmail: z.string().trim().email().optional(),
  })
  .strict();

export type ClientProfile = z.infer<typeof clientProfileSchema>;

export const offerLineSchema = z
  .object({
    label: z.string().trim().min(1).max(300),
    quantity: z.number().min(0).max(10_000).default(1),
    unit: z.string().trim().max(40).default("forfait"),
    /** Prix unitaire hors taxe, en centimes : jamais de flottant sur de l'argent. */
    unitPriceCents: z.number().int().min(0).max(1_000_000_000),
  })
  .strict();

export type OfferLine = z.infer<typeof offerLineSchema>;

export const engagementSchema = z
  .object({
    /** Référence de mission, alignée sur le fichier de mission de l'agent. */
    reference: z.string().trim().min(1).max(80),
    subject: z.string().trim().min(1).max(300),
    issuedOn: z.string().trim().max(40),
    lines: z.array(offerLineSchema).min(1).max(30),
    /** Jours ouvrés annoncés pour la restitution. */
    workingDays: z.number().int().min(1).max(60).default(10),
    scope: z.array(z.string().trim().min(1).max(300)).max(40).default([]),
    exclusions: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
    /** Numéro de facture, quand le document émis est une facture. */
    invoiceNumber: z.string().trim().max(40).optional(),
    /** Acompte déjà réglé, en centimes. */
    depositCents: z.number().int().min(0).max(1_000_000_000).default(0),
  })
  .strict();

export type Engagement = z.infer<typeof engagementSchema>;

export const adminInputSchema = z
  .object({
    entity: entityProfileSchema,
    client: clientProfileSchema,
    engagement: engagementSchema,
  })
  .strict();

export type AdminInput = z.infer<typeof adminInputSchema>;

export type AdminValidation =
  | { success: true; data: AdminInput }
  | { success: false; errors: string[] };

export function parseAdminInput(input: unknown): AdminValidation {
  const result = adminInputSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.issues
      .slice(0, 30)
      .map((issue) => `${issue.path.join(".") || "profil"}: ${issue.message}`),
  };
}

/** Formatage monétaire à partir de centimes, sans arithmétique flottante. */
export function formatMoney(cents: number, currency: Currency): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const units = Math.trunc(absolute / 100);
  const decimals = String(absolute % 100).padStart(2, "0");
  const grouped = String(units).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${grouped},${decimals} ${currency === "EUR" ? "€" : "CHF"}`;
}

export function formatDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  const date = new Date(parsed);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

/** Échéance de paiement dérivée de la date d'émission et du délai convenu. */
export function dueDate(issuedOn: string, paymentTermsDays: number): string {
  const parsed = Date.parse(issuedOn);
  if (!Number.isFinite(parsed)) return issuedOn;
  return new Date(parsed + paymentTermsDays * 24 * 60 * 60 * 1000).toISOString();
}

export function entityIdentityLines(entity: EntityProfile): string[] {
  const lines = [
    `${entity.legalName}${entity.tradeName ? ` (${entity.tradeName})` : ""}, ${ENTITY_FORM_LABELS[entity.form]}`,
    entity.address.line1,
    ...(entity.address.line2 ? [entity.address.line2] : []),
    `${entity.address.postalCode} ${entity.address.city}, ${entity.address.country}`,
    `${entity.registrationLabel} ${entity.registrationValue}`,
  ];
  if (entity.vatNumber) lines.push(`N° de TVA ${entity.vatNumber}`);
  lines.push(entity.email);
  if (entity.phone) lines.push(entity.phone);
  return lines;
}

export function clientIdentityLines(client: ClientProfile): string[] {
  const lines = [
    client.legalName,
    client.address.line1,
    ...(client.address.line2 ? [client.address.line2] : []),
    `${client.address.postalCode} ${client.address.city}, ${client.address.country}`,
  ];
  if (client.registrationValue) lines.push(`Identifiant ${client.registrationValue}`);
  if (client.vatNumber) lines.push(`N° de TVA ${client.vatNumber}`);
  if (client.contactName) lines.push(`Contact : ${client.contactName}`);
  return lines;
}
