import type { Assessment } from "../../app/components/assessment-types";
import type { PreuvanceAssessment } from "../../lib/pdf/assessment-payload";

const generatedAt = "2026-07-22T10:00:00.000Z";

export const northstarDemoReport: PreuvanceAssessment = {
  assessmentId: "northstar-demo-20260722",
  generatedAt,
  lastRegulatoryVerification: "2026-07-13",
  organization: {
    name: "Northstar Demo Ltd — organisation fictive",
    registrationCountry: "France — démonstration",
    employeeCount: 120,
    annualRevenueEur: 24_000_000,
    balanceSheetTotalEur: 18_000_000,
    smcEligible: false,
  },
  system: {
    name: "Northstar Support Copilot",
    description:
      "Assistant interne fictif qui recherche des passages dans une base approuvée, résume des tickets et prépare une réponse. Un agent de support doit relire et approuver chaque brouillon avant tout envoi.",
    sector: "Support client — démonstration",
    intendedUse:
      "Aider les agents à préparer des réponses à partir d’une base de connaissances approuvée.",
    affectedPeople: "Agents de support et clients de démonstration",
    operatorRole: "Déployeur fictif",
  },
  result: {
    score: 73,
    tier: "B",
    riskLevel: "limited",
    confidence: 0.84,
    executiveSummary:
      "Exemple figé et fictif : la supervision humaine est déclarée, des dépendances IA sont détectées et plusieurs pièces restent à documenter. Ce dossier illustre le fonctionnement de Preuvance ; il ne résulte pas d’un nouvel appel modèle et ne constitue ni une certification ni un avis juridique.",
  },
  crossCheck: {
    status: "concordant",
    version: "preuvance-crosscheck-v1",
    note:
      "Aucune contradiction structurante n’est introduite dans ce scénario fictif. La revue humaine déclarée reste distincte d’une preuve vérifiée.",
  },
  decisionLog: [
    {
      title: "Pratiques interdites — droit publié",
      decision: "Aucun signal explicite dans le scénario fourni",
      score: 88,
      rationale:
        "Le scénario exclut les décisions d’éligibilité, de tarification et d’évaluation des salariés.",
    },
    {
      title: "Transparence — article 50",
      decision: "Obligation d’information à documenter",
      score: 82,
      rationale:
        "Le brouillon est généré par une IA mais relu par un agent ; le dispositif d’information et la procédure doivent être conservés comme pièces.",
    },
    {
      title: "Contre-vérification déterministe",
      decision: "Concordante avec les faits du scénario",
      score: 95,
      rationale:
        "Les faits structurés, la qualification limitée et les écarts documentaires restent cohérents.",
    },
  ],
  classification: {
    rationale:
      "Sur les seuls faits fictifs fournis, le système prépare des brouillons sous contrôle humain et n’effectue pas de décision produisant un effet juridique ou similaire. Les obligations de transparence et la gouvernance documentaire restent à confirmer par un professionnel.",
    articles: [
      {
        reference: "Article 4",
        title: "Maîtrise de l’IA",
        finding:
          "Les personnes qui utilisent le système doivent disposer d’un niveau de maîtrise adapté à leur rôle.",
        deadline: "Applicable depuis le 2 février 2025",
        deadlineStatus: "Droit publié — actif",
      },
      {
        reference: "Article 50",
        title: "Transparence",
        finding:
          "Le dispositif d’information et les responsabilités de validation doivent être décrits et conservés.",
        deadline: "2 août 2026",
        deadlineStatus: "Droit publié — échéance programmée",
      },
    ],
  },
  dimensions: [
    {
      name: "Gouvernance",
      score: 78,
      finding: "Un responsable et une validation humaine sont déclarés, mais les pièces restent incomplètes.",
    },
    {
      name: "Transparence",
      score: 66,
      finding: "Le message d’information et sa preuve de diffusion doivent être formalisés.",
    },
    {
      name: "Données et base de connaissances",
      score: 74,
      finding: "La base approuvée est déclarée ; son journal de versions manque encore.",
    },
    {
      name: "Supervision humaine",
      score: 82,
      finding: "La règle de relecture est claire mais doit être prouvée par une procédure validée et des contrôles périodiques.",
    },
  ],
  gaps: [
    {
      priority: "high",
      title: "Procédure de revue humaine à approuver",
      finding:
        "Une relecture avant envoi est déclarée, mais aucune procédure approuvée n’est fournie dans le scénario initial.",
      recommendedAction:
        "Faire approuver la procédure, nommer son propriétaire et conserver les versions et dates de revue.",
      articleReferences: ["Article 4", "Article 50"],
      owner: "Responsable support — persona fictive",
    },
    {
      priority: "medium",
      title: "Journal de versions de la base approuvée",
      finding:
        "La source de connaissance est décrite comme approuvée sans journal vérifiable de ses versions.",
      recommendedAction:
        "Conserver version, date, propriétaire, changement et validation de chaque publication.",
      articleReferences: ["Article 4"],
    },
    {
      priority: "medium",
      title: "Échantillonnage périodique des réponses",
      finding:
        "Le contrôle mensuel est proposé dans la procédure fictive, mais aucun résultat de test n’est présent.",
      recommendedAction:
        "Définir l’échantillon, les critères d’échec, le responsable et la conservation des résultats.",
      articleReferences: ["Article 4"],
    },
  ],
  evidence: [
    {
      id: "ev-northstar-human-review",
      control: "Validation humaine avant chaque envoi",
      status: "declared",
      detail:
        "Contrôle déclaré dans le scénario Northstar ; aucune pièce de production ni identité réelle n’est associée.",
      owner: "Responsable support — persona fictive",
      sourceType: "user-declaration",
      sourceLabel: "Description fictive du système",
      collectedAt: generatedAt,
      updatedAt: generatedAt,
    },
    {
      id: "ev-northstar-openai",
      control: "Dépendance IA détectée : openai",
      status: "detected",
      detail:
        "Dépendance directe observée dans le manifeste de démonstration. Cette détection ne prouve ni l’usage réel ni la finalité métier.",
      sourceType: "dependency-scan",
      sourceLabel: "demo/build-week/package.json · SHA-256 6604f095ba398fd5…",
      collectedAt: generatedAt,
      updatedAt: generatedAt,
    },
    {
      id: "ev-northstar-langfuse",
      control: "Dépendance d’observabilité détectée : langfuse",
      status: "detected",
      detail:
        "Signal technique issu du manifeste fictif ; sa configuration et son périmètre restent à vérifier.",
      sourceType: "dependency-scan",
      sourceLabel: "demo/build-week/package.json",
      collectedAt: generatedAt,
      updatedAt: generatedAt,
    },
    {
      id: "ev-northstar-procedure",
      control: "Procédure de revue humaine",
      status: "documented",
      detail:
        "Document de démonstration uniquement. Son empreinte établit l’intégrité du fichier, pas sa validité organisationnelle.",
      owner: "Responsable support — persona fictive",
      sourceType: "policy",
      sourceLabel: "Pièce locale de démonstration",
      fileName: "review-procedure-demo.md",
      fileSizeBytes: 672,
      sha256: "e3973e70aee07ca6c3243456c604363e85ef2058763eeee4f0095c0b9b0e1b0e",
      collectedAt: generatedAt,
      updatedAt: generatedAt,
    },
    {
      id: "ev-northstar-demo-attestation",
      control: "Revue du caractère fictif du dossier de démonstration",
      status: "verified",
      detail:
        "La séparation entre données fictives, signaux détectés et preuves réelles a été relue pour cette démonstration. Cette attestation ne couvre aucune organisation réelle.",
      owner: "Équipe de démonstration",
      sourceType: "test",
      sourceLabel: "Checklist de démonstration Preuvance",
      reviewedBy: "Relecteur de démonstration — persona fictive",
      reviewedAt: "2026-07-22T10:15:00.000Z",
      collectedAt: generatedAt,
      updatedAt: "2026-07-22T10:15:00.000Z",
    },
    {
      id: "ev-northstar-version-log",
      control: "Journal de versions de la base de connaissances",
      status: "missing",
      detail: "Pièce attendue ; aucun journal n’est inclus dans le scénario fictif.",
      sourceType: "model-extraction",
      sourceLabel: "Écart documentaire du scénario",
      collectedAt: generatedAt,
      updatedAt: generatedAt,
    },
    {
      id: "ev-northstar-periodic-tests",
      control: "Résultats des contrôles périodiques",
      status: "missing",
      detail: "Pièce attendue ; aucun résultat de test n’est inclus dans le scénario fictif.",
      sourceType: "model-extraction",
      sourceLabel: "Écart documentaire du scénario",
      collectedAt: generatedAt,
      updatedAt: generatedAt,
    },
  ],
  evidenceInventory: {
    sourceItemCount: 7,
    includedItemCount: 7,
    truncatedItemCount: 0,
    methodVersion: "preuvance-evidence-builder-v1",
  },
  methodology: {
    version: "preuvance-readiness-v1",
  },
};

export const northstarDemoAssessment: Assessment = {
  id: northstarDemoReport.assessmentId,
  generatedAt,
  status: "completed",
  product: "PREUVANCE",
  demoMode: true,
  facts: {
    sector: "Support client — démonstration",
    intendedPurpose:
      "Préparer des brouillons à partir d’une base de connaissances approuvée.",
    targetUsers: ["Agents de support fictifs"],
    affectedPeople: ["Clients de démonstration"],
    existingControls: [
      "Validation humaine avant envoi",
      "Base de connaissances restreinte",
    ],
  },
  classification: {
    riskTier: "Risque limité — obligations de transparence",
    category: "Risque limité — obligations de transparence",
    confidence: 84,
    companyRegime: "PME — données fictives",
    summary: northstarDemoReport.classification.rationale,
    applicableArticles: northstarDemoReport.classification.articles,
    obligations: northstarDemoReport.classification.articles,
  },
  gaps: northstarDemoReport.gaps.map((gap, index) => ({
    id: `northstar-gap-${index + 1}`,
    title: gap.title,
    priority: gap.priority,
    article: gap.articleReferences.join(" · "),
    detail: gap.finding,
    rationale: gap.finding,
    action: gap.recommendedAction,
    recommendedAction: gap.recommendedAction,
  })),
  score: {
    overall: northstarDemoReport.result.score,
    tier: northstarDemoReport.result.tier,
    dimensions: northstarDemoReport.dimensions.map((dimension) => ({
      label: dimension.name,
      score: dimension.score,
      detail: dimension.finding,
    })),
    methodVersion: northstarDemoReport.methodology?.version,
  },
  crossCheck: {
    status: "concordant",
    version: northstarDemoReport.crossCheck?.version,
    noteFr: northstarDemoReport.crossCheck?.note,
  },
  decisionLog: northstarDemoReport.decisionLog,
  report: northstarDemoReport,
  metadata: {
    regulatoryReferenceVerifiedAt:
      northstarDemoReport.lastRegulatoryVerification,
    demoMode: true,
    modelProvenance: "absent-by-design",
  },
  persistence: {
    status: "disabled",
  },
};
