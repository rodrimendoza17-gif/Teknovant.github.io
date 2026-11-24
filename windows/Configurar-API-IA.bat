@echo off
setlocal
title Configurar API de IA (Cualquier Proveedor) - Teknovant Labs
cd /d "%~dp0.."

set "NO_PAUSE="
if /i "%~1"=="--no-pause" set "NO_PAUSE=1"

echo ============================================================
echo   CONFIGURAR API DE IA - TEKNOVANT LABS
echo ============================================================
echo Elige que motor de IA deseas configurar en .env:
echo.
echo   1. Google Gemini        [aistudio.google.com/apikey - Gratis]
echo   2. Groq Cloud           [console.groq.com/keys - Gratis/Rapido]
echo   3. OpenAI / ChatGPT     [platform.openai.com/api-keys]
echo   4. OpenRouter           [openrouter.ai/keys - Modelos Gratis]
echo   5. Anthropic Claude     [console.anthropic.com]
echo   6. DeepSeek             [platform.deepseek.com/api_keys]
echo   7. IA Personalizada / Ollama local [URL OpenAI-compatible]
echo   0. Omitir por ahora
echo.
set /p "AI_OPT=Selecciona una opcion [1-7 o 0]: "

if "%AI_OPT%"=="0" goto done_no_save
if "%AI_OPT%"=="" goto done_no_save

set "KEY_VAR="
set "URL_VAR="
set "MOD_VAR="
set "KEY_VAL="
set "URL_VAL="
set "MOD_VAL="

if "%AI_OPT%"=="1" set "KEY_VAR=GEMINI_API_KEY"
if "%AI_OPT%"=="2" set "KEY_VAR=GROQ_API_KEY"
if "%AI_OPT%"=="3" set "KEY_VAR=OPENAI_API_KEY"
if "%AI_OPT%"=="4" set "KEY_VAR=OPENROUTER_API_KEY"
if "%AI_OPT%"=="5" set "KEY_VAR=ANTHROPIC_API_KEY"
if "%AI_OPT%"=="6" set "KEY_VAR=DEEPSEEK_API_KEY"
if "%AI_OPT%"=="7" goto ask_custom

if not defined KEY_VAR goto invalid_opt

echo.
set /p "KEY_VAL=Pega tu %KEY_VAR% y presiona ENTER: "
if not defined KEY_VAL goto done_no_save
if "%KEY_VAL%"=="" goto done_no_save
goto save_env

:ask_custom
echo.
echo Ejemplo Ollama local: http://127.0.0.1:11434/v1
set /p "URL_VAL=URL base de tu API [CUSTOM_AI_BASE_URL]: "
if not defined URL_VAL goto done_no_save
if "%URL_VAL%"=="" goto done_no_save
set "URL_VAR=CUSTOM_AI_BASE_URL"
set /p "MOD_VAL=Nombre del modelo [ej: llama3.2 o mistral]: "
if defined MOD_VAL set "MOD_VAR=CUSTOM_AI_MODEL"
set /p "KEY_VAL=API Key [opcional para Ollama local, ENTER si no usa]: "
if defined KEY_VAL set "KEY_VAR=CUSTOM_AI_API_KEY"

:save_env
powershell -NoProfile -Command "$q = [char]34; $enc = New-Object System.Text.UTF8Encoding($false); $nl = [Environment]::NewLine; $localEnv = Join-Path (Get-Location) '.env'; if (Test-Path $localEnv -PathType Container) { Remove-Item $localEnv -Recurse -Force }; $map = [ordered]@{}; if (Test-Path $localEnv) { foreach ($line in (Get-Content -Path $localEnv -ErrorAction SilentlyContinue)) { if ($line -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$') { $map[$matches[1]] = $matches[2].Trim().Trim($q).Trim([char]39) } } }; if ($env:KEY_VAR -and $env:KEY_VAL) { $map[$env:KEY_VAR] = $env:KEY_VAL.Trim().Trim($q).Trim([char]39) }; if ($env:URL_VAR -and $env:URL_VAL) { $map[$env:URL_VAR] = $env:URL_VAL.Trim().Trim($q).Trim([char]39) }; if ($env:MOD_VAR -and $env:MOD_VAL) { $map[$env:MOD_VAR] = $env:MOD_VAL.Trim().Trim($q).Trim([char]39) }; if (-not $map.Contains('AI_PROVIDER')) { $map['AI_PROVIDER'] = 'auto' }; $out = ($map.GetEnumerator() | ForEach-Object { $_.Key + '=' + $q + $_.Value + $q }) -join $nl; $out += $nl; [System.IO.File]::WriteAllText($localEnv, $out, $enc); if (Test-Path 'release') { $relEnv = Join-Path (Get-Location) 'release\.env'; if (Test-Path $relEnv -PathType Container) { Remove-Item $relEnv -Recurse -Force }; [System.IO.File]::WriteAllText($relEnv, $out, $enc) }; foreach ($sub in @('Teknovant Labs Taller', 'teknovant-labs-taller')) { try { $dir = Join-Path $env:APPDATA $sub; if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }; $target = Join-Path $dir '.env'; if (Test-Path $target -PathType Container) { Remove-Item $target -Recurse -Force }; if (Test-Path $target) { Set-ItemProperty -Path $target -Name IsReadOnly -Value $false -ErrorAction SilentlyContinue }; [System.IO.File]::WriteAllText($target, $out, $enc) } catch { } }"
if %ERRORLEVEL% NEQ 0 goto save_err

echo.
echo [LISTO] Configuracion de IA guardada en .env y en AppData.
echo Si el programa ya estaba abierto, cierralo y vuelvelo a abrir.
if not defined NO_PAUSE pause
exit /b 0

:invalid_opt
echo [AVISO] Opcion no valida.
if not defined NO_PAUSE pause
exit /b 1

:save_err
echo [ERROR] No se pudo guardar .env.
if not defined NO_PAUSE pause
exit /b 1

:done_no_save
if not defined NO_PAUSE pause
exit /b 0
