import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  Receipt,
  Printer,
  Share2,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Layers,
  User,
  Phone,
  CreditCard,
  Banknote,
  RotateCcw,
  Sparkles,
  ArrowRight,
  PackageCheck,
  Calendar,
  Clock,
  Send,
  Landmark
} from 'lucide-react';
import {
  MerchandiseItem,
  POSSale,
  POSPaymentMethod,
  WorkshopSettings,
  MerchandiseCategory
} from '../types/workshop';
import { openWhatsApp } from '../utils/whatsapp';

interface POSViewProps {
  merchandise: MerchandiseItem[];
  sales: POSSale[];
  settings: WorkshopSettings;
  onSaveMerchandise: (items: MerchandiseItem[]) => void;
  onSaveSales: (sales: POSSale[]) => void;
  onPrintTicket: (sale: POSSale) => void;
}

interface CartItem {
  merchandise: MerchandiseItem;
  quantity: number;
  unitPrice: number;
}

export const POSView: React.FC<POSViewProps> = ({
  merchandise,
  sales,
  settings,
  onSaveMerchandise,
  onSaveSales,
  onPrintTicket
}) => {
  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [barcodeInput, setBarcodeInput] = useState('');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isAnonymousClient, setIsAnonymousClient] = useState(true);
  const [clientName, setClientName] = useState('Cliente Mostrador');
  const [clientPhone, setClientPhone] = useState('');
  const [clientDocId, setClientDocId] = useState('');
  const [cashierName, setCashierName] = useState(settings.technicians[0] || 'Recepción Teknovant');
  const [paymentMethod, setPaymentMethod] = useState<POSPaymentMethod>('efectivo');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [posNotice, setPosNotice] = useState<string | null>(null);
  const [confirmClearCart, setConfirmClearCart] = useState(false);

  const currency = settings.currency || '$';

  // Filtered merchandise for POS catalog
  const filteredProducts = useMemo(() => {
    return merchandise.filter(item => {
      if (selectedCategory !== 'todos' && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesSku = item.sku.toLowerCase().includes(query);
        const matchesBrand = (item.brand || '').toLowerCase().includes(query);
        return matchesName || matchesSku || matchesBrand;
      }
      return true;
    });
  }, [merchandise, selectedCategory, searchQuery]);

  // Handle Barcode Scan / Fast Add
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const query = barcodeInput.trim().toLowerCase();
    const found = merchandise.find(
      m => m.sku.toLowerCase() === query || m.name.toLowerCase().includes(query)
    );

    if (found) {
      setPosNotice(null);
      handleAddToCart(found);
      setBarcodeInput('');
    } else {
      setPosNotice(`No se encontró ningún producto con el código o SKU: "${barcodeInput}"`);
    }
  };

  // Add item to cart
  const handleAddToCart = (product: MerchandiseItem) => {
    if (product.stock <= 0) {
      setPosNotice(`El producto "${product.name}" está agotado en inventario.`);
      return;
    }

    setPosNotice(null);
    setCart(prev => {
      const existing = prev.find(item => item.merchandise.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          setPosNotice(`No hay más unidades disponibles de "${product.name}" (Stock máximo: ${product.stock}).`);
          return prev;
        }
        return prev.map(item =>
          item.merchandise.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { merchandise: product, quantity: 1, unitPrice: product.sellingPrice }];
    });
  };

  // Adjust quantity in cart
  const handleUpdateQuantity = (productId: string, newQty: number) => {
    const product = merchandise.find(m => m.id === productId);
    if (!product) return;

    if (newQty <= 0) {
      setCart(prev => prev.filter(i => i.merchandise.id !== productId));
      return;
    }

    if (newQty > product.stock) {
      setPosNotice(`Solo hay ${product.stock} unidades disponibles en inventario.`);
      return;
    }

    setPosNotice(null);
    setCart(prev =>
      prev.map(i =>
        i.merchandise.id === productId ? { ...i, quantity: newQty } : i
      )
    );
  };

  // Remove item from cart
  const handleRemoveFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.merchandise.id !== productId));
  };

  // Clear cart
  const handleClearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setAmountPaid(0);
    setNotes('');
    setConfirmClearCart(false);
    setPosNotice(null);
  };

  // Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  }, [cart]);

  const cartTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - discountAmount);
  }, [cartSubtotal, discountAmount]);

  const changeGiven = useMemo(() => {
    if (paymentMethod === 'efectivo' && amountPaid > cartTotal) {
      return amountPaid - cartTotal;
    }
    return 0;
  }, [paymentMethod, amountPaid, cartTotal]);

  // Complete POS Sale
  const handleCompleteSale = () => {
    if (cart.length === 0) {
      setPosNotice('Agrega al menos un producto al carrito para procesar la venta.');
      return;
    }

    if (paymentMethod === 'efectivo' && amountPaid > 0 && amountPaid < cartTotal) {
      setPosNotice(`El monto recibido ($${amountPaid}) es menor al total a pagar ($${cartTotal}).`);
      return;
    }
    setPosNotice(null);

    // 1. Generate new POS sale record
    const nextNumber = String(sales.length + 1).padStart(3, '0');
    const newSale: POSSale = {
      id: `sale-${Date.now()}`,
      saleNumber: `TIK-${new Date().getFullYear()}-${nextNumber}`,
      createdAt: new Date().toISOString(),
      clientName: isAnonymousClient ? 'Cliente Mostrador' : (clientName.trim() || 'Cliente Mostrador'),
      clientDocId: isAnonymousClient ? undefined : clientDocId.trim() || undefined,
      clientPhone: isAnonymousClient ? undefined : clientPhone.trim() || undefined,
      items: cart.map(item => ({
        id: `si-${Math.random().toString(36).substring(2, 9)}`,
        merchandiseId: item.merchandise.id,
        sku: item.merchandise.sku,
        name: item.merchandise.name,
        category: item.merchandise.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.quantity * item.unitPrice
      })),
      subtotal: cartSubtotal,
      discount: discountAmount,
      tax: 0,
      total: cartTotal,
      paymentMethod,
      amountPaid: paymentMethod === 'efectivo' && amountPaid > 0 ? amountPaid : cartTotal,
      changeGiven,
      cashierName,
      notes: notes.trim() || undefined
    };

    // 2. Deduct inventory stock
    const updatedMerchandise = merchandise.map(prod => {
      const soldItem = cart.find(ci => ci.merchandise.id === prod.id);
      if (soldItem) {
        return {
          ...prod,
          stock: Math.max(0, prod.stock - soldItem.quantity)
        };
      }
      return prod;
    });

    // 3. Save to state & storage
    onSaveMerchandise(updatedMerchandise);
    const updatedSales = [newSale, ...sales];
    onSaveSales(updatedSales);

    // 4. Open thermal ticket modal immediately
    onPrintTicket(newSale);

    // 5. Reset cart
    setCart([]);
    setDiscountAmount(0);
    setAmountPaid(0);
    setNotes('');
    if (isAnonymousClient) {
      setClientName('Cliente Mostrador');
    }
  };

  // Quick cash bill shortcuts
  const handleQuickCash = (bill: number) => {
    setAmountPaid(bill);
  };

  // Daily POS metrics
  const todaySalesMetrics = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySales = sales.filter(s => s.createdAt.startsWith(todayStr));
    const totalTodayAmount = todaySales.reduce((sum, s) => sum + s.total, 0);
    const totalTodayTickets = todaySales.length;
    return { totalTodayAmount, totalTodayTickets };
  }, [sales]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0b132b] via-[#09153a] to-[#070c18] p-5 sm:p-6 rounded-2xl border border-cyan-500/30 shadow-[0_4px_25px_rgba(0,242,254,0.15)] relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-cyan-500/5 blur-3xl pointer-events-none" />

        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-400">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest">
              CAJA & PUNTO DE VENTA POS
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
            Salida de Mercancía e Impresión de Tickets Térmicos
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Despacho rápido de cargadores, cables, repuestos y accesorios con comprobante continuo
          </p>
        </div>

        {/* View switcher & Quick stats */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right pr-3 border-r border-cyan-500/20">
            <div className="text-[10px] text-zinc-400 font-mono">VENTAS DE HOY</div>
            <div className="text-base font-black text-emerald-400 font-mono">
              ${todaySalesMetrics.totalTodayAmount.toLocaleString()} {currency}
            </div>
            <div className="text-[10px] text-cyan-300 font-mono">
              {todaySalesMetrics.totalTodayTickets} tickets emitidos
            </div>
          </div>

          <div className="flex bg-[#070b14] p-1 rounded-xl border border-cyan-500/30 text-xs font-bold">
            <button
              onClick={() => setActiveTab('pos')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition ${
                activeTab === 'pos'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Terminal POS</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition ${
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Historial ({sales.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* POS TERMINAL VIEW */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: Catalog & Fast Barcode Search (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Fast Barcode & Name Scanner Bar */}
            <div className="bg-[#0b132b]/80 border border-cyan-500/30 rounded-2xl p-4 backdrop-blur-md shadow-lg">
              <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Escanear código de barras o escribir SKU/nombre y presionar Enter..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="w-full bg-[#070b14] border border-cyan-500/40 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 font-mono"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold text-xs border border-cyan-500/40 transition whitespace-nowrap"
                >
                  + Agregar
                </button>
              </form>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto mt-3 pt-2 border-t border-cyan-500/10 scrollbar-thin">
                <button
                  onClick={() => setSelectedCategory('todos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === 'todos'
                      ? 'bg-cyan-500 text-black font-bold'
                      : 'bg-[#070b14] text-zinc-400 hover:text-white border border-cyan-500/20'
                  }`}
                >
                  Todos ({merchandise.length})
                </button>
                <button
                  onClick={() => setSelectedCategory('cargadores')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === 'cargadores'
                      ? 'bg-cyan-500 text-black font-bold'
                      : 'bg-[#070b14] text-zinc-400 hover:text-white border border-cyan-500/20'
                  }`}
                >
                  Cargadores
                </button>
                <button
                  onClick={() => setSelectedCategory('cables')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === 'cables'
                      ? 'bg-cyan-500 text-black font-bold'
                      : 'bg-[#070b14] text-zinc-400 hover:text-white border border-cyan-500/20'
                  }`}
                >
                  Cables
                </button>
                <button
                  onClick={() => setSelectedCategory('equipos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === 'equipos'
                      ? 'bg-cyan-500 text-black font-bold'
                      : 'bg-[#070b14] text-zinc-400 hover:text-white border border-cyan-500/20'
                  }`}
                >
                  Equipos
                </button>
                <button
                  onClick={() => setSelectedCategory('auriculares')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === 'auriculares'
                      ? 'bg-cyan-500 text-black font-bold'
                      : 'bg-[#070b14] text-zinc-400 hover:text-white border border-cyan-500/20'
                  }`}
                >
                  Auriculares
                </button>
                <button
                  onClick={() => setSelectedCategory('accesorios')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === 'accesorios'
                      ? 'bg-cyan-500 text-black font-bold'
                      : 'bg-[#070b14] text-zinc-400 hover:text-white border border-cyan-500/20'
                  }`}
                >
                  Accesorios
                </button>
                <button
                  onClick={() => setSelectedCategory('pantallas')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === 'pantallas'
                      ? 'bg-cyan-500 text-black font-bold'
                      : 'bg-[#070b14] text-zinc-400 hover:text-white border border-cyan-500/20'
                  }`}
                >
                  Pantallas
                </button>
              </div>
            </div>

            {/* Product Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredProducts.map((prod) => {
                const inCart = cart.find(i => i.merchandise.id === prod.id);
                const isOutOfStock = prod.stock <= 0;

                return (
                  <div
                    key={prod.id}
                    onClick={() => !isOutOfStock && handleAddToCart(prod)}
                    className={`p-3.5 rounded-2xl border transition duration-200 cursor-pointer flex flex-col justify-between relative group ${
                      isOutOfStock
                        ? 'bg-[#090e1d]/50 border-zinc-800 opacity-60 cursor-not-allowed'
                        : inCart
                        ? 'bg-[#0e1b3d] border-cyan-400 shadow-[0_0_15px_rgba(0,242,254,0.25)]'
                        : 'bg-[#0b132b]/70 border-cyan-500/20 hover:border-cyan-400/60 hover:bg-[#0c1838]'
                    }`}
                  >
                    <div>
                      {/* Category & SKU header */}
                      <div className="flex items-center justify-between text-[10px] mb-1 font-mono">
                        <span className="text-cyan-400 font-bold truncate max-w-[120px]">
                          {prod.sku}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded ${
                          isOutOfStock
                            ? 'bg-rose-950 text-rose-300'
                            : prod.stock <= prod.minStock
                            ? 'bg-amber-950 text-amber-300'
                            : 'bg-emerald-950 text-emerald-300'
                        }`}>
                          {isOutOfStock ? 'Agotado' : `${prod.stock} disp.`}
                        </span>
                      </div>

                      {/* Product Name */}
                      <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition line-clamp-2 leading-tight">
                        {prod.name}
                      </h4>
                      {prod.brand && (
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          {prod.brand}
                        </p>
                      )}
                    </div>

                    {/* Price & Add button footer */}
                    <div className="mt-3 pt-2 border-t border-cyan-500/10 flex items-center justify-between">
                      <div className="font-mono font-black text-sm text-cyan-300">
                        ${prod.sellingPrice.toLocaleString()} <span className="text-[10px] font-sans text-zinc-400">{currency}</span>
                      </div>

                      <button
                        type="button"
                        disabled={isOutOfStock}
                        className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                          inCart
                            ? 'bg-cyan-500 text-black'
                            : 'bg-cyan-950 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-900'
                        }`}
                      >
                        {inCart ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>{inCart.quantity}</span>
                          </>
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>

          </div>

          {/* RIGHT COLUMN: Active Cart / Ticket in Progress (5 Cols) */}
          <div className="lg:col-span-5 bg-[#0b132b]/90 border border-cyan-500/30 rounded-2xl p-4 sm:p-5 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] space-y-4">
            
            {/* Cart Header */}
            <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Ticket de Venta
                    <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                      {cart.reduce((s, i) => s + i.quantity, 0)} ítems
                    </span>
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    Salida de mercancía Teknovant
                  </p>
                </div>
              </div>

              {cart.length > 0 && (
                confirmClearCart ? (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={handleClearCart}
                      className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold"
                    >
                      Vaciar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearCart(false)}
                      className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClearCart(true)}
                    className="text-zinc-400 hover:text-rose-400 text-xs flex items-center gap-1 transition"
                    title="Vaciar carrito"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Vaciar</span>
                  </button>
                )
              )}
            </div>

            {posNotice && (
              <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  {posNotice}
                </span>
                <button type="button" onClick={() => setPosNotice(null)} className="text-amber-300 text-[10px]">
                  ✕
                </button>
              </div>
            )}

            {/* Client Mode Selector */}
            <div className="bg-[#070b14] p-2.5 rounded-xl border border-cyan-500/20 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-medium">Tipo de Cliente:</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAnonymousClient(true);
                      setClientName('Cliente Mostrador');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      isAnonymousClient
                        ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Mostrador
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAnonymousClient(false)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      !isAnonymousClient
                        ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Personalizado
                  </button>
                </div>
              </div>

              {/* Custom client fields */}
              {!isAnonymousClient && (
                <div className="pt-2 border-t border-cyan-500/10 space-y-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-0.5">Nombre del Cliente</label>
                    <input
                      type="text"
                      placeholder="Ej: Laura Gómez"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full bg-[#090e1d] border border-cyan-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-0.5">WhatsApp / Celular</label>
                      <input
                        type="text"
                        placeholder="+57 310..."
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        className="w-full bg-[#090e1d] border border-cyan-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-0.5">Cédula / NIT / DNI</label>
                      <input
                        type="text"
                        placeholder="ID Fiscal"
                        value={clientDocId}
                        onChange={(e) => setClientDocId(e.target.value)}
                        className="w-full bg-[#090e1d] border border-cyan-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 border border-dashed border-cyan-500/20 rounded-xl">
                  <ShoppingBag className="w-8 h-8 mx-auto text-zinc-600 mb-2 opacity-50" />
                  <p className="text-xs">El carrito está vacío</p>
                  <p className="text-[10px] text-zinc-600">Haz clic en los productos para agregarlos</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.merchandise.id}
                    className="p-2.5 rounded-xl bg-[#070b14] border border-cyan-500/20 flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {item.merchandise.name}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-2">
                        <span>SKU: {item.merchandise.sku}</span>
                        <span>•</span>
                        <span className="text-cyan-300">${item.unitPrice.toLocaleString()} c/u</span>
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.merchandise.id, item.quantity - 1)}
                        className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono text-xs font-bold text-white min-w-5 text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.merchandise.id, item.quantity + 1)}
                        className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Line total & remove */}
                    <div className="text-right min-w-16">
                      <div className="font-mono font-bold text-xs text-white">
                        ${(item.unitPrice * item.quantity).toLocaleString()}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(item.merchandise.id)}
                        className="text-[10px] text-rose-400 hover:underline"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Calculations & Totals */}
            <div className="p-3.5 rounded-xl bg-[#070b14] border border-cyan-500/20 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal Mercancía:</span>
                <span className="font-mono">${cartSubtotal.toLocaleString()} {currency}</span>
              </div>

              {/* Discount Input */}
              <div className="flex items-center justify-between text-zinc-400">
                <span className="flex items-center gap-1">
                  Descuento ({currency}):
                </span>
                <input
                  type="number"
                  min="0"
                  max={cartSubtotal}
                  value={discountAmount || ''}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-24 bg-[#090e1d] border border-zinc-700 rounded px-2 py-0.5 text-right font-mono text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Total To Pay */}
              <div className="flex justify-between items-center text-sm font-black text-white pt-2 border-t border-cyan-500/20">
                <span className="text-cyan-300">TOTAL A COBRAR:</span>
                <span className="text-lg font-mono text-cyan-300">
                  ${cartTotal.toLocaleString()} {currency}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-300">
                Método de Pago:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('efectivo')}
                  className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1 font-bold transition ${
                    paymentMethod === 'efectivo'
                      ? 'bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                      : 'bg-[#070b14] text-zinc-400 hover:text-white border border-cyan-500/20'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Efectivo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('transferencia')}
                  className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1 font-bold transition ${
                    paymentMethod === 'transferencia'
                      ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(0,242,254,0.4)]'
                      : 'bg-[#070b14] text-zinc-400 hover:text-white border border-cyan-500/20'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Transf.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('deposito')}
                  className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1 font-bold transition ${
                    paymentMethod === 'deposito'
                      ? 'bg-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                      : 'bg-[#070b14] text-zinc-400 hover:text-white border border-cyan-500/20'
                  }`}
                >
                  <Landmark className="w-3.5 h-3.5" />
                  <span>Depósito</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('tarjeta')}
                  className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1 font-bold transition ${
                    paymentMethod === 'tarjeta'
                      ? 'bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                      : 'bg-[#070b14] text-zinc-400 hover:text-white border border-cyan-500/20'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Tarjeta</span>
                </button>
              </div>

              {/* Cash change / devuelta calculator */}
              {paymentMethod === 'efectivo' && (
                <div className="p-3 rounded-xl bg-[#070b14] border border-emerald-500/30 space-y-2 mt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-medium">Efectivo Recibido:</span>
                    <input
                      type="number"
                      min="0"
                      value={amountPaid || ''}
                      onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                      placeholder={`$${cartTotal}`}
                      className="w-28 bg-[#090e1d] border border-emerald-500/50 rounded-lg px-2.5 py-1 text-right font-mono text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  {/* Quick bill chips */}
                  <div className="flex gap-1.5 justify-end">
                    {[cartTotal, cartTotal + 10, cartTotal + 20, cartTotal + 50].map((quickVal, i) => (
                      quickVal > 0 && (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleQuickCash(quickVal)}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:bg-emerald-950 hover:text-emerald-300 transition"
                        >
                          ${quickVal}
                        </button>
                      )
                    ))}
                  </div>

                  {changeGiven > 0 && (
                    <div className="flex items-center justify-between text-xs font-black text-emerald-400 pt-1.5 border-t border-emerald-500/20">
                      <span>CAMBIO / DEVUELTA:</span>
                      <span className="text-sm font-mono">${changeGiven.toLocaleString()} {currency}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cashier selection */}
            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">
                Atendido por (Cajero / Técnico):
              </label>
              <select
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                className="w-full bg-[#070b14] border border-cyan-500/30 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
              >
                {settings.technicians.map((t, idx) => (
                  <option key={idx} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* ACTION: CHECKOUT & PRINT TICKET */}
            <button
              onClick={handleCompleteSale}
              disabled={cart.length === 0}
              className={`w-full py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-[0.98] ${
                cart.length > 0
                  ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-[0_0_25px_rgba(0,242,254,0.4)] border border-cyan-300/40 cursor-pointer'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Cobrar y Generar Ticket Térmico</span>
            </button>

          </div>

        </div>
      )}

      {/* SALES HISTORY VIEW */}
      {activeTab === 'history' && (
        <div className="bg-[#0b132b]/80 border border-cyan-500/20 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
          <div className="p-4 bg-[#070e22] border-b border-cyan-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Registro de Ventas en Mostrador y Salidas</h3>
            </div>
            <span className="text-xs text-zinc-400 font-mono">
              Total acumulado: ${sales.reduce((s, sl) => s + sl.total, 0).toLocaleString()} {currency}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#050916] text-zinc-400 border-b border-cyan-500/10 uppercase tracking-wider font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Ticket #</th>
                  <th className="py-3 px-3">Fecha y Hora</th>
                  <th className="py-3 px-3">Cliente</th>
                  <th className="py-3 px-4">Productos Despachados</th>
                  <th className="py-3 px-3">Forma Pago</th>
                  <th className="py-3 px-3 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Impresión / WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-500/10">
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500">
                      No hay ventas registradas todavía. Realiza una venta en el terminal POS.
                    </td>
                  </tr>
                ) : (
                  sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-white/[0.03] transition">
                      <td className="py-3 px-4 font-mono font-bold text-cyan-300">
                        {sale.saleNumber}
                      </td>
                      <td className="py-3 px-3 text-zinc-400 text-[11px]">
                        {new Date(sale.createdAt).toLocaleString('es-CO', {
                          dateStyle: 'short',
                          timeStyle: 'short'
                        })}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-white">{sale.clientName}</div>
                        {sale.clientPhone && (
                          <div className="text-[10px] text-zinc-400">{sale.clientPhone}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-zinc-300 line-clamp-1 max-w-xs">
                          {sale.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {sale.items.reduce((s, i) => s + i.quantity, 0)} artículos • Atendió: {sale.cashierName}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 uppercase">
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-white text-sm">
                        ${sale.total.toLocaleString()} {currency}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {sale.clientPhone && (
                            <button
                              onClick={() => {
                                const msg = `🧾 *Ticket #${sale.saleNumber} - ${settings.name}*\nTotal: $${sale.total.toLocaleString()} ${currency}\n¡Gracias por su compra!`;
                                openWhatsApp(sale.clientPhone!, msg);
                              }}
                              className="p-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/30 transition"
                              title="Enviar por WhatsApp"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onPrintTicket(sale)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/30 font-bold text-xs transition"
                            title="Reimprimir Ticket Térmico"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Ticket</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
