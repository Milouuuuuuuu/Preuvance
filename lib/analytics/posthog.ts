import posthog from "posthog-js";

/**
 * Analyse produit optionnelle : sans clé, tout appel de ce module est un
 * no-op (même logique que OPENAI_API_KEY/Supabase — cf. D-020, D-024).
 * Aucune valeur envoyée ici ne doit contenir de texte libre saisi par
 * l'utilisateur (description système, nom d'organisation, contenu de
 * preuve) : uniquement des métadonnées structurées et agrégées.
 */
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

/**
 * Les identifiants de dossier (/dossiers/<uuid>) sont des données tenant :
 * ils sont expurgés de toute URL transmise, y compris celles que posthog-js
 * ajoute lui-même ($pageleave).
 */
export function redactPath(path: string): string {
  return path.replace(/\/dossiers\/[^/?#]+/g, "/dossiers/[id]");
}

function sanitizeUrlProperties<
  T extends { properties?: Record<string, unknown> } | null,
>(event: T): T {
  if (!event?.properties) return event;
  for (const key of ["$current_url", "$pathname"]) {
    const value = event.properties[key];
    if (typeof value === "string") {
      event.properties[key] = redactPath(value);
    }
  }
  return event;
}

let initialized = false;

export function initPostHogClient(): void {
  if (initialized || typeof window === "undefined" || !POSTHOG_KEY) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording: true,
    respect_dnt: true,
    // Épinglés explicitement : sans cela, ces captures suivent la config
    // distante du projet PostHog et pourraient s'activer à notre insu (D-087).
    capture_heatmaps: false,
    capture_dead_clicks: false,
    rageclick: false,
    capture_exceptions: false,
    before_send: sanitizeUrlProperties,
  });
  initialized = true;
}

export function trackEvent(
  name: string,
  properties?: Record<string, unknown>,
): void {
  if (!POSTHOG_KEY || typeof window === "undefined" || !initialized) return;
  posthog.capture(name, properties);
}

export function trackPageview(path: string): void {
  if (!POSTHOG_KEY || typeof window === "undefined" || !initialized) return;
  posthog.capture("$pageview", { $current_url: path });
}
