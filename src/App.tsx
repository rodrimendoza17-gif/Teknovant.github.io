/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X, Loader2, Cpu } from 'lucide-react';
import {
  DEFAULT_SETTINGS,
  SEED_SERVICES
} from './utils/storage';
import {
  AuthUser,
  RepairOrder,
  Quote,
  Invoice,
  WorkshopSettings,
  MerchandiseItem,
  POSSale,
  ServiceItem,
  StatusNotification,
  WhatsAppSessionState,
  WhatsAppDispatchLog
} from './types/workshop';
import {
  api,
  AuthStatusResponse,
  AdminBootstrapPayload,
  ClientDashboardPayload,
  connectRealtimeWS
} from './utils/api';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { OrdersView } from './components/OrdersView';
import { OrderModal } from './components/OrderModal';
import { OrderDetailModal } from './components/OrderDetailModal';
import { QuotesView } from './components/QuotesView';
import { InvoicesView } from './components/InvoicesView';
import { InventoryView } from './components/InventoryView';
import { POSView } from './components/POSView';
import { ServicesView } from './components/ServicesView';
import { ClientTrackerView } from './components/ClientTrackerView';
import { SettingsView } from './components/SettingsView';
import { DocumentPrintModal, DocumentType } from './components/DocumentPrintModal';
import { TicketPrintModal } from './components/TicketPrintModal';
import { LoginView } from './components/LoginView';
import { ClientPortalView } from './components/ClientPortalView';
import { WhatsAppSessionView, SendWhatsAppPayload } from './components/WhatsAppSessionView';
import type { AppliedAIQuotePayload } from './components/AIMarketQuotePanel';

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  // Workshop / Admin & Shared State
  const [settings, setSettings] = useState<WorkshopSettings>(DEFAULT_SETTINGS);
  const [orders, setOrders] = useState<RepairOrder[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [merchandise, setMerchandise] = useState<MerchandiseItem[]>([]);
  const [posSales, setPOSSales] = useState<POSSale[]>([]);
  const [services, setServices] = useState<ServiceItem[]>(SEED_SERVICES);
  const [notifications, setNotifications] = useState<StatusNotification[]>([]);
  const [liveToast, setLiveToast] = useState<StatusNotification | null>(null);
  const [whatsappSession, setWhatsappSession] = useState<WhatsAppSessionState>({
    status: 'disconnected',
    qrDataUrl: null,
    pairingCode: null,
    connectedPhone: null,
    connectedName: null,
    lastError: null,
    updatedAt: new Date().toISOString(),
  });
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppDispatchLog[]>([]);

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [quoteDraft, setQuoteDraft] = useState<AppliedAIQuotePayload | null>(null);

  // Modals state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<RepairOrder | null>(null);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<RepairOrder | null>(null);

  // Document printing modal (PDF)
  const [docModal, setDocModal] = useState<{
    isOpen: boolean;
    type: DocumentType;
    order?: RepairOrder;
    quote?: Quote;
    invoice?: Invoice;
  }>({
    isOpen: false,
    type: 'remision_entrada'
  });

  // Thermal ticket printing modal (58mm/80mm)
  const [ticketModal, setTicketModal] = useState<{
    isOpen: boolean;
    sale?: POSSale;
    order?: RepairOrder;
  }>({
    isOpen: false
  });

  const applyAdminBootstrap = useCallback((data: AdminBootstrapPayload) => {
    setSettings(data.settings);
    setOrders(data.orders);
    setQuotes(data.quotes);
    setInvoices(data.invoices);
    setMerchandise(data.merchandise);
    setPOSSales(data.posSales);
    setServices(data.services);
    setNotifications(data.notifications);
  }, []);

  const applyClientDashboard = useCallback((data: ClientDashboardPayload) => {
    setSettings(data.settings);
    setOrders(data.orders);
    setQuotes(data.quotes);
    setInvoices(data.invoices);
    setNotifications(data.notifications);
  }, []);

  // Load initial auth status & branding
  const fetchAuthStatus = useCallback(async () => {
    try {
      const status = await api.getAuthStatus();
      setAuthStatus(status);
      if (status.branding) {
        setSettings(prev => ({
          ...prev,
          name: status.branding.name || prev.name,
          slogan: status.branding.slogan || prev.slogan,
          logoUrl: status.branding.logoUrl ?? prev.logoUrl,
          phone: status.branding.phone || prev.phone,
          whatsapp: status.branding.whatsapp || prev.whatsapp,
          city: status.branding.city || prev.city,
        }));
      }
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuthStatus();
  }, [fetchAuthStatus]);

  // Sync theme changes to document root
  useEffect(() => {
    document.documentElement.classList.remove(
      'theme-blue',
      'theme-dark_slate',
      'theme-emerald',
      'theme-amber',
      'theme-purple',
      'theme-cyber'
    );
    document.documentElement.classList.add(`theme-${settings.theme}`);
  }, [settings.theme]);

  // Load role-specific data after authentication
  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    setDataLoading(true);

    const loadData = async () => {
      try {
        if (currentUser.role === 'admin') {
          const [data, waStatus] = await Promise.all([
            api.getAdminBootstrap(),
            api.getWhatsAppStatus().catch(() => null),
          ]);
          if (active) {
            applyAdminBootstrap(data);
            if (waStatus) {
              setWhatsappSession(waStatus.session);
              setWhatsappLogs(waStatus.logs);
            }
          }
        } else {
          const data = await api.getClientDashboard();
          if (active) applyClientDashboard(data);
        }
      } finally {
        if (active) setDataLoading(false);
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, [currentUser, applyAdminBootstrap, applyClientDashboard]);

  // Connect real-time WebSocket for status notifications & live state sync
  useEffect(() => {
    if (!currentUser) return;
    const disconnect = connectRealtimeWS((msg) => {
      if (msg.type === 'notification' && msg.notification) {
        setNotifications(prev => [msg.notification!, ...prev.filter(n => n.id !== msg.notification!.id)].slice(0, 60));
        setLiveToast(msg.notification);
        setTimeout(() => {
          setLiveToast(curr => (curr?.id === msg.notification?.id ? null : curr));
        }, 6500);
      } else if (msg.type === 'admin:sync' && currentUser.role === 'admin' && msg.data) {
        applyAdminBootstrap(msg.data as AdminBootstrapPayload);
      } else if (msg.type === 'client:sync' && currentUser.role === 'client' && msg.data) {
        applyClientDashboard(msg.data as ClientDashboardPayload);
      } else if (msg.type === 'whatsapp:status' && currentUser.role === 'admin' && msg.whatsapp) {
        setWhatsappSession(msg.whatsapp);
      }
    });

    return disconnect;
  }, [currentUser, applyAdminBootstrap, applyClientDashboard]);

  const handleAuthenticated = async (user: AuthUser) => {
    setCurrentUser(user);
    setCurrentTab('dashboard');
    await fetchAuthStatus();
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setSelectedOrderForDetail(null);
    setLiveToast(null);
    await fetchAuthStatus();
  };

  // --- ADMIN CRUD HANDLERS ---

  const handleSaveOrder = async (order: RepairOrder, shouldPrint: boolean = false) => {
    const res = await api.saveOrder(order);
    setOrders(res.orders);
    setNotifications(res.notifications);
    setShowOrderModal(false);
    setOrderToEdit(null);

    if (selectedOrderForDetail && selectedOrderForDetail.id === order.id) {
      setSelectedOrderForDetail(res.order);
    }

    if (shouldPrint) {
      setDocModal({
        isOpen: true,
        type: 'remision_entrada',
        order: res.order
      });
    }
  };

  const handleUpdateOrder = async (updatedOrder: RepairOrder) => {
    const res = await api.updateOrder(updatedOrder);
    setOrders(res.orders);
    setInvoices(res.invoices);
    setNotifications(res.notifications);
    setSelectedOrderForDetail(res.order);
  };

  const handleDeleteOrder = async (orderId: string) => {
    const res = await api.deleteOrder(orderId);
    setOrders(res.orders);
    if (selectedOrderForDetail?.id === orderId) {
      setSelectedOrderForDetail(null);
    }
  };

  const handleSaveQuote = async (quote: Quote) => {
    const res = await api.saveQuote(quote);
    setQuotes(res.quotes);
    setNotifications(res.notifications);
  };

  const handleDeleteQuote = async (quoteId: string) => {
    const res = await api.deleteQuote(quoteId);
    setQuotes(res.quotes);
  };

  const handleConvertQuoteToOrder = async (quote: Quote) => {
    const res = await api.convertQuoteToOrder(quote.id);
    setOrders(res.orders);
    setQuotes(res.quotes);
    setNotifications(res.notifications);
    setSelectedOrderForDetail(res.order);
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    const res = await api.deleteInvoice(invoiceId);
    setInvoices(res.invoices);
  };

  const handleSaveMerchandise = async (updatedItems: MerchandiseItem[]) => {
    const res = await api.saveMerchandise(updatedItems);
    setMerchandise(res.merchandise);
  };

  const handleSavePOSSales = async (updatedSales: POSSale[]) => {
    const res = await api.savePOSSales(updatedSales);
    setPOSSales(res.posSales);
  };

  const handleSaveService = async (service: ServiceItem) => {
    const res = await api.saveService(service);
    setServices(res.services);
  };

  const handleDeleteService = async (serviceId: string) => {
    const res = await api.deleteService(serviceId);
    setServices(res.services);
  };

  const handleSaveSettings = async (newSettings: WorkshopSettings) => {
    const res = await api.saveSettings(newSettings);
    setSettings(res.settings);
  };

  const handleImportBackup = async (parsed: unknown) => {
    const res = await api.importBackup(parsed);
    applyAdminBootstrap(res.data);
  };

  const handleResetBackup = async () => {
    const res = await api.resetBackup();
    applyAdminBootstrap(res.data);
  };

  const handleMarkAdminNotificationsRead = async () => {
    const res = await api.markAdminNotificationsRead();
    setNotifications(res.notifications);
  };

  const handleMarkClientNotificationsRead = async () => {
    const res = await api.markClientNotificationsRead();
    applyClientDashboard(res);
  };

  // --- WHATSAPP SESSION & DIRECT DISPATCH ---
  const showQuickToast = (title: string, message: string) => {
    const toast: StatusNotification = {
      id: `toast-${Date.now()}`,
      orderNumber: 'WHATSAPP',
      clientName: 'WhatsApp Taller',
      clientPhone: '',
      type: 'status_change',
      title,
      message,
      createdAt: new Date().toISOString(),
      readByAdmin: true,
      readByClient: true,
    };
    setLiveToast(toast);
    setTimeout(() => {
      setLiveToast((curr) => (curr?.id === toast.id ? null : curr));
    }, 5500);
  };

  const handleRefreshWhatsAppStatus = async () => {
    const res = await api.getWhatsAppStatus();
    setWhatsappSession(res.session);
    setWhatsappLogs(res.logs);
  };

  const handleConnectWhatsAppQR = async () => {
    const res = await api.connectWhatsAppQR();
    setWhatsappSession(res.session);
    setWhatsappLogs(res.logs);
  };

  const handleConnectWhatsAppPairing = async (phone: string) => {
    const res = await api.connectWhatsAppPairing(phone);
    setWhatsappSession(res.session);
    setWhatsappLogs(res.logs);
  };

  const handleLogoutWhatsApp = async () => {
    const res = await api.logoutWhatsApp();
    setWhatsappSession(res.session);
    setWhatsappLogs(res.logs);
  };

  const handleSendWhatsApp = async (payload: SendWhatsAppPayload) => {
    try {
      const res = await api.sendWhatsAppMessage(payload);
      setWhatsappLogs(res.logs);
      showQuickToast(
        `WhatsApp Enviado (${payload.referenceNumber || payload.category.toUpperCase()})`,
        `Mensaje entregado a ${payload.clientName} (${res.log.toPhone}).`
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error enviando mensaje por WhatsApp.';
      showQuickToast('Error al Enviar WhatsApp', errMsg);
      throw err;
    }
  };

  // Auth loading splash
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#070b14] cyber-grid flex flex-col items-center justify-center text-cyan-300 gap-3 font-mono">
        <Cpu className="w-10 h-10 animate-pulse text-cyan-400" />
        <div className="flex items-center gap-2 text-xs">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>INICIALIZANDO TEKNOVANT OS...</span>
        </div>
      </div>
    );
  }

  // Unauthenticated -> Show Admin / Client Login
  if (!currentUser && authStatus) {
    return (
      <LoginView
        authStatus={authStatus}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  // Client Authenticated -> Dedicated Client Portal
  if (currentUser?.role === 'client') {
    return (
      <ClientPortalView
        user={currentUser}
        settings={settings}
        orders={orders}
        quotes={quotes}
        invoices={invoices}
        notifications={notifications}
        liveToast={liveToast}
        onDismissToast={() => setLiveToast(null)}
        onMarkNotificationsRead={handleMarkClientNotificationsRead}
        onLogout={handleLogout}
      />
    );
  }

  const lowStockCount = merchandise.filter(m => m.stock <= m.minStock).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#070b14] cyber-grid text-zinc-100 selection:bg-cyan-500 selection:text-black">

      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        settings={settings}
        onNewOrder={() => {
          setOrderToEdit(null);
          setShowOrderModal(true);
        }}
        ordersCount={orders.filter(o => o.status !== 'entregado' && o.status !== 'cancelado').length}
        lowStockCount={lowStockCount}
        notifications={notifications}
        onMarkNotificationsRead={handleMarkAdminNotificationsRead}
        user={currentUser}
        onLogout={handleLogout}
        whatsappConnected={whatsappSession.status === 'connected'}
      />

      {/* Real-time WebSocket Toast Banner */}
      {liveToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-[#0b132b]/95 border border-cyan-400/60 rounded-2xl p-4 shadow-[0_0_30px_rgba(0,242,254,0.35)] backdrop-blur-xl animate-in slide-in-from-bottom-4 print:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-400/40 text-cyan-300 shrink-0">
                <Bell className="w-4 h-4 animate-bounce" />
              </div>
              <div>
                <div className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
                  ACTUALIZACIÓN EN TIEMPO REAL
                </div>
                <div className="text-xs font-bold text-white mt-0.5">{liveToast.title}</div>
                <p className="text-[11px] text-zinc-300 mt-0.5 leading-snug">{liveToast.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLiveToast(null)}
              className="text-zinc-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">

        {dataLoading && (
          <div className="mb-4 px-4 py-2 rounded-xl bg-cyan-950/50 border border-cyan-500/30 text-cyan-300 text-xs font-mono flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Sincronizando datos del taller con el servidor...</span>
          </div>
        )}

        {/* Dashboard */}
        {currentTab === 'dashboard' && (
          <Dashboard
            orders={orders}
            quotes={quotes}
            settings={settings}
            merchandise={merchandise}
            sales={posSales}
            onNewOrder={() => {
              setOrderToEdit(null);
              setShowOrderModal(true);
            }}
            onNewQuote={() => setCurrentTab('quotes')}
            onSelectOrder={(ord) => setSelectedOrderForDetail(ord)}
            onNavigateTab={setCurrentTab}
          />
        )}

        {/* Repair Orders & Entry Remissions */}
        {currentTab === 'orders' && (
          <OrdersView
            orders={orders}
            settings={settings}
            onSelectOrder={(ord) => setSelectedOrderForDetail(ord)}
            onNewOrder={() => {
              setOrderToEdit(null);
              setShowOrderModal(true);
            }}
            onDeleteOrder={handleDeleteOrder}
            onPrintRemision={(ord) => {
              setDocModal({
                isOpen: true,
                type: 'remision_entrada',
                order: ord
              });
            }}
            onPrintRecibo={(ord) => {
              setDocModal({
                isOpen: true,
                type: 'recibo_entrega',
                order: ord
              });
            }}
            whatsappConnected={whatsappSession.status === 'connected'}
            onSendWhatsApp={handleSendWhatsApp}
          />
        )}

        {/* Field Services & Minisplit Quotes */}
        {currentTab === 'services' && (
          <ServicesView
            services={services}
            settings={settings}
            onSaveService={handleSaveService}
            onDeleteService={handleDeleteService}
            onCreateQuoteFromService={(payload) => {
              setQuoteDraft(payload);
              setCurrentTab('quotes');
            }}
          />
        )}

        {/* Merchandise & Inventory Management */}
        {currentTab === 'inventory' && (
          <InventoryView
            merchandise={merchandise}
            settings={settings}
            onSaveMerchandise={handleSaveMerchandise}
            onNavigateToPOS={() => setCurrentTab('pos')}
          />
        )}

        {/* Point of Sale (POS) & Thermal Ticket */}
        {currentTab === 'pos' && (
          <POSView
            merchandise={merchandise}
            sales={posSales}
            settings={settings}
            onSaveMerchandise={handleSaveMerchandise}
            onSaveSales={handleSavePOSSales}
            onPrintTicket={(sale) => {
              setTicketModal({
                isOpen: true,
                sale
              });
            }}
          />
        )}

        {/* Quotes with Dual Claude + Gemini AI Market Pricing */}
        {currentTab === 'quotes' && (
          <QuotesView
            quotes={quotes}
            settings={settings}
            onSaveQuote={handleSaveQuote}
            onDeleteQuote={handleDeleteQuote}
            onConvertQuoteToOrder={handleConvertQuoteToOrder}
            onPrintQuote={(q) => {
              setDocModal({
                isOpen: true,
                type: 'cotizacion',
                quote: q
              });
            }}
            initialDraft={quoteDraft}
            onClearDraft={() => setQuoteDraft(null)}
            whatsappConnected={whatsappSession.status === 'connected'}
            onSendWhatsApp={handleSendWhatsApp}
          />
        )}

        {/* Invoices with List + Grouped by Client View */}
        {currentTab === 'invoices' && (
          <InvoicesView
            invoices={invoices}
            settings={settings}
            onPrintInvoice={(inv) => {
              setDocModal({
                isOpen: true,
                type: 'factura',
                invoice: inv
              });
            }}
            onDeleteInvoice={handleDeleteInvoice}
            whatsappConnected={whatsappSession.status === 'connected'}
            onSendWhatsApp={handleSendWhatsApp}
          />
        )}

        {/* WhatsApp Linked-Device Session & Direct Dispatch */}
        {currentTab === 'whatsapp' && (
          <WhatsAppSessionView
            session={whatsappSession}
            logs={whatsappLogs}
            settings={settings}
            quotes={quotes}
            invoices={invoices}
            orders={orders}
            onConnectQR={handleConnectWhatsAppQR}
            onConnectPairing={handleConnectWhatsAppPairing}
            onLogout={handleLogoutWhatsApp}
            onRefreshStatus={handleRefreshWhatsAppStatus}
            onSendDirect={handleSendWhatsApp}
          />
        )}

        {/* Quick Client Order Lookup */}
        {currentTab === 'tracker' && (
          <ClientTrackerView
            orders={orders}
            settings={settings}
          />
        )}

        {/* Workshop Settings */}
        {currentTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onImportBackup={handleImportBackup}
            onResetData={handleResetBackup}
          />
        )}
      </main>

      {/* New / Edit Order Modal */}
      {showOrderModal && (
        <OrderModal
          orderToEdit={orderToEdit}
          settings={settings}
          onSave={handleSaveOrder}
          onClose={() => {
            setShowOrderModal(false);
            setOrderToEdit(null);
          }}
          existingCount={orders.length}
        />
      )}

      {/* Order Detail & Tracking Management Modal */}
      {selectedOrderForDetail && (
        <OrderDetailModal
          order={selectedOrderForDetail}
          settings={settings}
          onUpdateOrder={handleUpdateOrder}
          onDeleteOrder={handleDeleteOrder}
          onOpenDocument={(type) => {
            setDocModal({
              isOpen: true,
              type,
              order: selectedOrderForDetail
            });
          }}
          onEditOrder={(ord) => {
            setOrderToEdit(ord);
            setShowOrderModal(true);
          }}
          onClose={() => setSelectedOrderForDetail(null)}
          whatsappConnected={whatsappSession.status === 'connected'}
          onSendWhatsApp={handleSendWhatsApp}
        />
      )}

      {/* PDF Document Print & Download Modal */}
      {docModal.isOpen && (
        <DocumentPrintModal
          type={docModal.type}
          order={docModal.order}
          quote={docModal.quote}
          invoice={docModal.invoice}
          settings={settings}
          onClose={() => setDocModal(prev => ({ ...prev, isOpen: false }))}
        />
      )}

      {/* Thermal POS Ticket Print Modal (58mm / 80mm roll) */}
      {ticketModal.isOpen && (
        <TicketPrintModal
          sale={ticketModal.sale}
          order={ticketModal.order}
          settings={settings}
          onClose={() => setTicketModal({ isOpen: false })}
        />
      )}

    </div>
  );
}
