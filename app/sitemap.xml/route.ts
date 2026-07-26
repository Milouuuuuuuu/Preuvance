import { resolveBaseUrlFromRequest } from "@/lib/base-url";

export const dynamic = "force-dynamic";

// /demo et /build-week restent volontairement hors sitemap : ces pages sont
// noindex (D-085 pour la démo, deck interne pour /build-week), comme /auth,
// /api et /dossiers. Une URL noindex soumise en sitemap est une erreur SEO.
const publicPaths = [
  "/",
  "/scan",
  "/diagnostic",
  "/en-clair",
  "/outils/migration-sqlite-postgresql",
];

export async function GET(request: Request) {
  const baseUrl = resolveBaseUrlFromRequest(request);
  const urlEntries = publicPaths
    .map(
      (path) =>
        `  <url>\n    <loc>${new URL(path, baseUrl).toString()}</loc>\n  </url>`,
    )
    .join("\n");
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlEntries,
    "</urlset>",
    "",
  ].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
