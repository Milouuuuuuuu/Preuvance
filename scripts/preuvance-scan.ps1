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
  @{ Provider = "google";       Label = "Google (Gemini/Vertex)"; Pattern = '(^|\.)(generativelanguage|aiplatform)\.googleapis\.com$' }
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
  @{ Category = "secret";        Pattern = '(^\.env$|\.env\.|\.pem$|\.key$|\.pfx$|\.p12$|\.keystore$|\.jks$|\.ppk$|\.tfstate$|(^|[\\/])id_rsa$|(^|[\\/])id_ed25519$|secret.*\.(json|txt|ya?ml)$)' }
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
    declared        = $false
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

if (-not $OutFile) {
  $outDir = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "Preuvance"
  if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
  $OutFile = Join-Path $outDir "preuvance-scan.json"
}

$json = $report | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($OutFile, $json, [System.Text.UTF8Encoding]::new($false))

Write-Section "Scan terminé"
Write-Host "  Rapport écrit : $OutFile" -ForegroundColor Green
Write-Host "  Chargez-le dans Preuvance (page « Scanner en local ») pour voir votre score d'exposition."
Write-Host "  Pour tout supprimer : lancez DESINSTALLER_PREUVANCE.cmd."
