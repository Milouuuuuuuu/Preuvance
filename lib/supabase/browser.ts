"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";
import { getSupabasePublicConfig } from "./env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createBrowserSupabaseClient() {
  if (browserClient) return browserClient;

  const config = getSupabasePublicConfig();
  if (!config) return null;

  browserClient = createBrowserClient<Database>(
    config.url,
    config.publishableKey,
  );
  return browserClient;
}
