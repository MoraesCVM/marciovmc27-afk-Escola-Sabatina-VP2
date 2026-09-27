'use client';

import React, { useState, useEffect } from 'react';
import { LogoEmblem } from '@/components/LogoEmblem';
import { DashboardView } from '@/components/DashboardView';
import { MembersView } from '@/components/MembersView';
import { ClassesView } from '@/components/ClassesView';
import { RollCallView } from '@/components/RollCallView';
import { CalendarView } from '@/components/CalendarView';
import { ManaView } from '@/components/ManaView';
import { AiAssistantView } from '@/components/AiAssistantView';
import { SyncModal } from '@/components/SyncModal';
import { LoginView } from '@/components/LoginView';
import { UserManagementView } from '@/components/UserManagementView';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';
import { ChangeLogoModal } from '@/components/ChangeLogoModal';

import {
  UserProfile,
  getSavedSession,
  clearSavedSession,
  getSupabaseClient,
  isMasterAdminRole,
  addAuditLog,
  fetchAllDataFromSupabase,
  syncAllLocalDataToSupabase,
} from '@/lib/supabase';

import {
  Member,
  ClassUnit,
  RollCallRecord,
  SabbathDate,
  ManaSubscription,
  LessonCatalogItem,
  SyncConfig,
  CriteriaPointsConfig,
  UnitWeeklyData,
} from '@/lib/types';

import {
  loadMembers,
  saveMembers,
  loadClasses,
  saveClasses,
  loadSabbaths,
  saveSabbaths,
  loadMana,
  saveMana,
  loadLessonCatalog,
  saveLessonCatalog,
  loadRollCall,
  saveRollCall,
  loadSyncConfig,
  saveSyncConfig,
  loadCriteriaConfig,
  saveCriteriaConfig,
  loadUnitWeeklyData,
  saveUnitWeeklyData,
} from '@/lib/storage';

import {
  INITIAL_MEMBERS,
  INITIAL_CLASSES,
  SABBATHS_2026,
  INITIAL_MANA,
  INITIAL_LESSON_CATALOG,
  INITIAL_ROLLCALL,
  DEFAULT_CRITERIA_CONFIG,
  INITIAL_UNIT_WEEKLY_DATA,
} from '@/lib/data';

import {
  LayoutDashboard,
  Users,
  CheckSquare,
  GraduationCap,
  Calendar,
  BookMarked,
  Bot,
  Cloud,
  ChevronDown,
  ShieldCheck,
  LogOut,
  UserCheck,
  KeyRound,
  Camera,
} from 'lucide-react';

export default function Home() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);
  const [isChangeLogoOpen, setIsChangeLogoOpen] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<string>('membros');

  // Core Application State
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [classes, setClasses] = useState<ClassUnit[]>(INITIAL_CLASSES);
  const [sabbaths, setSabbaths] = useState<SabbathDate[]>(SABBATHS_2026);
  const [manaSubscriptions, setManaSubscriptions] = useState<ManaSubscription[]>(INITIAL_MANA);
  const [lessonCatalog, setLessonCatalog] = useState<LessonCatalogItem[]>(INITIAL_LESSON_CATALOG);
  const [rollCallRecords, setRollCallRecords] = useState<RollCallRecord[]>(INITIAL_ROLLCALL);
  const [unitWeeklyData, setUnitWeeklyData] = useState<UnitWeeklyData[]>(INITIAL_UNIT_WEEKLY_DATA);
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    supabaseUrl: '',
    supabaseAnonKey: '',
    isConfigured: false,
  });
  const [criteriaConfig, setCriteriaConfig] = useState<CriteriaPointsConfig>(DEFAULT_CRITERIA_CONFIG);

  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Check saved session on mount & subscribe to Supabase auth state
  useEffect(() => {
    const timer = setTimeout(() => {
      const session = getSavedSession();
      if (session) {
        setCurrentUser(session.profile);
      }
      setIsAuthLoading(false);
    }, 0);

    const supabase = getSupabaseClient();
    let authListener: { subscription: { unsubscribe: () => void } } | null = null;

    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange(
        async (event, authSession) => {
          if (authSession?.user) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', authSession.user.id)
              .single();

            const profile: UserProfile = {
              id: authSession.user.id,
              email: authSession.user.email || '',
              full_name:
                profileData?.full_name ||
                authSession.user.user_metadata?.full_name ||
                (authSession.user.email || '').split('@')[0],
              role: profileData?.role || 'Diretor',
              class_unit_id: profileData?.class_unit_id,
              created_at: profileData?.created_at || new Date().toISOString(),
            };

            setCurrentUser(profile);
          } else if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
          }
        }
      );
      authListener = data;
    }

    return () => {
      clearTimeout(timer);
      if (authListener) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // Load initial application data on mount & subscribe to Supabase Realtime updates
  useEffect(() => {
    const reloadAllData = () => {
      setMembers(loadMembers());
      setClasses(loadClasses());
      setSabbaths(loadSabbaths());
      setManaSubscriptions(loadMana());
      setLessonCatalog(loadLessonCatalog());
      setRollCallRecords(loadRollCall());
      setUnitWeeklyData(loadUnitWeeklyData());
      setSyncConfig(loadSyncConfig());
      setCriteriaConfig(loadCriteriaConfig());
    };

    const timer = setTimeout(async () => {
      // 1. Initial local load for instant rendering
      reloadAllData();

      // 2. Automatically fetch cloud database if Supabase is connected
      const supabase = getSupabaseClient();
      if (supabase) {
        const hasCloudUpdates = await fetchAllDataFromSupabase();
        if (hasCloudUpdates) {
          reloadAllData();
        }
      }
    }, 0);

    // Cross-tab sync via Storage events
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key?.includes('escola_sabatina') ||
        e.key?.includes('members') ||
        e.key?.includes('rollcall') ||
        e.key?.includes('unit_weekly')
      ) {
        reloadAllData();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Supabase Realtime postgres_changes and broadcast channel listener
    const supabase = getSupabaseClient();
    let realtimeChannel: any = null;

    if (supabase) {
      realtimeChannel = supabase
        .channel('public:escola_sabatina_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public' },
          async (payload) => {
            console.log('Realtime change received from Supabase:', payload);
            await fetchAllDataFromSupabase();
            reloadAllData();
          }
        )
        .on('broadcast', { event: 'realtime_data_update' }, (payload) => {
          if (payload.payload?.members) setMembers(payload.payload.members);
          if (payload.payload?.rollCallRecords) setRollCallRecords(payload.payload.rollCallRecords);
          if (payload.payload?.unitWeeklyData) setUnitWeeklyData(payload.payload.unitWeeklyData);
        })
        .subscribe();
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('storage', handleStorageChange);
      if (supabase && realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, []);

  const handleLogout = async () => {
    if (currentUser) {
      addAuditLog(currentUser.email, 'LOGOUT', 'Sessão encerrada com segurança');
    }
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    clearSavedSession();
    setCurrentUser(null);
  };

  // Save updates to LocalStorage
  const handleAddMember = (newMemberData: Omit<Member, 'id' | 'createdAt'>) => {
    const newMember: Member = {
      ...newMemberData,
      id: `mb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setMembers((prev) => {
      const updated = [newMember, ...prev];
      saveMembers(updated);
      syncAllLocalDataToSupabase().catch(() => {});
      return updated;
    });
  };

  const handleAddMultipleMembers = (newMembersData: Omit<Member, 'id' | 'createdAt'>[]) => {
    const newMembers: Member[] = newMembersData.map((data, idx) => ({
      ...data,
      id: `mb-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString().slice(0, 10),
    }));
    setMembers((prev) => {
      const updated = [...newMembers, ...prev];
      saveMembers(updated);
      syncAllLocalDataToSupabase().catch(() => {});
      return updated;
    });
  };

  const handleUpdateMember = (updatedMember: Member) => {
    const updated = members.map((m) => (m.id === updatedMember.id ? updatedMember : m));
    setMembers(updated);
    saveMembers(updated);
  };

  const handleDeleteMember = (id: string) => {
    const updated = members.filter((m) => m.id !== id);
    setMembers(updated);
    saveMembers(updated);
  };

  const handleDeleteAllMembers = () => {
    setMembers([]);
    saveMembers([]);
  };

  const handleAddClass = (newClassData: Omit<ClassUnit, 'id'>) => {
    const newClass: ClassUnit = {
      ...newClassData,
      id: `cls-${Date.now()}`,
    };
    const updated = [...classes, newClass];
    setClasses(updated);
    saveClasses(updated);
  };

  const handleUpdateClass = (updatedClass: ClassUnit) => {
    const updated = classes.map((c) => (c.id === updatedClass.id ? updatedClass : c));
    setClasses(updated);
    saveClasses(updated);
  };

  const handleDeleteClass = (id: string) => {
    const updated = classes.filter((c) => c.id !== id);
    setClasses(updated);
    saveClasses(updated);
  };

  const broadcastRealtimeChange = (payload: {
    rollCallRecords?: RollCallRecord[];
    unitWeeklyData?: UnitWeeklyData[];
    members?: Member[];
  }) => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const channel = supabase.channel('public:escola_sabatina_realtime');
        channel.send({
          type: 'broadcast',
          event: 'realtime_data_update',
          payload,
        });
      } catch (err) {
        console.warn('Realtime broadcast note:', err);
      }
    }
  };

  const handleSaveRollCall = (newRecords: RollCallRecord[]) => {
    const existingIds = new Set(newRecords.map((r) => r.id));
    const filteredOld = rollCallRecords.filter((r) => !existingIds.has(r.id));
    const updated = [...newRecords, ...filteredOld];
    setRollCallRecords(updated);
    saveRollCall(updated);
    broadcastRealtimeChange({ rollCallRecords: updated });
    syncAllLocalDataToSupabase().catch(() => {});
  };

  const handleSaveUnitWeeklyData = (data: UnitWeeklyData) => {
    setUnitWeeklyData((prev) => {
      const existingIdx = prev.findIndex(
        (item) => item.sabbathDate === data.sabbathDate && item.unitOrClassId === data.unitOrClassId
      );
      let updated: UnitWeeklyData[];
      if (existingIdx >= 0) {
        updated = [...prev];
        updated[existingIdx] = data;
      } else {
        updated = [data, ...prev];
      }
      saveUnitWeeklyData(updated);
      broadcastRealtimeChange({ unitWeeklyData: updated });
      syncAllLocalDataToSupabase().catch(() => {});
      return updated;
    });
  };

  const handleAddMana = (newManaData: Omit<ManaSubscription, 'id'>) => {
    const newMana: ManaSubscription = {
      ...newManaData,
      id: `mn-${Date.now()}`,
    };
    const updated = [newMana, ...manaSubscriptions];
    setManaSubscriptions(updated);
    saveMana(updated);
    syncAllLocalDataToSupabase().catch(() => {});
  };

  const handleAddMultipleMana = (newOrders: Omit<ManaSubscription, 'id'>[]) => {
    const newSubs: ManaSubscription[] = newOrders.map((order, idx) => ({
      ...order,
      id: `mn-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    }));
    const updated = [...newSubs, ...manaSubscriptions];
    setManaSubscriptions(updated);
    saveMana(updated);
    syncAllLocalDataToSupabase().catch(() => {});
  };

  const handleReplaceAllMana = (allOrders: ManaSubscription[]) => {
    setManaSubscriptions(allOrders);
    saveMana(allOrders);
    syncAllLocalDataToSupabase().catch(() => {});
  };

  const handleUpdateManaOrder = (updatedOrder: ManaSubscription) => {
    const updated = manaSubscriptions.map((m) => (m.id === updatedOrder.id ? updatedOrder : m));
    setManaSubscriptions(updated);
    saveMana(updated);
    syncAllLocalDataToSupabase().catch(() => {});
  };

  const handleDeleteManaOrder = (id: string) => {
    const updated = manaSubscriptions.filter((m) => m.id !== id);
    setManaSubscriptions(updated);
    saveMana(updated);
    syncAllLocalDataToSupabase().catch(() => {});
  };

  const handleUpdateManaStatus = (
    id: string,
    status: ManaSubscription['status'],
    deliveryStatus: ManaSubscription['deliveryStatus']
  ) => {
    const updated = manaSubscriptions.map((m) =>
      m.id === id ? { ...m, status, deliveryStatus } : m
    );
    setManaSubscriptions(updated);
    saveMana(updated);
    syncAllLocalDataToSupabase().catch(() => {});
  };

  const handleSaveLessonCatalog = (updatedCatalog: LessonCatalogItem[]) => {
    setLessonCatalog(updatedCatalog);
    saveLessonCatalog(updatedCatalog);
    syncAllLocalDataToSupabase().catch(() => {});
  };

  const handleSaveSyncConfig = (config: SyncConfig) => {
    setSyncConfig(config);
    saveSyncConfig(config);
  };

  const handleSaveCriteriaConfig = (config: CriteriaPointsConfig) => {
    setCriteriaConfig(config);
    saveCriteriaConfig(config);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.members) {
          setMembers(data.members);
          saveMembers(data.members);
        }
        if (data.classes) {
          setClasses(data.classes);
          saveClasses(data.classes);
        }
        if (data.sabbaths) {
          setSabbaths(data.sabbaths);
          saveSabbaths(data.sabbaths);
        }
        if (data.mana) {
          setManaSubscriptions(data.mana);
          saveMana(data.mana);
        }
        if (data.rollcall) {
          setRollCallRecords(data.rollcall);
          saveRollCall(data.rollcall);
        }
        if (data.unitWeeklyData) {
          setUnitWeeklyData(data.unitWeeklyData);
          saveUnitWeeklyData(data.unitWeeklyData);
        }
        if (data.lessonCatalog) {
          setLessonCatalog(data.lessonCatalog);
          saveLessonCatalog(data.lessonCatalog);
        }

        // Auto sync with Supabase
        try {
          await syncAllLocalDataToSupabase();
        } catch {
          // Local save succeeded regardless
        }

        alert('Backup importado, restaurado e salvo na nuvem com sucesso!');
        setIsSyncModalOpen(false);
      } catch (err) {
        alert('Erro ao importar arquivo JSON de backup.');
      }
    };
    reader.readAsText(file);
  };

  const totalMembersCount = members.filter((m) => m.type === 'Membro').length;

  // 1. Loading Screen
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#600010] flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-10 h-10 border-4 border-white/30 border-t-[#D4AF37] rounded-full animate-spin" />
        <p className="text-xs font-bold tracking-widest text-amber-200 uppercase">
          Carregando Sessão e Permissões...
        </p>
      </div>
    );
  }

  // 2. PROTECTED ROUTE CHECK: Redirect to Login if not authenticated
  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={(profile) => {
          setCurrentUser(profile);
        }}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
      />
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#F5F2ED] text-[#1A1A1A] overflow-hidden font-sans">
      {/* 1. Left Sidebar (Desktop) */}
      <aside className="w-64 bg-[#600010] hidden md:flex flex-col border-r border-[#D4AF37]/25 shrink-0 select-none">
        {/* App Logo Circular Frame */}
        <div className="p-5 flex flex-col items-center border-b border-[#D4AF37]/30">
          <div
            className="relative group cursor-pointer"
            onClick={() => setIsChangeLogoOpen(true)}
          >
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border-2 border-[#D4AF37] mb-2 shadow-xl group-hover:scale-105 transition-transform">
              <LogoEmblem size={52} />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsChangeLogoOpen(true);
              }}
              className="absolute -bottom-1 -right-1 p-1.5 bg-[#D4AF37] text-[#600010] rounded-full shadow-md border border-white hover:scale-110 transition"
              title="Alterar Foto / Logo da Igreja"
            >
              <Camera className="w-3 h-3" />
            </button>
          </div>
          <h1 className="text-white font-serif italic text-xl font-bold tracking-tight">Sabatina Pro</h1>
          <button
            type="button"
            onClick={() => setIsChangeLogoOpen(true)}
            className="text-[#D4AF37] hover:text-amber-200 text-[10px] uppercase tracking-widest mt-1 font-semibold flex items-center gap-1 hover:underline"
          >
            <Camera className="w-2.5 h-2.5" />
            <span>Alterar Logo / Foto</span>
          </button>
        </div>

        {/* Vertical Nav Links */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'dashboard'
                ? 'bg-white/10 text-white border-l-4 border-[#D4AF37] font-bold shadow-xs'
                : 'text-white/75 hover:text-white hover:bg-white/5'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-[#D4AF37]" />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('membros')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'membros'
                ? 'bg-white/10 text-white border-l-4 border-[#D4AF37] font-bold shadow-xs'
                : 'text-white/75 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Users className="w-4 h-4 text-[#D4AF37]" />
              <span>Membros e Visitantes</span>
            </div>
            <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded-md text-[#D4AF37]">
              {totalMembersCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('frequencia')}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'frequencia'
                ? 'bg-white/10 text-white border-l-4 border-[#D4AF37] font-bold shadow-xs'
                : 'text-white/75 hover:text-white hover:bg-white/5'
            }`}
          >
            <CheckSquare className="w-4 h-4 text-[#D4AF37]" />
            <span>Chamada Semanal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('classes')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'classes'
                ? 'bg-white/10 text-white border-l-4 border-[#D4AF37] font-bold shadow-xs'
                : 'text-white/75 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center space-x-3">
              <GraduationCap className="w-4 h-4 text-[#D4AF37]" />
              <span>Classes e Unidades</span>
            </div>
            <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded-md text-[#D4AF37]">
              {classes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calendario')}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'calendario'
                ? 'bg-white/10 text-white border-l-4 border-[#D4AF37] font-bold shadow-xs'
                : 'text-white/75 hover:text-white hover:bg-white/5'
            }`}
          >
            <Calendar className="w-4 h-4 text-[#D4AF37]" />
            <span>Calendário 2026</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mana')}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'mana'
                ? 'bg-white/10 text-white border-l-4 border-[#D4AF37] font-bold shadow-xs'
                : 'text-white/75 hover:text-white hover:bg-white/5'
            }`}
          >
            <BookMarked className="w-4 h-4 text-[#D4AF37]" />
            <span>Projeto Maná</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ia')}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'ia'
                ? 'bg-white/10 text-white border-l-4 border-[#D4AF37] font-bold shadow-xs'
                : 'text-white/75 hover:text-white hover:bg-white/5'
            }`}
          >
            <Bot className="w-4 h-4 text-[#D4AF37]" />
            <span>Assistente IA</span>
          </button>

          {/* Master Admin Exclusive Tab */}
          {isMasterAdminRole(currentUser.role) && (
            <button
              type="button"
              onClick={() => setActiveTab('gestao')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'gestao'
                  ? 'bg-amber-500/20 text-white border-l-4 border-[#D4AF37] font-bold shadow-xs'
                  : 'text-amber-200/80 hover:text-amber-200 hover:bg-white/5'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
              <span>👑 Gestão de Usuários</span>
            </button>
          )}
        </nav>

        {/* User / Church Info Badge Footer with Logout */}
        <div className="p-4 bg-[#4A000C] border-t border-[#D4AF37]/20 space-y-2">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-[#D4AF37] text-[#600010] flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
              {currentUser.full_name.substring(0, 1).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-white text-xs font-bold truncate">{currentUser.full_name}</p>
              <p className="text-[#D4AF37] text-[10px] truncate font-extrabold uppercase">
                {currentUser.role === 'Admin' ? '👑 Admin Master' : `🛡️ ${currentUser.role}`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setIsChangePasswordOpen(true)}
              className="py-1.5 px-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 font-extrabold text-[10px] rounded-lg flex items-center justify-center gap-1 transition border border-amber-400/20"
              title="Alterar minha senha"
            >
              <KeyRound className="w-3 h-3 text-[#D4AF37]" />
              <span className="truncate">Senha</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="py-1.5 px-2 bg-white/10 hover:bg-white/20 text-rose-200 font-extrabold text-[10px] rounded-lg flex items-center justify-center gap-1 transition border border-white/10"
              title="Encerrar sessão"
            >
              <LogOut className="w-3 h-3" />
              <span className="truncate">Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Container */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 md:h-20 bg-white border-b border-gray-200/90 px-4 md:px-8 flex items-center justify-between shadow-xs shrink-0 z-10">
          <div className="flex items-center space-x-3 md:space-x-4">
            {/* Mobile Logo emblem */}
            <div className="md:hidden flex items-center space-x-2" onClick={() => setActiveTab('dashboard')}>
              <LogoEmblem size={36} />
              <span className="font-serif font-bold text-base text-[#600010]">Sabatina Pro</span>
            </div>

            <div className="hidden md:block">
              <h2 className="text-xl md:text-2xl font-serif font-bold text-[#600010]">
                {activeTab === 'dashboard' && 'Visão Geral do Trimestre'}
                {activeTab === 'membros' && 'Gestão de Membros e Visitantes'}
                {activeTab === 'frequencia' && 'Lançamento de Chamada Semanal'}
                {activeTab === 'classes' && 'Classes e Unidades de Estudo'}
                {activeTab === 'calendario' && 'Calendário Oficial 2026'}
                {activeTab === 'mana' && 'Controle de Assinaturas Maná'}
                {activeTab === 'ia' && 'Assistente de Inteligência Teológica'}
                {activeTab === 'gestao' && 'Gestão de Usuários & Permissões'}
              </h2>
            </div>

            <span className="bg-[#F5F2ED] text-[#D4AF37] border border-[#D4AF37]/40 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider hidden sm:inline-block">
              {selectedQuarter}º Trimestre 2026
            </span>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* User Profile Badge Header */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-rose-50 border border-rose-100 rounded-xl text-xs">
              <ShieldCheck className="w-4 h-4 text-[#600010]" />
              <div>
                <span className="font-extrabold text-gray-900 block leading-tight">{currentUser.full_name}</span>
                <span className="text-[10px] text-[#600010] font-black uppercase">
                  {currentUser.role === 'Admin' ? '👑 Admin Master' : `🛡️ ${currentUser.role}`}
                </span>
              </div>
            </div>

            {/* Change Password Button Header */}
            <button
              type="button"
              onClick={() => setIsChangePasswordOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-[#600010] font-extrabold text-xs rounded-xl border border-amber-200 transition"
              title="Alterar minha senha"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#600010]" />
              <span className="hidden sm:inline">Alterar Senha</span>
            </button>

            {/* Change Logo Button Header */}
            <button
              type="button"
              onClick={() => setIsChangeLogoOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-[#600010] font-extrabold text-xs rounded-xl border border-rose-200 transition"
              title="Alterar Foto / Logo do Sistema"
            >
              <Camera className="w-3.5 h-3.5 text-[#600010]" />
              <span className="hidden sm:inline">Foto/Logo</span>
            </button>

            {/* Logout Header Button */}
            <button
              type="button"
              onClick={handleLogout}
              title="Encerrar sessão"
              className="p-2 text-rose-800 hover:bg-rose-50 rounded-xl border border-rose-200 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Trimestre Selector Dropdown */}
            <div className="relative">
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(parseInt(e.target.value))}
                className="bg-[#F5F2ED] text-[#600010] text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-300 focus:outline-none appearance-none pr-7 cursor-pointer"
              >
                <option value={1}>1º Trim 2026</option>
                <option value={2}>2º Trim 2026</option>
                <option value={3}>3º Trim 2026</option>
                <option value={4}>4º Trim 2026</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#600010] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Cloud Sync Button */}
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                syncConfig.isConfigured
                  ? 'bg-emerald-700 border-emerald-500 text-white'
                  : 'bg-white hover:bg-gray-50 border-[#D4AF37] text-[#600010]'
              }`}
            >
              <Cloud className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="hidden sm:inline">
                {syncConfig.isConfigured ? 'Nuvem Conectada' : 'Sincronizar'}
              </span>
            </button>
          </div>
        </header>

        {/* Mobile Tab Segment Bar */}
        <nav className="md:hidden bg-white border-b border-gray-200 px-3 py-2 overflow-x-auto flex items-center space-x-1 shrink-0 no-scrollbar">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'membros', label: 'Membros', icon: Users },
            { id: 'frequencia', label: 'Chamada', icon: CheckSquare },
            { id: 'classes', label: 'Classes', icon: GraduationCap },
            { id: 'calendario', label: 'Calendário', icon: Calendar },
            { id: 'mana', label: 'Maná', icon: BookMarked },
            { id: 'ia', label: 'IA Assistente', icon: Bot },
            ...(isMasterAdminRole(currentUser.role) ? [{ id: 'gestao', label: 'Gestão', icon: ShieldCheck }] : []),
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[#600010] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Main Body Content Scroll Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {activeTab === 'dashboard' && (
            <DashboardView
              members={members}
              classes={classes}
              rollCallRecords={rollCallRecords}
              unitWeeklyData={unitWeeklyData}
              manaSubscriptions={manaSubscriptions}
              sabbaths={sabbaths}
              criteriaConfig={criteriaConfig}
              selectedQuarter={selectedQuarter}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'membros' && (
            <MembersView
              members={members}
              classes={classes}
              onAddMember={handleAddMember}
              onAddMultipleMembers={handleAddMultipleMembers}
              onUpdateMember={handleUpdateMember}
              onDeleteMember={handleDeleteMember}
              onDeleteAllMembers={handleDeleteAllMembers}
            />
          )}

          {activeTab === 'classes' && (
            <ClassesView
              classes={classes}
              members={members}
              onAddClass={handleAddClass}
              onUpdateClass={handleUpdateClass}
              onDeleteClass={handleDeleteClass}
            />
          )}

          {activeTab === 'frequencia' && (
            <RollCallView
              members={members}
              classes={classes}
              sabbaths={sabbaths}
              rollCallRecords={rollCallRecords}
              unitWeeklyData={unitWeeklyData}
              criteriaConfig={criteriaConfig}
              selectedQuarter={selectedQuarter}
              onSaveRollCall={handleSaveRollCall}
              onSaveUnitWeeklyData={handleSaveUnitWeeklyData}
              onSaveCriteriaConfig={handleSaveCriteriaConfig}
            />
          )}

          {activeTab === 'calendario' && (
            <CalendarView
              sabbaths={sabbaths}
              selectedQuarter={selectedQuarter}
              onSelectQuarter={(q) => setSelectedQuarter(q)}
              onUpdateSabbaths={(updated) => {
                setSabbaths(updated);
                saveSabbaths(updated);
              }}
            />
          )}

          {activeTab === 'mana' && (
            <ManaView
              manaSubscriptions={manaSubscriptions}
              members={members}
              classes={classes}
              lessonCatalog={lessonCatalog}
              onAddMana={handleAddMana}
              onAddMultipleMana={handleAddMultipleMana}
              onReplaceAllMana={handleReplaceAllMana}
              onUpdateManaOrder={handleUpdateManaOrder}
              onDeleteManaOrder={handleDeleteManaOrder}
              onUpdateManaStatus={handleUpdateManaStatus}
              onSaveLessonCatalog={handleSaveLessonCatalog}
              selectedQuarter={selectedQuarter}
              onSelectQuarter={(q) => setSelectedQuarter(q)}
            />
          )}

          {activeTab === 'ia' && <AiAssistantView />}

          {activeTab === 'gestao' && isMasterAdminRole(currentUser.role) && (
            <UserManagementView currentUser={currentUser} />
          )}

          {/* Footer Branding */}
          <footer className="pt-6 pb-4 flex flex-col items-center justify-center border-t border-gray-200/60">
            <p className="text-[10px] font-serif tracking-widest text-gray-500 uppercase text-center">
              Sistema Oficial de Gestão de Membros • Versão 2.0.4 Gold Edition
            </p>
          </footer>
        </main>
      </div>

      {/* Sync Modal */}
      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        syncConfig={syncConfig}
        onSaveSyncConfig={handleSaveSyncConfig}
        onImportJSON={handleImportJSON}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        currentUser={currentUser}
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />

      {/* Change Logo/Photo Modal */}
      <ChangeLogoModal
        isOpen={isChangeLogoOpen}
        onClose={() => setIsChangeLogoOpen(false)}
      />
    </div>
  );
}
