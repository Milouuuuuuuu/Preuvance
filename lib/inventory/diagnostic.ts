import type {
  Catalogue,
  CatalogueDataset,
  SensitiveCategory,
} from "./catalogue-contract";
import {
  resolveReversibility,
  REVERSIBILITY_LIMIT_NOTE,
  type ReversibilityEntry,
} from "./reversibility-playbooks";
import {
  SENSITIVITY_LIMIT_NOTE,
  summariseSensitivity,
  type SensitivitySummary,
} from "./sensitive-fields";

/**
 * Moteur de diagnostic déterministe de Preuvance v2.
 *
 * Il ne consulte aucun modèle de langage : à catalogue identique, il rend
 * exactement le même score, les mêmes constats et le même plan. Le LLM
 * interviendra plus tard, pour rédiger et hiérarchiser une restitution ; il ne
 * décide ni du score, ni de l'existence d'un constat.
 */
export const DIAGNOSTIC_VERSION = "preuvance-diagnostic-v1";

export const DIAGNOSTIC_AXES = [
  "inventaire",
  "donnees_personnelles",
  "securite_acces",
  "dependance_ia",
  "reversibilite",
  "qualite_donnees",
] as const;
export type DiagnosticAxisId = (typeof DIAGNOSTIC_AXES)[number];

export const AXIS_LABELS: Record<DiagnosticAxisId, string> = {
  inventaire: "Connaissance des sources",
  donnees_personnelles: "Données personnelles",
  securite_acces: "Sécurité et accès",
  dependance_ia: "Dépendances IA",
  reversibilite: "Réversibilité",
  qualite_donnees: "Qualité et fraîcheur",
};

export const AXIS_WEIGHTS: Record<DiagnosticAxisId, number> = {
  inventaire: 20,
  donnees_personnelles: 25,
  securite_acces: 20,
  dependance_ia: 15,
  reversibilite: 10,
  qualite_donnees: 10,
};

export type DiagnosticSeverity = "critical" | "major" | "moderate" | "minor";

export const SEVERITY_LABELS: Record<DiagnosticSeverity, string> = {
  critical: "critique",
  major: "majeur",
  moderate: "modéré",
  minor: "mineur",
};

/** Niveau de preuve du constat : ce qui est observé n'est pas ce qui est déclaré. */
export type DiagnosticEvidence = "observed" | "declared" | "absence_of_observation";

export type DiagnosticFinding = {
  id: string;
  axis: DiagnosticAxisId;
  severity: DiagnosticSeverity;
  title: string;
  detail: string;
  recommendation: string;
  /** Fondement réglementaire ou technique, cité tel quel. */
  basis: string | null;
  evidence: DiagnosticEvidence;
  penalty: number;
  effortDays: number;
};

export type DiagnosticAxis = {
  id: DiagnosticAxisId;
  label: string;
  weight: number;
  score: number;
  findingIds: string[];
};

export type DiagnosticCoverage = {
  sources: number;
  sourcesCollected: number;
  sourcesPartial: number;
  sourcesUnreachable: number;
  datasets: number;
  fields: number;
  datasetsWithoutFields: number;
  datasetsWithoutRowCount: number;
  datasetsWithoutFreshness: number;
  totalRowsKnown: number;
};

export type TransitionAction = {
  id: string;
  title: string;
  owner: "client" | "operateur" | "conjoint";
  effortDays: number;
  findingIds: string[];
};

export type TransitionPhase = {
  id: string;
  label: string;
  window: string;
  objective: string;
  actions: TransitionAction[];
  effortDays: number;
};

export type AppliedCap = { cap: number; reason: string };

export type Diagnostic = {
  version: string;
  /** Score pondéré avant plafonds : utile pour expliquer l'écart. */
  rawScore: number;
  appliedCaps: AppliedCap[];
  score: number;
  tier: "A" | "B" | "C" | "D";
  summary: string;
  axes: DiagnosticAxis[];
  findings: DiagnosticFinding[];
  coverage: DiagnosticCoverage;
  sensitivity: SensitivitySummary;
  /** Fiches de réversibilité résolues : une par outil en ligne du catalogue. */
  reversibility: ReversibilityEntry[];
  plan: TransitionPhase[];
  limits: string[];
};

const SEVERITY_PENALTY: Record<DiagnosticSeverity, number> = {
  critical: 45,
  major: 24,
  moderate: 12,
  minor: 5,
};

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const DORMANT_AFTER_MONTHS = 24;

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function finding(
  input: Omit<DiagnosticFinding, "penalty"> & { penalty?: number },
): DiagnosticFinding {
  return { ...input, penalty: input.penalty ?? SEVERITY_PENALTY[input.severity] };
}

export function computeCoverage(catalogue: Catalogue): DiagnosticCoverage {
  let fields = 0;
  let datasetsWithoutFields = 0;
  let datasetsWithoutRowCount = 0;
  let datasetsWithoutFreshness = 0;
  let totalRowsKnown = 0;

  for (const dataset of catalogue.datasets) {
    fields += dataset.fields.length;
    if (dataset.fields.length === 0) datasetsWithoutFields += 1;
    if (dataset.rowCount.value === null) datasetsWithoutRowCount += 1;
    else totalRowsKnown += dataset.rowCount.value;
    if (!dataset.lastChangeAt) datasetsWithoutFreshness += 1;
  }

  return {
    sources: catalogue.sources.length,
    sourcesCollected: catalogue.sources.filter((source) => source.status === "collected").length,
    sourcesPartial: catalogue.sources.filter((source) => source.status === "partial").length,
    sourcesUnreachable: catalogue.sources.filter((source) => source.status === "unreachable")
      .length,
    datasets: catalogue.datasets.length,
    fields,
    datasetsWithoutFields,
    datasetsWithoutRowCount,
    datasetsWithoutFreshness,
    totalRowsKnown,
  };
}

function datasetsWithCategory(
  catalogue: Catalogue,
  category: SensitiveCategory,
): CatalogueDataset[] {
  return catalogue.datasets.filter((dataset) =>
    dataset.fields.some((field) => field.sensitivity?.categories.includes(category)),
  );
}

/* ---------------------------------------------------------------------------
 * Règles par axe. Chaque règle produit un constat nommé, reproductible et
 * rattaché à un fondement ; aucune n'invente une observation absente.
 * ------------------------------------------------------------------------ */

function inventaireFindings(
  catalogue: Catalogue,
  coverage: DiagnosticCoverage,
): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];

  if (coverage.sources === 0) {
    return [
      finding({
        id: "inventaire-aucune-source",
        axis: "inventaire",
        severity: "critical",
        title: "Aucune source de données inventoriée",
        detail:
          "Le catalogue ne contient aucune source. Un diagnostic ne peut pas être produit tant qu’au moins une base, un export ou une API n’a pas été inventorié.",
        recommendation:
          "Reprendre le pack d’accès : au minimum un compte de lecture seule sur la base principale ou un export complet des tables clés.",
        basis: null,
        evidence: "absence_of_observation",
        effortDays: 1,
      }),
    ];
  }

  for (const source of catalogue.sources) {
    if (source.status === "unreachable") {
      findings.push(
        finding({
          id: `inventaire-source-injoignable-${source.id}`,
          axis: "inventaire",
          severity: "major",
          title: `Source « ${source.label} » non inventoriée`,
          detail:
            "La source figurait au périmètre mais n’a pas pu être lue : droits insuffisants, service indisponible ou identifiants non fournis. Tout ce qu’elle contient reste un angle mort.",
          recommendation:
            "Obtenir un accès en lecture seule, ou acter par écrit que la source sort du périmètre du diagnostic.",
          basis: null,
          evidence: "absence_of_observation",
          effortDays: 0.5,
        }),
      );
    } else if (source.status === "partial") {
      findings.push(
        finding({
          id: `inventaire-source-partielle-${source.id}`,
          axis: "inventaire",
          severity: "moderate",
          title: `Source « ${source.label} » inventoriée partiellement`,
          detail:
            "Une partie des métadonnées n’a pas pu être lue (droits partiels ou API limitée). Le décompte de cette source est un minorant.",
          recommendation:
            "Compléter les droits de lecture sur le catalogue système, puis relancer l’agent : l’écart est mesurable d’un scan à l’autre.",
          basis: null,
          evidence: "absence_of_observation",
          effortDays: 0.5,
        }),
      );
    }
  }

  if (coverage.datasets === 0) {
    findings.push(
      finding({
        id: "inventaire-aucun-jeu-de-donnees",
        axis: "inventaire",
        severity: "critical",
        title: "Aucun jeu de données inventorié malgré des sources déclarées",
        detail:
          "Des sources figurent au périmètre, mais aucune n’a rendu la moindre structure. Un score calculé sur zéro observation ne veut rien dire : la collecte doit être reprise avant toute restitution.",
        recommendation:
          "Vérifier les droits de lecture, le chemin des exports et la disponibilité des services, puis relancer l’agent.",
        basis: null,
        evidence: "absence_of_observation",
        effortDays: 1,
      }),
    );
  }

  if (coverage.datasets > 0) {
    const withoutFieldsRatio = percent(coverage.datasetsWithoutFields, coverage.datasets);
    if (withoutFieldsRatio > 20) {
      findings.push(
        finding({
          id: "inventaire-champs-absents",
          axis: "inventaire",
          severity: "moderate",
          title: `${withoutFieldsRatio} % des jeux de données sans détail de champs`,
          detail:
            "Ces objets sont connus par leur nom mais pas par leur structure : ni classification des champs sensibles, ni cartographie fine possible.",
          recommendation:
            "Étendre les droits de lecture au catalogue système (colonnes) ou fournir un export d’en-têtes pour ces objets.",
          basis: null,
          evidence: "absence_of_observation",
          effortDays: 0.5,
        }),
      );
    }

    const withoutRowsRatio = percent(coverage.datasetsWithoutRowCount, coverage.datasets);
    if (withoutRowsRatio > 50) {
      findings.push(
        finding({
          id: "inventaire-volumetrie-inconnue",
          axis: "inventaire",
          severity: "minor",
          title: `Volumétrie inconnue sur ${withoutRowsRatio} % des jeux de données`,
          detail:
            "Sans volumétrie, la charge de migration et le coût d’un stockage local ne peuvent être chiffrés qu’à la louche.",
          recommendation:
            "Autoriser la lecture des statistiques du moteur, ou lancer un comptage ciblé sur les tables retenues au périmètre.",
          basis: null,
          evidence: "absence_of_observation",
          effortDays: 0.5,
        }),
      );
    }
  }

  return findings;
}

function personalDataFindings(
  catalogue: Catalogue,
  sensitivity: SensitivitySummary,
): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];

  if (sensitivity.datasetsWithSpecialCategories > 0) {
    const datasets = datasetsWithCategory(catalogue, "donnee_sensible_art9");
    findings.push(
      finding({
        id: "dcp-categories-particulieres",
        axis: "donnees_personnelles",
        severity: "major",
        title: `${datasets.length} jeu(x) de données porteur(s) de catégories particulières`,
        detail: `Des champs évoquent la santé, les convictions, l’appartenance syndicale, l’origine ou la biométrie (ex. ${datasets
          .slice(0, 3)
          .map((dataset) => dataset.name)
          .join(", ")}). Ces traitements sont interdits par principe et n’échappent à l’interdiction que par une exception expresse.`,
        recommendation:
          "Documenter pour chacun l’exception invoquée (art. 9-2), vérifier le besoin réel de la donnée et instruire une analyse d’impact (art. 35) avant toute exposition à un outil d’IA.",
        basis: "Art. 9 et art. 35 RGPD",
        evidence: "observed",
        effortDays: 3,
      }),
    );
  }

  if (datasetsWithCategory(catalogue, "identifiant_national").length > 0) {
    findings.push(
      finding({
        id: "dcp-identifiant-national",
        axis: "donnees_personnelles",
        severity: "major",
        title: "Identifiants nationaux détectés (NIR, passeport, pièce d’identité)",
        detail:
          "L’usage du numéro de sécurité sociale et des pièces d’identité est strictement encadré en France : sa présence dans une base métier doit être justifiée finalité par finalité.",
        recommendation:
          "Vérifier le fondement de la collecte, restreindre l’accès à ces colonnes et documenter la durée de conservation.",
        basis: "Art. 87 RGPD ; art. 30 de la loi Informatique et Libertés",
        evidence: "observed",
        effortDays: 2,
      }),
    );
  }

  if (datasetsWithCategory(catalogue, "donnee_bancaire").length > 0) {
    findings.push(
      finding({
        id: "dcp-donnees-bancaires",
        axis: "donnees_personnelles",
        severity: "moderate",
        title: "Coordonnées bancaires ou de paiement en base",
        detail:
          "Des colonnes de type IBAN, RIB ou numéro de carte ont été identifiées. Elles appellent un chiffrement au repos et une restriction d’accès nominative.",
        recommendation:
          "Confirmer le chiffrement au repos, restreindre les habilitations et proscrire ces colonnes de tout export vers un outil tiers.",
        basis: "Art. 32 RGPD",
        evidence: "observed",
        effortDays: 2,
      }),
    );
  }

  if (datasetsWithCategory(catalogue, "donnee_mineur").length > 0) {
    findings.push(
      finding({
        id: "dcp-mineurs",
        axis: "donnees_personnelles",
        severity: "moderate",
        title: "Données susceptibles de concerner des mineurs",
        detail:
          "Des champs évoquent des mineurs ou leurs représentants légaux. Le consentement et l’information doivent être adaptés.",
        recommendation:
          "Documenter le recueil du consentement du titulaire de l’autorité parentale et l’information en langage clair.",
        basis: "Art. 8 RGPD",
        evidence: "observed",
        effortDays: 1,
      }),
    );
  }

  const personalSources = new Set(
    catalogue.datasets
      .filter((dataset) =>
        dataset.fields.some(
          (field) =>
            field.sensitivity &&
            field.sensitivity.categories.some((category) => category !== "secret_technique"),
        ),
      )
      .map((dataset) => dataset.sourceId),
  );
  if (personalSources.size > 3) {
    findings.push(
      finding({
        id: "dcp-dispersion",
        axis: "donnees_personnelles",
        severity: "moderate",
        title: `Données personnelles réparties sur ${personalSources.size} sources`,
        detail:
          "Plus la donnée est dispersée, plus le registre des traitements et les droits des personnes (accès, effacement, portabilité) sont coûteux à honorer.",
        recommendation:
          "Désigner la source de référence par catégorie de donnée et documenter les copies dans le registre.",
        basis: "Art. 30 RGPD (registre des activités de traitement)",
        evidence: "observed",
        effortDays: 3,
      }),
    );
  }

  const businessSources = catalogue.sources.filter(
    (source) => source.system === "dolibarr" || source.system === "salesforce",
  );
  if (sensitivity.fieldsSensitive === 0 && businessSources.length > 0) {
    findings.push(
      finding({
        id: "dcp-aucune-detection-suspecte",
        axis: "donnees_personnelles",
        severity: "minor",
        title: "Aucun champ personnel détecté sur un ERP/CRM : résultat à confronter",
        detail:
          "Un outil de gestion commerciale sans champ personnel détecté signale plus souvent des noms de colonnes opaques qu’une absence réelle de données personnelles.",
        recommendation:
          "Passer en revue avec le métier les 20 tables les plus volumineuses lors de l’entretien de la phase J6-J8.",
        basis: null,
        evidence: "absence_of_observation",
        effortDays: 0.5,
      }),
    );
  }

  return findings;
}

function securityFindings(catalogue: Catalogue): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];

  const secretDatasets = datasetsWithCategory(catalogue, "secret_technique");
  if (secretDatasets.length > 0) {
    findings.push(
      finding({
        id: "securite-secrets-en-base",
        axis: "securite_acces",
        severity: "critical",
        title: `${secretDatasets.length} jeu(x) de données contenant des champs de secret`,
        detail: `Des colonnes nommées mot de passe, jeton ou clé d’API ont été trouvées (ex. ${secretDatasets
          .slice(0, 3)
          .map((dataset) => dataset.name)
          .join(", ")}). Le nom ne dit pas si la valeur est hachée : c’est précisément ce qu’il faut vérifier avant toute migration.`,
        recommendation:
          "Vérifier le hachage (algorithme et sel) de chaque colonne, faire tourner les secrets applicatifs et retirer ces colonnes des exports.",
        basis: "Art. 32 RGPD (sécurité du traitement)",
        evidence: "observed",
        effortDays: 2,
      }),
    );
  }

  const aiScan = catalogue.aiScan;
  if (aiScan && aiScan.observation.secretFiles > 0) {
    findings.push(
      finding({
        id: "securite-secrets-poste",
        axis: "securite_acces",
        severity: aiScan.observation.secretFiles >= 3 ? "critical" : "major",
        title: `${aiScan.observation.secretFiles} secret(s) en clair sur le poste scanné`,
        detail:
          "Le scan local a inventorié des fichiers de secrets ou d’identifiants en clair. Un poste compromis donne alors accès aux systèmes qu’ils déverrouillent.",
        recommendation:
          "Déplacer ces secrets dans un coffre, faire tourner les valeurs exposées et documenter la procédure dans le plan de transition.",
        basis: "Art. 32 RGPD",
        evidence: "observed",
        effortDays: 1,
      }),
    );
  }

  const exportFlows = catalogue.flows.filter(
    (flow) => flow.medium === "export_fichier" && flow.personalData !== "no",
  );
  if (exportFlows.length > 0) {
    findings.push(
      finding({
        id: "securite-exports-non-traces",
        axis: "securite_acces",
        severity: "moderate",
        title: `${exportFlows.length} flux d’export de fichiers porteurs de données personnelles`,
        detail:
          "Un export manuel sort du périmètre des habilitations applicatives : il circule ensuite par messagerie, clé USB ou espace partagé, sans trace.",
        recommendation:
          "Remplacer les exports récurrents par un accès en lecture, ou encadrer l’export (destinataire, durée, suppression) dans une procédure écrite.",
        basis: "Art. 5-1-f et art. 32 RGPD",
        evidence: "declared",
        effortDays: 2,
      }),
    );
  }

  const outsideEu = catalogue.flows.filter((flow) => flow.transfersOutsideEu === "yes");
  if (outsideEu.length > 0) {
    findings.push(
      finding({
        id: "securite-transferts-hors-ue",
        axis: "securite_acces",
        severity: "major",
        title: `${outsideEu.length} flux déclaré(s) hors Union européenne`,
        detail:
          "Un transfert hors UE n’est licite qu’encadré : décision d’adéquation, clauses contractuelles types ou garanties équivalentes, avec analyse du droit du pays de destination.",
        recommendation:
          "Documenter l’outil de transfert utilisé pour chaque flux et vérifier qu’il figure au registre.",
        basis: "Chapitre V du RGPD (art. 44 à 49)",
        evidence: "declared",
        effortDays: 2,
      }),
    );
  }

  return findings;
}

function aiFindings(catalogue: Catalogue): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];
  const aiScan = catalogue.aiScan;

  if (!aiScan) {
    findings.push(
      finding({
        id: "ia-scan-absent",
        axis: "dependance_ia",
        severity: "moderate",
        title: "Aucun scan de dépendances IA rattaché au diagnostic",
        detail:
          "Le module 1 (scan local des appels d’IA) n’a pas été exécuté ou n’a pas été joint. L’usage réel d’outils d’IA sur les postes reste donc non observé.",
        recommendation:
          "Lancer le scan local sur un échantillon représentatif de postes, en mode surveillance d’une heure, et rattacher le digest au catalogue.",
        basis: "Art. 4 du règlement (UE) 2024/1689 (maîtrise de l’IA)",
        evidence: "absence_of_observation",
        effortDays: 0.5,
      }),
    );
  }

  if (aiScan?.concordance === "divergent") {
    findings.push(
      finding({
        id: "ia-shadow-ai",
        axis: "dependance_ia",
        severity: "critical",
        title: `Usage d’IA non déclaré détecté (${aiScan.undeclaredProviders.join(", ") || "fournisseur non identifié"})`,
        detail:
          "L’observation réseau contredit la déclaration recueillie avant le scan. Un outil d’IA non inventorié échappe à la classification, aux obligations de transparence et à toute gouvernance des données envoyées.",
        recommendation:
          "Trancher outil par outil : l’inscrire à l’inventaire avec sa finalité et ses données, ou en faire cesser l’usage. Documenter la décision.",
        basis: "Art. 4 et art. 50 du règlement (UE) 2024/1689",
        evidence: "observed",
        effortDays: 2,
      }),
    );
  } else if (aiScan?.concordance === "no_declaration") {
    findings.push(
      finding({
        id: "ia-sans-declaration",
        axis: "dependance_ia",
        severity: "moderate",
        title: "Scan IA réalisé sans déclaration d’usage préalable",
        detail:
          "Sans déclaration recueillie avant le scan, la concordance déclaré / observé ne peut pas être calculée : le résultat perd sa valeur probante.",
        recommendation:
          "Relancer le scan en recueillant d’abord la déclaration d’usage auprès du responsable.",
        basis: null,
        evidence: "absence_of_observation",
        effortDays: 0.5,
      }),
    );
  } else if (aiScan?.concordance === "uncorroborated") {
    findings.push(
      finding({
        id: "ia-non-corrobore",
        axis: "dependance_ia",
        severity: "minor",
        title: "Déclaration d’usage d’IA non encore corroborée par l’observation",
        detail:
          "Aucun usage non déclaré n’a été détecté, mais l’observation n’a pas confirmé les usages annoncés. L’absence de détection ne vaut pas preuve d’absence.",
        recommendation:
          "Relancer le scan en mode surveillance pendant une heure de travail effective.",
        basis: null,
        evidence: "absence_of_observation",
        effortDays: 0.25,
      }),
    );
  }

  const aiTools = catalogue.tools.filter((tool) => (tool.aiProviders?.length ?? 0) > 0);
  const personalDatasetSources = new Set(
    catalogue.datasets
      .filter((dataset) => dataset.fields.some((field) => field.sensitivity))
      .map((dataset) => dataset.sourceId),
  );
  const exposed = aiTools.filter((tool) =>
    (tool.sourceIds ?? []).some((sourceId) => personalDatasetSources.has(sourceId)),
  );
  if (exposed.length > 0) {
    findings.push(
      finding({
        id: "ia-donnees-personnelles-exposees",
        axis: "dependance_ia",
        severity: "major",
        title: `${exposed.length} outil(s) d’IA branché(s) sur une source porteuse de données personnelles`,
        detail: `Les outils ${exposed
          .map((tool) => tool.name)
          .slice(0, 3)
          .join(", ")} lisent une source dont des champs sont classés personnels. La base légale et la sous-traitance doivent être établies avant tout usage en production.`,
        recommendation:
          "Établir l’acte de sous-traitance (art. 28), vérifier la localisation du traitement et restreindre le périmètre transmis aux seules colonnes nécessaires.",
        basis: "Art. 5-1-c et art. 28 RGPD",
        evidence: "declared",
        effortDays: 3,
      }),
    );
  }

  return findings;
}

function reversibilityFindings(
  catalogue: Catalogue,
  entries: readonly ReversibilityEntry[],
): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];

  for (const entry of entries) {
    if (entry.sheet) {
      // Fiche reconnue : la sortie est documentée par l'éditeur, elle ne pénalise
      // pas le score, mais elle n'est un acquis qu'une fois testée en réel.
      findings.push(
        finding({
          id: `reversibilite-sortie-a-tester-${entry.sheet.id}`,
          axis: "reversibilite",
          severity: "minor",
          penalty: 0,
          title: `${entry.sheet.label} : procédure de sortie documentée, à tester en réel`,
          detail: `La sortie de ${entry.sheet.label} est documentée par l’éditeur. Export : ${entry.sheet.exportMethod}. Restitution : ${entry.sheet.exportFormat}. Une procédure documentée n’est pas une procédure testée.`,
          recommendation: `Exécuter un export complet réel, chronométrer la restauration locale (${entry.sheet.localMigration}) et exiger la confirmation écrite de suppression en fin de contrat.`,
          basis: entry.sheet.basis,
          evidence: "declared",
          effortDays: entry.sheet.effortDays,
        }),
      );
    } else {
      const toolId = entry.toolIds[0] ?? "outil";
      findings.push(
        finding({
          id: `reversibilite-sortie-non-documentee-${toolId}`,
          axis: "reversibilite",
          severity: "minor",
          title: `Outil « ${entry.label} » : procédure de sortie non documentée`,
          detail:
            "Cet outil hébergé en ligne ne correspond à aucune fiche du registre de réversibilité : la méthode d’export complet, le format de restitution et la procédure de suppression restent à établir. Aucune procédure n’est supposée à sa place.",
          recommendation:
            "Obtenir de l’éditeur la procédure d’export complet et la clause de restitution et de suppression de fin de contrat, les tester, puis les consigner dans la fiche outil.",
          basis: "Art. 28-3-g RGPD (restitution et suppression en fin de sous-traitance)",
          evidence: "absence_of_observation",
          effortDays: 1,
        }),
      );
    }
  }

  if (catalogue.datasets.length === 0) return findings;

  const apiSourceIds = new Set(
    catalogue.sources.filter((source) => source.kind === "api").map((source) => source.id),
  );
  const inApi = catalogue.datasets.filter((dataset) => apiSourceIds.has(dataset.sourceId)).length;
  const ratio = percent(inApi, catalogue.datasets.length);

  if (ratio > 50) {
    findings.push(
      finding({
        id: "reversibilite-dependance-api",
        axis: "reversibilite",
        severity: "major",
        title: `${ratio} % des jeux de données ne vivent que dans des API tierces`,
        detail:
          "La donnée n’est accessible que par l’éditeur : le coût de sortie, la disponibilité d’un export complet et le format de restitution conditionnent toute transition.",
        recommendation:
          "Obtenir un export complet documenté par éditeur et mesurer le temps de restauration sur une copie locale.",
        basis: null,
        evidence: "observed",
        effortDays: 3,
      }),
    );
  } else if (ratio > 20) {
    findings.push(
      finding({
        id: "reversibilite-dependance-api-partielle",
        axis: "reversibilite",
        severity: "moderate",
        title: `${ratio} % des jeux de données dépendent d’une API tierce`,
        detail:
          "Une partie du patrimoine informationnel dépend d’un éditeur pour être lue ou exportée.",
        recommendation:
          "Vérifier la clause de réversibilité de chaque contrat et tester un export réel.",
        basis: null,
        evidence: "observed",
        effortDays: 2,
      }),
    );
  }

  const cloudTools = catalogue.tools.filter((tool) => tool.hosting === "cloud");
  const unknownHosting = catalogue.tools.filter((tool) => tool.hosting === "unknown");
  if (unknownHosting.length > 0 && unknownHosting.length >= cloudTools.length) {
    findings.push(
      finding({
        id: "reversibilite-hebergement-inconnu",
        axis: "reversibilite",
        severity: "minor",
        title: `${unknownHosting.length} outil(s) au lieu d’hébergement inconnu`,
        detail:
          "Sans savoir où tourne l’outil, ni la réversibilité ni la localisation des données ne peuvent être établies.",
        recommendation:
          "Compléter la fiche outil lors des entretiens : éditeur, hébergement, pays, contrat.",
        basis: null,
        evidence: "absence_of_observation",
        effortDays: 0.5,
      }),
    );
  }

  return findings;
}

function qualityFindings(
  catalogue: Catalogue,
  coverage: DiagnosticCoverage,
  referenceDate: number,
): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];
  if (coverage.datasets === 0) return findings;

  const dated = catalogue.datasets.filter((dataset) => Boolean(dataset.lastChangeAt));
  const dormant = dated.filter((dataset) => {
    const timestamp = Date.parse(dataset.lastChangeAt ?? "");
    if (!Number.isFinite(timestamp)) return false;
    return referenceDate - timestamp > DORMANT_AFTER_MONTHS * MONTH_MS;
  });

  if (dated.length > 0 && percent(dormant.length, dated.length) > 30) {
    findings.push(
      finding({
        id: "qualite-donnees-dormantes",
        axis: "qualite_donnees",
        severity: "moderate",
        title: `${percent(dormant.length, dated.length)} % des jeux de données datés n’ont pas bougé depuis ${DORMANT_AFTER_MONTHS} mois`,
        detail:
          "Des données conservées sans usage restent une charge de conformité : elles doivent être supprimées, archivées ou justifiées par une durée de conservation écrite.",
        recommendation:
          "Statuer sur chaque ensemble dormant : purge, archivage hors production, ou inscription d’une durée de conservation au registre.",
        basis: "Art. 5-1-e RGPD (limitation de la conservation)",
        evidence: "observed",
        effortDays: 2,
      }),
    );
  }

  const empty = catalogue.datasets.filter((dataset) => dataset.rowCount.value === 0);
  if (percent(empty.length, coverage.datasets) > 20) {
    findings.push(
      finding({
        id: "qualite-tables-vides",
        axis: "qualite_donnees",
        severity: "minor",
        title: `${percent(empty.length, coverage.datasets)} % des jeux de données sont vides`,
        detail:
          "Un schéma largement vide signale des modules installés mais inutilisés : ils élargissent la surface d’attaque et brouillent la cartographie sans rien apporter.",
        recommendation:
          "Confirmer avec le métier les modules réellement utilisés et désactiver les autres.",
        basis: null,
        evidence: "observed",
        effortDays: 1,
      }),
    );
  }

  if (percent(coverage.datasetsWithoutFreshness, coverage.datasets) > 60) {
    findings.push(
      finding({
        id: "qualite-fraicheur-inconnue",
        axis: "qualite_donnees",
        severity: "minor",
        title: `Fraîcheur inconnue sur ${percent(coverage.datasetsWithoutFreshness, coverage.datasets)} % des jeux de données`,
        detail:
          "Sans date de dernière écriture, on ne distingue pas une donnée vivante d’un vestige : la priorisation de la transition perd sa base factuelle.",
        recommendation:
          "Autoriser le mode « métadonnées + fraîcheur » de l’agent, qui lit uniquement un MAX() sur les colonnes de date.",
        basis: null,
        evidence: "absence_of_observation",
        effortDays: 0.25,
      }),
    );
  }

  return findings;
}

function scoreForAxis(findings: readonly DiagnosticFinding[], axis: DiagnosticAxisId): number {
  const penalty = findings
    .filter((item) => item.axis === axis)
    .reduce((sum, item) => sum + item.penalty, 0);
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

function tierForScore(score: number): Diagnostic["tier"] {
  if (score >= 85) return "A";
  if (score >= 65) return "B";
  if (score >= 45) return "C";
  return "D";
}

const SEVERITY_ORDER: Record<DiagnosticSeverity, number> = {
  critical: 0,
  major: 1,
  moderate: 2,
  minor: 3,
};

/**
 * Plan de transition : trois fenêtres, dérivées mécaniquement de la gravité et
 * de la charge. Le chiffrage est une charge de travail en jours, pas un prix.
 */
export function buildTransitionPlan(findings: readonly DiagnosticFinding[]): TransitionPhase[] {
  const sorted = [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      b.effortDays - a.effortDays ||
      a.id.localeCompare(b.id),
  );

  const immediate: TransitionAction[] = [];
  const shortTerm: TransitionAction[] = [];
  const structural: TransitionAction[] = [];

  for (const item of sorted) {
    const action: TransitionAction = {
      id: `action-${item.id}`,
      title: item.recommendation,
      owner:
        item.evidence === "absence_of_observation"
          ? "conjoint"
          : item.axis === "inventaire"
            ? "client"
            : "conjoint",
      effortDays: item.effortDays,
      findingIds: [item.id],
    };
    const urgent = item.severity === "critical" || item.severity === "major";
    if (urgent && item.effortDays <= 2) immediate.push(action);
    else if (urgent) shortTerm.push(action);
    else if (item.effortDays <= 1) shortTerm.push(action);
    else structural.push(action);
  }

  const phases: TransitionPhase[] = [
    {
      id: "phase-immediate",
      label: "Mise en sécurité",
      window: "S+0 à S+2",
      objective:
        "Fermer ce qui est à la fois grave et rapide à corriger : secrets exposés, usages d’IA non déclarés, accès trop larges.",
      actions: immediate,
      effortDays: 0,
    },
    {
      id: "phase-court-terme",
      label: "Mise en conformité documentaire",
      window: "S+2 à S+6",
      objective:
        "Rattacher chaque donnée personnelle à une finalité, une base légale et une durée ; compléter le registre et les actes de sous-traitance.",
      actions: shortTerm,
      effortDays: 0,
    },
    {
      id: "phase-structurelle",
      label: "Transition et réversibilité",
      window: "S+6 à S+13",
      objective:
        "Réduire la dépendance aux tiers, rapatrier ou dupliquer localement les données critiques, industrialiser le re-scan.",
      actions: structural,
      effortDays: 0,
    },
  ];

  for (const phase of phases) {
    phase.effortDays = Math.round(
      phase.actions.reduce((sum, action) => sum + action.effortDays, 0) * 4,
    ) / 4;
  }

  return phases;
}

/**
 * Plafonds de score. Une collecte incomplète ne doit jamais produire un bon
 * score : l'absence d'observation est traitée comme une absence de preuve, pas
 * comme une bonne nouvelle. Même logique que les plafonds du dossier v1.
 */
export function determineCaps(
  catalogue: Catalogue,
  coverage: DiagnosticCoverage,
  findings: readonly DiagnosticFinding[] = [],
): AppliedCap[] {
  const caps: AppliedCap[] = [];

  const critical = findings.filter((item) => item.severity === "critical");
  if (critical.length > 0) {
    caps.push({
      cap: 59,
      reason: `${critical.length} constat(s) critique(s) : « ${critical[0].title} ». Un constat critique interdit de présenter le dossier comme maîtrisé tant qu’il n’est pas traité.`,
    });
  }

  const major = findings.filter((item) => item.severity === "major");
  if (major.length >= 3) {
    caps.push({
      cap: 74,
      reason: `${major.length} constats majeurs cumulés : le socle demande une reprise coordonnée, pas des correctifs isolés.`,
    });
  }

  if (coverage.sources > 0 && coverage.datasets === 0) {
    caps.push({
      cap: 35,
      reason:
        "Aucun jeu de données inventorié : le diagnostic ne repose sur aucune observation exploitable.",
    });
  }

  if (coverage.datasets > 0 && coverage.fields === 0) {
    caps.push({
      cap: 60,
      reason:
        "Les objets sont connus par leur nom mais aucune structure n’a été lue : ni champ sensible, ni cartographie fine ne peuvent être établis.",
    });
  }

  if (coverage.sourcesUnreachable > 0) {
    const ratio = percent(coverage.sourcesUnreachable, Math.max(coverage.sources, 1));
    caps.push({
      cap: ratio >= 50 ? 55 : 75,
      reason: `${coverage.sourcesUnreachable} source(s) au périmètre sont restées injoignables (${ratio} %) : leur contenu est un angle mort.`,
    });
  }

  if (!catalogue.aiScan) {
    caps.push({
      cap: 85,
      reason:
        "Aucun scan de dépendances IA n’est rattaché : l’usage réel d’outils d’IA sur les postes n’a pas été observé.",
    });
  }

  return caps;
}

function buildSummary(
  score: number,
  rawScore: number,
  caps: readonly AppliedCap[],
  coverage: DiagnosticCoverage,
  sensitivity: SensitivitySummary,
  findings: readonly DiagnosticFinding[],
): string {
  const critical = findings.filter((item) => item.severity === "critical").length;
  const major = findings.filter((item) => item.severity === "major").length;
  const parts = [
    `Score de préparation : ${score}/100.`,
    `${coverage.sources} source(s), ${coverage.datasets} jeu(x) de données et ${coverage.fields} champ(s) inventoriés.`,
  ];
  if (sensitivity.fieldsSensitive > 0) {
    parts.push(
      `${sensitivity.fieldsSensitive} champ(s) sensibles repérés dans ${sensitivity.datasetsWithPersonalData} jeu(x) de données.`,
    );
  }
  if (critical > 0 || major > 0) {
    parts.push(`${critical} constat(s) critique(s) et ${major} majeur(s) à traiter.`);
  } else {
    parts.push("Aucun constat critique ou majeur sur le périmètre observé.");
  }
  if (caps.length > 0 && score < rawScore) {
    parts.push(`Score plafonné (calcul pondéré : ${rawScore}/100). ${caps[0].reason}`);
  }
  return parts.join(" ");
}

/**
 * Produit le diagnostic complet d'un catalogue.
 * `referenceDate` rend la fonction pure : à catalogue et date donnés, le
 * résultat est stable, donc testable et opposable.
 */
export function computeDiagnostic(
  catalogue: Catalogue,
  options: { referenceDate?: string } = {},
): Diagnostic {
  const reference = Date.parse(options.referenceDate ?? catalogue.generatedAt);
  const referenceDate = Number.isFinite(reference) ? reference : Date.parse(catalogue.generatedAt);

  const coverage = computeCoverage(catalogue);
  const sensitivity = summariseSensitivity(catalogue);
  const reversibility = resolveReversibility(catalogue);

  const findings = [
    ...inventaireFindings(catalogue, coverage),
    ...personalDataFindings(catalogue, sensitivity),
    ...securityFindings(catalogue),
    ...aiFindings(catalogue),
    ...reversibilityFindings(catalogue, reversibility),
    ...qualityFindings(catalogue, coverage, referenceDate),
  ].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      b.penalty - a.penalty ||
      a.id.localeCompare(b.id),
  );

  const axes: DiagnosticAxis[] = DIAGNOSTIC_AXES.map((axis) => ({
    id: axis,
    label: AXIS_LABELS[axis],
    weight: AXIS_WEIGHTS[axis],
    score: scoreForAxis(findings, axis),
    findingIds: findings.filter((item) => item.axis === axis).map((item) => item.id),
  }));

  const totalWeight = axes.reduce((sum, axis) => sum + axis.weight, 0);
  const rawScore = Math.round(
    axes.reduce((sum, axis) => sum + axis.score * axis.weight, 0) / totalWeight,
  );
  const appliedCaps = determineCaps(catalogue, coverage, findings);
  const score = appliedCaps.reduce((value, applied) => Math.min(value, applied.cap), rawScore);

  const limits = [
    SENSITIVITY_LIMIT_NOTE,
    "Le diagnostic porte sur ce qui a été rendu lisible : une source injoignable reste un angle mort, jamais un point positif.",
    "Les volumétries issues des catalogues système sont des estimations du moteur, pas des comptages exacts.",
    REVERSIBILITY_LIMIT_NOTE,
    "Ce diagnostic n’est ni un avis juridique, ni une certification, ni une décision d’assurabilité.",
  ];

  return {
    version: DIAGNOSTIC_VERSION,
    rawScore,
    appliedCaps,
    score,
    tier: tierForScore(score),
    summary: buildSummary(score, rawScore, appliedCaps, coverage, sensitivity, findings),
    axes,
    findings,
    coverage,
    sensitivity,
    reversibility,
    plan: buildTransitionPlan(findings),
    limits,
  };
}
