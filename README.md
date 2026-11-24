# Teknovant Labs — Administrador de Taller Tecnológico

Plataforma web integral Full-Stack (`React + Express + WebSockets + Gemini AI + WhatsApp Directo`) lista para abrir desde cualquier navegador online (computadora, tablet o celular).

---

## Subir este proyecto a GitHub

Ejecuta estos comandos en la carpeta del proyecto desde tu PC:

```bash
git init
git add .
git commit -m "Teknovant Labs - Listo para hosting online"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/teknovant-taller.git
git push -u origin main
```

> **Seguridad importante:** Nunca pegues tu `GEMINI_API_KEY` dentro del código fuente ni la subas a GitHub (GitHub y Google detectan y desactivan automáticamente las claves publicadas en repositorios). El archivo `.gitignore` ya bloquea `.env`, `data/workshop-db.json` y `data/whatsapp-auth/`.

---

## Publicar tu página web online (con Gemini AI y WhatsApp activos)

Como el sistema usa servidor **Node.js**, **WebSockets en vivo** y sesión de **WhatsApp**, necesitas un host con servidor activo (no uses GitHub Pages porque solo sirve HTML estático).

### Opción 1: Render (Gratis para empezar, desde GitHub)
1. Crea cuenta gratuita en [render.com](https://render.com) y conecta tu GitHub.
2. Elige **New > Blueprint** y selecciona tu repositorio (`render.yaml` y `Dockerfile` ya vienen configurados en plan gratuito).
3. En la pantalla de variables, pega tu **`GEMINI_API_KEY`** (clave `AIza...` de `https://aistudio.google.com/apikey`).
4. Pulsa **Apply** y en unos minutos tendrás tu URL pública `https://...onrender.com` lista para cualquier navegador.
   *(Nota: el plan gratuito de Render reinicia archivos temporales al actualizar; si necesitas guardar órdenes y sesión QR de WhatsApp de forma permanente, usa Railway con Volume o un VPS).*

### Opción 2: Railway (Recomendada con guardado permanente)
1. Inicia sesión con GitHub en [railway.app](https://railway.app).
2. Pulsa **New Project > Deploy from GitHub Repo** y elige tu repo (`railway.toml` ya está listo).
3. En **Variables**, agrega:
   - `GEMINI_API_KEY` = tu clave de Google AI Studio (`AIza...`)
   - `ADMIN_PASSCODE` = *(opcional)* tu contraseña de administrador
4. En **Volumes > Add Volume**, móntalo en **`/app/data`** para conservar órdenes, facturas y sesión QR de WhatsApp.
5. En **Settings > Networking > Generate Domain**, obtendrás tu enlace `https://...up.railway.app`.

### Opción 3: Hosting VPS con Docker (Hostinger, DigitalOcean, Contabo, Vultr)
1. Sube o clona el proyecto en tu servidor y crea el archivo `.env`:
   ```bash
   cp .env.example .env
   nano .env   # Pega ahí tu GEMINI_API_KEY
   ```
2. Inicia el sitio web online con un solo comando:
   ```bash
   docker compose up -d --build
   ```
3. Abre `http://TU-IP-O-DOMINIO:3000` (o apunta Nginx/Cloudflare con HTTPS hacia el puerto `3000`).

### Opción 4: Hosting Node.js tradicional (Plesk, cPanel, Easypanel, etc.)
- **Comando de compilación (Build):** `npm install && npm run build`
- **Comando de inicio (Start):** `npm start`
- **Variables de entorno en el panel del host:** `NODE_ENV=production` y `GEMINI_API_KEY=tu_clave`

---

## Variables de entorno (`.env.example`)
- `GEMINI_API_KEY`: Requerida para el Cotizador Inteligente de Mercado.
- `ANTHROPIC_API_KEY`: Opcional (proveedor alterno Claude).
- `ADMIN_PASSCODE`: Opcional (si se omite, el sistema pide crear la contraseña al primer ingreso).
- `TEKNOVANT_DATA_DIR`: Carpeta de datos (por defecto `./data` o `/app/data` en Docker).

---

## Uso local o en Windows PC (.exe)
Para ejecutarlo o compilar el programa `.exe` en Windows, consulta `WINDOWS-INSTALACION.md`.
