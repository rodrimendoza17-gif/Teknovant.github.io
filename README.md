# Teknovant Labs — Administrador de Taller Tecnológico

Plataforma web integral Full-Stack (`React + Express + WebSockets + Gemini AI + WhatsApp Directo`) para talleres de reparación de celulares, cómputo, consolas, desbloqueos y servicios técnicos en campo.

---

## Subir este proyecto a GitHub

Ejecuta estos comandos en la carpeta del proyecto desde tu PC:

```bash
git init
git add .
git commit -m "Teknovant Labs - Taller listo para produccion"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/teknovant-taller.git
git push -u origin main
```

> **Seguridad:** El archivo `.gitignore` ya protege automáticamente `.env`, `data/workshop-db.json` y `data/whatsapp-auth/` para que nunca subas tus contraseñas, base de datos ni sesión de WhatsApp a un repositorio público.

---

## Crear tu página web desde GitHub

Como el taller incluye servidor **Node.js**, notificaciones en tiempo real (**WebSockets**) y sesión activa de **WhatsApp**, debes conectarlo a una plataforma con servidor activo (no uses GitHub Pages porque solo sirve archivos estáticos).

### Opción 1: Railway (Recomendada — más rápida)
1. Crea una cuenta en [railway.app](https://railway.app) e inicia sesión con GitHub.
2. Pulsa **New Project > Deploy from GitHub Repo** y selecciona tu repositorio (`railway.toml` y `Dockerfile` ya están configurados).
3. En **Variables**, agrega:
   - `GEMINI_API_KEY` *(tu API Key gratuita de Google AI Studio)*
   - `ADMIN_PASSCODE` *(opcional: clave fija de administrador; si la omites la creas al primer ingreso)*
4. En tu servicio, abre **Volumes > Add Volume** y móntalo en:
   ```text
   /app/data
   ```
   *(Esto conserva tus órdenes, facturas y la sesión QR de WhatsApp entre reinicios).*
5. En **Settings > Networking > Generate Domain**, obtendrás tu enlace `https://...up.railway.app` listo para usar.

### Opción 2: Render (con Blueprint incluido)
1. En [render.com](https://render.com), elige **New > Blueprint** y conecta tu repositorio de GitHub (`render.yaml` ya incluye el disco persistente en `/app/data`).
2. Ingresa tu `GEMINI_API_KEY` cuando Render te la solicite.
3. En pocos minutos tendrás tu URL `https://...onrender.com`.

### Opción 3: VPS propio con Docker (Hostinger, DigitalOcean, Vultr, Contabo)
```bash
git clone https://github.com/TU-USUARIO/teknovant-taller.git
cd teknovant-taller
cp .env.example .env
# Edita .env y agrega GEMINI_API_KEY
docker build -t teknovant-taller .
docker run -d --name teknovant --restart unless-stopped -p 3000:3000 -v $(pwd)/data:/app/data --env-file .env teknovant-taller
```

---

## Variables de entorno

Consulta `.env.example`:
- `GEMINI_API_KEY`: Requerida para el Cotizador Inteligente de Mercado.
- `ANTHROPIC_API_KEY`: Opcional (proveedor alterno Claude).
- `ADMIN_PASSCODE`: Opcional (si se omite, el sistema pide crear la contraseña al primer inicio).
- `TEKNOVANT_DATA_DIR`: Carpeta de datos (por defecto `./data` o `/app/data` en Docker).

---

## Uso local o en Windows PC
Para ejecutarlo como programa local en Windows o generar el instalador `.exe`/`.msi`, revisa `WINDOWS-INSTALACION.md`.
