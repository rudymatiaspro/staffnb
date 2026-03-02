import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { BackOfficeSidebar, type ModuleKey } from './BackOfficeSidebar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { LogOut, RefreshCw, User, Sun, Moon } from 'lucide-react';
import logo from '@/assets/logo.svg';
import logoDark from '@/assets/logo-dark.svg';

interface BackOfficeLayoutProps {
  activeModule: ModuleKey;
  onModuleSelect: (id: ModuleKey) => void;
  role: string;
  userName: string;
  restaurantName?: string;
  onSignOut: () => void;
  onChangeUser: () => void;
  onToggleTheme: () => void;
  theme: 'dark' | 'light';
  moduleTitle: string;
  children: React.ReactNode;
}

export function BackOfficeLayout({
  activeModule,
  onModuleSelect,
  role,
  userName,
  restaurantName,
  onSignOut,
  onChangeUser,
  onToggleTheme,
  theme,
  moduleTitle,
  children,
}: BackOfficeLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <BackOfficeSidebar
          activeModule={activeModule}
          onModuleSelect={onModuleSelect}
          role={role}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Desktop header */}
          <header className="h-14 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <img src={logo} alt="Staff&B" className="h-7 dark:hidden" />
              <img src={logoDark} alt="Staff&B" className="h-7 hidden dark:block" />
              {restaurantName && (
                <span className="text-sm font-semibold text-foreground hidden md:inline">{restaurantName}</span>
              )}
              <span className="text-xs text-muted-foreground">›</span>
              <span className="text-sm font-bold text-foreground">{moduleTitle}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onToggleTheme}
                className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <NotificationBell />

              <div className="flex items-center gap-2 pl-2 border-l border-border ml-1">
                <span className="text-xs font-medium text-muted-foreground hidden lg:inline">{userName}</span>
                <button
                  onClick={onChangeUser}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Changer d'utilisateur"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onSignOut}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Déconnexion"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
