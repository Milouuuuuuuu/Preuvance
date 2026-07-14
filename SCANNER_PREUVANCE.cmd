@echo off
setlocal
cd /d "%~dp0"

where powershell.exe >nul 2>&1
if errorlevel 1 (
  echo [Preuvance] Windows PowerShell est introuvable.
  echo Installez PowerShell puis relancez ce fichier.
  pause
  exit /b 1
)

echo.
echo   PREUVANCE - Scan local de conformite IA
echo.
echo   [1] Scan rapide (instantane)
echo   [2] Surveillance reseau 1 heure (laissez tourner en travaillant)
echo   [3] Annuler
echo.
set "PREUVANCE_CHOICE="
set /p "PREUVANCE_CHOICE=Votre choix [1/2/3] : "

if "%PREUVANCE_CHOICE%"=="2" (
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\preuvance-scan.ps1" -WatchMinutes 60
) else if "%PREUVANCE_CHOICE%"=="1" (
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\preuvance-scan.ps1" -WatchMinutes 0
) else (
  echo Annule.
  exit /b 0
)

set "PREUVANCE_EXIT=%ERRORLEVEL%"
echo.
if not "%PREUVANCE_EXIT%"=="0" (
  echo [Preuvance] Le scan a ete interrompu ou refuse.
)
pause
exit /b %PREUVANCE_EXIT%
