type AssessmentReadyEmail = {
  to: string;
  organizationName: string;
  assessmentId: string;
  score: number;
};

type EmailDeliveryResult =
  | { sent: false; reason: "disabled" }
  | { sent: true; id: string };

export async function sendAssessmentReadyEmail(
  input: AssessmentReadyEmail,
): Promise<EmailDeliveryResult> {
  if (process.env.ENABLE_RESEND !== "true") {
    return { sent: false, reason: "disabled" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error(
      "Resend est activé mais RESEND_API_KEY ou RESEND_FROM_EMAIL est absent.",
    );
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: `Rapport Preuvance prêt — score ${input.score}/100`,
    text: [
      `Le dossier de préparation courtier de ${input.organizationName} est prêt.`,
      `Référence : ${input.assessmentId}.`,
      `Score de préparation : ${input.score}/100.`,
      "Ce résultat est indicatif et ne constitue ni un avis juridique ni une décision d’assurabilité.",
    ].join("\n"),
  });

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Resend n’a retourné aucun identifiant.");
  }

  return { sent: true, id: data.id };
}
