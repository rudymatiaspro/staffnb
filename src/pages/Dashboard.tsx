import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { StaffView } from '../components/dashboard/StaffView';
import { ManagerView } from '../components/dashboard/ManagerView';
import { OwnerDashboard } from '../components/dashboard/OwnerDashboard';
import { ToastNotification } from '../components/ui/ToastNotification';
import { useBrowserNotifications } from '../hooks/useBrowserNotifications';
import { LogOut, Bell, Wine, ChefHat, Layers, Users, PersonStanding, Settings, ChevronDown, WifiOff, AlertOctagon, BellOff } from 'lucide-react';
import logo from '../assets/logo.svg';
import { TEAM_CSS, TEAM_LABELS } from '../data/initialData';
import type { Incident } from '../types';

const TEAM_ICONS: Record<string, React.ReactNode> = {
  BAR: <Wine className="w-3.5 h-3.5" />,
  KITCHEN: <ChefHat className="w-3.5 h-3.5" />,
  FLOOR: <PersonStanding className="w-3.5 h-3.5" />,
  ATELIER: <Layers className="w-3.5 h-3.5" />,
  MANAGEMENT: <Settings className="w-3.5 h-3.5" />,
  ALL: <Users className="w-3.5 h-3.5" />,
};

const SEVERITY_EMOJI: Record<Incident['severity'], string> = {
  high: '🚨',
  medium: '⚠️',
  low: 'ℹ️',
};

export default function Dashboard() {
  const { currentUser, logout, restaurantName, getTodayTasks, realtimeStatus, unreadHighIncidents, incidents } = useApp();
  const { signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const { permission, isSupported, requestPermission, notify } = useBrowserNotifications();

  const isOwner = currentUser?.role === 'owner';
  const isManager = currentUser?.role === 'manager' || isOwner;

  // ─── Real-time browser notifications for high-severity incidents ──────────
  // Seed known IDs on first render so we don't fire for historical incidents.
  const knownIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!isManager) return;

    // First load — seed without toasting
    if (knownIdsRef.current === null) {
      knownIdsRef.current = new Set(incidents.map((i) => i.id));
      return;
    }

    const known = knownIdsRef.current;
    const brandNew = incidents.filter(
      (i) => !known.has(i.id) && i.severity === 'high'
    );

    brandNew.forEach((inc) => {
      notify({
        title: `${SEVERITY_EMOJI.high} High-severity incident`,
        body: `${inc.type} · ${inc.location}${inc.description ? ` — "${inc.description.slice(0, 60)}"` : ''}`,
        tag: `incident-${inc.id}`,
      });
    });

    // Update the known set
    incidents.forEach((i) => known.add(i.id));
  }, [incidents, isManager, notify]);

  if (!currentUser) return null;

  const myTasks = getTodayTasks(isManager ? undefined : currentUser.team);
  const overdueCount = myTasks.filter((t) => t.status === 'overdue').length;

  const getRoleLabel = () => {
    if (isOwner) return 'Owner Dashboard';
    if (isManager) return 'Manager Dashboard';
    return `${TEAM_LABELS[currentUser.team]} — ${currentUser.name}`;
  };

  // Show the "Enable notifications" pill only if: manager, supported, not yet decided
  const showNotifPrompt = isManager && isSupported && permission === 'default';
  // Show "blocked" hint if denied
  const notifBlocked = isManager && isSupported && permission === 'denied';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Staff&B" className="h-7" />
            <div className="hidden sm:block">
              <span className="text-muted-foreground text-xs"> · {restaurantName}</span>
            </div>
          </div>

          {/* Right — realtime dot + alerts + user menu */}
          <div className="flex items-center gap-2">
            {/* Realtime status indicator */}
            {realtimeStatus === 'connected' ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-timer-safe/10">
                <span className="w-1.5 h-1.5 rounded-full bg-timer-safe animate-pulse" />
                <span className="text-[10px] text-timer-safe font-medium hidden sm:inline">live</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-timer-warning/10 border border-timer-warning/20">
                <WifiOff className="w-3 h-3 text-timer-warning" />
                <span className="text-[10px] text-timer-warning font-medium hidden sm:inline">
                  {realtimeStatus === 'connecting' ? 'Reconnecting…' : 'Offline'}
                </span>
              </div>
            )}

            {/* Enable push notifications prompt */}
            {showNotifPrompt && (
              <button
                onClick={requestPermission}
                title="Enable push notifications for high-severity incidents"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
              >
                <Bell className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold hidden sm:inline">Enable alerts</span>
              </button>
            )}

            {/* Notification blocked hint */}
            {notifBlocked && (
              <div
                title="Browser notifications are blocked. Enable them in your browser settings."
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted text-muted-foreground cursor-default"
              >
                <BellOff className="w-3 h-3" />
              </div>
            )}

            {/* High-severity incident badge */}
            {isManager && unreadHighIncidents > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive animate-pulse">
                <AlertOctagon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-xs font-bold">{unreadHighIncidents} HIGH</span>
              </div>
            )}

            {/* Overdue tasks bell */}
            {overdueCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-timer-danger">
                <Bell className="w-3.5 h-3.5 animate-pulse-danger" />
                <span className="text-xs font-bold">{overdueCount}</span>
              </div>
            )}

            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted transition-colors"
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center team-badge ${TEAM_CSS[currentUser.team]}`}>
                  {TEAM_ICONS[currentUser.team]}
                </div>
                <span className="text-xs font-medium text-foreground hidden sm:block max-w-[100px] truncate">
                  {currentUser.name}
                </span>
                <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 glass-card rounded-xl py-1 min-w-[180px] z-50 shadow-2xl animate-slide-up border border-border">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-bold text-foreground">{currentUser.name}</p>
                    <p className={`text-xs team-badge px-2 py-0.5 rounded-md inline-flex items-center gap-1 mt-1 ${TEAM_CSS[currentUser.team]}`}>
                      {TEAM_ICONS[currentUser.team]}
                      {TEAM_LABELS[currentUser.team]} · {currentUser.role === 'owner' ? 'Owner' : currentUser.role === 'manager' ? 'Manager' : 'Staff'}
                    </p>
                  </div>
                  {/* Notification toggle in menu */}
                  {isManager && isSupported && (
                    <button
                      onClick={async () => {
                        if (permission === 'default') await requestPermission();
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      {permission === 'granted'
                        ? <><Bell className="w-3.5 h-3.5 text-timer-safe" /> Push alerts on</>
                        : permission === 'denied'
                        ? <><BellOff className="w-3.5 h-3.5 text-muted-foreground" /> Alerts blocked</>
                        : <><Bell className="w-3.5 h-3.5" /> Enable push alerts</>
                      }
                    </button>
                  )}
                  <button
                    onClick={() => { logout(); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Change user
                  </button>
                  <button
                    onClick={() => { signOut(); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-destructive hover:bg-destructive/10 transition-colors border-t border-border"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{getRoleLabel()}</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {isOwner ? (
          <OwnerDashboard />
        ) : isManager ? (
          <ManagerView />
        ) : (
          <StaffView />
        )}
      </main>

      {/* Toast notifications */}
      <ToastNotification />

      {/* Overlay to close user menu */}
      {showUserMenu && (
        <div className="fixed inset-0 z-30" onClick={() => setShowUserMenu(false)} />
      )}
    </div>
  );
}
