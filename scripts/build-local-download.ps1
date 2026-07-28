[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$stagingRoot = [System.IO.Path]::GetFullPath(
  (Join-Path $projectRoot "outputs\local-download-staging")
)
$stagingProject = Join-Path $stagingRoot "preuvance-local"
$stagingScanner = Join-Path $stagingRoot "preuvance-scan"
$downloadDirectory = [System.IO.Path]::GetFullPath(
  (Join-Path $projectRoot "public\downloads")
)
$archivePath = Join-Path $downloadDirectory "preuvance-local.zip"
$scannerArchivePath = Join-Path $downloadDirectory "preuvance-scan.zip"

function Assert-WorkspaceChildPath {
  param([Parameter(Mandatory = $true)][string]$Path)

  $workspacePrefix = $projectRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
  $candidate = [System.IO.Path]::GetFullPath($Path)
  if (-not $candidate.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Chemin refuse hors du workspace : $candidate"
  }
  return $candidate
}

function Copy-AllowlistedDirectory {
  param([Parameter(Mandatory = $true)][string]$RelativePath)

  $source = Join-Path $projectRoot $RelativePath
  if (-not (Test-Path -LiteralPath $source -PathType Container)) {
    throw "Dossier requis absent : $RelativePath"
  }
  $destination = Join-Path $stagingProject $RelativePath
  $parent = Split-Path -Parent $destination
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
}

function Copy-AllowlistedFile {
  param(
    [Parameter(Mandatory = $true)][string]$RelativePath,
    [string]$TargetRoot = $stagingProject
  )

  $source = Join-Path $projectRoot $RelativePath
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "Fichier requis absent : $RelativePath"
  }
  $destination = Join-Path $TargetRoot $RelativePath
  $parent = Split-Path -Parent $destination
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination -Force
}

$verifiedStagingRoot = Assert-WorkspaceChildPath $stagingRoot
$verifiedArchivePath = Assert-WorkspaceChildPath $archivePath
$verifiedScannerArchivePath = Assert-WorkspaceChildPath $scannerArchivePath

if (Test-Path -LiteralPath $verifiedStagingRoot) {
  Remove-Item -LiteralPath $verifiedStagingRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $stagingProject | Out-Null
New-Item -ItemType Directory -Force -Path $downloadDirectory | Out-Null

$directories = @(
  "app",
  "build",
  "docs",
  "lib",
  "scripts",
  "supabase",
  "tests",
  "types",
  "worker"
)

$files = @(
  ".gitignore",
  ".openai\hosting.json",
  "AGENTS.md",
  "LANCER_PREUVANCE.cmd",
  "SCANNER_PREUVANCE.cmd",
  "DESINSTALLER_PREUVANCE.cmd",
  "README.md",
  "eslint.config.mjs",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "postcss.config.mjs",
  "tsconfig.json",
  "vite.config.ts",
  "worker-configuration.d.ts",
  "wrangler.jsonc",
  "public\og.png",
  "public\og-v2.png"
)

foreach ($directory in $directories) {
  Copy-AllowlistedDirectory $directory
}
foreach ($file in $files) {
  Copy-AllowlistedFile $file
}

# Sites may leave a local preview directory under app/. It is build output,
# never source for the downloadable release.
$previewOutput = Assert-WorkspaceChildPath (Join-Path $stagingProject "app\_sites-preview")
if (Test-Path -LiteralPath $previewOutput) {
  Remove-Item -LiteralPath $previewOutput -Recurse -Force
}

$readme = @"
PREUVANCE LOCAL : LANCEMENT WINDOWS

1. Extrayez completement cette archive.
2. Double-cliquez sur LANCER_PREUVANCE.cmd pour lancer l'application web locale.
   Au premier lancement, saisissez votre cle API OpenAI lorsque Windows la demande.
   Le script installe, construit, lance Preuvance sur 127.0.0.1 et ouvre le navigateur.

Scanner votre poste (source complementaire, sans cle API) :
   Double-cliquez sur SCANNER_PREUVANCE.cmd, puis chargez le rapport preuvance-scan.json
   dans la page "Scanner en local". Le scan reste 100% local et ne copie aucun contenu.

Portabilite SQLite / PostgreSQL (outil open source separe) :
   https://github.com/Milouuuuuuuu/sqlite-postgres-bridge/releases/latest
   Utilisez d'abord le mode --dry-run et importez toujours dans une base de test.

Tout desinstaller : double-cliquez sur DESINSTALLER_PREUVANCE.cmd.

Prerequis : Windows PowerShell 5.1+ et Node.js 22.13+ (l'application ; le scan n'exige que PowerShell).
Aucun droit administrateur n'est requis. Les secrets restent dans .env.local, exclu de cette archive.
"@
[System.IO.File]::WriteAllText(
  (Join-Path $stagingProject "LISEZ-MOI.txt"),
  $readme,
  [System.Text.UTF8Encoding]::new($false)
)

$forbidden = Get-ChildItem -LiteralPath $stagingProject -Recurse -Force -File |
  Where-Object {
    $_.Name -match '^\.env(?:\.|$)' -or
    $_.Extension -in @('.pem', '.pfx', '.p12') -or
    $_.Name -match '(?i)(secret|credentials)\.(json|txt|ini|yaml|yml)$'
  }
if ($forbidden) {
  $names = ($forbidden.FullName -join ", ")
  throw "Archive annulee : fichier potentiellement sensible detecte : $names"
}

$forbiddenDirectories = Get-ChildItem -LiteralPath $stagingProject -Recurse -Force -Directory |
  Where-Object {
    $_.Name -in @("node_modules", "dist", ".git", ".next", ".vinext", ".wrangler", "outputs")
  }
if ($forbiddenDirectories) {
  $names = ($forbiddenDirectories.FullName -join ", ")
  throw "Archive annulee : cache ou build detecte : $names"
}

if (Test-Path -LiteralPath $verifiedArchivePath) {
  Remove-Item -LiteralPath $verifiedArchivePath -Force
}
Compress-Archive -Path (Join-Path $stagingProject "*") -DestinationPath $verifiedArchivePath -CompressionLevel Optimal

$archive = Get-Item -LiteralPath $verifiedArchivePath
if ($archive.Length -le 0) {
  throw "L'archive generee est vide."
}

# --- Archive « scan seul » -------------------------------------------------
# Le scan n'exige que Windows PowerShell : ni Node.js, ni npm ci, ni cle API.
# L'empaqueter separement evite de faire telecharger 3 Mo d'application web a
# quelqu'un qui veut seulement regarder ce qui tourne sur son poste. Le script
# de scan est autonome : il ne lit aucun fichier du depot a l'execution, son
# catalogue de fournisseurs est en dur (l'alignement avec
# lib/scan/scan-contract.ts est verifie par les tests, pas au lancement).
New-Item -ItemType Directory -Force -Path $stagingScanner | Out-Null
Copy-AllowlistedFile "SCANNER_PREUVANCE.cmd" -TargetRoot $stagingScanner
Copy-AllowlistedFile "scripts\preuvance-scan.ps1" -TargetRoot $stagingScanner

$scannerReadme = @"
PREUVANCE - SCAN LOCAL

Ce dossier ne contient que le scan. Rien n'est envoye sur Internet, aucun compte
n'est demande, aucune cle API n'est necessaire, et aucun droit administrateur
n'est requis. Seul Windows PowerShell 5.1 ou plus recent est necessaire.

1. Extrayez completement cette archive.
2. Double-cliquez sur SCANNER_PREUVANCE.cmd.
3. Declarez les outils d'IA que vous utilisez sciemment, puis choisissez le scan
   rapide ou la surveillance reseau d'une heure.
4. Le rapport est ecrit dans %LOCALAPPDATA%\Preuvance\preuvance-scan.json.
5. Rechargez ce fichier sur la page "Scanner en local" (/scan) du site depuis
   lequel vous avez telecharge cette archive, pour lire le verdict de
   concordance et le score d'exposition. La lecture se fait dans votre
   navigateur : le rapport n'est pas televerse.

Ce que le scan fait : il inventorie les fichiers sensibles par nom et extension
avec leur empreinte SHA-256, sans lire ni copier leur contenu ; il repere les
appels reseau vers des API d'IA connues par nom d'hote ; il compare ce qu'il
observe a ce que vous avez declare.

Ce que le scan n'est pas : ni un audit certifie, ni un avis juridique, ni une
decision d'assurabilite. Le script est lisible en clair dans scripts\.

Windows peut afficher "Windows a protege votre ordinateur" (SmartScreen) au
premier lancement d'un script telecharge : cliquez sur "Informations
complementaires" puis "Executer quand meme".

Application complete (dossier de conformite, PDF, registre de preuves) : voir
l'archive "Preuvance Local" proposee sur la meme page de telechargement.
"@
[System.IO.File]::WriteAllText(
  (Join-Path $stagingScanner "LISEZ-MOI.txt"),
  $scannerReadme,
  [System.Text.UTF8Encoding]::new($false)
)

if (Test-Path -LiteralPath $verifiedScannerArchivePath) {
  Remove-Item -LiteralPath $verifiedScannerArchivePath -Force
}
Compress-Archive -Path (Join-Path $stagingScanner "*") -DestinationPath $verifiedScannerArchivePath -CompressionLevel Optimal

$scannerArchive = Get-Item -LiteralPath $verifiedScannerArchivePath
if ($scannerArchive.Length -le 0) {
  throw "L'archive de scan generee est vide."
}

Remove-Item -LiteralPath $verifiedStagingRoot -Recurse -Force
Write-Output $archive.FullName
Write-Output $scannerArchive.FullName
