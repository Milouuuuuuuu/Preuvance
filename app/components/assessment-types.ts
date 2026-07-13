export type JsonRecord = Record<string, unknown>;

export type CompanyInput = {
  employees: number;
  annualRevenue: number;
  balanceSheetTotal: number;
};

export type AssessmentRequest = {
  organizationName: string;
  systemName: string;
  description: string;
  company: CompanyInput;
};

export type Assessment = JsonRecord & {
  id?: string;
  generatedAt?: string;
  facts?: unknown;
  classification?: unknown;
  gaps?: unknown;
  score?: unknown;
  decisionLog?: unknown;
  report?: unknown;
};

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function unwrapAssessment(payload: unknown): Assessment {
  if (!isRecord(payload)) {
    throw new Error("La réponse reçue n’est pas exploitable.");
  }

  if (isRecord(payload.assessment)) {
    return payload.assessment as Assessment;
  }

  return payload as Assessment;
}
