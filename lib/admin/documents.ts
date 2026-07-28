import type { DocumentBlock, DocumentModel, DocumentSection } from "@/lib/documents/render";

import {
  clientIdentityLines,
  dueDate,
  entityIdentityLines,
  formatDate,
  formatMoney,
  type AdminInput,
  type EntityProfile,
} from "./entity-profile";
import {
  computeTotals,
  INVOICING_DISCLAIMER,
  INVOICING_RULES_VERSION,
  lineRows,
  resolveVatTreatment,
} from "./invoicing";

/**
 * Documents administratifs d'une mission Preuvance.
 *
 * Tous sont dérivés du même profil et du même engagement : la lettre de
 * mission, la facture, le contrat de sous-traitance, le registre de traitement
 * et l'attestation de fin de mission ne peuvent pas se contredire, puisqu'ils
 * lisent les mêmes champs. C'est le point : l'administratif d'une mission
 * cesse d'être six fichiers Word divergents.
 */
export const ADMIN_DOCUMENTS_VERSION = "preuvance-admin-documents-v1";

function footerFor(entity: EntityProfile): string {
  const parts = [
    `${entity.legalName}, ${entity.registrationLabel} ${entity.registrationValue}`,
  ];
  if (entity.footerNote) parts.push(entity.footerNote);
  parts.push("Document produit localement par Preuvance, sans transmission à un tiers.");
  return parts.join(" · ");
}

function partiesSection(input: AdminInput): DocumentSection {
  return {
    id: "parties",
    title: "Parties",
    blocks: [
      {
        kind: "table",
        head: ["Prestataire", "Client"],
        rows: [
          [entityIdentityLines(input.entity).join("\n"), clientIdentityLines(input.client).join("\n")],
        ],
      },
    ],
  };
}

/* --------------------------------------------------------------------------
 * 1. Lettre de mission (vaut devis et cadre contractuel)
 * ----------------------------------------------------------------------- */

export function buildEngagementLetter(input: AdminInput): DocumentModel {
  const { entity, client, engagement } = input;
  const treatment = resolveVatTreatment(entity, client);
  const totals = computeTotals(engagement.lines, treatment, engagement.depositCents);

  const sections: DocumentSection[] = [
    partiesSection(input),
    {
      id: "objet",
      title: "1. Objet et périmètre",
      blocks: [
        { kind: "paragraph", text: engagement.subject },
        engagement.scope.length > 0
          ? { kind: "list", items: engagement.scope }
          : {
              kind: "paragraph",
              text: "Le périmètre exact des systèmes inventoriés est arrêté par écrit avant le lancement, dans le pack d’accès.",
            },
        {
          kind: "callout",
          tone: "info",
          title: "Ce qui est lu, et ce qui ne l’est pas",
          text: "La collecte porte sur des métadonnées : structures des bases, en-têtes de fichiers, volumétries et dates. Aucune valeur métier, aucun contenu de document et aucun identifiant de connexion n’est copié ni conservé.",
        },
      ],
    },
    {
      id: "deroulement",
      title: "2. Déroulement",
      blocks: [
        {
          kind: "table",
          head: ["Étape", "Contenu", "Responsable"],
          rows: [
            ["J1-J2", "Kickoff, pack d’accès, checklist des systèmes", "Client et prestataire"],
            ["J3-J5", "Déploiement de l’agent local, scans et inventaire", "Prestataire"],
            ["J6-J8", "Analyse et deux entretiens métier d’une heure", "Client et prestataire"],
            ["J9-J10", "Restitution : diagnostic, plan de transition", "Prestataire"],
          ],
        },
        {
          kind: "paragraph",
          text: `Délai annoncé : **${engagement.workingDays} jours ouvrés** à compter de la remise complète du pack d’accès. Ce délai ne court pas tant qu’un accès ou une autorisation manque : le point de départ est le pack d’accès complet, pas la signature.`,
        },
      ],
    },
    {
      id: "prix",
      title: "3. Prix et conditions de règlement",
      blocks: [
        {
          kind: "table",
          head: ["Prestation", "Quantité", "Prix unitaire HT", "Total HT"],
          rows: lineRows(engagement.lines, entity.currency),
        },
        {
          kind: "table",
          head: ["", ""],
          rows: [
            ["Total HT", formatMoney(totals.subtotalCents, entity.currency)],
            [
              treatment.ratePercent > 0 ? `TVA ${treatment.ratePercent} %` : "TVA",
              treatment.ratePercent > 0
                ? formatMoney(totals.vatCents, entity.currency)
                : "Sans objet",
            ],
            ["Total à régler", formatMoney(totals.totalCents, entity.currency)],
          ],
        },
        { kind: "list", items: treatment.mentions },
        {
          kind: "paragraph",
          text: `Règlement à ${entity.paymentTermsDays} jours à compter de la date de facture. Tout retard donne lieu aux pénalités prévues par le contrat et, pour un client professionnel établi en France, à l’indemnité forfaitaire de recouvrement de 40 €.`,
        },
      ],
    },
    {
      id: "engagements",
      title: "4. Engagements du prestataire",
      blocks: [
        {
          kind: "list",
          items: [
            "Exécuter la collecte en lecture seule, sur le poste ou l’environnement désigné par le client.",
            "Ne conserver aucune valeur métier : le catalogue produit ne contient que des métadonnées.",
            "Remettre le catalogue et le rapport en formats ouverts (JSON, Markdown, HTML), réutilisables sans le prestataire.",
            "Supprimer les artefacts de mission à la restitution et remettre un journal de suppression horodaté et empreinté.",
            "Signaler par écrit toute source restée injoignable plutôt que de la passer sous silence.",
          ],
        },
      ],
    },
    {
      id: "engagements-client",
      title: "5. Engagements du client",
      blocks: [
        {
          kind: "list",
          items: [
            "Fournir le pack d’accès complet avant le lancement : périmètre écrit, comptes de lecture seule ou résultats de requêtes, chemins d’exports.",
            "Désigner un interlocuteur technique et un interlocuteur métier disponibles pour les entretiens.",
            "Garantir qu’il dispose du droit de faire inventorier les systèmes concernés.",
            "Révoquer les accès de lecture à l’issue de la mission et en conserver la preuve.",
          ],
        },
      ],
    },
    {
      id: "limites",
      title: "6. Portée et limites",
      blocks: [
        {
          kind: "list",
          items: [
            "Le diagnostic mesure une préparation à partir de ce qui a été rendu lisible. Une source injoignable reste un angle mort et plafonne le score.",
            "Les champs sensibles sont repérés par le nom des colonnes, jamais par leur contenu : la liste doit être confirmée avec le métier.",
            "Les volumétries issues des catalogues système sont des estimations du moteur de base de données.",
            "La prestation ne constitue ni un audit certifié, ni un avis juridique, ni une décision d’assurabilité.",
          ],
        },
        ...(engagement.exclusions.length > 0
          ? [{ kind: "list" as const, items: engagement.exclusions }]
          : []),
      ],
    },
    {
      id: "signature",
      title: "7. Acceptation",
      blocks: [
        {
          kind: "table",
          head: ["Pour le prestataire", "Pour le client"],
          rows: [
            [
              `${entity.representative}\nDate : ${formatDate(engagement.issuedOn)}\nSignature :`,
              `${client.contactName ?? "Nom et qualité du signataire"}\nDate :\nSignature précédée de « bon pour accord » :`,
            ],
          ],
        },
      ],
    },
  ];

  return {
    version: ADMIN_DOCUMENTS_VERSION,
    title: `Lettre de mission : ${engagement.subject}`,
    subtitle: `Référence ${engagement.reference} · ${formatDate(engagement.issuedOn)} · ${client.legalName}`,
    headline: {
      value: formatMoney(totals.totalCents, entity.currency),
      label: `pour ${engagement.workingDays} jours ouvrés`,
      tone: "neutral",
    },
    footer: footerFor(entity),
    sections,
  };
}

/* --------------------------------------------------------------------------
 * 2. Facture
 * ----------------------------------------------------------------------- */

export function buildInvoice(input: AdminInput): DocumentModel {
  const { entity, client, engagement } = input;
  const treatment = resolveVatTreatment(entity, client);
  const totals = computeTotals(engagement.lines, treatment, engagement.depositCents);
  const number = engagement.invoiceNumber ?? "À ATTRIBUER";
  const echeance = dueDate(engagement.issuedOn, entity.paymentTermsDays);

  const totalRows: string[][] = [
    ["Total HT", formatMoney(totals.subtotalCents, entity.currency)],
    [
      treatment.ratePercent > 0 ? `TVA ${treatment.ratePercent} %` : "TVA",
      treatment.ratePercent > 0 ? formatMoney(totals.vatCents, entity.currency) : "Sans objet",
    ],
    ["Total TTC", formatMoney(totals.totalCents, entity.currency)],
  ];
  if (totals.depositCents > 0) {
    totalRows.push(["Acompte déjà réglé", `- ${formatMoney(totals.depositCents, entity.currency)}`]);
    totalRows.push(["Net à payer", formatMoney(totals.dueCents, entity.currency)]);
  }

  const paiement: DocumentBlock[] = [
    {
      kind: "paragraph",
      text: `Échéance : ${formatDate(echeance)} (${entity.paymentTermsDays} jours). Prestation exécutée le ${formatDate(engagement.issuedOn)}.`,
    },
  ];
  if (entity.bank) {
    paiement.push({
      kind: "table",
      head: ["Coordonnées bancaires", ""],
      rows: [
        ["Titulaire", entity.bank.holder],
        ["IBAN", entity.bank.iban],
        ...(entity.bank.bic ? [["BIC", entity.bank.bic]] : []),
        ...(entity.bank.bankName ? [["Établissement", entity.bank.bankName]] : []),
        ["Référence à rappeler", number],
      ],
    });
  }
  paiement.push({
    kind: "paragraph",
    text: "En cas de retard de paiement, pénalités au taux d’intérêt légal majoré, exigibles sans rappel, et indemnité forfaitaire de recouvrement de 40 € pour un client professionnel établi en France.",
  });

  const sections: DocumentSection[] = [
    partiesSection(input),
    {
      id: "prestations",
      title: "Prestations facturées",
      blocks: [
        {
          kind: "table",
          head: ["Désignation", "Quantité", "Prix unitaire HT", "Total HT"],
          rows: lineRows(engagement.lines, entity.currency),
        },
        { kind: "table", head: ["", ""], rows: totalRows },
      ],
    },
    {
      id: "tva",
      title: "Régime de TVA",
      blocks: [
        { kind: "list", items: treatment.mentions },
        {
          kind: "table",
          head: ["Fondement", "Référence"],
          rows: treatment.basis.map((basis) => [basis.label, basis.url]),
        },
        ...(treatment.obligations.length > 0
          ? [
              {
                kind: "callout" as const,
                tone: "info" as const,
                title: "Obligations déclaratives déclenchées",
                text: treatment.obligations.join(" "),
              },
            ]
          : []),
        ...(treatment.warnings.length > 0
          ? [
              {
                kind: "callout" as const,
                tone: "risk" as const,
                title: "À vérifier avant envoi",
                text: treatment.warnings.join(" "),
              },
            ]
          : []),
      ],
    },
    { id: "paiement", title: "Paiement", blocks: paiement },
  ];

  return {
    version: `${ADMIN_DOCUMENTS_VERSION} · ${INVOICING_RULES_VERSION}`,
    title: `Facture ${number}`,
    subtitle: `${formatDate(engagement.issuedOn)} · ${client.legalName} · mission ${engagement.reference}`,
    headline: {
      value: formatMoney(totals.dueCents, entity.currency),
      label: "net à payer",
      tone: "neutral",
    },
    footer: `${footerFor(entity)} · ${INVOICING_DISCLAIMER}`,
    sections,
  };
}

/* --------------------------------------------------------------------------
 * 3. Contrat de sous-traitance (art. 28 RGPD)
 * ----------------------------------------------------------------------- */

export type ProcessingContext = {
  /** Systèmes inventoriés, tels qu'annoncés au pack d'accès. */
  systems: string[];
  /** Mode de collecte de l'agent. */
  collectionMode: "metadata_only" | "metadata_and_freshness";
  /** Durée de conservation des artefacts, en jours. */
  retentionDays: number;
  /** Lieu d'exécution et d'hébergement des artefacts. */
  hosting: string;
  /** Sous-traitants ultérieurs, s'il en existe. */
  subProcessors: string[];
  /** Catégories de personnes concernées, telles que déclarées par le client. */
  dataSubjects: string[];
};

function isSwiss(entity: EntityProfile): boolean {
  return entity.country.toUpperCase() === "CH";
}

export function buildProcessingAgreement(
  input: AdminInput,
  context: ProcessingContext,
): DocumentModel {
  const { entity, client, engagement } = input;
  const suisse = isSwiss(entity);

  const sections: DocumentSection[] = [
    partiesSection(input),
    {
      id: "qualification",
      title: "1. Qualification des parties",
      blocks: [
        {
          kind: "paragraph",
          text: `${client.legalName} agit en qualité de **responsable du traitement**. ${entity.legalName} agit en qualité de **sous-traitant** au sens de l’article 4, 8) du règlement (UE) 2016/679 (RGPD)${suisse ? " et de l’article 5 let. k de la loi fédérale suisse sur la protection des données (LPD)" : ""}.`,
        },
        ...(suisse
          ? [
              {
                kind: "callout" as const,
                tone: "info" as const,
                title: "Sous-traitant établi en Suisse",
                text: "La Suisse bénéficie d’une décision d’adéquation de la Commission européenne : le transfert de données depuis l’Union vers le sous-traitant ne requiert pas de garanties supplémentaires au titre du chapitre V du RGPD. Le sous-traitant reste par ailleurs soumis à la LPD suisse, et au RGPD pour les traitements relevant de son article 3.",
              },
            ]
          : []),
      ],
    },
    {
      id: "objet-traitement",
      title: "2. Objet, nature, finalité et durée",
      blocks: [
        {
          kind: "table",
          head: ["Élément (art. 28.3 RGPD)", "Contenu"],
          rows: [
            ["Objet", "Inventaire des sources de données et des dépendances d’intelligence artificielle du responsable du traitement, en vue d’un diagnostic et d’un plan de transition."],
            [
              "Nature des opérations",
              "Lecture de métadonnées techniques (structures, volumétries, dates), classification automatisée des noms de champs, production d’un catalogue et d’un rapport. Aucune collecte de valeur métier.",
            ],
            [
              "Finalité",
              "Établir la cartographie du patrimoine informationnel et les écarts de gouvernance. Aucune autre exploitation, aucun entraînement de modèle, aucune revente.",
            ],
            [
              "Type de données",
              context.collectionMode === "metadata_only"
                ? "Métadonnées techniques uniquement. Les noms de colonnes inventoriés peuvent révéler l’existence de catégories de données personnelles, sans en contenir aucune."
                : "Métadonnées techniques et dates agrégées de dernière écriture (MAX sur colonne de date). Aucune valeur métier.",
            ],
            [
              "Catégories de personnes concernées",
              context.dataSubjects.length > 0
                ? context.dataSubjects.join(", ")
                : "Aucune donnée personnelle n’est collectée ; les personnes concernées ne sont donc identifiées que par la structure des systèmes inventoriés.",
            ],
            [
              "Durée",
              `Durée de la mission ${engagement.reference}, puis suppression des artefacts au plus tard ${context.retentionDays} jour(s) après la restitution.`,
            ],
            ["Systèmes au périmètre", context.systems.join(" · ") || "Défini au pack d’accès"],
          ],
        },
      ],
    },
    {
      id: "obligations",
      title: "3. Obligations du sous-traitant",
      blocks: [
        {
          kind: "list",
          items: [
            "Ne traiter les données que sur instruction documentée du responsable du traitement, y compris pour un transfert hors Union européenne (art. 28.3 a).",
            "Veiller à ce que toute personne autorisée à traiter les données soit soumise à une obligation de confidentialité (art. 28.3 b).",
            "Mettre en œuvre les mesures techniques et organisationnelles de l’article 32, détaillées à l’article 4 du présent contrat (art. 28.3 c).",
            "Ne pas recruter de sous-traitant ultérieur sans autorisation écrite préalable et lui imposer les mêmes obligations (art. 28.2 et 28.4).",
            "Aider le responsable du traitement à répondre aux demandes d’exercice des droits des personnes concernées (art. 28.3 e).",
            "Aider le responsable du traitement à respecter les articles 32 à 36, notamment en cas de violation de données (art. 28.3 f).",
            "Supprimer les données et les artefacts au terme de la mission et remettre le journal de suppression horodaté et empreinté (art. 28.3 g).",
            "Mettre à disposition toute information nécessaire pour démontrer le respect de l’article 28 et permettre les audits (art. 28.3 h).",
          ],
        },
        ...(context.subProcessors.length > 0
          ? [
              {
                kind: "paragraph" as const,
                text: `Sous-traitants ultérieurs autorisés à la signature : ${context.subProcessors.join(", ")}.`,
              },
            ]
          : [
              {
                kind: "paragraph" as const,
                text: "Aucun sous-traitant ultérieur n’est autorisé à la signature. L’agent s’exécute localement, sans service tiers.",
              },
            ]),
      ],
    },
    {
      id: "securite",
      title: "4. Mesures de sécurité",
      blocks: [
        {
          kind: "list",
          items: [
            `Exécution locale : ${context.hosting}. Aucune transmission des artefacts à un service du sous-traitant ni à un tiers.`,
            "Accès aux systèmes du responsable en lecture seule, par des comptes dédiés et révocables, dont la liste figure au pack d’accès.",
            "Aucune valeur métier n’est copiée : le contrat de catalogue rejette structurellement tout champ contenant une valeur.",
            "Chiffrement du poste d’exécution et verrouillage de session.",
            "Journal de suppression avec empreinte SHA-256 de chaque artefact, calculée avant effacement, remis au responsable du traitement.",
          ],
        },
      ],
    },
    {
      id: "violation",
      title: "5. Violation de données",
      blocks: [
        {
          kind: "paragraph",
          text: `Le sous-traitant notifie au responsable du traitement toute violation de données à caractère personnel dans les meilleurs délais et au plus tard 48 heures après en avoir pris connaissance, avec la nature de la violation, les catégories et le nombre approximatif de personnes concernées, les conséquences probables et les mesures prises (art. 33.2 RGPD${suisse ? " ; art. 24 LPD pour le volet suisse" : ""}).`,
        },
      ],
    },
    {
      id: "fin",
      title: "6. Sort des données en fin de mission",
      blocks: [
        {
          kind: "paragraph",
          text: `À la restitution, et au plus tard ${context.retentionDays} jour(s) après, le sous-traitant supprime le catalogue, les rapports et tout fichier de travail, et remet le journal de suppression. Le responsable du traitement conserve son exemplaire du catalogue et du rapport, en formats ouverts.`,
        },
      ],
    },
    {
      id: "signature-dpa",
      title: "7. Signatures",
      blocks: [
        {
          kind: "table",
          head: ["Le sous-traitant", "Le responsable du traitement"],
          rows: [
            [
              `${entity.legalName}\n${entity.representative}\nDate :\nSignature :`,
              `${client.legalName}\n${client.contactName ?? "Nom et qualité"}\nDate :\nSignature :`,
            ],
          ],
        },
        {
          kind: "callout",
          tone: "risk",
          title: "Avant signature",
          text: "Ce contrat est un modèle rempli automatiquement à partir du périmètre réel de la mission. Il doit être relu par le responsable du traitement et, à la première mission sous une nouvelle entité, par un conseil juridique.",
        },
      ],
    },
  ];

  return {
    version: ADMIN_DOCUMENTS_VERSION,
    title: "Contrat de sous-traitance (article 28 RGPD)",
    subtitle: `Mission ${engagement.reference} · ${client.legalName} · ${formatDate(engagement.issuedOn)}`,
    footer: footerFor(entity),
    sections,
  };
}

/* --------------------------------------------------------------------------
 * 4. Registre des activités de traitement du sous-traitant (art. 30.2)
 * ----------------------------------------------------------------------- */

export function buildProcessingRecord(
  input: AdminInput,
  context: ProcessingContext,
): DocumentModel {
  const { entity, client, engagement } = input;
  const suisse = isSwiss(entity);

  return {
    version: ADMIN_DOCUMENTS_VERSION,
    title: "Registre des activités de traitement du sous-traitant",
    subtitle: `${entity.legalName} · article 30.2 du RGPD${suisse ? " et article 12 LPD" : ""} · mis à jour le ${formatDate(engagement.issuedOn)}`,
    footer: footerFor(entity),
    sections: [
      {
        id: "responsable",
        title: "1. Identité du sous-traitant",
        blocks: [
          { kind: "list", items: entityIdentityLines(entity) },
          {
            kind: "paragraph",
            text: entity.privacyContact
              ? `Point de contact « protection des données » : ${entity.privacyContact}.`
              : "Aucun délégué à la protection des données n’est désigné ; le représentant légal assure le point de contact.",
          },
        ],
      },
      {
        id: "traitement",
        title: "2. Traitement effectué pour le compte du responsable",
        blocks: [
          {
            kind: "table",
            head: ["Mention (art. 30.2)", "Contenu"],
            rows: [
              ["Responsable du traitement", clientIdentityLines(client).join(" · ")],
              ["Catégorie de traitement", "Inventaire de métadonnées et diagnostic de gouvernance des données et de l’IA"],
              [
                "Description",
                context.collectionMode === "metadata_only"
                  ? "Lecture de catalogues système, d’en-têtes de fichiers et de descripteurs d’API. Métadonnées uniquement."
                  : "Lecture de catalogues système, d’en-têtes de fichiers, de descripteurs d’API et de dates agrégées de dernière écriture.",
              ],
              ["Systèmes concernés", context.systems.join(" · ") || "Voir pack d’accès"],
              ["Transferts hors UE", suisse
                ? "Traitement exécuté en Suisse, pays bénéficiant d’une décision d’adéquation de la Commission européenne."
                : "Aucun transfert hors Union européenne."],
              ["Sous-traitants ultérieurs", context.subProcessors.join(", ") || "Aucun"],
              ["Durée de conservation", `${context.retentionDays} jour(s) après restitution, puis suppression avec journal empreinté`],
              [
                "Mesures de sécurité",
                "Exécution locale, accès en lecture seule dédiés et révocables, refus structurel des valeurs métier dans le catalogue, journal de suppression empreinté",
              ],
            ],
          },
        ],
      },
      {
        id: "note-30-5",
        title: "3. Note sur l’obligation de registre",
        blocks: [
          {
            kind: "paragraph",
            text: "L’exemption de l’article 30.5 pour les organismes de moins de 250 personnes ne s’applique pas dès lors que le traitement n’est pas occasionnel. Une activité d’audit exercée à titre professionnel est régulière : le registre est tenu.",
          },
        ],
      },
    ],
  };
}

/* --------------------------------------------------------------------------
 * 5. Attestation de fin de mission
 * ----------------------------------------------------------------------- */

export type CompletionContext = {
  completedOn: string;
  /** Artefacts remis au client. */
  deliverables: string[];
  /** Empreintes des artefacts supprimés, issues du journal de purge. */
  purged: Array<{ name: string; sha256: string; outcome: string }>;
  /** Score du diagnostic, quand il existe. */
  score?: { value: number; tier: string; summary: string };
  /** Comptes de lecture à révoquer, listés au pack d'accès. */
  accountsToRevoke: string[];
};

export function buildCompletionCertificate(
  input: AdminInput,
  context: CompletionContext,
): DocumentModel {
  const { entity, client, engagement } = input;

  const sections: DocumentSection[] = [
    partiesSection(input),
    {
      id: "attestation",
      title: "1. Attestation",
      blocks: [
        {
          kind: "paragraph",
          text: `${entity.legalName} atteste avoir exécuté la mission ${engagement.reference} pour le compte de ${client.legalName}, achevée le ${formatDate(context.completedOn)}, dans les conditions de la lettre de mission et du contrat de sous-traitance.`,
        },
        ...(context.score
          ? [
              {
                kind: "paragraph" as const,
                text: `Résultat du diagnostic : **${context.score.value}/100 (niveau ${context.score.tier})**. ${context.score.summary}`,
              },
            ]
          : []),
      ],
    },
    {
      id: "livrables",
      title: "2. Livrables remis",
      blocks: [
        {
          kind: "list",
          items:
            context.deliverables.length > 0
              ? context.deliverables
              : ["Catalogue JSON, rapport Markdown et rapport HTML imprimable."],
        },
      ],
    },
    {
      id: "suppression",
      title: "3. Suppression des artefacts",
      blocks:
        context.purged.length > 0
          ? [
              {
                kind: "paragraph",
                text: "Chaque artefact ci-dessous a vu son empreinte SHA-256 calculée avant suppression. Le client peut recalculer l’empreinte d’un fichier qu’il détient et la comparer à cette liste.",
              },
              {
                kind: "table",
                head: ["Artefact", "Empreinte SHA-256", "Sort"],
                rows: context.purged.map((item) => [item.name, item.sha256, item.outcome]),
              },
            ]
          : [
              {
                kind: "callout",
                tone: "risk",
                title: "Journal de suppression manquant",
                text: "Aucun journal de purge n’a été joint : lancer l’agent avec --purge avant de remettre cette attestation.",
              },
            ],
    },
    {
      id: "revocation",
      title: "4. Accès à révoquer",
      blocks: [
        {
          kind: "list",
          items:
            context.accountsToRevoke.length > 0
              ? context.accountsToRevoke
              : ["Aucun compte dédié n’a été créé pour cette mission."],
        },
        {
          kind: "paragraph",
          text: "La révocation incombe au client ; le prestataire en demande la confirmation écrite et l’archive avec la mission.",
        },
      ],
    },
    {
      id: "signature-attestation",
      title: "5. Signature",
      blocks: [
        {
          kind: "table",
          head: ["Pour le prestataire", ""],
          rows: [[`${entity.representative}\nDate : ${formatDate(context.completedOn)}\nSignature :`, ""]],
        },
      ],
    },
  ];

  return {
    version: ADMIN_DOCUMENTS_VERSION,
    title: `Attestation de fin de mission (${engagement.reference})`,
    subtitle: `${client.legalName} · achevée le ${formatDate(context.completedOn)}`,
    footer: footerFor(entity),
    sections,
  };
}

/* --------------------------------------------------------------------------
 * 6. Checklist du pack d'accès
 * ----------------------------------------------------------------------- */

export type AccessPackItem = {
  system: string;
  kind: "sql" | "file" | "api";
  method: string;
  owner: string;
};

export function buildAccessPackChecklist(
  input: AdminInput,
  items: readonly AccessPackItem[],
): DocumentModel {
  const { entity, client, engagement } = input;

  return {
    version: ADMIN_DOCUMENTS_VERSION,
    title: `Pack d’accès de la mission ${engagement.reference}`,
    subtitle: `${client.legalName} · à compléter avant le lancement`,
    headline: {
      value: `${items.length}`,
      label: items.length > 1 ? "systèmes au périmètre" : "système au périmètre",
      tone: "neutral",
    },
    footer: footerFor(entity),
    sections: [
      {
        id: "principe",
        title: "1. Pourquoi ce document conditionne le délai",
        blocks: [
          {
            kind: "paragraph",
            text: `Le délai de ${engagement.workingDays} jours ouvrés court à compter du pack d’accès complet. Un élément manquant ne bloque pas la mission : le système concerné est déclaré injoignable dans le rapport et plafonne le score. C’est le moyen le plus simple de rendre l’attente visible.`,
          },
        ],
      },
      {
        id: "systemes",
        title: "2. Systèmes et mode d’accès",
        blocks: [
          items.length > 0
            ? {
                kind: "table",
                head: ["Système", "Type", "Mode d’accès retenu", "Responsable côté client", "Fait"],
                rows: items.map((item) => [item.system, item.kind, item.method, item.owner, "☐"]),
              }
            : {
                kind: "paragraph",
                text: "Aucun système n’est encore inscrit au périmètre : compléter le fichier de mission avant d’émettre ce document.",
              },
        ],
      },
      {
        id: "juridique",
        title: "3. Éléments juridiques et organisationnels",
        blocks: [
          {
            kind: "table",
            head: ["Élément", "Responsable", "Échéance", "Fait"],
            rows: [
              ["Périmètre écrit et annexé à la lettre de mission", "Client", "J-5", "☐"],
              ["Contrat de sous-traitance (art. 28 RGPD) signé", "Client et prestataire", "J-3", "☐"],
              ["Comptes de lecture seule créés, ou accord pour la remise des requêtes au DBA", "DSI / DBA", "J-3", "☐"],
              ["Jetons d’API en lecture pour les outils métier retenus", "Administrateur de l’outil", "J-3", "☐"],
              ["Chemins des dossiers d’exports et droit de lecture", "Métier", "J-3", "☐"],
              ["Deux créneaux d’entretien d’une heure posés au calendrier", "Client", "J-1", "☐"],
              ["Poste ou environnement d’exécution de l’agent désigné", "Client et prestataire", "J-1", "☐"],
            ],
          },
        ],
      },
      {
        id: "rappel",
        title: "4. Ce que l’agent lit, et ce qu’il ne lit pas",
        blocks: [
          {
            kind: "list",
            items: [
              "Lu : catalogues système (tables, colonnes, types, clés, statistiques), en-têtes et nombre de lignes des exports, descripteurs d’API.",
              "Lu si le mode « métadonnées et fraîcheur » est retenu : une date agrégée MAX() par table, pour dater la dernière écriture.",
              "Jamais lu : valeurs de cellules, contenus de documents, secrets. Les identifiants restent dans l’environnement du poste et n’entrent ni dans le fichier de mission, ni dans le catalogue.",
            ],
          },
        ],
      },
    ],
  };
}
