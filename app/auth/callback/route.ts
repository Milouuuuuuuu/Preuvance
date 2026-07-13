import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeRelativePath(requestUrl.searchParams.get("next"));
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return redirectToSignIn(request, "configuration", next);
  }

  if (!code) {
    return redirectToSignIn(request, "missing_code", next);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("PREUVANCE auth callback failed", error.message);
    return redirectToSignIn(request, "callback_failed", next);
  }

  return Response.redirect(appUrl(request, next), 303);
}

function redirectToSignIn(request: Request, error: string, next: string) {
  const destination = appUrl(request, "/auth/sign-in");
  destination.searchParams.set("error", error);
  destination.searchParams.set("next", next);
  return Response.redirect(destination, 303);
}

function appUrl(request: Request, path: string) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredOrigin) {
    try {
      return new URL(path, ensureTrailingSlash(configuredOrigin));
    } catch {
      // Fall through to the request origin for local development.
    }
  }
  return new URL(path, new URL(request.url).origin);
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function safeRelativePath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const parsed = new URL(value, "https://preuvance.local");
    if (parsed.origin !== "https://preuvance.local") return "/";
    if (parsed.pathname.startsWith("/auth/")) return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}
