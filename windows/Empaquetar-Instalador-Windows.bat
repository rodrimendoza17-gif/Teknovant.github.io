@echo off
setlocal
title Empaquetador Teknovant Labs (.EXE + .MSI para Windows)
cd /d "%~dp0.."

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Necesitas Node.js v22+ instalado para compilar el programa.
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

powershell -NoProfile -Command "if (Test-Path '.env' -PathType Container) { Remove-Item '.env' -Recurse -Force }; $raw = Get-Content -Path '.env' -Raw -ErrorAction SilentlyContinue; if ($raw -match '(GEMINI_API_KEY|GROQ_API_KEY|OPENAI_API_KEY|OPENROUTER_API_KEY|ANTHROPIC_API_KEY|DEEPSEEK_API_KEY|CUSTOM_AI_BASE_URL)\s*=\s*[\x22\x27]?[^\s\x22\x27]{6,}[\x22\x27]?') { exit 0 } else { exit 1 }"
if %ERRORLEVEL% EQU 0 goto after_ai_prompt

call "windows\Configurar-API-IA.bat" --no-pause

:after_ai_prompt
echo.
echo [1/4] Instalando dependencias del taller...
call npm install --no-audit --no-fund
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Fallo npm install.
  pause
  exit /b 1
)

echo [2/4] Instalando herramientas Electron para generar .EXE y .MSI...
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

echo [4/4] Generando .EXE Instalador, .EXE Portable y .MSI en release\ ...
echo Nota: el paquete .MSI puede tardar varios minutos mientras WiX empaqueta node_modules.
call npx electron-builder --win nsis portable msi --x64 --config electron-builder.yml
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Fallo electron-builder.
  pause
  exit /b 1
)

if exist ".env" copy /y ".env" "release\.env" >nul

echo.
echo ============================================================
echo  LISTO! Tus instaladores estan en la carpeta release\:
echo   - Teknovant Labs Taller Setup 1.0.0.exe [Instalador]
echo   - Teknovant-Labs-Taller-Portable.exe     [1 solo archivo]
echo   - Teknovant Labs Taller 1.0.0.msi        [Instalador MSI]
echo ============================================================
if exist "release" start "" "release"
pause
