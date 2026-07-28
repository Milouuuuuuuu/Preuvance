/**
 * Provisionne les tableaux de bord PostHog de Preuvance via l'API privée.
 *
 * Usage :
 *   POSTHOG_PERSONAL_API_KEY=phx_... node scripts/posthog-setup.mjs
 *
 * Idempotent : tableaux de bord et insights sont recherchés par nom et
 * créés uniquement s'ils manquent. Voir docs/analytics.md.
 */

const API_HOST = (
  process.env.POSTHOG_API_HOST ?? "https://us.posthog.com"
).replace(/\/+$/, "");
const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;

// L'API refuse désormais les insights au format `filters` hérité
// (« legacy filters is not available for this user ») : chaque insight est
// décrit par un `query` InsightVizNode.
function trendSeries(eventId, math, extra = {}) {
  return { kind: "EventsNode", event: eventId, name: eventId, math, ...extra };
}

function trendsQuery(series, extra = {}) {
  return {
    kind: "InsightVizNode",
    source: {
      kind: "TrendsQuery",
      series,
      interval: "day",
      dateRange: { date_from: "-30d" },
      filterTestAccounts: true,
      ...extra,
    },
  };
}

function funnelQuery(steps, windowDays) {
  return {
    kind: "InsightVizNode",
    source: {
      kind: "FunnelsQuery",
      series: steps.map((id) => ({ kind: "EventsNode", event: id, name: id })),
      dateRange: { date_from: "-30d" },
      filterTestAccounts: true,
      funnelsFilter: {
        funnelVizType: "steps",
        funnelWindowInterval: windowDays,
        funnelWindowIntervalUnit: "day",
      },
    },
  };
}

const DASHBOARDS = [
  {
    name: "Preuvance — Vue d'ensemble",
    description: "Trafic et volumes clés sur 30 jours.",
    insights: [
      {
        name: "Preuvance — Visiteurs uniques",
        query: trendsQuery([trendSeries("$pageview", "dau")]),
      },
      {
        name: "Preuvance — Évaluations lancées",
        query: trendsQuery([trendSeries("assessment_started", "total")]),
      },
      {
        name: "Preuvance — Évaluations terminées",
        query: trendsQuery([trendSeries("assessment_completed", "total")]),
      },
      {
        name: "Preuvance — PDF téléchargés",
        query: trendsQuery([trendSeries("report_pdf_downloaded", "total")]),
      },
    ],
  },
  {
    name: "Preuvance — Funnel dossier",
    description: "Parcours complet : visite → formulaire → évaluation → PDF.",
    insights: [
      {
        name: "Preuvance — Funnel visite → PDF",
        query: funnelQuery(
          [
            "$pageview",
            "assessment_form_started",
            "assessment_started",
            "assessment_completed",
            "report_pdf_downloaded",
          ],
          14,
        ),
      },
    ],
  },
  {
    name: "Preuvance — Source scan local",
    description: "Conversion depuis le scan local vers un dossier complet.",
    insights: [
      {
        name: "Preuvance — Funnel scan local → évaluation",
        query: funnelQuery(
          [
            "scan_zip_download_clicked",
            "scan_report_loaded",
            "scan_digest_handoff",
            "assessment_started",
            "assessment_completed",
          ],
          14,
        ),
      },
    ],
  },
  {
    name: "Preuvance — Qualité & risques",
    description: "Échecs, progression des étapes et distribution des scores.",
    insights: [
      {
        name: "Preuvance — Échecs par code",
        query: trendsQuery([trendSeries("assessment_failed", "total")], {
          breakdownFilter: { breakdown: "code", breakdown_type: "event" },
        }),
      },
      {
        name: "Preuvance — Étapes atteintes",
        query: trendsQuery([trendSeries("assessment_stage_reached", "total")], {
          breakdownFilter: { breakdown: "stage", breakdown_type: "event" },
        }),
      },
      {
        name: "Preuvance — Répartition par palier",
        query: trendsQuery([trendSeries("assessment_completed", "total")], {
          breakdownFilter: { breakdown: "tier", breakdown_type: "event" },
        }),
      },
      {
        name: "Preuvance — Score moyen",
        query: trendsQuery([
          trendSeries("assessment_completed", "avg", {
            math_property: "score",
          }),
        ]),
      },
    ],
  },
];

async function request(method, pathname, body) {
  const response = await fetch(`${API_HOST}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `${method} ${pathname} → HTTP ${response.status}\n${detail}`,
    );
  }
  return response.json();
}

async function resolveProject() {
  const explicitId = process.env.POSTHOG_PROJECT_ID;
  if (explicitId) return { id: explicitId };

  const { results } = await request("GET", "/api/projects/");
  const project = results?.[0];
  if (!project) {
    throw new Error(
      "Aucun projet PostHog accessible avec cette clé. Définissez POSTHOG_PROJECT_ID ou élargissez les droits de la clé personnelle.",
    );
  }
  console.log(`Projet détecté : ${project.name} (id ${project.id})`);
  return project;
}

async function findByName(basePath, name) {
  const { results } = await request(
    "GET",
    `${basePath}?search=${encodeURIComponent(name)}`,
  );
  return (results ?? []).find((item) => item.name === name && !item.deleted);
}

async function ensureDashboard(projectId, definition) {
  const basePath = `/api/projects/${projectId}/dashboards/`;
  const existing = await findByName(basePath, definition.name);
  if (existing) {
    console.log(`Tableau de bord déjà présent : ${definition.name}`);
    return existing;
  }
  const created = await request("POST", basePath, {
    name: definition.name,
    description: definition.description,
  });
  console.log(`Tableau de bord créé : ${definition.name}`);
  return created;
}

async function ensureInsight(projectId, dashboardId, definition) {
  const basePath = `/api/projects/${projectId}/insights/`;
  const existing = await findByName(basePath, definition.name);
  if (!existing) {
    await request("POST", basePath, {
      name: definition.name,
      query: definition.query,
      dashboards: [dashboardId],
    });
    console.log(`  Insight créé : ${definition.name}`);
    return;
  }
  const attachedTo = Array.isArray(existing.dashboards)
    ? existing.dashboards
    : [];
  if (attachedTo.includes(dashboardId)) {
    console.log(`  Insight déjà présent : ${definition.name}`);
    return;
  }
  await request("PATCH", `${basePath}${existing.id}/`, {
    dashboards: [...attachedTo, dashboardId],
  });
  console.log(`  Insight rattaché au tableau de bord : ${definition.name}`);
}

async function main() {
  if (!API_KEY) {
    throw new Error(
      "POSTHOG_PERSONAL_API_KEY est requis : une clé personnelle phx_... (PostHog → Settings → Personal API Keys).",
    );
  }
  if (API_KEY.startsWith("phc_")) {
    throw new Error(
      "POSTHOG_PERSONAL_API_KEY contient une clé projet (phc_...), réservée à l'ingestion navigateur. L'API privée exige une clé personnelle phx_..., à créer dans PostHog → Settings → Personal API Keys.",
    );
  }

  const project = await resolveProject();
  const dashboardUrls = [];

  for (const definition of DASHBOARDS) {
    const dashboard = await ensureDashboard(project.id, definition);
    for (const insight of definition.insights) {
      await ensureInsight(project.id, dashboard.id, insight);
    }
    dashboardUrls.push(
      `${API_HOST}/project/${project.id}/dashboard/${dashboard.id}`,
    );
  }

  console.log("\nTableaux de bord :");
  for (const url of dashboardUrls) {
    console.log(`  ${url}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
