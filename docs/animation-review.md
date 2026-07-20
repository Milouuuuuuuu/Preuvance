# Revue des animations — direction visuelle Build Week

## Décision

Les quatre clips générés présents dans `Téléchargements` sont conservés comme références, mais **ne doivent pas être utilisés dans la vidéo ou le diaporama soumis à Build Week** dans leur état actuel.

La direction retenue est une animation procédurale construite avec React/Remotion : dossiers, graphes de dépendances, états de preuve et interface réelle. Le rendu doit rester sobre, lisible et sans watermark.

## Inventaire audité

| Source dans `Téléchargements` | Copie ou usage observé dans le dépôt | Rôle imaginé | Décision |
|---|---|---|---|
| `Evidence_room_with_dossiers_1080p_202607192230.mp4` | `remotion/public/higgsfield/output/opening.mp4` | Ouverture / salle de preuves | Exclure du rendu candidat |
| `Camera_track_following_evidence_…_202607192230.mp4` | `remotion/public/higgsfield/output/evidence.mp4` | Suivi d’une preuve | Exclure du rendu candidat |
| `Database_cores_connected_by_ligh…_202607192230.mp4` | `remotion/public/higgsfield/output/bridge.mp4` | Connexion entre systèmes | Exclure du rendu candidat |
| `Database_cores_connected_by_bridge_202607192230.mp4` | Pas d’intégration observée | Variante de pont de données | Exclure du rendu candidat |

Les noms contenant `…` comportent ce caractère dans le nom de fichier visible ; ils ne sont pas des noms reconstitués.

## Constats techniques

Les quatre fichiers audités partagent les caractéristiques suivantes :

- 1920 × 1080 ;
- H.264, pixel format `yuv420p` ;
- 24 images par seconde ;
- environ 8 secondes chacun ;
- piste audio AAC ;
- taille individuelle approximative comprise entre 9 et 13 Mo ;
- métadonnées d’encodage Google ;
- watermark Veo visible.

Le film Remotion existant vise 30 images par seconde. L’intégration directe de clips 24 fps ajouterait un risque de cadence irrégulière ou de conversion non maîtrisée.

## Constats visuels

L’inspection image par image et par planche contact a relevé :

- un watermark visible, incompatible avec un rendu de candidature propre ;
- des textes ou inscriptions générés peu fiables et parfois illisibles ;
- une esthétique spectaculaire, avec des effets proches de déflagrations, qui détourne le message de confiance et de maîtrise ;
- une continuité graphique insuffisante entre les clips ;
- un langage visuel plus cinématique que démonstratif, alors que les juges doivent voir le fonctionnement réel du produit.

Ces défauts ne prouvent pas que les fichiers sont techniquement inutilisables. Ils signifient qu’ils affaiblissent la candidature actuelle et nécessiteraient une régénération, un recadrage ou un remplacement dont le bénéfice ne justifie pas le risque avant l’échéance.

## Choix d’intégration

Conserver `useHiggsfield: false` pour le rendu de candidature et privilégier :

1. des fonds procéduraux sans texte généré ;
2. un graphe React/SVG montrant des dépendances reconnues qui convergent vers un digest ;
3. une chaîne de preuve lisible : **Declared → Detected → Proven** ;
4. des captures de l’interface locale réelle pour le prompt, le manifeste, le dossier et la revue humaine ;
5. un pont procédural sobre pour relier les signaux techniques au dossier ;
6. un écran final statique suffisamment long pour lire le nom et l’URL.

Le fichier `remotion/out/preuvance-hackathon.mp4` observé dans le projet constitue une base procédurale de 1920 × 1080, 30 fps et environ 48 secondes, sans watermark apparent lors de l’audit. Il doit néanmoins être rerendu et revérifié après les modifications finales ; il ne remplace pas à lui seul la vidéo de démonstration de 2 min 45 s.

## Storyboard visuel recommandé

### Plan 1 — Le bruit déclaratif

Des fiches abstraites apparaissent sans être cochées. Texte court : « A claim is not proof. » Aucun document réaliste ni faux logo.

### Plan 2 — Dossier instantané

Un prompt et trois sources abstraites convergent vers un dossier central nommé Preuvance. La transition doit prendre moins de cinq secondes.

### Plan 3 — Scan de dépendances

Un petit graphe montre `package.json`, `package-lock.json` et `requirements.txt` à gauche, un digest expurgé au centre, puis des catégories de dépendances à droite. Ne pas afficher de package non réellement reconnu dans la démo.

### Plan 4 — Preuve par preuve

Trois niveaux colorés et accessibles : Declared, Detected, Proven. Une seule carte passe à Proven lorsque le relecteur et la date apparaissent.

### Plan 5 — Interface réelle

Les captures du produit prennent la priorité sur l’animation. Montrer la saisie, le digest, le dossier et la validation avec des données de démo cohérentes.

### Plan 6 — Conclusion

Fond procédural discret, promesse « Prompt. Scan. Prove. », mention « Human review required » et URL finale.

## Contraintes d’accessibilité et de montage

- Contraste WCAG AA pour le texte important.
- Police d’au moins 32 px dans une vidéo 1080p pour les éléments narratifs.
- Aucun clignotement rapide ni mouvement essentiel lorsque la préférence de réduction des animations est active dans l’interface.
- Transitions de 250 à 600 ms ; éviter les zooms permanents.
- Les statuts ne doivent jamais reposer sur la couleur seule : ajouter libellé et icône.
- Captures de produit nettes, sans redimensionnement non entier si cela rend le texte flou.
- Normaliser tout média final en 1920 × 1080, 30 fps et vérifier l’audio après export.

## Provenance et droits

Avant la publication :

- vérifier les conditions d’utilisation et droits de redistribution de chaque média généré ;
- conserver les prompts et informations de génération utiles à la provenance interne ;
- ne pas retirer un watermark par retouche pour masquer l’origine d’un clip ;
- ne pas intégrer de musique, police, logo ou capture sans droit suffisant ;
- ne pas supprimer les quatre fichiers source : ils appartiennent au propriétaire du projet et restent hors du rendu final.

## TODO propriétaire

- [x] Retenir et implémenter la direction procédurale sans clips Veo pour le deck local et le PowerPoint.
- [ ] Valider les droits des polices, sons et logos retenus.
- [ ] Fournir ou approuver les captures de l’interface avec les données Northstar.
- [ ] Enregistrer la voix et choisir une musique autorisée, ou rester sans musique.
- [ ] Rendre le film final, contrôler chaque plan et confirmer l’absence de watermark.
- [ ] Vérifier que la vidéo YouTube finale reste sous trois minutes avec audio.

Rédigé et préparé le 20 juillet 2026 par ChatGPT 5.6, OpenAI.
