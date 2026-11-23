import React, { useState } from 'react';
import {
  X,
  Phone,
  MessageSquare,
  Printer,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Send,
  Plus,
  Trash2,
  Edit2,
  Check,
  Shield,
  Smartphone,
  User,
  DollarSign,
  Wrench,
  Receipt,
  Layers,
  ArrowRight,
  Loader2,
  ExternalLink
} from 'lucide-react';
import {
  RepairOrder,
  OrderStatus,
  TrackingNote,
  IncidentType,
  PartItem,
  WorkshopSettings
} from '../types/workshop';
import {
  calculateOrderTotals,
  formatCurrency,
  openWhatsApp,
  buildWhatsAppLink,
  generateWhatsAppMessage,
  STATUS_LABELS,
  WhatsAppMessageType
} from '../utils/whatsapp';
import type { SendWhatsAppPayload } from './WhatsAppSessionView';
import { SignaturePad } from './SignaturePad';

interface OrderDetailModalProps {
  order: RepairOrder;
  settings: WorkshopSettings;
  onUpdateOrder: (updatedOrder: RepairOrder) => void;
  onDeleteOrder?: (orderId: string) => void;
  onOpenDocument: (type: 'remision_entrada' | 'recibo_entrega' | 'factura') => void;
  onEditOrder: (order: RepairOrder) => void;
  onClose: () => void;
  whatsappConnected?: boolean;
  onSendWhatsApp?: (payload: SendWhatsAppPayload) => Promise<void>;
}

const ALL_STATUSES: OrderStatus[] = [
  'recibido',
  'diagnostico',
  'espera_repuesto',
  'en_reparacion',
  'control_calidad',
  'listo',
  'entregado',
  'cancelado'
];

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  settings,
  onUpdateOrder,
  onDeleteOrder,
  onOpenDocument,
  onEditOrder,
  onClose,
  whatsappConnected = false,
  onSendWhatsApp
}) => {
  const currency = settings.currency || '$';
  const totals = calculateOrderTotals(order);

  // Active tab inside detail
  const [activeTab, setActiveTab] = useState<'tracking' | 'financials' | 'delivery'>('tracking');
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState(false);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);

  // WhatsApp composer state
  const [showWhatsAppPanel, setShowWhatsAppPanel] = useState(false);
  const [selectedMsgType, setSelectedMsgType] = useState<WhatsAppMessageType>('actualizacion_estado');
  const [customWhatsAppMsg, setCustomWhatsAppMsg] = useState('');
  const [sendingWA, setSendingWA] = useState(false);
  const [waSendError, setWaSendError] = useState<string | null>(null);

  // Add / Edit note state
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteBody, setNewNoteBody] = useState('');
  const [newNoteIncident, setNewNoteIncident] = useState<IncidentType>('ninguno');
  const [newNoteVisible, setNewNoteVisible] = useState(true);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Price adjustment note draft
  const [priceNoteDraft, setPriceNoteDraft] = useState(order.priceAdjustmentNote || '');

  // New part state
  const [partName, setPartName] = useState('');
  const [partCost, setPartCost] = useState<number>(0);
  const [partPrice, setPartPrice] = useState<number>(0);
  const [partQty, setPartQty] = useState<number>(1);

  // Delivery checkout state
  const [deliveryPaymentMethod, setDeliveryPaymentMethod] = useState<
    'efectivo' | 'deposito' | 'transferencia' | 'tarjeta' | 'nequi_daviplata' | 'otro'
  >(order.paymentMethod || 'efectivo');
  const [signatureDelivery, setSignatureDelivery] = useState<string | undefined>(order.signatureDeliveryUrl);

  // Handle status update
  const handleStatusChange = (newStatus: OrderStatus) => {
    const isNowDelivered = newStatus === 'entregado';
    const statusNote: TrackingNote = {
      id: `tn-${Date.now()}`,
      timestamp: new Date().toISOString(),
      author: settings.technicians[0] || 'Técnico',
      incidentType: isNowDelivered ? 'prueba_exitosa' : 'ninguno',
      title: `Cambio de Estado: ${STATUS_LABELS[newStatus].label}`,
      note: isNowDelivered
        ? `Equipo entregado formalmente al cliente ${order.clientName}. Total pagado: ${formatCurrency(totals.total, currency)}.`
        : `El equipo pasó al estado ${STATUS_LABELS[newStatus].label}.`,
      isCustomerVisible: true
    };

    const updated: RepairOrder = {
      ...order,
      status: newStatus,
      deliveredAt: isNowDelivered ? new Date().toISOString() : order.deliveredAt,
      trackingNotes: [...order.trackingNotes, statusNote]
    };

    onUpdateOrder(updated);

    // If marked ready or delivered, prompt to send WhatsApp
    if (newStatus === 'listo') {
      setSelectedMsgType('equipo_listo');
      setCustomWhatsAppMsg(generateWhatsAppMessage('equipo_listo', updated, undefined, settings));
      setShowWhatsAppPanel(true);
    } else if (newStatus === 'entregado') {
      setSelectedMsgType('entrega_recibo');
      setCustomWhatsAppMsg(generateWhatsAppMessage('entrega_recibo', updated, undefined, settings));
      setShowWhatsAppPanel(true);
    }
  };

  // Add / update tracking note
  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteBody.trim()) return;

    let updatedNotes: TrackingNote[];

    if (editingNoteId) {
      updatedNotes = order.trackingNotes.map(n => {
        if (n.id === editingNoteId) {
          return {
            ...n,
            title: newNoteTitle.trim(),
            note: newNoteBody.trim(),
            incidentType: newNoteIncident,
            isCustomerVisible: newNoteVisible
          };
        }
        return n;
      });
      setEditingNoteId(null);
    } else {
      const newNote: TrackingNote = {
        id: `tn-${Date.now()}`,
        timestamp: new Date().toISOString(),
        author: settings.technicians[0] || 'Técnico',
        title: newNoteTitle.trim(),
        note: newNoteBody.trim(),
        incidentType: newNoteIncident,
        isCustomerVisible: newNoteVisible
      };
      updatedNotes = [...order.trackingNotes, newNote];
    }

    const updated: RepairOrder = {
      ...order,
      trackingNotes: updatedNotes
    };

    onUpdateOrder(updated);

    // If it was an incident, offer to notify via WhatsApp
    if (newNoteIncident !== 'ninguno') {
      setSelectedMsgType('incidente');
      setCustomWhatsAppMsg(generateWhatsAppMessage('incidente', updated, undefined, settings, newNoteBody.trim()));
      setShowWhatsAppPanel(true);
    }

    setNewNoteTitle('');
    setNewNoteBody('');
    setNewNoteIncident('ninguno');
  };

  const handleEditNoteClick = (note: TrackingNote) => {
    setEditingNoteId(note.id);
    setNewNoteTitle(note.title);
    setNewNoteBody(note.note);
    setNewNoteIncident(note.incidentType);
    setNewNoteVisible(note.isCustomerVisible);
    setActiveTab('tracking');
  };

  const handleDeleteNote = (noteId: string) => {
    const updated: RepairOrder = {
      ...order,
      trackingNotes: order.trackingNotes.filter(n => n.id !== noteId)
    };
    onUpdateOrder(updated);
    setConfirmDeleteNoteId(null);
  };

  const handleSavePriceAdjustment = () => {
    const noteText = priceNoteDraft.trim();
    if (!noteText) return;
    const adjNote: TrackingNote = {
      id: `tn-${Date.now()}`,
      timestamp: new Date().toISOString(),
      author: settings.technicians[0] || 'Técnico',
      incidentType: 'costo_adicional',
      title: 'Actualización / Ajuste de Costo',
      note: `${noteText} — Nuevo total: ${formatCurrency(totals.total, currency)}.`,
      isCustomerVisible: true
    };
    const updated: RepairOrder = {
      ...order,
      priceAdjustmentNote: noteText,
      trackingNotes: [...order.trackingNotes, adjNote]
    };
    onUpdateOrder(updated);
    setSelectedMsgType('incidente');
    setCustomWhatsAppMsg(
      generateWhatsAppMessage(
        'incidente',
        updated,
        undefined,
        settings,
        `Actualización de presupuesto: ${noteText}. Nuevo total estimado: ${formatCurrency(totals.total, currency)}.`
      )
    );
    setShowWhatsAppPanel(true);
  };

  // Parts management
  const handleAddPart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partName.trim() || partPrice <= 0) return;

    const newPart: PartItem = {
      id: `p-${Date.now()}`,
      name: partName.trim(),
      cost: Number(partCost) || 0,
      price: Number(partPrice) || 0,
      quantity: Number(partQty) || 1
    };

    const updated: RepairOrder = {
      ...order,
      parts: [...order.parts, newPart]
    };

    onUpdateOrder(updated);
    setPartName('');
    setPartCost(0);
    setPartPrice(0);
    setPartQty(1);
  };

  const handleUpdatePartPrice = (partId: string, field: 'cost' | 'price' | 'quantity', value: number) => {
    const updatedParts = order.parts.map((p) =>
      p.id === partId ? { ...p, [field]: Math.max(field === 'quantity' ? 1 : 0, value) } : p
    );
    onUpdateOrder({ ...order, parts: updatedParts });
  };

  const handleDeletePart = (partId: string) => {
    const updated: RepairOrder = {
      ...order,
      parts: order.parts.filter(p => p.id !== partId)
    };
    onUpdateOrder(updated);
  };

  const handleFinishDelivery = () => {
    const updated: RepairOrder = {
      ...order,
      status: 'entregado',
      deliveredAt: new Date().toISOString(),
      paymentMethod: deliveryPaymentMethod,
      signatureDeliveryUrl: signatureDelivery,
      trackingNotes: [
        ...order.trackingNotes,
        {
          id: `tn-${Date.now()}`,
          timestamp: new Date().toISOString(),
          author: settings.technicians[0] || 'Técnico',
          incidentType: 'prueba_exitosa',
          title: 'Entrega Finalizada y Facturada',
          note: `Equipo entregado conforme al cliente. Forma de pago: ${deliveryPaymentMethod.toUpperCase()}. Saldo cancelado.`,
          isCustomerVisible: true
        }
      ]
    };

    onUpdateOrder(updated);
    onOpenDocument('recibo_entrega');
  };

  // Trigger WhatsApp dispatch
  const handleSendWhatsAppNow = async () => {
    setWaSendError(null);
    if (whatsappConnected && onSendWhatsApp) {
      setSendingWA(true);
      try {
        await onSendWhatsApp({
          toPhone: order.clientPhone,
          clientName: order.clientName,
          message: customWhatsAppMsg,
          category: 'seguimiento',
          referenceNumber: order.orderNumber
        });
        setShowWhatsAppPanel(false);
      } catch (err: unknown) {
        setWaSendError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.');
      } finally {
        setSendingWA(false);
      }
      return;
    }
    openWhatsApp(order.clientPhone, customWhatsAppMsg);
    setShowWhatsAppPanel(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto font-mono">
      <div className="relative w-full max-w-5xl bg-[#091024] border border-cyan-500/30 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col max-h-[95vh] my-auto">
        
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-cyan-500/20 px-6 py-4 bg-[#070b16] rounded-t-3xl gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-xl shadow-[0_0_15px_rgba(0,242,254,0.3)]">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-base sm:text-lg text-cyan-400">
                  {order.orderNumber}
                </span>
                <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border border-cyan-500/30 bg-[#070b16] text-cyan-300`}>
                  {STATUS_LABELS[order.status].label}
                </span>
              </div>
              <h2 className="text-sm font-semibold text-white">
                {order.brand} {order.model} • <span className="text-zinc-400 font-normal">Cliente: {order.clientName}</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Direct WhatsApp button */}
            <button
              onClick={() => {
                setCustomWhatsAppMsg(generateWhatsAppMessage('actualizacion_estado', order, undefined, settings));
                setShowWhatsAppPanel(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>

            {/* Print documents menu */}
            <button
              onClick={() => onOpenDocument('remision_entrada')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0b142c] hover:bg-[#12224d] text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold transition"
              title="Descargar Remisión de Entrada en PDF"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              <span>Remisión</span>
            </button>

            {order.status === 'entregado' || order.status === 'listo' ? (
              <button
                onClick={() => onOpenDocument('recibo_entrega')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900 rounded-xl text-xs font-bold transition"
                title="Descargar Recibo de Entrega"
              >
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Recibo Entrega</span>
              </button>
            ) : null}

            <button
              onClick={() => onEditOrder(order)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#070b16] text-zinc-300 border border-cyan-500/20 rounded-xl text-xs font-medium hover:text-white transition"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Editar</span>
            </button>

            {onDeleteOrder && (
              confirmDeleteOrder ? (
                <div className="flex items-center gap-1.5 bg-red-950/90 border border-red-500/50 rounded-xl px-2.5 py-1">
                  <span className="text-[10px] text-red-200 font-bold">¿Borrar?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteOrder(order.id);
                      onClose();
                    }}
                    className="text-[11px] font-bold text-red-300 hover:text-white underline"
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOrder(false)}
                    className="text-[11px] text-zinc-400 hover:text-white"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOrder(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-950/50 hover:bg-rose-900/70 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-medium transition"
                  title="Eliminar equipo y remisión"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Eliminar</span>
                </button>
              )
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Pipeline bar */}
        <div className="bg-[#060a14] px-6 py-2.5 border-b border-cyan-500/20 overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-max text-xs">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mr-2">
              Cambiar Fase Técnica:
            </span>
            {ALL_STATUSES.map((st) => {
              const isCurrent = order.status === st;
              return (
                <button
                  key={st}
                  onClick={() => handleStatusChange(st)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    isCurrent
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_12px_rgba(0,242,254,0.3)] border border-cyan-400'
                      : 'bg-[#091024] text-zinc-400 hover:text-white border border-cyan-500/20'
                  }`}
                >
                  {isCurrent && <Check className="w-3.5 h-3.5" />}
                  {STATUS_LABELS[st].label}
                </button>
              );
            })}
          </div>
        </div>

        {/* WhatsApp Composer Drawer / Popup */}
        {showWhatsAppPanel && (
          <div className="bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-xs text-emerald-900 dark:text-emerald-200">
                  Enviar Mensaje de WhatsApp a {order.clientName} ({order.clientPhone})
                </h4>
              </div>
              <button
                onClick={() => setShowWhatsAppPanel(false)}
                className="text-xs text-zinc-500 hover:text-zinc-700"
              >
                Cerrar
              </button>
            </div>

            {/* Template selector */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { type: 'remision_entrada', label: '📥 Remisión de Ingreso' },
                { type: 'actualizacion_estado', label: '🔔 Avance de Estado' },
                { type: 'incidente', label: '⚠️ Reportar Incidente' },
                { type: 'equipo_listo', label: '🎉 Listo para Retirar' },
                { type: 'entrega_recibo', label: '✅ Recibo y Garantía' }
              ].map((btn) => (
                <button
                  key={btn.type}
                  onClick={() => {
                    const t = btn.type as WhatsAppMessageType;
                    setSelectedMsgType(t);
                    setCustomWhatsAppMsg(generateWhatsAppMessage(t, order, undefined, settings));
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition font-medium ${
                    selectedMsgType === btn.type
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Editable message textarea */}
            <textarea
              rows={4}
              value={customWhatsAppMsg}
              onChange={(e) => setCustomWhatsAppMsg(e.target.value)}
              className="w-full text-xs font-mono p-2.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
            />

            {waSendError && (
              <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 text-[11px]">
                {waSendError}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                {whatsappConnected
                  ? '● Sesión WhatsApp conectada (envío directo automático)'
                  : '○ Sesión WhatsApp no vinculada (se abrirá WhatsApp Web)'}
              </span>

              <div className="flex items-center gap-2">
                {whatsappConnected && (
                  <a
                    href={buildWhatsAppLink(order.clientPhone, customWhatsAppMsg)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Enlace Web
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setShowWhatsAppPanel(false)}
                  className="px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={sendingWA}
                  onClick={handleSendWhatsAppNow}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                >
                  {sendingWA ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {whatsappConnected ? 'Enviar Directo Ahora' : 'Abrir WhatsApp y Enviar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6 bg-white dark:bg-zinc-900 text-xs font-medium">
          <button
            onClick={() => setActiveTab('tracking')}
            className={`py-3 px-4 border-b-2 font-bold transition flex items-center gap-2 ${
              activeTab === 'tracking'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            Bitácora de Seguimiento & Incidentes ({order.trackingNotes.length})
          </button>

          <button
            onClick={() => setActiveTab('financials')}
            className={`py-3 px-4 border-b-2 font-bold transition flex items-center gap-2 ${
              activeTab === 'financials'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Repuestos, Costos & Liquidación
          </button>

          <button
            onClick={() => setActiveTab('delivery')}
            className={`py-3 px-4 border-b-2 font-bold transition flex items-center gap-2 ${
              activeTab === 'delivery'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            Entrega, Firma & Salida
          </button>
        </div>

        {/* Scrollable Tab Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* TAB 1: Seguimiento, Incidentes y Notas */}
          {activeTab === 'tracking' && (
            <div className="space-y-6">
              
              {/* Device Quick Recap Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-zinc-50 dark:bg-zinc-850 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase font-bold">Falla Reportada:</span>
                  <p className="text-zinc-800 dark:text-zinc-200 font-medium mt-0.5">{order.reportedFault}</p>
                  <span className="text-zinc-400 block text-[10px] uppercase font-bold mt-2">PIN / Clave:</span>
                  <p className="font-mono text-zinc-700 dark:text-zinc-300">{order.passcode || 'Sin clave'}</p>
                </div>

                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase font-bold">Serial / IMEI:</span>
                  <p className="font-mono text-zinc-700 dark:text-zinc-300">{order.serialOrImei || 'No visible'}</p>
                  <span className="text-zinc-400 block text-[10px] uppercase font-bold mt-2">Accesorios:</span>
                  <p className="text-zinc-700 dark:text-zinc-300">{order.accessories.join(', ') || 'Ninguno'}</p>
                </div>

                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase font-bold">Estado Físico:</span>
                  <p className="text-zinc-700 dark:text-zinc-300 italic">{order.physicalCondition || 'Sin observaciones'}</p>
                  <span className="text-zinc-400 block text-[10px] uppercase font-bold mt-2">Técnico a cargo:</span>
                  <p className="text-blue-600 dark:text-blue-400 font-semibold">{order.technicianAssigned}</p>
                </div>
              </div>

              {/* Form to add or edit tracking note / incident */}
              <div className="bg-white dark:bg-zinc-850 p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    <Edit2 className="w-3.5 h-3.5" />
                    {editingNoteId ? 'Editar Nota de Seguimiento' : 'Añadir Nueva Nota o Incidente Técnico'}
                  </h4>
                  {editingNoteId && (
                    <button
                      onClick={() => {
                        setEditingNoteId(null);
                        setNewNoteTitle('');
                        setNewNoteBody('');
                        setNewNoteIncident('ninguno');
                      }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Cancelar Edición
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Título del Avance / Novedad:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Falla en integrado de carga, Pantalla probada OK..."
                      value={newNoteTitle}
                      onChange={(e) => setNewNoteTitle(e.target.value)}
                      className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Tipo de Incidente / Categoría:
                    </label>
                    <select
                      value={newNoteIncident}
                      onChange={(e) => setNewNoteIncident(e.target.value as IncidentType)}
                      className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-white outline-none"
                    >
                      <option value="ninguno">🟢 Avance Regular de Trabajo</option>
                      <option value="falla_adicional">⚠️ Falla Adicional Descubierta</option>
                      <option value="costo_adicional">💵 Requiere Aprobación de Costo Extra</option>
                      <option value="retraso_repuesto">⏳ Retraso de Importación / Proveedor</option>
                      <option value="cliente_contactado">📞 Cliente Notificado</option>
                      <option value="prueba_exitosa">✅ Prueba Técnica Exitosa</option>
                      <option value="otro">⚪ Otra Novedad</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Descripción Detallada de la Nota:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Escribe el reporte técnico, mediciones con multímetro, estado del repuesto o mensaje para el cliente..."
                    value={newNoteBody}
                    onChange={(e) => setNewNoteBody(e.target.value)}
                    className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 text-zinc-900 dark:text-white outline-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newNoteVisible}
                      onChange={(e) => setNewNoteVisible(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    Visible en el portal de seguimiento del cliente
                  </label>

                  <button
                    onClick={handleSaveNote}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
                  >
                    {editingNoteId ? 'Guardar Cambios' : 'Registrar Nota'}
                  </button>
                </div>
              </div>

              {/* Timeline of tracking notes */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Historial de Bitácora ({order.trackingNotes.length} eventos registrados)
                </h4>

                <div className="relative border-l-2 border-zinc-200 dark:border-zinc-800 ml-4 space-y-4">
                  {order.trackingNotes.map((note) => {
                    const isIncident = note.incidentType !== 'ninguno';

                    return (
                      <div key={note.id} className="relative pl-6 group">
                        {/* Dot indicator */}
                        <div
                          className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-zinc-900 ${
                            isIncident ? 'bg-amber-500' : 'bg-blue-600'
                          }`}
                        />

                        <div className="bg-zinc-50 dark:bg-zinc-850 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-zinc-900 dark:text-white">
                                {note.title}
                              </span>
                              {isIncident && (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded">
                                  {note.incidentType.replace('_', ' ')}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-zinc-400">
                                {new Date(note.timestamp).toLocaleString()}
                              </span>
                              <button
                                onClick={() => handleEditNoteClick(note)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-blue-600 transition"
                                title="Editar esta nota"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              {confirmDeleteNoteId === note.id ? (
                                <div className="flex items-center gap-1 text-[10px] bg-red-950/80 px-2 py-0.5 rounded border border-red-500/40">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteNote(note.id)}
                                    className="text-red-300 font-bold"
                                  >
                                    Borrar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteNoteId(null)}
                                    className="text-zinc-400"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteNoteId(note.id)}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition"
                                  title="Eliminar nota"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                            {note.note}
                          </p>

                          <div className="flex items-center justify-between pt-1 text-[10px] text-zinc-400">
                            <span>Registrado por: <strong>{note.author}</strong></span>
                            <span>{note.isCustomerVisible ? '👁️ Visible al cliente' : '🔒 Nota interna'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: Repuestos y Costos */}
          {activeTab === 'financials' && (
            <div className="space-y-6">
              
              {/* Add Part Form */}
              <div className="bg-zinc-50 dark:bg-zinc-850 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" />
                  Agregar Repuesto o Insumo Utilizado
                </h4>

                <form onSubmit={handleAddPart} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Nombre del Repuesto:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Pantalla OLED, Batería OEM, Flex de Carga..."
                      value={partName}
                      onChange={(e) => setPartName(e.target.value)}
                      className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Costo Compra ({currency}):
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={partCost || ''}
                      onChange={(e) => setPartCost(Number(e.target.value))}
                      className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Precio Venta ({currency}):
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      placeholder="0"
                      value={partPrice || ''}
                      onChange={(e) => setPartPrice(Number(e.target.value))}
                      className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-white outline-none font-bold"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
                  >
                    + Agregar
                  </button>
                </form>
              </div>

              {/* Parts Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                  Lista de Repuestos y Materiales
                </h4>

                <table className="w-full text-left text-xs border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                  <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="p-3">Repuesto</th>
                      <th className="p-3 text-center">Cant.</th>
                      <th className="p-3 text-right">Costo Interno</th>
                      <th className="p-3 text-right">Precio Cliente</th>
                      <th className="p-3 text-right">Subtotal</th>
                      <th className="p-3 text-center w-12">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {order.parts.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <td className="p-3 font-medium text-zinc-900 dark:text-white">{p.name}</td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={p.quantity}
                            onChange={(e) => handleUpdatePartPrice(p.id, 'quantity', Number(e.target.value) || 1)}
                            className="w-12 text-center rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 py-0.5 text-xs font-mono"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={p.cost}
                            onChange={(e) => handleUpdatePartPrice(p.id, 'cost', Number(e.target.value) || 0)}
                            className="w-20 text-right rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-1.5 py-0.5 text-xs font-mono text-zinc-400"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={p.price}
                            onChange={(e) => handleUpdatePartPrice(p.id, 'price', Number(e.target.value) || 0)}
                            className="w-20 text-right rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-1.5 py-0.5 text-xs font-mono font-bold"
                          />
                        </td>
                        <td className="p-3 text-right font-bold text-zinc-900 dark:text-white font-mono">
                          {formatCurrency(p.price * p.quantity, currency)}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleDeletePart(p.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {order.parts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-zinc-400 italic">
                          No se han cargado repuestos todavía a esta orden.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Editable Financial summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-850 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase">
                    Ajustes de Costo, Anticipos y Presupuesto
                  </h4>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-zinc-500 mb-1">Mano de Obra ({currency}):</label>
                      <input
                        type="number"
                        min="0"
                        value={order.laborCost}
                        onChange={(e) => onUpdateOrder({ ...order, laborCost: Number(e.target.value) || 0 })}
                        className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-zinc-900 dark:text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-500 mb-1">Descuento ({currency}):</label>
                      <input
                        type="number"
                        min="0"
                        value={order.discount}
                        onChange={(e) => onUpdateOrder({ ...order, discount: Number(e.target.value) || 0 })}
                        className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-zinc-900 dark:text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-500 mb-1">Anticipo / Abono ({currency}):</label>
                      <input
                        type="number"
                        min="0"
                        value={order.depositPaid}
                        onChange={(e) => onUpdateOrder({ ...order, depositPaid: Number(e.target.value) || 0 })}
                        className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-blue-600 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-500 mb-1">Presupuesto Inicial ({currency}):</label>
                      <input
                        type="number"
                        min="0"
                        value={order.initialQuotedTotal ?? totals.total}
                        onChange={(e) => onUpdateOrder({ ...order, initialQuotedTotal: Number(e.target.value) || 0 })}
                        className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-zinc-900 dark:text-white font-mono"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-zinc-500 mb-1">Garantía Otorgada (Días):</label>
                      <input
                        type="number"
                        min="0"
                        value={order.warrantyDays}
                        onChange={(e) => onUpdateOrder({ ...order, warrantyDays: Number(e.target.value) || 0 })}
                        className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-zinc-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t md:border-t-0 md:border-l border-zinc-200 dark:border-zinc-700 md:pl-4 text-xs">
                  <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase">
                    Liquidación de la Orden
                  </h4>

                  <div className="flex justify-between text-zinc-500">
                    <span>Subtotal Repuestos:</span>
                    <span className="font-mono">{formatCurrency(totals.partsSubtotal, currency)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Mano de Obra:</span>
                    <span className="font-mono">{formatCurrency(order.laborCost, currency)}</span>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Descuento aplicado:</span>
                      <span className="font-mono">-{formatCurrency(totals.discount, currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-sm border-t border-zinc-200 dark:border-zinc-700 pt-1 text-zinc-900 dark:text-white">
                    <span>COSTO TOTAL:</span>
                    <span className="font-mono">{formatCurrency(totals.total, currency)}</span>
                  </div>
                  <div className="flex justify-between text-blue-600 font-semibold">
                    <span>Anticipo registrado:</span>
                    <span className="font-mono">{formatCurrency(order.depositPaid, currency)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-red-600 border-t border-zinc-300 dark:border-zinc-600 pt-1">
                    <span>SALDO PENDIENTE A COBRAR:</span>
                    <span className="font-mono">{formatCurrency(totals.balanceDue, currency)}</span>
                  </div>
                </div>
              </div>

              {/* Price Increase / Adjustment Note Box */}
              <div className="bg-amber-950/25 border border-amber-500/40 p-4 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Nota por Aumento / Ajuste de Precio al Cliente
                  </h4>
                  {order.initialQuotedTotal !== undefined && totals.total > order.initialQuotedTotal && (
                    <span className="text-[11px] font-mono font-bold text-amber-200 bg-amber-900/60 px-2 py-0.5 rounded">
                      +{formatCurrency(totals.total - order.initialQuotedTotal, currency)} sobre presupuesto inicial
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-300">
                  Si durante la revisión subió el costo respecto al presupuesto inicial, explica aquí el motivo para que quede en la remisión, se notifique en tiempo real al cliente y puedas enviarlo por WhatsApp.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={priceNoteDraft}
                    onChange={(e) => setPriceNoteDraft(e.target.value)}
                    placeholder="Ej: Se detectó daño adicional en IC de carga y flex principal (+$35)."
                    className="flex-1 text-xs rounded-lg border border-amber-500/30 bg-[#070b16] px-3 py-2 text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSavePriceAdjustment}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-xs whitespace-nowrap transition cursor-pointer"
                  >
                    Registrar Ajuste & Avisar
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: Entrega, Firma y Salida */}
          {activeTab === 'delivery' && (
            <div className="space-y-6">
              
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    Proceso de Entrega y Liquidación Final
                  </h4>
                </div>
                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                  Antes de entregar el equipo, realiza las pruebas finales con el cliente, cobra el saldo pendiente ({formatCurrency(totals.balanceDue, currency)}) y solicita su firma de recibido conforme.
                </p>
              </div>

              {/* Payment method for balance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Método de Pago del Saldo:
                  </label>
                  <select
                    value={deliveryPaymentMethod}
                    onChange={(e) => setDeliveryPaymentMethod(e.target.value as any)}
                    className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-white outline-none"
                  >
                    <option value="efectivo">💵 Efectivo</option>
                    <option value="deposito">🏦 Depósito Bancario</option>
                    <option value="transferencia">📲 Transferencia Bancaria</option>
                    <option value="nequi_daviplata">📱 Nequi / Daviplata / Billetera Digital</option>
                    <option value="tarjeta">💳 Tarjeta Débito / Crédito</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Garantía Otorgada:
                  </label>
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-zinc-50 dark:bg-zinc-800 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                    🛡️ {order.warrantyDays} días de garantía técnica directa
                  </div>
                </div>
              </div>

              {/* Delivery Signature Pad */}
              <div className="space-y-2">
                <SignaturePad
                  title="Firma del Cliente de 'Recibido Conforme y Probado'"
                  initialSignature={signatureDelivery}
                  onSave={(url) => setSignatureDelivery(url)}
                  height={150}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => onOpenDocument('factura')}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-medium transition flex items-center gap-1.5"
                >
                  <Receipt className="w-4 h-4 text-blue-600" />
                  Ver Factura Formal
                </button>

                <button
                  type="button"
                  onClick={handleFinishDelivery}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Finalizar Entrega & Generar Recibo Salida
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
