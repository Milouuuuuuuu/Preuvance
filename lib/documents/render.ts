/**
 * Moteur de rendu de documents Preuvance.
 *
 * Un document est décrit une seule fois sous forme de blocs typés, puis rendu
 * en Markdown (repris dans un traitement de texte, un courriel, un dépôt) ou
 * en HTML autonome (imprimable en PDF depuis le navigateur, sans script ni
 * ressource distante).
 *
 * Conséquence voulue : la version envoyée au client et la version technique ne
 * peuvent pas diverger, puisqu'elles sortent du même modèle. Le rapport de
 * diagnostic et les documents administratifs de mission partagent ce moteur.
 */
export const DOCUMENT_RENDER_VERSION = "preuvance-document-render-v1";

export type DocumentBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "code"; language: string; text: string }
  | { kind: "callout"; tone: "info" | "risk"; title: string; text: string };

export type DocumentSection = { id: string; title: string; blocks: DocumentBlock[] };

export type DocumentModel = {
  version: string;
  title: string;
  subtitle: string;
  /** Bandeau chiffré facultatif (score, montant total…). */
  headline?: { value: string; label: string; tone?: "neutral" | "pass" | "risk" };
  sections: DocumentSection[];
  /** Pied de page du rendu HTML. */
  footer?: string;
};

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function renderDocumentMarkdown(model: DocumentModel): string {
  const lines: string[] = [`# ${model.title}`, "", `_${model.subtitle}_`, ""];

  if (model.headline) {
    lines.push(`**${model.headline.value} — ${model.headline.label}**`, "");
  }

  for (const section of model.sections) {
    lines.push(`## ${section.title}`, "");
    for (const block of section.blocks) {
      if (block.kind === "paragraph") {
        lines.push(block.text, "");
      } else if (block.kind === "list") {
        for (const item of block.items) lines.push(`- ${item}`);
        lines.push("");
      } else if (block.kind === "table") {
        lines.push(`| ${block.head.join(" | ")} |`);
        lines.push(`| ${block.head.map(() => "---").join(" | ")} |`);
        for (const row of block.rows) {
          lines.push(`| ${row.map(escapeMarkdownCell).join(" | ")} |`);
        }
        lines.push("");
      } else if (block.kind === "code") {
        lines.push("```" + block.language, block.text, "```", "");
      } else {
        lines.push(`> **${block.title}**`, `>`, `> ${block.text}`, "");
      }
    }
  }

  return lines.join("\n");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Met en gras les segments `**...**` d'un texte déjà échappé. */
function inlineHtml(value: string): string {
  return escapeHtml(value).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

const DOCUMENT_STYLE = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; padding: 2.5rem 2rem 4rem; font-family: "Segoe UI", system-ui, -apple-system, sans-serif; color: #16202c; background: #fff; line-height: 1.55; }
main { max-width: 60rem; margin: 0 auto; }
h1 { font-size: 1.9rem; margin: 0 0 .35rem; }
h2 { font-size: 1.25rem; margin: 2.4rem 0 .8rem; border-bottom: 1px solid #d7dee8; padding-bottom: .35rem; }
p.subtitle { color: #4a5768; margin: 0 0 1.5rem; }
.headline { display: inline-flex; align-items: baseline; gap: .5rem; padding: .6rem 1rem; border-radius: .6rem; background: #eef3fb; border: 1px solid #c9d8f0; font-weight: 600; }
.headline strong { font-size: 1.8rem; }
.headline.risk { background: #fdeeee; border-color: #efb4b4; }
.headline.pass { background: #eaf7ee; border-color: #b7e0c4; }
table { width: 100%; border-collapse: collapse; margin: .6rem 0 1.2rem; font-size: .93rem; }
th, td { text-align: left; padding: .45rem .6rem; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
th { background: #f5f8fc; font-weight: 600; }
ul { margin: .4rem 0 1.2rem 1.1rem; padding: 0; }
li { margin-bottom: .35rem; }
pre { background: #f6f8fb; border: 1px solid #dde5ef; border-radius: .5rem; padding: .9rem; overflow-x: auto; font-size: .82rem; }
.callout { border-left: 4px solid #1a4fa0; background: #eef3fb; padding: .8rem 1rem; border-radius: 0 .5rem .5rem 0; margin: .6rem 0 1.2rem; }
.callout.risk { border-left-color: #c53030; background: #fdeeee; }
.callout h3 { margin: 0 0 .3rem; font-size: 1rem; }
footer { margin-top: 3rem; font-size: .82rem; color: #55637a; border-top: 1px solid #d7dee8; padding-top: .8rem; }
@media print { body { padding: 0; } h2 { break-after: avoid; } table, pre, .callout { break-inside: avoid; } }
`;

/**
 * Page HTML autonome : aucune ressource externe, aucun script, aucun appel
 * réseau. Elle s'ouvre depuis le poste et s'imprime en PDF.
 */
export function renderDocumentHtml(model: DocumentModel): string {
  const body: string[] = [
    `<h1>${escapeHtml(model.title)}</h1>`,
    `<p class="subtitle">${escapeHtml(model.subtitle)}</p>`,
  ];

  if (model.headline) {
    const tone = model.headline.tone && model.headline.tone !== "neutral" ? ` ${model.headline.tone}` : "";
    body.push(
      `<p class="headline${tone}"><strong>${escapeHtml(model.headline.value)}</strong><span>${escapeHtml(model.headline.label)}</span></p>`,
    );
  }

  for (const section of model.sections) {
    body.push(`<section id="${escapeHtml(section.id)}">`);
    body.push(`<h2>${escapeHtml(section.title)}</h2>`);
    for (const block of section.blocks) {
      if (block.kind === "paragraph") {
        body.push(`<p>${inlineHtml(block.text)}</p>`);
      } else if (block.kind === "list") {
        body.push(`<ul>${block.items.map((item) => `<li>${inlineHtml(item)}</li>`).join("")}</ul>`);
      } else if (block.kind === "table") {
        const head = block.head.map((cell) => `<th scope="col">${escapeHtml(cell)}</th>`).join("");
        const rows = block.rows
          .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
          .join("");
        body.push(`<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`);
      } else if (block.kind === "code") {
        body.push(
          `<pre><code data-language="${escapeHtml(block.language)}">${escapeHtml(block.text)}</code></pre>`,
        );
      } else {
        body.push(
          `<div class="callout ${block.tone === "risk" ? "risk" : ""}"><h3>${escapeHtml(block.title)}</h3><p>${inlineHtml(block.text)}</p></div>`,
        );
      }
    }
    body.push("</section>");
  }

  const footer =
    model.footer ??
    `Document produit localement par Preuvance (${model.version}). Aucune donnée n’a été transmise à un tiers pour le générer.`;

  return [
    "<!doctype html>",
    '<html lang="fr">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<meta name="robots" content="noindex, nofollow" />',
    `<title>${escapeHtml(model.title)}</title>`,
    `<style>${DOCUMENT_STYLE}</style>`,
    "</head>",
    "<body><main>",
    ...body,
    `<footer>${escapeHtml(footer)}</footer>`,
    "</main></body>",
    "</html>",
  ].join("\n");
}
