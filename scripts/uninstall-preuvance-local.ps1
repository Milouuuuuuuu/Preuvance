[CmdletBinding()]
param(
  # Supprime aussi le dossier de l'application lui-même (pas seulement les caches et secrets).
  [switch]$RemoveAll,
  # Ignore la confirmation (automatisation / tests).
  [switch]$Yes
)

$ErrorActionPreference = "Stop"
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$documentsScan = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "Preuvance"

Write-Host "PREUVANCE — Désinstallation propre" -ForegroundColor White
Write-Host "Cette action supprime la clé API locale, les caches, les dépendances, les"
Write-Host "sorties et les rapports de scan. Aucun droit administrateur n'est requis."
if ($RemoveAll) {
  Write-Host "Le dossier complet de l'application sera également supprimé." -ForegroundColor Yellow
}

if (-not $Yes) {
  $answer = Read-Host 'Confirmez-vous la suppression [oui/non]'
  if ($answer -notmatch '^(o|oui|y|yes)$') {
    Write-Host 'Désinstallation annulée.' -ForegroundColor Yellow
    exit 2
  }
}

$removed = New-Object System.Collections.Generic.List[string]
$missing = 0

function Remove-Target([string]$Path, [string]$Label) {
  if ([string]::IsNullOrWhiteSpace($Path)) { return }
  if (Test-Path -LiteralPath $Path) {
    try {
      Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
      $script:removed.Add($Label)
    } catch {
      Write-Host "  Impossible de supprimer $Label : $($_.Exception.Message)" -ForegroundColor Red
    }
  } else {
    $script:missing++
  }
}

# Secrets et configuration locale d'abord.
Remove-Target (Join-Path $projectRoot ".env.local") ".env.local (clé API)"
Remove-Target (Join-Path $projectRoot ".env.development.local") ".env.development.local"
Remove-Target (Join-Path $projectRoot ".env.production.local") ".env.production.local"

# Caches, builds et dépendances.
foreach ($relative in @("node_modules", ".vinext", ".wrangler", "dist", "outputs", ".next", "tsconfig.tsbuildinfo")) {
  Remove-Target (Join-Path $projectRoot $relative) $relative
}

# Rapports de scan enregistrés dans les Documents.
Remove-Target $documentsScan "Documents\Preuvance (rapports de scan)"

Write-Host ""
if ($removed.Count -gt 0) {
  Write-Host "Éléments supprimés :" -ForegroundColor Green
  foreach ($item in $removed) { Write-Host "  - $item" }
} else {
  Write-Host "Rien à supprimer : l'environnement était déjà propre." -ForegroundColor DarkGray
}

if ($RemoveAll) {
  Write-Host ""
  Write-Host "Suppression du dossier de l'application : $projectRoot" -ForegroundColor Yellow
  # Le dossier courant ne peut pas se supprimer lui-même ; on relance depuis le parent.
  $parent = Split-Path -Parent $projectRoot
  Set-Location -LiteralPath $parent
  try {
    Remove-Item -LiteralPath $projectRoot -Recurse -Force -ErrorAction Stop
    Write-Host "Dossier de l'application supprimé." -ForegroundColor Green
  } catch {
    Write-Host "Le dossier n'a pas pu être entièrement supprimé (fichier en cours d'utilisation ?)." -ForegroundColor Red
    Write-Host "Fermez les fenêtres liées à Preuvance puis relancez, ou supprimez le dossier à la main." -ForegroundColor Red
    exit 1
  }
}

Write-Host ""
Write-Host "Désinstallation terminée." -ForegroundColor Green
