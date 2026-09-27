'use client';

import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Member,
  LessonCatalogItem,
  ManaSubscription,
  ManaOrderItem,
  PaymentMethod,
} from '@/lib/types';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Check,
  Search,
  RotateCcw,
  Sparkles,
  User,
  BookOpen,
  DollarSign,
  Layers,
  ArrowRight,
  Filter,
  Trash2,
  FileText,
  HelpCircle,
} from 'lucide-react';

export interface ParsedManaRow {
  id: string;
  selected: boolean;
  memberName: string;
  matchedMemberId?: string;
  isMatchedMember: boolean;
  lessonName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  status: 'Quitado' | 'Parcial' | 'Pendente';
  deliveryStatus: 'Entregue' | 'Pendente' | 'A caminho';
  notes?: string;
}

interface ManaExcelImportViewProps {
  members: Member[];
  lessonCatalog: LessonCatalogItem[];
  currentSubscriptions: ManaSubscription[];
  selectedQuarter: number;
  onConfirmImport: (
    newSubscriptions: Omit<ManaSubscription, 'id'>[],
    mode: 'append' | 'replace',
    newCatalogItems?: LessonCatalogItem[]
  ) => void;
  onCancelOrBack: () => void;
}

export const ManaExcelImportView: React.FC<ManaExcelImportViewProps> = ({
  members,
  lessonCatalog,
  currentSubscriptions,
  selectedQuarter,
  onConfirmImport,
  onCancelOrBack,
}) => {
  // Input mode: 'file' (Excel / CSV upload) or 'text' (Paste table text)
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parsing results state
  const [parsedRows, setParsedRows] = useState<ParsedManaRow[]>([]);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [groupSamePerson, setGroupSamePerson] = useState(true);
  const [autoLinkMembers, setAutoLinkMembers] = useState(true);
  const [autoAddCatalog, setAutoAddCatalog] = useState(true);

  // Filter & Search inside preview
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewStatusFilter, setPreviewStatusFilter] = useState<'ALL' | 'Quitado' | 'Parcial' | 'Pendente'>('ALL');

  // Notices
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Helper: Normalize string for fuzzy comparison
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  // Helper: Detect Lesson Category from text
  const detectCategory = (text: string): string => {
    const norm = normalize(text);
    if (norm.includes('jovem') || norm.includes('jovens')) return 'Jovens';
    if (norm.includes('adolescente') || norm.includes('adolescentes') || norm.includes('interact')) return 'Adolescentes';
    if (norm.includes('juvenil') || norm.includes('juvenis')) return 'Juvenis';
    if (norm.includes('primario') || norm.includes('primarios')) return 'Primários';
    if (norm.includes('jardim')) return 'Jardim da Infância';
    if (norm.includes('berco') || norm.includes('berço') || norm.includes('rol')) return 'Rol do Berço';
    if (norm.includes('professor') || norm.includes('prof')) return 'Professores';
    if (norm.includes('inspir') || norm.includes('meditacao') || norm.includes('meditação')) return 'Inspiração';
    return 'Adultos';
  };

  // Helper: Find matching lesson in catalog or calculate fallback
  const matchLesson = (lessonText: string): { name: string; category: string; price: number; code?: string } => {
    const norm = normalize(lessonText);
    const cat = detectCategory(lessonText);

    // 1. Try exact or partial match in current catalog
    const matched = lessonCatalog.find((item) => {
      const itemNorm = normalize(item.name);
      return itemNorm === norm || itemNorm.includes(norm) || norm.includes(itemNorm);
    });

    if (matched) {
      return {
        name: matched.name,
        category: matched.category,
        price: matched.price,
        code: matched.code,
      };
    }

    // 2. Category match
    const catMatch = lessonCatalog.find((item) => normalize(item.category) === normalize(cat));
    if (catMatch) {
      return {
        name: lessonText.trim() || catMatch.name,
        category: catMatch.category,
        price: catMatch.price,
        code: catMatch.code,
      };
    }

    // 3. Default fallback
    return {
      name: lessonText.trim() || 'Lição Adultos Aluno',
      category: cat,
      price: 38.0,
    };
  };

  // Helper: Parse currency numbers from string/number
  const parseCurrency = (val: any, fallback = 0): number => {
    if (val === undefined || val === null || val === '') return fallback;
    if (typeof val === 'number') return isNaN(val) ? fallback : Math.max(0, val);
    const cleaned = String(val)
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? fallback : Math.max(0, num);
  };

  // Core parser: Transforms raw 2D array from Excel/CSV/Pasted table into ParsedManaRow[]
  const parseRaw2DData = (data: any[][]) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!data || data.length === 0) {
      setErrorMessage('Nenhum dado encontrado na planilha.');
      return;
    }

    // Clean empty rows
    const nonEmptyRows = data.filter((row) =>
      row && row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== '')
    );

    if (nonEmptyRows.length === 0) {
      setErrorMessage('A planilha está vazia.');
      return;
    }

    // Locate header row & column indexes
    let headerRowIdx = 0;
    let colName = -1;
    let colLesson = -1;
    let colQty = -1;
    let colUnitPrice = -1;
    let colTotalPrice = -1;
    let colPaid = -1;
    let colStatus = -1;
    let colPaymentMethod = -1;
    let colDelivery = -1;
    let colNotes = -1;

    // Scan first 5 rows to locate headers
    for (let r = 0; r < Math.min(5, nonEmptyRows.length); r++) {
      const row = nonEmptyRows[r];
      let matches = 0;

      row.forEach((cell, cIdx) => {
        const text = normalize(String(cell || ''));
        if (
          text.includes('nome') ||
          text.includes('membro') ||
          text.includes('assinante') ||
          text.includes('pessoa') ||
          text.includes('aluno')
        ) {
          colName = cIdx;
          matches++;
        } else if (
          text.includes('licao') ||
          text.includes('lição') ||
          text.includes('produto') ||
          text.includes('revista') ||
          text.includes('plano') ||
          text.includes('titulo') ||
          text.includes('item')
        ) {
          colLesson = cIdx;
          matches++;
        } else if (
          text.includes('qtd') ||
          text.includes('quantidade') ||
          text.includes('exemplar') ||
          text.includes('quant')
        ) {
          colQty = cIdx;
          matches++;
        } else if (
          text.includes('unit') ||
          text.includes('unitario') ||
          text.includes('unitário') ||
          text.includes('preco') ||
          text.includes('preço')
        ) {
          colUnitPrice = cIdx;
          matches++;
        } else if (
          text.includes('total') ||
          text.includes('valor total') ||
          text.includes('subtotal') ||
          text === 'r$' ||
          text === 'valor'
        ) {
          colTotalPrice = cIdx;
          matches++;
        } else if (
          text.includes('pago') ||
          text.includes('valor pago') ||
          text.includes('entrada') ||
          text.includes('quitado')
        ) {
          colPaid = cIdx;
          matches++;
        } else if (
          text.includes('status') ||
          text.includes('situacao') ||
          text.includes('situação') ||
          text.includes('pagamento')
        ) {
          colStatus = cIdx;
          matches++;
        } else if (
          text.includes('forma') ||
          text.includes('meio') ||
          text.includes('metodo') ||
          text.includes('pix')
        ) {
          colPaymentMethod = cIdx;
          matches++;
        } else if (
          text.includes('entrega') ||
          text.includes('entregue')
        ) {
          colDelivery = cIdx;
          matches++;
        } else if (
          text.includes('obs') ||
          text.includes('observ') ||
          text.includes('classe') ||
          text.includes('unidade') ||
          text.includes('telefone') ||
          text.includes('contato')
        ) {
          colNotes = cIdx;
          matches++;
        }
      });

      if (matches >= 2) {
        headerRowIdx = r;
        break;
      }
    }

    // Default column fallback positions if header was not detected
    if (colName === -1) colName = 0;
    if (colLesson === -1 && nonEmptyRows[0].length > 1) colLesson = 1;

    const dataRows = nonEmptyRows.slice(headerRowIdx + 1);
    const parsed: ParsedManaRow[] = [];

    dataRows.forEach((row, idx) => {
      const rawName = String(row[colName] || '').trim();
      if (!rawName) return; // skip empty name rows

      // 1. Match member in Church database
      const normName = normalize(rawName);
      const matchedMember = members.find((m) => {
        const mNorm = normalize(m.name);
        return mNorm === normName || mNorm.startsWith(normName) || normName.startsWith(mNorm);
      });

      // 2. Lesson title & Category
      const rawLesson = colLesson !== -1 ? String(row[colLesson] || '').trim() : '';
      const lessonInfo = matchLesson(rawLesson || 'Lição Adultos Aluno');

      // 3. Quantity
      let qty = 1;
      if (colQty !== -1 && row[colQty] !== undefined) {
        const parsedQ = parseInt(String(row[colQty]).replace(/\D/g, ''), 10);
        if (!isNaN(parsedQ) && parsedQ > 0) qty = parsedQ;
      }

      // 4. Prices
      let unitPrice = lessonInfo.price;
      if (colUnitPrice !== -1 && row[colUnitPrice] !== undefined) {
        const p = parseCurrency(row[colUnitPrice], 0);
        if (p > 0) unitPrice = p;
      }

      let totalPrice = unitPrice * qty;
      if (colTotalPrice !== -1 && row[colTotalPrice] !== undefined) {
        const tp = parseCurrency(row[colTotalPrice], 0);
        if (tp > 0) totalPrice = tp;
      }

      // 5. Amount Paid & Status
      let amountPaid = 0;
      let rawStatusText = colStatus !== -1 ? String(row[colStatus] || '').trim().toLowerCase() : '';

      if (colPaid !== -1 && row[colPaid] !== undefined) {
        const paidVal = row[colPaid];
        if (typeof paidVal === 'string' && (paidVal.toLowerCase().includes('quit') || paidVal.toLowerCase() === 'sim' || paidVal.toLowerCase() === 'pago')) {
          amountPaid = totalPrice;
        } else {
          amountPaid = parseCurrency(paidVal, 0);
        }
      } else if (rawStatusText.includes('quit') || rawStatusText.includes('pago') || rawStatusText === 'sim') {
        amountPaid = totalPrice;
      }

      let status: 'Quitado' | 'Parcial' | 'Pendente' = 'Pendente';
      if (amountPaid >= totalPrice && totalPrice > 0) {
        status = 'Quitado';
      } else if (amountPaid > 0 && amountPaid < totalPrice) {
        status = 'Parcial';
      } else if (rawStatusText.includes('quit') || rawStatusText.includes('pago')) {
        status = 'Quitado';
        amountPaid = totalPrice;
      } else if (rawStatusText.includes('parcial')) {
        status = 'Parcial';
      }

      // 6. Payment Method
      let paymentMethod: PaymentMethod = 'Pix';
      if (colPaymentMethod !== -1 && row[colPaymentMethod]) {
        const pmText = normalize(String(row[colPaymentMethod]));
        if (pmText.includes('dinheiro') || pmText.includes('especie') || pmText.includes('espécie')) paymentMethod = 'Dinheiro';
        else if (pmText.includes('credito') || pmText.includes('crédito')) paymentMethod = 'Cartão de Crédito';
        else if (pmText.includes('debito') || pmText.includes('débito')) paymentMethod = 'Cartão de Débito';
        else if (pmText.includes('transf') || pmText.includes('ted') || pmText.includes('doc')) paymentMethod = 'Transferência';
        else paymentMethod = 'Pix';
      }

      // 7. Delivery Status
      let deliveryStatus: 'Entregue' | 'Pendente' | 'A caminho' = 'Pendente';
      if (colDelivery !== -1 && row[colDelivery]) {
        const delText = normalize(String(row[colDelivery]));
        if (delText.includes('entreg') || delText.includes('ok') || delText.includes('sim')) deliveryStatus = 'Entregue';
        else if (delText.includes('caminho') || delText.includes('transito') || delText.includes('trânsito') || delText.includes('enviad')) deliveryStatus = 'A caminho';
      }

      // 8. Notes
      const notes = colNotes !== -1 && row[colNotes] ? String(row[colNotes]).trim() : '';

      parsed.push({
        id: `row-${idx}-${Date.now()}`,
        selected: true,
        memberName: rawName,
        matchedMemberId: matchedMember?.id,
        isMatchedMember: !!matchedMember,
        lessonName: lessonInfo.name,
        category: lessonInfo.category,
        quantity: qty,
        unitPrice,
        totalPrice,
        amountPaid,
        paymentMethod,
        status,
        deliveryStatus,
        notes,
      });
    });

    if (parsed.length === 0) {
      setErrorMessage('Nenhum registro com nome de membro foi identificado na planilha. Verifique se as linhas contêm nomes válidos.');
    } else {
      setParsedRows(parsed);
      setSuccessMessage(`${parsed.length} assinatura(s) encontrada(s) e processada(s) com sucesso na planilha!`);
    }
  };

  // Handle File Upload (.xlsx, .xls, .csv)
  const handleFileUpload = (file: File) => {
    setSelectedFileName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const bstr = e.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        parseRaw2DData(data);
      } catch (err) {
        setErrorMessage('Erro ao ler o arquivo Excel/CSV. Verifique se o arquivo não está corrompido ou protegido por senha.');
      }
    };

    reader.readAsBinaryString(file);
  };

  // Drag & Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Handle Pasted Text Parsing
  const handleParsePastedText = () => {
    if (!rawText.trim()) {
      setErrorMessage('Cole o texto da tabela ou do Excel no campo antes de processar.');
      return;
    }

    const lines = rawText.split(/\r?\n/).filter((l) => l.trim() !== '');
    const data2D: string[][] = lines.map((line) => {
      // Split by tab (standard for Excel/Sheets copy-paste), or semicolon, or pipe
      if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
      if (line.includes(';')) return line.split(';').map((c) => c.trim());
      if (line.includes('|')) return line.split('|').map((c) => c.trim()).filter((c) => c !== '');
      return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => c.replace(/^"|"$/g, '').trim());
    });

    parseRaw2DData(data2D);
  };

  // Download Sample Excel (.xlsx)
  const downloadSampleExcel = () => {
    const sampleRows = [
      {
        'Nome do Assinante': 'Marcos Oliveira',
        'Lição / Revista': 'Lição Adultos Aluno',
        Quantidade: 1,
        'Valor Unitário': 38.0,
        'Valor Total': 38.0,
        'Valor Pago': 38.0,
        'Forma de Pagamento': 'Pix',
        'Situação': 'Quitado',
        'Status da Entrega': 'Entregue',
        'Observações': 'Classe Ebenézer',
      },
      {
        'Nome do Assinante': 'Ana Paula Santos',
        'Lição / Revista': 'Lição Adultos Aluno - Letra Gigante',
        Quantidade: 1,
        'Valor Unitário': 45.0,
        'Valor Total': 45.0,
        'Valor Pago': 45.0,
        'Forma de Pagamento': 'Dinheiro',
        'Situação': 'Quitado',
        'Status da Entrega': 'Entregue',
        'Observações': 'Paga sempre adiantado',
      },
      {
        'Nome do Assinante': 'Carlos Eduardo Lima',
        'Lição / Revista': 'Lição Jovens Aluno',
        Quantidade: 2,
        'Valor Unitário': 38.0,
        'Valor Total': 76.0,
        'Valor Pago': 38.0,
        'Forma de Pagamento': 'Pix',
        'Situação': 'Parcial',
        'Status da Entrega': 'A caminho',
        'Observações': '1 para ele e 1 para visita',
      },
      {
        'Nome do Assinante': 'Fernanda Costa',
        'Lição / Revista': 'Lição Primários Aluno',
        Quantidade: 1,
        'Valor Unitário': 38.0,
        'Valor Total': 38.0,
        'Valor Pago': 0.0,
        'Forma de Pagamento': 'Pix',
        'Situação': 'Pendente',
        'Status da Entrega': 'Pendente',
        'Observações': 'Filho: Davi Costa',
      },
      {
        'Nome do Assinante': 'Pr. Ricardo Santos',
        'Lição / Revista': 'Lição Adultos Professor',
        Quantidade: 1,
        'Valor Unitário': 42.0,
        'Valor Total': 42.0,
        'Valor Pago': 42.0,
        'Forma de Pagamento': 'Pix',
        'Situação': 'Quitado',
        'Status da Entrega': 'Entregue',
        'Observações': 'Pastor Distrital',
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Assinaturas Maná');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo_importacao_projeto_mana.xlsx';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Download Sample CSV
  const downloadSampleCSV = () => {
    const csvContent =
      'Nome do Assinante;Lição / Revista;Quantidade;Valor Unitário;Valor Total;Valor Pago;Forma de Pagamento;Situação;Status da Entrega;Observações\n' +
      'Marcos Oliveira;Lição Adultos Aluno;1;38.00;38.00;38.00;Pix;Quitado;Entregue;Classe Ebenézer\n' +
      'Ana Paula Santos;Lição Adultos Aluno - Letra Gigante;1;45.00;45.00;45.00;Dinheiro;Quitado;Entregue;Paga adiantado\n' +
      'Carlos Eduardo Lima;Lição Jovens Aluno;2;38.00;76.00;38.00;Pix;Parcial;A caminho;1 para ele e 1 para visita\n' +
      'Fernanda Costa;Lição Primários Aluno;1;38.00;38.00;0.00;Pix;Pendente;Pendente;Filho: Davi Costa\n' +
      'Pr. Ricardo Santos;Lição Adultos Professor;1;42.00;42.00;42.00;Pix;Quitado;Entregue;Pastor Distrital\n';

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo_importacao_projeto_mana.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Toggle selection for all or single row
  const handleToggleSelectAll = (checked: boolean) => {
    setParsedRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  };

  const handleToggleRow = (id: string) => {
    setParsedRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r))
    );
  };

  const handleDeleteRow = (id: string) => {
    setParsedRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Filtered rows for preview display
  const filteredPreviewRows = useMemo(() => {
    return parsedRows.filter((r) => {
      const matchSearch =
        r.memberName.toLowerCase().includes(previewSearch.toLowerCase()) ||
        r.lessonName.toLowerCase().includes(previewSearch.toLowerCase()) ||
        (r.notes || '').toLowerCase().includes(previewSearch.toLowerCase());
      const matchStatus = previewStatusFilter === 'ALL' || r.status === previewStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [parsedRows, previewSearch, previewStatusFilter]);

  // Selected rows stats
  const selectedRows = useMemo(() => parsedRows.filter((r) => r.selected), [parsedRows]);

  const stats = useMemo(() => {
    const totalQty = selectedRows.reduce((sum, r) => sum + r.quantity, 0);
    const totalVal = selectedRows.reduce((sum, r) => sum + r.totalPrice, 0);
    const totalPaid = selectedRows.reduce((sum, r) => sum + r.amountPaid, 0);
    const totalPending = Math.max(0, totalVal - totalPaid);
    const matchedMembersCount = selectedRows.filter((r) => r.isMatchedMember).length;

    return {
      count: selectedRows.length,
      totalQty,
      totalVal,
      totalPaid,
      totalPending,
      matchedMembersCount,
    };
  }, [selectedRows]);

  // Confirm Import Execution
  const handleExecuteImport = () => {
    if (selectedRows.length === 0) {
      setErrorMessage('Selecione pelo menos uma linha para importar.');
      return;
    }

    // 1. Identify any new lesson catalog items to auto-register
    const newCatalogItems: LessonCatalogItem[] = [];
    if (autoAddCatalog) {
      selectedRows.forEach((r) => {
        const exists = lessonCatalog.some(
          (cat) => normalize(cat.name) === normalize(r.lessonName)
        );
        const alreadyInNew = newCatalogItems.some(
          (cat) => normalize(cat.name) === normalize(r.lessonName)
        );
        if (!exists && !alreadyInNew) {
          newCatalogItems.push({
            id: `cat-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            code: `CPB-IMP-${newCatalogItems.length + 1}`,
            name: r.lessonName,
            category: r.category,
            price: r.unitPrice,
          });
        }
      });
    }

    // 2. Build final subscription items
    let finalSubscriptions: Omit<ManaSubscription, 'id'>[] = [];

    if (groupSamePerson) {
      // Group rows by subscriber name
      const groupedMap = new Map<string, ParsedManaRow[]>();
      selectedRows.forEach((r) => {
        const key = normalize(r.memberName);
        const existing = groupedMap.get(key) || [];
        existing.push(r);
        groupedMap.set(key, existing);
      });

      groupedMap.forEach((rows) => {
        const first = rows[0];
        const items: ManaOrderItem[] = rows.map((r, itemIdx) => ({
          lessonId: `item-${Date.now()}-${itemIdx}`,
          lessonName: r.lessonName,
          category: r.category,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          totalPrice: r.totalPrice,
        }));

        const totalAmount = rows.reduce((acc, r) => acc + r.totalPrice, 0);
        const amountPaid = rows.reduce((acc, r) => acc + r.amountPaid, 0);
        const allNotes = rows
          .map((r) => r.notes)
          .filter(Boolean)
          .join(' | ');

        let status: 'Quitado' | 'Parcial' | 'Pendente' = 'Pendente';
        if (amountPaid >= totalAmount && totalAmount > 0) status = 'Quitado';
        else if (amountPaid > 0) status = 'Parcial';

        finalSubscriptions.push({
          memberId: autoLinkMembers && first.matchedMemberId ? first.matchedMemberId : '',
          memberName: first.memberName,
          items,
          totalAmount,
          amountPaid,
          paymentMethod: first.paymentMethod,
          status,
          quarterlyDelivery: {
            q1: first.deliveryStatus,
            q2: 'Pendente',
            q3: 'Pendente',
            q4: 'Pendente',
          },
          deliveryStatus: first.deliveryStatus,
          year: 2026,
          createdAt: new Date().toISOString().slice(0, 10),
          notes: allNotes || 'Importado via Planilha Excel',
          payments:
            amountPaid > 0
              ? [
                  {
                    id: `pay-${Date.now()}`,
                    date: new Date().toISOString().slice(0, 10),
                    amount: amountPaid,
                    method: first.paymentMethod,
                    notes: 'Pagamento inicial importado da planilha',
                  },
                ]
              : [],
        });
      });
    } else {
      // Individual subscriptions per row
      finalSubscriptions = selectedRows.map((r, idx) => ({
        memberId: autoLinkMembers && r.matchedMemberId ? r.matchedMemberId : '',
        memberName: r.memberName,
        items: [
          {
            lessonId: `item-${Date.now()}-${idx}`,
            lessonName: r.lessonName,
            category: r.category,
            quantity: r.quantity,
            unitPrice: r.unitPrice,
            totalPrice: r.totalPrice,
          },
        ],
        totalAmount: r.totalPrice,
        amountPaid: r.amountPaid,
        paymentMethod: r.paymentMethod,
        status: r.status,
        quarterlyDelivery: {
          q1: r.deliveryStatus,
          q2: 'Pendente',
          q3: 'Pendente',
          q4: 'Pendente',
        },
        deliveryStatus: r.deliveryStatus,
        year: 2026,
        createdAt: new Date().toISOString().slice(0, 10),
        notes: r.notes || 'Importado via Planilha Excel',
        payments:
          r.amountPaid > 0
            ? [
                {
                  id: `pay-${Date.now()}-${idx}`,
                  date: new Date().toISOString().slice(0, 10),
                  amount: r.amountPaid,
                  method: r.paymentMethod,
                  notes: 'Pagamento inicial importado da planilha',
                },
              ]
            : [],
      }));
    }

    onConfirmImport(
      finalSubscriptions,
      importMode,
      newCatalogItems.length > 0 ? newCatalogItems : undefined
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* 1. Header & Instructions Banner */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-200/90 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#6b1d2f] bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                PROJETO MANÁ 2026 / 2027
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                Leitor Inteligente de Planilhas
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-gray-900 flex items-center gap-2.5 tracking-tight">
              <FileSpreadsheet className="w-6 h-6 text-[#6b1d2f]" />
              Importar Listagem de Assinaturas do Excel
            </h2>
            <p className="text-xs text-gray-600 max-w-3xl leading-relaxed">
              Carregue a planilha da sua igreja (.xlsx, .xls ou .csv) ou cole a tabela copiada do Excel. O sistema reconhece automaticamente os nomes dos assinantes, quantidades, valores pagos, lições solicitadas e cruza com a lista de membros cadastrados.
            </p>
          </div>

          {/* Quick Model Download Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-stretch lg:self-auto justify-end">
            <button
              type="button"
              onClick={downloadSampleExcel}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Baixar planilha modelo formatada em Excel"
            >
              <Download className="w-4 h-4 text-emerald-700" />
              <span>Baixar Modelo (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={downloadSampleCSV}
              className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Baixar modelo em formato CSV"
            >
              <FileText className="w-4 h-4 text-gray-600" />
              <span>Modelo (.csv)</span>
            </button>
          </div>
        </div>

        {/* Notices */}
        {errorMessage && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl font-bold text-xs flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-700 hover:text-red-900 font-bold text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold text-xs flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 2. Upload / Input Area */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-xs space-y-4">
        {/* Toggle Mode */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setInputMode('file')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                inputMode === 'file'
                  ? 'bg-white text-[#6b1d2f] shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Arquivo (.xlsx / .xls / .csv)</span>
            </button>

            <button
              type="button"
              onClick={() => setInputMode('text')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                inputMode === 'text'
                  ? 'bg-white text-[#6b1d2f] shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Colar Tabela / Copiar do Excel</span>
            </button>
          </div>

          <div className="text-[11px] text-gray-500 font-medium">
            Formatos aceitos: Planilhas Excel (.xlsx, .xls), Arquivo CSV ou colagem direta com tabulação.
          </div>
        </div>

        {/* Input Option 1: File Dropzone */}
        {inputMode === 'file' && (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
              dragActive
                ? 'border-[#6b1d2f] bg-rose-50/50 scale-[1.01]'
                : 'border-gray-300 hover:border-[#6b1d2f]/60 hover:bg-gray-50/80 bg-gray-50/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-8 h-8" />
            </div>

            <div className="space-y-1 max-w-md">
              <p className="text-sm font-extrabold text-gray-900">
                {selectedFileName
                  ? `Arquivo selecionado: ${selectedFileName}`
                  : 'Clique para selecionar ou arraste sua planilha Excel aqui'}
              </p>
              <p className="text-xs text-gray-500">
                Suporte automático para planilhas da CPB, relatórios de igreja ou modelos personalizados
              </p>
            </div>

            <span className="px-4 py-2 bg-[#6b1d2f] hover:bg-[#4a121f] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all">
              {selectedFileName ? 'Trocar Planilha' : 'Selecionar Arquivo do Computador'}
            </span>
          </div>
        )}

        {/* Input Option 2: Paste Raw Text */}
        {inputMode === 'text' && (
          <div className="space-y-3">
            <label className="block text-xs font-bold text-gray-800">
              Cole abaixo as linhas copiadas do seu Excel ou Google Planilhas (Ctrl + V):
            </label>
            <textarea
              rows={6}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Nome\tLição\tQuantidade\tValor\tPago\tStatus\nMarcos Oliveira\tLição Adultos Aluno\t1\t38,00\t38,00\tQuitado\nAna Paula Santos\tLição Letra Gigante\t1\t45,00\t45,00\tQuitado`}
              className="w-full p-3 font-mono text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRawText('')}
                className="px-3 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 rounded-xl cursor-pointer"
              >
                Limpar Texto
              </button>
              <button
                type="button"
                onClick={handleParsePastedText}
                className="px-4 py-2 bg-[#6b1d2f] hover:bg-[#4a121f] text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Processar Dados Colados</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Preview & Configuration Table (if parsed rows exist) */}
      {parsedRows.length > 0 && (
        <div className="space-y-4 animate-in fade-in">
          {/* Options Card */}
          <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-200/90 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2.5">
              <Layers className="w-4 h-4 text-[#6b1d2f]" />
              Opções de Importação e Integração
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* Mode: Append vs Replace */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <label className="font-bold text-gray-800 block">Modo de Gravação:</label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="text-[#6b1d2f] focus:ring-[#6b1d2f]"
                    />
                    <span>Adicionar aos pedidos existentes ({currentSubscriptions.length})</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-rose-700">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-[#6b1d2f] focus:ring-[#6b1d2f]"
                    />
                    <span>Substituir todos os pedidos do Maná</span>
                  </label>
                </div>
              </div>

              {/* Grouping */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <label className="font-bold text-gray-800 block">Agrupamento de Itens:</label>
                <label className="flex items-start gap-2 cursor-pointer font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={groupSamePerson}
                    onChange={(e) => setGroupSamePerson(e.target.checked)}
                    className="mt-0.5 text-[#6b1d2f] rounded focus:ring-[#6b1d2f]"
                  />
                  <span>Agrupar múltiplos itens da mesma pessoa em um único pedido</span>
                </label>
              </div>

              {/* Auto Link Members */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <label className="font-bold text-gray-800 block">Vínculo com a Igreja:</label>
                <label className="flex items-start gap-2 cursor-pointer font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={autoLinkMembers}
                    onChange={(e) => setAutoLinkMembers(e.target.checked)}
                    className="mt-0.5 text-[#6b1d2f] rounded focus:ring-[#6b1d2f]"
                  />
                  <span>Vincular nomes aos {members.length} membros já cadastrados</span>
                </label>
              </div>

              {/* Auto Register Catalog */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <label className="font-bold text-gray-800 block">Catálogo de Preços:</label>
                <label className="flex items-start gap-2 cursor-pointer font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={autoAddCatalog}
                    onChange={(e) => setAutoAddCatalog(e.target.checked)}
                    className="mt-0.5 text-[#6b1d2f] rounded focus:ring-[#6b1d2f]"
                  />
                  <span>Cadastrar novas lições no Catálogo de Preços automaticamente</span>
                </label>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-gray-200/90 shadow-xs">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Selecionados</span>
              <p className="text-lg font-black text-[#6b1d2f]">{stats.count} / {parsedRows.length}</p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-gray-200/90 shadow-xs">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Exemplares</span>
              <p className="text-lg font-black text-gray-900">{stats.totalQty} un</p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-gray-200/90 shadow-xs">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Previsto</span>
              <p className="text-lg font-black text-gray-900">R$ {stats.totalVal.toFixed(2)}</p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-gray-200/90 shadow-xs">
              <span className="text-[10px] font-bold text-emerald-600 uppercase block">Valor Quitado</span>
              <p className="text-lg font-black text-emerald-700">R$ {stats.totalPaid.toFixed(2)}</p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-gray-200/90 shadow-xs">
              <span className="text-[10px] font-bold text-rose-600 uppercase block">Valor Pendente</span>
              <p className="text-lg font-black text-rose-700">R$ {stats.totalPending.toFixed(2)}</p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-gray-200/90 shadow-xs">
              <span className="text-[10px] font-bold text-blue-600 uppercase block">Membros Igreja</span>
              <p className="text-lg font-black text-blue-800">{stats.matchedMembersCount} vinculados</p>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden space-y-3 p-4">
            {/* Filters and Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filtrar por nome ou lição..."
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
                  />
                </div>

                <select
                  value={previewStatusFilter}
                  onChange={(e) => setPreviewStatusFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
                >
                  <option value="ALL">Todos os Status</option>
                  <option value="Quitado">Quitados</option>
                  <option value="Parcial">Pagamento Parcial</option>
                  <option value="Pendente">Pendentes</option>
                </select>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => handleToggleSelectAll(true)}
                  className="text-xs font-bold text-[#6b1d2f] hover:underline cursor-pointer"
                >
                  Marcar Todos
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => handleToggleSelectAll(false)}
                  className="text-xs font-bold text-gray-500 hover:text-gray-800 cursor-pointer"
                >
                  Desmarcar Todos
                </button>
              </div>
            </div>

            {/* Preview Table */}
            <div className="border border-gray-200 rounded-xl overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-700 font-extrabold uppercase text-[10px] sticky top-0 z-10 border-b border-gray-200">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedRows.length === parsedRows.length && parsedRows.length > 0}
                        onChange={(e) => handleToggleSelectAll(e.target.checked)}
                        className="rounded text-[#6b1d2f] focus:ring-[#6b1d2f]"
                      />
                    </th>
                    <th className="p-3">#</th>
                    <th className="p-3">Assinante / Membro</th>
                    <th className="p-3">Lição / Produto</th>
                    <th className="p-3 text-center">Qtd</th>
                    <th className="p-3 text-right">Unitário</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-right">Pago</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Forma</th>
                    <th className="p-3 text-center">Entrega</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPreviewRows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        !row.selected ? 'opacity-40 bg-gray-50/50' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => handleToggleRow(row.id)}
                          className="rounded text-[#6b1d2f] focus:ring-[#6b1d2f] cursor-pointer"
                        />
                      </td>
                      <td className="p-3 text-gray-400 font-mono text-[10px]">{idx + 1}</td>
                      <td className="p-3 font-bold text-gray-900">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{row.memberName}</span>
                          {row.isMatchedMember ? (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              Membro
                            </span>
                          ) : (
                            <span className="text-[9px] font-medium text-gray-400">
                              Externo
                            </span>
                          )}
                        </div>
                        {row.notes && (
                          <span className="text-[10px] text-gray-400 block truncate max-w-xs">
                            {row.notes}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-gray-800">{row.lessonName}</div>
                        <span className="text-[10px] text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/60 font-bold">
                          {row.category}
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold text-gray-900">{row.quantity}x</td>
                      <td className="p-3 text-right text-gray-600">R$ {row.unitPrice.toFixed(2)}</td>
                      <td className="p-3 text-right font-black text-gray-900">R$ {row.totalPrice.toFixed(2)}</td>
                      <td className="p-3 text-right font-black text-emerald-800">
                        R$ {row.amountPaid.toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            row.status === 'Quitado'
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.status === 'Parcial'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="p-3 text-center font-medium text-gray-600">{row.paymentMethod}</td>
                      <td className="p-3 text-center">
                        <span className="text-[10px] font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                          {row.deliveryStatus}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                          className="p-1 text-red-400 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                          title="Remover linha da importação"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setParsedRows([]);
                  setSelectedFileName(null);
                  setRawText('');
                }}
                className="text-xs font-bold text-gray-500 hover:text-gray-800 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpar e Carregar Outro Arquivo</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onCancelOrBack}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Voltar para Pedidos
                </button>

                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={stats.count === 0}
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl shadow-lg cursor-pointer flex items-center gap-2 transition-all"
                >
                  <Check className="w-4 h-4 text-[#d4af37]" />
                  <span>Confirmar e Importar {stats.count} Assinatura(s)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
