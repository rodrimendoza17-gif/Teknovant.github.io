import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Send,
  Printer,
  ArrowRight,
  Search,
  Sparkles,
  Loader2,
  AlertTriangle,
  Check
} from 'lucide-react';
import { Quote, QuoteItem, WorkshopSettings } from '../types/workshop';
import { formatCurrency, openWhatsApp, generateWhatsAppMessage } from '../utils/whatsapp';
import type { SendWhatsAppPayload } from './WhatsAppSessionView';
import { api } from '../utils/api';
import {
  AIMarketQuotePanel,
  AppliedAIQuotePayload,
  MarketQuoteAnalysis
} from './AIMarketQuotePanel';

interface QuotesViewProps {
  quotes: Quote[];
  settings: WorkshopSettings;
  onSaveQuote: (quote: Quote) => void;
  onDeleteQuote: (quoteId: string) => void;
  onConvertQuoteToOrder: (quote: Quote) => void;
  onPrintQuote: (quote: Quote) => void;
  initialDraft?: AppliedAIQuotePayload | null;
  onClearDraft?: () => void;
  whatsappConnected?: boolean;
  onSendWhatsApp?: (payload: SendWhatsAppPayload) => Promise<void>;
}

export const QuotesView: React.FC<QuotesViewProps> = ({
  quotes,
  settings,
  onSaveQuote,
  onDeleteQuote,
  onConvertQuoteToOrder,
  onPrintQuote,
  initialDraft,
  onClearDraft,
  whatsappConnected = false,
  onSendWhatsApp
}) => {
  const currency = settings.currency || '$';
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sendingQuoteId, setSendingQuoteId] = useState<string | null>(null);
  const [sentQuoteId, setSentQuoteId] = useState<string | null>(null);

  // New quote form state
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [deviceDescription, setDeviceDescription] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [validDays, setValidDays] = useState(15);
  const [laborCost, setLaborCost] = useState<number>(30);
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Items in quote
  const [items, setItems] = useState<QuoteItem[]>([
    { id: '1', description: 'Diagnóstico y mano de obra preliminar', unitPrice: 30, quantity: 1 }
  ]);
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemPrice, setNewItemPrice] = useState<number>(0);
  const [newItemQty, setNewItemQty] = useState<number>(1);

  // Inline AI helper inside the New Quote Modal
  const [modalAILoading, setModalAILoading] = useState(false);
  const [modalAIError, setModalAIError] = useState<string | null>(null);
  const [modalAIResult, setModalAIResult] = useState<MarketQuoteAnalysis | null>(null);

  const filteredQuotes = quotes.filter(q =>
    q.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.deviceDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.clientPhone.includes(searchTerm)
  );

  const calculateTotal = (itemList: QuoteItem[], labor: number, disc: number) => {
    const itemsTotal = itemList.reduce((acc, it) => acc + (it.unitPrice * it.quantity), 0);
    return Math.max(0, itemsTotal + labor - disc);
  };

  const handleApplyAIQuote = (payload: AppliedAIQuotePayload) => {
    setDeviceDescription(payload.deviceDescription);
    setIssueDescription(payload.issueDescription);
    setItems(payload.items);
    setLaborCost(payload.laborCost);
    setNotes(payload.notes);
    setModalAIResult(null);
    setModalAIError(null);
    setFormError(null);
    setShowNewModal(true);
  };

  useEffect(() => {
    if (initialDraft) {
      handleApplyAIQuote(initialDraft);
      if (onClearDraft) onClearDraft();
    }
  }, [initialDraft]);

  const handleConsultAIInModal = async () => {
    if (!deviceDescription.trim() && !issueDescription.trim()) {
      setModalAIError('Escribe primero la descripción del equipo y la falla o servicio a cotizar.');
      return;
    }

    setModalAILoading(true);
    setModalAIError(null);

    try {
      const data = await api.requestMarketQuote({
        device: deviceDescription.trim(),
        query: issueDescription.trim() || deviceDescription.trim(),
        category: 'general',
        region: settings.city || 'México / Latinoamérica',
        currency: settings.currency || 'MXN ($)',
        workshopName: settings.name,
        provider: 'gemini'
      });

      setModalAIResult(data.quoteAnalysis as MarketQuoteAnalysis);
    } catch (err: unknown) {
      setModalAIError(err instanceof Error ? err.message : 'Error consultando precios IA.');
    } finally {
      setModalAILoading(false);
    }
  };

  const applyModalTier = (tierKey: 'economico' | 'recomendado' | 'premium') => {
    if (!modalAIResult) return;
    const tier = modalAIResult.tiers[tierKey];
    if (!tier) return;

    if (tier.partsPrice > 0) {
      setItems([
        {
          id: `qi-${Date.now()}-ai`,
          description: `${modalAIResult.serviceTitle} — ${tier.label}`,
          unitPrice: Math.round(tier.partsPrice),
          quantity: 1
        }
      ]);
    } else if (modalAIResult.suggestedLineItems?.length > 0) {
      setItems(
        modalAIResult.suggestedLineItems.map((it, idx) => ({
          id: `qi-${Date.now()}-${idx}`,
          description: it.description,
          unitPrice: Math.round(it.unitPrice),
          quantity: it.quantity || 1
        }))
      );
    }

    setLaborCost(Math.round(tier.laborPrice || 0));
    if (modalAIResult.technicalWarnings?.length > 0) {
      setNotes(modalAIResult.technicalWarnings.join(' | '));
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemDesc.trim() || newItemPrice <= 0) return;
    setItems([
      ...items,
      {
        id: `qi-${Date.now()}`,
        description: newItemDesc.trim(),
        unitPrice: Number(newItemPrice),
        quantity: Number(newItemQty) || 1
      }
    ]);
    setNewItemDesc('');
    setNewItemPrice(0);
    setNewItemQty(1);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const handleCreateQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim() || !deviceDescription.trim()) {
      setFormError('Por favor complete el nombre, teléfono del cliente y descripción del equipo o servicio.');
      return;
    }
    setFormError(null);

    const total = calculateTotal(items, Number(laborCost) || 0, Number(discount) || 0);
    const quoteNumber = `COT-${new Date().getFullYear()}-${String(quotes.length + 1).padStart(3, '0')}`;

    const newQuote: Quote = {
      id: `cot-${Date.now()}`,
      quoteNumber,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      clientEmail: clientEmail.trim() || undefined,
      deviceDescription: deviceDescription.trim(),
      issueDescription: issueDescription.trim(),
      createdAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + validDays * 86400 * 1000).toISOString(),
      items,
      laborCost: Number(laborCost) || 0,
      discount: Number(discount) || 0,
      taxPercent: settings.taxRate || 0,
      total,
      status: 'pendiente',
      notes: notes.trim() || undefined
    };

    onSaveQuote(newQuote);
    setShowNewModal(false);

    // Reset form
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setDeviceDescription('');
    setIssueDescription('');
    setNotes('');
    setModalAIResult(null);
    setModalAIError(null);
    setItems([{ id: '1', description: 'Diagnóstico y servicio', unitPrice: 30, quantity: 1 }]);
  };

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="hud-panel p-4 rounded-3xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Buscar cotizaciones por número (COT-2026-...), cliente o equipo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs font-mono rounded-2xl border border-cyan-500/20 bg-[#070b16] text-white outline-none focus:ring-2 focus:ring-cyan-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAIPanel(!showAIPanel)}
            className={`flex items-center justify-center gap-2 font-mono font-bold px-4 py-2.5 rounded-xl text-xs border transition cursor-pointer ${
              showAIPanel
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-400/60 shadow-[0_0_15px_rgba(0,242,254,0.2)]'
                : 'bg-[#070b16] text-zinc-300 border-zinc-700 hover:border-cyan-500/40'
            }`}
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            {showAIPanel ? 'Ocultar Cotizador IA' : 'Cotizador Mercado IA'}
          </button>

          <button
            onClick={() => {
              setModalAIResult(null);
              setModalAIError(null);
              setShowNewModal(true);
            }}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-white font-mono font-bold px-4 py-2.5 rounded-xl text-xs shadow-[0_0_15px_rgba(0,242,254,0.3)] transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + Nueva Cotización
          </button>
        </div>
      </div>

      {/* AI Market Quote Studio */}
      {showAIPanel && (
        <AIMarketQuotePanel
          settings={settings}
          onApplyToNewQuote={handleApplyAIQuote}
        />
      )}

      {/* Quotes Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredQuotes.map((q) => {
          const isExpired = new Date(q.validUntil).getTime() < Date.now();

          return (
            <div
              key={q.id}
              className="bg-white dark:bg-zinc-850 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                    {q.quoteNumber}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      q.status === 'aprobada'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : q.status === 'convertida'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : q.status === 'rechazada'
                        ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {q.status === 'convertida' ? 'Orden Creada' : q.status}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                    {q.deviceDescription}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Cliente: <strong>{q.clientName}</strong> ({q.clientPhone})
                  </p>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-lg text-xs text-zinc-600 dark:text-zinc-400 italic">
                  "{q.issueDescription}"
                </div>

                <div className="text-xs space-y-1">
                  <div className="flex justify-between text-zinc-500">
                    <span>Ítems / Repuestos:</span>
                    <span>{q.items.length} conceptos</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Válida hasta:</span>
                    <span className={isExpired ? 'text-red-500 font-bold' : ''}>
                      {new Date(q.validUntil).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between font-extrabold text-sm text-zinc-950 dark:text-white pt-1 border-t border-zinc-100 dark:border-zinc-800">
                    <span>Total Presupuestado:</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">
                      {formatCurrency(q.total, currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={sendingQuoteId === q.id}
                    onClick={async () => {
                      const msg = generateWhatsAppMessage('cotizacion', undefined, q, settings);
                      if (whatsappConnected && onSendWhatsApp) {
                        setSendingQuoteId(q.id);
                        try {
                          await onSendWhatsApp({
                            toPhone: q.clientPhone,
                            clientName: q.clientName,
                            message: msg,
                            category: 'cotizacion',
                            referenceNumber: q.quoteNumber
                          });
                          setSentQuoteId(q.id);
                          setTimeout(() => setSentQuoteId((curr) => (curr === q.id ? null : curr)), 3000);
                        } catch {
                          // fallback handled via toast
                        } finally {
                          setSendingQuoteId(null);
                        }
                      } else {
                        openWhatsApp(q.clientPhone, msg);
                      }
                    }}
                    className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-xs font-semibold px-2 py-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition disabled:opacity-60 cursor-pointer"
                    title={whatsappConnected ? 'Enviar directo desde tu sesión de WhatsApp' : 'Abrir en WhatsApp Web'}
                  >
                    {sendingQuoteId === q.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : sentQuoteId === q.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    {sentQuoteId === q.id ? 'Enviado' : 'WhatsApp'}
                  </button>

                  <button
                    onClick={() => onPrintQuote(q)}
                    className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 text-xs font-semibold px-2 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    title="Descargar PDF Cotización"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    PDF
                  </button>

                  {confirmDeleteId === q.id ? (
                    <div className="flex items-center gap-1 bg-red-950/80 border border-red-500/40 rounded-lg px-2 py-1">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteQuote(q.id);
                          setConfirmDeleteId(null);
                        }}
                        className="text-[10px] font-bold text-red-300 hover:text-white"
                      >
                        Eliminar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-[10px] text-zinc-400 hover:text-white ml-1"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(q.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                      title="Eliminar Cotización"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {q.status !== 'convertida' && (
                  <button
                    onClick={() => onConvertQuoteToOrder(q)}
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-xs"
                  >
                    <span>Convertir a Orden</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredQuotes.length === 0 && (
          <div className="col-span-full text-center py-12 text-zinc-400 text-sm">
            No hay cotizaciones registradas. Usa el <strong>Cotizador IA de Mercado</strong> arriba o pulsa en "+ Nueva Cotización".
          </div>
        )}
      </div>

      {/* Modal New Quote */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] my-auto">
            
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 bg-zinc-50 dark:bg-zinc-950 rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600 text-white rounded-xl">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-white text-base">Crear Nueva Cotización Formal</h3>
                  <p className="text-xs text-zinc-500">Desglosa piezas, mano de obra y envíalo directo por WhatsApp.</p>
                </div>
              </div>

              <button onClick={() => setShowNewModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <Trash2 className="w-5 h-5 hidden" />
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuote} className="p-6 overflow-y-auto space-y-5 text-xs">
              {formError && (
                <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              
              {/* Client & Device */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Nombre Cliente *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: David Morales"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Teléfono / WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    placeholder="Ej: +57 312 345 6789"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Días de Vigencia</label>
                  <input
                    type="number"
                    min="1"
                    value={validDays}
                    onChange={(e) => setValidDays(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-white outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Descripción del Equipo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Laptop Asus TUF Dash F15 2022 o iPhone 13 128GB"
                    value={deviceDescription}
                    onChange={(e) => setDeviceDescription(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email (Opcional)</label>
                  <input
                    type="email"
                    placeholder="cliente@ejemplo.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300">
                    Falla Reportada / Servicio / Desbloqueo a Presupuestar
                  </label>
                  <button
                    type="button"
                    onClick={handleConsultAIInModal}
                    disabled={modalAILoading}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] transition disabled:opacity-60 cursor-pointer"
                  >
                    {modalAILoading ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Consultando Mercado...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        Sugerir Precio Mercado IA
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={2}
                  placeholder="Ej: Cambio de pantalla OLED, centro de carga, desbloqueo FRP / PayJoy / AT&T, HDMI PS5..."
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 text-zinc-900 dark:text-white outline-none"
                />

                {modalAIError && (
                  <div className="mt-2 p-2.5 rounded-lg bg-red-950/30 border border-red-500/40 text-red-400 flex items-center gap-2 text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{modalAIError}</span>
                  </div>
                )}

                {modalAIResult && (
                  <div className="mt-2 p-3 rounded-xl bg-cyan-950/25 border border-cyan-500/35 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-cyan-300">
                        Sugerencia IA ({modalAIResult.regionUsed}): {modalAIResult.serviceTitle}
                      </span>
                      <span className="text-zinc-400">Tiempo: {modalAIResult.estimatedTime}</span>
                    </div>
                    <p className="text-[11px] text-zinc-300">{modalAIResult.marketSummary}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(['economico', 'recomendado', 'premium'] as const).map((tk) => {
                        const t = modalAIResult.tiers[tk];
                        if (!t) return null;
                        return (
                          <button
                            key={tk}
                            type="button"
                            onClick={() => applyModalTier(tk)}
                            className="p-2 rounded-lg bg-zinc-900/90 hover:bg-cyan-900/40 border border-cyan-500/30 text-left transition cursor-pointer"
                          >
                            <span className="block text-[10px] text-cyan-300 font-bold uppercase truncate">
                              {t.label}
                            </span>
                            <span className="block text-sm font-mono font-black text-white">
                              {formatCurrency(t.total, currency)}
                            </span>
                            <span className="block text-[10px] text-zinc-400">
                              Aplicar este precio
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Items in quote */}
              <div className="space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                <span className="font-bold text-zinc-800 dark:text-zinc-200 block uppercase">Ítems de la Cotización</span>
                
                {/* Add item */}
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Concepto / Repuesto"
                    value={newItemDesc}
                    onChange={(e) => setNewItemDesc(e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-white outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder={`Precio (${currency})`}
                    value={newItemPrice || ''}
                    onChange={(e) => setNewItemPrice(Number(e.target.value))}
                    className="w-28 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 text-zinc-800 dark:text-zinc-200 rounded-lg font-bold"
                  >
                    + Agregar
                  </button>
                </div>

                {/* Items list */}
                <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-700">
                  {items.map((it) => (
                    <div key={it.id} className="p-2.5 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/40">
                      <span className="font-medium text-zinc-900 dark:text-white">{it.description}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold">{formatCurrency(it.unitPrice * it.quantity, currency)}</span>
                        <button type="button" onClick={() => handleRemoveItem(it.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Notas / Garantía / Advertencias Técnicas (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Sujeto a disponibilidad en servidor / Incluye garantía de 90 días..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-white outline-none"
                />
              </div>

              {/* Labor, discount and total */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                <div>
                  <label className="block text-zinc-500 mb-1">Mano de Obra ({currency}):</label>
                  <input
                    type="number"
                    min="0"
                    value={laborCost}
                    onChange={(e) => setLaborCost(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-white outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-zinc-500 mb-1">Descuento ({currency}):</label>
                  <input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-white outline-none font-mono"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1 flex flex-col justify-end">
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900">
                    <span className="text-[10px] text-blue-600 block">TOTAL COTIZADO:</span>
                    <strong className="text-base text-blue-900 dark:text-blue-200 font-mono">
                      {formatCurrency(calculateTotal(items, Number(laborCost) || 0, Number(discount) || 0), currency)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition"
                >
                  Guardar Cotización
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
