import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ToastNotification } from '../components/ui/ToastNotification';
import { useBrowserNotifications } from '../hooks/useBrowserNotifications';
import { NotificationBell } from '../components/notifications/NotificationBell';

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
  color: string;      // icon bg pastel
  iconColor: string;  // icon color
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
function InitialsAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-gradient-to-br from-primary to-accent text-primary-foreground">
      {initials}
    </div>
  );
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
  const [currentTime, setCurrentTime] = useState(new Date());
  const knownIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => { applyTheme(theme); }, [theme]);
  // Live clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

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
    // Tuile Menu du Jour commune
    const menuTile: Tile = { id: 'menu', label: 'Menu du Jour', emoji: '🍽️', icon: <UtensilsCrossed className="w-5 h-5" />, color: 'bg-amber-50 dark:bg-amber-950/30', iconColor: 'text-amber-600 dark:text-amber-400' };

    const base: Tile[] = [
      { id: 'tasks',     label: 'Mes Tâches',  emoji: '📋', icon: <CheckCircle className="w-5 h-5" />, badge: overdueCount || undefined, color: 'bg-blue-50 dark:bg-blue-950/30', iconColor: 'text-blue-600 dark:text-blue-400' },
      { id: 'pointage',  label: 'Pointage',    emoji: '⏱️', icon: <Clock className="w-5 h-5" />,       color: 'bg-cyan-50 dark:bg-cyan-950/30',     iconColor: 'text-cyan-600 dark:text-cyan-400' },
      { id: 'scores',    label: 'Mon Score',   emoji: '🏆', icon: <Trophy className="w-5 h-5" />,       color: 'bg-yellow-50 dark:bg-yellow-950/30', iconColor: 'text-yellow-600 dark:text-yellow-400' },
      { id: 'planning',  label: 'Planning',    emoji: '📅', icon: <CalendarDays className="w-5 h-5" />, color: 'bg-indigo-50 dark:bg-indigo-950/30', iconColor: 'text-indigo-600 dark:text-indigo-400' },
      { id: 'orders',    label: 'Commandes',   emoji: '📦', icon: <ShoppingCart className="w-5 h-5" />, color: 'bg-orange-50 dark:bg-orange-950/30', iconColor: 'text-orange-600 dark:text-orange-400' },
      { id: 'chat',      label: 'Équipe',      emoji: '👥', icon: <MessageSquare className="w-5 h-5" />, color: 'bg-violet-50 dark:bg-violet-950/30', iconColor: 'text-violet-600 dark:text-violet-400' },
      { id: 'sos',       label: 'Incidents',   emoji: '⚠️', icon: <AlertTriangle className="w-5 h-5" />, badge: unreadHighIncidents || undefined, color: 'bg-red-50 dark:bg-red-950/30', iconColor: 'text-red-600 dark:text-red-400' },
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
        { id: 'tasks',      label: 'Tâches',      emoji: '📋', icon: <CheckCircle className="w-5 h-5" />,    badge: overdueCount || undefined, color: 'bg-blue-50 dark:bg-blue-950/30',      iconColor: 'text-blue-600 dark:text-blue-400' },
        { id: 'planning',   label: 'Planning',    emoji: '📅', icon: <CalendarDays className="w-5 h-5" />,  color: 'bg-indigo-50 dark:bg-indigo-950/30',  iconColor: 'text-indigo-600 dark:text-indigo-400' },
        { id: 'orders',     label: 'Commandes',   emoji: '📦', icon: <ShoppingCart className="w-5 h-5" />,  color: 'bg-orange-50 dark:bg-orange-950/30',  iconColor: 'text-orange-600 dark:text-orange-400' },
        { id: 'stock',      label: 'Stock',        emoji: '📦', icon: <Package className="w-5 h-5" />,       color: 'bg-blue-50 dark:bg-blue-950/30',      iconColor: 'text-blue-600 dark:text-blue-400' },
        { id: 'haccp',      label: 'HACCP',        emoji: '🌡️', icon: <Thermometer className="w-5 h-5" />,   color: 'bg-teal-50 dark:bg-teal-950/30',      iconColor: 'text-teal-600 dark:text-teal-400' },
        { id: 'chat',       label: 'Équipe',       emoji: '👥', icon: <MessageSquare className="w-5 h-5" />, color: 'bg-violet-50 dark:bg-violet-950/30',  iconColor: 'text-violet-600 dark:text-violet-400' },
        { id: 'sos',        label: 'Incidents',    emoji: '⚠️', icon: <AlertTriangle className="w-5 h-5" />, badge: unreadHighIncidents || undefined, color: 'bg-red-50 dark:bg-red-950/30', iconColor: 'text-red-600 dark:text-red-400' },
        { id: 'objectives', label: 'Objectifs',    emoji: '🎯', icon: <Target className="w-5 h-5" />,        color: 'bg-emerald-50 dark:bg-emerald-950/30', iconColor: 'text-emerald-600 dark:text-emerald-400' },
        { id: 'reports',    label: 'Rapports',     emoji: '📈', icon: <FileText className="w-5 h-5" />,      color: 'bg-slate-50 dark:bg-slate-950/30',    iconColor: 'text-slate-600 dark:text-slate-400' },
        menuTile,
      ];
      if (isOwner) tiles.push({ id: 'settings', label: 'Paramètres', emoji: '⚙️', icon: <Settings className="w-5 h-5" />, color: 'bg-purple-50 dark:bg-purple-950/30', iconColor: 'text-purple-600 dark:text-purple-400' });
      return tiles;
    }

    // Staff : base déjà contient menuTile comme 8e tuile
    const staffTiles: Tile[] = [...base];
    if (team === 'KITCHEN') {
      staffTiles.push({ id: 'haccp', label: 'HACCP', emoji: '🌡️', icon: <Thermometer className="w-5 h-5" />, color: 'bg-teal-50 dark:bg-teal-950/30', iconColor: 'text-teal-600 dark:text-teal-400' });
    }
    return staffTiles;
  };

  const tiles = buildTiles();

  // ── Bottom nav tabs ──
  const uniqueBottomNav = [
    { id: 'home'     as ModuleKey, label: 'Accueil',  icon: <Home strokeWidth={2} className="w-6 h-6" /> },
    { id: 'tasks'    as ModuleKey, label: 'Tâches',   icon: <CheckCircle strokeWidth={2} className="w-6 h-6" /> },
    { id: 'pointage' as ModuleKey, label: 'Pointage', icon: <Clock strokeWidth={2} className="w-6 h-6" /> },
    { id: 'planning' as ModuleKey, label: 'Planning', icon: <CalendarDays strokeWidth={2} className="w-6 h-6" /> },
    { id: 'profile'  as ModuleKey, label: 'Profil',   icon: <User strokeWidth={2} className="w-6 h-6" /> },
  ] as const;

  // ── Render active module ──
  const renderModule = () => {
    switch (activeModule) {
      case 'home':      return <HomeScreen tiles={tiles} onSelect={setActiveModule} role={role} currentUser={currentUser} allTasks={allTasks} team={team} isManager={isManager} currentTime={currentTime} />;
      case 'tasks':     return <TasksModule role={role} team={team} isManager={isManager} onCreateTask={() => setShowCreateModal(true)} />;
      case 'chat':      return <MessagingModule />;
      case 'sos':       return <IncidentModule />;
      case 'orders':    return <OrdersModule canManage={canManageContent} isChef={isChef && !isManager} />;
      case 'timesheet': return currentUser ? <TimesheetView userId={currentUser.id} showPinChange /> : null;
      case 'objectives':return <ObjectivesModule canManage={canManageContent} />;
      case 'planning':  return canManageContent ? <PlanningModule /> : <StaffShiftsView />;
      case 'menu':      return <MenuModule canEdit={canManageContent} />;
      case 'haccp':     return <HACCPModule />;
      case 'scores':    return <MonScore />;
      case 'leaderboard': return <Leaderboard />;
      case 'reports':   return <ReportsView />;
      case 'stock':     return <StockModule />;
      case 'catalogue': return <ProductCatalogue canEdit={canManageContent} canDelete={isAdmin} />;
      case 'pins':      return <PinManagement />;
      case 'settings':  return <OwnerSettings readOnly={isPureOwner} />;
      case 'contests':  return <MalusContestModule />;
      case 'swaps':     return <ShiftSwapModule canManage={isManager} />;
      case 'availability': return <StaffAvailabilityView />;
      case 'pointage':  return <PointagePage />;
      case 'profile':   return <ProfilPage />;
      default:          return <HomeScreen tiles={tiles} onSelect={setActiveModule} role={role} currentUser={currentUser} allTasks={allTasks} team={team} isManager={isManager} currentTime={currentTime} />;
    }
  };

  const moduleTitle: Partial<Record<ModuleKey, string>> = {
    home: restaurantName,
    tasks: 'Tâches', chat: 'Messages', sos: 'Incidents SOS', orders: 'Commandes',
    timesheet: 'Mon Pointage', objectives: 'Objectifs', planning: 'Planning',
    menu: 'Menu du Jour', haccp: 'HACCP', scores: 'Classement', reports: 'Rapports', stock: 'Gestion du Stock',
    catalogue: 'Catalogue', pins: 'Gestion des PINs', settings: 'Paramètres',
    contests: 'Contestations', swaps: 'Échanges de shifts', availability: 'Disponibilités',
    pointage: 'Pointage', profile: 'Mon Profil',
  };

  const showNotifPrompt = isManager && isSupported && permission === 'default';
  const notifBlocked = isManager && isSupported && permission === 'denied';

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ══════════════════ HEADER ══════════════════ */}
      <header className="sticky top-0 z-40 bg-card border-b border-border" style={{ height: 56 }}>
        <div className="max-w-2xl mx-auto h-full flex items-center justify-between px-4">
          {/* Logo */}
          <button onClick={() => setActiveModule('home')} className="flex items-center">
            <img src={logo} alt="Staff&B" className="h-7" />
          </button>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Realtime dot */}
            {realtimeStatus === 'connected' ? (
              <span className="w-2 h-2 rounded-full bg-primary" title="Connecté en temps réel" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
            )}

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notification request */}
            {showNotifPrompt && (
              <button onClick={requestPermission}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                <Bell className="w-4 h-4" />
              </button>
            )}
            {notifBlocked && <BellOff className="w-4 h-4 text-muted-foreground" />}

            {/* Incident alert */}
            {isManager && unreadHighIncidents > 0 && (
              <button onClick={() => { clearIncidentBadge(); setActiveModule('sos'); }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive animate-pulse">
                <AlertOctagon className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">{unreadHighIncidents}</span>
              </button>
            )}

            {/* Notification bell */}
            <NotificationBell />

            {/* Avatar + menu */}
            <div className="relative">
              <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-1.5">
                <InitialsAvatar name={currentUser.name} />
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 bg-card rounded-2xl py-1 min-w-[200px] z-50 shadow-xl border border-border animate-slide-up">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-bold text-foreground">{currentUser.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{TEAM_LABELS[currentUser.team]} · {getRoleLabel(role)}</p>
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
                  <div className="border-t border-border mt-1">
                    <button onClick={() => { logout(); setShowUserMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <LogOut className="w-3.5 h-3.5" /> Changer d'utilisateur
                    </button>
                    <button onClick={() => { signOut(); setShowUserMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-destructive hover:bg-destructive/10 transition-colors">
                      <LogOut className="w-3.5 h-3.5" /> Se déconnecter
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── BREADCRUMB for sub-modules ── */}
      {activeModule !== 'home' && (
        <div className="max-w-2xl mx-auto w-full px-4 pt-4 pb-0">
          <button onClick={() => setActiveModule('home')}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3">
            <Home className="w-3.5 h-3.5" />
            <span>Accueil</span>
            <span className="opacity-40">›</span>
            <span className="text-foreground font-medium">{moduleTitle[activeModule]}</span>
          </button>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 max-w-2xl mx-auto w-full pb-28">
        {renderModule()}
      </main>

      {/* ══════════════════ BOTTOM NAV ══════════════════ */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-around pt-2 pb-1">
          {uniqueBottomNav.map((item, i) => {
            const navActive = activeModule === item.id;
            return (
              <button
                key={`${item.id}-${i}`}
                onClick={() => setActiveModule(item.id)}
                className="flex flex-col items-center justify-center gap-1 flex-1 min-h-[48px] transition-all active:scale-95 select-none"
              >
                <div className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                  navActive ? 'bg-primary/10' : 'bg-transparent'
                }`}>
                  <span className={navActive ? 'text-primary' : 'text-muted-foreground'}>
                    {item.icon}
                  </span>
                </div>
                <span className={`text-[11px] font-medium leading-none ${
                  navActive ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals */}
      {showCreateModal && <CreateTaskModal onClose={() => setShowCreateModal(false)} />}
      <ToastNotification />
      {showUserMenu && <div className="fixed inset-0 z-30" onClick={() => setShowUserMenu(false)} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HOME SCREEN — Bannière + Grille modules + Tâches du jour
// ══════════════════════════════════════════════════════════════════════════════
function HomeScreen({
  tiles, onSelect, role, currentUser, allTasks, team, isManager, currentTime,
}: {
  tiles: Tile[];
  onSelect: (id: ModuleKey) => void;
  role?: AppRole;
  currentUser: { id: string; name: string; team: string };
  allTasks: import('../types').Task[];
  team?: Team;
  isManager: boolean;
  currentTime: Date;
}) {
  const { objectives: teamObjectives, staffRankings } = useApp();

  // Score banner data
  const myRanking = staffRankings.find((r) => r.user_id === currentUser.id);
  const myScore = myRanking?.score ?? 0;

  // Today objectives for team
  const todayObjectives = teamObjectives.filter((o) => {
    if (!team) return false;
    return o.team === team || o.team === 'ALL';
  });
  const mainObjective = todayObjectives[0] ?? null;
  const objectivePct = mainObjective
    ? Math.min(100, Math.round((mainObjective.currentValue / mainObjective.targetValue) * 100))
    : null;

  // Upcoming tasks (pending, sorted by deadline)
  const upcomingTasks = allTasks
    .filter((t) => t.status === 'pending' || t.status === 'overdue')
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
    .slice(0, 3);

  // Time greeting
  const hour = currentTime.getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const firstName = currentUser.name.split(' ')[0];

  const timeStr = currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = currentTime.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex flex-col gap-4">
      {/* ── ① WELCOME BANNER ── */}
      <div className="mx-4 mt-4 rounded-[20px] overflow-hidden p-5"
        style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)' }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-primary-foreground/70 text-xs font-medium uppercase tracking-widest mb-1">{dateStr}</p>
            <h1 className="text-primary-foreground text-2xl font-black leading-tight">
              {greeting} {firstName} 👋
            </h1>
            <p className="text-primary-foreground/70 text-sm mt-1 capitalize">
              {getRoleLabel(role)} · {timeStr}
            </p>
          </div>
          <div className="text-right">
            <div className="bg-primary-foreground/20 rounded-xl px-3 py-2 text-center">
              <p className="text-primary-foreground text-xl font-black leading-none">{myScore}</p>
              <p className="text-primary-foreground/70 text-[10px] font-medium mt-0.5">pts</p>
            </div>
          </div>
        </div>

        {/* Objective progress bar — shown if objective exists */}
        {mainObjective && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-primary-foreground/90 text-xs font-medium truncate pr-2">{mainObjective.title}</span>
              <span className="text-primary-foreground text-xs font-bold flex-shrink-0">{objectivePct}%</span>
            </div>
            <div className="h-2 bg-primary-foreground/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-foreground rounded-full transition-all duration-700"
                style={{ width: `${objectivePct}%` }}
              />
            </div>
            <p className="text-primary-foreground/60 text-[10px] mt-1">
              {mainObjective.currentValue} / {mainObjective.targetValue} {mainObjective.unit}
            </p>
          </div>
        )}
      </div>

      {/* ── ② MODULE GRID ── */}
      <div className="px-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tiles.map((tile) => (
            <ModuleTile key={tile.id} tile={tile} onSelect={onSelect} />
          ))}
        </div>
      </div>

      {/* ── ③ MES TÂCHES DU JOUR ── */}
      {upcomingTasks.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-foreground">Mes tâches du jour</h2>
            <button
              onClick={() => onSelect('tasks')}
              className="text-[13px] font-medium text-primary hover:underline"
            >
              Voir tout →
            </button>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            {upcomingTasks.map((task, idx) => (
              <QuickTaskRow
                key={task.id}
                task={task}
                isLast={idx === upcomingTasks.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Module tile card ─────────────────────────────────────────────────────────
function ModuleTile({ tile, onSelect }: { tile: Tile; onSelect: (id: ModuleKey) => void }) {
  return (
    <button
      onClick={() => onSelect(tile.id)}
      className="relative flex flex-col items-center gap-2.5 py-5 px-3 rounded-xl bg-card border border-border transition-all active:scale-[0.96] hover:shadow-md text-center"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
    >
      {/* Badge */}
      {tile.badge != null && tile.badge > 0 && (
        <span className="absolute top-2 right-2 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-1">
          {tile.badge > 9 ? '9+' : tile.badge}
        </span>
      )}
      {/* Icon circle — 28px icon */}
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${tile.color}`}>
        <span className={`[&>svg]:w-7 [&>svg]:h-7 ${tile.iconColor}`}>{tile.icon}</span>
      </div>
      {/* Label */}
      <span className="text-[13px] font-medium text-foreground leading-tight">
        {tile.label}
      </span>
    </button>
  );
}

// ─── Quick task row ───────────────────────────────────────────────────────────
function QuickTaskRow({ task, isLast }: { task: import('../types').Task; isLast: boolean }) {
  const { completeTask } = useApp();
  const [done, setDone] = useState(task.status === 'done');

  const handleCheck = () => {
    if (done) return;
    setDone(true);
    completeTask(task.id);
  };

  const timeStr = task.deadline.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const isOverdue = task.status === 'overdue';

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${!isLast ? 'border-b border-border' : ''}`}>
      {/* Checkbox */}
      <button
        onClick={handleCheck}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          done
            ? 'bg-primary border-primary'
            : isOverdue
            ? 'border-destructive'
            : 'border-border hover:border-primary'
        }`}
      >
        {done && <CheckCircle className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
      </button>

      {/* Task name */}
      <span className={`flex-1 text-sm font-medium leading-tight ${
        done
          ? 'line-through text-muted-foreground'
          : isOverdue
          ? 'text-destructive'
          : 'text-foreground'
      }`}>
        {task.name}
      </span>

      {/* Time */}
      <span className={`text-xs font-medium flex-shrink-0 ${
        isOverdue ? 'text-destructive' : 'text-muted-foreground'
      }`}>
        {timeStr}
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TASKS MODULE (inline for staff/manager)
// ══════════════════════════════════════════════════════════════════════════════
function TasksModule({ role, team, isManager, onCreateTask }: { role?: AppRole; team?: Team; isManager: boolean; onCreateTask: () => void }) {
  const { getTodayTasks, deleteTask } = useApp();
  const [showDone, setShowDone] = useState(false);

  const allTasks = getTodayTasks(isManager ? undefined : team);
  const overdue = allTasks.filter((t) => t.status === 'overdue').sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  const pending = allTasks.filter((t) => t.status === 'pending').sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  const done = allTasks.filter((t) => t.status === 'done');

  return (
    <div className="flex flex-col gap-4 px-4 pt-2">
      {/* Stats row */}
      <div className="flex items-center gap-3">
        <div className="flex-1 content-card text-center">
          <p className="text-[20px] font-bold text-destructive">{overdue.length}</p>
          <p className="text-[13px] font-medium text-muted-foreground">En retard</p>
        </div>
        <div className="flex-1 content-card text-center">
          <p className="text-[20px] font-bold text-primary">{pending.length}</p>
          <p className="text-[13px] font-medium text-muted-foreground">À faire</p>
        </div>
        <div className="flex-1 content-card text-center">
          <p className="text-[20px] font-bold text-accent">{done.length}</p>
          <p className="text-[13px] font-medium text-muted-foreground">Faites</p>
        </div>
        {isManager && (
          <button
            onClick={onCreateTask}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex-shrink-0 font-semibold text-[13px]"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Créer</span>
          </button>
        )}
      </div>

      {overdue.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <h2 className="text-[13px] font-bold text-destructive uppercase tracking-wide">En retard ({overdue.length})</h2>
          </div>
          <div className="flex flex-col gap-3">{overdue.map((t) => <TaskCard key={t.id} task={t} canComplete />)}</div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">À faire</h2>
          {pending.length > 0 && <span className="ml-auto text-[12px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{pending.length}</span>}
        </div>
        {pending.length === 0 && overdue.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-[15px] font-semibold text-foreground">Tout est bon !</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">{pending.map((t) => <TaskCard key={t.id} task={t} canComplete onDelete={isManager ? () => deleteTask(t.id) : undefined} />)}</div>
        )}
      </section>

      {done.length > 0 && (
        <section className="flex flex-col gap-3">
          <button onClick={() => setShowDone(!showDone)} className="w-full flex items-center justify-between gap-2 group">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-accent" />
              <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">Complétées</h2>
              <span className="text-[12px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">{done.length}</span>
            </div>
            {showDone ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showDone && <div className="flex flex-col gap-3 animate-slide-up">{done.map((t) => <TaskCard key={t.id} task={t} canComplete={false} />)}</div>}
        </section>
      )}
    </div>
  );
}
