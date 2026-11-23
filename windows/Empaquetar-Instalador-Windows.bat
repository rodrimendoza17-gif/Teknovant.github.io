@echo off
title Empaquetador Teknovant Labs (.EXE y .MSI para Windows)
cd /d "%~dp0.."

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Necesitas Node.js v22+ instalado para compilar el .EXE de Windows.
  echo Descargalo desde https://nodejs.org/
  pause
  exit /b 1
)

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

echo [4/4] Generando .EXE Instalador, .EXE Portable y .MSI en release\ ...
call npx electron-builder --win nsis portable msi --x64 --config electron-builder.yml
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Fallo electron-builder.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  LISTO! Tus archivos generados estan en la carpeta release\:
echo   - Teknovant Labs Taller Setup 1.0.0.exe (Instalador)
echo   - Teknovant-Labs-Taller-Portable.exe     (1 solo archivo)
echo   - Teknovant Labs Taller 1.0.0.msi        (Paquete MSI)
echo ============================================================
if exist "release" start "" "release"
pause
