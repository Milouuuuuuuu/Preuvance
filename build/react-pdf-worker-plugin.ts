import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const clientReactEntry = fileURLToPath(
  new URL("../node_modules/react/index.js", import.meta.url),
);

export function reactPdfWorkerCompat(): Plugin {
  return {
    name: "preuvance:react-pdf-worker-compat",
    enforce: "pre",
    resolveId(source, importer) {
      if (source !== "react" || !importer) return null;

      const normalizedImporter = importer.replaceAll("\\", "/");
      if (!normalizedImporter.includes("/node_modules/@react-pdf/reconciler/")) {
        return null;
      }

      // A custom renderer needs the client dispatcher, even when invoked by a
      // server route. Limiting the override to react-pdf keeps RSC on React's
      // normal `react-server` export.
      return clientReactEntry;
    },
  };
}
