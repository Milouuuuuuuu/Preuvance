import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import path from "node:path";

import { AI_PROVIDER_HOSTS } from "../lib/scan/scan-contract";

const execFileAsync = promisify(execFile);
const scriptPath = path.join(process.cwd(), "scripts", "preuvance-scan.ps1");

function parsePowerShellCatalog(): Array<{
  provider: string;
  label: string;
  pattern: string;
}> {
  const source = readFileSync(scriptPath, "utf8");
  const entryPattern =
    /@\{ Provider = "([^"]+)";\s*Label = "([^"]+)";\s*Pattern = '([^']+)' \}/g;
  const entries: Array<{ provider: string; label: string; pattern: string }> = [];
  for (const match of source.matchAll(entryPattern)) {
    entries.push({ provider: match[1], label: match[2], pattern: match[3] });
  }
  return entries;
}

test("le catalogue de fournisseurs du script PowerShell est aligné sur le contrat TypeScript", () => {
  const psCatalog = parsePowerShellCatalog();
  assert.equal(
    psCatalog.length,
    AI_PROVIDER_HOSTS.length,
    "les deux catalogues doivent avoir le même nombre d’entrées",
  );

  for (const [index, tsEntry] of AI_PROVIDER_HOSTS.entries()) {
    const psEntry = psCatalog[index];
    assert.equal(
      psEntry.provider,
      tsEntry.provider,
      `identifiant divergent à l’index ${index}`,
    );
    assert.equal(
      psEntry.label,
      tsEntry.label,
      `label divergent pour « ${tsEntry.provider} »`,
    );
    assert.equal(
      psEntry.pattern,
      tsEntry.match.source,
      `motif de détection divergent pour « ${tsEntry.provider} »`,
    );
  }
});

test("les autotests du script PowerShell passent (-SelfTest)", async (t) => {
  const shell = process.platform === "win32" ? "powershell.exe" : "pwsh";
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      shell,
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-SelfTest"],
      { timeout: 60_000 },
    ));
  } catch (error) {
    const spawnError = error as NodeJS.ErrnoException & { stdout?: string };
    if (spawnError.code === "ENOENT") {
      t.skip(`interpréteur PowerShell « ${shell} » indisponible sur cette machine`);
      return;
    }
    assert.fail(
      `AUTOTEST en échec : ${spawnError.stdout ?? spawnError.message ?? "erreur inconnue"}`,
    );
  }
  assert.match(stdout, /AUTOTEST OK \(\d+ assertions\)/);
});
