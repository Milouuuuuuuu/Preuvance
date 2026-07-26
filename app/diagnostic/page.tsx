import type { Metadata } from "next";
import { Database, FileCheck2, Route } from "lucide-react";

import { CatalogueLoader } from "../components/CatalogueLoader";
import { SiteHeader } from "../components/SiteHeader";

export const metadata: Metadata = {
  title: "Diagnostic complet",
  description:
    "Inventaire des sources de données du client, cartographie des flux et plan de transition chiffré, à partir d’un catalogue de métadonnées produit localement.",
  alternates: { canonical: "/diagnostic" },
};

export default function DiagnosticPage() {
  return (
    <div className="pv-app-shell" id="accueil">
      <a className="pv-skip-link" href="#contenu">
        Aller au contenu
      </a>
      <SiteHeader current="/diagnostic" />


      <main id="contenu">
        <section className="pv-scan-hero" aria-labelledby="diagnostic-hero-title">
          <p className="pv-kicker">Diagnostic complet — 10 jours ouvrés</p>
          <h1 id="diagnostic-hero-title">
            Ce que le client possède, où ça circule, ce que ça coûte de le reprendre.
          </h1>
          <p className="pv-scan-hero-lede">
            Le scan de dépendances IA répond à « quels outils tournent sur les
            postes ». Le diagnostic complet répond à la question d’avant :
            <strong> quelles données existent, dans quels systèmes, avec quels
            champs sensibles, et par quels flux elles sortent</strong>. L’agent
            local lit des métadonnées en lecture seule ; le catalogue produit ne
            quitte jamais le poste du client.
          </p>

          <ol className="pv-scan-steps">
            <li>
              <span className="pv-method-number">01</span>
              <Database size={20} aria-hidden="true" />
              <h3>Inventorier</h3>
              <p>
                L’agent interroge les catalogues système (PostgreSQL, MySQL, SQL
                Server), les exports CSV/Excel et les API métier. Structures,
                volumétries et dates seulement.
              </p>
            </li>
            <li>
              <span className="pv-method-number">02</span>
              <Route size={20} aria-hidden="true" />
              <h3>Cartographier</h3>
              <p>
                Les champs sensibles sont classés par règles nommées, les flux
                déclarés en entretien rejoignent les flux observés, et la
                cartographie distingue toujours les deux.
              </p>
            </li>
            <li>
              <span className="pv-method-number">03</span>
              <FileCheck2 size={20} aria-hidden="true" />
              <h3>Restituer</h3>
              <p>
                Score par axe, constats gradués, plan de transition chiffré en
                jours. Export Markdown ou HTML imprimable, généré dans le
                navigateur.
              </p>
            </li>
          </ol>

          <p className="pv-scan-hint">
            Le mode « remise au DBA » permet un diagnostic sans aucun accès
            direct : l’agent imprime les requêtes de lecture seule, l’équipe du
            client les exécute et rend les résultats. C’est souvent le chemin le
            plus rapide vers le pack d’accès.
          </p>
        </section>

        <CatalogueLoader />

        <p className="pv-scan-legal">
          Ce diagnostic est informatif : il mesure une préparation à partir de ce
          qui a été rendu lisible. Il ne constitue ni un audit certifié, ni un
          avis juridique, ni une décision d’assurabilité.
        </p>
      </main>
    </div>
  );
}
