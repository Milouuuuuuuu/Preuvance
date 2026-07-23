"use client";

import type { ComponentPropsWithoutRef, MouseEvent } from "react";
import { trackEvent } from "@/lib/analytics/posthog";

type TrackedLinkProps = ComponentPropsWithoutRef<"a"> & {
  eventName: string;
};

/**
 * Ancre instrumentée : l'événement part en fire-and-forget, sans jamais
 * bloquer la navigation ni le téléchargement (aucun preventDefault).
 */
export function TrackedLink({ eventName, onClick, ...anchorProps }: TrackedLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    trackEvent(eventName);
    onClick?.(event);
  }

  return <a {...anchorProps} onClick={handleClick} />;
}
