# Crear el `.exe` y `.msi` en Visual Studio o Visual Studio Code (Windows)

Puedes abrir esta carpeta directamente en **Visual Studio Code** o **Microsoft Visual Studio** en Windows y generar tu programa completo (**`.exe` instalador**, **`.exe` portable** y **`.msi`**) compatible con **cualquier API de IA**.

---

## Requisito previo en tu PC con Windows
1. Instala **Node.js LTS (v22 o superior)**: https://nodejs.org/
2. Descarga este proyecto (o clónalo desde GitHub) en una carpeta de tu PC.
3. *(Opcional)* Para activar el **Cotizador IA** con el proveedor que prefieras (**Google Gemini, Groq gratis, OpenAI/ChatGPT, OpenRouter, Claude, DeepSeek u Ollama/API personalizada**), haz doble clic en **`windows\Configurar-API-IA.bat`** y elige tu motor. También te lo pedirá automáticamente al empaquetar si aún no hay ninguno configurado.

---

## Opción 1: Desde Visual Studio Code (VS Code)
1. Abre **Visual Studio Code** > **Archivo > Abrir carpeta...** y selecciona la carpeta del taller.
2. Presiona **`Ctrl + Shift + B`** (o ve al menú **Terminal > Ejecutar tarea de compilación...**).
3. Elige **`1. Crear Programa Windows (.EXE Instalador + .EXE Portable + .MSI)`** *(o la opción 2 si solo quieres `.exe` rápido sin esperar al `.msi`)*.
4. Al terminar, abre la carpeta **`release\`** y encontrarás:
   - **`Teknovant Labs Taller Setup 1.0.0.exe`** (instalador clásico de Windows)
   - **`Teknovant-Labs-Taller-Portable.exe`** (ejecutable directo de un solo archivo, sin instalar)
   - **`Teknovant Labs Taller 1.0.0.msi`** (paquete instalador MSI; ten paciencia en el paso final porque WiX tarda varios minutos en indexar `node_modules`)
5. También puedes probar el programa antes de empaquetar desde la terminal integrada con:
   ```bash
   npm run desktop:dev
   ```

---

## Opción 2: Desde Microsoft Visual Studio (2022 / 2026)
1. Abre **Visual Studio** > **Abrir una carpeta local** y selecciona la carpeta del taller.
2. Haz doble clic en **`windows\Empaquetar-Instalador-Windows.bat`** para generar los `.exe` y el `.msi`, o abre la terminal integrada y ejecuta `npm run desktop:all`.
3. Los instaladores quedarán listos en la carpeta **`release\`**.

---

## Opción 3: Doble clic directo sin abrir editor
- Abre `windows\Empaquetar-Instalador-Windows.bat` para generar `.exe` + `.msi` en `release\`.
- O abre `windows\Iniciar-Taller.bat` para usarlo de inmediato como programa de escritorio sin empaquetar.

---

## Motores de IA compatibles (en `.env` o `windows\Configurar-API-IA.bat`)
- `GEMINI_API_KEY`: Google Gemini
- `GROQ_API_KEY`: Groq Cloud (capa gratuita rápida)
- `OPENAI_API_KEY`: OpenAI / ChatGPT
- `OPENROUTER_API_KEY`: OpenRouter (modelos gratis y de pago)
- `ANTHROPIC_API_KEY`: Anthropic Claude
- `DEEPSEEK_API_KEY`: DeepSeek
- `CUSTOM_AI_BASE_URL` (+ `CUSTOM_AI_MODEL` / `CUSTOM_AI_API_KEY`): cualquier API compatible con OpenAI (Ollama local, LM Studio, Mistral, Together, etc.)

---

## ¿Dónde guarda los datos el `.exe` / `.msi` ya instalado?
Para evitar bloqueos de permisos de Windows en `Archivos de programa`, el programa guarda la base de datos (`workshop-db.json`), la sesión vinculada de WhatsApp y tu `.env` en:
`%APPDATA%\Teknovant Labs Taller\data\`
`%APPDATA%\Teknovant Labs Taller\.env`
