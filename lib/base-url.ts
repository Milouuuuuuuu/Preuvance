/**
 * Origine publique de l'application, source unique de vérité.
 *
 * Deux raisons d'exister (audit du 26/07/2026) :
 *
 * 1. **Sécurité (D-111).** `x-forwarded-host` est fourni par l'appelant :
 *    Cloudflare Workers ne le pose pas. Le lire sans contrôle laissait un
 *    visiteur déplacer l'origine absolue du sitemap, du JSON-LD et des images
 *    OpenGraph vers son propre domaine — avec, pour robots.txt et sitemap.xml,
 *    une mise en cache publique d'une heure. `NEXT_PUBLIC_APP_URL` fait donc
 *    autorité dès qu'elle est configurée ; l'en-tête n'est plus qu'un repli de
 *    développement.
 * 2. **Dette.** La même dérivation existait en trois exemplaires (layout,
 *    robots, sitemap) : une correction devait être portée trois fois.
 */

/** Repli quand ni la configuration ni les en-têtes ne renseignent l'hôte. */
const LOCAL_FALLBACK = "http://localhost:3000";

function fromConfiguredUrl(): URL | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return null;
  try {
    return new URL(configured);
  } catch {
    // Une valeur mal formée ne doit pas faire tomber le rendu : on retombe
    // sur l'hôte de la requête, comme si elle n'était pas configurée.
    return null;
  }
}

/**
 * `host` est posé par le runtime à partir de la requête réelle ; il reste
 * acceptable en développement et en prévisualisation. `x-forwarded-host` est
 * délibérément ignoré : contrôlé par le client, il n'apporte rien que
 * `NEXT_PUBLIC_APP_URL` ne fasse mieux en production.
 */
function fromRequestHost(host: string | null, forwardedProtocol: string | null): URL | null {
  if (!host) return null;
  const protocol = forwardedProtocol === "http" || host.startsWith("localhost") ? "http" : "https";
  try {
    return new URL(`${protocol}://${host}`);
  } catch {
    return null;
  }
}

export function resolveBaseUrlFromHeaders(headers: {
  get(name: string): string | null;
}): URL {
  return (
    fromConfiguredUrl() ??
    fromRequestHost(headers.get("host"), headers.get("x-forwarded-proto")) ??
    new URL(LOCAL_FALLBACK)
  );
}

export function resolveBaseUrlFromRequest(request: Request): URL {
  return resolveBaseUrlFromHeaders(request.headers);
}
