'use client';

import React, { useState } from 'react';
import { loadCustomLogo, saveCustomLogo } from '@/lib/storage';
import {
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  X,
  RotateCcw,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface ChangeLogoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangeLogoModal: React.FC<ChangeLogoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [logoUrl, setLogoUrl] = useState<string>(loadCustomLogo() || '');
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        alert('Por favor, selecione uma imagem de até 3MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setLogoUrl(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (logoUrl.trim()) {
      saveCustomLogo(logoUrl.trim());
      setSuccessMsg('Logo do login e do sistema atualizada com sucesso!');
    } else {
      saveCustomLogo(null);
      setSuccessMsg('Logo restaurada para o padrão oficial.');
    }

    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 1500);
  };

  const handleReset = () => {
    saveCustomLogo(null);
    setLogoUrl('');
    setSuccessMsg('Logo do sistema restaurada para o padrão!');
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-amber-200/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4a000c] via-[#600010] to-[#2e0007] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl border border-white/20">
              <ImageIcon className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <h2 className="text-base font-black">Alterar Foto / Logo do Sistema</h2>
              <p className="text-xs text-rose-100/80 font-medium">
                Personalize o emblema exibido no Login e no Painel
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
        <div className="p-6 space-y-5">
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs text-emerald-900 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Logo Preview */}
          <div className="flex flex-col items-center justify-center space-y-2 bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
              Pré-visualização Atual
            </span>
            <div className="w-20 h-20 rounded-full border-4 border-[#D4AF37] shadow-lg overflow-hidden bg-white flex items-center justify-center relative">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Prévia da Logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-2">
                  <Sparkles className="w-6 h-6 text-[#D4AF37] mx-auto" />
                  <span className="text-[9px] font-black text-gray-600 block mt-1">Logo Oficial</span>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                activeTab === 'upload'
                  ? 'bg-white text-[#600010] shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Enviar Arquivo</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                activeTab === 'url'
                  ? 'bg-white text-[#600010] shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>URL da Imagem</span>
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'upload' ? (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700">
                Escolha uma imagem no seu computador ou celular:
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-4 text-center bg-gray-50 hover:bg-gray-100 transition cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="logo-file-input"
                />
                <label htmlFor="logo-file-input" className="cursor-pointer space-y-1 block">
                  <Upload className="w-6 h-6 text-[#600010] mx-auto" />
                  <span className="text-xs font-extrabold text-gray-800 block">
                    Clique aqui para selecionar a foto/logo
                  </span>
                  <span className="text-[10px] text-gray-500">
                    Formatos aceitos: PNG, JPG, WEBP (Max: 3MB)
                  </span>
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700">
                Link direto da imagem (URL Web):
              </label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://exemplo.com/minha-igreja-logo.png"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#600010] focus:bg-white transition-all"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition flex items-center gap-1"
              title="Restaurar emblema original"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Padrão</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-2.5 bg-[#600010] hover:bg-[#4a000c] text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-md"
            >
              <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
              <span>Salvar Foto do Sistema</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
