"use client";

import { useEffect } from "react";

import { trackEvent } from "@/lib/analytics/posthog";

/**
 * Dernier filet du rendu client.
 *
 * L'audit du 26/07/2026 a relevé qu'aucune erreur d'exécution n'était
 * observée : une page blanche en production n'était visible de personne tant
 * qu'un utilisateur ne se plaignait pas. Ce composant fait deux choses :
 * afficher un écran honnête plutôt qu'une page blanche, et émettre un
 * événement **borné**.
 *
 * Ce qui part : le `digest` de React (une empreinte calculée côté serveur, pas
 * un message), le nom de la classe d'erreur et la route. Jamais la pile,
 * jamais le message — ils peuvent contenir des fragments de saisie
 * utilisateur, ce qu'interdit le contrat de confidentialité analytique.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    trackEvent("app_error", {
      digest: error.digest ?? "sans-digest",
      errorName: error.name,
      route: typeof window === "undefined" ? "inconnue" : window.location.pathname,
    });
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <main className="pv-error-shell">
          <p className="pv-kicker">Erreur d’affichage</p>
          <h1>Cette page n’a pas pu s’afficher</h1>
          <p>
            L’incident a été enregistré sans aucune donnée que vous auriez saisie.
            Vos évaluations déjà enregistrées ne sont pas affectées.
          </p>
          {error.digest ? (
            <p className="pv-error-digest">
              Référence à communiquer au support : <code>{error.digest}</code>
            </p>
          ) : null}
          <div className="pv-error-actions">
            <button type="button" onClick={() => reset()}>
              Réessayer
            </button>
            {/* Rechargement complet volontaire : `global-error` s'affiche quand
                l'arbre React a échoué, il ne faut pas dépendre du routeur
                client pour en sortir. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/">Revenir à l’accueil</a>
          </div>
        </main>
      </body>
    </html>
  );
}
