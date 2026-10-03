'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { SabbathDate } from '@/lib/types';
import { SABBATHS_2026, AVAILABLE_YEARS } from '@/lib/data';
import { Calendar, FileUp, CheckCircle2, Search, RotateCcw, AlertTriangle, Edit3, Save, X, FileText, Sparkles, Gift, User, Building2 } from 'lucide-react';

const isGarbage = (text: string) => {
  if (!text) return false;
  return /[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(text) || text.includes('%PDF-');
};

const sanitizeText = (str: string) => {
  if (!str) return '';
  return str.replace(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '').trim();
};

interface CalendarViewProps {
  sabbaths: SabbathDate[];
  selectedQuarter?: number;
  selectedYear?: number;
  onSelectQuarter?: (q: number) => void;
  onSelectYear?: (y: number) => void;
  onUpdateSabbaths: (newSabbaths: SabbathDate[]) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  sabbaths,
  selectedQuarter: propSelectedQuarter,
  selectedYear = 2026,
  onSelectQuarter,
  onSelectYear,
  onUpdateSabbaths,
}) => {
  const [internalQuarter, setInternalQuarter] = useState<1 | 2 | 3 | 4>(1);
  const activeQuarter = (propSelectedQuarter as 1 | 2 | 3 | 4) || internalQuarter;

  const handleQuarterChange = (q: 1 | 2 | 3 | 4) => {
    setInternalQuarter(q);
    if (onSelectQuarter) {
      onSelectQuarter(q);
    }
  };

  const [searchFilter, setSearchFilter] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importedStatus, setImportedStatus] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Editing single sabbath scale
  const [editingSabbath, setEditingSabbath] = useState<SabbathDate | null>(null);

  const quarterSabbaths = sabbaths.filter(
    (s) =>
      s.quarter === activeQuarter &&
      ((s.department && s.department.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (s.directorName && s.directorName.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (s.notes && s.notes.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (s.specialEvent && s.specialEvent.toLowerCase().includes(searchFilter.toLowerCase())))
  );

  const hasCorruptedData = sabbaths.some(
    (s) => isGarbage(s.department) || isGarbage(s.directorName)
  );

  const handleResetDefaultCalendar = () => {
    onUpdateSabbaths(SABBATHS_2026);
    setImportedStatus('Escala Oficial de 2026 restaurada com sucesso!');
  };

  // PDF / Text / Excel / CSV Table Calendar Import logic for Annual or Quarterly Sheets
  const [pasteText, setPasteText] = useState('');
  const [importMode, setImportMode] = useState<'file' | 'text'>('text');

  const processImportText = (rawText: string) => {
    setIsProcessing(true);
    setImportedStatus(null);

    if (isGarbage(rawText)) {
      setImportedStatus(
        'Aviso: O texto ou arquivo contém código binário de PDF. Abra o PDF, copie (Ctrl+C) as linhas da tabela e cole na aba "Cole a Tabela".'
      );
      setIsProcessing(false);
      return;
    }

    try {
      const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length === 0) {
        setImportedStatus('Texto vazio. Por favor insira as linhas da tabela.');
        setIsProcessing(false);
        return;
      }

      // Dictionary of month text and number aliases
      const monthMap: Record<string, string> = {
        jan: '01', janeiro: '01',
        fev: '02', fevereiro: '02',
        mar: '03', marco: '03', março: '03',
        abr: '04', abril: '04',
        mai: '05', maio: '05',
        jun: '06', junho: '06',
        jul: '07', julho: '07',
        ago: '08', agosto: '08',
        set: '09', setembro: '09',
        out: '10', outubro: '10',
        nov: '11', novembro: '11',
        dez: '12', dezembro: '12',
      };

      const findMonthNumFromText = (str: string): string => {
        const s = str.toLowerCase();
        for (const [key, val] of Object.entries(monthMap)) {
          if (s.includes(key)) return val;
        }
        return '';
      };

      const matchedUpdates = new Map<number, { dept: string; dir: string }>();
      const affectedQuartersSet = new Set<number>();

      lines.forEach((line) => {
        const lineLower = line.toLowerCase();
        // Skip table headers or sheet markers
        if (
          ((lineLower.includes('mês') || lineLower.includes('mes')) &&
            lineLower.includes('dia') &&
            lineLower.includes('departamento')) ||
          lineLower.startsWith('---')
        ) {
          return;
        }

        let parsedDay: number | null = null;
        let parsedMonthNum = '';

        // 1. Try extracting date string pattern DD/MM/YYYY or DD/MM or DD-MM-YYYY or DD.MM.YYYY
        const dateRegex = /(\d{1,2})[\/\-\.](\d{1,2}|[a-zA-Zçáéíóúâêôãõ]+)(?:[\/\-\.]\d{2,4})?/;
        const dateMatch = line.match(dateRegex);

        if (dateMatch) {
          const rawD = dateMatch[1];
          const rawM = dateMatch[2].toLowerCase();
          parsedDay = parseInt(rawD, 10);

          if (/^\d+$/.test(rawM)) {
            const mInt = parseInt(rawM, 10);
            if (mInt >= 1 && mInt <= 12) {
              parsedMonthNum = mInt.toString().padStart(2, '0');
            }
          } else {
            parsedMonthNum = findMonthNumFromText(rawM);
          }
        }

        // Split line by separators (pipe |, tab \t, semicolon ;, or comma/spaces)
        let parts = line.split(/[|\t;]/).map((p) => p.trim());
        if (parts.length < 2) {
          parts = line.split(/,|\s{2,}/).map((p) => p.trim());
        }

        // 2. If date was not found by regex, parse columns
        if (!parsedDay || !parsedMonthNum) {
          let foundMonthIdx = -1;
          let foundDayIdx = -1;

          parts.forEach((p, idx) => {
            const pLower = p.toLowerCase();
            const mVal = findMonthNumFromText(pLower);

            if (mVal && foundMonthIdx === -1) {
              parsedMonthNum = mVal;
              foundMonthIdx = idx;
            }

            const cleanDigits = p.replace(/\D/g, '');
            if (cleanDigits && foundDayIdx === -1) {
              const dNum = parseInt(cleanDigits, 10);
              if (dNum >= 1 && dNum <= 31 && idx !== foundMonthIdx) {
                parsedDay = dNum;
                foundDayIdx = idx;
              }
            }
          });
        }

        // 3. Extract Department and Director from remaining text parts
        const textParts = parts.filter((p) => {
          const cleanP = p.trim();
          if (!cleanP) return false;
          const pLow = cleanP.toLowerCase();
          if (pLow === 'mês' || pLow === 'mes' || pLow === 'dia' || pLow === 'sábado' || pLow === 'sabado') return false;
          if (dateMatch && p.includes(dateMatch[0])) return false;
          if (parsedDay && (cleanP === String(parsedDay) || cleanP === String(parsedDay).padStart(2, '0'))) return false;
          if (parsedMonthNum && findMonthNumFromText(pLow)) return false;
          return true;
        });

        let rawDept = '';
        let rawDir = '';

        if (textParts.length >= 2) {
          rawDept = sanitizeText(textParts[0]);
          rawDir = sanitizeText(textParts[1]);
        } else if (textParts.length === 1) {
          const single = sanitizeText(textParts[0]);
          if (single.includes('-')) {
            const [d, dr] = single.split('-').map((s) => s.trim());
            rawDept = d;
            rawDir = dr || '';
          } else if (single.includes(':')) {
            const [d, dr] = single.split(':').map((s) => s.trim());
            rawDept = d;
            rawDir = dr || '';
          } else {
            rawDept = single;
          }
        }

        // 4. Match against sabbaths array
        let matchedIdx = -1;

        if (parsedDay && parsedMonthNum) {
          // Exact date match anywhere in the year (Jan-Dec)
          matchedIdx = sabbaths.findIndex((s) => {
            const [, sMonth, sDay] = s.date.split('-');
            return parseInt(sDay, 10) === parsedDay && sMonth === parsedMonthNum;
          });
        }

        // Fallback match by day number within activeQuarter if no month was specified
        if (matchedIdx === -1 && parsedDay && !parsedMonthNum) {
          matchedIdx = sabbaths.findIndex(
            (s) => s.quarter === activeQuarter && parseInt(s.date.split('-')[2], 10) === parsedDay
          );
        }

        if (matchedIdx !== -1 && (rawDept || rawDir)) {
          matchedUpdates.set(matchedIdx, { dept: rawDept, dir: rawDir });
          affectedQuartersSet.add(sabbaths[matchedIdx].quarter);
        }
      });

      if (matchedUpdates.size > 0) {
        // SOBRESCRITA TOTAL:
        // Limpar completamente os trimestres afetados antes de aplicar os novos dados da escala
        let updatedSabbaths = sabbaths.map((s) => {
          if (affectedQuartersSet.has(s.quarter)) {
            return {
              ...s,
              department: '',
              directorName: '',
            };
          }
          return s;
        });

        // Aplicar novos lançamentos importados
        matchedUpdates.forEach((val, idx) => {
          updatedSabbaths[idx] = {
            ...updatedSabbaths[idx],
            department: val.dept,
            directorName: val.dir,
          };
        });

        onUpdateSabbaths(updatedSabbaths);

        const qList = Array.from(affectedQuartersSet).sort((a, b) => a - b);
        const qNames = qList.map((q) => `${q}º Trimestre`).join(', ');

        setImportedStatus(
          `Sucesso! Sobrescrita total realizada: ${matchedUpdates.size} sábados atualizados no(s) ${qNames}.`
        );
      } else {
        setImportedStatus(
          'Aviso: Nenhuma linha correspondeu aos sábados. Verifique se as linhas do arquivo ou texto contêm datas e colunas no formato [Mês/Data | Departamento | Diretor].'
        );
      }
    } catch (err) {
      setImportedStatus('Erro ao processar a tabela. Verifique o formato do arquivo ou do texto digitado.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setImportedStatus(null);

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.pdf')) {
      setIsProcessing(false);
      setImportedStatus(
        'Aviso: Arquivos .pdf contêm estrutura binária. Para importar a escala do PDF: abra o PDF, copie (Ctrl+C) o texto da tabela e cole na aba "Cole a Tabela".'
      );
      return;
    }

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          let combinedText = '';
          workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const sheetCsv = XLSX.utils.sheet_to_csv(worksheet);
            combinedText += `\n--- SHEET: ${sheetName} ---\n` + sheetCsv;
          });
          processImportText(combinedText);
        } catch (err) {
          setIsProcessing(false);
          setImportedStatus('Erro ao ler a planilha Excel/CSV. Verifique se o arquivo está corrompido.');
        }
      };
      reader.onerror = () => {
        setIsProcessing(false);
        setImportedStatus('Não foi possível ler o arquivo selecionado.');
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    // Default plain text reader (.txt, .json, etc)
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      processImportText(content);
    };
    reader.onerror = () => {
      setIsProcessing(false);
      setImportedStatus('Não foi possível ler o arquivo enviado.');
    };
    reader.readAsText(file);
  };

  const handleSaveSabbathEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSabbath) return;

    const updated = sabbaths.map((s) => (s.date === editingSabbath.date ? editingSabbath : s));
    onUpdateSabbaths(updated);
    setEditingSabbath(null);
  };

  return (
    <div className="space-y-4">
      {/* Corrupted Data Banner */}
      {hasCorruptedData && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-amber-900">Foram detectados caracteres corrompidos da importação do PDF</h4>
              <p className="text-xs text-amber-700 mt-0.5">Clique no botão ao lado para limpar os dados corrompidos e restaurar a escala oficial de 2026.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetDefaultCalendar}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shrink-0 transition-all cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restaurar Escala Padrão 2026</span>
          </button>
        </div>
      )}

      {/* 1. Header with Quarter Selector & PDF Import button */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#6b1d2f]" />
            Calendário Informativo da Escola Sabatina {selectedYear}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Escala Trimestral ({selectedYear}): Departamento responsável, Diretor(a) encarregado(a) e Programação de cada Sábado.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaultCalendar}
            className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-gray-200"
            title="Restaurar a escala oficial de fábrica para todos os sábados"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-600" />
            <span>Restaurar Padrão</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="px-4 py-2.5 bg-[#6b1d2f] hover:bg-[#4a121f] text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <FileUp className="w-4 h-4" />
            <span>Importar Folha</span>
          </button>
        </div>
      </div>

      {/* 2. Quarter Tabs & Search */}
      <div className="bg-white p-3.5 rounded-2xl border border-gray-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Year Select Buttons */}
            <div className="inline-flex p-1 bg-gray-100 rounded-xl border border-gray-200">
              <select
                value={selectedYear}
                onChange={(e) => onSelectYear?.(parseInt(e.target.value))}
                className="bg-[#6b1d2f] text-[#D4AF37] text-xs font-bold px-3 py-1.5 rounded-lg border-0 focus:outline-none cursor-pointer"
              >
                {AVAILABLE_YEARS.map((y) => (
                  <option key={y} value={y} className="bg-white text-gray-900 font-bold">
                    Ano {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Quarter Segmented Buttons */}
            <div className="inline-flex p-1 bg-gray-100 rounded-xl border border-gray-200 flex-1 sm:flex-none">
              {[1, 2, 3, 4].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleQuarterChange(q as 1 | 2 | 3 | 4)}
                  className={`flex-1 sm:flex-none px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeQuarter === q
                      ? 'bg-[#6b1d2f] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {q}º Trim
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Buscar departamento, diretor ou sábado..."
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
            />
          </div>
        </div>
      </div>

      {/* 3. Sabbath Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {quarterSabbaths.map((sabbath) => (
          <div
            key={sabbath.date}
            className={`bg-white rounded-2xl border p-4 shadow-xs transition-all flex flex-col justify-between space-y-3 relative overflow-hidden ${
              sabbath.specialEvent
                ? 'border-amber-300/80 bg-gradient-to-r from-amber-50/20 to-white'
                : 'border-gray-200/80 hover:border-gray-300'
            }`}
          >
            {sabbath.specialEvent && (
              <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-extrabold px-3 py-0.5 rounded-bl-xl shadow-xs flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>{sabbath.specialEvent}</span>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2 pr-16">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-[#6b1d2f] bg-[#f8eeea] px-2.5 py-0.5 rounded-lg border border-[#f0d6cc]">
                    Sábado {sabbath.sabbathNumberInQuarter}
                  </span>
                  <span className="text-xs font-bold text-gray-900">{sabbath.formattedDate}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingSabbath(sabbath)}
                  className="text-gray-400 hover:text-[#6b1d2f] p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  title="Editar escala deste sábado"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Department */}
              <div className="flex items-start gap-2 pt-0.5">
                <Building2 className="w-4 h-4 text-[#6b1d2f] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Departamento Responsável
                  </div>
                  <div className="text-xs font-extrabold text-gray-900">{sabbath.department || 'Não definido'}</div>
                </div>
              </div>

              {/* Director Responsible */}
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Diretor / Responsável da ES
                  </div>
                  <div className="text-xs font-bold text-blue-900">{sabbath.directorName || 'A definir'}</div>
                </div>
              </div>

              {/* Notes / Program */}
              {sabbath.notes && (
                <div className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex items-start gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                  <span className="text-gray-700 font-medium text-[11px] leading-relaxed">{sabbath.notes}</span>
                </div>
              )}
            </div>

            {sabbath.targetOffering && (
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-amber-800 font-medium flex items-center gap-1">
                  <Gift className="w-3.5 h-3.5 text-amber-600" />
                  Meta de Oferta Especial:
                </span>
                <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  R$ {sabbath.targetOffering.toLocaleString('pt-BR')}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit Sabbath Modal */}
      {editingSabbath && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#6b1d2f]" />
                Editar Escala — Sábado {editingSabbath.formattedDate}
              </h3>
              <button
                type="button"
                onClick={() => setEditingSabbath(null)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSabbathEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Departamento Responsável *</label>
                <input
                  type="text"
                  required
                  value={editingSabbath.department || ''}
                  onChange={(e) => setEditingSabbath({ ...editingSabbath, department: e.target.value })}
                  placeholder="Ex: Ministério da Mulher, Jovens, ASA..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Diretor(a) / Responsável do Sábado *</label>
                <input
                  type="text"
                  required
                  value={editingSabbath.directorName || ''}
                  onChange={(e) => setEditingSabbath({ ...editingSabbath, directorName: e.target.value })}
                  placeholder="Ex: Marcos Silva, Prof. Adriana..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Evento Especial / Destaque</label>
                <input
                  type="text"
                  value={editingSabbath.specialEvent || ''}
                  onChange={(e) => setEditingSabbath({ ...editingSabbath, specialEvent: e.target.value })}
                  placeholder="Ex: Dia do Jovem, Batismo, 13º Sábado..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Observações da Programação</label>
                <textarea
                  rows={2}
                  value={editingSabbath.notes || ''}
                  onChange={(e) => setEditingSabbath({ ...editingSabbath, notes: e.target.value })}
                  placeholder="Detalhes sobre louvores, recepção, testemunhos..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSabbath(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#6b1d2f] hover:bg-[#4a121f] text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar Escala</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Importar Calendário (Arquivo Único Anual ou Trimestral) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FileUp className="w-5 h-5 text-[#6b1d2f]" />
                Importar Folha (Ano Completo ou Trimestre)
              </h3>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-gray-600 leading-relaxed">
                Envie um <strong>único arquivo de todo o ano (1º a 4º Trimestre)</strong> ou de um trimestre específico. O sistema alocará automaticamente os sábados nos trimestres correspondentes e efetuará a <strong>sobrescrita total</strong> da escala antiga.
              </p>
              <p className="text-gray-500 text-[11px]">
                Padrão esperado de colunas: <strong>Mês/Data | Dia | Departamento | Diretor</strong>
              </p>

              {/* Mode switch */}
              <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200 gap-1">
                <button
                  type="button"
                  onClick={() => setImportMode('text')}
                  className={`flex-1 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
                    importMode === 'text' ? 'bg-[#6b1d2f] text-white shadow-xs' : 'text-gray-600'
                  }`}
                >
                  Cole a Tabela
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('file')}
                  className={`flex-1 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
                    importMode === 'file' ? 'bg-[#6b1d2f] text-white shadow-xs' : 'text-gray-600'
                  }`}
                >
                  Subir Arquivo (Excel/CSV/TXT)
                </button>
              </div>

              {importMode === 'text' ? (
                <div className="space-y-2">
                  <textarea
                    rows={7}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={`Exemplo de linhas a colar (Ano todo):\nJaneiro | 3 | Escola Sabatina | Bruna Silva\nJaneiro | 10 | Ministério Pessoal | Fernandes Ramos\nAbril | 4 | Jovens | Carlos Santos\nJulho | 4 | Diaconisas | Maria Souza\nOutubro | 3 | Aventureiros | Ana Lima`}
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#6b1d2f] leading-relaxed"
                  />
                  <button
                    type="button"
                    onClick={() => processImportText(pasteText)}
                    disabled={!pasteText.trim() || isProcessing}
                    className="w-full py-2.5 bg-[#6b1d2f] hover:bg-[#4a121f] text-white font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    Processar Tabela e Sobrescrever Escala
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 hover:border-[#6b1d2f] rounded-2xl p-6 text-center cursor-pointer bg-gray-50/50 hover:bg-rose-50/30 transition-all">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload-input"
                  />
                  <label htmlFor="file-upload-input" className="cursor-pointer space-y-2 block">
                    <FileUp className="w-8 h-8 text-[#6b1d2f] mx-auto" />
                    <div className="font-bold text-gray-800 text-sm">Clique para selecionar a folha da escala</div>
                    <div className="text-[11px] text-gray-500">Suporta arquivos Excel (.xlsx, .xls), CSV e TXT (Suporta Ano Completo)</div>
                  </label>
                </div>
              )}

              {isProcessing && (
                <div className="p-3 bg-blue-50 text-blue-800 rounded-xl flex items-center gap-2 font-medium">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span>Processando folha trimestral...</span>
                </div>
              )}

              {importedStatus && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-start gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{importedStatus}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 bg-[#6b1d2f] text-white rounded-xl font-bold text-xs cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
