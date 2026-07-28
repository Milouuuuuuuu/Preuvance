import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "../components/SiteHeader";

export const metadata: Metadata = {
  title: "Preuvance en clair",
  description:
    "Ce que fait Preuvance, expliqué simplement : dossier instantané, preuves déclarées ou détectées, scan local complémentaire et rapport PDF de préparation.",
  alternates: { canonical: "/en-clair" },
};

export default function EnClairPage() {
  return (
    <div className="pv-app-shell" id="accueil">
      <a className="pv-skip-link" href="#contenu">
        Aller au contenu
      </a>
      <SiteHeader current="/en-clair" />


      <main id="contenu" className="pv-plain">
        <section aria-labelledby="plain-title">
          <p className="pv-kicker">Sans jargon</p>
          <h1 id="plain-title">Preuvance, expliqué simplement</h1>
          <p className="pv-plain-lede">
            Preuvance aide une entreprise à savoir si son système d’intelligence
            artificielle est concerné par le règlement européen sur l’IA
            (l’AI Act), et à préparer un dossier de preuve à montrer à un
            courtier, un assureur ou un investisseur. Preuvance ne délivre ni
            avis juridique, ni certification, ni décision d’assurabilité :
            c’est un outil de préparation, pas un jugement final.
          </p>
        </section>

        <section aria-labelledby="plain-principle">
          <h2 id="plain-principle">Le principe : rien n’est cru sur parole</h2>
          <p>
            Tout ce que Preuvance affirme est contre-vérifié par un second
            mécanisme indépendant. La classification produite par
            l’intelligence artificielle est relue par un moteur de règles qui
            ne dépend d’aucune IA ; votre déclaration d’usage d’IA est comparée
            à ce que votre poste fait réellement. En cas de contradiction, le
            score est plafonné et une revue humaine est demandée. Jamais de
            conclusion rassurante sans preuve.
          </p>
        </section>

        <section aria-labelledby="plain-dossier">
          <h2 id="plain-dossier">Parcours principal : le dossier instantané</h2>
          <p>
            Vous décrivez votre système en français courant et pouvez joindre des
            manifestes pris en charge. Leur contenu reste dans le navigateur :
            seul un digest borné des dépendances IA rejoint l’évaluation.
            Preuvance extrait les faits, classe le contexte à partir d’un
            référentiel daté, contre-vérifie le résultat avec des règles
            déterministes, puis transforme chaque pièce attendue en une ligne
            distincte du dossier.
          </p>
          <p>
            Le registre indique ce qui est <strong>déclaré</strong>, ce qui est
            <strong> détecté</strong>, ce qui manque et ce qui a été
            <strong> attesté</strong> avec un relecteur et une date. Une
            déclaration ou un package détecté ne devient jamais automatiquement
            une preuve. Le PDF reprend le score, les obligations, les écarts, le
            journal de décision et cet inventaire documentaire.
          </p>
          <p>
            Le référentiel distingue toujours le droit déjà en vigueur
            (règlement (UE) 2024/1689) des changements votés mais pas encore
            publiés au Journal officiel, jamais présentés comme déjà obligatoires.
          </p>
          <p>
            <Link className="pv-plain-cta" href="/#evaluation">
              Construire un dossier
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </p>
        </section>

        <section aria-labelledby="plain-scan">
          <h2 id="plain-scan">Source complémentaire : le scan local</h2>
          <p>
            Un programme tourne sur votre ordinateur, sans rien envoyer sur
            Internet. Il vous demande d’abord de <strong>déclarer</strong> les
            outils d’IA que votre organisation utilise sciemment (OpenAI,
            Anthropic, Mistral, etc.). Puis il <strong>observe</strong> la
            réalité du poste : les appels réseau de vos logiciels vers des
            services d’IA connus (par le nom du service contacté, jamais en
            lisant le contenu, qui reste chiffré), et les fichiers sensibles
            présents (clés, certificats, documents financiers, données
            personnelles), par leur nom et une empreinte numérique uniquement,
            <strong> sans jamais lire ni copier leur contenu</strong>.
          </p>
          <p>
            Le résultat clé est la <strong>concordance déclaré / observé</strong> :
          </p>
          <ul>
            <li>
              <strong>Concordant</strong> : l’observation corrobore votre
              déclaration. C’est une déclaration vérifiée, pas une déclaration
              sur l’honneur. C’est exactement ce qu’un assureur attend d’une
              déclaration de risque sincère.
            </li>
            <li>
              <strong>Divergent</strong> signale un usage d’IA observé sans avoir
              été déclaré (« shadow AI ») : l’écart est nommé, expliqué, et fait
              chuter le score tant qu’il n’est pas résolu.
            </li>
            <li>
              <strong>Non contredit</strong> signifie que rien n’a été observé
              qui contredise la déclaration, sans la corroborer non plus ; le mode
              surveillance d’une heure renforce l’observation pendant que vous
              travaillez normalement.
            </li>
          </ul>
          <p>
            Le rapport reste un fichier sur votre disque ; la page
            «&nbsp;Scanner en local&nbsp;» le lit dans votre navigateur, sans
            aucun envoi. Une absence de détection ne prouve jamais une absence
            d’usage : cette limite est écrite dans le rapport lui-même.
          </p>
          <p>
            <Link className="pv-plain-cta" href="/scan">
              Ouvrir le scan local
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </p>
        </section>

        <section aria-labelledby="plain-privacy">
          <h2 id="plain-privacy">Confidentialité</h2>
          <ul>
            <li>Le scan local ne transmet rien sur Internet.</li>
            <li>
              L’évaluation en ligne n’envoie à l’IA que le nom de
              l’organisation, le nom du système et sa description. Jamais vos
              fichiers.
            </li>
            <li>
              Si vous êtes connecté, vos évaluations ne sont visibles que par
              vous et votre organisation.
            </li>
            <li>
              <code>DESINSTALLER_PREUVANCE.cmd</code> supprime tout de votre
              poste (clé, caches, rapports), avec une option de suppression
              complète.
            </li>
          </ul>
        </section>

        <section aria-labelledby="plain-scope">
          <h2 id="plain-scope">Ce que Preuvance ne fait pas (volontairement)</h2>
          <p>
            Pas d’intégration réelle avec un assureur, pas de tarification ni
            de paiement, pas de dossier réglementaire complet automatisé, pas
            de surveillance continue, et surtout aucune promesse de couverture
            d’assurance. Preuvance prépare un dossier ; la décision finale
            revient toujours à un professionnel humain.
          </p>
        </section>
      </main>
    </div>
  );
}
