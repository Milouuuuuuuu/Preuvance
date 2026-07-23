---
name: seo-audit
description: Checklist SEO de Preuvance — métadonnées uniques + canonique par page publique, /demo noindex (D-085), robots.txt et sitemap.xml servis par routes dédiées, JSON-LD sans notes ni compteurs inventés (D-081), vérification par tests/rendered-html.test.mjs avec le piège de démarrage à froid OneDrive.
---

# seo-audit — checklist SEO de Preuvance

À dérouler après toute modification d'une page publique, des métadonnées,
du layout ou des routes `robots.txt` / `sitemap.xml`.

## 1. Métadonnées par page publique

Chaque page publique (`app/page.tsx`, `app/scan/page.tsx`,
`app/en-clair/page.tsx`, `app/build-week/page.tsx`,
`app/outils/migration-sqlite-postgresql/page.tsx`) exporte un
`metadata: Metadata` avec :

- `title` **unique** sur le site (pas deux pages avec le même titre) ;
- `description` de **150 à 160 caractères** — compter, ne pas estimer :

```powershell
"…la description…".Length
```

- `alternates: { canonical: "/chemin" }` (chemin relatif, l'URL de base est
  résolue à la requête).

## 2. /demo reste noindex (D-085)

`app/demo/page.tsx` garde `robots: { index: false, follow: false }` et
**ne doit jamais** apparaître dans le sitemap. Toute PR qui indexe la démo
ou l'ajoute au sitemap est un non — la démo est un dossier fictif, son
indexation créerait de fausses attentes en résultats de recherche.

## 3. robots.txt et sitemap.xml

Servis par `app/robots.txt/route.ts` et `app/sitemap.xml/route.ts` — pas
de fichiers statiques dans `public/`. L'URL de base est **dérivée des
headers de la requête** : ne jamais coder un domaine en dur. Toute
nouvelle page publique indexable s'ajoute au sitemap ; /demo en reste
exclue (voir le commentaire en tête de `app/sitemap.xml/route.ts`).

## 4. JSON-LD (D-081)

Le bloc `application/ld+json` vit dans `app/layout.tsx`. **INTERDIT** d'y
ajouter `aggregateRating`, des avis (`review`), des compteurs
d'utilisateurs ou toute donnée chiffrée inventée — règle D-081 : aucune
métrique fabriquée, nulle part, y compris pour « aider le SEO ». Seules
des informations vraies et vérifiables (nom du produit, description,
langue) y figurent.

## 5. Langue

`lang="fr"` sur `<html>` et `openGraph.locale: "fr_FR"` sont déjà en place
dans `app/layout.tsx` — ne pas les casser en retouchant le layout.

## 6. Vérification

```powershell
npm run build
# ~25 s de pause (piège OneDrive, cf. skill fable-gate)
node --test tests/rendered-html.test.mjs
```

Le test rendu vérifie les réponses réellement servies, dont `robots.txt`
(zones privées exclues, pointeur sitemap) et `sitemap.xml` (pages
publiques, /demo absente). Les balises `canonical`/`description` de chaque
page se contrôlent à la main (`curl` de la page + inspection du `<head>`).
**Piège de ce poste** : le démarrage à froid du serveur
de test peut dépasser 150 s à cause d'OneDrive ; le timeout par défaut est
de 180 s et s'ajuste via la variable d'environnement :

```powershell
$env:PREUVANCE_TEST_STARTUP_TIMEOUT_MS = "300000"
node --test tests/rendered-html.test.mjs
```

Attendu : tous les tests verts. Un échec « Network connection lost »
juste après le build est le piège OneDrive n° 2 documenté dans
`fable-gate` (§ 3) — pause puis relance, ne pas conclure à une régression.
