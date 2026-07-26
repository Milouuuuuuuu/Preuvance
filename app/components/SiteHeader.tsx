import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Brand } from "./Brand";

/**
 * En-tête des pages secondaires (D-115).
 *
 * Il existait en quatre copies quasi identiques dont les navigations avaient
 * divergé : `/diagnostic` était absent de trois d'entre elles, donc le module
 * de diagnostic était invisible depuis le scan, la page « En clair » et
 * l'outil de portabilité. Une source unique supprime la dérive et rend la
 * navigation cohérente d'une page à l'autre.
 *
 * L'accueil garde son propre en-tête : ses actions (téléchargement local,
 * appel à l'action d'évaluation) et ses ancres internes n'ont pas d'équivalent
 * ailleurs.
 */
const SECONDARY_NAV = [
  { href: "/scan", label: "Scanner en local" },
  { href: "/diagnostic", label: "Diagnostic complet" },
  { href: "/#methode", label: "Méthode" },
  { href: "/en-clair", label: "En clair" },
  { href: "/auth/sign-in", label: "Espace" },
] as const;

export function SiteHeader({ current }: { current?: string }) {
  return (
    <header className="pv-site-header">
      <div className="pv-header-inner">
        <Link className="pv-brand-link" href="/">
          <Brand />
        </Link>
        <nav className="pv-main-nav" aria-label="Navigation principale">
          {SECONDARY_NAV.filter((item) => item.href !== current).map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="pv-header-actions">
          <Link className="pv-header-action" href="/">
            <ArrowLeft size={16} aria-hidden="true" />
            Retour à l’accueil
          </Link>
        </div>
      </div>
    </header>
  );
}
