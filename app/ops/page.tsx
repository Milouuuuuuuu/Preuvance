import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PreparationWorkbench } from "../components/PreparationWorkbench";

/**
 * Console interne d'opérations.
 *
 * Réservée à l'équipe : la page n'existe que si PREUVANCE_OPS=1 dans
 * l'environnement du poste ; sinon 404, comme si la route n'existait pas.
 * Elle est noindex, absente du sitemap et interdite par robots.txt.
 *
 * Esthétique inspirée des interfaces de hacking de fiction (néon sur noir,
 * scanlines), assumée pour l'interne uniquement : le site client reste sobre.
 * Règle absolue : la console affiche la PRÉSENCE d'une variable, jamais sa
 * valeur. Aucun secret ne transite par le rendu.
 */
export const metadata: Metadata = {
  title: "Console ops",
  robots: { index: false, follow: false },
};

type EnvCheck = { name: string; role: string };
type EnvGroup = { label: string; checks: EnvCheck[] };

const ENV_GROUPS: EnvGroup[] = [
  {
    label: "Analyse IA",
    checks: [
      { name: "OPENAI_API_KEY", role: "pipeline GPT-5.6 (sans elle : mode démo seulement)" },
      { name: "OPENAI_REASONING_MODEL", role: "modèle de raisonnement (optionnel)" },
    ],
  },
  {
    label: "Persistance",
    checks: [
      { name: "NEXT_PUBLIC_SUPABASE_URL", role: "projet Supabase" },
      { name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", role: "clé publique navigateur" },
    ],
  },
  {
    label: "Mesure",
    checks: [
      { name: "NEXT_PUBLIC_POSTHOG_KEY", role: "ingestion produit (phc_, sans elle : no-op)" },
      { name: "POSTHOG_PERSONAL_API_KEY", role: "provisionnement des tableaux de bord (phx_)" },
      { name: "POSTHOG_PROJECT_ID", role: "projet cible du script" },
    ],
  },
  {
    label: "Console",
    checks: [
      { name: "PREUVANCE_OPS", role: "existence de cette console (1 = servie)" },
      { name: "NEXT_PUBLIC_APP_URL", role: "origine publique faisant autorité (SEO, JSON-LD)" },
    ],
  },
];

const MISSION_STEPS: Array<{ window: string; label: string }> = [
  { window: "J1-J2", label: "Pack d'accès signé, comptes de lecture seule, périmètre acté" },
  { window: "J3-J5", label: "Collecte machine : agent local ou remise au DBA (--dry-run)" },
  { window: "J6-J8", label: "Analyse, deux entretiens métier, fiches de réversibilité déroulées" },
  { window: "J9-J10", label: "Re-scan final, restitution, remise du catalogue, purge journalisée" },
];

const PROGRAMS: Array<{ cmd: string; role: string }> = [
  { cmd: "npm run inventaire -- --mission mission.json --out sortie", role: "collecte + diagnostic" },
  { cmd: "npm run inventaire -- --mission mission.json --dry-run", role: "pack de requêtes DBA" },
  { cmd: "npm run admin -- --profil profil.json --mission mission.json", role: "six documents de mission" },
  { cmd: "npm run analytics:setup", role: "tableaux de bord PostHog (idempotent)" },
  { cmd: "npm run poste:verifier", role: "vérification du poste (Node, env, pièges)" },
  { cmd: "npm test", role: "porte de vérification complète avant tout commit" },
];

/**
 * Les raccourcis externes pointaient vers le projet analytique et le dépôt du
 * titulaire, en dur. Le code source de cette page part dans l'archive remise à
 * chaque PME : la garde `PREUVANCE_OPS` protège l'exécution, pas le fichier.
 * Ces adresses viennent donc de l'environnement, et le bloc disparaît quand
 * elles ne sont pas renseignées.
 */
function externalLinks(): Array<{ href: string; label: string }> {
  const candidats = [
    { href: process.env.PREUVANCE_OPS_POSTHOG_URL, label: "Tableaux de bord PostHog" },
    { href: process.env.PREUVANCE_OPS_REPO_URL, label: "Dépôt de code" },
  ];
  return candidats.flatMap((c) =>
    c.href?.trim() ? [{ href: c.href.trim(), label: c.label }] : [],
  );
}

export default function OpsPage() {
  if (process.env.PREUVANCE_OPS !== "1") notFound();

  const EXTERNAL_LINKS = externalLinks();

  const groups = ENV_GROUPS.map((group) => ({
    ...group,
    checks: group.checks.map((check) => ({
      ...check,
      present: Boolean(process.env[check.name]),
    })),
  }));

  return (
    <div className="ops-shell">
      <main className="ops-inner" id="contenu">
        <header>
          <p className="ops-topline">
            <span className="ops-dot" aria-hidden="true" />
            <span>console interne (accès équipe)</span>
            <span>preuvance-ops-v1</span>
          </p>
          <h1 className="ops-title">PRVNC//OPS</h1>
          <p className="ops-tagline">
            La preuve, pas la promesse. Ce poste pilote les missions ; rien de ce
            qui s&rsquo;affiche ici n&rsquo;est un secret : présence des clés,
            jamais leur valeur.
          </p>
        </header>

        <div className="ops-grid">
          <section className="ops-panel" aria-labelledby="ops-env">
            <h2 id="ops-env">État du poste</h2>
            {groups.map((group) => (
              <div key={group.label}>
                <p className="ops-note">{group.label}</p>
                <ul className="ops-env">
                  {group.checks.map((check) => (
                    <li key={check.name}>
                      <code title={check.role}>{check.name}</code>
                      <span className={`ops-badge ${check.present ? "is-on" : "is-off"}`}>
                        {check.present ? "présente" : "absente"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="ops-note">
              Une clé absente ne casse rien : chaque module devient no-op ou
              refuse explicitement.
            </p>
          </section>

          <section className="ops-panel" aria-labelledby="ops-mission">
            <h2 id="ops-mission">Mission sur 10 jours ouvrés</h2>
            <ul className="ops-list">
              {MISSION_STEPS.map((step) => (
                <li key={step.window}>
                  <span className="ops-step-window">{step.window}</span>
                  <span>{step.label}</span>
                </li>
              ))}
            </ul>
            <p className="ops-note">
              Runbook complet : docs/operateur-diagnostic.md · pack d&rsquo;accès :
              docs/pack-acces.md
            </p>
          </section>
        </div>

        <PreparationWorkbench />

        <section className="ops-panel" aria-labelledby="ops-programs">
          <h2 id="ops-programs">Programmes</h2>
          {PROGRAMS.map((program) => (
            <div key={program.cmd}>
              <pre className="ops-cmd">{program.cmd}</pre>
              <p className="ops-note">{program.role}</p>
            </div>
          ))}
        </section>

        <section className="ops-panel" aria-labelledby="ops-links">
          <h2 id="ops-links">Accès rapides</h2>
          <div className="ops-links">
            <a href="/diagnostic">Diagnostic (lecture locale)</a>
            <a href="/demo">Dossier de démonstration</a>
            <a href="/scan">Scan local</a>
            {EXTERNAL_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                rel="noreferrer noopener"
                target="_blank"
              >
                {link.label}
              </a>
            ))}
          </div>
          {EXTERNAL_LINKS.length === 0 ? (
            <p className="ops-note">
              Aucun raccourci externe : renseignez PREUVANCE_OPS_POSTHOG_URL et
              PREUVANCE_OPS_REPO_URL dans <code>.env.local</code>.
            </p>
          ) : null}
          <p className="ops-note">
            Cette console est servie uniquement quand PREUVANCE_OPS=1 : en
            production publique, cette URL renvoie 404 et robots.txt
            l&rsquo;interdit par principe.
          </p>
        </section>
      </main>
    </div>
  );
}
