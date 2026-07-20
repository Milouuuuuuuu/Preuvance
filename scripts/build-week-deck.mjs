import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const WIDTH = 1280;
const HEIGHT = 720;

const C = {
  bg: "#07111F",
  bg2: "#0A1626",
  panel: "#0E2033",
  panel2: "#132A41",
  ink: "#F7FAFC",
  muted: "#AAB6C5",
  quiet: "#708197",
  blue: "#3568FF",
  cyan: "#56DDE2",
  green: "#52E391",
  amber: "#FFC857",
  red: "#FF7474",
  line: "#263A50",
};

const FONT = "Aptos";

function rect(slide, x, y, w, h, fill, options = {}) {
  return slide.shapes.add({
    geometry: options.geometry ?? "rect",
    name: options.name,
    position: { left: x, top: y, width: w, height: h, rotation: options.rotation },
    fill,
    line: options.line ?? { style: "solid", fill: "none", width: 0 },
    borderRadius: options.radius,
    shadow: options.shadow,
  });
}

function line(slide, x, y, w, h, color = C.line, width = 2) {
  return slide.shapes.add({
    geometry: "line",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: color, width },
  });
}

function text(slide, value, x, y, w, h, options = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: options.name,
    position: { left: x, top: y, width: w, height: h },
    fill: options.fill ?? "none",
    line: options.line ?? { style: "solid", fill: "none", width: 0 },
    borderRadius: options.radius,
  });
  shape.text = value;
  shape.text.style = {
    fontSize: options.size ?? 23,
    bold: options.bold ?? false,
    color: options.color ?? C.ink,
    alignment: options.align ?? "left",
    verticalAlignment: options.valign ?? "top",
    autoFit: options.autoFit ?? "shrinkText",
    wrap: "square",
    insets: options.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
    typeface: options.typeface ?? FONT,
    lineSpacing: options.lineSpacing ?? 1,
  };
  return shape;
}

function richText(slide, paragraphs, x, y, w, h, options = {}) {
  const shape = text(slide, "", x, y, w, h, options);
  shape.text.set(paragraphs);
  return shape;
}

function circle(slide, x, y, d, fill, lineColor = "none", lineWidth = 0) {
  return rect(slide, x, y, d, d, fill, {
    geometry: "ellipse",
    line: { style: "solid", fill: lineColor, width: lineWidth },
  });
}

function addWordmark(slide, number) {
  text(slide, "PREUVANCE", 60, 34, 236, 28, {
    size: 20,
    bold: true,
    color: C.ink,
    valign: "middle",
  });
  rect(slide, 181, 45, 20, 3, C.blue);
  rect(slide, 181, 52, 20, 3, C.cyan);
  text(slide, String(number).padStart(2, "0"), 1165, 34, 54, 28, {
    size: 20,
    bold: true,
    color: C.quiet,
    align: "right",
    valign: "middle",
  });
  line(slide, 60, 78, 1160, 0, C.line, 1);
}

function addTitle(slide, titleValue, subtitle) {
  text(slide, titleValue, 60, 104, 1160, subtitle ? 112 : 130, {
    size: 50,
    bold: true,
    color: C.ink,
    lineSpacing: 0.92,
  });
  if (subtitle) {
    text(slide, subtitle, 62, 211, 1070, 38, {
      size: 23,
      color: C.muted,
      valign: "middle",
    });
  }
}

function addNotes(slide, notes) {
  slide.speakerNotes.textFrame.setText(notes);
  slide.speakerNotes.setVisible(true);
}

function slide1(deck) {
  const slide = deck.slides.add();
  slide.background.fill = C.bg;

  rect(slide, 0, 0, 18, HEIGHT, C.blue);
  rect(slide, 18, 0, 6, HEIGHT, C.cyan);
  text(slide, "OPENAI BUILD WEEK · 2026", 76, 56, 380, 28, {
    size: 20,
    bold: true,
    color: C.cyan,
  });
  text(slide, "PREUVANCE", 76, 106, 470, 48, {
    size: 30,
    bold: true,
    color: C.ink,
  });
  rect(slide, 253, 122, 31, 4, C.blue);
  rect(slide, 253, 133, 31, 4, C.cyan);

  richText(
    slide,
    [
      [{ run: "Prompt.", textStyle: { bold: true, color: C.ink } }],
      [{ run: "Scan.", textStyle: { bold: true, color: C.cyan } }],
      [{ run: "Prove.", textStyle: { bold: true, color: C.green } }],
    ],
    76,
    205,
    500,
    270,
    { size: 82, bold: true, lineSpacing: 0.84 },
  );

  text(
    slide,
    "Turn an AI system into a living, source-linked assurance dossier—evidence by evidence.",
    80,
    505,
    500,
    82,
    { size: 27, color: C.muted, lineSpacing: 1.08 },
  );
  text(slide, "Built with GPT-5.6 + Codex", 80, 634, 390, 30, {
    size: 22,
    bold: true,
    color: C.ink,
  });

  // Three offset sheets form one dossier: a single visual composition.
  rect(slide, 745, 127, 390, 450, C.panel2, {
    radius: 24,
    rotation: 5,
    line: { style: "solid", fill: C.blue, width: 2 },
  });
  rect(slide, 716, 140, 390, 450, C.panel, {
    radius: 24,
    rotation: -3,
    line: { style: "solid", fill: C.cyan, width: 2 },
  });
  rect(slide, 742, 113, 420, 474, "#F7FAFC", {
    radius: 24,
    shadow: "shadow-xl",
  });
  rect(slide, 742, 113, 420, 26, C.blue, { radius: 20 });
  text(slide, "AI ASSURANCE DOSSIER", 780, 168, 335, 34, {
    size: 24,
    bold: true,
    color: C.bg,
  });
  line(slide, 780, 222, 330, 0, "#CAD4DF", 2);

  const rows = [
    ["DECLARED", C.blue, "What the team states"],
    ["DETECTED", C.cyan, "What local signals reveal"],
    ["PROVEN", C.green, "What a reviewer validates"],
  ];
  rows.forEach(([label, color, desc], i) => {
    const y = 260 + i * 84;
    circle(slide, 782, y + 1, 21, color);
    text(slide, label, 818, y - 3, 150, 26, {
      size: 21,
      bold: true,
      color: C.bg,
      valign: "middle",
    });
    text(slide, desc, 818, y + 28, 285, 29, {
      size: 20,
      color: "#475569",
      valign: "middle",
    });
  });
  rect(slide, 780, 518, 330, 3, C.green);
  text(slide, "SOURCE-LINKED · HUMAN-REVIEWED", 780, 536, 330, 25, {
    size: 18,
    bold: true,
    color: C.bg,
    align: "center",
  });

  addNotes(slide, [
    "Preuvance turns AI assurance from a questionnaire into an operating workflow.",
    "The promise is simple: describe the system, strengthen it with local signals, then advance every claim with evidence.",
    "The dossier is useful immediately and remains traceable as the system evolves.",
  ]);
}

function slide2(deck) {
  const slide = deck.slides.add();
  slide.background.fill = C.bg;
  addWordmark(slide, 2);
  addTitle(slide, "AI governance still begins\nwith a blank questionnaire");

  text(
    slide,
    "Teams declare how a system works. Reviewers chase the proof. Meanwhile, the code and infrastructure keep changing.",
    62,
    233,
    640,
    88,
    { size: 26, color: C.muted, lineSpacing: 1.08 },
  );

  // Causal flow: arrows are placed before the nodes.
  rect(slide, 257, 387, 120, 24, C.line, { geometry: "rightArrow" });
  rect(slide, 567, 387, 120, 24, C.line, { geometry: "rightArrow" });

  const stages = [
    { x: 70, label: "DECLARE", detail: "Answers without attached proof", color: C.blue },
    { x: 380, label: "REVIEW", detail: "Manual evidence chase", color: C.amber },
    { x: 690, label: "DRIFT", detail: "Reality changes after sign-off", color: C.red },
  ];
  stages.forEach(({ x, label, detail, color }) => {
    circle(slide, x, 349, 104, C.panel, color, 4);
    text(slide, label, x + 7, 380, 90, 30, {
      size: 20,
      bold: true,
      color,
      align: "center",
      valign: "middle",
    });
    text(slide, detail, x - 20, 472, 144, 60, {
      size: 21,
      color: C.muted,
      align: "center",
      lineSpacing: 1.05,
    });
  });

  rect(slide, 930, 254, 252, 308, C.panel2, {
    radius: 28,
    line: { style: "solid", fill: C.red, width: 2 },
  });
  text(slide, "THE GAP", 968, 290, 180, 28, {
    size: 21,
    bold: true,
    color: C.red,
  });
  text(slide, "The questionnaire is static.\nThe system is not.", 968, 344, 185, 126, {
    size: 34,
    bold: true,
    color: C.ink,
    lineSpacing: 0.96,
  });
  text(slide, "Proof stays scattered.", 968, 494, 180, 42, {
    size: 22,
    color: C.muted,
    lineSpacing: 1.05,
  });

  addNotes(slide, [
    "The core problem is not a lack of questionnaires. It is the distance between declarations and operational reality.",
    "Evidence sits in many places and changes at different speeds.",
    "Preuvance closes that gap by making evidence part of the dossier itself.",
  ]);
}

function slide3(deck) {
  const slide = deck.slides.add();
  slide.background.fill = C.bg;
  addWordmark(slide, 3);
  addTitle(slide, "One prompt starts the dossier. Local signals strengthen it.");

  // Flow arrows first, so they remain behind the stages.
  rect(slide, 344, 352, 104, 30, C.blue, { geometry: "rightArrow" });
  rect(slide, 761, 352, 104, 30, C.cyan, { geometry: "rightArrow" });

  rect(slide, 68, 280, 284, 190, C.panel, {
    radius: 26,
    line: { style: "solid", fill: C.blue, width: 2 },
  });
  text(slide, "01  PROMPT", 98, 306, 215, 26, {
    size: 20,
    bold: true,
    color: C.blue,
  });
  text(slide, "“Describe the AI system you need to assess.”", 98, 353, 220, 83, {
    size: 28,
    bold: true,
    color: C.ink,
    lineSpacing: 1.02,
  });

  rect(slide, 452, 240, 310, 270, C.panel2, {
    radius: 28,
    line: { style: "solid", fill: C.cyan, width: 2 },
  });
  text(slide, "02  SCAN", 488, 270, 230, 26, {
    size: 20,
    bold: true,
    color: C.cyan,
  });
  text(slide, "Local manifests\n+ runtime signals", 488, 319, 230, 72, {
    size: 31,
    bold: true,
    color: C.ink,
    lineSpacing: 0.98,
  });
  const manifests = ["package.json", "requirements.txt", "scan digest"];
  manifests.forEach((label, i) => {
    const y = 416 + i * 26;
    circle(slide, 489, y + 5, 9, i === 2 ? C.green : C.cyan);
    text(slide, label, 510, y, 188, 20, {
      size: 18,
      color: C.muted,
      valign: "middle",
    });
  });

  rect(slide, 867, 278, 345, 198, "#F7FAFC", {
    radius: 25,
    shadow: "shadow-lg",
  });
  rect(slide, 867, 278, 345, 19, C.green, { radius: 18 });
  text(slide, "03  PROVE", 903, 319, 262, 28, {
    size: 20,
    bold: true,
    color: "#117A43",
  });
  text(slide, "Instant assurance dossier", 903, 365, 264, 74, {
    size: 32,
    bold: true,
    color: C.bg,
    lineSpacing: 0.98,
  });

  line(slide, 62, 570, 1154, 0, C.line, 1);
  circle(slide, 66, 596, 14, C.green);
  text(slide, "Only bounded, expurgated digests cross the local boundary—and only with consent.", 96, 586, 990, 42, {
    size: 24,
    bold: true,
    color: C.ink,
    valign: "middle",
  });

  addNotes(slide, [
    "The primary experience starts with a natural-language prompt.",
    "Teams can strengthen the dossier with dependency manifests and an optional local runtime scan.",
    "Raw files stay local; Preuvance sends only bounded digests and makes the handoff explicit.",
  ]);
}

function slide4(deck) {
  const slide = deck.slides.add();
  slide.background.fill = C.bg;
  addWordmark(slide, 4);
  addTitle(slide, "The dossier is useful when it appears—\nand stays alive after the review");

  // Large document visual.
  rect(slide, 64, 253, 648, 360, "#F7FAFC", {
    radius: 26,
    shadow: "shadow-xl",
  });
  rect(slide, 64, 253, 648, 22, C.blue, { radius: 20 });
  rect(slide, 106, 297, 148, 34, "#E7EDFF", { radius: 12 });
  text(slide, "LIVE DOSSIER", 118, 303, 124, 22, {
    size: 18,
    bold: true,
    color: "#1D47CE",
    align: "center",
    valign: "middle",
  });
  text(slide, "System identity", 106, 362, 200, 27, { size: 22, bold: true, color: C.bg });
  line(slide, 106, 402, 245, 0, "#CBD5E1", 7);
  line(slide, 106, 425, 195, 0, "#DCE3EA", 7);

  text(slide, "Risk mapping", 388, 362, 200, 27, { size: 22, bold: true, color: C.bg });
  line(slide, 388, 402, 260, 0, "#CBD5E1", 7);
  line(slide, 388, 425, 206, 0, "#DCE3EA", 7);

  line(slide, 106, 475, 540, 0, "#CBD5E1", 1);
  const dossierSections = [
    ["GAPS", C.amber],
    ["DECISIONS", C.blue],
    ["EVIDENCE", C.green],
  ];
  dossierSections.forEach(([label, color], i) => {
    const x = 106 + i * 178;
    circle(slide, x, 515, 18, color);
    text(slide, label, x + 31, 510, 132, 28, {
      size: 19,
      bold: true,
      color: C.bg,
      valign: "middle",
    });
    line(slide, x, 561, 137, 0, "#CBD5E1", 6);
    line(slide, x, 582, 102, 0, "#E2E8F0", 6);
  });

  text(slide, "USEFUL NOW", 790, 274, 360, 29, { size: 21, bold: true, color: C.cyan });
  richText(
    slide,
    [
      { bulletCharacter: "•", marginLeft: 22, indent: -13, runs: ["Prioritized gaps"] },
      { bulletCharacter: "•", marginLeft: 22, indent: -13, runs: ["Decision-ready PDF"] },
      { bulletCharacter: "•", marginLeft: 22, indent: -13, runs: ["Model provenance recorded"] },
    ],
    790,
    320,
    370,
    128,
    { size: 24, color: C.ink, lineSpacing: 1.2 },
  );
  line(slide, 790, 462, 370, 0, C.line, 1);
  text(slide, "LIVING LATER", 790, 490, 360, 29, { size: 21, bold: true, color: C.green });
  richText(
    slide,
    [
      { bulletCharacter: "•", marginLeft: 22, indent: -13, runs: ["Resume the dossier"] },
      { bulletCharacter: "•", marginLeft: 22, indent: -13, runs: ["Update evidence states"] },
      { bulletCharacter: "•", marginLeft: 22, indent: -13, runs: ["Preserve an event history"] },
    ],
    790,
    534,
    370,
    128,
    { size: 24, color: C.ink, lineSpacing: 1.2 },
  );

  addNotes(slide, [
    "The first output is not an empty workspace. It is an instant dossier with identity, mappings, gaps, decisions, and evidence.",
    "The same dossier can be reopened and strengthened after the initial assessment.",
    "PDF export remains useful for governance meetings, while the evidence ledger stays live.",
  ]);
}

function slide5(deck) {
  const slide = deck.slides.add();
  slide.background.fill = C.bg;
  addWordmark(slide, 5);
  addTitle(slide, "Evidence moves only when its proof gets stronger.");

  text(slide, "A visible ladder prevents detected signals from masquerading as verified claims.", 62, 195, 900, 36, {
    size: 24,
    color: C.muted,
  });

  // Evidence ladder: one flat visual rather than a grid of cards.
  const levels = [
    { y: 512, w: 260, label: "MISSING", detail: "Expected proof is absent", color: C.quiet },
    { y: 430, w: 400, label: "DECLARED", detail: "A team statement", color: C.blue },
    { y: 348, w: 540, label: "DETECTED", detail: "A bounded local signal", color: C.cyan },
    { y: 266, w: 680, label: "PROVEN", detail: "Human-reviewed evidence", color: C.green },
  ];
  levels.forEach(({ y, w, label, detail, color }) => {
    rect(slide, 70, y, w, 64, C.panel2, {
      radius: 10,
      line: { style: "solid", fill: color, width: 3 },
    });
    rect(slide, 70, y, 10, 64, color, { radius: 8 });
    text(slide, label, 102, y + 8, 155, 25, {
      size: 21,
      bold: true,
      color,
      valign: "middle",
    });
    text(slide, detail, 265, y + 8, Math.max(180, w - 205), 45, {
      size: 21,
      color: C.ink,
      valign: "middle",
    });
  });

  rect(slide, 816, 264, 374, 298, C.panel, {
    radius: 30,
    line: { style: "solid", fill: C.green, width: 2 },
  });
  text(slide, "PROVEN REQUIRES", 854, 301, 300, 28, {
    size: 20,
    bold: true,
    color: C.green,
  });
  text(slide, "Reviewer\n+ review date\n+ source context", 854, 350, 296, 128, {
    size: 34,
    bold: true,
    color: C.ink,
    lineSpacing: 1.05,
  });
  line(slide, 854, 500, 295, 0, C.line, 1);
  text(slide, "SHA-256 proves integrity—not truth.", 854, 520, 294, 32, {
    size: 20,
    bold: true,
    color: C.amber,
    valign: "middle",
  });

  addNotes(slide, [
    "Preuvance separates documentary coverage from regulatory readiness.",
    "Declared and detected items remain useful, but they do not count as proven.",
    "The strongest state requires human review and a date. A file hash protects integrity; it does not establish truth.",
  ]);
}

function slide6(deck) {
  const slide = deck.slides.add();
  slide.background.fill = C.bg;
  addWordmark(slide, 6);
  addTitle(slide, "GPT-5.6 reasons. Deterministic code keeps the record honest.");

  // Architecture connectors first.
  rect(slide, 278, 337, 84, 28, C.line, { geometry: "rightArrow" });
  rect(slide, 631, 337, 84, 28, C.line, { geometry: "rightArrow" });
  rect(slide, 974, 337, 84, 28, C.line, { geometry: "rightArrow" });

  const nodes = [
    { x: 62, w: 225, label: "PROMPT + DIGESTS", detail: "System description\nBounded local signals", color: C.blue },
    { x: 368, w: 272, label: "GPT-5.6", detail: "Extract · classify · analyze gaps", color: C.cyan },
    { x: 721, w: 262, label: "STRICT SYNTHESIS", detail: "Schemas · invariants\nStable evidence IDs", color: C.amber },
    { x: 1064, w: 154, label: "DOSSIER", detail: "Living record", color: C.green },
  ];
  nodes.forEach(({ x, w, label, detail, color }) => {
    rect(slide, x, 269, w, 178, C.panel, {
      radius: 24,
      line: { style: "solid", fill: color, width: 2 },
    });
    text(slide, label, x + 22, 299, w - 44, 30, {
      size: 20,
      bold: true,
      color,
      align: "center",
      valign: "middle",
    });
    text(slide, detail, x + 22, 351, w - 44, 67, {
      size: 21,
      color: C.ink,
      align: "center",
      valign: "middle",
      lineSpacing: 1.05,
    });
  });

  rect(slide, 62, 496, 1156, 127, C.panel2, {
    radius: 24,
    line: { style: "solid", fill: C.line, width: 1 },
  });
  text(slide, "CODEX", 91, 531, 140, 32, {
    size: 24,
    bold: true,
    color: C.blue,
    valign: "middle",
  });
  text(slide, "Build · test · document", 91, 568, 240, 27, {
    size: 20,
    color: C.muted,
  });
  line(slide, 352, 520, 0, 78, C.line, 1);
  const guards = [
    ["NO AUTO-VERIFICATION", "Models never upgrade evidence."],
    ["ACTUAL MODEL RECORDED", "Every run stays in methodology."],
    ["BOUNDED INPUTS", "Digests—not raw local content."],
  ];
  guards.forEach(([label, desc], i) => {
    const x = 385 + i * 270;
    text(slide, label, x, 525, 238, 24, { size: 18, bold: true, color: i === 0 ? C.green : C.cyan });
    text(slide, desc, x, 558, 236, 48, { size: 22, color: C.muted, lineSpacing: 1.03 });
  });

  addNotes(slide, [
    "GPT-5.6 performs the high-value reasoning stages: extraction, classification, and gap analysis.",
    "Deterministic synthesis enforces schemas, stable identifiers, and evidence invariants.",
    "Codex is used materially to build, test, and document the implementation—not merely as a wrapper.",
  ]);
}

function slide7(deck) {
  const slide = deck.slides.add();
  slide.background.fill = C.bg;
  addWordmark(slide, 7);
  addTitle(slide, "Privacy is an architectural constraint—\nnot a policy footnote");

  rect(slide, 57, 263, 446, 308, C.panel, {
    radius: 28,
    line: { style: "solid", fill: C.cyan, width: 2 },
  });
  text(slide, "LOCAL", 91, 296, 200, 28, { size: 21, bold: true, color: C.cyan });
  text(slide, "Source files stay on device", 91, 344, 360, 42, {
    size: 31,
    bold: true,
    color: C.ink,
  });
  const localItems = ["Manifest content", "Runtime details", "Proof file bytes"];
  localItems.forEach((item, i) => {
    circle(slide, 94, 420 + i * 45, 14, i === 2 ? C.green : C.cyan);
    text(slide, item, 124, 412 + i * 45, 310, 31, {
      size: 22,
      color: C.muted,
      valign: "middle",
    });
  });

  // Boundary and crossing arrow.
  line(slide, 615, 240, 0, 374, C.blue, 3);
  text(slide, "EXPLICIT\nCONSENT", 548, 284, 135, 61, {
    size: 19,
    bold: true,
    color: C.blue,
    align: "center",
    lineSpacing: 0.95,
  });
  rect(slide, 496, 405, 230, 38, C.blue, { geometry: "rightArrow" });
  text(slide, "EXPURGATED DIGEST", 515, 372, 190, 24, {
    size: 18,
    bold: true,
    color: C.ink,
    align: "center",
  });

  rect(slide, 732, 263, 486, 308, C.panel2, {
    radius: 28,
    line: { style: "solid", fill: C.green, width: 2 },
  });
  text(slide, "PERSISTED DOSSIER", 768, 296, 350, 28, { size: 21, bold: true, color: C.green });
  text(slide, "Tenant-isolated metadata", 768, 344, 382, 42, {
    size: 31,
    bold: true,
    color: C.ink,
  });
  const cloudItems = ["Supabase row-level security", "Evidence event history", "SHA-256 metadata only"];
  cloudItems.forEach((item, i) => {
    circle(slide, 771, 420 + i * 45, 14, C.green);
    text(slide, item, 801, 412 + i * 45, 362, 31, {
      size: 22,
      color: C.muted,
      valign: "middle",
    });
  });

  text(slide, "The boundary is visible, inspectable, and enforced in code.", 64, 623, 1150, 38, {
    size: 25,
    bold: true,
    color: C.ink,
    align: "center",
    valign: "middle",
  });

  addNotes(slide, [
    "The dependency loader parses manifests in the browser and sends only recognized dependency metadata.",
    "The optional runtime scan requires explicit consent before a bounded digest is handed to the assessment.",
    "Evidence attachments remain local: Preuvance records metadata and SHA-256, while Supabase RLS isolates the living ledger by tenant.",
  ]);
}

function slide8(deck) {
  const slide = deck.slides.add();
  slide.background.fill = C.bg;
  rect(slide, 0, 0, 18, HEIGHT, C.green);
  rect(slide, 18, 0, 6, HEIGHT, C.cyan);

  text(slide, "PREUVANCE", 76, 54, 320, 39, { size: 27, bold: true, color: C.ink });
  rect(slide, 253, 69, 31, 4, C.blue);
  rect(slide, 253, 80, 31, 4, C.cyan);
  text(slide, "OPENAI BUILD WEEK · WORK & PRODUCTIVITY", 76, 111, 650, 29, {
    size: 19,
    bold: true,
    color: C.cyan,
  });

  text(slide, "Build AI assurance\nas a practice,\nnot a PDF.", 76, 195, 670, 255, {
    size: 67,
    bold: true,
    color: C.ink,
    lineSpacing: 0.86,
  });
  text(
    slide,
    "Preuvance makes governance operable at build speed—without blurring the line between a declaration, a signal, and proof.",
    80,
    490,
    650,
    92,
    { size: 27, color: C.muted, lineSpacing: 1.06 },
  );
  text(slide, "Instant AI Assurance, Evidence by Evidence", 80, 630, 590, 30, {
    size: 22,
    bold: true,
    color: C.green,
  });

  line(slide, 820, 164, 0, 410, C.line, 1);
  const verbs = [
    ["PROMPT", "Start with intent", C.blue],
    ["SCAN", "Strengthen with local signals", C.cyan],
    ["PROVE", "Advance evidence with review", C.green],
  ];
  verbs.forEach(([verb, detail, color], i) => {
    const y = 190 + i * 130;
    circle(slide, 794, y + 8, 54, C.bg, color, 4);
    text(slide, String(i + 1), 804, y + 18, 34, 30, {
      size: 21,
      bold: true,
      color,
      align: "center",
      valign: "middle",
    });
    text(slide, verb, 879, y, 260, 35, { size: 29, bold: true, color });
    text(slide, detail, 879, y + 45, 295, 35, { size: 21, color: C.muted });
  });
  rect(slide, 873, 594, 309, 2, C.green);
  text(slide, "BUILT WITH GPT-5.6 + CODEX", 873, 615, 310, 27, {
    size: 20,
    bold: true,
    color: C.ink,
    align: "center",
  });

  addNotes(slide, [
    "Preuvance gives teams a practical loop: prompt, scan, and prove.",
    "Its key design choice is to preserve epistemic honesty—declared, detected, and proven remain distinct.",
    "We are applying to the Work & Productivity track because Preuvance turns assurance into a repeatable part of how AI systems are built and reviewed.",
  ]);
}

async function writeBlob(targetPath, blob) {
  await fs.writeFile(targetPath, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  const outputPath = process.env.PREUVANCE_DECK_OUT;
  const qaDir = process.env.PREUVANCE_DECK_QA;
  if (!outputPath || !qaDir) {
    throw new Error("PREUVANCE_DECK_OUT and PREUVANCE_DECK_QA are required.");
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.mkdir(qaDir, { recursive: true });

  const deck = Presentation.create({ slideSize: { width: WIDTH, height: HEIGHT } });
  slide1(deck);
  slide2(deck);
  slide3(deck);
  slide4(deck);
  slide5(deck);
  slide6(deck);
  slide7(deck);
  slide8(deck);

  for (const [index, slide] of deck.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    const png = await deck.export({ slide, format: "png", scale: 1 });
    await writeBlob(path.join(qaDir, `${stem}.png`), png);
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(path.join(qaDir, `${stem}.layout.json`), await layout.text());
  }

  const montage = await deck.export({ format: "webp", montage: true, scale: 1 });
  await writeBlob(path.join(qaDir, "deck-montage.webp"), montage);
  await fs.writeFile(
    path.join(qaDir, "source-notes.txt"),
    [
      "Product claims are derived from the local Preuvance implementation.",
      "No external imagery or quantitative outcome claims are used.",
      "Veo assets were intentionally excluded because the requested deck must be watermark-free.",
      "Visible copy is in English for OpenAI Build Week judges.",
    ].join("\n"),
  );

  const pptx = await PresentationFile.exportPptx(deck);
  await pptx.save(outputPath);
  console.log(`Wrote ${outputPath}`);
  console.log(`Rendered QA assets to ${qaDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
