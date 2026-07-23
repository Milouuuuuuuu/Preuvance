param(
  [string]$Voice = "Microsoft Zira Desktop",
  [int]$Rate = 1,
  [string]$OutputFolder = "audio-fast"
)

$ErrorActionPreference = "Stop"
$remotionRoot = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $remotionRoot "src\demo\narration.json"
$audioDirectory = Join-Path $remotionRoot ("public\{0}" -f $OutputFolder)

New-Item -ItemType Directory -Force -Path $audioDirectory | Out-Null

Add-Type -AssemblyName System.Speech
$segments = Get-Content -Raw -Encoding UTF8 $scriptPath | ConvertFrom-Json
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SelectVoice($Voice)
$speaker.Rate = $Rate
$speaker.Volume = 100

foreach ($segment in $segments) {
  $outputPath = Join-Path $audioDirectory ("{0}.wav" -f $segment.id)
  if (Test-Path -LiteralPath $outputPath) {
    Remove-Item -LiteralPath $outputPath -Force
  }
  $speaker.SetOutputToWaveFile($outputPath)
  $speaker.Speak([string]$segment.text)
  $speaker.SetOutputToNull()
}

$speaker.Dispose()
Write-Output ("Generated {0} narration segments in {1}" -f $segments.Count, $audioDirectory)
