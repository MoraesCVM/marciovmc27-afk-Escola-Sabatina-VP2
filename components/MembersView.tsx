'use client';

import React, { useState, useRef } from 'react';
import { Member, MemberStatus, MemberType, ClassUnit, GenderType } from '@/lib/types';
import {
  Search,
  UserPlus,
  Pencil,
  Trash2,
  Filter,
  UserCheck,
  X,
  Check,
  UploadCloud,
  FileSpreadsheet,
  Download,
  Calendar,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface MembersViewProps {
  members: Member[];
  classes: ClassUnit[];
  onAddMember: (member: Omit<Member, 'id' | 'createdAt'>) => void;
  onAddMultipleMembers?: (members: Omit<Member, 'id' | 'createdAt'>[]) => void;
  onUpdateMember: (member: Member) => void;
  onDeleteMember: (id: string) => void;
  onDeleteAllMembers?: () => void;
}

// Helper functions for date conversion and age calculation
function parseAndFormatDate(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  // DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('-');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
}

function displayDateBR(dateStr?: string): string {
  if (!dateStr) return 'Não informada';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
  return dateStr;
}

function calculateAgeFromBirthDate(dateStr?: string): number {
  if (!dateStr) return 0;
  const isoDate = parseAndFormatDate(dateStr);
  if (!isoDate || isoDate.length < 10) return 0;
  const birthYear = parseInt(isoDate.slice(0, 4), 10);
  if (isNaN(birthYear)) return 0;
  const currentYear = new Date().getFullYear();
  return Math.max(0, currentYear - birthYear);
}

export const MembersView: React.FC<MembersViewProps> = ({
  members,
  classes,
  onAddMember,
  onAddMultipleMembers,
  onUpdateMember,
  onDeleteMember,
  onDeleteAllMembers,
}) => {
  const [activeTab, setActiveTab] = useState<MemberType>('Membro');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');

  // Delete Confirmation States
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'manual' | 'csv'>('manual');
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // Simplified Form State
  const [formData, setFormData] = useState<{
    name: string;
    className: string;
    birthDate: string;
    status: MemberStatus;
    isTeacher: boolean;
    gender: GenderType;
  }>({
    name: '',
    className: classes[0]?.name || 'Ebenézer',
    birthDate: '',
    status: 'Ativo',
    isTeacher: false,
    gender: 'Masc',
  });

  // CSV State
  interface CsvMemberItem {
    name: string;
    className: string;
    birthDate: string;
    status: MemberStatus;
    isTeacher: boolean;
    gender: GenderType;
  }

  const [dragActive, setDragActive] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvMemberItem[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSuccessMsg, setCsvSuccessMsg] = useState<string | null>(null);
  const [csvPasteText, setCsvPasteText] = useState('');
  const [csvSubTab, setCsvSubTab] = useState<'file' | 'paste'>('paste');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter members list
  const tabMembers = members.filter((m) => m.type === activeTab);
  const filteredMembers = tabMembers.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.birthDate && displayDateBR(m.birthDate).includes(searchQuery));

    let matchesStatus = true;
    if (statusFilter === 'Professores') {
      matchesStatus = !!m.isTeacher;
    } else if (statusFilter !== 'Todos') {
      matchesStatus = m.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  const totalMembrosCount = members.filter((m) => m.type === 'Membro').length;
  const totalVisitantesCount = members.filter((m) => m.type === 'Visitante').length;
  const totalProfessoresCount = members.filter((m) => m.isTeacher).length;

  const handleOpenAddModal = (mode: 'manual' | 'csv' = 'manual') => {
    setEditingMember(null);
    setModalMode(mode);
    setFormData({
      name: '',
      className: classes[0]?.name || 'Ebenézer',
      birthDate: '',
      status: 'Ativo',
      isTeacher: false,
      gender: 'Masc',
    });
    setCsvPreview([]);
    setCsvPasteText('');
    setCsvError(null);
    setCsvSuccessMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (member: Member) => {
    setEditingMember(member);
    setModalMode('manual');
    setFormData({
      name: member.name,
      className: member.className,
      birthDate: member.birthDate || '',
      status: member.status || 'Ativo',
      isTeacher: !!member.isTeacher,
      gender: member.gender || 'Masc',
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const formattedBirthDate = parseAndFormatDate(formData.birthDate);
    const calculatedAge = calculateAgeFromBirthDate(formattedBirthDate);

    if (editingMember) {
      onUpdateMember({
        ...editingMember,
        name: formData.name.trim(),
        className: formData.className,
        unit: formData.className,
        birthDate: formattedBirthDate,
        status: formData.status,
        isTeacher: formData.isTeacher,
        gender: formData.gender,
        age: calculatedAge || editingMember.age || 0,
      });
    } else {
      onAddMember({
        name: formData.name.trim(),
        className: formData.className,
        unit: formData.className,
        birthDate: formattedBirthDate,
        status: formData.status || 'Ativo',
        type: activeTab,
        isTeacher: formData.isTeacher,
        age: calculatedAge,
        gender: formData.gender,
        phone: '',
        email: '',
        address: '',
        notes: '',
      });
    }

    setIsModalOpen(false);
  };

  // CSV / Text File Handler
  const parseCSVText = (text: string) => {
    setCsvError(null);
    setCsvSuccessMsg(null);

    if (!text || !text.trim()) {
      setCsvError('O conteúdo digitado ou arquivo está vazio.');
      return;
    }

    // Handle all line break formats (\r\n, \r, \n)
    const lines = text
      .split(/\r?\n|\r/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      setCsvError('Nenhuma linha válida encontrada no texto/arquivo.');
      return;
    }

    // Determine delimiter across sample lines
    const counts = { ';': 0, ',': 0, '\t': 0, '|': 0 };
    lines.slice(0, 30).forEach((line) => {
      ([';', ',', '\t', '|'] as const).forEach((d) => {
        const matches = line.split(d).length - 1;
        counts[d] += matches;
      });
    });

    let delimiter = ';';
    let maxMatches = -1;
    (([';', ',', '\t', '|'] as const)).forEach((d) => {
      if (counts[d] > maxMatches && counts[d] > 0) {
        maxMatches = counts[d];
        delimiter = d;
      }
    });

    const rows = lines.map((line) =>
      line.split(delimiter).map((cell) => cell.replace(/^["']|["']$/g, '').trim())
    );

    let startIndex = 0;
    const firstRowLower = rows[0].map((c) => c.toLowerCase());
    const isHeader =
      firstRowLower.some((c) => c.includes('nome') || c.includes('membro')) ||
      firstRowLower.some((c) => c.includes('classe') || c.includes('escola')) ||
      firstRowLower.some((c) => c.includes('nasc') || c.includes('data')) ||
      firstRowLower.some((c) => c.includes('situa') || c.includes('status') || c.includes('cadastr')) ||
      firstRowLower.some((c) => c.includes('prof') || c.includes('teacher')) ||
      firstRowLower.some((c) => c.includes('sexo') || c.includes('genero') || c.includes('gênero') || c.includes('sex'));

    let nameIdx = 0;
    let classIdx = 1;
    let birthIdx = 2;
    let statusIdx = 3;
    let teacherIdx = 4;
    let genderIdx = 5;

    if (isHeader) {
      startIndex = 1;
      firstRowLower.forEach((col, idx) => {
        if (col.includes('nome') || col.includes('membro') || col.includes('completo')) nameIdx = idx;
        else if (col.includes('classe') || col.includes('escola')) classIdx = idx;
        else if (col.includes('nasc') || col.includes('data')) birthIdx = idx;
        else if (col.includes('situa') || col.includes('status') || col.includes('cadastr')) statusIdx = idx;
        else if (col.includes('prof') || col.includes('teacher')) teacherIdx = idx;
        else if (col.includes('sexo') || col.includes('genero') || col.includes('gênero') || col.includes('sex')) genderIdx = idx;
      });
    }

    const parsed: CsvMemberItem[] = [];

    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const name = (row.length === 1 ? row[0] : row[nameIdx] || row[0]) || '';
      if (!name.trim() || name.trim().toLowerCase().startsWith('nome')) continue;

      const rawClass = row.length > 1 ? row[classIdx] || '' : '';
      const rawBirthDate = row.length > 2 ? row[birthIdx] || '' : '';
      const rawStatus = row.length > 3 ? row[statusIdx] || '' : '';
      const rawTeacher = row.length > 4 ? row[teacherIdx] || '' : '';
      const rawGender = row.length > 5 ? row[genderIdx] || '' : '';

      const matchedClass =
        classes.find(
          (c) => c.name.toLowerCase().trim() === rawClass.toLowerCase().trim()
        )?.name ||
        rawClass ||
        classes[0]?.name ||
        'Ebenézer';

      const formattedBirth = parseAndFormatDate(rawBirthDate);

      let parsedStatus: MemberStatus = 'Ativo';
      const sLower = rawStatus.toLowerCase();
      if (sLower.includes('inativ')) parsedStatus = 'Inativo';
      else if (sLower.includes('visit')) parsedStatus = 'Visitante';
      else if (sLower.includes('afast')) parsedStatus = 'Afastado';

      const isTeacher =
        rawTeacher.toLowerCase().includes('sim') ||
        rawTeacher.toLowerCase().includes('true') ||
        rawTeacher.toLowerCase().includes('prof') ||
        rawTeacher === '1' ||
        rawTeacher.toLowerCase() === 's';

      let gender: GenderType = 'Masc';
      const gLower = rawGender.toLowerCase().trim();
      if (gLower.startsWith('f') || gLower.includes('fem') || gLower.includes('mulher')) {
        gender = 'Fem';
      }

      parsed.push({
        name: name.trim(),
        className: matchedClass,
        birthDate: formattedBirth,
        status: parsedStatus,
        isTeacher,
        gender,
      });
    }

    if (parsed.length === 0) {
      setCsvError('Nenhum registro válido foi encontrado.');
      return;
    }

    setCsvPreview(parsed);
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        parseCSVText(content);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleImportCsvConfirm = () => {
    if (csvPreview.length === 0) return;

    const newMemberList = csvPreview.map((item) => ({
      name: item.name,
      className: item.className,
      birthDate: item.birthDate,
      status: item.status || 'Ativo',
      isTeacher: item.isTeacher,
      type: item.status === 'Visitante' ? 'Visitante' : activeTab,
      unit: item.className,
      age: calculateAgeFromBirthDate(item.birthDate),
      gender: item.gender || 'Masc',
      phone: '',
      email: '',
      address: '',
      notes: 'Importado via CSV',
    }));

    if (onAddMultipleMembers) {
      onAddMultipleMembers(newMemberList);
    } else {
      newMemberList.forEach((m) => onAddMember(m));
    }

    setCsvSuccessMsg(`${newMemberList.length} membro(s) importados com sucesso!`);
    setCsvPreview([]);
    setTimeout(() => {
      setIsModalOpen(false);
    }, 1200);
  };

  const downloadSampleCSV = () => {
    const csvContent =
      'Nome Completo;Classe da Escola Sabatina;Data de Nascimento;Situação Cadastral;É Professor?;Sexo\n' +
      'Adriana Silva;Ebenézer (Adultos);15/08/1992;Ativo;Não;Fem\n' +
      'Pr. Ricardo Santos;Ebenézer (Adultos);22/03/1985;Ativo;Sim;Masc\n' +
      'Lucas Mendes;Bereia (Jovens);05/11/2001;Visitante;Não;Masc\n';
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_importacao_membros.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: MemberStatus) => {
    switch (status) {
      case 'Ativo':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            Ativo
          </span>
        );
      case 'Inativo':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
            Inativo
          </span>
        );
      case 'Visitante':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            Visitante
          </span>
        );
      case 'Afastado':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
            Afastado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Bar with Tabs and Action Buttons */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
        {/* Segmented Tab: [ Membros | Visitantes ] */}
        <div className="inline-flex p-1 bg-[#F5F2ED] rounded-xl border border-gray-200 w-full md:w-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('Membro');
              setStatusFilter('Todos');
            }}
            className={`flex-1 md:flex-none px-5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'Membro'
                ? 'bg-[#600010] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Membros ({totalMembrosCount})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('Visitante');
              setStatusFilter('Todos');
            }}
            className={`flex-1 md:flex-none px-5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'Visitante'
                ? 'bg-[#600010] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Visitantes ({totalVisitantesCount})
          </button>
        </div>

        {/* Action Buttons: Excluir Todos + Importar CSV + Cadastro Manual */}
        <div className="flex flex-wrap items-center gap-2">
          {members.length > 0 && (
            <button
              type="button"
              onClick={() => setIsDeleteAllModalOpen(true)}
              className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs rounded-xl border border-rose-200 flex items-center justify-center gap-1.5 transition-all active:scale-98 shadow-xs cursor-pointer"
              title="Limpar todos os membros cadastrados para importar lista nova"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Excluir Todos ({members.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleOpenAddModal('csv')}
            className="flex-1 md:flex-none px-3.5 py-2.5 bg-white hover:bg-gray-50 text-[#600010] font-bold text-xs rounded-xl border border-[#D4AF37] flex items-center justify-center gap-2 transition-all active:scale-98 shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#D4AF37]" />
            <span>Importar CSV</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddModal('manual')}
            className="flex-1 md:flex-none px-4 py-2.5 bg-[#600010] hover:bg-[#4a000c] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-[#D4AF37]" />
            <span>Novo Cadastro</span>
          </button>
        </div>
      </div>

      {/* 2. Search & Status Filters */}
      <div className="bg-white p-3.5 rounded-2xl border border-gray-200/80 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, classe ou data de nascimento..."
            className="w-full pl-10 pr-4 py-2 bg-[#F5F2ED]/50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#600010] focus:bg-white transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1 mr-1 shrink-0">
            <Filter className="w-3 h-3 text-[#D4AF37]" /> Situação / Função:
          </span>
          {['Todos', 'Ativo', 'Inativo', 'Visitante', 'Afastado', 'Professores'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded-lg font-medium text-xs whitespace-nowrap transition-all ${
                statusFilter === status
                  ? 'bg-[#600010] text-white font-bold shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status === 'Professores' ? `🎓 Professores (${totalProfessoresCount})` : status}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Members List / Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-gray-50/90 border-b border-gray-200 flex items-center justify-between text-xs text-gray-500 font-semibold">
          <span>Exibindo {filteredMembers.length} cadastro(s)</span>
          <span className="hidden sm:inline text-[11px] text-[#600010]">
            Professores e membros sincronizados com o banco de dados
          </span>
        </div>

        {/* Desktop Table Header */}
        <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-2.5 bg-gray-100/70 border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
          <div className="col-span-4">Nome Completo</div>
          <div className="col-span-2">Classe da ES</div>
          <div className="col-span-2">Data de Nascimento</div>
          <div className="col-span-2 text-center">Função</div>
          <div className="col-span-1 text-center">Situação</div>
          <div className="col-span-1 text-right">Ações</div>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredMembers.length === 0 ? (
            <div className="p-10 text-center text-gray-500 space-y-2">
              <UserCheck className="w-10 h-10 text-gray-300 mx-auto" />
              <p className="text-sm font-bold text-gray-700">
                Nenhum {activeTab.toLowerCase()} encontrado.
              </p>
              <p className="text-xs text-gray-400">
                Utilize o botão &quot;Novo Cadastro&quot; ou &quot;Importar CSV&quot; para adicionar registros.
              </p>
            </div>
          ) : (
            filteredMembers.map((member) => (
              <div
                key={member.id}
                className="p-3.5 sm:px-5 hover:bg-[#F5F2ED]/40 transition-colors flex flex-col md:grid md:grid-cols-12 md:gap-3 md:items-center text-xs"
              >
                {/* Column 1: Avatar + Member Name */}
                <div className="col-span-4 flex items-center gap-3 mb-2 md:mb-0">
                  <div className="w-9 h-9 rounded-full bg-[#600010] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs border border-[#D4AF37]/30">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-gray-900 text-sm leading-snug truncate">
                        {member.name}
                      </h4>
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border shrink-0 ${
                          member.gender === 'Fem'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-blue-100 text-blue-800 border-blue-300'
                        }`}
                      >
                        {member.gender === 'Fem' ? 'Fem' : 'Masc'}
                      </span>
                      {member.isTeacher && (
                        <span className="md:hidden bg-amber-100 text-amber-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-amber-300">
                          Professor
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 md:hidden">
                      {member.className} • {displayDateBR(member.birthDate)}
                    </span>
                  </div>
                </div>

                {/* Column 2: Class */}
                <div className="col-span-2 hidden md:flex items-center gap-1.5 text-gray-800 font-medium">
                  <GraduationCap className="w-3.5 h-3.5 text-[#600010]" />
                  <span className="truncate">{member.className}</span>
                </div>

                {/* Column 3: Birth Date */}
                <div className="col-span-2 hidden md:flex items-center gap-1.5 text-gray-700">
                  <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>{displayDateBR(member.birthDate)}</span>
                  {member.birthDate && calculateAgeFromBirthDate(member.birthDate) > 0 && (
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded ml-0.5">
                      ({calculateAgeFromBirthDate(member.birthDate)}a)
                    </span>
                  )}
                </div>

                {/* Column 4: Professor Toggle Badge */}
                <div className="col-span-2 hidden md:flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => onUpdateMember({ ...member, isTeacher: !member.isTeacher })}
                    title="Clique para alternar se o irmão é professor"
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition-all ${
                      member.isTeacher
                        ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                        : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    <GraduationCap className={`w-3 h-3 ${member.isTeacher ? 'text-amber-700' : 'text-gray-400'}`} />
                    <span>{member.isTeacher ? '🎓 Professor' : '👤 Membro'}</span>
                  </button>
                </div>

                {/* Column 5: Status Select */}
                <div className="col-span-1 flex items-center justify-between md:justify-center my-1 md:my-0">
                  <span className="md:hidden text-gray-500 font-medium">Situação:</span>
                  <select
                    value={member.status}
                    onChange={(e) => {
                      onUpdateMember({
                        ...member,
                        status: e.target.value as MemberStatus,
                      });
                    }}
                    title="Clique para alterar a situação"
                    className={`cursor-pointer px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all focus:outline-none focus:ring-2 focus:ring-[#600010] ${
                      member.status === 'Ativo'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                        : member.status === 'Inativo'
                        ? 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
                        : member.status === 'Visitante'
                        ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                        : 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
                    }`}
                  >
                    <option value="Ativo" className="bg-white text-gray-900 font-bold">Ativo</option>
                    <option value="Inativo" className="bg-white text-gray-900 font-bold">Inativo</option>
                    <option value="Visitante" className="bg-white text-gray-900 font-bold">Visitante</option>
                    <option value="Afastado" className="bg-white text-gray-900 font-bold">Afastado</option>
                  </select>
                </div>

                {/* Column 5: Action Icons */}
                <div className="col-span-1 flex items-center justify-end gap-1 mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-0 border-gray-100">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(member)}
                    title="Editar membro"
                    className="p-1.5 text-gray-600 hover:text-[#600010] hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemberToDelete(member)}
                    title="Excluir cadastro"
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. Unified Modal: "Novo Cadastro" / "Importar CSV" */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 max-h-[92vh] overflow-y-auto space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-[#600010]" />
                <h3 className="text-base font-bold text-[#600010]">
                  {editingMember ? 'Editar Cadastro' : 'Cadastro de Membro / CSV'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-mode selector if creating new */}
            {!editingMember && (
              <div className="flex bg-[#F5F2ED] p-1 rounded-xl border border-gray-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setModalMode('manual')}
                  className={`flex-1 py-2 rounded-lg transition-all ${
                    modalMode === 'manual'
                      ? 'bg-[#600010] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Novo Cadastro Manual
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode('csv')}
                  className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    modalMode === 'csv'
                      ? 'bg-[#600010] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Importar via CSV</span>
                </button>
              </div>
            )}

            {/* MANUAL FORM MODE */}
            {modalMode === 'manual' && (
              <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
                {/* Field 1: Full Name */}
                <div>
                  <label className="block font-bold text-gray-800 mb-1">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Maria das Dores Silva"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#600010] focus:bg-white"
                  />
                </div>

                {/* Field 2: Class Selection */}
                <div>
                  <label className="block font-bold text-gray-800 mb-1">
                    Classe da Escola Sabatina
                  </label>
                  <select
                    value={formData.className}
                    onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#600010] focus:bg-white"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} ({c.category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Field 3: Birth Date */}
                <div>
                  <label className="block font-bold text-gray-800 mb-1">
                    Data de Nascimento
                  </label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#600010] focus:bg-white"
                  />
                </div>

                {/* Field 4: Status (Situação Cadastral) */}
                <div>
                  <label className="block font-bold text-gray-800 mb-1">
                    Situação Cadastral
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as MemberStatus })
                    }
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#600010] focus:bg-white"
                  >
                    <option value="Ativo">Ativo (Padrão)</option>
                    <option value="Inativo">Inativo</option>
                    <option value="Visitante">Visitante</option>
                    <option value="Afastado">Afastado</option>
                  </select>
                </div>

                {/* Field 5: Sexo / Gênero */}
                <div>
                  <label className="block font-bold text-gray-800 mb-1">
                    Sexo / Gênero <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) =>
                      setFormData({ ...formData, gender: e.target.value as GenderType })
                    }
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#600010] focus:bg-white"
                  >
                    <option value="Masc">Masculino (Masc)</option>
                    <option value="Fem">Feminino (Fem)</option>
                  </select>
                </div>

                {/* Field 6: Is Teacher (Professor) */}
                <div>
                  <label className="block font-bold text-gray-800 mb-1">
                    É Professor da Escola Sabatina?
                  </label>
                  <select
                    value={formData.isTeacher ? 'sim' : 'nao'}
                    onChange={(e) =>
                      setFormData({ ...formData, isTeacher: e.target.value === 'sim' })
                    }
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#600010] focus:bg-white"
                  >
                    <option value="nao">Não (Apenas Membro)</option>
                    <option value="sim">Sim (Professor Cadastrado)</option>
                  </select>
                </div>

                {/* Modal Action Footer */}
                <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#600010] hover:bg-[#4a000c] text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md"
                  >
                    <Check className="w-4 h-4 text-[#D4AF37]" />
                    <span>{editingMember ? 'Salvar Alterações' : 'Cadastrar Membro'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* CSV IMPORT MODE */}
            {modalMode === 'csv' && (
              <div className="space-y-4 text-xs">
                {/* Sub-tab choice: Paste text vs File upload */}
                <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200 gap-1 font-bold">
                  <button
                    type="button"
                    onClick={() => setCsvSubTab('paste')}
                    className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                      csvSubTab === 'paste'
                        ? 'bg-[#600010] text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Cole o Texto da Lista (100+ Membros)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCsvSubTab('file')}
                    className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                      csvSubTab === 'file'
                        ? 'bg-[#600010] text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Subir Arquivo (.CSV / .TXT)
                  </button>
                </div>

                {csvSubTab === 'paste' ? (
                  <div className="space-y-2">
                    <p className="text-gray-500 text-[11px]">
                      Cole as linhas da sua planilha (Excel / Word / WhatsApp). Suporta lista simples só de nomes ou colunas separadas por ponto e vírgula (;), vírgula (,), tab ou barra (|):
                    </p>
                    <textarea
                      rows={6}
                      value={csvPasteText}
                      onChange={(e) => setCsvPasteText(e.target.value)}
                      placeholder={`Exemplo de linhas a colar:\nJoão Silva;Ebenézer;15/05/1985;Ativo;Não;Masc\nMaria Oliveira;Maranata;20/10/1990;Ativo;Sim;Fem\nCarlos Eduardo;Bereia;10/01/2000;Visitante;Não;Masc`}
                      className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#600010]"
                    />
                    <button
                      type="button"
                      onClick={() => parseCSVText(csvPasteText)}
                      disabled={!csvPasteText.trim()}
                      className="w-full py-2 bg-[#600010] hover:bg-[#4a000c] text-white font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      Processar {csvPasteText.split(/\r?\n|\r/).filter((l) => l.trim()).length || ''} Linhas
                    </button>
                  </div>
                ) : (
                  /* Dotted Drag & Drop Dropzone */
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-2 ${
                      dragActive
                        ? 'border-[#600010] bg-[#600010]/10 scale-102'
                        : 'border-[#D4AF37] bg-[#F5F2ED]/60 hover:bg-[#F5F2ED] hover:border-[#600010]'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".csv, .txt, .tsv, text/csv, application/vnd.ms-excel"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileUpload(e.target.files[0]);
                        }
                      }}
                    />
                    <div className="w-12 h-12 rounded-full bg-[#600010]/10 flex items-center justify-center text-[#600010]">
                      <UploadCloud className="w-6 h-6 text-[#600010]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">Importar Membros via Arquivo</h4>
                      <p className="text-gray-500 text-[11px] mt-1">
                        Arraste e solte o arquivo CSV ou TXT com a lista de membros
                      </p>
                    </div>
                    <span className="inline-block bg-[#600010] text-white px-3 py-1 rounded-lg text-[10px] font-bold shadow-xs">
                      Selecionar Arquivo
                    </span>
                  </div>
                )}

                {/* CSV Format Notice & Download Sample */}
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-amber-900 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-[11px]">
                      <p className="font-bold">Padrão de Colunas do Cadastro (até 6 colunas):</p>
                      <p className="font-mono text-[10px] text-amber-800 mt-0.5">
                        Nome | Classe | Data Nasc. | Situação | É Professor? | Sexo (Masc/Fem)
                      </p>
                      <p className="text-[10px] text-amber-700 mt-1">
                        * Se a linha tiver apenas o Nome, o sistema cadastra automaticamente preenchendo os dados padrão.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={downloadSampleCSV}
                    className="w-full py-1.5 px-3 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-[11px] rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-700" />
                    <span>Baixar Modelo CSV Exemplo (.csv)</span>
                  </button>
                </div>

                {/* CSV Error message */}
                {csvError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium text-[11px] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span>{csvError}</span>
                  </div>
                )}

                {/* CSV Success message */}
                {csvSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold text-[11px] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{csvSuccessMsg}</span>
                  </div>
                )}

                {/* CSV Preview Table */}
                {csvPreview.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-gray-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-800">
                        Membros Prontos para Importação ({csvPreview.length})
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                        {csvPreview.length} registro(s) reconhecido(s)
                      </span>
                    </div>

                    <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-gray-50">
                      {csvPreview.map((item, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-2 flex flex-col gap-1 text-[11px] hover:bg-white transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-gray-900 truncate">
                              {idx + 1}. {item.name}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${
                                  item.gender === 'Fem'
                                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                                    : 'bg-blue-100 text-blue-800 border-blue-300'
                                }`}
                              >
                                {item.gender === 'Fem' ? 'Fem' : 'Masc'}
                              </span>
                              <span
                                className={`text-[9px] font-bold px-2 py-0.2 rounded-full border ${
                                  item.status === 'Ativo'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : item.status === 'Inativo'
                                    ? 'bg-red-100 text-red-800 border-red-300'
                                    : item.status === 'Visitante'
                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                    : 'bg-purple-100 text-purple-800 border-purple-300'
                                }`}
                              >
                                {item.status}
                              </span>
                              {item.isTeacher && (
                                <span className="bg-amber-100 text-amber-900 text-[9px] font-bold px-1.5 py-0.2 rounded border border-amber-300">
                                  🎓 Prof.
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-gray-500 gap-2">
                            <span className="truncate">
                              <strong>Classe:</strong> {item.className}
                            </span>
                            <span>
                              {item.birthDate ? displayDateBR(item.birthDate) : 'S/ Data Nasc.'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setCsvPreview([])}
                        className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-xl font-bold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleImportCsvConfirm}
                        className="px-5 py-1.5 bg-[#600010] hover:bg-[#4a000c] text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md"
                      >
                        <Check className="w-4 h-4 text-[#D4AF37]" />
                        <span>Confirmar Importação de {csvPreview.length} Membro(s)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Single Member Delete Modal */}
      {memberToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Excluir Membro</h3>
              <p className="text-xs text-gray-600 mt-1">
                Tem certeza que deseja excluir o cadastro de <strong>&quot;{memberToDelete.name}&quot;</strong>?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteMember(memberToDelete.id);
                  setMemberToDelete(null);
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

      {/* Delete All Members Modal */}
      {isDeleteAllModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-700 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Excluir Todos os Membros</h3>
              <p className="text-xs text-gray-600 mt-1">
                Atenção: Esta ação removerá <strong>todos os {members.length} cadastros</strong> atualmente gravados no sistema para que você possa importar a lista da sua igreja do zero.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteAllModalOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteAllMembers) {
                    onDeleteAllMembers();
                  }
                  setIsDeleteAllModalOpen(false);
                }}
                className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Excluir Todos</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
