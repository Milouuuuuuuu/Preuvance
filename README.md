# Preuvance

**Maîtrisez votre risque IA, préparez-en la preuve pour votre courtier.**

Preuvance est un MVP français de préparation au règlement européen sur l’IA pour PME et small mid-caps. L’utilisateur décrit son système en langage courant ; une chaîne de raisonnement structurée extrait les faits, classe le risque, produit une liste d’écarts priorisés, calcule un score de préparation de 0 à 100 et génère un dossier PDF destiné à une première conversation avec un courtier ou un investisseur.

Preuvance ne délivre ni avis juridique, ni certification, ni décision d’assurabilité.

## Décision Step 0

Le nom initial **Aplomb** a été rejeté après recherche : les trois domaines visés sont enregistrés et une entreprise homonyme intervient déjà en gouvernance IA et réglementaire. **Preuvance** a été retenu à **86/100**. Les contrôles RDAP sont favorables mais l’achat du domaine et la recherche EUIPO/TMview restent à effectuer avant lancement public.

Le détail des sources est dans [`docs/research.md`](docs/research.md). Toutes les décisions et leur note sur 100 sont consignées dans [`BEHAVIOR.md`](BEHAVIOR.md).

## Ce que fait le MVP

1. identification de l’organisation et du système, description libre et données de taille d’entreprise ;
2. extraction factuelle structurée ;
3. classification contre une référence réglementaire versionnée ;
4. écarts et actions associés à des articles précis ;
5. score déterministe et notes de confiance par décision ;
6. rapport PDF de préparation courtier ;
7. persistance atomique et contrôle d’accès Supabase lorsque les variables sont configurées.

## Contrainte réglementaire importante

Au **13 juillet 2026**, l’Omnibus IA est adopté et signé, mais encore en attente de publication au Journal officiel de l’Union européenne. L’application sépare donc :

- le droit actuellement contraignant issu du règlement (UE) 2024/1689 ;
- les dates futures prévues par l’Omnibus, clairement marquées comme non encore en vigueur.

La référence structurée, et non la mémoire du modèle, est injectée dans chaque classification.

## Configuration locale

Prérequis : Node.js 22.13 ou plus récent.

```bash
cp .env.example .env.local
npm install
npm run dev
```

En développement, renseigner au minimum `OPENAI_API_KEY`. Sans cette clé, l’interface reste accessible mais refuse explicitement de produire une évaluation ; aucun résultat fictif n’est généré. En production, Supabase doit aussi être configuré afin d’éviter un endpoint OpenAI anonyme.

Supabase est activé lorsque `NEXT_PUBLIC_SUPABASE_URL` et une clé publique (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, ou l’ancienne `NEXT_PUBLIC_SUPABASE_ANON_KEY`) sont présentes. Dans ce mode, une session est requise et l’évaluation, son rapport et son journal de raisonnement sont enregistrés ensemble. Les secrets ne doivent jamais être commités.

## Téléchargement Windows one shot

Le bouton « Télécharger la version locale » sert `public/downloads/preuvance-local.zip`. Après extraction, `LANCER_PREUVANCE.cmd` :

1. vérifie Windows PowerShell et Node.js `22.13.0+` ;
2. demande la clé OpenAI sans l’afficher si elle n’est pas déjà configurée ;
3. exécute `npm ci`, puis le build de vérification ;
4. démarre Vinext uniquement sur `127.0.0.1` et ouvre le navigateur.

Le lanceur ne demande pas les droits administrateur et ne scanne pas le poste. Le détail et la commande de régénération sont dans [`docs/local-launch.md`](docs/local-launch.md).

## Vérification

```bash
npm run lint
npm test
npm run build
```

## Architecture

- Next App Router, React, TypeScript strict, Tailwind ;
- API Responses OpenAI avec JSON Schema strict ;
- score et tiers calculés de façon déterministe ;
- PDF serveur via `@react-pdf/renderer` ;
- Supabase Auth/Postgres/RLS ;
- quota atomique de cinq démarrages d’évaluation par utilisateur et par heure ;
- PDF persistant relu sous RLS à partir de son identifiant, jamais forgé depuis le navigateur ;
- runtime Sites/Vinext compatible Cloudflare Worker.

## Extension locale « System Exposure »

Le prompt d’extension machine suppose un autre socle qui n’est pas présent dans ce workspace : un CLI Python/Typer/Rich avec une commande `aplomb scan` déjà validée trois fois. Preuvance ne simule donc aucun accès PowerShell depuis le navigateur. Le gate, la vérification des cmdlets Windows et la stratégie de reprise sont consignés dans [`docs/preuvance-machine-gate.md`](docs/preuvance-machine-gate.md).

## Périmètre volontairement exclu

Pas d’intégration assureur réelle, de tarification, de paiement, de générateur Annexe IV complet, de monitoring continu ni de promesse de couverture.
