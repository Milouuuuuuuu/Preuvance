import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Code2,
  Database,
  Download,
  LockKeyhole,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { Brand } from "../../components/Brand";

const repositoryUrl =
  "https://github.com/Milouuuuuuuu/sqlite-postgres-bridge";
const downloadUrl = `${repositoryUrl}/releases/latest/download/sqlite-postgres-bridge-v0.1.0.zip`;

export const metadata: Metadata = {
  title: "Portabilité SQLite et PostgreSQL",
  description:
    "Traduisez localement SQL et bases SQLite vers PostgreSQL, sans upload ni télémétrie.",
};

export default function DataPortabilityPage() {
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
            <Link href="/scan">Scanner en local</Link>
            <Link href="/#methode">Méthode</Link>
            <Link href="/en-clair">En clair</Link>
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

      <main id="contenu" className="pv-portability-page">
        <section className="pv-portability-hero" aria-labelledby="portability-hero-title">
          <div>
            <p className="pv-kicker">Preuvance Data Portability · outil open source</p>
            <h1 id="portability-hero-title">
              SQLite et PostgreSQL,<br />
              <span>sans abandonner vos données.</span>
            </h1>
            <p className="pv-portability-lede">
              Traduisez du SQL dans les deux sens ou transformez une vraie base
              <code>.sqlite</code> en dump PostgreSQL. Tout se passe localement :
              aucun serveur, aucun upload et aucune télémétrie.
            </p>
            <div className="pv-portability-actions">
              <a className="pv-header-action" href={downloadUrl}>
                <Download size={17} aria-hidden="true" />
                Télécharger la version 0.1.0
              </a>
              <a className="pv-portability-secondary" href={repositoryUrl}>
                <Code2 size={17} aria-hidden="true" />
                Voir le code source
              </a>
            </div>
          </div>

          <div className="pv-portability-terminal" aria-label="Exemple de contrôle avant migration">
            <div className="pv-portability-terminal-bar">
              <span />
              <span />
              <span />
              <strong>Contrôle avant migration</strong>
            </div>
            <pre><code>{`node cli.js dump donnees.sqlite --dry-run

[info] AUTOINCREMENT traduit en SERIAL
[warning] comportement LIKE à vérifier
[summary] info=4 warning=1 manual=0

Migration prête pour une base de test.`}</code></pre>
          </div>
        </section>

        <section className="pv-portability-features" aria-label="Capacités de l’outil">
          <article>
            <Database size={22} aria-hidden="true" />
            <h2>Deux dialectes, un passage contrôlé</h2>
            <p>
              Traduction SQLite vers PostgreSQL et PostgreSQL vers SQLite, avec
              des notes précises pour chaque adaptation.
            </p>
          </article>
          <article>
            <LockKeyhole size={22} aria-hidden="true" />
            <h2>Hors ligne par conception</h2>
            <p>
              Interface graphique ouvrable par double-clic et CLI Node sans
              installation de dépendances. Vos données ne quittent pas le poste.
            </p>
          </article>
          <article>
            <Terminal size={22} aria-hidden="true" />
            <h2>Automatisable sans faux vert</h2>
            <p>
              <code>--dry-run</code> et <code>--fail-on-manual</code> renvoient
              un code de blocage lorsqu’une décision humaine reste nécessaire.
            </p>
          </article>
        </section>

        <section className="pv-portability-workflow" aria-labelledby="workflow-title">
          <div>
            <p className="pv-kicker">Parcours de migration sûr</p>
            <h2 id="workflow-title">Tester avant de basculer.</h2>
          </div>
          <ol>
            <li>
              <span>01</span>
              <div>
                <strong>Analyser</strong>
                <p>Lancez le mode dry-run et traitez chaque note manuelle.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Importer en test</strong>
                <p>Chargez le dump dans une base vide et comparez les comptages.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Valider l’application</strong>
                <p>Testez les parcours métier, les droits et les sauvegardes avant la bascule.</p>
              </div>
            </li>
          </ol>
        </section>

        <section className="pv-portability-proof" aria-labelledby="proof-title">
          <CheckCircle2 size={24} aria-hidden="true" />
          <div>
            <p className="pv-kicker">Preuves techniques</p>
            <h2 id="proof-title">Validé contre de vrais PostgreSQL.</h2>
            <p>
              La chaîne de tests couvre Node.js 18, 20 et 22. Les dumps sont
              importés automatiquement dans PostgreSQL 14 et 18, puis les lignes,
              données binaires et séquences sont contrôlées.
            </p>
          </div>
        </section>

        <aside className="pv-portability-boundary" aria-labelledby="boundary-title">
          <ShieldAlert size={22} aria-hidden="true" />
          <div>
            <h2 id="boundary-title">Ce que l’outil ne prétend pas faire</h2>
            <p>
              Il traduit la structure et les valeurs ; il ne devine ni le sens
              métier, ni les droits, ni les politiques RLS. Preuvance ne lance
              jamais automatiquement un dump arbitraire dans sa base applicative.
            </p>
          </div>
        </aside>

        <section className="pv-portability-final-cta">
          <div>
            <p className="pv-kicker">MIT · gratuit · auditable</p>
            <h2>Commencez par une base de test.</h2>
          </div>
          <a href={downloadUrl}>
            Télécharger le bridge
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </section>
      </main>
    </div>
  );
}

