import {
  renderDocumentHtml,
  renderDocumentMarkdown,
  type DocumentBlock,
  type DocumentModel,
  type DocumentSection,
} from "@/lib/documents/render";

import type { Catalogue } from "./catalogue-contract";
import {
  AXIS_LABELS,
  SEVERITY_LABELS,
  type Diagnostic,
  type DiagnosticFinding,
} from "./diagnostic";
import { buildFlowGraph, toMermaid } from "./flow-map";
import { SENSITIVE_CATEGORY_LABELS } from "./sensitive-fields";

/**
 * Rapport de diagnostic : le livrable qui se vend.
 *
 * Le contenu est construit une seule fois sous forme de blocs typés, puis
 * rendu en Markdown (repris tel quel dans un document) ou en HTML autonome
 * (imprimable en PDF depuis le navigateur, sans envoi réseau). Les deux
 * sorties disent donc exactement la même chose — impossible qu'une version
 * commerciale s'écarte de la version technique.
 */
export const REPORT_VERSION = "preuvance-diagnostic-report-v1";

export type ReportBlock = DocumentBlock;
export type ReportSection = DocumentSection;
export type ReportModel = DocumentModel & {
  score: number;
  tier: Diagnostic["tier"];
};

const TIER_LABELS: Record<Diagnostic["tier"], string> = {
  A: "A — socle solide",
  B: "B — écarts circonscrits",
  C: "C — chantiers structurants",
  D: "D — reprise en profondeur",
};

const OWNER_LABELS = {
  client: "client",
  operateur: "opérateur",
  conjoint: "conjoint",
} as const;

function formatDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toISOString().slice(0, 10);
}

function formatNumber(value: number): string {
  return value.toLocaleString("fr-FR").replace(/ | /g, " ");
}

function findingRow(finding: DiagnosticFinding): string[] {
  return [
    SEVERITY_LABELS[finding.severity],
    AXIS_LABELS[finding.axis],
    finding.title,
    finding.basis ?? "—",
    `${finding.effortDays} j`,
  ];
}

export function buildReportModel(catalogue: Catalogue, diagnostic: Diagnostic): ReportModel {
  const graph = buildFlowGraph(catalogue);
  const sections: ReportSection[] = [];

  sections.push({
    id: "synthese",
    title: "1. Synthèse",
    blocks: [
      { kind: "paragraph", text: diagnostic.summary },
      {
        kind: "table",
        head: ["Axe", "Poids", "Score"],
        rows: diagnostic.axes.map((axis) => [
          axis.label,
          `${axis.weight} %`,
          `${axis.score}/100`,
        ]),
      },
      ...(diagnostic.appliedCaps.length > 0
        ? [
            {
              kind: "table" as const,
              head: ["Plafond appliqué", "Motif"],
              rows: diagnostic.appliedCaps.map((cap) => [`${cap.cap}/100`, cap.reason]),
            },
            {
              kind: "paragraph" as const,
              text: `Calcul pondéré avant plafonds : ${diagnostic.rawScore}/100. Un plafond traduit une observation manquante : il ne se négocie pas, il se lève en complétant la collecte.`,
            },
          ]
        : []),
      {
        kind: "callout",
        tone: "info",
        title: "Ce que ce score est, et ce qu’il n’est pas",
        text: "Le score agrège des constats déterministes issus de ce qui a été effectivement lu. Il mesure la préparation du client, pas sa conformité : il ne vaut ni avis juridique, ni certification, ni décision d’assurabilité.",
      },
    ],
  });

  sections.push({
    id: "couverture",
    title: "2. Couverture de la collecte",
    blocks: [
      {
        kind: "table",
        head: ["Indicateur", "Valeur"],
        rows: [
          ["Sources au périmètre", formatNumber(diagnostic.coverage.sources)],
          ["dont inventoriées intégralement", formatNumber(diagnostic.coverage.sourcesCollected)],
          ["dont partielles", formatNumber(diagnostic.coverage.sourcesPartial)],
          ["dont injoignables", formatNumber(diagnostic.coverage.sourcesUnreachable)],
          ["Jeux de données", formatNumber(diagnostic.coverage.datasets)],
          ["Champs décrits", formatNumber(diagnostic.coverage.fields)],
          ["Lignes connues (estimations cumulées)", formatNumber(diagnostic.coverage.totalRowsKnown)],
          [
            "Jeux de données sans volumétrie",
            formatNumber(diagnostic.coverage.datasetsWithoutRowCount),
          ],
          [
            "Jeux de données sans date de dernière écriture",
            formatNumber(diagnostic.coverage.datasetsWithoutFreshness),
          ],
        ],
      },
      {
        kind: "table",
        head: ["Source", "Type", "État", "Emplacement"],
        rows: catalogue.sources.map((source) => [
          source.label,
          source.system,
          source.status === "collected"
            ? "inventoriée"
            : source.status === "partial"
              ? "partielle"
              : "injoignable",
          source.location ?? "—",
        ]),
      },
    ],
  });

  const critical = diagnostic.findings.filter((item) => item.severity === "critical");
  const others = diagnostic.findings.filter((item) => item.severity !== "critical");
  const constatBlocks: ReportBlock[] = [];
  if (diagnostic.findings.length === 0) {
    constatBlocks.push({
      kind: "paragraph",
      text: "Aucun constat n’a été produit sur le périmètre observé. Ce résultat n’est probant que si la couverture ci-dessus est complète.",
    });
  } else {
    for (const item of critical) {
      constatBlocks.push({
        kind: "callout",
        tone: "risk",
        title: `Critique — ${item.title}`,
        text: `${item.detail} → ${item.recommendation}`,
      });
    }
    constatBlocks.push({
      kind: "table",
      head: ["Gravité", "Axe", "Constat", "Fondement", "Charge"],
      rows: others.map(findingRow),
    });
  }
  sections.push({ id: "constats", title: "3. Constats", blocks: constatBlocks });

  const sensitivityRows = diagnostic.sensitivity.byCategory.map((entry) => [
    SENSITIVE_CATEGORY_LABELS[entry.category],
    formatNumber(entry.fields),
    formatNumber(entry.datasets),
  ]);
  sections.push({
    id: "donnees-personnelles",
    title: "4. Données personnelles repérées",
    blocks: [
      {
        kind: "paragraph",
        text: `${formatNumber(diagnostic.sensitivity.fieldsSensitive)} champ(s) sur ${formatNumber(diagnostic.sensitivity.fieldsTotal)} portent un nom évoquant une donnée sensible, répartis dans ${formatNumber(diagnostic.sensitivity.datasetsWithPersonalData)} jeu(x) de données.`,
      },
      sensitivityRows.length > 0
        ? {
            kind: "table",
            head: ["Catégorie", "Champs", "Jeux de données"],
            rows: sensitivityRows,
          }
        : {
            kind: "paragraph",
            text: "Aucun champ sensible n’a été repéré par son nom. Ce résultat doit être confronté au métier avant d’être présenté comme une absence de données personnelles.",
          },
    ],
  });

  sections.push({
    id: "cartographie",
    title: "5. Cartographie des flux",
    blocks: [
      {
        kind: "paragraph",
        text: "Trait plein : flux observé par un connecteur ou par le scan local. Trait pointillé : flux déclaré en entretien, non observé.",
      },
      { kind: "code", language: "mermaid", text: toMermaid(graph) },
      ...(graph.notes.length > 0
        ? [{ kind: "list" as const, items: graph.notes }]
        : []),
    ],
  });

  sections.push({
    id: "plan",
    title: "6. Plan de transition",
    blocks: [
      {
        kind: "table",
        head: ["Phase", "Fenêtre", "Actions", "Charge estimée"],
        rows: diagnostic.plan.map((phase) => [
          phase.label,
          phase.window,
          formatNumber(phase.actions.length),
          `${phase.effortDays} j`,
        ]),
      },
      ...diagnostic.plan.flatMap((phase): ReportBlock[] =>
        phase.actions.length === 0
          ? []
          : [
              { kind: "paragraph", text: `**${phase.label} (${phase.window})** — ${phase.objective}` },
              {
                kind: "table",
                head: ["Action", "Porteur", "Charge"],
                rows: phase.actions.map((action) => [
                  action.title,
                  OWNER_LABELS[action.owner],
                  `${action.effortDays} j`,
                ]),
              },
            ],
      ),
    ],
  });

  sections.push({
    id: "limites",
    title: "7. Portée et limites",
    blocks: [
      { kind: "list", items: diagnostic.limits },
      { kind: "paragraph", text: catalogue.privacy },
      ...(catalogue.notes.length > 0
        ? [{ kind: "list" as const, items: catalogue.notes }]
        : []),
    ],
  });

  return {
    version: REPORT_VERSION,
    title: `Diagnostic Preuvance — ${catalogue.mission.client}`,
    subtitle: `Référence ${catalogue.mission.reference} · collecte du ${formatDate(catalogue.mission.startedAt)} · rapport du ${formatDate(catalogue.generatedAt)} · mode ${catalogue.mission.mode === "metadata_only" ? "métadonnées seules" : "métadonnées et fraîcheur"}`,
    headline: {
      value: `${diagnostic.score}/100`,
      label: `niveau ${TIER_LABELS[diagnostic.tier]}`,
      tone: diagnostic.score >= 85 ? "pass" : diagnostic.score >= 65 ? "neutral" : "risk",
    },
    footer: `Rapport produit localement par Preuvance (${REPORT_VERSION}). Aucune donnée n’a été transmise à un tiers pour le générer.`,
    score: diagnostic.score,
    tier: diagnostic.tier,
    sections,
  };
}

export const renderMarkdown = renderDocumentMarkdown;
export const renderHtml = renderDocumentHtml;
export { escapeHtml } from "@/lib/documents/render";

export function renderDiagnosticMarkdown(catalogue: Catalogue, diagnostic: Diagnostic): string {
  return renderMarkdown(buildReportModel(catalogue, diagnostic));
}

export function renderDiagnosticHtml(catalogue: Catalogue, diagnostic: Diagnostic): string {
  return renderHtml(buildReportModel(catalogue, diagnostic));
}
