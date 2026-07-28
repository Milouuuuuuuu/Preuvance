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
  assert.match(packager, /sqlite-postgres-bridge\/releases\/latest/);
  assert.match(packager, /--dry-run/);
  assert.doesNotMatch(packager, /Copy-Item[^\r\n]+\$projectRoot[^\r\n]+-Recurse/i);
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
