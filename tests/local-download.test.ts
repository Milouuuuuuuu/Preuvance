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

test("le livrable client n'embarque aucun document interne", () => {
  // `docs/` portait aussi la documentation de travail : dossier de candidature,
  // revue d'audit externe, script de démonstration, hypothèses de valorisation.
  // Une copie en bloc les expédiait chez chaque PME qui téléchargeait l'outil.
  assert.doesNotMatch(packager, /^\s*"docs",\s*$/m);
  assert.match(packager, /\$userDocuments\s*=\s*@\(/);

  const declared = packager
    .split("$userDocuments")[1]
    .split(")")[0]
    .match(/"docs\\[^"]+"/g);
  assert.ok(declared && declared.length > 0, "aucun document utilisateur déclaré");

  const interdits =
    /BEHAVIOR|AGENTS|VALORISATION|BUILD_WEEK|revue-audit|research|change-log|DEMO_SCRIPT|animation-review|machine-gate|chat-control/i;
  for (const entree of declared) {
    assert.doesNotMatch(
      entree,
      interdits,
      `document interne déclaré dans le livrable client : ${entree}`,
    );
  }
  assert.doesNotMatch(packager, /^\s*"(BEHAVIOR|AGENTS)\.md",\s*$/m);
});

test("le LISEZ-MOI ne promet jamais un téléchargement injoignable", () => {
  // Le dépôt du bridge est devenu privé : l'adresse promise renvoyait 404 chez
  // chaque utilisateur, sous un nom de compte nominatif. Les deux états sont
  // acceptés — distribution ouverte, ou fermeture annoncée — mais pas le
  // silence : l'utilisateur doit savoir où il en est.
  const offreUnTelechargement = /sqlite-postgres-bridge\/releases\/latest/.test(
    packager,
  );
  const annonceLaFermeture =
    /distribution publique de cet outil n'est pas ouverte/i.test(packager);

  assert.ok(
    offreUnTelechargement || annonceLaFermeture,
    "le LISEZ-MOI est muet sur la façon d'obtenir l'outil de portabilité",
  );
  assert.match(packager, /--dry-run/);

  const comptesNominatifs = packager.match(/github\.com\/[A-Za-z0-9-]+\//g);
  assert.equal(
    comptesNominatifs,
    null,
    `adresse nominative dans le livrable client : ${comptesNominatifs?.join(", ")}`,
  );
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
