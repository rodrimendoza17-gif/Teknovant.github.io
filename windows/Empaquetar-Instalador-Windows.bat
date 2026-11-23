@echo off
title Empaquetador Teknovant Labs (.exe y .msi para Windows)
cd /d "%~dp0.."

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Necesitas Node.js v22+ instalado para compilar el programa de Windows.
  echo Descargalo desde https://nodejs.org/
  pause
  exit /b 1
)

echo [1/4] Instalando dependencias del taller...
call npm install
if errorlevel 1 (
  echo [ERROR] Fallo npm install.
  pause
  exit /b 1
)

echo [2/4] Instalando herramientas Electron para Windows...
call npm install --no-save electron electron-builder
if errorlevel 1 (
  echo [ERROR] No se pudo instalar electron / electron-builder.
  pause
  exit /b 1
)

echo [3/4] Compilando web y servidor interno...
call npm run build:desktop
if errorlevel 1 (
  echo [ERROR] Fallo la compilacion.
  pause
  exit /b 1
)

echo [4/4] Generando instaladores .exe y .msi en la carpeta release\ ...
call npx electron-builder --win nsis msi --x64 --config electron-builder.yml
if errorlevel 1 (
  echo [ERROR] Fallo electron-builder.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  LISTO! Tus instaladores estan en la carpeta: release\
echo ============================================================
if exist "release" start "" "release"
pause
