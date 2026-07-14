import {
  formatFrenchDate,
  getDeadline,
  getRegulatoryReference,
} from "./assessment/regulatory";

export type ReferenceBandEntry = {
  date: string;
  title: string;
  detail: string;
};

export type MarketingReference = {
  verifiedAtDisplay: string;
  disclaimer: string;
  deadlineCallout: {
    day: string;
    monthLabel: string;
    year: string;
    ariaLabel: string;
  };
  band: ReferenceBandEntry[];
};

function compactFrenchDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

/**
 * Toutes les dates affichées sur la page d’accueil proviennent du référentiel
 * app/data/eu-ai-act-reference.json : aucune date réglementaire n’est codée en
 * dur dans la copie marketing.
 */
export function getMarketingReference(): MarketingReference {
  const reference = getRegulatoryReference();
  const art50 = getDeadline("art50-1-human-interaction-disclosure");
  const art50Marking = getDeadline("art50-2-machine-readable-marking");
  const annexIII = getDeadline("high-risk-annex-iii");
  const annexI = getDeadline("high-risk-annex-i");

  const art50Date = art50.bindingPosition.date;
  const [art50Year, , art50Day] = art50Date.split("-");
  const monthLabel = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    timeZone: "UTC",
  })
    .format(new Date(`${art50Date}T00:00:00Z`))
    .toUpperCase();

  return {
    verifiedAtDisplay: formatFrenchDate(reference.metadata.verifiedAt),
    disclaimer: reference.metadata.legalAdviceDisclaimerFr,
    deadlineCallout: {
      day: art50Day ?? "",
      monthLabel,
      year: art50Year ?? "",
      ariaLabel: formatFrenchDate(art50Date),
    },
    band: [
      {
        date: compactFrenchDate(art50Date),
        title: "Article 50",
        detail:
          "Interaction · marquage machine · divulgation de certains contenus synthétiques",
      },
      {
        date: compactFrenchDate(
          art50Marking.signedAmendmentPosition?.date ??
            art50Marking.bindingPosition.date,
        ),
        title: "Systèmes antérieurs",
        detail: "Transition Art. 50(2), si l’Omnibus entre en vigueur",
      },
      {
        date: compactFrenchDate(
          annexIII.signedAmendmentPosition?.date ??
            annexIII.bindingPosition.date,
        ),
        title: "Annexe III",
        detail: "Sous réserve de publication formelle au JO",
      },
      {
        date: compactFrenchDate(
          annexI.signedAmendmentPosition?.date ?? annexI.bindingPosition.date,
        ),
        title: "Annexe I",
        detail: "Sous réserve de publication formelle au JO",
      },
    ],
  };
}
