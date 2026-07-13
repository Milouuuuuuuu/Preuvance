"use client";

import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type SignInFormProps = {
  enabled: boolean;
  errorCode?: string;
  nextPath: string;
};

export function SignInForm({ enabled, errorCode, nextPath }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [message, setMessage] = useState(() => authErrorMessage(errorCode));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setMessage("L’authentification n’est pas configurée sur cet environnement.");
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
      setMessage("Le lien n’a pas pu être envoyé. Vérifiez l’adresse et réessayez.");
      return;
    }

    setStatus("sent");
    setMessage("Lien envoyé. Consultez votre boîte de réception pour continuer.");
  }

  return (
    <form onSubmit={submit} style={formStyle}>
      <label style={labelStyle} htmlFor="organization-name">
        Organisation <span style={{ color: "#778194", fontWeight: 400 }}>(première connexion)</span>
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

      {!enabled ? (
        <p role="status" style={noticeStyle}>
          Authentification indisponible : les variables Supabase ne sont pas configurées.
        </p>
      ) : null}
      {message ? (
        <p role="status" aria-live="polite" style={noticeStyle}>
          {message}
        </p>
      ) : null}
    </form>
  );
}

function authErrorMessage(code?: string) {
  if (!code) return "";
  if (code === "configuration") {
    return "L’authentification n’est pas configurée sur cet environnement.";
  }
  if (code === "missing_code") {
    return "Le lien de connexion est incomplet ou a expiré.";
  }
  return "La connexion a échoué. Demandez un nouveau lien.";
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
  color: "#566173",
  fontSize: 13,
  lineHeight: 1.5,
};
