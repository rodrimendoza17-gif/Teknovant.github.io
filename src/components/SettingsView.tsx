import React, { useState, useRef, useEffect } from 'react';
import {
  Settings,
  Image as ImageIcon,
  Palette,
  Shield,
  Save,
  RotateCcw,
  Upload,
  Trash2,
  Download,
  UploadCloud,
  CheckCircle,
  Building,
  Landmark,
  CreditCard,
  FileText,
  CheckSquare,
  Target,
  AlertCircle,
  Receipt
} from 'lucide-react';
import { WorkshopSettings, AppTheme, AcceptedPaymentMethods } from '../types/workshop';
import { DEFAULT_PAYMENT_METHODS, exportAllData } from '../utils/storage';

interface SettingsViewProps {
  settings: WorkshopSettings;
  onSaveSettings: (settings: WorkshopSettings) => Promise<void> | void;
  onImportBackup?: (parsed: unknown) => Promise<void>;
  onResetData?: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onImportBackup,
  onResetData
}) => {
  const [formData, setFormData] = useState<WorkshopSettings>({
    ...settings,
    acceptedPaymentMethods: settings.acceptedPaymentMethods || { ...DEFAULT_PAYMENT_METHODS }
  });
  const [newTech, setNewTech] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setFormData({
      ...settings,
      acceptedPaymentMethods: settings.acceptedPaymentMethods || { ...DEFAULT_PAYMENT_METHODS }
    });
  }, [settings]);

  const paymentMethods: AcceptedPaymentMethods = formData.acceptedPaymentMethods || DEFAULT_PAYMENT_METHODS;

  const togglePaymentMethod = (key: keyof AcceptedPaymentMethods) => {
    setFormData((prev) => ({
      ...prev,
      acceptedPaymentMethods: {
        ...(prev.acceptedPaymentMethods || DEFAULT_PAYMENT_METHODS),
        [key]: !(prev.acceptedPaymentMethods?.[key] ?? DEFAULT_PAYMENT_METHODS[key])
      }
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setFeedback({ type: 'error', text: 'La imagen del logotipo no debe superar los 2 MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setFormData((prev) => ({ ...prev, logoUrl: result }));
      setFeedback({ type: 'success', text: 'Logotipo cargado. Haz clic en "Guardar Configuración" para aplicarlo.' });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setFormData((prev) => ({ ...prev, logoUrl: '' }));
  };

  const handleAddTech = () => {
    if (newTech.trim() && !formData.technicians.includes(newTech.trim())) {
      setFormData((prev) => ({ ...prev, technicians: [...prev.technicians, newTech.trim()] }));
      setNewTech('');
    }
  };

  const handleRemoveTech = (tech: string) => {
    setFormData((prev) => ({ ...prev, technicians: prev.technicians.filter((t) => t !== tech) }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    try {
      await onSaveSettings(formData);
      setSaveSuccess(true);
      setFeedback({ type: 'success', text: 'Configuración guardada y sincronizada en el servidor.' });
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al guardar la configuración.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportBackup = () => {
    const jsonStr = exportAllData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_teknovant_${new Date().toISOString().substring(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (onImportBackup) {
          await onImportBackup(parsed);
        }
        setFeedback({ type: 'success', text: 'Copia de seguridad restaurada y guardada con éxito.' });
      } catch (err) {
        setFeedback({
          type: 'error',
          text: err instanceof Error ? err.message : 'Error al leer o restaurar el archivo JSON.'
        });
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = async () => {
    if (!onResetData) return;
    try {
      await onResetData();
      setConfirmReset(false);
      setFeedback({ type: 'success', text: 'Datos restablecidos a la demostración inicial.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al restablecer datos.'
      });
    }
  };

  const themes: { id: AppTheme; name: string; color: string; bg: string }[] = [
    { id: 'cyber', name: 'Teknovant Cyber Neon (Predeterminado)', color: 'bg-cyan-400', bg: 'border-cyan-400' },
    { id: 'dark_slate', name: 'Dark Slate Tech', color: 'bg-zinc-800', bg: 'border-zinc-700' },
    { id: 'blue', name: 'Azul Técnico Corporativo', color: 'bg-blue-600', bg: 'border-blue-600' },
    { id: 'emerald', name: 'Esmeralda Laboratorio', color: 'bg-emerald-600', bg: 'border-emerald-600' },
    { id: 'purple', name: 'Púrpura Quantum', color: 'bg-purple-600', bg: 'border-purple-600' },
    { id: 'amber', name: 'Ámbar Mecatrónica', color: 'bg-amber-600', bg: 'border-amber-600' }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0b132b]/80 p-5 rounded-2xl border border-cyan-500/30 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-xl shadow-xs">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base sm:text-lg">
              Ajustes del Taller, Branding, Cobros y PDF/Tickets
            </h2>
            <p className="text-xs text-zinc-400">
              Personaliza logotipo en inicio y documentos, formas de pago aceptadas, metas de ventas y términos legales.
            </p>
          </div>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-950/70 px-3 py-1.5 rounded-xl border border-emerald-500/40 shrink-0">
            <CheckCircle className="w-4 h-4" />
            ¡Cambios guardados!
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">

        {/* Section 1: Logo de la Empresa */}
        <div className="bg-[#0b132b]/80 p-6 rounded-2xl border border-cyan-500/20 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4" />
            1. Logotipo Oficial (Inicio, Login, PDF y Tickets POS)
          </h3>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-cyan-500/40 bg-[#070b14] flex items-center justify-center overflow-hidden shrink-0">
              {formData.logoUrl ? (
                <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
              ) : (
                <div className="text-center p-2 text-zinc-500">
                  <Building className="w-8 h-8 mx-auto mb-1 opacity-50" />
                  <span className="text-[10px] block">Sin logo</span>
                </div>
              )}
            </div>

            <div className="space-y-2 flex-1 text-center sm:text-left">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Subir Logotipo
                </button>
                {formData.logoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="px-3 py-2 bg-zinc-800 hover:bg-rose-950/60 text-rose-300 rounded-xl text-xs font-medium flex items-center gap-1.5 border border-zinc-700 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Quitar
                  </button>
                )}
              </div>
              <p className="text-[11px] text-zinc-400">
                El logotipo aparecerá en el inicio de la página, barra de navegación, pantalla de acceso, PDF de remisiones/facturas/cotizaciones y en los tickets térmicos del POS.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Temas de la Aplicación */}
        <div className="bg-[#0b132b]/80 p-6 rounded-2xl border border-cyan-500/20 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Palette className="w-4 h-4" />
            2. Tema Visual del Sistema
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {themes.map((th) => {
              const isSelected = formData.theme === th.id;
              return (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, theme: th.id })}
                  className={`p-3 rounded-xl border text-left transition flex items-center gap-3 ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-950/50 ring-1 ring-cyan-400'
                      : 'border-zinc-700/80 bg-[#070b14] hover:border-cyan-500/40'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full ${th.color} shrink-0`} />
                  <div>
                    <strong className="text-xs block text-white">{th.name}</strong>
                    <span className="text-[10px] text-zinc-400">{isSelected ? 'Activo' : 'Elegir'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Datos Generales del Taller + Metas de Ventas */}
        <div className="bg-[#0b132b]/80 p-6 rounded-2xl border border-cyan-500/20 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Building className="w-4 h-4" />
            3. Datos de la Empresa, WhatsApp, Moneda y Metas de Ventas
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-zinc-300 mb-1">Nombre Comercial del Taller:</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] px-3 py-2 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">Eslogan o Subtítulo:</label>
              <input
                type="text"
                value={formData.slogan}
                onChange={(e) => setFormData({ ...formData, slogan: e.target.value })}
                className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] px-3 py-2 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">NIT / RFC / Identificación Fiscal:</label>
              <input
                type="text"
                value={formData.nitRfc}
                onChange={(e) => setFormData({ ...formData, nitRfc: e.target.value })}
                className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] px-3 py-2 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">Teléfono Principal del Taller:</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] px-3 py-2 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">WhatsApp Oficial (código país sin +):</label>
              <input
                type="text"
                placeholder="Ej: 5215512345678"
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] px-3 py-2 text-white outline-none font-mono focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">Símbolo de Moneda:</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] px-3 py-2 text-white outline-none focus:border-cyan-400"
              >
                <option value="$">$ (Dólar / General)</option>
                <option value="MXN $">MXN $ (Pesos Mexicanos)</option>
                <option value="COP $">COP $ (Pesos Colombianos)</option>
                <option value="€">€ (Euro)</option>
                <option value="ARS $">ARS $ (Pesos Argentinos)</option>
                <option value="S/.">S/. (Soles Perú)</option>
                <option value="CLP $">CLP $ (Pesos Chilenos)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">Dirección del Taller:</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] px-3 py-2 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">Ciudad y País:</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] px-3 py-2 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block font-medium text-emerald-300 mb-1 flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                Meta Semanal de Ventas ({formData.currency}):
              </label>
              <input
                type="number"
                min="0"
                value={formData.weeklySalesGoal ?? 5000}
                onChange={(e) => setFormData({ ...formData, weeklySalesGoal: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-lg border border-emerald-500/30 bg-[#070b14] px-3 py-2 text-emerald-300 font-mono font-bold outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block font-medium text-cyan-300 mb-1 flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                Meta Mensual de Ventas ({formData.currency}):
              </label>
              <input
                type="number"
                min="0"
                value={formData.monthlySalesGoal ?? 20000}
                onChange={(e) => setFormData({ ...formData, monthlySalesGoal: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] px-3 py-2 text-cyan-300 font-mono font-bold outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Technicians list */}
          <div className="pt-3 border-t border-cyan-500/20 space-y-2">
            <label className="block text-xs font-semibold text-zinc-300">
              Personal Técnico del Taller:
            </label>
            <div className="flex flex-wrap gap-2">
              {formData.technicians.map((t) => (
                <div key={t} className="flex items-center gap-1.5 bg-[#070b14] border border-zinc-700 text-zinc-200 px-2.5 py-1 rounded-lg text-xs">
                  <span>{t}</span>
                  <button type="button" onClick={() => handleRemoveTech(t)} className="text-zinc-400 hover:text-rose-400">
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 max-w-sm pt-1">
              <input
                type="text"
                placeholder="Nombre de nuevo técnico..."
                value={newTech}
                onChange={(e) => setNewTech(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTech();
                  }
                }}
                className="text-xs flex-1 rounded-lg border border-cyan-500/30 bg-[#070b14] px-3 py-1.5 text-white outline-none"
              />
              <button
                type="button"
                onClick={handleAddTech}
                className="px-3 py-1.5 bg-cyan-950 border border-cyan-500/30 text-cyan-300 rounded-lg text-xs font-bold hover:bg-cyan-900/50 transition"
              >
                + Añadir
              </button>
            </div>
          </div>
        </div>

        {/* Section 4: Formas de Cobro y Datos Bancarios en Remisiones/Facturas */}
        <div className="bg-[#0b132b]/80 p-6 rounded-2xl border border-cyan-500/20 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Landmark className="w-4 h-4" />
              4. Tipos de Cobro, Cuenta Bancaria y Pago con Tarjeta
            </h3>
            <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Visible en Facturas & Remisiones PDF
            </span>
          </div>

          {/* Accepted Payment Methods Checkboxes */}
          <div className="p-3.5 rounded-xl bg-[#070b14] border border-cyan-500/20 space-y-2.5">
            <label className="block text-xs font-bold text-zinc-200">
              Métodos de cobro habilitados para mostrar en facturas y remisiones:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
              {[
                { key: 'depositoBancario' as const, label: 'Depósito Bancario' },
                { key: 'transferencia' as const, label: 'Transferencia SPEI' },
                { key: 'tarjeta' as const, label: 'Pago con Tarjeta' },
                { key: 'efectivo' as const, label: 'Efectivo en Caja' },
                { key: 'billeteraDigital' as const, label: 'Apps / Links Pago' }
              ].map((opt) => {
                const active = Boolean(paymentMethods[opt.key]);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => togglePaymentMethod(opt.key)}
                    className={`px-3 py-2 rounded-xl border text-left font-semibold transition flex items-center gap-2 ${
                      active
                        ? 'bg-emerald-950/70 border-emerald-400/60 text-emerald-300'
                        : 'bg-[#090e1d] border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <CheckSquare className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-emerald-400' : 'text-zinc-600'}`} />
                    <span className="truncate text-[11px]">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-zinc-300 mb-1">Nombre del Banco / Entidad:</label>
              <input
                type="text"
                placeholder="Ej: BBVA, Banorte, Bancolombia, Santander..."
                value={formData.bankName || ''}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] px-3 py-2 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">Tipo de Cuenta / Servicio:</label>
              <input
                type="text"
                placeholder="Ej: Cuenta de Débito / Ahorros / CLABE"
                value={formData.bankAccountType || ''}
                onChange={(e) => setFormData({ ...formData, bankAccountType: e.target.value })}
                className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] px-3 py-2 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">Número de Cuenta / CLABE / Tarjeta:</label>
              <input
                type="text"
                placeholder="Ej: 012180015489214783"
                value={formData.bankAccountNumber || ''}
                onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] px-3 py-2 text-white outline-none font-mono focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">Titular de la Cuenta:</label>
              <input
                type="text"
                placeholder="Ej: Teknovant Labs S.A."
                value={formData.bankAccountHolder || ''}
                onChange={(e) => setFormData({ ...formData, bankAccountHolder: e.target.value })}
                className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] px-3 py-2 text-white outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-zinc-300 mb-1 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                Notas de Pago con Tarjeta (TPV / Clip / MSI):
              </label>
              <input
                type="text"
                placeholder="Ej: Visa, Mastercard y Amex en terminal física o link de pago."
                value={formData.cardPaymentNotes || ''}
                onChange={(e) => setFormData({ ...formData, cardPaymentNotes: e.target.value })}
                className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] px-3 py-2 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">
                Instrucciones para Depósitos / Transferencias:
              </label>
              <input
                type="text"
                placeholder="Ej: Enviar comprobante de depósito o transferencia por WhatsApp."
                value={formData.bankPaymentNotes || ''}
                onChange={(e) => setFormData({ ...formData, bankPaymentNotes: e.target.value })}
                className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] px-3 py-2 text-white outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="space-y-1 text-xs pt-1">
            <label className="block font-medium text-zinc-300 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-zinc-400" />
              Nota al Pie de Hojas PDF (Remisión / Factura / Cotización):
            </label>
            <input
              type="text"
              value={formData.documentFooterNote || ''}
              onChange={(e) => setFormData({ ...formData, documentFooterNote: e.target.value })}
              className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] px-3 py-2 text-white outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {/* Section 5: Términos Editables para PDF y Tickets */}
        <div className="bg-[#0b132b]/80 p-6 rounded-2xl border border-cyan-500/20 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Shield className="w-4 h-4" />
            5. Términos y Condiciones para Clientes (PDFs y Tickets POS)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-zinc-300 mb-1">
                Términos en Remisión de Entrada (PDF):
              </label>
              <textarea
                rows={3}
                value={formData.entryTerms}
                onChange={(e) => setFormData({ ...formData, entryTerms: e.target.value })}
                className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] p-2.5 text-white outline-none leading-relaxed focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">
                Términos de Garantía al Entregar (Comprobante PDF):
              </label>
              <textarea
                rows={3}
                value={formData.deliveryTerms}
                onChange={(e) => setFormData({ ...formData, deliveryTerms: e.target.value })}
                className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] p-2.5 text-white outline-none leading-relaxed focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">
                Términos para Facturas y Cotizaciones (PDF):
              </label>
              <textarea
                rows={3}
                value={formData.invoiceTerms || ''}
                onChange={(e) => setFormData({ ...formData, invoiceTerms: e.target.value })}
                className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] p-2.5 text-white outline-none leading-relaxed focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1 flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                Términos y Garantía en Tickets Térmicos POS:
              </label>
              <textarea
                rows={3}
                value={formData.ticketTerms || ''}
                onChange={(e) => setFormData({ ...formData, ticketTerms: e.target.value })}
                className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] p-2.5 text-white outline-none leading-relaxed focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-medium text-zinc-300 mb-1">
              Mensaje de Despedida al Pie del Ticket Térmico:
            </label>
            <input
              type="text"
              placeholder="Ej: ¡Gracias por su preferencia! Síguenos en redes."
              value={formData.ticketFooterNote || ''}
              onChange={(e) => setFormData({ ...formData, ticketFooterNote: e.target.value })}
              className="w-full rounded-lg border border-cyan-500/30 bg-[#070b14] px-3 py-2 text-white outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {/* Save button bar */}
        <div className="flex justify-end gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(0,242,254,0.3)] transition text-xs active:scale-95 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </form>

      {/* Section 6: Copias de Seguridad */}
      <div className="bg-[#0b132b]/80 p-6 rounded-2xl border border-cyan-500/20 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <Download className="w-4 h-4" />
          6. Copias de Seguridad y Respaldo de Datos (JSON)
        </h3>

        <p className="text-xs text-zinc-400">
          Descarga un archivo completo de tus órdenes, servicios, mercancía, clientes y facturas para tener un respaldo o migrar a otro servidor.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleExportBackup}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#070b14] border border-cyan-500/30 hover:bg-cyan-950/40 text-zinc-200 rounded-xl text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Exportar Respaldo Completo (.json)
          </button>

          <label className="flex items-center gap-1.5 px-4 py-2 bg-[#070b14] border border-cyan-500/30 hover:bg-cyan-950/40 text-zinc-200 rounded-xl text-xs font-semibold transition cursor-pointer">
            <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
            Importar Respaldo
            <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
          </label>

          {onResetData && (
            <div className="ml-auto flex items-center gap-2">
              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-rose-400 hover:bg-rose-950/40 border border-rose-500/20 rounded-xl text-xs font-semibold transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restablecer Demostración
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-rose-950/60 border border-rose-500/40 px-3 py-1.5 rounded-xl">
                  <span className="text-[11px] text-rose-200 font-semibold">¿Restablecer todo?</span>
                  <button
                    type="button"
                    onClick={handleResetData}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-bold"
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="px-2.5 py-1 bg-zinc-800 text-zinc-300 rounded-lg text-[11px]"
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
