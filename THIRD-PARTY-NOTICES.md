# Composants tiers redistribués

Preuvance est publié sous licence MIT (voir [`LICENSE`](LICENSE)). Ce fichier
recense les composants tiers **redistribués tels quels** dans le dépôt et dans
l'archive de téléchargement, avec leur licence et leur mention de droit d'auteur.

Il ne recense pas les dépendances installées par `npm ci` : celles-ci sont
téléchargées depuis le registre npm sur le poste de l'utilisateur, avec leurs
propres fichiers de licence, et ne sont pas redistribuées par ce projet.

## Yoga — `lib/pdf/yoga.wasm`

Moteur de calcul de disposition utilisé par le rendu PDF, embarqué sous forme de
binaire WebAssembly afin que la génération de PDF fonctionne dans le runtime
Cloudflare Worker sans dépendance native.

- **Origine** : paquet npm `yoga-layout` 3.2.1 — https://github.com/facebook/yoga
- **Licence** : MIT
- **Mention conservée** :

```text
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Note sur les licences des dépendances

L'arbre de dépendances a été contrôlé : **aucune licence copyleft forte**
(GPL, AGPL, SSPL) n'y figure. Plusieurs paquets sont en **MPL-2.0**
(`lightningcss`, `satori`, `@vercel/og`, `axe-core`, `@resvg/resvg-wasm`) et
`dompurify` en `MPL-2.0 OR Apache-2.0`. La MPL-2.0 impose de partager les
modifications **des fichiers concernés** ; elle n'impose rien au reste du
projet et n'empêche pas une distribution sous MIT. Ces paquets sont utilisés
sans modification.

Ce contrôle doit être refait après tout ajout de dépendance : une licence
copyleft forte apparaissant dans l'arbre changerait les conditions de
distribution du produit.
