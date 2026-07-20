import type {
  DependencyCategory,
  DependencyFinding,
  ManifestKind,
} from "./dependency-contract";

export const DEPENDENCY_MANIFEST_MAX_BYTES = 1_000_000;

type CatalogEntry = {
  names: string[];
  prefixes?: string[];
  category: DependencyCategory;
  provider?: string;
  confidence: number;
};

const CATALOG: CatalogEntry[] = [
  { names: ["openai"], category: "provider-sdk", provider: "OpenAI", confidence: 100 },
  { names: ["@anthropic-ai/sdk", "anthropic"], category: "provider-sdk", provider: "Anthropic", confidence: 100 },
  { names: ["@google/generative-ai", "google-generativeai", "google-genai"], category: "provider-sdk", provider: "Google", confidence: 98 },
  { names: ["mistralai", "@mistralai/mistralai"], category: "provider-sdk", provider: "Mistral AI", confidence: 100 },
  { names: ["cohere", "cohere-ai"], category: "provider-sdk", provider: "Cohere", confidence: 96 },
  { names: ["groq", "groq-sdk"], category: "provider-sdk", provider: "Groq", confidence: 96 },
  { names: ["langchain", "langgraph", "@langchain/core"], prefixes: ["@langchain/"], category: "agent-framework", confidence: 96 },
  { names: ["llama-index", "llamaindex"], prefixes: ["@llamaindex/"], category: "agent-framework", confidence: 96 },
  { names: ["semantic-kernel"], category: "agent-framework", provider: "Microsoft", confidence: 94 },
  { names: ["autogen-agentchat", "crewai"], category: "agent-framework", confidence: 92 },
  { names: ["transformers", "@xenova/transformers", "onnxruntime", "onnxruntime-node", "ollama"], category: "model-runtime", confidence: 95 },
  { names: ["pinecone", "@pinecone-database/pinecone"], category: "vector-database", provider: "Pinecone", confidence: 100 },
  { names: ["chromadb", "chromadb-default-embed"], category: "vector-database", provider: "Chroma", confidence: 98 },
  { names: ["weaviate-client", "weaviate-ts-client"], category: "vector-database", provider: "Weaviate", confidence: 98 },
  { names: ["qdrant-client", "@qdrant/js-client-rest"], category: "vector-database", provider: "Qdrant", confidence: 98 },
  { names: ["pgvector"], category: "vector-database", confidence: 90 },
  { names: ["langfuse", "@langfuse/client", "@langfuse/tracing"], prefixes: ["langfuse-"], category: "ai-observability", provider: "Langfuse", confidence: 98 },
  { names: ["braintrust", "@braintrustdata/sdk"], category: "ai-observability", provider: "Braintrust", confidence: 98 },
  { names: ["arize-phoenix", "openinference-instrumentation"], prefixes: ["openinference-"], category: "ai-observability", confidence: 96 },
  { names: ["torch", "tensorflow", "jax", "scikit-learn"], category: "ml-library", confidence: 88 },
];

type ManifestScan = {
  kind: ManifestKind;
  dependencies: DependencyFinding[];
  warnings: string[];
};

export function scanDependencyManifest(name: string, content: string): ManifestScan {
  if (new TextEncoder().encode(content).byteLength > DEPENDENCY_MANIFEST_MAX_BYTES) {
    throw new Error("Le manifeste dépasse la limite de 1 Mo.");
  }
  const lowerName = name.toLowerCase();
  if (lowerName === "package.json") return scanPackageJson(name, content);
  if (lowerName === "package-lock.json") return scanPackageLock(name, content);
  if (/^requirements(?:[._-][^/]*)?\.txt$/.test(lowerName)) {
    return scanRequirements(name, content);
  }
  throw new Error("Format non pris en charge : package.json, package-lock.json ou requirements*.txt attendu.");
}

export function deduplicateDependencyFindings(
  findings: readonly DependencyFinding[],
): DependencyFinding[] {
  const selected = new Map<string, DependencyFinding>();
  for (const finding of findings) {
    const key = normalizePackageName(finding.packageName);
    const previous = selected.get(key);
    if (
      !previous ||
      (finding.direct && !previous.direct) ||
      finding.confidence > previous.confidence
    ) {
      selected.set(key, finding);
    }
  }
  return [...selected.values()]
    .sort((left, right) => {
      if (left.direct !== right.direct) return left.direct ? -1 : 1;
      return left.packageName.localeCompare(right.packageName, "en");
    })
    .slice(0, 120);
}

function scanPackageJson(name: string, content: string): ManifestScan {
  const parsed = parseJsonRecord(content, name);
  const groups = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
  const dependencies = groups.flatMap((group) => {
    const record = asStringRecord(parsed[group]);
    return Object.entries(record).flatMap(([packageName, version]) =>
      classifyDependency(packageName, version, true, name),
    );
  });
  return { kind: "package-json", dependencies: deduplicateDependencyFindings(dependencies), warnings: [] };
}

function scanPackageLock(name: string, content: string): ManifestScan {
  const parsed = parseJsonRecord(content, name);
  const rootPackages = asRecord(parsed.packages);
  const root = asRecord(rootPackages[""]);
  const directNames = new Set(
    ["dependencies", "devDependencies", "optionalDependencies"]
      .flatMap((group) => Object.keys(asStringRecord(root[group])))
      .map(normalizePackageName),
  );
  const dependencies: DependencyFinding[] = [];

  for (const [path, value] of Object.entries(rootPackages)) {
    if (!path.startsWith("node_modules/")) continue;
    const packageName = path.slice("node_modules/".length);
    if (!packageName || packageName.includes("/node_modules/")) continue;
    const record = asRecord(value);
    const version = typeof record.version === "string" ? record.version : undefined;
    dependencies.push(
      ...classifyDependency(
        packageName,
        version,
        directNames.has(normalizePackageName(packageName)),
        name,
      ),
    );
  }

  return {
    kind: "package-lock",
    dependencies: deduplicateDependencyFindings(dependencies),
    warnings: rootPackages[""] ? [] : ["Le lockfile ne contient pas de paquet racine ; le caractère direct ou transitif peut être incomplet."],
  };
}

function scanRequirements(name: string, content: string): ManifestScan {
  const dependencies = content.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) return [];
    const withoutMarker = trimmed.split(";")[0]?.trim() ?? "";
    const match = withoutMarker.match(/^([A-Za-z0-9_.-]+)(?:\[[^\]]+\])?\s*(?:===|==|~=|>=|<=|>|<|!=)?\s*([^\s#]+)?/);
    if (!match?.[1]) return [];
    return classifyDependency(match[1], match[2], true, name);
  });
  return { kind: "requirements", dependencies: deduplicateDependencyFindings(dependencies), warnings: [] };
}

function classifyDependency(
  packageName: string,
  version: string | undefined,
  direct: boolean,
  manifestName: string,
): DependencyFinding[] {
  const normalized = normalizePackageName(packageName);
  const catalogEntry = CATALOG.find(
    (entry) =>
      entry.names.some((name) => normalizePackageName(name) === normalized) ||
      entry.prefixes?.some((prefix) => normalized.startsWith(normalizePackageName(prefix))),
  );
  if (!catalogEntry) return [];
  return [
    {
      packageName,
      ...(version ? { version } : {}),
      category: catalogEntry.category,
      ...(catalogEntry.provider ? { provider: catalogEntry.provider } : {}),
      direct,
      manifestName,
      confidence: catalogEntry.confidence,
    },
  ];
}

function normalizePackageName(value: string) {
  return value.trim().toLowerCase().replaceAll("_", "-");
}

function parseJsonRecord(content: string, name: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // The public error below deliberately avoids echoing any manifest content.
  }
  throw new Error(`${name} n’est pas un objet JSON valide.`);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(asRecord(value)).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}
