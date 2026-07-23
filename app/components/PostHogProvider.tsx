"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  initPostHogClient,
  redactPath,
  trackPageview,
} from "@/lib/analytics/posthog";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    initPostHogClient();
  }, []);

  useEffect(() => {
    if (pathname) trackPageview(redactPath(pathname));
  }, [pathname]);

  return <>{children}</>;
}
