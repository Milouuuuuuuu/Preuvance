#!/usr/bin/env node
/**
 * Vérification du poste de travail Preuvance.
 *
 * Objectif : qu'un membre de l'équipe sache en une commande si son poste est
 * prêt. Il passe en revue les versions, les dépendances, les clés présentes
 * (jamais leurs valeurs) et les pièges connus de la machine (Docker vs tests
 * Workerd, OneDrive).
 *
 * Le script est en lecture seule : il n'installe rien, ne modifie rien,
 * n'affiche jamais la valeur d'une variable d'environnement.
 *
 *   npm run poste:verifier
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

export const NODE_MIN = { major: 22, minor: 13 };

/** Clés attendues, groupées comme la console /ops. Présence seulement. */
export const EXPECTED_KEYS = [
  { name: "OPENAI_API_KEY", module: "analyse IA (sans elle : démo seulement)" },
  { name: "NEXT_PUBLIC_SUPABASE_URL", module: "persistance Supabase" },
  { name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", module: "persistance Supabase" },
  { name: "NEXT_PUBLIC_POSTHOG_KEY", module: "mesure produit (no-op sans elle)" },
  { name: "POSTHOG_PERSONAL_API_KEY", module: "tableaux de bord PostHog" },
  { name: "PREUVANCE_OPS", module: "console interne /ops" },
];

/**
 * Extrait les NOMS de variables d'un contenu dotenv, jamais les valeurs.
 * Ignore commentaires, lignes vides, lignes sans « = » et valeurs vides :
 * `OPENAI_API_KEY=` sans valeur est traité comme absent, exactement comme le
 * fera le module qui la lit. Seule la longueur de la valeur est consultée.
 */
export function parseEnvNames(content) {
  const names = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const name = line.slice(0, eq).trim().replace(/^export\s+/, "");
    if (line.slice(eq + 1).trim() === "") continue;
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

export function checkNodeVersion(versionString) {
  const [major = 0, minor = 0] = versionString.split(".").map(Number);
  return major > NODE_MIN.major || (major === NODE_MIN.major && minor >= NODE_MIN.minor);
}

function isDockerDesktopRunning() {
  if (process.platform !== "win32") return false;
  const result = spawnSync("tasklist", ["/FI", "IMAGENAME eq Docker Desktop.exe", "/FO", "CSV"], {
    encoding: "utf8",
  });
  return typeof result.stdout === "string" && result.stdout.includes("Docker Desktop.exe");
}

function main() {
  const root = process.cwd();
  const lines = [];
  let blocking = 0;
  const ok = (text) => lines.push(`  [ok]    ${text}`);
  const warn = (text) => lines.push(`  [note]  ${text}`);
  const fail = (text) => {
    blocking += 1;
    lines.push(`  [ÉCHEC] ${text}`);
  };

  const nodeVersion = process.versions.node;
  if (checkNodeVersion(nodeVersion)) {
    ok(`Node ${nodeVersion} (minimum ${NODE_MIN.major}.${NODE_MIN.minor})`);
  } else {
    fail(`Node ${nodeVersion} alors que le projet exige >= ${NODE_MIN.major}.${NODE_MIN.minor} (cf. package.json engines)`);
  }

  if (existsSync(join(root, "node_modules"))) {
    ok("dépendances installées (node_modules présent)");
  } else {
    fail("node_modules absent : lancer « npm ci »");
  }

  const envPath = join(root, ".env.local");
  if (existsSync(envPath)) {
    const present = parseEnvNames(readFileSync(envPath, "utf8"));
    ok(`.env.local présent (${present.length} variable(s) définie(s))`);
    for (const key of EXPECTED_KEYS) {
      if (present.includes(key.name)) {
        ok(`${key.name} : ${key.module}`);
      } else {
        warn(`${key.name} absente : ${key.module}`);
      }
    }
  } else {
    warn(".env.local absent ; copier .env.example et remplir selon le rôle du poste");
  }

  if (isDockerDesktopRunning()) {
    warn(
      "Docker Desktop tourne : les tests Workerd de « npm test » peuvent échouer en « Network connection lost » sur ce poste. L'arrêter avant la chaîne complète (il ne sert qu'à supabase-local-verify).",
    );
  } else {
    ok("Docker Desktop arrêté (requis seulement pour la vérification Supabase locale)");
  }

  if (root.includes("OneDrive")) {
    warn(
      "dépôt sous OneDrive : après « npm run build », attendre ~25 s avant les tests HTTP, et vérifier le zip après build-local-download.ps1.",
    );
  }

  console.log("Vérification du poste Preuvance\n");
  console.log(lines.join("\n"));
  console.log(
    `\n${blocking === 0 ? "Poste prêt." : `${blocking} point(s) bloquant(s) à corriger.`} Aucune valeur de clé n'a été lue ni affichée.`,
  );
  process.exitCode = blocking === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
