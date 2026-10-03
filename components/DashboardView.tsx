'use client';

import React, { useState } from 'react';
import {
  Member,
  ClassUnit,
  RollCallRecord,
  ManaSubscription,
  SabbathDate,
  CriteriaPointsConfig,
  UnitWeeklyData,
  calculateRecordScore,
  getMaxPossibleScore,
  calculateOfferingPoints,
  calculateUnitFinalScore,
} from '@/lib/types';
import {
  Users,
  CheckSquare,
  GraduationCap,
  BookMarked,
  TrendingUp,
  Award,
  DollarSign,
  Bot,
  Clock,
  BookOpen,
  Sparkles,
  Filter,
  Layers,
  Target,
  CheckCircle2,
  PieChart,
} from 'lucide-react';

interface DashboardViewProps {
  members: Member[];
  classes: ClassUnit[];
  rollCallRecords: RollCallRecord[];
  unitWeeklyData?: UnitWeeklyData[];
  manaSubscriptions: ManaSubscription[];
  sabbaths: SabbathDate[];
  criteriaConfig: CriteriaPointsConfig;
  selectedQuarter?: number;
  selectedYear?: number;
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  members,
  classes,
  rollCallRecords,
  unitWeeklyData = [],
  manaSubscriptions,
  sabbaths,
  criteriaConfig,
  selectedQuarter = 1,
  selectedYear = 2026,
  onNavigate,
}) => {
  // Seletor de Visão: 'ALL' (Média Geral da Igreja) ou ID da Unidade/Classe
  const [selectedVision, setSelectedVision] = useState<string>('ALL');

  const totalMembros = members.filter((m) => m.type === 'Membro').length;
  const ativosCount = members.filter((m) => m.status === 'Ativo').length;
  const inativosCount = members.filter((m) => m.status === 'Inativo').length;
  const professoresCount = members.filter((m) => m.isTeacher).length;

  // Calculate date bounds for selected quarter
  const getQuarterBounds = (quarter: number, year = selectedYear) => {
    const q = Math.min(Math.max(quarter, 1), 4);
    const bounds = {
      1: { start: `${year}-01-01`, end: `${year}-03-31` },
      2: { start: `${year}-04-01`, end: `${year}-06-30` },
      3: { start: `${year}-07-01`, end: `${year}-09-30` },
      4: { start: `${year}-10-01`, end: `${year}-12-31` },
    };
    return bounds[q as 1 | 2 | 3 | 4];
  };

  const quarterBounds = getQuarterBounds(selectedQuarter, selectedYear);

  // Sabbaths for the selected quarter
  const quarterSabbaths = sabbaths.filter(
    (s) => s.quarter === selectedQuarter || (s.date >= quarterBounds.start && s.date <= quarterBounds.end)
  );
  const quarterSabbathDates = new Set(quarterSabbaths.map((s) => s.date));

  const isSabbathInQuarter = (dateStr: string) => {
    if (!dateStr) return false;
    return quarterSabbathDates.has(dateStr) || (dateStr >= quarterBounds.start && dateStr <= quarterBounds.end);
  };

  // Filter records belonging to the selected quarter's Sabbath dates
  const quarterRollCallRecords = rollCallRecords.filter((r) =>
    isSabbathInQuarter(r.sabbathDate)
  );

  // Filter weekly extra data belonging to the selected quarter
  const quarterUnitWeeklyData = unitWeeklyData.filter((u) =>
    isSabbathInQuarter(u.sabbathDate)
  );

  // Apply Vision Filter if a specific unit is selected
  const activeClassObj = selectedVision !== 'ALL' ? classes.find((c) => c.id === selectedVision || c.name === selectedVision) : null;
  const activeVisionName = activeClassObj ? activeClassObj.name : selectedVision !== 'ALL' ? selectedVision : 'Média Geral da Igreja';

  const visionMembers = selectedVision === 'ALL'
    ? members
    : members.filter((m) => m.className === activeVisionName || m.unit === activeVisionName);

  const visionMemberIds = new Set(visionMembers.map((m) => m.id));

  const targetRecords = selectedVision === 'ALL'
    ? quarterRollCallRecords
    : quarterRollCallRecords.filter((r) =>
        r.classId === activeClassObj?.id || visionMemberIds.has(r.memberId)
      );

  const targetUnitWeeklyData = selectedVision === 'ALL'
    ? quarterUnitWeeklyData
    : quarterUnitWeeklyData.filter(
        (u) => u.unitOrClassId === activeClassObj?.id || u.unitName === activeVisionName
      );

  const totalManaAmount = manaSubscriptions.reduce((acc, m) => acc + (m.totalAmount ?? m.amount ?? 0), 0);

  // 5 Criteria Calculations from targetRecords
  const totalRecords = targetRecords.length;

  const totalPresent = targetRecords.filter((r) => r.present).length;
  const totalPunctual = targetRecords.filter((r) => r.punctual).length;
  const totalLesson = targetRecords.filter((r) => r.studiedLesson).length;
  const totalOffering = targetRecords.filter((r) => r.broughtOffering || (r.offeringAmount && r.offeringAmount > 0)).length;
  const totalOfferings = targetRecords.reduce((acc, r) => acc + (r.offeringAmount || 0), 0) + targetUnitWeeklyData.reduce((acc, u) => acc + (u.offeringCollected || 0), 0);
  const totalPG = targetRecords.filter((r) => r.attendedPG).length;

  const presencePct = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;
  const punctualityPct = totalRecords > 0 ? Math.round((totalPunctual / totalRecords) * 100) : 0;
  const lessonPct = totalRecords > 0 ? Math.round((totalLesson / totalRecords) * 100) : 0;
  const offeringPct = totalRecords > 0 ? Math.round((totalOffering / totalRecords) * 100) : 0;
  const pgPct = totalRecords > 0 ? Math.round((totalPG / totalRecords) * 100) : 0;

  const totalScoreEarned = targetRecords.reduce((acc, r) => acc + calculateRecordScore(r, criteriaConfig), 0);
  const averageScore = totalRecords > 0 ? (totalScoreEarned / totalRecords).toFixed(1) : '0.0';
  const maxScore = getMaxPossibleScore(criteriaConfig);

  // Calculate Unit Metrics for every Unit/Class (Média por Unidade)
  const unitSummaries = classes.map((cls) => {
    const clsMembers = members.filter((m) => m.className === cls.name || m.unit === cls.name);
    const clsMemberIds = new Set(clsMembers.map((m) => m.id));

    const clsRecords = quarterRollCallRecords.filter(
      (r) => r.classId === cls.id || clsMemberIds.has(r.memberId)
    );

    const clsTotalEarned = clsRecords.reduce((acc, r) => acc + calculateRecordScore(r, criteriaConfig), 0);
    const regularScoreAvg = clsRecords.length > 0 ? Math.round(clsTotalEarned / clsRecords.length) : 0;

    // Unit weekly extra data (strictly filtered by selected quarter)
    const clsWeeklyData = quarterUnitWeeklyData.filter(
      (u) => u.unitOrClassId === cls.id || u.unitName === cls.name
    );

    const totalExtraPoints = clsWeeklyData.reduce((acc, u) => acc + (u.extraPoints || 0), 0);
    const avgExtraPoints = clsWeeklyData.length > 0 ? Math.round(totalExtraPoints / clsWeeklyData.length) : 0;

    const totalOfferingCollected = clsWeeklyData.reduce((acc, u) => acc + (u.offeringCollected || 0), 0);
    const targetOffering = cls.targetOffering || 50;

    const avgOfferingPoints = clsWeeklyData.length > 0
      ? Math.round(clsWeeklyData.reduce((acc, u) => acc + calculateOfferingPoints(u.offeringCollected, u.offeringTarget), 0) / clsWeeklyData.length)
      : 0;

    const finalUnitScore = calculateUnitFinalScore(regularScoreAvg, avgExtraPoints, avgOfferingPoints);

    return {
      classId: cls.id,
      className: cls.name,
      teacher: cls.teacher1Name,
      memberCount: clsMembers.length,
      regularScoreAvg,
      avgExtraPoints,
      totalOfferingCollected,
      targetOffering,
      avgOfferingPoints,
      finalUnitScore,
    };
  });

  // Sort units by final score descending
  unitSummaries.sort((a, b) => b.finalUnitScore - a.finalUnitScore);

  return (
    <div className="space-y-5">
      {/* 1. Hero Summary Card */}
      <div className="bg-gradient-to-r from-[#4a121f] via-[#6b1d2f] to-[#380d17] text-white p-5 sm:p-6 rounded-2xl shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#f3e5ab] bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
              Painel Geral • {selectedQuarter}º Trimestre {selectedYear}
            </span>
            {selectedVision !== 'ALL' && (
              <span className="text-[10px] uppercase font-extrabold text-amber-200 bg-amber-500/30 px-2.5 py-0.5 rounded-full border border-amber-300/40">
                Filtro: {activeVisionName}
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black">Escola Sabatina Pro</h1>
          <p className="text-xs text-rose-100/80 max-w-lg">
            Acompanhamento em tempo real das médias por unidade, chamada semanal, ofertas e atividades extras da igreja.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={() => onNavigate('frequencia')}
            className="flex-1 md:flex-none px-4 py-2.5 bg-[#d4af37] hover:bg-[#c5a028] text-gray-950 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <CheckSquare className="w-4 h-4" />
            <span>Fazer Chamada Hoje</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('ia')}
            className="flex-1 md:flex-none px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all border border-white/20"
          >
            <Bot className="w-4 h-4 text-[#f3e5ab]" />
            <span>Assistente IA</span>
          </button>
        </div>
      </div>

      {/* 2. SELETOR DE VISÃO (Média Geral da Igreja vs Unidade Específica) */}
      <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#600010]" />
            <span className="text-xs font-black text-gray-900 uppercase tracking-wide">
              Seletor de Visão do Dashboard
            </span>
          </div>
          <span className="text-[11px] font-semibold text-gray-500">
            {selectedVision === 'ALL'
              ? 'Exibindo Média Geral de Toda a Igreja'
              : `Filtrando Unidade: ${activeVisionName}`}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedVision('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all border ${
              selectedVision === 'ALL'
                ? 'bg-[#600010] text-white border-[#600010] shadow-2xs'
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Média Geral da Igreja</span>
          </button>

          <div className="h-6 w-px bg-gray-200 hidden sm:block" />

          <span className="text-xs font-bold text-gray-500 mr-1">Filtrar por Unidade:</span>

          <div className="flex-1 min-w-[200px]">
            <select
              value={selectedVision}
              onChange={(e) => setSelectedVision(e.target.value)}
              className="w-full px-3 py-1.5 bg-gray-50 border border-amber-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#600010]"
            >
              <option value="ALL">🏛️ Todas as Unidades (Média Geral)</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  📍 Unidade / Classe: {cls.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. TABELA / VISÃO DE MÉDIAS POR UNIDADE */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              Médias e Pontuação por Unidade ({selectedQuarter}º Trimestre)
            </h2>
            <p className="text-xs text-gray-500">
              Média da Chamada Regular + Pontos de Atividades Extras + Pontuação do Critério de Ofertas
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('classes')}
            className="text-xs font-extrabold text-[#600010] hover:underline flex items-center gap-1"
          >
            Gerenciar Unidades &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {unitSummaries.map((u, index) => {
            const isSelected = selectedVision === u.classId || activeVisionName === u.className;
            return (
              <div
                key={u.classId}
                onClick={() => setSelectedVision(u.classId)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 relative overflow-hidden ${
                  isSelected
                    ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-500/50 shadow-xs'
                    : 'bg-white border-gray-200/90 hover:border-amber-300 hover:shadow-xs'
                }`}
              >
                {index === 0 && (
                  <span className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-black px-2.5 py-0.5 rounded-bl-xl uppercase tracking-wider">
                    Líder do Trimestre 🏆
                  </span>
                )}

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-amber-800 tracking-wider">
                      Unidade #{index + 1}
                    </span>
                    <h3 className="text-sm font-black text-gray-900">{u.className}</h3>
                    <p className="text-[11px] text-gray-500 font-medium">Prof: {u.teacher}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-500 font-bold block">Pontuação Final</span>
                    <span className="text-lg font-black text-[#600010]">{u.finalUnitScore} pts</span>
                  </div>
                </div>

                {/* Score Breakdown Bars */}
                <div className="space-y-1.5 pt-2 border-t border-gray-100 text-[11px]">
                  <div className="flex items-center justify-between text-gray-700">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Chamada Regular:
                    </span>
                    <strong className="text-gray-900">{u.regularScoreAvg} pts</strong>
                  </div>

                  <div className="flex items-center justify-between text-gray-700">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      Atividades Extras:
                    </span>
                    <strong className="text-amber-900">+{u.avgExtraPoints} pts</strong>
                  </div>

                  <div className="flex items-center justify-between text-gray-700">
                    <span className="flex items-center gap-1">
                      <Target className="w-3 h-3 text-emerald-600" />
                      Critério de Ofertas:
                    </span>
                    <strong className="text-emerald-900">{u.avgOfferingPoints} pts</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-gray-500 font-semibold pt-1 border-t border-gray-100">
                  <span>Membros: {u.memberCount}</span>
                  <span>Alvo Oferta: R$ {u.targetOffering.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Members Card */}
        <div
          onClick={() => onNavigate('membros')}
          className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs hover:shadow-md transition-all cursor-pointer group space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              {selectedVision === 'ALL' ? 'Membros Totais' : `Membros (${activeVisionName})`}
            </span>
            <div className="p-2 bg-rose-50 text-[#6b1d2f] rounded-xl group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-gray-900">{visionMembers.length}</div>
          <div className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            {ativosCount} Ativos na Igreja
          </div>
        </div>

        {/* Teachers Card */}
        <div
          onClick={() => onNavigate('membros')}
          className="bg-white p-4 rounded-2xl border border-amber-200/90 shadow-xs hover:shadow-md transition-all cursor-pointer group space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Professores ES</span>
            <div className="p-2 bg-amber-50 text-amber-800 rounded-xl group-hover:scale-110 transition-transform">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-gray-900">{professoresCount}</div>
          <div className="text-[11px] font-semibold text-amber-700">
            Cadastrados no banco
          </div>
        </div>

        {/* Attendance Rate */}
        <div
          onClick={() => onNavigate('frequencia')}
          className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs hover:shadow-md transition-all cursor-pointer group space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Presença Média</span>
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-gray-900">{presencePct}%</div>
          <div className="text-[11px] text-gray-500">
            {selectedVision === 'ALL' ? 'Frequência da Igreja' : 'Frequência da Unidade'}
          </div>
        </div>

        {/* Classes Count */}
        <div
          onClick={() => onNavigate('classes')}
          className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs hover:shadow-md transition-all cursor-pointer group space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Classes Ativas</span>
            <div className="p-2 bg-purple-50 text-purple-700 rounded-xl group-hover:scale-110 transition-transform">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-gray-900">{classes.length}</div>
          <div className="text-[11px] text-gray-500">
            Adultos, Jovens e Infantil
          </div>
        </div>

        {/* Mana Project Collection */}
        <div
          onClick={() => onNavigate('mana')}
          className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs hover:shadow-md transition-all cursor-pointer group space-y-2 col-span-2 lg:col-span-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Projeto Maná</span>
            <div className="p-2 bg-blue-50 text-blue-700 rounded-xl group-hover:scale-110 transition-transform">
              <BookMarked className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-gray-900">R$ {totalManaAmount.toFixed(2)}</div>
          <div className="text-[11px] font-semibold text-blue-600">
            {manaSubscriptions.length} assinaturas
          </div>
        </div>
      </div>

      {/* 5. 5 CRITERIA DASHBOARD PERFORMANCE SECTION */}
      <div className="bg-white p-5 rounded-2xl border border-[#D4AF37]/30 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-[#600010]" />
              Relatório Geral dos 5 Critérios da Chamada ({activeVisionName})
            </h3>
            <p className="text-xs text-gray-500">
              Desempenho acumulado em Presença, Pontualidade, Lição, Oferta e PG
            </p>
          </div>

          <div className="bg-[#600010] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs">
            <Award className="w-4 h-4 text-[#D4AF37]" />
            <span>Pontuação Média: {averageScore} / {maxScore} pts</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* 1. Presença */}
          <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600" /> 1. Presença
              </span>
              <span className="text-xs font-extrabold text-emerald-800">{presencePct}%</span>
            </div>
            <div className="w-full bg-emerald-200/80 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${presencePct}%` }} />
            </div>
            <p className="text-[11px] font-semibold text-emerald-700">
              {totalPresent} chamadas com presença confirmada
            </p>
          </div>

          {/* 2. Pontualidade */}
          <div className="bg-blue-50/50 p-3.5 rounded-2xl border border-blue-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" /> 2. Pontualidade
              </span>
              <span className="text-xs font-extrabold text-blue-800">{punctualityPct}%</span>
            </div>
            <div className="w-full bg-blue-200/80 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full" style={{ width: `${punctualityPct}%` }} />
            </div>
            <p className="text-[11px] font-semibold text-blue-700">
              {totalPunctual} no horário regimental
            </p>
          </div>

          {/* 3. Estudou a Lição */}
          <div className="bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-amber-600" /> 3. Estudo da Lição
              </span>
              <span className="text-xs font-extrabold text-amber-800">{lessonPct}%</span>
            </div>
            <div className="w-full bg-amber-200/80 h-2 rounded-full overflow-hidden">
              <div className="bg-amber-600 h-full rounded-full" style={{ width: `${lessonPct}%` }} />
            </div>
            <p className="text-[11px] font-semibold text-amber-700">
              {totalLesson} com estudo diário da lição
            </p>
          </div>

          {/* 4. Oferta */}
          <div className="bg-purple-50/50 p-3.5 rounded-2xl border border-purple-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-purple-600" /> 4. Ofertas
              </span>
              <span className="text-xs font-extrabold text-purple-800">{offeringPct}%</span>
            </div>
            <div className="w-full bg-purple-200/80 h-2 rounded-full overflow-hidden">
              <div className="bg-purple-600 h-full rounded-full" style={{ width: `${offeringPct}%` }} />
            </div>
            <p className="text-[11px] font-semibold text-purple-700">
              R$ {totalOfferings.toFixed(2)} recolhidos
            </p>
          </div>

          {/* 5. Pequenos Grupos */}
          <div className="bg-[#600010]/5 p-3.5 rounded-2xl border border-[#600010]/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#600010] flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-[#600010]" /> 5. Pequenos Grupos
              </span>
              <span className="text-xs font-extrabold text-[#600010]">{pgPct}%</span>
            </div>
            <div className="w-full bg-[#600010]/20 h-2 rounded-full overflow-hidden">
              <div className="bg-[#600010] h-full rounded-full" style={{ width: `${pgPct}%` }} />
            </div>
            <p className="text-[11px] font-semibold text-[#600010]">
              {totalPG} participações em PGs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
