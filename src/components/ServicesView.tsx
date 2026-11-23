import React, { useState, useMemo } from 'react';
import {
  Wind,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Edit2,
  Clock,
  ShieldCheck,
  FileSpreadsheet,
  Wrench,
  Zap,
  Camera,
  Unlock,
  Cpu,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Globe,
} from 'lucide-react';
import type {
  ServiceItem,
  ServiceCategory,
  WorkshopSettings,
  QuoteItem,
} from '../types/workshop';
import { formatCurrency } from '../utils/whatsapp';
import { api } from '../utils/api';
import type { MarketQuoteAnalysis, AppliedAIQuotePayload } from './AIMarketQuotePanel';

interface ServicesViewProps {
  services: ServiceItem[];
  settings: WorkshopSettings;
  onSaveService: (service: ServiceItem) => Promise<void> | void;
  onDeleteService: (id: string) => Promise<void> | void;
  onCreateQuoteFromService: (payload: AppliedAIQuotePayload) => void;
}

const CATEGORY_META: Record<
  ServiceCategory,
  { label: string; icon: React.ComponentType<{ className?: string }>; badge: string }
> = {
  minisplit_clima: {
    label: 'Minisplits & Climatización',
    icon: Wind,
    badge: 'bg-cyan-950 text-cyan-300 border-cyan-500/40',
  },
  redes_cctv: {
    label: 'Redes & CCTV',
    icon: Camera,
    badge: 'bg-indigo-950 text-indigo-300 border-indigo-500/40',
  },
  electricidad: {
    label: 'Instalación Eléctrica',
    icon: Zap,
    badge: 'bg-amber-950 text-amber-300 border-amber-500/40',
  },
  desbloqueos_software: {
    label: 'Desbloqueos & Servidor',
    icon: Unlock,
    badge: 'bg-purple-950 text-purple-300 border-purple-500/40',
  },
  consolas_microsoldadura: {
    label: 'Consolas & Microsoldadura',
    icon: Cpu,
    badge: 'bg-rose-950 text-rose-300 border-rose-500/40',
  },
  otro: {
    label: 'Otros Servicios',
    icon: Wrench,
    badge: 'bg-zinc-900 text-zinc-300 border-zinc-700',
  },
};

export const ServicesView: React.FC<ServicesViewProps> = ({
  services,
  settings,
  onSaveService,
  onDeleteService,
  onCreateQuoteFromService,
}) => {
  const currency = settings.currency || '$';
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Service Form Modal
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<ServiceCategory>('minisplit_clima');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState<number>(80);
  const [formDuration, setFormDuration] = useState('2 - 3 horas');
  const [formWarranty, setFormWarranty] = useState<number>(90);
  const [formMaterials, setFormMaterials] = useState('');

  // Inline Delete Confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Quick AI Market Estimator for Field Services
  const [aiServiceQuery, setAiServiceQuery] = useState('');
  const [aiServiceDevice, setAiServiceDevice] = useState('Minisplit Inverter 1.5 Toneladas');
  const [aiRegion, setAiRegion] = useState(settings.city || 'México');
  const [aiProvider] = useState<'auto' | 'claude' | 'gemini'>('gemini');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<MarketQuoteAnalysis | null>(null);
  const [aiProviderUsed, setAiProviderUsed] = useState<string | null>(null);

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchCat = categoryFilter === 'all' || s.category === categoryFilter;
      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.includesMaterials && s.includesMaterials.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [services, categoryFilter, searchTerm]);

  const openNewModal = () => {
    setEditingService(null);
    setFormName('');
    setFormCategory('minisplit_clima');
    setFormDescription('');
    setFormPrice(80);
    setFormDuration('2 - 3 horas');
    setFormWarranty(settings.defaultWarrantyDays || 90);
    setFormMaterials('');
    setShowModal(true);
  };

  const openEditModal = (srv: ServiceItem) => {
    setEditingService(srv);
    setFormName(srv.name);
    setFormCategory(srv.category);
    setFormDescription(srv.description);
    setFormPrice(srv.basePrice);
    setFormDuration(srv.estimatedDuration);
    setFormWarranty(srv.warrantyDays);
    setFormMaterials(srv.includesMaterials || '');
    setShowModal(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const item: ServiceItem = {
      id: editingService ? editingService.id : `srv-${Date.now()}`,
      name: formName.trim(),
      category: formCategory,
      description: formDescription.trim() || formName.trim(),
      basePrice: Number(formPrice) || 0,
      estimatedDuration: formDuration.trim() || 'Por definir',
      warrantyDays: Number(formWarranty) || 30,
      includesMaterials: formMaterials.trim() || undefined,
      createdAt: editingService ? editingService.createdAt : new Date().toISOString(),
    };

    await onSaveService(item);
    setShowModal(false);
  };

  const handleConsultServiceMarket = async (customQuery?: string, customDevice?: string) => {
    const q = (customQuery ?? aiServiceQuery).trim();
    const d = (customDevice ?? aiServiceDevice).trim();
    if (!q && !d) {
      setAiError('Describe el servicio a cotizar (ej: recarga de gas R410A, cambio de lugar minisplit).');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    try {
      const data = await api.requestMarketQuote({
        device: d,
        query: q || d,
        category: 'Servicios en Sitio / Minisplits / Climatización / Instalaciones',
        region: aiRegion.trim() || settings.city || 'México / Latinoamérica',
        currency: settings.currency || 'MXN ($)',
        workshopName: settings.name,
        provider: aiProvider,
      });
      setAiResult(data.quoteAnalysis as MarketQuoteAnalysis);
      setAiProviderUsed(data.providerUsed || null);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Error consultando mercado con IA.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleConvertServiceToQuote = (srv: ServiceItem) => {
    const items: QuoteItem[] = [
      {
        id: `qi-${Date.now()}`,
        description: srv.includesMaterials
          ? `${srv.name} (Incluye: ${srv.includesMaterials})`
          : srv.name,
        unitPrice: srv.basePrice,
        quantity: 1,
      },
    ];
    onCreateQuoteFromService({
      deviceDescription: srv.name,
      issueDescription: srv.description,
      items,
      laborCost: 0,
      notes: `Duración estimada: ${srv.estimatedDuration}. Garantía técnica de ${srv.warrantyDays} días.`,
    });
  };

  const handleApplyAITierToQuote = (tierKey: 'economico' | 'recomendado' | 'premium') => {
    if (!aiResult) return;
    const tier = aiResult.tiers[tierKey];
    if (!tier) return;

    const items: QuoteItem[] = [];
    if (tier.partsPrice > 0) {
      items.push({
        id: `qi-${Date.now()}-mat`,
        description: `Materiales / Gas / Insumos — ${aiResult.serviceTitle} (${tier.label})`,
        unitPrice: Math.round(tier.partsPrice),
        quantity: 1,
      });
    } else if (aiResult.suggestedLineItems?.length > 0) {
      aiResult.suggestedLineItems.forEach((it, idx) => {
        items.push({
          id: `qi-${Date.now()}-${idx}`,
          description: it.description,
          unitPrice: Math.round(it.unitPrice),
          quantity: it.quantity || 1,
        });
      });
    }

    onCreateQuoteFromService({
      deviceDescription: aiServiceDevice.trim() || aiResult.serviceTitle,
      issueDescription: `${aiResult.serviceTitle}${aiServiceQuery.trim() ? ` — ${aiServiceQuery.trim()}` : ''} (${tier.label})`,
      items:
        items.length > 0
          ? items
          : [{ id: `qi-${Date.now()}`, description: aiResult.serviceTitle, unitPrice: 0, quantity: 1 }],
      laborCost: Math.round(tier.laborPrice || 0),
      notes: aiResult.technicalWarnings?.join(' | ') || tier.description,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="hud-panel p-4 rounded-3xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Buscar servicios (minisplit, gas refrigerante, cambio de lugar, CCTV, FRP...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs font-mono rounded-2xl border border-cyan-500/20 bg-[#070b16] text-white outline-none focus:ring-2 focus:ring-cyan-400"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs font-mono rounded-xl border border-cyan-500/20 bg-[#070b16] px-3 py-2.5 text-zinc-300 outline-none"
          >
            <option value="all">Todas las Categorías</option>
            {Object.entries(CATEGORY_META).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={openNewModal}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-white font-mono font-bold px-4 py-2.5 rounded-xl text-xs shadow-[0_0_15px_rgba(0,242,254,0.3)] transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nuevo Servicio</span>
          </button>
        </div>
      </div>

      {/* AI Market Price Estimator for Minisplits & Field Services */}
      <div className="hud-panel rounded-3xl p-5 sm:p-6 border border-cyan-500/30 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-600 text-white shadow-[0_0_15px_rgba(0,242,254,0.3)]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                Cotizador IA de Servicios en Mercado Actual
              </h2>
              <p className="text-xs text-zinc-400">
                Calcula precios competitivos al momento para instalación de minisplits, recarga de gas, reubicación, CCTV o trabajos técnicos en sitio.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#070b16] border border-cyan-500/25 rounded-xl px-3 py-1.5 shrink-0">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <input
              type="text"
              value={aiRegion}
              onChange={(e) => setAiRegion(e.target.value)}
              placeholder="Ciudad / País"
              className="bg-transparent text-xs font-mono text-white outline-none w-32"
              aria-label="Región del mercado"
            />
            <span className="text-[11px] font-mono text-emerald-300 border-l border-zinc-700 pl-2">
              Gemini IA (Gratis)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4">
            <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">
              Equipo / Capacidad
            </label>
            <input
              type="text"
              value={aiServiceDevice}
              onChange={(e) => setAiServiceDevice(e.target.value)}
              placeholder="Ej: Minisplit Inverter 1.5 Ton"
              className="w-full rounded-xl border border-cyan-500/25 bg-[#070b16] px-3.5 py-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          <div className="md:col-span-6">
            <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">
              Servicio a Cotizar *
            </label>
            <input
              type="text"
              value={aiServiceQuery}
              onChange={(e) => setAiServiceQuery(e.target.value)}
              placeholder="Ej: Instalación nueva con 3m tubería, recarga de gas R410A, cambio de lugar..."
              className="w-full rounded-xl border border-cyan-500/25 bg-[#070b16] px-3.5 py-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => handleConsultServiceMarket()}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{aiLoading ? 'Cotizando...' : 'Cotizar IA'}</span>
            </button>
          </div>
        </div>

        {/* Service quick presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-zinc-500 font-mono">Consultas rápidas:</span>
          {[
            { d: 'Minisplit 1 Tonelada', q: 'Instalación básica de minisplit con vacío' },
            { d: 'Minisplit Inverter R410A / R32', q: 'Recarga completa de gas refrigerante y detección de fuga' },
            { d: 'Minisplit 1.5 Toneladas', q: 'Desinstalación, recuperación de gas y cambio de lugar' },
            { d: 'Kit 4 Cámaras CCTV', q: 'Instalación y configuración de 4 cámaras con cableado' },
          ].map((preset, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setAiServiceDevice(preset.d);
                setAiServiceQuery(preset.q);
                handleConsultServiceMarket(preset.q, preset.d);
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-[#070b16] hover:bg-cyan-950/50 text-zinc-300 hover:text-cyan-300 border border-zinc-800 hover:border-cyan-500/40 transition cursor-pointer"
            >
              {preset.q.slice(0, 38)}...
            </button>
          ))}
        </div>

        {aiError && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{aiError}</span>
          </div>
        )}

        {aiResult && (
          <div className="pt-3 border-t border-cyan-500/20 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-cyan-300">{aiResult.serviceTitle}</span>
                  {aiProviderUsed && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40 uppercase">
                      IA: {aiProviderUsed}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-300 mt-1">{aiResult.marketSummary}</p>
              </div>
              <span className="text-xs font-mono text-zinc-400 shrink-0">
                Tiempo est.: <strong className="text-white">{aiResult.estimatedTime}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(['economico', 'recomendado', 'premium'] as const).map((tk) => {
                const t = aiResult.tiers[tk];
                if (!t) return null;
                return (
                  <div
                    key={tk}
                    className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 ${
                      tk === 'recomendado'
                        ? 'bg-cyan-950/35 border-cyan-400'
                        : 'bg-[#070b16] border-zinc-800'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-cyan-300 uppercase block">{t.label}</span>
                      <div className="text-xl font-black font-mono text-white">
                        {formatCurrency(t.total, aiResult.currencyLabel || currency)}
                      </div>
                      <p className="text-[11px] text-zinc-400">{t.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyAITierToQuote(tk)}
                      className="w-full py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Generar Cotización PDF</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Services Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredServices.map((srv) => {
          const meta = CATEGORY_META[srv.category] || CATEGORY_META.otro;
          const Icon = meta.icon;
          const isConfirming = confirmDeleteId === srv.id;

          return (
            <div
              key={srv.id}
              className="hud-panel rounded-2xl p-5 flex flex-col justify-between space-y-4 border border-cyan-500/20"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${meta.badge}`}
                  >
                    <Icon className="w-3 h-3" />
                    {meta.label}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(srv)}
                      className="p-1.5 text-zinc-400 hover:text-cyan-300 rounded-lg hover:bg-white/5 transition"
                      title="Editar servicio"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {isConfirming ? (
                      <div className="flex items-center gap-1 bg-red-950/80 border border-red-500/40 rounded-lg px-2 py-0.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteService(srv.id);
                            setConfirmDeleteId(null);
                          }}
                          className="text-[10px] font-bold text-red-300 hover:text-white"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-[10px] text-zinc-400 hover:text-white ml-1"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(srv.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-red-950/30 transition"
                        title="Eliminar servicio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-sm text-white leading-snug">{srv.name}</h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{srv.description}</p>
                </div>

                {srv.includesMaterials && (
                  <div className="text-[11px] bg-[#070b16] border border-cyan-500/15 rounded-xl p-2.5 text-zinc-300">
                    <strong className="text-cyan-300 block text-[10px] uppercase">Incluye:</strong>
                    {srv.includesMaterials}
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    {srv.estimatedDuration}
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    {srv.warrantyDays}d garantía
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-cyan-500/15 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400 font-mono">Precio Base:</span>
                  <strong className="text-lg font-black font-mono text-cyan-300">
                    {formatCurrency(srv.basePrice, currency)}
                  </strong>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAiServiceDevice(srv.name);
                      setAiServiceQuery(srv.description);
                      handleConsultServiceMarket(srv.description, srv.name);
                    }}
                    className="py-2 px-2.5 rounded-xl bg-[#070b16] hover:bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Mercado IA</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleConvertServiceToQuote(srv)}
                    className="py-2 px-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Cotizar PDF</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredServices.length === 0 && (
          <div className="col-span-full text-center py-12 text-zinc-400 text-sm">
            No se encontraron servicios con los filtros actuales.
          </div>
        )}
      </div>

      {/* Add / Edit Service Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#091024] border border-cyan-500/30 rounded-3xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#070b16] border-b border-cyan-500/20">
              <h3 className="font-bold text-white text-sm">
                {editingService ? 'Editar Servicio Técnico' : 'Registrar Nuevo Servicio'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Nombre del Servicio *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Instalación de Minisplit 1.5 Toneladas Inverter"
                  className="w-full rounded-xl border border-cyan-500/25 bg-[#070b16] px-3 py-2 text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Categoría</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ServiceCategory)}
                    className="w-full rounded-xl border border-cyan-500/25 bg-[#070b16] px-3 py-2 text-white outline-none"
                  >
                    {Object.entries(CATEGORY_META).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Precio Base ({currency}) *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-cyan-500/25 bg-[#070b16] px-3 py-2 text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Duración Estimada</label>
                  <input
                    type="text"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    placeholder="Ej: 2 - 4 horas"
                    className="w-full rounded-xl border border-cyan-500/25 bg-[#070b16] px-3 py-2 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Garantía (días)</label>
                  <input
                    type="number"
                    min="0"
                    value={formWarranty}
                    onChange={(e) => setFormWarranty(Number(e.target.value))}
                    className="w-full rounded-xl border border-cyan-500/25 bg-[#070b16] px-3 py-2 text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Descripción Técnica</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Detalla qué incluye la instalación, recarga o mantenimiento..."
                  className="w-full rounded-xl border border-cyan-500/25 bg-[#070b16] p-2.5 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Materiales / Insumos Incluidos (Opc.)</label>
                <input
                  type="text"
                  value={formMaterials}
                  onChange={(e) => setFormMaterials(e.target.value)}
                  placeholder="Ej: Hasta 1kg gas R410A, vacío con bomba, cinta momia"
                  className="w-full rounded-xl border border-cyan-500/25 bg-[#070b16] px-3 py-2 text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-cyan-500/20">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-zinc-400 hover:text-white rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl"
                >
                  Guardar Servicio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
