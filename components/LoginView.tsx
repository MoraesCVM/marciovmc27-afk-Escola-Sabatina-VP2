'use client';

import React, { useState } from 'react';
import { LogoEmblem } from './LogoEmblem';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { ChangeLogoModal } from './ChangeLogoModal';
import {
  UserProfile,
  ADMIN_PROFILE,
  getSupabaseClient,
  saveSession,
  loadSavedProfiles,
  addAuditLog,
  findProfileByEmail,
  getCustomPassword,
} from '@/lib/supabase';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Database,
  KeyRound,
  Camera,
  UserCheck,
  ShieldCheck,
  Zap,
  Sparkles,
} from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (profile: UserProfile, token: string) => void;
  onOpenSyncModal?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  onOpenSyncModal,
}) => {
  const [email, setEmail] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals state
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isChangeLogoOpen, setIsChangeLogoOpen] = useState(false);

  const supabase = getSupabaseClient();

  const handleQuickAdminLogin = () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const savedProfiles = loadSavedProfiles();
      const adminProfile = savedProfiles.find((p) => p.role === 'Admin') || ADMIN_PROFILE;
      const mockToken = `jwt-admin-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      saveSession(adminProfile, mockToken);
      addAuditLog(adminProfile.email, 'LOGIN', 'Acesso imediato com perfil de Administrador');
      onLoginSuccess(adminProfile, mockToken);
    } catch (err: any) {
      setErrorMessage('Erro ao efetuar login rápido do administrador.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const cleanInput = email.trim().toLowerCase();

    const isAdminIdentifier = [
      'admin',
      'administra',
      'administrador',
      'admin@escolasabatina.com',
      'administrador@escolasabatina.com',
      'marcio@escolasabatina.com',
      'marciovmc27@gmail.com',
    ].includes(cleanInput);

    try {
      // 1. Try real Supabase Authentication if client is connected AND input looks like an email
      if (supabase && cleanInput.includes('@')) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: cleanInput,
            password: password,
          });

          if (!error && data.session && data.user) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single();

            const userProfile: UserProfile = {
              id: data.user.id,
              email: data.user.email || cleanInput,
              full_name:
                profileData?.full_name ||
                data.user.user_metadata?.full_name ||
                (isAdminIdentifier ? 'Administrador' : cleanInput.split('@')[0]),
              role: profileData?.role || (isAdminIdentifier ? 'Admin' : 'Diretor'),
              class_unit_id: profileData?.class_unit_id,
              created_at: profileData?.created_at || new Date().toISOString(),
            };

            saveSession(userProfile, data.session.access_token);
            addAuditLog(userProfile.email, 'LOGIN', 'Acesso realizado via Supabase Auth');
            onLoginSuccess(userProfile, data.session.access_token);
            return;
          }
        } catch (sbErr) {
          console.warn('Supabase auth fallback to local login:', sbErr);
        }
      }

      // 2. Local Authentication Check
      const matchedProfile = findProfileByEmail(cleanInput);

      if (!matchedProfile && !isAdminIdentifier) {
        setErrorMessage(
          `O usuário ou e-mail "${cleanInput}" não foi encontrado. Utilize o usuário "admin" ou clique em "Entrar Direto como Administrador".`
        );
        setIsLoading(false);
        return;
      }

      const activeProfile = matchedProfile || ADMIN_PROFILE;
      const isAdminUser = activeProfile.role === 'Admin' || isAdminIdentifier;

      // 3. Password Validation
      // Standard easy passwords recognized for admin:
      const commonAdminPasswords = [
        'admin',
        'admin123',
        '123456',
        'escola',
        'administra',
        'administrador',
      ];
      const customPass = getCustomPassword(cleanInput) || getCustomPassword(activeProfile.email);

      let isPasswordValid = false;
      if (customPass) {
        // If custom password was specifically defined, allow it or common defaults for admin
        if (password === customPass || (isAdminUser && (commonAdminPasswords.includes(password.toLowerCase()) || password.length >= 3))) {
          isPasswordValid = true;
        }
      } else {
        // If no custom password was set, accept standard passwords or any non-empty >= 3 chars
        if (password.length >= 3) {
          isPasswordValid = true;
        }
      }

      if (!isPasswordValid) {
        setErrorMessage(
          'Senha incorreta. A senha padrão do administrador é "admin123" ou "123456", ou você pode clicar no botão de Acesso Rápido abaixo.'
        );
        setIsLoading(false);
        return;
      }

      const mockToken = `jwt-token-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      saveSession(activeProfile, mockToken);
      addAuditLog(activeProfile.email, 'LOGIN', 'Acesso autenticado ao sistema');
      onLoginSuccess(activeProfile, mockToken);
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(
        err?.message || 'Falha ao autenticar. Verifique o usuário ou utilize o Acesso Rápido.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3b0b13] via-[#600010] to-[#25040a] flex items-center justify-center p-4 sm:p-6 select-none">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="relative group">
              <div className="inline-flex p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 shadow-lg">
                <LogoEmblem className="w-16 h-16" />
              </div>
              <button
                type="button"
                onClick={() => setIsChangeLogoOpen(true)}
                className="absolute -bottom-1 -right-1 p-2 bg-[#D4AF37] hover:bg-amber-400 text-[#600010] rounded-full shadow-lg border-2 border-white transition-all transform hover:scale-110 flex items-center justify-center"
                title="Alterar Foto / Logo do Login e do Sistema"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsChangeLogoOpen(true)}
              className="text-[11px] font-extrabold text-amber-200/90 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full border border-white/20 transition flex items-center gap-1.5"
            >
              <Camera className="w-3 h-3 text-[#D4AF37]" />
              <span>Alterar Foto / Logo do Sistema</span>
            </button>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Escola Sabatina Pro
            </h1>
            <p className="text-xs text-amber-200/90 font-medium mt-1">
              Sistema Integrado de Gestão de Unidades e Chamadas
            </p>
          </div>
        </div>

        {/* Main Login Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-amber-200/40 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-gray-900">Acessar Conta</h2>
              <p className="text-xs text-gray-500">Digite suas credenciais para entrar no sistema</p>
            </div>
            <div className="p-2 bg-rose-50 text-[#600010] rounded-xl border border-rose-100">
              <Lock className="w-5 h-5" />
            </div>
          </div>

          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-xs text-red-800 font-medium animate-shake">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Field: User / Email */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                  Usuário ou E-mail
                </label>
                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Conta Administrador
                </span>
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ex: admin ou marciovmc27@gmail.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#600010] focus:bg-white transition-all"
                />
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 pt-0.5">
                <Sparkles className="w-3 h-3 text-[#D4AF37]" />
                <span>Digite <strong>admin</strong> ou seu e-mail cadastrado</span>
              </div>
            </div>

            {/* Field: Password */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                  Senha de Acesso
                </label>
                <span className="text-[10px] text-gray-400 font-medium">Sessão Segura</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#600010] focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Forgot / Reset Password Button */}
              <div className="flex justify-between items-center pt-1">
                <span className="text-[10px] text-gray-400">Padrão: admin123 ou 123456</span>
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className="text-xs font-extrabold text-[#600010] hover:text-[#800018] hover:underline flex items-center gap-1.5 transition py-1"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Esqueci / Alterar Senha</span>
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#600010] hover:bg-[#4a000c] text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-[#D4AF37]" />
                  <span>Entrar com Credenciais</span>
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-3 text-[10px] uppercase font-bold text-gray-400">ou</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            {/* Fast 1-Click Administrator Access */}
            <button
              type="button"
              onClick={handleQuickAdminLogin}
              disabled={isLoading}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-[#D4AF37] hover:from-amber-600 hover:to-amber-500 text-stone-900 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 border border-amber-300"
            >
              <Zap className="w-4 h-4 fill-stone-900" />
              <span>Acesso Imediato - Entrar Direto como Administrador</span>
            </button>
          </form>
        </div>

        {/* Supabase Integration Badge & Link */}
        <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 text-white/90 text-center text-xs space-y-1">
          <div className="flex items-center justify-center gap-1.5 font-bold text-amber-200 text-[11px]">
            <Database className="w-3.5 h-3.5 text-amber-300" />
            <span>Supabase Auth & Row Level Security (RLS)</span>
          </div>
          <p className="text-[10px] text-white/70">
            {supabase
              ? 'Conectado ao Supabase Cloud Project • Tokens JWT com renovação automática'
              : 'O sistema utiliza sessões salvas e suporta integração direta com Supabase Auth'}
          </p>
          {onOpenSyncModal && (
            <button
              type="button"
              onClick={onOpenSyncModal}
              className="text-[10px] font-extrabold text-amber-300 hover:underline mt-1 inline-flex items-center gap-1"
            >
              Configurar Chaves Supabase &rarr;
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      <ForgotPasswordModal
        key={email || 'forgot-pw-modal'}
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        initialEmail={email}
      />

      <ChangeLogoModal
        isOpen={isChangeLogoOpen}
        onClose={() => setIsChangeLogoOpen(false)}
      />
    </div>
  );
};
