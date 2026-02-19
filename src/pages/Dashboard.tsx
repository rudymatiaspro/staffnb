import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ToastNotification } from '../components/ui/ToastNotification';
import { useBrowserNotifications } from '../hooks/useBrowserNotifications';
import { NotificationBell } from '../components/notifications/NotificationBell';

// Module imports
import { TaskCard } from '../components/tasks/TaskCard';
import { BonusScoreCard } from '../components/zones/BonusScoreCard';
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
import { OwnerSettings } from '../components/dashboard/OwnerSettings';
import { ShiftSwapModule } from '../components/planning/ShiftSwapModule';
import { StaffShiftsView } from '../components/planning/StaffShiftsView';
import { StaffAvailabilityView } from '../components/planning/AvailabilityModule';
import { MenuModule } from '../components/menu/MenuModule';

import {
  LogOut, Bell, WifiOff, BellOff, Sun, Moon, ChevronDown, Settings, AlertOctagon,
  CheckCircle, MessageSquare, AlertTriangle, ShoppingCart, Clock, Target,
  CalendarDays, Thermometer, ChefHat, Home, User, LayoutGrid, Package,
  FileText, KeyRound, Trophy, Activity, ArrowLeftRight, CalendarCheck, Star,
  ChevronUp, Award,
} from 'lucide-react';
import logo from '../assets/logo.svg';
import { TEAM_CSS, TEAM_LABELS } from '../data/initialData';
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
// Owner = lecture seule (Hanh). Admin = accès complet en écriture (Rudy).
function canEdit(role?: AppRole) { return role === 'admin' || role === 'manager'; }

const SEVERITY_EMOJI: Record<Incident['severity'], string> = { high: '🚨', medium: '⚠️', low: 'ℹ️' };

// ─── Tile definition ──────────────────────────────────────────────────────────
type ModuleKey =
  | 'home' | 'tasks' | 'chat' | 'sos' | 'orders' | 'timesheet' | 'objectives'
  | 'planning' | 'menu' | 'haccp' | 'scores' | 'reports' | 'catalogue' | 'pins'
  | 'settings' | 'contests' | 'swaps' | 'availability' | 'timesheets_all';

interface Tile {
  id: ModuleKey;
  label: string;
  emoji: string;
  icon: React.ReactNode;
  badge?: number;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { currentUser, logout, restaurantName, getTodayTasks, realtimeStatus, unreadHighIncidents, incidents, clearIncidentBadge } = useApp();
  const { signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleKey>('home');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { permission, isSupported, requestPermission, notify } = useBrowserNotifications();
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);
  const knownIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => { applyTheme(theme); }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const role = currentUser?.role as AppRole | undefined;
  const team = currentUser?.team as Team | undefined;
  const isOwner = isOwnerOrAdmin(role);          // owner OR admin (both see Settings tile)
  const isAdmin = role === 'admin';              // Rudy only — full write access
  const isPureOwner = role === 'owner';          // Hanh — read-only
  const isManager = isManagerOrAbove(role);
  const isChef = isChefOrAbove(role);
  const canManageContent = canEdit(role);        // admin + manager can write

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
    const base: Tile[] = [
      { id: 'tasks',     label: 'Tâches',    emoji: '✅', icon: <CheckCircle className="w-6 h-6" />, badge: overdueCount || undefined },
      { id: 'chat',      label: 'Chat',       emoji: '💬', icon: <MessageSquare className="w-6 h-6" /> },
      { id: 'sos',       label: 'SOS',        emoji: '🚨', icon: <AlertTriangle className="w-6 h-6" />, badge: unreadHighIncidents || undefined },
      { id: 'orders',    label: 'Commandes',  emoji: '🛒', icon: <ShoppingCart className="w-6 h-6" /> },
      { id: 'timesheet', label: 'Pointage',   emoji: '🕐', icon: <Clock className="w-6 h-6" /> },
      { id: 'objectives',label: 'Objectifs',  emoji: '🎯', icon: <Target className="w-6 h-6" /> },
    ];

    if (isChef && !isManager) {
      // Chef / Sous-Chef → grille cuisine + HACCP
      return [...base,
        { id: 'haccp',    label: 'HACCP',   emoji: '🌡️', icon: <Thermometer className="w-6 h-6" /> },
        { id: 'menu',     label: 'Menu',     emoji: '🍽️', icon: <ChefHat className="w-6 h-6" /> },
      ];
    }

    if (isManager) {
      // Manager / Admin / Owner
      const menuLabel = canManageContent ? 'Menu ✏️' : 'Menu';
      const mgr: Tile[] = [...base,
        { id: 'planning', label: 'Planning',  emoji: '📅', icon: <CalendarDays className="w-6 h-6" /> },
        { id: 'menu',     label: menuLabel,   emoji: '🍽️', icon: <ChefHat className="w-6 h-6" /> },
      ];
      // Settings tile: visible to admin (Rudy) and owner (Hanh)
      if (isOwner) mgr.push({ id: 'settings', label: 'Paramètres', emoji: '⚙️', icon: <Settings className="w-6 h-6" /> });
      return mgr;
    }

    // Staff Salle → grille salle
    return [...base,
      { id: 'planning', label: 'Planning', emoji: '📅', icon: <CalendarDays className="w-6 h-6" /> },
      { id: 'menu',     label: 'Menu',     emoji: '🍽️', icon: <ChefHat className="w-6 h-6" /> },
    ];
  };

  const tiles = buildTiles();

  // ── Bottom nav tabs ──
  const bottomNav: { id: ModuleKey; label: string; icon: React.ReactNode }[] = [
    { id: 'home',     label: 'Accueil', icon: <Home className="w-5 h-5" /> },
    { id: 'chat',     label: 'Chat',    icon: <MessageSquare className="w-5 h-5" /> },
    { id: 'planning', label: 'Planning',icon: <CalendarDays className="w-5 h-5" /> },
    { id: 'timesheet',label: 'Profil',  icon: <User className="w-5 h-5" /> },
  ];

  // ── Render active module ──
  const renderModule = () => {
    switch (activeModule) {
      case 'home': return <HomeGrid tiles={tiles} onSelect={setActiveModule} role={role} />;
      case 'tasks': return <TasksModule role={role} team={team} isManager={isManager} onCreateTask={() => setShowCreateModal(true)} />;
      case 'chat': return <MessagingModule />;
      case 'sos': return <IncidentModule />;
      case 'orders':    return <OrdersModule canManage={canManageContent} />;
      case 'timesheet': return currentUser ? <TimesheetView userId={currentUser.id} /> : null;
      case 'objectives':return <ObjectivesModule canManage={canManageContent} />;
      case 'planning':  return canManageContent ? <PlanningModule /> : <StaffShiftsView />;
      case 'menu':      return <MenuModule canEdit={canManageContent} />;
      case 'haccp':     return <HACCPModule />;
      case 'scores':    return <Leaderboard />;
      case 'reports':   return <ReportsView />;
      case 'catalogue': return <ProductCatalogue canEdit={canManageContent} canDelete={isAdmin} />;
      case 'pins':      return <PinManagement />;
      case 'settings':  return <OwnerSettings readOnly={isPureOwner} />;
      case 'contests': return <MalusContestModule />;
      case 'swaps': return <ShiftSwapModule canManage={isManager} />;
      case 'availability': return <StaffAvailabilityView />;
      default: return <HomeGrid tiles={tiles} onSelect={setActiveModule} role={role} />;
    }
  };

  const moduleTitle: Partial<Record<ModuleKey, string>> = {
    home: restaurantName,
    tasks: 'Tâches', chat: 'Messages', sos: 'Incidents SOS', orders: 'Commandes',
    timesheet: 'Mon Pointage', objectives: 'Objectifs', planning: 'Planning',
    menu: 'Menu du Jour', haccp: 'HACCP', scores: 'Classement', reports: 'Rapports',
    catalogue: 'Catalogue', pins: 'Gestion des PINs', settings: 'Paramètres',
    contests: 'Contestations', swaps: 'Échanges de shifts', availability: 'Disponibilités',
  };

  const showNotifPrompt = isManager && isSupported && permission === 'default';
  const notifBlocked = isManager && isSupported && permission === 'denied';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={() => setActiveModule('home')}
            className="flex items-center gap-2.5"
          >
            <img src={logo} alt="Staff&B" className="h-7" />
          </button>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button onClick={toggleTheme} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Realtime dot */}
            {realtimeStatus === 'connected' ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[hsl(var(--timer-safe)/0.1)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--timer-safe))] animate-pulse" />
                <span className="text-[10px] text-[hsl(var(--timer-safe))] font-medium hidden sm:inline">live</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[hsl(var(--timer-warning)/0.1)]">
                <WifiOff className="w-3 h-3 text-[hsl(var(--timer-warning))]" />
              </div>
            )}

            {showNotifPrompt && (
              <button onClick={requestPermission} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors">
                <Bell className="w-3.5 h-3.5" />
              </button>
            )}
            {notifBlocked && <div className="p-1.5"><BellOff className="w-3.5 h-3.5 text-muted-foreground" /></div>}

            {isManager && unreadHighIncidents > 0 && (
              <button onClick={() => { clearIncidentBadge(); setActiveModule('sos'); }} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive animate-pulse">
                <AlertOctagon className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">{unreadHighIncidents}</span>
              </button>
            )}

            <NotificationBell />

            {/* User menu */}
            <div className="relative">
              <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted transition-colors">
                <span className="text-xs font-medium text-foreground max-w-[80px] truncate">{currentUser.name}</span>
                <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 glass-card rounded-xl py-1 min-w-[180px] z-50 shadow-2xl animate-slide-up border border-border">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-bold text-foreground">{currentUser.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{TEAM_LABELS[currentUser.team]} · {role}</p>
                  </div>
                  {isManager && (
                    <>
                      <button onClick={() => { setActiveModule('scores'); setShowUserMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Trophy className="w-3.5 h-3.5" /> Classement
                      </button>
                      <button onClick={() => { setActiveModule('reports'); setShowUserMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <FileText className="w-3.5 h-3.5" /> Rapports
                      </button>
                      <button onClick={() => { setActiveModule('catalogue'); setShowUserMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Package className="w-3.5 h-3.5" /> Catalogue
                      </button>
                      <button onClick={() => { setActiveModule('pins'); setShowUserMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <KeyRound className="w-3.5 h-3.5" /> PINs
                      </button>
                      <button onClick={() => { setActiveModule('contests'); setShowUserMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Activity className="w-3.5 h-3.5" /> Contestations
                      </button>
                    </>
                  )}
                  <button onClick={() => { logout(); setShowUserMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border-t border-border mt-1">
                    <LogOut className="w-3.5 h-3.5" /> Changer d'utilisateur
                  </button>
                  <button onClick={() => { signOut(); setShowUserMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-destructive hover:bg-destructive/10 transition-colors">
                    <LogOut className="w-3.5 h-3.5" /> Se déconnecter
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── BREADCRUMB / MODULE TITLE ── */}
      {activeModule !== 'home' && (
        <div className="max-w-2xl mx-auto w-full px-4 pt-4 pb-0">
          <button onClick={() => setActiveModule('home')} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3">
            <Home className="w-3.5 h-3.5" />
            <span>Accueil</span>
            <span className="text-muted-foreground/40">›</span>
            <span className="text-foreground font-medium">{moduleTitle[activeModule]}</span>
          </button>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 pb-24">
        {renderModule()}
      </main>

      {/* ── BOTTOM NAV (mobile-first) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t border-border safe-bottom">
        <div className="max-w-2xl mx-auto flex items-center justify-around px-2">
          {bottomNav.map((item) => {
            const isActive = activeModule === item.id || (item.id === 'home' && activeModule === 'home');
            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id)}
                className={`flex flex-col items-center gap-0.5 px-4 py-3 rounded-xl transition-all ${
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.icon}
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals */}
      {showCreateModal && <CreateTaskModal onClose={() => setShowCreateModal(false)} />}

      {/* Toast */}
      <ToastNotification />

      {/* Overlay for user menu */}
      {showUserMenu && <div className="fixed inset-0 z-30" onClick={() => setShowUserMenu(false)} />}
    </div>
  );
}

// ─── HOME GRID ────────────────────────────────────────────────────────────────
function HomeGrid({
  tiles,
  onSelect,
  role,
}: {
  tiles: Tile[];
  onSelect: (id: ModuleKey) => void;
  role?: AppRole;
}) {
  const TILE_COLORS: Record<ModuleKey, string> = {
    tasks:      'from-blue-500/20 to-blue-600/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
    chat:       'from-violet-500/20 to-violet-600/10 border-violet-500/20 text-violet-600 dark:text-violet-400',
    sos:        'from-red-500/20 to-red-600/10 border-red-500/20 text-red-600 dark:text-red-400',
    orders:     'from-orange-500/20 to-orange-600/10 border-orange-500/20 text-orange-600 dark:text-orange-400',
    timesheet:  'from-cyan-500/20 to-cyan-600/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400',
    objectives: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    planning:   'from-indigo-500/20 to-indigo-600/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400',
    menu:       'from-amber-500/20 to-amber-600/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
    haccp:      'from-teal-500/20 to-teal-600/10 border-teal-500/20 text-teal-600 dark:text-teal-400',
    scores:     'from-yellow-500/20 to-yellow-600/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400',
    reports:    'from-slate-500/20 to-slate-600/10 border-slate-500/20 text-slate-600 dark:text-slate-400',
    catalogue:  'from-pink-500/20 to-pink-600/10 border-pink-500/20 text-pink-600 dark:text-pink-400',
    pins:       'from-gray-500/20 to-gray-600/10 border-gray-500/20 text-gray-600 dark:text-gray-400',
    settings:   'from-purple-500/20 to-purple-600/10 border-purple-500/20 text-purple-600 dark:text-purple-400',
    contests:   'from-rose-500/20 to-rose-600/10 border-rose-500/20 text-rose-600 dark:text-rose-400',
    swaps:      'from-sky-500/20 to-sky-600/10 border-sky-500/20 text-sky-600 dark:text-sky-400',
    availability:'from-lime-500/20 to-lime-600/10 border-lime-500/20 text-lime-600 dark:text-lime-400',
    timesheets_all: 'from-slate-500/20 to-slate-600/10 border-slate-500/20 text-slate-600 dark:text-slate-400',
    home: 'from-primary/20 to-primary/10 border-primary/20 text-primary',
  };

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Bonjour' : now.getHours() < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-black text-foreground">{greeting} 👋</h1>
        <p className="text-sm text-muted-foreground mt-1 capitalize">
          {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Tile grid — 2 columns, thumb-friendly */}
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            onClick={() => onSelect(tile.id)}
            className={`relative flex flex-col items-start gap-3 p-4 rounded-2xl border bg-gradient-to-br ${TILE_COLORS[tile.id]} transition-all active:scale-95 hover:shadow-md min-h-[100px]`}
          >
            {/* Badge */}
            {tile.badge && tile.badge > 0 && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-destructive flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{tile.badge}</span>
              </div>
            )}
            <div className="opacity-80">{tile.icon}</div>
            <span className="text-sm font-semibold text-foreground">{tile.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── TASKS MODULE (inline for staff/manager) ──────────────────────────────────
function TasksModule({ role, team, isManager, onCreateTask }: { role?: AppRole; team?: Team; isManager: boolean; onCreateTask: () => void }) {
  const { getTodayTasks, deleteTask } = useApp();
  const [showDone, setShowDone] = useState(false);

  const allTasks = getTodayTasks(isManager ? undefined : team);
  const overdue = allTasks.filter((t) => t.status === 'overdue').sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  const pending = allTasks.filter((t) => t.status === 'pending').sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  const done = allTasks.filter((t) => t.status === 'done');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-2 flex-1">
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-destructive">{overdue.length}</p>
            <p className="text-xs text-muted-foreground">En retard</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-primary">{pending.length}</p>
            <p className="text-xs text-muted-foreground">À faire</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-[hsl(var(--timer-safe))]">{done.length}</p>
            <p className="text-xs text-muted-foreground">Faites</p>
          </div>
        </div>
        {isManager && (
          <button onClick={onCreateTask} className="ml-3 p-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex-shrink-0">
            <LayoutGrid className="w-4 h-4" />
          </button>
        )}
      </div>

      {overdue.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <h2 className="text-sm font-bold text-destructive uppercase tracking-wide">En retard ({overdue.length})</h2>
          </div>
          <div className="space-y-3">{overdue.map((t) => <TaskCard key={t.id} task={t} canComplete />)}</div>
        </section>
      )}

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">À faire</h2>
          {pending.length > 0 && <span className="ml-auto text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full">{pending.length}</span>}
        </div>
        {pending.length === 0 && overdue.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-foreground">Tout est bon !</p>
          </div>
        ) : (
          <div className="space-y-3">{pending.map((t) => <TaskCard key={t.id} task={t} canComplete onDelete={isManager ? () => deleteTask(t.id) : undefined} />)}</div>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <button onClick={() => setShowDone(!showDone)} className="w-full flex items-center justify-between gap-2 mb-3 group">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-[hsl(var(--timer-safe))]" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Complétées</h2>
              <span className="text-xs bg-[hsl(var(--timer-safe)/0.1)] text-[hsl(var(--timer-safe))] px-2 py-0.5 rounded-full">{done.length}</span>
            </div>
            {showDone ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showDone && <div className="space-y-2 animate-slide-up">{done.map((t) => <TaskCard key={t.id} task={t} canComplete={false} />)}</div>}
        </section>
      )}
    </div>
  );
}
