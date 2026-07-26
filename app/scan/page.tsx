import type { Metadata } from "next";
import { ArrowLeft, Download, Terminal } from "lucide-react";
import { ScanReportLoader } from "../components/ScanReportLoader";
import { TrackedLink } from "../components/TrackedLink";
import { SiteHeader } from "../components/SiteHeader";

export const metadata: Metadata = {
  title: "Scanner en local",
  description:
    "Analysez votre poste en local : appels d’IA non déclarés, fichiers sensibles et concordance déclaré / observé. Rien n’est envoyé, scripts lisibles en clair.",
  alternates: { canonical: "/scan" },
};

export default function ScanPage() {
  return (
    <div className="pv-app-shell" id="accueil">
      <a className="pv-skip-link" href="#contenu">
        Aller au contenu
      </a>
      <SiteHeader current="/scan" />


      <main id="contenu">
        <section className="pv-scan-hero" aria-labelledby="scan-hero-title">
          <p className="pv-kicker">Source complémentaire — scan local</p>
          <h1 id="scan-hero-title">Analysez votre poste, sans rien envoyer.</h1>
          <p className="pv-scan-hero-lede">
            Avant le scan, vous déclarez les outils d’IA que vous utilisez
            sciemment. Le scan observe ensuite la réalité du poste — appels d’IA
            et fichiers sensibles (chemin et empreinte seulement, jamais leur
            contenu) — et la compare à votre déclaration : c’est la
            <strong> concordance déclaré / observé</strong>, une déclaration
            corroborée plutôt qu’une déclaration sur l’honneur. Rien ne quitte
            votre poste.
          </p>

          <ol className="pv-scan-steps">
            <li>
              <span className="pv-method-number">01</span>
              <Download size={20} aria-hidden="true" />
              <h3>Télécharger</h3>
              <p>
                Récupérez la version locale puis extrayez l’archive.
                <TrackedLink
                  eventName="local_zip_download_clicked"
                  href="/downloads/preuvance-local.zip"
                  download
                >
                  Télécharger le .zip
                </TrackedLink>
              </p>
            </li>
            <li>
              <span className="pv-method-number">02</span>
              <Terminal size={20} aria-hidden="true" />
              <h3>Déclarer puis scanner</h3>
              <p>
                Double-cliquez sur <code>SCANNER_PREUVANCE.cmd</code>. Déclarez
                vos outils d’IA connus, puis choisissez le scan rapide ou la
                surveillance réseau d’une heure.
              </p>
            </li>
            <li>
              <span className="pv-method-number">03</span>
              <ArrowLeft size={20} aria-hidden="true" style={{ transform: "rotate(-90deg)" }} />
              <h3>Charger</h3>
              <p>Déposez ci-dessous le fichier <code>preuvance-scan.json</code> obtenu.</p>
            </li>
          </ol>

          <p className="pv-scan-hint">
            Windows peut afficher « Windows a protégé votre ordinateur »
            (SmartScreen) au premier lancement d’un script téléchargé : cliquez
            sur « Informations complémentaires » puis « Exécuter quand même ».
            Les scripts sont lisibles en clair dans l’archive et ne demandent
            aucun droit administrateur.
          </p>
        </section>

        <ScanReportLoader />

        <p className="pv-scan-legal">
          Le scan et cette lecture sont purement locaux et informatifs ; ils ne
          constituent ni un audit certifié, ni un avis juridique. Pour un poste
          professionnel géré, privilégiez le canal IT/DPO officiel.
        </p>
      </main>
    </div>
  );
}
