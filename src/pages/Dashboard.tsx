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
import { ShiftSwapModule } from '../components/planning/ShiftSwapModule';
import { StaffShiftsView } from '../components/planning/StaffShiftsView';
import { StaffAvailabilityView } from '../components/planning/AvailabilityModule';
import { MenuModule } from '../components/menu/MenuModule';
import PointagePage from './Pointage';
import ProfilPage from './Profil';
import { StockModule } from '../components/stock/StockModule';

import {
  LogOut, WifiOff, BellOff, Bell,
  CheckCircle, MessageSquare, AlertTriangle, ShoppingCart, Clock, Target,
  CalendarDays, Thermometer, ChefHat, Home, User, Package,
  FileText, KeyRound, Trophy, Activity, UtensilsCrossed,
  Star, ChevronDown, ChevronUp, LayoutGrid, AlertOctagon, Settings, Sun, Moon, Plus,
  Globe, RefreshCw,
} from 'lucide-react';
import logo from '../assets/logo.svg';
import { TEAM_LABELS } from '../data/initialData';
import type { Incident, Team } from '../types';

// ─── Dark mode ────────────────────────────────────────────────────────────────
function getInitialTheme(): 'dark' | 'light' {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {}
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme(theme: 'dark' | 'light') {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try { localStorage.setItem('theme', theme); } catch {}
}

// ─── Role helpers ─────────────────────────────────────────────────────────────
type AppRole = 'owner' | 'admin' | 'manager' | 'chef' | 'staff';

function isOwnerOrAdmin(role?: AppRole) { return role === 'owner' || role === 'admin'; }
function isManagerOrAbove(role?: AppRole) { return role === 'manager' || isOwnerOrAdmin(role); }
function isChefOrAbove(role?: AppRole) { return role === 'chef' || isManagerOrAbove(role); }
function canEdit(role?: AppRole) { return role === 'admin' || role === 'manager'; }

const SEVERITY_EMOJI: Record<Incident['severity'], string> = { high: '🚨', medium: '⚠️', low: 'ℹ️', critical: '🚨' };

// ─── Tile definition ──────────────────────────────────────────────────────────
type ModuleKey =
  | 'home' | 'tasks' | 'chat' | 'sos' | 'orders' | 'timesheet' | 'objectives'
  | 'planning' | 'menu' | 'haccp' | 'scores' | 'leaderboard' | 'reports' | 'catalogue' | 'pins'
  | 'settings' | 'contests' | 'swaps' | 'availability' | 'timesheets_all'
  | 'pointage' | 'profile' | 'stock';

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
    case 'owner':   return 'Propriétaire';
    case 'admin':   return 'Administrateur';
    case 'manager': return 'Manager';
    case 'chef':    return 'Chef';
    case 'staff':   return 'Équipier';
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

  useEffect(() => { applyTheme(theme); }, [theme]);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

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
      { id: 'chat',      label: 'Équipe',           emoji: '👥', icon: <MessageSquare className="w-5 h-5" />, color: 'bg-violet-50 dark:bg-violet-950/30', iconColor: 'text-violet-600 dark:text-violet-400' },
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
        { id: 'chat',       label: 'Équipe',          emoji: '👥', icon: <MessageSquare className="w-5 h-5" />, color: 'bg-violet-50 dark:bg-violet-950/30',  iconColor: 'text-violet-600 dark:text-violet-400' },
        { id: 'sos',        label: 'Incidents',       emoji: '⚠️', icon: <AlertTriangle className="w-5 h-5" />, badge: unreadHighIncidents || undefined, color: 'bg-red-50 dark:bg-red-950/30', iconColor: 'text-red-600 dark:text-red-400' },
        { id: 'objectives', label: 'Objectifs',       emoji: '🎯', icon: <Target className="w-5 h-5" />,        color: 'bg-emerald-50 dark:bg-emerald-950/30', iconColor: 'text-emerald-600 dark:text-emerald-400' },
        { id: 'reports',    label: 'Rapports',        emoji: '📈', icon: <FileText className="w-5 h-5" />,      color: 'bg-slate-50 dark:bg-slate-950/30',    iconColor: 'text-slate-600 dark:text-slate-400' },
        menuTile,
      ];
      if (isOwner || isAdmin) {
        tiles.push(
          { id: 'catalogue',    label: 'Catalogue',    emoji: '📚', icon: <LayoutGrid className="w-5 h-5" />,   color: 'bg-pink-50 dark:bg-pink-950/30',    iconColor: 'text-pink-600 dark:text-pink-400' },
          { id: 'pins',         label: 'PINs',         emoji: '🔑', icon: <KeyRound className="w-5 h-5" />,     color: 'bg-gray-50 dark:bg-gray-950/30',    iconColor: 'text-gray-600 dark:text-gray-400' },
          { id: 'leaderboard',  label: 'Classement',   emoji: '🏆', icon: <Trophy className="w-5 h-5" />,       color: 'bg-yellow-50 dark:bg-yellow-950/30', iconColor: 'text-yellow-600 dark:text-yellow-400' },
          { id: 'settings',     label: 'Paramètres',   emoji: '⚙️', icon: <Settings className="w-5 h-5" />,     color: 'bg-slate-50 dark:bg-slate-950/30',  iconColor: 'text-slate-600 dark:text-slate-400' },
          { id: 'timesheets_all', label: 'Pointages',  emoji: '⏱️', icon: <Clock className="w-5 h-5" />,         color: 'bg-cyan-50 dark:bg-cyan-950/30',    iconColor: 'text-cyan-600 dark:text-cyan-400' },
        );
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
      case 'objectives':return <ObjectivesModule />;
      case 'planning':  return isManager ? <PlanningModule /> : <StaffShiftsView />;
      case 'menu':      return <MenuModule />;
      case 'haccp':     return <HACCPModule />;
      case 'scores':    return <MonScore />;
      case 'leaderboard': return <Leaderboard />;
      case 'reports':   return <ReportsView />;
      case 'stock':     return <StockModule />;
      case 'catalogue': return <ProductCatalogue />;
      case 'pins':      return <PinManagement />;
      case 'settings':  return <OwnerSettings />;
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
    settings: 'Paramètres', leaderboard: 'Classement', contests: 'Contestations',
    swaps: 'Échanges de shifts', availability: 'Disponibilités', timesheets_all: 'Pointages',
    pointage: t('nav.timeclock'), profile: t('profile.title'),
  };

  const timeStr = currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ══════════════════ HEADER ══════════════════ */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-card/80 backdrop-blur-md border-b border-border h-14">
        <div className="max-w-2xl mx-auto h-full flex items-center justify-between px-4">

          {/* Logo + name */}
          <div className="flex items-center gap-2">
            <img src={logo} alt="Logo" className="w-6 h-6" />
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

            {/* Notif permission */}
            {isSupported && permission === 'default' && (
              <button onClick={requestPermission} title="Activer les notifications"
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                <BellOff className="w-4 h-4" />
              </button>
            )}

            {/* Clock */}
            <span className="text-xs font-mono text-muted-foreground hidden sm:inline">{timeStr}</span>

            {/* Notification bell */}
            <NotificationBell />

            {/* Avatar + enriched dropdown menu */}
            <div className="relative">
              <button
                onClick={() => { setShowUserMenu((v) => !v); setShowLangPicker(false); }}
                className="flex items-center gap-1.5"
              >
                {currentUser.photo ? (
                  <img src={currentUser.photo} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover border-2 border-border" />
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

                  {/* Notifications */}
                  <button onClick={() => setShowUserMenu(false)}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-foreground hover:bg-muted transition-colors">
                    <Bell className="w-3.5 h-3.5 text-muted-foreground" /> {t('menu.notifications')}
                  </button>

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
