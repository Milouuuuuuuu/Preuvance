# Lancer Preuvance localement sous Windows

Le téléchargement direct contient le code de l’application web Preuvance et un lanceur Windows. Il ne contient ni `node_modules`, ni build précompilé, ni secret.

## One shot

1. installer [Node.js](https://nodejs.org/) `22.13.0` ou plus récent ;
2. extraire complètement `preuvance-local.zip` ;
3. double-cliquer sur `LANCER_PREUVANCE.cmd` ;
4. saisir une clé API OpenAI au premier lancement.

Le lanceur exécute `npm ci`, vérifie le build, démarre Vinext sur `127.0.0.1` puis ouvre le navigateur. La clé est saisie sans écho et enregistrée uniquement dans `.env.local`, ignoré par Git. Supabase reste optionnel dans ce mode de développement local.

Le lanceur ne demande aucune élévation, n’interroge aucune API système et ne constitue pas l’extension « System Exposure » décrite dans le [document de gate](preuvance-machine-gate.md).

## Regénérer le téléchargement

Depuis la racine du dépôt :

```powershell
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-local-download.ps1
```

Le script assemble une allowlist dans `public/downloads/preuvance-local.zip`. Les caches, builds, dépendances, sorties, fichiers `.env` et formats de secrets usuels sont exclus.
