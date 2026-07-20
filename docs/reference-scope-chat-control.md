# Évaluation de périmètre — « Chat Control » et Preuvance

État au **20 juillet 2026**. Ce document est une évaluation de périmètre produit, pas un avis juridique. Il consigne pourquoi Preuvance **n'intègre pas** de module « Chat Control » à ce stade, et à quelle condition la décision serait révisée. Voir la décision **D-083** dans [`BEHAVIOR.md`](../BEHAVIOR.md).

## 1. Ce qu'est « Chat Control » (sources primaires et datées)

Deux instruments distincts, souvent confondus :

- **« Chat Control 1.0 » — Règlement (UE) 2021/1232.** Dérogation *temporaire* à la directive ePrivacy (2002/58/CE) qui **autorise** (détection *volontaire*, jamais obligatoire) certains fournisseurs à rechercher, signaler et retirer des contenus d'abus sexuels sur enfants (CSAM). Périmètre matériel : **opérateurs de services** — hébergement, communications interpersonnelles, app stores et FAI — dirigeant leurs services vers l'UE.
- **« Chat Control 2.0 » — proposition de règlement CSAR.** Régime permanent envisagé : évaluation des risques, mesures d'atténuation, signalement, et *potentielles* injonctions de détection ordonnées par une autorité. **Non adopté** : négociations en trilogue, détection non résolue à fin juin 2026.

### Statut juridique — instable

- **26 mars 2026** : le Parlement rejette la prolongation de la dérogation.
- **3 avril 2026** : la dérogation 2021/1232 **expire**.
- **7–9 juillet 2026** : réintroduction en urgence, services chiffrés de bout en bout (E2EE) **exclus**, échéance repoussée à 2028.
- **CSAR (2.0)** : toujours en négociation, issue incertaine.

Sources consultées le 20/07/2026 : [EUR-Lex — Règlement (UE) 2021/1232](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32021R1232) · [Wikipedia — Chat Control (chronologie 2026, 1.0 vs 2.0)](https://en.wikipedia.org/wiki/Chat_Control) · [CDT Europe — rejet de l'extension de Chat Control 1.0](https://cdt.org/insights/cdt-europes-response-to-the-european-parliament-rejection-of-the-chat-control-1-0s-extension/).

## 2. Pourquoi c'est hors périmètre de Preuvance

1. **Autre instrument, autre base juridique.** Preuvance prépare un dossier de maîtrise **AI Act** (règlement (UE) 2024/1689). Chat Control relève de l'ePrivacy et de la protection de l'enfance — un domaine différent, avec d'autres acteurs assujettis.
2. **Détection *volontaire*, pas d'obligation.** Sous 1.0, personne n'est « soumis » à une obligation : les opérateurs sont *autorisés* à scanner. Une brique « prêt au contrôle » n'a donc pas d'objet réglementaire clair.
3. **Assujettis ≠ clientèle de Preuvance.** Les acteurs visés sont des opérateurs de messagerie / hébergement / app store / FAI. La cible de Preuvance — PME/SMC **déployant** une IA — n'en fait, dans la très grande majorité des cas, pas partie.
4. **Loi en pleine tempête.** Expirée puis réintroduite en trois mois, CSAR non tranché : afficher un statut « Chat Control » dans le produit violerait la règle D-003 (séparer le droit contraignant du droit annoncé) et produirait un faux positif quasi garanti à court terme.
5. **L'angle CSAM pertinent pour l'AI Act est déjà couvert.** La modification signée de l'article 5 (`non-consensual-intimate-or-csam-generation`, appliquée le 2 décembre 2026 sous réserve de publication) traite la *génération* par IA de CSAM / NCII, correctement marquée « pas encore en vigueur » dans le référentiel.
6. **Risque de positionnement.** Associer un outil de préparation à l'assurance IA à la détection de contenus dans les communications privées brouillerait la proposition de valeur et toucherait un sujet politiquement sensible (scan de messages, débat E2EE).

## 3. Décision appliquée

**Ne pas créer de module « Chat Control », ni en B2C ni en entreprise.** Le B2C est d'autant moins justifié que les consommateurs sont, sous Chat Control, les *sujets* du scan et non des acteurs assujettis. La demande initiale précisait « si ce n'est pas nécessaire, ne le fais pas » : ce n'est pas nécessaire.

## 4. Condition de réexamen

Rouvrir cette décision **si et seulement si** :
- le CSAR (2.0) est **adopté et publié** avec des obligations de détection *réellement contraignantes* ; **et**
- Preuvance décide explicitement de cibler des opérateurs d'hébergement / communications interpersonnelles.

Le cas échéant, l'ajout se ferait sous forme d'un **repère de périmètre non contraignant** (une question de qualification renvoyant vers un spécialiste), versionné dans le référentiel et marqué comme domaine distinct de l'AI Act — jamais comme une allégation de conformité.
