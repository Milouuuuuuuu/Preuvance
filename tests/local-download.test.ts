import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

const launcher = readFileSync(
  new URL("../scripts/launch-preuvance-local.ps1", import.meta.url),
  "utf8",
);
const packager = readFileSync(
  new URL("../scripts/build-local-download.ps1", import.meta.url),
  "utf8",
);

test("le lanceur one-shot reste local, non élevé et vérifie le build", () => {
  assert.match(launcher, /22\.13\.0/);
  assert.match(launcher, /npm ci a echoue/);
  assert.match(launcher, /@\("run", "build"\)/);
  assert.match(launcher, /--hostname", "127\.0\.0\.1"/);
  assert.match(launcher, /Read-Host .* -AsSecureString/);
  assert.doesNotMatch(
    launcher,
    /Start-Process\s+[^\r\n]*(?:-Verb\s+RunAs|runas\.exe)/i,
  );
});

test("le packager utilise une allowlist et exclut les secrets et caches", () => {
  assert.match(packager, /\$directories\s*=\s*@\(/);
  assert.match(packager, /\$files\s*=\s*@\(/);
  assert.match(packager, /outputs\\local-download-staging/);
  assert.match(packager, /public\\downloads/);
  assert.match(packager, /\^\\\.env/);
  assert.match(packager, /--dry-run/);
  // Le LISEZ-MOI remis au client ne doit porter aucune adresse nominative :
  // le dépôt de l'outil de portabilité est privé, donc le lien serait mort, et
  // il exposerait le compte de l'auteur à chaque PME.
  assert.doesNotMatch(packager, /github\.com\/[A-Za-z0-9-]+\//);
  assert.doesNotMatch(packager, /Copy-Item[^\r\n]+\$projectRoot[^\r\n]+-Recurse/i);
});

/**
 * L'archive est remise à chaque PME qui télécharge l'outil. Copier `docs/` en
 * bloc revenait à livrer le runbook de mission, le pack d'accès, le dossier de
 * candidature et la recherche d'antériorité à chaque prospect — concurrents
 * compris. Ce test échoue si quelqu'un remet la copie en bloc.
 */
test("le livrable client n'embarque ni documentation interne ni conventions d'agents", () => {
  assert.doesNotMatch(packager, /^\s*"docs",\s*$/m);
  assert.match(packager, /\$docFiles\s*=\s*@\(/);
  assert.match(packager, /Archive annulee : document interne dans le livrable client/);
  assert.doesNotMatch(packager, /"AGENTS\.md"/);

  // Une liste explicite ne protège que si elle reste courte et justifiable :
  // chaque entrée ajoutée ici est une décision de divulgation.
  const bloc = packager.slice(packager.indexOf("$docFiles"), packager.indexOf("$files"));
  const inclus = [...bloc.matchAll(/"docs\\([A-Za-z0-9._-]+\.md)"/g)].map((m) => m[1]);
  assert.ok(inclus.length > 0, "aucun document client déclaré");

  const interdits = [
    "BUILD_WEEK_SUBMISSION_COPY.md",
    "OPENAI_BUILD_WEEK_2026.md",
    "build-week-change-log.md",
    "DEMO_SCRIPT_BUILD_WEEK.md",
    "operateur-diagnostic.md",
    "pack-acces.md",
    "admin-mission.md",
    "preuvance-v2-diagnostic.md",
    "research.md",
    "revue-audit-externe.md",
  ];
  for (const nom of interdits) {
    assert.ok(!inclus.includes(nom), `document interne exposé au client : ${nom}`);
  }
});

test("le packager produit aussi une archive de scan autonome", () => {
  assert.match(packager, /preuvance-scan\.zip/);
  assert.match(packager, /Copy-AllowlistedFile "SCANNER_PREUVANCE\.cmd" -TargetRoot \$stagingScanner/);
  assert.match(
    packager,
    /Copy-AllowlistedFile "scripts\\preuvance-scan\.ps1" -TargetRoot \$stagingScanner/,
  );
  // L'argument de vente est l'absence de prérequis : si le LISEZ-MOI du scan
  // se met à réclamer Node.js ou une clé API, la promesse de la page d'accueil
  // devient fausse.
  const scannerReadme = packager.slice(packager.indexOf("$scannerReadme"));
  assert.doesNotMatch(scannerReadme, /Node\.js/);
  assert.doesNotMatch(scannerReadme, /cle API OpenAI/i);
});

/**
 * Le scan est le premier téléchargement mis en avant : il ne doit contenir que
 * le scan. Si l'allowlist dérive vers l'application complète, l'archive gonfle
 * et le « double-clic sans rien installer » cesse d'être vrai.
 */
const scannerArchiveUrl = new URL(
  "../public/downloads/preuvance-scan.zip",
  import.meta.url,
);

test(
  "l'archive de scan est un ZIP matériel et reste légère",
  {
    skip:
      !existsSync(scannerArchiveUrl) &&
      "archive non embarquée dans son propre contenu",
  },
  () => {
    const archive = readFileSync(scannerArchiveUrl);
    const size = statSync(scannerArchiveUrl).size;

    assert.equal(archive.subarray(0, 2).toString("ascii"), "PK");
    assert.ok(size > 2_000, `archive suspecte : ${size} octets`);
    assert.ok(size < 200_000, `archive trop lourde : ${size} octets`);
  },
);

const archiveUrl = new URL(
  "../public/downloads/preuvance-local.zip",
  import.meta.url,
);

test(
  "le téléchargement direct est un ZIP matériel et non un lien vide",
  { skip: !existsSync(archiveUrl) && "archive non embarquée dans son propre contenu" },
  () => {
    const archive = readFileSync(archiveUrl);

    assert.ok(statSync(archiveUrl).size > 100_000);
    assert.equal(archive.subarray(0, 2).toString("ascii"), "PK");
  },
);
