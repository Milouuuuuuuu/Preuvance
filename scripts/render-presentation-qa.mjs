#!/usr/bin/env node

// QA-only copy of the bundled presentation renderer. The direct reallyExit
// avoids a known Windows Chromium teardown crash after every PNG is complete.
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) {
      throw new Error(`Invalid argument near ${key ?? "end of command"}.`);
    }
    args[key.slice(2)] = value;
  }
  return args;
}

function requireArg(args, key) {
  const value = args[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required --${key}.`);
  }
  return value;
}

async function saveBlobToFile(blob, output) {
  await fs.writeFile(output, new Uint8Array(await blob.arrayBuffer()));
}

function slidesFromPresentation(presentation) {
  if (Array.isArray(presentation.slides?.items)) return presentation.slides.items;
  if (Number.isInteger(presentation.slides?.count) && typeof presentation.slides.getItem === "function") {
    return Array.from({ length: presentation.slides.count }, (_, index) => presentation.slides.getItem(index));
  }
  throw new Error("Could not enumerate imported presentation slides.");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = path.resolve(requireArg(args, "input"));
  const outputDir = path.resolve(requireArg(args, "output_dir"));
  const artifactToolEntry = path.resolve(requireArg(args, "artifact_tool"));
  const scale = args.scale ? Number.parseFloat(args.scale) : 1;

  await fs.mkdir(outputDir, { recursive: true });
  const { FileBlob, PresentationFile } = await import(pathToFileURL(artifactToolEntry).href);
  const presentation = await PresentationFile.importPptx(await FileBlob.load(input));
  const slides = slidesFromPresentation(presentation);
  const paths = [];

  for (let index = 0; index < slides.length; index += 1) {
    const output = path.join(outputDir, `slide-${index + 1}.png`);
    const preview = await presentation.export({ slide: slides[index], format: "png", scale });
    await saveBlobToFile(preview, output);
    paths.push(output);
  }

  fsSync.writeSync(1, `${JSON.stringify({ input, outputDir, slideCount: slides.length, paths }, null, 2)}\n`);
  process.reallyExit(0);
}

main().catch((error) => {
  fsSync.writeSync(2, `${error.stack || error.message || String(error)}\n`);
  process.reallyExit(1);
});
