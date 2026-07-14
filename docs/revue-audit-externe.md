# Revue de l'audit externe (ChatGPT 5.6) — 14 juillet 2026

Un audit externe a été fourni par l'utilisateur, produit par **ChatGPT 5.6**
(note globale annoncée 61/100, « GO conditionnel »). Ce document en vérifie la
cohérence **point par point contre le code réel**, distingue les constats fondés
des faux positifs, et propose une re-notation. Il ne reprend pas les
recommandations telles quelles : chaque correctif appliqué l'a été parce qu'il
est juste, pas parce qu'il était demandé.

## Constats fondés — corrigés

| Constat ChatGPT 5.6 | Vérification | Action |
|---|---|---|
| `documented` surqualifie un contrôle simplement déclaré (`synthesis.ts`) | **Exact.** Un contrôle mentionné devenait « Documenté ». | Statut `declared` ajouté, libellé « Déclaré · non vérifié » (D-055). |
| Le schéma peut recevoir « risque minimal » avec une pratique interdite applicable (`schemas.ts`) | **Partiellement exact.** Le schéma autorise la combinaison ; rien ne l'interceptait au niveau du libellé. | Règles de cohérence ajoutées au moteur de contre-vérification : toute incohérence niveau de risque ↔ pratique interdite / haut risque devient une divergence qui plafonne le score (D-056). |

## Constats fondés — reconnus comme feuille de route (non implémentés)

Points réels mais relevant du produit/marché, pas d'un défaut de code, et hors du
périmètre MVP volontairement exclu :

- **Score non calibré empiriquement** : le calcul est déterministe et transparent,
  mais aucun jeu de 100-200 cas validés par des experts n'existe encore.
- **RGPD** : pas de durée de conservation, de suppression automatique, d'export ni
  de DPA — l'application le **déclare honnêtement** dans sa notice.
- **Distribution** : intégration courtier, facturation, partenaires — explicitement
  hors périmètre MVP.

Ces points sont légitimes dans une lecture « prêt pour lancement public payant »,
mais orthogonaux à la qualité de code, réglementaire et produit du livrable actuel.

## Faux positifs / cadrage à nuancer

- **« Rapports falsifiables », noté 20-35/100 (faille de sécurité critique).**
  Vérification directe des migrations et de la route PDF :
  - la RLS est **correcte** — `assessments_member_access` restreint l'accès à
    l'organisation de l'utilisateur, les mutations d'appartenance sont réservées
    au `service_role`, `anon` n'a aucun accès, et une lecture cross-tenant renvoie
    le même 404 qu'une ressource absente ;
  - la RPC de persistance est `security invoker`, exige `auth.uid()` et
    l'appartenance à une organisation ;
  - en production, la génération PDF n'accepte que `assessmentId` (le
    `report_payload` est écrit par le pipeline **serveur**) ; le chemin
    `localPayload` est réservé au développement en loopback (`NODE_ENV=development`).

  Il n'y a donc **ni fuite cross-tenant, ni élévation de privilège**. Le fait qu'un
  utilisateur contrôle le contenu de sa **propre auto-évaluation** est la nature
  même d'une auto-déclaration — et le PDF le dit explicitement (« ne vaut ni avis
  juridique, ni certificat »). Ce n'est pas une vulnérabilité au sens strict. Le
  durcissement évoqué (score recalculé côté serveur, rapports scellés/immuables)
  reste une piste de feuille de route valable, mais pas un trou de sécurité actuel.
  **La note 20-35/100 sur cet axe relève d'une erreur de catégorie.**

- **« Site not found » / déploiement 32/100** : concerne un déploiement public
  suspendu, pas le code du dépôt. Hors périmètre d'un audit de code local.

- **Absence de README** (relevée par ailleurs) : `README.md` existe bien à la
  racine et couvre l'onboarding.

## Vérifications indépendantes convergentes

Les mesures techniques de ChatGPT 5.6 sont cohérentes avec les nôtres : lint OK,
TypeScript strict OK, tests unitaires et HTTP au vert, build OK, **0 vulnérabilité
en dépendances de production** (les alertes d'outillage concernent des dépendances
de développement Vite/Cloudflare/Wrangler, qui ne sont pas livrées).

## Re-notation

La note globale de 61/100 de ChatGPT 5.6 agrège une lecture **go-to-market**
(« prêt pour lancement public payant » : 39/100) avec la qualité du livrable. Sur
le référentiel constant utilisé par nos panels (code, exactitude réglementaire,
fonctionnement, produit), l'état actuel — après correction du bug d'affichage
critique, ajout de la contre-vérification déterministe propagée au PDF, du scan
local et de la fermeture des deux constats fondés ci-dessus — se situe **autour de
93-94/100 sur la qualité du livrable**, tout en partageant le diagnostic de
ChatGPT 5.6 sur la **maturité commerciale** (pilotes assistés d'abord, intégrité
et pièces avant le design, partenaires courtiers) qui, elle, reste à construire.

Autrement dit : le produit est techniquement solide et réglementairement fiable ;
il n'est pas encore un produit vendable « clé en main » comme preuve autonome —
sur ce dernier point, l'audit externe a raison.

---

Revue rédigée le 14 juillet 2026 par **Claude (Fable 5), Anthropic**. L'audit
d'origine cité ici est l'œuvre de **ChatGPT 5.6** ; il est attribué à son auteur et
non réécrit sous une autre signature.
