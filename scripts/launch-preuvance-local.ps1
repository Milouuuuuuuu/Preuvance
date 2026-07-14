[CmdletBinding()]
param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
$minimumNodeVersion = [version]"22.13.0"
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$localUrl = "http://127.0.0.1:$Port"

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Executable,
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [Parameter(Mandatory = $true)]
    [string]$FailureMessage
  )

  & $Executable @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FailureMessage (code $LASTEXITCODE)."
  }
}

function Test-ConfiguredOpenAiKey {
  if (-not [string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)) {
    return $true
  }

  $environmentFile = Join-Path $projectRoot ".env.local"
  if (-not (Test-Path -LiteralPath $environmentFile -PathType Leaf)) {
    return $false
  }

  foreach ($line in [System.IO.File]::ReadAllLines($environmentFile)) {
    if ($line -match '^\s*OPENAI_API_KEY\s*=\s*(.+?)\s*$') {
      $candidate = $Matches[1].Trim().Trim('"').Trim("'")
      return -not [string]::IsNullOrWhiteSpace($candidate)
    }
  }

  return $false
}

function Save-LocalConfiguration {
  Write-Host ""
  Write-Host "Une cle API OpenAI est requise pour les analyses reelles." -ForegroundColor Yellow
  Write-Host "Elle sera stockee uniquement dans .env.local, ignore par Git." -ForegroundColor DarkGray
  $secureKey = Read-Host "Collez votre cle API OpenAI" -AsSecureString
  $keyPointer = [IntPtr]::Zero

  try {
    $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
    if ([string]::IsNullOrWhiteSpace($plainKey) -or $plainKey -match '[\r\n]') {
      throw "La cle API fournie est vide ou invalide."
    }

    $configuration = @(
      "OPENAI_API_KEY=$plainKey"
      "OPENAI_REASONING_MODEL=gpt-5.6-sol"
      "OPENAI_ANCILLARY_MODEL=gpt-5.6-luna"
      "OPENAI_REASONING_EFFORT=high"
      "OPENAI_REQUEST_TIMEOUT_MS=90000"
      "NEXT_PUBLIC_APP_URL=$localUrl"
      "ENABLE_RESEND=false"
    ) -join [Environment]::NewLine

    [System.IO.File]::WriteAllText(
      (Join-Path $projectRoot ".env.local"),
      $configuration + [Environment]::NewLine,
      [System.Text.UTF8Encoding]::new($false)
    )
  }
  finally {
    if ($keyPointer -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
    }
    $plainKey = $null
  }
}

try {
  Set-Location -LiteralPath $projectRoot

  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "package.json") -PathType Leaf)) {
    throw "Le dossier Preuvance est incomplet : package.json est absent."
  }

  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $node -or -not $npm) {
    throw "Node.js $minimumNodeVersion ou plus recent est requis. Installez-le depuis https://nodejs.org puis relancez."
  }

  $nodeVersionText = (& $node.Source -p "process.versions.node").Trim()
  $nodeVersion = [version]$nodeVersionText
  if ($nodeVersion -lt $minimumNodeVersion) {
    throw "Node.js $nodeVersion est trop ancien. Version minimale : $minimumNodeVersion."
  }

  if (-not (Test-ConfiguredOpenAiKey)) {
    Save-LocalConfiguration
  }

  Write-Host ""
  Write-Host "[1/3] Installation reproductible des dependances..." -ForegroundColor Cyan
  Invoke-CheckedCommand $npm.Source @("ci", "--no-audit", "--no-fund") "npm ci a echoue"

  Write-Host ""
  Write-Host "[2/3] Construction et verification du projet..." -ForegroundColor Cyan
  Invoke-CheckedCommand $npm.Source @("run", "build") "La construction a echoue"

  Write-Host ""
  Write-Host "[3/3] Demarrage local sur $localUrl" -ForegroundColor Cyan
  Write-Host "Aucun droit administrateur ni audit de la machine n'est demande." -ForegroundColor DarkGray
  Write-Host "Fermez avec Ctrl+C." -ForegroundColor DarkGray

  $browserJob = Start-Job -ArgumentList $localUrl -ScriptBlock {
    param($Url)
    for ($attempt = 0; $attempt -lt 90; $attempt++) {
      try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
          Start-Process $Url
          return
        }
      }
      catch {
        # Le serveur est encore en cours de demarrage.
      }
      Start-Sleep -Milliseconds 500
    }
  }

  try {
    Invoke-CheckedCommand $npm.Source @(
      "run", "dev", "--", "--port", [string]$Port, "--hostname", "127.0.0.1"
    ) "Le serveur local s'est arrete"
  }
  finally {
    if ($browserJob) {
      Stop-Job -Job $browserJob -ErrorAction SilentlyContinue
      Remove-Job -Job $browserJob -Force -ErrorAction SilentlyContinue
    }
  }
}
catch {
  Write-Host ""
  Write-Host "[Preuvance] $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
