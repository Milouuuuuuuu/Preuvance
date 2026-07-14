import type {
  ScanAiEndpoint,
  ScanReport,
  ScanSensitiveFile,
} from "@/lib/scan/scan-contract";

export const SCAN_SCORING_VERSION = "preuvance-scan-scoring-v1";

export type ScanFindingSeverity = "critical" | "major" | "moderate" | "minor";

export type ScanFinding = {
  id: string;
  severity: ScanFindingSeverity;
  title: string;
  detail: string;
  article: string | null;
  penalty: number;
};

export type ScanExposure = {
  version: string;
  exposureScore: number;
  tier: "A" | "B" | "C" | "D";
  findings: ScanFinding[];
  summary: string;
  observed: {
    aiEndpoints: number;
    undeclaredAiEndpoints: number;
    secretFiles: number;
    financialFiles: number;
    personalDataFiles: number;
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

function endpointFinding(endpoint: ScanAiEndpoint): ScanFinding {
  const declared = endpoint.declared === true;
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
      ? `Des requêtes réseau vers ${endpoint.host} ont été observées et correspondent à un usage d’IA déclaré.${processHint}`
      : `Des requêtes réseau vers ${endpoint.host} ont été observées sur ce poste sans usage d’IA déclaré dans l’évaluation. Un système d’IA non inventorié échappe à la classification, aux obligations de transparence et à la gouvernance.${processHint}`,
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

  for (const endpoint of report.network.aiEndpoints) {
    findings.push(endpointFinding(endpoint));
  }

  const secretFiles = countCategory(report.files.sensitive, "secret");
  const credentialFiles = countCategory(report.files.sensitive, "credential");
  const financialFiles = countCategory(report.files.sensitive, "financial");
  const personalDataFiles = countCategory(report.files.sensitive, "personal_data");

  const exposedSecrets = secretFiles + credentialFiles;
  if (exposedSecrets > 0) {
    findings.push({
      id: "exposed-secrets",
      severity: exposedSecrets >= 3 ? "critical" : "major",
      title: `${exposedSecrets} fichier(s) de ${CATEGORY_LABELS.secret} en clair sur le poste`,
      detail:
        "Des secrets ou certificats ont été inventoriés (chemin et empreinte seulement, aucun contenu copié). Leur présence en clair sur un poste de travail est un risque de gouvernance des données à corriger avant tout dossier d’assurabilité.",
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

  const undeclaredAiEndpoints = report.network.aiEndpoints.filter(
    (endpoint) => endpoint.declared !== true,
  ).length;

  return {
    version: SCAN_SCORING_VERSION,
    exposureScore,
    tier: tierForExposure(exposureScore),
    findings: findings.sort((a, b) => b.penalty - a.penalty),
    summary: buildSummary(exposureScore, undeclaredAiEndpoints, exposedSecrets),
    observed: {
      aiEndpoints: report.network.aiEndpoints.length,
      undeclaredAiEndpoints,
      secretFiles: exposedSecrets,
      financialFiles,
      personalDataFiles,
      limitedObservation,
    },
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
