"use client";

import { useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { trackEvent } from "@/lib/analytics/posthog";

const STORAGE_KEY = "pv-theme";

/**
 * Bascule du thème nuit (D-105). Opt-in : le site reste en mode jour tant que
 * le visiteur n'a pas choisi, et le choix persiste en localStorage. Le script
 * d'initialisation du layout pose data-theme avant la peinture pour éviter le
 * flash ; ici on ne fait que lire puis basculer.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"jour" | "nuit" | null>(null);
  const [sweeping, setSweeping] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "nuit" ? "nuit" : "jour");
  }, []);

  const toggle = useCallback(() => {
    const root = document.documentElement;
    const next = root.dataset.theme === "nuit" ? "jour" : "nuit";
    root.classList.add("pv-theme-anim");
    if (next === "nuit") {
      root.dataset.theme = "nuit";
    } else {
      delete root.dataset.theme;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Stockage indisponible (navigation privée) : le choix vaut pour la page.
    }
    setTheme(next);
    setSweeping(true);
    window.setTimeout(() => {
      root.classList.remove("pv-theme-anim");
      setSweeping(false);
    }, 680);
    trackEvent("theme_toggled", { theme: next });
  }, []);

  if (theme === null) return null;

  const nuit = theme === "nuit";
  return (
    <>
      {sweeping ? <div className="pv-theme-sweep" aria-hidden="true" /> : null}
      <button
        type="button"
        className="pv-theme-toggle"
        aria-pressed={nuit}
        aria-label={nuit ? "Revenir au mode jour" : "Passer en mode nuit"}
        onClick={toggle}
      >
        {nuit ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
      </button>
    </>
  );
}
