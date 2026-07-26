# Onboarding équipe — poste prêt en 20 minutes

Ce document met un poste de travail Preuvance en état de marche : fondateur,
opérateur de mission ou développeur. Une seule règle traverse tout : **les
secrets vivent dans `.env.local`, jamais dans le dépôt, jamais dans un
message** (D-098 pour les missions, même esprit pour l'équipe).

## 1. Prérequis

- **Node.js ≥ 22.13** (cf. `engines` de `package.json`).
- **Git**, et un accès au dépôt GitHub.
- **Docker Desktop** uniquement pour la vérification Supabase locale — le
  reste du projet n'en a pas besoin, et il doit être **arrêté** pendant
  `npm test` (voir pièges plus bas).

## 2. Installation

```bash
git clone https://github.com/Milouuuuuuuu/Preuvance.git
cd Preuvance
npm ci
npm run poste:verifier
```

`poste:verifier` dit ce qui manque sans jamais lire ni afficher une valeur de
clé : version de Node, dépendances, variables présentes/absentes, pièges
actifs de la machine (Docker, OneDrive).

## 3. Environnement selon le rôle

Copier le gabarit puis remplir **seulement ce que le rôle exige** :

```bash
cp .env.example .env.local
```

| Rôle | Variables à remplir | Ce que ça ouvre |
| --- | --- | --- |
| Direction / pilotage | `PREUVANCE_OPS=1`, clés PostHog (`phc_`, `phx_`, projet) | Console interne `/ops`, tableaux de bord, provisionnement analytics |
| Opérateur de mission | aucune obligatoire | Agent d'inventaire, documents admin et rapports : tout tourne en local sans clé |
| Développeur produit | `OPENAI_API_KEY` (pipeline réel), Supabase si besoin de la persistance | Dossier instantané réel, comptes et sauvegarde |

Sans clé, chaque module devient no-op ou refuse explicitement — la démo
`/demo`, le scan local et le diagnostic fonctionnent toujours.

## 4. Lancer

```bash
npm run dev              # http://localhost:3000
npm run inventaire:demo  # mission fictive de bout en bout
npm run admin:demo       # six documents administratifs de démonstration
```

La console interne `/ops` n'existe que si `PREUVANCE_OPS=1` est posée sur le
poste (sinon la route renvoie 404). Elle affiche l'état des clés — présence
seulement, jamais les valeurs — le runbook de mission et les programmes.

## 5. Avant tout commit

```bash
npm test
```

C'est la porte **fable-gate** (`.claude/skills/fable-gate/SKILL.md`) : lint,
typecheck, tests unitaires, build de production et tests HTTP Workerd. Toute
décision matérielle se consigne dans `BEHAVIOR.md` avec une note sur 100.

## 6. Pièges connus des postes Windows (payés en heures réelles)

- **Docker Desktop en marche casse les tests Workerd** (« Network connection
  lost ») : l'arrêter avant `npm test`. Il ne sert qu'à
  `supabase-local-verify`.
- **Dépôt sous OneDrive** : après `npm run build`, OneDrive peut verrouiller
  les artefacts — attendre ~25 s avant les tests HTTP ; après régénération du
  zip local, vérifier sa présence et sa taille (> 1 Mo).
- **`curl` vers des hôtes HTTPS échoue en sandbox** (`CRYPT_E_REVOCATION_OFFLINE`) :
  ajouter `--ssl-no-revoke` (spécifique Schannel/Windows).
- **`npx supabase db reset` casse le port 54322** : préférer
  `npx supabase stop --no-backup` puis `npx supabase start`.

## 7. Où lire ensuite

- `README.md` — vue d'ensemble produit.
- `BEHAVIOR.md` — le registre de décisions : c'est la mémoire du projet.
- `docs/operateur-diagnostic.md` — runbook J1-J10 d'une mission.
- `docs/analytics.md` — contrat de mesure D-087 (jamais de texte libre).
