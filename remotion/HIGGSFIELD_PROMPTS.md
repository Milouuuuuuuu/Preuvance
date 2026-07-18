# Plans Higgsfield — Preuvance Hackathon 2026

Utiliser les trois images de `public/higgsfield/input/` comme premières images. Exporter en **1920×1080, 30 i/s, MP4**, sans texte ajouté et sans audio. Les textes et le logo sont superposés ensuite par Remotion afin de rester parfaitement lisibles.

## 1. Ouverture — `opening.png` → `opening.mp4`

Durée cible : 5 à 8 secondes.

> Cinematic slow dolly-in through a dark navy evidence room. Three translucent glass legal dossier folders float with restrained parallax. Paper edges react subtly to air, blue light travels along the document lines, and the green verification seal emits one elegant soft pulse. Premium European legal-tech aesthetic, realistic optical depth, controlled anamorphic highlights, no new objects, no readable text, no logos, no camera shake, no morphing. Preserve the original composition and dark blue, electric blue and green palette. 16:9.

## 2. Chaîne de preuve — `evidence.png` → `evidence.mp4`

Durée cible : 7 secondes.

> Precise lateral camera track following a luminous evidence chain in a dark architectural space. Energy travels sequentially from the blue node to the cyan node and finally to the green verified node. Fine particles reveal the path, each node activates once, no explosions. Premium data visualization, optical realism, high contrast navy background, clean controlled motion, no text, no logos, no extra nodes, no deformation. Preserve the three-node composition. 16:9.

## 3. Portabilité — `bridge.png` → `bridge.mp4`

Durée cible : 7 secondes.

> Slow orbital camera move around two secure database cores connected by an encrypted luminous bridge. A packet of blue light crosses from the left database to the right database, passes through the central security ring, then turns green when verified. Cinematic enterprise technology, polished glass and metal, dark navy atmosphere, subtle volumetric light, no readable text, no logos, no extra databases, no distortion. Preserve the symmetric composition. 16:9.

## Dépôt des exports

Placer les fichiers dans :

```text
public/higgsfield/output/opening.mp4
public/higgsfield/output/evidence.mp4
public/higgsfield/output/bridge.mp4
```

Puis lancer :

```powershell
npm run render:higgsfield
```
