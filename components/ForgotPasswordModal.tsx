'use client';

import React, { useState } from 'react';
import {
  getSupabaseClient,
  addAuditLog,
  findProfileByEmail,
  saveCustomPassword,
  saveAdminPassword,
} from '@/lib/supabase';
import {
  KeyRound,
  X,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
}) => {
  const [email, setEmail] = useState(initialEmail.trim() || 'admin');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanInput = email.trim().toLowerCase();

    // 1. Check if user exists (or is admin alias or single-admin fallback)
    const existingProfile = findProfileByEmail(cleanInput || 'admin');
    if (!existingProfile) {
      setErrorMessage(
        `O usuário ou e-mail "${cleanInput}" não foi encontrado. Clique em "Usar admin" abaixo para redefinir a senha do Administrador.`
      );
      return;
    }

    if (newPassword.length < 3) {
      setErrorMessage('A nova senha deve possuir pelo menos 3 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('A nova senha e a confirmação de senha não conferem.');
      return;
    }

    setIsLoading(true);

    try {
      // 2. Save password in local credentials store
      saveCustomPassword(cleanInput || 'admin', newPassword);
      if (existingProfile.email) {
        saveCustomPassword(existingProfile.email, newPassword);
      }
      
      const isAdminTarget = existingProfile.role === 'Admin' ||
        ['admin', 'administra', 'aministra', 'administrador', 'marcio'].some(k => cleanInput.includes(k));

      if (isAdminTarget) {
        saveAdminPassword(newPassword);
      }

      // 3. Sync with Supabase Auth if available (non-blocking)
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.auth.updateUser({
            password: newPassword,
          });
        } catch (sErr) {
          console.warn('Supabase password sync note:', sErr);
        }
      }

      // 4. Audit Log & Success Confirmation
      addAuditLog(
        existingProfile.email || cleanInput || 'admin',
        'PASSWORD_RESET',
        `Senha cadastrada/redefinida com sucesso para ${existingProfile.full_name} (${cleanInput || 'admin'})`
      );

      setSuccessMessage(
        `A senha do usuário ${existingProfile.full_name} foi cadastrada com sucesso! Ela já está pronta para login.`
      );

      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setErrorMessage(
        err?.message || 'Erro ao processar o cadastro de senha. Tente novamente.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-amber-200/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4a000c] via-[#600010] to-[#2e0007] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl border border-white/20">
              <KeyRound className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <h2 className="text-base font-black">Recuperar / Alterar Senha</h2>
              <p className="text-xs text-rose-100/80 font-medium">
                Redefina sua senha de acesso ao sistema
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

        {/* Content */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-xs text-red-800 font-bold animate-shake">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2 text-xs text-emerald-900 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-4">
            {/* Field: User / Email */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                  Usuário ou E-mail
                </label>
                <button
                  type="button"
                  onClick={() => setEmail('admin')}
                  className="text-[10px] font-bold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200 transition flex items-center gap-1"
                >
                  <Zap className="w-2.5 h-2.5 fill-amber-600" />
                  <span>Usar Administrador (admin)</span>
                </button>
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
            </div>

            {/* Field: New Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                Nova Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 3 caracteres (sua nova senha)"
                  className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#600010] focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Field: Confirm New Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#600010] focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Buttons */}
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
                className="flex-1 py-2.5 bg-[#600010] hover:bg-[#4a000c] text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-md disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                    <span>Redefinir Senha</span>
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
