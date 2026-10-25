import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, Lock, Mail, ArrowRight, AlertCircle, Building2 } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('rehmanglobal.contact@gmail.com');
  const [password, setPassword] = useState('Rehman@2026Admin');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await login(email, password);
    if (!res.success) {
      setError(res.error || 'Failed to authenticate');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#080B11] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden bg-grid-pattern">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#0E1626]/90 border border-[#1E2C4A] rounded-2xl p-8 shadow-2xl backdrop-blur-xl relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 p-0.5 shadow-lg shadow-blue-500/20 mb-4 flex items-center justify-center">
            <div className="w-full h-full bg-[#080B11] rounded-[10px] flex items-center justify-center">
              <Building2 className="w-7 h-7 text-cyan-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            REHMAN GWS
            <span className="text-xs uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold tracking-wider">
              Private
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-medium">Lead Operations & Sales Command Center</p>
        </div>

        {/* Security Notice */}
        <div className="mb-6 p-3 rounded-lg bg-blue-950/40 border border-blue-900/50 flex items-center gap-3 text-xs text-blue-300">
          <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Restricted Admin System. Authorized staff access only.</span>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-950/50 border border-red-900/60 flex items-start gap-3 text-xs text-red-300 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Admin Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rehmanglobal.contact@gmail.com"
                className="w-full pl-10 pr-4 py-2.5 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Secure Passkey
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer active:scale-[0.99]"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Authenticating...
              </span>
            ) : (
              <>
                <span>Access Command Center</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#1E2C4A]/60 text-center">
          <p className="text-[11px] text-slate-500">
            Encrypted session &bull; Role allowlist enforcement &bull; v2.6.0
          </p>
        </div>
      </div>
    </div>
  );
};
