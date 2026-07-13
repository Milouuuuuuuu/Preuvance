# Consignes durables du dépôt

Lire `BEHAVIOR.md` avant toute modification matérielle.

- Le produit s’appelle **Preuvance**. « Aplomb » n’est conservé que dans l’historique de recherche.
- Toute décision produit, réglementation, IA, données, sécurité ou architecture doit être inscrite dans `BEHAVIOR.md` avec une note sur 100.
- Les affirmations réglementaires viennent uniquement de `lib/regulatory` et distinguent droit contraignant, texte futur adopté et incertitude.
- Les sorties OpenAI sont validées par schéma strict. Aucun parsing artisanal de texte libre, aucun résultat fictif et aucun fallback silencieux.
- Le score final est déterministe et testé. Une note d’étape exprime la confiance de l’analyse, jamais une certification.
- Les secrets restent dans `.env.local`, jamais dans le dépôt ni les logs.
- Respecter l’ordre des gates : pipeline → interface → PDF → auth/persistance → finition.
- Avant livraison : exécuter le lint, les tests et le build ; corriger toute erreur réelle.
- Préserver WCAG AA, clavier, HTML sémantique et `prefers-reduced-motion`.

Commandes de vérification :

```text
npm run lint
npm test
npm run build
```
