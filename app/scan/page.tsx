import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Download, Terminal } from "lucide-react";
import { Brand } from "../components/Brand";
import { ScanReportLoader } from "../components/ScanReportLoader";

export const metadata: Metadata = {
  title: "Scanner en local",
  description:
    "Analysez votre poste en local : appels d’IA non déclarés et fichiers sensibles, sans rien envoyer sur Internet.",
};

export default function ScanPage() {
  return (
    <div className="pv-app-shell" id="accueil">
      <a className="pv-skip-link" href="#contenu">
        Aller au contenu
      </a>

      <header className="pv-site-header">
        <div className="pv-header-inner">
          <Link className="pv-brand-link" href="/">
            <Brand />
          </Link>
          <nav className="pv-main-nav" aria-label="Navigation principale">
            <Link href="/#methode">Méthode</Link>
            <Link href="/#referentiel">Référentiel</Link>
            <Link href="/auth/sign-in">Espace</Link>
          </nav>
          <div className="pv-header-actions">
            <Link className="pv-header-action" href="/">
              <ArrowLeft size={16} aria-hidden="true" />
              Retour à l’accueil
            </Link>
          </div>
        </div>
      </header>

      <main id="contenu">
        <section className="pv-scan-hero" aria-labelledby="scan-hero-title">
          <p className="pv-kicker">Option A — le scan local</p>
          <h1 id="scan-hero-title">Analysez votre poste, sans rien envoyer.</h1>
          <p className="pv-scan-hero-lede">
            Le scan tourne sur votre machine, détecte les appels d’IA non déclarés
            et inventorie vos fichiers sensibles (chemin et empreinte seulement,
            jamais leur contenu). Vous chargez ensuite le rapport ici pour voir
            votre score d’exposition. Rien ne quitte votre poste.
          </p>

          <ol className="pv-scan-steps">
            <li>
              <span className="pv-method-number">01</span>
              <Download size={20} aria-hidden="true" />
              <h3>Télécharger</h3>
              <p>
                Récupérez la version locale puis extrayez l’archive.
                <a href="/downloads/preuvance-local.zip" download>
                  Télécharger le .zip
                </a>
              </p>
            </li>
            <li>
              <span className="pv-method-number">02</span>
              <Terminal size={20} aria-hidden="true" />
              <h3>Scanner</h3>
              <p>
                Double-cliquez sur <code>SCANNER_PREUVANCE.cmd</code>. Choisissez
                le scan rapide ou la surveillance réseau d’une heure.
              </p>
            </li>
            <li>
              <span className="pv-method-number">03</span>
              <ArrowLeft size={20} aria-hidden="true" style={{ transform: "rotate(-90deg)" }} />
              <h3>Charger</h3>
              <p>Déposez ci-dessous le fichier <code>preuvance-scan.json</code> obtenu.</p>
            </li>
          </ol>
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
