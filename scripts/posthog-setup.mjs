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

function trendSeries(eventId, math, extra = {}) {
  return { id: eventId, name: eventId, type: "events", math, ...extra };
}

function trendsFilters(series, extra = {}) {
  return {
    insight: "TRENDS",
    display: "ActionsLineGraph",
    interval: "day",
    date_from: "-30d",
    events: series,
    ...extra,
  };
}

function funnelFilters(steps, windowDays) {
  return {
    insight: "FUNNELS",
    funnel_viz_type: "steps",
    funnel_window_interval: windowDays,
    funnel_window_interval_unit: "day",
    date_from: "-30d",
    events: steps.map((id, order) => ({ id, name: id, type: "events", order })),
  };
}

const DASHBOARDS = [
  {
    name: "Preuvance — Vue d'ensemble",
    description: "Trafic et volumes clés sur 30 jours.",
    insights: [
      {
        name: "Preuvance — Visiteurs uniques",
        filters: trendsFilters([trendSeries("$pageview", "dau")]),
      },
      {
        name: "Preuvance — Évaluations lancées",
        filters: trendsFilters([trendSeries("assessment_started", "total")]),
      },
      {
        name: "Preuvance — Évaluations terminées",
        filters: trendsFilters([trendSeries("assessment_completed", "total")]),
      },
      {
        name: "Preuvance — PDF téléchargés",
        filters: trendsFilters([trendSeries("report_pdf_downloaded", "total")]),
      },
    ],
  },
  {
    name: "Preuvance — Funnel dossier",
    description: "Parcours complet : visite → formulaire → évaluation → PDF.",
    insights: [
      {
        name: "Preuvance — Funnel visite → PDF",
        filters: funnelFilters(
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
        filters: funnelFilters(
          [
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
        filters: trendsFilters([trendSeries("assessment_failed", "total")], {
          breakdown: "code",
          breakdown_type: "event",
        }),
      },
      {
        name: "Preuvance — Étapes atteintes",
        filters: trendsFilters(
          [trendSeries("assessment_stage_reached", "total")],
          { breakdown: "stage", breakdown_type: "event" },
        ),
      },
      {
        name: "Preuvance — Répartition par palier",
        filters: trendsFilters([trendSeries("assessment_completed", "total")], {
          breakdown: "tier",
          breakdown_type: "event",
        }),
      },
      {
        name: "Preuvance — Score moyen",
        filters: trendsFilters([
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
      filters: definition.filters,
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
      "POSTHOG_PERSONAL_API_KEY contient une clé projet (phc_...), réservée à l'ingestion navigateur. L'API privée exige une clé personnelle phx_... — créez-en une dans PostHog → Settings → Personal API Keys.",
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
