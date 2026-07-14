import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectDirectory = fileURLToPath(new URL("../", import.meta.url));
const vinextCli = fileURLToPath(
  new URL("../node_modules/vinext/dist/cli.js", import.meta.url),
);
const port = 34_000 + (process.pid % 1_000);
const baseUrl = `http://127.0.0.1:${port}`;
let preview;
let previewLogs = "";

test.before(async () => {
  preview = spawn(
    process.execPath,
    [vinextCli, "dev", "--port", String(port), "--hostname", "127.0.0.1"],
    {
      cwd: projectDirectory,
      env: {
        ...process.env,
        PORT: String(port),
        NODE_OPTIONS: [process.env.NODE_OPTIONS, "--use-system-ca"]
          .filter(Boolean)
          .join(" "),
        OPENAI_API_KEY: "",
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  preview.stdout.on("data", (chunk) => {
    previewLogs += String(chunk);
  });
  preview.stderr.on("data", (chunk) => {
    previewLogs += String(chunk);
  });

  // Démarrage à froid mesuré entre 25 s et plus de 60 s selon la charge du
  // poste (synchronisation OneDrive, antivirus) : le délai doit rester large.
  const startupTimeoutMs =
    Number(process.env.PREUVANCE_TEST_STARTUP_TIMEOUT_MS) || 180_000;
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    if (preview.exitCode !== null) {
      throw new Error(`Le serveur de test s’est arrêté.\n${previewLogs}`);
    }
    try {
      const response = await fetch(baseUrl, {
        signal: AbortSignal.timeout(15_000),
      });
      if (response.status > 0) return;
    } catch {
      // Le serveur démarre encore.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Le serveur de test n’a pas démarré.\n${previewLogs}`);
});

test.after(async () => {
  if (!preview || preview.exitCode !== null) return;
  preview.kill();
  await Promise.race([
    once(preview, "exit"),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
});

test("rend la page Preuvance en français sans vestige du starter", async () => {
  const response = await fetch(baseUrl, { headers: { accept: "text/html" } });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(
    response.headers.get("content-security-policy") ?? "",
    /frame-ancestors 'none'/,
  );

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="fr"/i);
  assert.match(html, /<title>Preuvance/i);
  assert.match(html, /Maîtrisez votre risque IA/i);
  assert.match(html, /Référentiel EU AI Act vérifié le 13 juillet 2026/i);
  assert.match(html, /Description libre/i);
  assert.match(html, /Espace/i);
  assert.match(html, /class="pv-brand-e"/i);
  assert.match(html, /src="\/og\.png"/i);
  assert.match(html, /loading="lazy"/i);
  assert.match(html, /class="pv-mobile-auth-action"[^>]*href="\/auth\/sign-in"/i);
  assert.match(html, /href="\/downloads\/preuvance-local\.zip"/i);
  assert.match(html, /id="confidentialite"/i);
  assert.match(html, /Marquage machine · 50\(2\)/i);
  assert.match(html, /Contenu synthétique · 50\(4\)/i);
  assert.doesNotMatch(html, /Codex is working|Your site is taking shape|SkeletonPreview/i);
});

test("rend l’indisponibilité de l’authentification actionnable", async () => {
  const response = await fetch(
    `${baseUrl}/auth/sign-in?error=configuration&next=%2F%23evaluation`,
    { headers: { accept: "text/html" } },
  );

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /variables Supabase ne sont pas configurées/i);
  assert.match(html, /href="\/#evaluation"[^>]*>Revenir à l’évaluation</i);
});

test("génère un vrai PDF dans le runtime Worker", async () => {
  const response = await fetch(
    `${baseUrl}/api/reports/pdf`,
    {
      method: "POST",
      headers: {
        accept: "application/pdf",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        localPayload: {
          assessmentId: "assessment_01",
          generatedAt: "2026-07-13T14:30:00.000Z",
          lastRegulatoryVerification: "2026-07-13",
          organization: {
            name: "Atelier Horizon",
            employeeCount: 40,
            annualRevenueEur: 8_000_000,
            balanceSheetTotalEur: 5_000_000,
            smcEligible: false,
          },
          system: {
            name: "Assistant clients",
            description:
              "Un assistant répond aux questions des clients à partir de la documentation validée.",
            intendedUse: "Répondre aux questions fréquentes des clients.",
          },
          result: {
            score: 59,
            tier: "C",
            riskLevel: "undetermined",
            confidence: 0.42,
            executiveSummary:
              "La qualification reste à confirmer faute d’informations suffisantes.",
          },
          classification: {
            rationale: "Les faits disponibles ne permettent pas encore de trancher.",
            articles: [
              {
                reference: "Article 4",
                finding: "L’obligation de maîtrise de l’IA reste applicable.",
              },
            ],
          },
          dimensions: [
            {
              name: "Gouvernance",
              score: 59,
              finding: "Les preuves déclarées restent à vérifier.",
            },
          ],
          gaps: [],
        },
      }),
    },
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/pdf\b/i);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.ok(bytes.byteLength > 5_000);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
});

test("refuse l’ancien payload PDF directement fourni par le client", async () => {
  const response = await fetch(`${baseUrl}/api/reports/pdf`, {
    method: "POST",
    headers: {
      accept: "application/problem+json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      assessmentId: "assessment_01",
      generatedAt: "2026-07-13T14:30:00.000Z",
    }),
  });

  assert.equal(response.status, 422);
  const problem = await response.json();
  assert.equal(problem.title, "invalid_report_request");
});

test("refuse un assessmentId persistant quand Supabase est absent", async () => {
  const response = await fetch(`${baseUrl}/api/reports/pdf`, {
    method: "POST",
    headers: {
      accept: "application/problem+json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      assessmentId: "00000000-0000-4000-8000-000000000001",
    }),
  });

  assert.equal(response.status, 503);
  const problem = await response.json();
  assert.equal(problem.title, "report_storage_unavailable");
});

test("le flux d’évaluation refuse la clé absente sans fabriquer de résultat", async () => {
  const response = await fetch(`${baseUrl}/api/assessments`, {
    method: "POST",
    headers: {
      accept: "application/x-ndjson",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      organizationName: "Atelier Horizon",
      systemName: "Assistant clients",
      description:
        "Un assistant répond aux questions des clients à partir de la documentation validée par notre équipe.",
      company: {
        employees: 40,
        annualRevenue: 8_000_000,
        balanceSheetTotal: 5_000_000,
      },
    }),
  });

  const responseBody = await response.text();
  assert.equal(response.status, 200, responseBody);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^application\/x-ndjson\b/i,
  );
  const events = responseBody
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.ok(
    events.some(
      (event) =>
        event.type === "error" && event.code === "CONFIGURATION_ERROR",
    ),
  );
  assert.equal(events.some((event) => event.type === "result"), false);
});
