import fs from 'fs';
import path from 'path';
import pino from 'pino';
import QRCode from 'qrcode';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys';
import type {
  WhatsAppDispatchLog,
  WhatsAppSessionState,
} from '../src/types/workshop.ts';

const WA_AUTH_DIR = process.env.TEKNOVANT_DATA_DIR
  ? path.join(path.resolve(process.env.TEKNOVANT_DATA_DIR), 'whatsapp-auth')
  : path.resolve(process.cwd(), 'data', 'whatsapp-auth');

let activeSocket: WASocket | null = null;
let isConnecting = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

let sessionState: WhatsAppSessionState = {
  status: 'disconnected',
  qrDataUrl: null,
  pairingCode: null,
  connectedPhone: null,
  connectedName: null,
  lastError: null,
  updatedAt: new Date().toISOString(),
};

const dispatchLogs: WhatsAppDispatchLog[] = [];

type StatusListener = (state: WhatsAppSessionState) => void;
const listeners = new Set<StatusListener>();

export function subscribeWhatsAppStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function updateState(patch: Partial<WhatsAppSessionState>) {
  sessionState = {
    ...sessionState,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  for (const fn of listeners) {
    try {
      fn(sessionState);
    } catch {
      // ignore listener errors
    }
  }
}

export function getWhatsAppStatus(): {
  session: WhatsAppSessionState;
  logs: WhatsAppDispatchLog[];
} {
  return {
    session: sessionState,
    logs: dispatchLogs.slice(0, 50),
  };
}

function ensureAuthDir() {
  if (!fs.existsSync(WA_AUTH_DIR)) {
    fs.mkdirSync(WA_AUTH_DIR, { recursive: true });
  }
}

function clearAuthDir() {
  if (fs.existsSync(WA_AUTH_DIR)) {
    fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
  }
}

function teardownSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (activeSocket) {
    try {
      activeSocket.ev.removeAllListeners('connection.update');
      activeSocket.ev.removeAllListeners('creds.update');
      activeSocket.end(undefined);
    } catch {
      // ignore close errors
    }
    activeSocket = null;
  }
}

function inferCountryPrefix(workshopWhatsapp?: string): string {
  const digits = (workshopWhatsapp || '').replace(/[^0-9]/g, '');
  if (digits.length >= 11) {
    if (digits.startsWith('521')) return '521';
    if (digits.startsWith('52')) return '52';
    if (digits.startsWith('57')) return '57';
    if (digits.startsWith('51')) return '51';
    if (digits.startsWith('56')) return '56';
    if (digits.startsWith('54')) return '54';
    if (digits.startsWith('34')) return '34';
    if (digits.startsWith('1')) return '1';
  }
  return '52';
}

function formatDestinationDigits(rawPhone: string, workshopWhatsapp?: string): string {
  const digits = rawPhone.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.length === 10) {
    return `${inferCountryPrefix(workshopWhatsapp)}${digits}`;
  }
  return digits;
}

async function openBaileysSocket(options: {
  pairingPhone?: string;
}): Promise<WhatsAppSessionState> {
  if (isConnecting) {
    return sessionState;
  }
  isConnecting = true;
  teardownSocket();
  ensureAuthDir();

  updateState({
    status: 'connecting',
    qrDataUrl: null,
    pairingCode: null,
    lastError: null,
  });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(WA_AUTH_DIR);
    let version: [number, number, number] = [2, 3000, 1015901307];
    try {
      const latest = await fetchLatestBaileysVersion();
      if (latest?.version) {
        version = latest.version;
      }
    } catch {
      // fallback version
    }

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: Browsers.macOS('Teknovant Labs'),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 45_000,
    });

    activeSocket = sock;
    sock.ev.on('creds.update', saveCreds);

    let pairingRequested = false;

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !options.pairingPhone) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, {
            width: 300,
            margin: 2,
            color: {
              dark: '#050b18',
              light: '#ffffff',
            },
          });
          updateState({
            status: 'qr_ready',
            qrDataUrl,
            pairingCode: null,
            lastError: null,
          });
        } catch {
          updateState({
            status: 'error',
            lastError: 'No se pudo generar la imagen del código QR.',
          });
        }
      }

      if (
        options.pairingPhone &&
        !pairingRequested &&
        !sock.authState.creds.registered &&
        (qr || connection === 'connecting')
      ) {
        pairingRequested = true;
        try {
          const cleanPairingPhone = options.pairingPhone.replace(/[^0-9]/g, '');
          const rawCode = await sock.requestPairingCode(cleanPairingPhone);
          const formattedCode =
            rawCode && rawCode.length === 8
              ? `${rawCode.slice(0, 4)}-${rawCode.slice(4)}`
              : rawCode;
          updateState({
            status: 'pairing_code_ready',
            pairingCode: formattedCode,
            qrDataUrl: null,
            lastError: null,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Error generando código de vinculación.';
          updateState({
            status: 'error',
            lastError: msg,
          });
        }
      }

      if (connection === 'open') {
        const jid = sock.user?.id || '';
        const phone = jid.split(':')[0]?.split('@')[0] || '';
        updateState({
          status: 'connected',
          qrDataUrl: null,
          pairingCode: null,
          connectedPhone: phone ? `+${phone}` : null,
          connectedName: sock.user?.name || 'WhatsApp Vinculado',
          lastError: null,
        });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
          ?.output?.statusCode;
        const shouldLogout =
          statusCode === DisconnectReason.loggedOut ||
          statusCode === 401 ||
          statusCode === 403;

        if (shouldLogout) {
          teardownSocket();
          clearAuthDir();
          updateState({
            status: 'disconnected',
            qrDataUrl: null,
            pairingCode: null,
            connectedPhone: null,
            connectedName: null,
            lastError: 'La sesión de WhatsApp fue cerrada o desvinculada desde el teléfono.',
          });
        } else if (statusCode === DisconnectReason.restartRequired || statusCode === 515 || sock.authState.creds.registered) {
          teardownSocket();
          updateState({
            status: 'connecting',
            lastError: null,
          });
          reconnectTimer = setTimeout(() => {
            openBaileysSocket({}).catch(() => {});
          }, 1500);
        } else {
          teardownSocket();
          updateState({
            status: 'disconnected',
            qrDataUrl: null,
            pairingCode: null,
            lastError: 'Conexión cerrada con WhatsApp Web. Intenta vincular nuevamente.',
          });
        }
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo iniciar la sesión de WhatsApp.';
    updateState({
      status: 'error',
      lastError: msg,
    });
  } finally {
    isConnecting = false;
  }

  return sessionState;
}

export async function startWhatsAppQRSession(): Promise<WhatsAppSessionState> {
  // If previously errored or stale creds without registration, reset auth dir cleanly
  const credsPath = path.join(WA_AUTH_DIR, 'creds.json');
  if (sessionState.status !== 'connected' && fs.existsSync(credsPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
      if (!parsed?.registered) {
        clearAuthDir();
      }
    } catch {
      clearAuthDir();
    }
  }
  return openBaileysSocket({});
}

export async function startWhatsAppPairingSession(
  phone: string
): Promise<WhatsAppSessionState> {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length < 10) {
    throw new Error('Ingresa el número completo de WhatsApp con código de país (mínimo 10 dígitos).');
  }
  clearAuthDir();
  return openBaileysSocket({ pairingPhone: digits });
}

export async function logoutWhatsAppSession(): Promise<WhatsAppSessionState> {
  if (activeSocket) {
    try {
      await activeSocket.logout();
    } catch {
      // ignore if already closed
    }
  }
  teardownSocket();
  clearAuthDir();
  updateState({
    status: 'disconnected',
    qrDataUrl: null,
    pairingCode: null,
    connectedPhone: null,
    connectedName: null,
    lastError: null,
  });
  return sessionState;
}

export function initWhatsAppIfLinked() {
  const credsFile = path.join(WA_AUTH_DIR, 'creds.json');
  if (fs.existsSync(credsFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(credsFile, 'utf-8'));
      if (parsed?.registered) {
        openBaileysSocket({}).catch(() => {});
      }
    } catch {
      // ignore corrupted auth file
    }
  }
}

export async function sendWhatsAppDirectMessage(params: {
  toPhone: string;
  clientName: string;
  message: string;
  category: 'cotizacion' | 'factura' | 'seguimiento' | 'manual';
  referenceNumber?: string;
  workshopWhatsapp?: string;
}): Promise<WhatsAppDispatchLog> {
  const cleanDigits = formatDestinationDigits(params.toPhone, params.workshopWhatsapp);
  if (!cleanDigits || cleanDigits.length < 10) {
    throw new Error('El teléfono del cliente no es válido para enviar por WhatsApp.');
  }

  const trimmedMessage = params.message.trim();
  if (!trimmedMessage) {
    throw new Error('El mensaje de WhatsApp no puede estar vacío.');
  }
  if (trimmedMessage.length > 4096) {
    throw new Error('El mensaje excede el límite permitido de 4096 caracteres.');
  }

  if (sessionState.status !== 'connected' || !activeSocket) {
    throw new Error('WhatsApp no está conectado. Inicia sesión con código QR en el apartado de WhatsApp primero.');
  }

  let targetJid = `${cleanDigits}@s.whatsapp.net`;
  try {
    const check = await activeSocket.onWhatsApp(cleanDigits);
    if (Array.isArray(check) && check[0]?.exists && check[0]?.jid) {
      targetJid = check[0].jid;
    }
  } catch {
    // fallback to default JID if onWhatsApp lookup fails
  }

  const logBase: WhatsAppDispatchLog = {
    id: `wa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    toPhone: `+${cleanDigits}`,
    clientName: params.clientName || 'Cliente',
    category: params.category,
    referenceNumber: params.referenceNumber,
    messagePreview: trimmedMessage.slice(0, 140),
    status: 'sent',
    sentAt: new Date().toISOString(),
  };

  try {
    await activeSocket.sendMessage(targetJid, { text: trimmedMessage });
    dispatchLogs.unshift(logBase);
    if (dispatchLogs.length > 50) dispatchLogs.length = 50;
    return logBase;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'No se pudo enviar el mensaje por WhatsApp.';
    const failedLog: WhatsAppDispatchLog = {
      ...logBase,
      status: 'failed',
      error: errMsg,
    };
    dispatchLogs.unshift(failedLog);
    if (dispatchLogs.length > 50) dispatchLogs.length = 50;
    throw new Error(errMsg);
  }
}
