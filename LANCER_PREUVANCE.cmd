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

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launch-preuvance-local.ps1"
set "PREUVANCE_EXIT=%ERRORLEVEL%"

if not "%PREUVANCE_EXIT%"=="0" (
  echo.
  echo [Preuvance] Le lancement a echoue. Consultez le message ci-dessus.
  pause
)

exit /b %PREUVANCE_EXIT%
