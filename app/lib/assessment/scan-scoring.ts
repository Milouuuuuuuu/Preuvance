import {
  providerIdForHost,
  providerLabelForId,
  type ScanAiEndpoint,
  type ScanReport,
  type ScanSensitiveFile,
} from "@/lib/scan/scan-contract";

export const SCAN_SCORING_VERSION = "preuvance-scan-scoring-v2";

export type ScanFindingSeverity = "critical" | "major" | "moderate" | "minor";

export type ScanFinding = {
  id: string;
  severity: ScanFindingSeverity;
  title: string;
  detail: string;
  article: string | null;
  penalty: number;
};

export type ScanConcordanceStatus =
  | "concordant"
  | "uncorroborated"
  | "divergent"
  | "no_declaration";

/**
 * Concordance déclaré / observé : le rapprochement entre les fournisseurs
 * d'IA que l'utilisateur déclare utiliser sciemment et ceux réellement
 * observés sur le réseau du poste. C'est l'esprit de la déclaration du risque
 * en assurance (art. L113-2 du Code des assurances) : une déclaration
 * corroborée par une observation indépendante vaut plus qu'une déclaration
 * sur l'honneur.
 */
export type ScanConcordance = {
  status: ScanConcordanceStatus;
  declaredProviders: string[];
  corroborated: string[];
  undeclaredObserved: string[];
  declaredNotObserved: string[];
  note: string;
};

export type ScanExposure = {
  version: string;
  exposureScore: number;
  tier: "A" | "B" | "C" | "D";
  findings: ScanFinding[];
  summary: string;
  concordance: ScanConcordance;
  observed: {
    aiEndpoints: number;
    declaredAiEndpoints: number;
    undeclaredAiEndpoints: number;
    secretFiles: number;
    financialFiles: number;
    personalDataFiles: number;
    otherSensitiveFiles: number;
    limitedObservation: boolean;
  };
};

const SEVERITY_PENALTY: Record<ScanFindingSeverity, number> = {
  critical: 45,
  major: 24,
  moderate: 12,
  minor: 5,
};

const CATEGORY_LABELS: Record<ScanSensitiveFile["category"], string> = {
  secret: "secret ou clé d’API",
  credential: "identifiant / certificat",
  financial: "document financier",
  personal_data: "donnée personnelle",
  other: "fichier sensible",
};

function countCategory(
  files: readonly ScanSensitiveFile[],
  category: ScanSensitiveFile["category"],
): number {
  return files.filter((file) => file.category === category).length;
}

/**
 * Un endpoint est « déclaré » si la déclaration recueillie avant le scan
 * couvre son fournisseur (rapprochement par nom d'hôte, indépendant du champ
 * `declared` écrit par le scanner). Les rapports antérieurs, sans bloc de
 * déclaration, retombent sur le champ `declared` du scanner.
 */
function isEndpointDeclared(report: ScanReport, endpoint: ScanAiEndpoint): boolean {
  if (!report.declaration) return endpoint.declared === true;
  const providerId = providerIdForHost(endpoint.host);
  if (!providerId) return endpoint.declared === true;
  return report.declaration.providers.includes(providerId);
}

function endpointFinding(endpoint: ScanAiEndpoint, declared: boolean): ScanFinding {
  const severity: ScanFindingSeverity = declared ? "minor" : "critical";
  const processHint = endpoint.processes.length
    ? ` Processus observé(s) : ${endpoint.processes.slice(0, 5).join(", ")}.`
    : "";
  return {
    id: `ai-endpoint-${endpoint.host}`,
    severity,
    title: declared
      ? `Appel d’IA déclaré vers ${endpoint.provider || endpoint.host}`
      : `Appel d’IA non déclaré (« shadow AI ») vers ${endpoint.provider || endpoint.host}`,
    detail: declared
      ? `Des requêtes réseau vers ${endpoint.host} ont été observées et corroborent la déclaration d’usage recueillie avant le scan.${processHint}`
      : `Des requêtes réseau vers ${endpoint.host} ont été observées sur ce poste sans figurer dans la déclaration d’usage. Un système d’IA non inventorié échappe à la classification, aux obligations de transparence et à la gouvernance.${processHint}`,
    article: declared ? null : "Article 4 · Article 50 · gouvernance",
    penalty: declared ? SEVERITY_PENALTY.minor : SEVERITY_PENALTY.critical,
  };
}

/**
 * Calcul déterministe et auditable d'un score d'exposition à partir du rapport
 * de scan local. Un usage d'IA non déclaré (« shadow AI ») ou des secrets
 * exposés abaissent le score : c'est un signal de gouvernance, indépendant du
 * modèle de langage.
 */
export function computeScanExposure(report: ScanReport): ScanExposure {
  const findings: ScanFinding[] = [];

  const endpointStates = report.network.aiEndpoints.map((endpoint) => ({
    endpoint,
    declared: isEndpointDeclared(report, endpoint),
  }));

  for (const { endpoint, declared } of endpointStates) {
    findings.push(endpointFinding(endpoint, declared));
  }

  const secretFiles = countCategory(report.files.sensitive, "secret");
  const credentialFiles = countCategory(report.files.sensitive, "credential");
  const financialFiles = countCategory(report.files.sensitive, "financial");
  const personalDataFiles = countCategory(report.files.sensitive, "personal_data");
  const otherSensitiveFiles = countCategory(report.files.sensitive, "other");

  const exposedSecrets = secretFiles + credentialFiles;
  if (exposedSecrets > 0) {
    const composition =
      secretFiles > 0 && credentialFiles > 0
        ? `${CATEGORY_LABELS.secret} et ${CATEGORY_LABELS.credential}`
        : secretFiles > 0
          ? CATEGORY_LABELS.secret
          : CATEGORY_LABELS.credential;
    findings.push({
      id: "exposed-secrets",
      severity: exposedSecrets >= 3 ? "critical" : "major",
      title: `${exposedSecrets} fichier(s) de type ${composition} en clair sur le poste`,
      detail:
        "Des secrets, identifiants ou certificats ont été inventoriés (chemin et empreinte seulement, aucun contenu copié). Leur présence en clair sur un poste de travail est un risque de gouvernance des données à corriger avant tout dossier d’assurabilité.",
      article: "Gouvernance des données · sécurité",
      penalty: exposedSecrets >= 3 ? SEVERITY_PENALTY.critical : SEVERITY_PENALTY.major,
    });
  }

  if (personalDataFiles > 0) {
    findings.push({
      id: "personal-data-files",
      severity: personalDataFiles >= 5 ? "major" : "moderate",
      title: `${personalDataFiles} fichier(s) potentiellement porteurs de données personnelles`,
      detail:
        "Des fichiers correspondant à des motifs de données personnelles ont été pointés (sans copie). Ils doivent être rattachés à une finalité, une base légale et une durée de conservation.",
      article: "RGPD · gouvernance des données",
      penalty:
        personalDataFiles >= 5 ? SEVERITY_PENALTY.major : SEVERITY_PENALTY.moderate,
    });
  }

  if (financialFiles > 0) {
    findings.push({
      id: "financial-files",
      severity: "minor",
      title: `${financialFiles} document(s) financier(s) inventorié(s)`,
      detail:
        "Documents financiers pointés à titre indicatif ; à protéger et à référencer dans le dossier de preuves.",
      article: null,
      penalty: SEVERITY_PENALTY.minor,
    });
  }

  if (otherSensitiveFiles > 0) {
    findings.push({
      id: "other-sensitive-files",
      severity: "minor",
      title: `${otherSensitiveFiles} autre(s) fichier(s) sensible(s) inventorié(s)`,
      detail:
        "Fichiers marqués sensibles sans catégorie précise ; à vérifier manuellement et à rattacher à une catégorie de gouvernance.",
      article: null,
      penalty: SEVERITY_PENALTY.minor,
    });
  }

  const limitedObservation =
    !report.capabilities.connectionSampling && !report.capabilities.dnsClientLog;
  if (limitedObservation) {
    findings.push({
      id: "limited-network-observation",
      severity: "minor",
      title: "Observation réseau limitée sur ce poste",
      detail:
        "Ni le journal DNS ni l’échantillonnage des connexions n’étaient disponibles : l’absence d’appel d’IA détecté ne vaut pas preuve d’absence. Relancer le scan en mode surveillance (option 1 heure) pour une couverture réseau fiable.",
      article: null,
      penalty: SEVERITY_PENALTY.minor,
    });
  }

  const totalPenalty = findings.reduce((sum, finding) => sum + finding.penalty, 0);
  const exposureScore = Math.max(0, Math.min(100, Math.round(100 - totalPenalty)));

  const declaredAiEndpoints = endpointStates.filter((state) => state.declared).length;
  const undeclaredAiEndpoints = endpointStates.length - declaredAiEndpoints;
  const concordance = computeConcordance(report, endpointStates);

  return {
    version: SCAN_SCORING_VERSION,
    exposureScore,
    tier: tierForExposure(exposureScore),
    findings: findings.sort((a, b) => b.penalty - a.penalty),
    summary: buildSummary(exposureScore, undeclaredAiEndpoints, exposedSecrets),
    concordance,
    observed: {
      aiEndpoints: report.network.aiEndpoints.length,
      declaredAiEndpoints,
      undeclaredAiEndpoints,
      secretFiles: exposedSecrets,
      financialFiles,
      personalDataFiles,
      otherSensitiveFiles,
      limitedObservation,
    },
  };
}

function computeConcordance(
  report: ScanReport,
  endpointStates: ReadonlyArray<{ endpoint: ScanAiEndpoint; declared: boolean }>,
): ScanConcordance {
  if (!report.declaration) {
    return {
      status: "no_declaration",
      declaredProviders: [],
      corroborated: [],
      undeclaredObserved: endpointStates.map(
        ({ endpoint }) => endpoint.provider || endpoint.host,
      ),
      declaredNotObserved: [],
      note:
        "Aucune déclaration d’usage d’IA n’a été recueillie avant ce scan. Relancez le scan pour déclarer vos outils d’IA connus : la concordance déclaré / observé renforce la crédibilité du dossier.",
    };
  }

  const declaredProviders = report.declaration.providers.map(
    (providerId) => providerLabelForId(providerId) ?? providerId,
  );
  const observedProviderIds = new Set(
    endpointStates
      .map(({ endpoint }) => providerIdForHost(endpoint.host))
      .filter((providerId): providerId is string => providerId !== null),
  );
  const corroborated = report.declaration.providers
    .filter((providerId) => observedProviderIds.has(providerId))
    .map((providerId) => providerLabelForId(providerId) ?? providerId);
  const undeclaredObserved = endpointStates
    .filter((state) => !state.declared)
    .map(({ endpoint }) => endpoint.provider || endpoint.host);
  const declaredNotObserved = report.declaration.providers
    .filter((providerId) => !observedProviderIds.has(providerId))
    .map((providerId) => providerLabelForId(providerId) ?? providerId);

  if (undeclaredObserved.length > 0) {
    return {
      status: "divergent",
      declaredProviders,
      corroborated,
      undeclaredObserved,
      declaredNotObserved,
      note: `L’observation contredit la déclaration : ${undeclaredObserved.join(", ")} détecté(s) sans être déclaré(s). Cet écart de sincérité doit être résolu (déclarer l’outil, ou en cesser l’usage) avant de présenter le dossier.`,
    };
  }

  if (corroborated.length > 0) {
    return {
      status: "concordant",
      declaredProviders,
      corroborated,
      undeclaredObserved,
      declaredNotObserved,
      note: `L’observation corrobore la déclaration : ${corroborated.join(", ")} déclaré(s) et effectivement observé(s), aucun usage non déclaré détecté. C’est le meilleur signal de sincérité que ce scan peut produire.`,
    };
  }

  return {
    status: "uncorroborated",
    declaredProviders,
    corroborated,
    undeclaredObserved,
    declaredNotObserved,
    note:
      declaredProviders.length > 0
        ? "Aucun usage non déclaré n’a été détecté, mais l’observation n’a pas (encore) corroboré la déclaration. Le mode surveillance (-WatchMinutes 60) augmente la probabilité d’observer les usages déclarés."
        : "Vous déclarez n’utiliser aucun outil d’IA et aucun usage n’a été observé dans le périmètre du scan. L’absence de détection ne vaut pas preuve d’absence : le mode surveillance renforce ce constat.",
  };
}

function tierForExposure(score: number): ScanExposure["tier"] {
  if (score >= 85) return "A";
  if (score >= 65) return "B";
  if (score >= 45) return "C";
  return "D";
}

function buildSummary(
  score: number,
  undeclaredAiEndpoints: number,
  exposedSecrets: number,
): string {
  const parts: string[] = [
    `Score d’exposition local : ${score}/100.`,
  ];
  if (undeclaredAiEndpoints > 0) {
    parts.push(
      `${undeclaredAiEndpoints} appel(s) d’IA non déclaré(s) détecté(s) sur le réseau du poste.`,
    );
  }
  if (exposedSecrets > 0) {
    parts.push(`${exposedSecrets} secret(s) exposé(s) en clair.`);
  }
  if (undeclaredAiEndpoints === 0 && exposedSecrets === 0) {
    parts.push(
      "Aucun usage d’IA non déclaré ni secret exposé n’a été détecté dans le périmètre observé.",
    );
  }
  return parts.join(" ");
}
