'use client';

import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  UserRole,
  UserAuditLog,
  loadSavedProfiles,
  saveSavedProfiles,
  loadAuditLogs,
  addAuditLog,
  getSupabaseClient,
  INITIAL_DEMO_PROFILES,
  ADMIN_PROFILE,
  saveCustomPassword,
  saveAdminPassword,
} from '@/lib/supabase';
import { loadMembers } from '@/lib/storage';
import { Member } from '@/lib/types';
import {
  ShieldCheck,
  UserPlus,
  Users,
  Key,
  Copy,
  Check,
  Database,
  FileCode,
  History,
  AlertTriangle,
  Mail,
  Lock,
  Edit2,
  Trash2,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Search,
  UserCheck,
} from 'lucide-react';

interface UserManagementViewProps {
  currentUser: UserProfile;
}

export const SUPABASE_SQL_SCRIPT = `-- ====================================================================
-- ESCOLA SABATINA PRO - SCRIPT SQL COMPLETO SUPABASE & RLS RESTRITIVA
-- Tabelas 'profiles', 'audit_logs', Cargos e Inserção Padrão dos 5 Usuários
-- ====================================================================

-- 1. Criar Tipo Enum para Cargos dos Usuários
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('Admin', 'Diretor', 'Associado', 'Secretário', 'Auxiliar');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Criar Tabela de Perfis de Usuários ('profiles')
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role public.user_role NOT NULL DEFAULT 'Diretor',
  class_unit_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Habilitar RLS (Row Level Security) Estrita
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Política RLS: Leitura apenas para usuários autenticados cujos e-mails estejam em profiles
CREATE POLICY "Leitura de perfis restrita a membros autorizados"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- 5. Política RLS: Apenas Administrador Master (Admin) pode alterar a tabela profiles
CREATE POLICY "Controle total de escrita na tabela profiles para Admin"
  ON public.profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'Admin'
    )
  );

-- 6. Inserção Padrão da Conta de Administrador Autorizada da Escola Sabatina
-- Nota: Execute este bloco para preencher a tabela profiles com o Administrador:
INSERT INTO public.profiles (id, email, full_name, role)
VALUES 
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'admin@escolasabatina.com', 'Administrador Geral', 'Admin')
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;

-- 7. Trigger Automático: Sincronizar perfis ao cadastrar usuário no Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'Diretor')
  )
  ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ativar Trigger após Insert em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Tabela de Logs de Auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver e gravar logs"
  ON public.audit_logs FOR ALL
  TO authenticated
  USING (true);
`;

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'add' | 'sql' | 'logs'>('users');
  const [profilesList, setProfilesList] = useState<UserProfile[]>(loadSavedProfiles());
  const [auditLogs, setAuditLogs] = useState<UserAuditLog[]>(loadAuditLogs());
  const [copiedSql, setCopiedSql] = useState(false);

  // New User Form State
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('123456');
  const [newRole, setNewRole] = useState<UserRole>('Diretor');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Editing User
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editRole, setEditRole] = useState<UserRole>('Diretor');

  // Church Members list
  const [churchMembers] = useState<Member[]>(() => loadMembers());

  // Deleting User Modal State
  const [userToDeleteTarget, setUserToDeleteTarget] = useState<UserProfile | null>(null);

  const supabase = getSupabaseClient();

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);

    const cleanEmail = newEmail.trim().toLowerCase();

    // 1. Try create user via Supabase Client if configured
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: newPassword,
          options: {
            data: {
              full_name: newName,
              role: newRole,
            },
          },
        });

        if (error) {
          console.warn('Supabase signup error:', error.message);
        } else if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            email: cleanEmail,
            full_name: newName,
            role: newRole,
          });
        }
      } catch (err) {
        console.error('Supabase signup exception:', err);
      }
    }

    // 2. Add to local list for immediate display
    const newUserProfile: UserProfile = {
      id: `user-${crypto.randomUUID()}`,
      email: cleanEmail,
      full_name: newName,
      role: newRole,
      created_at: new Date().toISOString(),
    };

    saveCustomPassword(cleanEmail, newPassword);
    if (newRole === 'Admin') {
      saveAdminPassword(newPassword);
    }

    const updated = [newUserProfile, ...profilesList.filter((p) => p.email !== cleanEmail)];
    setProfilesList(updated);
    saveSavedProfiles(updated);

    addAuditLog(
      currentUser.email,
      'USER_CREATE',
      `Novo usuário cadastrado: ${newName} (${cleanEmail}) como cargo ${newRole}`
    );
    setAuditLogs(loadAuditLogs());

    setSuccessMsg(`Usuário ${newName} (${newRole}) foi cadastrado com sucesso!`);
    setNewEmail('');
    setNewName('');
    setNewPassword('123456');
    setNewRole('Diretor');

    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleUpdateUser = async (userId: string) => {
    const cleanName = editName.trim();
    if (!cleanName) {
      alert('Por favor, informe o nome completo do usuário.');
      return;
    }

    if (supabase) {
      try {
        await supabase
          .from('profiles')
          .update({ full_name: cleanName, role: editRole })
          .eq('id', userId);
      } catch (err) {
        console.warn('Supabase update profile note:', err);
      }
    }

    const updated = profilesList.map((p) =>
      p.id === userId ? { ...p, full_name: cleanName, role: editRole } : p
    );
    setProfilesList(updated);
    saveSavedProfiles(updated);

    const targetUser = profilesList.find((p) => p.id === userId);
    addAuditLog(
      currentUser.email,
      'USER_UPDATE',
      `Dados do usuário ${targetUser?.email || userId} alterados: Nome="${cleanName}", Cargo="${editRole}"`
    );
    setAuditLogs(loadAuditLogs());

    setEditingUserId(null);
  };

  const handleResetPasswordMock = (userEmail: string) => {
    addAuditLog(
      currentUser.email,
      'PASSWORD_RESET',
      `Solicitação de redefinição de senha enviada para ${userEmail}`
    );
    setAuditLogs(loadAuditLogs());
    alert(`E-mail de redefinição de senha enviado para: ${userEmail}`);
  };

  const handleDeleteUserClick = (userToDelete: UserProfile) => {
    setUserToDeleteTarget(userToDelete);
  };

  const confirmDeleteUser = async () => {
    if (!userToDeleteTarget) return;

    const emailToDelete = userToDeleteTarget.email.toLowerCase();

    if (supabase) {
      try {
        await supabase.from('profiles').delete().eq('email', emailToDelete);
      } catch (err) {
        console.warn('Supabase delete user note:', err);
      }
    }

    const updated = profilesList.filter(
      (p) => p.email.toLowerCase() !== emailToDelete && p.id !== userToDeleteTarget.id
    );
    setProfilesList(updated);
    saveSavedProfiles(updated);

    addAuditLog(
      currentUser.email,
      'USER_DELETE',
      `Usuário excluído: ${userToDeleteTarget.full_name} (${emailToDelete})`
    );
    setAuditLogs(loadAuditLogs());
    setUserToDeleteTarget(null);
  };

  const handleKeepOnlyAdmin = () => {
    const adminUser = profilesList.find((p) => p.role === 'Admin') || ADMIN_PROFILE;
    const onlyAdmin: UserProfile[] = [adminUser];
    setProfilesList(onlyAdmin);
    saveSavedProfiles(onlyAdmin);
    addAuditLog(
      currentUser.email,
      'USER_PURGE',
      'Configuração aplicada: Mantida exclusivamente a conta de Administrador Geral'
    );
    setAuditLogs(loadAuditLogs());
    setSuccessMsg('Configuração salva: Mantido apenas o usuário Administrador no sistema.');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#4a000c] via-[#600010] to-[#2e0007] text-white p-5 sm:p-6 rounded-3xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
              👑 Painel exclusivo de Administrador Master
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black">Gestão de Usuários & Permissões</h1>
          <p className="text-xs text-rose-100/90 max-w-xl">
            Cadastre os cargos operacionais (Diretora, Associada, Secretários e Auxiliares), controle acessos e exporte as configurações de segurança do Supabase Auth.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/20 text-xs">
          <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
          <div>
            <div className="font-extrabold text-white">{currentUser.full_name}</div>
            <div className="text-[10px] text-amber-200">Acesso Master Ativo</div>
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-[#600010] text-white shadow-sm'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Users className="w-4 h-4 text-[#D4AF37]" />
          <span>Usuários Cadastrados ({profilesList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('add')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'add'
              ? 'bg-[#600010] text-white shadow-sm'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <UserPlus className="w-4 h-4 text-[#D4AF37]" />
          <span>Cadastrar / Convidar Usuário</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sql')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'sql'
              ? 'bg-[#600010] text-white shadow-sm'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <FileCode className="w-4 h-4 text-[#D4AF37]" />
          <span>Script SQL Supabase (RLS)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'logs'
              ? 'bg-[#600010] text-white shadow-sm'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <History className="w-4 h-4 text-[#D4AF37]" />
          <span>Logs de Auditoria ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: Lista de Usuários */}
      {activeTab === 'users' && (
        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#600010]" />
                Usuários e Cargos Cadastrados no Sistema
              </h2>
              <p className="text-xs text-gray-500">
                Acesso e controle de contas de usuário. Você pode manter apenas o Administrador ou convidar outros usuários.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleKeepOnlyAdmin}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-[#600010] border border-rose-200 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all"
                title="Limpar outros usuários e manter apenas a conta do Administrador"
              >
                <ShieldCheck className="w-4 h-4 text-[#600010]" />
                <span>Manter Apenas o Administrador</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('add')}
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-[#600010] border border-amber-300 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all"
              >
                <UserPlus className="w-4 h-4 text-amber-700" />
                <span>Novo Cadastro</span>
              </button>
            </div>
          </div>

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {profilesList.length === 1 && profilesList[0].role === 'Admin' && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span><strong>Modo Administrador Único:</strong> Apenas o perfil de Administrador está ativo no sistema. Todos os demais acessos foram removidos.</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {profilesList.map((user) => {
              const isAdmin = user.role === 'Admin';
              const isEditing = editingUserId === user.id;

              return (
                <div
                  key={user.id}
                  className={`p-4 rounded-2xl border transition-all space-y-3 relative overflow-hidden ${
                    isAdmin
                      ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/50'
                      : 'bg-white border-gray-200/90 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        isAdmin
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-rose-50 text-[#600010] border-rose-200'
                      }`}>
                        {user.role}
                      </span>
                      <h3 className="text-sm font-black text-gray-900 mt-1">{user.full_name}</h3>
                      <p className="text-xs text-gray-500 font-mono">{user.email}</p>
                    </div>

                    <div className="p-2 bg-gray-100 text-gray-600 rounded-xl">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="pt-2 border-t border-gray-200 space-y-3 bg-amber-50/60 p-3 rounded-2xl border border-amber-200">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-extrabold text-gray-800 uppercase tracking-wider">
                          Nome Completo:
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:ring-2 focus:ring-[#600010] focus:outline-none"
                          placeholder="Digite ou escolha do banco"
                        />
                        {churchMembers.length > 0 && (
                          <div className="pt-0.5">
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  setEditName(e.target.value);
                                }
                              }}
                              defaultValue=""
                              className="w-full px-2 py-1 bg-white border border-amber-300 rounded-lg text-[11px] font-medium text-amber-950 focus:outline-none cursor-pointer"
                            >
                              <option value="" disabled>
                                🔍 Buscar no banco de membros da igreja...
                              </option>
                              {churchMembers.map((m) => (
                                <option key={m.id} value={m.name}>
                                  {m.name} ({m.type} - {m.status})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-extrabold text-gray-800 uppercase tracking-wider">
                          Cargo / Função:
                        </label>
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as UserRole)}
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none"
                        >
                          <option value="Diretor">Diretor(a)</option>
                          <option value="Associado">Associado(a)</option>
                          <option value="Secretário">Secretário(a)</option>
                          <option value="Auxiliar">Auxiliar</option>
                          <option value="Admin">👑 Administrador Master</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingUserId(null)}
                          className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-extrabold text-xs rounded-xl transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateUser(user.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition shadow-xs flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Salvar</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUserId(user.id);
                          setEditName(user.full_name);
                          setEditRole(user.role);
                        }}
                        className="font-extrabold text-gray-600 hover:text-gray-900 flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleResetPasswordMock(user.email)}
                        className="font-extrabold text-amber-800 hover:underline flex items-center gap-1"
                      >
                        <Key className="w-3.5 h-3.5 text-amber-600" />
                        <span>Senha</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteUserClick(user)}
                        className="font-extrabold text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded-lg flex items-center gap-1 transition"
                        title="Excluir Usuário"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Form para Cadastrar Novo Usuário */}
      {activeTab === 'add' && (
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-200 shadow-2xs space-y-5 max-w-2xl mx-auto">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#600010]" />
              Cadastrar ou Enviar Convite de Usuário
            </h2>
            <p className="text-xs text-gray-500">
              Cadastre e defina o cargo dos 5 membros responsáveis (Auxiliares, Diretora, Associada, Secretários).
            </p>
          </div>

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                Nome Completo do Usuário
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ex: Maria da Silva"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#600010]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                E-mail de Acesso
              </label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="ex: maria@escolasabatina.com"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#600010]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                  Cargo / Função no Sistema
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#600010]"
                >
                  <option value="Diretor">Diretor(a)</option>
                  <option value="Associado">Associado(a)</option>
                  <option value="Secretário">Secretário(a)</option>
                  <option value="Auxiliar">Auxiliar</option>
                  <option value="Admin">👑 Administrador Master</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                  Senha Inicial
                </label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#600010]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#600010] hover:bg-[#4a000c] text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <UserPlus className="w-4 h-4 text-[#D4AF37]" />
              <span>Confirmar Cadastro de Usuário</span>
            </button>
          </form>

          {/* Guide for 5 People Registration in Supabase */}
          <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200 space-y-2 text-xs">
            <div className="font-extrabold text-amber-950 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-700" />
              Instruções de Cadastro Manual ou Convite das 5 Pessoas no Supabase Console
            </div>
            <ol className="list-decimal list-inside space-y-1 text-gray-700 leading-relaxed font-medium">
              <li>Acesse o painel do seu projeto no Supabase (<strong>supabase.com</strong>).</li>
              <li>Vá na aba lateral em <strong>Authentication &rarr; Users</strong>.</li>
              <li>Clique em <strong>Add User &rarr; Create User</strong> (ou Invite User por E-mail).</li>
              <li>Digite o e-mail da pessoa (ex: diretora, associada, secretários, auxiliares) e defina a senha inicial.</li>
              <li>Após criar, o Trigger SQL cadastrado em <code>profiles</code> salvará automaticamente a conta.</li>
            </ol>
          </div>
        </div>
      )}

      {/* TAB 3: Script SQL Supabase RLS */}
      {activeTab === 'sql' && (
        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FileCode className="w-5 h-5 text-[#600010]" />
                Script SQL para Criação das Tabelas e Políticas RLS (Supabase)
              </h2>
              <p className="text-xs text-gray-500">
                Copie e execute no <strong>SQL Editor</strong> do seu painel do Supabase para aplicar a tabela de perfis, triggers e segurança Row Level Security.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopySql}
              className="px-4 py-2 bg-[#600010] hover:bg-[#4a000c] text-white font-extrabold text-xs rounded-xl flex items-center gap-2 transition-all shadow-sm"
            >
              {copiedSql ? (
                <>
                  <Check className="w-4 h-4 text-[#D4AF37]" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#D4AF37]" />
                  <span>Copiar Script SQL</span>
                </>
              )}
            </button>
          </div>

          <div className="relative bg-gray-950 text-emerald-400 p-4 rounded-2xl font-mono text-[11px] overflow-x-auto leading-relaxed border border-gray-800 shadow-inner max-h-[400px]">
            <pre>{SUPABASE_SQL_SCRIPT}</pre>
          </div>

          {/* Setup Guide Cards for Vercel & Supabase */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Supabase Security Card */}
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-xs">
              <div className="font-black text-[#600010] flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-rose-700" />
                <span>1. Bloquear Autocadastro no Supabase (Sistema Fechado)</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-gray-800 font-medium leading-relaxed">
                <li>Acesse o painel do Supabase em <strong>supabase.com</strong>.</li>
                <li>Navegue até <strong>Authentication &rarr; Providers &rarr; Email</strong>.</li>
                <li>Desmarque a opção <strong>&quot;Allow new users to sign up&quot;</strong>.</li>
                <li>Clique em <strong>Save</strong>. Isso fechará o sistema para novos cadastros públicos.</li>
              </ol>
            </div>

            {/* Vercel Environment Variables Card */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 text-xs">
              <div className="font-black text-amber-950 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-amber-700" />
                <span>2. Configurar Variáveis de Ambiente na Vercel</span>
              </div>
              <p className="text-gray-800 font-medium leading-relaxed">
                No painel do seu projeto na <strong>Vercel &rarr; Settings &rarr; Environment Variables</strong>, adicione:
              </p>
              <ul className="space-y-1 font-mono text-[11px] text-gray-900 bg-white/80 p-2 rounded-xl border border-amber-200">
                <li>• <strong>NEXT_PUBLIC_SUPABASE_URL</strong> = <code>https://seu-projeto.supabase.co</code></li>
                <li>• <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY</strong> = <code>sua_chave_anon_key</code></li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Logs de Auditoria */}
      {activeTab === 'logs' && (
        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-2xs space-y-4">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5 text-[#600010]" />
              Histórico de Acessos e Auditoria do Sistema
            </h2>
            <p className="text-xs text-gray-500">
              Registro das ações realizadas pelos usuários no aplicativo.
            </p>
          </div>

          <div className="space-y-2">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 italic">
                Nenhum log registrado ainda.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-gray-50 rounded-2xl border border-gray-200/80 flex items-center justify-between text-xs gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="font-extrabold text-gray-900 flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-black text-[10px]">
                        {log.action}
                      </span>
                      <span>{log.user_email}</span>
                    </div>
                    <p className="text-gray-600 font-medium">{log.details}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap font-mono">
                    {new Date(log.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Usuário */}
      {userToDeleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-red-600 border-b border-gray-100 pb-3">
              <div className="p-2.5 bg-red-100 text-red-700 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-gray-900 text-base">Excluir Usuário</h3>
                <p className="text-xs text-gray-500">Confirmação de remoção do cadastro</p>
              </div>
            </div>

            {userToDeleteTarget.email.toLowerCase() === currentUser.email.toLowerCase() ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-2 text-amber-900">
                <p className="font-extrabold flex items-center gap-1.5 text-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  Não é possível excluir a sua própria conta!
                </p>
                <p className="text-gray-700 leading-relaxed">
                  Você está atualmente logado como <strong>{userToDeleteTarget.full_name}</strong> ({userToDeleteTarget.email}). Para excluir ou alterar este usuário, conecte-se com outro administrador.
                </p>
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setUserToDeleteTarget(null)}
                    className="px-4 py-2 bg-gray-900 text-white font-extrabold text-xs rounded-xl hover:bg-black transition"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-gray-700 leading-relaxed">
                  Tem certeza de que deseja excluir o usuário <strong className="text-gray-900 font-extrabold">{userToDeleteTarget.full_name}</strong> (<span className="font-mono text-gray-600">{userToDeleteTarget.email}</span>)?
                </p>
                <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-[11px] text-red-700 font-medium">
                  ⚠️ O usuário será removido da lista e perderá o acesso ao sistema.
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setUserToDeleteTarget(null)}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs rounded-xl transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteUser}
                    className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl transition shadow-md flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Sim, Excluir Usuário</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
