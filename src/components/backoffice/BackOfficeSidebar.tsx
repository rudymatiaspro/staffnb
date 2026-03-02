import {
  CheckCircle, MessageSquare, AlertTriangle, ShoppingCart, Clock, Target,
  CalendarDays, Thermometer, Home, Users, Package, FileText, KeyRound, Trophy,
  UtensilsCrossed, Shield, Settings, LayoutGrid, Store, CakeSlice,
  ChevronDown,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export type ModuleKey =
  | 'home' | 'tasks' | 'chat' | 'sos' | 'orders' | 'timesheet' | 'objectives'
  | 'planning' | 'menu' | 'haccp' | 'scores' | 'leaderboard' | 'reports' | 'catalogue' | 'pins'
  | 'settings' | 'contests' | 'swaps' | 'availability' | 'timesheets_all'
  | 'pointage' | 'profile' | 'stock' | 'accounts' | 'rooms' | 'restaurants'
  | 'classes' | 'membres' | 'cakes' | 'backoffice';

interface SidebarSection {
  label: string;
  items: { id: ModuleKey; label: string; icon: React.ReactNode }[];
}

function buildSections(role: string): SidebarSection[] {
  const sections: SidebarSection[] = [
    {
      label: 'Opérations',
      items: [
        { id: 'home', label: 'Accueil', icon: <Home className="w-4 h-4" /> },
        { id: 'tasks', label: 'Tâches', icon: <CheckCircle className="w-4 h-4" /> },
        { id: 'pointage', label: 'Pointage', icon: <Clock className="w-4 h-4" /> },
        { id: 'planning', label: 'Planning', icon: <CalendarDays className="w-4 h-4" /> },
        { id: 'menu', label: 'Menu du Jour', icon: <UtensilsCrossed className="w-4 h-4" /> },
        { id: 'cakes', label: 'Cakes', icon: <CakeSlice className="w-4 h-4" /> },
      ],
    },
    {
      label: 'Communication',
      items: [
        { id: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" /> },
        { id: 'sos', label: 'Incidents', icon: <AlertTriangle className="w-4 h-4" /> },
      ],
    },
    {
      label: 'Logistique',
      items: [
        { id: 'orders', label: 'Commandes', icon: <ShoppingCart className="w-4 h-4" /> },
        { id: 'stock', label: 'Stock', icon: <Package className="w-4 h-4" /> },
        { id: 'catalogue', label: 'Catalogue', icon: <LayoutGrid className="w-4 h-4" /> },
        { id: 'haccp', label: 'HACCP', icon: <Thermometer className="w-4 h-4" /> },
      ],
    },
    {
      label: 'Performance',
      items: [
        { id: 'scores', label: 'Mon Score', icon: <Trophy className="w-4 h-4" /> },
        { id: 'leaderboard', label: 'Classement', icon: <Trophy className="w-4 h-4" /> },
        { id: 'objectives', label: 'Objectifs', icon: <Target className="w-4 h-4" /> },
        { id: 'reports', label: 'Rapports', icon: <FileText className="w-4 h-4" /> },
      ],
    },
    {
      label: 'Administration',
      items: [
        { id: 'rooms', label: 'Salles', icon: <Home className="w-4 h-4" /> },
        
        { id: 'timesheets_all', label: 'Pointages', icon: <Clock className="w-4 h-4" /> },
        { id: 'backoffice', label: 'Permissions', icon: <Shield className="w-4 h-4" /> },
        { id: 'settings', label: 'Paramètres', icon: <Settings className="w-4 h-4" /> },
      ],
    },
  ];

  if (role === 'god' || role === 'admin') {
    sections.push({
      label: 'Plateforme',
      items: [
        { id: 'restaurants', label: 'Restaurants', icon: <Store className="w-4 h-4" /> },
        { id: 'classes', label: 'Classes', icon: <Shield className="w-4 h-4" /> },
        { id: 'membres', label: 'Membres', icon: <Users className="w-4 h-4" /> },
      ],
    });
  }

  return sections;
}

interface BackOfficeSidebarProps {
  activeModule: ModuleKey;
  onModuleSelect: (id: ModuleKey) => void;
  role: string;
}

export function BackOfficeSidebar({ activeModule, onModuleSelect, role }: BackOfficeSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const sections = buildSections(role);

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent className="pt-2">
        {sections.map((section) => {
          const isActive = section.items.some((item) => item.id === activeModule);
          return (
            <Collapsible key={section.label} defaultOpen={isActive || true}>
              <SidebarGroup>
                <CollapsibleTrigger className="w-full">
                  <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors">
                    {!collapsed && <span>{section.label}</span>}
                    {!collapsed && <ChevronDown className="w-3 h-3" />}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {section.items.map((item) => (
                        <SidebarMenuItem key={item.id}>
                          <SidebarMenuButton
                            onClick={() => onModuleSelect(item.id)}
                            isActive={activeModule === item.id}
                            tooltip={item.label}
                            className={activeModule === item.id ? 'bg-primary/10 text-primary font-medium' : ''}
                          >
                            {item.icon}
                            {!collapsed && <span>{item.label}</span>}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
