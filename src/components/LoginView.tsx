import React, { useState } from 'react';
import {
  ShieldCheck,
  User,
  Lock,
  Phone,
  FileText,
  ArrowRight,
  Cpu,
  AlertTriangle,
  Loader2,
  Sparkles,
  Wrench,
  Eye,
  EyeOff,
} from 'lucide-react';
import { AuthUser } from '../types/workshop';
import { api, AuthStatusResponse } from '../utils/api';

interface LoginViewProps {
  authStatus: AuthStatusResponse;
  onAuthenticated: (user: AuthUser) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ authStatus, onAuthenticated }) => {
  const [mode, setMode] = useState<'admin' | 'client'>('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [clientContact, setClientContact] = useState('');
  const [clientFolio, setClientFolio] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { branding, requiresFirstTimeSetup } = authStatus;

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (requiresFirstTimeSetup) {
      if (adminPassword.trim().length < 6) {
        setError('La contraseña de administrador debe tener mínimo 6 caracteres.');
        return;
      }
      if (adminPassword !== adminConfirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }
    } else if (!adminPassword.trim()) {
      setError('Ingresa tu contraseña de administrador.');
      return;
    }

    setLoading(true);
    try {
      const user = requiresFirstTimeSetup
        ? await api.setupAdmin(adminPassword.trim())
        : await api.loginAdmin(adminPassword.trim());
      onAuthenticated(user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!clientContact.trim() || !clientFolio.trim()) {
      setError('Ingresa tu teléfono o correo y tu número de folio (ej. REC-2026-001).');
      return;
    }

    setLoading(true);
    try {
      const user = await api.loginClient(clientContact.trim(), clientFolio.trim());
      onAuthenticated(user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo validar tu acceso de cliente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] cyber-grid text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Workshop Logo & Branding Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-700 p-0.5 shadow-[0_0_30px_rgba(0,242,254,0.35)]">
            <div className="w-full h-full bg-[#090e1d] rounded-[14px] flex items-center justify-center overflow-hidden p-2">
              {branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={branding.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Cpu className="w-10 h-10 text-cyan-400" />
              )}
            </div>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-mono">
              {branding.name}
            </h1>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
              {branding.slogan}
            </p>
          </div>
        </div>

        {/* Auth Card */}
        <div className="hud-panel rounded-3xl p-6 space-y-5 border border-cyan-500/30">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1.5 bg-[#070b16] p-1.5 rounded-2xl border border-cyan-500/20">
            <button
              type="button"
              onClick={() => {
                setMode('admin');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                mode === 'admin'
                  ? 'bg-gradient-to-r from-cyan-500/25 to-blue-600/25 text-cyan-300 border border-cyan-400/50 shadow-[0_0_15px_rgba(0,242,254,0.18)]'
                  : 'text-zinc-400 hover:text-white border border-transparent'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Administrador</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('client');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                mode === 'client'
                  ? 'bg-gradient-to-r from-emerald-500/25 to-teal-600/25 text-emerald-300 border border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.18)]'
                  : 'text-zinc-400 hover:text-white border border-transparent'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Portal Clientes</span>
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Admin Login / Initial Setup Form */}
          {mode === 'admin' ? (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-cyan-400" />
                    {requiresFirstTimeSetup
                      ? 'Configurar Clave de Administrador'
                      : 'Acceso de Taller & Gerencia'}
                  </h2>
                </div>
                <p className="text-[11px] text-zinc-400">
                  {requiresFirstTimeSetup
                    ? 'Define la contraseña maestra para proteger remisiones, facturas, POS, servicios y cotizador IA.'
                    : 'Ingresa tu contraseña para administrar reparaciones, punto de venta, facturas y ajustes.'}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 uppercase mb-1">
                    {requiresFirstTimeSetup ? 'Nueva Contraseña Admin *' : 'Contraseña de Administrador *'}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      autoFocus
                      className="w-full pl-10 pr-10 py-2.5 text-xs font-mono rounded-xl border border-cyan-500/25 bg-[#070b16] text-white outline-none focus:ring-2 focus:ring-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-zinc-400 hover:text-cyan-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {requiresFirstTimeSetup && (
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 uppercase mb-1">
                      Confirmar Contraseña *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={adminConfirmPassword}
                        onChange={(e) => setAdminConfirmPassword(e.target.value)}
                        placeholder="Repite la contraseña"
                        className="w-full pl-10 pr-4 py-2.5 text-xs font-mono rounded-xl border border-cyan-500/25 bg-[#070b16] text-white outline-none focus:ring-2 focus:ring-cyan-400"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 hover:from-cyan-300 hover:to-indigo-500 text-white font-mono font-black text-xs rounded-xl shadow-[0_0_20px_rgba(0,242,254,0.3)] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {requiresFirstTimeSetup ? 'ACTIVAR CUENTA ADMIN' : 'ENTRAR AL LABORATORIO'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Client Login Form */
            <form onSubmit={handleClientSubmit} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Consulta de Equipos, Cotizaciones y Facturas
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Accede en tiempo real al estatus de tu reparación, cotizaciones vigentes y descarga tus facturas PDF.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 uppercase mb-1">
                    Teléfono o Correo Registrado *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-emerald-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={clientContact}
                      onChange={(e) => setClientContact(e.target.value)}
                      placeholder="Ej: 3158891234 o correo@ejemplo.com"
                      autoFocus
                      className="w-full pl-10 pr-4 py-2.5 text-xs font-mono rounded-xl border border-emerald-500/25 bg-[#070b16] text-white outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 uppercase mb-1">
                    Número de Folio (Orden, Cotización o Factura) *
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-emerald-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={clientFolio}
                      onChange={(e) => setClientFolio(e.target.value)}
                      placeholder="Ej: REC-2026-001, COT-2026-001 o FAC-2026-001"
                      className="w-full pl-10 pr-4 py-2.5 text-xs font-mono uppercase rounded-xl border border-emerald-500/25 bg-[#070b16] text-white outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-mono font-black text-xs rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Buscando tus folios...</span>
                  </>
                ) : (
                  <>
                    <span>VER MI SEGUIMIENTO & FACTURAS</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-zinc-500 font-mono">
          {branding.city} • Tel/WhatsApp: {branding.phone}
        </div>
      </div>
    </div>
  );
};
