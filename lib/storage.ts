import { Member, ClassUnit, SabbathDate, ManaSubscription, RollCallRecord, SyncConfig, CriteriaPointsConfig, LessonCatalogItem, UnitWeeklyData, normalizeCriteriaConfig } from './types';
import { INITIAL_MEMBERS, INITIAL_CLASSES, SABBATHS_2026, INITIAL_MANA, INITIAL_ROLLCALL, DEFAULT_CRITERIA_CONFIG, INITIAL_LESSON_CATALOG, INITIAL_UNIT_WEEKLY_DATA } from './data';

const STORAGE_KEYS = {
  MEMBERS: 'escola_sabatina_members_v2',
  CLASSES: 'escola_sabatina_classes_v2',
  SABBATHS: 'escola_sabatina_sabbaths_v2',
  MANA: 'escola_sabatina_mana_v3',
  LESSON_CATALOG: 'escola_sabatina_lesson_catalog_v1',
  ROLLCALL: 'escola_sabatina_rollcall_v3',
  SYNC: 'escola_sabatina_sync_config_v2',
  CRITERIA: 'escola_sabatina_criteria_config_v2',
  UNIT_WEEKLY: 'escola_sabatina_unit_weekly_v1',
};

export function loadMembers(): Member[] {
  if (typeof window === 'undefined') return INITIAL_MEMBERS;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MEMBERS);
    return data ? JSON.parse(data) : INITIAL_MEMBERS;
  } catch (e) {
    console.error('Failed to load members from localStorage', e);
    return INITIAL_MEMBERS;
  }
}

export function saveMembers(members: Member[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
  } catch (e) {
    console.error('Failed to save members', e);
  }
}

export function loadClasses(): ClassUnit[] {
  if (typeof window === 'undefined') return INITIAL_CLASSES;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CLASSES);
    return data ? JSON.parse(data) : INITIAL_CLASSES;
  } catch (e) {
    console.error('Failed to load classes', e);
    return INITIAL_CLASSES;
  }
}

export function saveClasses(classes: ClassUnit[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
  } catch (e) {
    console.error('Failed to save classes', e);
  }
}

export function loadSabbaths(): SabbathDate[] {
  if (typeof window === 'undefined') return SABBATHS_2026;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SABBATHS);
    return data ? JSON.parse(data) : SABBATHS_2026;
  } catch (e) {
    console.error('Failed to load sabbaths', e);
    return SABBATHS_2026;
  }
}

export function saveSabbaths(sabbaths: SabbathDate[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.SABBATHS, JSON.stringify(sabbaths));
  } catch (e) {
    console.error('Failed to save sabbaths', e);
  }
}

export function loadLessonCatalog(): LessonCatalogItem[] {
  if (typeof window === 'undefined') return INITIAL_LESSON_CATALOG;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LESSON_CATALOG);
    return data ? JSON.parse(data) : INITIAL_LESSON_CATALOG;
  } catch (e) {
    console.error('Failed to load lesson catalog', e);
    return INITIAL_LESSON_CATALOG;
  }
}

export function saveLessonCatalog(catalog: LessonCatalogItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.LESSON_CATALOG, JSON.stringify(catalog));
  } catch (e) {
    console.error('Failed to save lesson catalog', e);
  }
}

export function loadMana(): ManaSubscription[] {
  if (typeof window === 'undefined') return INITIAL_MANA;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MANA);
    if (!data) return INITIAL_MANA;
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return INITIAL_MANA;

    // Sanitize and convert legacy entries to multi-item structure
    return parsed.map((item: any) => {
      const items = Array.isArray(item.items) && item.items.length > 0
        ? item.items
        : [
            {
              lessonId: 'legacy-1',
              lessonName: item.plan || 'Lição de Adultos',
              category: 'Adultos',
              quantity: item.quantity || 1,
              unitPrice: item.amount ? item.amount / (item.quantity || 1) : 38.0,
              totalPrice: item.amount || 38.0,
            },
          ];

      const totalAmount = item.totalAmount ?? item.amount ?? items.reduce((a: number, i: any) => a + (i.totalPrice || 0), 0);
      const amountPaid = item.amountPaid ?? (item.status === 'Quitado' ? totalAmount : item.status === 'Parcial' ? totalAmount / 2 : 0);

      const quarterlyDelivery = item.quarterlyDelivery || {
        q1: item.deliveryStatus || 'Entregue',
        q2: 'Pendente',
        q3: 'Pendente',
        q4: 'Pendente',
      };

      return {
        id: item.id || `mn-${Date.now()}`,
        memberId: item.memberId || '',
        memberName: item.memberName || 'Assinante Sem Nome',
        items,
        totalAmount,
        amountPaid,
        paymentMethod: item.paymentMethod || 'Pix',
        status: item.status || (amountPaid >= totalAmount ? 'Quitado' : amountPaid > 0 ? 'Parcial' : 'Pendente'),
        quarterlyDelivery,
        quarterlyDeliveryDetails: item.quarterlyDeliveryDetails || {},
        deliveryStatus: item.deliveryStatus || quarterlyDelivery.q1 || 'Pendente',
        year: item.year || 2026,
        createdAt: item.createdAt || new Date().toISOString().slice(0, 10),
        notes: item.notes || '',
        payments: item.payments || [],
      };
    });
  } catch (e) {
    console.error('Failed to load mana subscriptions', e);
    return INITIAL_MANA;
  }
}

export function saveMana(mana: ManaSubscription[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.MANA, JSON.stringify(mana));
  } catch (e) {
    console.error('Failed to save mana', e);
  }
}

export function loadRollCall(): RollCallRecord[] {
  if (typeof window === 'undefined') return INITIAL_ROLLCALL;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ROLLCALL);
    return data ? JSON.parse(data) : INITIAL_ROLLCALL;
  } catch (e) {
    console.error('Failed to load rollcall', e);
    return INITIAL_ROLLCALL;
  }
}

export function saveRollCall(records: RollCallRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.ROLLCALL, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save rollcall', e);
  }
}

export function loadSyncConfig(): SyncConfig {
  if (typeof window === 'undefined') return { supabaseUrl: '', supabaseAnonKey: '', isConfigured: false };
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SYNC);
    return data ? JSON.parse(data) : { supabaseUrl: '', supabaseAnonKey: '', isConfigured: false };
  } catch (e) {
    return { supabaseUrl: '', supabaseAnonKey: '', isConfigured: false };
  }
}

export function saveSyncConfig(config: SyncConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.SYNC, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save sync config', e);
  }
}

export function loadCriteriaConfig(): CriteriaPointsConfig {
  if (typeof window === 'undefined') return DEFAULT_CRITERIA_CONFIG;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CRITERIA);
    return data ? normalizeCriteriaConfig(JSON.parse(data)) : DEFAULT_CRITERIA_CONFIG;
  } catch (e) {
    console.error('Failed to load criteria config', e);
    return DEFAULT_CRITERIA_CONFIG;
  }
}

export function saveCriteriaConfig(config: CriteriaPointsConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.CRITERIA, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save criteria config', e);
  }
}

export function loadUnitWeeklyData(): UnitWeeklyData[] {
  if (typeof window === 'undefined') return INITIAL_UNIT_WEEKLY_DATA;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.UNIT_WEEKLY);
    return data ? JSON.parse(data) : INITIAL_UNIT_WEEKLY_DATA;
  } catch (e) {
    console.error('Failed to load unit weekly data', e);
    return INITIAL_UNIT_WEEKLY_DATA;
  }
}

export function saveUnitWeeklyData(unitWeeklyData: UnitWeeklyData[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.UNIT_WEEKLY, JSON.stringify(unitWeeklyData));
  } catch (e) {
    console.error('Failed to save unit weekly data', e);
  }
}

export function loadCustomLogo(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('escola_sabatina_custom_logo_v1');
  } catch (e) {
    return null;
  }
}

export function saveCustomLogo(logoUrlOrBase64: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (logoUrlOrBase64) {
      localStorage.setItem('escola_sabatina_custom_logo_v1', logoUrlOrBase64);
    } else {
      localStorage.removeItem('escola_sabatina_custom_logo_v1');
    }
    window.dispatchEvent(new Event('custom-logo-changed'));
  } catch (e) {
    console.error('Failed to save custom logo', e);
  }
}

// Backup & Export / Import
export function exportAllDataAsJSON() {
  const backup = {
    appName: 'Escola Sabatina Pro',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    members: loadMembers(),
    classes: loadClasses(),
    sabbaths: loadSabbaths(),
    mana: loadMana(),
    rollcall: loadRollCall(),
    unitWeeklyData: loadUnitWeeklyData(),
  };

  const jsonString = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Escola_Sabatina_Pro_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
