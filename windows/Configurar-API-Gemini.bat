@echo off
setlocal
title Configurar API Key de Gemini - Teknovant Labs
cd /d "%~dp0.."

echo ============================================================
echo   CONFIGURAR CLAVE DE GEMINI AI - TEKNOVANT LABS
echo ============================================================
echo.
echo Pega tu API Key de Google AI Studio [AIza... o AQ....]
echo y presiona ENTER:
echo.
set /p "GEMINI_KEY=GEMINI_API_KEY: "

if not defined GEMINI_KEY goto empty_key
if "%GEMINI_KEY%"=="" goto empty_key

powershell -NoProfile -Command "$q = [char]34; $k = $env:GEMINI_KEY.Trim().Trim($q).Trim([char]39); if (-not $k) { exit 1 }; $enc = New-Object System.Text.UTF8Encoding($false); $nl = [Environment]::NewLine; $txt = 'GEMINI_API_KEY=' + $q + $k + $q + $nl + 'ANTHROPIC_API_KEY=' + $q + $q + $nl + 'ADMIN_PASSCODE=' + $q + $q + $nl; $localEnv = Join-Path (Get-Location) '.env'; if (Test-Path $localEnv -PathType Container) { Remove-Item $localEnv -Recurse -Force }; [System.IO.File]::WriteAllText($localEnv, $txt, $enc); if (Test-Path 'release') { $relEnv = Join-Path (Get-Location) 'release\.env'; if (Test-Path $relEnv -PathType Container) { Remove-Item $relEnv -Recurse -Force }; [System.IO.File]::WriteAllText($relEnv, $txt, $enc) }; foreach ($sub in @('Teknovant Labs Taller', 'teknovant-labs-taller')) { try { $dir = Join-Path $env:APPDATA $sub; if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }; $target = Join-Path $dir '.env'; if (Test-Path $target -PathType Container) { Remove-Item $target -Recurse -Force }; if (Test-Path $target) { Set-ItemProperty -Path $target -Name IsReadOnly -Value $false -ErrorAction SilentlyContinue }; [System.IO.File]::WriteAllText($target, $txt, $enc) } catch { } }"

if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] No se pudo guardar el archivo .env.
  pause
  exit /b 1
)

echo.
echo [LISTO] Se guardo tu GEMINI_API_KEY correctamente en:
echo  1. "%CD%\.env"
echo  2. "%APPDATA%\Teknovant Labs Taller\.env"
if exist "release\.env" echo  3. "%CD%\release\.env"
echo.
echo IMPORTANTE: Cierra por completo tu programa .exe si estaba abierto
echo y vuelvelo a abrir para que cargue la nueva clave.
pause
exit /b 0

:empty_key
echo [ERROR] No ingresaste ninguna clave.
pause
exit /b 1
