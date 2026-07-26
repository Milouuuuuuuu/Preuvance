import { resolveBaseUrlFromRequest } from "@/lib/base-url";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sitemapUrl = new URL("/sitemap.xml", resolveBaseUrlFromRequest(request)).toString();
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /auth/",
    "Disallow: /dossiers/",
    "Disallow: /ops",
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

