import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const projectDirectory = fileURLToPath(new URL("../", import.meta.url));
const vinextCli = fileURLToPath(
  new URL("../node_modules/vinext/dist/cli.js", import.meta.url),
);
const wasmLoader = fileURLToPath(
  new URL("../scripts/node-wasm-module-loader.mjs", import.meta.url),
);
const port = 35_000 + (process.pid % 1_000);
const baseUrl = `http://127.0.0.1:${port}`;
let server;
let serverLogs = "";

test.before(async () => {
  server = spawn(
    process.execPath,
    [
      "--no-warnings=ExperimentalWarning",
      "--experimental-loader",
      pathToFileURL(wasmLoader).href,
      vinextCli,
      "start",
      "--port",
      String(port),
      "--hostname",
      "127.0.0.1",
    ],
    {
      cwd: projectDirectory,
      env: {
        ...process.env,
        PORT: String(port),
        OPENAI_API_KEY: "",
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  server.stdout.on("data", (chunk) => {
    serverLogs += String(chunk);
  });
  server.stderr.on("data", (chunk) => {
    serverLogs += String(chunk);
  });

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Le serveur de production s’est arrêté.\n${serverLogs}`);
    }
    try {
      const response = await fetch(baseUrl, {
        signal: AbortSignal.timeout(5_000),
      });
      if (response.status > 0) return;
    } catch {
      // Le serveur démarre encore.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Le serveur de production n’a pas démarré.\n${serverLogs}`);
});

test.after(async () => {
  if (!server || server.exitCode !== null) return;
  server.kill();
  await Promise.race([
    once(server, "exit"),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
});

test("démarre le build de production et rend la page d’accueil", async () => {
  const response = await fetch(baseUrl, { headers: { accept: "text/html" } });
  const html = await response.text();

  assert.equal(response.status, 200, serverLogs);
  assert.match(html, /<title>Preuvance/i);
  assert.match(html, /Parcours principal · dossier instantané/i);
});

test("compile le module Yoga émis pour le build de production", async () => {
  const assetsDirectory = path.join(projectDirectory, "dist", "server", "assets");
  const yogaAssetName = readdirSync(assetsDirectory).find(
    (name) => /^yoga-.*\.wasm$/i.test(name),
  );
  assert.ok(yogaAssetName, "Le build doit émettre le module Yoga WASM.");

  const yogaAssetUrl = pathToFileURL(
    path.join(assetsDirectory, yogaAssetName),
  ).href;
  const verification = spawn(
    process.execPath,
    [
      "--no-warnings=ExperimentalWarning",
      "--experimental-loader",
      pathToFileURL(wasmLoader).href,
      "--input-type=module",
      "--eval",
      `const loaded = await import(${JSON.stringify(yogaAssetUrl)}); if (!(loaded.default instanceof WebAssembly.Module)) process.exit(2);`,
    ],
    { cwd: projectDirectory, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  let verificationLogs = "";
  verification.stdout.on("data", (chunk) => {
    verificationLogs += String(chunk);
  });
  verification.stderr.on("data", (chunk) => {
    verificationLogs += String(chunk);
  });
  const [exitCode] = await once(verification, "exit");

  assert.equal(exitCode, 0, verificationLogs);
});
