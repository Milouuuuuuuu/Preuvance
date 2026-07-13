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
  assert.doesNotMatch(packager, /Copy-Item[^\r\n]+\$projectRoot[^\r\n]+-Recurse/i);
});

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
