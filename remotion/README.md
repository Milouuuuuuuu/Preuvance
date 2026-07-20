# Film Remotion Preuvance

Film hackathon de 48 secondes, disponible en 16:9 et 9:16. Il fonctionne immédiatement avec des animations procédurales Remotion et accepte trois plans générés dans Higgsfield.

## Commandes

```powershell
npm install
npm run frames
npm run studio
npm run render
npm run render:vertical
```

Après génération des plans Higgsfield décrits dans `HIGGSFIELD_PROMPTS.md` :

```powershell
npm run render:higgsfield
npm run render:higgsfield-vertical
```

Les vidéos finales sont écrites dans `out/`.

Si les plans Higgsfield ne sont pas disponibles (pas encore générés, ou téléchargement impossible), le film reste jouable : la scène « Pont » retombe automatiquement sur une animation 100 % Remotion (`BridgeProcedural` dans `src/film/ProceduralBackgrounds.tsx`) qui reproduit le même principe visuel — un point de lumière qui traverse à vitesse constante, sans collision, jusqu'à ce que le rebord droit devienne vert.
