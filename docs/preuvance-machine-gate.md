# Extension locale « System Exposure » — gate et Step 0

Dernière vérification : 13 juillet 2026.

## État du gate

Le prompt d’extension suppose un moteur Python/Typer/Rich existant, une commande `aplomb scan`, un dépôt de démonstration et trois exécutions consécutives réussies. Aucun de ces éléments n’est présent dans le workspace actuel : le dépôt livré est l’application web TypeScript/Vinext de Preuvance, exécutée dans un Cloudflare Worker.

La phase « whole-machine audit » n’est donc **pas implémentée** dans ce dépôt. Un Worker distant ne peut pas interroger PowerShell, le registre, SMB, BitLocker ou les ports d’écoute du poste client. Simuler ces signaux dans le navigateur contredirait à la fois le gate, la promesse « zéro faux résultat » et le modèle de consentement du prompt.

| Décision | Note /100 | Conséquence |
|---|---:|---|
| Respecter le gate tant que le vrai dépôt Mode Code n’est pas disponible | 100 | Aucun détecteur machine n’est ajouté ou présenté comme fonctionnel. |
| Ne jamais simuler un signal Windows côté web | 100 | Le site reste une évaluation déclarative d’un système IA. |
| Exécuter la collecte future dans un CLI local, puis importer un JSON strict et expurgé | 94 | Les API OS restent locales ; seuls des constats structurés peuvent rejoindre le pipeline de classification et le rapport. |

## Step 0 — environnement observé

Seule la présence des commandes a été contrôlée avec `Get-Command`. Aucun listener, partage, compte, volume, logiciel, historique ou secret de la machine n’a été énuméré.

- Windows PowerShell Desktop `5.1.26100.8655`, processus 64 bits, build Windows `10.0.26100.8655` ;
- réseau : `Get-NetTCPConnection`, `Get-NetUDPEndpoint` ;
- pare-feu : `Get-NetFirewallProfile`, `Get-NetFirewallRule` et les filtres port, adresse, application, service et interface ;
- partage : `Get-SmbShare`, `Get-SmbShareAccess` ;
- comptes et disque : `Get-LocalUser`, `Get-BitLockerVolume`, `Get-Volume` ;
- inventaire : `Get-CimInstance`, `Get-ItemProperty`, `Get-AppxPackage`, `Get-Package`.

Sources Microsoft consultées :

- [Get-NetTCPConnection](https://learn.microsoft.com/en-us/powershell/module/nettcpip/get-nettcpconnection?view=windowsserver2025-ps) et [Get-NetUDPEndpoint](https://learn.microsoft.com/en-us/powershell/module/nettcpip/get-netudpendpoint?view=windowsserver2025-ps) ;
- [Get-NetFirewallProfile](https://learn.microsoft.com/en-us/powershell/module/netsecurity/get-netfirewallprofile?view=windowsserver2025-ps), [Get-NetFirewallRule](https://learn.microsoft.com/en-us/powershell/module/netsecurity/get-netfirewallrule?view=windowsserver2025-ps), [Get-NetFirewallPortFilter](https://learn.microsoft.com/en-us/powershell/module/netsecurity/get-netfirewallportfilter?view=windowsserver2025-ps) et [précédence des règles](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/rules) ;
- [Get-SmbShare](https://learn.microsoft.com/en-us/powershell/module/smbshare/get-smbshare?view=windowsserver2025-ps) et [Get-SmbShareAccess](https://learn.microsoft.com/en-us/powershell/module/smbshare/get-smbshareaccess?view=windowsserver2025-ps) ;
- [Get-LocalUser](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.localaccounts/get-localuser?view=powershell-5.1) et [Win32_UserAccount](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-useraccount) ;
- [Get-BitLockerVolume](https://learn.microsoft.com/en-us/powershell/module/bitlocker/get-bitlockervolume?view=windowsserver2025-ps) et [guide d’exploitation BitLocker](https://learn.microsoft.com/en-us/windows/security/operating-system-security/data-protection/bitlocker/operations-guide) ;
- [Get-AppxPackage](https://learn.microsoft.com/en-us/powershell/module/appx/get-appxpackage?view=windowsserver2025-ps) et [clé de désinstallation MSI](https://learn.microsoft.com/en-us/windows/win32/msi/uninstall-registry-key).

## Correctif de précision pour le détecteur réseau

Un listener lié à `0.0.0.0` ou à une adresse non-loopback n’est pas automatiquement accessible depuis Internet. Windows Defender Firewall peut bloquer les entrées par défaut sans règle `Block` explicite. Une future décision d’exposition doit donc croiser :

1. le profil réseau actif ;
2. `Enabled` et `DefaultInboundAction` du profil ;
3. les règles de l’`ActiveStore` ;
4. les filtres de protocole, port local, adresse, programme, service et interface ;
5. la précédence documentée entre blocages et autorisations.

Si l’ensemble ne suffit pas à prouver l’accessibilité, le constat doit rester factuel (`listener non-loopback détecté`) avec `confidence: "heuristic"`, jamais devenir `internet-exposed`. Un profil de pare-feu désactivé, lui, est un constat `verified`.

Premières fixtures à écrire dans le vrai dépôt CLI :

- **trigger** : listener TCP `0.0.0.0:5432`, profil Public actif, pare-feu activé, `DefaultInboundAction=Allow`, aucune règle de blocage correspondante ;
- **non-trigger** : même listener, avec règle `ActiveStore` active, entrante, `Block`, TCP, port local `5432`, profil Public, adresses quelconques ;
- **garde-fou obligatoire** : même listener, aucune règle explicite et `DefaultInboundAction=Block` — aucun finding d’exposition.

La troisième fixture dépasse le minimum demandé de deux, mais protège précisément contre le faux positif induit par une lecture trop littérale du prompt.

## Consentement et élévation futurs

Les lectures non privilégiées doivent être tentées d’abord. Un refus d’accès est une donnée d’exécution, pas une permission implicite d’élever le processus. Le CLI ne pourra proposer un sous-processus administrateur qu’après le consentement explicite prévu dans le prompt, uniquement pour les contrôles qui ont échoué faute de droits. Un refus utilisateur doit produire `skipped: no elevated consent`.

`Get-AppxPackage` pour l’utilisateur courant ne requiert pas d’élévation ; `-AllUsers` ou l’accès à un autre profil en requiert. `Get-LocalUser` n’est pas disponible dans un PowerShell 32 bits sur un OS 64 bits, contrainte satisfaite dans l’environnement contrôlé. L’inventaire MSI ne doit pas utiliser `Win32_Product`, dont l’énumération peut déclencher une vérification/réparation des packages.

## Invariants du futur contrat local

- la détection produit uniquement des faits déterministes ; GPT ne voit que leur forme structurée et expurgée, puis classe la sévérité, la remédiation et le fondement juridique ;
- `legal_basis` est fermé à `AI_ACT_ART4`, `AI_ACT_ART9`, `AI_ACT_ART15`, `GDPR_ART32` ou `GENERAL_HYGIENE` ;
- chaque constat transporte son identifiant de détecteur, la preuve OS vérifiable, `confidence: "verified" | "heuristic"` et, le cas échéant, une raison de saut explicite ;
- les ACL SMB doivent être comparées par SID (`S-1-1-0` et `S-1-5-11`), pas par libellés localisés, et seules les autorisations `Allow` avec `Change` ou `Full` constituent un droit d’écriture ;
- `PasswordRequired=false` signifie que le système n’exige pas de mot de passe, pas que le mot de passe est nécessairement vide ;
- BitLocker doit être joint à l’inventaire des volumes et limité aux volumes fixes ;
- Nearby Sharing détecté via la politique pare-feu reste `heuristic`, car cette politique ne prouve pas à elle seule l’activation utilisateur ;
- l’inventaire logiciel doit lire les vues de registre 32 et 64 bits ainsi que les packages Appx, sans `Win32_Product` ;
- les dossiers de synchronisation ne remontent que des comptes et distributions d’extensions ; aucun nom ni contenu de fichier ;
- les emplacements de secrets restent une liste fixe et documentée ; aucune valeur brute ne quitte le poste, seulement le chemin, le nom du motif et un aperçu expurgé.

## Chemin de reprise

1. fournir ou rapatrier le dépôt Python Mode Code réel ;
2. exécuter `aplomb scan` sur le dépôt de démonstration trois fois de suite avec succès et conserver les preuves de run ;
3. écrire les fixtures réseau ci-dessus avant le premier détecteur ;
4. implémenter la collecte locale, le consentement et la séparation des privilèges ;
5. définir un contrat JSON strict avec preuve brute expurgée, `confidence` et `legal_basis` ;
6. seulement ensuite, ajouter « System Exposure » au rapport Preuvance.
