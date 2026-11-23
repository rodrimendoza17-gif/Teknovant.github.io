@echo off
setlocal
title Configurar API Key de Gemini - Teknovant Labs
cd /d "%~dp0.."

echo ============================================================
echo   CONFIGURAR CLAVE DE GEMINI AI - TEKNOVANT LABS
echo ============================================================
echo.
echo Pega tu API Key de Google AI Studio (empieza con AIza...)
echo y presiona ENTER:
echo.
set /p "GEMINI_KEY=GEMINI_API_KEY: "

if "%GEMINI_KEY%"=="" (
  echo [ERROR] No ingresaste ninguna clave.
  pause
  exit /b 1
)

set "DIR_NEW=%APPDATA%\Teknovant Labs Taller"
set "DIR_OLD=%APPDATA%\teknovant-labs-taller"
if not exist "%DIR_NEW%" mkdir "%DIR_NEW%"
if not exist "%DIR_OLD%" mkdir "%DIR_OLD%"

powershell -NoProfile -Command "$q = [char]34; $k = $env:GEMINI_KEY.Trim().Trim($q).Trim([char]39); if (-not $k) { exit 1 }; $enc = New-Object System.Text.UTF8Encoding($false); $nl = [Environment]::NewLine; $txt = 'GEMINI_API_KEY=' + $q + $k + $q + $nl + 'ANTHROPIC_API_KEY=' + $q + $q + $nl + 'ADMIN_PASSCODE=' + $q + $q + $nl; [System.IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $txt, $enc); [System.IO.File]::WriteAllText((Join-Path $env:DIR_NEW '.env'), $txt, $enc); [System.IO.File]::WriteAllText((Join-Path $env:DIR_OLD '.env'), $txt, $enc); if (Test-Path 'release') { [System.IO.File]::WriteAllText((Join-Path (Get-Location) 'release\.env'), $txt, $enc) }"

if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] No se pudo guardar el archivo .env.
  pause
  exit /b 1
)

echo.
echo [LISTO] Se guardo tu GEMINI_API_KEY correctamente en:
echo  1) "%CD%\.env"
echo  2) "%DIR_NEW%\.env"
echo  3) "%DIR_OLD%\.env"
if exist "release\.env" echo  4) "%CD%\release\.env"
echo.
echo IMPORTANTE: Cierra por completo tu programa .exe si estaba abierto
echo y vuelvelo a abrir para que cargue la nueva clave.
pause
