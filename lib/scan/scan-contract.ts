import { z } from "zod";

export const SCAN_SCHEMA_VERSION = "preuvance-scan-v1";

/**
 * Catalogue des fournisseurs d'API d'IA générative, par nom d'hôte.
 * Sert au détecteur de « shadow AI » : on observe la DESTINATION réseau
 * (hostname / IP), jamais le contenu chiffré des requêtes. Le scan local
 * PowerShell embarque sa propre copie de cette liste ; les deux doivent
 * rester alignées.
 */
export const AI_PROVIDER_HOSTS: Array<{
  provider: string;
  label: string;
  match: RegExp;
}> = [
  { provider: "openai", label: "OpenAI", match: /(^|\.)api\.openai\.com$/i },
  { provider: "anthropic", label: "Anthropic", match: /(^|\.)api\.anthropic\.com$/i },
  { provider: "azure-openai", label: "Azure OpenAI", match: /\.openai\.azure\.com$/i },
  {
    provider: "google",
    label: "Google (Gemini / Vertex)",
    match: /(^|\.)(generativelanguage|aiplatform)\.googleapis\.com$/i,
  },
  { provider: "mistral", label: "Mistral", match: /(^|\.)api\.mistral\.ai$/i },
  { provider: "cohere", label: "Cohere", match: /(^|\.)api\.cohere\.(ai|com)$/i },
  {
    provider: "aws-bedrock",
    label: "AWS Bedrock",
    match: /(^|\.)bedrock[a-z0-9.-]*\.amazonaws\.com$/i,
  },
  {
    provider: "huggingface",
    label: "Hugging Face",
    match: /(^|\.)(api-inference|router)\.huggingface\.co$/i,
  },
  { provider: "xai", label: "xAI", match: /(^|\.)api\.x\.ai$/i },
  { provider: "deepseek", label: "DeepSeek", match: /(^|\.)api\.deepseek\.com$/i },
  { provider: "groq", label: "Groq", match: /(^|\.)api\.groq\.com$/i },
  {
    provider: "together",
    label: "Together AI",
    match: /(^|\.)api\.together\.(ai|xyz)$/i,
  },
  { provider: "openrouter", label: "OpenRouter", match: /(^|\.)openrouter\.ai$/i },
  { provider: "perplexity", label: "Perplexity", match: /(^|\.)api\.perplexity\.ai$/i },
];

export function providerLabelForHost(host: string): string | null {
  const entry = AI_PROVIDER_HOSTS.find((candidate) => candidate.match.test(host));
  return entry ? entry.label : null;
}

export const SENSITIVE_FILE_CATEGORIES = [
  "secret",
  "credential",
  "financial",
  "personal_data",
  "other",
] as const;

const isoDateTime = z
  .string()
  .trim()
  .max(40)
  .refine((value) => Number.isFinite(Date.parse(value)), "date ISO invalide");

const boundedString = (max: number, min = 0) =>
  z.string().trim().min(min).max(max);

const aiEndpointSchema = z
  .object({
    host: boundedString(255, 1),
    provider: boundedString(60),
    firstSeen: isoDateTime.optional(),
    lastSeen: isoDateTime.optional(),
    hitCount: z.number().int().min(0).max(10_000_000),
    processes: z.array(boundedString(160)).max(50),
    remoteAddresses: z.array(boundedString(60)).max(50),
    declared: z.boolean().default(false),
  })
  .strict();

const sensitiveFileSchema = z
  .object({
    path: boundedString(1_000, 1),
    category: z.enum(SENSITIVE_FILE_CATEGORIES),
    sizeBytes: z.number().int().min(0),
    modifiedAt: isoDateTime.optional(),
    // Empreinte SHA-256 (pointage sans copie). Jamais le contenu du fichier.
    sha256: boundedString(64).optional(),
  })
  .strict();

export const scanReportSchema = z
  .object({
    schemaVersion: z.literal(SCAN_SCHEMA_VERSION),
    generatedAt: isoDateTime,
    host: z
      .object({
        profile: z.enum(["personal", "professional", "unknown"]),
        domainJoined: z.boolean(),
        osCaption: boundedString(120).optional(),
        elevated: z.boolean(),
      })
      .strict(),
    capabilities: z
      .object({
        dnsClientLog: z.boolean(),
        connectionSampling: z.boolean(),
        fileInventory: z.boolean(),
      })
      .strict(),
    network: z
      .object({
        mode: z.enum(["snapshot", "watch"]),
        durationSeconds: z.number().min(0).max(86_400),
        samples: z.number().int().min(0).max(1_000_000),
        aiEndpoints: z.array(aiEndpointSchema).max(200),
        otherExternalEndpoints: z.number().int().min(0).max(1_000_000),
      })
      .strict(),
    files: z
      .object({
        rootsScanned: z.array(boundedString(1_000)).max(50),
        sensitive: z.array(sensitiveFileSchema).max(5_000),
        truncated: z.boolean(),
      })
      .strict(),
    notes: z.array(boundedString(500)).max(50),
  })
  .strict();

export type ScanReport = z.infer<typeof scanReportSchema>;
export type ScanAiEndpoint = z.infer<typeof aiEndpointSchema>;
export type ScanSensitiveFile = z.infer<typeof sensitiveFileSchema>;

export type ScanValidationResult =
  | { success: true; data: ScanReport }
  | { success: false; errors: string[] };

export function validateScanReport(input: unknown): ScanValidationResult {
  const result = scanReportSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.issues
      .slice(0, 50)
      .map((issue) => `${issue.path.join(".") || "scan"}: ${issue.message}`),
  };
}
