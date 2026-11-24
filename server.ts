import dotenv from 'dotenv';
import fs from 'fs';
import http from 'http';
import crypto from 'crypto';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const envCandidates = [
  process.env.TEKNOVANT_ENV_PATH,
  process.env.PORTABLE_EXECUTABLE_DIR
    ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, '.env')
    : null,
  path.join(process.cwd(), '.env'),
  process.env.APPDATA
    ? path.join(process.env.APPDATA, 'Teknovant Labs Taller', '.env')
    : null,
  process.env.APPDATA
    ? path.join(process.env.APPDATA, 'teknovant-labs-taller', '.env')
    : null,
].filter((p): p is string => Boolean(p));

for (const candidate of envCandidates) {
  try {
    if (!fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) continue;
    const parsed = dotenv.parse(fs.readFileSync(candidate));
    for (const [k, v] of Object.entries(parsed)) {
      const trimmed = typeof v === 'string' ? v.trim() : '';
      if (trimmed && (!process.env[k] || !process.env[k]!.trim())) {
        process.env[k] = trimmed;
      }
    }
  } catch {
    // Skip unreadable candidate
  }
}
import type {
  AuthUser,
  RepairOrder,
  Quote,
  Invoice,
  WorkshopSettings,
  MerchandiseItem,
  POSSale,
  ServiceItem,
  StatusNotification,
  WhatsAppSessionState,
} from './src/types/workshop.ts';
import {
  loadDB,
  saveDB,
  hashPassword,
  verifyPasswordHash,
  verifyClientAccess,
  getClientScopedData,
  addNotification,
  computeOrderTotal,
  getStatusDisplayLabel,
  isClientRecordMatch,
  resetServerDB,
} from './server/store.ts';
import {
  getWhatsAppStatus,
  startWhatsAppQRSession,
  startWhatsAppPairingSession,
  logoutWhatsAppSession,
  sendWhatsAppDirectMessage,
  subscribeWhatsAppStatus,
  initWhatsAppIfLinked,
} from './server/whatsapp.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '5mb' }));

// -------------------------------------------------------------------
// IN-MEMORY AUTH SESSION STORE (never exposed or persisted in localStorage)
// -------------------------------------------------------------------
interface SessionRecord {
  token: string;
  user: AuthUser;
  createdAt: number;
  expiresAt: number;
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const sessions = new Map<string, SessionRecord>();

function createSession(user: AuthUser): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  sessions.set(token, {
    token,
    user,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
  return token;
}

function getSessionFromToken(token: string | undefined | null): SessionRecord | null {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

interface AuthenticatedRequest extends Request {
  session?: SessionRecord;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  const session = getSessionFromToken(token);
  if (!session) {
    res.status(401).json({ error: 'Sesión inválida o expirada. Inicia sesión nuevamente.' });
    return;
  }
  req.session = session;
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.session?.user.role !== 'admin') {
      res.status(403).json({ error: 'Acceso restringido al Administrador del Taller.' });
      return;
    }
    next();
  });
}

// -------------------------------------------------------------------
// REAL-TIME WEBSOCKET HUB
// -------------------------------------------------------------------
interface SocketClientMeta {
  ws: WebSocket;
  user: AuthUser;
}

const wsClients = new Set<SocketClientMeta>();

function sendWsPayload(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastNotification(notification: StatusNotification) {
  for (const client of wsClients) {
    if (client.user.role === 'admin') {
      sendWsPayload(client.ws, { type: 'notification', notification });
    } else if (
      client.user.role === 'client' &&
      isClientRecordMatch(notification.clientPhone, undefined, client.user.phone, client.user.email)
    ) {
      sendWsPayload(client.ws, { type: 'notification', notification });
    }
  }
}

function broadcastWhatsAppStatus(whatsapp: WhatsAppSessionState) {
  for (const client of wsClients) {
    if (client.user.role === 'admin') {
      sendWsPayload(client.ws, { type: 'whatsapp:status', whatsapp });
    }
  }
}

function broadcastStateRefresh(affectedPhone?: string, affectedEmail?: string) {
  const db = loadDB();
  for (const client of wsClients) {
    if (client.user.role === 'admin') {
      sendWsPayload(client.ws, {
        type: 'admin:sync',
        data: {
          settings: db.settings,
          orders: db.orders,
          quotes: db.quotes,
          invoices: db.invoices,
          merchandise: db.merchandise,
          posSales: db.posSales,
          services: db.services,
          notifications: db.notifications,
        },
      });
    } else if (client.user.role === 'client') {
      if (
        (!affectedPhone && !affectedEmail) ||
        isClientRecordMatch(affectedPhone, affectedEmail, client.user.phone, client.user.email)
      ) {
        sendWsPayload(client.ws, {
          type: 'client:sync',
          data: getClientScopedData(db, client.user.phone, client.user.email),
        });
      }
    }
  }
}

// -------------------------------------------------------------------
// AI PROVIDERS (UNIVERSAL: GEMINI, GROQ, OPENAI, OPENROUTER, CLAUDE, DEEPSEEK, CUSTOM/OLLAMA)
// -------------------------------------------------------------------
type AIProviderId = 'gemini' | 'claude' | 'openai' | 'groq' | 'openrouter' | 'deepseek' | 'custom';

function getGeminiClient(useVertexAi = false) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if (useVertexAi) {
    return new GoogleGenAI({
      apiKey,
      vertexai: true,
    });
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function hasClaudeKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function hasGroqKey(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

function hasOpenRouterKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

function hasDeepSeekKey(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
}

function hasCustomAI(): boolean {
  return Boolean(process.env.CUSTOM_AI_BASE_URL?.trim());
}

function getAvailableAIProviders(): AIProviderId[] {
  const list: AIProviderId[] = [];
  if (hasGeminiKey()) list.push('gemini');
  if (hasGroqKey()) list.push('groq');
  if (hasOpenAIKey()) list.push('openai');
  if (hasOpenRouterKey()) list.push('openrouter');
  if (hasClaudeKey()) list.push('claude');
  if (hasDeepSeekKey()) list.push('deepseek');
  if (hasCustomAI()) list.push('custom');
  return list;
}

function getDefaultAIProvider(): AIProviderId | 'none' {
  const available = getAvailableAIProviders();
  if (available.length === 0) return 'none';
  const preferred = process.env.AI_PROVIDER?.trim().toLowerCase() as AIProviderId | undefined;
  if (preferred && available.includes(preferred)) return preferred;
  return available[0];
}

interface MarketQuoteRequest {
  query: string;
  category?: string;
  device?: string;
  region?: string;
  currency?: string;
  knownPartCost?: number | null;
  workshopName?: string;
  provider?: 'auto' | AIProviderId;
}

function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch && fenceMatch[1]) {
      try {
        return JSON.parse(fenceMatch[1].trim());
      } catch {
        // continue
      }
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('La respuesta del modelo no tuvo formato JSON válido.');
  }
}

async function callClaudeMarketQuote(
  systemInstruction: string,
  userPrompt: string
): Promise<{ rawText: string; modelUsed: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('No se encontró ANTHROPIC_API_KEY configurada en el servidor.');
  }

  const modelName = process.env.ANTHROPIC_MODEL?.trim() || 'claude-3-5-sonnet-latest';
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: 2048,
      system: systemInstruction,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    }),
  });

  const payload = (await response.json()) as {
    error?: { message?: string; type?: string };
    content?: Array<{ type: string; text?: string }>;
  };

  if (!response.ok) {
    const detail = payload.error?.message || `Error HTTP ${response.status} de Anthropic Claude`;
    throw new Error(`Claude API (${response.status}): ${detail}`);
  }

  const textBlock = payload.content?.find((c) => c.type === 'text' && c.text);
  if (!textBlock || !textBlock.text) {
    throw new Error('Claude no devolvió contenido de texto válido.');
  }

  return { rawText: textBlock.text, modelUsed: modelName };
}

async function callOpenAICompatibleMarketQuote(options: {
  providerLabel: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  systemInstruction: string;
  userPrompt: string;
  extraHeaders?: Record<string, string>;
}): Promise<{ rawText: string; modelUsed: string }> {
  const normalizedBase = options.baseUrl.replace(/\/+$/, '');
  const endpoint = normalizedBase.endsWith('/chat/completions')
    ? normalizedBase
    : `${normalizedBase}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.extraHeaders || {}),
  };
  if (options.apiKey && options.apiKey.trim()) {
    headers.Authorization = `Bearer ${options.apiKey.trim()}`;
  }

  const sendRequest = async (useJsonFormat: boolean) => {
    const body: Record<string, unknown> = {
      model: options.model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: options.systemInstruction },
        { role: 'user', content: options.userPrompt },
      ],
    };
    if (useJsonFormat) {
      body.response_format = { type: 'json_object' };
    }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; code?: string | number };
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    return { res, payload };
  };

  let { res, payload } = await sendRequest(true);
  if (!res.ok && res.status === 400) {
    // Some OpenAI-compatible / local Ollama models reject response_format
    ({ res, payload } = await sendRequest(false));
  }

  if (!res.ok) {
    const detail = payload.error?.message || `Error HTTP ${res.status} en ${options.providerLabel}`;
    throw new Error(`${options.providerLabel} (${res.status}): ${detail}`);
  }

  const rawText = payload.choices?.[0]?.message?.content;
  if (!rawText || !rawText.trim()) {
    throw new Error(`${options.providerLabel} no devolvió texto válido.`);
  }

  return { rawText, modelUsed: options.model };
}

async function callProviderMarketQuote(
  provider: AIProviderId,
  systemInstruction: string,
  userPrompt: string
): Promise<{
  rawText: string;
  modelUsed: string;
  sources: Array<{ title: string; url: string }>;
}> {
  if (provider === 'gemini') {
    return callGeminiMarketQuote(systemInstruction, userPrompt);
  }
  if (provider === 'claude') {
    const res = await callClaudeMarketQuote(systemInstruction, userPrompt);
    return { ...res, sources: [] };
  }
  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error('No se encontró OPENAI_API_KEY configurada.');
    const res = await callOpenAICompatibleMarketQuote({
      providerLabel: 'OpenAI',
      baseUrl: process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1',
      apiKey,
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
      systemInstruction,
      userPrompt,
    });
    return { ...res, sources: [] };
  }
  if (provider === 'groq') {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) throw new Error('No se encontró GROQ_API_KEY configurada.');
    const res = await callOpenAICompatibleMarketQuote({
      providerLabel: 'Groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey,
      model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
      systemInstruction,
      userPrompt,
    });
    return { ...res, sources: [] };
  }
  if (provider === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) throw new Error('No se encontró OPENROUTER_API_KEY configurada.');
    const res = await callOpenAICompatibleMarketQuote({
      providerLabel: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey,
      model: process.env.OPENROUTER_MODEL?.trim() || 'meta-llama/llama-3.3-70b-instruct:free',
      systemInstruction,
      userPrompt,
      extraHeaders: {
        'X-Title': 'Teknovant Labs Taller',
      },
    });
    return { ...res, sources: [] };
  }
  if (provider === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) throw new Error('No se encontró DEEPSEEK_API_KEY configurada.');
    const res = await callOpenAICompatibleMarketQuote({
      providerLabel: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey,
      model: process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat',
      systemInstruction,
      userPrompt,
    });
    return { ...res, sources: [] };
  }
  // custom (Ollama, LM Studio, Mistral, Together, any OpenAI-compatible endpoint)
  const customBaseUrl = process.env.CUSTOM_AI_BASE_URL?.trim();
  if (!customBaseUrl) {
    throw new Error('No se encontró CUSTOM_AI_BASE_URL configurada.');
  }
  const res = await callOpenAICompatibleMarketQuote({
    providerLabel: 'IA Personalizada',
    baseUrl: customBaseUrl,
    apiKey: process.env.CUSTOM_AI_API_KEY?.trim(),
    model: process.env.CUSTOM_AI_MODEL?.trim() || 'llama3.2',
    systemInstruction,
    userPrompt,
  });
  return { ...res, sources: [] };
}

function isQuotaOrRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('429') ||
    msg.toLowerCase().includes('quota') ||
    msg.toLowerCase().includes('rate limit')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CachedGeminiQuote {
  expiresAt: number;
  rawText: string;
  modelUsed: string;
  sources: Array<{ title: string; url: string }>;
}

const geminiQuoteCache = new Map<string, CachedGeminiQuote>();

async function callGeminiMarketQuote(
  systemInstruction: string,
  userPrompt: string
): Promise<{
  rawText: string;
  modelUsed: string;
  sources: Array<{ title: string; url: string }>;
}> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('No se encontró GEMINI_API_KEY configurada en el servidor.');
  }

  const cacheKey = crypto
    .createHash('sha256')
    .update(`${systemInstruction}::${userPrompt}`)
    .digest('hex');
  const cached = geminiQuoteCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      rawText: cached.rawText,
      modelUsed: cached.modelUsed,
      sources: cached.sources,
    };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim() || '';

  const attempts: Array<{
    model: string;
    useSearch: boolean;
    thinkingLevel?: ThinkingLevel;
    delayBeforeMs: number;
    useVertexAi?: boolean;
  }> = [
    {
      model: 'gemini-4-hydrogen',
      useSearch: true,
      thinkingLevel: ThinkingLevel.LOW,
      delayBeforeMs: 0,
    },
    {
      model: 'gemini-4-hydrogen',
      useSearch: false,
      thinkingLevel: ThinkingLevel.LOW,
      delayBeforeMs: 900,
    },
    {
      model: 'gemini-3.1-flash-lite',
      useSearch: false,
      thinkingLevel: ThinkingLevel.MINIMAL,
      delayBeforeMs: 900,
    },
    {
      model: 'gemini-2.5-flash',
      useSearch: true,
      delayBeforeMs: 900,
    },
    {
      model: 'gemini-2.5-flash',
      useSearch: false,
      delayBeforeMs: 900,
    },
  ];

  if (apiKey.startsWith('AQ.')) {
    attempts.push(
      {
        model: 'gemini-2.5-flash',
        useSearch: true,
        delayBeforeMs: 300,
        useVertexAi: true,
      },
      {
        model: 'gemini-2.5-flash',
        useSearch: false,
        delayBeforeMs: 500,
        useVertexAi: true,
      }
    );
  }

  let lastError: unknown = null;
  const overloadedModels = new Set<string>();

  for (const attempt of attempts) {
    if (overloadedModels.has(attempt.model)) {
      continue;
    }
    if (attempt.delayBeforeMs > 0) {
      await sleep(attempt.delayBeforeMs);
    }

    const client = attempt.useVertexAi ? getGeminiClient(true) : ai;
    if (!client) continue;

    try {
      const response = await client.models.generateContent({
        model: attempt.model,
        contents: userPrompt,
        config: {
          systemInstruction,
          ...(attempt.thinkingLevel
            ? { thinkingConfig: { thinkingLevel: attempt.thinkingLevel } }
            : {}),
          ...(attempt.useSearch
            ? { tools: [{ googleSearch: {} }] }
            : { responseMimeType: 'application/json' }),
        },
      });

      const rawText = response.text;
      if (!rawText) {
        throw new Error('Gemini no devolvió respuesta. Intenta detallar un poco más el modelo o servicio.');
      }

      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks
        .map((chunk: { web?: { uri?: string; title?: string } }) => {
          if (chunk.web?.uri) {
            return {
              title: chunk.web.title || chunk.web.uri,
              url: chunk.web.uri,
            };
          }
          return null;
        })
        .filter((s): s is { title: string; url: string } => s !== null);

      geminiQuoteCache.set(cacheKey, {
        expiresAt: Date.now() + 10 * 60 * 1000,
        rawText,
        modelUsed: attempt.model,
        sources,
      });

      return { rawText, modelUsed: attempt.model, sources };
    } catch (err) {
      lastError = err;
      const rawMsg = err instanceof Error ? err.message : String(err);
      const lowerMsg = rawMsg.toLowerCase();
      const isApiKeyInvalid = rawMsg.includes('API_KEY_INVALID') || lowerMsg.includes('api key not valid');
      const canTryVertexFallback = apiKey.startsWith('AQ.') && !attempt.useVertexAi;
      const isOverloaded =
        rawMsg.includes('503') ||
        rawMsg.includes('UNAVAILABLE') ||
        lowerMsg.includes('high demand');
      if (isOverloaded) {
        overloadedModels.add(attempt.model);
      }
      const isModelUnavailable =
        rawMsg.includes('NOT_FOUND') ||
        rawMsg.includes('404') ||
        lowerMsg.includes('not found') ||
        lowerMsg.includes('not supported');
      const isTransientOrToolFallback =
        (!isApiKeyInvalid || canTryVertexFallback) &&
        (attempt.useSearch ||
          canTryVertexFallback ||
          isQuotaOrRateLimitError(err) ||
          isOverloaded ||
          isModelUnavailable);
      if (!isTransientOrToolFallback) {
        throw err;
      }
      console.log(
        `Gemini fallback from ${attempt.model} (search=${attempt.useSearch}, vertex=${Boolean(attempt.useVertexAi)}) to next model.`
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('RESOURCE_EXHAUSTED: Límite temporal de cuota de Gemini alcanzado.');
}

// -------------------------------------------------------------------
// HEALTH & AUTH ENDPOINTS
// -------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  const availableAIProviders = getAvailableAIProviders();
  res.json({
    ok: true,
    hasGeminiKey: hasGeminiKey(),
    hasClaudeKey: hasClaudeKey(),
    hasAnyAIKey: availableAIProviders.length > 0,
    availableAIProviders,
  });
});

app.get('/api/auth/status', (_req, res) => {
  const db = loadDB();
  const hasEnvPasscode = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim());
  const adminConfigured = Boolean(db.adminPasswordHash) || hasEnvPasscode;

  res.json({
    adminConfigured,
    requiresFirstTimeSetup: !adminConfigured,
    branding: {
      name: db.settings.name,
      slogan: db.settings.slogan,
      logoUrl: db.settings.logoUrl,
      phone: db.settings.phone,
      whatsapp: db.settings.whatsapp,
      city: db.settings.city,
    },
  });
});

app.post('/api/auth/admin/setup', (req, res) => {
  const db = loadDB();
  const hasEnvPasscode = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim());
  if (db.adminPasswordHash || hasEnvPasscode) {
    res.status(409).json({
      error: 'La clave de Administrador ya fue configurada. Inicia sesión con tu clave actual.',
    });
    return;
  }

  const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
  if (password.length < 6) {
    res.status(400).json({
      error: 'La contraseña de Administrador debe tener al menos 6 caracteres.',
    });
    return;
  }

  db.adminPasswordHash = hashPassword(password);
  saveDB(db);

  const user: AuthUser = {
    role: 'admin',
    displayName: 'Administrador Teknovant',
  };
  const token = createSession(user);
  res.json({ token, user });
});

app.post('/api/auth/admin/login', (req, res) => {
  const db = loadDB();
  const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
  const envPasscode = process.env.ADMIN_PASSCODE?.trim();

  if (!db.adminPasswordHash && !envPasscode) {
    res.status(400).json({
      error: 'Aún no se ha configurado la clave de Administrador. Completa la configuración inicial.',
      requiresFirstTimeSetup: true,
    });
    return;
  }

  let valid = false;
  if (envPasscode && password) {
    const a = Buffer.from(password);
    const b = Buffer.from(envPasscode);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      valid = true;
    }
  }
  if (!valid && db.adminPasswordHash && password) {
    valid = verifyPasswordHash(password, db.adminPasswordHash);
  }

  if (!valid) {
    res.status(401).json({ error: 'Contraseña de administrador incorrecta.' });
    return;
  }

  const user: AuthUser = {
    role: 'admin',
    displayName: 'Administrador Teknovant',
  };
  const token = createSession(user);
  res.json({ token, user });
});

app.post('/api/auth/client/login', (req, res) => {
  const db = loadDB();
  const contact = typeof req.body?.contact === 'string' ? req.body.contact : '';
  const folio = typeof req.body?.folio === 'string' ? req.body.folio : '';

  if (!contact.trim() || !folio.trim()) {
    res.status(400).json({
      error: 'Ingresa tu teléfono o correo electrónico y un folio válido (ej: REC-2026-001, COT-... o FAC-...).',
    });
    return;
  }

  const check = verifyClientAccess(db, contact, folio);
  if (!check.matched) {
    res.status(401).json({
      error: 'No encontramos coincidencias entre ese contacto y el folio indicado. Verifica tus datos o contacta al taller.',
    });
    return;
  }

  const user: AuthUser = {
    role: 'client',
    displayName: check.displayName,
    phone: check.phone,
    email: check.email,
  };
  const token = createSession(user);
  res.json({ token, user });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.session!.user });
});

app.post('/api/auth/logout', (req, res) => {
  const token = extractBearerToken(req);
  if (token) {
    sessions.delete(token);
  }
  res.json({ ok: true });
});

// -------------------------------------------------------------------
// ADMIN STATE & CRUD ENDPOINTS
// -------------------------------------------------------------------
app.get('/api/admin/bootstrap', requireAdmin, (_req, res) => {
  const db = loadDB();
  res.json({
    settings: db.settings,
    orders: db.orders,
    quotes: db.quotes,
    invoices: db.invoices,
    merchandise: db.merchandise,
    posSales: db.posSales,
    services: db.services,
    notifications: db.notifications,
  });
});

// Orders (Create / Update / Delete)
app.post('/api/orders', requireAdmin, (req, res) => {
  const db = loadDB();
  const order = req.body as RepairOrder;
  if (!order || !order.id || !order.clientName) {
    res.status(400).json({ error: 'Datos de orden inválidos.' });
    return;
  }

  const existingIndex = db.orders.findIndex((o) => o.id === order.id);
  if (existingIndex >= 0) {
    db.orders[existingIndex] = order;
  } else {
    if (order.initialQuotedTotal === undefined) {
      order.initialQuotedTotal = computeOrderTotal(order);
    }
    db.orders = [order, ...db.orders];
    const notif = addNotification(db, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      type: 'new_order',
      title: `Nueva Remisión ${order.orderNumber}`,
      message: `${order.brand} ${order.model} ingresado al laboratorio para ${order.reportedFault}.`,
      status: order.status,
    });
    broadcastNotification(notif);
  }

  saveDB(db);
  broadcastStateRefresh(order.clientPhone, order.clientEmail);
  res.json({ order, orders: db.orders, notifications: db.notifications });
});

app.put('/api/orders/:id', requireAdmin, (req, res) => {
  const db = loadDB();
  const orderId = req.params.id;
  const incoming = req.body as RepairOrder;
  const idx = db.orders.findIndex((o) => o.id === orderId);
  if (idx === -1) {
    res.status(404).json({ error: 'Orden no encontrada.' });
    return;
  }

  const prev = db.orders[idx];
  const prevTotal = computeOrderTotal(prev);
  const nextTotal = computeOrderTotal(incoming);

  db.orders[idx] = incoming;

  let generatedNotif: StatusNotification | null = null;
  if (prev.status !== incoming.status) {
    generatedNotif = addNotification(db, {
      orderId: incoming.id,
      orderNumber: incoming.orderNumber,
      clientName: incoming.clientName,
      clientPhone: incoming.clientPhone,
      type: 'status_change',
      title: `${incoming.orderNumber}: ${getStatusDisplayLabel(incoming.status)}`,
      message: `Tu equipo ${incoming.brand} ${incoming.model} cambió a estado "${getStatusDisplayLabel(incoming.status)}".`,
      status: incoming.status,
    });
  } else if (
    Math.abs(nextTotal - prevTotal) > 0.01 ||
    (incoming.priceAdjustmentNote && incoming.priceAdjustmentNote !== prev.priceAdjustmentNote)
  ) {
    generatedNotif = addNotification(db, {
      orderId: incoming.id,
      orderNumber: incoming.orderNumber,
      clientName: incoming.clientName,
      clientPhone: incoming.clientPhone,
      type: 'price_adjustment',
      title: `Actualización de Costo en ${incoming.orderNumber}`,
      message: incoming.priceAdjustmentNote
        ? `${incoming.priceAdjustmentNote} (Nuevo total: ${db.settings.currency} ${nextTotal.toLocaleString()})`
        : `El presupuesto de ${incoming.brand} ${incoming.model} se actualizó a ${db.settings.currency} ${nextTotal.toLocaleString()}.`,
      status: incoming.status,
    });
  }

  // Auto-generate invoice on delivery if not present
  if (incoming.status === 'entregado') {
    const invoiceExists = db.invoices.some((inv) => inv.orderId === incoming.id);
    if (!invoiceExists) {
      const partsSubtotal = incoming.parts.reduce((acc, p) => acc + p.price * p.quantity, 0);
      const subtotal = partsSubtotal + (incoming.laborCost || 0);
      const discount = incoming.discount || 0;
      const taxable = Math.max(0, subtotal - discount);
      const tax = taxable * ((incoming.taxPercent || 0) / 100);
      const total = taxable + tax;

      const newInvoice: Invoice = {
        id: `fac-${Date.now()}`,
        invoiceNumber: `FAC-${new Date().getFullYear()}-${String(db.invoices.length + 1).padStart(3, '0')}`,
        orderId: incoming.id,
        orderNumber: incoming.orderNumber,
        clientName: incoming.clientName,
        clientDocId: incoming.clientDocId,
        clientPhone: incoming.clientPhone,
        clientEmail: incoming.clientEmail,
        clientAddress: incoming.clientAddress,
        createdAt: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        items: [
          ...incoming.parts.map((p) => ({
            description: p.name,
            quantity: p.quantity,
            unitPrice: p.price,
            total: p.price * p.quantity,
          })),
          ...(incoming.laborCost > 0
            ? [
                {
                  description: 'Servicio técnico especializado y mano de obra',
                  quantity: 1,
                  unitPrice: incoming.laborCost,
                  total: incoming.laborCost,
                },
              ]
            : []),
        ],
        subtotal,
        discount,
        tax,
        total,
        paymentMethod: incoming.paymentMethod || 'efectivo',
        paymentStatus: 'pagada',
        warrantyText: `Garantía técnica de ${incoming.warrantyDays} días a partir de la fecha de entrega.`,
      };
      db.invoices = [newInvoice, ...db.invoices];
      const invNotif = addNotification(db, {
        orderId: incoming.id,
        orderNumber: newInvoice.invoiceNumber,
        clientName: incoming.clientName,
        clientPhone: incoming.clientPhone,
        type: 'invoice_paid',
        title: `Factura ${newInvoice.invoiceNumber} Emitida`,
        message: `Disponible factura PDF por ${db.settings.currency} ${newInvoice.total.toLocaleString()} para ${incoming.brand} ${incoming.model}.`,
        status: 'entregado',
      });
      broadcastNotification(invNotif);
    }
  }

  saveDB(db);
  if (generatedNotif) broadcastNotification(generatedNotif);
  broadcastStateRefresh(incoming.clientPhone, incoming.clientEmail);
  res.json({
    order: incoming,
    orders: db.orders,
    invoices: db.invoices,
    notifications: db.notifications,
  });
});

app.delete('/api/orders/:id', requireAdmin, (req, res) => {
  const db = loadDB();
  const target = db.orders.find((o) => o.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'Orden/Remisión no encontrada.' });
    return;
  }
  db.orders = db.orders.filter((o) => o.id !== req.params.id);
  saveDB(db);
  broadcastStateRefresh(target.clientPhone, target.clientEmail);
  res.json({ ok: true, orders: db.orders });
});

// Quotes
app.post('/api/quotes', requireAdmin, (req, res) => {
  const db = loadDB();
  const quote = req.body as Quote;
  if (!quote || !quote.id) {
    res.status(400).json({ error: 'Datos de cotización inválidos.' });
    return;
  }
  const idx = db.quotes.findIndex((q) => q.id === quote.id);
  if (idx >= 0) {
    db.quotes[idx] = quote;
  } else {
    db.quotes = [quote, ...db.quotes];
    const notif = addNotification(db, {
      orderNumber: quote.quoteNumber,
      clientName: quote.clientName,
      clientPhone: quote.clientPhone,
      type: 'quote_ready',
      title: `Cotización ${quote.quoteNumber} Lista`,
      message: `Presupuesto disponible por ${db.settings.currency} ${quote.total.toLocaleString()} para ${quote.deviceDescription}.`,
    });
    broadcastNotification(notif);
  }
  saveDB(db);
  broadcastStateRefresh(quote.clientPhone, quote.clientEmail);
  res.json({ quote, quotes: db.quotes, notifications: db.notifications });
});

app.delete('/api/quotes/:id', requireAdmin, (req, res) => {
  const db = loadDB();
  const target = db.quotes.find((q) => q.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'Cotización no encontrada.' });
    return;
  }
  db.quotes = db.quotes.filter((q) => q.id !== req.params.id);
  saveDB(db);
  broadcastStateRefresh(target.clientPhone, target.clientEmail);
  res.json({ ok: true, quotes: db.quotes });
});

app.post('/api/quotes/:id/convert', requireAdmin, (req, res) => {
  const db = loadDB();
  const quote = db.quotes.find((q) => q.id === req.params.id);
  if (!quote) {
    res.status(404).json({ error: 'Cotización no encontrada.' });
    return;
  }

  const nextOrderNum = String(db.orders.length + 1).padStart(3, '0');
  const newOrder: RepairOrder = {
    id: `ord-${Date.now()}`,
    orderNumber: `REC-${new Date().getFullYear()}-${nextOrderNum}`,
    clientName: quote.clientName,
    clientPhone: quote.clientPhone,
    clientEmail: quote.clientEmail,
    deviceType: 'celular',
    brand: 'Equipo / Servicio',
    model: quote.deviceDescription,
    serialOrImei: 'POR-VERIFICAR',
    accessories: [],
    physicalCondition: 'Revisión técnica tras aprobación de cotización.',
    reportedFault: quote.issueDescription,
    status: 'recibido',
    priority: 'normal',
    technicianAssigned: db.settings.technicians[0] || 'Ingeniero Asignado',
    createdAt: new Date().toISOString(),
    parts: quote.items.map((it, i) => ({
      id: `p-${Date.now()}-${i}`,
      name: it.description,
      cost: Math.round(it.unitPrice * 0.6),
      price: it.unitPrice,
      quantity: it.quantity,
    })),
    laborCost: quote.laborCost,
    discount: quote.discount,
    taxPercent: quote.taxPercent,
    depositPaid: 0,
    initialQuotedTotal: quote.total,
    warrantyDays: db.settings.defaultWarrantyDays || 90,
    trackingNotes: [
      {
        id: `note-${Date.now()}`,
        timestamp: new Date().toISOString(),
        author: 'Sistema Teknovant',
        incidentType: 'cliente_contactado',
        title: 'Cotización Aprobada y Convertida',
        note: `Orden generada automáticamente a partir de la Cotización #${quote.quoteNumber}.`,
        isCustomerVisible: true,
      },
    ],
    quoteId: quote.id,
  };

  db.quotes = db.quotes.map((q) =>
    q.id === quote.id
      ? { ...q, status: 'convertida', convertedOrderId: newOrder.id }
      : q
  );
  db.orders = [newOrder, ...db.orders];

  const notif = addNotification(db, {
    orderId: newOrder.id,
    orderNumber: newOrder.orderNumber,
    clientName: newOrder.clientName,
    clientPhone: newOrder.clientPhone,
    type: 'new_order',
    title: `Orden ${newOrder.orderNumber} Creada`,
    message: `Tu cotización ${quote.quoteNumber} fue convertida a orden de servicio activa.`,
    status: 'recibido',
  });

  saveDB(db);
  broadcastNotification(notif);
  broadcastStateRefresh(newOrder.clientPhone, newOrder.clientEmail);
  res.json({ order: newOrder, orders: db.orders, quotes: db.quotes, notifications: db.notifications });
});

// Invoices (Create / Delete)
app.post('/api/invoices', requireAdmin, (req, res) => {
  const db = loadDB();
  const invoice = req.body as Invoice;
  if (!invoice || !invoice.id) {
    res.status(400).json({ error: 'Datos de factura inválidos.' });
    return;
  }
  const idx = db.invoices.findIndex((i) => i.id === invoice.id);
  if (idx >= 0) {
    db.invoices[idx] = invoice;
  } else {
    db.invoices = [invoice, ...db.invoices];
  }
  saveDB(db);
  broadcastStateRefresh(invoice.clientPhone, invoice.clientEmail);
  res.json({ invoice, invoices: db.invoices });
});

app.delete('/api/invoices/:id', requireAdmin, (req, res) => {
  const db = loadDB();
  const target = db.invoices.find((i) => i.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'Factura no encontrada.' });
    return;
  }
  db.invoices = db.invoices.filter((i) => i.id !== req.params.id);
  saveDB(db);
  broadcastStateRefresh(target.clientPhone, target.clientEmail);
  res.json({ ok: true, invoices: db.invoices });
});

// Merchandise bulk sync
app.put('/api/merchandise', requireAdmin, (req, res) => {
  const db = loadDB();
  if (!Array.isArray(req.body?.items)) {
    res.status(400).json({ error: 'Se esperaba un arreglo de artículos.' });
    return;
  }
  db.merchandise = req.body.items as MerchandiseItem[];
  saveDB(db);
  broadcastStateRefresh();
  res.json({ merchandise: db.merchandise });
});

// POS Sales bulk sync
app.put('/api/pos/sales', requireAdmin, (req, res) => {
  const db = loadDB();
  if (!Array.isArray(req.body?.sales)) {
    res.status(400).json({ error: 'Se esperaba un arreglo de ventas POS.' });
    return;
  }
  db.posSales = req.body.sales as POSSale[];
  saveDB(db);
  broadcastStateRefresh();
  res.json({ posSales: db.posSales });
});

// Services catalog (Create / Update / Delete)
app.post('/api/services', requireAdmin, (req, res) => {
  const db = loadDB();
  const service = req.body as ServiceItem;
  if (!service || !service.id || !service.name) {
    res.status(400).json({ error: 'Datos del servicio inválidos.' });
    return;
  }
  const idx = db.services.findIndex((s) => s.id === service.id);
  if (idx >= 0) {
    db.services[idx] = service;
  } else {
    db.services = [service, ...db.services];
  }
  saveDB(db);
  broadcastStateRefresh();
  res.json({ service, services: db.services });
});

app.delete('/api/services/:id', requireAdmin, (req, res) => {
  const db = loadDB();
  db.services = db.services.filter((s) => s.id !== req.params.id);
  saveDB(db);
  broadcastStateRefresh();
  res.json({ ok: true, services: db.services });
});

// Settings
app.put('/api/settings', requireAdmin, (req, res) => {
  const db = loadDB();
  const nextSettings = req.body as WorkshopSettings;
  db.settings = {
    ...db.settings,
    ...nextSettings,
    acceptedPaymentMethods: {
      ...db.settings.acceptedPaymentMethods!,
      ...(nextSettings.acceptedPaymentMethods || {}),
    },
  };
  saveDB(db);
  broadcastStateRefresh();
  res.json({ settings: db.settings });
});

// Notifications read markers
app.post('/api/notifications/read', requireAdmin, (_req, res) => {
  const db = loadDB();
  db.notifications = db.notifications.map((n) => ({ ...n, readByAdmin: true }));
  saveDB(db);
  res.json({ notifications: db.notifications });
});

// Backup Import & Reset
app.post('/api/backup/import', requireAdmin, (req, res) => {
  const db = loadDB();
  const data = req.body || {};
  if (data.settings) db.settings = { ...db.settings, ...data.settings };
  if (Array.isArray(data.orders)) db.orders = data.orders;
  if (Array.isArray(data.quotes)) db.quotes = data.quotes;
  if (Array.isArray(data.invoices)) db.invoices = data.invoices;
  if (Array.isArray(data.merchandise)) db.merchandise = data.merchandise;
  if (Array.isArray(data.posSales)) db.posSales = data.posSales;
  if (Array.isArray(data.services)) db.services = data.services;
  saveDB(db);
  broadcastStateRefresh();
  res.json({
    ok: true,
    data: {
      settings: db.settings,
      orders: db.orders,
      quotes: db.quotes,
      invoices: db.invoices,
      merchandise: db.merchandise,
      posSales: db.posSales,
      services: db.services,
      notifications: db.notifications,
    },
  });
});

app.post('/api/backup/reset', requireAdmin, (_req, res) => {
  const db = resetServerDB();
  broadcastStateRefresh();
  res.json({
    ok: true,
    data: {
      settings: db.settings,
      orders: db.orders,
      quotes: db.quotes,
      invoices: db.invoices,
      merchandise: db.merchandise,
      posSales: db.posSales,
      services: db.services,
      notifications: db.notifications,
    },
  });
});

// -------------------------------------------------------------------
// SCOPED CLIENT PORTAL ENDPOINTS
// -------------------------------------------------------------------
app.get('/api/client/dashboard', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = loadDB();
  const user = req.session!.user;
  if (user.role === 'admin') {
    res.json({
      settings: db.settings,
      orders: db.orders,
      quotes: db.quotes,
      invoices: db.invoices,
      notifications: db.notifications,
    });
    return;
  }
  res.json(getClientScopedData(db, user.phone, user.email));
});

app.post('/api/client/notifications/read', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = loadDB();
  const user = req.session!.user;
  db.notifications = db.notifications.map((n) => {
    if (isClientRecordMatch(n.clientPhone, undefined, user.phone, user.email)) {
      return { ...n, readByClient: true };
    }
    return n;
  });
  saveDB(db);
  res.json(getClientScopedData(db, user.phone, user.email));
});

// -------------------------------------------------------------------
// AI MARKET QUOTER (UNIVERSAL MULTI-PROVIDER)
// -------------------------------------------------------------------
app.get('/api/ai/providers', requireAdmin, (_req, res) => {
  const availableProviders = getAvailableAIProviders();
  res.json({
    gemini: hasGeminiKey(),
    claude: hasClaudeKey(),
    openai: hasOpenAIKey(),
    groq: hasGroqKey(),
    openrouter: hasOpenRouterKey(),
    deepseek: hasDeepSeekKey(),
    custom: hasCustomAI(),
    availableProviders,
    defaultProvider: getDefaultAIProvider(),
  });
});

app.post('/api/ai/market-quote', requireAdmin, async (req, res) => {
  const body = (req.body || {}) as MarketQuoteRequest;
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : 'general';
  const device = typeof body.device === 'string' ? body.device.trim() : '';
  const region =
    typeof body.region === 'string' && body.region.trim()
      ? body.region.trim()
      : 'México / Latinoamérica';
  const currency =
    typeof body.currency === 'string' && body.currency.trim()
      ? body.currency.trim()
      : 'MXN ($)';
  const knownPartCost =
    typeof body.knownPartCost === 'number' && !Number.isNaN(body.knownPartCost) && body.knownPartCost > 0
      ? body.knownPartCost
      : null;
  const requestedProvider = body.provider || 'auto';

  if (!query && !device) {
    res.status(400).json({
      error: 'Describe el equipo, falla, desbloqueo, servicio de instalación o producto a cotizar.',
    });
    return;
  }

  const available = getAvailableAIProviders();
  if (available.length === 0) {
    res.status(503).json({
      error:
        'No hay ninguna API de IA configurada en .env (puedes usar Gemini, Groq gratis, OpenAI, OpenRouter, Claude, DeepSeek u Ollama/Custom con windows\\Configurar-API-IA.bat).',
    });
    return;
  }

  let providerChain: AIProviderId[] = [];
  if (requestedProvider === 'auto') {
    const preferred = getDefaultAIProvider();
    providerChain =
      preferred !== 'none'
        ? [preferred, ...available.filter((p) => p !== preferred)]
        : available;
  } else {
    if (!available.includes(requestedProvider)) {
      res.status(503).json({
        error: `El proveedor de IA "${requestedProvider}" no tiene su clave/URL configurada en .env.`,
      });
      return;
    }
    providerChain = [requestedProvider];
  }

  const currentYear = new Date().getFullYear();
  const workshopName = body.workshopName || 'Teknovant Labs';

  const systemInstruction = `Eres un consultor experto en costos de talleres de reparación electrónica, telefonía celular, microsoldadura, consolas, cómputo, desbloqueos de software/servidor (FRP, PayJoy, Macropay, MDM, KNOX, AT&T, Movistar, Telcel, Claro, etc.) Y servicios técnicos en campo/climatización (instalación de minisplit, recarga de gas refrigerante R410A/R32/R22, reubicación/cambio de lugar de minisplit, mantenimiento preventivo, CCTV y cableado eléctrico) en el mercado actual (${currentYear}).

Tu misión es analizar precios ACTUALES del mercado local real en la región y moneda indicadas para que "${workshopName}" dé precios justos y competitivos manteniendo un buen margen de ganancia.

REGLAS CRÍTICAS:
1. Todos los montos numéricos DEBEN estar expresados en la moneda solicitada (${currency}) acorde a los precios reales de taller/campo en la región (${region}).
2. Si el usuario proporcionó un costo de refacción/insumo/crédito conocido (${knownPartCost !== null ? knownPartCost : 'no especificado'}), úsalo como costo base real y calcula encima la mano de obra y margen competitivo.
3. En desbloqueos (FRP, PayJoy, Macropay, MDM, AT&T, Movistar, IMEI/servidor), diferencia si se realiza vía servidor/créditos, herramienta box/dongle o ISP/JTAG, y agrega advertencias técnicas/legales claras.
4. En servicios de minisplit y climatización, contempla materiales (tubería cobre, gas refrigerante por kg/libra, cinta momia, bomba de vacío, mano de obra por tonelada o metro adicional) y advertencias de instalación (ej. amperaje, drenaje, altura).
5. Responde ÚNICAMENTE con un objeto JSON válido (sin texto adicional fuera del JSON) con esta estructura exacta:
{
  "serviceTitle": "Nombre claro del servicio o reparación",
  "detectedCategory": "pantalla | centro_carga | desbloqueo | microsoldadura | consola | servicio_minisplit | accesorio | otro",
  "regionUsed": "${region}",
  "currencyLabel": "${currency}",
  "marketSummary": "Resumen breve (2-4 líneas) de cómo se cotiza actualmente este trabajo en el mercado local, disponibilidad de insumos o servidores y factores de precio.",
  "estimatedTime": "Ej: 45 - 90 minutos / 2 - 4 horas en sitio",
  "difficultyLevel": "Baja | Media | Alta | Experto",
  "partsCostRange": {
    "min": 0,
    "max": 0,
    "avg": 0,
    "notes": "Explicación corta del costo de refacción, gas refrigerante, materiales o crédito de servidor"
  },
  "tiers": {
    "economico": {
      "label": "Económico / Competitivo",
      "partsPrice": 0,
      "laborPrice": 0,
      "total": 0,
      "marginPercent": 0,
      "description": "Opción accesible o margen ajustado para cerrar cliente"
    },
    "recomendado": {
      "label": "Recomendado Taller (Justo y Competitivo)",
      "partsPrice": 0,
      "laborPrice": 0,
      "total": 0,
      "marginPercent": 0,
      "description": "Balance ideal entre calidad, precio competitivo frente a la competencia local y buena ganancia"
    },
    "premium": {
      "label": "Original / Express / Garantía Extendida",
      "partsPrice": 0,
      "laborPrice": 0,
      "total": 0,
      "marginPercent": 0,
      "description": "Materiales premium / pieza original / método permanente con garantía extendida"
    }
  },
  "suggestedLineItems": [
    {
      "description": "Concepto detallado de pieza, material, gas o crédito",
      "unitPrice": 0,
      "quantity": 1
    }
  ],
  "suggestedLaborCost": 0,
  "technicalWarnings": [
    "Advertencia o consideración técnica importante antes de realizar el trabajo"
  ]
}`;

  const promptParts = [
    `Categoría seleccionada: ${category}`,
    device ? `Equipo / Modelo / Capacidad: ${device}` : '',
    `Trabajo, falla, desbloqueo o servicio a cotizar: ${query}`,
    `Región / País del mercado local: ${region}`,
    `Moneda para los precios: ${currency}`,
    knownPartCost !== null
      ? `Costo actual del repuesto / material / crédito que ya tengo: ${knownPartCost} ${currency}`
      : 'No tengo el costo exacto del insumo aún; estima el costo promedio actual de proveedor/distribuidor y el precio justo al público.',
    `Genera la cotización competitiva basada en el mercado local (${currentYear}) y devuelve exclusivamente el JSON exacto.`,
  ].filter(Boolean);

  try {
    let rawText = '';
    let modelUsed = '';
    let providerUsed: AIProviderId = providerChain[0];
    let sources: Array<{ title: string; url: string }> = [];
    let chainError: unknown = null;

    for (const candidateProvider of providerChain) {
      try {
        const result = await callProviderMarketQuote(
          candidateProvider,
          systemInstruction,
          promptParts.join('\n')
        );
        rawText = result.rawText;
        modelUsed = result.modelUsed;
        sources = result.sources;
        providerUsed = candidateProvider;
        chainError = null;
        break;
      } catch (providerErr) {
        chainError = providerErr;
        if (providerChain.length > 1) {
          console.log(`AI provider ${candidateProvider} failed, trying next configured provider...`);
        }
      }
    }

    if (chainError || !rawText) {
      throw chainError instanceof Error
        ? chainError
        : new Error('No se pudo obtener respuesta de ningún proveedor de IA configurado.');
    }

    const parsed = extractJsonFromText(rawText) as Record<string, unknown>;
    res.json({
      quoteAnalysis: parsed,
      sources,
      providerUsed,
      modelUsed,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : 'Error consultando el cotizador IA.';

    let status = 500;
    let friendlyMessage = rawMessage;

    if (rawMessage.includes('API_KEY_INVALID') || rawMessage.includes('API key not valid') || rawMessage.includes('PERMISSION_DENIED') || rawMessage.includes('401') || rawMessage.includes('403')) {
      status = 403;
      const isDesktopOrLocal = Boolean(process.env.TEKNOVANT_DATA_DIR || process.env.TEKNOVANT_ENV_PATH);
      const cleanDetail = rawMessage
        .replace(/AIza[0-9A-Za-z_\-]+/g, '[KEY]')
        .replace(/AQ\.[0-9A-Za-z_\-\.]+/g, '[KEY]')
        .replace(/sk-[0-9A-Za-z_\-]+/g, '[KEY]')
        .replace(/gsk_[0-9A-Za-z_\-]+/g, '[KEY]')
        .slice(0, 500);
      friendlyMessage = isDesktopOrLocal
        ? `La clave de IA configurada en .env no es válida o no tiene permisos activos. Puedes cambiar de motor o clave (Gemini, Groq gratis, OpenAI, OpenRouter, Claude, DeepSeek u Ollama) ejecutando windows\\Configurar-API-IA.bat y reiniciando el programa. Detalle: ${cleanDetail}`
        : `La clave de IA configurada en el servidor no es válida o no tiene permisos activos. Verifica tus variables de entorno. Detalle: ${cleanDetail}`;
      console.warn('AI auth warning in /api/ai/market-quote:', cleanDetail);
    } else if (isQuotaOrRateLimitError(err)) {
      status = 429;
      friendlyMessage =
        'Se alcanzó temporalmente el límite de cuota gratuita de Gemini. Espera unos 30-60 segundos e intenta de nuevo, o selecciona una API Key con facturación en Settings > Secrets para ampliar tu cuota.';
      console.warn('Gemini rate-limit (429) in /api/ai/market-quote:', rawMessage);
    } else if (rawMessage.includes('503') || rawMessage.includes('UNAVAILABLE') || rawMessage.toLowerCase().includes('high demand')) {
      status = 503;
      friendlyMessage = 'Los modelos de Gemini están con alta demanda temporal. Espera unos segundos e intenta nuevamente.';
      console.warn('Gemini temporary 503 in /api/ai/market-quote');
    } else if (rawMessage.includes('NOT_FOUND') || rawMessage.includes('404')) {
      status = 404;
      friendlyMessage = 'El modelo de IA solicitado no está disponible en este momento.';
      console.warn('Gemini model 404 in /api/ai/market-quote:', rawMessage);
    } else {
      console.error('Error in /api/ai/market-quote:', err);
    }

    res.status(status).json({ error: friendlyMessage });
  }
});

// -------------------------------------------------------------------
// WHATSAPP LINKED-DEVICE SESSION & DIRECT DISPATCH (ADMIN ONLY)
// -------------------------------------------------------------------
app.get('/api/whatsapp/status', requireAdmin, (_req, res) => {
  res.json(getWhatsAppStatus());
});

app.post('/api/whatsapp/connect/qr', requireAdmin, async (_req, res) => {
  try {
    await startWhatsAppQRSession();
    res.json(getWhatsAppStatus());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'No se pudo iniciar la sesión QR de WhatsApp.';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/whatsapp/connect/pairing', requireAdmin, async (req, res) => {
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  if (!phone) {
    res.status(400).json({ error: 'Ingresa el número de WhatsApp con código de país (ej: 5215512345678).' });
    return;
  }
  try {
    await startWhatsAppPairingSession(phone);
    res.json(getWhatsAppStatus());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'No se pudo generar el código de vinculación.';
    res.status(400).json({ error: msg });
  }
});

app.post('/api/whatsapp/logout', requireAdmin, async (_req, res) => {
  try {
    await logoutWhatsAppSession();
    res.json(getWhatsAppStatus());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'No se pudo cerrar la sesión de WhatsApp.';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/whatsapp/send', requireAdmin, async (req, res) => {
  const toPhone = typeof req.body?.toPhone === 'string' ? req.body.toPhone.trim() : '';
  const clientName = typeof req.body?.clientName === 'string' ? req.body.clientName.trim() : 'Cliente';
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const rawCategory = req.body?.category;
  const category: 'cotizacion' | 'factura' | 'seguimiento' | 'manual' =
    rawCategory === 'cotizacion' ||
    rawCategory === 'factura' ||
    rawCategory === 'seguimiento' ||
    rawCategory === 'manual'
      ? rawCategory
      : 'manual';
  const referenceNumber =
    typeof req.body?.referenceNumber === 'string' && req.body.referenceNumber.trim()
      ? req.body.referenceNumber.trim()
      : undefined;

  if (!toPhone || !message) {
    res.status(400).json({ error: 'El teléfono del cliente y el mensaje son obligatorios.' });
    return;
  }

  try {
    const db = loadDB();
    const log = await sendWhatsAppDirectMessage({
      toPhone,
      clientName,
      message,
      category,
      referenceNumber,
      workshopWhatsapp: db.settings.whatsapp,
    });
    res.json({ ok: true, log, logs: getWhatsAppStatus().logs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al enviar el mensaje por WhatsApp.';
    const status = msg.includes('no está conectado') ? 409 : 400;
    res.status(status).json({ error: msg, logs: getWhatsAppStatus().logs });
  }
});

// -------------------------------------------------------------------
// HTTP + WEBSOCKET SERVER BOOTSTRAP
// -------------------------------------------------------------------
async function startServer() {
  subscribeWhatsAppStatus(broadcastWhatsAppStatus);
  initWhatsAppIfLinked();
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = process.env.TEKNOVANT_DIST_DIR
      ? path.resolve(process.env.TEKNOVANT_DIST_DIR)
      : fs.existsSync(path.join(__dirname, 'dist'))
      ? path.join(__dirname, 'dist')
      : path.resolve(__dirname, '..', 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    try {
      const parsedUrl = new URL(req.url || '/', `http://localhost:${PORT}`);
      const token = parsedUrl.searchParams.get('token');
      const session = getSessionFromToken(token);

      if (!session) {
        ws.close(4001, 'Unauthorized');
        return;
      }

      const meta: SocketClientMeta = { ws, user: session.user };
      wsClients.add(meta);
      sendWsPayload(ws, { type: 'connected', user: session.user });

      ws.on('close', () => {
        wsClients.delete(meta);
      });

      ws.on('error', () => {
        wsClients.delete(meta);
      });
    } catch {
      ws.close(4000, 'Bad connection');
    }
  });

  const listenHost = process.env.HOST || '0.0.0.0';
  httpServer.listen(PORT, listenHost, () => {
    console.log(`Teknovant Labs full-stack server (HTTP + WS) running on http://${listenHost}:${PORT}`);
  });

  const shutdown = () => {
    wss.close();
    httpServer.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
