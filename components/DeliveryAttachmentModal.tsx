'use client';

import React, { useState, useRef } from 'react';
import {
  ManaSubscription,
  QuarterlyDeliveryRecord,
  Member,
} from '@/lib/types';
import {
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Paperclip,
  Upload,
  Trash2,
  Eye,
  Download,
  FileText,
  Calendar,
  User,
  Check,
  PackageCheck,
  RefreshCw,
} from 'lucide-react';

interface DeliveryAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: ManaSubscription | null;
  initialQuarter?: number; // 1 | 2 | 3 | 4
  onSaveDelivery: (updatedOrder: ManaSubscription) => void;
  members?: Member[];
}

export function DeliveryAttachmentModal(props: DeliveryAttachmentModalProps) {
  if (!props.isOpen || !props.order) return null;

  return (
    <DeliveryAttachmentModalContent
      key={`${props.order.id}-${props.initialQuarter ?? 1}`}
      order={props.order}
      onClose={props.onClose}
      initialQuarter={props.initialQuarter}
      onSaveDelivery={props.onSaveDelivery}
      members={props.members}
    />
  );
}

interface DeliveryAttachmentModalContentProps {
  order: ManaSubscription;
  onClose: () => void;
  initialQuarter?: number;
  onSaveDelivery: (updatedOrder: ManaSubscription) => void;
  members?: Member[];
}

function DeliveryAttachmentModalContent({
  order,
  onClose,
  initialQuarter = 1,
  onSaveDelivery,
}: DeliveryAttachmentModalContentProps) {
  const [selectedQ, setSelectedQ] = useState<1 | 2 | 3 | 4>(
    (initialQuarter >= 1 && initialQuarter <= 4 ? initialQuarter : 1) as 1 | 2 | 3 | 4
  );

  // Local draft of quarterly deliveries and details initialized from order
  const [localQuarterly, setLocalQuarterly] = useState<{
    q1: 'Entregue' | 'Pendente' | 'A caminho';
    q2: 'Entregue' | 'Pendente' | 'A caminho';
    q3: 'Entregue' | 'Pendente' | 'A caminho';
    q4: 'Entregue' | 'Pendente' | 'A caminho';
  }>(() => ({
    q1: order.quarterlyDelivery?.q1 || 'Pendente',
    q2: order.quarterlyDelivery?.q2 || 'Pendente',
    q3: order.quarterlyDelivery?.q3 || 'Pendente',
    q4: order.quarterlyDelivery?.q4 || 'Pendente',
  }));

  const [localDetails, setLocalDetails] = useState<{
    q1?: QuarterlyDeliveryRecord;
    q2?: QuarterlyDeliveryRecord;
    q3?: QuarterlyDeliveryRecord;
    q4?: QuarterlyDeliveryRecord;
  }>(() => order.quarterlyDeliveryDetails || {});

  const [previewZoomUrl, setPreviewZoomUrl] = useState<string | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentQKey = `q${selectedQ}` as 'q1' | 'q2' | 'q3' | 'q4';
  const currentStatus = localQuarterly[currentQKey] || 'Pendente';
  const currentDetail: QuarterlyDeliveryRecord = localDetails[currentQKey] || {
    status: currentStatus,
    deliveredAt: '',
    deliveredBy: '',
    recipientName: '',
    notes: '',
  };

  const handleUpdateCurrentDetail = (updates: Partial<QuarterlyDeliveryRecord>) => {
    setLocalDetails((prev) => ({
      ...prev,
      [currentQKey]: {
        ...(prev[currentQKey] || {
          status: currentStatus,
        }),
        ...updates,
      },
    }));
  };

  const handleStatusChange = (newStatus: 'Entregue' | 'A caminho' | 'Pendente') => {
    setLocalQuarterly((prev) => ({
      ...prev,
      [currentQKey]: newStatus,
    }));

    // If changing to 'Entregue' and no delivery date is set, default to today
    const today = new Date().toISOString().slice(0, 10);
    const existingDate = currentDetail.deliveredAt;

    handleUpdateCurrentDetail({
      status: newStatus,
      deliveredAt: newStatus === 'Entregue' && !existingDate ? today : existingDate,
    });
  };

  // Handle file upload
  const handleFileProcess = (file: File) => {
    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      alert('O arquivo selecionado é muito grande. O limite máximo é de 10 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const isImg = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      const today = new Date().toISOString().slice(0, 10);

      // Auto-set status to Entregue when attaching proof if currently Pendente
      const newStatus = currentStatus === 'Pendente' ? 'Entregue' : currentStatus;
      if (currentStatus === 'Pendente') {
        setLocalQuarterly((prev) => ({
          ...prev,
          [currentQKey]: 'Entregue',
        }));
      }

      handleUpdateCurrentDetail({
        status: newStatus,
        deliveredAt: currentDetail.deliveredAt || today,
        attachmentName: file.name,
        attachmentUrl: dataUrl,
        attachmentType: isImg ? 'image' : isPdf ? 'pdf' : 'document',
        attachmentSize: file.size,
      });

      setSaveSuccessNotice(`Anexo "${file.name}" carregado com sucesso!`);
      setTimeout(() => setSaveSuccessNotice(null), 3000);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
    // reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleRemoveAttachment = () => {
    if (confirm('Tem certeza de que deseja remover o anexo deste trimestre?')) {
      handleUpdateCurrentDetail({
        attachmentName: undefined,
        attachmentUrl: undefined,
        attachmentType: undefined,
        attachmentSize: undefined,
      });
      setSaveSuccessNotice('Anexo removido.');
      setTimeout(() => setSaveSuccessNotice(null), 2500);
    }
  };

  const handleDownloadAttachment = () => {
    if (!currentDetail.attachmentUrl) return;
    const a = document.createElement('a');
    a.href = currentDetail.attachmentUrl;
    a.download = currentDetail.attachmentName || `comprovante_entrega_${selectedQ}trimestre.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSave = () => {
    const qKey = `q${selectedQ}` as 'q1' | 'q2' | 'q3' | 'q4';
    const mainDeliveryStatus = localQuarterly[qKey] || order.deliveryStatus;

    const updatedOrder: ManaSubscription = {
      ...order,
      quarterlyDelivery: localQuarterly,
      quarterlyDeliveryDetails: localDetails,
      deliveryStatus: mainDeliveryStatus,
    };

    onSaveDelivery(updatedOrder);
    setSaveSuccessNotice('Comprovante e status salvos com sucesso!');
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 text-white p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/20 backdrop-blur-xs">
              <PackageCheck className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">Comprovante de Entrega de Lições</h3>
                <span className="text-[11px] bg-amber-400/20 text-amber-200 font-bold px-2 py-0.5 rounded-full border border-amber-300/30">
                  Por Trimestre
                </span>
              </div>
              <p className="text-xs text-amber-100/90 mt-0.5">
                Assinante: <strong className="text-white font-bold">{order.memberName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subheader info: Items Ordered */}
        <div className="bg-amber-50/70 border-b border-amber-100 px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-amber-950 font-medium">
            <span className="font-bold text-amber-900">Lições Solicitadas:</span>
            <span className="text-amber-800">
              {order.items && order.items.length > 0
                ? order.items.map((i) => `${i.quantity}x ${i.lessonName}`).join(' • ')
                : '1x Lição'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-medium">Total:</span>
            <span className="font-bold text-gray-900">R$ {order.totalAmount.toFixed(2)}</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                order.status === 'Quitado'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : order.status === 'Parcial'
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-rose-100 text-rose-800 border border-rose-200'
              }`}
            >
              {order.status}
            </span>
          </div>
        </div>

        {/* Quarter Tabs */}
        <div className="bg-gray-50 border-b border-gray-200 px-5 pt-3">
          <div className="flex space-x-1 sm:space-x-2">
            {[1, 2, 3, 4].map((q) => {
              const qKey = `q${q}` as 'q1' | 'q2' | 'q3' | 'q4';
              const qStatus = localQuarterly[qKey] || 'Pendente';
              const hasAttachment = Boolean(localDetails[qKey]?.attachmentUrl);
              const isSelected = selectedQ === q;

              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => setSelectedQ(q as 1 | 2 | 3 | 4)}
                  className={`flex-1 py-2 px-2 text-center rounded-t-xl text-xs font-bold transition-all border-t border-x cursor-pointer flex flex-col items-center gap-1 ${
                    isSelected
                      ? 'bg-white border-gray-300 text-amber-900 border-b-2 border-b-white -mb-px shadow-xs'
                      : 'bg-gray-100/80 border-transparent text-gray-600 hover:bg-gray-200/60'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 w-full">
                    <span>{q}º Trimestre</span>
                    {hasAttachment && (
                      <span
                        className="inline-flex items-center text-[10px] bg-emerald-100 text-emerald-800 font-black px-1 rounded-sm"
                        title="Possui comprovante anexado"
                      >
                        📎
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md ${
                      qStatus === 'Entregue'
                        ? 'bg-emerald-100 text-emerald-800'
                        : qStatus === 'A caminho'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {qStatus}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body content for selected quarter */}
        <div className="p-5 space-y-5">
          {saveSuccessNotice && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessNotice}</span>
            </div>
          )}

          {/* Delivery Status selector */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
              Status da Entrega — {selectedQ}º Trimestre 2026:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleStatusChange('Entregue')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  currentStatus === 'Entregue'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-200'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <CheckCircle2
                  className={`w-4 h-4 ${
                    currentStatus === 'Entregue' ? 'text-emerald-600' : 'text-gray-400'
                  }`}
                />
                <span>Entregue</span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('A caminho')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  currentStatus === 'A caminho'
                    ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-200'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Clock
                  className={`w-4 h-4 ${
                    currentStatus === 'A caminho' ? 'text-amber-600' : 'text-gray-400'
                  }`}
                />
                <span>A caminho</span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('Pendente')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  currentStatus === 'Pendente'
                    ? 'bg-gray-100 border-gray-400 text-gray-800 ring-2 ring-gray-200'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <AlertCircle
                  className={`w-4 h-4 ${
                    currentStatus === 'Pendente' ? 'text-gray-600' : 'text-gray-400'
                  }`}
                />
                <span>Pendente</span>
              </button>
            </div>
          </div>

          {/* Delivery Details Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50/80 p-3.5 rounded-xl border border-gray-200">
            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-500" />
                Data da Entrega:
              </label>
              <input
                type="date"
                value={currentDetail.deliveredAt || ''}
                onChange={(e) => handleUpdateCurrentDetail({ deliveredAt: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-gray-500" />
                Entregue por (Responsável):
              </label>
              <input
                type="text"
                placeholder="Ex: Diretor(a) da ES, Professor(a)..."
                value={currentDetail.deliveredBy || ''}
                onChange={(e) => handleUpdateCurrentDetail({ deliveredBy: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-gray-600 mb-1">
                Recebido por / Observação:
              </label>
              <input
                type="text"
                placeholder="Ex: Entregue em mãos na classe; retirado pelo cônjuge..."
                value={currentDetail.recipientName || ''}
                onChange={(e) => handleUpdateCurrentDetail({ recipientName: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Anexo de Comprovante de Entrega */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5 uppercase tracking-wider">
                <Paperclip className="w-4 h-4 text-amber-700" />
                <span>Anexo do Comprovante de Entrega ({selectedQ}º Trim):</span>
              </label>
              {currentDetail.attachmentUrl && (
                <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" />
                  Comprovante Anexado
                </span>
              )}
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept="image/*,application/pdf"
              className="hidden"
            />

            {currentDetail.attachmentUrl ? (
              /* Display Current Attachment */
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {currentDetail.attachmentType === 'image' ? (
                    <div
                      onClick={() => setPreviewZoomUrl(currentDetail.attachmentUrl || null)}
                      className="relative w-14 h-14 rounded-lg overflow-hidden border border-emerald-300 bg-white cursor-pointer shrink-0 group shadow-xs"
                      title="Clique para ampliar imagem"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentDetail.attachmentUrl}
                        alt="Comprovante"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Eye className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-red-100 border border-red-200 flex flex-col items-center justify-center text-red-700 shrink-0">
                      <FileText className="w-6 h-6" />
                      <span className="text-[9px] font-black uppercase">PDF</span>
                    </div>
                  )}

                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-gray-900 truncate max-w-[200px] sm:max-w-xs">
                      {currentDetail.attachmentName || 'Comprovante_de_Entrega'}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {formatFileSize(currentDetail.attachmentSize)} • Anexado para o {selectedQ}º Trimestre
                    </p>
                  </div>
                </div>

                {/* Actions on existing attachment */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                  {currentDetail.attachmentType === 'image' && (
                    <button
                      type="button"
                      onClick={() => setPreviewZoomUrl(currentDetail.attachmentUrl || null)}
                      className="px-2.5 py-1.5 bg-white hover:bg-gray-100 text-gray-700 font-semibold text-xs rounded-lg border border-gray-300 transition-all flex items-center gap-1 cursor-pointer"
                      title="Visualizar anexo em tamanho grande"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>Ver</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadAttachment}
                    className="px-2.5 py-1.5 bg-white hover:bg-gray-100 text-gray-700 font-semibold text-xs rounded-lg border border-gray-300 transition-all flex items-center gap-1 cursor-pointer"
                    title="Baixar comprovante"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Baixar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 bg-white hover:bg-gray-100 text-gray-700 font-semibold text-xs rounded-lg border border-gray-300 transition-all flex items-center gap-1 cursor-pointer"
                    title="Substituir anexo por outro arquivo"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                    <span>Substituir</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRemoveAttachment}
                    className="p-1.5 bg-white hover:bg-red-50 text-red-600 rounded-lg border border-red-200 transition-all cursor-pointer"
                    title="Excluir este anexo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Dropzone / Upload Box */
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-amber-500 bg-amber-50/50 scale-[1.01]'
                    : 'border-gray-300 bg-gray-50/60 hover:bg-amber-50/30 hover:border-amber-400'
                }`}
              >
                <div className="w-10 h-10 mx-auto rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-gray-800">
                  Clique ou arraste o comprovante de entrega do {selectedQ}º Trimestre
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Foto da lição entregue, assinatura do membro ou recibo em JPG, PNG ou PDF (até 10 MB)
                </p>
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Selecionar Foto ou Arquivo</span>
                </button>
              </div>
            )}
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              Observações Gerais da Entrega ({selectedQ}º Trim):
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Lição entregue durante o culto de quarta; comprovante assinado no verso..."
              value={currentDetail.notes || ''}
              onChange={(e) => handleUpdateCurrentDetail({ notes: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-100/90 border-t border-gray-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <span>Trimestre Atual:</span>
            <strong className="text-amber-900 font-bold">{selectedQ}º Trimestre 2026</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl border border-gray-300 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 text-amber-200" />
              <span>Salvar Comprovante</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox / Zoom Preview Modal */}
      {previewZoomUrl && (
        <div
          onClick={() => setPreviewZoomUrl(null)}
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl border border-white/20 flex flex-col"
          >
            <div className="p-3 bg-gray-900 text-white flex items-center justify-between">
              <span className="text-xs font-bold truncate max-w-md">
                Visualização do Comprovante — {order.memberName} ({selectedQ}º Trimestre)
              </span>
              <button
                type="button"
                onClick={() => setPreviewZoomUrl(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 overflow-auto max-h-[75vh] flex items-center justify-center bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewZoomUrl}
                alt="Comprovante ampliado"
                className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
              />
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleDownloadAttachment}
                className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Imagem</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewZoomUrl(null)}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs rounded-lg transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
