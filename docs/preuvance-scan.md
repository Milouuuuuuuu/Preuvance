# Scan local Preuvance

Le scan local est l'**option A** de Preuvance : une analyse de conformité IA qui
tourne entièrement sur le poste de l'utilisateur, avec son consentement, sans
rien envoyer sur Internet. Il alimente un score d'exposition déterministe,
indépendant de tout modèle de langage, et une **concordance déclaré / observé**
qui corrobore (ou contredit) la déclaration d'usage d'IA de l'utilisateur.

## Ce qu'il fait

1. **Déclaration d'usage d'IA** — avant le scan, l'utilisateur déclare les
   fournisseurs d'IA que son organisation utilise sciemment (liste interactive,
   ou `-DeclaredProviders openai,anthropic`, ou `aucun`). Cette déclaration est
   enregistrée dans le rapport (`declaration`), avec sa méthode de recueil.
2. **Profil du poste** — personnel ou professionnel, détecté via
   `Win32_ComputerSystem.PartOfDomain` et `dsregcmd /status` (jonction domaine ou
   Entra ID). Sur un poste professionnel géré, le rapport recommande de passer par
   le canal IT/DPO officiel plutôt que par ce script ad hoc.
3. **Inventaire des fichiers sensibles** — chemin, taille, dates et empreinte
   SHA-256, **sans jamais copier ni lire le contenu**. La détection est fondée sur
   le nom et l'extension (`.env`, `.pem`, `id_rsa`, `.pfx`, documents financiers,
   motifs de données personnelles). Les gabarits versionnés sans valeur secrète
   réelle (`.env.example`, `.env.sample`, `.env.template`, `.dist`) sont exclus.
   C'est un « pointage » d'actifs conforme à l'esprit de NIST CSF 2.0 (ID.AM-07)
   et ISO 27001 (A.5.9).
4. **Observation réseau « shadow AI »** — détecte les appels de vos logiciels vers
   des API d'IA connues (OpenAI, Anthropic, Azure OpenAI, Google, Mistral, etc.).
   En mode surveillance, l'utilisateur peut laisser le scan tourner une heure
   pendant qu'il travaille.

## La concordance déclaré / observé

C'est la spécificité du scan Preuvance : il ne se contente ni de croire la
déclaration (comme un questionnaire), ni d'observer sans cadre (comme un outil
de sécurité). Il **compare les deux**, dans l'esprit de la déclaration du
risque en assurance (art. L113-2 du Code des assurances) — une déclaration
corroborée par une observation indépendante vaut plus qu'une déclaration sur
l'honneur.

| Verdict | Signification |
|---|---|
| **Concordant** | Au moins un usage déclaré est effectivement observé, et aucun usage non déclaré n'est détecté. La déclaration est corroborée. |
| **Divergent** | Un usage d'IA est observé sans figurer dans la déclaration (« shadow AI ») : écart de sincérité, pénalité critique jusqu'à résolution. |
| **Non corroboré** | Rien ne contredit la déclaration, mais rien ne la corrobore encore (instantané trop court, TTL DNS) : relancer en mode surveillance. |
| **Sans déclaration** | Rapport produit sans déclaration (`-Yes` sans `-DeclaredProviders`, ou rapport antérieur) : comportement historique, tous les endpoints sont traités comme non déclarés. |

Le champ `declared` de chaque endpoint est recalculé côté application à partir
du bloc `declaration` et du nom d'hôte (jamais sur la seule foi du champ écrit
par le scanner), ce qui rend le verdict robuste à une édition manuelle du
champ. Cas concret résolu : Claude Code, utilisé par l'équipe sur ce projet,
était auparavant affiché « shadow AI critique » ; déclaré avant le scan, il
apparaît désormais comme un usage corroboré, mineur.

Limites résiduelles, assumées : la déclaration reste auto-déclarative (le
rapport est produit par l'utilisateur, pour l'utilisateur) ; la corroboration
est au niveau du fournisseur contacté, pas de l'usage métier qui en est fait ;
et une absence d'observation ne prouve jamais une absence d'usage.

Le rapport est écrit dans `Documents\Preuvance\preuvance-scan.json`, puis chargé
dans la page **« Scanner en local »** de l'application, qui reste elle aussi 100 %
locale (le fichier est lu dans le navigateur, sans upload).

## Comment la détection réseau fonctionne — et ses limites

Le contenu HTTPS est chiffré : le scan n'observe **que la destination**, pas le
contenu des requêtes. Deux sources natives, sans droit administrateur :

- **`Get-DnsClientCache`** — révèle les noms d'hôtes résolus (ex. `api.openai.com`).
  C'est le signal **fiable pour identifier le fournisseur**. Limite : le cache
  expire vite (TTL de 60 à 300 s), donc un instantané rate beaucoup d'appels.
- **`Get-NetTCPConnection`** — donne le processus (PID) derrière une connexion.
  C'est la seule source qui attribue nativement une connexion à un logiciel.

Le scan **corrèle les deux** : il ne se fie **pas** aux plages d'adresses IP, car
elles sont partagées et non publiées de façon fiable pour OpenAI (Cloudflare) ou
Azure OpenAI (Azure Front Door) — s'y fier produirait des faux positifs. Seul le
**nom d'hôte** déclenche une détection ; le processus est ajouté quand la
corrélation est possible.

Limites assumées, écrites dans le rapport lui-même (`notes`) :

- l'absence de détection **ne prouve pas** l'absence d'appel (échantillonnage,
  TTL) — d'où la recommandation du mode surveillance sur une heure ;
- l'attribution au processus est au mieux indicative, et dépend des droits du
  compte utilisateur (`Get-NetTCPConnection` peut ne pas tout énumérer selon la
  session) ;
- une résolution DNS n'est pas une connexion effective.

Une capture exhaustive (journal DNS ETW, `pktmon`, audit WFP 5156) existe mais
exige des droits administrateur : hors périmètre du scan sans élévation, par
choix de proportionnalité.

## Score d'exposition

Calcul déterministe et auditable (`app/lib/assessment/scan-scoring.ts`,
`preuvance-scan-scoring-v1`) : chaque signal retire des points.

| Signal | Gravité | Effet |
|---|---|---|
| Appel d'IA **non déclaré** | critique | forte baisse — un système d'IA hors inventaire échappe à la classification et aux obligations |
| Appel d'IA déclaré (corroboré) | mineur | trace, sans pénalité forte |
| Secrets/certificats/identifiants en clair | majeur → critique | risque de gouvernance des données (le titre du constat distingue secrets et identifiants) |
| Fichiers de données personnelles | modéré → majeur | à rattacher à une finalité et une durée |
| Autres fichiers sensibles non catégorisés | mineur | à vérifier manuellement |
| Observation réseau indisponible | mineur | angle mort signalé |

## Confidentialité

- Aucun contenu de fichier n'est lu ni copié ; seules des métadonnées et une
  empreinte SHA-256 sont enregistrées.
- Le SHA-256 nu est une pseudonymisation, pas une anonymisation : pour un très
  petit fichier, il peut théoriquement être inversé. Le rapport reste donc local ;
  l'option `-NoHash` supprime les empreintes.
- Rien n'est transmis : ni le scan, ni la page de lecture n'effectuent d'upload.
- Tout se supprime via `DESINSTALLER_PREUVANCE.cmd`.

## Utilisation

```powershell
# Scan rapide (instantané) — la déclaration d'usage est demandée en interactif
powershell -ExecutionPolicy Bypass -File scripts\preuvance-scan.ps1

# Surveillance réseau d'une heure, déclaration en paramètre
powershell -ExecutionPolicy Bypass -File scripts\preuvance-scan.ps1 -WatchMinutes 60 -DeclaredProviders openai,anthropic

# Autotests des fonctions pures (détection, catégories, déclaration)
powershell -ExecutionPolicy Bypass -File scripts\preuvance-scan.ps1 -SelfTest
```

Ou, sans ligne de commande : `SCANNER_PREUVANCE.cmd`.

Les fonctions pures du script (catalogue de fournisseurs, catégories de
fichiers, adresses privées, analyse de la déclaration) sont couvertes par des
autotests (`-SelfTest`) exécutés dans la chaîne de tests standard
(`tests/scan-script.test.ts`), qui vérifie aussi que le catalogue PowerShell
reste strictement aligné sur `lib/scan/scan-contract.ts`.

---

Conçu et vérifié les 14-16 juillet 2026 par **Fable (Claude Fable 5), Anthropic**.
Faisabilité technique et bonnes pratiques établies par recherche de sources
primaires (Microsoft Learn pktmon/DNS, documentation des plages IP
Anthropic/OpenAI/Azure, NIST CSF 2.0, ISO 27001, EDPB Guidelines 01/2025).
La concordance déclaré / observé s'inspire du devoir de déclaration du risque
de l'article L113-2 du Code des assurances.
