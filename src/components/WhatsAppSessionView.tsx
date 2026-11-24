import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  QrCode,
  Smartphone,
  LogOut,
  Send,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  FileSpreadsheet,
  Receipt,
  Wrench,
  Clock,
  ExternalLink,
  ShieldCheck,
  History,
  UserCheck,
  CheckCheck,
  Check,
  KeyRound,
  Search,
  Trash2,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
} from 'lucide-react';
import type {
  Invoice,
  Quote,
  RepairOrder,
  WhatsAppDispatchLog,
  WhatsAppSessionState,
  WorkshopSettings,
} from '../types/workshop';
import {
  buildWhatsAppLink,
  formatCurrency,
  generateInvoiceWhatsAppMessage,
  generateWhatsAppMessage,
  STATUS_LABELS,
  type WhatsAppMessageType,
} from '../utils/whatsapp';

export interface SendWhatsAppPayload {
  toPhone: string;
  clientName: string;
  message: string;
  category: 'cotizacion' | 'factura' | 'seguimiento' | 'manual';
  referenceNumber?: string;
}

interface WhatsAppSessionViewProps {
  session: WhatsAppSessionState;
  logs: WhatsAppDispatchLog[];
  settings: WorkshopSettings;
  quotes: Quote[];
  invoices: Invoice[];
  orders: RepairOrder[];
  onConnectQR: () => Promise<void>;
  onConnectPairing: (phone: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onRepairSessions: () => Promise<void>;
  onDeleteHistoryItem: (logId: string) => Promise<void>;
  onClearHistory: () => Promise<void>;
  onRefreshStatus: () => Promise<void>;
  onSendDirect: (payload: SendWhatsAppPayload) => Promise<WhatsAppDispatchLog>;
}

const CATEGORY_LABELS: Record<WhatsAppDispatchLog['category'], string> = {
  cotizacion: 'Cotización',
  factura: 'Factura',
  seguimiento: 'Seguimiento',
  manual: 'Manual',
  entrante: 'Entrante',
};

export const WhatsAppSessionView: React.FC<WhatsAppSessionViewProps> = ({
  session,
  logs,
  settings,
  quotes,
  invoices,
  orders,
  onConnectQR,
  onConnectPairing,
  onLogout,
  onRepairSessions,
  onDeleteHistoryItem,
  onClearHistory,
  onRefreshStatus,
  onSendDirect,
}) => {
  const currency = settings.currency || '$';
  const isConnected = session.status === 'connected';

  // Main workspace view on the right column
  const [workspaceTab, setWorkspaceTab] = useState<'composer' | 'history'>('composer');

  // Connection mode
  const [linkMode, setLinkMode] = useState<'qr' | 'pairing'>('qr');
  const [pairingPhone, setPairingPhone] = useState(
    (settings.whatsapp || '').replace(/[^0-9]/g, '')
  );
  const [sessionActionLoading, setSessionActionLoading] = useState(false);
  const [repairLoading, setRepairLoading] = useState(false);
  const [sessionActionError, setSessionActionError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  // Dispatch center state
  const [dispatchTab, setDispatchTab] = useState<'cotizaciones' | 'facturas' | 'seguimientos' | 'manual'>('cotizaciones');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>(quotes[0]?.id || '');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(invoices[0]?.id || '');
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  const [orderMsgType, setOrderMsgType] = useState<WhatsAppMessageType>('actualizacion_estado');

  const [destPhone, setDestPhone] = useState('');
  const [destName, setDestName] = useState('');
  const [refNumber, setRefNumber] = useState<string | undefined>(undefined);
  const [draftMessage, setDraftMessage] = useState('');

  const [sending, setSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);

  // History registry filters & state
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    'all' | 'delivered' | 'server_ack' | 'failed' | 'received'
  >('all');
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<
    'all' | WhatsAppDispatchLog['category']
  >('all');
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);

  useEffect(() => {
    if (quotes.length > 0 && !quotes.some((q) => q.id === selectedQuoteId)) {
      setSelectedQuoteId(quotes[0].id);
    }
  }, [quotes, selectedQuoteId]);

  useEffect(() => {
    if (invoices.length > 0 && !invoices.some((i) => i.id === selectedInvoiceId)) {
      setSelectedInvoiceId(invoices[0].id);
    }
  }, [invoices, selectedInvoiceId]);

  useEffect(() => {
    if (orders.length > 0 && !orders.some((o) => o.id === selectedOrderId)) {
      setSelectedOrderId(orders[0].id);
    }
  }, [orders, selectedOrderId]);

  useEffect(() => {
    setSendFeedback(null);
    if (dispatchTab === 'cotizaciones') {
      const q = quotes.find((item) => item.id === selectedQuoteId);
      if (q) {
        setDestPhone(q.clientPhone);
        setDestName(q.clientName);
        setRefNumber(q.quoteNumber);
        setDraftMessage(generateWhatsAppMessage('cotizacion', undefined, q, settings));
      } else {
        setDestPhone('');
        setDestName('');
        setRefNumber(undefined);
        setDraftMessage('');
      }
    } else if (dispatchTab === 'facturas') {
      const inv = invoices.find((item) => item.id === selectedInvoiceId);
      if (inv) {
        setDestPhone(inv.clientPhone);
        setDestName(inv.clientName);
        setRefNumber(inv.invoiceNumber);
        setDraftMessage(generateInvoiceWhatsAppMessage(inv, settings));
      } else {
        setDestPhone('');
        setDestName('');
        setRefNumber(undefined);
        setDraftMessage('');
      }
    } else if (dispatchTab === 'seguimientos') {
      const ord = orders.find((item) => item.id === selectedOrderId);
      if (ord) {
        setDestPhone(ord.clientPhone);
        setDestName(ord.clientName);
        setRefNumber(ord.orderNumber);
        setDraftMessage(generateWhatsAppMessage(orderMsgType, ord, undefined, settings));
      } else {
        setDestPhone('');
        setDestName('');
        setRefNumber(undefined);
        setDraftMessage('');
      }
    } else {
      setRefNumber(undefined);
    }
  }, [dispatchTab, selectedQuoteId, selectedInvoiceId, selectedOrderId, orderMsgType, quotes, invoices, orders, settings]);

  const historyStats = useMemo(() => {
    let delivered = 0;
    let serverAck = 0;
    let failed = 0;
    let received = 0;
    for (const log of logs) {
      if (log.status === 'received' || log.direction === 'inbound') {
        received += 1;
      } else if (log.status === 'failed' || log.deliveryStatus === 'failed') {
        failed += 1;
      } else if (log.deliveryStatus === 'delivered' || log.deliveryStatus === 'read') {
        delivered += 1;
      } else {
        serverAck += 1;
      }
    }
    return { total: logs.length, delivered, serverAck, failed, received };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return logs.filter((log) => {
      if (historyCategoryFilter !== 'all' && log.category !== historyCategoryFilter) {
        return false;
      }
      if (historyStatusFilter !== 'all') {
        const isInbound = log.status === 'received' || log.direction === 'inbound';
        const isFailed = log.status === 'failed' || log.deliveryStatus === 'failed';
        const isDelivered = log.deliveryStatus === 'delivered' || log.deliveryStatus === 'read';
        if (historyStatusFilter === 'received' && !isInbound) return false;
        if (historyStatusFilter === 'failed' && !isFailed) return false;
        if (historyStatusFilter === 'delivered' && (!isDelivered || isInbound || isFailed)) return false;
        if (historyStatusFilter === 'server_ack' && (isInbound || isFailed || isDelivered)) return false;
      }
      if (!q) return true;
      const body = (log.fullMessage || log.messagePreview || '').toLowerCase();
      return (
        log.clientName.toLowerCase().includes(q) ||
        log.toPhone.toLowerCase().includes(q) ||
        (log.referenceNumber || '').toLowerCase().includes(q) ||
        body.includes(q)
      );
    });
  }, [logs, historySearch, historyStatusFilter, historyCategoryFilter]);

  const handleStartQR = async () => {
    setSessionActionLoading(true);
    setSessionActionError(null);
    setSessionNotice(null);
    try {
      await onConnectQR();
    } catch (err: unknown) {
      setSessionActionError(err instanceof Error ? err.message : 'Error al iniciar sesión QR.');
    } finally {
      setSessionActionLoading(false);
    }
  };

  const handleStartPairing = async (e: React.FormEvent) => {
    e.preventDefault();
    setSessionActionLoading(true);
    setSessionActionError(null);
    setSessionNotice(null);
    try {
      await onConnectPairing(pairingPhone);
    } catch (err: unknown) {
      setSessionActionError(err instanceof Error ? err.message : 'Error al solicitar código.');
    } finally {
      setSessionActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setSessionActionLoading(true);
    setSessionActionError(null);
    setSessionNotice(null);
    try {
      await onLogout();
    } catch (err: unknown) {
      setSessionActionError(err instanceof Error ? err.message : 'Error al cerrar sesión.');
    } finally {
      setSessionActionLoading(false);
    }
  };

  const handleRepair = async () => {
    setRepairLoading(true);
    setSessionActionError(null);
    setSessionNotice(null);
    try {
      await onRepairSessions();
      setSessionNotice('Llaves Signal y dispositivos limpiados. Vuelve a enviar el mensaje para negociar cifrado nuevo.');
    } catch (err: unknown) {
      setSessionActionError(err instanceof Error ? err.message : 'No se pudo reparar el cifrado Signal.');
    } finally {
      setRepairLoading(false);
    }
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destPhone.trim() || !draftMessage.trim()) {
      setSendFeedback({ type: 'error', text: 'Indica el teléfono del cliente y el contenido del mensaje.' });
      return;
    }

    const categoryMap: Record<typeof dispatchTab, SendWhatsAppPayload['category']> = {
      cotizaciones: 'cotizacion',
      facturas: 'factura',
      seguimientos: 'seguimiento',
      manual: 'manual',
    };

    setSending(true);
    setSendFeedback(null);
    try {
      const log = await onSendDirect({
        toPhone: destPhone.trim(),
        clientName: destName.trim() || 'Cliente',
        message: draftMessage.trim(),
        category: categoryMap[dispatchTab],
        referenceNumber: refNumber,
      });

      if (log.deliveryStatus === 'delivered' || log.deliveryStatus === 'read') {
        setSendFeedback({
          type: 'success',
          text: `Entregado al destinatario (✓✓) para ${destName || log.toPhone}.`,
        });
      } else {
        setSendFeedback({
          type: 'warning',
          text: `Aceptado por el servidor (✓) para ${destName || log.toPhone}. Si en el historial sigue en "En servidor ✓", pulsa "Reparar Cifrado Signal".`,
        });
      }
    } catch (err: unknown) {
      setSendFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo enviar el mensaje por WhatsApp.',
      });
    } finally {
      setSending(false);
    }
  };

  const handleLoadIntoComposer = (log: WhatsAppDispatchLog) => {
    setDispatchTab('manual');
    setDestPhone(log.toPhone);
    setDestName(log.clientName);
    setRefNumber(log.referenceNumber);
    setDraftMessage(log.fullMessage || log.messagePreview || '');
    setWorkspaceTab('composer');
    setSendFeedback(null);
  };

  const handleDeleteLog = async (logId: string) => {
    setHistoryBusy(true);
    try {
      await onDeleteHistoryItem(logId);
    } finally {
      setHistoryBusy(false);
    }
  };

  const handleClearAllLogs = async () => {
    setHistoryBusy(true);
    try {
      await onClearHistory();
      setConfirmClearAll(false);
    } finally {
      setHistoryBusy(false);
    }
  };

  const handleExportCSV = () => {
    const escapeCell = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;
    const headers = [
      'Fecha',
      'Dirección',
      'Cliente',
      'Teléfono',
      'Categoría',
      'Referencia',
      'Estado',
      'Mensaje',
      'Error',
    ];
    const rows = filteredLogs.map((log) => [
      new Date(log.sentAt).toLocaleString(),
      log.direction === 'inbound' || log.status === 'received' ? 'Entrante' : 'Saliente',
      log.clientName,
      log.toPhone,
      CATEGORY_LABELS[log.category] || log.category,
      log.referenceNumber || '',
      log.status === 'received'
        ? 'Recibido'
        : log.status === 'failed'
        ? 'Error'
        : log.deliveryStatus === 'read'
        ? 'Leído'
        : log.deliveryStatus === 'delivered'
        ? 'Entregado'
        : 'En servidor',
      log.fullMessage || log.messagePreview,
      log.error || '',
    ]);
    const csv =
      '\uFEFF' +
      [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial-whatsapp-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const statusMeta = (() => {
    switch (session.status) {
      case 'connected':
        return {
          label: 'WHATSAPP CONECTADO Y ACTIVO',
          badgeClass: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50',
          dotClass: 'bg-emerald-400',
        };
      case 'qr_ready':
        return {
          label: 'ESPERANDO ESCANEO QR',
          badgeClass: 'bg-cyan-950/90 text-cyan-300 border-cyan-400/50',
          dotClass: 'bg-cyan-400 animate-ping',
        };
      case 'pairing_code_ready':
        return {
          label: 'CÓDIGO DE VINCULACIÓN LISTO',
          badgeClass: 'bg-cyan-950/90 text-cyan-300 border-cyan-400/50',
          dotClass: 'bg-cyan-400 animate-ping',
        };
      case 'connecting':
        return {
          label: 'CONECTANDO CON WHATSAPP...',
          badgeClass: 'bg-amber-950/90 text-amber-300 border-amber-500/50',
          dotClass: 'bg-amber-400 animate-pulse',
        };
      case 'error':
        return {
          label: 'ERROR DE CONEXIÓN',
          badgeClass: 'bg-rose-950/90 text-rose-300 border-rose-500/50',
          dotClass: 'bg-rose-400',
        };
      default:
        return {
          label: 'DESCONECTADO',
          badgeClass: 'bg-zinc-900 text-zinc-400 border-zinc-700',
          dotClass: 'bg-zinc-500',
        };
    }
  })();

  return (
    <div className="space-y-6 font-mono">
      {/* Top Hero Header */}
      <div className="hud-panel p-5 sm:p-6 rounded-3xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-white shadow-[0_0_25px_rgba(16,185,129,0.35)] shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
              Centro de Envío WhatsApp • Sesión Directa + Historial
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Vincula el WhatsApp de tu taller por QR o número para enviar cotizaciones, facturas y seguimientos directos, con registro de historial.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold ${statusMeta.badgeClass}`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className={`inline-flex h-full w-full rounded-full ${statusMeta.dotClass}`} />
            </span>
            <span>{statusMeta.label}</span>
          </div>

          <button
            type="button"
            onClick={() => onRefreshStatus()}
            className="p-2.5 rounded-xl bg-[#070b16] hover:bg-white/5 border border-cyan-500/30 text-cyan-300 transition cursor-pointer"
            title="Actualizar estado de WhatsApp"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Linked WhatsApp Session */}
        <div className="lg:col-span-5 space-y-4">
          <div className="hud-panel p-5 sm:p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <h2 className="text-sm font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                <QrCode className="w-4 h-4" />
                Iniciar Sesión WhatsApp
              </h2>
              <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Sesión Servidor
              </span>
            </div>

            {(sessionActionError || session.lastError) && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{sessionActionError || session.lastError}</span>
              </div>
            )}

            {sessionNotice && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{sessionNotice}</span>
              </div>
            )}

            {isConnected ? (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-400 uppercase font-bold block">
                        Dispositivo Vinculado
                      </span>
                      <strong className="text-sm text-white block">
                        {session.connectedName || 'WhatsApp del Taller'}
                      </strong>
                      <span className="text-xs text-emerald-200 font-bold">
                        {session.connectedPhone || 'Número activo'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-300 leading-relaxed">
                    Sesión lista para enviar mensajes directos y recibir respuestas en el historial. Si algún envío queda en &quot;En servidor ✓&quot;, pulsa &quot;Reparar Cifrado Signal&quot;.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleRepair}
                    disabled={repairLoading || sessionActionLoading}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-950/70 hover:bg-amber-900/80 text-amber-200 border border-amber-500/40 text-xs font-bold transition disabled:opacity-60 cursor-pointer"
                  >
                    {repairLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="w-3.5 h-3.5" />
                    )}
                    <span>Reparar Cifrado Signal</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={sessionActionLoading || repairLoading}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-500/40 text-xs font-bold transition disabled:opacity-60 cursor-pointer"
                  >
                    {sessionActionLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <LogOut className="w-3.5 h-3.5" />
                    )}
                    <span>Cerrar Sesión QR</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-1.5 bg-[#070b16] p-1 rounded-xl border border-cyan-500/20 text-xs">
                  <button
                    type="button"
                    onClick={() => setLinkMode('qr')}
                    className={`py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      linkMode === 'qr'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Código QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkMode('pairing')}
                    className={`py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      linkMode === 'pairing'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Por Número</span>
                  </button>
                </div>

                {linkMode === 'qr' ? (
                  <div className="space-y-4">
                    {session.status === 'qr_ready' && session.qrDataUrl ? (
                      <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-[#070b16] border border-emerald-500/40">
                        <div className="bg-white p-3 rounded-2xl shadow-lg">
                          <img
                            src={session.qrDataUrl}
                            alt="Código QR para iniciar sesión en WhatsApp"
                            className="w-56 h-56 object-contain"
                          />
                        </div>
                        <p className="text-[11px] text-center text-emerald-300">
                          Escanea este QR con tu teléfono:
                          <br />
                          <span className="text-zinc-400">
                            WhatsApp &gt; Dispositivos vinculados &gt; Vincular dispositivo
                          </span>
                        </p>
                      </div>
                    ) : (
                      <div className="p-5 rounded-2xl bg-[#070b16] border border-cyan-500/20 text-center space-y-3">
                        {session.status === 'connecting' ? (
                          <div className="flex flex-col items-center gap-2 py-4">
                            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                            <span className="text-xs text-cyan-300 font-bold">
                              Generando código QR de WhatsApp...
                            </span>
                          </div>
                        ) : (
                          <>
                            <QrCode className="w-10 h-10 text-emerald-400 mx-auto opacity-80" />
                            <p className="text-xs text-zinc-300">
                              Pulsa el botón para generar un QR en vivo y vincular tu número de WhatsApp del taller.
                            </p>
                          </>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleStartQR}
                      disabled={sessionActionLoading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white font-bold text-xs shadow-lg transition disabled:opacity-60 cursor-pointer"
                    >
                      {sessionActionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <QrCode className="w-4 h-4" />
                      )}
                      <span>
                        {session.qrDataUrl ? 'Regenerar Código QR' : 'Generar QR de WhatsApp'}
                      </span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleStartPairing} className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-zinc-300 mb-1">
                        Teléfono del Taller (con código de país, sin +)
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="Ej: 5215512345678 o 573001234567"
                        value={pairingPhone}
                        onChange={(e) => setPairingPhone(e.target.value)}
                        className="w-full rounded-xl border border-cyan-500/30 bg-[#070b16] px-3.5 py-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-cyan-400"
                      />
                    </div>

                    {session.status === 'pairing_code_ready' && session.pairingCode && (
                      <div className="p-4 rounded-2xl bg-[#070b16] border border-cyan-400/50 text-center space-y-2">
                        <span className="text-[10px] text-cyan-300 uppercase block">
                          Ingresa este código en tu teléfono
                        </span>
                        <div className="text-2xl font-black tracking-[0.25em] text-white bg-cyan-950/60 py-2.5 px-4 rounded-xl border border-cyan-500/30">
                          {session.pairingCode}
                        </div>
                        <p className="text-[10px] text-zinc-400">
                          WhatsApp &gt; Dispositivos vinculados &gt; Vincular con número de teléfono
                        </p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={sessionActionLoading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg transition disabled:opacity-60 cursor-pointer"
                    >
                      {sessionActionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Smartphone className="w-4 h-4" />
                      )}
                      <span>Obtener Código de 8 Dígitos</span>
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Composer OR Full Persistent Message History Registry */}
        <div className="lg:col-span-7 space-y-4">
          {/* Primary Right-Column Workspace Switch */}
          <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[#070b16] border border-cyan-500/25 text-xs">
            <button
              type="button"
              onClick={() => setWorkspaceTab('composer')}
              className={`py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                workspaceTab === 'composer'
                  ? 'bg-gradient-to-r from-emerald-500/25 to-cyan-500/25 text-white border border-emerald-400/50'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Send className="w-4 h-4 text-emerald-400" />
              <span>Enviar Mensajes</span>
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceTab('history')}
              className={`py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                workspaceTab === 'history'
                  ? 'bg-gradient-to-r from-cyan-500/25 to-blue-500/25 text-white border border-cyan-400/50'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <History className="w-4 h-4 text-cyan-400" />
              <span>Registro de Historial ({logs.length})</span>
            </button>
          </div>

          {workspaceTab === 'composer' ? (
            <div className="hud-panel p-5 sm:p-6 rounded-3xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Send className="w-4 h-4 text-emerald-400" />
                    Enviar Cotizaciones, Facturas y Seguimientos
                  </h2>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Cada envío queda guardado automáticamente en tu Registro de Historial.
                  </p>
                </div>
              </div>

              {/* Category Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setDispatchTab('cotizaciones')}
                  className={`py-2.5 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    dispatchTab === 'cotizaciones'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/60'
                      : 'bg-[#070b16] text-zinc-400 border-cyan-500/15 hover:text-white'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Cotizaciones ({quotes.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDispatchTab('facturas')}
                  className={`py-2.5 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    dispatchTab === 'facturas'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/60'
                      : 'bg-[#070b16] text-zinc-400 border-cyan-500/15 hover:text-white'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Facturas ({invoices.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDispatchTab('seguimientos')}
                  className={`py-2.5 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    dispatchTab === 'seguimientos'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/60'
                      : 'bg-[#070b16] text-zinc-400 border-cyan-500/15 hover:text-white'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Seguimientos ({orders.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDispatchTab('manual')}
                  className={`py-2.5 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    dispatchTab === 'manual'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/60'
                      : 'bg-[#070b16] text-zinc-400 border-cyan-500/15 hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Mensaje Libre</span>
                </button>
              </div>

              {/* Record Selector per Tab */}
              {dispatchTab === 'cotizaciones' && (
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1.5">
                    Selecciona la Cotización a enviar:
                  </label>
                  {quotes.length === 0 ? (
                    <div className="p-3 rounded-xl bg-[#070b16] border border-zinc-800 text-xs text-zinc-500">
                      No hay cotizaciones guardadas todavía.
                    </div>
                  ) : (
                    <select
                      value={selectedQuoteId}
                      onChange={(e) => setSelectedQuoteId(e.target.value)}
                      className="w-full rounded-xl border border-cyan-500/30 bg-[#070b16] px-3.5 py-2.5 text-xs text-white outline-none"
                    >
                      {quotes.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.quoteNumber} — {q.clientName} ({q.deviceDescription}) • {formatCurrency(q.total, currency)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {dispatchTab === 'facturas' && (
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1.5">
                    Selecciona la Factura a enviar:
                  </label>
                  {invoices.length === 0 ? (
                    <div className="p-3 rounded-xl bg-[#070b16] border border-zinc-800 text-xs text-zinc-500">
                      No hay facturas generadas todavía.
                    </div>
                  ) : (
                    <select
                      value={selectedInvoiceId}
                      onChange={(e) => setSelectedInvoiceId(e.target.value)}
                      className="w-full rounded-xl border border-cyan-500/30 bg-[#070b16] px-3.5 py-2.5 text-xs text-white outline-none"
                    >
                      {invoices.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoiceNumber} — {inv.clientName} • {formatCurrency(inv.total, currency)} ({inv.paymentStatus.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {dispatchTab === 'seguimientos' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1.5">
                      Selecciona la Orden / Equipo en Taller:
                    </label>
                    {orders.length === 0 ? (
                      <div className="p-3 rounded-xl bg-[#070b16] border border-zinc-800 text-xs text-zinc-500">
                        No hay órdenes de taller registradas todavía.
                      </div>
                    ) : (
                      <select
                        value={selectedOrderId}
                        onChange={(e) => setSelectedOrderId(e.target.value)}
                        className="w-full rounded-xl border border-cyan-500/30 bg-[#070b16] px-3.5 py-2.5 text-xs text-white outline-none"
                      >
                        {orders.map((ord) => (
                          <option key={ord.id} value={ord.id}>
                            {ord.orderNumber} — {ord.clientName} • {ord.brand} {ord.model} [{STATUS_LABELS[ord.status].label}]
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {orders.length > 0 && (
                    <div>
                      <span className="block text-[11px] text-zinc-400 mb-1.5">
                        Plantilla de Seguimiento:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { type: 'remision_entrada', label: '📥 Remisión Entrada' },
                          { type: 'actualizacion_estado', label: '🔔 Avance Estado' },
                          { type: 'incidente', label: '⚠️ Novedad / Ajuste' },
                          { type: 'equipo_listo', label: '🎉 Equipo Listo' },
                          { type: 'entrega_recibo', label: '✅ Recibo Garantía' },
                        ].map((tpl) => (
                          <button
                            key={tpl.type}
                            type="button"
                            onClick={() => setOrderMsgType(tpl.type as WhatsAppMessageType)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] border font-bold transition cursor-pointer ${
                              orderMsgType === tpl.type
                                ? 'bg-emerald-600 text-white border-emerald-500'
                                : 'bg-[#070b16] text-zinc-300 border-cyan-500/20 hover:border-cyan-400/50'
                            }`}
                          >
                            {tpl.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Composer Form */}
              <form onSubmit={handleDispatch} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">
                      Cliente Destinatario:
                    </label>
                    <input
                      type="text"
                      placeholder="Nombre del cliente"
                      value={destName}
                      onChange={(e) => setDestName(e.target.value)}
                      className="w-full rounded-xl border border-cyan-500/20 bg-[#070b16] px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">
                      WhatsApp del Cliente *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="Ej: 5512345678 o +5215512345678"
                      value={destPhone}
                      onChange={(e) => setDestPhone(e.target.value)}
                      className="w-full rounded-xl border border-cyan-500/20 bg-[#070b16] px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-cyan-400"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-zinc-400">
                      Vista Previa del Mensaje (Editable):
                    </label>
                    <span className="text-[10px] text-zinc-500">
                      {draftMessage.length} / 4096 caracteres
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    required
                    placeholder="Escribe o selecciona un documento arriba para prellenar el mensaje..."
                    value={draftMessage}
                    onChange={(e) => setDraftMessage(e.target.value)}
                    className="w-full rounded-2xl border border-cyan-500/25 bg-[#070b16] p-3.5 text-xs text-white outline-none focus:ring-2 focus:ring-emerald-400 leading-relaxed"
                  />
                </div>

                {sendFeedback && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      sendFeedback.type === 'success'
                        ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                        : sendFeedback.type === 'warning'
                        ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                        : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                    }`}
                  >
                    {sendFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle
                        className={`w-4 h-4 shrink-0 ${
                          sendFeedback.type === 'warning' ? 'text-amber-400' : 'text-rose-400'
                        }`}
                      />
                    )}
                    <span>{sendFeedback.text}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2">
                  {destPhone && draftMessage ? (
                    <a
                      href={buildWhatsAppLink(destPhone, draftMessage)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir en WhatsApp Web (100% seguro)</span>
                    </a>
                  ) : (
                    <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>
                        {isConnected
                          ? `Sesión activa: ${session.connectedPhone || 'WhatsApp vinculado'}.`
                          : 'Vincula tu WhatsApp por QR o número en el panel izquierdo.'}
                      </span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={sending || !isConnected}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg transition cursor-pointer"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Enviar por WhatsApp Ahora</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* FULL PERSISTENT MESSAGE HISTORY REGISTRY */
            <div className="hud-panel p-5 sm:p-6 rounded-3xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-cyan-400" />
                    Registro Persistente de Mensajes WhatsApp
                  </h2>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Guardado en la base del servidor (salientes, estado ✓/✓✓, errores y respuestas recibidas).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={filteredLogs.length === 0}
                    onClick={handleExportCSV}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#070b16] hover:bg-white/5 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold transition disabled:opacity-40 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar CSV</span>
                  </button>

                  {logs.length > 0 && (
                    confirmClearAll ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={historyBusy}
                          onClick={handleClearAllLogs}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClearAll(false)}
                          className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmClearAll(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/30 text-rose-300 text-[11px] font-bold transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Limpiar</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* KPI Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-[#070b16] border border-cyan-500/20">
                  <div className="text-base font-black text-white">{historyStats.total}</div>
                  <div className="text-[10px] text-zinc-400">Total</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#070b16] border border-emerald-500/30">
                  <div className="text-base font-black text-emerald-300">{historyStats.delivered}</div>
                  <div className="text-[10px] text-emerald-400">Entregados ✓✓</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#070b16] border border-amber-500/30">
                  <div className="text-base font-black text-amber-300">{historyStats.serverAck}</div>
                  <div className="text-[10px] text-amber-400">En servidor ✓</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#070b16] border border-cyan-400/30">
                  <div className="text-base font-black text-cyan-300">{historyStats.received}</div>
                  <div className="text-[10px] text-cyan-400">Recibidos</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#070b16] border border-rose-500/30">
                  <div className="text-base font-black text-rose-300">{historyStats.failed}</div>
                  <div className="text-[10px] text-rose-400">Errores</div>
                </div>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                <div className="sm:col-span-6 relative">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar cliente, teléfono, folio o texto..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full rounded-xl border border-cyan-500/25 bg-[#070b16] pl-8 pr-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
                <div className="sm:col-span-3">
                  <select
                    value={historyStatusFilter}
                    onChange={(e) =>
                      setHistoryStatusFilter(
                        e.target.value as 'all' | 'delivered' | 'server_ack' | 'failed' | 'received'
                      )
                    }
                    className="w-full rounded-xl border border-cyan-500/25 bg-[#070b16] px-2.5 py-2 text-xs text-white outline-none"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="delivered">Entregados (✓✓)</option>
                    <option value="server_ack">En servidor (✓)</option>
                    <option value="received">Recibidos</option>
                    <option value="failed">Con error</option>
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <select
                    value={historyCategoryFilter}
                    onChange={(e) =>
                      setHistoryCategoryFilter(
                        e.target.value as 'all' | WhatsAppDispatchLog['category']
                      )
                    }
                    className="w-full rounded-xl border border-cyan-500/25 bg-[#070b16] px-2.5 py-2 text-xs text-white outline-none"
                  >
                    <option value="all">Todas las categorías</option>
                    <option value="cotizacion">Cotizaciones</option>
                    <option value="factura">Facturas</option>
                    <option value="seguimiento">Seguimientos</option>
                    <option value="manual">Manuales</option>
                    <option value="entrante">Entrantes</option>
                  </select>
                </div>
              </div>

              {/* Log List */}
              <div className="max-h-[34rem] overflow-y-auto space-y-2.5 pr-1">
                {filteredLogs.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-[#070b16] border border-zinc-800 text-center space-y-2">
                    <History className="w-8 h-8 text-zinc-600 mx-auto" />
                    <p className="text-xs text-zinc-400">
                      {logs.length === 0
                        ? 'Todavía no hay mensajes registrados en el historial del servidor.'
                        : 'No hay mensajes que coincidan con tu búsqueda o filtros.'}
                    </p>
                  </div>
                ) : (
                  filteredLogs.map((log) => {
                    const isInbound = log.direction === 'inbound' || log.status === 'received';
                    const isFailed = log.status === 'failed' || log.deliveryStatus === 'failed';
                    const isDelivered = log.deliveryStatus === 'delivered' || log.deliveryStatus === 'read';
                    const fullText = log.fullMessage || log.messagePreview || '';
                    const isLong = fullText.length > 145;
                    const isExpanded = Boolean(expandedLogIds[log.id]);

                    return (
                      <div
                        key={log.id}
                        className="p-3.5 rounded-2xl bg-[#070b16] border border-cyan-500/20 space-y-2 text-[11px]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                                isInbound
                                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                                  : 'bg-zinc-900 text-zinc-300 border border-zinc-700'
                              }`}
                            >
                              {isInbound ? (
                                <>
                                  <ArrowDownLeft className="w-3 h-3" />
                                  <span>Entrante</span>
                                </>
                              ) : (
                                <>
                                  <ArrowUpRight className="w-3 h-3" />
                                  <span>Saliente</span>
                                </>
                              )}
                            </span>
                            <strong className="text-white truncate">
                              {log.clientName} ({log.toPhone})
                            </strong>
                          </div>

                          <span
                            className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 shrink-0 ${
                              isInbound
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-400/40'
                                : isFailed
                                ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                                : isDelivered
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {isInbound ? (
                              'Recibido'
                            ) : isFailed ? (
                              'Error'
                            ) : isDelivered ? (
                              <>
                                <CheckCheck className="w-3 h-3" />
                                <span>{log.deliveryStatus === 'read' ? 'Leído' : 'Entregado'}</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3" />
                                <span>En servidor</span>
                              </>
                            )}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-cyan-400">
                          <span className="uppercase">
                            {CATEGORY_LABELS[log.category] || log.category}
                            {log.referenceNumber ? ` • ${log.referenceNumber}` : ''}
                          </span>
                          <span className="text-zinc-500">
                            {new Date(log.sentAt).toLocaleString([], {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>

                        <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed break-words">
                          {isExpanded || !isLong ? fullText : `${fullText.slice(0, 145)}...`}
                        </p>

                        {log.error && (
                          <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[10px]">
                            {log.error}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
                          <div>
                            {isLong && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedLogIds((prev) => ({
                                    ...prev,
                                    [log.id]: !prev[log.id],
                                  }))
                                }
                                className="text-[10px] text-cyan-300 hover:text-cyan-200 font-bold cursor-pointer"
                              >
                                {isExpanded ? 'Ocultar mensaje completo' : 'Ver mensaje completo'}
                              </button>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleLoadIntoComposer(log)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/70 border border-cyan-500/30 text-cyan-200 text-[10px] font-bold cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>{isInbound ? 'Responder' : 'Reenviar'}</span>
                            </button>

                            <a
                              href={buildWhatsAppLink(log.toPhone, fullText)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-[10px] font-bold"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>WhatsApp Web</span>
                            </a>

                            <button
                              type="button"
                              disabled={historyBusy}
                              onClick={() => handleDeleteLog(log.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-[10px] font-bold cursor-pointer disabled:opacity-40"
                              title="Eliminar este registro"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
