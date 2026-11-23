import React, { useState, useMemo } from 'react';
import {
  Search,
  Printer,
  Trash2,
  Users,
  List,
  ChevronDown,
  ChevronUp,
  Phone,
  Receipt,
  Send,
  Loader2,
  Check
} from 'lucide-react';
import { Invoice, WorkshopSettings } from '../types/workshop';
import { formatCurrency, generateInvoiceWhatsAppMessage, openWhatsApp } from '../utils/whatsapp';
import type { SendWhatsAppPayload } from './WhatsAppSessionView';

interface InvoicesViewProps {
  invoices: Invoice[];
  settings: WorkshopSettings;
  onPrintInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  whatsappConnected?: boolean;
  onSendWhatsApp?: (payload: SendWhatsAppPayload) => Promise<void>;
}

interface ClientGroup {
  key: string;
  clientName: string;
  clientPhone: string;
  clientDocId?: string;
  invoices: Invoice[];
  totalPaid: number;
  totalPending: number;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices,
  settings,
  onPrintInvoice,
  onDeleteInvoice,
  whatsappConnected = false,
  onSendWhatsApp,
}) => {
  const currency = settings.currency || '$';
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pagada' | 'pendiente'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');
  const [expandedClientKey, setExpandedClientKey] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sendingInvId, setSendingInvId] = useState<string | null>(null);
  const [sentInvId, setSentInvId] = useState<string | null>(null);

  const handleSendInvoiceWhatsApp = async (inv: Invoice) => {
    const msg = generateInvoiceWhatsAppMessage(inv, settings);
    if (whatsappConnected && onSendWhatsApp) {
      setSendingInvId(inv.id);
      try {
        await onSendWhatsApp({
          toPhone: inv.clientPhone,
          clientName: inv.clientName,
          message: msg,
          category: 'factura',
          referenceNumber: inv.invoiceNumber,
        });
        setSentInvId(inv.id);
        setTimeout(() => setSentInvId((curr) => (curr === inv.id ? null : curr)), 3000);
      } catch {
        // handled by toast
      } finally {
        setSendingInvId(null);
      }
    } else {
      openWhatsApp(inv.clientPhone, msg);
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.clientName.toLowerCase().includes(q) ||
        inv.clientPhone.includes(searchTerm) ||
        (inv.orderNumber && inv.orderNumber.toLowerCase().includes(q));

      const matchStatus = statusFilter === 'all' || inv.paymentStatus === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [invoices, searchTerm, statusFilter]);

  const totalInvoiced = filteredInvoices.reduce(
    (acc, inv) => acc + (inv.paymentStatus === 'pagada' ? inv.total : 0),
    0
  );

  // Group invoices by normalized phone or lowercase name
  const groupedClients = useMemo(() => {
    const map = new Map<string, ClientGroup>();
    filteredInvoices.forEach((inv) => {
      const cleanPhone = (inv.clientPhone || '').replace(/[^0-9]/g, '');
      const key = cleanPhone.length >= 7 ? cleanPhone.slice(-10) : inv.clientName.trim().toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.invoices.push(inv);
        if (inv.paymentStatus === 'pagada') existing.totalPaid += inv.total;
        else if (inv.paymentStatus === 'pendiente') existing.totalPending += inv.total;
      } else {
        map.set(key, {
          key,
          clientName: inv.clientName,
          clientPhone: inv.clientPhone,
          clientDocId: inv.clientDocId,
          invoices: [inv],
          totalPaid: inv.paymentStatus === 'pagada' ? inv.total : 0,
          totalPending: inv.paymentStatus === 'pendiente' ? inv.total : 0,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.totalPaid - a.totalPaid);
  }, [filteredInvoices]);

  return (
    <div className="space-y-4">
      {/* Top Banner and Stats */}
      <div className="hud-panel p-4 rounded-3xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Buscar por # Factura, Orden, Cliente o Teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs font-mono rounded-2xl border border-cyan-500/20 bg-[#070b16] text-white outline-none focus:ring-2 focus:ring-cyan-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View mode toggle: List vs Grouped by Client */}
          <div className="flex items-center bg-[#070b16] p-1 rounded-xl border border-cyan-500/20 text-xs font-mono">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 font-bold cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 font-bold cursor-pointer ${
                viewMode === 'grouped'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Agrupado por Cliente ({groupedClients.length})</span>
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pagada' | 'pendiente')}
            className="text-xs font-mono rounded-xl border border-cyan-500/20 bg-[#070b16] px-3 py-2 text-zinc-300 outline-none"
          >
            <option value="all">Todas las Facturas</option>
            <option value="pagada">Pagadas</option>
            <option value="pendiente">Pendientes de Pago</option>
          </select>

          <div className="bg-[#070b16] border border-cyan-500/30 px-3.5 py-2 rounded-xl text-xs font-mono flex items-center gap-2">
            <span className="text-zinc-400">Recaudado:</span>
            <strong className="text-cyan-300 font-bold">
              {formatCurrency(totalInvoiced, currency)}
            </strong>
          </div>
        </div>
      </div>

      {/* LIST VIEW */}
      {viewMode === 'list' ? (
        <div className="hud-panel rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#070b16] text-cyan-400 font-bold border-b border-cyan-500/20">
                <tr>
                  <th className="p-4"># Factura</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Orden Asociada</th>
                  <th className="p-4">Método de Pago</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-right">Subtotal</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-500/10">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-cyan-500/5 transition">
                    <td className="p-4 font-bold text-cyan-400 whitespace-nowrap">
                      {inv.invoiceNumber}
                    </td>
                    <td className="p-4 text-zinc-400 whitespace-nowrap">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <strong className="text-white block">{inv.clientName}</strong>
                      <span className="text-[11px] text-zinc-500">
                        {inv.clientDocId || inv.clientPhone}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-300">{inv.orderNumber || 'Servicio Directo'}</td>
                    <td className="p-4 uppercase text-zinc-300 font-medium">{inv.paymentMethod}</td>
                    <td className="p-4 whitespace-nowrap">
                      <span
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          inv.paymentStatus === 'pagada'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                            : 'bg-amber-950 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {inv.paymentStatus}
                      </span>
                    </td>
                    <td className="p-4 text-right text-zinc-400">
                      {formatCurrency(inv.subtotal, currency)}
                    </td>
                    <td className="p-4 text-right font-bold text-white">
                      {formatCurrency(inv.total, currency)}
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          disabled={sendingInvId === inv.id}
                          onClick={() => handleSendInvoiceWhatsApp(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-60"
                          title={whatsappConnected ? 'Enviar factura directo por WhatsApp' : 'Abrir WhatsApp Web'}
                        >
                          {sendingInvId === inv.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : sentInvId === inv.id ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span>{sentInvId === inv.id ? 'Enviada' : 'WA'}</span>
                        </button>

                        <button
                          onClick={() => onPrintInvoice(inv)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0b142c] hover:bg-[#12224d] text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>

                        {confirmDeleteId === inv.id ? (
                          <div className="flex items-center gap-1 bg-red-950/90 border border-red-500/50 rounded-lg px-2 py-1">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteInvoice(inv.id);
                                setConfirmDeleteId(null);
                              }}
                              className="text-[10px] font-bold text-red-300 hover:text-white"
                            >
                              Borrar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[10px] text-zinc-400 hover:text-white"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(inv.id)}
                            className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg border border-rose-500/30 transition cursor-pointer"
                            title="Eliminar factura"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-zinc-500 font-mono italic">
                      No se encontraron facturas registradas en el sistema.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GROUPED BY CLIENT VIEW */
        <div className="space-y-3">
          {groupedClients.map((group) => {
            const isExpanded = expandedClientKey === group.key;

            return (
              <div
                key={group.key}
                className="hud-panel rounded-2xl border border-cyan-500/25 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedClientKey(isExpanded ? null : group.key)}
                  className="w-full p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-cyan-500/5 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm sm:text-base">
                        {group.clientName}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-zinc-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-cyan-400" />
                          {group.clientPhone}
                        </span>
                        {group.clientDocId && <span>• {group.clientDocId}</span>}
                        <span className="text-cyan-300 font-bold">
                          • {group.invoices.length}{' '}
                          {group.invoices.length === 1 ? 'factura' : 'facturas'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 font-mono">
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-500 block uppercase">
                        Historial Pagado
                      </span>
                      <strong className="text-base text-emerald-400 font-black">
                        {formatCurrency(group.totalPaid, currency)}
                      </strong>
                      {group.totalPending > 0 && (
                        <span className="block text-[10px] text-amber-400">
                          Pendiente: {formatCurrency(group.totalPending, currency)}
                        </span>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-cyan-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-zinc-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-cyan-500/20 bg-[#070b16]/80 p-4 space-y-2">
                    {group.invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3 rounded-xl bg-[#091024] border border-cyan-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono"
                      >
                        <div className="flex items-center gap-3">
                          <Receipt className="w-4 h-4 text-cyan-400 shrink-0" />
                          <div>
                            <div className="flex items-center gap-2">
                              <strong className="text-cyan-300">{inv.invoiceNumber}</strong>
                              <span className="text-zinc-500">
                                {new Date(inv.createdAt).toLocaleDateString()}
                              </span>
                              <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                                {inv.paymentStatus}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-0.5">
                              {inv.orderNumber ? `Orden ${inv.orderNumber} • ` : ''}
                              Pago: <span className="uppercase">{inv.paymentMethod}</span> •{' '}
                              {inv.items.length} conceptos
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <strong className="text-sm text-white mr-2">
                            {formatCurrency(inv.total, currency)}
                          </strong>
                          <button
                            type="button"
                            disabled={sendingInvId === inv.id}
                            onClick={() => handleSendInvoiceWhatsApp(inv)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-60"
                            title={whatsappConnected ? 'Enviar factura directo por WhatsApp' : 'Abrir WhatsApp Web'}
                          >
                            {sendingInvId === inv.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : sentInvId === inv.id ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            <span>{sentInvId === inv.id ? 'Enviada' : 'WhatsApp'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onPrintInvoice(inv)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0b142c] hover:bg-[#12224d] text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold transition cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                          {confirmDeleteId === inv.id ? (
                            <div className="flex items-center gap-1 bg-red-950/90 border border-red-500/50 rounded-lg px-2 py-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteInvoice(inv.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="text-[10px] font-bold text-red-300 hover:text-white"
                              >
                                Borrar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-[10px] text-zinc-400 hover:text-white"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(inv.id)}
                              className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg border border-rose-500/30 transition cursor-pointer"
                              title="Eliminar factura"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {groupedClients.length === 0 && (
            <div className="hud-panel rounded-3xl p-10 text-center text-zinc-500 font-mono text-xs italic">
              No se encontraron clientes con facturas registradas.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
