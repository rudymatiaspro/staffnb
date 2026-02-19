import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TaskCard } from '../tasks/TaskCard';
import { BonusScoreCard } from '../zones/BonusScoreCard';
import { ProductCatalogue } from '../catalogue/ProductCatalogue';
import { TimesheetView } from '../timesheets/TimesheetView';
import { IncidentModule } from '../incidents/IncidentModule';
import { HACCPModule } from '../haccp/HACCPModule';
import { ObjectivesModule } from '../objectives/ObjectivesModule';
import { StaffShiftsView } from '../planning/StaffShiftsView';
import { ShiftSwapModule } from '../planning/ShiftSwapModule';
import { OrdersModule } from '../orders/OrdersModule';
import { MessagingModule } from '../messaging/MessagingModule';
import { StaffAvailabilityView } from '../planning/AvailabilityModule';
import { Team } from '../../types';
import {
  CheckCircle, Clock, Star, ChevronDown, ChevronUp, Trophy, Award,
  Package, AlertTriangle, Thermometer, Target, CalendarDays, ShoppingCart,
  MessageSquare, ArrowLeftRight, CalendarCheck,
} from 'lucide-react';
import { TEAM_LABELS } from '../../data/initialData';

type StaffTab = 'tasks' | 'messages' | 'planning' | 'swaps' | 'orders' | 'catalogue' | 'timesheet' | 'incidents' | 'haccp' | 'objectives' | 'availability';

export function StaffView() {
  const { currentUser, getTodayTasks, users, staffRankings } = useApp();
  const team = currentUser?.team as Team;
  const teams = currentUser?.teams && currentUser.teams.length > 0 ? currentUser.teams : [team];
  const [showDone, setShowDone] = useState(false);
  const [activeTab, setActiveTab] = useState<StaffTab>('tasks');

  const allTasks = getTodayTasks(teams);
  const overdueTasks = allTasks.filter((t) => t.status === 'overdue').sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  const pendingTasks = allTasks.filter((t) => t.status === 'pending').sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  const doneTasks = allTasks.filter((t) => t.status === 'done');
  const teamStaff = users.filter((u) => u.team === team && u.role === 'staff');
  const completionPct = allTasks.length > 0 ? Math.round((doneTasks.length / allTasks.length) * 100) : 0;

  // Real rankings from DB
  const myRanking = currentUser ? staffRankings.find((r) => r.user_id === currentUser.id) : null;
  const teamRank = myRanking?.team_rank ?? null;
  const overallRank = myRanking?.overall_rank ?? null;
  const myScore = myRanking?.score ?? 0;

  const tabs: { id: StaffTab; label: string; icon: React.ReactNode }[] = [
    { id: 'tasks',        label: 'Tâches',      icon: <CheckCircle className="w-3.5 h-3.5" /> },
    { id: 'messages',     label: 'Messages',    icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { id: 'planning',     label: 'Planning',    icon: <CalendarDays className="w-3.5 h-3.5" /> },
    { id: 'availability', label: 'Dispos',      icon: <CalendarCheck className="w-3.5 h-3.5" /> },
    { id: 'swaps',        label: 'Échanges',    icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
    { id: 'orders',       label: 'Commandes',   icon: <ShoppingCart className="w-3.5 h-3.5" /> },
    { id: 'catalogue',    label: 'Catalogue',   icon: <Package className="w-3.5 h-3.5" /> },
    { id: 'timesheet',    label: 'Pointage',    icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'incidents',    label: 'Incident',    icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    { id: 'haccp',        label: 'HACCP',       icon: <Thermometer className="w-3.5 h-3.5" /> },
    { id: 'objectives',   label: 'Objectifs',   icon: <Target className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Tab nav — scrollable */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium flex-shrink-0 justify-center transition-all ${
              activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Messages tab */}
      {activeTab === 'messages' && <MessagingModule />}

      {/* Planning tab */}
      {activeTab === 'planning' && <StaffShiftsView />}

      {/* Shift swaps tab */}
      {activeTab === 'swaps' && <ShiftSwapModule canManage={false} />}

      {/* Orders tab */}
      {activeTab === 'orders' && <OrdersModule canManage={false} />}

      {/* Catalogue tab */}
      {activeTab === 'catalogue' && <ProductCatalogue canEdit={false} canDelete={false} />}

      {/* Timesheet tab */}
      {activeTab === 'timesheet' && currentUser && <TimesheetView userId={currentUser.id} />}

      {/* Incidents tab */}
      {activeTab === 'incidents' && <IncidentModule />}

      {/* HACCP tab */}
      {activeTab === 'haccp' && <HACCPModule />}

      {/* Objectives tab — read-only progress */}
      {activeTab === 'objectives' && <ObjectivesModule canManage={false} />}

      {/* Tasks tab */}
      {activeTab === 'tasks' && (
        <div className="space-y-5">
          {/* ShiftScore card */}
          <div className="glass-card rounded-2xl p-5 border border-border">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Mon ShiftScore</p>
                <div className="flex items-end gap-2 mt-1">
                  <span className="text-5xl font-black text-foreground tracking-tight">{myScore}</span>
                  <span className="text-sm text-muted-foreground mb-1">pts aujourd'hui</span>
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="flex items-center gap-1.5 justify-end">
                  <Trophy className="w-3.5 h-3.5 text-[hsl(var(--timer-warning))]" />
                  {teamRank
                    ? <span className="text-xs text-muted-foreground">#{teamRank} dans {TEAM_LABELS[team]}</span>
                    : <span className="text-xs text-muted-foreground">— dans {TEAM_LABELS[team]}</span>
                  }
                </div>
                <div className="flex items-center gap-1.5 justify-end">
                  <Award className="w-3.5 h-3.5 text-primary" />
                  {overallRank
                    ? <span className="text-xs text-muted-foreground">#{overallRank} global</span>
                    : <span className="text-xs text-muted-foreground">— global</span>
                  }
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Tâches complétées</span>
                <span className="font-semibold text-foreground">{doneTasks.length}/{allTasks.length}</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${completionPct}%` }} />
              </div>
            </div>
          </div>

          {/* Bonus score card */}
          {team && team !== 'MANAGEMENT' && <BonusScoreCard team={team} />}

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="glass-card rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-timer-danger">{overdueTasks.length}</p>
              <p className="text-xs text-muted-foreground">En retard</p>
            </div>
            <div className="glass-card rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-primary">{pendingTasks.length}</p>
              <p className="text-xs text-muted-foreground">À faire</p>
            </div>
            <div className="glass-card rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-timer-safe">{doneTasks.length}</p>
              <p className="text-xs text-muted-foreground">Faites</p>
            </div>
          </div>

          {/* Overdue tasks */}
          {overdueTasks.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-timer-danger animate-pulse-danger" />
                <h2 className="text-sm font-bold text-timer-danger uppercase tracking-wide">En retard ({overdueTasks.length})</h2>
              </div>
              <div className="space-y-3">
                {overdueTasks.map((task) => <TaskCard key={task.id} task={task} canComplete />)}
              </div>
            </section>
          )}

          {/* Pending tasks */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">À faire</h2>
              {pendingTasks.length > 0 && (
                <span className="ml-auto text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">{pendingTasks.length}</span>
              )}
            </div>
            {pendingTasks.length === 0 && overdueTasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-semibold text-foreground">Tout est bon !</p>
                <p className="text-sm mt-1">Toutes les tâches sont complétées</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingTasks.map((task) => <TaskCard key={task.id} task={task} canComplete />)}
              </div>
            )}
          </section>

          {/* Completed tasks */}
          {doneTasks.length > 0 && (
            <section>
              <button onClick={() => setShowDone(!showDone)} className="w-full flex items-center justify-between gap-2 mb-3 group">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-timer-safe" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide group-hover:text-foreground transition-colors">Complétées aujourd'hui</h2>
                  <span className="text-xs bg-timer-safe/10 text-timer-safe px-2 py-0.5 rounded-full">{doneTasks.length}</span>
                </div>
                {showDone ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {showDone && (
                <div className="space-y-2 animate-slide-up">
                  {doneTasks.map((task) => <TaskCard key={task.id} task={task} canComplete={false} />)}
                </div>
              )}
            </section>
          )}

          {/* Team members */}
          {teamStaff.length > 1 && (
            <section className="glass-card rounded-xl p-4">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Équipe {TEAM_LABELS[team]}</h2>
              <div className="flex flex-wrap gap-2">
                {teamStaff.map((u) => (
                  <div key={u.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${u.id === currentUser?.id ? 'bg-primary/15 text-primary border border-primary/25' : 'bg-secondary text-secondary-foreground'}`}>
                    {u.name}
                    {u.id === currentUser?.id && <span className="text-[10px] opacity-70">(moi)</span>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
