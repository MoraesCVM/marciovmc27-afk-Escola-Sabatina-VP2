'use client';

import React, { useState } from 'react';
import { ClassUnit, Member } from '@/lib/types';
import { MemberDropdownSelector } from './MemberDropdownSelector';
import { Plus, Pencil, Trash2, Users, GraduationCap, MapPin, Check, X } from 'lucide-react';

interface ClassesViewProps {
  classes: ClassUnit[];
  members: Member[];
  onAddClass: (newClass: Omit<ClassUnit, 'id'>) => void;
  onUpdateClass: (updatedClass: ClassUnit) => void;
  onDeleteClass: (id: string) => void;
}

export const ClassesView: React.FC<ClassesViewProps> = ({
  classes,
  members,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassUnit | null>(null);
  const [classToDelete, setClassToDelete] = useState<ClassUnit | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    category: 'Adultos' as ClassUnit['category'],
    teacher1Id: '',
    teacher1Name: '',
    teacher2Id: '',
    teacher2Name: '',
    room: 'Sala Principal',
  });

  const handleOpenAddModal = () => {
    setEditingClass(null);
    setFormData({
      name: '',
      category: 'Adultos',
      teacher1Id: '',
      teacher1Name: '',
      teacher2Id: '',
      teacher2Name: '',
      room: 'Sala Principal',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cls: ClassUnit) => {
    setEditingClass(cls);
    setFormData({
      name: cls.name,
      category: cls.category,
      teacher1Id: cls.teacher1Id,
      teacher1Name: cls.teacher1Name,
      teacher2Id: cls.teacher2Id || '',
      teacher2Name: cls.teacher2Name || '',
      room: cls.room || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingClass) {
      onUpdateClass({
        ...editingClass,
        ...formData,
      });
    } else {
      onAddClass({
        ...formData,
        memberCount: 15,
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-[#6b1d2f]" />
            Classes & Unidades da Escola Sabatina
          </h2>
          <p className="text-xs text-gray-500">
            Gerencie os professores, salas de aula e divisões dos alunos por faixa etária.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="px-4 py-2 bg-[#6b1d2f] hover:bg-[#4a121f] text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Classe</span>
        </button>
      </div>

      {/* Grid of Class Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {classes.map((cls) => {
          const classMembers = members.filter((m) => m.className === cls.name);
          return (
            <div
              key={cls.id}
              className="bg-white rounded-2xl border border-gray-200/90 shadow-xs p-4 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group"
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-[#6b1d2f]" />

              <div className="pl-1.5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#f7eee9] text-[#6b1d2f]">
                      {cls.category}
                    </span>
                    <h3 className="text-base font-bold text-gray-900 mt-1">{cls.name}</h3>
                  </div>

                  <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(cls)}
                      className="p-1.5 text-gray-400 hover:text-[#6b1d2f] hover:bg-rose-50 rounded-lg transition-colors"
                      title="Editar classe e professores"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setClassToDelete(cls)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Excluir classe"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Teachers Section */}
                <div className="space-y-1.5 bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-gray-500">Professor 1:</span>
                    <span className="font-bold text-gray-900">{cls.teacher1Name || 'Não atribuído'}</span>
                  </div>

                  {cls.teacher2Name && (
                    <div className="flex items-center justify-between border-t border-gray-200/60 pt-1.5">
                      <span className="text-[11px] font-semibold text-gray-500">Professor 2:</span>
                      <span className="font-medium text-gray-800">{cls.teacher2Name}</span>
                    </div>
                  )}
                </div>

                {/* Location & Member count */}
                <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    <span>{cls.room || 'Sala de Aula'}</span>
                  </div>

                  <div className="flex items-center gap-1 font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                    <Users className="w-3.5 h-3.5 text-[#6b1d2f]" />
                    <span>{classMembers.length} alunos</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Editar / Criar Classe */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-[#6b1d2f]" />
                {editingClass ? 'Editar Classe & Professores' : 'Criar Nova Classe'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Nome da Classe *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Ebenézer, Maranata, Bereia..."
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Categoria / Faixa Etária</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
                  >
                    <option value="Adultos">Adultos</option>
                    <option value="Jovens">Jovens</option>
                    <option value="Adolescentes">Adolescentes</option>
                    <option value="Infantil">Infantil</option>
                    <option value="Primários">Primários</option>
                    <option value="Bebês / Róis">Bebês / Róis</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Sala de Aula / Local</label>
                  <input
                    type="text"
                    value={formData.room}
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                    placeholder="Ex: Sala 01, Galeria..."
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
                  />
                </div>
              </div>

              {/* Autocomplete Dropdown Selector for Professor 1 */}
              <div className="space-y-1 bg-amber-50/50 p-3 rounded-xl border border-amber-200/60">
                <MemberDropdownSelector
                  label="Professor 1 Principal"
                  required
                  value={formData.teacher1Name}
                  members={members}
                  placeholder="Digite o nome do professor 1..."
                  onChange={(val, selectedMember) => {
                    setFormData((prev) => ({
                      ...prev,
                      teacher1Name: val,
                      teacher1Id: selectedMember ? selectedMember.id : prev.teacher1Id,
                    }));
                  }}
                />
              </div>

              {/* Autocomplete Dropdown Selector for Professor 2 (Opcional) */}
              <div className="space-y-1 bg-gray-50 p-3 rounded-xl border border-gray-200">
                <MemberDropdownSelector
                  label="Professor 2 (Opcional)"
                  value={formData.teacher2Name}
                  members={members}
                  placeholder="Digite o nome do professor assistente (se houver)..."
                  onChange={(val, selectedMember) => {
                    setFormData((prev) => ({
                      ...prev,
                      teacher2Name: val,
                      teacher2Id: selectedMember ? selectedMember.id : prev.teacher2Id,
                    }));
                  }}
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#6b1d2f] hover:bg-[#4a121f] text-white rounded-xl font-bold flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Classe</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Class Modal */}
      {classToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Excluir Classe</h3>
              <p className="text-xs text-gray-600 mt-1">
                Tem certeza que deseja excluir a classe <strong>&quot;{classToDelete.name}&quot;</strong>?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setClassToDelete(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteClass(classToDelete.id);
                  setClassToDelete(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
