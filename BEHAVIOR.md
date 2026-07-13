# Comportement de construction — Preuvance

Dernière mise à jour : 13 juillet 2026.

Ce document est la mémoire de décision du projet. Toute décision produit, réglementaire, IA, données, sécurité ou architecture qui modifie le comportement livré doit être ajoutée au registre avec une note sur 100.

## Barème

- **90–100** : décision verrouillée, étayée par une source primaire, un test ou une contrainte explicite.
- **75–89** : décision forte, révisable si une meilleure preuve apparaît.
- **60–74** : hypothèse de travail ; elle ne doit pas devenir une promesse publique sans validation.
- **< 60** : expérimentation ; elle reste hors du parcours critique.

La note mesure la solidité de la décision au moment où elle est prise, pas une probabilité juridique ni un score d’assurabilité.

## Règles de comportement

1. **Rechercher avant d’affirmer.** Les noms, domaines, modèles, délais et obligations sont vérifiés sur des sources primaires actuelles.
2. **Séparer le droit contraignant du droit annoncé.** Une mesure adoptée mais non encore entrée en vigueur reste présentée comme un scénario futur.
3. **Ne rien inventer pour rendre une démo plus jolie.** Pas de faux appel API, de résultat simulé présenté comme réel, ni de fallback de modèle silencieux.
4. **Structurer puis calculer.** Le modèle extrait, classe et propose des écarts dans des schémas stricts ; le score final est calculé de façon déterministe et auditable.
5. **Montrer l’incertitude.** Chaque étape expose une note sur 100, ses limites et les informations manquantes.
6. **Ne pas promettre l’assurabilité.** Preuvance prépare un dossier de pré-souscription ; seul un courtier ou assureur décide d’une couverture.
7. **Protéger les données.** Secrets hors dépôt, validation serveur systématique, contrôle d’accès au niveau base de données, aucune donnée client dans les logs applicatifs.
8. **Gater les phases.** Pipeline et tests d’abord ; interface, PDF, persistance puis finition seulement après validation de la phase précédente.
9. **Livrer accessible.** Contrastes AA, navigation clavier, HTML sémantique, messages d’erreur explicites et respect de `prefers-reduced-motion`.
10. **Mettre ce registre à jour.** Une décision matérielle non notée n’est pas considérée comme stabilisée.

## Registre des décisions

| ID | Décision | Note /100 | Justification et conséquence |
|---|---|---:|---|
| D-001 | Remplacer la marque **Aplomb** par **Preuvance** | 86 | Les trois domaines ciblés sont enregistrés et Aplomb Strategies opère déjà en gouvernance IA/réglementaire. Preuvance combine « preuve » et « assurance » et présente de bons signaux RDAP préliminaires. Un achat registrar et une recherche EUIPO/TMview restent nécessaires. |
| D-002 | Positionner le produit comme un **dossier de pré-souscription IA en français pour PME/SMC européennes** | 82 | Le pont assurance existe déjà chez Armilla, Munich Re et Insured AI. Le différenciateur crédible est l’entrée libre en français, la traçabilité réglementaire datée et la préparation courtier pour le segment UE. |
| D-003 | Afficher séparément **droit en vigueur** et **scénario Omnibus** | 100 | Au 13/07/2026, l’Omnibus est adopté et signé mais attend sa publication au JOUE ; il n’a donc pas encore d’effet juridique. |
| D-004 | Ne pas présenter le 02/12/2026 comme date générale de « watermarking » | 100 | Cette transition ne concerne que l’article 50(2) et les systèmes déjà mis sur le marché avant le 02/08/2026. Le terme juridique sûr est « marquage détectable dans un format lisible par machine ». |
| D-005 | Définir une SMC par moins de 750 salariés et **CA ≤ 150 M€ ou bilan ≤ 129 M€**, hors PME | 100 | Le brief omettait le seuil de bilan et le caractère alternatif des seuils financiers. |
| D-006 | Utiliser `gpt-5.6-sol` pour les décisions importantes | 99 | Modèle officiel actuel recommandé pour le raisonnement complexe et les sorties structurées. |
| D-007 | Réserver `gpt-5.6-luna` aux tâches simples/économiques après évaluation | 96 | Modèle documenté pour les charges sensibles au coût ; aucune substitution silencieuse sur une décision réglementaire. |
| D-008 | Utiliser l’API Responses avec JSON Schema strict à chaque appel | 98 | Tous les champs sont requis, les objets refusent les propriétés additionnelles et les refus/réponses incomplètes sont traités explicitement. |
| D-009 | Calculer le score de préparation de façon déterministe après les appels IA | 97 | Rend le résultat reproductible, explicable et testable ; le LLM ne choisit pas directement la note finale. |
| D-010 | Refuser un lancement sans clé API au lieu de fabriquer un résultat | 100 | Respecte l’interdiction de faux API et évite qu’un exemple soit confondu avec une analyse réelle. |
| D-011 | Produire un PDF de **préparation courtier**, jamais un certificat | 98 | Le rapport assemble preuves, lacunes, questions et limites ; il ne tranche ni couverture, ni prime, ni conformité juridique. |
| D-012 | Utiliser Supabase avec RLS pour comptes, organisations, systèmes et évaluations | 94 | Correspond au périmètre explicite ; chaque accès utilisateur doit être vérifié côté serveur et base. |
| D-013 | Garder Resend désactivé derrière un drapeau tant qu’aucun envoi n’est requis | 95 | Évite un effet externe et un secret supplémentaire dans le MVP. |
| D-014 | Respecter les quatre phases et faire passer compilation/tests à chaque gate | 98 | Réduit le risque de masquer un pipeline défaillant sous une interface polie. |
| D-015 | Conserver le socle Sites/Vinext pour l’hébergement Cloudflare | 92 | Le projet a été initialisé avec le runtime Sites demandé ; l’implémentation reste compatible Worker et évite les API serveur non portables. |
| D-016 | Épingler Next.js `15.5.20` et React `19.2.6` | 97 | Respecte la stack explicitement demandée ; les peer dependencies publiées confirment la compatibilité React 19 et Vinext impose React 19.2.6. |
| D-017 | Charger Yoga comme **WASM statique précompilé** et ne résoudre React côté client que pour `@react-pdf/reconciler` | 96 | Workerd interdit la compilation WASM dynamique et Vinext applique la condition React Server. L’adaptateur ciblé évite un alias React global qui casserait les Server Components ; le test runtime renvoie un vrai PDF signé `%PDF-`. |
| D-018 | Construire dans la synthèse un **contrat de rapport unique**, validé par Zod et partagé par l’UI, le PDF et Supabase | 98 | Élimine les divergences de schéma et empêche le PDF ou la base de recalculer ou d’inventer un résultat. Organisation et système sont obligatoires dans le formulaire afin que le dossier soit nominatif. |
| D-019 | Exiger une session quand Supabase est configuré et persister toute évaluation terminée dans une transaction RPC | 97 | Organisation, système, évaluation, rapport et journal des quatre étapes sont écrits atomiquement sous RLS ; une écriture partielle n’est jamais annoncée comme réussie. |
| D-020 | Laisser Supabase optionnel en développement, sans prétendre à une persistance | 94 | Sans variables Supabase, l’évaluation peut fonctionner avec OpenAI et retourne explicitement `persistence.status = disabled`. Avec Supabase configuré, l’authentification et la persistance deviennent obligatoires. |
| D-021 | Valider le formulaire avec **React Hook Form + Zod** avant la validation serveur | 96 | Les mêmes bornes de longueur et de taille d’entreprise sont contrôlées côté interface, puis de nouveau par le schéma strict de l’API. La validation navigateur ne remplace jamais la validation serveur. |
| D-022 | Gater la livraison sur lint, TypeScript strict, tests unitaires, build et test HTTP du PDF sous Workerd | 99 | Ces contrôles couvrent le référentiel, le score, le contrat PDF, le rendu français et la contrainte d’exécution Cloudflare qui avait révélé les incompatibilités React/WASM. |
| D-023 | Diffuser la progression réelle du pipeline en **NDJSON**, sans chaîne de pensée | 97 | L’interface change d’étape uniquement lorsqu’un événement serveur `extraction`, `classification`, `gap_analysis` ou `synthesis` est reçu. Le flux n’expose que l’état, jamais le raisonnement interne du modèle. |
| D-024 | Refuser tout endpoint OpenAI anonyme en production | 99 | En production, Supabase et une session valide sont obligatoires avant les trois appels modèle. Le mode sans Supabase reste réservé au développement local et n’annonce aucune persistance. |
| D-025 | Ne pas transformer une annexe `insufficient_information` en obligation applicable | 99 | Une qualification à confirmer reste dans le journal des décisions et les informations manquantes ; seules les issues `applies` et `likely_applies` ajoutent les obligations Annexe I/III au dossier. |
| D-026 | Utiliser Supabase comme unique base applicative et retirer le squelette D1/Drizzle inutilisé | 97 | Le brief impose Postgres, Auth et RLS Supabase. Conserver une seconde pile de données inactive aurait créé une ambiguïté de déploiement et une surface de maintenance sans fonctionnalité utilisateur. |

## Protocole de modification

Pour toute nouvelle décision matérielle :

1. ajouter une ligne `D-xxx` ;
2. indiquer une note entière sur 100 ;
3. citer la preuve ou le test qui la soutient ;
4. préciser ce qui ferait baisser ou réviser la note ;
5. mettre à jour le README si la décision change une promesse utilisateur.
