import React, { useState } from 'react';
import {
  Cpu,
  Bell,
  LogOut,
  Wrench,
  FileSpreadsheet,
  Receipt,
  MessageSquare,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import type {
  AuthUser,
  RepairOrder,
  Quote,
  Invoice,
  WorkshopSettings,
  StatusNotification,
  OrderStatus,
} from '../types/workshop';
import {
  calculateOrderTotals,
  formatCurrency,
  openWhatsApp,
  STATUS_LABELS,
} from '../utils/whatsapp';
import { DocumentPrintModal, DocumentType } from './DocumentPrintModal';

interface ClientPortalViewProps {
  user: AuthUser;
  settings: WorkshopSettings;
  orders: RepairOrder[];
  quotes: Quote[];
  invoices: Invoice[];
  notifications: StatusNotification[];
  liveToast: StatusNotification | null;
  onDismissToast: () => void;
  onMarkNotificationsRead: () => void;
  onLogout: () => void;
}

export const ClientPortalView: React.FC<ClientPortalViewProps> = ({
  user,
  settings,
  orders,
  quotes,
  invoices,
  notifications,
  liveToast,
  onDismissToast,
  onMarkNotificationsRead,
  onLogout,
}) => {
  const currency = settings.currency || '$';
  const [tab, setTab] = useState<'orders' | 'quotes' | 'invoices'>('orders');
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const [docModal, setDocModal] = useState<{
    isOpen: boolean;
    type: DocumentType;
    order?: RepairOrder;
    quote?: Quote;
    invoice?: Invoice;
  }>({ isOpen: false, type: 'factura' });

  const unreadCount = notifications.filter((n) => !n.readByClient).length;

  const steps: { status: OrderStatus; label: string }[] = [
    { status: 'recibido', label: '1. Recibido' },
    { status: 'diagnostico', label: '2. Diagnóstico' },
    { status: 'en_reparacion', label: '3. En Reparación' },
    { status: 'control_calidad', label: '4. Control QA' },
    { status: 'listo', label: '5. Listo' },
    { status: 'entregado', label: '6. Entregado' },
  ];

  const getStepIndex = (status: OrderStatus) => {
    switch (status) {
      case 'recibido':
        return 0;
      case 'diagnostico':
        return 1;
      case 'espera_repuesto':
      case 'en_reparacion':
        return 2;
      case 'control_calidad':
        return 3;
      case 'listo':
        return 4;
      case 'entregado':
        return 5;
      default:
        return 0;
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] cyber-grid text-zinc-100 flex flex-col">
      {/* Client Navbar */}
      <header className="sticky top-0 z-40 bg-[#070c18]/90 backdrop-blur-xl border-b border-cyan-500/20 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#090e1d] border border-cyan-500/40 flex items-center justify-center overflow-hidden p-1">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt={settings.name} className="w-full h-full object-contain" />
              ) : (
                <Cpu className="w-5 h-5 text-cyan-400" />
              )}
            </div>
            <div>
              <div className="font-mono font-black text-white text-sm sm:text-base leading-none">
                {settings.name}
              </div>
              <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                Portal Cliente • {user.displayName}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Real-Time Notifications Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowNotifMenu(!showNotifMenu);
                  if (unreadCount > 0) onMarkNotificationsRead();
                }}
                className="relative p-2 rounded-xl bg-[#0b132b] border border-cyan-500/30 text-cyan-300 hover:text-white transition cursor-pointer"
                title="Notificaciones de estatus en tiempo real"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifMenu && (
                <div className="absolute right-0 mt-2 w-80 bg-[#091024] border border-cyan-500/40 rounded-2xl shadow-2xl p-3 space-y-2 z-50">
                  <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                    <span className="text-xs font-mono font-bold text-cyan-300">
                      Notificaciones en Vivo
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNotifMenu(false)}
                      className="text-xs text-zinc-400 hover:text-white"
                    >
                      Cerrar
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-zinc-500 text-center py-4">
                        Sin notificaciones recientes.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className="p-2.5 rounded-xl bg-[#070b16] border border-cyan-500/20 text-xs space-y-1"
                        >
                          <div className="font-bold text-white">{n.title}</div>
                          <p className="text-[11px] text-zinc-300">{n.message}</p>
                          <span className="text-[10px] text-zinc-500 block">
                            {new Date(n.createdAt).toLocaleString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                openWhatsApp(
                  settings.whatsapp || settings.phone,
                  `Hola ${settings.name}, soy ${user.displayName}. Consulto desde mi Portal de Cliente.`
                )
              }
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp Taller</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Live WebSocket Status Update Banner */}
      {liveToast && (
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-4 print:hidden">
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-cyan-950/90 to-emerald-950/90 border border-cyan-400/60 shadow-[0_0_25px_rgba(0,242,254,0.25)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs">
              <Bell className="w-4 h-4 text-cyan-300 animate-bounce shrink-0" />
              <div>
                <strong className="text-white block">{liveToast.title}</strong>
                <span className="text-cyan-200">{liveToast.message}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onDismissToast}
              className="text-xs text-zinc-300 hover:text-white px-2 py-1"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Section Tabs */}
        <div className="flex flex-wrap items-center gap-2 bg-[#0b132b]/70 p-2 rounded-2xl border border-cyan-500/20">
          <button
            type="button"
            onClick={() => setTab('orders')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              tab === 'orders'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Mis Equipos ({orders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('quotes')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              tab === 'quotes'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Mis Cotizaciones ({quotes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('invoices')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              tab === 'invoices'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Mis Facturas PDF ({invoices.length})</span>
          </button>
        </div>

        {/* Orders Tracking */}
        {tab === 'orders' && (
          <div className="space-y-4">
            {orders.map((ord) => {
              const totals = calculateOrderTotals(ord);
              const stepIdx = getStepIndex(ord.status);

              return (
                <div
                  key={ord.id}
                  className="hud-panel rounded-3xl p-5 sm:p-6 space-y-5 border border-cyan-500/30"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-4">
                    <div>
                      <span className="font-mono text-xs font-bold text-cyan-400">
                        {ord.orderNumber}
                      </span>
                      <h3 className="text-lg font-black text-white">
                        {ord.brand} {ord.model}
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Ingreso: {new Date(ord.createdAt).toLocaleDateString()} • Técnico:{' '}
                        <strong className="text-zinc-200">{ord.technicianAssigned}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${STATUS_LABELS[ord.status].bg} ${STATUS_LABELS[ord.status].color}`}
                      >
                        {STATUS_LABELS[ord.status].label}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDocModal({ isOpen: true, type: 'remision_entrada', order: ord })
                        }
                        className="px-3 py-1.5 rounded-xl bg-[#070b16] hover:bg-cyan-950/50 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Remisión PDF</span>
                      </button>
                    </div>
                  </div>

                  {/* Stepper */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    {steps.map((st, idx) => {
                      const passed = idx <= stepIdx;
                      const current = idx === stepIdx;
                      return (
                        <div
                          key={st.status}
                          className={`p-2 rounded-xl text-center border text-[11px] font-mono ${
                            current
                              ? 'bg-cyan-500 text-black font-black border-cyan-300'
                              : passed
                              ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                              : 'bg-[#070b16] text-zinc-500 border-zinc-800'
                          }`}
                        >
                          {st.label}
                        </div>
                      );
                    })}
                  </div>

                  {/* Price adjustment notice if any */}
                  {ord.priceAdjustmentNote && (
                    <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block text-amber-300">
                          Actualización de Costo / Presupuesto:
                        </strong>
                        <span>{ord.priceAdjustmentNote}</span>
                      </div>
                    </div>
                  )}

                  {/* Summary & Balance */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 rounded-2xl bg-[#070b16] border border-cyan-500/15 space-y-1.5">
                      <div className="text-zinc-400">
                        <strong className="text-zinc-200">Falla Reportada:</strong> {ord.reportedFault}
                      </div>
                      {ord.technicalDiagnostic && (
                        <div className="text-zinc-400">
                          <strong className="text-cyan-300">Diagnóstico Técnico:</strong>{' '}
                          {ord.technicalDiagnostic}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-emerald-400 pt-1">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Garantía: {ord.warrantyDays} días</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#070b16] border border-cyan-500/15 flex flex-col justify-between">
                      <div className="flex justify-between text-zinc-400">
                        <span>Costo Total Servicio:</span>
                        <strong className="text-white font-mono">
                          {formatCurrency(totals.total, currency)}
                        </strong>
                      </div>
                      <div className="flex justify-between text-cyan-400">
                        <span>Anticipo / Abono:</span>
                        <strong className="font-mono">
                          {formatCurrency(ord.depositPaid, currency)}
                        </strong>
                      </div>
                      <div className="flex justify-between text-sm font-black border-t border-zinc-800 pt-2 mt-1">
                        <span className="text-zinc-200">Saldo Pendiente:</span>
                        <span className="font-mono text-amber-400">
                          {formatCurrency(totals.balanceDue, currency)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Customer Visible Notes */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-mono uppercase text-zinc-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      Bitácora de Laboratorio
                    </span>
                    <div className="space-y-2">
                      {ord.trackingNotes
                        .filter((n) => n.isCustomerVisible)
                        .map((note) => (
                          <div
                            key={note.id}
                            className="p-3 rounded-xl bg-[#070b16] border border-zinc-800 text-xs"
                          >
                            <div className="flex justify-between items-center mb-0.5">
                              <strong className="text-white">{note.title}</strong>
                              <span className="text-[10px] text-zinc-500">
                                {new Date(note.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-zinc-300">{note.note}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {orders.length === 0 && (
              <div className="hud-panel rounded-3xl p-10 text-center text-zinc-400 text-sm">
                No tienes órdenes de reparación activas asociadas a este contacto.
              </div>
            )}
          </div>
        )}

        {/* Quotes */}
        {tab === 'quotes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quotes.map((q) => (
              <div
                key={q.id}
                className="hud-panel rounded-2xl p-5 space-y-4 border border-cyan-500/25"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-cyan-400">
                    {q.quoteNumber}
                  </span>
                  <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                    {q.status}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-white text-sm">{q.deviceDescription}</h3>
                  <p className="text-xs text-zinc-400 mt-1">{q.issueDescription}</p>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-zinc-800">
                  <span className="text-xs text-zinc-400">Total Cotizado:</span>
                  <strong className="text-base font-mono font-black text-white">
                    {formatCurrency(q.total, currency)}
                  </strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDocModal({ isOpen: true, type: 'cotizacion', quote: q })}
                    className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Ver / Descargar PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openWhatsApp(
                        settings.whatsapp || settings.phone,
                        `Hola ${settings.name}, apruebo/consulto la cotización ${q.quoteNumber} (${q.deviceDescription}).`
                      )
                    }
                    className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Aprobar</span>
                  </button>
                </div>
              </div>
            ))}

            {quotes.length === 0 && (
              <div className="col-span-full hud-panel rounded-3xl p-10 text-center text-zinc-400 text-sm">
                No tienes cotizaciones registradas.
              </div>
            )}
          </div>
        )}

        {/* Invoices */}
        {tab === 'invoices' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="hud-panel rounded-2xl p-5 space-y-4 border border-cyan-500/25"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-cyan-400">
                    {inv.invoiceNumber}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                    <CheckCircle2 className="w-3 h-3" />
                    {inv.paymentStatus}
                  </span>
                </div>

                <div className="text-xs space-y-1">
                  <div className="text-zinc-300">
                    Fecha: <strong>{new Date(inv.createdAt).toLocaleDateString()}</strong>
                  </div>
                  <div className="text-zinc-400">
                    Método: <strong className="uppercase text-white">{inv.paymentMethod}</strong>
                  </div>
                  {inv.orderNumber && (
                    <div className="text-zinc-400">
                      Orden: <strong className="font-mono text-cyan-300">{inv.orderNumber}</strong>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-zinc-800">
                  <span className="text-xs text-zinc-400">Total Facturado:</span>
                  <strong className="text-base font-mono font-black text-white">
                    {formatCurrency(inv.total, currency)}
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={() => setDocModal({ isOpen: true, type: 'factura', invoice: inv })}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Ver e Imprimir Factura en PDF</span>
                </button>
              </div>
            ))}

            {invoices.length === 0 && (
              <div className="col-span-full hud-panel rounded-3xl p-10 text-center text-zinc-400 text-sm">
                No tienes facturas emitidas todavía.
              </div>
            )}
          </div>
        )}
      </main>

      {docModal.isOpen && (
        <DocumentPrintModal
          type={docModal.type}
          order={docModal.order}
          quote={docModal.quote}
          invoice={docModal.invoice}
          settings={settings}
          onClose={() => setDocModal((prev) => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  );
};
