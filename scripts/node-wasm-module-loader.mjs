import { readFile } from "node:fs/promises";

/**
 * Vinext's Cloudflare build imports precompiled WebAssembly modules directly.
 * Workerd understands that import, while Node's production preview otherwise
 * tries to instantiate the binary as a native ESM WebAssembly module and
 * resolves its internal import names as npm packages.
 *
 * Keep the compatibility layer local to `npm start`: turn only emitted `.wasm`
 * files into JavaScript modules exporting a compiled WebAssembly.Module. The
 * deployed Worker artifact is not rewritten and still receives the static
 * precompiled module required by Workerd.
 */
export async function load(url, context, nextLoad) {
  if (!url.endsWith(".wasm")) {
    return nextLoad(url, context);
  }

  const bytes = await readFile(new URL(url));
  const base64 = Buffer.from(bytes).toString("base64");

  return {
    format: "module",
    shortCircuit: true,
    source: `export default new WebAssembly.Module(Buffer.from(${JSON.stringify(
      base64,
    )}, "base64"));`,
  };
}
