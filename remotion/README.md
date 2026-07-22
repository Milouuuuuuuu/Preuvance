# Films Remotion Preuvance

Le dossier contient le teaser historique de 48 secondes et une démonstration Build Week de **154 secondes** en 1080p. La démonstration utilise des captures du build réel, une voix anglaise locale et des sous-titres incrustés. Les écrans Northstar sont toujours marqués comme fixture fictive sans appel modèle.

## Commandes

```powershell
npm install
npm run narration
npm run render:demo
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

Le fichier prêt à téléverser est `out/preuvance-build-week-submission.mp4`. Après `npm run render:demo`, normaliser la piste audio sans réencoder la vidéo :

```powershell
ffmpeg -y -i out/preuvance-build-week-demo.mp4 -c:v copy -af "loudnorm=I=-16:LRA=7:TP=-1.5,aresample=48000" -ar 48000 -c:a aac -b:a 192k out/preuvance-build-week-submission.mp4
```

Si les plans Higgsfield ne sont pas disponibles, le teaser reste jouable grâce aux animations procédurales. Les clips Higgsfield sont décoratifs : ils peuvent remplacer les transitions du teaser, jamais une capture de fonctionnalité ou un résultat de dossier.
