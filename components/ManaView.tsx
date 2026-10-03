'use client';

import React, { useState, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  ManaSubscription,
  Member,
  LessonCatalogItem,
  ManaOrderItem,
  PaymentMethod,
  ManaPayment,
  ClassUnit,
} from '@/lib/types';
import { AVAILABLE_YEARS } from '@/lib/data';
import { ManaExcelImportView } from '@/components/ManaExcelImportView';
import {
  BookMarked,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShoppingCart,
  DollarSign,
  Award,
  X,
  Check,
  Search,
  Filter,
  Trash2,
  Edit3,
  FileSpreadsheet,
  Upload,
  Receipt,
  Printer,
  ChevronRight,
  TrendingUp,
  Package,
  Layers,
  Sparkles,
  CreditCard,
  ArrowUpRight,
  Copy,
  ExternalLink,
  FileText,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Building,
  Users,
  Paperclip,
  PackageCheck,
} from 'lucide-react';
import { DeliveryAttachmentModal } from '@/components/DeliveryAttachmentModal';

interface ManaViewProps {
  manaSubscriptions: ManaSubscription[];
  members: Member[];
  classes?: ClassUnit[];
  lessonCatalog: LessonCatalogItem[];
  onAddMana: (newMana: Omit<ManaSubscription, 'id'>) => void;
  onAddMultipleMana?: (newOrders: Omit<ManaSubscription, 'id'>[]) => void;
  onReplaceAllMana?: (allOrders: ManaSubscription[]) => void;
  onUpdateManaOrder: (updatedOrder: ManaSubscription) => void;
  onDeleteManaOrder: (id: string) => void;
  onUpdateManaStatus: (
    id: string,
    status: ManaSubscription['status'],
    deliveryStatus: ManaSubscription['deliveryStatus']
  ) => void;
  onSaveLessonCatalog: (updatedCatalog: LessonCatalogItem[]) => void;
  selectedQuarter: number;
  selectedYear?: number;
  onSelectQuarter: (quarter: number) => void;
  onSelectYear?: (year: number) => void;
}

export const ManaView: React.FC<ManaViewProps> = ({
  manaSubscriptions,
  members,
  classes = [],
  lessonCatalog,
  onAddMana,
  onAddMultipleMana,
  onReplaceAllMana,
  onUpdateManaOrder,
  onDeleteManaOrder,
  onUpdateManaStatus,
  onSaveLessonCatalog,
  selectedQuarter,
  selectedYear = 2026,
  onSelectQuarter,
  onSelectYear,
}) => {
  // Main view active tab: 'pedidos' | 'unidades' | 'importar' | 'cadastro' | 'relatorio'
  const [activeTab, setActiveTab] = useState<'pedidos' | 'unidades' | 'importar' | 'cadastro' | 'relatorio'>('pedidos');

  // Search & Filter state for Orders
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Quitado' | 'Parcial' | 'Pendente' | 'ComAnexo' | 'SemAnexo'>('ALL');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const [unitSpecificStatusFilter, setUnitSpecificStatusFilter] = useState<Record<string, 'ALL' | 'Quitado' | 'Parcial' | 'Pendente'>>({});

  // Modal State for Delivery Attachment per Quarter
  const [deliveryModalOrder, setDeliveryModalOrder] = useState<ManaSubscription | null>(null);
  const [deliveryModalQuarter, setDeliveryModalQuarter] = useState<number>(selectedQuarter);

  // Modal State for Order (New or Edit)
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // Order Form State
  const [orderMemberId, setOrderMemberId] = useState('');
  const [orderMemberName, setOrderMemberName] = useState('');
  const [orderItems, setOrderItems] = useState<ManaOrderItem[]>([]);
  const [orderPaymentMethod, setOrderPaymentMethod] = useState<PaymentMethod>('Pix');
  const [orderAmountPaid, setOrderAmountPaid] = useState<number>(0);
  const [orderNotes, setOrderNotes] = useState('');
  // Split / Multi-method payment list
  const [orderPayments, setOrderPayments] = useState<ManaPayment[]>([]);

  // Modal State for Quick Payment
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<ManaSubscription | null>(null);
  const [newPaymentAmount, setNewPaymentAmount] = useState<number>(0);
  const [newPaymentMethod, setNewPaymentMethod] = useState<PaymentMethod>('Pix');
  const [newPaymentDate, setNewPaymentDate] = useState<string>('');
  const [newPaymentNotes, setNewPaymentNotes] = useState<string>('');

  // Modal State for Adding / Editing Lesson Catalog Item
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catalogFormData, setCatalogFormData] = useState<{
    id?: string;
    code: string;
    name: string;
    category: string;
    price: number;
  }>({
    code: '',
    name: '',
    category: 'Adultos',
    price: 38.0,
  });

  // Modal State for deleting catalog item or order
  const [catalogItemToDelete, setCatalogItemToDelete] = useState<LessonCatalogItem | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<ManaSubscription | null>(null);

  // Batch Import from Church Members State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [batchSearchTerm, setBatchSearchTerm] = useState('');
  const [batchClassFilter, setBatchClassFilter] = useState('ALL');
  const [batchSelectedMemberIds, setBatchSelectedMemberIds] = useState<string[]>([]);
  const [batchLessonId, setBatchLessonId] = useState<string>('');
  const [batchPaymentStatus, setBatchPaymentStatus] = useState<'Pendente' | 'Quitado'>('Pendente');

  // Form error & success message banners
  const [orderFormError, setOrderFormError] = useState<string | null>(null);
  const [orderSuccessNotice, setOrderSuccessNotice] = useState<string | null>(null);
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Member selection mode for order form: 'db' (Church Members) vs 'custom' (Custom subscriber)
  const [orderMemberMode, setOrderMemberMode] = useState<'db' | 'custom'>('db');

  // Open batch import modal
  const handleOpenBatchModal = () => {
    setBatchSearchTerm('');
    setBatchClassFilter('ALL');
    setBatchSelectedMemberIds(members.map((m) => m.id));
    setBatchLessonId(lessonCatalog[0]?.id || '');
    setBatchPaymentStatus('Pendente');
    setIsBatchModalOpen(true);
  };

  // Toggle all members in batch import modal
  const handleToggleAllBatchMembers = () => {
    if (batchSelectedMemberIds.length === members.length) {
      setBatchSelectedMemberIds([]);
    } else {
      setBatchSelectedMemberIds(members.map((m) => m.id));
    }
  };

  // Toggle single member in batch import modal
  const handleToggleBatchMember = (id: string) => {
    setBatchSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  // Submit batch import from church members
  const handleConfirmBatchImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (batchSelectedMemberIds.length === 0) {
      alert('Selecione pelo menos um membro para importar.');
      return;
    }

    const selectedLesson = lessonCatalog.find((l) => l.id === batchLessonId) || lessonCatalog[0];
    if (!selectedLesson) {
      alert('Selecione uma lição do catálogo.');
      return;
    }

    const currentQuarterKey = `q${selectedQuarter}` as 'q1' | 'q2' | 'q3' | 'q4';
    let addedCount = 0;

    batchSelectedMemberIds.forEach((mId, index) => {
      const member = members.find((m) => m.id === mId);
      if (!member) return;

      const totalAmount = selectedLesson.price;
      const amountPaid = batchPaymentStatus === 'Quitado' ? totalAmount : 0;

      const newOrder: Omit<ManaSubscription, 'id'> = {
        memberId: member.id,
        memberName: member.name,
        items: [
          {
            lessonId: selectedLesson.id,
            lessonName: selectedLesson.name,
            category: selectedLesson.category,
            quantity: 1,
            unitPrice: selectedLesson.price,
            totalPrice: selectedLesson.price,
          },
        ],
        totalAmount,
        amountPaid,
        paymentMethod: 'Pix',
        status: batchPaymentStatus === 'Quitado' ? 'Quitado' : 'Pendente',
        quarterlyDelivery: {
          q1: 'Pendente',
          q2: 'Pendente',
          q3: 'Pendente',
          q4: 'Pendente',
          [currentQuarterKey]: 'A caminho',
        },
        deliveryStatus: 'A caminho',
        year: 2026,
        createdAt: new Date().toISOString().slice(0, 10),
        notes: `Importado em lote dos Membros da Igreja (${member.className})`,
        payments:
          amountPaid > 0
            ? [
                {
                  id: `pm-${Date.now()}-${index}`,
                  date: new Date().toISOString().slice(0, 10),
                  amount: amountPaid,
                  method: 'Pix',
                },
              ]
            : [],
      };

      onAddMana(newOrder);
      addedCount++;
    });

    setIsBatchModalOpen(false);
    setOrderSuccessNotice(`${addedCount} pedido(s) gerado(s) com sucesso a partir dos Membros da Igreja!`);
  };

  // Calculate Order Total dynamically
  const calculatedOrderTotal = useMemo(() => {
    return orderItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice || 0), 0);
  }, [orderItems]);

  // Calculate sum of payments entered in order modal
  const totalPaidInOrderModal = useMemo(() => {
    return orderPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [orderPayments]);

  const remainingBalanceInOrderModal = useMemo(() => {
    return Math.max(0, calculatedOrderTotal - totalPaidInOrderModal);
  }, [calculatedOrderTotal, totalPaidInOrderModal]);

  // Helper to add a payment installment / split payment in order form
  const handleAddPaymentEntry = (method: PaymentMethod = 'Pix', customAmount?: number) => {
    const defaultAmount = customAmount !== undefined ? customAmount : remainingBalanceInOrderModal;
    const newEntry: ManaPayment = {
      id: `pm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: new Date().toISOString().slice(0, 10),
      amount: Math.max(0, defaultAmount),
      method,
      notes: '',
    };
    setOrderPayments((prev) => [...prev, newEntry]);
  };

  const handleUpdatePaymentEntry = (
    index: number,
    field: keyof ManaPayment,
    value: any
  ) => {
    setOrderPayments((prev) => {
      const updated = [...prev];
      const entry = { ...updated[index] };
      if (field === 'amount') {
        const parsed = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : Number(value);
        entry.amount = Math.max(0, isNaN(parsed) ? 0 : parsed);
      } else if (field === 'method') {
        entry.method = value as PaymentMethod;
      } else if (field === 'date') {
        entry.date = value;
      } else if (field === 'notes') {
        entry.notes = value;
      }
      updated[index] = entry;
      return updated;
    });
  };

  const handleRemovePaymentEntry = (index: number) => {
    setOrderPayments((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Quick preset helper buttons
  const handleSetQuickSinglePayment = (method: PaymentMethod, fullAmount = true) => {
    const amt = fullAmount ? calculatedOrderTotal : remainingBalanceInOrderModal;
    setOrderPayments([
      {
        id: `pm-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        amount: amt,
        method,
        notes: '',
      },
    ]);
  };

  // Open modal to launch new order
  const handleOpenNewOrderModal = () => {
    setEditingOrderId(null);
    setOrderFormError(null);
    setOrderMemberMode(members.length > 0 ? 'db' : 'custom');
    const defaultMember = members[0];
    setOrderMemberId(defaultMember?.id || '');
    setOrderMemberName(defaultMember?.name || '');

    // Default item from catalog
    const defaultLesson = lessonCatalog[0];
    if (defaultLesson) {
      setOrderItems([
        {
          lessonId: defaultLesson.id,
          lessonName: defaultLesson.name,
          category: defaultLesson.category,
          quantity: 1,
          unitPrice: defaultLesson.price,
          totalPrice: defaultLesson.price,
        },
      ]);
      setOrderPayments([
        {
          id: `pm-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          amount: defaultLesson.price,
          method: 'Pix',
          notes: '',
        },
      ]);
    } else {
      setOrderItems([]);
      setOrderPayments([]);
    }

    setOrderPaymentMethod('Pix');
    setOrderNotes('');
    setIsOrderModalOpen(true);
  };

  // Open modal to edit existing order
  const handleOpenEditOrderModal = (order: ManaSubscription) => {
    setEditingOrderId(order.id);
    setOrderFormError(null);
    const existingMember = members.find(
      (m) => m.id === order.memberId || m.name.toLowerCase() === order.memberName.toLowerCase()
    );
    if (existingMember) {
      setOrderMemberMode('db');
      setOrderMemberId(existingMember.id);
      setOrderMemberName(existingMember.name);
    } else {
      setOrderMemberMode('custom');
      setOrderMemberId(order.memberId || '');
      setOrderMemberName(order.memberName || '');
    }
    setOrderItems(order.items || []);
    
    // Load existing payment breakdown or migrate single payment
    if (order.payments && order.payments.length > 0) {
      setOrderPayments(order.payments.map((p) => ({ ...p })));
    } else if ((order.amountPaid || 0) > 0) {
      setOrderPayments([
        {
          id: `pm-${Date.now()}`,
          date: order.createdAt || new Date().toISOString().slice(0, 10),
          amount: order.amountPaid,
          method: order.paymentMethod || 'Dinheiro',
          notes: order.notes || '',
        },
      ]);
    } else {
      setOrderPayments([]);
    }

    setOrderPaymentMethod(order.paymentMethod || 'Pix');
    setOrderNotes(order.notes || '');
    setIsOrderModalOpen(true);
  };

  // Handle Member selection in order form
  const handleMemberChange = (id: string) => {
    setOrderMemberId(id);
    const m = members.find((mem) => mem.id === id);
    if (m) {
      setOrderMemberName(m.name);
    }
  };

  // Add line item to order
  const handleAddOrderItem = () => {
    const lesson = lessonCatalog[0];
    if (!lesson) return;
    setOrderItems((prev) => [
      ...prev,
      {
        lessonId: lesson.id,
        lessonName: lesson.name,
        category: lesson.category,
        quantity: 1,
        unitPrice: lesson.price,
        totalPrice: lesson.price,
      },
    ]);
  };

  // Remove line item from order
  const handleRemoveOrderItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Update item details in order form
  const handleUpdateOrderItem = (
    index: number,
    field: keyof ManaOrderItem,
    value: any
  ) => {
    setOrderItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };

      if (field === 'lessonId') {
        const catItem = lessonCatalog.find((c) => c.id === value);
        if (catItem) {
          item.lessonId = catItem.id;
          item.lessonName = catItem.name;
          item.category = catItem.category;
          item.unitPrice = catItem.price;
          item.totalPrice = item.quantity * catItem.price;
        }
      } else if (field === 'quantity') {
        const q = Math.max(1, parseInt(value) || 1);
        item.quantity = q;
        item.totalPrice = q * item.unitPrice;
      } else if (field === 'unitPrice') {
        const parsed = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : Number(value);
        const p = Math.max(0, isNaN(parsed) ? 0 : parsed);
        item.unitPrice = p;
        item.totalPrice = item.quantity * p;
      }

      updated[index] = item;
      return updated;
    });
  };

  // Submit Order Form (Create or Edit)
  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setOrderFormError(null);
    if (!orderMemberName.trim()) {
      setOrderFormError('Por favor, informe o nome do membro ou assinante.');
      return;
    }
    if (orderItems.length === 0) {
      setOrderFormError('Adicione pelo menos uma lição ao pedido.');
      return;
    }

    const totalAmount = calculatedOrderTotal;
    
    // Filter and sanitize payment records
    const validPayments = orderPayments
      .filter((p) => (Number(p.amount) || 0) > 0)
      .map((p, idx) => ({
        id: p.id || `pm-${Date.now()}-${idx}`,
        date: p.date || new Date().toISOString().slice(0, 10),
        amount: Number(p.amount) || 0,
        method: p.method || 'Pix',
        notes: p.notes || '',
      }));

    const amountPaid = validPayments.reduce((sum, p) => sum + p.amount, 0);
    const status: 'Quitado' | 'Parcial' | 'Pendente' =
      amountPaid >= totalAmount
        ? 'Quitado'
        : amountPaid > 0
        ? 'Parcial'
        : 'Pendente';

    const primaryPaymentMethod: PaymentMethod =
      validPayments[0]?.method || orderPaymentMethod || 'Pix';

    const currentQuarterKey = `q${selectedQuarter}` as 'q1' | 'q2' | 'q3' | 'q4';

    if (editingOrderId) {
      // Find existing order
      const existing = manaSubscriptions.find((o) => o.id === editingOrderId);
      if (!existing) return;

      const updated: ManaSubscription = {
        ...existing,
        memberId: orderMemberId,
        memberName: orderMemberName,
        items: orderItems,
        totalAmount,
        amountPaid,
        paymentMethod: primaryPaymentMethod,
        status,
        notes: orderNotes,
        payments: validPayments,
      };

      onUpdateManaOrder(updated);
      setOrderSuccessNotice(`Pedido de ${orderMemberName} atualizado com sucesso!`);
    } else {
      // Create new order
      const newOrder: Omit<ManaSubscription, 'id'> = {
        memberId: orderMemberId,
        memberName: orderMemberName,
        items: orderItems,
        totalAmount,
        amountPaid,
        paymentMethod: primaryPaymentMethod,
        status,
        quarterlyDelivery: {
          q1: 'Pendente',
          q2: 'Pendente',
          q3: 'Pendente',
          q4: 'Pendente',
          [currentQuarterKey]: 'A caminho',
        },
        deliveryStatus: 'A caminho',
        year: 2026,
        createdAt: new Date().toISOString().slice(0, 10),
        notes: orderNotes,
        payments: validPayments,
      };

      onAddMana(newOrder);
      setOrderSuccessNotice(`Pedido de ${orderMemberName} cadastrado com sucesso!`);
    }

    setIsOrderModalOpen(false);
  };

  // Open Quick Payment Modal
  const handleOpenPaymentModal = (order: ManaSubscription) => {
    setSelectedOrderForPayment(order);
    const balanceRemaining = Math.max(0, order.totalAmount - order.amountPaid);
    setNewPaymentAmount(balanceRemaining);
    setNewPaymentMethod(order.paymentMethod || 'Pix');
    setNewPaymentDate(new Date().toISOString().slice(0, 10));
    setNewPaymentNotes('');
    setIsPaymentModalOpen(true);
  };

  // Submit Quick Payment
  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForPayment) return;

    const currentPaid = selectedOrderForPayment.amountPaid || 0;
    const additionalPaid = Math.max(0, newPaymentAmount);
    const updatedPaid = currentPaid + additionalPaid;
    const total = selectedOrderForPayment.totalAmount;

    const newStatus: 'Quitado' | 'Parcial' | 'Pendente' =
      updatedPaid >= total
        ? 'Quitado'
        : updatedPaid > 0
        ? 'Parcial'
        : 'Pendente';

    const newPaymentRecord: ManaPayment = {
      id: `pm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: newPaymentDate || new Date().toISOString().slice(0, 10),
      amount: additionalPaid,
      method: newPaymentMethod,
      notes: newPaymentNotes.trim() || undefined,
    };

    const existingPayments = selectedOrderForPayment.payments || [];
    const updatedPayments = [...existingPayments, newPaymentRecord];

    const updatedOrder: ManaSubscription = {
      ...selectedOrderForPayment,
      amountPaid: Math.min(total, updatedPaid),
      status: newStatus,
      paymentMethod: newPaymentMethod,
      payments: updatedPayments,
    };

    onUpdateManaOrder(updatedOrder);
    setOrderSuccessNotice(`Pagamento de R$ ${additionalPaid.toFixed(2)} registrado com sucesso para ${selectedOrderForPayment.memberName}!`);
    setIsPaymentModalOpen(false);
  };

  // Open Delivery Attachment Modal
  const handleOpenDeliveryAttachmentModal = (order: ManaSubscription, quarter?: number) => {
    setDeliveryModalOrder(order);
    setDeliveryModalQuarter(quarter || selectedQuarter);
  };

  // Save updated delivery record from modal
  const handleSaveDeliveryAttachment = (updatedOrder: ManaSubscription) => {
    onUpdateManaOrder(updatedOrder);
    setOrderSuccessNotice(`Comprovante de entrega de ${updatedOrder.memberName} salvo com sucesso!`);
  };

  // Toggle delivery status for active quarter
  const handleQuarterlyDeliveryChange = (
    order: ManaSubscription,
    newDeliveryStatus: 'Entregue' | 'A caminho' | 'Pendente'
  ) => {
    const qKey = `q${selectedQuarter}` as 'q1' | 'q2' | 'q3' | 'q4';
    const updatedQuarterly = {
      ...order.quarterlyDelivery,
      [qKey]: newDeliveryStatus,
    };

    const currentDetail = order.quarterlyDeliveryDetails?.[qKey];
    const today = new Date().toISOString().slice(0, 10);

    const updatedDetails = {
      ...(order.quarterlyDeliveryDetails || {}),
      [qKey]: {
        ...(currentDetail || {}),
        status: newDeliveryStatus,
        deliveredAt:
          newDeliveryStatus === 'Entregue' && !currentDetail?.deliveredAt
            ? today
            : currentDetail?.deliveredAt,
      },
    };

    const updatedOrder: ManaSubscription = {
      ...order,
      quarterlyDelivery: updatedQuarterly,
      quarterlyDeliveryDetails: updatedDetails,
      deliveryStatus: newDeliveryStatus,
    };

    onUpdateManaOrder(updatedOrder);
  };

  // Handle Catalog Modal (New / Edit Lesson)
  const handleOpenCatalogModal = (item?: LessonCatalogItem) => {
    if (item) {
      setCatalogFormData({
        id: item.id,
        code: item.code || '',
        name: item.name,
        category: item.category,
        price: item.price,
      });
    } else {
      setCatalogFormData({
        code: `CPB-${String(lessonCatalog.length + 1).padStart(2, '0')}`,
        name: '',
        category: 'Adultos',
        price: 38.0,
      });
    }
    setIsCatalogModalOpen(true);
  };

  const handleSaveCatalogItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogFormData.name.trim()) return;

    if (catalogFormData.id) {
      // Edit
      const updated = lessonCatalog.map((c) =>
        c.id === catalogFormData.id
          ? {
              ...c,
              code: catalogFormData.code,
              name: catalogFormData.name,
              category: catalogFormData.category,
              price: catalogFormData.price,
            }
          : c
      );
      onSaveLessonCatalog(updated);
    } else {
      // Create
      const newItem: LessonCatalogItem = {
        id: `cat-${Date.now()}`,
        code: catalogFormData.code,
        name: catalogFormData.name,
        category: catalogFormData.category,
        price: catalogFormData.price,
      };
      onSaveLessonCatalog([...lessonCatalog, newItem]);
    }

    setIsCatalogModalOpen(false);
  };

  const handleDeleteCatalogItem = (item: LessonCatalogItem) => {
    setCatalogItemToDelete(item);
  };

  // Excel / CSV File Import Handler
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCatalogNotice(null);
    setCatalogError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const importedItems: LessonCatalogItem[] = [];

        // Parse rows (assuming Header row or name/price in columns)
        data.forEach((row, idx) => {
          if (idx === 0) return; // Skip header
          if (!row || row.length === 0) return;

          const name = String(row[0] || row['Nome'] || row['Lição'] || '').trim();
          if (!name) return;

          const category = String(row[1] || 'Adultos').trim();
          const rawPrice = row[2] || row[1];
          const price = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice).replace('R$', '').replace(',', '.')) || 38.0;
          const code = String(row[3] || `CPB-IMP-${idx}`);

          importedItems.push({
            id: `cat-imp-${Date.now()}-${idx}`,
            code,
            name,
            category,
            price,
          });
        });

        if (importedItems.length > 0) {
          // Replace old catalog items with newly imported items as requested
          onSaveLessonCatalog(importedItems);
          setCatalogNotice(`${importedItems.length} lição(ões) importada(s) do arquivo com sucesso! O catálogo antigo foi substituído.`);
          setCatalogError(null);
        } else {
          setCatalogError('Nenhuma lição válida encontrada no arquivo. Verifique se a planilha possui colunas: [Nome, Categoria, Preço].');
        }
      } catch (err) {
        setCatalogError('Erro ao importar arquivo Excel/CSV. Verifique o formato do arquivo e tente novamente.');
      }
    };
    reader.readAsBinaryString(file);
    // Reset file input so user can re-upload same file if needed
    e.target.value = '';
  };

  // Handle Confirmed Excel Import of Subscriptions
  const handleConfirmExcelImport = (
    newSubs: Omit<ManaSubscription, 'id'>[],
    mode: 'append' | 'replace',
    newCatalogItems?: LessonCatalogItem[]
  ) => {
    // 1. Save new catalog items if any were auto-detected
    if (newCatalogItems && newCatalogItems.length > 0) {
      const updatedCatalog = [...lessonCatalog, ...newCatalogItems];
      onSaveLessonCatalog(updatedCatalog);
    }

    // 2. Insert or Replace subscriptions
    if (mode === 'replace') {
      const fullSubs: ManaSubscription[] = newSubs.map((s, idx) => ({
        ...s,
        id: `mn-imp-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      }));

      if (onReplaceAllMana) {
        onReplaceAllMana(fullSubs);
      } else {
        fullSubs.forEach((s) => onAddMana(s));
      }
    } else {
      if (onAddMultipleMana) {
        onAddMultipleMana(newSubs);
      } else {
        newSubs.forEach((s) => onAddMana(s));
      }
    }

    setOrderSuccessNotice(
      `${newSubs.length} assinatura(s) do Projeto Maná importada(s) com sucesso da planilha Excel!`
    );
    setActiveTab('pedidos');
  };

  // Helper to match member unit/class
  const getMemberUnitInfo = useCallback(
    (order: ManaSubscription) => {
      const member = members.find(
        (m) =>
          (order.memberId && m.id === order.memberId) ||
          m.name.trim().toLowerCase() === order.memberName.trim().toLowerCase()
      );
      const unitName = member?.unit || member?.className || 'Sem Unidade / Avulso';
      const className = member?.className || member?.unit || 'Sem Classe';
      return { unitName, className, member };
    },
    [members]
  );

  // Unique list of units for filters
  const availableUnitsList = useMemo(() => {
    const unitSet = new Set<string>();
    classes.forEach((c) => {
      if (c.name) unitSet.add(c.name);
    });
    members.forEach((m) => {
      if (m.unit) unitSet.add(m.unit);
      if (m.className) unitSet.add(m.className);
    });
    manaSubscriptions.forEach((sub) => {
      const info = getMemberUnitInfo(sub);
      if (info.unitName) unitSet.add(info.unitName);
    });
    return Array.from(unitSet).sort();
  }, [classes, members, manaSubscriptions, getMemberUnitInfo]);

  // Overall Financial & Quantity KPIs for Report
  const totalOrdersCount = manaSubscriptions.length;
  const quitadosCount = useMemo(() => manaSubscriptions.filter((s) => s.status === 'Quitado').length, [manaSubscriptions]);
  const parcialCount = useMemo(() => manaSubscriptions.filter((s) => s.status === 'Parcial').length, [manaSubscriptions]);
  const pendenteCount = useMemo(() => manaSubscriptions.filter((s) => s.status === 'Pendente').length, [manaSubscriptions]);

  const activeQuarterKey = `q${selectedQuarter}` as 'q1' | 'q2' | 'q3' | 'q4';
  const comAnexoCount = useMemo(
    () =>
      manaSubscriptions.filter(
        (s) => Boolean(s.quarterlyDeliveryDetails?.[activeQuarterKey]?.attachmentUrl)
      ).length,
    [manaSubscriptions, activeQuarterKey]
  );
  const semAnexoCount = totalOrdersCount - comAnexoCount;

  // Filter Orders for Display
  const filteredOrders = useMemo(() => {
    return manaSubscriptions.filter((sub) => {
      const matchesSearch =
        sub.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.items.some((i) => i.lessonName.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchesStatus = true;
      if (statusFilter === 'ALL') {
        matchesStatus = true;
      } else if (statusFilter === 'ComAnexo') {
        matchesStatus = Boolean(sub.quarterlyDeliveryDetails?.[activeQuarterKey]?.attachmentUrl);
      } else if (statusFilter === 'SemAnexo') {
        matchesStatus = !sub.quarterlyDeliveryDetails?.[activeQuarterKey]?.attachmentUrl;
      } else {
        matchesStatus = sub.status === statusFilter;
      }

      const { unitName, className } = getMemberUnitInfo(sub);
      const matchesUnit =
        unitFilter === 'ALL' || unitName === unitFilter || className === unitFilter;

      return matchesSearch && matchesStatus && matchesUnit;
    });
  }, [manaSubscriptions, searchTerm, statusFilter, unitFilter, getMemberUnitInfo, activeQuarterKey]);

  // Unit-by-Unit Financial & Subscription Consolidation
  const unitSummaries = useMemo(() => {
    const map: Record<
      string,
      {
        unitName: string;
        className: string;
        teacherName?: string;
        room?: string;
        totalOrders: number;
        totalLessons: number;
        totalAmount: number;
        amountPaid: number;
        balanceRemaining: number;
        quitadosCount: number;
        parcialCount: number;
        pendenteCount: number;
        orders: ManaSubscription[];
      }
    > = {};

    // 1. Pre-seed with configured classes/units
    classes.forEach((c) => {
      map[c.name] = {
        unitName: c.name,
        className: c.category || c.name,
        teacherName: c.teacher1Name,
        room: c.room,
        totalOrders: 0,
        totalLessons: 0,
        totalAmount: 0,
        amountPaid: 0,
        balanceRemaining: 0,
        quitadosCount: 0,
        parcialCount: 0,
        pendenteCount: 0,
        orders: [],
      };
    });

    // 2. Aggregate all subscriptions
    manaSubscriptions.forEach((sub) => {
      const { unitName, className } = getMemberUnitInfo(sub);
      if (!map[unitName]) {
        map[unitName] = {
          unitName,
          className,
          totalOrders: 0,
          totalLessons: 0,
          totalAmount: 0,
          amountPaid: 0,
          balanceRemaining: 0,
          quitadosCount: 0,
          parcialCount: 0,
          pendenteCount: 0,
          orders: [],
        };
      }

      const u = map[unitName];
      u.totalOrders += 1;
      const lessonsQty = (sub.items || []).reduce((acc, i) => acc + (i.quantity || 0), 0);
      u.totalLessons += lessonsQty;
      u.totalAmount += sub.totalAmount || 0;
      u.amountPaid += sub.amountPaid || 0;
      u.balanceRemaining += Math.max(0, (sub.totalAmount || 0) - (sub.amountPaid || 0));

      if (sub.status === 'Quitado') u.quitadosCount += 1;
      else if (sub.status === 'Parcial') u.parcialCount += 1;
      else u.pendenteCount += 1;

      u.orders.push(sub);
    });

    return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [manaSubscriptions, classes, getMemberUnitInfo]);

  const totalLessonsCount = useMemo(() => {
    return manaSubscriptions.reduce((acc, sub) => {
      return acc + (sub.items || []).reduce((sum, item) => sum + item.quantity, 0);
    }, 0);
  }, [manaSubscriptions]);

  const totalPredictedAmount = useMemo(() => {
    return manaSubscriptions.reduce((acc, sub) => acc + (sub.totalAmount || 0), 0);
  }, [manaSubscriptions]);

  const totalCollectedAmount = useMemo(() => {
    return manaSubscriptions.reduce((acc, sub) => acc + (sub.amountPaid || 0), 0);
  }, [manaSubscriptions]);

  const totalPendingAmount = useMemo(() => {
    return Math.max(0, totalPredictedAmount - totalCollectedAmount);
  }, [totalPredictedAmount, totalCollectedAmount]);

  // Operational Consolidation per Lesson Type (for Master Distributor Order)
  const consolidatedReport = useMemo(() => {
    const map: Record<string, { name: string; category: string; totalQty: number; totalValue: number; unitPrice: number }> = {};

    manaSubscriptions.forEach((sub) => {
      (sub.items || []).forEach((item) => {
        const key = item.lessonName;
        if (!map[key]) {
          map[key] = {
            name: item.lessonName,
            category: item.category || 'Geral',
            totalQty: 0,
            totalValue: 0,
            unitPrice: item.unitPrice,
          };
        }
        map[key].totalQty += item.quantity;
        map[key].totalValue += item.totalPrice;
      });
    });

    return Object.values(map).sort((a, b) => b.totalQty - a.totalQty);
  }, [manaSubscriptions]);

  // Breakdown of collected amount by payment method (Pix, Dinheiro, Cartão, Transferência, etc.)
  const paymentMethodBreakdown = useMemo(() => {
    const counts: Record<string, { total: number; count: number }> = {
      Pix: { total: 0, count: 0 },
      Dinheiro: { total: 0, count: 0 },
      'Cartão de Crédito': { total: 0, count: 0 },
      'Cartão de Débito': { total: 0, count: 0 },
      Transferência: { total: 0, count: 0 },
      Outros: { total: 0, count: 0 },
    };

    manaSubscriptions.forEach((sub) => {
      if (sub.payments && sub.payments.length > 0) {
        let totalTrackedInPayments = 0;
        sub.payments.forEach((p) => {
          const methodKey = p.method || sub.paymentMethod || 'Pix';
          const amt = p.amount || 0;
          totalTrackedInPayments += amt;

          const key = counts[methodKey] ? methodKey : 'Outros';
          counts[key].total += amt;
          counts[key].count += 1;
        });

        const remainingPaid = (sub.amountPaid || 0) - totalTrackedInPayments;
        if (remainingPaid > 0) {
          const primaryMethod = sub.paymentMethod || 'Pix';
          const key = counts[primaryMethod] ? primaryMethod : 'Outros';
          counts[key].total += remainingPaid;
          counts[key].count += 1;
        }
      } else {
        const amt = sub.amountPaid || 0;
        if (amt > 0) {
          const primaryMethod = sub.paymentMethod || 'Pix';
          const key = counts[primaryMethod] ? primaryMethod : 'Outros';
          counts[key].total += amt;
          counts[key].count += 1;
        }
      }
    });

    return counts;
  }, [manaSubscriptions]);

  // Handler to open print modal and attempt browser print
  const handleTriggerPrint = () => {
    setIsPrintModalOpen(true);
    try {
      window.print();
    } catch (err) {
      console.warn('Native window.print() failed or was blocked by browser iframe policy:', err);
    }
  };

  // Handler to open a clean standalone window/tab for printing (bypasses iframe restrictions)
  const handleOpenPrintWindow = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('O seu navegador bloqueou a abertura de pop-ups. Por favor, libere janelas emergentes neste site ou utilize o botão de copiar em texto.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Relatório Maná ${selectedYear} - ${selectedQuarter}º Trimestre</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 25px; color: #111827; background: #ffffff; line-height: 1.5; }
            .no-print-bar { display: flex; items-center: center; justify-content: space-between; gap: 10px; margin-bottom: 24px; padding: 14px 18px; background: #111827; color: #ffffff; border-radius: 12px; }
            .btn { padding: 8px 16px; background: #6b1d2f; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px; }
            .btn-close { background: #374151; }
            .header { text-align: center; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 20px; }
            .header h1 { font-size: 18px; font-weight: 900; margin: 0; text-transform: uppercase; color: #111827; letter-spacing: -0.5px; }
            .header h2 { font-size: 13px; font-weight: 700; margin: 4px 0 0 0; color: #4b5563; }
            .meta { display: flex; justify-content: space-between; font-size: 11px; color: #6b7280; font-family: monospace; margin-top: 8px; }
            .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 24px; }
            .kpi-box { border: 1px solid #e5e7eb; padding: 10px; border-radius: 10px; text-align: center; background: #f9fafb; }
            .kpi-title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #6b7280; }
            .kpi-value { font-size: 16px; font-weight: 900; color: #111827; margin-top: 4px; }
            .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #6b1d2f; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
            th, td { border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; }
            th { background: #f3f4f6; font-weight: 800; text-transform: uppercase; font-size: 9px; color: #374151; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .green { color: #065f46; font-weight: bold; }
            .red { color: #991b1b; font-weight: bold; }
            .signatures { margin-top: 45px; display: flex; justify-content: space-around; font-size: 11px; font-weight: bold; text-align: center; page-break-inside: avoid; }
            .sig-line { border-top: 1px solid #111827; width: 220px; margin: 0 auto 6px auto; }
            @media print {
              .no-print-bar { display: none !important; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="no-print-bar">
            <div>
              <strong>Relatório de Impressão Maná ${selectedYear}</strong> — ${selectedQuarter}º Trimestre
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn" onclick="window.print()">🖨️ Imprimir Agora / Salvar PDF</button>
              <button class="btn btn-close" onclick="window.close()">✕ Fechar</button>
            </div>
          </div>

          <div class="header">
            <h1>Igreja Adventista do Sétimo Dia • Escola Sabatina</h1>
            <h2>RELATÓRIO FINANCEIRO & CONSOLIDAÇÃO DE PEDIDOS — PROJETO MANÁ (${selectedYear})</h2>
            <div class="meta">
              <span>Periodo: ${selectedQuarter}º Trimestre ${selectedYear}</span>
              <span>Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</span>
            </div>
          </div>

          <div class="kpis">
            <div class="kpi-box">
              <div class="kpi-title">Total Pedidos</div>
              <div class="kpi-value">${totalOrdersCount}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-title">Total Lições</div>
              <div class="kpi-value">${totalLessonsCount}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-title">Total Previsto</div>
              <div class="kpi-value">R$ ${totalPredictedAmount.toFixed(2)}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-title">Total Arrecadado</div>
              <div class="kpi-value green">R$ ${totalCollectedAmount.toFixed(2)}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-title">Total Pendente</div>
              <div class="kpi-value red">R$ ${totalPendingAmount.toFixed(2)}</div>
            </div>
          </div>

          <div class="section-title">1. ARRECADAÇÃO POR FORMA DE PAGAMENTO</div>
          <table>
            <thead>
              <tr>
                <th>Forma de Pagamento</th>
                <th class="text-center">Qtd. Lançamentos</th>
                <th class="text-right">Total Arrecadado (R$)</th>
                <th class="text-right">% do Total</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(paymentMethodBreakdown).map(([method, data]) => {
                const pct = totalCollectedAmount > 0 ? ((data.total / totalCollectedAmount) * 100).toFixed(1) : '0.0';
                return `
                  <tr>
                    <td><strong>${method}</strong></td>
                    <td class="text-center">${data.count}</td>
                    <td class="text-right green">R$ ${data.total.toFixed(2)}</td>
                    <td class="text-right">${pct}%</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="section-title">2. QUANTIDADES POR LIÇÃO PARA ENCOMENDA (CPB / DISTRIBUIDORA)</div>
          <table>
            <thead>
              <tr>
                <th>Tipo de Lição</th>
                <th>Categoria</th>
                <th class="text-center">Qtd. Acumulada</th>
                <th class="text-right">Preço Unitário</th>
                <th class="text-right">Subtotal Previsto (R$)</th>
              </tr>
            </thead>
            <tbody>
              ${consolidatedReport.map(item => `
                <tr>
                  <td><strong>${item.name}</strong></td>
                  <td>${item.category}</td>
                  <td class="text-center"><strong>${item.totalQty}x</strong></td>
                  <td class="text-right">R$ ${item.unitPrice.toFixed(2)}</td>
                  <td class="text-right"><strong>R$ ${item.totalValue.toFixed(2)}</strong></td>
                </tr>
              `).join('')}
              <tr style="background: #f9fafb; font-weight: bold;">
                <td colspan="2">TOTAL CONSOLIDADO DA IGREJA</td>
                <td class="text-center">${totalLessonsCount} Lições</td>
                <td class="text-right">Total Bruto:</td>
                <td class="text-right">R$ ${totalPredictedAmount.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">3. RELAÇÃO DETALHADA DE ASSINANTES E COBRANÇAS</div>
          <table>
            <thead>
              <tr>
                <th>Membro / Assinante</th>
                <th>Lições Encomendadas</th>
                <th class="text-center">Forma Pagto</th>
                <th class="text-right">Total (R$)</th>
                <th class="text-right">Pago (R$)</th>
                <th class="text-right">Pendente (R$)</th>
                <th class="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              ${manaSubscriptions.map(sub => {
                const pending = Math.max(0, sub.totalAmount - sub.amountPaid);
                return `
                  <tr>
                    <td><strong>${sub.memberName}</strong></td>
                    <td>${sub.items.map(i => `${i.quantity}x ${i.lessonName}`).join(', ')}</td>
                    <td class="text-center">${sub.paymentMethod || 'Pix'}</td>
                    <td class="text-right">R$ ${sub.totalAmount.toFixed(2)}</td>
                    <td class="text-right green">R$ ${sub.amountPaid.toFixed(2)}</td>
                    <td class="text-right red">R$ ${pending.toFixed(2)}</td>
                    <td class="text-center">${sub.status}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="signatures">
            <div>
              <div class="sig-line"></div>
              Diretor(a) da Escola Sabatina
            </div>
            <div>
              <div class="sig-line"></div>
              Tesoureiro(a) da Igreja
            </div>
          </div>

          <script>
            setTimeout(() => {
              window.print();
            }, 300);
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Copy plain text summary
  const handleCopyReportText = () => {
    let text = `*RELATÓRIO FINANCEIRO MANÁ ${selectedYear} - ${selectedQuarter}º TRIMESTRE*\n`;
    text += `Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    text += `*RESUMO GERAL:*\n`;
    text += `• Total Pedidos: ${totalOrdersCount}\n`;
    text += `• Total Lições: ${totalLessonsCount}\n`;
    text += `• Valor Bruto Previsto: R$ ${totalPredictedAmount.toFixed(2)}\n`;
    text += `• Total Arrecadado: R$ ${totalCollectedAmount.toFixed(2)}\n`;
    text += `• Total Pendente: R$ ${totalPendingAmount.toFixed(2)}\n\n`;

    text += `*ARRECADAÇÃO POR FORMA DE PAGAMENTO:*\n`;
    Object.entries(paymentMethodBreakdown).forEach(([method, data]) => {
      if (data.total > 0) {
        text += `• ${method}: R$ ${data.total.toFixed(2)} (${data.count} lançamento(s))\n`;
      }
    });

    text += `\n*RESUMO DE ENCOMENDA CPB:*\n`;
    consolidatedReport.forEach((item) => {
      text += `• ${item.totalQty}x ${item.name} - R$ ${item.totalValue.toFixed(2)}\n`;
    });

    navigator.clipboard.writeText(text);
    alert('Resumo do relatório copiado para a área de transferência com sucesso!');
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* 1. Header Banner & Quarter Selector */}
      <div className="bg-gradient-to-r from-[#4a121f] via-[#6b1d2f] to-[#380d17] text-white p-5 md:p-6 rounded-2xl shadow-lg space-y-4 border border-[#D4AF37]/30">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#f3e5ab] bg-white/10 px-3 py-1 rounded-full border border-white/20">
                PROJETO MANÁ 2026 / 2027
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-300 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                Módulo Pedidos & Faturas Active
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black flex items-center gap-2.5 tracking-tight text-white">
              <BookMarked className="w-7 h-7 text-[#d4af37]" />
              Gestão de Assinaturas e Pedidos da Lição
            </h2>
            <p className="text-xs text-rose-100/80 max-w-2xl leading-relaxed font-medium">
              Controle completo de assinaturas individuais, pedidos multi-itens por membro, catálogo de preços, faturas de cobrança e relatórios consolidados para a distribuidora.
            </p>
          </div>

          {/* Year & Quarter Selectors */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-stretch lg:self-auto">
            {/* Year Selector */}
            <div className="bg-black/30 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 flex items-center">
              <select
                value={selectedYear}
                onChange={(e) => onSelectYear?.(parseInt(e.target.value))}
                className="bg-[#d4af37] text-gray-950 text-xs font-black px-3 py-1.5 rounded-xl border-0 focus:outline-none cursor-pointer"
                title="Selecionar Ano Letivo"
              >
                {AVAILABLE_YEARS.map((y) => (
                  <option key={y} value={y} className="bg-white text-gray-900 font-bold">
                    Ano {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Quarter Selector */}
            <div className="bg-black/30 backdrop-blur-md p-2 rounded-2xl border border-white/15 flex items-center gap-1 shrink-0 justify-between lg:justify-start">
              <span className="text-[11px] font-bold text-[#f3e5ab] px-2 hidden sm:inline">Trimestre:</span>
              {[1, 2, 3, 4].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onSelectQuarter(q)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    selectedQuarter === q
                      ? 'bg-[#d4af37] text-gray-950 shadow-md scale-105'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {q}º Trim
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 5 Main Module Navigation Tabs */}
        <div className="pt-2 border-t border-white/10 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('pedidos')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'pedidos'
                ? 'bg-white text-[#6b1d2f] shadow-md'
                : 'bg-white/10 text-white/90 hover:bg-white/20'
            }`}
          >
            <ShoppingCart className="w-4 h-4 text-[#d4af37]" />
            <span>Pedidos & Faturas ({totalOrdersCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('unidades')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'unidades'
                ? 'bg-white text-[#6b1d2f] shadow-md'
                : 'bg-white/10 text-white/90 hover:bg-white/20'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-[#d4af37]" />
            <span>Visão por Unidades & Classes ({unitSummaries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('importar')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'importar'
                ? 'bg-white text-[#6b1d2f] shadow-md'
                : 'bg-white/10 text-white/90 hover:bg-white/20'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-[#d4af37]" />
            <span>Importar Planilha Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cadastro')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'cadastro'
                ? 'bg-white text-[#6b1d2f] shadow-md'
                : 'bg-white/10 text-white/90 hover:bg-white/20'
            }`}
          >
            <Layers className="w-4 h-4 text-[#d4af37]" />
            <span>Cadastro de Lições e Preços ({lessonCatalog.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('relatorio')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'relatorio'
                ? 'bg-white text-[#6b1d2f] shadow-md'
                : 'bg-white/10 text-white/90 hover:bg-white/20'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-[#d4af37]" />
            <span>Relatório Maná (Financeiro & CPB)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PEDIDOS & FATURAS                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'pedidos' && (
        <div className="space-y-4">
          {/* Success Banner */}
          {orderSuccessNotice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold text-xs flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{orderSuccessNotice}</span>
              </div>
              <button type="button" onClick={() => setOrderSuccessNotice(null)} className="text-emerald-700 hover:text-emerald-900 font-bold text-xs cursor-pointer">✕</button>
            </div>
          )}

          {/* Quick Status Pills / Elipses Filter Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border ${
                statusFilter === 'ALL'
                  ? 'bg-gray-900 text-white border-gray-900 shadow-xs scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
              }`}
            >
              <span>📋 Todos os Pedidos</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
                {totalOrdersCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('Quitado')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border ${
                statusFilter === 'Quitado'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs scale-105'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>🟢 Quitados (100% Pago)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'Quitado' ? 'bg-white/20 text-white' : 'bg-emerald-200/70 text-emerald-900'}`}>
                {quitadosCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('Parcial')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border ${
                statusFilter === 'Parcial'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs scale-105'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>🟡 Pagamento Parcial (Em Aberto)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'Parcial' ? 'bg-white/20 text-white' : 'bg-amber-200/70 text-amber-900'}`}>
                {parcialCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('Pendente')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border ${
                statusFilter === 'Pendente'
                  ? 'bg-rose-700 text-white border-rose-700 shadow-xs scale-105'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border-rose-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <span>🔴 Pendentes (Não Pago)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'Pendente' ? 'bg-white/20 text-white' : 'bg-rose-200/70 text-rose-900'}`}>
                {pendenteCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('ComAnexo')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border ${
                statusFilter === 'ComAnexo'
                  ? 'bg-blue-800 text-white border-blue-800 shadow-xs scale-105'
                  : 'bg-blue-50 text-blue-900 hover:bg-blue-100 border-blue-200'
              }`}
              title="Filtrar assinantes que possuem comprovante anexado no trimestre atual"
            >
              <Paperclip className="w-3 h-3 text-blue-600" />
              <span>📎 Com Comprovante ({selectedQuarter}º Trim)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'ComAnexo' ? 'bg-white/20 text-white' : 'bg-blue-200/80 text-blue-950 font-black'}`}>
                {comAnexoCount}
              </span>
            </button>
          </div>

          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Search, Status, and Unit Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto flex-wrap">
              <div className="relative w-full sm:w-60">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar membro ou lição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
                />
              </div>

              {/* Unit Dropdown Filter */}
              <div className="w-full sm:w-auto">
                <select
                  value={unitFilter}
                  onChange={(e) => setUnitFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
                >
                  <option value="ALL">🏛️ Todas as Unidades ({availableUnitsList.length})</option>
                  {availableUnitsList.map((u) => (
                    <option key={u} value={u}>
                      🏛️ {u}
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full sm:w-auto px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
              >
                <option value="ALL">Todos os Status ({totalOrdersCount})</option>
                <option value="Quitado">🟢 Quitados ({quitadosCount})</option>
                <option value="Parcial">🟡 Pagamento Parcial ({parcialCount})</option>
                <option value="Pendente">🔴 Pendentes ({pendenteCount})</option>
                <option value="ComAnexo">📎 Com Comprovante ({comAnexoCount})</option>
                <option value="SemAnexo">📋 Sem Comprovante ({semAnexoCount})</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setActiveTab('unidades')}
                className="w-full sm:w-auto px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer shrink-0"
                title="Visualizar resumo financeiro e lições agrupadas por Unidade"
              >
                <GraduationCap className="w-4 h-4 text-[#6b1d2f]" />
                <span>Painel por Unidades</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('importar')}
                className="w-full sm:w-auto px-3.5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer shrink-0 border border-emerald-600/40"
                title="Importar lista de assinaturas a partir de uma planilha Excel ou CSV"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                <span>Importar do Excel</span>
              </button>

              <button
                type="button"
                onClick={handleOpenBatchModal}
                className="w-full sm:w-auto px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer shrink-0"
                title="Criar pedidos de lições em lote a partir dos Membros da Igreja"
              >
                <Upload className="w-4 h-4 text-amber-300" />
                <span>Importar dos Membros</span>
              </button>

              <button
                type="button"
                onClick={handleOpenNewOrderModal}
                className="w-full sm:w-auto px-4 py-2.5 bg-[#6b1d2f] hover:bg-[#4a121f] text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 text-[#d4af37]" />
                <span>Lançar Novo Pedido</span>
              </button>
            </div>
          </div>

          {/* Orders Table & Cards */}
          <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-gray-50/80 border-b border-gray-200 font-bold text-xs text-gray-800 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#6b1d2f]" />
                Pedidos de Lições Registrados ({filteredOrders.length})
              </span>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-gray-500 font-medium">
                  Previsto: <strong className="text-gray-900 font-bold">R$ {totalPredictedAmount.toFixed(2)}</strong>
                </span>
                <span className="text-emerald-700 font-bold">
                  Arrecadado: R$ {totalCollectedAmount.toFixed(2)}
                </span>
                <span className="text-red-700 font-bold">
                  Pendente: R$ {totalPendingAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <BookMarked className="w-10 h-10 text-gray-300 mx-auto" />
                <p className="text-sm font-bold text-gray-600">Nenhum pedido encontrado para o filtro selecionado.</p>
                <p className="text-xs text-gray-400">Clique em &quot;Lançar Novo Pedido de Lições&quot; para registrar a assinatura de um irmão.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 overflow-x-auto">
                {filteredOrders.map((order) => {
                  const currentQuarterDelivery =
                    order.quarterlyDelivery?.[activeQuarterKey] || order.deliveryStatus || 'Pendente';
                  const currentQuarterDetail = order.quarterlyDeliveryDetails?.[activeQuarterKey];
                  const hasAttachment = Boolean(currentQuarterDetail?.attachmentUrl);

                  const balanceRemaining = Math.max(0, order.totalAmount - order.amountPaid);
                  const { unitName } = getMemberUnitInfo(order);

                  return (
                    <div
                      key={order.id}
                      className="p-4 hover:bg-gray-50/80 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs"
                    >
                      {/* Member Info */}
                      <div className="flex items-start gap-3 lg:w-1/4">
                        <div className="w-9 h-9 rounded-2xl bg-rose-100 text-[#6b1d2f] font-black flex items-center justify-center shrink-0 shadow-xs text-sm">
                          {order.memberName.charAt(0)}
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="font-extrabold text-gray-900 text-sm leading-tight">
                            {order.memberName}
                          </h4>
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200/80 rounded-full text-[10px] font-bold">
                              <GraduationCap className="w-3 h-3 text-[#6b1d2f]" />
                              <span>{unitName}</span>
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium">
                              {order.createdAt || '2026-01-01'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="space-y-1 lg:w-1/3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                          Lições Solicitadas ({order.items.reduce((s, i) => s + i.quantity, 0)}x):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {(order.items || []).map((item, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200/80 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                            >
                              <Package className="w-3 h-3 text-amber-700" />
                              {item.quantity}x {item.lessonName}
                              <span className="text-amber-700/80 font-normal">
                                (R$ {item.totalPrice.toFixed(2)})
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Financial Status & Quick Baixa */}
                      <div className="flex flex-col gap-1.5 lg:w-1/4">
                        <div className="flex items-center gap-3">
                          <div className="space-y-0.5 min-w-[100px]">
                            <div className="text-sm font-black text-gray-900">
                              R$ {order.totalAmount.toFixed(2)}
                            </div>
                            <div className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                              Pago: <strong className="text-emerald-700 font-bold">R$ {order.amountPaid.toFixed(2)}</strong>
                              {balanceRemaining > 0 && (
                                <span className="text-red-600 font-bold">
                                  (Falta R$ {balanceRemaining.toFixed(2)})
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                                order.status === 'Quitado'
                                  ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                                  : order.status === 'Parcial'
                                  ? 'bg-amber-100 border-amber-300 text-amber-800'
                                  : 'bg-red-100 border-red-300 text-red-800'
                              }`}
                            >
                              {order.status}
                            </span>

                            {order.status !== 'Quitado' && (
                              <button
                                type="button"
                                onClick={() => handleOpenPaymentModal(order)}
                                className="text-[10px] font-bold text-[#6b1d2f] hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                <CreditCard className="w-3 h-3 text-[#d4af37]" />
                                Dar Baixa
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Split Payment Badges */}
                        {order.payments && order.payments.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {order.payments.map((p, pIdx) => (
                              <span
                                key={p.id || pIdx}
                                className="inline-flex items-center gap-1 text-[10px] bg-emerald-50/70 text-emerald-950 px-1.5 py-0.5 rounded-md font-medium border border-emerald-200/80"
                                title={`${p.method}: R$ ${p.amount.toFixed(2)}${p.date ? ` em ${p.date}` : ''}${p.notes ? ` (${p.notes})` : ''}`}
                              >
                                <span>{p.method === 'Pix' ? '⚡' : p.method === 'Dinheiro' ? '💵' : '💳'}</span>
                                <span className="font-bold">{p.method}:</span>
                                <strong className="font-black text-emerald-800">R$ {p.amount.toFixed(2)}</strong>
                              </span>
                            ))}
                          </div>
                        ) : order.paymentMethod ? (
                          <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                            <span>Forma:</span>
                            <span className="font-bold text-gray-700">{order.paymentMethod}</span>
                          </span>
                        ) : null}
                      </div>

                      {/* Delivery Status & Actions */}
                      <div className="flex items-center justify-between lg:justify-end gap-2 lg:w-1/4 border-t lg:border-t-0 pt-2 lg:pt-0">
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">
                              Entrega {selectedQuarter}º Trim:
                            </span>
                            {hasAttachment && (
                              <span
                                className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
                                title="Comprovante de entrega anexado!"
                              />
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <select
                              value={currentQuarterDelivery}
                              onChange={(e) =>
                                handleQuarterlyDeliveryChange(order, e.target.value as any)
                              }
                              className={`px-2 py-1 rounded-lg text-[11px] font-bold border focus:outline-none cursor-pointer ${
                                currentQuarterDelivery === 'Entregue'
                                  ? 'bg-blue-50 border-blue-300 text-blue-800'
                                  : currentQuarterDelivery === 'A caminho'
                                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                                  : 'bg-gray-100 border-gray-300 text-gray-700'
                              }`}
                            >
                              <option value="Entregue">Entregue</option>
                              <option value="A caminho">A caminho</option>
                              <option value="Pendente">Pendente</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => handleOpenDeliveryAttachmentModal(order, selectedQuarter)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                                hasAttachment
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 shadow-2xs'
                                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300'
                              }`}
                              title={
                                hasAttachment
                                  ? `Comprovante anexado (${currentQuarterDetail?.attachmentName || 'Ver comprovante'}). Clique para visualizar ou editar.`
                                  : `Anexar comprovante de entrega para o ${selectedQuarter}º Trimestre`
                              }
                            >
                              <Paperclip className={`w-3.5 h-3.5 ${hasAttachment ? 'text-emerald-600' : 'text-gray-400'}`} />
                              <span>{hasAttachment ? 'Anexo' : 'Anexar'}</span>
                            </button>
                          </div>

                          {currentQuarterDetail?.deliveredAt && (
                            <span className="text-[9px] text-gray-400 font-medium">
                              Entregue: {currentQuarterDetail.deliveredAt.split('-').reverse().join('/')}
                              {currentQuarterDetail.deliveredBy ? ` • por ${currentQuarterDetail.deliveredBy}` : ''}
                            </span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenDeliveryAttachmentModal(order, selectedQuarter)}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                              hasAttachment
                                ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 ring-1 ring-emerald-300'
                                : 'text-gray-400 hover:text-amber-800 hover:bg-amber-50'
                            }`}
                            title="Comprovante de entrega por trimestre"
                          >
                            <Paperclip className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditOrderModal(order)}
                            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
                            title="Editar Pedido"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrderToDelete(order)}
                            className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                            title="Excluir Pedido"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: VISÃO POR UNIDADES & CLASSES (PAINEL POR ELIPSE / STATUS)         */}
      {/* ========================================================================= */}
      {activeTab === 'unidades' && (
        <div className="space-y-5 animate-in fade-in">
          {/* Header Description & Summary */}
          <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-[#6b1d2f]" />
                Painel Consolidado de Unidades e Classes
              </h3>
              <p className="text-xs text-gray-500 max-w-2xl">
                Acompanhe o status financeiro e a entrega de lições agrupadas por Unidade da Escola Sabatina. Utilize as elipses de status para identificar quem já pagou (🟢 Quitado), está pagando (🟡 Parcial) ou ainda não pagou (🔴 Pendente).
              </p>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={() => {
                  const allExpanded = Object.keys(expandedUnits).length === unitSummaries.length &&
                    Object.values(expandedUnits).every(Boolean);
                  const nextState: Record<string, boolean> = {};
                  unitSummaries.forEach((u) => {
                    nextState[u.unitName] = !allExpanded;
                  });
                  setExpandedUnits(nextState);
                }}
                className="w-full md:w-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Alternar Expansão de Todas</span>
              </button>
            </div>
          </div>

          {/* Unit KPI Overview Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-gray-200/90 shadow-xs space-y-1">
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
                Unidades com Pedidos
              </span>
              <div className="text-xl font-black text-gray-900">
                {unitSummaries.filter((u) => u.totalOrders > 0).length} / {unitSummaries.length}
              </div>
              <p className="text-[10px] text-gray-500 font-medium">Unidades ativas no Maná</p>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-gray-200/90 shadow-xs space-y-1">
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
                Total de Lições
              </span>
              <div className="text-xl font-black text-amber-800">
                {totalLessonsCount}
              </div>
              <p className="text-[10px] text-gray-500 font-medium">Em todas as unidades</p>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-gray-200/90 shadow-xs space-y-1">
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
                Arrecadado
              </span>
              <div className="text-xl font-black text-emerald-700">
                R$ {totalCollectedAmount.toFixed(2)}
              </div>
              <p className="text-[10px] text-emerald-600 font-bold">
                {totalPredictedAmount > 0 ? ((totalCollectedAmount / totalPredictedAmount) * 100).toFixed(0) : 0}% recebido
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-gray-200/90 shadow-xs space-y-1">
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
                Saldo Pendente
              </span>
              <div className="text-xl font-black text-red-600">
                R$ {totalPendingAmount.toFixed(2)}
              </div>
              <p className="text-[10px] text-red-500 font-medium">A receber das unidades</p>
            </div>
          </div>

          {/* Unit Cards List */}
          {unitSummaries.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-gray-200/90 text-center space-y-3">
              <GraduationCap className="w-12 h-12 text-gray-300 mx-auto" />
              <h4 className="text-sm font-bold text-gray-700">Nenhuma unidade ou pedido registrado</h4>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Cadastre suas unidades ou lance assinaturas de membros vinculados às suas respectivas unidades.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {unitSummaries.map((unit) => {
                const isExpanded = !!expandedUnits[unit.unitName];
                const percentPaid = unit.totalAmount > 0 ? Math.min(100, (unit.amountPaid / unit.totalAmount) * 100) : 0;
                const specificStatus = unitSpecificStatusFilter[unit.unitName] || 'ALL';

                const unitFilteredOrders = unit.orders.filter((ord) => {
                  if (specificStatus === 'ALL') return true;
                  return ord.status === specificStatus;
                });

                return (
                  <div
                    key={unit.unitName}
                    className="bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden transition-all hover:border-[#6b1d2f]/40"
                  >
                    {/* Unit Card Header */}
                    <div className="p-4 md:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-b from-white to-gray-50/50">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 bg-[#6b1d2f]/10 text-[#6b1d2f] border border-[#6b1d2f]/20 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            Unidade da Escola Sabatina
                          </span>
                          {unit.teacherName && (
                            <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                              • Professor: <strong className="text-gray-800 font-bold">{unit.teacherName}</strong>
                            </span>
                          )}
                          {unit.room && (
                            <span className="text-[11px] text-gray-500 font-medium">
                              • Sala: <strong className="text-gray-800 font-bold">{unit.room}</strong>
                            </span>
                          )}
                        </div>

                        <h4 className="text-base font-black text-gray-900 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#6b1d2f]"></span>
                          {unit.unitName}
                        </h4>

                        <div className="flex items-center gap-3 text-xs text-gray-600 font-medium pt-0.5">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-gray-400" />
                            <strong className="text-gray-900 font-bold">{unit.totalOrders}</strong> assinante(s)
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5 text-amber-600" />
                            <strong className="text-gray-900 font-bold">{unit.totalLessons}</strong> lição(ões)
                          </span>
                        </div>
                      </div>

                      {/* Financial Bar & Status Elipses */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:gap-6">
                        {/* Financial Snapshot */}
                        <div className="space-y-1.5 min-w-[200px]">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-gray-500">Arrecadação:</span>
                            <span className="text-emerald-700 font-extrabold">
                              R$ {unit.amountPaid.toFixed(2)}{' '}
                              <span className="text-gray-400 font-normal">/ R$ {unit.totalAmount.toFixed(2)}</span>
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                percentPaid >= 100
                                  ? 'bg-emerald-500'
                                  : percentPaid > 0
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${percentPaid}%` }}
                            ></div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium">
                            <span>{percentPaid.toFixed(0)}% pago</span>
                            {unit.balanceRemaining > 0 ? (
                              <span className="text-rose-600 font-bold">
                                Resta: R$ {unit.balanceRemaining.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-bold">100% Quitado</span>
                            )}
                          </div>
                        </div>

                        {/* Status Ellipses Pills (Clickable filter) */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setUnitSpecificStatusFilter((prev) => ({
                                ...prev,
                                [unit.unitName]: specificStatus === 'Quitado' ? 'ALL' : 'Quitado',
                              }));
                              setExpandedUnits((prev) => ({ ...prev, [unit.unitName]: true }));
                            }}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer border ${
                              specificStatus === 'Quitado'
                                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-200'
                            }`}
                            title="Filtrar assinantes quitados nesta unidade"
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>Quitados: {unit.quitadosCount}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setUnitSpecificStatusFilter((prev) => ({
                                ...prev,
                                [unit.unitName]: specificStatus === 'Parcial' ? 'ALL' : 'Parcial',
                              }));
                              setExpandedUnits((prev) => ({ ...prev, [unit.unitName]: true }));
                            }}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer border ${
                              specificStatus === 'Parcial'
                                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200'
                            }`}
                            title="Filtrar assinantes com pagamento parcial nesta unidade"
                          >
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            <span>Parcial: {unit.parcialCount}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setUnitSpecificStatusFilter((prev) => ({
                                ...prev,
                                [unit.unitName]: specificStatus === 'Pendente' ? 'ALL' : 'Pendente',
                              }));
                              setExpandedUnits((prev) => ({ ...prev, [unit.unitName]: true }));
                            }}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer border ${
                              specificStatus === 'Pendente'
                                ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                                : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border-rose-200'
                            }`}
                            title="Filtrar assinantes pendentes nesta unidade"
                          >
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            <span>Pendentes: {unit.pendenteCount}</span>
                          </button>
                        </div>

                        {/* Expand / Collapse Button */}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedUnits((prev) => ({
                              ...prev,
                              [unit.unitName]: !isExpanded,
                            }))
                          }
                          className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all cursor-pointer shrink-0 self-end sm:self-auto"
                          title={isExpanded ? 'Recolher detalhes' : 'Ver assinantes desta unidade'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-700" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-700" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Subscribers Table */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 bg-gray-50/60 p-4 space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                          <span className="flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-[#6b1d2f]" />
                            Membros e Assinaturas da Unidade &quot;{unit.unitName}&quot; ({unitFilteredOrders.length})
                            {specificStatus !== 'ALL' && (
                              <span className="text-xs text-[#6b1d2f] font-bold">
                                (Filtrando por: {specificStatus})
                              </span>
                            )}
                          </span>

                          {specificStatus !== 'ALL' && (
                            <button
                              type="button"
                              onClick={() =>
                                setUnitSpecificStatusFilter((prev) => ({
                                  ...prev,
                                  [unit.unitName]: 'ALL',
                                }))
                              }
                              className="text-[11px] text-[#6b1d2f] hover:underline font-bold cursor-pointer"
                            >
                              Limpar Filtro da Unidade
                            </button>
                          )}
                        </div>

                        {unitFilteredOrders.length === 0 ? (
                          <div className="p-6 text-center text-xs text-gray-500 bg-white rounded-xl border border-gray-200">
                            Nenhum pedido encontrado para esta unidade com o filtro atual.
                          </div>
                        ) : (
                          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
                            {unitFilteredOrders.map((order) => {
                              const remaining = Math.max(0, order.totalAmount - order.amountPaid);
                              return (
                                <div
                                  key={order.id}
                                  className="p-3 hover:bg-gray-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                                >
                                  {/* Member & Lessons */}
                                  <div className="space-y-1 md:w-1/3">
                                    <h5 className="font-extrabold text-gray-900 text-sm">
                                      {order.memberName}
                                    </h5>
                                    <div className="flex flex-wrap gap-1">
                                      {order.items.map((it, idx) => (
                                        <span
                                          key={idx}
                                          className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200/60 px-2 py-0.5 rounded-md text-[10px] font-bold"
                                        >
                                          {it.quantity}x {it.lessonName}
                                        </span>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Status Pill Ellipse */}
                                  <div className="flex items-center gap-2">
                                    {order.status === 'Quitado' ? (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        Quitado (100%)
                                      </span>
                                    ) : order.status === 'Parcial' ? (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                        Parcial
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-900 border border-rose-300">
                                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                        Pendente
                                      </span>
                                    )}
                                  </div>

                                  {/* Financials */}
                                  <div className="text-right space-y-0.5">
                                    <div className="text-xs text-gray-500">
                                      Total:{' '}
                                      <strong className="text-gray-900 font-bold">
                                        R$ {order.totalAmount.toFixed(2)}
                                      </strong>
                                    </div>
                                    <div className="text-[11px] text-emerald-700 font-bold">
                                      Pago: R$ {order.amountPaid.toFixed(2)}
                                    </div>
                                    {remaining > 0 && (
                                      <div className="text-[11px] text-rose-600 font-bold">
                                        Falta: R$ {remaining.toFixed(2)}
                                      </div>
                                    )}
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center gap-1.5 self-end md:self-auto">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenPaymentModal(order)}
                                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                                      title="Lançar pagamento ou dar baixa"
                                    >
                                      <DollarSign className="w-3.5 h-3.5 text-amber-300" />
                                      <span>Dar Baixa</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleOpenDeliveryAttachmentModal(order, selectedQuarter)}
                                      className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                        order.quarterlyDeliveryDetails?.[activeQuarterKey]?.attachmentUrl
                                          ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 ring-1 ring-emerald-300'
                                          : 'text-gray-500 hover:text-amber-800 hover:bg-gray-100'
                                      }`}
                                      title={`Comprovante de entrega (${selectedQuarter}º Trimestre)`}
                                    >
                                      <Paperclip className="w-4 h-4" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditOrderModal(order)}
                                      className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
                                      title="Editar Pedido"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setOrderToDelete(order)}
                                      className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                      title="Excluir Pedido"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: IMPORTAR PLANILHA EXCEL DO PROJETO MANÁ                          */}
      {/* ========================================================================= */}
      {activeTab === 'importar' && (
        <ManaExcelImportView
          members={members}
          lessonCatalog={lessonCatalog}
          currentSubscriptions={manaSubscriptions}
          selectedQuarter={selectedQuarter}
          onConfirmImport={handleConfirmExcelImport}
          onCancelOrBack={() => setActiveTab('pedidos')}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CADASTRO DE LIÇÕES E PREÇOS (CATÁLOGO DE PRODUTOS)                */}
      {/* ========================================================================= */}
      {activeTab === 'cadastro' && (
        <div className="space-y-4">
          {catalogNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold text-xs flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{catalogNotice}</span>
              </div>
              <button type="button" onClick={() => setCatalogNotice(null)} className="text-emerald-700 hover:text-emerald-900 font-bold text-xs cursor-pointer">✕</button>
            </div>
          )}

          {catalogError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium text-xs flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{catalogError}</span>
              </div>
              <button type="button" onClick={() => setCatalogError(null)} className="text-red-700 hover:text-red-900 font-bold text-xs cursor-pointer">✕</button>
            </div>
          )}

          <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#6b1d2f]" />
                Catálogo de Lições e Preços da Escola Sabatina
              </h3>
              <p className="text-xs text-gray-500">
                Cadastre os valores atualizados das lições ou importe a tabela da Casa Publicadora / CPB via planilha.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <label className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Importar Planilha (Excel/CSV)</span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleImportExcel}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => handleOpenCatalogModal()}
                className="px-4 py-2 bg-[#6b1d2f] hover:bg-[#4a121f] text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 text-[#d4af37]" />
                <span>Nova Lição</span>
              </button>
            </div>
          </div>

          {/* Catalog Table */}
          <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden">
            <div className="divide-y divide-gray-100 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 font-extrabold text-gray-700 border-b border-gray-200 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Código CPB</th>
                    <th className="px-4 py-3">Nome da Lição</th>
                    <th className="px-4 py-3">Categoria / Público</th>
                    <th className="px-4 py-3 text-right">Preço Unitário (R$)</th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lessonCatalog.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-gray-500">
                        {item.code || 'CPB-00'}
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900 text-sm">
                        {item.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-rose-50 text-[#6b1d2f] font-bold px-2.5 py-1 rounded-lg border border-rose-200/60 text-[11px]">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-extrabold text-emerald-800 text-sm text-right">
                        R$ {item.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenCatalogModal(item)}
                            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg cursor-pointer"
                            title="Editar Lição"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCatalogItem(item)}
                            className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                            title="Excluir Lição"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PAINEL RELATÓRIO MANÁ (FINANCEIRO & CPB)                          */}
      {/* ========================================================================= */}
      {activeTab === 'relatorio' && (
        <div className="space-y-6 print-container">
          {/* Header ONLY for Printing */}
          <div className="hidden print:block border-b-2 border-gray-900 pb-4 mb-4 text-center space-y-1">
            <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">
              Igreja Adventista do Sétimo Dia • Escola Sabatina
            </h1>
            <h2 className="text-sm font-bold text-gray-700">
              RELATÓRIO FINANCEIRO & CONSOLIDAÇÃO DE PEDIDOS — PROJETO MANÁ ({selectedYear})
            </h2>
            <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2 font-mono">
              <span>{selectedQuarter}º Trimestre {selectedYear}</span>
              <span>Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</span>
            </div>
          </div>

          {/* Top Bar with Print Button */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print">
            <div className="space-y-0.5">
              <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#6b1d2f]" />
                Relatórios Financeiros e Faturamento CPB
              </h3>
              <p className="text-xs text-gray-500">
                Acompanhe o caixa arrecadado por forma de pagamento e as quantidades consolidadas para a distribuidora.
              </p>
            </div>

            <button
              type="button"
              onClick={handleTriggerPrint}
              className="w-full sm:w-auto px-5 py-2.5 bg-gray-900 hover:bg-black text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer shrink-0"
            >
              <Printer className="w-4 h-4 text-[#d4af37]" />
              <span>Imprimir Relatório Completo</span>
            </button>
          </div>

          {/* 5 Financial KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 print-break-inside-avoid">
            <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                Total Pedidos
              </span>
              <div className="text-2xl font-black text-gray-900">{totalOrdersCount}</div>
              <p className="text-[11px] text-gray-500 font-medium">Assinaturas ativas</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                Total de Lições
              </span>
              <div className="text-2xl font-black text-amber-800">{totalLessonsCount}</div>
              <p className="text-[11px] text-gray-500 font-medium">Unidades encomendadas</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                Total Previsto
              </span>
              <div className="text-2xl font-black text-gray-900">R$ {totalPredictedAmount.toFixed(2)}</div>
              <p className="text-[11px] text-gray-500 font-medium">Valor total bruto</p>
            </div>

            <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                Total Arrecadado
              </span>
              <div className="text-2xl font-black text-emerald-900">R$ {totalCollectedAmount.toFixed(2)}</div>
              <p className="text-[11px] text-emerald-700 font-medium">Caixa recebido</p>
            </div>

            <div className="bg-red-50/70 p-4 rounded-2xl border border-red-200/80 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-red-800 uppercase tracking-wider block">
                Total Pendente
              </span>
              <div className="text-2xl font-black text-red-900">R$ {totalPendingAmount.toFixed(2)}</div>
              <p className="text-[11px] text-red-700 font-medium">A receber dos irmãos</p>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEÇÃO: ARRECADAÇÃO POR TIPO / FORMA DE PAGAMENTO                          */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden print-break-inside-avoid">
            <div className="px-5 py-4 bg-emerald-900/5 border-b border-emerald-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-700" />
                  Valores Arrecadados por Forma de Pagamento
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Detalhamento das receitas no caixa por meio de pagamento (Pix, Dinheiro, Cartões, Transferências, etc.)
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-xs text-gray-500 block">Total Arrecadado</span>
                <span className="text-base font-black text-emerald-800">
                  R$ {totalCollectedAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(paymentMethodBreakdown).map(([method, data]) => {
                const percentage =
                  totalCollectedAmount > 0
                    ? ((data.total / totalCollectedAmount) * 100).toFixed(1)
                    : '0.0';

                return (
                  <div
                    key={method}
                    className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200/80 space-y-2 hover:bg-gray-100/60 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center">
                          {method === 'Pix' ? '⚡' : method === 'Dinheiro' ? '💵' : method.includes('Cartão') ? '💳' : '🏦'}
                        </div>
                        <div>
                          <span className="font-extrabold text-xs text-gray-900 block">{method}</span>
                          <span className="text-[10px] text-gray-500 font-medium">
                            {data.count} lançamento(s)
                          </span>
                        </div>
                      </div>

                      <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        {percentage}%
                      </span>
                    </div>

                    <div className="pt-1 flex items-baseline justify-between">
                      <span className="text-[11px] font-bold text-gray-400 uppercase">Arrecadado:</span>
                      <span className="text-base font-black text-gray-900">
                        R$ {data.total.toFixed(2)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, parseFloat(percentage))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Operational Consolidated Report for Master Order */}
          <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden print-break-inside-avoid">
            <div className="px-5 py-4 bg-gray-50/90 border-b border-gray-200 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#6b1d2f]" />
                  Relatório Operacional — Quantidades por Lição para Encomenda (CPB / Distribuidora)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Consolidação automática do volume total por tipo de lição para realizar o pedido mestre junto à Casa Publicadora.
                </p>
              </div>
            </div>

            <div className="divide-y divide-gray-100 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100/70 font-extrabold text-gray-700 uppercase text-[10px] tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3">Tipo de Lição</th>
                    <th className="px-5 py-3">Categoria</th>
                    <th className="px-5 py-3 text-center">Quantidade Acumulada</th>
                    <th className="px-5 py-3 text-right">Preço Unitário Ref.</th>
                    <th className="px-5 py-3 text-right">Subtotal Previsto (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {consolidatedReport.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                        Nenhum pedido de lição registrado para gerar a consolidação.
                      </td>
                    </tr>
                  ) : (
                    consolidatedReport.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-gray-900 text-sm">
                          {row.name}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="bg-gray-100 text-gray-800 font-bold px-2.5 py-0.5 rounded-md text-[11px]">
                            {row.category}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="inline-flex items-center justify-center bg-amber-100 text-amber-900 font-black px-3 py-1 rounded-xl text-sm border border-amber-300/80">
                            {row.totalQty}x
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-gray-700">
                          R$ {row.unitPrice.toFixed(2)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-extrabold text-emerald-800 text-sm">
                          R$ {row.totalValue.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-gray-50 font-black text-gray-900 border-t-2 border-gray-300 text-sm">
                  <tr>
                    <td colSpan={2} className="px-5 py-4 uppercase text-xs tracking-wider">
                      TOTAL CONSOLIDADO DA IGREJA
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="bg-[#6b1d2f] text-white px-3 py-1 rounded-xl">
                        {totalLessonsCount} Lições
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-xs font-bold text-gray-500">
                      Total Bruto:
                    </td>
                    <td className="px-5 py-4 text-right text-emerald-800 text-base">
                      R$ {totalPredictedAmount.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Relação Completa de Assinantes e Cobranças */}
          <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden print-break-inside-avoid">
            <div className="px-5 py-4 bg-gray-50/90 border-b border-gray-200">
              <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#6b1d2f]" />
                Relação Detalhada de Assinantes e Cobranças
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Listagem nominal de todos os inscritos no Projeto Maná, itens encomendados, forma de pagamento e saldo restante.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100/70 font-extrabold text-gray-700 uppercase text-[10px] tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Assinante / Membro</th>
                    <th className="px-4 py-3">Itens / Lições</th>
                    <th className="px-4 py-3 text-center">Forma Pagto</th>
                    <th className="px-4 py-3 text-right">Total (R$)</th>
                    <th className="px-4 py-3 text-right">Pago (R$)</th>
                    <th className="px-4 py-3 text-right">Pendente (R$)</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {manaSubscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                        Nenhum pedido cadastrado.
                      </td>
                    </tr>
                  ) : (
                    manaSubscriptions.map((sub) => {
                      const pending = Math.max(0, sub.totalAmount - sub.amountPaid);
                      return (
                        <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-bold text-gray-900">{sub.memberName}</td>
                          <td className="px-4 py-3 text-gray-600">
                            {sub.items.map((i) => `${i.quantity}x ${i.lessonName}`).join(', ')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="bg-gray-100 text-gray-800 font-bold px-2 py-0.5 rounded text-[10px]">
                              {sub.paymentMethod || 'Pix'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900">
                            R$ {sub.totalAmount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-800">
                            R$ {sub.amountPaid.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-red-700">
                            R$ {pending.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                sub.status === 'Quitado'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : sub.status === 'Parcial'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {sub.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signature Block ONLY for Printing */}
          <div className="hidden print:block pt-12 mt-8 border-t border-gray-300">
            <div className="grid grid-cols-2 gap-12 text-center text-xs font-bold text-gray-800">
              <div className="space-y-1">
                <div className="border-b border-gray-800 w-3/4 mx-auto pb-1" />
                <p>Diretor(a) da Escola Sabatina</p>
                <p className="text-[10px] text-gray-500 font-normal">Assinatura / Visto</p>
              </div>

              <div className="space-y-1">
                <div className="border-b border-gray-800 w-3/4 mx-auto pb-1" />
                <p>Tesoureiro(a) da Igreja</p>
                <p className="text-[10px] text-gray-500 font-normal">Assinatura / Visto</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CRIAÇÃO / EDIÇÃO DE PEDIDO MULTI-ITENS                          */}
      {/* ========================================================================= */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 md:p-6 shadow-2xl border border-gray-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <BookMarked className="w-5 h-5 text-[#6b1d2f]" />
                {editingOrderId ? 'Editar Pedido do Maná' : 'Novo Pedido de Lições do Projeto Maná'}
              </h3>
              <button
                type="button"
                onClick={() => setIsOrderModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="space-y-4 text-xs">
              {orderFormError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-bold text-xs flex items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span>{orderFormError}</span>
                  </div>
                  <button type="button" onClick={() => setOrderFormError(null)} className="text-red-700 hover:text-red-900 font-bold text-xs cursor-pointer">✕</button>
                </div>
              )}

              {/* Member Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-gray-800">
                    Membro / Assinante *
                  </label>

                  <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg text-[10px]">
                    <button
                      type="button"
                      onClick={() => {
                        setOrderMemberMode('db');
                        if (members[0]) {
                          setOrderMemberId(members[0].id);
                          setOrderMemberName(members[0].name);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                        orderMemberMode === 'db'
                          ? 'bg-white text-[#6b1d2f] shadow-xs'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      Membros da Igreja ({members.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOrderMemberMode('custom');
                        setOrderMemberId('');
                      }}
                      className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                        orderMemberMode === 'custom'
                          ? 'bg-white text-[#6b1d2f] shadow-xs'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      Outro Assinante
                    </button>
                  </div>
                </div>

                {orderMemberMode === 'db' && members.length > 0 ? (
                  <div className="space-y-1.5">
                    <select
                      value={orderMemberId}
                      onChange={(e) => handleMemberChange(e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
                    >
                      <option value="">-- Selecione o membro no banco de dados da igreja --</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.className ? `— Classe ${m.className}` : ''}
                        </option>
                      ))}
                    </select>

                    {orderMemberId && (
                      <div className="flex items-center gap-2 text-[11px] text-gray-600 font-medium px-1 bg-amber-50/60 p-2 rounded-xl border border-amber-200/60">
                        <span>Membro da Igreja:</span>
                        <strong className="text-gray-900 font-bold">{orderMemberName}</strong>
                        {members.find((m) => m.id === orderMemberId)?.className && (
                          <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-amber-300 ml-auto">
                            Classe: {members.find((m) => m.id === orderMemberId)?.className}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={orderMemberName}
                    onChange={(e) => setOrderMemberName(e.target.value)}
                    placeholder="Digite o nome completo do irmão/assinante..."
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
                  />
                )}
              </div>

              {/* Multi-Item Selection Table */}
              <div className="space-y-2 border border-gray-200 rounded-2xl p-3.5 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-gray-900 flex items-center gap-1.5 text-xs">
                    <Package className="w-4 h-4 text-[#6b1d2f]" />
                    Lições Inclusas no Pedido
                  </span>

                  <button
                    type="button"
                    onClick={handleAddOrderItem}
                    className="px-2.5 py-1 bg-[#6b1d2f] hover:bg-[#4a121f] text-white text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#d4af37]" />
                    <span>+ Adicionar Outra Lição</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {orderItems.map((item, index) => (
                    <div
                      key={index}
                      className="bg-white p-3 rounded-xl border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-xs"
                    >
                      <div className="w-full sm:w-1/2">
                        <label className="block text-[10px] font-bold text-gray-500 mb-0.5">
                          Selecione a Lição
                        </label>
                        <select
                          value={item.lessonId}
                          onChange={(e) =>
                            handleUpdateOrderItem(index, 'lessonId', e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:outline-none"
                        >
                          {lessonCatalog.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name} — R$ {cat.price.toFixed(2)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-1/2 justify-between">
                        <div className="w-20">
                          <label className="block text-[10px] font-bold text-gray-500 mb-0.5">
                            Qtd
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateOrderItem(index, 'quantity', e.target.value)
                            }
                            className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-extrabold text-center text-gray-900"
                          />
                        </div>

                        <div className="w-24">
                          <label className="block text-[10px] font-bold text-gray-500 mb-0.5">
                            Preço Un. R$
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={item.unitPrice}
                            onChange={(e) =>
                              handleUpdateOrderItem(index, 'unitPrice', e.target.value)
                            }
                            className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-right text-gray-900"
                          />
                        </div>

                        <div className="w-24 text-right">
                          <span className="block text-[10px] font-bold text-gray-500 mb-0.5">
                            Subtotal
                          </span>
                          <span className="font-black text-emerald-800 text-xs">
                            R$ {item.totalPrice.toFixed(2)}
                          </span>
                        </div>

                        {orderItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOrderItem(index)}
                            className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer mt-3 sm:mt-0"
                            title="Remover Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Live Order Dynamic Total Display */}
                <div className="pt-2 flex items-center justify-between border-t border-gray-200/80 bg-emerald-50/80 p-3 rounded-xl border border-emerald-200">
                  <span className="font-extrabold text-emerald-900 text-xs uppercase">
                    Total Automático do Pedido Individual:
                  </span>
                  <span className="text-lg font-black text-emerald-900">
                    R$ {calculatedOrderTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Multi-Payment & Split Payment System */}
              <div className="bg-gray-50/90 p-3.5 rounded-2xl border border-gray-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-2">
                  <div>
                    <span className="font-extrabold text-gray-900 flex items-center gap-1.5 text-xs">
                      <CreditCard className="w-4 h-4 text-emerald-700" />
                      Formas de Pagamento e Entradas (Pagamento Dividido / Múltiplas Formas)
                    </span>
                    <p className="text-[11px] text-gray-500 font-medium">
                      O assinante pode pagar usando múltiplas formas (ex: parte em dinheiro e parte em Pix).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddPaymentEntry('Pix')}
                    className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Adicionar Outra Forma</span>
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mr-1">
                    Atalhos Rápidos:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSetQuickSinglePayment('Pix', true)}
                    className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    ⚡ Quitar Tudo no Pix
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickSinglePayment('Dinheiro', true)}
                    className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-md text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    💵 Quitar Tudo em Dinheiro
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickSinglePayment('Cartão de Crédito', true)}
                    className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-md text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    💳 Quitar no Cartão
                  </button>
                  {remainingBalanceInOrderModal > 0 && orderPayments.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleAddPaymentEntry(orderPayments.some(p => p.method === 'Dinheiro') ? 'Pix' : 'Dinheiro', remainingBalanceInOrderModal)}
                      className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-md text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      ➕ Adicionar Restante (R$ {remainingBalanceInOrderModal.toFixed(2)})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOrderPayments([])}
                    className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-md text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    ⭕ Deixar Pendente (R$ 0)
                  </button>
                </div>

                {/* List of Payment Entries */}
                <div className="space-y-2">
                  {orderPayments.length === 0 ? (
                    <div className="bg-white p-3 rounded-xl border border-dashed border-gray-300 text-center text-xs text-gray-500">
                      Nenhum pagamento inicial registrado. O pedido ficará com status <strong>Pendente</strong>.
                      <div className="mt-1.5">
                        <button
                          type="button"
                          onClick={() => handleAddPaymentEntry('Pix')}
                          className="text-[#6b1d2f] hover:underline font-bold"
                        >
                          + Adicionar entrada agora
                        </button>
                      </div>
                    </div>
                  ) : (
                    orderPayments.map((pEntry, pIdx) => (
                      <div
                        key={pEntry.id || pIdx}
                        className="bg-white p-2.5 rounded-xl border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-xs"
                      >
                        <div className="flex items-center gap-2 w-full sm:w-1/3">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-900 font-black text-[10px] flex items-center justify-center shrink-0">
                            {pIdx + 1}
                          </span>
                          <div className="w-full">
                            <label className="block text-[9px] font-bold text-gray-400 uppercase">
                              Forma
                            </label>
                            <select
                              value={pEntry.method}
                              onChange={(e) =>
                                handleUpdatePaymentEntry(pIdx, 'method', e.target.value)
                              }
                              className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:outline-none"
                            >
                              <option value="Pix">⚡ Pix</option>
                              <option value="Dinheiro">💵 Dinheiro</option>
                              <option value="Cartão de Crédito">💳 Cartão de Crédito</option>
                              <option value="Cartão de Débito">💳 Cartão de Débito</option>
                              <option value="Transferência">🏦 Transferência</option>
                              <option value="Outro">Outro</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-2/3 justify-between">
                          <div className="w-28">
                            <label className="block text-[9px] font-bold text-gray-400 uppercase">
                              Valor R$
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={pEntry.amount}
                              onChange={(e) =>
                                handleUpdatePaymentEntry(pIdx, 'amount', e.target.value)
                              }
                              className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-lg text-xs font-black text-emerald-800 text-right focus:outline-none"
                            />
                          </div>

                          <div className="w-28">
                            <label className="block text-[9px] font-bold text-gray-400 uppercase">
                              Data
                            </label>
                            <input
                              type="date"
                              value={pEntry.date || new Date().toISOString().slice(0, 10)}
                              onChange={(e) =>
                                handleUpdatePaymentEntry(pIdx, 'date', e.target.value)
                              }
                              className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none"
                            />
                          </div>

                          <div className="w-32">
                            <label className="block text-[9px] font-bold text-gray-400 uppercase">
                              Nota / Parcela
                            </label>
                            <input
                              type="text"
                              placeholder="Ex: 1ª parte"
                              value={pEntry.notes || ''}
                              onChange={(e) =>
                                handleUpdatePaymentEntry(pIdx, 'notes', e.target.value)
                              }
                              className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-800 focus:outline-none"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemovePaymentEntry(pIdx)}
                            className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer mt-3 sm:mt-0"
                            title="Remover Esta Forma"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Live Payment Summary Balance */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-gray-200 bg-white p-2.5 rounded-xl border border-gray-200 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-500">
                      Total Pago:{' '}
                      <strong className="font-black text-emerald-700">
                        R$ {totalPaidInOrderModal.toFixed(2)}
                      </strong>
                    </span>
                    <span className="font-medium text-gray-500">
                      Saldo Restante:{' '}
                      <strong
                        className={`font-black ${
                          remainingBalanceInOrderModal > 0
                            ? 'text-amber-700'
                            : 'text-gray-900'
                        }`}
                      >
                        R$ {remainingBalanceInOrderModal.toFixed(2)}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      Status Automático:
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                        totalPaidInOrderModal >= calculatedOrderTotal && calculatedOrderTotal > 0
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                          : totalPaidInOrderModal > 0
                          ? 'bg-amber-100 border-amber-300 text-amber-800'
                          : 'bg-red-100 border-red-300 text-red-800'
                      }`}
                    >
                      {totalPaidInOrderModal >= calculatedOrderTotal && calculatedOrderTotal > 0
                        ? 'Quitado'
                        : totalPaidInOrderModal > 0
                        ? 'Parcial'
                        : 'Pendente'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Observações Gerais do Pedido
                </label>
                <input
                  type="text"
                  placeholder="Ex: Assinante solicitou entrega na classe; pagou parte em dinheiro e o restante via Pix..."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#6b1d2f] hover:bg-[#4a121f] text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Check className="w-4 h-4 text-[#d4af37]" />
                  <span>{editingOrderId ? 'Salvar Alterações' : 'Confirmar Pedido'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: REGISTRO RÁPIDO DE PAGAMENTO (BAIXA FINANCEIRA)                  */}
      {/* ========================================================================= */}
      {isPaymentModalOpen && selectedOrderForPayment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-700" />
                Registrar Pagamento — {selectedOrderForPayment.memberName}
              </h3>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-3.5 text-xs">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">Total do Pedido:</span>
                  <strong className="text-gray-900 font-bold">
                    R$ {selectedOrderForPayment.totalAmount.toFixed(2)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">Valor Já Quitado:</span>
                  <strong className="text-emerald-700 font-bold">
                    R$ {selectedOrderForPayment.amountPaid.toFixed(2)}
                  </strong>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-1 text-sm font-black">
                  <span className="text-red-700">Saldo Restante:</span>
                  <span className="text-red-700">
                    R${' '}
                    {Math.max(
                      0,
                      selectedOrderForPayment.totalAmount - selectedOrderForPayment.amountPaid
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* History of existing payments for this order */}
              {selectedOrderForPayment.payments && selectedOrderForPayment.payments.length > 0 && (
                <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-200/80 space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase text-emerald-900 block">
                    Histórico de Pagamentos Já Realizados ({selectedOrderForPayment.payments.length}):
                  </span>
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {selectedOrderForPayment.payments.map((p, idx) => (
                      <div
                        key={p.id || idx}
                        className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-emerald-100 text-[11px]"
                      >
                        <span className="font-bold text-gray-800 flex items-center gap-1">
                          <span>{p.method === 'Pix' ? '⚡' : p.method === 'Dinheiro' ? '💵' : '💳'}</span>
                          {p.method}
                          {p.notes && <span className="text-gray-500 font-normal">({p.notes})</span>}
                        </span>
                        <div className="text-right">
                          <strong className="text-emerald-800 font-bold">
                            R$ {p.amount.toFixed(2)}
                          </strong>
                          {p.date && (
                            <span className="text-[9px] text-gray-400 block">{p.date}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New installment / split payment entry */}
              <div className="space-y-2 border-t border-gray-100 pt-2">
                <span className="text-[11px] font-extrabold text-gray-900 block">
                  Registrar Nova Parcela / Nova Entrada:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">
                      Valor a Pagar Agora (R$)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={newPaymentAmount}
                      onChange={(e) => {
                        const val = e.target.value;
                        const parsed = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : Number(val);
                        setNewPaymentAmount(isNaN(parsed) ? 0 : parsed);
                      }}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-black text-emerald-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-800 mb-1">
                      Forma de Pagamento
                    </label>
                    <select
                      value={newPaymentMethod}
                      onChange={(e) => setNewPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none"
                    >
                      <option value="Pix">⚡ Pix</option>
                      <option value="Dinheiro">💵 Dinheiro</option>
                      <option value="Cartão de Crédito">💳 Cartão de Crédito</option>
                      <option value="Cartão de Débito">💳 Cartão de Débito</option>
                      <option value="Transferência">🏦 Transferência Bancária</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">
                      Data do Pagamento
                    </label>
                    <input
                      type="date"
                      value={newPaymentDate}
                      onChange={(e) => setNewPaymentDate(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-800 mb-1">
                      Observação / Parcela
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 2ª parcela no Pix"
                      value={newPaymentNotes}
                      onChange={(e) => setNewPaymentNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmar Recebimento</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CADASTRO / EDIÇÃO DE LIÇÃO NO CATÁLOGO                          */}
      {/* ========================================================================= */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#6b1d2f]" />
                {catalogFormData.id ? 'Editar Lição do Catálogo' : 'Nova Lição no Catálogo'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCatalogModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCatalogItem} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Código da Lição (CPB / Ref)
                </label>
                <input
                  type="text"
                  placeholder="Ex: CPB-01"
                  value={catalogFormData.code}
                  onChange={(e) =>
                    setCatalogFormData({ ...catalogFormData, code: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono font-bold text-gray-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Nome da Lição *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Lição de Adultos - Aluno"
                  value={catalogFormData.name}
                  onChange={(e) =>
                    setCatalogFormData({ ...catalogFormData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Categoria / Público
                </label>
                <select
                  value={catalogFormData.category}
                  onChange={(e) =>
                    setCatalogFormData({ ...catalogFormData, category: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none"
                >
                  <option value="Adultos">Adultos</option>
                  <option value="Jovens">Jovens</option>
                  <option value="Adolescentes">Adolescentes / Teens</option>
                  <option value="Juvenis">Juvenis</option>
                  <option value="Primários">Primários</option>
                  <option value="Infantil">Infantil / Jardim</option>
                  <option value="Bebês / Róis">Bebês / Rol dos Berços</option>
                  <option value="Geral">Geral / Meditações / Informativo</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Preço Unitário (R$) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={catalogFormData.price}
                  onChange={(e) => {
                    const val = e.target.value;
                    const parsed = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : Number(val);
                    setCatalogFormData({
                      ...catalogFormData,
                      price: isNaN(parsed) ? 0 : parsed,
                    });
                  }}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-black text-emerald-800 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCatalogModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#6b1d2f] hover:bg-[#4a121f] text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Check className="w-4 h-4 text-[#d4af37]" />
                  <span>Salvar no Catálogo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EXCLUIR ITEM DO CATÁLOGO                                           */}
      {/* ========================================================================= */}
      {catalogItemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900">Excluir Lição do Catálogo</h3>
              <p className="text-xs text-gray-600 mt-1">
                Tem certeza que deseja remover <strong>&quot;{catalogItemToDelete.name}&quot;</strong> do catálogo de preços?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCatalogItemToDelete(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onSaveLessonCatalog(lessonCatalog.filter((c) => c.id !== catalogItemToDelete.id));
                  setCatalogItemToDelete(null);
                  setCatalogNotice('Lição removida do catálogo com sucesso!');
                  setTimeout(() => setCatalogNotice(null), 4000);
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

      {/* ========================================================================= */}
      {/* MODAL: EXCLUIR PEDIDO                                                     */}
      {/* ========================================================================= */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900">Excluir Pedido</h3>
              <p className="text-xs text-gray-600 mt-1">
                Deseja realmente cancelar/excluir o pedido de <strong>&quot;{orderToDelete.memberName}&quot;</strong>?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteManaOrder(orderToDelete.id);
                  setOrderToDelete(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Excluir Pedido</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: IMPORTAR PEDIDOS DOS MEMBROS DA IGREJA EM LOTE                    */}
      {/* ========================================================================= */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 md:p-6 shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">
                    Importar Pedidos dos Membros da Igreja
                  </h3>
                  <p className="text-xs text-gray-500">
                    Gere assinaturas do Projeto Maná em lote para os membros cadastrados na igreja.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmBatchImport} className="space-y-4 text-xs">
              {/* Select Lesson to Assign */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80">
                <div>
                  <label className="block font-bold text-gray-900 mb-1">
                    Selecione a Lição Padrão *
                  </label>
                  <select
                    value={batchLessonId}
                    onChange={(e) => setBatchLessonId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
                  >
                    {lessonCatalog.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — R$ {item.price.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-900 mb-1">
                    Status de Pagamento Inicial
                  </label>
                  <select
                    value={batchPaymentStatus}
                    onChange={(e) => setBatchPaymentStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
                  >
                    <option value="Pendente">Pendente (A pagar)</option>
                    <option value="Quitado">Quitado (Pago via Pix/Dinheiro)</option>
                  </select>
                </div>
              </div>

              {/* Filter and Member List */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                  <span className="font-extrabold text-gray-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Selecione os Membros da Igreja ({batchSelectedMemberIds.length} de {members.length} selecionados):
                  </span>

                  <button
                    type="button"
                    onClick={handleToggleAllBatchMembers}
                    className="text-xs font-bold text-[#6b1d2f] hover:underline cursor-pointer"
                  >
                    {batchSelectedMemberIds.length === members.length
                      ? 'Desmarcar Todos'
                      : 'Selecionar Todos'}
                  </button>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Filtrar por nome do membro..."
                      value={batchSearchTerm}
                      onChange={(e) => setBatchSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
                    />
                  </div>

                  <select
                    value={batchClassFilter}
                    onChange={(e) => setBatchClassFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#6b1d2f]"
                  >
                    <option value="ALL">Todas as Classes</option>
                    {Array.from(new Set(members.map((m) => m.className))).map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Members List with Checkboxes */}
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-2xl divide-y divide-gray-100 bg-gray-50/50">
                  {members
                    .filter((m) => {
                      const matchesSearch = m.name
                        .toLowerCase()
                        .includes(batchSearchTerm.toLowerCase());
                      const matchesClass =
                        batchClassFilter === 'ALL' || m.className === batchClassFilter;
                      return matchesSearch && matchesClass;
                    })
                    .map((member) => {
                      const isSelected = batchSelectedMemberIds.includes(member.id);
                      return (
                        <label
                          key={member.id}
                          className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isSelected ? 'bg-emerald-50/80 hover:bg-emerald-100/80' : 'hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleBatchMember(member.id)}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <div>
                              <div className="font-bold text-gray-900">{member.name}</div>
                              <div className="text-[10px] text-gray-500 font-medium">
                                Status: {member.status} {member.isTeacher ? '• Professor' : ''}
                              </div>
                            </div>
                          </div>

                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md shrink-0">
                            Classe: {member.className}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={batchSelectedMemberIds.length === 0}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-amber-300" />
                  <span>
                    Importar Pedidos para {batchSelectedMemberIds.length} Membro(s)
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL / DEDICATED PRINT PREVIEW & EXPORT DIALOG                           */}
      {/* ========================================================================= */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200 no-print">
          <div className="bg-white rounded-3xl max-w-4xl w-full h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100">
            {/* Modal Header Bar */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-[#4a121f] to-[#6b1d2f] text-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                  <Printer className="w-5 h-5 text-[#d4af37]" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                    Visualizador de Relatório Maná
                  </h3>
                  <p className="text-xs text-amber-200/90 font-medium">
                    {selectedQuarter}º Trimestre {selectedYear} • Pronto para Impressão e PDF
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="p-3 bg-amber-50/80 border-b border-amber-200/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="text-xs text-amber-900 font-bold flex items-center gap-1.5 px-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Opções de impressão e exportação:</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    try { window.print(); } catch (e) { console.error(e); }
                  }}
                  className="px-3.5 py-1.5 bg-[#6b1d2f] hover:bg-[#4a121f] text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>Imprimir Agora (Ctrl + P)</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenPrintWindow}
                  className="px-3.5 py-1.5 bg-gray-900 hover:bg-black text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                  <span>Abrir em Nova Aba (Ideal p/ PDF)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyReportText}
                  className="px-3 py-1.5 bg-white border border-gray-300 text-gray-800 hover:bg-gray-100 text-xs font-extrabold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-gray-600" />
                  <span>Copiar Resumo (WhatsApp)</span>
                </button>
              </div>
            </div>

            {/* Scrollable Document Body */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-gray-900 text-xs font-sans">
              {/* Official Header */}
              <div className="border-b-2 border-gray-900 pb-4 text-center space-y-1">
                <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                  Igreja Adventista do Sétimo Dia • Escola Sabatina
                </h1>
                <h2 className="text-sm font-bold text-gray-700">
                  RELATÓRIO FINANCEIRO & CONSOLIDAÇÃO DE PEDIDOS — PROJETO MANÁ ({selectedYear})
                </h2>
                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2 font-mono">
                  <span>{selectedQuarter}º Trimestre {selectedYear}</span>
                  <span>Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</span>
                </div>
              </div>

              {/* KPI Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-center">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Pedidos</span>
                  <span className="text-lg font-black text-gray-900">{totalOrdersCount}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-center">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Lições</span>
                  <span className="text-lg font-black text-amber-800">{totalLessonsCount}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-center">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Previsto</span>
                  <span className="text-lg font-black text-gray-900">R$ {totalPredictedAmount.toFixed(2)}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-center">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Arrecadado</span>
                  <span className="text-lg font-black text-emerald-700">R$ {totalCollectedAmount.toFixed(2)}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-center col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Pendente</span>
                  <span className="text-lg font-black text-rose-700">R$ {totalPendingAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase text-[#6b1d2f] border-b border-gray-200 pb-1">
                  1. Arrecadação por Forma de Pagamento
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {Object.entries(paymentMethodBreakdown).map(([method, data]) => {
                    const pct = totalCollectedAmount > 0 ? ((data.total / totalCollectedAmount) * 100).toFixed(1) : '0.0';
                    return (
                      <div key={method} className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                        <div>
                          <span className="font-extrabold text-xs block text-gray-900">{method}</span>
                          <span className="text-[10px] text-gray-500 font-medium">{data.count} lançamento(s)</span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-emerald-800 text-sm block">R$ {data.total.toFixed(2)}</span>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Master Order Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase text-[#6b1d2f] border-b border-gray-200 pb-1">
                  2. Quantidades por Lição para Encomenda Mestre (CPB / Distribuidora)
                </h3>
                <table className="w-full text-left text-xs border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-100 font-black text-gray-700 uppercase text-[10px]">
                    <tr>
                      <th className="p-2 border-b">Tipo de Lição</th>
                      <th className="p-2 border-b">Categoria</th>
                      <th className="p-2 border-b text-center">Qtd. Acumulada</th>
                      <th className="p-2 border-b text-right">Preço Unit.</th>
                      <th className="p-2 border-b text-right">Subtotal (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {consolidatedReport.map((item) => (
                      <tr key={item.name}>
                        <td className="p-2 font-bold text-gray-900">{item.name}</td>
                        <td className="p-2 text-gray-600">{item.category}</td>
                        <td className="p-2 text-center font-black">{item.totalQty}x</td>
                        <td className="p-2 text-right">R$ {item.unitPrice.toFixed(2)}</td>
                        <td className="p-2 text-right font-black text-gray-900">R$ {item.totalValue.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-black">
                      <td colSpan={2} className="p-2">TOTAL CONSOLIDADO DA IGREJA</td>
                      <td className="p-2 text-center">{totalLessonsCount} Lições</td>
                      <td className="p-2 text-right">Total Bruto:</td>
                      <td className="p-2 text-right text-emerald-800 font-black text-sm">R$ {totalPredictedAmount.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Detailed Subscribers Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase text-[#6b1d2f] border-b border-gray-200 pb-1">
                  3. Relação Detalhada de Assinantes e Cobranças
                </h3>
                <table className="w-full text-left text-xs border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-100 font-black text-gray-700 uppercase text-[10px]">
                    <tr>
                      <th className="p-2 border-b">Assinante</th>
                      <th className="p-2 border-b">Itens Encomendados</th>
                      <th className="p-2 border-b text-center">Forma Pagto</th>
                      <th className="p-2 border-b text-right">Total (R$)</th>
                      <th className="p-2 border-b text-right">Pago (R$)</th>
                      <th className="p-2 border-b text-right">Pendente (R$)</th>
                      <th className="p-2 border-b text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {manaSubscriptions.map((sub) => {
                      const pending = Math.max(0, sub.totalAmount - sub.amountPaid);
                      return (
                        <tr key={sub.id}>
                          <td className="p-2 font-bold text-gray-900">{sub.memberName}</td>
                          <td className="p-2 text-gray-600">{sub.items.map((i) => `${i.quantity}x ${i.lessonName}`).join(', ')}</td>
                          <td className="p-2 text-center font-bold text-gray-700">{sub.paymentMethod || 'Pix'}</td>
                          <td className="p-2 text-right font-bold">R$ {sub.totalAmount.toFixed(2)}</td>
                          <td className="p-2 text-right font-bold text-emerald-700">R$ {sub.amountPaid.toFixed(2)}</td>
                          <td className="p-2 text-right font-bold text-rose-700">R$ {pending.toFixed(2)}</td>
                          <td className="p-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              sub.status === 'Quitado' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {sub.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="pt-10 border-t border-gray-300 grid grid-cols-2 gap-8 text-center text-xs font-bold text-gray-800">
                <div className="space-y-1">
                  <div className="border-b border-gray-800 w-3/4 mx-auto pb-1" />
                  <p>Diretor(a) da Escola Sabatina</p>
                </div>
                <div className="space-y-1">
                  <div className="border-b border-gray-800 w-3/4 mx-auto pb-1" />
                  <p>Tesoureiro(a) da Igreja</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-gray-500 font-medium text-center sm:text-left">
                💡 Dica: Se o seu navegador bloquear a impressão no iframe, use o botão <strong>&quot;Abrir em Nova Aba&quot;</strong> para salvar como PDF ou imprimir sem bloqueios.
              </span>
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="w-full sm:w-auto px-5 py-2 bg-gray-900 hover:bg-black text-white font-extrabold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Attachment Modal per Quarter */}
      {deliveryModalOrder && (
        <DeliveryAttachmentModal
          isOpen={Boolean(deliveryModalOrder)}
          onClose={() => setDeliveryModalOrder(null)}
          order={deliveryModalOrder}
          initialQuarter={deliveryModalQuarter}
          selectedYear={selectedYear}
          onSaveDelivery={handleSaveDeliveryAttachment}
          members={members}
        />
      )}
    </div>
  );
};
