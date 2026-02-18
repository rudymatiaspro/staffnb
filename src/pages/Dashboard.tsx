import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { StaffView } from '../components/dashboard/StaffView';
import { ManagerView } from '../components/dashboard/ManagerView';
import { OwnerSettings } from '../components/dashboard/OwnerSettings';
import { ToastNotification } from '../components/ui/ToastNotification';
import { LogOut, UtensilsCrossed, Settings, LayoutDashboard, ChevronDown, Bell, Wine, ChefHat, Layers, Users } from 'lucide-react';
import { TEAM_CSS, TEAM_LABELS } from '../data/initialData';

type DashTab = 'tasks' | 'settings';

const TEAM_ICONS: Record<string, React.ReactNode> = {
  BAR: <Wine className="w-3.5 h-3.5" />,
  KITCHEN: <ChefHat className="w-3.5 h-3.5" />,
  FLOOR: <Users className="w-3.5 h-3.5" />,
  ATELIER: <Layers className="w-3.5 h-3.5" />,
  MANAGEMENT: <Users className="w-3.5 h-3.5" />,
  ALL: <Users className="w-3.5 h-3.5" />,
};

export default function Dashboard() {
  const { currentUser, logout, restaurantName, getTodayTasks } = useApp();
  const [activeTab, setActiveTab] = useState<DashTab>('tasks');
  const [showUserMenu, setShowUserMenu] = useState(false);

  if (!currentUser) return null;

  const isOwner = currentUser.role === 'owner';
  const isManager = currentUser.role === 'manager' || isOwner;

  // Count overdue for badge
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

          {/* Center tabs — owner/manager only */}
          {isOwner && (
            <div className="flex items-center gap-1 bg-secondary rounded-xl p-1">
              <button
                onClick={() => setActiveTab('tasks')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'tasks' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'settings' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            </div>
          )}

          {/* Right — alert + user menu */}
          <div className="flex items-center gap-2">
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

        {activeTab === 'settings' && isOwner ? (
          <OwnerSettings />
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
