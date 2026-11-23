const { app, BrowserWindow, dialog, shell } = require('electron');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { pathToFileURL } = require('url');

let mainWindow = null;

function findAvailablePort(preferredPort = 3000) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => {
      const fallback = net.createServer();
      fallback.unref();
      fallback.on('error', reject);
      fallback.listen(0, '127.0.0.1', () => {
        const addr = fallback.address();
        const port = typeof addr === 'object' && addr ? addr.port : preferredPort;
        fallback.close(() => resolve(port));
      });
    });
    server.listen(preferredPort, '127.0.0.1', () => {
      server.close(() => resolve(preferredPort));
    });
  });
}

function waitForServer(port, timeoutMs = 20000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve();
        } else if (Date.now() - startedAt > timeoutMs) {
          reject(new Error('El servidor interno tardó demasiado en responder.'));
        } else {
          setTimeout(check, 250);
        }
      });
      req.on('error', () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error('No se pudo conectar con el servidor interno del taller.'));
        } else {
          setTimeout(check, 250);
        }
      });
    };
    check();
  });
}

app.setName('Teknovant Labs Taller');

function envHasGeminiKey(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return /GEMINI_API_KEY\s*=\s*["']?[A-Za-z0-9_\-]{10,}["']?/.test(raw);
  } catch {
    return false;
  }
}

function ensureUserEnvFile(userDataDir, appRoot) {
  const candidates = [];
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    candidates.push(path.join(process.env.PORTABLE_EXECUTABLE_DIR, '.env'));
  }
  if (app.isPackaged) {
    candidates.push(path.join(path.dirname(process.execPath), '.env'));
  }
  candidates.push(path.join(userDataDir, '.env'));
  candidates.push(path.join(app.getPath('appData'), 'teknovant-labs-taller', '.env'));
  candidates.push(path.join(appRoot, '.env'));

  for (const c of candidates) {
    if (envHasGeminiKey(c)) return c;
  }

  const userEnv = path.join(userDataDir, '.env');
  const rootEnv = path.join(appRoot, '.env');
  const exampleEnv = path.join(appRoot, '.env.example');

  if (!fs.existsSync(userEnv)) {
    if (fs.existsSync(rootEnv)) {
      fs.copyFileSync(rootEnv, userEnv);
    } else if (fs.existsSync(exampleEnv)) {
      fs.copyFileSync(exampleEnv, userEnv);
    }
  }
  return userEnv;
}

async function createDesktopWindow(port, appRoot) {
  const iconPath = path.join(appRoot, 'public', 'icon.ico');
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'Teknovant Labs — Administrador de Taller',
    backgroundColor: '#070b14',
    autoHideMenuBar: true,
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotSingleLock = app.requestSingleInstanceLock();
if (!gotSingleLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      const appRoot = app.getAppPath();
      const userDataDir = app.getPath('userData');
      const dataDir = path.join(userDataDir, 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const envPath = ensureUserEnvFile(userDataDir, appRoot);
      const port = await findAvailablePort(3000);

      process.env.NODE_ENV = 'production';
      process.env.HOST = '127.0.0.1';
      process.env.PORT = String(port);
      process.env.TEKNOVANT_DATA_DIR = dataDir;
      process.env.TEKNOVANT_DIST_DIR = path.join(appRoot, 'dist');
      process.env.TEKNOVANT_ENV_PATH = envPath;

      const bundledServerPath = path.join(appRoot, 'dist-server', 'server.mjs');
      await import(pathToFileURL(bundledServerPath).href);
      await waitForServer(port);
      await createDesktopWindow(port, appRoot);
    } catch (err) {
      dialog.showErrorBox(
        'Error al iniciar Teknovant Labs',
        err instanceof Error ? err.stack || err.message : String(err)
      );
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
