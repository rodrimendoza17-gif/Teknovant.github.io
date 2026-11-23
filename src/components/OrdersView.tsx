import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  PlusCircle,
  Smartphone,
  Laptop,
  Monitor,
  Gamepad2,
  Wrench,
  Clock,
  Printer,
  MessageSquare,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Layers,
  ListFilter,
  Calendar,
  Cpu,
  ArrowRight,
  ShieldCheck,
  Check,
  Trash2,
  Loader2
} from 'lucide-react';
import { RepairOrder, OrderStatus, Priority, WorkshopSettings } from '../types/workshop';
import { calculateOrderTotals, formatCurrency, openWhatsApp, generateWhatsAppMessage, STATUS_LABELS } from '../utils/whatsapp';
import type { SendWhatsAppPayload } from './WhatsAppSessionView';

interface OrdersViewProps {
  orders: RepairOrder[];
  settings: WorkshopSettings;
  onSelectOrder: (order: RepairOrder) => void;
  onNewOrder: () => void;
  onDeleteOrder: (orderId: string) => void;
  onPrintRemision: (order: RepairOrder) => void;
  onPrintRecibo: (order: RepairOrder) => void;
  whatsappConnected?: boolean;
  onSendWhatsApp?: (payload: SendWhatsAppPayload) => Promise<void>;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  settings,
  onSelectOrder,
  onNewOrder,
  onDeleteOrder,
  onPrintRemision,
  onPrintRecibo,
  whatsappConnected = false,
  onSendWhatsApp
}) => {
  const currency = settings.currency || '$';
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('all');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sendingOrderId, setSendingOrderId] = useState<string | null>(null);
  const [sentOrderId, setSentOrderId] = useState<string | null>(null);

  const handleQuickWhatsApp = async (ord: RepairOrder) => {
    const msg = generateWhatsAppMessage('actualizacion_estado', ord, undefined, settings);
    if (whatsappConnected && onSendWhatsApp) {
      setSendingOrderId(ord.id);
      try {
        await onSendWhatsApp({
          toPhone: ord.clientPhone,
          clientName: ord.clientName,
          message: msg,
          category: 'seguimiento',
          referenceNumber: ord.orderNumber
        });
        setSentOrderId(ord.id);
        setTimeout(() => setSentOrderId((curr) => (curr === ord.id ? null : curr)), 3000);
      } catch {
        // toast shows error
      } finally {
        setSendingOrderId(null);
      }
    } else {
      openWhatsApp(ord.clientPhone, msg);
    }
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch =
        o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.clientPhone.includes(searchTerm) ||
        o.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.serialOrImei && o.serialOrImei.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus = selectedStatusFilter === 'all' || o.status === selectedStatusFilter;
      const matchPriority = selectedPriorityFilter === 'all' || o.priority === selectedPriorityFilter;
      const matchDevice = deviceFilter === 'all' || o.deviceType === deviceFilter;

      return matchSearch && matchStatus && matchPriority && matchDevice;
    });
  }, [orders, searchTerm, selectedStatusFilter, selectedPriorityFilter, deviceFilter]);

  const kanbanColumns: { status: OrderStatus; label: string; icon: string; border: string }[] = [
    { status: 'recibido', label: '1. Recibido en Lab', icon: '📥', border: 'border-blue-500/40' },
    { status: 'diagnostico', label: '2. En Diagnóstico', icon: '🔍', border: 'border-amber-500/40' },
    { status: 'espera_repuesto', label: '3. Espera Repuesto', icon: '⏳', border: 'border-purple-500/40' },
    { status: 'en_reparacion', label: '4. En Banco / BGA', icon: '⚙️', border: 'border-indigo-500/40' },
    { status: 'control_calidad', label: '5. Pruebas / QA', icon: '🧪', border: 'border-cyan-500/40' },
    { status: 'listo', label: '6. Listo para Retiro', icon: '🎉', border: 'border-emerald-500/40' },
    { status: 'entregado', label: '7. Entregado Conforme', icon: '✅', border: 'border-zinc-500/40' },
  ];

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'celular': return <Smartphone className="w-3.5 h-3.5 text-cyan-400" />;
      case 'laptop': return <Laptop className="w-3.5 h-3.5 text-emerald-400" />;
      case 'computador': return <Monitor className="w-3.5 h-3.5 text-purple-400" />;
      case 'consola': return <Gamepad2 className="w-3.5 h-3.5 text-rose-400" />;
      default: return <Cpu className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Organized Futuristic Filter Bar */}
      <div className="hud-panel p-4 rounded-3xl space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Main search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Buscar por IMEI, # Orden, Cliente, Celular, Modelo (ej: iPhone, ThinkPad, PS5)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs font-mono rounded-2xl border border-cyan-500/20 bg-[#070b16] text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400"
            />
          </div>

          {/* Filters & View switcher */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className="text-xs font-mono rounded-xl border border-cyan-500/20 bg-[#070b16] px-3 py-2 text-zinc-300 outline-none"
            >
              <option value="all">Todos los Equipos</option>
              <option value="celular">📱 Celulares</option>
              <option value="laptop">💻 Laptops</option>
              <option value="computador">🖥️ Computadores</option>
              <option value="consola">🎮 Consolas</option>
              <option value="tablet">📟 Tablets</option>
            </select>

            <select
              value={selectedPriorityFilter}
              onChange={(e) => setSelectedPriorityFilter(e.target.value)}
              className="text-xs font-mono rounded-xl border border-cyan-500/20 bg-[#070b16] px-3 py-2 text-zinc-300 outline-none"
            >
              <option value="all">Prioridad (Todas)</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">🔥 Urgente</option>
            </select>

            {/* Kanban vs List Switcher */}
            <div className="flex items-center bg-[#070b16] p-1 rounded-xl border border-cyan-500/20 text-xs font-mono">
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 font-bold ${
                  viewMode === 'kanban'
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(0,242,254,0.2)]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Tablero
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 font-bold ${
                  viewMode === 'list'
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(0,242,254,0.2)]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                Lista
              </button>
            </div>

            <button
              onClick={onNewOrder}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs font-mono shadow-[0_0_15px_rgba(0,242,254,0.3)] transition active:scale-95 border border-cyan-200/40"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Nueva Remisión</span>
            </button>
          </div>
        </div>

        {/* Quick Status Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
          <button
            onClick={() => setSelectedStatusFilter('all')}
            className={`px-3 py-1 rounded-xl transition whitespace-nowrap ${
              selectedStatusFilter === 'all'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-zinc-400 hover:text-white bg-[#070b16]'
            }`}
          >
            Todos ({orders.length})
          </button>
          {Object.entries(STATUS_LABELS).map(([key, val]) => {
            const isSelected = selectedStatusFilter === key;
            const count = orders.filter(o => o.status === key).length;
            return (
              <button
                key={key}
                onClick={() => setSelectedStatusFilter(key)}
                className={`px-3 py-1 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'text-zinc-400 hover:text-white bg-[#070b16]'
                }`}
              >
                <span>{val.label}</span>
                <span className="text-[10px] text-zinc-500">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* KANBAN BOARD VIEW */}
      {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-6 pt-1">
          {kanbanColumns.map((col) => {
            const colOrders = filteredOrders.filter((o) => o.status === col.status);

            return (
              <div
                key={col.status}
                className={`w-76 sm:w-82 shrink-0 bg-[#090f22]/90 rounded-3xl p-3.5 border ${col.border} flex flex-col max-h-[78vh] shadow-[0_4px_25px_rgba(0,0,0,0.4)]`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 px-1 border-b border-cyan-500/20 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{col.icon}</span>
                    <h3 className="font-mono font-bold text-xs text-zinc-200 uppercase tracking-wide">
                      {col.label}
                    </h3>
                  </div>
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#070b16] text-cyan-300 border border-cyan-500/30">
                    {colOrders.length}
                  </span>
                </div>

                {/* Orders in Column */}
                <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                  {colOrders.map((ord) => {
                    const totals = calculateOrderTotals(ord);
                    const hasIncidents = ord.trackingNotes.some((n) => n.incidentType !== 'ninguno');

                    return (
                      <div
                        key={ord.id}
                        onClick={() => onSelectOrder(ord)}
                        className="bg-[#0b142c] p-4 rounded-2xl border border-cyan-500/20 hover:border-cyan-400/60 shadow-md hover:shadow-[0_0_20px_rgba(0,242,254,0.15)] transition cursor-pointer space-y-3 group"
                      >
                        {/* Top bar with Order # and tags */}
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-cyan-400">
                            {ord.orderNumber}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {ord.priority === 'urgente' && (
                              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-500/40 uppercase">
                                🔥 Urgente
                              </span>
                            )}
                            {hasIncidents && (
                              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/40 uppercase">
                                ⚠️ Novedad
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Device info */}
                        <div>
                          <div className="flex items-center gap-2 text-xs font-mono font-bold text-white truncate">
                            {getDeviceIcon(ord.deviceType)}
                            <span className="truncate">{ord.brand} {ord.model}</span>
                          </div>
                          <p className="text-[11px] text-zinc-400 truncate mt-0.5 font-mono">
                            Cliente: <strong className="text-zinc-200">{ord.clientName}</strong>
                          </p>
                        </div>

                        {/* Reported Fault */}
                        <p className="text-[11px] text-zinc-300 line-clamp-2 bg-[#060b18] p-2 rounded-xl border border-cyan-500/10 font-mono">
                          {ord.reportedFault}
                        </p>

                        {/* Bottom Actions and Balances */}
                        <div className="flex items-center justify-between pt-2.5 border-t border-cyan-500/10 text-xs font-mono">
                          <div>
                            <span className="text-[10px] text-zinc-500 block">Saldo a cobrar:</span>
                            <strong className="text-white font-bold text-xs">
                              {formatCurrency(totals.balanceDue, currency)}
                            </strong>
                          </div>

                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              disabled={sendingOrderId === ord.id}
                              onClick={() => handleQuickWhatsApp(ord)}
                              className="p-1.5 text-emerald-400 hover:bg-emerald-950/60 rounded-lg border border-emerald-500/30 transition disabled:opacity-60 cursor-pointer"
                              title={whatsappConnected ? 'Enviar seguimiento directo por WhatsApp' : 'Avisar por WhatsApp Web'}
                            >
                              {sendingOrderId === ord.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : sentOrderId === ord.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-300" />
                              ) : (
                                <MessageSquare className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              onClick={() => onPrintRemision(ord)}
                              className="p-1.5 text-cyan-400 hover:bg-cyan-950/60 rounded-lg border border-cyan-500/30 transition"
                              title="Imprimir Remisión"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            {confirmDeleteId === ord.id ? (
                              <div className="flex items-center gap-1 bg-red-950/90 border border-red-500/50 rounded-lg px-2 py-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteOrder(ord.id);
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
                                onClick={() => setConfirmDeleteId(ord.id)}
                                className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg border border-rose-500/30 transition"
                                title="Eliminar equipo / remisión"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}

                  {colOrders.length === 0 && (
                    <div className="text-center py-10 text-zinc-500 font-mono text-xs italic">
                      Fase despejada
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TABLE LIST VIEW */}
      {viewMode === 'list' && (
        <div className="hud-panel rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#070b16] text-cyan-400 font-bold border-b border-cyan-500/20">
                <tr>
                  <th className="p-4">Folio</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Dispositivo</th>
                  <th className="p-4">Falla Reportada</th>
                  <th className="p-4">Estado Técnico</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4 text-right">Saldo</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-500/10">
                {filteredOrders.map((ord) => {
                  const totals = calculateOrderTotals(ord);
                  const statusMeta = STATUS_LABELS[ord.status];

                  return (
                    <tr
                      key={ord.id}
                      onClick={() => onSelectOrder(ord)}
                      className="hover:bg-cyan-500/5 cursor-pointer transition"
                    >
                      <td className="p-4 font-bold text-cyan-400 whitespace-nowrap">
                        {ord.orderNumber}
                      </td>
                      <td className="p-4 text-zinc-400 whitespace-nowrap">
                        {new Date(ord.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <strong className="text-white block">{ord.clientName}</strong>
                        <span className="text-[11px] text-zinc-500">{ord.clientPhone}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 font-bold text-white">
                          {getDeviceIcon(ord.deviceType)}
                          {ord.brand} {ord.model}
                        </div>
                        <span className="text-[10px] text-zinc-500">{ord.serialOrImei || 'Sin IMEI'}</span>
                      </td>
                      <td className="p-4 max-w-xs truncate text-zinc-300">
                        {ord.reportedFault}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border border-cyan-500/20 bg-[#070b16] text-cyan-300`}>
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="p-4 text-right font-bold text-white whitespace-nowrap">
                        {formatCurrency(totals.total, currency)}
                      </td>
                      <td className="p-4 text-right font-bold text-rose-400 whitespace-nowrap">
                        {formatCurrency(totals.balanceDue, currency)}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            disabled={sendingOrderId === ord.id}
                            onClick={() => handleQuickWhatsApp(ord)}
                            className="p-1.5 text-emerald-400 hover:bg-emerald-950/60 rounded-lg border border-emerald-500/30 transition disabled:opacity-60 cursor-pointer"
                            title={whatsappConnected ? 'Enviar seguimiento directo por WhatsApp' : 'Avisar WhatsApp Web'}
                          >
                            {sendingOrderId === ord.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : sentOrderId === ord.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-300" />
                            ) : (
                              <MessageSquare className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => onPrintRemision(ord)}
                            className="p-1.5 text-cyan-400 hover:bg-cyan-950/60 rounded-lg border border-cyan-500/30 transition"
                            title="Remisión PDF"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {confirmDeleteId === ord.id ? (
                            <div className="flex items-center gap-1 bg-red-950/90 border border-red-500/50 rounded-lg px-2 py-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteOrder(ord.id);
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
                              onClick={() => setConfirmDeleteId(ord.id)}
                              className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg border border-rose-500/30 transition"
                              title="Eliminar equipo / remisión"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-zinc-500 font-mono italic">
                      No se encontraron órdenes registradas con los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
