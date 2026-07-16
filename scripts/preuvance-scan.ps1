[CmdletBinding()]
param(
  # 0 = instantané ; > 0 = surveillance réseau passive de N minutes (l'utilisateur
  # peut laisser tourner pendant qu'il travaille).
  [ValidateRange(0, 480)]
  [int]$WatchMinutes = 0,
  [ValidateRange(2, 300)]
  [int]$SampleSeconds = 15,
  [string[]]$Roots,
  [ValidateSet("auto", "personal", "professional")]
  [string]$MachineProfile = "auto",
  # Empreinte SHA-256 des fichiers pointés (jamais leur contenu). -NoHash pour l'omettre.
  [switch]$NoHash,
  [string]$OutFile,
  # Déclaration d'usage d'IA (concordance) : identifiants du catalogue
  # (ex: openai,anthropic) ou "aucun" pour déclarer zéro usage sciemment.
  [string[]]$DeclaredProviders,
  # Exécute les autotests des fonctions pures puis sort (aucun scan, aucune écriture).
  [switch]$SelfTest,
  # Ignore la demande de consentement (pour l'automatisation et les tests).
  [switch]$Yes
)

$ErrorActionPreference = "Stop"
$scanVersion = "preuvance-scan-v1"

function Write-Section([string]$Text) {
  Write-Host ""
  Write-Host $Text -ForegroundColor Cyan
}

function Get-UtcIso {
  return (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
}

# --- Catalogue des fournisseurs d'API d'IA (aligné sur lib/scan/scan-contract.ts) ---
$aiProviders = @(
  @{ Provider = "openai";       Label = "OpenAI";                 Pattern = '(^|\.)api\.openai\.com$' }
  @{ Provider = "anthropic";    Label = "Anthropic";              Pattern = '(^|\.)api\.anthropic\.com$' }
  @{ Provider = "azure-openai"; Label = "Azure OpenAI";           Pattern = '\.openai\.azure\.com$' }
  @{ Provider = "google";       Label = "Google (Gemini / Vertex)"; Pattern = '(^|\.)(generativelanguage|aiplatform)\.googleapis\.com$' }
  @{ Provider = "mistral";      Label = "Mistral";                Pattern = '(^|\.)api\.mistral\.ai$' }
  @{ Provider = "cohere";       Label = "Cohere";                 Pattern = '(^|\.)api\.cohere\.(ai|com)$' }
  @{ Provider = "aws-bedrock";  Label = "AWS Bedrock";            Pattern = '(^|\.)bedrock[a-z0-9.-]*\.amazonaws\.com$' }
  @{ Provider = "huggingface";  Label = "Hugging Face";           Pattern = '(^|\.)(api-inference|router)\.huggingface\.co$' }
  @{ Provider = "xai";          Label = "xAI";                    Pattern = '(^|\.)api\.x\.ai$' }
  @{ Provider = "deepseek";     Label = "DeepSeek";               Pattern = '(^|\.)api\.deepseek\.com$' }
  @{ Provider = "groq";         Label = "Groq";                   Pattern = '(^|\.)api\.groq\.com$' }
  @{ Provider = "together";     Label = "Together AI";            Pattern = '(^|\.)api\.together\.(ai|xyz)$' }
  @{ Provider = "openrouter";   Label = "OpenRouter";             Pattern = '(^|\.)openrouter\.ai$' }
  @{ Provider = "perplexity";   Label = "Perplexity";             Pattern = '(^|\.)api\.perplexity\.ai$' }
)

function Resolve-AiProvider([string]$HostName) {
  foreach ($provider in $aiProviders) {
    if ($HostName -match $provider.Pattern) { return $provider }
  }
  return $null
}

# --- Catégories de fichiers sensibles (nom/extension uniquement, sans lecture de contenu) ---
# Les gabarits versionnés (.example/.sample/.template/.dist), sans valeur secrète
# réelle, sont exclus pour éviter un faux positif systématique sur .env.example.
$fileTemplateSuffixPattern = '\.(example|sample|template|dist)$'
$fileRules = @(
  @{ Category = "secret";        Pattern = '((^|[\\/])\.env$|\.env\.|\.pem$|\.key$|\.pfx$|\.p12$|\.keystore$|\.jks$|\.ppk$|\.tfstate$|(^|[\\/])id_rsa$|(^|[\\/])id_ed25519$|secret.*\.(json|txt|ya?ml)$)' }
  @{ Category = "credential";    Pattern = '(credential.*\.(json|txt|ya?ml)$|\.kdbx$|\.ovpn$|(^|[\\/])\.npmrc$|(^|[\\/])\.pypirc$|(^|[\\/])\.netrc$|(^|[\\/])\.git-credentials$)' }
  @{ Category = "financial";     Pattern = '(facture|invoice|(^|[\\/])rib|releve|bilan|paie|salaire|comptab|\.qbo$|\.ofx$)' }
  @{ Category = "personal_data"; Pattern = '(\.vcf$|passeport|(carte.?identite)|(^|[\\/])cni(?![a-z])|patient|dossier.?rh|donnees.?personnelles|rgpd)' }
)

function Resolve-FileCategory([string]$FullPath) {
  $lower = $FullPath.ToLowerInvariant()
  if ($lower -match $fileTemplateSuffixPattern) { return $null }
  foreach ($rule in $fileRules) {
    if ($lower -match $rule.Pattern) { return $rule.Category }
  }
  return $null
}

function Test-PrivateAddress([string]$Address) {
  return (
    $Address -match '^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)' -or
    $Address -eq '::1' -or $Address -match '^(fe80|fc|fd)' -or $Address -eq '0.0.0.0' -or $Address -eq '::'
  )
}

# Transforme une saisie de déclaration (numéros du catalogue ou identifiants,
# séparés par virgules) en tableau d'identifiants. "aucun"/"none" = déclaration
# explicite de zéro usage. Retourne $null si la saisie est invalide.
function ConvertTo-DeclaredIds([string]$InputText) {
  $trimmed = ("" + $InputText).Trim().ToLowerInvariant()
  if (-not $trimmed) { return $null }
  if ($trimmed -in @("aucun", "none")) { return ,@() }
  $ids = New-Object System.Collections.Generic.List[string]
  foreach ($token in ($trimmed -split '[,;\s]+')) {
    if (-not $token) { continue }
    if ($token -match '^\d+$') {
      $index = [int]$token
      if ($index -lt 1 -or $index -gt $aiProviders.Count) { return $null }
      $candidate = $aiProviders[$index - 1].Provider
    } else {
      $candidate = $token
      if (-not ($aiProviders | Where-Object { $_.Provider -eq $candidate })) { return $null }
    }
    if (-not $ids.Contains($candidate)) { $ids.Add($candidate) }
  }
  return ,$ids.ToArray()
}

# --- Autotests des fonctions pures (-SelfTest : aucun scan, aucune écriture) ---
if ($SelfTest) {
  $script:selfTestFailures = New-Object System.Collections.Generic.List[string]
  $script:selfTestCount = 0
  function Assert-Case([bool]$Condition, [string]$Name) {
    $script:selfTestCount++
    if (-not $Condition) { [void]$script:selfTestFailures.Add($Name) }
  }

  Assert-Case ($null -ne (Resolve-AiProvider "api.openai.com") -and (Resolve-AiProvider "api.openai.com").Provider -eq "openai") "api.openai.com -> openai"
  Assert-Case ($null -ne (Resolve-AiProvider "api.anthropic.com") -and (Resolve-AiProvider "api.anthropic.com").Provider -eq "anthropic") "api.anthropic.com -> anthropic"
  Assert-Case ($null -ne (Resolve-AiProvider "moninstance.openai.azure.com") -and (Resolve-AiProvider "moninstance.openai.azure.com").Provider -eq "azure-openai") "*.openai.azure.com -> azure-openai"
  Assert-Case ($null -ne (Resolve-AiProvider "generativelanguage.googleapis.com") -and (Resolve-AiProvider "generativelanguage.googleapis.com").Provider -eq "google") "gemini -> google"
  Assert-Case ($null -ne (Resolve-AiProvider "openrouter.ai") -and (Resolve-AiProvider "openrouter.ai").Provider -eq "openrouter") "openrouter.ai -> openrouter"
  Assert-Case ($null -eq (Resolve-AiProvider "chat.openai.com")) "chat.openai.com ignore (pas une API)"
  Assert-Case ($null -eq (Resolve-AiProvider "api.openai.com.evil.example")) "suffixe usurpe ignore"
  Assert-Case ($null -eq (Resolve-AiProvider "storage.googleapis.com")) "googleapis non-IA ignore"

  Assert-Case ((Resolve-FileCategory "C:\p\.env") -eq "secret") ".env -> secret"
  Assert-Case ((Resolve-FileCategory "C:\p\.env.local") -eq "secret") ".env.local -> secret"
  Assert-Case ($null -eq (Resolve-FileCategory "C:\p\.env.example")) ".env.example exclu (gabarit)"
  Assert-Case ($null -eq (Resolve-FileCategory "C:\p\config.sample")) "*.sample exclu (gabarit)"
  Assert-Case ((Resolve-FileCategory "C:\p\id_rsa") -eq "secret") "id_rsa -> secret"
  Assert-Case ((Resolve-FileCategory "C:\p\coffre.kdbx") -eq "credential") "*.kdbx -> credential"
  Assert-Case ((Resolve-FileCategory "C:\p\.npmrc") -eq "credential") ".npmrc -> credential"
  Assert-Case ((Resolve-FileCategory "C:\p\facture-mars.pdf") -eq "financial") "facture -> financial"
  Assert-Case ((Resolve-FileCategory "C:\p\cni-recto.jpg") -eq "personal_data") "cni -> personal_data"
  Assert-Case ($null -eq (Resolve-FileCategory "C:\p\cnil-notification.pdf")) "cnil non confondu avec cni"
  Assert-Case ($null -eq (Resolve-FileCategory "C:\p\rapport-projet.docx")) "document ordinaire ignore"

  Assert-Case (Test-PrivateAddress "10.1.2.3") "10/8 privee"
  Assert-Case (Test-PrivateAddress "192.168.1.10") "192.168/16 privee"
  Assert-Case (Test-PrivateAddress "172.31.255.1") "172.31 privee"
  Assert-Case (-not (Test-PrivateAddress "172.32.0.1")) "172.32 publique"
  Assert-Case (-not (Test-PrivateAddress "8.8.8.8")) "8.8.8.8 publique"
  Assert-Case (Test-PrivateAddress "::1") "::1 boucle locale"
  Assert-Case (Test-PrivateAddress "fe80::1234") "fe80 lien-local"
  Assert-Case (-not (Test-PrivateAddress "2001:4860:4860::8888")) "ipv6 publique"

  $parsedNumbers = ConvertTo-DeclaredIds "1, 2"
  Assert-Case ($null -ne $parsedNumbers -and $parsedNumbers.Count -eq 2 -and $parsedNumbers[0] -eq "openai" -and $parsedNumbers[1] -eq "anthropic") "declaration par numeros"
  $parsedIds = ConvertTo-DeclaredIds "mistral,anthropic"
  Assert-Case ($null -ne $parsedIds -and $parsedIds.Count -eq 2 -and ($parsedIds -contains "mistral") -and ($parsedIds -contains "anthropic")) "declaration par identifiants"
  $parsedNone = ConvertTo-DeclaredIds "aucun"
  Assert-Case ($null -ne $parsedNone -and $parsedNone.Count -eq 0) "declaration 'aucun' = liste vide"
  Assert-Case ($null -eq (ConvertTo-DeclaredIds "42")) "numero hors catalogue rejete"
  Assert-Case ($null -eq (ConvertTo-DeclaredIds "skynet")) "identifiant inconnu rejete"
  Assert-Case ($null -eq (ConvertTo-DeclaredIds "")) "saisie vide rejetee"
  $parsedDedup = ConvertTo-DeclaredIds "openai,1"
  Assert-Case ($null -ne $parsedDedup -and $parsedDedup.Count -eq 1) "doublon numero/identifiant dedoublonne"

  if ($script:selfTestFailures.Count -eq 0) {
    Write-Output "AUTOTEST OK ($script:selfTestCount assertions)"
    exit 0
  }
  Write-Output ("AUTOTEST ECHEC ($($script:selfTestFailures.Count)/$script:selfTestCount) : " + ($script:selfTestFailures -join " | "))
  exit 1
}

# --- Consentement explicite ---
$isElevated = ([Security.Principal.WindowsPrincipal] `
  [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)

Write-Host "PREUVANCE — Scan local de conformité IA" -ForegroundColor White
Write-Host "Ce scan reste 100% local. Il ne copie aucun contenu de fichier, n'envoie rien"
Write-Host "sur Internet et ne demande aucun droit administrateur. Il produit un rapport"
Write-Host "JSON que vous pouvez charger dans Preuvance ou supprimer à tout moment."
Write-Host ""
Write-Host "Il observe : (1) un inventaire des fichiers sensibles (chemin, taille, dates,"
Write-Host "empreinte), (2) les appels réseau de vos logiciels vers des API d'IA connues."
if (-not $Yes) {
  $answer = Read-Host 'Confirmez-vous ce scan sur votre propre poste [oui/non]'
  if ($answer -notmatch '^(o|oui|y|yes)$') {
    Write-Host 'Scan annule.' -ForegroundColor Yellow
    exit 2
  }
}

$notes = New-Object System.Collections.Generic.List[string]

# --- Déclaration d'usage d'IA (concordance déclaré / observé) ---
# La déclaration recueillie AVANT le scan est ensuite comparée à ce qui est
# réellement observé sur le réseau : la concordance corrobore la déclaration,
# un écart signale un usage non déclaré (« shadow AI »).
$declaredIds = $null
$declarationMethod = $null
$declarationCollectedAt = $null

if ($DeclaredProviders) {
  $declaredIds = ConvertTo-DeclaredIds ($DeclaredProviders -join ",")
  if ($null -eq $declaredIds) {
    $validIds = ($aiProviders | ForEach-Object { $_.Provider }) -join ", "
    Write-Host "Valeur -DeclaredProviders invalide. Identifiants valides : $validIds (ou 'aucun')." -ForegroundColor Red
    exit 1
  }
  $declarationMethod = "parameter"
  $declarationCollectedAt = Get-UtcIso
} elseif (-not $Yes) {
  Write-Section "Déclaration d'usage d'IA (concordance déclaré / observé)"
  Write-Host "Déclarez les fournisseurs d'IA que votre organisation utilise sciemment."
  Write-Host "Le scan comparera cette déclaration à ce qu'il observe réellement :"
  Write-Host "une déclaration corroborée renforce votre dossier ; un écart signale un usage non déclaré."
  for ($i = 0; $i -lt $aiProviders.Count; $i++) {
    Write-Host ("  {0,2}. {1}" -f ($i + 1), $aiProviders[$i].Label)
  }
  $declarationAttempts = 0
  while ($null -eq $declaredIds -and $declarationAttempts -lt 3) {
    $declarationAttempts++
    $declarationAnswer = Read-Host "Fournisseurs utilisés sciemment (ex: 1,3 ou openai,anthropic), ou 'aucun'"
    $declaredIds = ConvertTo-DeclaredIds $declarationAnswer
    if ($null -eq $declaredIds) {
      Write-Host "  Saisie non reconnue : numéros du catalogue, identifiants, ou 'aucun'." -ForegroundColor Yellow
    }
  }
  if ($null -ne $declaredIds) {
    $declarationMethod = "interactive"
    $declarationCollectedAt = Get-UtcIso
  } else {
    $notes.Add("Aucune déclaration d'usage d'IA recueillie (saisie non reconnue) : la concordance déclaré / observé ne sera pas calculée pour ce rapport.")
  }
} else {
  $notes.Add("Scan lancé sans déclaration d'usage d'IA (-Yes sans -DeclaredProviders) : la concordance déclaré / observé ne sera pas calculée pour ce rapport.")
}

# --- Profil poste : personnel vs professionnel ---
$domainJoined = $false
try { $domainJoined = [bool] (Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction Stop).PartOfDomain } catch { $domainJoined = $false }
$entraJoined = $false
try {
  $dsreg = (& dsregcmd.exe /status) 2>$null
  if ($dsreg -match 'AzureAdJoined\s*:\s*YES') { $entraJoined = $true }
} catch { $entraJoined = $false }

$resolvedProfile = $MachineProfile
if ($MachineProfile -eq "auto") {
  $resolvedProfile = if ($domainJoined -or $entraJoined) { "professional" } else { "personal" }
}
if ($resolvedProfile -eq "professional") {
  $notes.Add("Poste professionnel détecté (domaine ou Entra ID). Pour un poste géré, privilégiez le canal IT/DPO officiel (ex. Microsoft Purview) ; ce scan reste une préqualification locale.")
}

$osCaption = ""
try { $osCaption = (Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop).Caption } catch { $osCaption = "" }

# --- Inventaire de fichiers (sans copie de contenu) ---
if (-not $Roots -or $Roots.Count -eq 0) {
  $Roots = @(
    [Environment]::GetFolderPath("Desktop"),
    [Environment]::GetFolderPath("MyDocuments"),
    (Join-Path $env:USERPROFILE "Downloads")
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
}

Write-Section "[1/2] Inventaire des fichiers sensibles (aucun contenu copié)"
$maxFiles = 2000
$sensitive = New-Object System.Collections.Generic.List[object]
$inaccessible = 0
$truncated = $false
$rootsScanned = New-Object System.Collections.Generic.List[string]

foreach ($root in $Roots) {
  if (-not (Test-Path -LiteralPath $root)) { continue }
  $rootsScanned.Add($root)
  try {
    $files = Get-ChildItem -LiteralPath $root -Recurse -File -Force -ErrorAction SilentlyContinue -ErrorVariable scanErrors
    $inaccessible += @($scanErrors).Count
  } catch {
    $inaccessible++
    continue
  }
  foreach ($file in $files) {
    if ($sensitive.Count -ge $maxFiles) { $truncated = $true; break }
    $category = Resolve-FileCategory $file.FullName
    if (-not $category) { continue }
    $hash = $null
    if (-not $NoHash -and $file.Length -le 52428800) {
      try { $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256 -ErrorAction Stop).Hash } catch { $hash = $null }
    }
    $entry = [ordered]@{
      path       = $file.FullName
      category   = $category
      sizeBytes  = [int64]$file.Length
      modifiedAt = $file.LastWriteTimeUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    }
    if ($hash) { $entry.sha256 = $hash.ToLowerInvariant() }
    $sensitive.Add([pscustomobject]$entry)
  }
  if ($truncated) { break }
}
if ($inaccessible -gt 0) {
  $notes.Add("$inaccessible dossier(s) non lisible(s) sans élévation ont été ignorés et ne figurent pas dans l'inventaire.")
}
if (-not $NoHash) {
  $notes.Add("Les empreintes SHA-256 pointent les fichiers sans les copier. Un hash de très petit fichier reste théoriquement réversible : conservez ce rapport localement.")
}
Write-Host ("  $($sensitive.Count) fichier(s) sensible(s) pointé(s) dans $($rootsScanned.Count) dossier(s).")

# --- Observation réseau : détection des appels d'IA ---
$mode = if ($WatchMinutes -gt 0) { "watch" } else { "snapshot" }
Write-Section "[2/2] Observation réseau ($mode)"
if ($mode -eq "watch") {
  Write-Host ("  Surveillance passive pendant $WatchMinutes min (échantillon toutes les $SampleSeconds s).") -ForegroundColor DarkGray
  Write-Host "  Vous pouvez continuer à travailler ; laissez cette fenêtre ouverte." -ForegroundColor DarkGray
}

$endpoints = @{}
$aiIpToHost = @{}
$otherIps = New-Object System.Collections.Generic.HashSet[string]
$dnsAvailable = $false
$connAvailable = $false
$samples = 0

$deadline = (Get-Date).AddMinutes([Math]::Max($WatchMinutes, 0))
do {
  $samples++

  try {
    $cache = Get-DnsClientCache -ErrorAction Stop
    $dnsAvailable = $true
    foreach ($record in $cache) {
      $entryName = ("" + $record.Entry).TrimEnd('.').ToLowerInvariant()
      if (-not $entryName) { continue }
      $provider = Resolve-AiProvider $entryName
      if (-not $provider) { continue }
      $data = ("" + $record.Data).Trim()
      if (-not $endpoints.ContainsKey($entryName)) {
        $endpoints[$entryName] = [ordered]@{
          host = $entryName; provider = $provider.Label; providerId = $provider.Provider
          firstSeen = (Get-UtcIso); lastSeen = (Get-UtcIso); hitCount = 0
          processes = (New-Object System.Collections.Generic.HashSet[string])
          remoteAddresses = (New-Object System.Collections.Generic.HashSet[string])
        }
      }
      $endpoints[$entryName].lastSeen = (Get-UtcIso)
      $endpoints[$entryName].hitCount++
      if ($data -match '^\d{1,3}(\.\d{1,3}){3}$' -or $data -match ':') {
        [void]$endpoints[$entryName].remoteAddresses.Add($data)
        $aiIpToHost[$data] = $entryName
      }
    }
  } catch { }

  try {
    $conns = Get-NetTCPConnection -State Established -ErrorAction Stop
    $connAvailable = $true
    foreach ($conn in $conns) {
      $remote = "" + $conn.RemoteAddress
      if (-not $remote -or (Test-PrivateAddress $remote)) { continue }
      if ($aiIpToHost.ContainsKey($remote)) {
        $aiHost = $aiIpToHost[$remote]
        try {
          $proc = Get-Process -Id $conn.OwningProcess -ErrorAction Stop
          if ($proc -and $proc.ProcessName) { [void]$endpoints[$aiHost].processes.Add($proc.ProcessName) }
        } catch { }
      } else {
        [void]$otherIps.Add($remote)
      }
    }
  } catch { }

  if ($mode -eq "watch" -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds $SampleSeconds
  }
} while ($mode -eq "watch" -and (Get-Date) -lt $deadline)

$aiEndpoints = New-Object System.Collections.Generic.List[object]
foreach ($key in $endpoints.Keys) {
  $endpoint = $endpoints[$key]
  $aiEndpoints.Add([pscustomobject][ordered]@{
    host            = $endpoint.host
    provider        = $endpoint.provider
    firstSeen       = $endpoint.firstSeen
    lastSeen        = $endpoint.lastSeen
    hitCount        = [int]$endpoint.hitCount
    processes       = @($endpoint.processes)
    remoteAddresses = @($endpoint.remoteAddresses)
    declared        = [bool]($null -ne $declaredIds -and $declaredIds -contains $endpoint.providerId)
  })
}
Write-Host ("  $($aiEndpoints.Count) endpoint(s) d'IA détecté(s) ; $($otherIps.Count) autre(s) destination(s) externe(s).")

if (-not $dnsAvailable -and -not $connAvailable) {
  $notes.Add("Aucune source d'observation réseau n'était disponible : l'absence de détection ne prouve pas l'absence d'appel d'IA.")
}
$notes.Add("Détection réseau fondée sur le nom d'hôte (cache DNS), fiable pour identifier le fournisseur mais pas exhaustive : le cache expire (TTL court) et l'attribution au processus reste au mieux indicative. Pour une couverture réseau sérieuse, lancez le mode surveillance (-WatchMinutes 60) et laissez tourner pendant que vous travaillez.")
if ($mode -eq "snapshot") {
  $notes.Add("Mode instantané : une seule lecture du cache réseau. De nombreux appels courts ont pu échapper à l'observation.")
}

$durationSeconds = if ($mode -eq "watch") { [int]($WatchMinutes * 60) } else { 0 }

$report = [ordered]@{
  schemaVersion = $scanVersion
  generatedAt   = (Get-UtcIso)
  host = [ordered]@{
    profile      = $resolvedProfile
    domainJoined = [bool]($domainJoined -or $entraJoined)
    osCaption    = $osCaption
    elevated     = [bool]$isElevated
  }
  capabilities = [ordered]@{
    dnsClientLog       = [bool]$dnsAvailable
    connectionSampling = [bool]$connAvailable
    fileInventory      = $true
  }
  network = [ordered]@{
    mode                   = $mode
    durationSeconds        = $durationSeconds
    samples                = [int]$samples
    aiEndpoints            = $aiEndpoints.ToArray()
    otherExternalEndpoints = [int]$otherIps.Count
  }
  files = [ordered]@{
    rootsScanned = $rootsScanned.ToArray()
    sensitive    = $sensitive.ToArray()
    truncated    = [bool]$truncated
  }
  notes = $notes.ToArray()
}

if ($null -ne $declarationMethod) {
  $report.declaration = [ordered]@{
    providers   = [string[]]$declaredIds
    method      = $declarationMethod
    collectedAt = $declarationCollectedAt
  }
}

if (-not $OutFile) {
  $outDir = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "Preuvance"
  if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
  $OutFile = Join-Path $outDir "preuvance-scan.json"
}

try {
  $json = $report | ConvertTo-Json -Depth 8
  [System.IO.File]::WriteAllText($OutFile, $json, [System.Text.UTF8Encoding]::new($false))
} catch {
  Write-Host "Impossible d'écrire le rapport dans « $OutFile » : $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Vérifiez que le fichier n'est pas ouvert dans un autre programme et que le dossier est accessible en écriture, puis relancez le scan."
  exit 1
}

Write-Section "Scan terminé"
Write-Host "  Rapport écrit : $OutFile" -ForegroundColor Green
Write-Host "  Chargez-le dans Preuvance (page « Scanner en local ») pour voir votre score d'exposition."
Write-Host "  Pour tout supprimer : lancez DESINSTALLER_PREUVANCE.cmd."
