import React, { useState } from 'react';
import {
  Search,
  Smartphone,
  CheckCircle,
  Clock,
  Shield,
  MessageSquare,
  DollarSign,
  AlertCircle,
  Wrench,
  Layers,
  ArrowRight
} from 'lucide-react';
import { RepairOrder, WorkshopSettings, OrderStatus } from '../types/workshop';
import { calculateOrderTotals, formatCurrency, openWhatsApp, STATUS_LABELS } from '../utils/whatsapp';

interface ClientTrackerViewProps {
  orders: RepairOrder[];
  settings: WorkshopSettings;
}

export const ClientTrackerView: React.FC<ClientTrackerViewProps> = ({ orders, settings }) => {
  const currency = settings.currency || '$';
  const [orderQuery, setOrderQuery] = useState('');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [searchedOrder, setSearchedOrder] = useState<RepairOrder | null>(orders[0] || null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
    const cleanSearchOrder = orderQuery.trim().toLowerCase();
    const cleanPhone = phoneQuery.trim();

    const found = orders.find(o => {
      const matchNumber = o.orderNumber.toLowerCase() === cleanSearchOrder || o.orderNumber.toLowerCase().includes(cleanSearchOrder);
      const matchPhone = !cleanPhone || o.clientPhone.includes(cleanPhone);
      return matchNumber && matchPhone;
    });

    setSearchedOrder(found || null);
  };

  const steps: { status: OrderStatus; label: string }[] = [
    { status: 'recibido', label: '1. Recibido' },
    { status: 'diagnostico', label: '2. En Diagnóstico' },
    { status: 'en_reparacion', label: '3. En Reparación' },
    { status: 'control_calidad', label: '4. Pruebas Finales' },
    { status: 'listo', label: '5. Listo para Entrega' },
    { status: 'entregado', label: '6. Entregado' },
  ];

  const getStepIndex = (status: OrderStatus) => {
    switch (status) {
      case 'recibido': return 0;
      case 'diagnostico': return 1;
      case 'espera_repuesto': return 2;
      case 'en_reparacion': return 2;
      case 'control_calidad': return 3;
      case 'listo': return 4;
      case 'entregado': return 5;
      default: return 0;
    }
  };

  const currentStepIdx = searchedOrder ? getStepIndex(searchedOrder.status) : 0;
  const totals = searchedOrder ? calculateOrderTotals(searchedOrder) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Intro Header */}
      <div className="text-center space-y-3 py-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold shadow-[0_0_15px_rgba(0,242,254,0.2)]">
          <Wrench className="w-3.5 h-3.5 text-cyan-400" />
          PORTAL DE TELEMETRÍA PARA CLIENTES • TEKNOVANT LABS
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white font-mono">
          Rastreo de Reparación en Tiempo Real
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto font-mono">
          Ingresa el folio de tu orden (ej: REC-2026-001) y tu número de teléfono para consultar los avances y pruebas del laboratorio.
        </p>
      </div>

      {/* Search Box */}
      <form onSubmit={handleSearch} className="hud-panel p-5 sm:p-6 rounded-3xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-mono font-bold text-cyan-300 mb-1">
              Folio de Remisión / Orden:
            </label>
            <input
              type="text"
              placeholder="Ej: REC-2026-001"
              value={orderQuery}
              onChange={(e) => setOrderQuery(e.target.value)}
              className="w-full text-xs font-mono uppercase rounded-xl border border-cyan-500/30 bg-[#070b16] px-3.5 py-2.5 text-white outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-cyan-300 mb-1">
              Teléfono de Contacto:
            </label>
            <input
              type="text"
              placeholder="Ej: 3124567890 (Opcional)"
              value={phoneQuery}
              onChange={(e) => setPhoneQuery(e.target.value)}
              className="w-full text-xs font-mono rounded-xl border border-cyan-500/30 bg-[#070b16] px-3.5 py-2.5 text-white outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-white font-mono font-extrabold text-xs rounded-xl shadow-[0_0_15px_rgba(0,242,254,0.3)] transition flex items-center justify-center gap-2"
        >
          <Search className="w-4 h-4" />
          CONSULTAR ESTADO EN LABORATORIO TEKNOVANT
        </button>
      </form>

      {/* Search Result */}
      {searchedOrder ? (
        <div className="bg-white dark:bg-zinc-850 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-md space-y-6">
          
          {/* Order Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div>
              <span className="font-mono text-xs font-extrabold text-blue-600 dark:text-blue-400">
                {searchedOrder.orderNumber}
              </span>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white mt-0.5">
                {searchedOrder.brand} {searchedOrder.model}
              </h3>
              <p className="text-xs text-zinc-500">
                Cliente: <strong>{searchedOrder.clientName}</strong> • Ingresado el {new Date(searchedOrder.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className={`inline-block text-xs font-bold uppercase px-3 py-1 rounded-full ${STATUS_LABELS[searchedOrder.status].bg} ${STATUS_LABELS[searchedOrder.status].color}`}>
                {STATUS_LABELS[searchedOrder.status].label}
              </span>
              {searchedOrder.estimatedDeliveryDate && (
                <p className="text-[11px] text-zinc-500 mt-1">
                  Entrega estimada: {new Date(searchedOrder.estimatedDeliveryDate).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {/* Stepper Progress */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Progreso de Reparación:
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
              {steps.map((step, idx) => {
                const isPassed = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;

                return (
                  <div
                    key={step.status}
                    className={`p-2 rounded-xl text-center border transition ${
                      isCurrent
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                        : isPassed
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <div className="text-[10px] sm:text-[11px] truncate">{step.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Issue & Technical Diagnosis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <span className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                Falla o Motivo de Ingreso:
              </span>
              <p className="text-zinc-600 dark:text-zinc-400">{searchedOrder.reportedFault}</p>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <span className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                Diagnóstico Técnico:
              </span>
              <p className="text-zinc-600 dark:text-zinc-400">
                {searchedOrder.technicalDiagnostic || 'El equipo se encuentra en mesa de diagnóstico por el técnico especialista.'}
              </p>
            </div>
          </div>

          {/* Financial summary for customer */}
          {totals && (
            <div className="bg-gradient-to-r from-zinc-50 to-blue-50 dark:from-zinc-800 dark:to-zinc-850 p-4 rounded-xl border border-blue-100 dark:border-zinc-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <span className="text-xs text-zinc-500 block">Resumen Económico:</span>
                <div className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">
                  Total: {formatCurrency(totals.total, currency)} • Abono: {formatCurrency(searchedOrder.depositPaid, currency)}
                </div>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-xs text-zinc-500 block">Saldo a Cancelar al Retirar:</span>
                <div className="text-xl font-mono font-black text-red-600 dark:text-red-400">
                  {formatCurrency(totals.balanceDue, currency)}
                </div>
              </div>
            </div>
          )}

          {/* Public Timeline Notes */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Bitácora de Actualizaciones para el Cliente:
            </h4>

            <div className="space-y-2.5">
              {searchedOrder.trackingNotes
                .filter(n => n.isCustomerVisible)
                .map((note) => (
                  <div key={note.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-900 dark:text-white">{note.title}</span>
                      <span className="text-[10px] text-zinc-400">{new Date(note.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-300">{note.note}</p>
                  </div>
                ))}
            </div>
          </div>

          {/* Workshop Contact button */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-zinc-500">
              ¿Deseas autorizar un repuesto o consultar detalles con el técnico?
            </span>

            <button
              onClick={() => {
                const text = `Hola ${settings.name}, soy ${searchedOrder.clientName}. Deseo consultar sobre mi orden ${searchedOrder.orderNumber} (${searchedOrder.brand} ${searchedOrder.model}).`;
                openWhatsApp(settings.whatsapp || settings.phone, text);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
            >
              <MessageSquare className="w-4 h-4" />
              Contactar al Taller por WhatsApp
            </button>
          </div>

        </div>
      ) : hasSearched ? (
        <div className="bg-white dark:bg-zinc-850 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-center text-zinc-500 text-sm space-y-2">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
          <p className="font-bold text-zinc-800 dark:text-zinc-200">No encontramos ninguna orden con esos datos.</p>
          <p className="text-xs">Verifica el número de orden (ej: REC-2026-001) o comunícate con el taller.</p>
        </div>
      ) : null}

    </div>
  );
};
