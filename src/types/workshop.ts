export type DeviceType =
  | 'celular'
  | 'computador'
  | 'laptop'
  | 'tablet'
  | 'consola'
  | 'smartwatch'
  | 'audio_tv'
  | 'otro';

export type OrderStatus =
  | 'recibido'
  | 'diagnostico'
  | 'espera_repuesto'
  | 'en_reparacion'
  | 'control_calidad'
  | 'listo'
  | 'entregado'
  | 'cancelado';

export type Priority = 'normal' | 'alta' | 'urgente';

export type IncidentType =
  | 'ninguno'
  | 'retraso_repuesto'
  | 'falla_adicional'
  | 'costo_adicional'
  | 'cliente_contactado'
  | 'prueba_exitosa'
  | 'otro';

export interface TrackingNote {
  id: string;
  timestamp: string;
  author: string;
  incidentType: IncidentType;
  title: string;
  note: string;
  isCustomerVisible: boolean;
}

export interface PartItem {
  id: string;
  name: string;
  cost: number;
  price: number;
  quantity: number;
}

export interface RepairOrder {
  id: string;
  orderNumber: string; // Ej: REC-2026-001
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  clientDocId?: string; // Cédula / DNI / NIT
  clientAddress?: string;

  // Device Info
  deviceType: DeviceType;
  brand: string;
  model: string;
  serialOrImei: string;
  color?: string;
  passcode?: string;
  patternCode?: string; // Patrón desbloqueo ej: "1-2-5-8"
  accessories: string[]; // Cargador, Funda, SIM, Tarjeta SD, etc.
  physicalCondition: string; // Rayas, pantalla rota, tapa rota, etc.
  reportedFault: string; // Motivo de ingreso
  technicalDiagnostic?: string; // Diagnóstico técnico

  // Order Lifecycle
  status: OrderStatus;
  priority: Priority;
  technicianAssigned: string;
  createdAt: string;
  estimatedDeliveryDate?: string;
  deliveredAt?: string;

  // Signatures
  signatureEntryUrl?: string; // Firma cliente entrada
  signatureDeliveryUrl?: string; // Firma cliente recibido conforme

  // Costs
  parts: PartItem[];
  laborCost: number;
  discount: number;
  taxPercent: number; // e.g. 0 o 19%
  depositPaid: number; // Abono / anticipo
  initialQuotedTotal?: number; // Presupuesto inicial al ingresar
  priceAdjustmentNote?: string; // Nota explicativa si el precio subió respecto al inicial
  paymentMethod?: 'efectivo' | 'transferencia' | 'deposito' | 'tarjeta' | 'nequi_daviplata' | 'otro';
  warrantyDays: number; // Ej: 30, 60, 90 días

  // Incident / Tracking History
  trackingNotes: TrackingNote[];

  // Related IDs
  quoteId?: string;
  invoiceNumber?: string;
}

export interface QuoteItem {
  id: string;
  description: string;
  unitPrice: number;
  quantity: number;
}

export interface Quote {
  id: string;
  quoteNumber: string; // COT-2026-001
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  deviceDescription: string;
  issueDescription: string;
  createdAt: string;
  validUntil: string;
  items: QuoteItem[];
  laborCost: number;
  discount: number;
  taxPercent: number;
  total: number;
  status: 'pendiente' | 'aprobada' | 'rechazada' | 'convertida';
  convertedOrderId?: string;
  notes?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // FAC-2026-001
  orderId?: string;
  orderNumber?: string;
  clientName: string;
  clientDocId?: string;
  clientPhone: string;
  clientEmail?: string;
  clientAddress?: string;
  createdAt: string;
  dueDate: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  paymentStatus: 'pagada' | 'pendiente' | 'anulada';
  warrantyText: string;
}

export type AppTheme = 'blue' | 'dark_slate' | 'emerald' | 'amber' | 'purple' | 'cyber';

export interface AcceptedPaymentMethods {
  efectivo: boolean;
  depositoBancario: boolean;
  transferencia: boolean;
  tarjeta: boolean;
  billeteraDigital: boolean;
}

export interface WorkshopSettings {
  name: string;
  slogan: string;
  nitRfc: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  currency: string; // $, COP $, MXN $, €, S/.
  logoUrl: string;
  defaultWarrantyDays: number;
  taxRate: number; // Ej 0 o 19
  entryTerms: string;
  deliveryTerms: string;
  invoiceTerms?: string;
  ticketTerms?: string;
  ticketFooterNote?: string;
  theme: AppTheme;
  technicians: string[];
  // Datos bancarios, tipos de cobro y configuración de hoja impresa
  bankName?: string;
  bankAccountType?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  bankPaymentNotes?: string;
  cardPaymentNotes?: string;
  acceptedPaymentMethods?: AcceptedPaymentMethods;
  documentFooterNote?: string;
  compactPrintMode?: boolean;
  // Metas de ventas
  monthlySalesGoal?: number;
  weeklySalesGoal?: number;
}

// -------------------------------------------------------------------
// SERVICES CATALOG TYPES (Minisplits, Gas, Instalaciones, Domicilio, etc.)
// -------------------------------------------------------------------
export type ServiceCategory =
  | 'minisplit_clima'
  | 'redes_cctv'
  | 'electricidad'
  | 'desbloqueos_software'
  | 'consolas_microsoldadura'
  | 'otro';

export interface ServiceItem {
  id: string;
  name: string;
  category: ServiceCategory;
  description: string;
  basePrice: number;
  estimatedDuration: string;
  warrantyDays: number;
  includesMaterials?: string;
  createdAt: string;
}

// -------------------------------------------------------------------
// MERCHANDISE / INVENTORY TYPES
// -------------------------------------------------------------------
export type MerchandiseCategory =
  | 'cargadores'
  | 'cables'
  | 'equipos'
  | 'auriculares'
  | 'fundas_micas'
  | 'memorias'
  | 'baterias'
  | 'pantallas'
  | 'accesorios'
  | 'otro';

export interface MerchandiseItem {
  id: string;
  sku: string; // Código de barras o SKU interno ej: "CRG-20W-01"
  name: string;
  category: MerchandiseCategory;
  brand?: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  location?: string; // Ej: "Vitrina 1", "Bodega B"
  description?: string;
  compatibility?: string; // Ej: "Universal USB-C", "iPhone 11-15"
  createdAt: string;
  updatedAt?: string;
}

// -------------------------------------------------------------------
// POINT OF SALE (POS) & TICKET TYPES
// -------------------------------------------------------------------
export interface POSCartItem {
  merchandise: MerchandiseItem;
  quantity: number;
  unitPrice: number;
  discount: number; // Monto de descuento
}

export interface POSSaleItem {
  id: string;
  merchandiseId: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export type POSPaymentMethod = 'efectivo' | 'deposito' | 'transferencia' | 'tarjeta' | 'nequi_daviplata' | 'mixto';

export interface POSSale {
  id: string;
  saleNumber: string; // Ej: TIK-2026-001
  createdAt: string;
  clientName: string;
  clientDocId?: string;
  clientPhone?: string;
  items: POSSaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: POSPaymentMethod;
  amountPaid: number; // Monto entregado por el cliente
  changeGiven: number; // Cambio / devuelta
  cashierName: string;
  notes?: string;
}

// -------------------------------------------------------------------
// REAL-TIME NOTIFICATIONS & AUTH SESSION TYPES
// -------------------------------------------------------------------
export interface StatusNotification {
  id: string;
  orderId?: string;
  orderNumber?: string;
  clientName: string;
  clientPhone: string;
  type: 'status_change' | 'price_adjustment' | 'new_order' | 'quote_ready' | 'invoice_paid';
  title: string;
  message: string;
  status?: OrderStatus;
  createdAt: string;
  readByAdmin: boolean;
  readByClient: boolean;
}

export interface AuthUser {
  role: 'admin' | 'client';
  displayName: string;
  phone?: string;
  email?: string;
}

// -------------------------------------------------------------------
// WHATSAPP LINKED SESSION & DIRECT DISPATCH TYPES
// -------------------------------------------------------------------
export type WhatsAppConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'qr_ready'
  | 'pairing_code_ready'
  | 'connected'
  | 'error';

export interface WhatsAppSessionState {
  status: WhatsAppConnectionStatus;
  qrDataUrl?: string | null;
  pairingCode?: string | null;
  connectedPhone?: string | null;
  connectedName?: string | null;
  lastError?: string | null;
  updatedAt: string;
}

export interface WhatsAppDispatchLog {
  id: string;
  toPhone: string;
  clientName: string;
  category: 'cotizacion' | 'factura' | 'seguimiento' | 'manual';
  referenceNumber?: string;
  messagePreview: string;
  status: 'sent' | 'failed';
  error?: string;
  sentAt: string;
}

