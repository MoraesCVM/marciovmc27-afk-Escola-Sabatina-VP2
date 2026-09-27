export type MemberStatus = 'Ativo' | 'Inativo' | 'Visitante' | 'Afastado';
export type MemberType = 'Membro' | 'Visitante';
export type GenderType = 'Masc' | 'Fem';

export interface Member {
  id: string;
  name: string;
  type: MemberType;
  status: MemberStatus;
  className: string;
  unit: string;
  isTeacher?: boolean;
  age: number;
  gender: GenderType;
  phone: string;
  email?: string;
  address?: string;
  birthDate?: string;
  notes?: string;
  createdAt: string;
}

export interface ClassUnit {
  id: string;
  name: string;
  category: 'Adultos' | 'Jovens' | 'Adolescentes' | 'Infantil' | 'Primários' | 'Bebês / Róis';
  teacher1Id: string;
  teacher1Name: string;
  teacher2Id?: string;
  teacher2Name?: string;
  room?: string;
  memberCount?: number;
  targetOffering?: number;
}

export interface UnitWeeklyData {
  id: string;
  sabbathDate: string; // YYYY-MM-DD
  unitOrClassId: string; // classId or unitName
  unitName?: string;
  extraPoints: number; // Pontos de Atividades Extras
  offeringTarget: number; // Alvo/Meta de Oferta para a unidade no sábado (R$)
  offeringCollected: number; // Valor Recolhido da Oferta da unidade no sábado (R$)
}

export function calculateOfferingPoints(collected: number, target: number): number {
  if (!target || target <= 0) {
    return collected > 0 ? 100 : 0;
  }
  const ratio = (collected / target) * 100;
  return Math.min(100, Math.round(ratio));
}

export function calculateUnitFinalScore(
  regularScoreAvg: number,
  extraPoints: number,
  offeringPoints: number
): number {
  return Math.round((regularScoreAvg || 0) + (extraPoints || 0) + (offeringPoints || 0));
}

export type CriterionColor =
  | 'emerald'
  | 'blue'
  | 'amber'
  | 'purple'
  | 'rose'
  | 'indigo'
  | 'teal'
  | 'orange'
  | 'cyan'
  | 'red';

export interface CriterionItem {
  id: string; // e.g. 'presence', 'punctuality', 'lesson', 'offering', 'pg', or 'crit_123...'
  name: string; // e.g. "Presença", "Trouxe a Bíblia", etc.
  description?: string; // Subtitle or explanation
  points: number; // e.g. 20
  enabled: boolean; // Active in roll call
  isCustom?: boolean; // User created
  icon?: string; // Icon identifier
  color?: CriterionColor; // Color scheme
  systemKey?: 'present' | 'punctual' | 'studiedLesson' | 'broughtOffering' | 'attendedPG';
}

export interface CriteriaPointsConfig {
  presencePoints: number;
  punctualityPoints: number;
  lessonPoints: number;
  offeringPoints: number;
  pgPoints: number;
  items?: CriterionItem[];
}

export interface RollCallRecord {
  id: string;
  sabbathDate: string; // YYYY-MM-DD
  memberId: string;
  memberName: string;
  classId: string;
  present: boolean; // 1. Presença
  punctual: boolean; // 2. Pontualidade
  studiedLesson: boolean; // 3. Estudou a lição
  broughtOffering: boolean; // 4. Oferta
  offeringAmount: number; // Valor R$
  attendedPG: boolean; // 5. PG (Pequeno Grupo)
  lessonStudyDays?: number; // 0 to 7 CRM
  broughtBible?: boolean;
  visitsMade?: number;
  customCriteria?: Record<string, boolean>; // Values for custom criteria
}

export function normalizeCriteriaConfig(
  config?: Partial<CriteriaPointsConfig> | null
): CriteriaPointsConfig & { items: CriterionItem[] } {
  const defaultItems: CriterionItem[] = [
    {
      id: 'presence',
      name: 'Presença',
      description: 'Presença física no sábado',
      points: config?.presencePoints ?? 20,
      enabled: (config?.presencePoints ?? 20) > 0,
      isCustom: false,
      icon: 'check',
      color: 'emerald',
      systemKey: 'present',
    },
    {
      id: 'punctuality',
      name: 'Pontualidade',
      description: 'Chegada no horário da Escola Sabatina',
      points: config?.punctualityPoints ?? 20,
      enabled: (config?.punctualityPoints ?? 20) > 0,
      isCustom: false,
      icon: 'clock',
      color: 'blue',
      systemKey: 'punctual',
    },
    {
      id: 'lesson',
      name: 'Estudo da Lição',
      description: 'Estudo diário da Lição da Escola Sabatina',
      points: config?.lessonPoints ?? 20,
      enabled: (config?.lessonPoints ?? 20) > 0,
      isCustom: false,
      icon: 'book',
      color: 'amber',
      systemKey: 'studiedLesson',
    },
    {
      id: 'offering',
      name: 'Oferta de Classe',
      description: 'Participação na oferta da unidade',
      points: config?.offeringPoints ?? 20,
      enabled: (config?.offeringPoints ?? 20) > 0,
      isCustom: false,
      icon: 'dollar',
      color: 'teal',
      systemKey: 'broughtOffering',
    },
    {
      id: 'pg',
      name: 'Pequeno Grupo (PG)',
      description: 'Participação no Pequeno Grupo semanal',
      points: config?.pgPoints ?? 20,
      enabled: (config?.pgPoints ?? 20) > 0,
      isCustom: false,
      icon: 'users',
      color: 'purple',
      systemKey: 'attendedPG',
    },
  ];

  if (!config) {
    return {
      presencePoints: 20,
      punctualityPoints: 20,
      lessonPoints: 20,
      offeringPoints: 20,
      pgPoints: 20,
      items: defaultItems,
    };
  }

  if (Array.isArray(config.items) && config.items.length > 0) {
    const presenceItem = config.items.find(
      (i) => i.id === 'presence' || i.systemKey === 'present'
    );
    const punctualityItem = config.items.find(
      (i) => i.id === 'punctuality' || i.systemKey === 'punctual'
    );
    const lessonItem = config.items.find(
      (i) => i.id === 'lesson' || i.systemKey === 'studiedLesson'
    );
    const offeringItem = config.items.find(
      (i) => i.id === 'offering' || i.systemKey === 'broughtOffering'
    );
    const pgItem = config.items.find(
      (i) => i.id === 'pg' || i.systemKey === 'attendedPG'
    );

    return {
      presencePoints: presenceItem ? presenceItem.points : (config.presencePoints ?? 20),
      punctualityPoints: punctualityItem ? punctualityItem.points : (config.punctualityPoints ?? 20),
      lessonPoints: lessonItem ? lessonItem.points : (config.lessonPoints ?? 20),
      offeringPoints: offeringItem ? offeringItem.points : (config.offeringPoints ?? 20),
      pgPoints: pgItem ? pgItem.points : (config.pgPoints ?? 20),
      items: config.items.map((it) => ({
        ...it,
        points: Number(it.points) || 0,
        enabled: it.enabled !== false,
      })),
    };
  }

  return {
    presencePoints: config.presencePoints ?? 20,
    punctualityPoints: config.punctualityPoints ?? 20,
    lessonPoints: config.lessonPoints ?? 20,
    offeringPoints: config.offeringPoints ?? 20,
    pgPoints: config.pgPoints ?? 20,
    items: defaultItems,
  };
}

export function calculateRecordScore(
  record: RollCallRecord,
  config?: CriteriaPointsConfig
): number {
  if (!record) return 0;
  const normalized = normalizeCriteriaConfig(config);

  if (normalized.items && normalized.items.length > 0) {
    let score = 0;
    for (const item of normalized.items) {
      if (!item.enabled) continue;
      const pts = item.points || 0;
      if (item.systemKey === 'present' || item.id === 'presence') {
        if (record.present) score += pts;
      } else if (item.systemKey === 'punctual' || item.id === 'punctuality') {
        if (record.punctual) score += pts;
      } else if (item.systemKey === 'studiedLesson' || item.id === 'lesson') {
        if (record.studiedLesson) score += pts;
      } else if (item.systemKey === 'broughtOffering' || item.id === 'offering') {
        if (record.broughtOffering) score += pts;
      } else if (item.systemKey === 'attendedPG' || item.id === 'pg') {
        if (record.attendedPG) score += pts;
      } else {
        // Custom criterion
        if (record.customCriteria && record.customCriteria[item.id]) {
          score += pts;
        }
      }
    }
    return score;
  }

  let score = 0;
  if (record.present) score += normalized.presencePoints || 0;
  if (record.punctual) score += normalized.punctualityPoints || 0;
  if (record.studiedLesson) score += normalized.lessonPoints || 0;
  if (record.broughtOffering) score += normalized.offeringPoints || 0;
  if (record.attendedPG) score += normalized.pgPoints || 0;
  return score;
}

export function getMaxPossibleScore(config?: CriteriaPointsConfig): number {
  const normalized = normalizeCriteriaConfig(config);
  if (normalized.items && normalized.items.length > 0) {
    return normalized.items
      .filter((i) => i.enabled)
      .reduce((sum, i) => sum + (Number(i.points) || 0), 0);
  }
  return (
    (normalized.presencePoints || 0) +
    (normalized.punctualityPoints || 0) +
    (normalized.lessonPoints || 0) +
    (normalized.offeringPoints || 0) +
    (normalized.pgPoints || 0)
  );
}

export interface SabbathDate {
  date: string; // YYYY-MM-DD
  formattedDate: string; // ex: "03/Jan/2026"
  quarter: 1 | 2 | 3 | 4;
  sabbathNumberInQuarter: number; // 1 to 13
  department: string; // ex: "Ministério da Mulher", "Jovens", "Ancionato"
  directorName: string; // Diretor/Responsável que conduzirá a Escola Sabatina
  specialEvent?: string; // ex: "13º Sábado", "Dia da Bíblia", "Batismo da Primavera"
  notes?: string; // Observações da programação
  targetOffering?: number;
}

export interface LessonCatalogItem {
  id: string;
  name: string;
  category: string;
  price: number;
  code?: string;
}

export type PaymentMethod = 'Pix' | 'Dinheiro' | 'Cartão de Crédito' | 'Cartão de Débito' | 'Transferência' | 'Outro';

export interface ManaOrderItem {
  lessonId: string;
  lessonName: string;
  category?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ManaPayment {
  id: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  notes?: string;
}

export interface QuarterlyDeliveryRecord {
  status: 'Entregue' | 'Pendente' | 'A caminho';
  deliveredAt?: string; // YYYY-MM-DD
  deliveredBy?: string; // Nome de quem entregou
  recipientName?: string; // Nome de quem recebeu
  attachmentName?: string; // Nome do arquivo de comprovante
  attachmentUrl?: string; // Base64 data URL ou URL da foto/documento
  attachmentType?: 'image' | 'pdf' | 'document';
  attachmentSize?: number; // Tamanho em bytes
  notes?: string; // Observações da entrega
}

export interface ManaSubscription {
  id: string;
  memberId: string;
  memberName: string;
  items: ManaOrderItem[];
  totalAmount: number;
  amountPaid: number;
  paymentMethod?: PaymentMethod;
  status: 'Quitado' | 'Pendente' | 'Parcial';
  quarterlyDelivery: {
    q1: 'Entregue' | 'Pendente' | 'A caminho';
    q2: 'Entregue' | 'Pendente' | 'A caminho';
    q3: 'Entregue' | 'Pendente' | 'A caminho';
    q4: 'Entregue' | 'Pendente' | 'A caminho';
  };
  quarterlyDeliveryDetails?: {
    q1?: QuarterlyDeliveryRecord;
    q2?: QuarterlyDeliveryRecord;
    q3?: QuarterlyDeliveryRecord;
    q4?: QuarterlyDeliveryRecord;
  };
  deliveryStatus: 'Entregue' | 'Pendente' | 'A caminho';
  year: number;
  createdAt: string;
  notes?: string;
  payments?: ManaPayment[];

  // Legacy backward-compatibility optional fields
  plan?: string;
  quantity?: number;
  amount?: number;
}

export interface SyncConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  isConfigured: boolean;
  lastSync?: string;
}
