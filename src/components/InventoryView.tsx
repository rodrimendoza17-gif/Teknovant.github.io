import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  TrendingUp,
  Tag,
  DollarSign,
  Edit2,
  Trash2,
  CheckCircle,
  X,
  PlusCircle,
  MinusCircle,
  Barcode,
  Layers,
  ArrowRight,
  Sparkles,
  Zap,
  ShoppingBag,
  Info
} from 'lucide-react';
import { MerchandiseItem, MerchandiseCategory, WorkshopSettings } from '../types/workshop';

interface InventoryViewProps {
  merchandise: MerchandiseItem[];
  settings: WorkshopSettings;
  onSaveMerchandise: (items: MerchandiseItem[]) => void;
  onNavigateToPOS?: () => void;
}

const CATEGORIES: { id: MerchandiseCategory; label: string; iconColor: string }[] = [
  { id: 'cargadores', label: 'Cargadores', iconColor: 'from-amber-500 to-orange-600' },
  { id: 'cables', label: 'Cables & Adaptadores', iconColor: 'from-blue-500 to-cyan-500' },
  { id: 'equipos', label: 'Equipos & Celulares', iconColor: 'from-cyan-500 to-blue-600' },
  { id: 'auriculares', label: 'Auriculares & Audio', iconColor: 'from-purple-500 to-indigo-600' },
  { id: 'fundas_micas', label: 'Fundas & Micas 9D', iconColor: 'from-pink-500 to-rose-600' },
  { id: 'memorias', label: 'Memorias & USB', iconColor: 'from-emerald-500 to-teal-600' },
  { id: 'baterias', label: 'Baterías', iconColor: 'from-yellow-500 to-amber-600' },
  { id: 'pantallas', label: 'Pantallas & Displays', iconColor: 'from-indigo-500 to-cyan-600' },
  { id: 'accesorios', label: 'Accesorios Varios', iconColor: 'from-teal-500 to-emerald-600' },
  { id: 'otro', label: 'Otros Insumos', iconColor: 'from-zinc-500 to-zinc-700' }
];

export const InventoryView: React.FC<InventoryViewProps> = ({
  merchandise,
  settings,
  onSaveMerchandise,
  onNavigateToPOS
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [stockFilter, setStockFilter] = useState<'todos' | 'bajo' | 'agotado'>('todos');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MerchandiseItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    sku: string;
    category: MerchandiseCategory;
    brand: string;
    costPrice: number;
    sellingPrice: number;
    stock: number;
    minStock: number;
    location: string;
    compatibility: string;
    description: string;
  }>({
    name: '',
    sku: '',
    category: 'cargadores',
    brand: '',
    costPrice: 0,
    sellingPrice: 0,
    stock: 1,
    minStock: 3,
    location: '',
    compatibility: '',
    description: ''
  });

  const currency = settings.currency || '$';

  // Metrics
  const metrics = useMemo(() => {
    const totalItems = merchandise.length;
    const totalUnits = merchandise.reduce((sum, item) => sum + item.stock, 0);
    const lowStockCount = merchandise.filter(item => item.stock > 0 && item.stock <= item.minStock).length;
    const outOfStockCount = merchandise.filter(item => item.stock <= 0).length;
    const inventoryCost = merchandise.reduce((sum, item) => sum + (item.costPrice * item.stock), 0);
    const inventoryRetail = merchandise.reduce((sum, item) => sum + (item.sellingPrice * item.stock), 0);
    const projectedProfit = inventoryRetail - inventoryCost;

    return {
      totalItems,
      totalUnits,
      lowStockCount,
      outOfStockCount,
      inventoryCost,
      inventoryRetail,
      projectedProfit
    };
  }, [merchandise]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return merchandise.filter(item => {
      // Category filter
      if (selectedCategory !== 'todos' && item.category !== selectedCategory) {
        return false;
      }
      // Stock filter
      if (stockFilter === 'bajo' && (item.stock > item.minStock || item.stock === 0)) {
        return false;
      }
      if (stockFilter === 'agotado' && item.stock > 0) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesSku = item.sku.toLowerCase().includes(query);
        const matchesBrand = (item.brand || '').toLowerCase().includes(query);
        const matchesCompat = (item.compatibility || '').toLowerCase().includes(query);
        return matchesName || matchesSku || matchesBrand || matchesCompat;
      }
      return true;
    });
  }, [merchandise, selectedCategory, stockFilter, searchQuery]);

  // Open modal for add
  const handleOpenAdd = () => {
    const category = (selectedCategory !== 'todos' ? selectedCategory : 'cargadores') as MerchandiseCategory;
    const prefix = category.substring(0, 3).toUpperCase();
    const autoSku = `${prefix}-${Math.floor(100 + Math.random() * 900)}`;

    setFormData({
      name: '',
      sku: autoSku,
      category,
      brand: '',
      costPrice: 0,
      sellingPrice: 0,
      stock: 5,
      minStock: 2,
      location: 'Vitrina Principal',
      compatibility: '',
      description: ''
    });
    setEditingItem(null);
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEdit = (item: MerchandiseItem) => {
    setFormData({
      name: item.name,
      sku: item.sku,
      category: item.category,
      brand: item.brand || '',
      costPrice: item.costPrice,
      sellingPrice: item.sellingPrice,
      stock: item.stock,
      minStock: item.minStock,
      location: item.location || '',
      compatibility: item.compatibility || '',
      description: item.description || ''
    });
    setEditingItem(item);
    setIsModalOpen(true);
  };

  // Quick SKU generator
  const handleGenerateSku = () => {
    const prefix = formData.category.substring(0, 3).toUpperCase();
    const random = Math.floor(1000 + Math.random() * 9000);
    setFormData(prev => ({ ...prev, sku: `${prefix}-${random}` }));
  };

  // Save form
  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingItem) {
      const updated = merchandise.map(item =>
        item.id === editingItem.id
          ? {
              ...item,
              ...formData,
              updatedAt: new Date().toISOString()
            }
          : item
      );
      onSaveMerchandise(updated);
    } else {
      const newItem: MerchandiseItem = {
        id: `merch-${Date.now()}`,
        ...formData,
        createdAt: new Date().toISOString()
      };
      onSaveMerchandise([newItem, ...merchandise]);
    }

    setIsModalOpen(false);
  };

  // Quick adjust stock
  const handleAdjustStock = (itemId: string, delta: number) => {
    const updated = merchandise.map(item => {
      if (item.id === itemId) {
        const nextStock = Math.max(0, item.stock + delta);
        return { ...item, stock: nextStock };
      }
      return item;
    });
    onSaveMerchandise(updated);
  };

  // Delete item
  const handleDelete = (itemId: string) => {
    const updated = merchandise.filter(i => i.id !== itemId);
    onSaveMerchandise(updated);
    setConfirmDeleteId(null);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0b132b] via-[#09153a] to-[#070c18] p-5 sm:p-6 rounded-2xl border border-cyan-500/30 shadow-[0_4px_25px_rgba(0,242,254,0.15)] relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-cyan-500/5 blur-3xl pointer-events-none" />
        
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-400">
              <Package className="w-5 h-5" />
            </span>
            <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest">
              CONTROL DE MERCANCÍA & STOCK
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
            Inventario de Equipos, Cargadores, Cables y Repuestos
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Catálogo unificado para venta directa en mostrador y suministro de reparaciones
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onNavigateToPOS && (
            <button
              onClick={onNavigateToPOS}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 font-bold text-xs border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)] transition active:scale-95"
            >
              <ShoppingBag className="w-4 h-4 text-emerald-400" />
              <span>Abrir Punto de Venta (POS)</span>
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-xs shadow-[0_0_20px_rgba(0,242,254,0.35)] transition transform active:scale-95 border border-cyan-300/30"
          >
            <Plus className="w-4 h-4" />
            <span>+ Agregar Mercancía</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Stock Units */}
        <div className="bg-[#0b132b]/70 border border-cyan-500/20 rounded-2xl p-4 relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Stock Total Disponible</span>
            <Package className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-white">
            {metrics.totalUnits} <span className="text-xs text-zinc-400 font-sans font-normal">unidades</span>
          </div>
          <div className="text-[11px] text-cyan-300/80 mt-1 font-mono">
            {metrics.totalItems} productos registrados
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-[#0b132b]/70 border border-amber-500/30 rounded-2xl p-4 relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Alertas de Stock Bajo</span>
            <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-amber-400">
            {metrics.lowStockCount + metrics.outOfStockCount}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1.5">
            <span className="text-rose-400 font-bold">{metrics.outOfStockCount} agotados</span> •{' '}
            <span className="text-amber-300 font-bold">{metrics.lowStockCount} por reponer</span>
          </div>
        </div>

        {/* Inventory Cost Value */}
        <div className="bg-[#0b132b]/70 border border-blue-500/20 rounded-2xl p-4 relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Inversión en Mercancía (Costo)</span>
            <DollarSign className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-blue-300">
            ${metrics.inventoryCost.toLocaleString()} <span className="text-xs font-sans text-zinc-400">{currency}</span>
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">
            Capital en vitrina y bodega
          </div>
        </div>

        {/* Retail Value & Projected Profit */}
        <div className="bg-[#0b132b]/70 border border-emerald-500/20 rounded-2xl p-4 relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Valor Venta Proyectado</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-emerald-400">
            ${metrics.inventoryRetail.toLocaleString()} <span className="text-xs font-sans text-zinc-400">{currency}</span>
          </div>
          <div className="text-[11px] text-emerald-400/90 mt-1 font-mono font-bold">
            +${metrics.projectedProfit.toLocaleString()} ganancia estimada
          </div>
        </div>

      </div>

      {/* Categories Horizontal Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        <button
          onClick={() => setSelectedCategory('todos')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            selectedCategory === 'todos'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_15px_rgba(0,242,254,0.3)]'
              : 'bg-[#0b132b]/60 text-zinc-400 hover:text-white border border-cyan-500/20'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Todas las Categorías ({merchandise.length})</span>
        </button>

        {CATEGORIES.map(cat => {
          const count = merchandise.filter(m => m.category === cat.id).length;
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                isSelected
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_15px_rgba(0,242,254,0.3)]'
                  : 'bg-[#0b132b]/60 text-zinc-400 hover:text-white border border-cyan-500/20'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-black/30 text-white' : 'bg-cyan-950 text-cyan-300'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#0b132b]/60 border border-cyan-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, SKU, marca o compatibilidad..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#070b14] border border-cyan-500/30 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Stock Filter Pills */}
        <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
          <span className="text-zinc-400 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Estado:
          </span>
          <button
            onClick={() => setStockFilter('todos')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              stockFilter === 'todos'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setStockFilter('bajo')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1 ${
              stockFilter === 'bajo'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-zinc-400 hover:text-amber-300'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Bajo Stock</span>
          </button>
          <button
            onClick={() => setStockFilter('agotado')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              stockFilter === 'agotado'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-zinc-400 hover:text-rose-300'
            }`}
          >
            Agotados
          </button>
        </div>

      </div>

      {/* Merchandise Table */}
      <div className="bg-[#0b132b]/80 border border-cyan-500/20 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#070e22] text-zinc-400 border-b border-cyan-500/20 uppercase tracking-wider font-mono text-[10px]">
              <tr>
                <th className="py-3 px-4">Producto & SKU</th>
                <th className="py-3 px-3">Categoría</th>
                <th className="py-3 px-3">Ubicación</th>
                <th className="py-3 px-3 text-right">Costo</th>
                <th className="py-3 px-3 text-right">Precio Venta</th>
                <th className="py-3 px-3 text-center">Margen</th>
                <th className="py-3 px-4 text-center">Stock</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-500/10">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400">
                    <Package className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
                    <p className="font-medium text-sm text-zinc-300">No se encontraron productos en el inventario</p>
                    <p className="text-xs text-zinc-500 mt-1">Prueba con otra búsqueda o haz clic en "+ Agregar Mercancía"</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isOutOfStock = item.stock <= 0;
                  const isLowStock = !isOutOfStock && item.stock <= item.minStock;
                  const marginPercent = item.sellingPrice > 0
                    ? Math.round(((item.sellingPrice - item.costPrice) / item.sellingPrice) * 100)
                    : 0;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-white/[0.03] transition duration-150 group"
                    >
                      {/* Product Name & SKU */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-sm group-hover:text-cyan-300 transition">
                          {item.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#070b14] text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                            <Barcode className="w-3 h-3 text-cyan-400" />
                            {item.sku}
                          </span>
                          {item.brand && (
                            <span className="text-[11px] text-zinc-400">
                              Marca: <span className="text-zinc-300 font-medium">{item.brand}</span>
                            </span>
                          )}
                        </div>
                        {item.compatibility && (
                          <div className="text-[10px] text-zinc-400 mt-0.5 truncate max-w-xs">
                            <span className="text-zinc-500">Compatibilidad:</span> {item.compatibility}
                          </div>
                        )}
                      </td>

                      {/* Category Badge */}
                      <td className="py-3.5 px-3">
                        <span className="text-[10px] font-mono font-semibold px-2.5 py-1 rounded-lg bg-cyan-950/70 text-cyan-300 border border-cyan-500/30 capitalize whitespace-nowrap">
                          {item.category.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-3 text-zinc-300 text-xs">
                        {item.location || <span className="text-zinc-600 italic">No asignada</span>}
                      </td>

                      {/* Cost */}
                      <td className="py-3.5 px-3 text-right font-mono text-zinc-400 text-xs">
                        ${item.costPrice.toLocaleString()} {currency}
                      </td>

                      {/* Selling Price */}
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-white text-sm">
                        ${item.sellingPrice.toLocaleString()} {currency}
                      </td>

                      {/* Margin */}
                      <td className="py-3.5 px-3 text-center">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          marginPercent >= 50
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : marginPercent >= 25
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {marginPercent}%
                        </span>
                      </td>

                      {/* Stock Stepper & Status */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-2 bg-[#070b14] px-2 py-1 rounded-xl border border-cyan-500/20">
                          <button
                            type="button"
                            onClick={() => handleAdjustStock(item.id, -1)}
                            className="text-zinc-400 hover:text-rose-400 transition"
                            title="Restar 1 al stock"
                          >
                            <MinusCircle className="w-4 h-4" />
                          </button>

                          <span className={`font-mono font-black text-sm min-w-8 text-center ${
                            isOutOfStock
                              ? 'text-rose-400'
                              : isLowStock
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}>
                            {item.stock}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleAdjustStock(item.id, 1)}
                            className="text-zinc-400 hover:text-cyan-400 transition"
                            title="Sumar 1 al stock"
                          >
                            <PlusCircle className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Stock alert pill below */}
                        <div className="mt-1">
                          {isOutOfStock ? (
                            <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wider">
                              Agotado
                            </span>
                          ) : isLowStock ? (
                            <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">
                              Mínimo: {item.minStock}
                            </span>
                          ) : (
                            <span className="text-[9px] text-zinc-500">
                              Mínimo: {item.minStock}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/30 transition"
                            title="Editar Mercancía"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {confirmDeleteId === item.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold"
                              >
                                Borrar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-1.5 py-1 rounded bg-zinc-800 text-zinc-300 text-[10px]"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              className="p-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/50 text-rose-300 border border-rose-500/30 transition"
                              title="Eliminar del catálogo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Merchandise Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-xl bg-[#090e1d] border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(0,242,254,0.25)] overflow-hidden my-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20 bg-[#0b132b]/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingItem ? 'Editar Producto / Mercancía' : 'Nueva Mercancía para Taller'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Ingreso a inventario para punto de venta y uso técnico
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              
              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Nombre del Producto / Mercancía <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Cargador GaN 65W USB-C, Cable Lightning, Samsung S22, etc."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#070b14] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* SKU & Category Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-zinc-300">
                      Código de Barras / SKU <span className="text-cyan-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateSku}
                      className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3" /> Auto SKU
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Ej: CRG-20W-01"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-[#070b14] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-xs font-mono text-cyan-300 placeholder-zinc-500 focus:outline-none focus:border-cyan-400 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Categoría <span className="text-cyan-400">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as MerchandiseCategory })}
                    className="w-full bg-[#070b14] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Brand & Location Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Marca / Fabricante
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Apple, Anker, Baseus, Samsung, Genérico"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full bg-[#070b14] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Ubicación Física en Tienda
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Vitrina 1, Panel Cables, Bodega A"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full bg-[#070b14] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Prices & Profit Margin Row */}
              <div className="p-3.5 rounded-xl bg-[#070b14] border border-cyan-500/20 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
                    Precios y Margen de Utilidad
                  </span>
                  {formData.sellingPrice > 0 && (
                    <span className="font-mono text-emerald-400 font-black">
                      Margen: {Math.round(((formData.sellingPrice - formData.costPrice) / formData.sellingPrice) * 100)}%
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">
                      Costo de Compra ({currency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formData.costPrice || ''}
                      onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#090e1d] border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">
                      Precio de Venta al Público ({currency}) <span className="text-cyan-400">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={formData.sellingPrice || ''}
                      onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#090e1d] border border-cyan-500/40 rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-bold focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Stock & Minimum Threshold Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Stock Inicial / Actual
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-[#070b14] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Alerta de Stock Mínimo
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-[#070b14] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Compatibility & Notes */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Compatibilidad o Especificación Técnica
                </label>
                <input
                  type="text"
                  placeholder="Ej: Universal USB-C / PD 3.0, iPhone 11 al 16, Dell 19.5V 4.62A"
                  value={formData.compatibility}
                  onChange={(e) => setFormData({ ...formData, compatibility: e.target.value })}
                  className="w-full bg-[#070b14] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-cyan-500/20">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-[0_0_20px_rgba(0,242,254,0.4)] transition"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{editingItem ? 'Guardar Cambios' : 'Registrar Mercancía'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
