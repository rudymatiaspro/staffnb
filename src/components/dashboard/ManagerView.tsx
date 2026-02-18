import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TaskCard } from '../tasks/TaskCard';
import { BonusScoreCard } from '../zones/BonusScoreCard';
import { CreateTaskModal } from '../tasks/CreateTaskModal';
import { Team } from '../../types';
import { TEAM_CSS, TEAM_LABELS } from '../../data/initialData';
import {
  Plus, LayoutGrid, List, Activity, CheckCircle, Clock,
  AlertTriangle, Users, ChevronDown, ChevronUp, Wine, ChefHat, Layers, Globe
} from 'lucide-react';

const TEAMS: Team[] = ['BAR', 'KITCHEN', 'FLOOR', 'ATELIER'];

const TEAM_ICONS: Record<string, React.ReactNode> = {
  BAR: <Wine className="w-4 h-4" />,
  KITCHEN: <ChefHat className="w-4 h-4" />,
  FLOOR: <Users className="w-4 h-4" />,
  ATELIER: <Layers className="w-4 h-4" />,
  MANAGEMENT: <Users className="w-4 h-4" />,
  ALL: <Globe className="w-4 h-4" />,
};

type ManagerTab = 'tasks' | 'activity' | 'scores';

export function ManagerView() {
  const { getTodayTasks, deleteTask, validationLog, getTeamScore, users } = useApp();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filterTeam, setFilterTeam] = useState<Team | 'ALL'>('ALL');
  const [activeTab, setActiveTab] = useState<ManagerTab>('tasks');
  const [expandedTeams, setExpandedTeams] = useState<Set<Team>>(new Set(TEAMS));

  const allTasks = getTodayTasks();
  const filteredTasks = filterTeam === 'ALL'
    ? allTasks
    : allTasks.filter((t) => t.team === filterTeam || t.team === 'ALL');

  const pendingCount = allTasks.filter((t) => t.status === 'pending').length;
  const overdueCount = allTasks.filter((t) => t.status === 'overdue').length;
  const doneCount = allTasks.filter((t) => t.status === 'done').length;
  const todayLog = validationLog.filter((v) => {
    const today = new Date().toISOString().split('T')[0];
    return v.validatedAt.toISOString().split('T')[0] === today;
  });

  const toggleTeam = (team: Team) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team);
      else next.add(team);
      return next;
    });
  };

  const tabs = [
    { id: 'tasks' as ManagerTab, label: 'Tasks', icon: <CheckCircle className="w-3.5 h-3.5" /> },
    { id: 'scores' as ManagerTab, label: 'Scores', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'activity' as ManagerTab, label: 'Activity', icon: <Users className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-primary">{pendingCount}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
        <div className={`rounded-xl p-3 text-center ${overdueCount > 0 ? 'bg-destructive/10 border border-destructive/20' : 'glass-card'}`}>
          <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-timer-danger' : 'text-foreground'}`}>{overdueCount}</p>
          <p className="text-xs text-muted-foreground">Overdue</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-timer-safe">{doneCount}</p>
          <p className="text-xs text-muted-foreground">Done</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium flex-1 justify-center transition-all ${
              activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* === TASKS TAB === */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setFilterTeam('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterTeam === 'ALL' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'}`}
              >
                All Teams
              </button>
              {([...TEAMS, 'ALL' as Team]).map((team) => (
                <button
                  key={team}
                  onClick={() => setFilterTeam(team === filterTeam ? 'ALL' : team)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all team-badge ${TEAM_CSS[team]} ${filterTeam === team ? 'ring-1 ring-current' : 'opacity-70 hover:opacity-100'}`}
                >
                  {TEAM_ICONS[team]}
                  {TEAM_LABELS[team]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
                className="p-2 rounded-lg bg-secondary hover:bg-muted transition-colors"
              >
                {view === 'grid'
                  ? <List className="w-4 h-4 text-muted-foreground" />
                  : <LayoutGrid className="w-4 h-4 text-muted-foreground" />}
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Task</span>
                <span className="sm:hidden">+</span>
              </button>
            </div>
          </div>

          {/* Grid view */}
          {view === 'grid' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {([...TEAMS, 'ALL' as Team]).filter((t) => filterTeam === 'ALL' || filterTeam === t).map((team) => {
                const teamTasks = team === 'ALL'
                  ? allTasks.filter((t) => t.team === 'ALL')
                  : allTasks.filter((t) => t.team === team || t.team === 'ALL');
                const pending = teamTasks.filter((t) => t.status !== 'done').sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
                const done = teamTasks.filter((t) => t.status === 'done');
                const overdue = teamTasks.filter((t) => t.status === 'overdue');
                const expanded = expandedTeams.has(team);

                return (
                  <div key={team} className={`rounded-xl border team-card ${TEAM_CSS[team]}`}>
                    <button
                      className="w-full flex items-center gap-2 p-4 text-left"
                      onClick={() => toggleTeam(team)}
                    >
                      <span className="text-muted-foreground">{TEAM_ICONS[team]}</span>
                      <div className="flex-1">
                        <h3 className="font-bold text-sm text-foreground">{TEAM_LABELS[team]}</h3>
                        <p className="text-xs text-muted-foreground">{done.length}/{teamTasks.length} done</p>
                      </div>
                      {overdue.length > 0 && (
                        <span className="text-xs bg-red-500/15 text-timer-danger border border-red-500/20 px-2 py-0.5 rounded-full font-medium">
                          {overdue.length} late
                        </span>
                      )}
                      {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    {expanded && (
                      <div className="px-4 pb-4 space-y-2 animate-slide-up">
                        {pending.map((task) => (
                          <TaskCard key={task.id} task={task} canComplete canDelete onDelete={() => deleteTask(task.id)} compact />
                        ))}
                        {done.map((task) => (
                          <TaskCard key={task.id} task={task} canComplete={false} canDelete onDelete={() => deleteTask(task.id)} compact />
                        ))}
                        {teamTasks.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">No tasks</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.filter(t => t.status === 'overdue').map(task => (
                <TaskCard key={task.id} task={task} canComplete canDelete onDelete={() => deleteTask(task.id)} />
              ))}
              {filteredTasks.filter(t => t.status === 'pending')
                .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
                .map(task => (
                  <TaskCard key={task.id} task={task} canComplete canDelete onDelete={() => deleteTask(task.id)} />
                ))}
              {filteredTasks.filter(t => t.status === 'done').map(task => (
                <TaskCard key={task.id} task={task} canComplete={false} canDelete onDelete={() => deleteTask(task.id)} />
              ))}
              {filteredTasks.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No tasks for today</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* === SCORES TAB === */}
      {activeTab === 'scores' && (
        <div className="space-y-4">
          {TEAMS.map((team) => (
            <BonusScoreCard key={team} team={team} />
          ))}
        </div>
      )}

      {/* === ACTIVITY TAB === */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-4 h-4 text-timer-safe" />
              <h3 className="text-sm font-semibold text-foreground">Today's Validations</h3>
              <span className="ml-auto text-xs text-muted-foreground">{todayLog.length} total</span>
            </div>
            {todayLog.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No validations yet</p>
            ) : (
              <div className="space-y-2">
                {todayLog.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground">{TEAM_ICONS[v.team]}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{v.taskName}</p>
                        <p className="text-xs text-muted-foreground">{TEAM_LABELS[v.team]} · by {v.validatedBy}</p>
                      </div>
                    </div>
                    <span className="text-xs text-timer-safe font-medium flex-shrink-0">
                      {v.validatedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Penalty log per team */}
          {TEAMS.map((team) => {
            const score = getTeamScore(team);
            if (score.malusEvents.length === 0) return null;
            return (
              <div key={team} className={`rounded-xl p-4 team-card ${TEAM_CSS[team]}`}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-timer-danger" />
                  <h3 className="text-sm font-semibold text-foreground">Penalties — {TEAM_LABELS[team]}</h3>
                  <span className="ml-auto text-xs text-timer-danger font-bold">-{score.totalMalus} pts</span>
                </div>
                <div className="space-y-1.5">
                  {score.malusEvents.map((me) => (
                    <div key={me.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{me.taskName}</span>
                      <div className="flex items-center gap-2 text-timer-danger">
                        <span>{me.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="font-bold">-{me.points}pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Staff activity */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Staff Activity</h3>
            </div>
            {TEAMS.map((team) => {
              const teamStaff = users.filter((u) => u.team === team && u.role === 'staff');
              return (
                <div key={team} className="mb-3 last:mb-0">
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1">
                    {TEAM_ICONS[team]} {TEAM_LABELS[team]}
                  </p>
                  <div className="space-y-1.5">
                    {teamStaff.map((staff) => {
                      const staffValidations = todayLog.filter((v) => v.validatedBy === staff.name);
                      return (
                        <div key={staff.id} className="flex items-center justify-between text-xs py-1">
                          <span className="text-foreground">{staff.name}</span>
                          <div className="flex items-center gap-2">
                            {staffValidations.length > 0 ? (
                              <span className="text-timer-safe font-medium">
                                {staffValidations.length} task{staffValidations.length > 1 ? 's' : ''} validated
                              </span>
                            ) : (
                              <span className="text-muted-foreground">No validations</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showCreateModal && <CreateTaskModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
}
