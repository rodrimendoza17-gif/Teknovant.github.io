import type {
  RepairOrder,
  Quote,
  Invoice,
  WorkshopSettings,
  MerchandiseItem,
  POSSale,
  ServiceItem,
} from '../types/workshop';

const SETTINGS_KEY = 'electrofix_workshop_settings_v1';
const ORDERS_KEY = 'electrofix_orders_v1';
const QUOTES_KEY = 'electrofix_quotes_v1';
const INVOICES_KEY = 'electrofix_invoices_v1';
const MERCHANDISE_KEY = 'teknovant_merchandise_v1';
const POS_SALES_KEY = 'teknovant_pos_sales_v1';
const SERVICES_KEY = 'teknovant_services_v1';

export const DEFAULT_PAYMENT_METHODS = {
  efectivo: true,
  depositoBancario: true,
  transferencia: true,
  tarjeta: true,
  billeteraDigital: true,
};

export const DEFAULT_SETTINGS: WorkshopSettings = {
  name: 'Teknovant Labs',
  slogan: 'Ingeniería & Servicio Técnico Avanzado en Electrónica, Computación y Climatización',
  nitRfc: 'NIT: 901.884.210-9',
  phone: '+57 312 456 7890',
  whatsapp: '573124567890',
  email: 'contacto@teknovant.com',
  address: 'Av. Tecnológica 104, Hub de Innovación Digital',
  city: 'Bogotá, Colombia',
  currency: '$',
  logoUrl: '',
  defaultWarrantyDays: 90,
  taxRate: 0,
  entryTerms: `1. Teknovant Labs no responde por pérdida de datos; el cliente debe respaldar su información previamente.
2. Dispositivos no reclamados tras 60 días entrarán en proceso de custodia y abandono legal.
3. El abono inicial respalda horas de diagnóstico y repuestos solicitados bajo autorización.`,
  deliveryTerms: `1. Garantía sobre mano de obra y repuestos especificados contra defectos de fábrica.
2. Quedan excluidos daños por golpes, humedad sobrevenida, sobretensión o manipulación de terceros.
3. El cliente retira el equipo probado y en completa conformidad técnica.`,
  invoiceTerms: `1. Factura / comprobante oficial por servicio técnico, refacciones y/o mercancía suministrada.
2. Para hacer válida cualquier garantía, presente este folio junto con el equipo sin sellos violados.`,
  ticketTerms: `Garantía de 30 días en accesorios, cargadores y cables por defecto de fábrica presentando este ticket. No aplica por golpes, humedad o variación de voltaje.`,
  ticketFooterNote: '¡Gracias por su compra! Síguenos y cotiza por WhatsApp.',
  theme: 'cyber',
  technicians: [
    'Ing. Carlos Mendoza (Líder Hardware & BGA)',
    'Andrés Silva (Firmware & Microcontroladores)',
    'Diana Reyes (Microsoldadura Láser)',
    'Recepción Técnica Teknovant',
  ],
  bankName: 'Bancolombia',
  bankAccountType: 'Cuenta de Ahorros',
  bankAccountNumber: '458-921478-33',
  bankAccountHolder: 'Teknovant Labs S.A.S. (NIT 901.884.231-9)',
  bankPaymentNotes: 'Transferencias / Nequi / Daviplata al 312 456 7890. Enviar comprobante a WhatsApp.',
  cardPaymentNotes: 'Aceptamos tarjetas Débito y Crédito (Visa, Mastercard, Amex) vía terminal física o link de pago.',
  acceptedPaymentMethods: { ...DEFAULT_PAYMENT_METHODS },
  documentFooterNote: 'Documento oficial de control técnico y garantía. Conserve este comprobante para cualquier reclamación.',
  compactPrintMode: true,
  monthlySalesGoal: 5000,
  weeklySalesGoal: 1250,
};

export const SEED_ORDERS: RepairOrder[] = [
  {
    id: 'ord-001',
    orderNumber: 'REC-2026-001',
    clientName: 'Juan Pablo Martínez',
    clientPhone: '+57 315 889 1234',
    clientEmail: 'juan.pablo@gmail.com',
    clientDocId: 'CC 1024567890',
    clientAddress: 'Cra 15 # 85-20',
    deviceType: 'celular',
    brand: 'Apple',
    model: 'iPhone 14 Pro Max 256GB',
    serialOrImei: '356789123456789',
    color: 'Morado Oscuro',
    passcode: '2580',
    accessories: ['Funda de silicona', 'Sin cargador'],
    physicalCondition: 'Pantalla frontal fisurada en esquina superior derecha. Tapa trasera intacta con leves rayones normales de uso.',
    reportedFault: 'Se cayó de un metro de altura. No da imagen en pantalla (parpadea verde), pero vibra y suena al recibir llamadas.',
    technicalDiagnostic: 'Panel OLED fracturado internamente. Flex de FaceID intacto. Requiere cambio de módulo de pantalla OLED original.',
    status: 'en_reparacion',
    priority: 'alta',
    technicianAssigned: 'Diana Reyes (Microsoldadura Láser)',
    createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    estimatedDeliveryDate: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    parts: [
      { id: 'p-1', name: 'Módulo Pantalla OLED Original iPhone 14 Pro Max', cost: 140, price: 210, quantity: 1 },
      { id: 'p-2', name: 'Sello Adhesivo Contra Agua/Polvo', cost: 5, price: 10, quantity: 1 },
    ],
    laborCost: 45,
    discount: 5,
    taxPercent: 0,
    depositPaid: 80,
    initialQuotedTotal: 260,
    paymentMethod: 'transferencia',
    warrantyDays: 90,
    trackingNotes: [
      {
        id: 'tn-1',
        timestamp: new Date(Date.now() - 35 * 3600 * 1000).toISOString(),
        author: 'Recepción',
        incidentType: 'ninguno',
        title: 'Recepción del equipo',
        note: 'Ingresó iPhone 14 Pro Max con pantalla quebrada. Cliente deja abono de $80.',
        isCustomerVisible: true,
      },
      {
        id: 'tn-2',
        timestamp: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
        author: 'Diana Reyes',
        incidentType: 'prueba_exitosa',
        title: 'Diagnóstico de placa completado',
        note: 'Placa base en perfecto estado, no hay consumo anómalo de corriente. Face ID e IC de carga probados.',
        isCustomerVisible: true,
      },
      {
        id: 'tn-3',
        timestamp: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
        author: 'Diana Reyes',
        incidentType: 'retraso_repuesto',
        title: 'Llegada de pantalla del distribuidor',
        note: 'Se recibe el display OLED en laboratorio para calibración del sensor True Tone.',
        isCustomerVisible: true,
      },
    ],
  },
  {
    id: 'ord-002',
    orderNumber: 'REC-2026-002',
    clientName: 'Carolina Gómez Herrera',
    clientPhone: '+57 320 654 9988',
    clientEmail: 'carolina.gomez@empresa.co',
    clientDocId: 'CC 52899456',
    clientAddress: 'Av. El Dorado # 68C-61',
    deviceType: 'laptop',
    brand: 'Lenovo',
    model: 'ThinkPad T14 Gen 2 (Core i7 / 16GB)',
    serialOrImei: 'PF-2K908L',
    color: 'Negro Mate',
    passcode: 'Sin clave de Windows (cuenta local)',
    accessories: ['Cargador original USB-C 65W', 'Maletín'],
    physicalCondition: 'Equipo en muy buen estado estético. Teclado limpio. Bisagras firmes.',
    reportedFault: 'Se apaga repentinamente a los 15 minutos de uso intenso o al abrir muchas pestañas. El ventilador zumba con fuerza.',
    technicalDiagnostic: 'Mantenimiento térmico vencido. Pasta térmica cristalizada y rejilla de disipador obstruida de pelusa. Ventilador requiere lubricación.',
    status: 'listo',
    priority: 'normal',
    technicianAssigned: 'Ing. Carlos Mendoza (Líder Hardware & BGA)',
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    estimatedDeliveryDate: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    parts: [
      { id: 'p-3', name: 'Compuesto Térmico Artic MX-4 Alto Rendimiento', cost: 4, price: 12, quantity: 1 },
      { id: 'p-4', name: 'Thermal Pads Grado Industrial', cost: 3, price: 8, quantity: 1 },
    ],
    laborCost: 35,
    discount: 0,
    taxPercent: 0,
    depositPaid: 0,
    initialQuotedTotal: 55,
    paymentMethod: 'efectivo',
    warrantyDays: 60,
    trackingNotes: [
      {
        id: 'tn-4',
        timestamp: new Date(Date.now() - 47 * 3600 * 1000).toISOString(),
        author: 'Recepción',
        incidentType: 'ninguno',
        title: 'Ingreso para mantenimiento correctivo',
        note: 'Se recibe ThinkPad para evaluación térmica.',
        isCustomerVisible: true,
      },
      {
        id: 'tn-5',
        timestamp: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
        author: 'Carlos Mendoza',
        incidentType: 'prueba_exitosa',
        title: 'Pruebas de estrés térmico superadas',
        note: 'Temperaturas estables a 42°C en reposo y max 71°C en prueba Cinebench por 30 minutos. Ventilador silencioso. Equipo listo para entrega.',
        isCustomerVisible: true,
      },
    ],
  },
  {
    id: 'ord-003',
    orderNumber: 'REC-2026-003',
    clientName: 'Santiago Rodríguez',
    clientPhone: '+57 301 222 4545',
    clientEmail: 'santi.rod@outlook.com',
    clientDocId: 'CC 1018443900',
    deviceType: 'computador',
    brand: 'PC Gamer Custom',
    model: 'Gamer Ryzen 7 5700X / RTX 3070',
    serialOrImei: 'CUSTOM-PC-9912',
    color: 'Torre Blanca Vidrio Templado',
    passcode: 'No aplica',
    accessories: ['Cable de poder', 'Antenas WiFi'],
    physicalCondition: 'Vidrio templado sin rayas. Polvo acumulado en filtros.',
    reportedFault: 'Da pantallazos azules (BSOD) continuos con código WHEA_UNCORRECTABLE_ERROR al jugar o renderizar.',
    technicalDiagnostic: 'En revisión de banco de memorias y fuente de poder 750W con osciloscopio.',
    status: 'diagnostico',
    priority: 'urgente',
    technicianAssigned: 'Andrés Silva (Firmware & Microcontroladores)',
    createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    estimatedDeliveryDate: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    parts: [],
    laborCost: 40,
    discount: 0,
    taxPercent: 0,
    depositPaid: 20,
    initialQuotedTotal: 40,
    paymentMethod: 'nequi_daviplata',
    warrantyDays: 30,
    trackingNotes: [
      {
        id: 'tn-6',
        timestamp: new Date(Date.now() - 11 * 3600 * 1000).toISOString(),
        author: 'Andrés Silva',
        incidentType: 'falla_adicional',
        title: 'Inconsistencia en módulo RAM slot 2',
        note: 'Memtest86 reportó 142 errores en el segundo módulo de 16GB. Se probará módulo alternativo para confirmar estabilidad.',
        isCustomerVisible: true,
      },
    ],
  },
  {
    id: 'ord-004',
    orderNumber: 'REC-2026-004',
    clientName: 'Marcela Castillo',
    clientPhone: '+57 318 900 1122',
    clientEmail: 'marcela.c@yahoo.es',
    deviceType: 'consola',
    brand: 'Sony',
    model: 'PlayStation 5 Digital Edition',
    serialOrImei: 'PS5-DIG-884210',
    color: 'Blanco',
    accessories: ['Control DualSense blanco', 'Cable HDMI'],
    physicalCondition: 'Placas laterales limpias. Puerto HDMI presenta holgura evidente.',
    reportedFault: 'No envía señal al televisor. Luz azul parpadea y cambia a blanca pero pantalla queda en negro.',
    technicalDiagnostic: 'Pines 4, 7 y 19 del puerto HDMI hembra doblados y arrancados de pista.',
    status: 'espera_repuesto',
    priority: 'normal',
    technicianAssigned: 'Diana Reyes (Microsoldadura Láser)',
    createdAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    estimatedDeliveryDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    parts: [
      { id: 'p-5', name: 'Conector Puerto HDMI Reforzado PS5 OEM', cost: 8, price: 25, quantity: 1 },
    ],
    laborCost: 55,
    discount: 0,
    taxPercent: 0,
    depositPaid: 40,
    initialQuotedTotal: 80,
    paymentMethod: 'efectivo',
    warrantyDays: 60,
    trackingNotes: [
      {
        id: 'tn-7',
        timestamp: new Date(Date.now() - 70 * 3600 * 1000).toISOString(),
        author: 'Recepción',
        incidentType: 'ninguno',
        title: 'Ingreso PS5',
        note: 'Se recibe con abono de $40. Cliente autorizó reemplazo de puerto.',
        isCustomerVisible: true,
      },
      {
        id: 'tn-8',
        timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        author: 'Diana Reyes',
        incidentType: 'retraso_repuesto',
        title: 'Pedido de repuesto en camino',
        note: 'Lote de conectores HDMI PS5 original con entrega programada para mañana a primera hora.',
        isCustomerVisible: true,
      },
    ],
  },
  {
    id: 'ord-005',
    orderNumber: 'REC-2026-005',
    clientName: 'Felipe Vargas Ruiz',
    clientPhone: '+57 311 777 8899',
    clientEmail: 'felipe.vargas@correo.com',
    deviceType: 'celular',
    brand: 'Samsung',
    model: 'Galaxy S22 Ultra 5G',
    serialOrImei: '359002148765432',
    color: 'Burgundy',
    accessories: ['S-Pen integrado'],
    physicalCondition: 'Golpe fuerte en bisel inferior. Cristal de cámara trasera rayado.',
    reportedFault: 'Batería inflada que levantó la tapa trasera y el equipo no retiene carga más de 2 horas.',
    technicalDiagnostic: 'Batería con degradación al 58% y celdas hinchadas. Riesgo de perforación mitigado.',
    status: 'entregado',
    priority: 'normal',
    technicianAssigned: 'Ing. Carlos Mendoza (Líder Hardware & BGA)',
    createdAt: new Date(Date.now() - 120 * 3600 * 1000).toISOString(),
    deliveredAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    parts: [
      { id: 'p-6', name: 'Batería Original Samsung EB-BS908ABY 5000mAh', cost: 28, price: 55, quantity: 1 },
      { id: 'p-7', name: 'Adhesivo Batería y Tapa Trasera OEM', cost: 4, price: 8, quantity: 1 },
    ],
    laborCost: 30,
    discount: 5,
    taxPercent: 0,
    depositPaid: 88,
    initialQuotedTotal: 88,
    paymentMethod: 'tarjeta',
    warrantyDays: 90,
    trackingNotes: [
      {
        id: 'tn-9',
        timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        author: 'Carlos Mendoza',
        incidentType: 'prueba_exitosa',
        title: 'Entrega final realizada',
        note: 'Cliente retiró el teléfono con carga al 100%, ciclos de carga reseteados. Firma recibo de conformidad.',
        isCustomerVisible: true,
      },
    ],
  },
];

export const SEED_QUOTES: Quote[] = [
  {
    id: 'cot-001',
    quoteNumber: 'COT-2026-001',
    clientName: 'Gabriel Peñaloza',
    clientPhone: '+57 314 555 9012',
    clientEmail: 'gabriel.p@empresa.com',
    deviceDescription: 'MacBook Pro M1 14" (2021) Space Gray',
    issueDescription: 'Derrame accidental de café sobre el teclado. 6 teclas se traban y trackpad tiene respuesta intermitente.',
    createdAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    validUntil: new Date(Date.now() + 15 * 86400 * 1000).toISOString(),
    items: [
      { id: 'qi-1', description: 'Top Case con Teclado Español y Batería Ensamblada Apple OEM', unitPrice: 280, quantity: 1 },
      { id: 'qi-2', description: 'Descontaminación por ultrasonido y limpieza de corrosión en placa lógica', unitPrice: 65, quantity: 1 },
    ],
    laborCost: 75,
    discount: 20,
    taxPercent: 0,
    total: 400,
    status: 'pendiente',
    notes: 'Presupuesto incluye garantía de 90 días en teclado y componentes.',
  },
  {
    id: 'cot-002',
    quoteNumber: 'COT-2026-002',
    clientName: 'Valeria Santos',
    clientPhone: '+57 300 444 8822',
    clientEmail: 'valeria.s@correo.com',
    deviceDescription: 'iPad Pro 11 Pulgadas (3ra Gen)',
    issueDescription: 'Batería no carga más del 1% y se apaga al desconectar.',
    createdAt: new Date(Date.now() - 40 * 3600 * 1000).toISOString(),
    validUntil: new Date(Date.now() + 12 * 86400 * 1000).toISOString(),
    items: [
      { id: 'qi-3', description: 'Batería Original Li-Po iPad Pro 11"', unitPrice: 75, quantity: 1 },
      { id: 'qi-4', description: 'Adhesivos y sellado hermético', unitPrice: 12, quantity: 1 },
    ],
    laborCost: 40,
    discount: 0,
    taxPercent: 0,
    total: 127,
    status: 'aprobada',
    notes: 'Cliente aprobó vía WhatsApp el día de ayer.',
  },
];

export const SEED_INVOICES: Invoice[] = [
  {
    id: 'fac-001',
    invoiceNumber: 'FAC-2026-001',
    orderId: 'ord-005',
    orderNumber: 'REC-2026-005',
    clientName: 'Felipe Vargas Ruiz',
    clientDocId: 'CC 1014235889',
    clientPhone: '+57 311 777 8899',
    clientEmail: 'felipe.vargas@correo.com',
    clientAddress: 'Calle 100 # 19-50',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    dueDate: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    items: [
      { description: 'Batería Original Samsung EB-BS908ABY 5000mAh', quantity: 1, unitPrice: 55, total: 55 },
      { description: 'Adhesivo Batería y Tapa Trasera OEM', quantity: 1, unitPrice: 8, total: 8 },
      { description: 'Mano de obra especializada reemplazo y calibración de batería', quantity: 1, unitPrice: 30, total: 30 },
    ],
    subtotal: 93,
    discount: 5,
    tax: 0,
    total: 88,
    paymentMethod: 'tarjeta',
    paymentStatus: 'pagada',
    warrantyText: 'Garantía legal de 90 días en repuesto y mano de obra a partir de la fecha de entrega.',
  },
];

export const SEED_MERCHANDISE: MerchandiseItem[] = [
  {
    id: 'merch-001',
    sku: 'CRG-65W-GAN',
    name: 'Cargador Rápido GaN 65W Dual USB-C + USB-A',
    category: 'cargadores',
    brand: 'Baseus / Teknovant Pro',
    costPrice: 18,
    sellingPrice: 38,
    stock: 14,
    minStock: 4,
    location: 'Vitrina 1 - Nivel A',
    compatibility: 'MacBook, Laptops Dell/HP/Lenovo, iPhone, Samsung 45W',
    description: 'Tecnología GaN III ultracompacta con control térmico dinámico y protección de sobrevoltaje.',
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'merch-002',
    sku: 'CRG-20W-PD',
    name: 'Cargador Original 20W Power Delivery USB-C',
    category: 'cargadores',
    brand: 'Foxconn / Apple Cert',
    costPrice: 8,
    sellingPrice: 19,
    stock: 22,
    minStock: 5,
    location: 'Vitrina 1 - Nivel B',
    compatibility: 'iPhone 11 al 16 Pro Max, iPad Pro, AirPods',
    description: 'Carga rápida estándar de 20 Watts homologada para batería de litio.',
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: 'merch-003',
    sku: 'CRG-UNIV-90W',
    name: 'Cargador Universal para Laptop 90W con 8 Puntas Intercambiables',
    category: 'cargadores',
    brand: 'PowerTech Labs',
    costPrice: 14,
    sellingPrice: 32,
    stock: 7,
    minStock: 3,
    location: 'Bodega Repuestos Estante 2',
    compatibility: 'HP, Dell, Asus, Acer, Lenovo, Toshiba, Samsung',
    description: 'Selector automático de voltaje (18.5V - 20V) con cable de alto calibre.',
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 'merch-004',
    sku: 'CBL-TC-LTG',
    name: 'Cable USB-C a Lightning Reforzado en Nylon Blindado 1.2m',
    category: 'cables',
    brand: 'Anker / Teknovant Line',
    costPrice: 4.5,
    sellingPrice: 12,
    stock: 28,
    minStock: 6,
    location: 'Panel Colgante Cables',
    compatibility: 'iPhones con conector Lightning, soporte Carga Rápida 27W',
    description: 'Malla de nylon balístico resistente a más de 30.000 flexiones mecánicas.',
    createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    id: 'merch-005',
    sku: 'CBL-TC-TC-100W',
    name: 'Cable USB-C a USB-C 100W 5A con Display LED Digital de Watts',
    category: 'cables',
    brand: 'Toocki / Teknovant HUD',
    costPrice: 6,
    sellingPrice: 16,
    stock: 18,
    minStock: 5,
    location: 'Panel Colgante Cables',
    compatibility: 'Laptops, MacBooks, Tablets, Celulares carga ultrarrápida',
    description: 'Muestra en tiempo real la potencia de carga en Watts mediante pantalla micro-OLED integrada.',
    createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
  },
  {
    id: 'merch-006',
    sku: 'CBL-HDMI-21',
    name: 'Cable HDMI 2.1 Ultra High Speed 8K@60Hz / 4K@120Hz 2m',
    category: 'cables',
    brand: 'Ugreen / ProVision',
    costPrice: 5.5,
    sellingPrice: 14,
    stock: 12,
    minStock: 3,
    location: 'Panel Colgante Cables',
    compatibility: 'PS5, Xbox Series X, Monitores Gamer, Smart TV OLED',
    description: 'Conectores chapados en oro 24K, HDR dinámico, eARC y ancho de banda de 48 Gbps.',
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  {
    id: 'merch-007',
    sku: 'EQP-S22-128',
    name: 'Samsung Galaxy S22 5G 128GB Reacondicionado Certificado Grado A+',
    category: 'equipos',
    brand: 'Samsung',
    costPrice: 280,
    sellingPrice: 395,
    stock: 3,
    minStock: 1,
    location: 'Vitrina Seguridad Alta',
    compatibility: 'Libre para cualquier operador móvil internacional',
    description: 'Equipo 100% testeado con batería al 95% de salud, pantalla Dynamic AMOLED 2X intacta, garantía de 6 meses.',
    createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
  {
    id: 'merch-008',
    sku: 'EQP-DELL-5420',
    name: 'Laptop Dell Latitude 5420 Core i7-1185G7 16GB RAM 512GB SSD NVMe',
    category: 'equipos',
    brand: 'Dell',
    costPrice: 420,
    sellingPrice: 590,
    stock: 2,
    minStock: 1,
    location: 'Vitrina Seguridad Alta',
    compatibility: 'Windows 11 Pro con licencia oficial',
    description: 'Chasis de magnesio, batería original con 90% de ciclo de vida, cargador tipo C GaN incluido.',
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: 'merch-009',
    sku: 'AUD-TWS-ANC',
    name: 'Auriculares Inalámbricos TWS Pro con Cancelación Activa de Ruido',
    category: 'auriculares',
    brand: 'QCY / SoundPro',
    costPrice: 16,
    sellingPrice: 34,
    stock: 15,
    minStock: 4,
    location: 'Vitrina 2 - Audio',
    compatibility: 'Android, iOS, Windows, Mac',
    description: 'Cancelación híbrida de 40dB, 32 horas de autonomía total con estuche, baja latencia para gaming.',
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    id: 'merch-010',
    sku: 'ACC-PB-20K',
    name: 'Batería Portátil Powerbank 20.000mAh 22.5W Carga Bidireccional',
    category: 'accesorios',
    brand: 'Romoss / Teknovant Power',
    costPrice: 15,
    sellingPrice: 32,
    stock: 9,
    minStock: 3,
    location: 'Vitrina 2 - Accesorios',
    compatibility: 'Universal Celulares, Cámaras, Tablets',
    description: 'Permite hasta 4 cargas completas de smartphone con display porcentual de energía.',
    createdAt: new Date(Date.now() - 11 * 86400000).toISOString(),
  },
  {
    id: 'merch-011',
    sku: 'REP-LCD-IP13',
    name: 'Display Pantalla OLED iPhone 13 Pro Calidad Original TrueTone',
    category: 'pantallas',
    brand: 'GX OLED Tech',
    costPrice: 95,
    sellingPrice: 150,
    stock: 4,
    minStock: 2,
    location: 'Gaveta Repuestos Pantallas G-3',
    compatibility: 'iPhone 13 Pro (A2638, A2483)',
    description: 'Panel OLED con soporte ProMotion 120Hz y reprogramación de IC TrueTone.',
    createdAt: new Date(Date.now() - 9 * 86400000).toISOString(),
  },
  {
    id: 'merch-012',
    sku: 'FND-GLS-9D',
    name: 'Vidrio Cerámico Templado 9D Curvo Antiespía Privacidad',
    category: 'fundas_micas',
    brand: 'NanoShield 9D',
    costPrice: 1.5,
    sellingPrice: 6,
    stock: 45,
    minStock: 10,
    location: 'Panel Micas y Cristales',
    compatibility: 'Modelos iPhone 11-16 / Samsung Serie S y A',
    description: 'Ángulo de privacidad lateral de 28 grados y resistencia a impactos 9H.',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
];

export const SEED_POS_SALES: POSSale[] = [
  {
    id: 'sale-001',
    saleNumber: 'TIK-2026-001',
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    clientName: 'Andrés Camargo',
    clientDocId: 'CC 1098452140',
    clientPhone: '+57 310 987 6543',
    items: [
      {
        id: 'si-1',
        merchandiseId: 'merch-001',
        sku: 'CRG-65W-GAN',
        name: 'Cargador Rápido GaN 65W Dual USB-C + USB-A',
        category: 'cargadores',
        quantity: 1,
        unitPrice: 38,
        subtotal: 38,
      },
      {
        id: 'si-2',
        merchandiseId: 'merch-005',
        sku: 'CBL-TC-TC-100W',
        name: 'Cable USB-C a USB-C 100W 5A con Display LED Digital de Watts',
        category: 'cables',
        quantity: 1,
        unitPrice: 16,
        subtotal: 16,
      },
    ],
    subtotal: 54,
    discount: 4,
    tax: 0,
    total: 50,
    paymentMethod: 'transferencia',
    amountPaid: 50,
    changeGiven: 0,
    cashierName: 'Ing. Carlos Mendoza (Líder Hardware & BGA)',
    notes: 'Pago recibido por Nequi comprobante #490218',
  },
  {
    id: 'sale-002',
    saleNumber: 'TIK-2026-002',
    createdAt: new Date(Date.now() - 26 * 3600000).toISOString(),
    clientName: 'Cliente Mostrador',
    items: [
      {
        id: 'si-3',
        merchandiseId: 'merch-002',
        sku: 'CRG-20W-PD',
        name: 'Cargador Original 20W Power Delivery USB-C',
        category: 'cargadores',
        quantity: 1,
        unitPrice: 19,
        subtotal: 19,
      },
      {
        id: 'si-4',
        merchandiseId: 'merch-012',
        sku: 'FND-GLS-9D',
        name: 'Vidrio Cerámico Templado 9D Curvo Antiespía Privacidad',
        category: 'fundas_micas',
        quantity: 2,
        unitPrice: 6,
        subtotal: 12,
      },
    ],
    subtotal: 31,
    discount: 1,
    tax: 0,
    total: 30,
    paymentMethod: 'efectivo',
    amountPaid: 50,
    changeGiven: 20,
    cashierName: 'Recepción Técnica Teknovant',
    notes: 'Venta rápida en mostrador',
  },
];

export const SEED_SERVICES: ServiceItem[] = [
  {
    id: 'srv-001',
    name: 'Instalación Básica de Minisplit (1 a 1.5 Toneladas)',
    category: 'minisplit_clima',
    description: 'Montaje de unidad evaporadora y condensadora, interconexión de tubería de cobre hasta 3m, vacío con bomba y prueba de fugas/drenaje.',
    basePrice: 110,
    estimatedDuration: '3 - 4 horas',
    warrantyDays: 90,
    includesMaterials: 'Kit básico de instalación, taquetes, cinta momia y vacío técnico.',
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 'srv-002',
    name: 'Recarga de Gas Refrigerante Minisplit (R410A / R32 / R22)',
    category: 'minisplit_clima',
    description: 'Detección de fuga con nitrógeno, corrección de abocardado, vacío profundo y carga por peso/manómetro según especificación de placa.',
    basePrice: 65,
    estimatedDuration: '1.5 - 2 horas',
    warrantyDays: 60,
    includesMaterials: 'Hasta 1 kg de gas refrigerante ecológico + revisión de presiones.',
    createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
  {
    id: 'srv-003',
    name: 'Desinstalación y Reubicación (Cambio de Lugar) de Minisplit',
    category: 'minisplit_clima',
    description: 'Recuperación segura de gas refrigerante en condensador, desmontaje cuidadoso de unidades, traslado local y nueva instalación calibrada.',
    basePrice: 135,
    estimatedDuration: '4 - 5 horas',
    warrantyDays: 90,
    includesMaterials: 'Recuperación de gas y revisión completa de drenaje y cableado.',
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: 'srv-004',
    name: 'Mantenimiento Preventivo Profundo de Minisplit (Lavado Hidropresión)',
    category: 'minisplit_clima',
    description: 'Desarmado de turbina, lavado químico de serpentines con bolsa protectora, limpieza de charola y revisión de capacitores.',
    basePrice: 40,
    estimatedDuration: '1 - 1.5 horas',
    warrantyDays: 30,
    includesMaterials: 'Desengrasante dieléctrico y sanitizante antibacterial.',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'srv-005',
    name: 'Instalación de Kit CCTV 4 Cámaras HD/4K + Configuración App',
    category: 'redes_cctv',
    description: 'Tendido de cableado UTP, ponchado de transceptores, montaje de 4 cámaras, disco DVR/NVR y acceso remoto en celulares.',
    basePrice: 145,
    estimatedDuration: '4 - 6 horas',
    warrantyDays: 90,
    includesMaterials: 'Mano de obra, configuración P2P y calibración de ángulos.',
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 'srv-006',
    name: 'Desbloqueo Avanzado (FRP / PayJoy / Macropay / Operador AT&T)',
    category: 'desbloqueos_software',
    description: 'Liberación y remoción de bloqueos de seguridad mediante servidor autorizado o herramienta box/ISP certificada.',
    basePrice: 35,
    estimatedDuration: '30 min - 24 hrs',
    warrantyDays: 30,
    includesMaterials: 'Créditos de servidor / licencia de servicio.',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

// LocalStorage loaders and savers (retained as fallback utilities / export helpers)
export function getSettings(): WorkshopSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      saveSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      acceptedPaymentMethods: {
        ...DEFAULT_SETTINGS.acceptedPaymentMethods,
        ...(parsed.acceptedPaymentMethods || {}),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: WorkshopSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving settings', e);
  }
}

export function getOrders(): RepairOrder[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) {
      saveOrders(SEED_ORDERS);
      return SEED_ORDERS;
    }
    return JSON.parse(raw);
  } catch {
    return SEED_ORDERS;
  }
}

export function saveOrders(orders: RepairOrder[]): void {
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  } catch (e) {
    console.error('Error saving orders', e);
  }
}

export function getQuotes(): Quote[] {
  try {
    const raw = localStorage.getItem(QUOTES_KEY);
    if (!raw) {
      saveQuotes(SEED_QUOTES);
      return SEED_QUOTES;
    }
    return JSON.parse(raw);
  } catch {
    return SEED_QUOTES;
  }
}

export function saveQuotes(quotes: Quote[]): void {
  try {
    localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
  } catch (e) {
    console.error('Error saving quotes', e);
  }
}

export function getInvoices(): Invoice[] {
  try {
    const raw = localStorage.getItem(INVOICES_KEY);
    if (!raw) {
      saveInvoices(SEED_INVOICES);
      return SEED_INVOICES;
    }
    return JSON.parse(raw);
  } catch {
    return SEED_INVOICES;
  }
}

export function saveInvoices(invoices: Invoice[]): void {
  try {
    localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));
  } catch (e) {
    console.error('Error saving invoices', e);
  }
}

export function getMerchandise(): MerchandiseItem[] {
  try {
    const raw = localStorage.getItem(MERCHANDISE_KEY);
    if (!raw) {
      saveMerchandise(SEED_MERCHANDISE);
      return SEED_MERCHANDISE;
    }
    return JSON.parse(raw);
  } catch {
    return SEED_MERCHANDISE;
  }
}

export function saveMerchandise(items: MerchandiseItem[]): void {
  try {
    localStorage.setItem(MERCHANDISE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Error saving merchandise', e);
  }
}

export function getPOSSales(): POSSale[] {
  try {
    const raw = localStorage.getItem(POS_SALES_KEY);
    if (!raw) {
      savePOSSales(SEED_POS_SALES);
      return SEED_POS_SALES;
    }
    return JSON.parse(raw);
  } catch {
    return SEED_POS_SALES;
  }
}

export function savePOSSales(sales: POSSale[]): void {
  try {
    localStorage.setItem(POS_SALES_KEY, JSON.stringify(sales));
  } catch (e) {
    console.error('Error saving POS sales', e);
  }
}

export function getServices(): ServiceItem[] {
  try {
    const raw = localStorage.getItem(SERVICES_KEY);
    if (!raw) {
      saveServices(SEED_SERVICES);
      return SEED_SERVICES;
    }
    return JSON.parse(raw);
  } catch {
    return SEED_SERVICES;
  }
}

export function saveServices(services: ServiceItem[]): void {
  try {
    localStorage.setItem(SERVICES_KEY, JSON.stringify(services));
  } catch (e) {
    console.error('Error saving services', e);
  }
}

export function exportAllData(): string {
  const data = {
    settings: getSettings(),
    orders: getOrders(),
    quotes: getQuotes(),
    invoices: getInvoices(),
    merchandise: getMerchandise(),
    posSales: getPOSSales(),
    services: getServices(),
    exportDate: new Date().toISOString(),
    version: '3.0',
  };
  return JSON.stringify(data, null, 2);
}

export function importAllData(jsonData: string): boolean {
  try {
    const parsed = JSON.parse(jsonData);
    if (parsed.settings) saveSettings(parsed.settings);
    if (parsed.orders && Array.isArray(parsed.orders)) saveOrders(parsed.orders);
    if (parsed.quotes && Array.isArray(parsed.quotes)) saveQuotes(parsed.quotes);
    if (parsed.invoices && Array.isArray(parsed.invoices)) saveInvoices(parsed.invoices);
    if (parsed.merchandise && Array.isArray(parsed.merchandise)) saveMerchandise(parsed.merchandise);
    if (parsed.posSales && Array.isArray(parsed.posSales)) savePOSSales(parsed.posSales);
    if (parsed.services && Array.isArray(parsed.services)) saveServices(parsed.services);
    return true;
  } catch (e) {
    console.error('Failed to import data', e);
    return false;
  }
}

export function resetToSeedData(): void {
  saveSettings(DEFAULT_SETTINGS);
  saveOrders(SEED_ORDERS);
  saveQuotes(SEED_QUOTES);
  saveInvoices(SEED_INVOICES);
  saveMerchandise(SEED_MERCHANDISE);
  savePOSSales(SEED_POS_SALES);
  saveServices(SEED_SERVICES);
}
