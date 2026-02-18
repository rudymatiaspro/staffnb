import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { StaffView } from '../components/dashboard/StaffView';
import { ManagerView } from '../components/dashboard/ManagerView';
import { OwnerSettings } from '../components/dashboard/OwnerSettings';
import { ToastNotification } from '../components/ui/ToastNotification';
import { LogOut, UtensilsCrossed, Settings, LayoutDashboard, ChevronDown, Bell } from 'lucide-react';
import { ZONE_CSS, ZONE_EMOJI } from '../data/initialData';

type DashTab = 'tasks' | 'settings';

export default function Dashboard() {
  const { currentUser, logout, restaurantName, getTodayTasks } = useApp();
  const [activeTab, setActiveTab] = useState<DashTab>('tasks');
  const [showUserMenu, setShowUserMenu] = useState(false);

  if (!currentUser) return null;

  const isOwner = currentUser.role === 'owner';
  const isManager = currentUser.role === 'manager' || isOwner;

  // Count overdue for badge
  const myTasks = getTodayTasks(isManager ? undefined : currentUser.zone);
  const overdueCount = myTasks.filter((t) => t.status === 'overdue').length;

  const getRoleLabel = () => {
    if (isOwner) return '👑 Vue Owner';
    if (isManager) return '🔵 Vue Manager';
    return `${ZONE_EMOJI[currentUser.zone]} Zone ${currentUser.zone}`;
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
              <span className="font-bold text-foreground text-sm">{restaurantName}</span>
              <span className="text-muted-foreground text-xs"> · Manager</span>
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
                <span className="hidden sm:inline">Tableau de bord</span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'settings' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Paramètres</span>
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
                <span className="text-sm">{ZONE_EMOJI[currentUser.zone]}</span>
                <span className="text-xs font-medium text-foreground hidden sm:block max-w-[100px] truncate">
                  {currentUser.name}
                </span>
                <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 glass-card rounded-xl py-1 min-w-[180px] z-50 shadow-2xl animate-slide-up border border-border">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-bold text-foreground">{currentUser.name}</p>
                    <p className={`text-xs zone-badge px-2 py-0.5 rounded-md inline-block mt-1 ${ZONE_CSS[currentUser.zone]}`}>
                      {currentUser.zone} · {currentUser.role === 'owner' ? 'Owner' : currentUser.role === 'manager' ? 'Manager' : 'Staff'}
                    </p>
                  </div>
                  <button
                    onClick={() => { logout(); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Se déconnecter
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
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
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
