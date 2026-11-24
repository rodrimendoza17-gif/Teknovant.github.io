import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  Smartphone,
  PlugZap,
  Unlock,
  Cpu,
  Gamepad2,
  Package,
  Loader2,
  Clock,
  TrendingUp,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  ArrowRight,
  Globe,
  History,
  Trash2,
  WifiOff,
  Wrench,
  DollarSign,
  Wind,
  Bot
} from 'lucide-react';
import { WorkshopSettings, QuoteItem } from '../types/workshop';
import { formatCurrency } from '../utils/whatsapp';
import { api, AIProvidersStatus, AIProviderId } from '../utils/api';

export interface MarketTier {
  label: string;
  partsPrice: number;
  laborPrice: number;
  total: number;
  marginPercent: number;
  description: string;
}

export interface MarketQuoteAnalysis {
  serviceTitle: string;
  detectedCategory: string;
  regionUsed: string;
  currencyLabel: string;
  marketSummary: string;
  estimatedTime: string;
  difficultyLevel: string;
  partsCostRange: {
    min: number;
    max: number;
    avg: number;
    notes: string;
  };
  tiers: {
    economico: MarketTier;
    recomendado: MarketTier;
    premium: MarketTier;
  };
  suggestedLineItems: {
    description: string;
    unitPrice: number;
    quantity: number;
  }[];
  suggestedLaborCost: number;
  technicalWarnings: string[];
}

export interface MarketQuoteSource {
  title: string;
  url: string;
}

export interface SavedMarketLookup {
  id: string;
  query: string;
  device: string;
  category: string;
  region: string;
  currency: string;
  analysis: MarketQuoteAnalysis;
  sources: MarketQuoteSource[];
  createdAt: string;
}

export interface AppliedAIQuotePayload {
  deviceDescription: string;
  issueDescription: string;
  items: QuoteItem[];
  laborCost: number;
  notes: string;
}

interface AIMarketQuotePanelProps {
  settings: WorkshopSettings;
  onApplyToNewQuote: (payload: AppliedAIQuotePayload) => void;
}

const HISTORY_STORAGE_KEY = 'teknovant_ai_market_quotes_v1';

const CATEGORIES = [
  {
    id: 'pantalla',
    label: 'Pantallas / Display',
    icon: Smartphone,
    placeholderDevice: 'Ej: iPhone 13 / Samsung A54 / Redmi Note 13',
    placeholderQuery: 'Cambio de pantalla OLED vs Incell'
  },
  {
    id: 'centro_carga',
    label: 'Centro de Carga',
    icon: PlugZap,
    placeholderDevice: 'Ej: Moto G54 / Samsung A34 / iPad 9',
    placeholderQuery: 'Cambio de centro de carga tipo C / flex de carga'
  },
  {
    id: 'desbloqueo',
    label: 'Desbloqueos / FRP / MDM',
    icon: Unlock,
    placeholderDevice: 'Ej: Samsung A15 / Motorola G24 / Xiaomi',
    placeholderQuery: 'Desbloqueo FRP, PayJoy, Macropay, AT&T o Movistar'
  },
  {
    id: 'microsoldadura',
    label: 'Componentes / Placa',
    icon: Cpu,
    placeholderDevice: 'Ej: iPhone 12 / MacBook Air M1 / Moto Edge',
    placeholderQuery: 'Reparación IC de carga, backlight o corto en placa'
  },
  {
    id: 'consola',
    label: 'Consolas',
    icon: Gamepad2,
    placeholderDevice: 'Ej: PlayStation 5 / Xbox Series S / Nintendo Switch',
    placeholderQuery: 'Cambio de puerto HDMI / mantenimiento y metal líquido / drift'
  },
  {
    id: 'servicio_minisplit',
    label: 'Servicios / Minisplits',
    icon: Wind,
    placeholderDevice: 'Ej: Minisplit Inverter 1.5 Ton / Kit CCTV 4 Cámaras',
    placeholderQuery: 'Instalación, recarga de gas R410A/R32 o cambio de lugar'
  },
  {
    id: 'accesorio',
    label: 'Accesorios / Otros',
    icon: Package,
    placeholderDevice: 'Ej: Laptop HP / Cargador 65W / Audífonos / Smartwatch',
    placeholderQuery: 'Venta o reparación de accesorio / batería / teclado'
  }
];

const QUICK_PRESETS = [
  { category: 'pantalla', device: 'Samsung Galaxy A54 5G', query: 'Cambio de pantalla OLED original vs Genérica Incell' },
  { category: 'centro_carga', device: 'Motorola Moto G54', query: 'Cambio de centro de carga USB-C (pin o subplaca)' },
  { category: 'desbloqueo', device: 'Samsung / Motorola Android 14', query: 'Quitar cuenta Google FRP y desbloqueo PayJoy / Macropay' },
  { category: 'desbloqueo', device: 'iPhone 13 / Samsung', query: 'Liberación de compañía AT&T / Movistar / Telcel' },
  { category: 'consola', device: 'PlayStation 5 (PS5)', query: 'Cambio de puerto HDMI y mantenimiento con metal líquido' },
  { category: 'servicio_minisplit', device: 'Minisplit Inverter 1.5 Toneladas', query: 'Instalación básica, recarga de gas R410A o cambio de lugar' }
];

const REGION_PRESETS = [
  { id: 'taller', label: 'Según Ajustes del Taller', region: '', currency: '' },
  { id: 'mx', label: 'México — Pesos (MXN $)', region: 'México', currency: 'MXN ($)' },
  { id: 'co', label: 'Colombia — Pesos (COP $)', region: 'Colombia', currency: 'COP ($)' },
  { id: 'pe', label: 'Perú — Soles (PEN S/.)', region: 'Perú', currency: 'PEN (S/.)' },
  { id: 'cl', label: 'Chile — Pesos (CLP $)', region: 'Chile', currency: 'CLP ($)' },
  { id: 'ar', label: 'Argentina — Pesos (ARS $)', region: 'Argentina', currency: 'ARS ($)' },
  { id: 'us', label: 'USA / Internacional — Dólares (USD $)', region: 'Estados Unidos / Internacional', currency: 'USD ($)' },
  { id: 'es', label: 'España — Euros (EUR €)', region: 'España', currency: 'EUR (€)' }
];

export const AIMarketQuotePanel: React.FC<AIMarketQuotePanelProps> = ({
  settings,
  onApplyToNewQuote
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('pantalla');
  const [device, setDevice] = useState('');
  const [query, setQuery] = useState('');
  const [knownPartCost, setKnownPartCost] = useState('');
  const [regionPreset, setRegionPreset] = useState<string>('mx');
  const [aiProvider, setAiProvider] = useState<'auto' | AIProviderId>('auto');
  const [providersStatus, setProvidersStatus] = useState<AIProvidersStatus | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<MarketQuoteAnalysis | null>(null);
  const [sources, setSources] = useState<MarketQuoteSource[]>([]);
  const [history, setHistory] = useState<SavedMarketLookup[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    api.getAIProviders().then(setProvidersStatus).catch(() => {});
  }, []);

  // Auto-align initial region preset with workshop settings if recognizable
  useEffect(() => {
    const cityLower = (settings.city || '').toLowerCase();
    const currLower = (settings.currency || '').toLowerCase();
    if (cityLower.includes('méxico') || cityLower.includes('mexico') || cityLower.includes('cdmx') || currLower.includes('mxn')) {
      setRegionPreset('mx');
    } else if (cityLower.includes('colombia') || cityLower.includes('bogotá') || cityLower.includes('medellín') || currLower.includes('cop')) {
      setRegionPreset('co');
    } else if (cityLower.includes('perú') || cityLower.includes('peru') || currLower.includes('s/')) {
      setRegionPreset('pe');
    } else if (cityLower.includes('chile')) {
      setRegionPreset('cl');
    } else if (cityLower.includes('argentina')) {
      setRegionPreset('ar');
    } else if (cityLower.includes('españa') || currLower.includes('€')) {
      setRegionPreset('es');
    } else {
      setRegionPreset('taller');
    }
  }, [settings.city, settings.currency]);

  const activeCategoryObj = CATEGORIES.find((c) => c.id === selectedCategory) || CATEGORIES[0];

  const getActiveRegionAndCurrency = () => {
    const preset = REGION_PRESETS.find((r) => r.id === regionPreset);
    if (!preset || preset.id === 'taller') {
      return {
        region: settings.city || 'Latinoamérica',
        currency: settings.currency || '$'
      };
    }
    return {
      region: preset.region,
      currency: preset.currency
    };
  };

  const saveLookupToHistory = (
    lookup: Omit<SavedMarketLookup, 'id' | 'createdAt'>
  ) => {
    const newEntry: SavedMarketLookup = {
      ...lookup,
      id: `aiq-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    const updated = [newEntry, ...history].slice(0, 10);
    setHistory(updated);
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage quota errors
    }
  };

  const handleAnalyzeMarket = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!device.trim() && !query.trim()) {
      setErrorMsg('Escribe el equipo, modelo o servicio que deseas cotizar.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const { region, currency } = getActiveRegionAndCurrency();
    const parsedPartCost = knownPartCost.trim() ? Number(knownPartCost) : null;

    try {
      const data = await api.requestMarketQuote({
        query: query.trim() || activeCategoryObj.label,
        device: device.trim(),
        category: activeCategoryObj.label,
        region,
        currency,
        knownPartCost: parsedPartCost,
        workshopName: settings.name,
        provider: aiProvider
      });

      const analysis = data.quoteAnalysis as MarketQuoteAnalysis;
      const fetchedSources = Array.isArray(data.sources) ? (data.sources as MarketQuoteSource[]) : [];

      setResult(analysis);
      setSources(fetchedSources);
      setProviderUsed(data.providerUsed || null);

      saveLookupToHistory({
        query: query.trim() || activeCategoryObj.label,
        device: device.trim(),
        category: selectedCategory,
        region,
        currency,
        analysis,
        sources: fetchedSources
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error consultando el mercado actual.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyTier = (tierKey: 'economico' | 'recomendado' | 'premium') => {
    if (!result) return;
    const tier = result.tiers[tierKey];
    const items: QuoteItem[] = [];

    if (tier.partsPrice > 0) {
      items.push({
        id: `qi-${Date.now()}-part`,
        description: `${result.serviceTitle} — ${tier.label}`,
        unitPrice: Math.round(tier.partsPrice),
        quantity: 1
      });
    } else if (result.suggestedLineItems && result.suggestedLineItems.length > 0) {
      result.suggestedLineItems.forEach((it, idx) => {
        items.push({
          id: `qi-${Date.now()}-${idx}`,
          description: it.description,
          unitPrice: Math.round(it.unitPrice),
          quantity: it.quantity || 1
        });
      });
    }

    const warningsText =
      result.technicalWarnings && result.technicalWarnings.length > 0
        ? `Notas técnicas (${tier.label}): ${result.technicalWarnings.join(' | ')}`
        : tier.description;

    onApplyToNewQuote({
      deviceDescription: device.trim() || result.serviceTitle,
      issueDescription: `${result.serviceTitle}${query.trim() ? ` (${query.trim()})` : ''} - Opción ${tier.label}`,
      items: items.length > 0 ? items : [{ id: `qi-${Date.now()}`, description: result.serviceTitle, unitPrice: 0, quantity: 1 }],
      laborCost: Math.round(tier.laborPrice || 0),
      notes: warningsText
    });
  };

  const handleLoadFromHistory = (item: SavedMarketLookup) => {
    setSelectedCategory(item.category || 'pantalla');
    setDevice(item.device);
    setQuery(item.query);
    setResult(item.analysis);
    setSources(item.sources || []);
    setErrorMsg(null);
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  };

  const currencySymbol = result?.currencyLabel || getActiveRegionAndCurrency().currency;

  return (
    <div className="hud-panel rounded-3xl p-5 sm:p-6 border border-cyan-500/30 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 text-white shadow-[0_0_20px_rgba(0,242,254,0.35)]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                Cotizador IA de Mercado Actual
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                BÚSQUEDA EN VIVO
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Cotiza pantallas, centros de carga, desbloqueos (FRP, PayJoy, Macropay, AT&T, Movistar), microsoldadura, consolas y accesorios a precio competitivo.
            </p>
          </div>
        </div>

        {/* AI Provider & Region / Currency Selectors */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {(() => {
            const labels: Record<AIProviderId, string> = {
              gemini: 'Google Gemini IA',
              groq: 'Groq Cloud (Llama 3.3 Gratis)',
              openai: 'OpenAI (ChatGPT)',
              openrouter: 'OpenRouter (Modelos Gratis/Pro)',
              claude: 'Claude AI (Anthropic)',
              deepseek: 'DeepSeek IA',
              custom: 'IA Personalizada / Ollama',
            };
            const list = providersStatus?.availableProviders || [];
            if (list.length > 0) {
              return (
                <div className="flex items-center gap-2 bg-[#070b16] border border-indigo-500/30 rounded-xl px-3 py-2">
                  <Bot className="w-4 h-4 text-indigo-400 shrink-0" />
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value as 'auto' | AIProviderId)}
                    className="bg-transparent text-xs font-mono text-white outline-none cursor-pointer"
                    aria-label="Motor IA"
                  >
                    <option value="auto" className="bg-[#070b16] text-white">
                      Auto ({list.length > 1 ? 'Respaldo multi-IA' : labels[list[0]]})
                    </option>
                    {list.map((p) => (
                      <option key={p} value={p} className="bg-[#070b16] text-white">
                        {labels[p]}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }
            return (
              <div className="flex items-center gap-2 bg-[#070b16] border border-amber-500/30 rounded-xl px-3 py-2 text-xs font-mono text-amber-300">
                <Bot className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Sin API IA en .env</span>
              </div>
            );
          })()}

          <div className="flex items-center gap-2 bg-[#070b16] border border-cyan-500/25 rounded-xl px-3 py-2">
            <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
            <select
              value={regionPreset}
              onChange={(e) => setRegionPreset(e.target.value)}
              className="bg-transparent text-xs font-mono text-white outline-none cursor-pointer"
              aria-label="Mercado y moneda"
            >
              {REGION_PRESETS.map((r) => (
                <option key={r.id} value={r.id} className="bg-[#070b16] text-white">
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Category Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const active = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition border text-left ${
                active
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border-cyan-400 text-cyan-200 shadow-[0_0_15px_rgba(0,242,254,0.18)]'
                  : 'bg-[#070b16]/80 border-zinc-800 text-zinc-400 hover:text-white hover:border-cyan-500/40'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-cyan-400' : 'text-zinc-500'}`} />
              <span className="truncate">{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search Form */}
      <form onSubmit={handleAnalyzeMarket} className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-4 space-y-1">
          <label className="text-[11px] font-mono text-zinc-400 uppercase block">
            Equipo / Modelo / Consola *
          </label>
          <input
            type="text"
            value={device}
            onChange={(e) => setDevice(e.target.value)}
            placeholder={activeCategoryObj.placeholderDevice}
            className="w-full rounded-xl border border-cyan-500/25 bg-[#070b16] px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-cyan-400"
          />
        </div>

        <div className="md:col-span-4 space-y-1">
          <label className="text-[11px] font-mono text-zinc-400 uppercase block">
            Reparación, Desbloqueo o Artículo *
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={activeCategoryObj.placeholderQuery}
            className="w-full rounded-xl border border-cyan-500/25 bg-[#070b16] px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-cyan-400"
          />
        </div>

        <div className="md:col-span-2 space-y-1">
          <label className="text-[11px] font-mono text-zinc-400 uppercase block" title="Opcional: si ya sabes cuánto te cuesta la refacción o crédito">
            Costo Refacción (Opc.)
          </label>
          <div className="relative">
            <DollarSign className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
            <input
              type="number"
              min="0"
              value={knownPartCost}
              onChange={(e) => setKnownPartCost(e.target.value)}
              placeholder="Ej: 450"
              className="w-full rounded-xl border border-cyan-500/25 bg-[#070b16] pl-8 pr-3 py-2.5 text-xs font-mono text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>
        </div>

        <div className="md:col-span-2 flex items-end">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 hover:from-cyan-300 hover:to-indigo-500 disabled:opacity-60 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-[0_0_20px_rgba(0,242,254,0.3)] transition cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analizando...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Cotizar Mercado</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Quick Presets */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        <span className="text-[11px] text-zinc-500 font-mono">Ejemplos rápidos:</span>
        {QUICK_PRESETS.map((preset, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setSelectedCategory(preset.category);
              setDevice(preset.device);
              setQuery(preset.query);
            }}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-[#070b16] hover:bg-cyan-950/50 text-zinc-300 hover:text-cyan-300 border border-zinc-800 hover:border-cyan-500/40 transition"
          >
            {preset.device} • {preset.query.split(' ')[0]} {preset.query.split(' ')[1] || ''}
          </button>
        ))}
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5">
          {errorMsg.includes('internet') ? (
            <WifiOff className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <strong className="block text-red-300">No se pudo completar la consulta de mercado</strong>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Results View */}
      {result && (
        <div className="space-y-5 pt-2 border-t border-cyan-500/20 animate-fade-in">
          {/* Summary Header */}
          <div className="bg-[#070b16]/90 border border-cyan-500/25 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">
                    Análisis de Mercado • {result.regionUsed} ({currencySymbol})
                  </span>
                  {providerUsed && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40 uppercase">
                      Motor: {providerUsed === 'claude' ? 'Claude AI' : 'Gemini AI'}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-white">{result.serviceTitle}</h3>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  {result.estimatedTime}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-amber-300">
                  <Wrench className="w-3.5 h-3.5 text-amber-400" />
                  Dificultad: {result.difficultyLevel}
                </span>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">{result.marketSummary}</p>

            {/* Wholesale / Provider Cost Box */}
            {result.partsCostRange && (
              <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-blue-200">
                  <TrendingUp className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>
                    <strong>Costo estimado de refacción / crédito:</strong>{' '}
                    {formatCurrency(result.partsCostRange.min, currencySymbol)} –{' '}
                    {formatCurrency(result.partsCostRange.max, currencySymbol)}{' '}
                    (Prom. {formatCurrency(result.partsCostRange.avg, currencySymbol)})
                  </span>
                </div>
                {result.partsCostRange.notes && (
                  <span className="text-[11px] text-zinc-400">{result.partsCostRange.notes}</span>
                )}
              </div>
            )}
          </div>

          {/* 3 Competitive Pricing Tiers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['economico', 'recomendado', 'premium'] as const).map((tierKey) => {
              const tier = result.tiers[tierKey];
              if (!tier) return null;
              const isRecommended = tierKey === 'recomendado';
              const isPremium = tierKey === 'premium';

              return (
                <div
                  key={tierKey}
                  className={`rounded-2xl p-4 flex flex-col justify-between space-y-4 border transition ${
                    isRecommended
                      ? 'bg-gradient-to-b from-cyan-950/50 to-[#070b16] border-cyan-400 shadow-[0_0_25px_rgba(0,242,254,0.18)]'
                      : isPremium
                      ? 'bg-[#090f22] border-indigo-500/40'
                      : 'bg-[#070b16] border-zinc-800'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-bold uppercase tracking-wide ${
                          isRecommended
                            ? 'text-cyan-300'
                            : isPremium
                            ? 'text-indigo-300'
                            : 'text-emerald-300'
                        }`}
                      >
                        {tier.label}
                      </span>
                      {isRecommended && (
                        <span className="text-[9px] font-mono font-black px-2 py-0.5 rounded bg-cyan-400 text-black">
                          IDEAL
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black font-mono text-white">
                        {formatCurrency(tier.total, currencySymbol)}
                      </span>
                      {tier.marginPercent > 0 && (
                        <span className="text-[11px] font-mono text-emerald-400">
                          ~{tier.marginPercent}% margen
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {tier.description}
                    </p>

                    <div className="pt-2 border-t border-white/10 space-y-1 text-[11px] font-mono text-zinc-300">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Pieza / Crédito:</span>
                        <span>{formatCurrency(tier.partsPrice, currencySymbol)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Mano de Obra:</span>
                        <span>{formatCurrency(tier.laborPrice, currencySymbol)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyTier(tierKey)}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      isRecommended
                        ? 'bg-cyan-400 hover:bg-cyan-300 text-black'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Usar en Cotización</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Warnings & Grounding Sources */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {result.technicalWarnings && result.technicalWarnings.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-2">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Consideraciones Técnicas y Riesgos al Recibir
                </span>
                <ul className="space-y-1.5 text-xs text-zinc-300 list-disc list-inside">
                  {result.technicalWarnings.map((warn, i) => (
                    <li key={i} className="leading-snug">
                      {warn}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {sources.length > 0 && (
              <div className="p-4 rounded-2xl bg-[#070b16] border border-zinc-800 space-y-2">
                <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  Fuentes de Referencia del Mercado Consultadas
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {sources.slice(0, 6).map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 text-[11px] text-cyan-400 hover:text-cyan-300 bg-zinc-900/70 px-2.5 py-1.5 rounded-lg border border-zinc-800 hover:border-cyan-500/40 transition"
                    >
                      <span className="truncate">{src.title}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Lookups History (also works offline!) */}
      {history.length > 0 && (
        <div className="pt-3 border-t border-cyan-500/15 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-cyan-400" />
              Consultas Recientes Guardadas Localmente ({history.length})
            </span>
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-[11px] text-zinc-500 hover:text-red-400 flex items-center gap-1 transition"
            >
              <Trash2 className="w-3 h-3" />
              Limpiar
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleLoadFromHistory(item)}
                className="shrink-0 text-left px-3 py-2 rounded-xl bg-[#070b16] hover:bg-cyan-950/30 border border-zinc-800 hover:border-cyan-500/40 transition max-w-[240px]"
              >
                <div className="text-xs font-bold text-white truncate">
                  {item.device || item.analysis.serviceTitle}
                </div>
                <div className="text-[10px] text-zinc-400 truncate">{item.query}</div>
                <div className="text-[11px] font-mono text-cyan-400 mt-1">
                  Rec: {formatCurrency(item.analysis.tiers?.recomendado?.total || 0, item.currency)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
