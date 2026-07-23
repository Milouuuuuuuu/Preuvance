export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sitemapUrl = new URL("/sitemap.xml", resolveBaseUrl(request)).toString();
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /auth/",
    "Disallow: /dossiers/",
    "",
    `Sitemap: ${sitemapUrl}`,
    "",
  ].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

// Même dérivation d’origine que generateMetadata (app/layout.tsx) : en-têtes
// du proxy d’abord, NEXT_PUBLIC_APP_URL ensuite. Garder les deux synchronisés.
function resolveBaseUrl(request: Request): URL {
  const requestHeaders = request.headers;
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProtocol === "http" ? "http" : "https";
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  return host
    ? new URL(`${protocol}://${host}`)
    : new URL(configuredUrl ?? "http://localhost:3000");
}
