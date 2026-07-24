import { providerLabelForId } from "@/lib/scan/scan-contract";

import type { Catalogue } from "./catalogue-contract";

/**
 * Cartographie des flux : où vit la donnée, par où elle passe, où elle sort.
 *
 * Le graphe est construit à partir du seul catalogue. Une arête existe parce
 * qu'un flux a été déclaré ou observé ; aucune n'est déduite d'une
 * vraisemblance. Le niveau de preuve est porté par l'arête et rendu visible
 * dans le schéma : un trait plein pour l'observé, un trait pointillé pour le
 * déclaré.
 */
export const FLOW_MAP_VERSION = "preuvance-flow-map-v1";

export type FlowNodeKind = "source" | "tool" | "ai_provider" | "person" | "external";

export type FlowNode = {
  id: string;
  kind: FlowNodeKind;
  label: string;
  /** Mention courte affichée sous le libellé (volumétrie, hébergement…). */
  badge: string | null;
};

export type FlowEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  evidence: "declared" | "observed_connector" | "observed_scan";
  personalData: "yes" | "no" | "unknown";
};

export type FlowGraph = {
  version: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  notes: string[];
};

function nodeId(kind: FlowNodeKind, reference: string): string {
  const prefix =
    kind === "source" ? "src" : kind === "tool" ? "out" : kind === "ai_provider" ? "ia" : "ext";
  const safe = reference.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 60);
  return `${prefix}_${safe || "inconnu"}`;
}

function formatRows(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")} M lignes`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} k lignes`;
  return `${value} lignes`;
}

export function buildFlowGraph(catalogue: Catalogue): FlowGraph {
  const nodes = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];
  const notes: string[] = [];

  for (const source of catalogue.sources) {
    const datasets = catalogue.datasets.filter((dataset) => dataset.sourceId === source.id);
    const knownRows = datasets
      .map((dataset) => dataset.rowCount.value)
      .filter((value): value is number => value !== null)
      .reduce((sum, value) => sum + value, 0);
    const personal = datasets.some((dataset) =>
      dataset.fields.some((field) => field.sensitivity),
    );
    const badgeParts = [`${datasets.length} objet(s)`];
    if (knownRows > 0) badgeParts.push(formatRows(knownRows));
    if (personal) badgeParts.push("données personnelles");
    if (source.status !== "collected") badgeParts.push(`collecte ${source.status === "partial" ? "partielle" : "impossible"}`);

    const id = nodeId("source", source.id);
    nodes.set(id, {
      id,
      kind: "source",
      label: source.label,
      badge: badgeParts.join(" · "),
    });
  }

  for (const tool of catalogue.tools) {
    const id = nodeId("tool", tool.id);
    nodes.set(id, {
      id,
      kind: "tool",
      label: tool.name,
      badge: [
        tool.category,
        tool.hosting === "cloud"
          ? "cloud"
          : tool.hosting === "on_premise"
            ? "hébergé chez le client"
            : "hébergement inconnu",
      ].join(" · "),
    });

    for (const sourceId of tool.sourceIds ?? []) {
      const from = nodeId("source", sourceId);
      if (!nodes.has(from)) continue;
      edges.push({
        id: `edge-${sourceId}-${tool.id}`,
        from,
        to: id,
        label: "lecture",
        evidence: tool.evidence,
        personalData: catalogue.datasets.some(
          (dataset) => dataset.sourceId === sourceId && dataset.fields.some((f) => f.sensitivity),
        )
          ? "yes"
          : "unknown",
      });
    }

    for (const providerId of tool.aiProviders ?? []) {
      const providerNode = nodeId("ai_provider", providerId);
      if (!nodes.has(providerNode)) {
        nodes.set(providerNode, {
          id: providerNode,
          kind: "ai_provider",
          label: providerLabelForId(providerId) ?? providerId,
          badge: "fournisseur d’IA",
        });
      }
      edges.push({
        id: `edge-${tool.id}-${providerId}`,
        from: id,
        to: providerNode,
        label: "appel d’IA",
        evidence: tool.evidence,
        personalData: "unknown",
      });
    }
  }

  /* Fournisseurs d'IA observés par le scan local, même sans outil déclaré. */
  const aiScan = catalogue.aiScan;
  if (aiScan) {
    for (const providerId of [...aiScan.undeclaredProviders, ...aiScan.corroboratedProviders]) {
      const providerNode = nodeId("ai_provider", providerId);
      if (nodes.has(providerNode)) continue;
      const undeclared = aiScan.undeclaredProviders.includes(providerId);
      nodes.set(providerNode, {
        id: providerNode,
        kind: "ai_provider",
        label: providerLabelForId(providerId) ?? providerId,
        badge: undeclared ? "observé, non déclaré" : "déclaré et observé",
      });
      const posteNode = nodeId("person", "postes");
      if (!nodes.has(posteNode)) {
        nodes.set(posteNode, {
          id: posteNode,
          kind: "person",
          label: "Postes de travail",
          badge: "scan local",
        });
      }
      edges.push({
        id: `edge-postes-${providerId}`,
        from: posteNode,
        to: providerNode,
        label: undeclared ? "appel non déclaré" : "appel déclaré",
        evidence: "observed_scan",
        personalData: "unknown",
      });
    }
  }

  for (const flow of catalogue.flows) {
    const from = nodeId(flow.from.kind, flow.from.ref);
    const to = nodeId(flow.to.kind, flow.to.ref);
    if (!nodes.has(from)) {
      nodes.set(from, {
        id: from,
        kind: flow.from.kind,
        label: flow.from.ref,
        badge: flow.from.kind === "external" ? "tiers externe" : null,
      });
    }
    if (!nodes.has(to)) {
      nodes.set(to, {
        id: to,
        kind: flow.to.kind,
        label: flow.to.ref,
        badge: flow.to.kind === "external" ? "tiers externe" : null,
      });
    }
    edges.push({
      id: `edge-${flow.id}`,
      from,
      to,
      label: flow.label ?? flowLabel(flow.medium, flow.frequency),
      evidence: flow.evidence,
      personalData: flow.personalData,
    });
  }

  if (edges.length === 0) {
    notes.push(
      "Aucun flux n’a encore été déclaré ni observé : la cartographie se limite aux sources inventoriées. Les entretiens de la phase J6-J8 servent précisément à les recueillir.",
    );
  }

  return {
    version: FLOW_MAP_VERSION,
    nodes: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
    edges: edges.sort((a, b) => a.id.localeCompare(b.id)),
    notes,
  };
}

function flowLabel(medium: string, frequency: string): string {
  const media: Record<string, string> = {
    api: "API",
    export_fichier: "export de fichier",
    synchronisation: "synchronisation",
    saisie_manuelle: "saisie manuelle",
    courriel: "courriel",
    inconnu: "flux",
  };
  const frequencies: Record<string, string> = {
    temps_reel: "temps réel",
    quotidien: "quotidien",
    hebdomadaire: "hebdomadaire",
    mensuel: "mensuel",
    ponctuel: "ponctuel",
    inconnu: "fréquence inconnue",
  };
  return `${media[medium] ?? medium} · ${frequencies[frequency] ?? frequency}`;
}

function escapeMermaid(value: string): string {
  return value.replace(/["<>|]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Rend le graphe en Mermaid. Le format est du texte : il se lit dans le
 * Markdown livré au client, se colle dans une documentation, et n'exige aucun
 * moteur de rendu propriétaire.
 */
export function toMermaid(graph: FlowGraph): string {
  const lines = ["flowchart LR"];

  for (const node of graph.nodes) {
    const label = graph.nodes.some((other) => other.id !== node.id && other.label === node.label)
      ? `${escapeMermaid(node.label)} (${node.kind})`
      : escapeMermaid(node.label);
    const text = node.badge ? `${label}<br/>${escapeMermaid(node.badge)}` : label;
    if (node.kind === "source") lines.push(`  ${node.id}[("${text}")]`);
    else if (node.kind === "ai_provider") lines.push(`  ${node.id}{{"${text}"}}`);
    else if (node.kind === "person") lines.push(`  ${node.id}(["${text}"])`);
    else lines.push(`  ${node.id}["${text}"]`);
  }

  for (const edge of graph.edges) {
    const arrow = edge.evidence === "declared" ? "-.->" : "-->";
    const marker = edge.personalData === "yes" ? "données personnelles · " : "";
    lines.push(`  ${edge.from} ${arrow}|"${marker}${escapeMermaid(edge.label)}"| ${edge.to}`);
  }

  lines.push("  classDef ia fill:#fde8e8,stroke:#c53030,color:#3b0d0d;");
  lines.push("  classDef src fill:#e8f0fe,stroke:#1a4fa0,color:#0b2545;");
  const aiNodes = graph.nodes.filter((node) => node.kind === "ai_provider").map((node) => node.id);
  const sourceNodes = graph.nodes.filter((node) => node.kind === "source").map((node) => node.id);
  if (aiNodes.length > 0) lines.push(`  class ${aiNodes.join(",")} ia;`);
  if (sourceNodes.length > 0) lines.push(`  class ${sourceNodes.join(",")} src;`);

  return lines.join("\n");
}
