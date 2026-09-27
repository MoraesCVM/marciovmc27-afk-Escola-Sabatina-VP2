'use client';

import React, { useState } from 'react';
import { SyncConfig } from '@/lib/types';
import { exportAllDataAsJSON } from '@/lib/storage';
import {
  syncAllLocalDataToSupabase,
  fetchAllDataFromSupabase,
  testSupabaseConnection,
  SUPABASE_SCHEMA_SQL,
} from '@/lib/supabase';
import {
  Cloud,
  Download,
  Upload,
  Check,
  RefreshCw,
  Key,
  ShieldCheck,
  X,
  Database,
  Copy,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Layers,
  Server,
} from 'lucide-react';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncConfig: SyncConfig;
  onSaveSyncConfig: (config: SyncConfig) => void;
  onImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  syncConfig,
  onSaveSyncConfig,
  onImportJSON,
}) => {
  const [activeTab, setActiveTab] = useState<'cloud' | 'sql' | 'backup'>('cloud');

  const [formData, setFormData] = useState({
    supabaseUrl: syncConfig.supabaseUrl || '',
    supabaseAnonKey: syncConfig.supabaseAnonKey || '',
  });

  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    tables: Record<string, boolean>;
  } | null>(null);

  const [copiedSQL, setCopiedSQL] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSyncConfig({
      supabaseUrl: formData.supabaseUrl.trim(),
      supabaseAnonKey: formData.supabaseAnonKey.trim(),
      isConfigured: !!(formData.supabaseUrl.trim() && formData.supabaseAnonKey.trim()),
      lastSync: new Date().toISOString(),
    });
    setStatusMessage({
      type: 'success',
      text: 'Configurações de conexão salvas com sucesso!',
    });
    setTimeout(() => {
      setStatusMessage(null);
    }, 3000);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setStatusMessage(null);

    // Save temporary config if changed
    onSaveSyncConfig({
      supabaseUrl: formData.supabaseUrl.trim(),
      supabaseAnonKey: formData.supabaseAnonKey.trim(),
      isConfigured: !!(formData.supabaseUrl.trim() && formData.supabaseAnonKey.trim()),
      lastSync: new Date().toISOString(),
    });

    try {
      const res = await testSupabaseConnection();
      setTestResult(res);
      setStatusMessage({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Falha ao conectar com o Supabase.',
        tables: {},
      });
      setStatusMessage({
        type: 'error',
        text: err.message || 'Falha ao conectar.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handlePushToCloud = async () => {
    setIsSyncing(true);
    setStatusMessage(null);
    try {
      const count = await syncAllLocalDataToSupabase();
      setStatusMessage({
        type: 'success',
        text: `Sincronização concluída com sucesso! ${count} registros salvos no Supabase.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Erro ao enviar dados para a nuvem.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullFromCloud = async () => {
    setIsPulling(true);
    setStatusMessage(null);
    try {
      const success = await fetchAllDataFromSupabase();
      if (success) {
        setStatusMessage({
          type: 'success',
          text: 'Dados baixados do Supabase com sucesso! Recarregando tela...',
        });
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setStatusMessage({
          type: 'error',
          text: 'Nenhum dado encontrado na nuvem ou as tabelas ainda estão vazias.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Erro ao baixar dados da nuvem.',
      });
    } finally {
      setIsPulling(false);
    }
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSQL(true);
    setTimeout(() => setCopiedSQL(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-gray-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-[#6b1d2f] to-[#4a121f] text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Cloud className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-extrabold flex items-center gap-2">
                Integração Supabase & Backup Nuvem
              </h3>
              <p className="text-[11px] text-white/80 font-medium">
                Conecte seu banco de dados PostgreSQL para sincronização multi-dispositivo em tempo real
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-gray-200 bg-gray-50/80 px-4 pt-2 gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('cloud')}
            className={`px-4 py-2.5 text-xs font-black rounded-t-xl transition-all flex items-center gap-2 border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'cloud'
                ? 'bg-white text-[#6b1d2f] border-[#6b1d2f] shadow-xs'
                : 'text-gray-500 hover:text-gray-900 border-transparent'
            }`}
          >
            <Server className="w-4 h-4 text-[#6b1d2f]" />
            <span>Conexão & Nuvem</span>
            {syncConfig.isConfigured && (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`px-4 py-2.5 text-xs font-black rounded-t-xl transition-all flex items-center gap-2 border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'sql'
                ? 'bg-white text-[#6b1d2f] border-[#6b1d2f] shadow-xs'
                : 'text-gray-500 hover:text-gray-900 border-transparent'
            }`}
          >
            <FileCode className="w-4 h-4 text-amber-600" />
            <span>Script SQL (Tabelas)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`px-4 py-2.5 text-xs font-black rounded-t-xl transition-all flex items-center gap-2 border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'backup'
                ? 'bg-white text-[#6b1d2f] border-[#6b1d2f] shadow-xs'
                : 'text-gray-500 hover:text-gray-900 border-transparent'
            }`}
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>Backup Local (JSON)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {/* Status Message Notification */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl flex items-center gap-2.5 font-bold animate-in fade-in duration-150 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="flex-1">{statusMessage.text}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: CONEXÃO SUPABASE                                                   */}
          {/* ========================================================================= */}
          {activeTab === 'cloud' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-200/80 rounded-2xl space-y-1.5">
                <span className="font-extrabold text-amber-950 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#6b1d2f]" /> Sincronização em Tempo Real para a Escola Sabatina
                </span>
                <p className="text-[11px] text-amber-900/80 leading-relaxed">
                  Conecte sua conta do Supabase para que todas as chamadas, pontuações, membros e assinaturas do Projeto Maná fiquem sincronizadas entre todos os celulares e computadores da diretoria e dos professores.
                </p>
              </div>

              <form onSubmit={handleSave} className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-gray-800">URL do Projeto Supabase</label>
                    <a
                      href="https://supabase.com/dashboard"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-[#6b1d2f] hover:underline font-bold flex items-center gap-1"
                    >
                      <span>Abrir Painel Supabase</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <input
                    type="text"
                    value={formData.supabaseUrl}
                    onChange={(e) => setFormData({ ...formData, supabaseUrl: e.target.value })}
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Disponível no Supabase em: <strong>Project Settings &gt; API &gt; Project URL</strong>
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-gray-800 mb-1">
                    Chave Pública Anônima (Anon Key) Supabase
                  </label>
                  <input
                    type="password"
                    value={formData.supabaseAnonKey}
                    onChange={(e) => setFormData({ ...formData, supabaseAnonKey: e.target.value })}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Disponível no Supabase em: <strong>Project Settings &gt; API &gt; Project API Keys &gt; anon/public</strong>
                  </p>
                </div>

                {/* Diagnostics List when tested */}
                {testResult && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                    <span className="font-extrabold text-xs text-gray-800 block">
                      Diagnóstico das Tabelas do Banco:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                      {Object.entries(testResult.tables).map(([tbl, ok]) => (
                        <div
                          key={tbl}
                          className={`p-1.5 rounded-lg flex items-center gap-1.5 font-bold ${
                            ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`}
                          ></span>
                          <span className="truncate">{tbl}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Primary Action Buttons */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      disabled={isTesting || !formData.supabaseUrl || !formData.supabaseAnonKey}
                      onClick={handleTestConnection}
                      className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                      <span>{isTesting ? 'Testando...' : 'Testar Conexão'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('sql')}
                      className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <FileCode className="w-3.5 h-3.5 text-amber-700" />
                      <span>Ver Script SQL</span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="w-full sm:w-auto px-5 py-2 bg-[#6b1d2f] hover:bg-[#4a121f] text-white font-extrabold rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition"
                  >
                    <Cloud className="w-4 h-4" />
                    <span>Salvar Configuração</span>
                  </button>
                </div>
              </form>

              {/* Two-Way Sync Actions */}
              <div className="pt-4 border-t border-gray-200 space-y-2">
                <span className="font-extrabold text-xs text-gray-800 uppercase tracking-wider block">
                  Ações de Sincronização Manual
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={isSyncing || !syncConfig.isConfigured}
                    onClick={handlePushToCloud}
                    className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl font-bold text-emerald-900 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    <Database className="w-4 h-4 text-emerald-700" />
                    <span>{isSyncing ? 'Enviando dados...' : '1. Enviar Dados Locais p/ Nuvem'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isPulling || !syncConfig.isConfigured}
                    onClick={handlePullFromCloud}
                    className="p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl font-bold text-blue-900 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    <RefreshCw className={`w-4 h-4 text-blue-700 ${isPulling ? 'animate-spin' : ''}`} />
                    <span>{isPulling ? 'Baixando...' : '2. Baixar Dados da Nuvem p/ Local'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: SCRIPT SQL SUPABASE                                                */}
          {/* ========================================================================= */}
          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-rose-50/60 border border-rose-200 rounded-2xl space-y-1.5">
                <h4 className="font-black text-[#6b1d2f] text-xs flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-[#6b1d2f]" /> Como criar as tabelas no Supabase em 4 passos:
                </h4>
                <ol className="list-decimal list-inside text-[11px] text-gray-700 space-y-1 leading-relaxed">
                  <li>Acesse o painel do seu projeto no <strong>Supabase</strong>.</li>
                  <li>No menu lateral esquerdo, clique no ícone <strong>SQL Editor</strong>.</li>
                  <li>Clique em <strong>&quot;New Query&quot;</strong>, cole o script abaixo e clique no botão <strong>&quot;Run&quot;</strong>.</li>
                  <li>Volte na aba <strong>&quot;Conexão & Nuvem&quot;</strong>, clique em <strong>&quot;Testar Conexão&quot;</strong> e sincronize!</li>
                </ol>
              </div>

              {/* Copy SQL Button */}
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs text-gray-800">
                  Script DDL Completo (PostgreSQL / Supabase):
                </span>
                <button
                  type="button"
                  onClick={handleCopySQL}
                  className="px-3.5 py-1.5 bg-[#6b1d2f] hover:bg-[#4a121f] text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  {copiedSQL ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Copiado com Sucesso!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Script SQL</span>
                    </>
                  )}
                </button>
              </div>

              {/* Code Box */}
              <div className="relative">
                <pre className="p-4 bg-gray-900 text-gray-100 rounded-2xl text-[10px] font-mono overflow-x-auto max-h-80 border border-gray-800 leading-relaxed selection:bg-[#6b1d2f] selection:text-white">
                  {SUPABASE_SCHEMA_SQL}
                </pre>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: BACKUP LOCAL (JSON)                                                */}
          {/* ========================================================================= */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-1">
                <span className="font-bold text-gray-800 text-xs">
                  Exportação e Restauração de Arquivo Local (.JSON)
                </span>
                <p className="text-[11px] text-gray-600">
                  Você também pode salvar uma cópia offline de segurança de todos os membros, unidades, chamadas e do Projeto Maná em um arquivo JSON no seu computador ou celular.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => exportAllDataAsJSON()}
                  className="p-4 bg-rose-50/60 hover:bg-rose-100/80 border border-rose-200 rounded-2xl flex items-center justify-center gap-2 font-black text-[#6b1d2f] transition-all shadow-xs cursor-pointer active:scale-98"
                  title="Fazer download automático do arquivo JSON de backup"
                >
                  <Download className="w-5 h-5 text-[#6b1d2f]" />
                  <span>Baixar Backup Completo (.JSON)</span>
                </button>

                <label className="p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl flex items-center justify-center gap-2 font-black text-gray-800 transition-all cursor-pointer shadow-xs active:scale-98">
                  <Upload className="w-5 h-5 text-[#6b1d2f]" />
                  <span>Restaurar de Arquivo (.JSON)</span>
                  <input type="file" accept=".json" onChange={onImportJSON} className="hidden" />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <div className="text-[11px] text-gray-500 font-medium">
            {syncConfig.lastSync ? (
              <span>Última sincronização: {new Date(syncConfig.lastSync).toLocaleString('pt-BR')}</span>
            ) : (
              <span>Nenhuma sincronização registrada</span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

