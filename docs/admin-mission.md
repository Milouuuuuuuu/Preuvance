# Environnement administratif d'une mission

Une mission de diagnostic produit six documents administratifs. Écrits à la
main, ils divergent : le périmètre du contrat n'est plus celui de la lettre de
mission, la facture porte une mention de TVA périmée, le registre oublie une
source ajoutée en cours de route.

Ici, les six documents sont **dérivés des deux mêmes fichiers** — le profil
administratif et le fichier de mission de l'agent. Ils ne peuvent donc pas se
contredire, et changer d'entité émettrice met tout à jour d'un coup.

```bash
npm run admin -- --profil profil.json --mission mission.json --out documents
npm run admin -- --profil profil.json --emettre facture --numero PV-2026-0007
npm run admin -- --profil profil.json --mission mission.json --emettre attestation \
  --journal-purge sortie/journal-suppression.json --catalogue sortie/preuvance-catalogue.json
npm run admin -- --self-test
npm run admin:demo          # profil et mission fictifs, versionnés
```

Chaque document sort en Markdown (reprise, courriel, dépôt) et en HTML autonome
imprimable en PDF depuis le navigateur — sans script, sans ressource distante,
sans envoi.

## 1. Les six documents

| Clé | Document | Quand | Ce qu'il évite |
| --- | --- | --- | --- |
| `lettre` | Lettre de mission (vaut devis) | Avant J1 | Un périmètre oral, un délai qui court avant le pack d'accès |
| `pack` | Checklist du pack d'accès | Avant J1 | Les deux semaines perdues à attendre des credentials |
| `dpa` | Contrat de sous-traitance (art. 28 RGPD) | Avant la collecte | Un traitement de données sans acte écrit |
| `registre` | Registre des traitements du sous-traitant (art. 30.2) | Tenu en continu | La pièce que la CNIL demande en premier lors d'un contrôle |
| `facture` | Facture | À la restitution | Une mention de TVA fausse, une numérotation trouée |
| `attestation` | Attestation de fin de mission | À la restitution | Une suppression promise mais invérifiable |

`dpa`, `registre`, `pack` et `attestation` exigent `--mission` : leur contenu
vient du périmètre réel de la mission, pas d'un modèle figé.

## 2. Le profil administratif

Un seul fichier JSON, sans aucun secret — identité, adresse, régime de TVA et
IBAN figurent déjà sur une facture :

```jsonc
{
  "entity": {
    "profileVersion": "preuvance-admin-profile-v1",
    "legalName": "…",
    "form": "micro_entreprise_fr",        // ou sarl_ch, sasu_fr…
    "country": "FR",                       // FR ou CH
    "registrationLabel": "SIRET",          // IDE pour une société suisse
    "registrationValue": "…",
    "vatRegime": "franchise_en_base_fr",   // pilote toutes les mentions fiscales
    "address": { "line1": "…", "postalCode": "…", "city": "…", "country": "France" },
    "email": "…", "representative": "…",
    "currency": "EUR",                     // EUR ou CHF
    "paymentTermsDays": 30,
    "bank": { "holder": "…", "iban": "…" }
  },
  "client":  { "legalName": "…", "isBusiness": true, "country": "FR", "address": { … } },
  "engagement": {
    "reference": "PVD-2026-001",           // même référence que le fichier de mission
    "subject": "Diagnostic complet des sources de données",
    "issuedOn": "2026-07-25T09:00:00.000Z",
    "workingDays": 10,
    "lines": [ { "label": "…", "quantity": 1, "unit": "forfait", "unitPriceCents": 450000 } ]
  }
}
```

Les montants sont en **centimes entiers** : aucune arithmétique flottante sur de
l'argent, donc aucun écart d'un centime entre le devis et la facture.

Modèle de départ : [`demo/diagnostic/profil-admin.json`](../demo/diagnostic/profil-admin.json).
Le profil réel, lui, n'a pas à vivre dans ce dépôt public.

## 3. Le moteur de mentions fiscales

`vatRegime` et le pays du client déterminent, à eux seuls, le taux, les mentions
et les obligations déclarées. Le tableau est dans
[`lib/admin/invoicing.ts`](../lib/admin/invoicing.ts) et chaque règle cite son
fondement avec un lien vérifiable.

| Émetteur | Client | Taux | Mention principale | Signalé en plus |
| --- | --- | --- | --- | --- |
| FR franchise en base | FR | 0 % | art. 293 B CGI | surveiller le seuil |
| FR franchise en base | UE, assujetti | 0 % | art. 293 B + autoliquidation art. 283, 2 CGI | numéro de TVA intracommunautaire et DES nécessaires |
| FR franchise en base | hors UE | 0 % | art. 293 B + art. 259, 1° CGI | pas de DES |
| FR régime réel | FR | 20 % | art. 278 CGI | — |
| FR régime réel | UE, assujetti | 0 % | autoliquidation art. 283, 2 CGI | DES mensuelle, contrôle VIES |
| FR régime réel | UE, non assujetti | 20 % | art. 278 CGI | guichet OSS à instruire selon la nature du service |
| FR régime réel | hors UE | 0 % | art. 259, 1° CGI | — |
| CH assujetti | CH | 8,1 % | art. 25 LTVA | — |
| CH assujetti | FR | 0 % | art. 8 al. 1 LTVA + autoliquidation art. 283, 2 CGI | **retenue à la source art. 182 B CGI à traiter avant la première facture** |
| CH non assujetti | FR | 0 % | art. 10 LTVA | seuil d'assujettissement calculé sur le chiffre d'affaires **mondial** |

Une combinaison non couverte ne produit pas un taux deviné : elle rend une règle
« à instruire » et un avertissement bloquant. C'est volontaire — mieux vaut une
facture retardée qu'une facture fausse.

Ces mentions citent les textes applicables ; elles ne valent pas avis fiscal. La
première facture émise sous un nouveau régime doit être relue par un
expert-comptable ou une fiduciaire.

## 4. Ce que le fichier de mission apporte aux documents

| Élément de la mission | Où il ressort |
| --- | --- |
| Libellé et type de chaque source | Pack d'accès (avec le mode d'accès déduit), registre, contrat de sous-traitance |
| Exécuteur `results` (remise au DBA) | Pack d'accès : « aucun accès direct » ; aucun compte à révoquer |
| Compte de lecture seule nommé | Pack d'accès et liste des accès à révoquer de l'attestation |
| Variable d'environnement d'un jeton d'API | Pack d'accès et accès à révoquer — jamais la valeur du jeton |
| Mode de collecte (`metadata_only`…) | Contrat de sous-traitance et registre, rubrique « type de données » |
| Journal de purge | Attestation : nom, empreinte SHA-256 et sort de chaque artefact |
| Catalogue de la mission | Attestation : score et synthèse du diagnostic |

Ajouter une source au fichier de mission la fait apparaître dans le pack
d'accès et dans le registre. C'est ce qui empêche le contrat de décrire une
mission différente de celle qui est réellement exécutée.

## 5. Changer d'entité émettrice

Passer d'une micro-entreprise française à une société suisse ne demande que
trois modifications dans le profil :

```jsonc
"country": "CH",
"vatRegime": "assujetti_ch",     // ou non_assujetti_ch sous le seuil
"currency": "CHF",
"registrationLabel": "IDE", "registrationValue": "CHE-…"
```

Les six documents suivent : la facture porte l'article 8 al. 1 LTVA et
l'autoliquidation française, le contrat de sous-traitance ajoute la LPD suisse
et la décision d'adéquation européenne, l'alerte sur la retenue à la source de
l'article 182 B du CGI apparaît. Un test vérifie précisément ce basculement.

## 6. Ce que l'outil ne fait pas

- Il ne tient pas la comptabilité : il produit des documents, pas des écritures.
- Il n'attribue pas les numéros de facture. `nextInvoiceNumber` calcule le
  suivant à partir du dernier ; le compteur reste sous le contrôle de
  l'émetteur, comme l'exige une numérotation continue sans rupture.
- Il ne remplace ni l'expert-comptable, ni le conseil juridique. Il rend leur
  intervention plus courte en présentant un dossier déjà structuré et sourcé.
