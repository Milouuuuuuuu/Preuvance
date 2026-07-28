# Déploiement

Procédure de mise en ligne de Preuvance. Elle n'existait que dans une tête
humaine jusqu'à l'audit du 26 juillet 2026 (DT-19) : c'est le genre de savoir
qui disparaît avec la personne qui le détient.

## Ce qui tourne où

| Cible | Contenu | Statut au 26/07/2026 |
| --- | --- | --- |
| Cloudflare Workers | L'application complète (pages, API, PDF, console interne) | **Non déployée** : aucun domaine ne résout |
| GitHub Pages (`gh-pages`) | Une page d'accueil autonome, publiée le 20/07/2026 | En ligne : `https://milouuuuuuuu.github.io/Preuvance/` |
| Poste client (PME) | `LANCER_PREUVANCE.cmd` → serveur local sur `127.0.0.1` | Fonctionnel, hors ligne |

Conséquence mesurée : la page publique **ne porte pas** l'instrumentation
analytique (elle est antérieure à son ajout, le 24/07). C'est la raison pour
laquelle PostHog ne mesure aucun trafic (voir `outputs/` pour le rapport).

## Déployer l'application sur Cloudflare

```bash
npm test          # la porte de vérification complète, jamais sautée
npm run deploy    # build Vite puis wrangler deploy
```

`npm run deploy:preview` publie une version sans basculer le trafic
(`wrangler versions upload`) : c'est la manière de valider une mise en ligne
avant de la rendre visible.

Prérequis, à faire une fois :

1. `npx wrangler login` (ou `CLOUDFLARE_API_TOKEN` dans l'environnement CI).
2. Créer les secrets côté Cloudflare ; ils ne passent **jamais** par
   `wrangler.jsonc`, qui est versionné :

   ```bash
   npx wrangler secret put OPENAI_API_KEY
   npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
   npx wrangler secret put NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   npx wrangler secret put NEXT_PUBLIC_POSTHOG_KEY
   npx wrangler secret put NEXT_PUBLIC_APP_URL
   ```

   `NEXT_PUBLIC_APP_URL` fait autorité sur l'origine publique (canoniques,
   sitemap, JSON-LD) : sans elle, l'origine est dérivée de la requête.
   Ne **jamais** poser `PREUVANCE_OPS` sur un déploiement public : la console
   interne doit rester en 404.

3. Appliquer les migrations Supabase sur le projet visé avant la première mise
   en ligne avec persistance (`supabase db push`, voir `docs/backend-setup.md`).

## Ce que `wrangler.jsonc` déclare

`compatibility_flags: ["nodejs_compat"]` (requis par le rendu PDF), le binding
`ASSETS` sur `dist/client` (sans lui, les fichiers statiques renvoient 404) et
le binding `IMAGES`. Ces valeurs doivent rester alignées avec
`localBindingConfig` dans `vite.config.ts` : les deux décrivent le même worker.

## Après un déploiement

1. Vérifier les en-têtes de sécurité : la réponse doit porter
   `content-security-policy` avec `default-src 'self'`, `x-frame-options: DENY`
   et, en HTTPS, `strict-transport-security`.
2. Vérifier que `/ops` renvoie **404**.
3. Vérifier `robots.txt` et `sitemap.xml` : ils doivent citer le domaine public
   réel, pas un hôte deviné.
4. Charger une page et confirmer dans PostHog qu'un `$pageview` arrive : c'est
   la seule preuve que la mesure fonctionne en production.

## Limite connue : `npm start`

Le serveur Node de production (`npm start`) rend le HTML mais **ne sert pas**
les fichiers de `dist/client` : sur Cloudflare c'est le binding `ASSETS` qui
s'en charge. `npm start` sert donc à vérifier le démarrage (c'est ce que fait
`tests/production-start.test.mjs`), pas à héberger le site. Le lanceur des
postes clients utilise `npm run dev`, qui sert bien les assets.
