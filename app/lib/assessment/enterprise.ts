import type { EnterpriseThresholds } from "./regulatory";
import type { CompanyInput, EnterpriseCategory } from "./schemas";

export type EnterpriseAssessment = {
  category: EnterpriseCategory;
  label: string;
  isSme: boolean;
  isSmallMidCap: boolean;
  financialTest: "revenue" | "balance_sheet" | "both" | "neither";
  rationale: string;
  aggregationWarning: string;
  aiActSmcRelief: {
    eligibleBySize: boolean;
    legalStatus: "binding" | "signed_pending_official_journal" | "not_applicable";
    display: string;
  };
};

type Threshold = EnterpriseThresholds["categories"]["micro"];

export function classifyEnterprise(
  company: CompanyInput,
  thresholds: EnterpriseThresholds,
): EnterpriseAssessment {
  const categories = thresholds.categories;

  if (meetsThreshold(company, categories.micro)) {
    return buildSmeAssessment(
      "micro",
      "Microentreprise",
      company,
      categories.micro,
      thresholds,
    );
  }

  if (meetsThreshold(company, categories.small)) {
    return buildSmeAssessment(
      "small",
      "Petite entreprise",
      company,
      categories.small,
      thresholds,
    );
  }

  if (meetsThreshold(company, categories.medium)) {
    return buildSmeAssessment(
      "medium",
      "Moyenne entreprise",
      company,
      categories.medium,
      thresholds,
    );
  }

  if (meetsThreshold(company, categories.smallMidCap)) {
    const financialTest = describeFinancialTest(company, categories.smallMidCap);
    return {
      category: "small_mid_cap",
      label: "Petite entreprise à moyenne capitalisation (SMC)",
      isSme: false,
      isSmallMidCap: true,
      financialTest,
      rationale: buildRationale(company, categories.smallMidCap, financialTest, true),
      aggregationWarning: thresholds.aggregationWarningFr,
      aiActSmcRelief: {
        eligibleBySize: true,
        legalStatus: thresholds.aiActSmcRelief.legalStatus,
        display: thresholds.aiActSmcRelief.displayFr,
      },
    };
  }

  return {
    category: "large",
    label: "Grande entreprise ou statut non démontré",
    isSme: false,
    isSmallMidCap: false,
    financialTest: "neither",
    rationale:
      "Les chiffres fournis ne satisfont pas simultanément le seuil d’effectif et l’un des plafonds financiers de la définition SMC.",
    aggregationWarning: thresholds.aggregationWarningFr,
    aiActSmcRelief: {
      eligibleBySize: false,
      legalStatus: "not_applicable",
      display: "Aucun régime SMC n’est préqualifié à partir des chiffres fournis.",
    },
  };
}

function buildSmeAssessment(
  category: "micro" | "small" | "medium",
  label: string,
  company: CompanyInput,
  threshold: Threshold,
  thresholds: EnterpriseThresholds,
): EnterpriseAssessment {
  const financialTest = describeFinancialTest(company, threshold);
  return {
    category,
    label,
    isSme: true,
    isSmallMidCap: false,
    financialTest,
    rationale: buildRationale(company, threshold, financialTest, false),
    aggregationWarning: thresholds.aggregationWarningFr,
    aiActSmcRelief: {
      eligibleBySize: false,
      legalStatus: "binding",
      display:
        "Le régime PME de l’AI Act est déjà prévu par le règlement publié ; l’extension SMC n’est pas nécessaire pour cette préqualification.",
    },
  };
}

function meetsThreshold(company: CompanyInput, threshold: Threshold): boolean {
  return (
    company.employees < threshold.maxEmployeesExclusive &&
    (company.annualRevenue <= threshold.maxAnnualRevenueInclusive ||
      company.balanceSheetTotal <= threshold.maxBalanceSheetInclusive)
  );
}

function describeFinancialTest(
  company: CompanyInput,
  threshold: Threshold,
): EnterpriseAssessment["financialTest"] {
  const revenue = company.annualRevenue <= threshold.maxAnnualRevenueInclusive;
  const balance = company.balanceSheetTotal <= threshold.maxBalanceSheetInclusive;
  if (revenue && balance) return "both";
  if (revenue) return "revenue";
  if (balance) return "balance_sheet";
  return "neither";
}

function buildRationale(
  company: CompanyInput,
  threshold: Threshold,
  financialTest: EnterpriseAssessment["financialTest"],
  excludesSme: boolean,
): string {
  const financialLabel =
    financialTest === "both"
      ? "les deux plafonds financiers"
      : financialTest === "revenue"
        ? "le plafond de chiffre d’affaires"
        : "le plafond de total de bilan";
  const exclusion = excludesSme
    ? " L’entreprise ne satisfait pas les critères PME avec les chiffres fournis, condition nécessaire à la catégorie SMC."
    : "";

  return `${company.employees.toLocaleString("fr-FR")} salarié(s), sous le seuil strict de ${threshold.maxEmployeesExclusive.toLocaleString("fr-FR")}, et ${financialLabel} respecté(s).${exclusion}`;
}

