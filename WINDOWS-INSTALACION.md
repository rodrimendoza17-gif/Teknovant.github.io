# Usar Teknovant Labs como Programa en Windows

Puedes ejecutar este taller en tu PC con Windows de **dos maneras**: como programa de escritorio directo con doble clic o compilando un instalador clásico (`.exe` y `.msi`).

---

## Requisito previo (solo una vez)
1. Instala **Node.js LTS (v22 o superior)** en tu PC desde: https://nodejs.org/
2. Descarga o clona esta carpeta completa del proyecto en tu computadora.
3. Si deseas usar el **Cotizador IA**, edita el archivo `.env` (copiando `.env.example` a `.env`) y pega tu `GEMINI_API_KEY`.

---

## Opción A: Modo Programa Directo (sin compilar instalador)
1. Abre la carpeta `windows\`.
2. Haz doble clic en **`Iniciar-Taller.bat`**.
3. La primera vez instalará las librerías y compilará automáticamente; luego abrirá el taller en una **ventana propia de aplicación** en tu escritorio.
4. Puedes crear un acceso directo en tu Escritorio hacia `windows\Iniciar-Taller.bat`.

> Todos tus datos (`workshop-db.json` y tu sesión vinculada de WhatsApp) se guardan en la carpeta `data\` dentro del proyecto.

---

## Opción B: Crear el Instalador `.exe` y `.msi` para Windows
1. Abre la carpeta `windows\`.
2. Haz doble clic en **`Empaquetar-Instalador-Windows.bat`**.
3. El script compilará la interfaz web, el servidor interno (`dist-server/server.mjs`) y generará en la carpeta **`release\`**:
   - Instalador clásico **`.exe`** (NSIS)
   - Paquete empresarial **`.msi`**
4. Ejecuta el instalador en tu PC o en otras computadoras con Windows.

### ¿Dónde guarda los datos y el `.env` el programa ya instalado?
Cuando instalas el `.exe` o `.msi`, Windows guarda tus datos y tu sesión de WhatsApp de forma segura en tu carpeta de usuario (con permisos de escritura):
`%APPDATA%\Teknovant Labs Taller\data\`

Si quieres configurar tu `GEMINI_API_KEY` en el programa instalado, crea o edita el archivo:
`%APPDATA%\Teknovant Labs Taller\.env`

---

## Nota sobre conexión a Internet
- Las órdenes, remisiones, inventario, punto de venta, tickets térmicos y facturas PDF funcionan de forma local en tu PC.
- El **Cotizador IA (Gemini)** y el **envío por WhatsApp** requieren que la PC tenga conexión a internet al momento de usarlos.
