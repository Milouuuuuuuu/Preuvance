import { renderToBuffer } from "@react-pdf/renderer";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { northstarDemoReport } from "../demo/build-week/northstar-demo";
import { createPreuvanceReportDocument } from "../lib/pdf/preuvance-report";
import { preuvanceAssessmentSchema } from "../lib/pdf/assessment-payload";

const outputPath = resolve(
  "public",
  "downloads",
  "preuvance-northstar-demo.pdf",
);
const report = preuvanceAssessmentSchema.parse(northstarDemoReport);
const buffer = await renderToBuffer(createPreuvanceReportDocument(report));

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, buffer);

console.log(`Northstar demo PDF written: ${outputPath} (${buffer.byteLength} bytes)`);
