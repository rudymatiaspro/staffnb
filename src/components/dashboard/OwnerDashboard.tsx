import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Team } from '../../types';
import { TEAM_CSS, TEAM_LABELS } from '../../data/initialData';
import { Leaderboard } from '../leaderboard/Leaderboard';
import {
  Users, CheckCircle, AlertTriangle, TrendingUp, Trophy,
  Wine, ChefHat, Layers, PersonStanding, Settings,
  Clock, ChevronRight, BarChart2, Star, Bell,
} from 'lucide-react';

const ACTIVE_TEAMS: Team[] = ['BAR', 'KITCHEN', 'FLOOR', 'ATELIER'];

const TEAM_ICONS: Record<string, React.ReactNode> = {
  BAR: <Wine className="w-4 h-4" />,
  KITCHEN: <ChefHat className="w-4 h-4" />,
  FLOOR: <PersonStanding className="w-4 h-4" />,
  ATELIER: <Layers className="w-4 h-4" />,
  MANAGEMENT: <Settings className="w-4 h-4" />,
  ALL: <Users className="w-4 h-4" />,
};

type OwnerTab = 'overview' | 'leaderboard' | 'settings';

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

// Import OwnerSettings here for the settings tab
import { OwnerSettings } from './OwnerSettings';

export function OwnerDashboard() {
  const { users, getTodayTasks, getTeamScore, validationLog } = useApp();
  const [activeTab, setActiveTab] = useState<OwnerTab>('overview');

  const allTasks = getTodayTasks();
  const doneTasks = allTasks.filter((t) => t.status === 'done');
  const overdueTasks = allTasks.filter((t) => t.status === 'overdue');
  const pendingTasks = allTasks.filter((t) => t.status === 'pending');

  const staffUsers = users.filter((u) => u.role === 'staff');
  const completionRate = allTasks.length > 0 ? Math.round((doneTasks.length / allTasks.length) * 100) : 0;
  const alertsCount = overdueTasks.length;

  const todayLog = validationLog.filter((v) => {
    const today = new Date().toISOString().split('T')[0];
    return v.validatedAt.toISOString().split('T')[0] === today;
  });

  const tabs: { id: OwnerTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart2 className="w-3.5 h-3.5" /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy className="w-3.5 h-3.5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Tab nav */}
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

      {/* ===== OVERVIEW TAB ===== */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Live Overview — KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-card rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-black text-foreground">{staffUsers.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Staff Total</p>
            </div>

            <div className="glass-card rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <CheckCircle className="w-4 h-4 text-timer-safe" />
              </div>
              <p className="text-2xl font-black text-foreground">{completionRate}%</p>
              <p className="text-xs text-muted-foreground mt-0.5">Tasks Done</p>
            </div>

            <div className={`rounded-xl p-4 text-center ${alertsCount > 0 ? 'bg-destructive/10 border border-destructive/20' : 'glass-card'}`}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Bell className={`w-4 h-4 ${alertsCount > 0 ? 'text-timer-danger animate-pulse-danger' : 'text-muted-foreground'}`} />
              </div>
              <p className={`text-2xl font-black ${alertsCount > 0 ? 'text-timer-danger' : 'text-foreground'}`}>{alertsCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Alerts</p>
            </div>

            <div className="glass-card rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Clock className="w-4 h-4 text-timer-warning" />
              </div>
              <p className="text-2xl font-black text-foreground">{pendingTasks.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pending</p>
            </div>
          </div>

          {/* Global progress bar */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Overall Task Completion</span>
              </div>
              <span className="text-sm font-bold text-foreground">{doneTasks.length}/{allTasks.length}</span>
            </div>
            <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${completionRate}%`,
                  background: completionRate >= 70
                    ? 'hsl(var(--timer-safe))'
                    : completionRate >= 40
                    ? 'hsl(var(--timer-warning))'
                    : 'hsl(var(--timer-danger))',
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {completionRate >= 70 ? '✓ On track — great performance!' : completionRate >= 40 ? 'Getting there — push the team!' : 'Needs attention — check overdue tasks'}
            </p>
          </div>

          {/* Team Performance cards */}
          <div>
            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-muted-foreground" />
              Team Performance
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ACTIVE_TEAMS.map((team) => {
                const teamScore = getTeamScore(team);
                const teamTasks = allTasks.filter((t) => t.team === team || t.team === 'ALL');
                const teamDone = teamTasks.filter((t) => t.status === 'done');
                const teamOverdue = teamTasks.filter((t) => t.status === 'overdue');
                const teamPct = teamTasks.length > 0 ? Math.round((teamDone.length / teamTasks.length) * 100) : 0;
                const isLow = teamPct < 70 && teamTasks.length > 0;
                const topPerformer = users
                  .filter((u) => u.team === team && u.role === 'staff')
                  .sort(() => 0.5 - Math.random())[0]; // demo: random pick

                return (
                  <div key={team} className={`rounded-xl p-4 team-card ${TEAM_CSS[team]}`}>
                    {/* Team header */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center team-badge">
                        {TEAM_ICONS[team]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-foreground">{TEAM_LABELS[team]}</h3>
                        <p className="text-xs text-muted-foreground">
                          {users.filter((u) => u.team === team && u.role === 'staff').length} staff
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-base font-black ${isLow ? 'text-timer-danger' : 'text-foreground'}`}>
                          {teamPct}%
                        </p>
                        <p className="text-[10px] text-muted-foreground">done</p>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="h-1.5 bg-secondary/60 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${teamPct}%`,
                          background: isLow ? 'hsl(var(--timer-danger))' : 'hsl(var(--timer-safe))',
                        }}
                      />
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-timer-safe" />
                        {teamDone.length} done
                      </span>
                      {teamOverdue.length > 0 && (
                        <span className="flex items-center gap-1 text-timer-danger">
                          <AlertTriangle className="w-3 h-3" />
                          {teamOverdue.length} overdue
                        </span>
                      )}
                      <span className="ml-auto">Bonus: {teamScore.currentBonus}pts</span>
                    </div>

                    {/* Collective penalty warning */}
                    {isLow && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 mt-1">
                        <AlertTriangle className="w-3 h-3 text-timer-danger flex-shrink-0" />
                        <span className="text-[10px] text-timer-danger font-medium">
                          Below 70% — collective penalty risk
                        </span>
                      </div>
                    )}

                    {/* Top performer */}
                    {topPerformer && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
                        <Star className="w-3 h-3 text-amber-400 flex-shrink-0" />
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                          style={{
                            background: `hsl(var(--team-${team.toLowerCase()}) / 0.2)`,
                            color: `hsl(var(--team-${team.toLowerCase()}))`,
                          }}
                        >
                          {getInitials(topPerformer.name)}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{topPerformer.name}</span> · top performer
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Alerts panel */}
          {(overdueTasks.length > 0 || todayLog.length > 0) && (
            <div>
              <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Bell className="w-4 h-4 text-muted-foreground" />
                Alerts & Activity
              </h2>
              <div className="glass-card rounded-xl divide-y divide-border">
                {/* Overdue tasks — sorted by urgency */}
                {overdueTasks
                  .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
                  .map((task) => (
                    <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-3.5 h-3.5 text-timer-danger" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{task.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {TEAM_LABELS[task.team]} · due {task.deadline.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-timer-danger px-1.5 py-0.5 rounded-md bg-destructive/10 flex-shrink-0">
                        OVERDUE
                      </span>
                    </div>
                  ))}

                {/* Recent validations */}
                {todayLog.slice(0, 5).map((v) => (
                  <div key={v.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-7 h-7 rounded-full bg-timer-safe/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-3.5 h-3.5 text-timer-safe" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{v.taskName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {TEAM_LABELS[v.team]} · by {v.validatedBy}
                      </p>
                    </div>
                    <span className="text-[10px] text-timer-safe font-medium flex-shrink-0">
                      {v.validatedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}

                {overdueTasks.length === 0 && todayLog.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">All clear! No alerts right now.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Leaderboard preview — Top 3 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                Top Performers This Week
              </h2>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
              >
                View full leaderboard
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="glass-card rounded-xl divide-y divide-border">
              {staffUsers.slice(0, 3).map((user, idx) => {
                const rank = idx + 1;
                const score = [185, 162, 148][idx];
                return (
                  <div key={user.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      rank === 1 ? 'bg-amber-400/20 text-amber-500' :
                      rank === 2 ? 'bg-secondary text-muted-foreground' :
                      'bg-secondary text-muted-foreground'
                    }`}>
                      {rank}
                    </div>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{
                        background: `hsl(var(--team-${user.team.toLowerCase()}) / 0.15)`,
                        color: `hsl(var(--team-${user.team.toLowerCase()}))`,
                      }}
                    >
                      {user.photo
                        ? <img src={user.photo} alt={user.name} className="w-full h-full object-cover rounded-full" />
                        : getInitials(user.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{TEAM_LABELS[user.team]}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{score}</p>
                      <p className="text-[10px] text-muted-foreground">pts</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== LEADERBOARD TAB ===== */}
      {activeTab === 'leaderboard' && <Leaderboard />}

      {/* ===== SETTINGS TAB ===== */}
      {activeTab === 'settings' && <OwnerSettings />}
    </div>
  );
}
