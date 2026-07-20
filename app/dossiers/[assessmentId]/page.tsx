import type { Metadata } from "next";
import Link from "next/link";

import { Brand } from "@/app/components/Brand";
import { DossierViewer } from "@/app/components/DossierViewer";
import type { Assessment } from "@/app/components/assessment-types";
import { validatePreuvanceAssessment } from "@/lib/pdf/assessment-payload";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dossier de maîtrise IA",
  robots: { index: false, follow: false },
};

type DossierPageProps = {
  params: Promise<{ assessmentId: string }>;
};

export default async function DossierPage({ params }: DossierPageProps) {
  const { assessmentId } = await params;
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return <DossierMessage title="Espace indisponible" detail="Configurez Supabase pour reprendre un dossier enregistré." />;
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return (
      <DossierMessage
        title="Connexion requise"
        detail="Ce dossier est privé. Connectez-vous avec le compte de son organisation."
        action={{
          href: `/auth/sign-in?next=${encodeURIComponent(`/dossiers/${assessmentId}`)}`,
          label: "Se connecter",
        }}
      />
    );
  }

  const { data, error } = await supabase
    .from("assessments")
    .select("id, ai_system_id, structured_facts, classification, gaps, report_payload, score, tier, created_at, completed_at")
    .eq("id", assessmentId)
    .eq("status", "completed")
    .maybeSingle();

  if (error) {
    console.error("[PREUVANCE] dossier.lookup_failed", error.code);
    return <DossierMessage title="Dossier indisponible" detail="Le dossier n’a pas pu être chargé. Réessayez dans un instant." />;
  }
  if (!data?.report_payload) {
    return <DossierMessage title="Dossier introuvable" detail="Ce dossier n’existe pas ou votre organisation n’y a pas accès." />;
  }

  const report = validatePreuvanceAssessment(data.report_payload);
  if (!report.success || report.data.assessmentId !== data.id) {
    console.error("[PREUVANCE] dossier.report_invalid", data.id);
    return <DossierMessage title="Dossier invalide" detail="Le rapport enregistré ne respecte plus le contrat attendu." />;
  }

  const assessment: Assessment = {
    id: data.id,
    generatedAt: data.completed_at ?? data.created_at,
    facts: data.structured_facts,
    classification: data.classification,
    gaps: data.gaps,
    score: {
      overall: data.score,
      tier: data.tier,
      dimensions: report.data.dimensions.map((dimension) => ({
        label: dimension.name,
        score: dimension.score,
        detail: dimension.finding,
      })),
      methodVersion: report.data.methodology?.version,
    },
    decisionLog: report.data.decisionLog,
    crossCheck: report.data.crossCheck,
    report: report.data,
    metadata: {
      regulatoryReferenceVerifiedAt: report.data.lastRegulatoryVerification,
    },
    persistence: {
      status: "persisted",
      assessmentId: data.id,
      aiSystemId: data.ai_system_id,
    },
  };

  return (
    <div className="pv-dossier-page">
      <header className="pv-dossier-header">
        <Link href="/" aria-label="Retour à l’accueil Preuvance">
          <Brand />
        </Link>
        <nav aria-label="Navigation du dossier">
          <Link href="/#evaluation">Nouveau dossier</Link>
          <Link href="/build-week">Mode présentation</Link>
        </nav>
      </header>
      <main>
        <DossierViewer assessment={assessment} />
      </main>
    </div>
  );
}

function DossierMessage({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: { href: string; label: string };
}) {
  return (
    <main className="pv-dossier-message">
      <Brand />
      <p className="pv-kicker">Dossier privé</p>
      <h1>{title}</h1>
      <p>{detail}</p>
      <div>
        {action ? (
          <Link className="pv-primary-button" href={action.href}>
            {action.label}
          </Link>
        ) : null}
        <Link className="pv-secondary-button" href="/">
          Retour à l’accueil
        </Link>
      </div>
    </main>
  );
}
