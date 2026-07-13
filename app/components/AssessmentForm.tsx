"use client";

import { useId } from "react";
import { ArrowRight, Building2, CircleAlert, FileText } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { AssessmentRequest } from "./assessment-types";

type AssessmentFormProps = {
  error: string | null;
  initialValue?: AssessmentRequest | null;
  isSubmitting: boolean;
  onSubmit: (payload: AssessmentRequest) => void;
};

const MIN_DESCRIPTION_LENGTH = 50;

function isNonNegativeNumber(value: string) {
  const normalized = value.trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0;
}

const assessmentFormSchema = z.object({
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
    .refine((value) => Number(value.replace(",", ".")) <= 1_000_000_000, "Le montant déclaré est trop élevé."),
  balanceSheetTotal: z
    .string()
    .trim()
    .refine(isNonNegativeNumber, "Renseignez un total de bilan valide.")
    .refine((value) => Number(value.replace(",", ".")) <= 1_000_000_000, "Le montant déclaré est trop élevé."),
});

type AssessmentFormValues = z.infer<typeof assessmentFormSchema>;

export function AssessmentForm({
  error,
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
    const revenueInMillions = Number(values.annualRevenue.replace(",", "."));
    const balanceInMillions = Number(values.balanceSheetTotal.replace(",", "."));
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

  const validationError = Object.values(errors)
    .map((fieldError) => fieldError?.message)
    .find((message): message is string => typeof message === "string");
  const visibleError = validationError ?? error;

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
            aria-invalid={Boolean(errors.organizationName)}
            placeholder="Ex. Atelier Horizon"
            required
            disabled={isSubmitting}
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
            aria-invalid={Boolean(errors.systemName)}
            placeholder="Ex. Assistant service client"
            required
            disabled={isSubmitting}
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
          aria-describedby={`${descriptionId}-hint`}
          aria-invalid={Boolean(errors.description)}
          required
          disabled={isSubmitting}
        />
        <p className="pv-field-hint" id={`${descriptionId}-hint`}>
          Écrivez comme vous l’expliqueriez à un collègue. Aucun questionnaire
          réglementaire à préparer.
        </p>
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
              aria-invalid={Boolean(errors.employees)}
              placeholder="120"
              required
              disabled={isSubmitting}
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
                aria-invalid={Boolean(errors.annualRevenue)}
                placeholder="24"
                required
                disabled={isSubmitting}
              />
              <span>M€</span>
            </div>
          </div>
          <div className="pv-field-group">
            <label htmlFor={balanceId}>Total du bilan</label>
            <div className="pv-input-unit">
              <input
                id={balanceId}
                type="text"
                inputMode="decimal"
                {...register("balanceSheetTotal")}
                aria-invalid={Boolean(errors.balanceSheetTotal)}
                placeholder="18"
                required
                disabled={isSubmitting}
              />
              <span>M€</span>
            </div>
          </div>
        </div>
        <p className="pv-field-hint">
          Ces données servent uniquement à déterminer le régime PME ou SMC
          applicable.
        </p>
      </fieldset>

      {visibleError ? (
        <div className="pv-form-error" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <span>{visibleError}</span>
        </div>
      ) : null}

      <button className="pv-primary-button pv-submit-button" type="submit" disabled={isSubmitting}>
        <span>{isSubmitting ? "Analyse en cours…" : "Évaluer mon système"}</span>
        <ArrowRight size={18} aria-hidden="true" />
      </button>

      <p className="pv-confidentiality-note">
        Ne transmettez aucune donnée personnelle ni secret métier. La requête
        est envoyée à l’API OpenAI pour produire l’évaluation.
      </p>
    </form>
  );
}
