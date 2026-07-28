import posthog from "posthog-js";

/**
 * Analyse produit optionnelle : sans clé, tout appel de ce module est un
 * no-op (même logique que OPENAI_API_KEY/Supabase).
 * Aucune valeur envoyée ici ne doit contenir de texte libre saisi par
 * l'utilisateur (description système, nom d'organisation, contenu de
 * preuve) : uniquement des métadonnées structurées et agrégées.
 */
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

/**
 * Les identifiants de dossier (/dossiers/<uuid>) sont des données tenant :
 * ils sont expurgés de toute valeur transmise, y compris celles que posthog-js
 * ajoute lui-même ($pageleave, $prev_pageview_pathname, $referrer).
 */
export function redactPath(path: string): string {
  return path.replace(/\/dossiers\/[^/?#\s"']+/g, "/dossiers/[id]");
}

/**
 * Expurge TOUTE propriété de type chaîne qui contient un chemin de dossier,
 * plutôt qu'une liste de clés à maintenir à la main.
 *
 * Une liste de clés à expurger ne peut pas être exhaustive : le SDK ajoute
 * lui-même des propriétés dérivées de l'URL (`$prev_pageview_pathname`,
 * `$referrer`, `$initial_current_url`…) et une version ultérieure peut en
 * ajouter d'autres. Balayer toutes les valeurs de type chaîne couvre donc
 * aussi celles que nous ne connaissons pas encore.
 */
export function sanitizeUrlProperties<
  T extends { properties?: Record<string, unknown> } | null,
>(event: T): T {
  if (!event?.properties) return event;
  for (const [key, value] of Object.entries(event.properties)) {
    if (typeof value === "string" && value.includes("/dossiers/")) {
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
    // distante du projet PostHog et pourraient s'activer à notre insu.
    capture_heatmaps: false,
    capture_dead_clicks: false,
    rageclick: false,
    capture_exceptions: false,
    // Aucun aller-retour de configuration distante, aucun script tiers chargé
    // à l'exécution : le SDK n'émet que vers l'hôte d'ingestion. C'est la
    // conséquence logique des épinglages ci-dessus (si la config distante ne
    // doit rien pouvoir réactiver, autant ne pas aller la chercher) et cela
    // permet une CSP sans exception pour us-assets.i.posthog.com.
    // Nous n'utilisons ni feature flags, ni sondages, ni enregistrement.
    advanced_disable_flags: true,
    disable_external_dependency_loading: true,
    disable_surveys: true,
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
