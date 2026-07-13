export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !publishableKey) return null;

  try {
    const parsed = new URL(url);
    const secureRemote = parsed.protocol === "https:";
    const localDevelopment =
      parsed.protocol === "http:" &&
      (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
    if (!secureRemote && !localDevelopment) {
      return null;
    }
  } catch {
    return null;
  }

  return { url, publishableKey };
}

export function isSupabaseConfigured() {
  return getSupabasePublicConfig() !== null;
}
