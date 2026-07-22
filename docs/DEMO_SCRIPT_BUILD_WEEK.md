# Script vidéo Build Week — Preuvance en 2 min 45 s

> **État au 22 juillet 2026, après la clôture :** une nouvelle version de 154,1 secondes a été rendue localement dans `remotion/out/preuvance-build-week-submission.mp4`. Elle contient une voix anglaise, des sous-titres et des captures du build réel. Le dossier Northstar y est explicitement présenté comme une fixture fictive sans appel modèle ; l’architecture GPT-5.6 est expliquée séparément, sans prétendre montrer un run absent. Toute publication ou modification Devpost postérieure à la clôture nécessite l’accord des organisateurs.

## Objectif de la vidéo

En moins de trois minutes, un juge doit comprendre le problème, voir un parcours réellement fonctionnel et retenir une différence : Preuvance ne confond jamais une déclaration, une détection technique et une preuve revue par un humain.

Durée cible : **2 min 45 s**, audio inclus. La marge de quinze secondes évite qu’un export, un écran titre ou une plateforme fasse dépasser la limite stricte de trois minutes.

## Règles de tournage

- Enregistrer l’application réellement soumise, pas une maquette qui promet des fonctions absentes.
- Utiliser exclusivement des données de démonstration non sensibles et clairement identifiées.
- Garder le pointeur visible et les interactions lisibles ; éviter les accélérations qui empêchent de vérifier le résultat.
- Afficher le modèle réellement enregistré dans la méthodologie. Ne pas incruster « GPT-5.6 » si le run ne le confirme pas.
- Ne montrer aucun secret, token, adresse interne, chemin personnel, adresse IP, document client ou notification privée.
- Utiliser des animations procédurales sans watermark. Les clips Veo audités ne font pas partie du montage recommandé.
- Ajouter une voix intelligible et, si possible, des sous-titres anglais. Toute musique doit être originale, sous licence appropriée ou supprimée.
- Exporter en 1080p, relire la vidéo entière et confirmer sa durée après l’upload YouTube.

## Données de démonstration à préparer

Préparer avant l’enregistrement :

- un projet fictif nommé **Northstar Support Copilot** ;
- un prompt court décrivant un assistant de support interne qui résume des tickets et propose des réponses, avec validation humaine avant envoi ;
- un manifeste de démonstration inclus dans le dépôt, ne contenant aucun secret ;
- un digest de scan local fictif ou généré sur une machine de démonstration, sans chemin, IP, processus ou hash sensible ;
- une pièce de démonstration dont le nom, le propriétaire, le relecteur et la date peuvent être montrés publiquement ;
- un dossier déjà généré en secours si une API distante est momentanément indisponible.

Le manifeste et le prompt exacts doivent être renseignés dans le README avant la soumission.

## Découpage chronométré

| Temps | Écran et action | Message à faire passer |
|---|---|---|
| 00:00–00:12 | Titre procédural Preuvance, puis accueil | Une promesse simple : Prompt. Scan. Prove. |
| 00:12–00:30 | Carte problème, transition immédiate vers le produit | Les déclarations et les preuves ne sont pas équivalentes |
| 00:30–00:55 | Saisir le prompt Northstar dans le formulaire | Le dossier commence avec un contexte compréhensible |
| 00:55–01:20 | Ajouter le manifeste de démo ; montrer le digest | Analyse locale bornée, pas d’envoi du manifeste brut |
| 01:20–01:50 | Lancer puis ouvrir le dossier instantané | GPT-5.6 structure ; les règles déterministes gardent les états distincts |
| 01:50–02:12 | Ouvrir « Evidence by evidence » ; compléter une revue | Un élément n’est Proven qu’avec relecteur et date |
| 02:12–02:30 | Montrer digest de scan, modèle réel et export/reprise | Consentement, provenance, modèle réellement utilisé |
| 02:30–02:45 | Conclusion animée + URL courte | Preuvance rend la gouvernance praticable sans promettre la conformité |

## Narration anglaise prête à enregistrer

Le texte ci-dessous vise environ 300 mots. Le lire naturellement, sans accélérer. Répéter puis ajuster les silences aux captures réelles.

### 00:00–00:12 — Opening

> AI governance should not begin with another stale spreadsheet. Preuvance turns a prompt or repository signal into a living, verifiable AI dossier. Prompt. Scan. Prove.

### 00:12–00:30 — Problem

> Today, a user declaration, a detected dependency, and a reviewed document are often treated as if they meant the same thing. They do not. That ambiguity slows reviews and creates false confidence.

### 00:30–00:55 — Prompt

> Here is Northstar, a fictional support copilot. I describe what it does, who uses it, and where humans remain in control. This gives Preuvance the operational context for an assessment.

### 00:55–01:20 — Dependency scan

> I can also add a supported dependency manifest. It is parsed in my browser. Preuvance extracts a bounded digest of recognized AI providers, frameworks, vector stores, and observability tools. The raw manifest is not uploaded by this workflow.

### 01:20–01:50 — Instant dossier

> GPT-5.6 structures the supplied facts and identifies gaps. Deterministic rules then assemble the dossier. Notice the evidence ladder: Declared, Detected, Missing, and Proven. A model observation can create a lead, but it cannot silently become proof.

### 01:50–02:12 — Human proof

> This policy item is still documented, not proven. To verify it, I add its owner, reviewer, review date, validity, and browser-computed integrity hash. Proven is accepted only when the human-review fields are complete. A hash protects integrity; it does not prove truth.

### 02:12–02:30 — Provenance and privacy

> A local scan can contribute an aggregate digest only after explicit consent. Paths, IP addresses, process names, and raw evidence stay out of the handoff. The methodology also records the model actually returned by each AI stage.

### 02:30–02:45 — Close

> Preuvance does not certify compliance. It makes every claim reviewable, every gap actionable, and every proof traceable. From AI inventory to assurance dossier, evidence by evidence.

## Liste de prises

1. **Ouverture** : 4 à 6 secondes d’animation procédurale, puis titre statique lisible.
2. **Accueil** : plan large du hero « dossier instantané ».
3. **Prompt** : saisie ou collage du texte Northstar ; ne pas perdre de temps à tout taper en direct.
4. **Manifeste** : sélection du fixture, puis gros plan sur le nombre de dépendances reconnues et la mention de confidentialité.
5. **Progression** : garder une courte portion de l’analyse ; couper les attentes sans simuler un résultat.
6. **Dossier** : plan large, puis zoom sur la méthodologie et le modèle réel.
7. **Registre** : montrer plusieurs états avant de modifier une seule pièce.
8. **Validation** : saisir un relecteur et une date, sauvegarder, constater le passage à Proven.
9. **Scan local** : montrer le consentement et le digest agrégé, pas les données brutes.
10. **Sortie** : export ou reprise du dossier, selon la fonction la plus stable dans le build final.
11. **Conclusion** : titre, URL du projet, mention « Human review required ».

## Plan de secours sans falsifier la démo

Si l’API est instable pendant l’enregistrement :

- enregistrer séparément un run réel réussi ;
- utiliser des coupes franches entre les étapes, sans accélération trompeuse ;
- conserver à l’écran l’identifiant ou la date du même dossier lorsque c’est possible ;
- indiquer « shortened for time » si une attente est coupée ;
- ne jamais substituer une capture statique à une interaction annoncée comme live.

## Vérification avant YouTube

- [x] Durée finale inférieure à 3:00 : 154,1 secondes.
- [x] Audio AAC stéréo présent et normalisé.
- [x] Sous-titres anglais incrustés et relus sur la planche de contrôle.
- [x] Aucune donnée privée visible dans les captures utilisées.
- [ ] Aucun watermark Veo ou média dont les droits sont incertains.
- [x] Aucun modèle n’est attribué à la fixture ; la provenance réelle reste décrite comme dépendante d’un run configuré.
- [x] Les écrans montrés existent dans le build vérifié.
- [x] La route `/demo` reste affichée dans la conclusion.
- [ ] La vidéo YouTube est accessible depuis une fenêtre privée.

## TODO propriétaire

- [x] Valider le prompt et le fixture Northstar.
- [x] Choisir et enregistrer la voix finale.
- [ ] Approuver les droits de tous les éléments sonores et visuels.
- [x] Enregistrer les prises réelles après le build de validation.
- [x] Monter la vidéo locale.
- [ ] Obtenir l’accord des organisateurs avant tout remplacement post-deadline, puis téléverser la vidéo YouTube.
- [ ] Coller l’URL publique ou non répertoriée acceptée par Devpost dans la candidature.

Rédigé et préparé le 20 juillet 2026 par ChatGPT 5.6, OpenAI.
