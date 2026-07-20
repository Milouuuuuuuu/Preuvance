# OpenAI Build Week 2026 — dossier d’exécution Preuvance

> État de préparation au 20 juillet 2026. Ce document organise la candidature ; les règles et messages publiés sur les sites officiels restent la source de vérité.

## Résumé opérationnel

Preuvance doit être présenté dans la catégorie **Work & Productivity** comme un environnement de « dossier instantané » : l’utilisateur décrit un système d’IA, peut joindre des manifestes de dépendances et un digest de scan local expurgé, puis obtient un dossier vivant où chaque affirmation est classée **Declared → Detected → Proven**.

La promesse de démonstration est :

> **Prompt. Scan. Prove.** From a prompt and bounded project signals to a living, reviewable AI dossier.

Le cœur de la candidature n’est pas de promettre une conformité automatique. Il faut montrer comment GPT-5.6 structure des informations hétérogènes, pendant que des règles déterministes, une traçabilité des sources et une revue humaine empêchent une déclaration de devenir artificiellement une preuve.

## Échéance et conditions connues

| Élément | Exigence à respecter |
|---|---|
| Date limite | **Mardi 21 juillet 2026 à 17 h 00 PT**, soit **mercredi 22 juillet 2026 à 02 h 00 à Paris** |
| Éligibilité | La France est éligible ; les participants doivent être majeurs |
| Catégorie recommandée | **Work & Productivity** |
| Produit | Une application fonctionnelle, accessible aux juges |
| Vidéo | Vidéo YouTube avec audio, strictement inférieure à 3 minutes ; cible Preuvance : **2 min 45 s** |
| Dépôt | Public avec une licence, ou privé et partagé avec `testing@devpost.com` et `build-week-event@openai.com` |
| Codex | Fournir le **Session ID** obtenu avec la commande `/feedback` depuis la tâche Codex principale |
| Antériorité | Un projet préexistant est autorisé, mais seuls les ajouts réalisés après le **13 juillet 2026 à 09 h 00 PT** sont jugés |
| Technologies attendues | Montrer une utilisation réelle et substantielle de **GPT-5.6** et de **Codex** |

Les dates de jugement peuvent apparaître différemment selon certaines pages. Pour la candidature, appliquer les règles officielles et ne pas déduire un délai supplémentaire de ces différences.

## Positionnement recommandé

### Nom

**Preuvance — Instant AI Assurance, Evidence by Evidence**

### Phrase d’accroche

**From a prompt and bounded project signals to a living, reviewable AI dossier.**

### Démonstration en une phrase

Preuvance transforme une description, des manifestes de dépendances et un signal de scan local en un dossier de maîtrise IA relié à ses sources, avec des états de preuve explicites et une validation humaine obligatoire pour toute pièce marquée « Proven ».

### Pourquoi Work & Productivity

Preuvance réduit le travail manuel nécessaire pour inventorier un système d’IA, retrouver les pièces attendues, relier les constats aux contrôles et préparer une revue. La valeur est l’accélération d’un flux de travail de gouvernance, pas une décision juridique automatisée.

## Ce que la démonstration doit prouver

La vidéo et l’application doivent permettre à un juge de constater, sans narration spéculative :

1. qu’un utilisateur peut lancer un dossier depuis une description courte ;
2. que des manifestes reconnus peuvent être analysés localement et réduits à un digest expurgé ;
3. que le dossier sépare explicitement les éléments déclarés, détectés, manquants et prouvés ;
4. qu’un élément ne devient « Proven » qu’avec un relecteur et une date de revue ;
5. qu’une pièce locale est représentée par ses métadonnées et son empreinte SHA-256, sans prétendre que le hash démontre sa véracité ;
6. que le modèle réellement utilisé est enregistré dans la méthodologie du rapport ;
7. qu’un scan local peut alimenter le dossier par consentement explicite et sans envoyer ses données brutes ;
8. que le dossier peut être repris et exporté dans le parcours démontré ;
9. que GPT-5.6 et Codex ont chacun un rôle réel, documenté et visible.

## Plan d’exécution prioritaire

### P0 — avant toute soumission

- [ ] Ouvrir ou rejoindre officiellement l’événement Devpost avec le bon compte.
- [ ] Confirmer que chaque membre de l’équipe est majeur, éligible et correctement déclaré.
- [ ] Choisir le mode de partage du dépôt : public avec licence, ou privé avec les deux comptes de test officiels.
- [ ] Exécuter un parcours réel et confirmer que la méthodologie affiche bien **GPT-5.6** comme modèle retourné, pas seulement comme valeur configurée.
- [x] Exécuter localement la suite complète de tests, le lint, le contrôle TypeScript et le build de production ; les relancer sur le commit soumis.
- [ ] Appliquer la migration Supabase sur l’environnement de démonstration si le mode persistant est montré.
- [ ] Créer un compte ou des données de démonstration non sensibles ; vérifier que les juges peuvent accéder au parcours.
- [ ] Enregistrer la vidéo avec audio, la monter à 2 min 45 s maximum et la téléverser sur YouTube avec une visibilité compatible avec Devpost.
- [ ] Dans la tâche Codex principale, saisir `/feedback`, copier le Session ID exact et le reporter dans Devpost.
- [ ] Remplir tous les champs Devpost, vérifier les liens dans une fenêtre privée, puis soumettre avant l’échéance.

### P1 — qualité de la candidature

- [x] Préparer un cas Northstar reproductible, clairement identifié comme données fictives dans `demo/build-week/`.
- [x] Afficher dans le produit et les deux decks la progression **Declared → Detected → Proven**.
- [ ] Montrer une validation humaine réelle d’une pièce, avec relecteur et date.
- [ ] Montrer le digest de dépendances sans exposer le contenu brut d’un fichier local.
- [x] Ajouter au dépôt des instructions de lancement, les prérequis, les données de démo et les limites connues.
- [ ] Renseigner les commits réalisés après le 13 juillet à 09 h PT dans le journal Build Week.
- [ ] Vérifier que chaque affirmation de la page Devpost correspond à une fonctionnalité visible dans la version fournie aux juges.

### P2 — finition utile si le temps le permet

- [ ] Ajouter des sous-titres anglais à la vidéo.
- [ ] Exporter une version PDF ou PPTX du pitch pour l’équipe, sans l’utiliser à la place de la vidéo exigée.
- [ ] Conserver une courte capture de secours montrant le parcours principal en cas de problème réseau.
- [ ] Préparer une branche ou un tag exact correspondant à la version soumise.

## Répartition claire des rôles technologiques

### GPT-5.6

Dans la candidature, GPT-5.6 doit être décrit uniquement par ses opérations réellement exécutées et observables : structuration des faits, classification des risques ou contrôles, et analyse des lacunes. Les garde-fous déterministes restent responsables des invariants du registre de preuves, des états autorisés et de la production du payload final.

Avant de publier cette formulation, vérifier un run complet : la valeur à citer est le modèle effectivement retourné et enregistré dans le rapport.

### Codex

Codex doit être présenté comme l’environnement de construction et de vérification utilisé pendant la Build Week : exploration de la base existante, conception du registre de preuves, implémentation, tests, documentation, revue des médias et préparation de la candidature. Le Session ID fourni par `/feedback` matérialise cette utilisation ; il ne doit jamais être inventé.

## Intégrité de la soumission

Preuvance existait avant la Build Week. La candidature doit donc :

- présenter honnêtement le socle antérieur ;
- identifier précisément les ajouts réalisés après le 13 juillet 2026 à 09 h 00 PT ;
- relier ces ajouts à des commits datés et à des fichiers vérifiables ;
- ne pas antidater un commit, une capture, une fonctionnalité ou une mesure ;
- ne pas annoncer de métriques d’usage, de gain de temps ou de conformité qui n’ont pas été mesurées ;
- parler de « dossier de maîtrise », « traçabilité » ou « aide à la revue », jamais de conformité juridique garantie ;
- signaler les limites connues dans le README et dans la soumission.

Le journal de travail dédié est `docs/build-week-change-log.md`. Il doit recevoir les hash de commits réels avant la soumission.

## Vérification du dépôt et de l’accès

### Option A — dépôt public

1. choisir explicitement une licence compatible avec les droits détenus sur le code et les médias ;
2. vérifier que le dépôt ne contient aucun secret, donnée personnelle, fichier `.env` ou média sans droit d’usage ;
3. tester les instructions d’installation depuis un clone vierge ;
4. coller l’URL exacte dans Devpost.

### Option B — dépôt privé

1. conserver le dépôt privé ;
2. inviter ou partager l’accès avec `testing@devpost.com` et `build-week-event@openai.com` ;
3. vérifier que les invitations sont acceptées ou que l’accès est effectif ;
4. tester les instructions depuis un compte sans contexte local.

La décision public/privé et le choix de licence appartiennent au propriétaire du projet ; ils ne doivent pas être supposés par l’outil.

## Contrôle final à T−60 minutes

- [ ] L’URL de l’application s’ouvre hors de la session du développeur.
- [ ] Le dépôt est accessible selon l’option choisie.
- [ ] La vidéo YouTube démarre, contient du son et dure moins de 3 minutes.
- [ ] Le titre, le résumé et la catégorie sont corrects.
- [ ] Les rôles de GPT-5.6 et Codex sont concrets.
- [ ] Le Session ID `/feedback` est présent.
- [ ] Les ajouts Build Week sont reliés à des commits réels.
- [ ] Les limites et le caractère non juridique de l’évaluation sont visibles.
- [ ] Aucun secret ni document client réel n’apparaît dans la vidéo, les captures ou le dépôt.
- [ ] La soumission Devpost est effectivement envoyée, pas seulement enregistrée en brouillon.

## Actions qui nécessitent le propriétaire du projet

Ces actions ne peuvent pas être réalisées ou validées à sa place :

1. accepter les règles et rejoindre l’événement Devpost ;
2. confirmer l’identité, l’âge, l’éligibilité, la composition de l’équipe et les droits sur le projet ;
3. choisir la licence ou partager le dépôt privé avec les adresses officielles ;
4. fournir des identifiants de démonstration si nécessaire ;
5. exécuter `/feedback` dans la tâche Codex principale et copier le Session ID ;
6. enregistrer ou approuver la voix, la musique, les sous-titres et le montage final ;
7. téléverser la vidéo sur YouTube ;
8. approuver puis envoyer la candidature Devpost avant l’échéance.

## Liens officiels

- [OpenAI Build Week](https://openai.com/build-week/)
- [Page Devpost de l’événement](https://openai.devpost.com/)
- [Règles officielles](https://openai.devpost.com/rules)
- [FAQ officielle](https://openai.devpost.com/details/faqs)
- [Ressources officielles](https://openai.devpost.com/resources)
- [Conseils officiels de dernière minute](https://openai.devpost.com/updates/45371-tuesday-last-minute-tips)

Rédigé et préparé le 20 juillet 2026 par ChatGPT 5.6, OpenAI.
