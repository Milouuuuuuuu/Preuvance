@echo off
setlocal
cd /d "%~dp0"

where powershell.exe >nul 2>&1
if errorlevel 1 (
  echo [Preuvance] Windows PowerShell est introuvable.
  pause
  exit /b 1
)

echo.
echo   PREUVANCE - Desinstallation
echo.
echo   [1] Nettoyer (cle API, caches, dependances, rapports de scan)
echo   [2] Tout supprimer (y compris le dossier de l'application)
echo   [3] Annuler
echo.
set "PREUVANCE_CHOICE="
set /p "PREUVANCE_CHOICE=Votre choix [1/2/3] : "

if "%PREUVANCE_CHOICE%"=="2" (
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\uninstall-preuvance-local.ps1" -RemoveAll
) else if "%PREUVANCE_CHOICE%"=="1" (
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\uninstall-preuvance-local.ps1"
) else (
  echo Annule.
  exit /b 0
)

set "PREUVANCE_EXIT=%ERRORLEVEL%"
echo.
pause
exit /b %PREUVANCE_EXIT%
