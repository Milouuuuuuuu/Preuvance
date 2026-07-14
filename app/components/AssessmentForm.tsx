"use client";

import { useId } from "react";
import { ArrowRight, Building2, CircleAlert, FileText } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { AssessmentRequest } from "./assessment-types";

type AssessmentFormProps = {
  error: string | null;
  errorAction?: {
    href: string;
    label: string;
  } | null;
  initialValue?: AssessmentRequest | null;
  isSubmitting: boolean;
  onSubmit: (payload: AssessmentRequest) => void;
};

const MIN_DESCRIPTION_LENGTH = 50;

export function parseMillionsInput(value: string): number | null {
  const normalized = value
    .trim()
    .replace(/[\s  ]/g, "")
    .replaceAll(",", ".");
  if (!normalized || (normalized.match(/\./g) ?? []).length > 1) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isNonNegativeNumber(value: string) {
  return parseMillionsInput(value) !== null;
}

export const assessmentFormSchema = z.object({
  organizationName: z.string().trim().min(2, "Renseignez le nom de l’organisation.").max(160),
  systemName: z.string().trim().min(2, "Renseignez le nom du système évalué.").max(160),
  description: z
    .string()
    .trim()
    .min(
      MIN_DESCRIPTION_LENGTH,
      `Décrivez votre système en au moins ${MIN_DESCRIPTION_LENGTH} caractères.`,
    )
    .max(5_000),
  employees: z
    .string()
    .trim()
    .regex(/^\d+$/, "Renseignez un effectif entier positif ou nul.")
    .refine((value) => Number(value) <= 10_000_000, "L’effectif déclaré est trop élevé."),
  annualRevenue: z
    .string()
    .trim()
    .refine(isNonNegativeNumber, "Renseignez un chiffre d’affaires valide.")
    .refine((value) => (parseMillionsInput(value) ?? Infinity) <= 1_000_000_000, "Le montant déclaré est trop élevé."),
  balanceSheetTotal: z
    .string()
    .trim()
    .refine(isNonNegativeNumber, "Renseignez un total de bilan valide.")
    .refine((value) => (parseMillionsInput(value) ?? Infinity) <= 1_000_000_000, "Le montant déclaré est trop élevé."),
});

type AssessmentFormValues = z.infer<typeof assessmentFormSchema>;

function describedBy(...ids: Array<string | false | null | undefined>) {
  const value = ids.filter((id): id is string => Boolean(id)).join(" ");
  return value || undefined;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p className="pv-field-error" id={id}>
      {message}
    </p>
  ) : null;
}

export function AssessmentForm({
  error,
  errorAction,
  initialValue,
  isSubmitting,
  onSubmit,
}: AssessmentFormProps) {
  const organizationNameId = useId();
  const systemNameId = useId();
  const descriptionId = useId();
  const employeesId = useId();
  const revenueId = useId();
  const balanceId = useId();
  const companyHintId = useId();
  const organizationErrorId = `${organizationNameId}-error`;
  const systemErrorId = `${systemNameId}-error`;
  const descriptionHintId = `${descriptionId}-hint`;
  const descriptionErrorId = `${descriptionId}-error`;
  const employeesErrorId = `${employeesId}-error`;
  const revenueErrorId = `${revenueId}-error`;
  const balanceErrorId = `${balanceId}-error`;
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AssessmentFormValues>({
    resolver: zodResolver(assessmentFormSchema),
    defaultValues: {
      organizationName: initialValue?.organizationName ?? "",
      systemName: initialValue?.systemName ?? "",
      description: initialValue?.description ?? "",
      employees: initialValue ? String(initialValue.company.employees) : "",
      annualRevenue: initialValue
        ? String(initialValue.company.annualRevenue / 1_000_000).replace(".", ",")
        : "",
      balanceSheetTotal: initialValue
        ? String(initialValue.company.balanceSheetTotal / 1_000_000).replace(".", ",")
        : "",
    },
  });
  const description = watch("description") ?? "";

  function submit(values: AssessmentFormValues) {
    const revenueInMillions = parseMillionsInput(values.annualRevenue) ?? 0;
    const balanceInMillions = parseMillionsInput(values.balanceSheetTotal) ?? 0;
    onSubmit({
      organizationName: values.organizationName.trim(),
      systemName: values.systemName.trim(),
      description: values.description.trim(),
      company: {
        employees: Number(values.employees),
        annualRevenue: Math.round(revenueInMillions * 1_000_000),
        balanceSheetTotal: Math.round(balanceInMillions * 1_000_000),
      },
    });
  }

  return (
    <form className="pv-assessment-form" onSubmit={handleSubmit(submit)} noValidate>
      <div className="pv-form-heading">
        <div className="pv-form-icon" aria-hidden="true">
          <FileText size={20} />
        </div>
        <div>
          <p className="pv-kicker">Évaluation guidée</p>
          <h2>Décrivez votre système d’IA</h2>
        </div>
      </div>

      <div className="pv-field-grid pv-identity-grid">
        <div className="pv-field-group">
          <label htmlFor={organizationNameId}>Organisation</label>
          <input
            id={organizationNameId}
            type="text"
            autoComplete="organization"
            minLength={2}
            maxLength={160}
            {...register("organizationName")}
            aria-describedby={
              errors.organizationName ? organizationErrorId : undefined
            }
            aria-invalid={Boolean(errors.organizationName)}
            placeholder="Ex. Atelier Horizon"
            required
            disabled={isSubmitting}
          />
          <FieldError
            id={organizationErrorId}
            message={errors.organizationName?.message}
          />
        </div>
        <div className="pv-field-group">
          <label htmlFor={systemNameId}>Système évalué</label>
          <input
            id={systemNameId}
            type="text"
            minLength={2}
            maxLength={160}
            {...register("systemName")}
            aria-describedby={errors.systemName ? systemErrorId : undefined}
            aria-invalid={Boolean(errors.systemName)}
            placeholder="Ex. Assistant service client"
            required
            disabled={isSubmitting}
          />
          <FieldError
            id={systemErrorId}
            message={errors.systemName?.message}
          />
        </div>
      </div>

      <div className="pv-field-group">
        <div className="pv-label-row">
          <label htmlFor={descriptionId}>Description libre</label>
          <span aria-hidden="true">{description.trim().length} caractères</span>
        </div>
        <textarea
          id={descriptionId}
          {...register("description")}
          placeholder="Expliquez ce que fait le système, à qui il s’adresse, quelles données il traite et quelles décisions ou recommandations il produit."
          rows={7}
          minLength={MIN_DESCRIPTION_LENGTH}
          maxLength={5000}
          aria-describedby={describedBy(
            descriptionHintId,
            errors.description && descriptionErrorId,
          )}
          aria-invalid={Boolean(errors.description)}
          required
          disabled={isSubmitting}
        />
        <p className="pv-field-hint" id={descriptionHintId}>
          Écrivez comme vous l’expliqueriez à un collègue. Aucun questionnaire
          réglementaire à préparer.
        </p>
        <FieldError
          id={descriptionErrorId}
          message={errors.description?.message}
        />
        <details className="pv-guidance">
          <summary>Votre description est encore vague ? Quatre points à préciser</summary>
          <ul>
            <li>Qui utilise le système et quelles personnes sont concernées ?</li>
            <li>Quelles décisions, recommandations ou contenus produit-il ?</li>
            <li>Quelles données traite-t-il, notamment personnelles ou biométriques ?</li>
            <li>Quel contrôle humain intervient avant que la sortie produise un effet ?</li>
          </ul>
        </details>
      </div>

      <fieldset className="pv-company-fields">
        <legend>
          <Building2 size={16} aria-hidden="true" />
          Profil de l’entreprise
        </legend>
        <div className="pv-field-grid">
          <div className="pv-field-group">
            <label htmlFor={employeesId}>Effectif</label>
            <input
              id={employeesId}
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              {...register("employees")}
              aria-describedby={describedBy(
                companyHintId,
                errors.employees && employeesErrorId,
              )}
              aria-invalid={Boolean(errors.employees)}
              placeholder="120"
              required
              disabled={isSubmitting}
            />
            <FieldError
              id={employeesErrorId}
              message={errors.employees?.message}
            />
          </div>
          <div className="pv-field-group">
            <label htmlFor={revenueId}>CA annuel</label>
            <div className="pv-input-unit">
              <input
                id={revenueId}
                type="text"
                inputMode="decimal"
                {...register("annualRevenue")}
                aria-describedby={describedBy(
                  companyHintId,
                  errors.annualRevenue && revenueErrorId,
                )}
                aria-invalid={Boolean(errors.annualRevenue)}
                placeholder="24"
                required
                disabled={isSubmitting}
              />
              <span>M€</span>
            </div>
            <FieldError
              id={revenueErrorId}
              message={errors.annualRevenue?.message}
            />
          </div>
          <div className="pv-field-group">
            <label htmlFor={balanceId}>Total du bilan</label>
            <div className="pv-input-unit">
              <input
                id={balanceId}
                type="text"
                inputMode="decimal"
                {...register("balanceSheetTotal")}
                aria-describedby={describedBy(
                  companyHintId,
                  errors.balanceSheetTotal && balanceErrorId,
                )}
                aria-invalid={Boolean(errors.balanceSheetTotal)}
                placeholder="18"
                required
                disabled={isSubmitting}
              />
              <span>M€</span>
            </div>
            <FieldError
              id={balanceErrorId}
              message={errors.balanceSheetTotal?.message}
            />
          </div>
        </div>
        <p className="pv-field-hint" id={companyHintId}>
          Ces chiffres servent à préqualifier le régime PME ou SMC applicable.
        </p>
      </fieldset>

      {error ? (
        <div className="pv-form-error" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <div>
            <span>{error}</span>
            {errorAction ? (
              <a href={errorAction.href}>{errorAction.label}</a>
            ) : null}
          </div>
        </div>
      ) : null}

      <button className="pv-primary-button pv-submit-button" type="submit" disabled={isSubmitting}>
        <span>{isSubmitting ? "Analyse en cours…" : "Évaluer mon système"}</span>
        <ArrowRight size={18} aria-hidden="true" />
      </button>

      <p className="pv-confidentiality-note">
        Pour produire l’évaluation, Preuvance envoie à l’API OpenAI le nom de
        l’organisation, le nom du système, la description, puis les faits et la
        préqualification qui en sont dérivés. Si vous êtes connecté,
        l’évaluation est enregistrée dans votre espace. Ne saisissez ni donnée
        personnelle ni secret métier. <a href="#confidentialite">En savoir plus</a>.
      </p>
    </form>
  );
}
