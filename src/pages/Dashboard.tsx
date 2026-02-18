import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { StaffView } from '../components/dashboard/StaffView';
import { ManagerView } from '../components/dashboard/ManagerView';
import { OwnerSettings } from '../components/dashboard/OwnerSettings';
import { LogOut, UtensilsCrossed, Settings, LayoutDashboard, ChevronDown } from 'lucide-react';
import { ZONE_CSS, ZONE_EMOJI } from '../data/initialData';

type DashTab = 'tasks' | 'settings';

export default function Dashboard() {
  const { currentUser, logout, restaurantName } = useApp();
  const [activeTab, setActiveTab] = useState<DashTab>('tasks');
  const [showUserMenu, setShowUserMenu] = useState(false);

  if (!currentUser) return null;

  const isOwner = currentUser.role === 'owner';
  const isManager = currentUser.role === 'manager' || isOwner;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <UtensilsCrossed className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground text-sm">{restaurantName}</span>
            <span className="text-muted-foreground text-xs hidden sm:block">· Manager</span>
          </div>

          {/* Tabs (manager/owner only) */}
          {isOwner && (
            <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab('tasks')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'tasks' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tableau de bord</span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'settings' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Paramètres</span>
              </button>
            </div>
          )}

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted transition-colors"
            >
              <span className="text-sm">{ZONE_EMOJI[currentUser.zone]}</span>
              <span className="text-xs font-medium text-foreground hidden sm:block">{currentUser.name}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1 glass-card rounded-xl py-1 min-w-[160px] z-50 shadow-xl animate-slide-up">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-xs font-semibold text-foreground">{currentUser.name}</p>
                  <p className={`text-xs zone-badge px-1.5 py-0.5 rounded inline-block mt-0.5 ${ZONE_CSS[currentUser.zone]}`}>
                    {currentUser.zone} · {currentUser.role}
                  </p>
                </div>
                <button
                  onClick={() => { logout(); setShowUserMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">
            {activeTab === 'settings'
              ? '⚙️ Paramètres'
              : isOwner
              ? '👑 Vue Owner'
              : isManager
              ? '🔵 Vue Manager'
              : `${ZONE_EMOJI[currentUser.zone]} Zone ${currentUser.zone}`}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
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

      {/* Overlay for user menu */}
      {showUserMenu && (
        <div className="fixed inset-0 z-30" onClick={() => setShowUserMenu(false)} />
      )}
    </div>
  );
}
