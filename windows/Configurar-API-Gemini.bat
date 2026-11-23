@echo off
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

set "ENV_DATA_DIR=%APPDATA%\Teknovant Labs Taller"
if not exist "%ENV_DATA_DIR%" mkdir "%ENV_DATA_DIR%"

powershell -NoProfile -Command "$k = $env:GEMINI_KEY.Trim().Trim('\"'); $enc = New-Object System.Text.UTF8Encoding($false); $text = 'GEMINI_API_KEY=\"' + $k + '\"' + [Environment]::NewLine + 'ANTHROPIC_API_KEY=\"\"' + [Environment]::NewLine + 'ADMIN_PASSCODE=\"\"' + [Environment]::NewLine; [System.IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $text, $enc); [System.IO.File]::WriteAllText((Join-Path $env:ENV_DATA_DIR '.env'), $text, $enc); if (Test-Path 'release') { [System.IO.File]::WriteAllText((Join-Path (Get-Location) 'release\.env'), $text, $enc) }"

if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] No se pudo guardar el archivo .env.
  pause
  exit /b 1
)

echo.
echo [LISTO] Se guardo tu GEMINI_API_KEY correctamente en:
echo  1) "%CD%\.env"
echo  2) "%ENV_DATA_DIR%\.env"
if exist "release\.env" echo  3) "%CD%\release\.env"
echo.
echo Si ya tenias abierto el programa .exe, cierralo y vuelvelo a abrir.
pause
