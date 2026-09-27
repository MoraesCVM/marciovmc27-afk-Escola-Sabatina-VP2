'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Member,
  ClassUnit,
  SabbathDate,
  RollCallRecord,
  CriteriaPointsConfig,
  CriterionItem,
  UnitWeeklyData,
  calculateRecordScore,
  getMaxPossibleScore,
  normalizeCriteriaConfig,
  calculateOfferingPoints,
  calculateUnitFinalScore,
} from '@/lib/types';
import {
  CriteriaConfigModal,
  renderCriterionIcon,
  getCriterionColorStyles,
} from '@/components/CriteriaConfigModal';
import {
  Calendar,
  CheckSquare,
  BookOpen,
  Clock,
  DollarSign,
  Save,
  CheckCircle2,
  UserCheck,
  Users,
  Settings,
  Award,
  Users2,
  XCircle,
  Upload,
  FileText,
  FileSpreadsheet,
  Download,
  AlertCircle,
  AlertTriangle,
  X,
  Check,
  Plus,
  Minus,
  Target,
  Sparkles,
  Layers,
  Filter,
} from 'lucide-react';

export interface ParsedRollCallItem extends RollCallRecord {
  quarter: 1 | 2 | 3 | 4;
  sabbathNumberInQuarter: number;
  formattedDisplayDate: string;
  className?: string;
  score: number;
}

interface RollCallViewProps {
  members: Member[];
  classes: ClassUnit[];
  sabbaths: SabbathDate[];
  rollCallRecords: RollCallRecord[];
  unitWeeklyData?: UnitWeeklyData[];
  criteriaConfig: CriteriaPointsConfig;
  selectedQuarter?: number;
  onSaveRollCall: (records: RollCallRecord[]) => void;
  onSaveUnitWeeklyData?: (data: UnitWeeklyData) => void;
  onSaveCriteriaConfig: (newConfig: CriteriaPointsConfig) => void;
}

export const RollCallView: React.FC<RollCallViewProps> = ({
  members,
  classes,
  sabbaths,
  rollCallRecords,
  unitWeeklyData = [],
  criteriaConfig,
  selectedQuarter = 1,
  onSaveRollCall,
  onSaveUnitWeeklyData,
  onSaveCriteriaConfig,
}) => {
  const quarterSabbaths = useMemo(() => sabbaths.filter((s) => s.quarter === selectedQuarter), [sabbaths, selectedQuarter]);
  const displayedSabbaths = useMemo(() => (quarterSabbaths.length > 0 ? quarterSabbaths : sabbaths), [quarterSabbaths, sabbaths]);

  // Default to nearest or first Sabbath of selected quarter
  const [selectedDate, setSelectedDate] = useState<string>(displayedSabbaths[0]?.date || '2026-01-03');
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const normalizedCriteria = useMemo(() => normalizeCriteriaConfig(criteriaConfig), [criteriaConfig]);
  const activeCriteria = useMemo(
    () => normalizedCriteria.items.filter((c) => c.enabled),
    [normalizedCriteria]
  );

  // CSV & Excel Import Modal State
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [csvPreview, setCsvPreview] = useState<ParsedRollCallItem[]>([]);
  const [previewQuarterFilter, setPreviewQuarterFilter] = useState<'all' | 1 | 2 | 3 | 4>('all');
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSuccessMsg, setCsvSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseQuarterValue = (val: any): 1 | 2 | 3 | 4 | null => {
    if (val === null || val === undefined) return null;
    const str = String(val).toLowerCase().trim();
    if (!str) return null;
    if (str === '1' || str === '1º' || str === '1o' || str.includes('1º') || str.includes('1o') || str.includes('primeiro') || str.includes('q1')) return 1;
    if (str === '2' || str === '2º' || str === '2o' || str.includes('2º') || str.includes('2o') || str.includes('segundo') || str.includes('q2')) return 2;
    if (str === '3' || str === '3º' || str === '3o' || str.includes('3º') || str.includes('3o') || str.includes('terceiro') || str.includes('q3')) return 3;
    if (str === '4' || str === '4º' || str === '4o' || str.includes('4º') || str.includes('4o') || str.includes('quarto') || str.includes('q4')) return 4;
    const num = parseInt(str, 10);
    if (num >= 1 && num <= 4) return num as 1 | 2 | 3 | 4;
    return null;
  };

  const parseSabbathNum = (val: any): number | null => {
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    const match = str.match(/\b([1-9]|1[0-3])\b/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n >= 1 && n <= 13) return n;
    }
    return null;
  };

  const parseExcelOrStringDate = (rawDate: any): string => {
    if (!rawDate) return '';
    if (typeof rawDate === 'number') {
      try {
        const dateObj = XLSX.SSF.parse_date_code(rawDate);
        if (dateObj && dateObj.y && dateObj.m && dateObj.d) {
          const y = String(dateObj.y).padStart(4, '0');
          const m = String(dateObj.m).padStart(2, '0');
          const d = String(dateObj.d).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
      } catch {
        // ignore
      }
    }
    const str = String(rawDate).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      let year = match[3];
      if (year.length === 2) year = '20' + year;
      return `${year}-${month}-${day}`;
    }
    return str;
  };

  const resolveSabbathAndQuarter = (
    rawQuarterVal: any,
    rawSabbathNumVal: any,
    rawDateVal: any,
    fallbackDate: string
  ): { sabbathDate: string; quarter: 1 | 2 | 3 | 4; sabbathNumberInQuarter: number } => {
    const parsedQuarter = parseQuarterValue(rawQuarterVal);
    const parsedSabbathNum = parseSabbathNum(rawSabbathNumVal);
    const formattedDate = parseExcelOrStringDate(rawDateVal);

    // 1. If explicit date provided and matches YYYY-MM-DD
    if (formattedDate && /^\d{4}-\d{2}-\d{2}$/.test(formattedDate)) {
      const matchedSabbath = sabbaths.find((s) => s.date === formattedDate);
      if (matchedSabbath) {
        return {
          sabbathDate: matchedSabbath.date,
          quarter: (parsedQuarter || matchedSabbath.quarter) as 1 | 2 | 3 | 4,
          sabbathNumberInQuarter: parsedSabbathNum || matchedSabbath.sabbathNumberInQuarter,
        };
      } else {
        const month = parseInt(formattedDate.split('-')[1], 10);
        let estQuarter: 1 | 2 | 3 | 4 = 1;
        if (month >= 4 && month <= 6) estQuarter = 2;
        else if (month >= 7 && month <= 9) estQuarter = 3;
        else if (month >= 10 && month <= 12) estQuarter = 4;
        return {
          sabbathDate: formattedDate,
          quarter: (parsedQuarter || estQuarter) as 1 | 2 | 3 | 4,
          sabbathNumberInQuarter: parsedSabbathNum || 1,
        };
      }
    }

    // 2. If Quarter and Sabbath Number are given (e.g., Trimestre 1, Sábado 3)
    if (parsedQuarter && parsedSabbathNum) {
      const matchedSabbath = sabbaths.find(
        (s) => s.quarter === parsedQuarter && s.sabbathNumberInQuarter === parsedSabbathNum
      );
      if (matchedSabbath) {
        return {
          sabbathDate: matchedSabbath.date,
          quarter: matchedSabbath.quarter,
          sabbathNumberInQuarter: matchedSabbath.sabbathNumberInQuarter,
        };
      }
    }

    // 3. If only Quarter is given
    if (parsedQuarter) {
      const quarterSabbathsList = sabbaths.filter((s) => s.quarter === parsedQuarter);
      if (quarterSabbathsList.length > 0) {
        const idx =
          parsedSabbathNum && parsedSabbathNum >= 1 && parsedSabbathNum <= quarterSabbathsList.length
            ? parsedSabbathNum - 1
            : 0;
        const targetSabbath = quarterSabbathsList[idx];
        return {
          sabbathDate: targetSabbath.date,
          quarter: targetSabbath.quarter,
          sabbathNumberInQuarter: targetSabbath.sabbathNumberInQuarter,
        };
      }
    }

    // 4. Fallback to currently selected Sabbath
    const currSabbath = sabbaths.find((s) => s.date === fallbackDate) || sabbaths[0];
    return {
      sabbathDate: currSabbath ? currSabbath.date : fallbackDate,
      quarter: currSabbath ? currSabbath.quarter : 1,
      sabbathNumberInQuarter: currSabbath ? currSabbath.sabbathNumberInQuarter : 1,
    };
  };

  const parseBool = (val: string): boolean => {
    if (!val) return false;
    const clean = val.toLowerCase().trim();
    return (
      clean === 'sim' ||
      clean === 's' ||
      clean === '1' ||
      clean === 'true' ||
      clean === 'p' ||
      clean === 'presente' ||
      clean === 'x' ||
      clean === 'v' ||
      clean === 'pontual' ||
      clean === 'estudou' ||
      clean === 'ofertou'
    );
  };

  const parseOffering = (val: string): { broughtOffering: boolean; offeringAmount: number } => {
    if (!val) return { broughtOffering: false, offeringAmount: 0 };
    const clean = val.trim().replace('R$', '').replace('$', '').trim();
    const normalizedNum = clean.replace(',', '.');
    const num = parseFloat(normalizedNum);
    if (!isNaN(num) && num >= 0) {
      return { broughtOffering: true, offeringAmount: num };
    }
    if (parseBool(val)) {
      return { broughtOffering: true, offeringAmount: 0 };
    }
    return { broughtOffering: false, offeringAmount: 0 };
  };

  const processParsedRows = (rows: any[][]) => {
    if (!rows || rows.length === 0) {
      setCsvError('Nenhum dado encontrado no arquivo.');
      return;
    }

    // Find header row in first 5 rows
    let headerRowIdx = 0;
    for (let r = 0; r < Math.min(5, rows.length); r++) {
      const rowStr = rows[r].map((c) => String(c).toLowerCase()).join(' ');
      if (
        rowStr.includes('nome') ||
        rowStr.includes('membro') ||
        rowStr.includes('trimestre') ||
        rowStr.includes('sábado') ||
        rowStr.includes('sabado') ||
        rowStr.includes('presen')
      ) {
        headerRowIdx = r;
        break;
      }
    }

    const header = rows[headerRowIdx].map((c) => String(c).toLowerCase().trim());

    let quarterIdx = -1;
    let sabbathNumIdx = -1;
    let dateIdx = -1;
    let nameIdx = -1;
    let classIdx = -1;
    let presentIdx = -1;
    let punctualIdx = -1;
    let lessonIdx = -1;
    let offeringIdx = -1;
    let pgIdx = -1;

    header.forEach((col, idx) => {
      if (col.includes('trimestre') || col.includes('trim') || col.includes('quarter')) {
        quarterIdx = idx;
      } else if (
        col.includes('sábado nº') ||
        col.includes('sabado nº') ||
        col.includes('nº sábado') ||
        col.includes('nº sabado') ||
        col.includes('semana') ||
        col.includes('lição nº') ||
        col.includes('licao nº') ||
        (col.includes('sábado') && !col.includes('data')) ||
        (col.includes('sabado') && !col.includes('data'))
      ) {
        sabbathNumIdx = idx;
      } else if (col.includes('data')) {
        dateIdx = idx;
      } else if (col.includes('nome') || col.includes('membro') || col.includes('aluno')) {
        nameIdx = idx;
      } else if (col.includes('classe') || col.includes('unidade') || col.includes('turma')) {
        classIdx = idx;
      } else if (col.includes('presen') || col.includes('compare')) {
        presentIdx = idx;
      } else if (col.includes('pontu') || col.includes('horário') || col.includes('horario') || col.includes('atras')) {
        punctualIdx = idx;
      } else if (col.includes('liç') || col.includes('lic') || col.includes('estud')) {
        lessonIdx = idx;
      } else if (col.includes('ofer') || col.includes('valor')) {
        offeringIdx = idx;
      } else if (col.includes('pg') || col.includes('pequen') || col.includes('grupo')) {
        pgIdx = idx;
      }
    });

    if (nameIdx === -1) {
      nameIdx = 0;
    }

    const parsedItems: ParsedRollCallItem[] = [];

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const rawName = String(row[nameIdx] || '').trim();
      if (!rawName) continue;

      const rawQuarter = quarterIdx >= 0 ? row[quarterIdx] : undefined;
      const rawSabbathNum = sabbathNumIdx >= 0 ? row[sabbathNumIdx] : undefined;
      const rawDate = dateIdx >= 0 ? row[dateIdx] : undefined;
      const rawClass = classIdx >= 0 ? String(row[classIdx] || '').trim() : '';
      const rawPresent = presentIdx >= 0 ? row[presentIdx] : 'sim';
      const rawPunctual = punctualIdx >= 0 ? row[punctualIdx] : 'sim';
      const rawLesson = lessonIdx >= 0 ? row[lessonIdx] : 'sim';
      const rawOffering = offeringIdx >= 0 ? row[offeringIdx] : '0';
      const rawPG = pgIdx >= 0 ? row[pgIdx] : 'sim';

      const { sabbathDate, quarter, sabbathNumberInQuarter } = resolveSabbathAndQuarter(
        rawQuarter,
        rawSabbathNum,
        rawDate,
        selectedDate
      );

      // Member matching
      const matchedMember =
        members.find((m) => m.name.toLowerCase().trim() === rawName.toLowerCase().trim()) ||
        members.find((m) => m.name.toLowerCase().includes(rawName.toLowerCase().trim()));

      const memberName = matchedMember ? matchedMember.name : rawName;
      const memberId = matchedMember ? matchedMember.id : `mb-imp-${Date.now()}-${i}`;

      let classId = selectedClassId;
      let className = rawClass;
      if (matchedMember) {
        className = matchedMember.className || matchedMember.unit || rawClass;
        const mClass = classes.find(
          (c) =>
            c.name.toLowerCase() === (matchedMember.className || '').toLowerCase() ||
            c.name.toLowerCase() === (matchedMember.unit || '').toLowerCase()
        );
        if (mClass) classId = mClass.id;
      } else if (rawClass) {
        const mClass = classes.find(
          (c) =>
            c.name.toLowerCase().includes(rawClass.toLowerCase()) ||
            rawClass.toLowerCase().includes(c.name.toLowerCase())
        );
        if (mClass) classId = mClass.id;
      }

      const present = parseBool(String(rawPresent));
      const punctual = present ? parseBool(String(rawPunctual)) : false;
      const studiedLesson = present ? parseBool(String(rawLesson)) : false;
      const { broughtOffering, offeringAmount } = present
        ? parseOffering(String(rawOffering))
        : { broughtOffering: false, offeringAmount: 0 };
      const attendedPG = present ? parseBool(String(rawPG)) : false;

      const recordId = `rc-${sabbathDate}-${memberId}`;
      const sabbathObj = sabbaths.find((s) => s.date === sabbathDate);
      const formattedDisplayDate = sabbathObj ? sabbathObj.formattedDate : sabbathDate;

      const record: RollCallRecord = {
        id: recordId,
        sabbathDate,
        memberId,
        memberName,
        classId,
        present,
        punctual,
        studiedLesson,
        broughtOffering,
        offeringAmount,
        attendedPG,
      };

      const score = calculateRecordScore(record, criteriaConfig);

      parsedItems.push({
        ...record,
        quarter,
        sabbathNumberInQuarter,
        formattedDisplayDate,
        className: className || 'Geral',
        score,
      });
    }

    if (parsedItems.length === 0) {
      setCsvError('Nenhum registro de chamada válido pôde ser extraído do arquivo.');
      return;
    }

    setCsvPreview(parsedItems);
    setPreviewQuarterFilter('all');
  };

  const handleImportFile = async (file: File) => {
    setCsvError(null);
    setCsvSuccessMsg(null);

    const isExcel =
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls') ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel';

    try {
      let rows: any[][] = [];

      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      } else {
        const text = await file.text();
        if (!text.trim()) {
          setCsvError('O arquivo está vazio.');
          return;
        }
        const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
        if (lines.length === 0) {
          setCsvError('Nenhum registro encontrado no arquivo.');
          return;
        }
        const firstLine = lines[0];
        let delimiter = ',';
        if (firstLine.includes(';')) delimiter = ';';
        else if (firstLine.includes('\t')) delimiter = '\t';

        rows = lines.map((line) => line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, '')));
      }

      processParsedRows(rows);
    } catch {
      setCsvError('Erro ao ler e processar o arquivo. Verifique se o formato está correto (.xlsx, .xls ou .csv).');
    }
  };

  const quarterCounts = useMemo(() => {
    const counts = { all: csvPreview.length, 1: 0, 2: 0, 3: 0, 4: 0 };
    csvPreview.forEach((item) => {
      if (item.quarter >= 1 && item.quarter <= 4) {
        counts[item.quarter as 1 | 2 | 3 | 4]++;
      }
    });
    return counts;
  }, [csvPreview]);

  const filteredPreview = useMemo(() => {
    if (previewQuarterFilter === 'all') return csvPreview;
    return csvPreview.filter((item) => item.quarter === previewQuarterFilter);
  }, [csvPreview, previewQuarterFilter]);

  const handleConfirmCsvImport = () => {
    if (csvPreview.length === 0) return;

    const recordsToSave: RollCallRecord[] = csvPreview.map((item) => ({
      id: item.id,
      sabbathDate: item.sabbathDate,
      memberId: item.memberId,
      memberName: item.memberName,
      classId: item.classId,
      present: item.present,
      punctual: item.punctual,
      studiedLesson: item.studiedLesson,
      broughtOffering: item.broughtOffering,
      offeringAmount: item.offeringAmount,
      attendedPG: item.attendedPG,
      customCriteria: item.customCriteria || {},
    }));

    onSaveRollCall(recordsToSave);

    const updatedLocalMap = { ...records };
    csvPreview.forEach((r) => {
      if (r.sabbathDate === selectedDate) {
        updatedLocalMap[r.memberId] = r;
      }
    });

    setRecords(updatedLocalMap);
    setCsvSuccessMsg(
      `${csvPreview.length} registro(s) de chamada importados com sucesso distribuídos nos trimestres correspondentes!`
    );
    setCsvPreview([]);
    setTimeout(() => {
      setIsCsvModalOpen(false);
      setCsvSuccessMsg(null);
    }, 1500);
  };

  const sampleQuarterData = [
    ['Trimestre', 'Sábado Nº', 'Data do Sábado', 'Nome do Membro', 'Classe / Unidade', 'Presença', 'Pontualidade', 'Lição Estudada', 'Oferta (R$)', 'Pequeno Grupo'],
    // 1º Trimestre (Janeiro a Março)
    ['1', '1', '2026-01-03', 'Adriana Silva', 'Ebenézer (Adultos)', 'Sim', 'Sim', 'Sim', '20.00', 'Sim'],
    ['1', '1', '2026-01-03', 'Bruno Oliveira', 'Maranata (Adultos)', 'Sim', 'Sim', 'Não', '10.00', 'Sim'],
    ['1', '2', '2026-01-10', 'Adriana Silva', 'Ebenézer (Adultos)', 'Sim', 'Sim', 'Sim', '15.00', 'Sim'],
    ['1', '2', '2026-01-10', 'Gabriel Rocha', 'Jovens - Geração Eleita', 'Sim', 'Não', 'Sim', '5.00', 'Não'],
    // 2º Trimestre (Abril a Junho)
    ['2', '1', '2026-04-04', 'Adriana Silva', 'Ebenézer (Adultos)', 'Sim', 'Sim', 'Sim', '25.00', 'Sim'],
    ['2', '1', '2026-04-04', 'Diego Martins', 'Bereia (Adultos)', 'Sim', 'Sim', 'Sim', '10.00', 'Sim'],
    ['2', '2', '2026-04-11', 'Heloísa Ribeiro', 'Adolescentes - Teen Zone', 'Sim', 'Sim', 'Sim', '10.00', 'Sim'],
    // 3º Trimestre (Julho a Setembro)
    ['3', '1', '2026-07-04', 'Adriana Silva', 'Ebenézer (Adultos)', 'Sim', 'Sim', 'Sim', '20.00', 'Sim'],
    ['3', '1', '2026-07-04', 'Bruno Oliveira', 'Maranata (Adultos)', 'Sim', 'Sim', 'Sim', '15.00', 'Sim'],
    ['3', '2', '2026-07-11', 'Pr. Ricardo Santos', 'Ebenézer (Adultos)', 'Sim', 'Sim', 'Sim', '30.00', 'Sim'],
  ];

  const downloadSampleRollCallExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet(sampleQuarterData);
    ws['!cols'] = [
      { wch: 12 }, // Trimestre
      { wch: 12 }, // Sábado Nº
      { wch: 16 }, // Data do Sábado
      { wch: 25 }, // Nome do Membro
      { wch: 25 }, // Classe / Unidade
      { wch: 12 }, // Presença
      { wch: 14 }, // Pontualidade
      { wch: 16 }, // Lição Estudada
      { wch: 14 }, // Oferta (R$)
      { wch: 14 }, // Pequeno Grupo
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Chamada_Trimestres');
    XLSX.writeFile(wb, 'modelo_chamada_semanal_por_trimestres.xlsx');
  };

  const downloadSampleRollCallCSV = () => {
    const csvContent = sampleQuarterData.map((row) => row.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_chamada_semanal_por_trimestres.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sync selectedDate when selectedQuarter changes
  useEffect(() => {
    if (displayedSabbaths.length > 0) {
      const isCurrentInQuarter = displayedSabbaths.some((s) => s.date === selectedDate);
      if (!isCurrentInQuarter && displayedSabbaths[0]?.date) {
        const nextDate = displayedSabbaths[0].date;
        setTimeout(() => setSelectedDate(nextDate), 0);
      }
    }
  }, [selectedQuarter, displayedSabbaths, selectedDate]);

  // Find class name & filter members flexibly
  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) || classes[0],
    [classes, selectedClassId]
  );

  const isMemberInClass = useCallback((m: Member, targetClass?: ClassUnit) => {
    if (!targetClass) return false;

    const cName = (targetClass.name || '').trim().toLowerCase();
    const cId = (targetClass.id || '').trim().toLowerCase();

    const mClass = (m.className || '').trim().toLowerCase();
    const mUnit = (m.unit || '').trim().toLowerCase();

    if (!mClass && !mUnit) return false;

    // 1. Direct match
    if (mClass === cName || mUnit === cName) return true;
    if (cId && (mClass === cId || mUnit === cId)) return true;

    // 2. Substring match (e.g. "Ebenézer" matches "Ebenézer (Adultos)" or vice versa)
    if (mClass && (cName.includes(mClass) || mClass.includes(cName))) return true;
    if (mUnit && (cName.includes(mUnit) || mUnit.includes(cName))) return true;

    return false;
  }, []);

  const matchedMembers = useMemo(
    () => members.filter((m) => isMemberInClass(m, selectedClass)),
    [members, selectedClass, isMemberInClass]
  );

  // Fallback: If no members explicitly matched this class filter, display all members so the list is never empty!
  const classMembers = useMemo(
    () => (matchedMembers.length > 0 ? matchedMembers : members),
    [matchedMembers, members]
  );
  const isFallbackAllMembers = matchedMembers.length === 0 && members.length > 0;

  // Local state for current rollcall entries
  const [records, setRecords] = useState<Record<string, RollCallRecord>>({});
  const [manualClassOffering, setManualClassOffering] = useState<number>(0);
  const [extraPoints, setExtraPoints] = useState<number>(0);
  const [offeringTarget, setOfferingTarget] = useState<number>(50);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    // Load existing records for date & class
    const newRecordsMap: Record<string, RollCallRecord> = {};

    classMembers.forEach((member) => {
      const existing = rollCallRecords.find(
        (r) => r.sabbathDate === selectedDate && r.memberId === member.id
      );

      if (existing) {
        newRecordsMap[member.id] = {
          ...existing,
          // Ensure defaults for missing fields
          present: existing.present ?? false,
          punctual: existing.punctual ?? false,
          studiedLesson: existing.studiedLesson ?? false,
          broughtOffering: existing.broughtOffering ?? false,
          offeringAmount: existing.offeringAmount ?? 0,
          attendedPG: existing.attendedPG ?? false,
          customCriteria: existing.customCriteria || {},
        };
      } else {
        newRecordsMap[member.id] = {
          id: `rc-${selectedDate}-${member.id}`,
          sabbathDate: selectedDate,
          memberId: member.id,
          memberName: member.name,
          classId: selectedClassId,
          present: false,
          punctual: false,
          studiedLesson: false,
          broughtOffering: false,
          offeringAmount: 0,
          attendedPG: false,
          lessonStudyDays: 0,
          broughtBible: false,
          visitsMade: 0,
          customCriteria: {},
        };
      }
    });

    // Determine existing offering sum for this date and class
    const existingClassRecords = rollCallRecords.filter(
      (r) => r.sabbathDate === selectedDate && r.classId === selectedClassId
    );
    const existingSum =
      existingClassRecords.length > 0
        ? existingClassRecords.reduce((acc, r) => acc + (r.offeringAmount || 0), 0)
        : 0;

    const existingUwd = unitWeeklyData?.find(
      (u) => u.sabbathDate === selectedDate && u.unitOrClassId === selectedClassId
    );
    const defaultTarget = selectedClass?.targetOffering || 50;

    setTimeout(() => {
      setExtraPoints(existingUwd?.extraPoints ?? 0);
      setOfferingTarget(existingUwd?.offeringTarget ?? defaultTarget);
      setManualClassOffering(
        existingUwd?.offeringCollected ?? (existingSum > 0 ? existingSum : 0)
      );
      setRecords(newRecordsMap);
      setIsSaved(false);
    }, 0);
  }, [selectedDate, selectedClassId, members, rollCallRecords, classMembers, unitWeeklyData, selectedClass]);

  // Criteria Handlers
  const handleTogglePresent = (memberId: string) => {
    setRecords((prev) => {
      const current = prev[memberId];
      const nextPresent = !current?.present;
      return {
        ...prev,
        [memberId]: {
          ...current,
          present: nextPresent,
          ...(nextPresent
            ? {}
            : {
                punctual: false,
                studiedLesson: false,
                attendedPG: false,
                lessonStudyDays: 0,
                broughtBible: false,
                customCriteria: {},
              }),
        },
      };
    });
  };

  const handleTogglePunctual = (memberId: string) => {
    setRecords((prev) => {
      const current = prev[memberId];
      const nextPunctual = !current?.punctual;
      return {
        ...prev,
        [memberId]: {
          ...current,
          punctual: nextPunctual,
          present: nextPunctual ? true : current?.present,
        },
      };
    });
  };

  const handleToggleLesson = (memberId: string) => {
    setRecords((prev) => {
      const current = prev[memberId];
      const nextLesson = !current?.studiedLesson;
      return {
        ...prev,
        [memberId]: {
          ...current,
          studiedLesson: nextLesson,
          lessonStudyDays: nextLesson ? 7 : 0,
          present: nextLesson ? true : current?.present,
        },
      };
    });
  };

  const handleToggleOffering = (memberId: string) => {
    setRecords((prev) => {
      const current = prev[memberId];
      const nextOffering = !current?.broughtOffering;
      return {
        ...prev,
        [memberId]: {
          ...current,
          broughtOffering: nextOffering,
          present: nextOffering ? true : current?.present,
        },
      };
    });
  };

  const handleTogglePG = (memberId: string) => {
    setRecords((prev) => {
      const current = prev[memberId];
      const nextPG = !current?.attendedPG;
      return {
        ...prev,
        [memberId]: {
          ...current,
          attendedPG: nextPG,
          present: nextPG ? true : current?.present,
        },
      };
    });
  };

  const handleToggleCustomCriterion = (memberId: string, criterionId: string) => {
    setRecords((prev) => {
      const current = prev[memberId];
      const currentChecked = Boolean(current?.customCriteria?.[criterionId]);
      const nextChecked = !currentChecked;
      return {
        ...prev,
        [memberId]: {
          ...current,
          present: nextChecked ? true : current?.present,
          customCriteria: {
            ...(current?.customCriteria || {}),
            [criterionId]: nextChecked,
          },
        },
      };
    });
  };

  const handleMarkAllPresent = () => {
    setRecords((prev) => {
      const updated = { ...prev };
      classMembers.forEach((m) => {
        if (updated[m.id]) {
          updated[m.id] = { ...updated[m.id], present: true };
        }
      });
      return updated;
    });
  };

  const handleClearAll = () => {
    setRecords((prev) => {
      const updated = { ...prev };
      classMembers.forEach((m) => {
        if (updated[m.id]) {
          updated[m.id] = {
            ...updated[m.id],
            present: false,
            punctual: false,
            studiedLesson: false,
            broughtOffering: false,
            offeringAmount: 0,
            attendedPG: false,
            lessonStudyDays: 0,
            broughtBible: false,
            visitsMade: 0,
            customCriteria: {},
          };
        }
      });
      return updated;
    });
  };

  const handleSave = () => {
    const recordsListToSave = Object.values(records);
    let updatedList: RollCallRecord[] = [];

    if (manualClassOffering > 0 && recordsListToSave.length > 0) {
      const offeringMembers = recordsListToSave.filter((r) => r.broughtOffering);

      if (offeringMembers.length > 0) {
        const perMemberAmount = Math.floor((manualClassOffering / offeringMembers.length) * 100) / 100;
        const remainder = Math.round((manualClassOffering - perMemberAmount * offeringMembers.length) * 100) / 100;

        let remainderAdded = false;
        updatedList = recordsListToSave.map((r) => {
          if (r.broughtOffering) {
            const extra = !remainderAdded ? remainder : 0;
            remainderAdded = true;
            return {
              ...r,
              offeringAmount: perMemberAmount + extra,
            };
          }
          return { ...r, offeringAmount: 0 };
        });
      } else {
        const perMemberAmount = Math.floor((manualClassOffering / recordsListToSave.length) * 100) / 100;
        const remainder = Math.round((manualClassOffering - perMemberAmount * recordsListToSave.length) * 100) / 100;

        let remainderAdded = false;
        updatedList = recordsListToSave.map((r) => {
          const extra = !remainderAdded ? remainder : 0;
          remainderAdded = true;
          return {
            ...r,
            offeringAmount: perMemberAmount + extra,
          };
        });
      }
    } else {
      updatedList = recordsListToSave.map((r) => ({
        ...r,
        offeringAmount: 0,
      }));
    }

    onSaveRollCall(updatedList);

    if (onSaveUnitWeeklyData) {
      const clsName = selectedClass?.name || 'Unidade';
      onSaveUnitWeeklyData({
        id: `uwd-${selectedDate}-${selectedClassId}`,
        sabbathDate: selectedDate,
        unitOrClassId: selectedClassId,
        unitName: clsName,
        extraPoints: Number(extraPoints) || 0,
        offeringTarget: Number(offeringTarget) || 0,
        offeringCollected: Number(manualClassOffering) || 0,
      });
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // Metrics calculations for the current class/date
  const totalClassMembers = classMembers.length;
  const recordsList = Object.values(records);

  const presentCount = recordsList.filter((r) => r.present).length;
  const punctualCount = recordsList.filter((r) => r.punctual).length;
  const lessonCount = recordsList.filter((r) => r.studiedLesson).length;
  const offeringCount = recordsList.filter((r) => r.broughtOffering).length;
  const pgCount = recordsList.filter((r) => r.attendedPG).length;

  const classOfferingTotal = manualClassOffering;

  // Calculate offering per unit for the selected sabbath date
  const unitOfferingMap: Record<string, number> = {};
  const memberUnitLookup = new Map<string, string>();
  members.forEach((m) => {
    memberUnitLookup.set(m.id, m.unit || 'Unidade 1');
    memberUnitLookup.set(m.name, m.unit || 'Unidade 1');
  });

  // Aggregate saved roll call records for this date from OTHER classes
  rollCallRecords
    .filter((r) => r.sabbathDate === selectedDate && r.classId !== selectedClassId)
    .forEach((r) => {
      const u = memberUnitLookup.get(r.memberId) || memberUnitLookup.get(r.memberName) || 'Unidade 1';
      unitOfferingMap[u] = (unitOfferingMap[u] || 0) + (r.offeringAmount || 0);
    });

  // Add current active class manual offering attributed to the units of current class members
  const currentClassUnits = Array.from(new Set(classMembers.map((m) => m.unit || 'Unidade 1')));
  if (currentClassUnits.length > 0) {
    const amountPerUnit = manualClassOffering / currentClassUnits.length;
    currentClassUnits.forEach((u) => {
      unitOfferingMap[u] = (unitOfferingMap[u] || 0) + amountPerUnit;
    });
  }

  const maxPossibleScorePerMember = getMaxPossibleScore(criteriaConfig);
  const totalScoreEarnedInClass = recordsList.reduce(
    (acc, r) => acc + calculateRecordScore(r, criteriaConfig),
    0
  );

  const averageClassScore =
    totalClassMembers > 0
      ? (totalScoreEarnedInClass / totalClassMembers).toFixed(1)
      : '0';

  const currentSabbathObj = sabbaths.find((s) => s.date === selectedDate);

  return (
    <div className="space-y-4">
      {/* 1. Header & Date/Class Filter */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-[#600010]" />
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                Lançamento de Chamada Semanal ({activeCriteria.length} Critérios)
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {activeCriteria.length > 0
                ? activeCriteria.map((c) => c.name).join(', ')
                : 'Nenhum critério ativo. Abra as configurações para ativar.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* CSV & Excel Import Button */}
            <button
              type="button"
              onClick={() => setIsCsvModalOpen(true)}
              className="flex-1 lg:flex-none px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-2xs cursor-pointer"
            >
              <Upload className="w-4 h-4 text-emerald-700" />
              <span>Importar Chamadas (Excel / CSV)</span>
            </button>

            {/* Admin Config Modal Trigger Button */}
            <button
              type="button"
              onClick={() => setIsConfigModalOpen(true)}
              className="flex-1 lg:flex-none px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-2xs hover:shadow-xs cursor-pointer"
              title="Gerenciar critérios, editar pontuações ou adicionar novos critérios"
            >
              <Settings className="w-4 h-4 text-amber-700" />
              <span>Critérios ({activeCriteria.length})</span>
              <span className="bg-amber-200/90 text-amber-900 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {maxPossibleScorePerMember} pts
              </span>
            </button>

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              className={`flex-1 lg:flex-none px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                isSaved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#600010] hover:bg-[#4a000c] text-white active:scale-98'
              }`}
            >
              {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{isSaved ? 'Chamada Salva!' : 'Salvar Chamada'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-3 border-t border-gray-100 items-end">
          {/* Select Sabbath Date */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
              Data do Sábado
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#600010]"
              >
                {displayedSabbaths.map((s) => (
                  <option key={s.date} value={s.date}>
                    {s.formattedDate} ({s.quarter}º Trimestre)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Select Class */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
              Classe / Unidade da Igreja
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#600010]"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.category}) — Prof: {c.teacher1Name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* PAINEL DE PONTUAÇÃO E REGISTROS DA UNIDADE (Atividades Extras, Alvo de Ofertas & Pontuação Final) */}
        {(() => {
          const totalClassMembers = classMembers.length;
          const recordsList = Object.values(records);
          const regularTotalPoints = recordsList.reduce((acc, r) => acc + calculateRecordScore(r, criteriaConfig), 0);
          const regularScoreAvg = totalClassMembers > 0 ? Math.round(regularTotalPoints / totalClassMembers) : 0;
          const currentOfferingPoints = calculateOfferingPoints(manualClassOffering, offeringTarget);
          const currentOfferingPct = offeringTarget > 0 ? Math.round((manualClassOffering / offeringTarget) * 100) : 0;
          const currentUnitFinalScore = calculateUnitFinalScore(regularScoreAvg, extraPoints, currentOfferingPoints);

          return (
            <div className="space-y-3 bg-gradient-to-br from-amber-50/60 via-amber-100/30 to-emerald-50/50 p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-amber-200/80">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-700 animate-pulse" />
                  <span className="text-xs font-black text-amber-950 uppercase tracking-wide">
                    Pontuação e Metas da Unidade: {selectedClass?.name || 'Unidade'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-900 bg-white/80 px-2.5 py-1 rounded-lg border border-amber-300">
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  Pontuação Final do Sábado: <strong className="text-sm text-[#600010] ml-1">{currentUnitFinalScore} pts</strong>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Atividades Extras */}
                <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-extrabold text-amber-950">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      1. Atividades Extras (Pontos)
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                      +{extraPoints} pts
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExtraPoints((p) => Math.max(0, p - 5))}
                      className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold text-xs transition"
                      title="-5 Pontos"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={extraPoints}
                      onChange={(e) => setExtraPoints(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full text-center py-1.5 bg-gray-50 border border-amber-300 rounded-lg text-xs font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="0"
                    />
                    <button
                      type="button"
                      onClick={() => setExtraPoints((p) => p + 5)}
                      className="p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xs transition"
                      title="+5 Pontos"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setExtraPoints((p) => p + 10)}
                      className="px-2 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-black text-[10px] whitespace-nowrap transition"
                    >
                      +10
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 italic">
                    Pontuação adicional concedida à unidade no sábado.
                  </p>
                </div>

                {/* 2. Área de Ofertas (Alvo e Valor Recolhido) */}
                <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between text-[11px] font-extrabold text-emerald-950">
                    <span className="flex items-center gap-1 text-emerald-900">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      2. Ofertas da Unidade (Alvo vs Recolhido)
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-black border ${
                      currentOfferingPoints >= 100
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border-amber-300'
                    }`}>
                      Critério de Ofertas: {currentOfferingPoints} / 100 pts
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 mb-0.5 flex items-center gap-1">
                        <Target className="w-3 h-3 text-emerald-600" /> Alvo de Oferta (R$)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">R$</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={offeringTarget === 0 ? '' : offeringTarget}
                          onChange={(e) => setOfferingTarget(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full pl-8 pr-2 py-1 bg-gray-50 border border-emerald-300 rounded-lg text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="50.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 mb-0.5 flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-emerald-600" /> Valor Recolhido (R$)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-emerald-800">R$</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={manualClassOffering === 0 ? '' : manualClassOffering}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setManualClassOffering(raw === '' ? 0 : Math.max(0, parseFloat(raw) || 0));
                          }}
                          className="w-full pl-8 pr-2 py-1 bg-emerald-50 border border-emerald-400 rounded-lg text-xs font-black text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Rating Progress bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between items-center text-[10px] font-bold text-gray-600">
                      <span>Progresso do Alvo de Ofertas</span>
                      <span className="text-emerald-800 font-extrabold">{currentOfferingPct}% Atingido</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                      <div
                        className={`h-full transition-all duration-300 ${
                          currentOfferingPct >= 100
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                            : 'bg-gradient-to-r from-amber-400 to-emerald-400'
                        }`}
                        style={{ width: `${Math.min(100, currentOfferingPct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Formula Breakdown Banner */}
              <div className="p-2.5 bg-white rounded-xl border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-800">
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <span className="font-bold text-gray-600">Fórmula da Pontuação Final:</span>
                  <span className="bg-gray-100 px-2 py-0.5 rounded font-extrabold text-gray-800">
                    Chamada Regular: {regularScoreAvg} pts
                  </span>
                  <span>+</span>
                  <span className="bg-amber-100 px-2 py-0.5 rounded font-extrabold text-amber-900">
                    Atividades Extras: {extraPoints} pts
                  </span>
                  <span>+</span>
                  <span className="bg-emerald-100 px-2 py-0.5 rounded font-extrabold text-emerald-900">
                    Critério Ofertas: {currentOfferingPoints} pts
                  </span>
                </div>
                <div className="font-black text-sm text-[#600010] bg-amber-50 px-3 py-1 rounded-lg border border-amber-300 whitespace-nowrap">
                  = {currentUnitFinalScore} Pontos
                </div>
              </div>
            </div>
          );
        })()}

        {/* Units summary badge bar */}
        <div className="flex items-center gap-2 flex-wrap text-xs bg-gray-50 p-2.5 rounded-xl border border-gray-200">
          <span className="font-extrabold text-emerald-900 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-300 text-[11px] flex items-center gap-1 shrink-0">
            <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
            Oferta por Unidade (neste Sábado):
          </span>
          {Object.keys(unitOfferingMap).length === 0 ? (
            <span className="text-gray-500 italic text-[11px]">Nenhuma oferta registrada neste sábado.</span>
          ) : (
            Object.entries(unitOfferingMap).map(([unitName, amount]) => (
              <span
                key={unitName}
                className="text-[11px] font-bold text-gray-800 bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-2xs"
              >
                {unitName}: <strong className="text-emerald-800">R$ {amount.toFixed(2)}</strong>
              </span>
            ))
          )}
        </div>

        {currentSabbathObj?.specialEvent && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium flex items-center justify-between">
            <span>✨ Evento Especial neste Sábado: <strong>{currentSabbathObj.specialEvent}</strong></span>
            {currentSabbathObj.targetOffering && (
              <span className="font-bold">Meta de Oferta: R$ {currentSabbathObj.targetOffering}</span>
            )}
          </div>
        )}
      </div>

      {/* 2. Real-Time Class Summary Cards for All Active Criteria */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
        {activeCriteria.map((criterion) => {
          let count = 0;
          let subtitle = '';
          const styles = getCriterionColorStyles(criterion.color, true);

          if (criterion.systemKey === 'present' || criterion.id === 'presence') {
            count = presentCount;
            subtitle = `${totalClassMembers > 0 ? Math.round((presentCount / totalClassMembers) * 100) : 0}% Presentes`;
          } else if (criterion.systemKey === 'punctual' || criterion.id === 'punctuality') {
            count = punctualCount;
            subtitle = `${totalClassMembers > 0 ? Math.round((punctualCount / totalClassMembers) * 100) : 0}% No Horário`;
          } else if (criterion.systemKey === 'studiedLesson' || criterion.id === 'lesson') {
            count = lessonCount;
            subtitle = `${totalClassMembers > 0 ? Math.round((lessonCount / totalClassMembers) * 100) : 0}% Estudou`;
          } else if (criterion.systemKey === 'broughtOffering' || criterion.id === 'offering') {
            count = offeringCount;
            subtitle = `${offeringCount} ${offeringCount === 1 ? 'ofertante' : 'ofertantes'} (${totalClassMembers > 0 ? Math.round((offeringCount / totalClassMembers) * 100) : 0}%)`;
          } else if (criterion.systemKey === 'attendedPG' || criterion.id === 'pg') {
            count = pgCount;
            subtitle = `${totalClassMembers > 0 ? Math.round((pgCount / totalClassMembers) * 100) : 0}% em PG`;
          } else {
            count = recordsList.filter((r) => Boolean(r.customCriteria?.[criterion.id])).length;
            subtitle = `${totalClassMembers > 0 ? Math.round((count / totalClassMembers) * 100) : 0}% Realizou`;
          }

          const isOffering = criterion.systemKey === 'broughtOffering' || criterion.id === 'offering';

          return (
            <div
              key={criterion.id}
              className="bg-white p-3 rounded-2xl border border-gray-200 shadow-xs space-y-1 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center justify-between text-[10px] font-bold text-gray-500 uppercase truncate">
                <span className="truncate">{criterion.name}</span>
                <span className={styles.badgeText}>
                  {renderCriterionIcon(criterion.icon, 'w-3.5 h-3.5')}
                </span>
              </div>
              <div className="text-lg font-black text-gray-900 truncate">
                {isOffering ? `R$ ${classOfferingTotal.toFixed(2)}` : `${count} / ${totalClassMembers}`}
              </div>
              <div className={`text-[10px] font-bold ${styles.badgeText} truncate`}>
                {subtitle}
              </div>
            </div>
          );
        })}

        {/* Average Score */}
        <div className="bg-[#600010] text-white p-3 rounded-2xl border border-[#D4AF37]/40 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-[#D4AF37] uppercase">
            <span>Média Classe</span>
            <Award className="w-3.5 h-3.5 text-[#D4AF37]" />
          </div>
          <div className="text-lg font-black">
            {averageClassScore} <span className="text-xs font-normal text-[#D4AF37]">pts</span>
          </div>
          <div className="text-[10px] text-[#D4AF37]/90 font-semibold truncate">
            de {maxPossibleScorePerMember} pts máximos
          </div>
        </div>
      </div>

      {/* 3. Interactive 5 Criteria Member List */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-bold text-xs text-gray-800 flex flex-wrap items-center justify-between gap-2">
          <span>Classe: {selectedClass?.name} ({classMembers.length} membros cadastrados)</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleMarkAllPresent}
              className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
            >
              Marcar Todos Presentes
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="px-2.5 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
            >
              Desmarcar / Zerar
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-100 overflow-x-auto">
          {isFallbackAllMembers && (
            <div className="p-3 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Nenhum membro vinculado especificamente à classe &quot;{selectedClass?.name}&quot;. Exibindo todos os {members.length} membros cadastrados para o lançamento da chamada.
              </span>
            </div>
          )}

          {classMembers.length === 0 ? (
            <div className="p-8 text-center text-gray-500 space-y-2">
              <UserCheck className="w-8 h-8 text-gray-300 mx-auto" />
              <p className="text-sm font-semibold">Nenhum membro cadastrado no sistema.</p>
              <p className="text-xs text-gray-400">
                Acesse a aba &quot;Membros e Visitantes&quot; para cadastrar alunos.
              </p>
            </div>
          ) : (
            classMembers.map((member) => {
              const record = records[member.id] || {
                present: false,
                punctual: false,
                studiedLesson: false,
                broughtOffering: false,
                offeringAmount: 0,
                attendedPG: false,
              };

              const memberScore = calculateRecordScore(record, criteriaConfig);

              return (
                <div
                  key={member.id}
                  className={`p-3.5 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs ${
                    record.present ? 'hover:bg-gray-50/80' : 'bg-red-50/30 hover:bg-red-50/50'
                  }`}
                >
                  {/* Left: Member Info & Score Badge */}
                  <div className="flex items-center justify-between lg:justify-start gap-3 lg:w-1/4 shrink-0">
                    <div className="flex items-center gap-2.5 truncate">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs text-white shrink-0 ${
                          record.present ? 'bg-[#600010]' : 'bg-gray-400'
                        }`}
                      >
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-gray-900 text-sm truncate flex items-center gap-1.5">
                          <span>{member.name}</span>
                          {member.isTeacher && (
                            <span className="bg-amber-100 text-amber-800 text-[9px] font-extrabold px-1.5 py-0.2 rounded border border-amber-300">
                              Prof
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {member.unit} • {member.status}
                        </div>
                      </div>
                    </div>

                    {/* Individual Member Score Badge */}
                    <div className="bg-amber-100 border border-amber-300 text-amber-900 px-2.5 py-1 rounded-xl text-center shrink-0 font-extrabold text-xs">
                      {memberScore} / {maxPossibleScorePerMember} <span className="text-[9px] text-amber-800 font-semibold">pts</span>
                    </div>
                  </div>

                  {/* Middle: Interactive Individual Criteria Selection Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 lg:flex-1 justify-start lg:justify-center">
                    {activeCriteria.map((criterion) => {
                      const isPresence = criterion.systemKey === 'present' || criterion.id === 'presence';
                      const isPunctual = criterion.systemKey === 'punctual' || criterion.id === 'punctuality';
                      const isLesson = criterion.systemKey === 'studiedLesson' || criterion.id === 'lesson';
                      const isOffering = criterion.systemKey === 'broughtOffering' || criterion.id === 'offering';
                      const isPG = criterion.systemKey === 'attendedPG' || criterion.id === 'pg';

                      let isChecked = false;
                      let onClickHandler: () => void = () => {};
                      let label = criterion.name;

                      if (isPresence) {
                        isChecked = record.present;
                        onClickHandler = () => handleTogglePresent(member.id);
                        label = record.present ? 'Presente' : 'Ausente';
                      } else if (isPunctual) {
                        isChecked = record.punctual;
                        onClickHandler = () => handleTogglePunctual(member.id);
                        label = record.punctual ? 'Pontual' : 'Atrasado';
                      } else if (isLesson) {
                        isChecked = record.studiedLesson;
                        onClickHandler = () => handleToggleLesson(member.id);
                        label = record.studiedLesson ? (criterion.name || 'Lição') : 'Sem Lição';
                      } else if (isOffering) {
                        isChecked = record.broughtOffering;
                        onClickHandler = () => handleToggleOffering(member.id);
                        label = record.broughtOffering ? '$ Ofertou' : 'Sem Oferta';
                      } else if (isPG) {
                        isChecked = record.attendedPG;
                        onClickHandler = () => handleTogglePG(member.id);
                        label = record.attendedPG ? (criterion.name || 'PG') : 'Sem PG';
                      } else {
                        // Custom criterion
                        isChecked = Boolean(record.customCriteria?.[criterion.id]);
                        onClickHandler = () => handleToggleCustomCriterion(member.id, criterion.id);
                        label = isChecked ? criterion.name : `Sem ${criterion.name}`;
                      }

                      const styles = getCriterionColorStyles(criterion.color, isChecked);

                      return (
                        <button
                          key={criterion.id}
                          type="button"
                          onClick={onClickHandler}
                          className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all border cursor-pointer ${
                            isChecked
                              ? `${styles.btnActive} shadow-xs`
                              : isPresence
                              ? 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
                              : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200'
                          }`}
                          title={`${criterion.name} (+${criterion.points} pts)`}
                        >
                          {isPresence && !isChecked ? (
                            <XCircle className="w-3.5 h-3.5 text-red-600" />
                          ) : (
                            renderCriterionIcon(criterion.icon, 'w-3.5 h-3.5')
                          )}
                          <span className="truncate max-w-[130px]">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Criteria Points Modal */}
      <CriteriaConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        config={criteriaConfig}
        onSaveConfig={onSaveCriteriaConfig}
      />

      {/* CSV & Excel Import Modal for Chamada Semanal with Quarter Support */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shadow-2xs">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span>Importação de Chamadas por Trimestre</span>
                    <span className="text-[10px] uppercase tracking-wider bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-md border border-emerald-300">
                      Excel / CSV
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500">
                    Importe pontuações e registros de trimestres anteriores (1º, 2º, 3º e 4º) com detecção automática da coluna de Trimestre e Sábado.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCsvModalOpen(false);
                  setCsvPreview([]);
                  setCsvError(null);
                  setCsvSuccessMsg(null);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {csvSuccessMsg && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2.5 font-bold shadow-2xs animate-in fade-in duration-200">
                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{csvSuccessMsg}</span>
              </div>
            )}

            {csvError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{csvError}</span>
              </div>
            )}

            {/* Drag and Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleImportFile(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                dragActive
                  ? 'border-emerald-600 bg-emerald-50/60 ring-4 ring-emerald-100'
                  : 'border-gray-300 hover:border-emerald-500 bg-gray-50/50'
              }`}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <FileSpreadsheet className="w-8 h-8 text-emerald-700" />
                <FileText className="w-7 h-7 text-amber-600" />
              </div>
              <p className="text-sm font-bold text-gray-800">
                Arraste a planilha de chamada aqui (.xlsx, .xls ou .csv)
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Suporta planilhas contendo dados de múltiplos trimestres (1º, 2º, 3º e 4º)
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleImportFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Selecionar Planilha do Computador</span>
                </button>
              </div>
            </div>

            {/* Instruction Box with Column Guide & Download Templates */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1.5 flex-1">
                  <p className="font-bold text-gray-900">
                    Estrutura com Coluna de Trimestre (Recomendada para importar períodos anteriores):
                  </p>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 font-mono text-[11px] text-gray-800 overflow-x-auto">
                    Trimestre | Sábado Nº | Data do Sábado | Nome do Membro | Classe / Unidade | Presença | Pontualidade | Lição Estudada | Oferta (R$) | Pequeno Grupo
                  </div>
                  <ul className="list-disc pl-4 text-[11px] text-gray-600 space-y-0.5">
                    <li>
                      <strong>Trimestre:</strong> preencha com <span className="text-emerald-700 font-bold">1, 2, 3</span> ou <span className="text-emerald-700 font-bold">4</span> (ou &quot;1º Trimestre&quot;, etc.).
                    </li>
                    <li>
                      <strong>Sábado Nº:</strong> número do sábado no trimestre (1 a 13) <em>ou</em> informe a <strong>Data do Sábado</strong> (ex: <code className="bg-gray-100 px-1 rounded">2026-01-03</code> ou <code className="bg-gray-100 px-1 rounded">03/01/2026</code>).
                    </li>
                    <li>
                      <strong>Critérios:</strong> aceita <code className="bg-gray-100 px-1 rounded">Sim</code> / <code className="bg-gray-100 px-1 rounded">Não</code>. Oferta aceita valor numérico (ex: <code className="bg-gray-100 px-1 rounded">15.00</code>).
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200">
                <button
                  type="button"
                  onClick={downloadSampleRollCallExcel}
                  className="flex-1 min-w-[200px] py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-2xs"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>Baixar Modelo Excel (.xlsx) com Trimestres</span>
                </button>

                <button
                  type="button"
                  onClick={downloadSampleRollCallCSV}
                  className="flex-1 min-w-[200px] py-2 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-2xs"
                >
                  <FileText className="w-4 h-4 text-amber-700" />
                  <span>Baixar Modelo CSV (.csv) com Trimestres</span>
                </button>
              </div>
            </div>

            {/* Preview of Parsed Records with Quarter Filter */}
            {csvPreview.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">
                      Registros Identificados ({csvPreview.length})
                    </span>
                    <span className="text-[10px] text-emerald-800 font-extrabold bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                      Pronto para Gravar
                    </span>
                  </div>

                  {/* Quarter distribution summary tags */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                      1º Trim: {quarterCounts[1]}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 font-bold">
                      2º Trim: {quarterCounts[2]}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 font-bold">
                      3º Trim: {quarterCounts[3]}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                      4º Trim: {quarterCounts[4]}
                    </span>
                  </div>
                </div>

                {/* Filter Tabs in Preview */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <span className="text-gray-500 font-bold flex items-center gap-1 text-[11px] pr-1">
                    <Filter className="w-3.5 h-3.5" />
                    Filtrar visualização:
                  </span>
                  {(['all', 1, 2, 3, 4] as const).map((q) => {
                    const count = q === 'all' ? quarterCounts.all : quarterCounts[q];
                    const label = q === 'all' ? `Todos (${count})` : `${q}º Trimestre (${count})`;
                    const isActive = previewQuarterFilter === q;
                    return (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setPreviewQuarterFilter(q)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all shrink-0 ${
                          isActive
                            ? 'bg-gray-900 text-white shadow-2xs'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* List of items */}
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-gray-50/50">
                  {filteredPreview.map((item, idx) => {
                    const quarterBadgeColors: Record<number, string> = {
                      1: 'bg-emerald-100 text-emerald-900 border-emerald-300',
                      2: 'bg-blue-100 text-blue-900 border-blue-300',
                      3: 'bg-purple-100 text-purple-900 border-purple-300',
                      4: 'bg-amber-100 text-amber-900 border-amber-300',
                    };

                    return (
                      <div
                        key={idx}
                        className="p-2.5 flex flex-col gap-1.5 text-[11px] hover:bg-white transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`px-2 py-0.5 rounded-md font-extrabold text-[10px] border shrink-0 ${
                                quarterBadgeColors[item.quarter] || 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {item.quarter}º Trimestre • Sáb {String(item.sabbathNumberInQuarter).padStart(2, '0')}
                            </span>
                            <span className="font-bold text-gray-900 truncate">
                              {item.memberName}
                            </span>
                            <span className="text-[10px] text-gray-500 truncate hidden sm:inline">
                              ({item.className})
                            </span>
                          </div>

                          <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 shrink-0">
                            +{item.score} pts
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="text-gray-500 font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200">
                            📅 {item.formattedDisplayDate || item.sabbathDate}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              item.present
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}
                          >
                            {item.present ? 'Presente' : 'Ausente'}
                          </span>
                          {item.present && (
                            <>
                              <span
                                className={`px-1.5 py-0.5 rounded font-bold ${
                                  item.punctual
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : 'bg-gray-200 text-gray-700'
                                }`}
                              >
                                {item.punctual ? 'Pontual' : 'Atrasado'}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded font-bold ${
                                  item.studiedLesson
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-gray-200 text-gray-700'
                                }`}
                              >
                                {item.studiedLesson ? 'Lição OK' : 'Sem Lição'}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded font-bold ${
                                  item.broughtOffering
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-gray-200 text-gray-700'
                                }`}
                              >
                                {item.broughtOffering ? `Oferta R$ ${(item.offeringAmount || 0).toFixed(2)}` : 'Sem Oferta'}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded font-bold ${
                                  item.attendedPG
                                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                    : 'bg-gray-200 text-gray-700'
                                }`}
                              >
                                {item.attendedPG ? 'PG OK' : 'Sem PG'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                {csvPreview.length > 0 ? `${csvPreview.length} registro(s) no total` : 'Nenhum arquivo selecionado ainda'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCsvModalOpen(false);
                    setCsvPreview([]);
                    setCsvError(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleConfirmCsvImport}
                  disabled={csvPreview.length === 0}
                  className={`px-5 py-2.5 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 ${
                    csvPreview.length > 0
                      ? 'bg-emerald-800 hover:bg-emerald-900 text-white cursor-pointer ring-2 ring-emerald-600/30'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmar e Importar Chamadas ({csvPreview.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
