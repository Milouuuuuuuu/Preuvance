---
name: goal
description: Mode objectif Preuvance — protocole d'exécution autonome d'un objectif utilisateur. Décomposition en sous-objectifs vérifiables suivis via TodoWrite, preuve concrète exigée avant tout « fait », questions regroupées à la fin, rapport final sous-objectif → preuve.
---

# goal — mode objectif

Protocole à appliquer quand l'utilisateur confie un objectif à exécuter en
autonomie (« atteins X », « mode objectif », « débrouille-toi jusqu'à Y »).
Le principe : aucune étape n'est déclarée atteinte sans preuve vérifiable,
et l'utilisateur n'est pas interrompu en cours de route.

## 1. Reformuler l'objectif en sous-objectifs VÉRIFIABLES

- Décomposer l'objectif en **2 à 5 sous-objectifs**, ni plus ni moins.
- Chaque sous-objectif énonce **dès sa formulation** la preuve qui
  l'attestera : un test vert, une sortie de commande, un fichier créé, une
  réponse HTTP observée. « Améliorer le SEO » est invérifiable ;
  « `node --test tests/rendered-html.test.mjs` passe avec la balise
  canonique sur /scan » est vérifiable.
- Si l'objectif est trop flou pour produire des sous-objectifs vérifiables,
  le dire immédiatement — c'est la seule question autorisée avant de
  commencer.

## 2. Suivre via TodoWrite

Créer la liste TodoWrite dès la reformulation, un item par sous-objectif.
Un seul item `in_progress` à la fois ; passage à `completed` uniquement
quand la preuve du § 4 existe. La liste est le contrat : ne pas ajouter de
travail hors périmètre sans le tracer comme nouvel item.

## 3. Travailler sans interruption (mode auto)

- Enchaîner les sous-objectifs sans demander de validation intermédiaire.
- Les décisions réversibles (nommage, découpage, ordre) sont prises seul,
  en suivant les conventions du dépôt (`AGENTS.md`, `BEHAVIOR.md`).
- Les questions qui nécessitent réellement le propriétaire (choix produit,
  secret manquant, arbitrage irréversible) sont **notées au fil de l'eau et
  regroupées à la FIN** du rapport — jamais posées en cours de route. Si un
  sous-objectif est bloqué par une telle question, le marquer bloqué,
  passer au suivant, et le dire honnêtement dans le rapport.

## 4. Critère de « fait » : la preuve

Un sous-objectif n'est « fait » qu'avec une preuve concrète et reproductible :

- test exécuté et vert (nom du test + sortie) ;
- sortie de commande réelle (pas paraphrasée de mémoire) ;
- fichier créé/modifié dont l'existence et le contenu ont été vérifiés.

**Jamais de résultat fabriqué** (règle D-081 du dépôt) : pas de sortie de
test inventée, pas de métrique estimée présentée comme mesurée, pas de
« ça devrait marcher ». Une preuve impossible à obtenir = sous-objectif
non atteint, dit tel quel.

**Règle dépôt** : si un sous-objectif touche au code du dépôt, la chaîne

```powershell
npm test
```

doit rester verte **avant** de le déclarer atteint (lint + `tsc --noEmit` +
tests unitaires + build + tests HTTP — voir le skill `fable-gate` pour les
pièges OneDrive de cette chaîne sur ce poste).

## 5. Rapport final

Terminer par un tableau, une ligne par sous-objectif :

| Sous-objectif | Statut | Preuve |
| --- | --- | --- |
| … | atteint / non atteint / bloqué | commande + sortie, test vert, chemin de fichier |

Suivi des questions regroupées pour le propriétaire (§ 3), s'il y en a.
Un rapport honnête avec un sous-objectif non atteint vaut mieux qu'un
tableau tout vert non prouvé.
