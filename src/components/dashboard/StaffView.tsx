import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TaskCard } from '../tasks/TaskCard';
import { BonusScoreCard } from '../zones/BonusScoreCard';
import { Team } from '../../types';
import { CheckCircle, Clock, Star, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Trophy, Award } from 'lucide-react';
import { TEAM_LABELS } from '../../data/initialData';

export function StaffView() {
  const { currentUser, getTodayTasks, users } = useApp();
  const team = currentUser?.team as Team;
  const [showDone, setShowDone] = useState(false);

  const allTasks = getTodayTasks(team);
  const overdueTasks = allTasks
    .filter((t) => t.status === 'overdue')
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  const pendingTasks = allTasks
    .filter((t) => t.status === 'pending')
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  const doneTasks = allTasks.filter((t) => t.status === 'done');

  const myValidations = doneTasks.filter((t) => t.validatedBy === currentUser?.name);
  const teamStaff = users.filter((u) => u.team === team && u.role === 'staff');
  
  // Daily score calculation (demo)
  const myScore = myValidations.length * 10 + (doneTasks.length === allTasks.length && allTasks.length > 0 ? 20 : 0);
  const teamRank = 2; // demo
  const overallRank = 4; // demo

  const completionPct = allTasks.length > 0 ? Math.round((doneTasks.length / allTasks.length) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* === TOP CARD — ShiftScore === */}
      <div className="glass-card rounded-2xl p-5 border border-border">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">My ShiftScore</p>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-5xl font-black text-foreground tracking-tight">{myScore}</span>
              <span className="text-sm text-muted-foreground mb-1">pts today</span>
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="flex items-center gap-1.5 justify-end">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-muted-foreground">#{teamRank} in {TEAM_LABELS[team]}</span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <Award className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">#{overallRank} overall</span>
            </div>
          </div>
        </div>

        {/* Task progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Tasks completed</span>
            <span className="font-semibold text-foreground">{doneTasks.length}/{allTasks.length}</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Bonus score card */}
      {team && team !== 'MANAGEMENT' && (
        <BonusScoreCard team={team} />
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-timer-danger">{overdueTasks.length}</p>
          <p className="text-xs text-muted-foreground">Overdue</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-primary">{pendingTasks.length}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-timer-safe">{doneTasks.length}</p>
          <p className="text-xs text-muted-foreground">Done</p>
        </div>
      </div>

      {/* Overdue tasks */}
      {overdueTasks.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-timer-danger animate-pulse-danger" />
            <h2 className="text-sm font-bold text-timer-danger uppercase tracking-wide">
              Overdue ({overdueTasks.length})
            </h2>
          </div>
          <div className="space-y-3">
            {overdueTasks.map((task) => (
              <TaskCard key={task.id} task={task} canComplete />
            ))}
          </div>
        </section>
      )}

      {/* Pending tasks */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            To Do
          </h2>
          {pendingTasks.length > 0 && (
            <span className="ml-auto text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
              {pendingTasks.length}
            </span>
          )}
        </div>
        {pendingTasks.length === 0 && overdueTasks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-foreground">All clear!</p>
            <p className="text-sm mt-1">All tasks are completed</p>
          </div>
        ) : pendingTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No pending tasks</p>
        ) : (
          <div className="space-y-3">
            {pendingTasks.map((task) => (
              <TaskCard key={task.id} task={task} canComplete />
            ))}
          </div>
        )}
      </section>

      {/* Completed tasks — collapsible */}
      {doneTasks.length > 0 && (
        <section>
          <button
            onClick={() => setShowDone(!showDone)}
            className="w-full flex items-center justify-between gap-2 mb-3 group"
          >
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-timer-safe" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide group-hover:text-foreground transition-colors">
                Completed today
              </h2>
              <span className="text-xs bg-timer-safe/10 text-timer-safe px-2 py-0.5 rounded-full">
                {doneTasks.length}
              </span>
            </div>
            {showDone ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showDone && (
            <div className="space-y-2 animate-slide-up">
              {doneTasks.map((task) => (
                <TaskCard key={task.id} task={task} canComplete={false} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Team members */}
      {teamStaff.length > 1 && (
        <section className="glass-card rounded-xl p-4">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            {TEAM_LABELS[team]} Team
          </h2>
          <div className="flex flex-wrap gap-2">
            {teamStaff.map((u) => (
              <div
                key={u.id}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                  u.id === currentUser?.id ? 'bg-primary/15 text-primary border border-primary/25' : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {u.name}
                {u.id === currentUser?.id && <span className="text-[10px] opacity-70">(me)</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
