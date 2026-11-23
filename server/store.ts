import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  RepairOrder,
  Quote,
  Invoice,
  WorkshopSettings,
  MerchandiseItem,
  POSSale,
  ServiceItem,
  StatusNotification,
  OrderStatus,
} from '../src/types/workshop.ts';
import {
  DEFAULT_SETTINGS,
  SEED_ORDERS,
  SEED_QUOTES,
  SEED_INVOICES,
  SEED_MERCHANDISE,
  SEED_POS_SALES,
  SEED_SERVICES,
} from '../src/utils/storage.ts';

export interface WorkshopDB {
  adminPasswordHash: string | null;
  settings: WorkshopSettings;
  orders: RepairOrder[];
  quotes: Quote[];
  invoices: Invoice[];
  merchandise: MerchandiseItem[];
  posSales: POSSale[];
  services: ServiceItem[];
  notifications: StatusNotification[];
}

const DATA_DIR = process.env.TEKNOVANT_DATA_DIR
  ? path.resolve(process.env.TEKNOVANT_DATA_DIR)
  : path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'workshop-db.json');

const STATUS_NAMES: Record<OrderStatus, string> = {
  recibido: 'Recibido en Taller',
  diagnostico: 'En Diagnóstico',
  espera_repuesto: 'Espera de Repuestos',
  en_reparacion: 'En Reparación',
  control_calidad: 'Pruebas / QA',
  listo: 'Listo para Entrega',
  entregado: 'Entregado al Cliente',
  cancelado: 'Cancelado',
};

export function normalizePhone(phone: string | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  // Match last 10 digits when country prefix differs (e.g. +57 315... vs 315...)
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function normalizeEmail(email: string | undefined): string {
  return (email || '').trim().toLowerCase();
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPasswordHash(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function createInitialDB(): WorkshopDB {
  return {
    adminPasswordHash: null,
    settings: structuredClone(DEFAULT_SETTINGS),
    orders: structuredClone(SEED_ORDERS),
    quotes: structuredClone(SEED_QUOTES),
    invoices: structuredClone(SEED_INVOICES),
    merchandise: structuredClone(SEED_MERCHANDISE),
    posSales: structuredClone(SEED_POS_SALES),
    services: structuredClone(SEED_SERVICES),
    notifications: [
      {
        id: 'notif-seed-1',
        orderId: 'ord-002',
        orderNumber: 'REC-2026-002',
        clientName: 'Carolina Gómez Herrera',
        clientPhone: '+57 320 654 9988',
        type: 'status_change',
        title: 'Equipo Listo para Entrega',
        message: 'Lenovo ThinkPad T14 Gen 2 superó las pruebas de estrés térmico y está listo para retiro.',
        status: 'listo',
        createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        readByAdmin: false,
        readByClient: false,
      },
    ],
  };
}

let cachedDB: WorkshopDB | null = null;

export function loadDB(): WorkshopDB {
  if (cachedDB) return cachedDB;

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      cachedDB = createInitialDB();
      saveDB(cachedDB);
      return cachedDB;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<WorkshopDB>;
    const seed = createInitialDB();
    cachedDB = {
      adminPasswordHash: parsed.adminPasswordHash ?? null,
      settings: {
        ...seed.settings,
        ...(parsed.settings || {}),
        acceptedPaymentMethods: {
          ...seed.settings.acceptedPaymentMethods!,
          ...(parsed.settings?.acceptedPaymentMethods || {}),
        },
      },
      orders: Array.isArray(parsed.orders) ? parsed.orders : seed.orders,
      quotes: Array.isArray(parsed.quotes) ? parsed.quotes : seed.quotes,
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : seed.invoices,
      merchandise: Array.isArray(parsed.merchandise) ? parsed.merchandise : seed.merchandise,
      posSales: Array.isArray(parsed.posSales) ? parsed.posSales : seed.posSales,
      services: Array.isArray(parsed.services) ? parsed.services : seed.services,
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : seed.notifications,
    };
    return cachedDB;
  } catch (err) {
    console.error('Failed to load workshop DB, falling back to seed:', err);
    cachedDB = createInitialDB();
    return cachedDB;
  }
}

export function saveDB(db: WorkshopDB): void {
  cachedDB = db;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist workshop DB:', err);
  }
}

export function computeOrderTotal(order: RepairOrder): number {
  const partsSubtotal = order.parts.reduce((acc, p) => acc + p.price * p.quantity, 0);
  const subtotal = partsSubtotal + (order.laborCost || 0);
  const taxable = Math.max(0, subtotal - (order.discount || 0));
  const tax = taxable * ((order.taxPercent || 0) / 100);
  return taxable + tax;
}

export function addNotification(
  db: WorkshopDB,
  input: Omit<StatusNotification, 'id' | 'createdAt' | 'readByAdmin' | 'readByClient'>
): StatusNotification {
  const notif: StatusNotification = {
    ...input,
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    readByAdmin: false,
    readByClient: false,
  };
  db.notifications = [notif, ...db.notifications].slice(0, 60);
  return notif;
}

export function getStatusDisplayLabel(status: OrderStatus): string {
  return STATUS_NAMES[status] || status;
}

export function isClientRecordMatch(
  recordPhone: string | undefined,
  recordEmail: string | undefined,
  clientPhone: string | undefined,
  clientEmail: string | undefined
): boolean {
  const targetPhone = normalizePhone(clientPhone);
  const targetEmail = normalizeEmail(clientEmail);
  const recPhone = normalizePhone(recordPhone);
  const recEmail = normalizeEmail(recordEmail);

  if (targetPhone && recPhone && targetPhone === recPhone) {
    return true;
  }
  if (targetEmail && recEmail && targetEmail === recEmail) {
    return true;
  }
  return false;
}

export function verifyClientAccess(
  db: WorkshopDB,
  contact: string,
  folio: string
): {
  matched: boolean;
  displayName: string;
  phone: string;
  email?: string;
} {
  const trimmedContact = contact.trim();
  const trimmedFolio = folio.trim().toLowerCase();
  if (!trimmedContact || !trimmedFolio) {
    return { matched: false, displayName: '', phone: '' };
  }

  const isEmail = trimmedContact.includes('@');
  const normEmail = isEmail ? normalizeEmail(trimmedContact) : '';
  const normPhone = !isEmail ? normalizePhone(trimmedContact) : '';

  const matchContact = (phone?: string, email?: string) => {
    if (isEmail && normEmail) {
      return normalizeEmail(email) === normEmail;
    }
    if (!isEmail && normPhone) {
      return normalizePhone(phone) === normPhone;
    }
    return false;
  };

  const matchedOrder = db.orders.find(
    (o) =>
      o.orderNumber.toLowerCase() === trimmedFolio &&
      matchContact(o.clientPhone, o.clientEmail)
  );
  if (matchedOrder) {
    return {
      matched: true,
      displayName: matchedOrder.clientName,
      phone: matchedOrder.clientPhone,
      email: matchedOrder.clientEmail,
    };
  }

  const matchedQuote = db.quotes.find(
    (q) =>
      q.quoteNumber.toLowerCase() === trimmedFolio &&
      matchContact(q.clientPhone, q.clientEmail)
  );
  if (matchedQuote) {
    return {
      matched: true,
      displayName: matchedQuote.clientName,
      phone: matchedQuote.clientPhone,
      email: matchedQuote.clientEmail,
    };
  }

  const matchedInvoice = db.invoices.find(
    (inv) =>
      inv.invoiceNumber.toLowerCase() === trimmedFolio &&
      matchContact(inv.clientPhone, inv.clientEmail)
  );
  if (matchedInvoice) {
    return {
      matched: true,
      displayName: matchedInvoice.clientName,
      phone: matchedInvoice.clientPhone,
      email: matchedInvoice.clientEmail,
    };
  }

  return { matched: false, displayName: '', phone: '' };
}

export function getClientScopedData(
  db: WorkshopDB,
  phone: string | undefined,
  email: string | undefined
) {
  const orders = db.orders.filter((o) =>
    isClientRecordMatch(o.clientPhone, o.clientEmail, phone, email)
  );
  const quotes = db.quotes.filter((q) =>
    isClientRecordMatch(q.clientPhone, q.clientEmail, phone, email)
  );
  const invoices = db.invoices.filter((inv) =>
    isClientRecordMatch(inv.clientPhone, inv.clientEmail, phone, email)
  );
  const notifications = db.notifications.filter((n) =>
    isClientRecordMatch(n.clientPhone, undefined, phone, email)
  );

  return {
    settings: {
      name: db.settings.name,
      slogan: db.settings.slogan,
      nitRfc: db.settings.nitRfc,
      phone: db.settings.phone,
      whatsapp: db.settings.whatsapp,
      email: db.settings.email,
      address: db.settings.address,
      city: db.settings.city,
      currency: db.settings.currency,
      logoUrl: db.settings.logoUrl,
      defaultWarrantyDays: db.settings.defaultWarrantyDays,
      taxRate: db.settings.taxRate,
      entryTerms: db.settings.entryTerms,
      deliveryTerms: db.settings.deliveryTerms,
      invoiceTerms: db.settings.invoiceTerms,
      ticketTerms: db.settings.ticketTerms,
      ticketFooterNote: db.settings.ticketFooterNote,
      theme: db.settings.theme,
      technicians: [],
      bankName: db.settings.bankName,
      bankAccountType: db.settings.bankAccountType,
      bankAccountNumber: db.settings.bankAccountNumber,
      bankAccountHolder: db.settings.bankAccountHolder,
      bankPaymentNotes: db.settings.bankPaymentNotes,
      cardPaymentNotes: db.settings.cardPaymentNotes,
      acceptedPaymentMethods: db.settings.acceptedPaymentMethods,
      documentFooterNote: db.settings.documentFooterNote,
      compactPrintMode: db.settings.compactPrintMode,
    } as WorkshopSettings,
    orders,
    quotes,
    invoices,
    notifications,
  };
}

export function resetServerDB(): WorkshopDB {
  const existing = loadDB();
  const fresh = createInitialDB();
  fresh.adminPasswordHash = existing.adminPasswordHash;
  saveDB(fresh);
  return fresh;
}
