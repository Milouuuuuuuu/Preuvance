import type { Catalogue, SourceSystem } from "./catalogue-contract";
import { normalizeFieldName } from "./sensitive-fields";

/**
 * Fiches de réversibilité par outil.
 *
 * Le diagnostic sait dire « la donnée dépend d'un éditeur » ; ce registre dit
 * QUOI faire, outil par outil : le mécanisme d'export documenté publiquement
 * par l'éditeur, la procédure de suppression en fin de contrat et le chemin de
 * remise en local. C'est de la donnée versionnée, pas du code : ajouter un
 * outil, c'est ajouter une fiche — jamais coder un connecteur (D-100 : un
 * connecteur dédié ne se code que pour un client signé).
 *
 * Règle héritée de D-081 : une fiche ne cite que des mécanismes documentés
 * publiquement par l'éditeur. Un outil absent du registre produit un constat
 * « procédure à établir avec l'éditeur » — jamais une procédure supposée.
 */
export const REVERSIBILITY_VERSION = "preuvance-reversibility-v1";

export const REVERSIBILITY_LIMIT_NOTE =
  "Les fiches de réversibilité citent les mécanismes d’export documentés publiquement par chaque éditeur à la date du registre ; elles ne remplacent ni le contrat en vigueur, ni un export réellement testé et chronométré.";

/** Contenu d'une fiche, tel qu'il est restitué au client. */
export type ReversibilitySheet = {
  id: string;
  label: string;
  /** Mécanisme d'export complet documenté par l'éditeur. */
  exportMethod: string;
  /** Format de restitution des données exportées. */
  exportFormat: string;
  /** Procédure de suppression chez l'éditeur en fin de contrat. */
  deletion: string;
  /** Chemin de remise en local, en formats relisibles sans l'éditeur. */
  localMigration: string;
  /** Fondement réglementaire, cité tel quel dans le rapport. */
  basis: string;
  /** Charge pour un export réel testé et une restauration locale mesurée. */
  effortDays: number;
};

export type ReversibilityPlaybook = ReversibilitySheet & {
  /**
   * Motif testé contre le nom d'outil normalisé encadré de tirets bas (même
   * normalisation que les champs sensibles). Sous-couverture volontaire : un
   * nom ambigu ne matche pas et produit un constat « à établir », alors qu'un
   * faux positif prescrirait une procédure fausse.
   */
  pattern: RegExp;
  /** Systèmes de source du catalogue couverts par la même fiche. */
  sourceSystems?: readonly SourceSystem[];
};

export const REVERSIBILITY_PLAYBOOKS: readonly ReversibilityPlaybook[] = [
  {
    id: "salesforce",
    label: "Salesforce",
    pattern: /_(salesforce|sales_force|sfdc|sales_cloud)_/,
    sourceSystems: ["salesforce"],
    exportMethod:
      "Data Export Service (export planifié depuis la Configuration) ou Bulk API 2.0 pour une extraction complète objet par objet ; fichiers et pièces jointes via l’objet ContentVersion",
    exportFormat: "Archives CSV (un fichier par objet), pièces jointes dans leur format d’origine",
    deletion:
      "Résiliation du contrat puis demande écrite de suppression, avec la confirmation prévue par l’acte de sous-traitance ; l’éditeur documente la suppression des données client après la fin du service",
    localMigration:
      "Restauration des CSV dans une base PostgreSQL locale (une table par objet, identifiants conservés), puis reprise éventuelle dans un CRM auto-hébergé",
    basis: "Art. 20, art. 17 et art. 28-3-g RGPD",
    effortDays: 3,
  },
  {
    id: "dolibarr",
    label: "Dolibarr",
    pattern: /_(dolibarr|dolicloud|doli_cloud)_/,
    sourceSystems: ["dolibarr"],
    exportMethod:
      "Sauvegarde native (Outils → Sauvegarde : dump complet de la base MySQL/MariaDB ou PostgreSQL) et copie de l’arborescence documents/ ; en instance hébergée, export complet à demander à l’hébergeur",
    exportFormat: "Dump SQL complet + répertoire documents/ dans son arborescence d’origine",
    deletion:
      "Clôture de l’instance hébergée après restauration vérifiée, puis demande écrite de suppression à l’hébergeur",
    localMigration:
      "Réinstallation de Dolibarr (logiciel libre, licence GPL) sur un serveur interne et restauration du dump et des documents : même logiciel en local, réversibilité complète",
    basis: "Art. 20 et art. 28-3-g RGPD ; logiciel libre sous licence GPL",
    effortDays: 1.5,
  },
  {
    id: "hubspot",
    label: "HubSpot",
    pattern: /_(hubspot|hub_spot)_/,
    exportMethod:
      "Export des fiches objet par objet depuis l’interface (contacts, entreprises, transactions, tickets) ou via l’API d’exports CRM ; pièces jointes à exporter séparément",
    exportFormat: "CSV ou XLSX par objet",
    deletion:
      "Suppression définitive des contacts par la fonction de suppression conforme RGPD de l’éditeur, puis résiliation du compte avec demande écrite de suppression",
    localMigration:
      "Restauration des CSV dans une base locale, puis reprise éventuelle dans un CRM auto-hébergé (le module CRM de Dolibarr couvre le besoin courant d’une PME)",
    basis: "Art. 17, art. 20 et art. 28-3-g RGPD",
    effortDays: 2,
  },
  {
    id: "google-workspace",
    label: "Google Workspace",
    pattern: /_(google_workspace|gsuite|g_suite|google_drive|gmail|google_docs|google_agenda)_/,
    exportMethod:
      "Outil d’export de l’organisation depuis la console d’administration (l’ensemble du domaine en une opération), ou Google Takeout compte par compte",
    exportFormat:
      "MBOX (messagerie), vCard (contacts), ICS (agendas), formats bureautiques ouverts ou Office pour les documents",
    deletion:
      "Suppression des comptes puis résiliation de l’abonnement, avec demande écrite de confirmation ; l’éditeur documente la suppression des données après clôture",
    localMigration:
      "Messagerie vers un serveur IMAP interne ou des archives MBOX ; fichiers vers un serveur de fichiers ou une instance Nextcloud auto-hébergée",
    basis: "Art. 20 et art. 28-3-g RGPD",
    effortDays: 4,
  },
  {
    id: "microsoft-365",
    label: "Microsoft 365",
    pattern:
      /_(microsoft_365|office_365|m_365|o_365|microsoft_office|onedrive|one_drive|exchange_online|microsoft_teams)_/,
    exportMethod:
      "Messagerie exportée en PST par la recherche de contenu (eDiscovery Purview) ; fichiers SharePoint et OneDrive récupérés par synchronisation ou via l’API Microsoft Graph",
    exportFormat: "PST (messagerie), fichiers dans leur format d’origine",
    deletion:
      "Suppression des comptes puis résiliation de l’abonnement ; l’éditeur documente un délai de rétention post-résiliation avant suppression définitive — la confirmation écrite reste à exiger",
    localMigration:
      "Messagerie vers un serveur de messagerie interne ou des archives PST ; fichiers vers un serveur de fichiers ou une instance Nextcloud auto-hébergée",
    basis: "Art. 20 et art. 28-3-g RGPD",
    effortDays: 4,
  },
  {
    id: "notion",
    label: "Notion",
    pattern: /_notion_/,
    exportMethod:
      "Export complet de l’espace de travail depuis les réglages (contenu et sous-pages), ou lecture des bases via l’API",
    exportFormat: "Markdown + CSV (bases de données), ou HTML",
    deletion:
      "Suppression de l’espace de travail par son propriétaire puis clôture du compte, avec demande écrite de confirmation",
    localMigration:
      "Les fichiers Markdown et CSV se relisent sans l’éditeur ; reprise possible dans un outil de notes auto-hébergé compatible Markdown",
    basis: "Art. 17 et art. 20 RGPD",
    effortDays: 1,
  },
];

/**
 * Une entrée de réversibilité du diagnostic : une fiche reconnue (avec les
 * références du catalogue qu'elle couvre), ou un outil en ligne sans fiche —
 * auquel cas rien n'est prescrit, tout est « à établir avec l'éditeur ».
 */
export type ReversibilityEntry = {
  sheet: ReversibilitySheet | null;
  label: string;
  toolIds: string[];
  sourceIds: string[];
};

function sheetOf(playbook: ReversibilityPlaybook): ReversibilitySheet {
  const { id, label, exportMethod, exportFormat, deletion, localMigration, basis, effortDays } =
    playbook;
  return { id, label, exportMethod, exportFormat, deletion, localMigration, basis, effortDays };
}

/** Retrouve la fiche d'un outil par son nom, ou null — jamais une fiche « probable ». */
export function matchPlaybook(toolName: string): ReversibilityPlaybook | null {
  const normalized = normalizeFieldName(toolName);
  if (normalized === "_") return null;
  return REVERSIBILITY_PLAYBOOKS.find((playbook) => playbook.pattern.test(normalized)) ?? null;
}

/**
 * Croise le catalogue avec le registre. Une fiche couvre à la fois les outils
 * reconnus par leur nom et les sources d'API du même éditeur : Salesforce
 * déclaré comme outil et inventorié comme source ne produit qu'une entrée.
 * Un outil en ligne sans fiche produit une entrée sans prescription ; un outil
 * on-premise sans fiche n'en produit pas (la donnée est déjà chez le client).
 */
export function resolveReversibility(catalogue: Catalogue): ReversibilityEntry[] {
  const matched = new Map<string, ReversibilityEntry>();
  const unmatched: ReversibilityEntry[] = [];

  const entryFor = (playbook: ReversibilityPlaybook): ReversibilityEntry => {
    let entry = matched.get(playbook.id);
    if (!entry) {
      entry = { sheet: sheetOf(playbook), label: playbook.label, toolIds: [], sourceIds: [] };
      matched.set(playbook.id, entry);
    }
    return entry;
  };

  for (const tool of catalogue.tools) {
    const playbook = matchPlaybook(tool.name);
    if (playbook) {
      entryFor(playbook).toolIds.push(tool.id);
    } else if (tool.hosting === "cloud") {
      unmatched.push({ sheet: null, label: tool.name, toolIds: [tool.id], sourceIds: [] });
    }
  }

  for (const source of catalogue.sources) {
    const playbook = REVERSIBILITY_PLAYBOOKS.find((candidate) =>
      candidate.sourceSystems?.includes(source.system),
    );
    if (playbook) entryFor(playbook).sourceIds.push(source.id);
  }

  const order = REVERSIBILITY_PLAYBOOKS.map((playbook) => playbook.id);
  return [
    ...[...matched.values()].sort(
      (a, b) => order.indexOf(a.sheet?.id ?? "") - order.indexOf(b.sheet?.id ?? ""),
    ),
    ...unmatched.sort((a, b) => a.label.localeCompare(b.label, "fr")),
  ];
}
