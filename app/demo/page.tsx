import type { Metadata } from "next";
import Link from "next/link";

import { Brand } from "@/app/components/Brand";
import { DossierViewer } from "@/app/components/DossierViewer";
import { northstarDemoAssessment } from "@/demo/build-week/northstar-demo";

export const metadata: Metadata = {
  title: "Dossier de démonstration Northstar",
  description:
    "Explorez un dossier Preuvance fictif sans compte, sans clé API et sans appel modèle.",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return (
    <div className="pv-dossier-page pv-demo-page">
      <header className="pv-dossier-header">
        <Link href="/" aria-label="Retour à l’accueil Preuvance">
          <Brand />
        </Link>
        <nav aria-label="Navigation de la démonstration">
          <Link href="/#evaluation">Lancer une analyse réelle</Link>
          <Link href="/build-week">Présentation</Link>
        </nav>
      </header>
      <main>
        <aside className="pv-demo-disclosure" aria-labelledby="demo-disclosure-title">
          <div>
            <p className="pv-kicker">Démo publique · données fictives</p>
            <h1 id="demo-disclosure-title">Explorez le dossier, sans compte ni clé API.</h1>
          </div>
          <p>
            Ce scénario figé montre l’interface, le registre et les règles de preuve.
            Il ne déclenche aucun appel modèle et n’affiche volontairement aucun nom
            de modèle résolu. Les statuts, identités et dates de revue sont fictifs ;
            ils ne prouvent rien sur une organisation réelle.
          </p>
          <div className="pv-demo-actions">
            <a
              className="pv-primary-button"
              href="/downloads/preuvance-northstar-demo.pdf"
              download
            >
              Télécharger le dossier d’exemple
            </a>
            <Link className="pv-secondary-button" href="/#evaluation">
              Faire une analyse réelle
            </Link>
          </div>
        </aside>
        <DossierViewer
          assessment={northstarDemoAssessment}
          resetHref="/demo"
          staticPdfHref="/downloads/preuvance-northstar-demo.pdf"
        />
      </main>
    </div>
  );
}
