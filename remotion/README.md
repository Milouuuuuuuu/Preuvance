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
```

Les vidéos finales sont écrites dans `out/`.
