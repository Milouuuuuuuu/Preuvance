import {
  ArrowRight,
  CalendarDays,
  Database,
  Download,
  FileText,
  Landmark,
  MonitorCheck,
  Scale,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { AssessmentExperience } from "./components/AssessmentExperience";
import { Brand } from "./components/Brand";
import { getMarketingReference } from "./lib/marketing";

export default function Home() {
  const marketing = getMarketingReference();

  return (
    <div className="pv-app-shell" id="accueil">
      <a className="pv-skip-link" href="#contenu">
        Aller au contenu
      </a>

      <header className="pv-site-header">
        <div className="pv-header-inner">
          <a className="pv-brand-link" href="#accueil">
            <Brand />
          </a>
          <nav className="pv-main-nav" aria-label="Navigation principale">
            <a href="/scan">Scanner en local</a>
            <a href="/build-week">Présentation</a>
            <a href="/outils/migration-sqlite-postgresql">Portabilité</a>
            <a href="#methode">Méthode</a>
            <a href="#referentiel">Référentiel</a>
            <a href="/en-clair">En clair</a>
            <a href="/auth/sign-in">Espace</a>
          </nav>
          <div className="pv-header-actions">
            <a
              className="pv-local-download-action"
              href="/downloads/preuvance-local.zip"
              download
              aria-label="Télécharger la version locale"
            >
              <Download size={15} aria-hidden="true" />
              <span>Télécharger la version locale</span>
            </a>
            <a className="pv-mobile-auth-action" href="/auth/sign-in">
              Espace
            </a>
            <a className="pv-header-action" href="#evaluation">
              Construire un dossier
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>

      <main id="contenu">
        <section className="pv-hero" aria-labelledby="hero-title">
          <div className="pv-hero-copy">
            <div className="pv-hero-eyebrow">
              <span aria-hidden="true" />
              {`Référentiel EU AI Act vérifié le ${marketing.verifiedAtDisplay}`}
            </div>
            <h1 id="hero-title">
              Décrivez votre IA.<br />
              <span>Preuvance bâtit le dossier.</span>
            </h1>
            <p className="pv-hero-lede">
              Un prompt et, si vous le souhaitez, les manifestes du projet
              deviennent une classification contre-vérifiée, un plan d’action
              et un registre vivant à consolider preuve par preuve.
            </p>

            <div className="pv-path-choice" aria-label="Construire puis étayer le dossier">
              <a className="pv-path-card pv-path-primary" href="#evaluation">
                <span className="pv-path-tag">Parcours principal · dossier instantané</span>
                <span className="pv-path-heading">
                  <Zap size={20} aria-hidden="true" />
                  Décrire, scanner les dépendances, assembler
                </span>
                <span className="pv-path-copy">
                  Décrivez le système en français et joignez facultativement ses
                  manifestes. GPT-5.6 structure le contexte ; le moteur de règles
                  contre-vérifie ; Preuvance assemble le dossier.
                </span>
                <span className="pv-path-produces">
                  Produit : score distinct, obligations, actions, manifeste des
                  dépendances et registre Déclaré → Détecté → Prouvé.
                </span>
                <span className="pv-path-cta">
                  Construire mon dossier
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
              </a>
              <a className="pv-path-card" href="/scan">
                <span className="pv-path-tag">Source complémentaire · poste local</span>
                <span className="pv-path-heading">
                  <MonitorCheck size={20} aria-hidden="true" />
                  Observer les usages réels
                </span>
                <span className="pv-path-copy">
                  Le scan local compare les outils déclarés aux appels observés
                  sans lire le contenu de vos fichiers et fait ressortir le
                  shadow AI.
                </span>
                <span className="pv-path-produces">
                  Produit : un digest local de concordance qui peut étayer le
                  dossier sans devenir une preuve juridique automatique.
                </span>
                <span className="pv-path-cta">
                  Ouvrir le scan local
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
              </a>
            </div>

            <ul className="pv-proof-list" aria-label="Bénéfices de Preuvance">
              <li>
                <Scale size={17} aria-hidden="true" />
                Raisonnement contextuel contre-vérifié par un moteur de règles
              </li>
              <li>
                <ShieldCheck size={17} aria-hidden="true" />
                Score explicable et décisions notées sur 100
              </li>
              <li>
                <Landmark size={17} aria-hidden="true" />
                Dossier vivant, PDF et manifeste de preuves exportable
              </li>
            </ul>

            <div className="pv-deadline-callout">
              <div
                className="pv-deadline-date"
                aria-label={marketing.deadlineCallout.ariaLabel}
              >
                <strong>{marketing.deadlineCallout.day}</strong>
                <span>
                  {marketing.deadlineCallout.monthLabel}
                  <br />
                  {marketing.deadlineCallout.year}
                </span>
              </div>
              <div>
                <p className="pv-kicker">Prochaine échéance ferme</p>
                <strong>Transparence — Article 50</strong>
                <ul className="pv-deadline-scope">
                  <li>
                    <b>Interaction · 50(1)</b> informer la personne qu’elle
                    échange avec un système d’IA, sauf si cela est évident.
                  </li>
                  <li>
                    <b>Marquage machine · 50(2)</b> le fournisseur marque les
                    sorties synthétiques dans un format lisible par machine.
                  </li>
                  <li>
                    <b>Contenu synthétique · 50(4)</b> le déployeur divulgue les
                    deepfakes et certains textes d’intérêt public.
                  </li>
                </ul>
                <p className="pv-deadline-note">
                  Le paragraphe 50(3) prévoit aussi une information en cas de
                  reconnaissance des émotions ou de catégorisation biométrique.
                </p>
              </div>
            </div>
          </div>

          <div className="pv-evaluation-panel" id="evaluation">
            <AssessmentExperience />
          </div>
        </section>

        <div id="pv-results-slot" />

        <section className="pv-method" id="methode" aria-labelledby="method-title">
          <div className="pv-section-intro">
            <p className="pv-kicker">Une preuve, pas une checklist</p>
            <h2 id="method-title">Du contexte métier à une décision traçable.</h2>
            <p>
              Chaque conclusion reste reliée aux faits extraits, aux dépendances
              observées, au texte applicable et aux pièces qui la confirment —
              ou qui manquent encore.
            </p>
          </div>
          <ol className="pv-method-steps">
            <li>
              <span className="pv-method-number">01</span>
              <FileText size={22} aria-hidden="true" />
              <h3>Déclarer</h3>
              <p>
                Votre équipe explique l’usage réel, les personnes concernées et
                les décisions produites, sans jargon juridique.
              </p>
            </li>
            <li>
              <span className="pv-method-number">02</span>
              <Scale size={22} aria-hidden="true" />
              <h3>Détecter</h3>
              <p>
                Les manifestes et scans reconnus ajoutent des observations
                techniques bornées ; GPT-5.6 rapproche les faits du référentiel,
                puis un moteur déterministe cherche les contradictions.
              </p>
            </li>
            <li>
              <span className="pv-method-number">03</span>
              <ShieldCheck size={22} aria-hidden="true" />
              <h3>Prouver, pièce par pièce</h3>
              <p>
                Chaque contrôle conserve sa source, son propriétaire, son
                empreinte et sa revue. Seule une revue humaine datée atteint
                l’état « Prouvé ».
              </p>
            </li>
          </ol>
        </section>

        <section
          className="pv-evidence-visual"
          aria-labelledby="evidence-visual-title"
        >
          <div className="pv-evidence-visual-copy">
            <p className="pv-kicker">La signature Preuvance</p>
            <h2 id="evidence-visual-title">
              Du risque à la preuve, dans un dossier lisible.
            </h2>
            <p>
              Une vue structurée pour partager la classification, les contrôles
              et les priorités avec les équipes dirigeantes, juridiques et
              assurantielles.
            </p>
          </div>
          <figure className="pv-evidence-figure">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/og-v2.png"
              width="1728"
              height="910"
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              alt="Aperçu d’un dossier Preuvance montrant le score, la concordance déclaré-observé et la portabilité locale SQLite-PostgreSQL."
            />
            <figcaption>
              Dossier de préparation courtier · référentiel EU AI Act daté
            </figcaption>
          </figure>
        </section>

        <section className="pv-portability-band" aria-labelledby="portability-title">
          <div className="pv-portability-icon" aria-hidden="true">
            <Database size={28} />
          </div>
          <div className="pv-portability-copy">
            <p className="pv-kicker">Boîte à outils locale</p>
            <h2 id="portability-title">
              Faites circuler vos données sans les exposer.
            </h2>
            <p>
              Le bridge SQLite ↔ PostgreSQL traduit les schémas dans les deux
              sens et transforme une base <code>.sqlite</code> en dump
              PostgreSQL, entièrement sur votre machine. Le mode strict bloque
              les cas qui exigent une validation humaine.
            </p>
          </div>
          <a className="pv-portability-action" href="/outils/migration-sqlite-postgresql">
            Découvrir l’outil open source
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </section>

        <section className="pv-reference-band" id="referentiel" aria-labelledby="reference-title">
          <div className="pv-reference-heading">
            <CalendarDays size={22} aria-hidden="true" />
            <div>
              <p className="pv-kicker">Référentiel réglementaire figé</p>
              <h2 id="reference-title">Des dates contrôlées, pas improvisées.</h2>
            </div>
          </div>
          <div className="pv-reference-dates">
            {marketing.band.map((entry) => (
              <div key={entry.title}>
                <span>{entry.date}</span>
                <strong>{entry.title}</strong>
                <small>{entry.detail}</small>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="pv-site-footer">
        <div className="pv-footer-main">
          <Brand compact />
          <p>Maîtrisez votre risque IA, prouvez-le à votre assureur.</p>
          <nav className="pv-footer-links" aria-label="Liens de pied de page">
            <a href="#confidentialite">Confidentialité</a>
            <a href="/en-clair">Preuvance en clair</a>
            <a href="/outils/migration-sqlite-postgresql">Portabilité des données</a>
            <a href="#evaluation">
              Évaluer un système
              <ArrowRight size={15} aria-hidden="true" />
            </a>
          </nav>
        </div>
        <div className="pv-local-download-note">
          <Download size={18} aria-hidden="true" />
          <p>
            <strong>Version locale.</strong> Lance l’application web sur votre
            ordinateur ; Node.js 22.13 ou supérieur et une clé API OpenAI sont
            requis.
          </p>
          <a href="/downloads/preuvance-local.zip" download>
            Télécharger le fichier .zip
          </a>
        </div>
        <section
          className="pv-footer-privacy"
          id="confidentialite"
          aria-labelledby="privacy-title"
        >
          <div>
            <p className="pv-kicker">Traitement des données</p>
            <h2 id="privacy-title">Confidentialité</h2>
          </div>
          <div className="pv-footer-privacy-grid">
            <p>
              <strong>Finalité.</strong> Les informations servent à extraire les
              faits, préqualifier les obligations, analyser les écarts et
              produire le dossier de préparation.
            </p>
            <p>
              <strong>API OpenAI.</strong> Le nom de l’organisation, le nom du
              système et sa description sont envoyés à OpenAI, puis les faits
              et préqualifications dérivés nécessaires aux étapes suivantes.
            </p>
            <p>
              <strong>Compte.</strong> Lorsque vous êtes connecté, les données
              d’entrée, les résultats et le rapport sont enregistrés dans votre
              espace Preuvance. Ce MVP privé ne configure actuellement ni durée
              de conservation ni suppression automatique.
            </p>
          </div>
        </section>
        <div className="pv-footer-legal">
          <p>
            {`Référentiel réglementaire vérifié le ${marketing.verifiedAtDisplay}. Les reports des Annexes III et I restent indiqués sous réserve de publication formelle au Journal officiel de l’Union européenne.`}
          </p>
          <p>
            Preuvance fournit une aide à la préparation et à la décision. Ce
            service ne constitue pas un conseil juridique.
          </p>
        </div>
      </footer>
    </div>
  );
}
