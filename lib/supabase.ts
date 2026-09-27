import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SyncConfig } from './types';
import { loadSyncConfig } from './storage';

export type UserRole = 'Admin' | 'Diretor' | 'Associado' | 'Secretário' | 'Auxiliar';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  class_unit_id?: string;
  created_at?: string;
  last_login?: string;
}

export interface UserAuditLog {
  id: string;
  user_email: string;
  action: string;
  details: string;
  created_at: string;
}

const AUTH_STORAGE_KEY = 'escola_sabatina_session_v1';
const PROFILES_STORAGE_KEY = 'escola_sabatina_profiles_v1';
const AUDIT_LOGS_STORAGE_KEY = 'escola_sabatina_audit_logs_v1';

// Default Authorized Profile for Escola Sabatina - Administrator Only
export const ADMIN_PROFILE: UserProfile = {
  id: 'user-admin-master',
  email: 'admin@escolasabatina.com',
  full_name: 'Administrador Geral',
  role: 'Admin',
  created_at: '2026-01-01T00:00:00.000Z',
};

export const AUTHORIZED_EMAILS = [
  'admin',
  'administra',
  'administrador',
  'admin@escolasabatina.com',
  'administrador@escolasabatina.com',
  'marcio@escolasabatina.com',
  'marciovmc27@gmail.com',
];

export const INITIAL_DEMO_PROFILES: UserProfile[] = [ADMIN_PROFILE];

let supabaseInstance: SupabaseClient | null = null;
let currentSupabaseUrl: string | null = null;
let currentSupabaseKey: string | null = null;
let realtimeChannel: any = null;

export function resetSupabaseClient(): void {
  supabaseInstance = null;
  currentSupabaseUrl = null;
  currentSupabaseKey = null;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;

  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const syncConfig = loadSyncConfig();

  const url = (envUrl || syncConfig.supabaseUrl || '').trim();
  const key = (envKey || syncConfig.supabaseAnonKey || '').trim();

  if (!url || !key) {
    return null;
  }

  if (!supabaseInstance || currentSupabaseUrl !== url || currentSupabaseKey !== key) {
    currentSupabaseUrl = url;
    currentSupabaseKey = key;
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return supabaseInstance;
}

export function isAuthorizedEmail(email: string): boolean {
  const clean = email.trim().toLowerCase();
  const isAdminAlias = [
    'admin',
    'administra',
    'aministra',
    'administrador',
    'administradora',
    'admin@escolasabatina.com',
    'administrador@escolasabatina.com',
    'marcio@escolasabatina.com',
    'marciovmc27@gmail.com',
    'marcio',
    'marciovmc',
    'marciovmc27',
  ].includes(clean) || clean.startsWith('admin') || clean.startsWith('marcio') || clean.includes('marciovmc');
  if (isAdminAlias) return true;

  const allowedInList = AUTHORIZED_EMAILS.includes(clean);
  if (allowedInList) return true;

  // Also check saved profiles
  const profiles = loadSavedProfiles();
  return profiles.some((p) => p.email.toLowerCase() === clean);
}

export function isOperationalRole(role: UserRole): boolean {
  return ['Admin', 'Diretor', 'Associado', 'Secretário', 'Auxiliar'].includes(role);
}

export function isMasterAdminRole(role: UserRole): boolean {
  return role === 'Admin';
}

// Local session helpers for seamless state & fallback
export function getSavedSession(): { profile: UserProfile; token: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(AUTH_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function saveSession(profile: UserProfile, token: string = 'jwt-session-token'): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ profile, token, timestamp: Date.now() }));
  } catch (e) {
    console.error('Failed to save session', e);
  }
}

export function clearSavedSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear session', e);
  }
}

// Stale demo email list that should be automatically purged
const STALE_DEMO_EMAILS = [
  'bruna@escolasabatina.com',
  'ana@escolasabatina.com',
  'gleice@escolasabatina.com',
  'davi@escolasabatina.com',
];

export function loadSavedProfiles(): UserProfile[] {
  if (typeof window === 'undefined') return INITIAL_DEMO_PROFILES;
  try {
    const data = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!data) {
      saveSavedProfiles(INITIAL_DEMO_PROFILES);
      return INITIAL_DEMO_PROFILES;
    }
    const parsed: UserProfile[] = JSON.parse(data);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveSavedProfiles(INITIAL_DEMO_PROFILES);
      return INITIAL_DEMO_PROFILES;
    }

    // Purge deprecated demo profiles (keeping only Admin / real administrator)
    const cleaned = parsed.filter(
      (p) => !STALE_DEMO_EMAILS.includes(p.email?.toLowerCase?.() || '')
    );

    // Ensure Admin profile is always present
    const hasAdmin = cleaned.some((p) => p.role === 'Admin');
    if (!hasAdmin) {
      cleaned.unshift(ADMIN_PROFILE);
    }

    // If cleaned list differs from parsed, update localStorage
    if (cleaned.length !== parsed.length || !hasAdmin) {
      saveSavedProfiles(cleaned);
    }

    return cleaned;
  } catch {
    return INITIAL_DEMO_PROFILES;
  }
}

export function saveSavedProfiles(profiles: UserProfile[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  } catch (e) {
    console.error('Failed to save profiles', e);
  }
}

export function findProfileByEmail(email: string): UserProfile | null {
  const cleanEmail = email.trim().toLowerCase();

  // 1. Direct admin alias detection (admin, administra, aministra, administrador, marcio, marciovmc27, etc.)
  const isAdminAlias = [
    'admin',
    'administra',
    'aministra',
    'administrador',
    'administradora',
    'admin@escolasabatina.com',
    'administrador@escolasabatina.com',
    'marcio@escolasabatina.com',
    'marciovmc27@gmail.com',
    'marcio',
    'marciovmc',
    'marciovmc27',
  ].includes(cleanEmail) ||
    cleanEmail.startsWith('admin') ||
    cleanEmail.startsWith('aminist') ||
    cleanEmail.startsWith('marcio') ||
    cleanEmail.includes('marciovmc');

  if (isAdminAlias) {
    const saved = loadSavedProfiles();
    const adminMatch = saved.find((p) => p.role === 'Admin') || ADMIN_PROFILE;
    return {
      ...adminMatch,
      email: cleanEmail.includes('@') ? cleanEmail : (adminMatch.email || 'admin@escolasabatina.com'),
    };
  }

  // 2. Check saved profiles in localStorage
  const profiles = loadSavedProfiles();
  const matched = profiles.find((p) => p.email.toLowerCase() === cleanEmail);
  if (matched) return matched;

  // 3. Direct fallback to INITIAL_DEMO_PROFILES
  const initialMatch = INITIAL_DEMO_PROFILES.find((p) => p.email.toLowerCase() === cleanEmail);
  if (initialMatch) return initialMatch;

  // 4. If only 1 profile exists (single admin mode), return that admin profile
  if (profiles.length === 1 && profiles[0].role === 'Admin') {
    return profiles[0];
  }

  return null;
}

export function registerOrGetGoogleProfile(email: string, fullName?: string): UserProfile {
  const cleanEmail = email.trim().toLowerCase();

  const existing = findProfileByEmail(cleanEmail);
  if (existing) {
    return existing;
  }

  const derivedName = fullName || cleanEmail.split('@')[0].replace('.', ' ').toUpperCase();
  const newProfile: UserProfile = {
    id: `admin-google-${Date.now()}`,
    email: cleanEmail,
    full_name: derivedName,
    role: 'Admin',
    created_at: new Date().toISOString(),
  };

  const profiles = loadSavedProfiles();
  const updatedProfiles = [...profiles, newProfile];
  saveSavedProfiles(updatedProfiles);
  addAuditLog(cleanEmail, 'CADASTRO_GOOGLE', `Administrador cadastrado via Conta Google (${cleanEmail})`);

  return newProfile;
}

const PASSWORDS_STORAGE_KEY = 'escola_sabatina_passwords_v1';
const ADMIN_MASTER_PASSWORD_KEY = 'escola_sabatina_admin_master_password';

export function saveAdminPassword(password: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ADMIN_MASTER_PASSWORD_KEY, password);
    const adminKeys = [
      'admin',
      'administra',
      'aministra',
      'administrador',
      'marcio',
      'marciovmc',
      'marciovmc27',
      'marciovmc27@gmail.com',
      'admin@escolasabatina.com',
      'marcio@escolasabatina.com',
    ];
    adminKeys.forEach((key) => saveCustomPassword(key, password));
  } catch (e) {
    console.error('Failed to save admin password', e);
  }
}

export function saveCustomPassword(email: string, password: string): void {
  if (typeof window === 'undefined') return;
  try {
    const data = localStorage.getItem(PASSWORDS_STORAGE_KEY);
    const map = data ? JSON.parse(data) : {};
    map[email.trim().toLowerCase()] = password;
    localStorage.setItem(PASSWORDS_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('Failed to save custom password', e);
  }
}

export function getCustomPassword(email: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const cleanKey = email.trim().toLowerCase();
    const isAdmin = [
      'admin',
      'administra',
      'aministra',
      'administrador',
      'marcio',
      'marciovmc',
      'marciovmc27',
      'marciovmc27@gmail.com',
      'admin@escolasabatina.com',
      'marcio@escolasabatina.com',
    ].includes(cleanKey) ||
      cleanKey.startsWith('admin') ||
      cleanKey.startsWith('aminist') ||
      cleanKey.startsWith('marcio') ||
      cleanKey.includes('marciovmc');

    if (isAdmin) {
      const master = localStorage.getItem(ADMIN_MASTER_PASSWORD_KEY);
      if (master) return master;
    }

    const data = localStorage.getItem(PASSWORDS_STORAGE_KEY);
    if (!data) {
      if (isAdmin) {
        return localStorage.getItem(ADMIN_MASTER_PASSWORD_KEY) || null;
      }
      return null;
    }
    const map = JSON.parse(data);
    return map[cleanKey] || (isAdmin ? (map['admin'] || localStorage.getItem(ADMIN_MASTER_PASSWORD_KEY) || null) : null);
  } catch {
    return null;
  }
}

export function loadAuditLogs(): UserAuditLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(AUDIT_LOGS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addAuditLog(userEmail: string, action: string, details: string): void {
  if (typeof window === 'undefined') return;
  try {
    const logs = loadAuditLogs();
    const newLog: UserAuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      user_email: userEmail,
      action,
      details,
      created_at: new Date().toISOString(),
    };
    const updated = [newLog, ...logs].slice(0, 100);
    localStorage.setItem(AUDIT_LOGS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save audit log', e);
  }
}

// Quarterly Range Helper
export function getQuarterDateBounds(quarter: number, year = 2026) {
  const q = Math.min(Math.max(quarter, 1), 4);
  const bounds = {
    1: { start: `${year}-01-01`, end: `${year}-03-31` },
    2: { start: `${year}-04-01`, end: `${year}-06-30` },
    3: { start: `${year}-07-01`, end: `${year}-09-30` },
    4: { start: `${year}-10-01`, end: `${year}-12-31` },
  };
  return bounds[q as 1 | 2 | 3 | 4];
}

// Fetch Roll Call Records from Supabase filtered by Quarter
export async function fetchRollCallRecordsFromSupabaseByQuarter(quarter: number, year = 2026) {
  const client = getSupabaseClient();
  if (!client) return null;

  const { start, end } = getQuarterDateBounds(quarter, year);
  try {
    const { data, error } = await client
      .from('roll_call_records')
      .select('*')
      .gte('sabbath_date', start)
      .lte('sabbath_date', end);

    if (error) {
      console.warn('Supabase roll call fetch error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Supabase fetch failed:', err);
    return null;
  }
}

// Fetch Unit Weekly Data from Supabase filtered by Quarter
export async function fetchUnitWeeklyDataFromSupabaseByQuarter(quarter: number, year = 2026) {
  const client = getSupabaseClient();
  if (!client) return null;

  const { start, end } = getQuarterDateBounds(quarter, year);
  try {
    const { data, error } = await client
      .from('unit_weekly_data')
      .select('*')
      .gte('sabbath_date', start)
      .lte('sabbath_date', end);

    if (error) {
      console.warn('Supabase unit weekly fetch error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Supabase unit weekly fetch failed:', err);
    return null;
  }
}

// Row Mappers from Supabase to Types
export function mapSupabaseRowToMember(row: any) {
  return {
    id: row.id,
    name: row.name || row.full_name || 'Sem Nome',
    type: row.type || 'Membro',
    status: row.status || 'Ativo',
    className: row.class_name || row.className || 'Classe Geral',
    unit: row.unit || 'Unidade 1',
    isTeacher: !!(row.is_teacher ?? row.isTeacher),
    age: Number(row.age || 0),
    gender: row.gender || 'Homem',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    birthDate: row.birth_date || row.birthDate || '',
    notes: row.notes || '',
    createdAt: row.created_at || row.createdAt || new Date().toISOString().slice(0, 10),
  };
}

export function mapSupabaseRowToRollCall(row: any) {
  return {
    id: row.id,
    sabbathDate: row.sabbath_date || row.sabbathDate,
    memberId: row.member_id || row.memberId,
    memberName: row.member_name || row.memberName || '',
    classId: row.class_id || row.classId || '',
    present: !!row.present,
    punctual: !!row.punctual,
    studiedLesson: !!(row.studied_lesson ?? row.studiedLesson),
    broughtOffering: !!(row.brought_offering ?? row.broughtOffering),
    offeringAmount: Number(row.offering_amount ?? row.offeringAmount ?? 0),
    attendedPG: !!(row.attended_pg ?? row.attendedPG),
  };
}

export function mapSupabaseRowToUnitWeekly(row: any) {
  return {
    id: row.id,
    sabbathDate: row.sabbath_date || row.sabbathDate,
    unitOrClassId: row.unit_or_class_id || row.unitOrClassId,
    unitName: row.unit_name || row.unitName || '',
    extraPoints: Number(row.extra_points ?? row.extraPoints ?? 0),
    offeringTarget: Number(row.offering_target ?? row.offeringTarget ?? 0),
    offeringCollected: Number(row.offering_collected ?? row.offeringCollected ?? 0),
  };
}

export function mapSupabaseRowToMana(row: any) {
  return {
    id: row.id,
    memberId: row.member_id || row.memberId || '',
    memberName: row.member_name || row.memberName || 'Assinante',
    items: Array.isArray(row.items) && row.items.length > 0
      ? row.items
      : [
          {
            lessonId: 'legacy-1',
            lessonName: row.plan || 'Lição de Adultos',
            category: 'Adultos',
            quantity: row.quantity || 1,
            unitPrice: row.unit_price || 38.0,
            totalPrice: row.total_amount || 38.0,
          },
        ],
    totalAmount: Number(row.total_amount ?? row.amount ?? 38.0),
    amountPaid: Number(row.amount_paid ?? 0),
    paymentMethod: row.payment_method || 'Pix',
    status: row.status || (Number(row.amount_paid ?? 0) >= Number(row.total_amount ?? 38.0) ? 'Quitado' : Number(row.amount_paid ?? 0) > 0 ? 'Parcial' : 'Pendente'),
    quarterlyDelivery: row.quarterly_delivery || {
      q1: row.delivery_status || 'Pendente',
      q2: 'Pendente',
      q3: 'Pendente',
      q4: 'Pendente',
    },
    quarterlyDeliveryDetails:
      row.quarterly_delivery_details ||
      (row.quarterly_delivery && typeof row.quarterly_delivery === 'object' ? row.quarterly_delivery.details : undefined) ||
      {},
    deliveryStatus: row.delivery_status || 'Pendente',
    year: Number(row.year || 2026),
    createdAt: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    notes: row.notes || '',
    payments: Array.isArray(row.payments) ? row.payments : [],
  };
}

export function mapSupabaseRowToCatalog(row: any) {
  return {
    id: row.id,
    name: row.name,
    category: row.category || 'Adultos',
    price: Number(row.price ?? 0),
    code: row.code || '',
  };
}

// Full SQL Schema Definition for Supabase
export const SUPABASE_SCHEMA_SQL = `-- =========================================================================
-- ESCOLA SABATINA PRO & PROJETO MANÁ - SUPABASE DATABASE SCHEMA DDL
-- Execute este script no SQL Editor do seu projeto Supabase (https://supabase.com)
-- =========================================================================

-- 1. TABELA DE MEMBROS E VISITANTES
CREATE TABLE IF NOT EXISTS public.members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'Membro',
    status TEXT DEFAULT 'Ativo',
    class_name TEXT,
    unit TEXT,
    is_teacher BOOLEAN DEFAULT FALSE,
    age INTEGER DEFAULT 0,
    gender TEXT DEFAULT 'Masc',
    phone TEXT,
    email TEXT,
    address TEXT,
    birth_date TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. TABELA DE CLASSES / UNIDADES
CREATE TABLE IF NOT EXISTS public.classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Adultos',
    teacher1_id TEXT,
    teacher1_name TEXT,
    teacher2_id TEXT,
    teacher2_name TEXT,
    room TEXT,
    member_count INTEGER DEFAULT 0,
    target_offering NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. TABELA DE REGISTROS DE CHAMADA (PONTUAÇÃO / CRM / OFERTAS)
CREATE TABLE IF NOT EXISTS public.roll_call_records (
    id TEXT PRIMARY KEY,
    sabbath_date DATE NOT NULL,
    member_id TEXT NOT NULL,
    member_name TEXT,
    class_id TEXT,
    present BOOLEAN DEFAULT FALSE,
    punctual BOOLEAN DEFAULT FALSE,
    studied_lesson BOOLEAN DEFAULT FALSE,
    brought_offering BOOLEAN DEFAULT FALSE,
    offering_amount NUMERIC DEFAULT 0,
    attended_pg BOOLEAN DEFAULT FALSE,
    lesson_study_days INTEGER DEFAULT 0,
    brought_bible BOOLEAN DEFAULT FALSE,
    visits_made INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. TABELA DE DADOS SEMANAIS DAS UNIDADES (PONTOS EXTRAS E METAS)
CREATE TABLE IF NOT EXISTS public.unit_weekly_data (
    id TEXT PRIMARY KEY,
    sabbath_date DATE NOT NULL,
    unit_or_class_id TEXT NOT NULL,
    unit_name TEXT,
    extra_points INTEGER DEFAULT 0,
    offering_target NUMERIC DEFAULT 0,
    offering_collected NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. TABELA DO PROJETO MANÁ (ASSINATURAS, ITENS E HISTÓRICO DE PAGAMENTOS)
CREATE TABLE IF NOT EXISTS public.mana_subscriptions (
    id TEXT PRIMARY KEY,
    member_id TEXT,
    member_name TEXT NOT NULL,
    items JSONB DEFAULT '[]'::jsonb,
    total_amount NUMERIC DEFAULT 0,
    amount_paid NUMERIC DEFAULT 0,
    payment_method TEXT DEFAULT 'Pix',
    status TEXT DEFAULT 'Pendente',
    quarterly_delivery JSONB DEFAULT '{"q1":"Pendente","q2":"Pendente","q3":"Pendente","q4":"Pendente"}'::jsonb,
    delivery_status TEXT DEFAULT 'Pendente',
    year INTEGER DEFAULT 2026,
    notes TEXT,
    payments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. TABELA DO CATÁLOGO DE LIÇÕES
CREATE TABLE IF NOT EXISTS public.lesson_catalog (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Adultos',
    price NUMERIC DEFAULT 0,
    code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. TABELA DE USUÁRIOS E PERFIS DE ACESSO
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'Secretário',
    class_unit_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =========================================================================
-- HABILITAR ROW LEVEL SECURITY (RLS) E POLÍTICAS DE ACESSO
-- Garante acesso de leitura e escrita via Anon Key para a aplicação
-- =========================================================================

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roll_call_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_weekly_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mana_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso completo a members" ON public.members;
CREATE POLICY "Permitir acesso completo a members" ON public.members FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso completo a classes" ON public.classes;
CREATE POLICY "Permitir acesso completo a classes" ON public.classes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso completo a roll_call_records" ON public.roll_call_records;
CREATE POLICY "Permitir acesso completo a roll_call_records" ON public.roll_call_records FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso completo a unit_weekly_data" ON public.unit_weekly_data;
CREATE POLICY "Permitir acesso completo a unit_weekly_data" ON public.unit_weekly_data FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso completo a mana_subscriptions" ON public.mana_subscriptions;
CREATE POLICY "Permitir acesso completo a mana_subscriptions" ON public.mana_subscriptions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso completo a lesson_catalog" ON public.lesson_catalog;
CREATE POLICY "Permitir acesso completo a lesson_catalog" ON public.lesson_catalog FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso completo a profiles" ON public.profiles;
CREATE POLICY "Permitir acesso completo a profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- HABILITAR REPLICAÇÃO EM TEMPO REAL (REALTIME)
ALTER PUBLICATION supabase_realtime ADD TABLE public.members, public.classes, public.roll_call_records, public.unit_weekly_data, public.mana_subscriptions;
`;

// Test Supabase Connection with Detailed Diagnostics
export async function testSupabaseConnection(): Promise<{
  success: boolean;
  message: string;
  tables: Record<string, boolean>;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase não configurado. Forneça URL e Anon Key.',
      tables: {},
    };
  }

  const tableNames = [
    'members',
    'classes',
    'roll_call_records',
    'unit_weekly_data',
    'mana_subscriptions',
    'lesson_catalog',
    'profiles',
  ];

  const results: Record<string, boolean> = {};

  try {
    for (const tbl of tableNames) {
      const { error } = await client.from(tbl).select('id').limit(1);
      results[tbl] = !error;
    }

    const availableCount = Object.values(results).filter(Boolean).length;
    const allOk = availableCount === tableNames.length;

    return {
      success: availableCount > 0,
      message: allOk
        ? `Todas as ${availableCount} tabelas estão conectadas e prontas!`
        : `${availableCount} de ${tableNames.length} tabelas encontradas. Execute o Script SQL para criar as restantes.`,
      tables: results,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Erro na conexão: ${err.message || 'Falha de rede.'}`,
      tables: results,
    };
  }
}

// Fetch all application data from Supabase Cloud
export async function fetchAllDataFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const storage = await import('./storage');

    const [resMembers, resClasses, resRollCall, resWeekly, resMana, resCatalog] = await Promise.all([
      client.from('members').select('*'),
      client.from('classes').select('*'),
      client.from('roll_call_records').select('*'),
      client.from('unit_weekly_data').select('*'),
      client.from('mana_subscriptions').select('*'),
      client.from('lesson_catalog').select('*'),
    ]);

    let updatedAny = false;

    if (resMembers.data && resMembers.data.length > 0) {
      const fetchedMembers = resMembers.data.map(mapSupabaseRowToMember);
      storage.saveMembers(fetchedMembers);
      updatedAny = true;
    }

    if (resClasses.data && resClasses.data.length > 0) {
      const fetchedClasses = resClasses.data.map((row: any) => ({
        id: row.id,
        name: row.name,
        category: row.category || 'Adultos',
        teacher1Id: row.teacher1_id || row.teacher1Id || '',
        teacher1Name: row.teacher1_name || row.teacher1Name || row.teacher || '',
        teacher2Id: row.teacher2_id || row.teacher2Id || '',
        teacher2Name: row.teacher2_name || row.teacher2Name || '',
        room: row.room || '',
        memberCount: Number(row.member_count ?? row.memberCount ?? 0),
        targetOffering: Number(row.target_offering ?? row.targetOffering ?? 0),
      }));
      storage.saveClasses(fetchedClasses);
      updatedAny = true;
    }

    if (resRollCall.data && resRollCall.data.length > 0) {
      const fetchedRollCall = resRollCall.data.map(mapSupabaseRowToRollCall);
      storage.saveRollCall(fetchedRollCall);
      updatedAny = true;
    }

    if (resWeekly.data && resWeekly.data.length > 0) {
      const fetchedWeekly = resWeekly.data.map(mapSupabaseRowToUnitWeekly);
      storage.saveUnitWeeklyData(fetchedWeekly);
      updatedAny = true;
    }

    if (resMana.data && resMana.data.length > 0) {
      const fetchedMana = resMana.data.map(mapSupabaseRowToMana);
      storage.saveMana(fetchedMana);
      updatedAny = true;
    }

    if (resCatalog.data && resCatalog.data.length > 0) {
      const fetchedCatalog = resCatalog.data.map(mapSupabaseRowToCatalog);
      storage.saveLessonCatalog(fetchedCatalog);
      updatedAny = true;
    }

    return updatedAny;
  } catch (err) {
    console.warn('Error fetching all data from Supabase:', err);
    return false;
  }
}

// Push local data to Supabase Tables
export async function syncAllLocalDataToSupabase() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase não está configurado. Insira a URL e Anon Key.');

  const storage = await import('./storage');
  const members = storage.loadMembers();
  const classes = storage.loadClasses();
  const rollCallRecords = storage.loadRollCall();
  const unitWeeklyData = storage.loadUnitWeeklyData();
  const manaSubscriptions = storage.loadMana();
  const lessonCatalog = storage.loadLessonCatalog();
  const profiles = loadSavedProfiles();

  let syncedCount = 0;

  // 1. Members
  if (members.length > 0) {
    const memberRows = members.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      status: m.status,
      class_name: m.className,
      unit: m.unit,
      is_teacher: !!m.isTeacher,
      age: m.age,
      gender: m.gender,
      phone: m.phone,
      email: m.email || null,
      address: m.address || null,
      birth_date: m.birthDate || null,
      notes: m.notes || null,
      created_at: m.createdAt || new Date().toISOString().slice(0, 10),
    }));
    const { error: errMembers } = await client.from('members').upsert(memberRows, { onConflict: 'id' });
    if (!errMembers) syncedCount += memberRows.length;
  }

  // 2. Classes
  if (classes.length > 0) {
    const classRows = classes.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category || 'Adultos',
      teacher1_id: c.teacher1Id || null,
      teacher1_name: c.teacher1Name || null,
      teacher2_id: c.teacher2Id || null,
      teacher2_name: c.teacher2Name || null,
      room: c.room || null,
      member_count: c.memberCount || 0,
      target_offering: c.targetOffering || 0,
    }));
    const { error: errClasses } = await client.from('classes').upsert(classRows, { onConflict: 'id' });
    if (!errClasses) syncedCount += classRows.length;
  }

  // 3. Roll Call Records
  if (rollCallRecords.length > 0) {
    const rollCallRows = rollCallRecords.map((r) => ({
      id: r.id,
      sabbath_date: r.sabbathDate,
      member_id: r.memberId,
      member_name: r.memberName,
      class_id: r.classId,
      present: r.present,
      punctual: r.punctual,
      studied_lesson: r.studiedLesson,
      brought_offering: r.broughtOffering,
      offering_amount: r.offeringAmount || 0,
      attended_pg: r.attendedPG,
      created_at: new Date().toISOString(),
    }));
    const { error: errRollCall } = await client.from('roll_call_records').upsert(rollCallRows, { onConflict: 'id' });
    if (!errRollCall) syncedCount += rollCallRows.length;
  }

  // 4. Unit Weekly Data
  if (unitWeeklyData.length > 0) {
    const weeklyRows = unitWeeklyData.map((u) => ({
      id: u.id,
      sabbath_date: u.sabbathDate,
      unit_or_class_id: u.unitOrClassId,
      unit_name: u.unitName || null,
      extra_points: u.extraPoints || 0,
      offering_target: u.offeringTarget || 0,
      offering_collected: u.offeringCollected || 0,
    }));
    const { error: errWeekly } = await client.from('unit_weekly_data').upsert(weeklyRows, { onConflict: 'id' });
    if (!errWeekly) syncedCount += weeklyRows.length;
  }

  // 5. Mana Subscriptions with Full JSON
  if (manaSubscriptions.length > 0) {
    const manaRows = manaSubscriptions.map((m) => ({
      id: m.id,
      member_id: m.memberId || null,
      member_name: m.memberName,
      items: m.items || [],
      total_amount: m.totalAmount || m.amount || 0,
      amount_paid: m.amountPaid || 0,
      payment_method: m.paymentMethod || 'Pix',
      status: m.status,
      quarterly_delivery: {
        ...(m.quarterlyDelivery || {}),
        details: m.quarterlyDeliveryDetails || {},
      },
      delivery_status: m.deliveryStatus,
      year: m.year || 2026,
      notes: m.notes || null,
      payments: m.payments || [],
      created_at: m.createdAt || new Date().toISOString(),
    }));
    const { error: errMana } = await client.from('mana_subscriptions').upsert(manaRows, { onConflict: 'id' });
    if (!errMana) syncedCount += manaRows.length;
  }

  // 6. Lesson Catalog
  if (lessonCatalog.length > 0) {
    const catalogRows = lessonCatalog.map((l) => ({
      id: l.id,
      name: l.name,
      category: l.category || 'Adultos',
      price: l.price || 0,
      code: l.code || null,
    }));
    const { error: errCat } = await client.from('lesson_catalog').upsert(catalogRows, { onConflict: 'id' });
    if (!errCat) syncedCount += catalogRows.length;
  }

  // 7. Profiles
  if (profiles.length > 0) {
    const profileRows = profiles.map((p) => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      role: p.role,
      class_unit_id: p.class_unit_id || null,
      created_at: p.created_at || new Date().toISOString(),
    }));
    const { error: errProfiles } = await client.from('profiles').upsert(profileRows, { onConflict: 'id' });
    if (!errProfiles) syncedCount += profileRows.length;
  }

  return syncedCount;
}

