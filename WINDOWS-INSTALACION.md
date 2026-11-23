# Crear el `.exe` en Visual Studio o Visual Studio Code (Windows)

Puedes abrir esta carpeta directamente en **Visual Studio Code** o **Microsoft Visual Studio** en Windows y generar tu programa `.exe` (tanto **instalador** como **portable de 1 solo archivo**).

---

## Requisito previo en tu PC con Windows
1. Instala **Node.js LTS (v22 o superior)**: https://nodejs.org/
2. Descarga este proyecto (o clónalo desde GitHub) en una carpeta de tu PC.
3. *(Opcional)* Para activar el **Cotizador IA**, haz doble clic en **`windows\Configurar-API-Gemini.bat`** y pega tu `GEMINI_API_KEY` (no uses `setx` manualmente en consola; el script crea el `.env` con las comillas correctas). También te la pedirá automáticamente al empaquetar si aún no la configuraste.

---

## Opción 1: Desde Visual Studio Code (VS Code)
1. Abre **Visual Studio Code** > **Archivo > Abrir carpeta...** y selecciona la carpeta del taller.
2. Presiona **`Ctrl + Shift + B`** (o ve al menú **Terminal > Ejecutar tarea de compilación...**).
3. Elige **`1. Crear Programa Windows (.EXE Instalador + .EXE Portable)`**.
4. Al terminar, abre la carpeta **`release\`** y encontrarás:
   - **`Teknovant Labs Taller Setup 1.0.0.exe`** (instalador clásico de Windows)
   - **`Teknovant-Labs-Taller-Portable.exe`** (ejecutable directo de un solo archivo, sin instalar)
   *(Si además requieres paquete empresarial `.msi`, puedes ejecutar `npm run desktop:msi` en terminal).*
5. También puedes probar el programa antes de empaquetar desde la terminal integrada con:
   ```bash
   npm run desktop:dev
   ```

---

## Opción 2: Desde Microsoft Visual Studio (2022 / 2026)
1. Abre **Visual Studio** > **Abrir una carpeta local** y selecciona la carpeta del taller.
2. En el **Explorador de soluciones**, haz doble clic en **`windows\Empaquetar-Instalador-Windows.bat`** para generar los `.exe`, o abre la terminal integrada y ejecuta `npm run desktop:exe`.
3. Los ejecutables quedarán listos en la carpeta **`release\`**.

---

## Opción 3: Doble clic directo sin abrir editor
- Abre `windows\Empaquetar-Instalador-Windows.bat` para generar ambos `.exe` en `release\`.
- O abre `windows\Iniciar-Taller.bat` para usarlo de inmediato como programa de escritorio sin empaquetar.

---

## ¿Dónde guarda los datos el `.exe` ya ejecutado?
Para evitar bloqueos de permisos de Windows en `Archivos de programa`, el programa guarda la base de datos (`workshop-db.json`), la sesión vinculada de WhatsApp y tu `.env` en:
`%APPDATA%\Teknovant Labs Taller\data\`
`%APPDATA%\Teknovant Labs Taller\.env`
