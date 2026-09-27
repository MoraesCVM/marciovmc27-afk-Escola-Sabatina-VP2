'use client';

import React, { useState, useEffect } from 'react';
import {
  CriteriaPointsConfig,
  CriterionItem,
  CriterionColor,
  getMaxPossibleScore,
  normalizeCriteriaConfig,
} from '@/lib/types';
import { DEFAULT_CRITERIA_ITEMS } from '@/lib/data';
import {
  Settings,
  Save,
  RotateCcw,
  X,
  Award,
  CheckCircle2,
  Plus,
  Pencil,
  Trash2,
  Check,
  Clock,
  BookOpen,
  DollarSign,
  Users2,
  Bookmark,
  Heart,
  Star,
  Sparkles,
  Shield,
  Smile,
  Flame,
  Gift,
  HelpCircle,
  Eye,
  EyeOff,
  Cross,
} from 'lucide-react';

interface CriteriaConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: CriteriaPointsConfig;
  onSaveConfig: (newConfig: CriteriaPointsConfig) => void;
}

export const CRITERIA_ICONS = [
  { id: 'check', label: 'Check / Presença', icon: Check },
  { id: 'clock', label: 'Relógio / Pontual', icon: Clock },
  { id: 'book', label: 'Livro / Lição / Bíblia', icon: BookOpen },
  { id: 'dollar', label: 'Cifrão / Oferta', icon: DollarSign },
  { id: 'users', label: 'Pessoas / PG', icon: Users2 },
  { id: 'heart', label: 'Coração / Amor', icon: Heart },
  { id: 'star', label: 'Estrela / Destaque', icon: Star },
  { id: 'sparkles', label: 'Brilho / Especial', icon: Sparkles },
  { id: 'bookmark', label: 'Marcador / Verso', icon: Bookmark },
  { id: 'shield', label: 'Escudo / Fé', icon: Shield },
  { id: 'flame', label: 'Fogo / Espírito', icon: Flame },
  { id: 'gift', label: 'Presente / Ação Social', icon: Gift },
  { id: 'award', label: 'Troféu / Conquista', icon: Award },
];

export const CRITERIA_COLORS: { id: CriterionColor; label: string; bg: string; text: string; border: string }[] = [
  { id: 'emerald', label: 'Esmeralda', bg: 'bg-emerald-600', text: 'text-emerald-700', border: 'border-emerald-500' },
  { id: 'blue', label: 'Azul', bg: 'bg-blue-600', text: 'text-blue-700', border: 'border-blue-500' },
  { id: 'amber', label: 'Âmbar Dourado', bg: 'bg-amber-600', text: 'text-amber-700', border: 'border-amber-500' },
  { id: 'teal', label: 'Verde Petróleo', bg: 'bg-teal-600', text: 'text-teal-700', border: 'border-teal-500' },
  { id: 'purple', label: 'Roxo Real', bg: 'bg-purple-600', text: 'text-purple-700', border: 'border-purple-500' },
  { id: 'rose', label: 'Rosa', bg: 'bg-rose-600', text: 'text-rose-700', border: 'border-rose-500' },
  { id: 'indigo', label: 'Índigo', bg: 'bg-indigo-600', text: 'text-indigo-700', border: 'border-indigo-500' },
  { id: 'orange', label: 'Laranja', bg: 'bg-orange-600', text: 'text-orange-700', border: 'border-orange-500' },
  { id: 'red', label: 'Vermelho', bg: 'bg-red-600', text: 'text-red-700', border: 'border-red-500' },
  { id: 'cyan', label: 'Ciano', bg: 'bg-cyan-600', text: 'text-cyan-700', border: 'border-cyan-500' },
];

export function renderCriterionIcon(iconId?: string, className = 'w-4 h-4') {
  switch (iconId) {
    case 'clock':
      return <Clock className={className} />;
    case 'book':
      return <BookOpen className={className} />;
    case 'dollar':
      return <DollarSign className={className} />;
    case 'users':
      return <Users2 className={className} />;
    case 'heart':
      return <Heart className={className} />;
    case 'star':
      return <Star className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'bookmark':
      return <Bookmark className={className} />;
    case 'shield':
      return <Shield className={className} />;
    case 'flame':
      return <Flame className={className} />;
    case 'gift':
      return <Gift className={className} />;
    case 'award':
      return <Award className={className} />;
    case 'check':
    default:
      return <Check className={className} />;
  }
}

export function getCriterionColorStyles(color?: CriterionColor, active = true) {
  if (!active) {
    return {
      badgeBg: 'bg-gray-100',
      badgeText: 'text-gray-500',
      btnActive: 'bg-gray-100 text-gray-500 border-gray-300',
    };
  }
  switch (color) {
    case 'blue':
      return {
        badgeBg: 'bg-blue-100',
        badgeText: 'text-blue-800',
        btnActive: 'bg-blue-600 text-white border-blue-700',
      };
    case 'amber':
      return {
        badgeBg: 'bg-amber-100',
        badgeText: 'text-amber-800',
        btnActive: 'bg-amber-600 text-white border-amber-700',
      };
    case 'teal':
      return {
        badgeBg: 'bg-teal-100',
        badgeText: 'text-teal-800',
        btnActive: 'bg-teal-700 text-white border-teal-800',
      };
    case 'purple':
      return {
        badgeBg: 'bg-purple-100',
        badgeText: 'text-purple-800',
        btnActive: 'bg-purple-600 text-white border-purple-700',
      };
    case 'rose':
      return {
        badgeBg: 'bg-rose-100',
        badgeText: 'text-rose-800',
        btnActive: 'bg-rose-600 text-white border-rose-700',
      };
    case 'indigo':
      return {
        badgeBg: 'bg-indigo-100',
        badgeText: 'text-indigo-800',
        btnActive: 'bg-indigo-600 text-white border-indigo-700',
      };
    case 'orange':
      return {
        badgeBg: 'bg-orange-100',
        badgeText: 'text-orange-800',
        btnActive: 'bg-orange-600 text-white border-orange-700',
      };
    case 'red':
      return {
        badgeBg: 'bg-red-100',
        badgeText: 'text-red-800',
        btnActive: 'bg-red-600 text-white border-red-700',
      };
    case 'cyan':
      return {
        badgeBg: 'bg-cyan-100',
        badgeText: 'text-cyan-800',
        btnActive: 'bg-cyan-600 text-white border-cyan-700',
      };
    case 'emerald':
    default:
      return {
        badgeBg: 'bg-emerald-100',
        badgeText: 'text-emerald-800',
        btnActive: 'bg-emerald-600 text-white border-emerald-700',
      };
  }
}

const TEMPLATE_SUGGESTIONS = [
  {
    name: 'Trouxe a Bíblia',
    description: 'Membro trouxe a Bíblia (impressa ou no celular)',
    points: 20,
    icon: 'book',
    color: 'indigo' as CriterionColor,
  },
  {
    name: 'Visitação Missionária',
    description: 'Realizou ou participou de visitas durante a semana',
    points: 25,
    icon: 'heart',
    color: 'rose' as CriterionColor,
  },
  {
    name: 'Verso de Memória',
    description: 'Recitou o verso bíblico para memorizar da lição',
    points: 15,
    icon: 'bookmark',
    color: 'amber' as CriterionColor,
  },
  {
    name: 'Ação Solidária / Alimento',
    description: 'Apoiou o projeto social ou doação de alimentos da classe',
    points: 20,
    icon: 'gift',
    color: 'teal' as CriterionColor,
  },
  {
    name: 'Ano Bíblico',
    description: 'Leitura diária do plano do Ano Bíblico',
    points: 15,
    icon: 'star',
    color: 'cyan' as CriterionColor,
  },
  {
    name: 'Espírito de Profecia',
    description: 'Leitura dos escritos inspirados de Ellen G. White',
    points: 15,
    icon: 'sparkles',
    color: 'purple' as CriterionColor,
  },
];

interface CriteriaConfigModalContentProps {
  onClose: () => void;
  config: CriteriaPointsConfig;
  onSaveConfig: (newConfig: CriteriaPointsConfig) => void;
}

const CriteriaConfigModalContent: React.FC<CriteriaConfigModalContentProps> = ({
  onClose,
  config,
  onSaveConfig,
}) => {
  const [items, setItems] = useState<CriterionItem[]>(
    () => normalizeCriteriaConfig(config).items
  );
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<CriterionItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newFormData, setNewFormData] = useState<Omit<CriterionItem, 'id'>>({
    name: '',
    description: '',
    points: 20,
    enabled: true,
    isCustom: true,
    icon: 'star',
    color: 'indigo',
  });
  const [isSavedMsg, setIsSavedMsg] = useState(false);

  const currentConfig: CriteriaPointsConfig = {
    ...config,
    items,
  };
  const totalPossible = getMaxPossibleScore(currentConfig);
  const activeCount = items.filter((i) => i.enabled).length;

  const handleToggleEnabled = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item))
    );
  };

  const handleStartEdit = (item: CriterionItem) => {
    setEditingItemId(item.id);
    setEditFormData({ ...item });
    setIsAddingNew(false);
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditFormData(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData || !editingItemId) return;
    if (!editFormData.name.trim()) return;

    setItems((prev) =>
      prev.map((item) => (item.id === editingItemId ? { ...editFormData, name: editFormData.name.trim() } : item))
    );
    setEditingItemId(null);
    setEditFormData(null);
  };

  const handleDeleteItem = (id: string) => {
    const itemToDelete = items.find((i) => i.id === id);
    if (!itemToDelete) return;
    if (itemToDelete.systemKey) {
      // Default system item: disable instead of completely removing
      if (confirm(`Desativar o critério "${itemToDelete.name}" da chamada? Ele não somará pontos.`)) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, enabled: false } : i)));
      }
      return;
    }

    if (confirm(`Tem certeza que deseja excluir o critério "${itemToDelete.name}"?`)) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (editingItemId === id) {
        setEditingItemId(null);
        setEditFormData(null);
      }
    }
  };

  const handleAddNewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFormData.name.trim()) return;

    const newId = `crit_${Date.now()}`;
    const created: CriterionItem = {
      id: newId,
      name: newFormData.name.trim(),
      description: newFormData.description?.trim() || '',
      points: Number(newFormData.points) || 20,
      enabled: true,
      isCustom: true,
      icon: newFormData.icon || 'star',
      color: newFormData.color || 'indigo',
    };

    setItems((prev) => [...prev, created]);
    setNewFormData({
      name: '',
      description: '',
      points: 20,
      enabled: true,
      isCustom: true,
      icon: 'star',
      color: 'indigo',
    });
    setIsAddingNew(false);
  };

  const handleApplyTemplate = (tmpl: typeof TEMPLATE_SUGGESTIONS[0]) => {
    setNewFormData({
      name: tmpl.name,
      description: tmpl.description,
      points: tmpl.points,
      enabled: true,
      isCustom: true,
      icon: tmpl.icon,
      color: tmpl.color,
    });
    setIsAddingNew(true);
  };

  const handleResetDefault = () => {
    if (confirm('Deseja restaurar os 5 critérios oficiais da Escola Sabatina com 20 pontos cada?')) {
      const resetItems: CriterionItem[] = DEFAULT_CRITERIA_ITEMS.map((item) => ({ ...item }));
      setItems(resetItems);
      setEditingItemId(null);
      setEditFormData(null);
      setIsAddingNew(false);
    }
  };

  const handleSubmitAll = (e: React.FormEvent) => {
    e.preventDefault();

    const presenceItem = items.find((i) => i.id === 'presence' || i.systemKey === 'present');
    const punctualityItem = items.find((i) => i.id === 'punctuality' || i.systemKey === 'punctual');
    const lessonItem = items.find((i) => i.id === 'lesson' || i.systemKey === 'studiedLesson');
    const offeringItem = items.find((i) => i.id === 'offering' || i.systemKey === 'broughtOffering');
    const pgItem = items.find((i) => i.id === 'pg' || i.systemKey === 'attendedPG');

    const updatedConfig: CriteriaPointsConfig = {
      presencePoints: presenceItem && presenceItem.enabled ? presenceItem.points : 0,
      punctualityPoints: punctualityItem && punctualityItem.enabled ? punctualityItem.points : 0,
      lessonPoints: lessonItem && lessonItem.enabled ? lessonItem.points : 0,
      offeringPoints: offeringItem && offeringItem.enabled ? offeringItem.points : 0,
      pgPoints: pgItem && pgItem.enabled ? pgItem.points : 0,
      items,
    };

    onSaveConfig(updatedConfig);
    setIsSavedMsg(true);
    setTimeout(() => {
      setIsSavedMsg(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-[#D4AF37]/30 shadow-2xl overflow-hidden my-4 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#600010] p-4 sm:p-5 text-white flex items-center justify-between border-b border-[#D4AF37]/30 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#D4AF37]/20 rounded-2xl text-[#D4AF37]">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg sm:text-xl leading-tight">
                Gerenciar Critérios da Chamada
              </h3>
              <p className="text-xs text-[#D4AF37]/90 font-sans">
                Edite nomes, pontuações, ative/desative ou adicione novos critérios à chamada
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* Status Bar */}
          <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl text-xs flex flex-wrap items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center space-x-2 text-amber-950 font-medium">
              <Award className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>{activeCount}</strong> de {items.length} critérios ativos na chamada semanal
              </span>
            </div>
            <div className="flex items-center space-x-1.5 bg-[#600010] text-[#D4AF37] px-3.5 py-1 rounded-full text-xs font-black shadow-xs">
              <span>{totalPossible} PONTOS MÁXIMOS</span>
            </div>
          </div>

          {/* Edit Form Modal/Drawer if editing an item */}
          {editingItemId && editFormData && (
            <div className="bg-amber-50/70 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                <div className="flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-amber-800" />
                  <h4 className="font-bold text-sm text-gray-900">
                    Editar Critério: <span className="text-[#600010]">{editFormData.name}</span>
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Nome do Critério *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl font-medium text-gray-900 text-sm focus:ring-2 focus:ring-[#600010] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Pontos por Membro *</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="500"
                        required
                        value={editFormData.points}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            points: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-24 px-3 py-2 bg-white border border-gray-300 rounded-xl font-bold text-center text-gray-900 text-sm focus:ring-2 focus:ring-[#600010] focus:outline-none"
                      />
                      <span className="font-bold text-gray-500">pontos</span>
                      <div className="flex gap-1">
                        {[10, 20, 25].map((pts) => (
                          <button
                            key={pts}
                            type="button"
                            onClick={() => setEditFormData({ ...editFormData, points: pts })}
                            className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-[11px] font-bold text-gray-700 cursor-pointer"
                          >
                            {pts}p
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Descrição / Instrução</label>
                  <input
                    type="text"
                    value={editFormData.description || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    placeholder="Instrução para os professores da classe"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-gray-800 text-xs focus:ring-2 focus:ring-[#600010] focus:outline-none"
                  />
                </div>

                {/* Color and Icon Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Cor do Botão e Destaque</label>
                    <div className="flex flex-wrap gap-1.5">
                      {CRITERIA_COLORS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setEditFormData({ ...editFormData, color: c.id })}
                          className={`w-6 h-6 rounded-full ${c.bg} transition-all ${
                            editFormData.color === c.id
                              ? 'ring-2 ring-offset-2 ring-gray-900 scale-110'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Ícone</label>
                    <div className="flex flex-wrap gap-1.5">
                      {CRITERIA_ICONS.map((ic) => {
                        const IconComp = ic.icon;
                        const isSelected = editFormData.icon === ic.id;
                        return (
                          <button
                            key={ic.id}
                            type="button"
                            onClick={() => setEditFormData({ ...editFormData, icon: ic.id })}
                            className={`p-1.5 rounded-lg border text-xs flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-[#600010] text-white border-[#600010] shadow-xs'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                            title={ic.label}
                          >
                            <IconComp className="w-3.5 h-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-3.5 py-1.5 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#600010] hover:bg-[#4a000c] text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Concluir Edição</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Form to Add New Criteria */}
          {isAddingNew && !editingItemId && (
            <div className="bg-indigo-50/70 border-2 border-indigo-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                <div className="flex items-center gap-2 text-indigo-950">
                  <Plus className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-bold text-sm">Adicionar Novo Critério à Chamada</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Template quick pills */}
              <div>
                <span className="text-[11px] font-bold text-indigo-900 block mb-1.5">
                  Sugestões Rápidas de Critérios Adventistas:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_SUGGESTIONS.map((sug) => (
                    <button
                      key={sug.name}
                      type="button"
                      onClick={() => handleApplyTemplate(sug)}
                      className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <span>{sug.name}</span>
                      <span className="text-[10px] text-indigo-600 font-bold">+{sug.points}p</span>
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleAddNewSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Nome do Critério *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Trouxe a Bíblia, Visita Missionária, etc."
                      value={newFormData.name}
                      onChange={(e) => setNewFormData({ ...newFormData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl font-medium text-gray-900 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Pontos por Membro *</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="500"
                        required
                        value={newFormData.points}
                        onChange={(e) =>
                          setNewFormData({
                            ...newFormData,
                            points: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-24 px-3 py-2 bg-white border border-gray-300 rounded-xl font-bold text-center text-gray-900 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                      />
                      <span className="font-bold text-gray-500">pontos</span>
                      <div className="flex gap-1">
                        {[10, 15, 20, 25].map((pts) => (
                          <button
                            key={pts}
                            type="button"
                            onClick={() => setNewFormData({ ...newFormData, points: pts })}
                            className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-[11px] font-bold text-gray-700 cursor-pointer"
                          >
                            {pts}p
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Descrição / Instrução</label>
                  <input
                    type="text"
                    placeholder="Ex: Pontos concedidos ao membro que trouxe a Bíblia para a classe"
                    value={newFormData.description || ''}
                    onChange={(e) => setNewFormData({ ...newFormData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-gray-800 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>

                {/* Color & Icon Pickers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Cor do Botão e Destaque</label>
                    <div className="flex flex-wrap gap-1.5">
                      {CRITERIA_COLORS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setNewFormData({ ...newFormData, color: c.id })}
                          className={`w-6 h-6 rounded-full ${c.bg} transition-all ${
                            newFormData.color === c.id
                              ? 'ring-2 ring-offset-2 ring-indigo-900 scale-110'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Ícone</label>
                    <div className="flex flex-wrap gap-1.5">
                      {CRITERIA_ICONS.map((ic) => {
                        const IconComp = ic.icon;
                        const isSelected = newFormData.icon === ic.id;
                        return (
                          <button
                            key={ic.id}
                            type="button"
                            onClick={() => setNewFormData({ ...newFormData, icon: ic.id })}
                            className={`p-1.5 rounded-lg border text-xs flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                            title={ic.label}
                          >
                            <IconComp className="w-3.5 h-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-indigo-100">
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(false)}
                    className="px-3.5 py-1.5 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar à Chamada</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Criteria List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Critérios Cadastrados ({items.length})
              </span>
              {!isAddingNew && (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(true);
                    setEditingItemId(null);
                  }}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Adicionar Novo Critério</span>
                </button>
              )}
            </div>

            {items.map((criterion, index) => {
              const styles = getCriterionColorStyles(criterion.color, criterion.enabled);

              return (
                <div
                  key={criterion.id}
                  className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    criterion.enabled
                      ? 'bg-white border-gray-200 hover:border-gray-300 shadow-2xs'
                      : 'bg-gray-50/80 border-gray-200/60 opacity-60'
                  }`}
                >
                  {/* Left: Icon, Number, Title & Description */}
                  <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        criterion.enabled
                          ? `${styles.badgeBg} ${styles.badgeText} border-black/5 shadow-2xs`
                          : 'bg-gray-200 text-gray-400 border-gray-300'
                      }`}
                    >
                      {renderCriterionIcon(criterion.icon, 'w-4 h-4')}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
                        <h5 className="font-bold text-sm text-gray-900 truncate">
                          {criterion.name}
                        </h5>
                        {criterion.isCustom && (
                          <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-1.5 py-0.2 rounded border border-purple-200">
                            Personalizado
                          </span>
                        )}
                        {!criterion.enabled && (
                          <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-0.2 rounded">
                            Desativado
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">
                        {criterion.description || 'Critério da chamada semanal'}
                      </p>
                    </div>
                  </div>

                  {/* Right: Points & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                    {/* Points Input */}
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        min="0"
                        max="500"
                        value={criterion.points}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setItems((prev) =>
                            prev.map((i) => (i.id === criterion.id ? { ...i, points: val } : i))
                          );
                        }}
                        className={`w-16 px-2 py-1 bg-white border rounded-xl font-bold text-center text-xs focus:ring-2 focus:ring-[#600010] focus:outline-none ${
                          criterion.enabled
                            ? 'border-gray-300 text-gray-900'
                            : 'border-gray-200 text-gray-400'
                        }`}
                      />
                      <span className="text-[11px] font-bold text-gray-500">pts</span>
                    </div>

                    {/* Enable/Disable Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleEnabled(criterion.id)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        criterion.enabled
                          ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                      }`}
                      title={criterion.enabled ? 'Clique para desativar' : 'Clique para ativar'}
                    >
                      {criterion.enabled ? (
                        <>
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Ativo</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-gray-400" />
                          <span>Pausado</span>
                        </>
                      )}
                    </button>

                    {/* Edit Details */}
                    <button
                      type="button"
                      onClick={() => handleStartEdit(criterion)}
                      className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-gray-200"
                      title="Editar nome, descrição, cor e ícone"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    {/* Delete (if custom or allow disabling) */}
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(criterion.id)}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-red-200"
                      title={criterion.isCustom ? 'Excluir critério personalizado' : 'Desativar critério'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleResetDefault}
            className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 border border-gray-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
            <span>Restaurar 5 Padrões Oficiais (20 pts)</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSubmitAll}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-[#600010] hover:bg-[#4a000c] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 cursor-pointer"
            >
              {isSavedMsg ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isSavedMsg ? 'Critérios Atualizados!' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CriteriaConfigModal: React.FC<CriteriaConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  if (!isOpen) return null;
  return (
    <CriteriaConfigModalContent
      onClose={onClose}
      config={config}
      onSaveConfig={onSaveConfig}
    />
  );
};
