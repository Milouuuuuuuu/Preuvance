import { isSupabaseConfigured } from "@/lib/supabase/env";

import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

type SignInPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
    next?: string | string[];
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = searchParams ? await searchParams : {};
  const nextValue = Array.isArray(params.next) ? params.next[0] : params.next;
  const errorValue = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px 20px",
        background: "#FAFAF7",
        color: "#0B1220",
      }}
    >
      <section style={{ width: "100%", maxWidth: 440 }} aria-labelledby="sign-in-title">
        <p
          style={{
            margin: "0 0 24px",
            color: "#2552F0",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.14em",
          }}
        >
          PREUVANCE
        </p>
        <h1 id="sign-in-title" style={{ margin: "0 0 10px", fontSize: 38, lineHeight: 1.05 }}>
          Accéder à votre espace
        </h1>
        <p style={{ margin: "0 0 28px", color: "#566173", lineHeight: 1.6 }}>
          Recevez un lien sécurisé par e-mail. Aucun mot de passe n’est nécessaire.
        </p>
        <SignInForm
          enabled={isSupabaseConfigured()}
          errorCode={errorValue}
          nextPath={safeRelativePath(nextValue)}
        />
      </section>
    </main>
  );
}

function safeRelativePath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value.startsWith("/auth/") ? "/" : value;
}
