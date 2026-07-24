import type {
  Catalogue,
  CatalogueDataset,
  CatalogueField,
  FieldSensitivity,
  SensitiveCategory,
} from "./catalogue-contract";

/**
 * Classification déterministe des champs sensibles, à partir du SEUL nom de
 * colonne (et de son type déclaré). Aucune valeur n'est lue : ce classifieur
 * s'exécute sur des métadonnées déjà collectées.
 *
 * Conséquence assumée, à écrire dans le rapport : un champ nommé `champ1`
 * contenant des NIR ne sera pas détecté, et un champ nommé `email_contact`
 * vide sera signalé. Le classifieur pointe des zones à vérifier avec le
 * métier ; il ne prétend pas prouver la présence de données personnelles.
 */
export const SENSITIVITY_RULES_VERSION = "preuvance-sensitivity-v1";

export const SENSITIVITY_LIMIT_NOTE =
  "Les champs sensibles sont détectés d’après le nom de la colonne, jamais d’après son contenu. Un nom neutre masque la donnée qu’il porte : la liste doit être confirmée avec le métier lors des entretiens.";

export type SensitivityRule = {
  id: string;
  category: SensitiveCategory;
  confidence: FieldSensitivity["confidence"];
  /** Fondement du signalement, cité tel quel dans le rapport. */
  basis: string;
  pattern: RegExp;
};

/**
 * Motifs testés contre le nom normalisé encadré de tirets bas
 * (`_date_naissance_`), ce qui donne des frontières de mots fiables sans
 * dépendre de la casse ni des accents.
 */
export const SENSITIVITY_RULES: readonly SensitivityRule[] = [
  {
    id: "identite-nom",
    category: "identifiant_direct",
    confidence: "high",
    basis: "Donnée d’identité : identifie directement une personne physique (art. 4-1 RGPD).",
    pattern:
      /_(nom|prenom|prenoms|nom_complet|nom_usage|nom_naissance|nom_jeune_fille|last_name|first_name|lastname|firstname|full_name|surname|civilite|nom_prenom)_/,
  },
  {
    id: "identite-attributs",
    category: "identifiant_direct",
    confidence: "medium",
    basis: "Attribut d’identité rattachable à une personne physique (art. 4-1 RGPD).",
    pattern:
      /_(date_naissance|datenaissance|birth_date|birthdate|birthday|date_of_birth|dob|lieu_naissance|age|sexe|genre|gender|nationalite|nationality|situation_familiale|etat_civil)_/,
  },
  {
    id: "contact-electronique",
    category: "contact",
    confidence: "high",
    basis: "Donnée de contact : personnelle dès qu’elle désigne une personne physique (art. 4-1 RGPD).",
    pattern: /_(email|e_mail|mail|courriel|telephone|tel|mobile|portable|fax|gsm)_/,
  },
  {
    id: "contact-postal",
    category: "contact",
    confidence: "medium",
    basis: "Adresse postale : donnée personnelle lorsqu’elle vise une personne physique (art. 4-1 RGPD).",
    pattern:
      /_(adresse|adresse_1|adresse_2|address|street|rue|code_postal|codepostal|cp|zip|zipcode|postal_code|ville|city|commune)_/,
  },
  {
    id: "identifiant-national",
    category: "identifiant_national",
    confidence: "high",
    basis: "Numéro national d’identification : usage strictement encadré (art. 87 RGPD, art. 30 loi Informatique et Libertés).",
    pattern:
      /_(nir|numero_secu|num_secu|securite_sociale|secu|ssn|social_security|numero_passeport|passeport|passport|carte_identite|cni|numero_permis|permis_conduire|national_id)_/,
  },
  {
    id: "donnee-bancaire",
    category: "donnee_bancaire",
    confidence: "high",
    basis: "Coordonnées bancaires ou de paiement : sécurité renforcée exigée (art. 32 RGPD, PCI-DSS pour les cartes).",
    pattern:
      /_(iban|bic|swift|rib|numero_compte|compte_bancaire|bank_account|carte_bancaire|numero_carte|card_number|cardnumber|pan|cvv|cvc|crypto_carte|date_expiration_carte)_/,
  },
  {
    id: "donnee-rh",
    category: "donnee_rh",
    confidence: "high",
    basis: "Donnée de gestion du personnel : finalité et durée de conservation propres (art. 5-1-b et 5-1-e RGPD).",
    pattern:
      /_(salaire|salary|remuneration|paie|payroll|bulletin_paie|matricule|matricule_salarie|contrat_travail|anciennete|conge|conges|rtt|absence|entretien_annuel|evaluation_annuelle)_/,
  },
  {
    id: "donnee-sante",
    category: "donnee_sensible_art9",
    confidence: "high",
    basis: "Donnée de santé : catégorie particulière, traitement interdit sauf exception (art. 9 RGPD).",
    pattern:
      /_(sante|health|medical|medicale|pathologie|maladie|diagnostic_medical|handicap|invalidite|arret_maladie|traitement_medical|ordonnance|mutuelle|medecin_traitant|groupe_sanguin)_/,
  },
  {
    id: "donnee-art9-convictions",
    category: "donnee_sensible_art9",
    confidence: "high",
    basis: "Opinion, conviction, appartenance syndicale, origine ou vie sexuelle : catégorie particulière (art. 9 RGPD).",
    pattern:
      /_(religion|confession|opinion_politique|parti_politique|appartenance_syndicale|syndicat|syndicale|origine_ethnique|origine_raciale|ethnie|orientation_sexuelle|vie_sexuelle|conviction_philosophique)_/,
  },
  {
    id: "donnee-art9-biometrie",
    category: "donnee_sensible_art9",
    confidence: "high",
    basis: "Donnée biométrique ou génétique d’identification : catégorie particulière (art. 9 RGPD).",
    pattern:
      /_(biometrie|biometrique|empreinte_digitale|reconnaissance_faciale|face_id|iris_scan|donnee_genetique|genetique|adn)_/,
  },
  {
    id: "donnee-mineur",
    category: "donnee_mineur",
    confidence: "medium",
    basis: "Donnée relative à un mineur : consentement et protection renforcés (art. 8 RGPD).",
    pattern:
      /_(mineur|mineurs|tuteur_legal|responsable_legal|autorite_parentale|nom_parent|eleve|scolarite)_/,
  },
  {
    id: "secret-technique",
    category: "secret_technique",
    confidence: "high",
    basis: "Secret d’authentification : ne doit jamais être stocké en clair ni exporté (art. 32 RGPD).",
    pattern:
      /_(password|passwd|pwd|mot_de_passe|motdepasse|mdp|api_key|apikey|cle_api|secret|secret_key|client_secret|token|access_token|refresh_token|private_key|cle_privee|salt|otp|code_pin|pin_code)_/,
  },
  {
    id: "localisation",
    category: "localisation",
    confidence: "medium",
    basis: "Donnée de localisation ou adresse IP : personnelle et traçante (art. 4-1 RGPD, CJUE C-582/14 Breyer).",
    pattern:
      /_(latitude|longitude|gps|geoloc|geolocalisation|coordonnees_gps|adresse_ip|ip_address|ip|position_gps|trace_gps)_/,
  },
];

/**
 * Exclusions appliquées AVANT les règles : ces noms contiennent un mot
 * déclencheur mais désignent un objet technique ou une personne morale.
 * Sans elles, `nom_fichier` ou `nom_produit` gonfleraient artificiellement le
 * nombre de champs personnels et décrédibiliseraient le rapport.
 */
export const SENSITIVITY_EXCLUSIONS: readonly { id: string; pattern: RegExp }[] = [
  {
    id: "objet-technique",
    pattern:
      /_(nom|name)_(fichier|file|table|colonne|column|champ|field|base|schema|module|projet|project|produit|product|categorie|category|marque|brand|page|serveur|server|domaine|domain|classe|class|methode|methode|role|groupe|group|etat|statut|status|type|modele|model|dossier|repertoire|image|photo|logo|onglet|feuille|sheet)_/,
  },
  {
    id: "objet-technique-suffixe",
    pattern:
      /_(fichier|file|table|colonne|column|champ|field|module|produit|product|categorie|category|marque|brand|serveur|server|domaine|domain|societe|entreprise|fournisseur|magasin|entrepot|depot|projet|project|tache|task|document|rapport|modele|model|template|evenement|event|page|site)_(nom|name)_/,
  },
  {
    id: "personne-morale",
    pattern:
      /_(raison_sociale|nom_societe|nom_entreprise|company_name|denomination_sociale|nom_commercial|enseigne)_/,
  },
  {
    id: "empreinte-technique",
    pattern: /_(empreinte|hash|checksum|digest)_(fichier|file|sha256|sha1|md5|contenu)_/,
  },
  {
    id: "identifiant-interne",
    pattern:
      /^_(id|rowid|uuid|guid|fk|pk|ref|reference|code|numero|num)_(client|commande|facture|produit|ligne|entite|objet|document|dossier|projet|tache)_$/,
  },
];

/** Normalise un nom de colonne : camelCase séparé, accents retirés, bornes explicites. */
export function normalizeFieldName(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Za-z])([0-9])/g, "$1_$2")
    .replace(/([0-9])([A-Za-z])/g, "$1_$2");
  const ascii = spaced
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const core = ascii
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");
  return core === "" ? "_" : `_${core}_`;
}

export type SensitivityMatch = FieldSensitivity & { ruleIds: string[] };

/**
 * Classe un nom de champ. Retourne `null` quand rien n'est détecté : l'absence
 * de détection n'est jamais présentée comme une preuve d'absence de donnée
 * personnelle.
 */
export function classifyFieldName(name: string): SensitivityMatch | null {
  const normalized = normalizeFieldName(name);
  if (normalized === "_") return null;

  for (const exclusion of SENSITIVITY_EXCLUSIONS) {
    if (exclusion.pattern.test(normalized)) return null;
  }

  const matched = SENSITIVITY_RULES.filter((rule) => rule.pattern.test(normalized));
  if (matched.length === 0) return null;

  const categories: SensitiveCategory[] = [];
  for (const rule of matched) {
    if (!categories.includes(rule.category)) categories.push(rule.category);
  }

  return {
    categories: categories.slice(0, 6),
    ruleIds: matched.map((rule) => rule.id).slice(0, 10),
    confidence: matched.some((rule) => rule.confidence === "high") ? "high" : "medium",
    basis: matched
      .map((rule) => rule.basis)
      .filter((basis, index, list) => list.indexOf(basis) === index)
      .join(" ")
      .slice(0, 300),
  };
}

/**
 * Jeux de données dont l'objet n'est pas une personne. Un champ `nom` dans
 * `produits` désigne un produit : le signalement est conservé (le métier doit
 * trancher) mais sa confiance est abaissée et la raison est écrite.
 */
const NON_PERSON_DATASET_PATTERN =
  /_(produit|produits|product|products|article|articles|item|items|stock|stocks|entrepot|warehouse|categorie|categories|category|tarif|tarifs|price|prices|taxe|taxes|tax|devise|devises|currency|pays|country|region|regions|module|modules|parametre|parametres|parameter|config|configuration|setting|settings|log|logs|audit|journal|migration|migrations|sequence|cache|session|sessions|template|templates|modele|modeles|model|unite|unites|unit|type|types|statut|statuts|status|etat|etats|societe|societes|company|companies|entreprise|entreprises|fournisseur|fournisseurs|supplier|suppliers)_/;

const AMBIGUOUS_IDENTITY_ONLY = /^_(nom|name|prenom|civilite)_$/;

export function annotateField(
  field: CatalogueField,
  datasetName?: string,
): CatalogueField {
  const sensitivity = classifyFieldName(field.name);
  if (!sensitivity) return { ...field, sensitivity: null };

  const ambiguous =
    AMBIGUOUS_IDENTITY_ONLY.test(normalizeFieldName(field.name)) &&
    datasetName !== undefined &&
    NON_PERSON_DATASET_PATTERN.test(normalizeFieldName(datasetName));

  if (!ambiguous) return { ...field, sensitivity };

  return {
    ...field,
    sensitivity: {
      ...sensitivity,
      confidence: "medium",
      basis: `${sensitivity.basis} Nom porté par un jeu de données qui ne décrit pas des personnes : à confirmer avec le métier.`.slice(
        0,
        300,
      ),
    },
  };
}

export function annotateDataset(dataset: CatalogueDataset): CatalogueDataset {
  return {
    ...dataset,
    fields: dataset.fields.map((field) => annotateField(field, dataset.name)),
  };
}

/** Applique la classification à tout le catalogue, sans autre modification. */
export function annotateCatalogue(catalogue: Catalogue): Catalogue {
  return { ...catalogue, datasets: catalogue.datasets.map(annotateDataset) };
}

export type SensitivitySummary = {
  fieldsTotal: number;
  fieldsSensitive: number;
  datasetsWithPersonalData: number;
  datasetsWithSpecialCategories: number;
  datasetsWithSecrets: number;
  byCategory: Array<{ category: SensitiveCategory; fields: number; datasets: number }>;
};

const PERSONAL_CATEGORIES: readonly SensitiveCategory[] = [
  "identifiant_direct",
  "contact",
  "identifiant_national",
  "donnee_bancaire",
  "donnee_rh",
  "donnee_sensible_art9",
  "donnee_mineur",
  "localisation",
];

export function isPersonalCategory(category: SensitiveCategory): boolean {
  return PERSONAL_CATEGORIES.includes(category);
}

/** Agrégats utilisés par le moteur de diagnostic et par le digest. */
export function summariseSensitivity(catalogue: Catalogue): SensitivitySummary {
  const perCategoryFields = new Map<SensitiveCategory, number>();
  const perCategoryDatasets = new Map<SensitiveCategory, Set<string>>();
  let fieldsTotal = 0;
  let fieldsSensitive = 0;
  const datasetsPersonal = new Set<string>();
  const datasetsSpecial = new Set<string>();
  const datasetsSecrets = new Set<string>();

  for (const dataset of catalogue.datasets) {
    for (const field of dataset.fields) {
      fieldsTotal += 1;
      const sensitivity = field.sensitivity;
      if (!sensitivity) continue;
      fieldsSensitive += 1;
      for (const category of sensitivity.categories) {
        perCategoryFields.set(category, (perCategoryFields.get(category) ?? 0) + 1);
        const datasets = perCategoryDatasets.get(category) ?? new Set<string>();
        datasets.add(dataset.id);
        perCategoryDatasets.set(category, datasets);
        if (isPersonalCategory(category)) datasetsPersonal.add(dataset.id);
        if (category === "donnee_sensible_art9") datasetsSpecial.add(dataset.id);
        if (category === "secret_technique") datasetsSecrets.add(dataset.id);
      }
    }
  }

  const byCategory = [...perCategoryFields.entries()]
    .map(([category, fields]) => ({
      category,
      fields,
      datasets: perCategoryDatasets.get(category)?.size ?? 0,
    }))
    .sort((a, b) => b.fields - a.fields || a.category.localeCompare(b.category));

  return {
    fieldsTotal,
    fieldsSensitive,
    datasetsWithPersonalData: datasetsPersonal.size,
    datasetsWithSpecialCategories: datasetsSpecial.size,
    datasetsWithSecrets: datasetsSecrets.size,
    byCategory,
  };
}

export const SENSITIVE_CATEGORY_LABELS: Record<SensitiveCategory, string> = {
  identifiant_direct: "identité",
  contact: "coordonnées",
  identifiant_national: "identifiant national",
  donnee_bancaire: "coordonnées bancaires",
  donnee_rh: "gestion du personnel",
  donnee_sensible_art9: "catégorie particulière (art. 9)",
  donnee_mineur: "données de mineurs",
  secret_technique: "secret d’authentification",
  localisation: "localisation",
  autre: "autre donnée sensible",
};
