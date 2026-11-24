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
  WhatsAppDispatchLog,
} from '../types/workshop';

// Keep auth token strictly in JS memory (never localStorage or sessionStorage)
let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Error del servidor (${response.status})`);
  }
  return data as T;
}

export interface AuthStatusResponse {
  adminConfigured: boolean;
  requiresFirstTimeSetup: boolean;
  branding: {
    name: string;
    slogan: string;
    logoUrl: string;
    phone: string;
    whatsapp: string;
    city: string;
  };
}

export interface AdminBootstrapPayload {
  settings: WorkshopSettings;
  orders: RepairOrder[];
  quotes: Quote[];
  invoices: Invoice[];
  merchandise: MerchandiseItem[];
  posSales: POSSale[];
  services: ServiceItem[];
  notifications: StatusNotification[];
}

export interface ClientDashboardPayload {
  settings: WorkshopSettings;
  orders: RepairOrder[];
  quotes: Quote[];
  invoices: Invoice[];
  notifications: StatusNotification[];
}

export type AIProviderId =
  | 'gemini'
  | 'claude'
  | 'openai'
  | 'groq'
  | 'openrouter'
  | 'deepseek'
  | 'custom';

export interface AIProvidersStatus {
  gemini: boolean;
  claude: boolean;
  openai: boolean;
  groq: boolean;
  openrouter: boolean;
  deepseek: boolean;
  custom: boolean;
  availableProviders: AIProviderId[];
  defaultProvider: AIProviderId | 'none';
}

export const api = {
  // Auth
  getAuthStatus: () => apiRequest<AuthStatusResponse>('/api/auth/status'),

  setupAdmin: async (password: string) => {
    const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/admin/setup', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    setAuthToken(res.token);
    return res.user;
  },

  loginAdmin: async (password: string) => {
    const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    setAuthToken(res.token);
    return res.user;
  },

  loginClient: async (contact: string, folio: string) => {
    const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/client/login', {
      method: 'POST',
      body: JSON.stringify({ contact, folio }),
    });
    setAuthToken(res.token);
    return res.user;
  },

  logout: async () => {
    try {
      if (inMemoryToken) {
        await apiRequest<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
      }
    } finally {
      setAuthToken(null);
    }
  },

  // Admin Data
  getAdminBootstrap: () => apiRequest<AdminBootstrapPayload>('/api/admin/bootstrap'),

  saveOrder: (order: RepairOrder) =>
    apiRequest<{ order: RepairOrder; orders: RepairOrder[]; notifications: StatusNotification[] }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    }),

  updateOrder: (order: RepairOrder) =>
    apiRequest<{
      order: RepairOrder;
      orders: RepairOrder[];
      invoices: Invoice[];
      notifications: StatusNotification[];
    }>(`/api/orders/${encodeURIComponent(order.id)}`, {
      method: 'PUT',
      body: JSON.stringify(order),
    }),

  deleteOrder: (orderId: string) =>
    apiRequest<{ ok: boolean; orders: RepairOrder[] }>(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: 'DELETE',
    }),

  saveQuote: (quote: Quote) =>
    apiRequest<{ quote: Quote; quotes: Quote[]; notifications: StatusNotification[] }>('/api/quotes', {
      method: 'POST',
      body: JSON.stringify(quote),
    }),

  deleteQuote: (quoteId: string) =>
    apiRequest<{ ok: boolean; quotes: Quote[] }>(`/api/quotes/${encodeURIComponent(quoteId)}`, {
      method: 'DELETE',
    }),

  convertQuoteToOrder: (quoteId: string) =>
    apiRequest<{
      order: RepairOrder;
      orders: RepairOrder[];
      quotes: Quote[];
      notifications: StatusNotification[];
    }>(`/api/quotes/${encodeURIComponent(quoteId)}/convert`, {
      method: 'POST',
    }),

  saveInvoice: (invoice: Invoice) =>
    apiRequest<{ invoice: Invoice; invoices: Invoice[] }>('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(invoice),
    }),

  deleteInvoice: (invoiceId: string) =>
    apiRequest<{ ok: boolean; invoices: Invoice[] }>(`/api/invoices/${encodeURIComponent(invoiceId)}`, {
      method: 'DELETE',
    }),

  saveMerchandise: (items: MerchandiseItem[]) =>
    apiRequest<{ merchandise: MerchandiseItem[] }>('/api/merchandise', {
      method: 'PUT',
      body: JSON.stringify({ items }),
    }),

  savePOSSales: (sales: POSSale[]) =>
    apiRequest<{ posSales: POSSale[] }>('/api/pos/sales', {
      method: 'PUT',
      body: JSON.stringify({ sales }),
    }),

  saveService: (service: ServiceItem) =>
    apiRequest<{ service: ServiceItem; services: ServiceItem[] }>('/api/services', {
      method: 'POST',
      body: JSON.stringify(service),
    }),

  deleteService: (serviceId: string) =>
    apiRequest<{ ok: boolean; services: ServiceItem[] }>(`/api/services/${encodeURIComponent(serviceId)}`, {
      method: 'DELETE',
    }),

  saveSettings: (settings: WorkshopSettings) =>
    apiRequest<{ settings: WorkshopSettings }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  markAdminNotificationsRead: () =>
    apiRequest<{ notifications: StatusNotification[] }>('/api/notifications/read', {
      method: 'POST',
    }),

  importBackup: (parsedData: unknown) =>
    apiRequest<{ ok: boolean; data: AdminBootstrapPayload }>('/api/backup/import', {
      method: 'POST',
      body: JSON.stringify(parsedData),
    }),

  resetBackup: () =>
    apiRequest<{ ok: boolean; data: AdminBootstrapPayload }>('/api/backup/reset', {
      method: 'POST',
    }),

  // Client Data
  getClientDashboard: () => apiRequest<ClientDashboardPayload>('/api/client/dashboard'),

  markClientNotificationsRead: () =>
    apiRequest<ClientDashboardPayload>('/api/client/notifications/read', {
      method: 'POST',
    }),

  // AI Market Quote (Universal Multi-Provider)
  getAIProviders: () => apiRequest<AIProvidersStatus>('/api/ai/providers'),

  requestMarketQuote: (payload: {
    query: string;
    category?: string;
    device?: string;
    region?: string;
    currency?: string;
    knownPartCost?: number | null;
    workshopName?: string;
    provider?: 'auto' | AIProviderId;
  }) =>
    apiRequest<{
      quoteAnalysis: unknown;
      sources?: { title: string; url: string }[];
      providerUsed?: AIProviderId;
      modelUsed?: string;
      generatedAt?: string;
    }>('/api/ai/market-quote', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // WhatsApp Linked-Device Session & Direct Messaging (Admin Only)
  getWhatsAppStatus: () =>
    apiRequest<{ session: WhatsAppSessionState; logs: WhatsAppDispatchLog[] }>('/api/whatsapp/status'),

  connectWhatsAppQR: () =>
    apiRequest<{ session: WhatsAppSessionState; logs: WhatsAppDispatchLog[] }>('/api/whatsapp/connect/qr', {
      method: 'POST',
    }),

  connectWhatsAppPairing: (phone: string) =>
    apiRequest<{ session: WhatsAppSessionState; logs: WhatsAppDispatchLog[] }>('/api/whatsapp/connect/pairing', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  logoutWhatsApp: () =>
    apiRequest<{ session: WhatsAppSessionState; logs: WhatsAppDispatchLog[] }>('/api/whatsapp/logout', {
      method: 'POST',
    }),

  sendWhatsAppMessage: (payload: {
    toPhone: string;
    clientName: string;
    message: string;
    category: 'cotizacion' | 'factura' | 'seguimiento' | 'manual';
    referenceNumber?: string;
  }) =>
    apiRequest<{ ok: boolean; log: WhatsAppDispatchLog; logs: WhatsAppDispatchLog[] }>('/api/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export interface WSMessage {
  type: 'connected' | 'notification' | 'admin:sync' | 'client:sync' | 'whatsapp:status';
  notification?: StatusNotification;
  data?: AdminBootstrapPayload | ClientDashboardPayload;
  whatsapp?: WhatsAppSessionState;
}

export function connectRealtimeWS(
  onMessage: (msg: WSMessage) => void
): () => void {
  let closed = false;
  let ws: WebSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (closed || !inMemoryToken) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws?token=${encodeURIComponent(inMemoryToken)}`;
    ws = new WebSocket(url);

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as WSMessage;
        onMessage(parsed);
      } catch {
        // ignore malformed WS frames
      }
    };

    ws.onclose = () => {
      if (!closed && inMemoryToken) {
        retryTimer = setTimeout(connect, 2500);
      }
    };
  };

  connect();

  return () => {
    closed = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close();
    }
  };
}
