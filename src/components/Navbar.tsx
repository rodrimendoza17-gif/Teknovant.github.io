import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Layers,
  FileSpreadsheet,
  Receipt,
  Search,
  Settings,
  Plus,
  Menu,
  X,
  Activity,
  Cpu,
  Package,
  ShoppingBag,
  Wind,
  Bell,
  LogOut,
  CheckCheck,
  MessageSquare
} from 'lucide-react';
import { WorkshopSettings, StatusNotification, AuthUser } from '../types/workshop';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  settings: WorkshopSettings;
  onNewOrder: () => void;
  ordersCount: number;
  lowStockCount?: number;
  notifications?: StatusNotification[];
  onMarkNotificationsRead?: () => void;
  user?: AuthUser | null;
  onLogout?: () => void;
  whatsappConnected?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  settings,
  onNewOrder,
  ordersCount,
  lowStockCount = 0,
  notifications = [],
  onMarkNotificationsRead,
  user,
  onLogout,
  whatsappConnected = false
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [timeString, setTimeString] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.readByAdmin).length;

  const navItems = [
    { id: 'dashboard', label: 'Centro Mando', icon: LayoutDashboard },
    { id: 'orders', label: 'Taller & Remisiones', icon: Layers, badge: ordersCount },
    { id: 'services', label: 'Servicios', icon: Wind },
    { id: 'inventory', label: 'Mercancía', icon: Package, badge: lowStockCount > 0 ? lowStockCount : undefined, badgeColor: 'amber' },
    { id: 'pos', label: 'Punto Venta', icon: ShoppingBag },
    { id: 'quotes', label: 'Cotizaciones IA', icon: FileSpreadsheet },
    { id: 'invoices', label: 'Facturas', icon: Receipt },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, statusDot: whatsappConnected ? 'emerald' : 'amber' },
    { id: 'tracker', label: 'Rastreo', icon: Search },
    { id: 'settings', label: 'Ajustes', icon: Settings }
  ];

  const handleNavClick = (id: string) => {
    onSelectTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#070c18]/90 backdrop-blur-xl border-b border-cyan-500/20 shadow-[0_4px_30px_rgba(0,0,0,0.5)] print:hidden">
      <div className="h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent w-full opacity-60" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-18 gap-2">

          {/* Logo & Brand */}
          <div
            className="flex items-center gap-2.5 cursor-pointer group shrink-0"
            onClick={() => handleNavClick('dashboard')}
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 p-0.5 shadow-[0_0_15px_rgba(0,242,254,0.4)] group-hover:shadow-[0_0_25px_rgba(0,242,254,0.7)] transition duration-300">
                <div className="w-full h-full bg-[#090e1d] rounded-[10px] flex items-center justify-center overflow-hidden">
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
                  ) : (
                    <div className="relative flex items-center justify-center text-cyan-400">
                      <Cpu className="w-5 h-5 animate-pulse" />
                      <div className="absolute w-2 h-2 rounded-full bg-cyan-300 blur-[2px]" />
                    </div>
                  )}
                </div>
              </div>
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
              </span>
            </div>

            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-white text-sm tracking-wider font-mono uppercase truncate max-w-[140px]">
                  {settings.name || 'TEKNOVANT'}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 font-medium tracking-wide">
                {user?.displayName || 'Panel Admin'}
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden xl:flex items-center gap-0.5 bg-[#0b132b]/60 p-1 rounded-2xl border border-cyan-500/20 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition relative duration-200 whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_15px_rgba(0,242,254,0.15)] font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-zinc-400'}`} />
                  <span>{item.label}</span>
                  {'statusDot' in item && item.statusDot && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        item.statusDot === 'emerald'
                          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                          : 'bg-amber-400'
                      }`}
                    />
                  )}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                        item.badgeColor === 'amber'
                          ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 font-mono text-[11px]">
              <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>{timeString}</span>
            </div>

            {/* Real-Time Notifications Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  const next = !notifOpen;
                  setNotifOpen(next);
                  if (next && unreadCount > 0 && onMarkNotificationsRead) {
                    onMarkNotificationsRead();
                  }
                }}
                className="relative p-2 rounded-xl bg-[#0b132b] border border-cyan-500/30 text-zinc-300 hover:text-cyan-300 transition"
                title="Notificaciones en tiempo real"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-md">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[#0b132b] border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 bg-[#070e24] border-b border-cyan-500/20 flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-cyan-400" />
                      Actividad en Tiempo Real
                    </span>
                    {onMarkNotificationsRead && (
                      <button
                        type="button"
                        onClick={() => {
                          onMarkNotificationsRead();
                        }}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        <CheckCheck className="w-3 h-3" />
                        Leídas
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-cyan-500/10">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-zinc-500">
                        Sin notificaciones recientes.
                      </div>
                    ) : (
                      notifications.slice(0, 12).map((n) => (
                        <div key={n.id} className="p-3 hover:bg-white/[0.03] transition">
                          <div className="flex items-center justify-between gap-2 text-[10px] text-cyan-400 font-mono">
                            <span className="font-bold">{n.title}</span>
                            <span className="text-zinc-500">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 mt-1 leading-snug">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick New Order */}
            <button
              onClick={onNewOrder}
              className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold px-3 py-2 rounded-xl text-xs shadow-[0_0_20px_rgba(0,242,254,0.35)] transition transform active:scale-95 border border-cyan-300/30"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">+ Remisión</span>
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-rose-950/60 border border-zinc-700 hover:border-rose-500/40 text-zinc-300 hover:text-rose-300 transition"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}

            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 xl:hidden text-zinc-300 hover:text-cyan-400 rounded-xl bg-[#0b132b] border border-cyan-500/30"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-cyan-500/20 bg-[#070c18] px-4 py-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'text-zinc-300 hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-cyan-400" />
                  <span>{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {'statusDot' in item && item.statusDot && (
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        item.statusDot === 'emerald' ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                    />
                  )}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        item.badgeColor === 'amber'
                          ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                          : 'bg-cyan-950 text-cyan-300 border border-cyan-500/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
