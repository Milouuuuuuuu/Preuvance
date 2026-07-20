# Preuvance, expliqué simplement

## En une phrase

Preuvance aide une entreprise à savoir si son système d'intelligence
artificielle est concerné par le règlement européen sur l'IA (l'AI Act), et à
préparer un dossier de preuve à montrer à un courtier, un assureur ou un
investisseur.

Preuvance ne délivre ni avis juridique, ni certification, ni décision
d'assurabilité. C'est un outil de préparation, pas un jugement final.

## Un dossier principal, deux sources techniques facultatives

Le parcours principal commence par une description libre du système. Preuvance
peut ensuite enrichir le dossier avec deux sources techniques bornées :

- des manifestes `package.json`, `package-lock.json` ou `requirements*.txt`, lus
  dans le navigateur et réduits à un digest de dépendances IA ;
- un rapport du scan local, réduit après consentement à des compteurs et verdicts
  expurgés avant d'être relié à l'évaluation.

Le résultat n'est pas une qualification juridique automatique : c'est un
dossier de préparation avec score déterministe, écarts, PDF et registre de
preuves distinctes — déclarées, détectées, manquantes ou attestées.

## Le parcours principal : dossier instantané

Vous décrivez votre système en français, sans jargon juridique : à qui il
s'adresse, quelles données il traite, quelles décisions il produit. Preuvance
enchaîne alors extraction structurée, classification à partir d'un référentiel
daté, contre-vérification déterministe et analyse des écarts.

Chaque pièce attendue devient une ligne propre du registre. Un contrôle déclaré
reste déclaré ; un package reconnu reste détecté ; une pièce pointée devient
documentée. Seule une revue humaine renseignant un relecteur et une date peut
atteindre l'état « attesté ». Cette attestation enregistrée dans Preuvance n'est
ni un audit indépendant, ni une certification.

## Ce que fait le scan local complémentaire

Le scan (`SCANNER_PREUVANCE.cmd`) est un programme Windows qui reste
**entièrement sur votre machine**. Concrètement :

1. **Il recueille votre déclaration** — vous cochez les outils d'IA que votre
   organisation utilise sciemment (OpenAI, Anthropic, Mistral, etc.), ou vous
   déclarez n'en utiliser aucun. C'est la même logique que la déclaration d'un
   risque à un assureur : dire ce que l'on sait, avant la vérification.
2. **Il identifie le contexte du poste** — personnel, ou professionnel (relié à
   un domaine d'entreprise). Sur un poste professionnel géré, il recommande de
   passer plutôt par le service informatique ou le délégué à la protection des
   données de l'entreprise.
3. **Il repère les fichiers sensibles** — clés secrètes, certificats,
   documents financiers, données personnelles — par leur nom et leur
   emplacement. **Il ne copie et ne lit jamais le contenu d'un fichier** :
   seuls le chemin, la taille, la date et une empreinte numérique (un
   « code-barres » du fichier, pas son contenu) sont enregistrés. C'est un
   inventaire, pas une extraction.
4. **Il détecte les appels vers des services d'IA** — si un logiciel de votre
   poste communique avec OpenAI, Anthropic, Azure OpenAI, Google Gemini,
   Mistral et une dizaine d'autres fournisseurs, le scan le repère par le nom
   du service contacté (jamais en lisant le contenu, qui reste chiffré et
   illisible de l'extérieur). Vous pouvez lancer une **surveillance d'une
   heure** pendant que vous travaillez normalement, pour une détection plus
   fiable qu'un simple instantané.
5. **Il rend le verdict de concordance et un score d'exposition sur 100**, de
   façon entièrement automatique et vérifiable (pas d'intelligence artificielle
   dans ce calcul) :
   - **concordant** — ce qui est observé corrobore ce que vous avez déclaré :
     votre déclaration n'est plus une déclaration sur l'honneur, elle est
     vérifiée par les faits ;
   - **divergent** — un usage d'IA est observé sans avoir été déclaré
     (« shadow AI ») : l'écart est nommé et fait fortement chuter la note tant
     qu'il n'est pas résolu (déclarer l'outil, ou cesser de l'utiliser) ;
   - **non contredit** — rien n'infirme la déclaration, sans la confirmer
     encore ; la surveillance d'une heure renforce l'observation.
   Des secrets exposés font aussi chuter la note, et chaque point perdu est
   expliqué.

Le rapport produit (`preuvance-scan.json`) reste un fichier sur votre disque.
La page **« Scanner en local »** du site le lit **dans votre navigateur**, sans
jamais l'envoyer où que ce soit, et affiche la concordance, le score et les
explications.

**Limites assumées** : la déclaration reste la vôtre (le scan ne peut pas
vérifier ce que vous faites des outils déclarés), et une absence de détection
ne prouve jamais une absence d'usage. Ce n'est pas un défaut caché : c'est
écrit dans le rapport lui-même et dans la documentation technique.

## Comment l'évaluation est construite

Vous décrivez votre système en français, sans jargon juridique : à qui il
s'adresse, quelles données il traite, quelles décisions il produit. Preuvance
enchaîne alors quatre étapes visibles à l'écran :

1. **Extraction des faits** — le texte est transformé en informations
   structurées (secteur, rôle de l'entreprise, type de données, etc.).
2. **Classification réglementaire** — ces faits sont comparés à un référentiel
   daté du règlement européen sur l'IA, pour déterminer le niveau de risque
   (interdit, haut risque, risque limité, risque minimal) et les obligations
   qui s'appliquent.
3. **Contre-vérification indépendante** — un second mécanisme, qui ne dépend
   d'aucune intelligence artificielle, relit la classification et signale toute
   contradiction (par exemple si le texte décrit clairement une pratique
   interdite mais que la classification dit le contraire). En cas de
   contradiction, le score est automatiquement plafonné et une revue humaine
   est recommandée. C'est un garde-fou pensé pour qu'aucune conclusion
   trompeuse ne parte sans alerte.
4. **Analyse des écarts et score** — les manques par rapport aux obligations
   sont listés par priorité, et un score de préparation sur 100 est calculé
   selon une formule fixe et documentée (pas une estimation de l'IA).

## Le rapport PDF

Un vrai document PDF est généré, pensé pour être montré à un tiers : score,
classification, échéances réglementaires, écarts prioritaires, et le
**journal complet des décisions** — y compris le résultat de la
contre-vérification indépendante et la raison de chaque plafond appliqué au
score. Rien de ce qui compte n'est laissé uniquement sur l'écran du site.

## Le référentiel réglementaire

Preuvance distingue toujours deux couches :

- le **droit déjà en vigueur** (règlement européen 2024/1689) ;
- les **changements votés mais pas encore officiellement publiés** (comme le
  paquet « Digital Omnibus » de 2026), présentés comme des scénarios à venir,
  jamais comme des règles déjà applicables.

Cette distinction, vérifiée par recherche de sources officielles, évite
l'erreur la plus fréquente : présenter une réforme encore en discussion comme
si elle était déjà obligatoire.

## Confidentialité

- Le scan local ne transmet rien sur Internet.
- L'évaluation en ligne envoie à l'intelligence artificielle uniquement le nom
  de l'organisation, le nom du système et sa description — jamais vos fichiers.
- Si vous êtes connecté, vos évaluations sont enregistrées dans votre espace
  personnel, protégé pour n'être visible que par vous et votre organisation.
- Vous pouvez tout supprimer de votre poste avec `DESINSTALLER_PREUVANCE.cmd`
  (clé, caches, rapports de scan — avec une option pour tout effacer, y
  compris l'application elle-même).

## Ce que Preuvance ne fait pas (volontairement)

Pas d'intégration réelle avec un assureur, pas de tarification ni de paiement,
pas de dossier réglementaire complet automatisé, pas de surveillance continue,
et surtout : **aucune promesse de couverture d'assurance**. Preuvance prépare
un dossier ; la décision finale revient toujours à un professionnel humain.

## Utiliser Preuvance en local

1. Télécharger la version locale depuis le site (bouton « Télécharger la
   version locale »), puis extraire l'archive.
2. `SCANNER_PREUVANCE.cmd` — lance le scan (aucune clé nécessaire).
3. `LANCER_PREUVANCE.cmd` — lance l'application web complète sur votre
   ordinateur (une clé API est demandée une seule fois, jamais affichée).
4. `DESINSTALLER_PREUVANCE.cmd` — nettoie ou supprime tout.

Aucun de ces trois programmes ne demande de droits administrateur.

## Pour aller plus loin

Ce document reste volontairement simple. Le détail technique complet se trouve
dans le dépôt du projet : `README.md` (vue d'ensemble technique),
`BEHAVIOR.md` (registre de chaque décision de conception, notée et justifiée),
`docs/preuvance-scan.md` (détail technique du scan) et
`docs/revue-audit-externe.md` (revue critique et transparente d'un audit tiers).

---

Document initial rédigé le 15 juillet 2026 par ChatGPT Sol 5.6. Mise à jour de la
vision « dossier instantané » et de la séparation déclaré / détecté / attesté le
20 juillet 2026 par ChatGPT 5.6, OpenAI. À cette date, 85 tests unitaires et 10
tests de rendu HTTP/Worker passent localement.
