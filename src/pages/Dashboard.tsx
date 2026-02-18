import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { StaffView } from '../components/dashboard/StaffView';
import { ManagerView } from '../components/dashboard/ManagerView';
import { OwnerDashboard } from '../components/dashboard/OwnerDashboard';
import { ToastNotification } from '../components/ui/ToastNotification';
import { LogOut, UtensilsCrossed, Bell, Wine, ChefHat, Layers, Users, PersonStanding, Settings, ChevronDown, WifiOff, AlertOctagon } from 'lucide-react';
import { TEAM_CSS, TEAM_LABELS } from '../data/initialData';

const TEAM_ICONS: Record<string, React.ReactNode> = {
  BAR: <Wine className="w-3.5 h-3.5" />,
  KITCHEN: <ChefHat className="w-3.5 h-3.5" />,
  FLOOR: <PersonStanding className="w-3.5 h-3.5" />,
  ATELIER: <Layers className="w-3.5 h-3.5" />,
  MANAGEMENT: <Settings className="w-3.5 h-3.5" />,
  ALL: <Users className="w-3.5 h-3.5" />,
};

export default function Dashboard() {
  const { currentUser, logout, restaurantName, getTodayTasks, realtimeStatus, unreadHighIncidents } = useApp();
  const { signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  if (!currentUser) return null;

  const isOwner = currentUser.role === 'owner';
  const isManager = currentUser.role === 'manager' || isOwner;

  const myTasks = getTodayTasks(isManager ? undefined : currentUser.team);
  const overdueCount = myTasks.filter((t) => t.status === 'overdue').length;

  const getRoleLabel = () => {
    if (isOwner) return 'Owner Dashboard';
    if (isManager) return 'Manager Dashboard';
    return `${TEAM_LABELS[currentUser.team]} — ${currentUser.name}`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary/15 rounded-lg flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4 text-primary" />
            </div>
            <div className="hidden sm:block">
              <span className="font-black text-foreground text-sm tracking-tight">Staff&B</span>
              <span className="text-muted-foreground text-xs"> · {restaurantName}</span>
            </div>
          </div>

          {/* Right — realtime dot + alert + user menu */}
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
            {isManager && unreadHighIncidents > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive animate-pulse">
                <AlertOctagon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-xs font-bold">{unreadHighIncidents} HIGH</span>
              </div>
            )}
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
