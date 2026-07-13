"use client";

import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type SignInFormProps = {
  enabled: boolean;
  errorCode?: string;
  nextPath: string;
};

type AuthFeedback = {
  action?: {
    href: string;
    label: string;
  };
  kind: "error" | "success";
  text: string;
};

export function SignInForm({ enabled, errorCode, nextPath }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [feedback, setFeedback] = useState<AuthFeedback | null>(() =>
    authErrorFeedback(errorCode, nextPath),
  );
  const visibleFeedback = !enabled
    ? configurationFeedback(nextPath)
    : feedback;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setFeedback(configurationFeedback(nextPath));
      return;
    }

    setStatus("submitting");
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", nextPath);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: callback.toString(),
        shouldCreateUser: true,
        ...(organizationName.trim()
          ? { data: { organization_name: organizationName.trim() } }
          : {}),
      },
    });

    if (error) {
      setStatus("idle");
      setFeedback({
        kind: "error",
        text: "Le lien n’a pas pu être envoyé. Vérifiez l’adresse et réessayez.",
      });
      return;
    }

    setStatus("sent");
    setFeedback({
      kind: "success",
      text: "Lien envoyé. Consultez votre boîte de réception pour continuer.",
    });
  }

  return (
    <form onSubmit={submit} style={formStyle}>
      <label style={labelStyle} htmlFor="organization-name">
        Organisation <span style={{ color: "#475467", fontWeight: 400 }}>(première connexion)</span>
      </label>
      <input
        id="organization-name"
        name="organizationName"
        autoComplete="organization"
        disabled={!enabled || status !== "idle"}
        maxLength={160}
        onChange={(event) => setOrganizationName(event.target.value)}
        placeholder="Nom de votre organisation"
        style={inputStyle}
        value={organizationName}
      />

      <label style={labelStyle} htmlFor="email">
        E-mail professionnel
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        disabled={!enabled || status !== "idle"}
        maxLength={320}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="vous@entreprise.eu"
        style={inputStyle}
        value={email}
      />

      <button
        type="submit"
        disabled={!enabled || status !== "idle" || !email.trim()}
        style={{
          ...buttonStyle,
          opacity: !enabled || status !== "idle" || !email.trim() ? 0.55 : 1,
        }}
      >
        {status === "submitting" ? "Envoi…" : status === "sent" ? "Lien envoyé" : "Recevoir mon lien"}
      </button>

      {visibleFeedback ? (
        <div
          role={visibleFeedback.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          style={noticeStyle}
        >
          <p style={{ margin: 0 }}>{visibleFeedback.text}</p>
          {visibleFeedback.action ? (
            <a href={visibleFeedback.action.href} style={noticeLinkStyle}>
              {visibleFeedback.action.label}
            </a>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function authErrorFeedback(
  code: string | undefined,
  nextPath: string,
): AuthFeedback | null {
  if (!code) return null;
  if (code === "configuration") {
    return configurationFeedback(nextPath);
  }
  if (code === "missing_code") {
    return {
      kind: "error",
      text: "Le lien de connexion est incomplet ou a expiré. Demandez un nouveau lien ci-dessus.",
    };
  }
  return {
    kind: "error",
    text: "La connexion a échoué. Demandez un nouveau lien ci-dessus.",
  };
}

function configurationFeedback(nextPath: string): AuthFeedback {
  return {
    kind: "error",
    text: "Authentification indisponible : les variables Supabase ne sont pas configurées sur cet environnement.",
    action: {
      href: nextPath,
      label:
        nextPath === "/" ? "Revenir à Preuvance" : "Revenir à l’évaluation",
    },
  };
}

const formStyle: CSSProperties = {
  display: "grid",
  padding: 24,
  border: "1px solid #DDE2E8",
  borderRadius: 12,
  background: "#FFFFFF",
  boxShadow: "0 18px 50px rgba(11, 18, 32, 0.08)",
};

const labelStyle: CSSProperties = {
  marginBottom: 7,
  fontSize: 13,
  fontWeight: 700,
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 46,
  boxSizing: "border-box",
  marginBottom: 18,
  padding: "10px 12px",
  border: "1px solid #BFC7D2",
  borderRadius: 7,
  background: "#FFFFFF",
  color: "#0B1220",
  font: "inherit",
};

const buttonStyle: CSSProperties = {
  minHeight: 46,
  border: 0,
  borderRadius: 7,
  background: "#2552F0",
  color: "#FFFFFF",
  cursor: "pointer",
  font: "inherit",
  fontWeight: 800,
};

const noticeStyle: CSSProperties = {
  margin: "14px 0 0",
  color: "#344054",
  fontSize: 13,
  lineHeight: 1.5,
};

const noticeLinkStyle: CSSProperties = {
  display: "inline-block",
  marginTop: 8,
  color: "#173BB6",
  fontWeight: 750,
  textDecoration: "underline",
  textUnderlineOffset: 3,
};
