@echo off
title Teknovant Labs - Administrador de Taller
cd /d "%~dp0.."

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js instalado en esta PC.
  echo Descarga e instala Node.js LTS (v22 o superior) desde https://nodejs.org/
  pause
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" (
    copy ".env.example" ".env" >nul
    echo [AVISO] Se creo el archivo .env a partir de .env.example.
    echo Edita .env y agrega tu GEMINI_API_KEY para activar el Cotizador IA.
  )
)

if not exist "node_modules" (
  echo Instalando dependencias por primera vez...
  call npm install
  if errorlevel 1 (
    echo [ERROR] Fallo npm install.
    pause
    exit /b 1
  )
)

if not exist "dist\index.html" (
  echo Compilando interfaz del taller...
  call npm run build
  if errorlevel 1 (
    echo [ERROR] Fallo la compilacion del proyecto.
    pause
    exit /b 1
  )
)

set NODE_ENV=production
set PORT=3000

echo Iniciando servidor del taller en http://localhost:3000 ...
start /b "" cmd /c "npx tsx server.ts"

powershell -NoProfile -Command "for ($i=0; $i -lt 40; $i++) { try { $r = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/api/health -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; exit 1"

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3000
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3000
) else if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000
) else (
  start "" "http://localhost:3000"
)

echo.
echo Teknovant Labs esta corriendo en esta ventana. No cierres esta consola mientras uses el taller.
echo Para detener el programa, cierra esta ventana o presiona Ctrl + C.
:waitloop
timeout /t 60 /nobreak >nul
goto waitloop
