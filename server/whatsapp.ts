import fs from 'fs';
import path from 'path';
import pino from 'pino';
import QRCode from 'qrcode';
import makeWASocket, {
  BufferJSON,
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidBroadcast,
  makeCacheableSignalKeyStore,
  proto,
  useMultiFileAuthState,
  type PossiblyExtendedCacheStore,
  type WASocket,
} from '@whiskeysockets/baileys';
import type {
  WhatsAppDispatchLog,
  WhatsAppSessionState,
} from '../src/types/workshop.ts';
import {
  appendWhatsAppMessageLog,
  clearWhatsAppMessageLogs,
  deleteWhatsAppMessageLog,
  getWhatsAppMessageLogs,
  loadDB,
  normalizePhone,
  updateWhatsAppMessageLogByExternalId,
} from './store.ts';

const WA_AUTH_DIR = process.env.TEKNOVANT_DATA_DIR
  ? path.join(path.resolve(process.env.TEKNOVANT_DATA_DIR), 'whatsapp-auth')
  : path.resolve(process.cwd(), 'data', 'whatsapp-auth');

const SENT_MESSAGES_FILE = () => path.join(WA_AUTH_DIR, 'sent-messages-cache.json');
const V7_CLEAN_MARKER_FILE = () => path.join(WA_AUTH_DIR, 'v7-sessions-cleaned.json');

let activeSocket: WASocket | null = null;
let isConnecting = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let activeAckListener: ((node: { attrs?: Record<string, string> }) => void) | null = null;

let sessionState: WhatsAppSessionState = {
  status: 'disconnected',
  qrDataUrl: null,
  pairingCode: null,
  connectedPhone: null,
  connectedName: null,
  lastError: null,
  updatedAt: new Date().toISOString(),
};

const logByMsgId = new Map<string, WhatsAppDispatchLog>();
const sentMessageStore = new Map<string, proto.IMessage>();
const recentWaErrors: string[] = [];

interface AckRecord {
  error?: string;
  ok: boolean;
  deliveryStatus?: 'server_ack' | 'delivered' | 'read' | 'failed';
  at: number;
}

const recentMessageAcks = new Map<string, AckRecord>();
const ackWaiters = new Map<string, (ack: AckRecord) => void>();

let sentCacheLoaded = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function recordRecentWaError(detail: string) {
  if (!detail) return;
  recentWaErrors.push(detail);
  if (recentWaErrors.length > 25) {
    recentWaErrors.shift();
  }
}

const waLogStream = {
  write(chunk: string) {
    try {
      const parsed = JSON.parse(chunk) as {
        level?: number;
        msg?: string;
        err?: { message?: string };
        error?: { message?: string };
      };
      const msg = String(parsed.msg || '');
      if (
        msg.includes('Bad MAC') ||
        msg.includes('Failed to decrypt message with any known session') ||
        msg.includes('Closing stale open session')
      ) {
        return;
      }
      if ((parsed.level || 0) >= 40) {
        const errDetail = parsed.err?.message || parsed.error?.message;
        const combined = errDetail ? `${msg}: ${errDetail}` : msg;
        if (combined) {
          recordRecentWaError(combined);
          console.warn('[WhatsApp]', combined);
        }
      }
    } catch {
      // ignore non-JSON log lines
    }
  },
};

function loadSentMessageStore() {
  if (sentCacheLoaded) return;
  sentCacheLoaded = true;
  try {
    const filePath = SENT_MESSAGES_FILE();
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw, BufferJSON.reviver) as Record<string, proto.IMessage>;
    if (parsed && typeof parsed === 'object') {
      for (const [id, msg] of Object.entries(parsed)) {
        if (id && msg) {
          sentMessageStore.set(id, proto.Message.fromObject(msg));
        }
      }
    }
  } catch {
    // ignore corrupted sent message cache
  }
}

function schedulePersistSentMessages() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      ensureAuthDir();
      const entries = Array.from(sentMessageStore.entries()).slice(-200);
      const obj = Object.fromEntries(entries);
      fs.writeFileSync(SENT_MESSAGES_FILE(), JSON.stringify(obj, BufferJSON.replacer));
    } catch {
      // ignore disk write failure for non-critical retry cache
    }
  }, 300);
}

function storeSentMessage(id: string | null | undefined, message: proto.IMessage | null | undefined) {
  if (!id || !message) return;
  sentMessageStore.set(id, message);
  if (sentMessageStore.size > 300) {
    const oldestKey = sentMessageStore.keys().next().value;
    if (oldestKey) sentMessageStore.delete(oldestKey);
  }
  schedulePersistSentMessages();
}

function createMemoryCache(maxEntries = 1000, ttlMs = 5 * 60 * 1000): PossiblyExtendedCacheStore {
  const map = new Map<string, { value: unknown; expiresAt: number }>();

  const getSync = <T>(key: string): T | undefined => {
    const entry = map.get(key);
    if (!entry) return undefined;
    if (ttlMs > 0 && Date.now() > entry.expiresAt) {
      map.delete(key);
      return undefined;
    }
    return entry.value as T;
  };

  const setSync = <T>(key: string, value: T): void => {
    map.set(key, {
      value,
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : Number.MAX_SAFE_INTEGER,
    });
    if (map.size > maxEntries) {
      const oldestKey = map.keys().next().value;
      if (oldestKey) map.delete(oldestKey);
    }
  };

  return {
    get<T>(key: string): T | undefined {
      return getSync<T>(key);
    },
    async mget<T>(keys: string[]): Promise<Record<string, T | undefined>> {
      const out: Record<string, T | undefined> = {};
      for (const key of keys) {
        const val = getSync<T>(key);
        if (val !== undefined) {
          out[key] = val;
        }
      }
      return out;
    },
    set<T>(key: string, value: T): void {
      setSync(key, value);
    },
    mset<T>(entries: Array<{ key: string; value: T }>): void {
      for (const entry of entries) {
        setSync(entry.key, entry.value);
      }
    },
    del(key: string): void {
      map.delete(key);
    },
    flushAll(): void {
      map.clear();
    },
  };
}

const msgRetryCounterCache = createMemoryCache(1000, 60 * 60 * 1000);
const userDevicesCache = createMemoryCache(1000, 5 * 60 * 1000);

function recordAck(
  msgId: string,
  patch: { error?: string; ok: boolean; deliveryStatus?: AckRecord['deliveryStatus'] }
) {
  const prev = recentMessageAcks.get(msgId);
  const ack: AckRecord = {
    error: patch.error,
    ok: patch.ok,
    deliveryStatus: patch.deliveryStatus || prev?.deliveryStatus,
    at: Date.now(),
  };
  recentMessageAcks.set(msgId, ack);
  if (recentMessageAcks.size > 400) {
    const oldestKey = recentMessageAcks.keys().next().value;
    if (oldestKey) recentMessageAcks.delete(oldestKey);
  }
  const waiter = ackWaiters.get(msgId);
  if (waiter && (!ack.ok || ack.deliveryStatus === 'delivered' || ack.deliveryStatus === 'read')) {
    ackWaiters.delete(msgId);
    waiter(ack);
  }
}

function waitForDeliveryOutcome(
  msgId: string | null | undefined,
  timeoutMs = 4500
): Promise<{
  error?: string;
  ok: boolean;
  deliveryStatus?: 'server_ack' | 'delivered' | 'read' | 'failed';
}> {
  if (!msgId) return Promise.resolve({ ok: true, deliveryStatus: 'server_ack' });
  const existing = recentMessageAcks.get(msgId);
  if (existing && (!existing.ok || existing.deliveryStatus === 'delivered' || existing.deliveryStatus === 'read')) {
    return Promise.resolve(existing);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      ackWaiters.delete(msgId);
      const latest = recentMessageAcks.get(msgId);
      if (latest) {
        resolve(latest);
      } else {
        resolve({ ok: true, deliveryStatus: 'server_ack' });
      }
    }, timeoutMs);
    ackWaiters.set(msgId, (ack) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

function formatWhatsAppAckError(code: string): string {
  switch (code) {
    case '463':
      return 'WhatsApp bloqueó temporalmente el envío (código 463: cuenta restringida o falta interacción previa). Inicia el chat desde tu teléfono o usa el enlace de WhatsApp Web.';
    case '420':
    case '479':
      return `WhatsApp rechazó la sesión o formato del destinatario (código ${code}). Pulsa "Reparar Cifrado Signal" o verifica el número con código de país.`;
    case '405':
    case '406':
      return `No se pudo entregar el mensaje al destinatario (código ${code}). Verifica que el número tenga WhatsApp activo.`;
    default:
      return `WhatsApp devolvió un error de entrega (código ${code}). Si persiste, pulsa "Reparar Cifrado Signal" o vuelve a vincular tu sesión.`;
  }
}

// libsignal logs expected transient Signal key-rotation retries directly via console.error
// even though Baileys handles retry receipts automatically. Suppress only those known
// transient Signal messages so they do not pollute server stderr.
const originalConsoleError = console.error.bind(console);
let libsignalFilterInstalled = false;
function installLibsignalNoiseFilter() {
  if (libsignalFilterInstalled) return;
  libsignalFilterInstalled = true;
  console.error = (...args: unknown[]) => {
    const first = typeof args[0] === 'string' ? args[0] : '';
    if (
      first.startsWith('Failed to decrypt message with any known session') ||
      (first.startsWith('Session error:') && first.includes('Bad MAC'))
    ) {
      return;
    }
    originalConsoleError(...args);
  };
}

type StatusListener = (state: WhatsAppSessionState) => void;
const listeners = new Set<StatusListener>();

export function subscribeWhatsAppStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitStatusUpdate() {
  const snapshot = { ...sessionState };
  for (const fn of listeners) {
    try {
      fn(snapshot);
    } catch {
      // ignore listener errors
    }
  }
}

function updateState(patch: Partial<WhatsAppSessionState>) {
  sessionState = {
    ...sessionState,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  emitStatusUpdate();
}

export function getWhatsAppStatus(): {
  session: WhatsAppSessionState;
  logs: WhatsAppDispatchLog[];
} {
  return {
    session: { ...sessionState },
    logs: getWhatsAppMessageLogs().slice(0, 250),
  };
}

export function removeWhatsAppHistoryEntry(logId: string): WhatsAppDispatchLog[] {
  const updated = deleteWhatsAppMessageLog(logId);
  emitStatusUpdate();
  return updated.slice(0, 250);
}

export function wipeWhatsAppHistory(): WhatsAppDispatchLog[] {
  const updated = clearWhatsAppMessageLogs();
  logByMsgId.clear();
  emitStatusUpdate();
  return updated;
}

function ensureAuthDir() {
  if (!fs.existsSync(WA_AUTH_DIR)) {
    fs.mkdirSync(WA_AUTH_DIR, { recursive: true });
  }
}

function clearAuthDir() {
  sentMessageStore.clear();
  sentCacheLoaded = false;
  if (fs.existsSync(WA_AUTH_DIR)) {
    fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
  }
}

function purgeSignalSessionFiles(options?: { keepMarker?: boolean }) {
  if (!fs.existsSync(WA_AUTH_DIR)) return 0;
  let removed = 0;
  const files = fs.readdirSync(WA_AUTH_DIR);
  for (const file of files) {
    if (
      file.startsWith('session-') ||
      file.startsWith('device-list-') ||
      file.startsWith('tctoken-')
    ) {
      try {
        fs.unlinkSync(path.join(WA_AUTH_DIR, file));
        removed += 1;
      } catch {
        // ignore single file errors
      }
    }
  }
  if (!options?.keepMarker) {
    try {
      fs.writeFileSync(
        V7_CLEAN_MARKER_FILE(),
        JSON.stringify({ cleanedAt: new Date().toISOString(), removed })
      );
    } catch {
      // ignore marker write errors
    }
  }
  return removed;
}

function cleanupLegacyV6SessionsIfNeeded() {
  if (!fs.existsSync(WA_AUTH_DIR)) return;
  const marker = V7_CLEAN_MARKER_FILE();
  if (fs.existsSync(marker)) return;
  const credsPath = path.join(WA_AUTH_DIR, 'creds.json');
  if (fs.existsSync(credsPath)) {
    purgeSignalSessionFiles();
  }
}

function isCredsLinked(creds: { registered?: boolean; me?: { id?: string } } | null | undefined): boolean {
  return Boolean(creds?.registered || creds?.me?.id);
}

function teardownSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (activeSocket) {
    try {
      if (activeAckListener) {
        activeSocket.ws.off('CB:ack,class:message', activeAckListener);
        activeAckListener = null;
      }
      activeSocket.ev.removeAllListeners('connection.update');
      activeSocket.ev.removeAllListeners('creds.update');
      activeSocket.ev.removeAllListeners('messages.upsert');
      activeSocket.ev.removeAllListeners('messages.update');
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

function resolveKnownClientName(rawPhone: string, fallbackName?: string | null): string {
  const targetNorm = normalizePhone(rawPhone);
  if (targetNorm) {
    try {
      const db = loadDB();
      const orderMatch = db.orders.find((o) => normalizePhone(o.clientPhone) === targetNorm);
      if (orderMatch?.clientName) return orderMatch.clientName;
      const quoteMatch = db.quotes.find((q) => normalizePhone(q.clientPhone) === targetNorm);
      if (quoteMatch?.clientName) return quoteMatch.clientName;
      const invMatch = db.invoices.find((i) => normalizePhone(i.clientPhone) === targetNorm);
      if (invMatch?.clientName) return invMatch.clientName;
    } catch {
      // ignore DB lookup error
    }
  }
  return fallbackName?.trim() || 'Cliente WhatsApp';
}

function extractInboundText(msg: proto.IWebMessageInfo): string {
  const m = msg.message;
  if (!m) return '';
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    ''
  ).trim();
}

async function openBaileysSocket(options: {
  pairingPhone?: string;
}): Promise<WhatsAppSessionState> {
  if (isConnecting) {
    return { ...sessionState };
  }
  isConnecting = true;
  teardownSocket();
  ensureAuthDir();
  cleanupLegacyV6SessionsIfNeeded();
  loadSentMessageStore();

  updateState({
    status: 'connecting',
    qrDataUrl: null,
    pairingCode: null,
    lastError: null,
  });

  try {
    installLibsignalNoiseFilter();
    const { state, saveCreds } = await useMultiFileAuthState(WA_AUTH_DIR);
    const waLogger = pino({ level: 'warn' }, waLogStream);
    let version: [number, number, number] = [2, 3000, 1043857760];
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
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, waLogger),
      },
      logger: waLogger,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: false,
      enableAutoSessionRecreation: true,
      enableRecentMessageCache: true,
      defaultQueryTimeoutMs: 60_000,
      connectTimeoutMs: 45_000,
      retryRequestDelayMs: 300,
      maxMsgRetryCount: 5,
      msgRetryCounterCache,
      userDevicesCache,
      shouldIgnoreJid: (jid) =>
        Boolean(
          !jid ||
            isJidBroadcast(jid) ||
            jid.endsWith('@newsletter') ||
            jid.endsWith('@g.us')
        ),
      getMessage: async (key) => {
        if (!key?.id) return undefined;
        return sentMessageStore.get(key.id);
      },
    });

    activeSocket = sock;
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      let inboundRecorded = false;
      for (const msg of messages) {
        if (msg.key?.id && msg.message) {
          storeSentMessage(msg.key.id, msg.message);
        }

        // Persist real-time 1:1 incoming customer replies in message history
        if (
          type === 'notify' &&
          msg.key &&
          !msg.key.fromMe &&
          msg.key.remoteJid &&
          !isJidBroadcast(msg.key.remoteJid) &&
          !msg.key.remoteJid.endsWith('@g.us') &&
          !msg.key.remoteJid.endsWith('@newsletter')
        ) {
          const text = extractInboundText(msg);
          if (!text) continue;

          const existingLogs = getWhatsAppMessageLogs();
          if (msg.key.id && existingLogs.some((item) => item.externalMessageId === msg.key.id)) {
            continue;
          }

          let senderDigits = msg.key.remoteJid.split('@')[0]?.split(':')[0] || '';
          if (msg.key.remoteJid.endsWith('@lid') && sock.signalRepository?.lidMapping) {
            try {
              const pn = await sock.signalRepository.lidMapping.getPNForLID(msg.key.remoteJid);
              if (pn) {
                senderDigits = pn.split('@')[0]?.split(':')[0] || senderDigits;
              }
            } catch {
              // keep LID digits fallback
            }
          }

          const formattedPhone = senderDigits ? `+${senderDigits}` : msg.key.remoteJid;
          const clientName = resolveKnownClientName(formattedPhone, msg.pushName);

          appendWhatsAppMessageLog({
            id: `wa-in-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            direction: 'inbound',
            toPhone: formattedPhone,
            clientName,
            category: 'entrante',
            messagePreview: text.slice(0, 140),
            fullMessage: text.slice(0, 4096),
            status: 'received',
            deliveryStatus: 'received',
            externalMessageId: msg.key.id || undefined,
            sentAt: msg.messageTimestamp
              ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
              : new Date().toISOString(),
          });
          inboundRecorded = true;
        }
      }
      if (inboundRecorded) {
        emitStatusUpdate();
      }
    });

    sock.ev.on('messages.update', (updates) => {
      let logsChanged = false;
      for (const item of updates) {
        const msgId = item.key?.id;
        if (!msgId) continue;
        const logEntry = logByMsgId.get(msgId);
        const st = item.update?.status;

        if (st === proto.WebMessageInfo.Status.ERROR) {
          const code = item.update.messageStubParameters?.[0] || 'desconocido';
          const formattedErr = formatWhatsAppAckError(code);
          recordAck(msgId, { ok: false, error: code, deliveryStatus: 'failed' });
          if (logEntry) {
            logEntry.status = 'failed';
            logEntry.deliveryStatus = 'failed';
            logEntry.error = formattedErr;
          }
          if (
            updateWhatsAppMessageLogByExternalId(msgId, {
              status: 'failed',
              deliveryStatus: 'failed',
              error: formattedErr,
            })
          ) {
            logsChanged = true;
          }
        } else if (st === proto.WebMessageInfo.Status.DELIVERY_ACK) {
          recordAck(msgId, { ok: true, deliveryStatus: 'delivered' });
          if (logEntry && logEntry.status === 'sent' && logEntry.deliveryStatus !== 'read') {
            logEntry.deliveryStatus = 'delivered';
          }
          if (
            updateWhatsAppMessageLogByExternalId(msgId, {
              deliveryStatus: 'delivered',
            })
          ) {
            logsChanged = true;
          }
        } else if (
          st === proto.WebMessageInfo.Status.READ ||
          st === proto.WebMessageInfo.Status.PLAYED
        ) {
          recordAck(msgId, { ok: true, deliveryStatus: 'read' });
          if (logEntry && logEntry.status === 'sent') {
            logEntry.deliveryStatus = 'read';
          }
          if (
            updateWhatsAppMessageLogByExternalId(msgId, {
              deliveryStatus: 'read',
            })
          ) {
            logsChanged = true;
          }
        } else if (st === proto.WebMessageInfo.Status.SERVER_ACK) {
          recordAck(msgId, { ok: true, deliveryStatus: 'server_ack' });
          if (logEntry && !logEntry.deliveryStatus) {
            logEntry.deliveryStatus = 'server_ack';
          }
        }
      }
      if (logsChanged) {
        emitStatusUpdate();
      }
    });

    activeAckListener = (node: { attrs?: Record<string, string> }) => {
      const msgId = node?.attrs?.id;
      if (!msgId) return;
      const errCode = node?.attrs?.error ? String(node.attrs.error) : undefined;
      if (errCode) {
        recordAck(msgId, { ok: false, error: errCode, deliveryStatus: 'failed' });
      } else {
        recordAck(msgId, { ok: true, deliveryStatus: 'server_ack' });
      }
    };
    sock.ws.on('CB:ack,class:message', activeAckListener);

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
        !isCredsLinked(sock.authState.creds) &&
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
        const lid = sock.user?.lid || '';
        const phone = jid.split(':')[0]?.split('@')[0] || '';
        if (jid && lid && sock.signalRepository?.lidMapping) {
          sock.signalRepository.lidMapping
            .storeLIDPNMappings([{ pn: jid, lid }])
            .catch(() => {});
        }
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
        } else if (
          statusCode === DisconnectReason.restartRequired ||
          statusCode === 515 ||
          isCredsLinked(sock.authState.creds)
        ) {
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

  return { ...sessionState };
}

export async function startWhatsAppQRSession(): Promise<WhatsAppSessionState> {
  const credsPath = path.join(WA_AUTH_DIR, 'creds.json');
  if (sessionState.status !== 'connected' && fs.existsSync(credsPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
      if (!isCredsLinked(parsed)) {
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

export async function repairWhatsAppSignalSessions(): Promise<WhatsAppSessionState> {
  teardownSocket();
  userDevicesCache.flushAll();
  msgRetryCounterCache.flushAll();
  sentMessageStore.clear();
  sentCacheLoaded = false;
  purgeSignalSessionFiles();

  const credsFile = path.join(WA_AUTH_DIR, 'creds.json');
  if (fs.existsSync(credsFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(credsFile, 'utf-8'));
      if (isCredsLinked(parsed)) {
        return openBaileysSocket({});
      }
    } catch {
      // ignore unreadable creds
    }
  }
  updateState({
    status: 'disconnected',
    lastError: null,
  });
  return { ...sessionState };
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
  return { ...sessionState };
}

export function initWhatsAppIfLinked() {
  const credsFile = path.join(WA_AUTH_DIR, 'creds.json');
  if (fs.existsSync(credsFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(credsFile, 'utf-8'));
      if (isCredsLinked(parsed)) {
        openBaileysSocket({}).catch(() => {});
      }
    } catch {
      // ignore corrupted auth file
    }
  }
}

async function resolveDeliverableTarget(
  sock: WASocket,
  cleanDigits: string
): Promise<{ targetJid: string; recipientDeviceJids: string[] }> {
  const ownPnUser = sock.authState.creds.me?.id?.split(':')[0]?.split('@')[0] || '';
  const ownLidUser = sock.authState.creds.me?.lid?.split(':')[0]?.split('@')[0] || '';

  const candidateDigits = [cleanDigits];
  if (cleanDigits.startsWith('52') && !cleanDigits.startsWith('521') && cleanDigits.length === 12) {
    candidateDigits.push(`521${cleanDigits.slice(2)}`);
  } else if (cleanDigits.startsWith('521') && cleanDigits.length === 13) {
    candidateDigits.push(`52${cleanDigits.slice(3)}`);
  }

  const candidateJids: string[] = [];
  const addCandidateJid = (jid: string | undefined | null) => {
    if (!jid) return;
    if (!candidateJids.includes(jid)) {
      candidateJids.push(jid);
    }
  };

  try {
    const check = await sock.onWhatsApp(...candidateDigits);
    if (Array.isArray(check)) {
      for (const entry of check) {
        if (entry?.exists && entry?.jid) {
          addCandidateJid(entry.jid);
        }
      }
    }
  } catch {
    // proceed with raw candidate JIDs if onWhatsApp fails
  }

  for (const digits of candidateDigits) {
    addCandidateJid(`${digits}@s.whatsapp.net`);
  }

  const isSelfTarget = candidateDigits.some(
    (d) => (ownPnUser && d === ownPnUser) || (ownLidUser && d === ownLidUser)
  );

  if (isSelfTarget) {
    const selfJid = `${cleanDigits}@s.whatsapp.net`;
    const devices = await sock.getUSyncDevices([selfJid], false, false).catch(() => []);
    return {
      targetJid: selfJid,
      recipientDeviceJids: devices.map((d) => d.jid).filter(Boolean),
    };
  }

  const isExternalDevice = (user: string) =>
    Boolean(user) && user !== ownPnUser && (!ownLidUser || user !== ownLidUser);

  for (const candidateJid of candidateJids) {
    const candUser = candidateJid.split('@')[0]?.split(':')[0];
    if (candUser) {
      userDevicesCache.del(candUser);
    }

    const pnDevices = await sock.getUSyncDevices([candidateJid], false, false).catch(() => []);
    const externalPnDevices = pnDevices.filter((d) => isExternalDevice(d.user));
    if (externalPnDevices.length > 0) {
      return {
        targetJid: candidateJid,
        recipientDeviceJids: externalPnDevices.map((d) => d.jid),
      };
    }

    // Fallback: check mapped LID directly in case USync devices only resolved on LID
    const mappedLid = await sock.signalRepository?.lidMapping
      ?.getLIDForPN(candidateJid)
      .catch(() => null);
    if (mappedLid) {
      const lidUser = mappedLid.split('@')[0]?.split(':')[0];
      if (lidUser) userDevicesCache.del(lidUser);
      const lidDevices = await sock.getUSyncDevices([mappedLid], false, false).catch(() => []);
      const externalLidDevices = lidDevices.filter((d) => isExternalDevice(d.user));
      if (externalLidDevices.length > 0) {
        return {
          targetJid: mappedLid,
          recipientDeviceJids: externalLidDevices.map((d) => d.jid),
        };
      }
    }
  }

  throw new Error(
    `WhatsApp no devolvió dispositivos activos para el número +${cleanDigits}. Verifica que el número tenga WhatsApp activo e incluya código de país (ej. +521... o +52...).`
  );
}

async function sendViaBaileys(
  cleanDigits: string,
  messageText: string,
  logBase: WhatsAppDispatchLog
): Promise<{ externalMessageId?: string; deliveryStatus: 'server_ack' | 'delivered' | 'read' }> {
  if (sessionState.status !== 'connected' || !activeSocket) {
    throw new Error(
      'La sesión de WhatsApp no está conectada. Escanea el código QR o vincula tu número en el panel izquierdo.'
    );
  }

  const sock = activeSocket;
  const errCountBefore = recentWaErrors.length;
  const { targetJid, recipientDeviceJids } = await resolveDeliverableTarget(sock, cleanDigits);

  const mappedLid = targetJid.endsWith('@lid')
    ? targetJid
    : await sock.signalRepository?.lidMapping?.getLIDForPN(targetJid).catch(() => null);

  const sessionTargets = Array.from(
    new Set([targetJid, ...recipientDeviceJids, ...(mappedLid ? [mappedLid] : [])])
  );

  try {
    await sock.assertSessions(sessionTargets, false);
  } catch {
    // continue and allow retry with force=true if needed
  }

  let sent;
  try {
    sent = await sock.sendMessage(targetJid, { text: messageText });
  } catch {
    const targetUser = targetJid.split('@')[0]?.split(':')[0];
    if (targetUser) userDevicesCache.del(targetUser);
    await sock.assertSessions(sessionTargets, true).catch(() => {});
    sent = await sock.sendMessage(targetJid, { text: messageText });
  }

  const msgId = sent?.key?.id;
  if (msgId && sent?.message) {
    logBase.externalMessageId = msgId;
    storeSentMessage(msgId, sent.message);
    logByMsgId.set(msgId, logBase);
    if (logByMsgId.size > 200) {
      const oldestKey = logByMsgId.keys().next().value;
      if (oldestKey) logByMsgId.delete(oldestKey);
    }
  }

  const ackResult = await waitForDeliveryOutcome(msgId, 4500);
  if (!ackResult.ok && ackResult.error) {
    // On recipient session error codes (420/479), force-refresh Signal sessions and retry once
    if (ackResult.error === '420' || ackResult.error === '479') {
      const targetUser = targetJid.split('@')[0]?.split(':')[0];
      if (targetUser) userDevicesCache.del(targetUser);
      await sock.assertSessions(sessionTargets, true).catch(() => {});
      const retrySent = await sock.sendMessage(targetJid, { text: messageText });
      const retryId = retrySent?.key?.id;
      if (retryId && retrySent?.message) {
        logBase.externalMessageId = retryId;
        storeSentMessage(retryId, retrySent.message);
        logByMsgId.set(retryId, logBase);
      }
      const retryAck = await waitForDeliveryOutcome(retryId, 4500);
      if (!retryAck.ok && retryAck.error) {
        throw new Error(formatWhatsAppAckError(retryAck.error));
      }
      const latestRetryAck = retryId ? recentMessageAcks.get(retryId) : undefined;
      const finalRetryStatus = latestRetryAck?.deliveryStatus || retryAck.deliveryStatus;
      return {
        externalMessageId: retryId || undefined,
        deliveryStatus:
          finalRetryStatus === 'delivered' || finalRetryStatus === 'read'
            ? finalRetryStatus
            : 'server_ack',
      };
    }

    const newErrors = recentWaErrors.slice(errCountBefore);
    const extraHint = newErrors.length > 0 ? ` (${newErrors[newErrors.length - 1]})` : '';
    throw new Error(`${formatWhatsAppAckError(ackResult.error)}${extraHint}`);
  }

  const latestAck = msgId ? recentMessageAcks.get(msgId) : undefined;
  const finalStatus = latestAck?.deliveryStatus || ackResult.deliveryStatus;

  return {
    externalMessageId: msgId || undefined,
    deliveryStatus:
      finalStatus === 'delivered' || finalStatus === 'read' ? finalStatus : 'server_ack',
  };
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
    throw new Error(
      'La sesión de WhatsApp no está conectada. Vincula tu WhatsApp por QR o número en el apartado de WhatsApp.'
    );
  }

  const logBase: WhatsAppDispatchLog = {
    id: `wa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    direction: 'outbound',
    toPhone: `+${cleanDigits}`,
    clientName: params.clientName || 'Cliente',
    category: params.category,
    referenceNumber: params.referenceNumber,
    messagePreview: trimmedMessage.slice(0, 140),
    fullMessage: trimmedMessage,
    status: 'sent',
    deliveryStatus: 'server_ack',
    sentAt: new Date().toISOString(),
  };

  try {
    const result = await sendViaBaileys(cleanDigits, trimmedMessage, logBase);
    logBase.externalMessageId = result.externalMessageId;
    logBase.deliveryStatus = result.deliveryStatus;

    appendWhatsAppMessageLog(logBase);
    if (logBase.externalMessageId) {
      const latest = recentMessageAcks.get(logBase.externalMessageId);
      if (latest?.deliveryStatus === 'delivered' || latest?.deliveryStatus === 'read') {
        logBase.deliveryStatus = latest.deliveryStatus;
        updateWhatsAppMessageLogByExternalId(logBase.externalMessageId, {
          deliveryStatus: latest.deliveryStatus,
        });
      }
    }
    emitStatusUpdate();
    return logBase;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'No se pudo enviar el mensaje por WhatsApp.';
    const failedLog: WhatsAppDispatchLog = {
      ...logBase,
      status: 'failed',
      deliveryStatus: 'failed',
      error: errMsg,
    };
    appendWhatsAppMessageLog(failedLog);
    emitStatusUpdate();
    throw new Error(errMsg);
  }
}
