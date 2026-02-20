import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ToastNotification } from '../components/ui/ToastNotification';
import { useBrowserNotifications } from '../hooks/useBrowserNotifications';
import { NotificationBell } from '../components/notifications/NotificationBell';
import { supabase } from '../integrations/supabase/client';
import { switchLanguage, LANG_META, type SupportedLang } from '../i18n/index';

// Module imports
import { TaskCard } from '../components/tasks/TaskCard';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { ProductCatalogue } from '../components/catalogue/ProductCatalogue';
import { ReportsView } from '../components/reports/EndOfDayReport';
import { TimesheetView } from '../components/timesheets/TimesheetView';
import { IncidentModule } from '../components/incidents/IncidentModule';
import { HACCPModule } from '../components/haccp/HACCPModule';
import { ObjectivesModule } from '../components/objectives/ObjectivesModule';
import { PinManagement } from '../components/pins/PinManagement';
import { PlanningModule } from '../components/planning/PlanningModule';
import { OrdersModule } from '../components/orders/OrdersModule';
import { MessagingModule } from '../components/messaging/MessagingModule';
import { MalusContestModule } from '../components/scoring/MalusContestModule';
import { Leaderboard } from '../components/leaderboard/Leaderboard';
import { MonScore } from '../components/scoring/MonScore';
import { OwnerSettings } from '../components/dashboard/OwnerSettings';
import { AccountManagement } from '../components/dashboard/AccountManagement';
import { RoomManagement } from '../components/dashboard/RoomManagement';
import { RestaurantManagement } from '../components/dashboard/RestaurantManagement';
import { ShiftSwapModule } from '../components/planning/ShiftSwapModule';
import { StaffShiftsView } from '../components/planning/StaffShiftsView';
import { StaffAvailabilityView } from '../components/planning/AvailabilityModule';
import { MenuModule } from '../components/menu/MenuModule';
import PointagePage from './Pointage';
import ProfilPage from './Profil';
import { StockModule } from '../components/stock/StockModule';
import { ClassesModule } from '../components/admin/ClassesModule';
import { MembresModule } from '../components/admin/MembresModule';

import {
  LogOut, WifiOff, BellOff, Bell, Mail,
  CheckCircle, MessageSquare, AlertTriangle, ShoppingCart, Clock, Target,
  CalendarDays, Thermometer, ChefHat, Home, User, Users, Package,
  FileText, KeyRound, Trophy, Activity, UtensilsCrossed, Shield,
  Star, ChevronDown, ChevronUp, LayoutGrid, AlertOctagon, Settings, Sun, Moon, Plus,
  Globe, RefreshCw, Store, Edit2, X,
} from 'lucide-react';
import logo from '../assets/logo.svg';
import logoDark from '../assets/logo-dark.svg';
import { TEAM_LABELS } from '../data/initialData';
import type { Incident, Team } from '../types';

// ─── Dark mode ────────────────────────────────────────────────────────────────
function getInitialTheme(): 'dark' | 'light' {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {}
  return 'light';
}
function applyTheme(theme: 'dark' | 'light') {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try { localStorage.setItem('theme', theme); } catch {}
}

// ─── Role helpers ─────────────────────────────────────────────────────────────
type AppRole = 'god' | 'owner' | 'admin' | 'manager' | 'chef' | 'staff' | 'station';

function isGodOrOwner(role?: AppRole) { return role === 'god' || role === 'owner' || role === 'admin'; }
function isOwnerOrAdmin(role?: AppRole) { return isGodOrOwner(role); }
function isManagerOrAbove(role?: AppRole) { return role === 'manager' || isGodOrOwner(role); }
function isChefOrAbove(role?: AppRole) { return role === 'chef' || isManagerOrAbove(role); }
function canEdit(role?: AppRole) { return isGodOrOwner(role) || role === 'manager'; }

const SEVERITY_EMOJI: Record<Incident['severity'], string> = { high: '🚨', medium: '⚠️', low: 'ℹ️', critical: '🚨' };

// ─── Tile definition ──────────────────────────────────────────────────────────
type ModuleKey =
  | 'home' | 'tasks' | 'chat' | 'sos' | 'orders' | 'timesheet' | 'objectives'
  | 'planning' | 'menu' | 'haccp' | 'scores' | 'leaderboard' | 'reports' | 'catalogue' | 'pins'
  | 'settings' | 'contests' | 'swaps' | 'availability' | 'timesheets_all'
  | 'pointage' | 'profile' | 'stock' | 'accounts' | 'rooms' | 'restaurants'
  | 'classes' | 'membres';

interface Tile {
  id: ModuleKey;
  label: string;
  emoji: string;
  icon: React.ReactNode;
  badge?: number;
  color: string;
  iconColor: string;
}

// ─── Role label helper ────────────────────────────────────────────────────────
function getRoleLabel(role?: AppRole): string {
  switch (role) {
    case 'god':     return 'Divinité';
    case 'owner':   return 'Propriétaire';
    case 'admin':   return 'Administrateur';
    case 'manager': return 'Manager';
    case 'chef':    return 'Chef';
    case 'staff':   return 'Équipier';
    case 'station': return 'Station';
    default:        return '';
  }
}

// ─── Initials avatar ─────────────────────────────────────────────────────────
function InitialsAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const sz = size === 'lg' ? 'w-10 h-10 text-sm' : size === 'sm' ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-xs';
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold flex-shrink-0 bg-gradient-to-br from-primary to-accent text-primary-foreground`}>
      {initials}
    </div>
  );
}

// ─── GOD impersonation banner ────────────────────────────────────────────────
function GodBanner() {
  const [hidden, setHidden] = useState(false);
  const raw = sessionStorage.getItem('god_impersonating');
  if (!raw || hidden) return null;
  try {
    const data = JSON.parse(raw);
    const handleQuit = () => {
      sessionStorage.removeItem('god_impersonating');
      window.location.reload();
    };
    return (
      <div className="fixed top-0 left-0 right-0 z-[200] px-4 py-1.5 flex items-center justify-between gap-2 text-xs font-bold shadow-lg"
        style={{ background: 'hsl(45 100% 50%)', color: 'hsl(45 100% 10%)' }}>
        <span>👁 Session GOD — Connecté en tant que <strong>{data.targetName}</strong> ({data.restaurantName})</span>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setHidden(true)} className="underline hover:no-underline opacity-70 hover:opacity-100">Masquer</button>
          <button onClick={handleQuit} className="underline hover:no-underline">Quitter</button>
        </div>
      </div>
    );
  } catch { return null; }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { t } = useTranslation();
  const { currentUser, logout, restaurantName, getTodayTasks, realtimeStatus, unreadHighIncidents, incidents, clearIncidentBadge } = useApp();
  const { signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleKey>('home');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { permission, isSupported, requestPermission, notify } = useBrowserNotifications();
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);
  const [currentLang, setCurrentLang] = useState<SupportedLang>((localStorage.getItem('i18n_lang') as SupportedLang) ?? 'fr');
  const [currentTime, setCurrentTime] = useState(new Date());
  const knownIdsRef = useRef<Set<string> | null>(null);
  const [unreadManagerMessages, setUnreadManagerMessages] = useState(0);

  useEffect(() => { applyTheme(theme); }, [theme]);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Unread manager messages — count messages in 'managers' channel newer than last visit
  useEffect(() => {
    if (!currentUser) return;
    const role = currentUser.role as AppRole | undefined;
    if (!isManagerOrAbove(role)) return;

    const lastOpen = localStorage.getItem('last_chat_managers_open') ?? '1970-01-01T00:00:00Z';

    const fetchUnread = async () => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('channel', 'managers')
        .neq('sender_id', currentUser.id)
        .gt('created_at', lastOpen);
      setUnreadManagerMessages(count ?? 0);
    };

    fetchUnread();

    const channel = supabase
      .channel('manager-msgs-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'channel=eq.managers' }, (payload) => {
        const msg = payload.new as { sender_id: string; created_at: string };
        if (msg.sender_id !== currentUser.id) {
          setUnreadManagerMessages((prev) => prev + 1);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  const handleToggleDark = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (currentUser?.id) {
      supabase.from('profiles').update({ dark_mode: next === 'dark' }).eq('id', currentUser.id).then(() => {});
    }
  };

  const handleSwitchLang = async (lang: SupportedLang) => {
    await switchLanguage(lang);
    setCurrentLang(lang);
    setShowLangPicker(false);
    setShowUserMenu(false);
    if (currentUser?.id) {
      supabase.from('profiles').update({ language_preference: lang }).eq('id', currentUser.id).then(() => {});
    }
  };

  const role = currentUser?.role as AppRole | undefined;
  const team = currentUser?.team as Team | undefined;
  const isOwner = isOwnerOrAdmin(role);
  const isAdmin = role === 'admin';
  const isPureOwner = role === 'owner';
  const isManager = isManagerOrAbove(role);
  const isChef = isChefOrAbove(role);
  const canManageContent = canEdit(role);

  // Browser notifications for high-severity incidents
  useEffect(() => {
    if (!isManager) return;
    if (knownIdsRef.current === null) { knownIdsRef.current = new Set(incidents.map((i) => i.id)); return; }
    const known = knownIdsRef.current;
    const brandNew = incidents.filter((i) => !known.has(i.id) && i.severity === 'high');
    brandNew.forEach((inc) => notify({ title: `${SEVERITY_EMOJI.high} Incident grave`, body: `${inc.type} · ${inc.location}`, tag: `incident-${inc.id}` }));
    incidents.forEach((i) => known.add(i.id));
  }, [incidents, isManager, notify]);

  if (!currentUser) return null;

  const allTasks = getTodayTasks(isManager ? undefined : currentUser.team);
  const overdueCount = allTasks.filter((t) => t.status === 'overdue').length;

  // ── Build tiles per role ──
  const buildTiles = (): Tile[] => {
    const menuTile: Tile = { id: 'menu', label: 'Menu du Jour', emoji: '🍽️', icon: <UtensilsCrossed className="w-5 h-5" />, color: 'bg-amber-50 dark:bg-amber-950/30', iconColor: 'text-amber-600 dark:text-amber-400' };

    const base: Tile[] = [
      { id: 'tasks',     label: t('nav.tasks'),    emoji: '📋', icon: <CheckCircle className="w-5 h-5" />, badge: overdueCount || undefined, color: 'bg-blue-50 dark:bg-blue-950/30', iconColor: 'text-blue-600 dark:text-blue-400' },
      { id: 'pointage',  label: t('nav.timeclock'),emoji: '⏱️', icon: <Clock className="w-5 h-5" />,       color: 'bg-cyan-50 dark:bg-cyan-950/30',     iconColor: 'text-cyan-600 dark:text-cyan-400' },
      { id: 'scores',    label: 'Mon Score',        emoji: '🏆', icon: <Trophy className="w-5 h-5" />,       color: 'bg-yellow-50 dark:bg-yellow-950/30', iconColor: 'text-yellow-600 dark:text-yellow-400' },
      { id: 'planning',  label: t('nav.planning'),  emoji: '📅', icon: <CalendarDays className="w-5 h-5" />, color: 'bg-indigo-50 dark:bg-indigo-950/30', iconColor: 'text-indigo-600 dark:text-indigo-400' },
      { id: 'orders',    label: 'Commandes',        emoji: '📦', icon: <ShoppingCart className="w-5 h-5" />, color: 'bg-orange-50 dark:bg-orange-950/30', iconColor: 'text-orange-600 dark:text-orange-400' },
      { id: 'chat',      label: 'Chat',             emoji: '💬', icon: <MessageSquare className="w-5 h-5" />, color: 'bg-violet-50 dark:bg-violet-950/30', iconColor: 'text-violet-600 dark:text-violet-400' },
      { id: 'sos',       label: 'Incidents',        emoji: '⚠️', icon: <AlertTriangle className="w-5 h-5" />, badge: unreadHighIncidents || undefined, color: 'bg-red-50 dark:bg-red-950/30', iconColor: 'text-red-600 dark:text-red-400' },
      menuTile,
    ];

    if (isChef && !isManager) {
      return [...base,
        { id: 'haccp',      label: 'HACCP',     emoji: '🌡️', icon: <Thermometer className="w-5 h-5" />, color: 'bg-teal-50 dark:bg-teal-950/30',    iconColor: 'text-teal-600 dark:text-teal-400' },
        { id: 'objectives', label: 'Objectifs', emoji: '🎯', icon: <Target className="w-5 h-5" />,      color: 'bg-emerald-50 dark:bg-emerald-950/30', iconColor: 'text-emerald-600 dark:text-emerald-400' },
      ];
    }

    if (isManager) {
      const tiles: Tile[] = [
        { id: 'tasks',      label: t('nav.tasks'),    emoji: '📋', icon: <CheckCircle className="w-5 h-5" />,    badge: overdueCount || undefined, color: 'bg-blue-50 dark:bg-blue-950/30',      iconColor: 'text-blue-600 dark:text-blue-400' },
        { id: 'planning',   label: t('nav.planning'), emoji: '📅', icon: <CalendarDays className="w-5 h-5" />,  color: 'bg-indigo-50 dark:bg-indigo-950/30',  iconColor: 'text-indigo-600 dark:text-indigo-400' },
        { id: 'pointage',   label: t('nav.timeclock'),emoji: '⏱️', icon: <Clock className="w-5 h-5" />,         color: 'bg-cyan-50 dark:bg-cyan-950/30',      iconColor: 'text-cyan-600 dark:text-cyan-400' },
        { id: 'orders',     label: 'Commandes',       emoji: '📦', icon: <ShoppingCart className="w-5 h-5" />,  color: 'bg-orange-50 dark:bg-orange-950/30',  iconColor: 'text-orange-600 dark:text-orange-400' },
        { id: 'stock',      label: 'Stock',           emoji: '📦', icon: <Package className="w-5 h-5" />,       color: 'bg-blue-50 dark:bg-blue-950/30',      iconColor: 'text-blue-600 dark:text-blue-400' },
        { id: 'haccp',      label: 'HACCP',           emoji: '🌡️', icon: <Thermometer className="w-5 h-5" />,   color: 'bg-teal-50 dark:bg-teal-950/30',      iconColor: 'text-teal-600 dark:text-teal-400' },
        { id: 'chat',       label: 'Chat',            emoji: '💬', icon: <MessageSquare className="w-5 h-5" />, color: 'bg-violet-50 dark:bg-violet-950/30',  iconColor: 'text-violet-600 dark:text-violet-400' },
        { id: 'sos',        label: 'Incidents',       emoji: '⚠️', icon: <AlertTriangle className="w-5 h-5" />, badge: unreadHighIncidents || undefined, color: 'bg-red-50 dark:bg-red-950/30', iconColor: 'text-red-600 dark:text-red-400' },
        { id: 'objectives', label: 'Objectifs',       emoji: '🎯', icon: <Target className="w-5 h-5" />,        color: 'bg-emerald-50 dark:bg-emerald-950/30', iconColor: 'text-emerald-600 dark:text-emerald-400' },
        { id: 'reports',    label: 'Rapports',        emoji: '📈', icon: <FileText className="w-5 h-5" />,      color: 'bg-slate-50 dark:bg-slate-950/30',    iconColor: 'text-slate-600 dark:text-slate-400' },
        menuTile,
      ];
      if (isOwner || isAdmin) {
        tiles.push(
          { id: 'catalogue',      label: 'Catalogue',    emoji: '📚', icon: <LayoutGrid className="w-5 h-5" />,   color: 'bg-pink-50 dark:bg-pink-950/30',       iconColor: 'text-pink-600 dark:text-pink-400' },
          { id: 'pins',           label: 'PINs',         emoji: '🔑', icon: <KeyRound className="w-5 h-5" />,     color: 'bg-gray-50 dark:bg-gray-950/30',        iconColor: 'text-gray-600 dark:text-gray-400' },
          { id: 'leaderboard',    label: 'Classement',   emoji: '🏆', icon: <Trophy className="w-5 h-5" />,       color: 'bg-yellow-50 dark:bg-yellow-950/30',    iconColor: 'text-yellow-600 dark:text-yellow-400' },
          { id: 'settings',       label: 'Paramètres',   emoji: '⚙️', icon: <Settings className="w-5 h-5" />,     color: 'bg-slate-50 dark:bg-slate-950/30',      iconColor: 'text-slate-600 dark:text-slate-400' },
          { id: 'timesheets_all', label: 'Pointages',    emoji: '⏱️', icon: <Clock className="w-5 h-5" />,        color: 'bg-cyan-50 dark:bg-cyan-950/30',         iconColor: 'text-cyan-600 dark:text-cyan-400' },
          { id: 'accounts',       label: 'Comptes',      emoji: '👤', icon: <User className="w-5 h-5" />,         color: 'bg-indigo-50 dark:bg-indigo-950/30',    iconColor: 'text-indigo-600 dark:text-indigo-400' },
          { id: 'rooms',          label: 'Salles',       emoji: '🏠', icon: <Home className="w-5 h-5" />,          color: 'bg-emerald-50 dark:bg-emerald-950/30',  iconColor: 'text-emerald-600 dark:text-emerald-400' },
        );
        // Admin/God only: Classes, Membres, Restaurants
        if (role === 'god' || role === 'admin') {
          tiles.push(
            { id: 'restaurants', label: 'Restaurants', emoji: '🏪', icon: <Store className="w-5 h-5" />,  color: 'bg-violet-50 dark:bg-violet-950/30', iconColor: 'text-violet-600 dark:text-violet-400' },
            { id: 'classes',     label: 'Classes',     emoji: '🎓', icon: <Shield className="w-5 h-5" />, color: 'bg-purple-50 dark:bg-purple-950/30', iconColor: 'text-purple-600 dark:text-purple-400' },
            { id: 'membres',     label: 'Membres',     emoji: '👥', icon: <Users className="w-5 h-5" />,  color: 'bg-blue-50 dark:bg-blue-950/30',     iconColor: 'text-blue-600 dark:text-blue-400' },
          );
        }
      }
      return tiles;
    }

    return base;
  };

  const tiles = buildTiles();

  // ── Bottom nav tabs (4 tabs — no Profile) ──
  const uniqueBottomNav = [
    { id: 'home'     as ModuleKey, label: t('nav.home'),      icon: <Home strokeWidth={2} className="w-6 h-6" /> },
    { id: 'tasks'    as ModuleKey, label: t('nav.tasks'),     icon: <CheckCircle strokeWidth={2} className="w-6 h-6" /> },
    { id: 'pointage' as ModuleKey, label: t('nav.timeclock'), icon: <Clock strokeWidth={2} className="w-6 h-6" /> },
    { id: 'planning' as ModuleKey, label: t('nav.planning'),  icon: <CalendarDays strokeWidth={2} className="w-6 h-6" /> },
  ] as const;

  // ── Render active module ──
  const renderModule = () => {
    switch (activeModule) {
      case 'home':      return <HomeScreen tiles={tiles} onSelect={setActiveModule} role={role} currentUser={currentUser} allTasks={allTasks} team={team} isManager={isManager} currentTime={currentTime} />;
      case 'tasks':     return <TasksModule role={role} team={team} isManager={isManager} onCreateTask={() => setShowCreateModal(true)} />;
      case 'chat':      return <MessagingModule />;
      case 'sos':       return <IncidentModule />;
      case 'orders':    return <OrdersModule canManage={canManageContent} isChef={isChef && !isManager} />;
      case 'timesheet': return <TimesheetView />;
      case 'objectives':return <ObjectivesModule canManage={isManager} />;
      case 'planning':  return isManager ? <PlanningModule /> : <StaffShiftsView />;
      case 'menu':      return <MenuModule />;
      case 'haccp':     return <HACCPModule canExport={isManager} canDelete={isOwner} />;
      case 'scores':    return <MonScore />;
      case 'leaderboard': return <Leaderboard />;
      case 'reports':   return <ReportsView />;
      case 'stock':     return <StockModule />;
      case 'catalogue': return <ProductCatalogue />;
      case 'pins':      return <PinManagement />;
      case 'settings':  return <OwnerSettings />;
      case 'accounts':  return <AccountManagement />;
      case 'classes':   return <ClassesModule />;
      case 'membres':   return <MembresModule />;
      case 'rooms':     return <RoomManagement />;
      case 'restaurants': return <RestaurantManagement />;
      case 'contests':  return <MalusContestModule />;
      case 'swaps':     return <ShiftSwapModule />;
      case 'availability': return <StaffAvailabilityView />;
      case 'timesheets_all': return <TimesheetView />;
      case 'pointage':  return <PointagePage />;
      case 'profile':   return <ProfilPage />;
      default:          return null;
    }
  };

  const moduleTitle: Partial<Record<ModuleKey, string>> = {
    home: restaurantName,
    tasks: t('nav.tasks'), chat: 'Messages', sos: 'Incidents SOS', orders: 'Commandes',
    menu: 'Menu du Jour', haccp: 'HACCP', scores: 'Classement', reports: 'Rapports', stock: 'Stock',
    planning: t('nav.planning'), objectives: 'Objectifs', catalogue: 'Catalogue', pins: 'PINs',
    settings: 'Paramètres', leaderboard: 'Classement', contests: 'Contestations', accounts: 'Gestion des comptes',
    rooms: 'Gestion des salles', restaurants: 'Restaurants',
    classes: 'Classes & Privilèges', membres: 'Gestion des Membres',
    swaps: 'Échanges de shifts', availability: 'Disponibilités', timesheets_all: 'Pointages',
    pointage: t('nav.timeclock'), profile: t('profile.title'),
  };

  const timeStr = currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <GodBanner />

      {/* ══════════════════ HEADER ══════════════════ */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-card/80 backdrop-blur-md border-b border-border h-14">
        <div className="max-w-2xl mx-auto h-full flex items-center justify-between px-4">

          {/* Logo + name */}
          <div className="flex items-center gap-2">
            <img src={logo} alt="Logo" className="h-[34px] w-auto object-contain dark:hidden" />
            <img src={logoDark} alt="Logo" className="h-[34px] w-auto object-contain hidden dark:block" />
            <span className="text-sm font-bold text-foreground hidden sm:inline">{restaurantName}</span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">

          {/* Realtime indicator */}
            {(realtimeStatus as string) === 'CLOSED' && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <WifiOff className="w-3.5 h-3.5" /> Hors ligne
              </span>
            )}

            {/* Browser notif — affiché uniquement dans le menu (pas ici) */}

            {/* Mail: unread manager messages (managers/owner/god only) */}
            {isManager && (
              <button
                onClick={() => {
                  setActiveModule('chat');
                  setUnreadManagerMessages(0);
                  try { localStorage.setItem('last_chat_managers_open', new Date().toISOString()); } catch {}
                }}
                title="Messages équipe managers"
                className="relative p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <Mail className={`w-4 h-4 ${unreadManagerMessages > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                {unreadManagerMessages > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-destructive" />
                )}
              </button>
            )}

            {/* Clock */}
            <span className="text-xs font-mono text-muted-foreground hidden sm:inline">{timeStr}</span>

            {/* Notification bell (in-app) */}
            <NotificationBell />

            {/* Avatar + enriched dropdown menu */}
            <div className="relative">
              <button
                onClick={() => { setShowUserMenu((v) => !v); setShowLangPicker(false); }}
                className="flex items-center gap-1.5"
              >
                {currentUser.photo ? (
                  <img src={currentUser.photo} alt={currentUser.name} className="w-[34px] h-[34px] rounded-full object-cover border-2 border-border" />
                ) : (
                  <InitialsAvatar name={currentUser.name} />
                )}
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 bg-card rounded-2xl py-1.5 min-w-[230px] z-50 shadow-2xl border border-border animate-slide-up overflow-hidden">

                  {/* User info header */}
                  <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                    {currentUser.photo ? (
                      <img src={currentUser.photo} alt={currentUser.name} className="w-10 h-10 rounded-full object-cover border border-border flex-shrink-0" />
                    ) : (
                      <InitialsAvatar name={currentUser.name} size="lg" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{currentUser.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {TEAM_LABELS[currentUser.team as Team] ?? currentUser.team} · {getRoleLabel(role)}
                      </p>
                    </div>
                  </div>

                  {/* Mon Profil */}
                  <button
                    onClick={() => { setActiveModule('profile'); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-foreground hover:bg-muted transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-muted-foreground" /> {t('menu.my_profile')}
                  </button>

                  {/* Langue */}
                  <div>
                    <button
                      onClick={() => setShowLangPicker((v) => !v)}
                      className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-xs text-foreground hover:bg-muted transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <Globe className="w-3.5 h-3.5 text-muted-foreground" /> {t('menu.language')}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground text-xs">
                        {LANG_META[currentLang].flag} {LANG_META[currentLang].label}
                        <ChevronDown className="w-3 h-3" />
                      </span>
                    </button>
                    {showLangPicker && (
                      <div className="bg-muted/40 border-y border-border py-1 max-h-48 overflow-y-auto">
                        {(Object.entries(LANG_META) as [SupportedLang, { flag: string; label: string }][]).map(([code, { flag, label }]) => (
                          <button key={code} onClick={() => handleSwitchLang(code)}
                            className={`w-full flex items-center gap-2.5 px-6 py-2 text-xs transition-colors ${currentLang === code ? 'text-primary font-semibold bg-primary/5' : 'text-foreground hover:bg-muted'}`}>
                            <span>{flag}</span> {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mode sombre */}
                  <button onClick={handleToggleDark}
                    className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-xs text-foreground hover:bg-muted transition-colors">
                    <span className="flex items-center gap-2.5">
                      {theme === 'dark'
                        ? <Moon className="w-3.5 h-3.5 text-muted-foreground" />
                        : <Sun className="w-3.5 h-3.5 text-muted-foreground" />}
                      {t('menu.dark_mode')}
                    </span>
                    <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${theme === 'dark' ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </button>

                  {/* Notifications push — toggle */}
                  {isSupported && (
                    <button
                      onClick={async () => {
                        if (permission !== 'granted') {
                          await requestPermission();
                        } else {
                          // Can't revoke programmatically — inform user
                          alert('Pour désactiver, modifiez les paramètres de votre navigateur.');
                        }
                      }}
                      className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-xs text-foreground hover:bg-muted transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        {permission === 'granted'
                          ? <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                          : <BellOff className="w-3.5 h-3.5 text-muted-foreground" />
                        }
                        {t('menu.notifications')}
                      </span>
                      <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${permission === 'granted' ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${permission === 'granted' ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  )}

                  {/* Divider */}
                  <div className="border-t border-border my-1" />

                  {/* Changer d'utilisateur */}
                  <button onClick={() => { logout(); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" /> {t('menu.change_user')}
                  </button>

                  {/* Déconnecter */}
                  <button onClick={() => { signOut(); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-destructive hover:bg-destructive/10 transition-colors font-medium">
                    <LogOut className="w-3.5 h-3.5" /> {t('menu.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── BREADCRUMB for sub-modules ── */}
      {activeModule !== 'home' && (
        <div className="fixed top-14 left-0 right-0 z-30 bg-card/60 backdrop-blur-sm border-b border-border/50 px-4 py-1.5">
          <div className="max-w-2xl mx-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <button onClick={() => setActiveModule('home')} className="hover:text-foreground transition-colors flex items-center gap-1">
              <Home className="w-3 h-3" />
              <span>Accueil</span>
            </button>
            <span className="opacity-40">›</span>
            <span className="text-foreground font-medium">{moduleTitle[activeModule]}</span>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main className={`flex-1 max-w-2xl mx-auto w-full ${activeModule !== 'home' ? 'pt-24' : 'pt-14'} pb-20`}>
        {renderModule()}
      </main>

      {/* ══════════════════ BOTTOM NAV (4 tabs) ══════════════════ */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4px)', minHeight: '64px' }}
      >
        <div className="max-w-2xl mx-auto flex items-stretch justify-around pt-1">
          {uniqueBottomNav.map((item) => {
            const navActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 min-h-[52px] transition-all ${navActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${navActive ? 'bg-primary/10' : ''}`}>
                  {item.icon}
                </div>
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {showCreateModal && <CreateTaskModal onClose={() => setShowCreateModal(false)} />}
      <ToastNotification />
      {showUserMenu && <div className="fixed inset-0 z-30" onClick={() => { setShowUserMenu(false); setShowLangPicker(false); }} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HomeScreen
// ══════════════════════════════════════════════════════════════════════════════

interface RoomInfo { id: string; name: string; team_key: string; }

function TeamsBlock({ currentUser }: { currentUser: any }) {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [assignedTeams, setAssignedTeams] = useState<string[]>([]);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  useEffect(() => {
    supabase.from('rooms').select('id, name, team_key').order('display_order').then(({ data }) => { if (data) setRooms(data); });
    supabase.from('profile_teams').select('team').eq('profile_id', currentUser.id).then(({ data }) => {
      if (data && data.length > 0) setAssignedTeams(data.map((r: any) => r.team));
      else setAssignedTeams([currentUser.team]);
    });
  }, [currentUser.id]);

  const getTeamName = (teamKey: string) => {
    const room = rooms.find(r => r.team_key === teamKey);
    return room?.name || TEAM_LABELS[teamKey] || teamKey;
  };

  const saveTeamName = async () => {
    if (!editingTeam || !editName.trim()) return;
    setNameSaving(true);
    const room = rooms.find(r => r.team_key === editingTeam);
    if (room) {
      await supabase.from('rooms').update({ name: editName.trim() }).eq('id', room.id);
      setRooms(prev => prev.map(r => r.id === room.id ? { ...r, name: editName.trim() } : r));
    }
    setNameSaving(false);
    setEditingTeam(null);
  };

  const displayedTeams = rooms.length > 0
    ? rooms.map(r => r.team_key)
    : ['BAR', 'KITCHEN', 'FLOOR', 'ATELIER', 'MANAGEMENT'];

  return (
    <>
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wide">Équipes</span>
        </div>
        <div className="p-3 grid grid-cols-2 gap-2">
          {displayedTeams.map(teamKey => {
            const active = assignedTeams.includes(teamKey);
            return (
              <div key={teamKey} className={`flex items-center rounded-xl border transition-all overflow-hidden ${
                active ? 'border-primary/40 bg-primary/5' : 'border-border bg-secondary/40'
              }`}>
                <div className="flex items-center gap-2 px-3 py-2.5 flex-1 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? 'bg-primary' : 'bg-border'}`} />
                  <p className={`text-xs font-semibold truncate ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {getTeamName(teamKey)}
                  </p>
                </div>
                <button
                  onClick={() => { setEditingTeam(teamKey); setEditName(getTeamName(teamKey)); }}
                  className="px-2 py-2.5 flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  title="Renommer"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {editingTeam && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">Renommer l'équipe</h3>
              <button onClick={() => setEditingTeam(null)} className="p-1 rounded-lg hover:bg-secondary">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveTeamName(); if (e.key === 'Escape') setEditingTeam(null); }}
              className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setEditingTeam(null)} className="flex-1 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-secondary">Annuler</button>
              <button
                onClick={saveTeamName}
                disabled={nameSaving || !editName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {nameSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function HomeScreen({ tiles, onSelect, role, currentUser, allTasks, team, isManager, currentTime }: {
  tiles: Tile[];
  onSelect: (id: ModuleKey) => void;
  role?: AppRole;
  currentUser: NonNullable<ReturnType<typeof useApp>['currentUser']>;
  allTasks: ReturnType<typeof useApp>['getTodayTasks'] extends (...a: any[]) => infer R ? R : never;
  team?: Team;
  isManager: boolean;
  currentTime: Date;
}) {
  const { t } = useTranslation();
  const dateStr = currentTime.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const done = allTasks.filter((t) => t.status === 'done').length;
  const total = allTasks.length;

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      {/* Greeting */}
      <div>
        <p className="text-xs text-muted-foreground capitalize">{dateStr}</p>
        <h1 className="text-xl font-black text-foreground mt-0.5">
          Bonjour, {currentUser.name.split(' ')[0]} 👋
        </h1>
        {total > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {done}/{total} tâches complétées
          </p>
        )}
      </div>

      {/* Tiles grid */}
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((tile) => <ModuleTile key={tile.id} tile={tile} onSelect={onSelect} />)}
      </div>

      {/* Teams block */}
      <TeamsBlock currentUser={currentUser} />
    </div>
  );
}

function ModuleTile({ tile, onSelect }: { tile: Tile; onSelect: (id: ModuleKey) => void }) {
  return (
    <button
      onClick={() => onSelect(tile.id)}
      className={`relative flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border border-border/50 ${tile.color} hover:scale-105 active:scale-95 transition-all duration-150 aspect-square`}
    >
      {tile.badge && tile.badge > 0 ? (
        <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-destructive text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
          {tile.badge > 9 ? '9+' : tile.badge}
        </span>
      ) : null}
      <span className={tile.iconColor}>{tile.icon}</span>
      <span className="text-[10px] font-semibold text-foreground/80 text-center leading-tight">{tile.label}</span>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TasksModule (inline list)
// ══════════════════════════════════════════════════════════════════════════════
function TasksModule({ role, team, isManager, onCreateTask }: {
  role?: AppRole;
  team?: Team;
  isManager: boolean;
  onCreateTask: () => void;
}) {
  const { getTodayTasks } = useApp();
  const tasks = getTodayTasks(isManager ? undefined : team);
  return (
    <div className="px-4 pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">Tâches du jour</h2>
        {isManager && (
          <button onClick={onCreateTask}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity">
            <Plus className="w-3.5 h-3.5" /> Nouvelle
          </button>
        )}
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucune tâche pour aujourd'hui 🎉</p>
      ) : (
        tasks.map((task) => <TaskCard key={task.id} task={task} />)
      )}
    </div>
  );
}
