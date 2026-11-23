@echo off
setlocal
title Empaquetador Teknovant Labs (.EXE para Windows)
cd /d "%~dp0.."

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Necesitas Node.js v22+ instalado para compilar el .EXE de Windows.
  echo Descargalo desde https://nodejs.org/
  pause
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" (
    copy ".env.example" ".env" >nul
  ) else (
    type nul > ".env"
  )
)

powershell -NoProfile -Command "if (Test-Path '.env' -PathType Container) { Remove-Item '.env' -Recurse -Force }; $raw = Get-Content -Path '.env' -Raw -ErrorAction SilentlyContinue; if ($raw -match 'GEMINI_API_KEY\s*=\s*[\x22\x27]?[A-Za-z0-9_\-\.]{10,}[\x22\x27]?') { exit 0 } else { exit 1 }"
if %ERRORLEVEL% EQU 0 goto after_key_prompt

echo.
echo ============================================================
echo   CONFIGURAR GEMINI_API_KEY ANTES DE CREAR EL .EXE
echo ============================================================
echo Pega tu API Key de Google AI Studio [AIza... o AQ....]
echo o presiona ENTER para dejarlo vacio y configurarlo despues:
echo.
set /p "GEMINI_KEY=GEMINI_API_KEY: "

if not defined GEMINI_KEY goto after_key_prompt
if "%GEMINI_KEY%"=="" goto after_key_prompt

powershell -NoProfile -Command "$q = [char]34; $k = $env:GEMINI_KEY.Trim().Trim($q).Trim([char]39); if (-not $k) { exit 0 }; $enc = New-Object System.Text.UTF8Encoding($false); $nl = [Environment]::NewLine; $txt = 'GEMINI_API_KEY=' + $q + $k + $q + $nl + 'ANTHROPIC_API_KEY=' + $q + $q + $nl + 'ADMIN_PASSCODE=' + $q + $q + $nl; $localEnv = Join-Path (Get-Location) '.env'; if (Test-Path $localEnv -PathType Container) { Remove-Item $localEnv -Recurse -Force }; [System.IO.File]::WriteAllText($localEnv, $txt, $enc); foreach ($sub in @('Teknovant Labs Taller', 'teknovant-labs-taller')) { try { $dir = Join-Path $env:APPDATA $sub; if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }; $target = Join-Path $dir '.env'; if (Test-Path $target -PathType Container) { Remove-Item $target -Recurse -Force }; if (Test-Path $target) { Set-ItemProperty -Path $target -Name IsReadOnly -Value $false -ErrorAction SilentlyContinue }; [System.IO.File]::WriteAllText($target, $txt, $enc) } catch { } }"
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] No se pudo guardar .env en la carpeta del proyecto.
  pause
  exit /b 1
)
echo [OK] GEMINI_API_KEY guardada para incluirse en el .EXE.

:after_key_prompt
echo.
echo [1/4] Instalando dependencias del taller...
call npm install --no-audit --no-fund
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Fallo npm install.
  pause
  exit /b 1
)

echo [2/4] Instalando herramientas Electron para generar .EXE...
call npm install --no-save --no-audit --no-fund electron electron-builder
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] No se pudo instalar electron / electron-builder.
  pause
  exit /b 1
)

echo [3/4] Compilando interfaz web y servidor interno...
call npm run build:desktop
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Fallo la compilacion.
  pause
  exit /b 1
)

echo [4/4] Generando .EXE Instalador y .EXE Portable en release\ ...
call npx electron-builder --win nsis portable --x64 --config electron-builder.yml
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Fallo electron-builder.
  pause
  exit /b 1
)

if exist ".env" copy /y ".env" "release\.env" >nul

echo.
echo ============================================================
echo  LISTO! Tus programas .EXE estan en la carpeta release\:
echo   - Teknovant Labs Taller Setup 1.0.0.exe [Instalador]
echo   - Teknovant-Labs-Taller-Portable.exe     [1 solo archivo]
echo ============================================================
if exist "release" start "" "release"
pause
