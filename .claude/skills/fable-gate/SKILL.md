---
name: fable-gate
description: Porte de vérification Preuvance — à exécuter avant tout commit ou release sur ce dépôt. Encode les pièges connus du projet (BOM des .ps1, verrou OneDrive sur le zip, synchronisation TS/PowerShell) et le protocole zéro-faux-positif pour la revue et la re-notation.
---

# fable-gate — porte de vérification Preuvance

Procédure de vérification avant commit/release, écrite par Fable (Claude
Fable 5, Anthropic) à partir des incidents réellement rencontrés sur ce dépôt.
Chaque règle ci-dessous a été payée par un bug réel.

## 1. Après toute édition d'un fichier `.ps1`

Les outils d'édition écrivent l'UTF-8 **sans BOM** ; Windows PowerShell 5.1
lit alors les accents comme du Windows-1252 et peut interpréter des fragments
de texte français comme des commandes. **Toujours** ré-appliquer le BOM :

```powershell
$p = "scripts\<fichier>.ps1"
$txt = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($p, $txt, (New-Object System.Text.UTF8Encoding($true)))
```

Puis exécuter les autotests du script :

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\preuvance-scan.ps1 -SelfTest
```

Attendu : `AUTOTEST OK (N assertions)`, code de sortie 0.

## 2. Synchronisation TS ↔ PowerShell

Le catalogue des fournisseurs d'IA existe en deux exemplaires :
`lib/scan/scan-contract.ts` (`AI_PROVIDER_HOSTS`) et
`scripts/preuvance-scan.ps1` (`$aiProviders`). Le test
`tests/scan-script.test.ts` échoue si identifiants, labels ou motifs
divergent. Toute modification d'un côté doit être répliquée de l'autre
**avant** de lancer la chaîne.

## 3. Chaîne complète

```powershell
npm test
```

Enchaîne lint, `tsc --noEmit`, tests unitaires (dont autotests PowerShell et
garde-fou de synchronisation), build de production et tests HTTP Workerd.

**Piège OneDrive n° 2 (vérifié le 16/07/2026)** : enchaîné immédiatement après
le build, le test HTTP peut échouer en 500 / « Network connection lost » —
OneDrive synchronise les artefacts fraîchement écrits et verrouille des
fichiers au moment où Workerd les charge. Sur cette machine, exécuter les
étapes séparément avec ~25 s de pause entre `npm run build` et
`node --test tests/rendered-html.test.mjs`. La CI (ubuntu, sans OneDrive)
n'est pas affectée. Si l'échec persiste, tuer les processus `vinext`/`workerd`
orphelins avant de relancer (ne jamais tuer les processus claude/anthropic).

## 4. Régénération du zip local (piège OneDrive)

Ce dépôt vit sous OneDrive : `Compress-Archive` peut échouer en plein build
parce que OneDrive verrouille un fichier du staging, **après** que le script a
déjà supprimé l'ancien zip. Le dépôt se retrouve alors sans archive.

Après chaque `scripts/build-local-download.ps1` :

1. vérifier que `public/downloads/preuvance-local.zip` existe ;
2. vérifier une taille plausible (> 1 Mo) ;
3. en cas d'échec : supprimer `outputs/local-download-staging`, relancer.

Ne jamais commiter sans avoir fait ces vérifications si le zip a été touché.

## 5. Protocole zéro-faux-positif (revue et re-notation)

- Un constat n'est rapporté qu'après lecture directe du code incriminé, avec
  fichier et ligne à l'appui. Jamais sur la seule foi d'une description.
- Un constat non code-vérifiable (marché, juridique) est étiqueté comme tel.
- Dans les workflows de notation, l'énumération des sévérités doit être
  imposée par le schéma (`enum: ["critical", "major", "medium", "low"]`) —
  un filtre textuel sur des sévérités libres a déjà silencieusement vidé une
  passe de vérification adversariale.
- Une limite réelle non corrigeable dans la vague en cours est documentée
  honnêtement (docs + rapport), jamais tue.

## 6. Fixture de scan

La fixture `tests/fixtures/scan-sample.json` est un rapport réellement
produit par le script. Pour la régénérer :

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\preuvance-scan.ps1 `
  -Yes -DeclaredProviders anthropic -Roots <dossier-synthetique> `
  -OutFile tests\fixtures\scan-sample.json
```

Précédée de `Resolve-DnsName api.anthropic.com` pour garantir qu'un endpoint
observé figure dans le cache DNS (sinon la fixture perd le chemin
« concordant »). Le dossier synthétique doit contenir `.env.local` (secret
détecté), `.env.example` (gabarit exclu) et un fichier `facture-*.pdf`
(financier).
