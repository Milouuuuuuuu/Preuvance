# Preuvance — dossier hackathon 2026

Date d’évaluation : 17 juillet 2026.

Ce document est une estimation de travail, pas une expertise financière ni une
promesse de financement.

## Résumé en une phrase

**Preuvance transforme une déclaration d’usage de l’IA en preuve vérifiable :
elle compare le déclaré à l’observé, contre-vérifie la qualification réglementaire
et produit un dossier exploitable par un dirigeant, un courtier ou un investisseur.**

## Note hackathon : 86 / 100

| Critère | Note | Preuve actuelle | Prochaine marche |
|---|---:|---|---|
| Problème et impact | 18/20 | Les PME doivent inventorier, expliquer et tracer leurs usages IA ; les obligations de transparence de l’article 50 deviennent applicables le 2 août 2026. | Obtenir une lettre d’intérêt d’un courtier ou d’une PME pilote. |
| Différenciation | 18/20 | Concordance déclaré / observé, cross-check déterministe et dossier courtier ; le bridge local renforce la maîtrise des données. | Tester le message face à trois courtiers et cinq dirigeants. |
| Exécution technique | 19/20 | Typage strict, tests unitaires, tests HTTP Worker, PDF réel, scanner local autotesté, CI et migrations Supabase. | Ajouter un test utilisateur filmé et une mesure du temps jusqu’au premier rapport. |
| Expérience de démonstration | 17/20 | Parcours local puis dossier, résultats explicables, PDF et nouvelle boîte à outils de portabilité. | Préparer une démo de trois minutes avec une divergence shadow AI nette. |
| Viabilité commerciale | 14/20 | Segment, bénéfice et acheteurs possibles identifiés, mais aucun revenu, pilote signé ou canal courtier vérifié. | Signer un pilote payant et préciser le prix par organisation. |

### Pourquoi la note n’est pas supérieure à 90

- aucune preuve de willingness-to-pay ;
- aucun courtier ou assureur engagé comme partenaire de distribution ;
- pas encore de mesure d’usage réelle ;
- la maintenance réglementaire doit être organisée comme une fonction continue ;
- l’évaluation complète dépend encore d’OpenAI et Supabase, contrairement au scan et au bridge qui sont locaux.

## Démo recommandée en trois minutes

1. **Déclarer** : « notre équipe utilise seulement ChatGPT ».
2. **Observer** : le scan local retrouve un appel Anthropic non déclaré, sans lire le contenu des fichiers.
3. **Prouver** : Preuvance affiche la divergence, puis le dossier réglementaire contre-vérifié et son PDF.
4. **Maîtriser les données** : montrer en vingt secondes le dry-run SQLite → PostgreSQL qui bloque une action manuelle.
5. **Conclure** : « une déclaration devient une preuve, et la preuve devient un dossier partageable ».

Le bridge est une preuve d’exécution et de souveraineté ; il ne doit pas prendre plus
de vingt à trente secondes dans la démonstration principale.

## Valorisation indicative

### 1. Valeur de remplacement des actifs : 150 k€ à 300 k€

Cette fourchette couvre le coût de reconstitution raisonnable du produit actuel :
scanner Windows, moteur réglementaire, garde-fous déterministes, PDF, persistance,
interface, tests, documentation et bridge. Elle ne valorise ni clientèle, ni marque
établie, ni revenus récurrents, puisqu’ils ne sont pas encore démontrés.

### 2. Valorisation pré-money aujourd’hui : 1,2 M€ à 2,2 M€

Fourchette défendable pour un MVP pré-revenu avec une exécution technique forte mais
sans traction commerciale. À titre de repère, PitchBook situait la médiane seed
européenne à 5,6 M€ au premier trimestre 2025 ; Preuvance doit rester nettement sous
ce repère tant qu’un pilote payant et un canal de distribution ne sont pas prouvés.
Les caps SAFE américains publiés par Carta sont plus élevés et ne doivent pas être
transposés directement à une société française pré-revenu.

### 3. Scénarios de revalorisation

| Preuve obtenue | Fourchette de travail | Pourquoi |
|---|---:|---|
| Hackathon seulement, sans pilote | 1,2–2,2 M€ | Visibilité accrue, mais risque commercial inchangé. |
| 2 pilotes, dont 1 payant, et 1 lettre d’intérêt courtier | 2,5–4,0 M€ | Première validation acheteur et canal. |
| 50–100 k€ d’ARR, rétention démontrée, référentiel maintenu | 4–6 M€ | Début de répétabilité commerciale, proche d’un dossier seed européen. |
| Partenariat courtier/assureur avec distribution mesurable | 6–10 M€ | Effet de canal et données d’usage défendables, sous réserve des termes du partenariat. |

Ces valeurs doivent être recalculées à partir des revenus, de la croissance, de la
rétention, de la propriété intellectuelle et des conditions réelles d’un financement.

## Perspective commerciale

### Offre en trois niveaux

1. **Preuvance Local — gratuit** : scan déclaré / observé et bridge de portabilité.
2. **Preuvance Dossier — abonnement** : qualification, plan d’action, journal et PDF.
3. **Preuvance Courtier — B2B2B** : portefeuille de dossiers, modèles de pièces et suivi des écarts pour courtiers ou cabinets.

Le gratuit apporte la preuve de confidentialité et l’acquisition. Le dossier est le
produit payant. Le canal courtier est la perspective de distribution, mais doit être
validé avant toute promesse publique.

## Feuille de route

### 30 jours

- enregistrer cinq démonstrations utilisateurs ;
- obtenir trois entretiens courtiers ;
- définir un prix pilote et une durée de conservation ;
- automatiser la mise à jour et la revue du référentiel réglementaire ;
- instrumenter uniquement les métriques produit consenties, sans contenu client.

### 90 jours

- convertir deux pilotes, dont un payant ;
- ajouter un espace de pièces justificatives avec suppression et export ;
- mesurer temps jusqu’au rapport, taux de complétion et nombre d’écarts résolus ;
- formaliser le modèle de responsabilité entre Preuvance, courtier et client.

### 180 jours

- tester l’offre portefeuille auprès d’un courtier ou cabinet ;
- proposer un déploiement européen avec référentiels versionnés ;
- évaluer un mode d’inférence privé pour les organisations qui refusent une API externe ;
- préparer une levée uniquement si le canal et la rétention sont démontrés.

## Sources de cadrage

- [Commission européenne — cadre et calendrier de l’AI Act](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)
- [Commission européenne — mesures pour les PME, article 62](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-62)
- [PitchBook — Q1 2025 European VC Valuations Report](https://files.pitchbook.com/website/files/pdf/Q1_2025_European_VC_Valuations_Report_19303.pdf)
- [Carta — State of Pre-Seed Q2 2025](https://carta.com/data/state-of-pre-seed-q2-2025/)

