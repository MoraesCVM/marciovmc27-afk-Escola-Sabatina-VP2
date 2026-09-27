'use client';

import React, { useState } from 'react';
import { registerOrGetGoogleProfile, saveSession, addAuditLog, UserProfile, getSupabaseClient } from '@/lib/supabase';
import { X, CheckCircle2, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';

interface GoogleLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (profile: UserProfile, token: string) => void;
}

export const GoogleLoginModal: React.FC<GoogleLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [googleEmail, setGoogleEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = googleEmail.trim().toLowerCase();

    if (!cleanEmail.includes('@')) {
      setErrorMessage('Por favor, informe um endereço de e-mail do Google / Gmail válido.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Try Supabase OAuth if available
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
            },
          });
        } catch (sErr) {
          console.warn('Supabase OAuth attempt:', sErr);
        }
      }

      // 2. Register or Retrieve existing profile for this Google Email
      const profile = registerOrGetGoogleProfile(cleanEmail, fullName.trim() || undefined);

      const mockToken = `google-jwt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      saveSession(profile, mockToken);
      addAuditLog(profile.email, 'LOGIN_GOOGLE', `Acesso realizado via Conta Google (${cleanEmail})`);

      onLoginSuccess(profile, mockToken);
      onClose();
    } catch (err: any) {
      console.error('Google login error:', err);
      setErrorMessage(err?.message || 'Erro ao realizar login com Conta do Google.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-amber-200/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header with Google Colors */}
        <div className="bg-gradient-to-r from-[#1a73e8] via-[#4285f4] to-[#0d47a1] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-2xl shadow-sm flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-black text-white">Acessar com Conta do Google</h2>
              <p className="text-xs text-blue-100 font-medium">
                Conecte seu Gmail pessoal sem complicação
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-2.5 text-xs text-blue-900 font-medium">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Ao entrar com sua Conta Google, seu acesso pessoal é criado e atrelado diretamente ao seu e-mail individual.
            </span>
          </div>

          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-xs text-red-800 font-bold">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleGoogleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                Seu E-mail do Google (Gmail)
              </label>
              <input
                type="email"
                required
                value={googleEmail}
                onChange={(e) => setGoogleEmail(e.target.value)}
                placeholder="ex: seu.nome@gmail.com"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                Seu Nome Completo (Opcional)
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="ex: Márcio Silva"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:bg-white transition-all"
              />
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-2.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-md disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Conectando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-amber-300" />
                    <span>Confirmar e Entrar</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
