import React, { useState } from 'react';
import {
  X,
  Smartphone,
  User,
  Wrench,
  DollarSign,
  PenTool,
  Calendar,
  AlertCircle,
  Plus,
  Trash2,
  CheckCircle,
  Printer,
  Shield,
  Key,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Cpu
} from 'lucide-react';
import { RepairOrder, DeviceType, Priority, WorkshopSettings } from '../types/workshop';
import { SignaturePad } from './SignaturePad';
import { formatCurrency } from '../utils/whatsapp';

interface OrderModalProps {
  orderToEdit?: RepairOrder | null;
  settings: WorkshopSettings;
  onSave: (order: RepairOrder, shouldPrint?: boolean) => void;
  onClose: () => void;
  existingCount: number;
}

const COMMON_ACCESSORIES = [
  'Cargador Original',
  'Cable USB-C / Lightning',
  'Funda / Case',
  'Chip SIM',
  'Memoria MicroSD',
  'Maletín / Bolso',
  'Control / Mando',
  'Cable de Poder'
];

const POPULAR_BRANDS = [
  'Apple', 'Samsung', 'Xiaomi', 'Motorola', 'Lenovo', 'HP', 'Dell', 'Asus', 'Sony PlayStation', 'Nintendo'
];

export const OrderModal: React.FC<OrderModalProps> = ({
  orderToEdit,
  settings,
  onSave,
  onClose,
  existingCount
}) => {
  const isEditing = !!orderToEdit;
  const currency = settings.currency || '$';

  // Wizard tab step state: 1 (Cliente), 2 (Equipo), 3 (Diagnostico), 4 (Costos & Firma)
  const [activeStep, setActiveStep] = useState<number>(1);

  // Form states
  const [clientName, setClientName] = useState(orderToEdit?.clientName || '');
  const [clientPhone, setClientPhone] = useState(orderToEdit?.clientPhone || '');
  const [clientEmail, setClientEmail] = useState(orderToEdit?.clientEmail || '');
  const [clientDocId, setClientDocId] = useState(orderToEdit?.clientDocId || '');
  const [clientAddress, setClientAddress] = useState(orderToEdit?.clientAddress || '');

  const [deviceType, setDeviceType] = useState<DeviceType>(orderToEdit?.deviceType || 'celular');
  const [brand, setBrand] = useState(orderToEdit?.brand || '');
  const [model, setModel] = useState(orderToEdit?.model || '');
  const [serialOrImei, setSerialOrImei] = useState(orderToEdit?.serialOrImei || '');
  const [color, setColor] = useState(orderToEdit?.color || '');
  const [passcode, setPasscode] = useState(orderToEdit?.passcode || '');
  const [accessories, setAccessories] = useState<string[]>(orderToEdit?.accessories || []);
  const [newAccessory, setNewAccessory] = useState('');
  const [physicalCondition, setPhysicalCondition] = useState(orderToEdit?.physicalCondition || '');
  const [reportedFault, setReportedFault] = useState(orderToEdit?.reportedFault || '');
  const [technicalDiagnostic, setTechnicalDiagnostic] = useState(orderToEdit?.technicalDiagnostic || '');

  const [priority, setPriority] = useState<Priority>(orderToEdit?.priority || 'normal');
  const [technicianAssigned, setTechnicianAssigned] = useState(
    orderToEdit?.technicianAssigned || settings.technicians[0] || 'Ingeniero de Laboratorio'
  );
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState(
    orderToEdit?.estimatedDeliveryDate
      ? orderToEdit.estimatedDeliveryDate.substring(0, 10)
      : new Date(Date.now() + 2 * 86400 * 1000).toISOString().substring(0, 10)
  );

  const [laborCost, setLaborCost] = useState<number>(orderToEdit?.laborCost || 35);
  const [depositPaid, setDepositPaid] = useState<number>(orderToEdit?.depositPaid || 0);
  const [discount, setDiscount] = useState<number>(orderToEdit?.discount || 0);
  const [warrantyDays, setWarrantyDays] = useState<number>(orderToEdit?.warrantyDays || settings.defaultWarrantyDays || 90);

  const [signatureEntryUrl, setSignatureEntryUrl] = useState<string | undefined>(orderToEdit?.signatureEntryUrl);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const toggleAccessory = (acc: string) => {
    if (accessories.includes(acc)) {
      setAccessories(accessories.filter(a => a !== acc));
    } else {
      setAccessories([...accessories, acc]);
    }
  };

  const handleAddCustomAccessory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAccessory.trim() && !accessories.includes(newAccessory.trim())) {
      setAccessories([...accessories, newAccessory.trim()]);
      setNewAccessory('');
    }
  };

  const handleSubmit = (e: React.FormEvent, shouldPrint: boolean = false) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim() || !brand.trim() || !model.trim() || !reportedFault.trim()) {
      setFormError('Por favor completa los campos obligatorios: Nombre de Cliente, Teléfono, Marca, Modelo y Falla reportada.');
      return;
    }
    setFormError(null);

    const orderNumber = orderToEdit?.orderNumber || `REC-${new Date().getFullYear()}-${String(existingCount + 1).padStart(3, '0')}`;

    const orderData: RepairOrder = {
      id: orderToEdit?.id || `ord-${Date.now()}`,
      orderNumber,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      clientEmail: clientEmail.trim() || undefined,
      clientDocId: clientDocId.trim() || undefined,
      clientAddress: clientAddress.trim() || undefined,
      deviceType,
      brand: brand.trim(),
      model: model.trim(),
      serialOrImei: serialOrImei.trim(),
      color: color.trim() || undefined,
      passcode: passcode.trim() || undefined,
      accessories,
      physicalCondition: physicalCondition.trim(),
      reportedFault: reportedFault.trim(),
      technicalDiagnostic: technicalDiagnostic.trim() || undefined,
      status: orderToEdit?.status || 'recibido',
      priority,
      technicianAssigned,
      createdAt: orderToEdit?.createdAt || new Date().toISOString(),
      estimatedDeliveryDate: estimatedDeliveryDate ? new Date(estimatedDeliveryDate).toISOString() : undefined,
      deliveredAt: orderToEdit?.deliveredAt,
      signatureEntryUrl,
      signatureDeliveryUrl: orderToEdit?.signatureDeliveryUrl,
      parts: orderToEdit?.parts || [],
      laborCost: Number(laborCost) || 0,
      discount: Number(discount) || 0,
      taxPercent: orderToEdit?.taxPercent || settings.taxRate || 0,
      depositPaid: Number(depositPaid) || 0,
      initialQuotedTotal:
        orderToEdit?.initialQuotedTotal ??
        Math.max(
          0,
          (orderToEdit?.parts || []).reduce((s, p) => s + p.price * p.quantity, 0) +
            (Number(laborCost) || 0) -
            (Number(discount) || 0)
        ),
      paymentMethod: orderToEdit?.paymentMethod || 'efectivo',
      warrantyDays: Number(warrantyDays) || 90,
      trackingNotes: orderToEdit?.trackingNotes || [
        {
          id: `tn-${Date.now()}`,
          timestamp: new Date().toISOString(),
          author: technicianAssigned,
          incidentType: 'ninguno',
          title: 'Recepción en Laboratorio Teknovant',
          note: `Equipo ingresado para diagnóstico técnico: ${reportedFault.trim()}. Abono recibido: ${formatCurrency(Number(depositPaid) || 0, currency)}.`,
          isCustomerVisible: true
        }
      ],
      quoteId: orderToEdit?.quoteId,
      invoiceNumber: orderToEdit?.invoiceNumber
    };

    onSave(orderData, shouldPrint);
  };

  const steps = [
    { num: 1, label: 'Cliente', icon: User },
    { num: 2, label: 'Dispositivo & IMEI', icon: Smartphone },
    { num: 3, label: 'Falla & Diagnóstico', icon: Wrench },
    { num: 4, label: 'Firma & Costos', icon: DollarSign },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#091024] border border-cyan-500/30 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col max-h-[94vh] my-auto">
        
        {/* Futuristic Modal Header */}
        <div className="flex items-center justify-between border-b border-cyan-500/20 px-6 py-4 bg-[#070b16] rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-xl shadow-[0_0_15px_rgba(0,242,254,0.3)]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold tracking-widest text-cyan-400 uppercase bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/30">
                  REMISIÓN DE ENTRADA
                </span>
                <span className="text-zinc-500 text-xs font-mono">• TEKNOVANT LABS</span>
              </div>
              <h2 className="font-mono font-bold text-white text-base sm:text-lg">
                {isEditing ? `Editar Orden: ${orderToEdit.orderNumber}` : 'Registrar Nuevo Equipo en Laboratorio'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Progress Bar */}
        <div className="grid grid-cols-4 border-b border-cyan-500/20 bg-[#060a14] px-4 py-2 font-mono text-xs">
          {steps.map((s) => {
            const Icon = s.icon;
            const isCurrent = activeStep === s.num;
            const isCompleted = activeStep > s.num;

            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setActiveStep(s.num)}
                className={`py-2 px-1 flex items-center justify-center gap-2 rounded-xl transition ${
                  isCurrent
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-[0_0_10px_rgba(0,242,254,0.2)]'
                    : isCompleted
                    ? 'text-emerald-400'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isCurrent ? 'bg-cyan-400 text-black' : isCompleted ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {isCompleted ? '✓' : s.num}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 overflow-y-auto space-y-5 text-xs font-mono">
          
          {/* STEP 1: INFORMACIÓN DEL CLIENTE */}
          {activeStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-cyan-400 font-bold tracking-wider">
                <User className="w-4 h-4" />
                <span>PASO 1: DATOS DE CONTACTO DEL CLIENTE</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-300 mb-1 font-bold">
                    Nombre Completo del Cliente: <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Laura Sofía Mendoza"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full rounded-xl border border-cyan-500/20 bg-[#070b16] px-3.5 py-2.5 text-white outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1 font-bold">
                    Teléfono / WhatsApp (Avisos): <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="Ej: +57 312 456 7890"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full rounded-xl border border-cyan-500/20 bg-[#070b16] px-3.5 py-2.5 text-white outline-none focus:ring-2 focus:ring-cyan-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1">
                    Cédula / DNI / NIT:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: CC 1020304050"
                    value={clientDocId}
                    onChange={(e) => setClientDocId(e.target.value)}
                    className="w-full rounded-xl border border-cyan-500/20 bg-[#070b16] px-3.5 py-2.5 text-white outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1">
                    Correo Electrónico (Opcional):
                  </label>
                  <input
                    type="email"
                    placeholder="cliente@ejemplo.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full rounded-xl border border-cyan-500/20 bg-[#070b16] px-3.5 py-2.5 text-white outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-zinc-300 mb-1">
                    Dirección de Entrega o Ciudad:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Cra 15 # 85-30 Oficina 402"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    className="w-full rounded-xl border border-cyan-500/20 bg-[#070b16] px-3.5 py-2.5 text-white outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: DISPOSITIVO, HARDWARE & IMEI */}
          {activeStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-cyan-400 font-bold tracking-wider">
                <Smartphone className="w-4 h-4" />
                <span>PASO 2: ESPECIFICACIONES DE HARDWARE & SEGURIDAD</span>
              </div>

              {/* Quick Brand Pills */}
              <div>
                <label className="block text-zinc-400 mb-1 text-[11px]">Sugerencias de Marcas Frecuentes:</label>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_BRANDS.map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBrand(b)}
                      className="px-2.5 py-1 rounded-lg bg-[#070b16] hover:bg-cyan-950 text-zinc-300 hover:text-cyan-300 border border-cyan-500/20 transition text-[11px]"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-300 mb-1 font-bold">Tipo de Dispositivo:</label>
                  <select
                    value={deviceType}
                    onChange={(e) => setDeviceType(e.target.value as DeviceType)}
                    className="w-full rounded-xl border border-cyan-500/20 bg-[#070b16] px-3 py-2.5 text-white outline-none"
                  >
                    <option value="celular">📱 Celular / Smartphone</option>
                    <option value="laptop">💻 Laptop / Portátil</option>
                    <option value="computador">🖥️ PC de Escritorio / Torre</option>
                    <option value="tablet">📟 Tablet / iPad</option>
                    <option value="consola">🎮 Consola de Videojuegos</option>
                    <option value="smartwatch">⌚ Smartwatch</option>
                    <option value="audio_tv">🔊 Audio / TV / Monitor</option>
                    <option value="otro">🔌 Otro Dispositivo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1 font-bold">
                    Marca: <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Apple, Samsung, Lenovo..."
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full rounded-xl border border-cyan-500/20 bg-[#070b16] px-3.5 py-2.5 text-white outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1 font-bold">
                    Modelo Exacto: <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: iPhone 14 Pro Max 256GB"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-xl border border-cyan-500/20 bg-[#070b16] px-3.5 py-2.5 text-white outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1">Serial / IMEI:</label>
                  <input
                    type="text"
                    placeholder="Ej: 356789123456789"
                    value={serialOrImei}
                    onChange={(e) => setSerialOrImei(e.target.value)}
                    className="w-full rounded-xl border border-cyan-500/20 bg-[#070b16] px-3.5 py-2.5 text-white outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1">Color del Equipo:</label>
                  <input
                    type="text"
                    placeholder="Ej: Gris Titanio / Space Gray"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full rounded-xl border border-cyan-500/20 bg-[#070b16] px-3.5 py-2.5 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    PIN / Clave o Patrón:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 2580 o L invertida"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="w-full rounded-xl border border-cyan-500/20 bg-[#070b16] px-3.5 py-2.5 text-amber-300 outline-none font-mono"
                  />
                </div>
              </div>

              {/* Physical Condition */}
              <div>
                <label className="block text-zinc-300 mb-1">
                  Estado Físico / Estético al Ingresar:
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Bisel con golpe en esquina superior, pantalla estrellada pero táctil responde, sin tornillos inferiores..."
                  value={physicalCondition}
                  onChange={(e) => setPhysicalCondition(e.target.value)}
                  className="w-full rounded-xl border border-cyan-500/20 bg-[#070b16] p-3 text-white outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>
            </div>
          )}

          {/* STEP 3: FALLA, DIAGNÓSTICO & ACCESORIOS */}
          {activeStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-cyan-400 font-bold tracking-wider">
                <Wrench className="w-4 h-4" />
                <span>PASO 3: FALLA REPORTADA & ASIGNACIÓN TÉCNICA</span>
              </div>

              <div>
                <label className="block text-zinc-300 mb-1 font-bold">
                  Falla o Problema Reportado por el Cliente: <span className="text-cyan-400">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Ej: Se apagó tras caer en líquido. No reacciona a la carga y calienta cerca del procesador."
                  value={reportedFault}
                  onChange={(e) => setReportedFault(e.target.value)}
                  className="w-full rounded-xl border border-cyan-500/20 bg-[#070b16] p-3 text-white outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1">
                  Diagnóstico Preliminar de Laboratorio (Opcional):
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Posible cortocircuito en línea VDD_MAIN. Requiere inspección térmica y baño de ultrasonido."
                  value={technicalDiagnostic}
                  onChange={(e) => setTechnicalDiagnostic(e.target.value)}
                  className="w-full rounded-xl border border-cyan-500/20 bg-[#070b16] p-3 text-white outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              {/* Accesorios Checklist */}
              <div>
                <label className="block text-zinc-300 mb-1.5 font-bold">
                  Accesorios que Entrega el Cliente:
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_ACCESSORIES.map((acc) => {
                    const isSelected = accessories.includes(acc);
                    return (
                      <button
                        key={acc}
                        type="button"
                        onClick={() => toggleAccessory(acc)}
                        className={`text-xs px-3 py-1.5 rounded-xl border transition ${
                          isSelected
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-400 shadow-[0_0_10px_rgba(0,242,254,0.3)] font-bold'
                            : 'bg-[#070b16] text-zinc-400 border-cyan-500/20 hover:border-cyan-500/40'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '} {acc}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 mt-2 max-w-sm">
                  <input
                    type="text"
                    placeholder="Otro accesorio..."
                    value={newAccessory}
                    onChange={(e) => setNewAccessory(e.target.value)}
                    className="text-xs rounded-xl border border-cyan-500/20 bg-[#070b16] px-3 py-1.5 text-white outline-none flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomAccessory}
                    className="px-3 py-1.5 bg-[#0b142c] text-cyan-300 border border-cyan-500/30 rounded-xl font-bold"
                  >
                    + Agregar
                  </button>
                </div>
              </div>

              {/* Assignee & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-zinc-300 mb-1 font-bold">Prioridad:</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="w-full rounded-xl border border-cyan-500/20 bg-[#070b16] px-3 py-2 text-white outline-none"
                  >
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">🔥 Urgente / Prioridad Máxima</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1 font-bold">Ingeniero Asignado:</label>
                  <select
                    value={technicianAssigned}
                    onChange={(e) => setTechnicianAssigned(e.target.value)}
                    className="w-full rounded-xl border border-cyan-500/20 bg-[#070b16] px-3 py-2 text-white outline-none"
                  >
                    {settings.technicians.map((t, idx) => (
                      <option key={idx} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: COSTOS & FIRMA DIGITAL */}
          {activeStep === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-cyan-400 font-bold tracking-wider">
                <DollarSign className="w-4 h-4" />
                <span>PASO 4: LIQUIDACIÓN PRELIMINAR & FIRMA DIGITAL</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#070b16] p-4 rounded-2xl border border-cyan-500/20">
                <div>
                  <label className="block text-zinc-400 mb-1">Mano de Obra ({currency}):</label>
                  <input
                    type="number"
                    min="0"
                    value={laborCost}
                    onChange={(e) => setLaborCost(Number(e.target.value))}
                    className="w-full rounded-xl border border-cyan-500/20 bg-[#091024] px-3 py-2 text-white outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Abono Inicial ({currency}):</label>
                  <input
                    type="number"
                    min="0"
                    value={depositPaid}
                    onChange={(e) => setDepositPaid(Number(e.target.value))}
                    className="w-full rounded-xl border border-cyan-500/20 bg-[#091024] px-3 py-2 text-cyan-400 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Garantía (Días):</label>
                  <input
                    type="number"
                    min="0"
                    value={warrantyDays}
                    onChange={(e) => setWarrantyDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-cyan-500/20 bg-[#091024] px-3 py-2 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Fecha Entrega Estimada:</label>
                  <input
                    type="date"
                    value={estimatedDeliveryDate}
                    onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                    className="w-full rounded-xl border border-cyan-500/20 bg-[#091024] px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              {/* Digital Signature Pad */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-cyan-400" />
                    Firma del Cliente al Ingresar (Aceptación de condiciones):
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSignaturePad(!showSignaturePad)}
                    className="text-cyan-400 underline"
                  >
                    {showSignaturePad ? 'Ocultar canvas' : 'Abrir recuadro de firma'}
                  </button>
                </div>

                {showSignaturePad && (
                  <div className="bg-white rounded-2xl p-2 border border-cyan-500/40">
                    <SignaturePad
                      title="Firma del cliente con dedo o lápiz"
                      initialSignature={signatureEntryUrl}
                      onSave={(url) => setSignatureEntryUrl(url)}
                      height={140}
                    />
                  </div>
                )}

                {signatureEntryUrl && !showSignaturePad && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-between text-emerald-300">
                    <span>✓ Firma digital capturada con éxito</span>
                    <button type="button" onClick={() => setShowSignaturePad(true)} className="underline text-xs">
                      Modificar firma
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stepper Footer Navigation */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 border-t border-cyan-500/20">
            <div className="flex items-center gap-2">
              {activeStep > 1 && (
                <button
                  type="button"
                  onClick={() => setActiveStep(activeStep - 1)}
                  className="px-4 py-2.5 rounded-xl bg-[#070b16] hover:bg-[#0c1630] text-zinc-300 border border-cyan-500/20 font-bold flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </button>
              )}

              {activeStep < 4 && (
                <button
                  type="button"
                  onClick={() => setActiveStep(activeStep + 1)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,242,254,0.3)]"
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
              {formError && (
                <div className="text-[11px] text-rose-300 bg-rose-950/70 border border-rose-500/40 px-3 py-1.5 rounded-lg">
                  {formError}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, true)}
                  className="px-4 py-2.5 bg-[#0b142c] hover:bg-[#12224d] text-cyan-300 border border-cyan-500/30 rounded-xl font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Guardar e Imprimir
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 hover:from-cyan-300 hover:to-indigo-500 text-white font-extrabold rounded-xl shadow-[0_0_20px_rgba(0,242,254,0.4)] border border-cyan-300/40"
                >
                  {isEditing ? 'Actualizar Orden' : 'Emitir Remisión'}
                </button>
              </div>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
