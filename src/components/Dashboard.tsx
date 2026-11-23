import React, { useState, useMemo } from 'react';
import {
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Smartphone,
  Laptop,
  Monitor,
  Gamepad2,
  PlusCircle,
  FileSpreadsheet,
  Layers,
  Cpu,
  Zap,
  Activity,
  Radio,
  ShieldCheck,
  ChevronRight,
  MessageSquare,
  Package,
  ShoppingBag,
  Wind,
  Target,
  BarChart3
} from 'lucide-react';
import { RepairOrder, Quote, WorkshopSettings, OrderStatus, MerchandiseItem, POSSale } from '../types/workshop';
import { calculateOrderTotals, formatCurrency, STATUS_LABELS, openWhatsApp, generateWhatsAppMessage } from '../utils/whatsapp';

interface DashboardProps {
  orders: RepairOrder[];
  quotes: Quote[];
  settings: WorkshopSettings;
  merchandise?: MerchandiseItem[];
  sales?: POSSale[];
  onNewOrder: () => void;
  onNewQuote: () => void;
  onSelectOrder: (order: RepairOrder) => void;
  onNavigateTab: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  orders,
  settings,
  merchandise = [],
  sales = [],
  onNewOrder,
  onNewQuote,
  onSelectOrder,
  onNavigateTab
}) => {
  const [timeRange, setTimeRange] = useState<'all' | 'month' | 'week'>('all');
  const currency = settings.currency || '$';

  // Filter orders and POS sales by time range
  const filteredOrders = useMemo(() => {
    const now = Date.now();
    return orders.filter(order => {
      const orderTime = new Date(order.createdAt).getTime();
      if (timeRange === 'week') return now - orderTime <= 7 * 86400 * 1000;
      if (timeRange === 'month') return now - orderTime <= 30 * 86400 * 1000;
      return true;
    });
  }, [orders, timeRange]);

  const filteredSales = useMemo(() => {
    const now = Date.now();
    return sales.filter(sale => {
      const saleTime = new Date(sale.createdAt).getTime();
      if (timeRange === 'week') return now - saleTime <= 7 * 86400 * 1000;
      if (timeRange === 'month') return now - saleTime <= 30 * 86400 * 1000;
      return true;
    });
  }, [sales, timeRange]);

  // Key metrics
  const metrics = useMemo(() => {
    let workshopRevenue = 0;
    let totalPendingBalance = 0;
    let totalLabor = 0;
    let totalParts = 0;
    let completedCount = 0;
    let inProgressCount = 0;
    let readyCount = 0;
    let urgentCount = 0;

    filteredOrders.forEach(ord => {
      const totals = calculateOrderTotals(ord);
      if (ord.status === 'entregado') {
        workshopRevenue += totals.total;
        completedCount++;
      } else {
        totalPendingBalance += totals.balanceDue;
        workshopRevenue += ord.depositPaid || 0;
      }

      totalLabor += ord.laborCost || 0;
      totalParts += totals.partsSubtotal || 0;

      if (['diagnostico', 'espera_repuesto', 'en_reparacion', 'control_calidad'].includes(ord.status)) {
        inProgressCount++;
      }
      if (ord.status === 'listo') {
        readyCount++;
      }
      if (ord.priority === 'urgente' && ord.status !== 'entregado' && ord.status !== 'cancelado') {
        urgentCount++;
      }
    });

    const posRevenue = filteredSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalRevenue = workshopRevenue + posRevenue;

    const activeOrders = filteredOrders.filter(o => o.status !== 'entregado' && o.status !== 'cancelado').length;
    const efficiencyRate = filteredOrders.length > 0
      ? Math.round((completedCount / filteredOrders.length) * 100)
      : 100;

    return {
      workshopRevenue,
      posRevenue,
      totalRevenue,
      totalPendingBalance,
      totalLabor,
      totalParts,
      completedCount,
      inProgressCount,
      readyCount,
      urgentCount,
      activeOrders,
      efficiencyRate
    };
  }, [filteredOrders, filteredSales]);

  // Visible Sales vs Goals Chart Data (Last 7 days + Monthly & Weekly Goal Progress)
  const salesGoalsChart = useMemo(() => {
    const now = new Date();
    const weekAgo = now.getTime() - 7 * 86400 * 1000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const getOrderRev = (o: RepairOrder) =>
      o.status === 'entregado' ? calculateOrderTotals(o).total : (o.depositPaid || 0);

    const weeklyTotal =
      orders.filter(o => new Date(o.createdAt).getTime() >= weekAgo).reduce((s, o) => s + getOrderRev(o), 0) +
      sales.filter(s => new Date(s.createdAt).getTime() >= weekAgo).reduce((s, sl) => s + (sl.total || 0), 0);

    const monthlyTotal =
      orders.filter(o => new Date(o.createdAt).getTime() >= monthStart).reduce((s, o) => s + getOrderRev(o), 0) +
      sales.filter(s => new Date(s.createdAt).getTime() >= monthStart).reduce((s, sl) => s + (sl.total || 0), 0);

    const weeklyGoal = Math.max(1, settings.weeklySalesGoal || 5000);
    const monthlyGoal = Math.max(1, settings.monthlySalesGoal || 20000);

    const weeklyPct = Math.min(100, Math.round((weeklyTotal / weeklyGoal) * 100));
    const monthlyPct = Math.min(100, Math.round((monthlyTotal / monthlyGoal) * 100));

    // Build 7 daily buckets
    const days: { label: string; fullDate: string; workshop: number; pos: number; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const isoPrefix = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '').toUpperCase();

      const dayWorkshop = orders
        .filter(o => o.createdAt.startsWith(isoPrefix))
        .reduce((s, o) => s + getOrderRev(o), 0);

      const dayPos = sales
        .filter(s => s.createdAt.startsWith(isoPrefix))
        .reduce((s, sl) => s + (sl.total || 0), 0);

      days.push({
        label: dayLabel,
        fullDate: isoPrefix,
        workshop: dayWorkshop,
        pos: dayPos,
        total: dayWorkshop + dayPos
      });
    }

    const maxDaily = Math.max(...days.map(d => d.total), 100);

    return {
      weeklyTotal,
      monthlyTotal,
      weeklyGoal,
      monthlyGoal,
      weeklyPct,
      monthlyPct,
      days,
      maxDaily
    };
  }, [orders, sales, settings.weeklySalesGoal, settings.monthlySalesGoal]);

  // Breakdown by status
  const statusStats = useMemo(() => {
    const counts: Record<OrderStatus, number> = {
      recibido: 0,
      diagnostico: 0,
      espera_repuesto: 0,
      en_reparacion: 0,
      control_calidad: 0,
      listo: 0,
      entregado: 0,
      cancelado: 0
    };

    filteredOrders.forEach(o => {
      if (counts[o.status] !== undefined) {
        counts[o.status]++;
      }
    });

    return counts;
  }, [filteredOrders]);

  // Breakdown by device type
  const deviceStats = useMemo(() => {
    const counts: Record<string, number> = {
      celular: 0,
      laptop: 0,
      computador: 0,
      consola: 0,
      tablet: 0,
      otro: 0
    };

    filteredOrders.forEach(o => {
      const type = counts[o.deviceType] !== undefined ? o.deviceType : 'otro';
      counts[type]++;
    });

    const total = filteredOrders.length || 1;
    return Object.entries(counts)
      .map(([type, count]) => ({
        type,
        count,
        pct: Math.round((count / total) * 100)
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredOrders]);

  // Orders with incidents or urgent
  const attentionOrders = useMemo(() => {
    return orders
      .filter(o => {
        if (o.status === 'entregado' || o.status === 'cancelado') return false;
        const hasIncident = o.trackingNotes.some(n => n.incidentType !== 'ninguno');
        const isUrgent = o.priority === 'urgente';
        const isWaitingParts = o.status === 'espera_repuesto';
        return hasIncident || isUrgent || isWaitingParts;
      })
      .slice(0, 6);
  }, [orders]);

  const maxStatusCount = Math.max(...Object.values(statusStats), 1);

  return (
    <div className="space-y-6">

      {/* Futuristic Command Hero Banner with Workshop Logo */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-[#070e24] via-[#0b1739] to-[#071328] p-6 sm:p-8 shadow-[0_0_50px_rgba(0,242,254,0.12)]">
        <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {settings.logoUrl && (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#050914] border border-cyan-400/40 p-2.5 flex items-center justify-center shrink-0 shadow-[0_0_25px_rgba(0,242,254,0.2)]">
                <img
                  src={settings.logoUrl}
                  alt={settings.name}
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-mono tracking-wider shadow-[0_0_15px_rgba(0,242,254,0.2)]">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                SISTEMA DE MANDO DE LABORATORIO • WEB EN TIEMPO REAL
              </div>

              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white font-mono">
                {settings.name} <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">LABS</span>
              </h1>

              <p className="text-zinc-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
                Consola central de taller, punto de venta y servicios técnicos. Control de remisiones, cotizaciones con IA de mercado, notificaciones en tiempo real, WhatsApp y facturación PDF.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-mono text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Garantía Estándar: <strong className="text-zinc-200">{settings.defaultWarrantyDays} días</strong>
                </span>
                <span className="text-zinc-600">•</span>
                <span className="flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                  Técnicos Activos: <strong className="text-cyan-300">{settings.technicians.length} Ingenieros</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Launchers */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <button
              onClick={onNewOrder}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 hover:from-cyan-300 hover:to-indigo-500 text-white font-black px-6 py-3.5 rounded-2xl shadow-[0_0_25px_rgba(0,242,254,0.4)] transition active:scale-95 text-xs sm:text-sm border border-cyan-200/40 font-mono tracking-wide"
            >
              <PlusCircle className="w-4 h-4" />
              + NUEVA REMISIÓN DE ENTRADA
            </button>

            <div className="flex gap-2">
              <button
                onClick={onNewQuote}
                className="flex-1 flex items-center justify-center gap-2 bg-[#0c1630] hover:bg-[#12224d] text-cyan-300 font-bold px-3 py-2.5 rounded-xl border border-cyan-500/30 transition text-xs font-mono"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Cotizar IA
              </button>

              <button
                onClick={() => onNavigateTab('services')}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold px-3 py-2.5 rounded-xl border border-cyan-400/40 transition text-xs font-mono shadow-[0_0_15px_rgba(0,242,254,0.2)]"
              >
                <Wind className="w-4 h-4 text-cyan-200" />
                <span>Servicios</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Period Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#0a1124] p-3 rounded-2xl border border-cyan-500/20">
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-300 tracking-wider">
          <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
          MÉTRICAS DE RENDIMIENTO & CARGA OPERATIVA
        </div>

        <div className="flex items-center bg-[#070b16] p-1 rounded-xl border border-cyan-500/20 text-xs font-mono">
          <button
            onClick={() => setTimeRange('week')}
            className={`px-3 py-1.5 rounded-lg transition ${
              timeRange === 'week'
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-[0_0_10px_rgba(0,242,254,0.2)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Últimos 7 días
          </button>
          <button
            onClick={() => setTimeRange('month')}
            className={`px-3 py-1.5 rounded-lg transition ${
              timeRange === 'month'
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-[0_0_10px_rgba(0,242,254,0.2)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Último Mes
          </button>
          <button
            onClick={() => setTimeRange('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              timeRange === 'all'
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-[0_0_10px_rgba(0,242,254,0.2)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Historial Completo
          </button>
        </div>
      </div>

      {/* KPI Futuristic Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Card 1: Órdenes Activas en Taller */}
        <div
          onClick={() => onNavigateTab('orders')}
          className="hud-panel p-5 rounded-2xl cursor-pointer group transition duration-300 relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
            <span>LABORATORIO ACTIVO</span>
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 group-hover:scale-110 transition shadow-[0_0_10px_rgba(0,242,254,0.2)]">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
              {metrics.activeOrders}
            </span>
            <span className="text-xs text-cyan-400 font-mono">equipos</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 border-t border-cyan-500/20 pt-2 font-mono">
            <span className="flex items-center gap-1 text-amber-400">
              <Clock className="w-3.5 h-3.5" />
              {metrics.inProgressCount} en banco
            </span>
            <span className="text-zinc-500 group-hover:text-cyan-300 transition">Ver taller →</span>
          </div>
        </div>

        {/* Card 2: Listos para Entrega */}
        <div
          onClick={() => onNavigateTab('orders')}
          className="hud-panel p-5 rounded-2xl cursor-pointer group transition duration-300 relative overflow-hidden border-emerald-500/30"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
            <span>LISTOS PARA ENTREGA</span>
            <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 group-hover:scale-110 transition shadow-[0_0_10px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight">
              {metrics.readyCount}
            </span>
            <span className="text-xs text-emerald-300 font-mono">reparados</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-emerald-400/80 border-t border-emerald-500/20 pt-2 font-mono">
            <span>Pruebas QA 100% OK</span>
            <span className="text-zinc-500 group-hover:text-emerald-300 transition">Avisar →</span>
          </div>
        </div>

        {/* Card 3: Ingresos Totales (Taller + POS) */}
        <div
          onClick={() => onNavigateTab('invoices')}
          className="hud-panel p-5 rounded-2xl cursor-pointer group transition duration-300 relative overflow-hidden border-indigo-500/30"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
            <span>INGRESOS TALLER + POS</span>
            <div className="p-2 rounded-xl bg-indigo-950/80 border border-indigo-500/40 text-indigo-400 group-hover:scale-110 transition shadow-[0_0_10px_rgba(99,102,241,0.2)]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              {formatCurrency(metrics.totalRevenue, currency)}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 border-t border-indigo-500/20 pt-2 font-mono">
            <span>POS: {formatCurrency(metrics.posRevenue, currency)}</span>
            <strong className="text-indigo-300">Taller: {formatCurrency(metrics.workshopRevenue, currency)}</strong>
          </div>
        </div>

        {/* Card 4: Saldos Pendientes / Novedades */}
        <div
          onClick={() => onNavigateTab('orders')}
          className="hud-panel p-5 rounded-2xl cursor-pointer group transition duration-300 relative overflow-hidden border-amber-500/30"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
            <span>SALDOS POR COBRAR</span>
            <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-400 group-hover:scale-110 transition shadow-[0_0_10px_rgba(245,158,11,0.2)]">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight">
              {formatCurrency(metrics.totalPendingBalance, currency)}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-amber-400/80 border-t border-amber-500/20 pt-2 font-mono">
            <span>{metrics.urgentCount} urgentes</span>
            <span className="text-zinc-500 group-hover:text-amber-300 transition">Gestionar →</span>
          </div>
        </div>

      </div>

      {/* Visible Sales & Goals Telemetry Chart */}
      <div className="hud-panel rounded-3xl p-6 space-y-6 border-cyan-500/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-mono font-bold text-white text-base">
                MONITOR DE METAS Y VENTAS EN TIEMPO REAL
              </h3>
              <p className="text-xs text-zinc-400 font-mono">
                Progreso semanal y mensual combinando Reparaciones de Taller + Ventas POS
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('settings')}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30"
          >
            <Target className="w-3.5 h-3.5" />
            <span>Ajustar Metas</span>
          </button>
        </div>

        {/* Weekly & Monthly Goal Progress Bars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="p-4 rounded-2xl bg-[#070b16] border border-emerald-500/30 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                <Target className="w-4 h-4" />
                META SEMANAL (7 DÍAS)
              </span>
              <span className="font-black text-emerald-400 text-sm">{salesGoalsChart.weeklyPct}%</span>
            </div>
            <div className="h-4 w-full bg-zinc-900 rounded-full p-0.5 border border-emerald-500/20 overflow-hidden">
              <div
                style={{ width: `${Math.max(4, salesGoalsChart.weeklyPct)}%` }}
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 shadow-[0_0_12px_rgba(16,185,129,0.4)] transition-all duration-700"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span>Recaudado: <strong className="text-white">{formatCurrency(salesGoalsChart.weeklyTotal, currency)}</strong></span>
              <span>Objetivo: <strong className="text-emerald-300">{formatCurrency(salesGoalsChart.weeklyGoal, currency)}</strong></span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#070b16] border border-cyan-500/30 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                <Target className="w-4 h-4" />
                META MENSUAL ({new Date().toLocaleDateString('es-CO', { month: 'long' }).toUpperCase() || 'MES ACTUAL'})
              </span>
              <span className="font-black text-cyan-400 text-sm">{salesGoalsChart.monthlyPct}%</span>
            </div>
            <div className="h-4 w-full bg-zinc-900 rounded-full p-0.5 border border-cyan-500/20 overflow-hidden">
              <div
                style={{ width: `${Math.max(4, salesGoalsChart.monthlyPct)}%` }}
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 shadow-[0_0_12px_rgba(0,242,254,0.4)] transition-all duration-700"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span>Recaudado: <strong className="text-white">{formatCurrency(salesGoalsChart.monthlyTotal, currency)}</strong></span>
              <span>Objetivo: <strong className="text-cyan-300">{formatCurrency(salesGoalsChart.monthlyGoal, currency)}</strong></span>
            </div>
          </div>
        </div>

        {/* 7-Day Daily Stacked Column Chart (Workshop vs POS) */}
        <div className="p-4 rounded-2xl bg-[#070b16] border border-cyan-500/20 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <span className="text-zinc-300 font-bold">Desglose Diario de Ventas (Últimos 7 Días)</span>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400" />
                Taller & Servicios
              </span>
              <span className="flex items-center gap-1.5 text-emerald-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
                Punto de Venta (POS)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-44 pt-4">
            {salesGoalsChart.days.map((day) => {
              const workshopHeightPct = Math.round((day.workshop / salesGoalsChart.maxDaily) * 100);
              const posHeightPct = Math.round((day.pos / salesGoalsChart.maxDaily) * 100);
              const totalHeightPct = Math.max(4, workshopHeightPct + posHeightPct);

              return (
                <div key={day.fullDate} className="flex flex-col items-center h-full justify-end group">
                  <div className="text-[10px] font-mono font-bold text-zinc-300 mb-1 opacity-80 group-hover:opacity-100">
                    {day.total > 0 ? formatCurrency(day.total, currency) : '0'}
                  </div>
                  <div className="w-full max-w-[44px] h-28 bg-zinc-900/80 rounded-t-xl border border-zinc-800 flex flex-col justify-end overflow-hidden p-0.5">
                    <div
                      style={{ height: `${Math.min(100, totalHeightPct)}%` }}
                      className="w-full rounded-t-lg overflow-hidden flex flex-col justify-end transition-all duration-500"
                    >
                      {day.pos > 0 && (
                        <div
                          style={{ height: `${Math.round((day.pos / Math.max(1, day.total)) * 100)}%` }}
                          className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400"
                          title={`POS: ${formatCurrency(day.pos, currency)}`}
                        />
                      )}
                      {day.workshop > 0 && (
                        <div
                          style={{ height: `${Math.round((day.workshop / Math.max(1, day.total)) * 100)}%` }}
                          className="w-full bg-gradient-to-t from-blue-600 to-cyan-400"
                          title={`Taller: ${formatCurrency(day.workshop, currency)}`}
                        />
                      )}
                    </div>
                  </div>
                  <span className="mt-1.5 text-[10px] font-mono font-bold text-zinc-400">
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Launch: POS & Merchandise Inventory HUD */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Card: Punto de Venta POS */}
        <div
          onClick={() => onNavigateTab('pos')}
          className="bg-gradient-to-r from-[#0a1b2a] to-[#071320] border border-emerald-500/30 hover:border-emerald-400/60 p-4 sm:p-5 rounded-2xl cursor-pointer transition duration-300 relative overflow-hidden group shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 group-hover:scale-110 transition">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">
                  TERMINAL RÁPIDO POS
                </div>
                <h4 className="text-base font-bold text-white group-hover:text-emerald-300 transition">
                  Punto de Venta & Salida de Mercancía
                </h4>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 group-hover:bg-emerald-500 group-hover:text-black transition">
              Abrir POS →
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-emerald-500/10 flex items-center justify-between text-xs font-mono text-zinc-400">
            <span>Ventas registradas: <strong className="text-emerald-300 font-bold">{sales?.length || 0} tickets</strong></span>
            <span className="text-zinc-500">Ticket térmico con logotipo</span>
          </div>
        </div>

        {/* Card: Catálogo de Mercancía */}
        <div
          onClick={() => onNavigateTab('inventory')}
          className="bg-gradient-to-r from-[#0d1633] to-[#080d22] border border-cyan-500/30 hover:border-cyan-400/60 p-4 sm:p-5 rounded-2xl cursor-pointer transition duration-300 relative overflow-hidden group shadow-[0_0_20px_rgba(0,242,254,0.1)] hover:shadow-[0_0_30px_rgba(0,242,254,0.2)]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 group-hover:scale-110 transition">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest">
                  CATÁLOGO & BODEGA
                </div>
                <h4 className="text-base font-bold text-white group-hover:text-cyan-300 transition">
                  Cargadores, Cables, Equipos & Repuestos
                </h4>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 group-hover:bg-cyan-500 group-hover:text-black transition">
              Inventario →
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-cyan-500/10 flex items-center justify-between text-xs font-mono text-zinc-400">
            <span>{merchandise?.length || 0} productos registrados</span>
            {merchandise && merchandise.filter(m => m.stock <= m.minStock).length > 0 ? (
              <span className="text-amber-400 font-bold">
                ⚠️ {merchandise.filter(m => m.stock <= m.minStock).length} con bajo stock
              </span>
            ) : (
              <span className="text-emerald-400">Stock en niveles óptimos</span>
            )}
          </div>
        </div>

      </div>

      {/* Cyber Flow Matrix & Device Telemetry Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Chart 1: Proceso del Taller Teknovant (HUD Pipeline) */}
        <div className="lg:col-span-2 hud-panel rounded-3xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-4">
            <div>
              <h3 className="font-mono font-bold text-white text-base flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                PIPELINE DEL TALLER & CICLO TÉCNICO
              </h3>
              <p className="text-xs text-zinc-400 font-mono">
                Flujo en tiempo real desde remisión inicial hasta control de calidad
              </p>
            </div>

            <div className="px-3 py-1 bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold rounded-xl">
              {filteredOrders.length} DISPOSITIVOS AUDITADOS
            </div>
          </div>

          <div className="space-y-4">
            {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((status) => {
              const count = statusStats[status];
              const pct = Math.round((count / (filteredOrders.length || 1)) * 100);
              const barWidth = Math.max(5, Math.round((count / maxStatusCount) * 100));
              const meta = STATUS_LABELS[status];

              let barColor = 'from-cyan-500 to-blue-600';
              if (status === 'listo') barColor = 'from-emerald-400 to-teal-500';
              else if (status === 'en_reparacion') barColor = 'from-indigo-500 to-purple-600';
              else if (status === 'espera_repuesto') barColor = 'from-purple-500 to-pink-600';
              else if (status === 'diagnostico') barColor = 'from-amber-400 to-orange-500';
              else if (status === 'entregado') barColor = 'from-zinc-500 to-zinc-600';

              return (
                <div key={status} className="group">
                  <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
                    <span className="font-bold text-zinc-300 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,242,254,0.6)]" />
                      {meta.label}
                    </span>
                    <div className="flex items-center gap-2 text-zinc-400">
                      <span className="text-[11px]">{pct}%</span>
                      <strong className="text-white font-bold bg-[#070e24] px-2 py-0.5 rounded border border-cyan-500/20">
                        {count} {count === 1 ? 'equipo' : 'equipos'}
                      </strong>
                    </div>
                  </div>

                  <div className="h-3.5 w-full bg-[#070b16] rounded-full p-0.5 border border-cyan-500/20 overflow-hidden">
                    <div
                      style={{ width: `${barWidth}%` }}
                      className={`h-full rounded-full bg-gradient-to-r ${barColor} shadow-[0_0_12px_rgba(0,242,254,0.3)] transition-all duration-700`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3.5 rounded-xl bg-[#070b16] border border-cyan-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono text-zinc-300">
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              Eficiencia de entrega en laboratorio: <strong className="text-cyan-300 font-bold">{metrics.efficiencyRate}%</strong>
            </span>
            <button
              onClick={() => onNavigateTab('orders')}
              className="text-cyan-400 hover:text-cyan-300 font-bold underline whitespace-nowrap"
            >
              Abrir Tablero de Taller →
            </button>
          </div>
        </div>

        {/* Chart 2: Matriz de Hardware Diagnosticado */}
        <div className="hud-panel rounded-3xl p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-1 border-b border-cyan-500/20 pb-4">
            <h3 className="font-mono font-bold text-white text-base flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-400" />
              MATRIZ DE DISPOSITIVOS
            </h3>
            <p className="text-xs text-zinc-400 font-mono">
              Distribución por arquitectura de electrónica
            </p>
          </div>

          <div className="space-y-4 flex-1 my-auto">
            {deviceStats.map((item) => {
              const getIcon = (t: string) => {
                switch (t) {
                  case 'celular': return <Smartphone className="w-4 h-4 text-cyan-400" />;
                  case 'laptop': return <Laptop className="w-4 h-4 text-emerald-400" />;
                  case 'computador': return <Monitor className="w-4 h-4 text-purple-400" />;
                  case 'consola': return <Gamepad2 className="w-4 h-4 text-rose-400" />;
                  default: return <Wrench className="w-4 h-4 text-amber-400" />;
                }
              };

              const getLabel = (t: string) => {
                switch (t) {
                  case 'celular': return 'Smartphones / Celulares';
                  case 'laptop': return 'Laptops & Portátiles';
                  case 'computador': return 'PC / Estaciones de Trabajo';
                  case 'consola': return 'Consolas de Juego';
                  case 'tablet': return 'iPads & Tablets';
                  default: return 'Otros Electrónicos';
                }
              };

              return (
                <div key={item.type} className="space-y-1.5 font-mono">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-zinc-200">
                      {getIcon(item.type)}
                      {getLabel(item.type)}
                    </span>
                    <span className="text-white font-bold">
                      {item.count} <span className="text-zinc-500 font-normal">({item.pct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#070b16] rounded-full overflow-hidden border border-zinc-800">
                    <div
                      style={{ width: `${item.pct}%` }}
                      className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-cyan-500/20 pt-4 text-xs font-mono text-zinc-400 space-y-1">
            <span className="text-zinc-500 block">Jefe de Laboratorio BGA:</span>
            <strong className="text-cyan-300 block">{settings.technicians[0] || 'Teknovant Lab'}</strong>
          </div>
        </div>

      </div>

      {/* Incident Radar / Urgent Service Orders */}
      <div className="hud-panel rounded-3xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h3 className="font-mono font-bold text-white text-base">
                RADAR DE INCIDENTES & ATENCIÓN PRIORITARIA
              </h3>
              <p className="text-xs text-zinc-400 font-mono">
                Equipos con fallas imprevistas, retrasos de piezas o prioridad urgente
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('orders')}
            className="text-xs font-mono font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5"
          >
            <span>Ver todo el taller</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {attentionOrders.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 font-mono text-xs space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto opacity-80" />
            <p className="font-bold text-zinc-200">Radar despejado. No hay incidencias críticas activas.</p>
            <p className="text-zinc-500">Todos los protocolos de reparación avanzan en tiempo estimado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attentionOrders.map((ord) => {
              const totals = calculateOrderTotals(ord);
              const latestNote = ord.trackingNotes[ord.trackingNotes.length - 1];

              return (
                <div
                  key={ord.id}
                  onClick={() => onSelectOrder(ord)}
                  className="bg-[#091024]/90 p-4 rounded-2xl border border-cyan-500/20 hover:border-cyan-400/60 transition cursor-pointer space-y-3 group hover:shadow-[0_0_20px_rgba(0,242,254,0.15)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-cyan-400">
                      {ord.orderNumber}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                        ord.priority === 'urgente'
                          ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                          : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      {ord.priority}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-mono font-bold text-sm text-white truncate">
                      {ord.brand} {ord.model}
                    </h4>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">
                      Cliente: <strong className="text-zinc-200">{ord.clientName}</strong>
                    </p>
                  </div>

                  {latestNote ? (
                    <div className="text-xs bg-[#060b18] border border-amber-500/30 p-2.5 rounded-xl text-amber-200/90 font-mono space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold">
                        <span>⚡ {latestNote.title}</span>
                      </div>
                      <p className="line-clamp-2 text-[11px] text-zinc-300">{latestNote.note}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400 line-clamp-2 italic">
                      Falla: {ord.reportedFault}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-cyan-500/10 text-xs font-mono">
                    <div className="text-zinc-400">
                      Saldo: <strong className="text-rose-400 font-bold">{formatCurrency(totals.balanceDue, currency)}</strong>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const msg = generateWhatsAppMessage('incidente', ord, undefined, settings, latestNote?.note);
                        openWhatsApp(ord.clientPhone, msg);
                      }}
                      className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30 transition"
                      title="Contactar al cliente por WhatsApp"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Avisar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
