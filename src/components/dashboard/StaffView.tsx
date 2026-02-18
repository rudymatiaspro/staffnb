import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TaskCard } from '../tasks/TaskCard';
import { BonusScoreCard } from '../zones/BonusScoreCard';
import { Zone } from '../../types';
import { CheckCircle, Clock, ListChecks, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { ZONE_EMOJI } from '../../data/initialData';

export function StaffView() {
  const { currentUser, getTodayTasks, users } = useApp();
  const zone = currentUser?.zone as Zone;
  const [showDone, setShowDone] = useState(false);

  const allTasks = getTodayTasks(zone);
  const overdueTasks = allTasks
    .filter((t) => t.status === 'overdue')
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  const pendingTasks = allTasks
    .filter((t) => t.status === 'pending')
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  const doneTasks = allTasks.filter((t) => t.status === 'done');

  const myValidations = doneTasks.filter((t) => t.validatedBy === currentUser?.name);
  const zoneStaff = users.filter((u) => u.zone === zone && u.role === 'staff');

  return (
    <div className="space-y-5">
      {/* Bonus score card */}
      {zone && zone !== 'MANAGEMENT' && (
        <BonusScoreCard zone={zone} />
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-timer-danger">{overdueTasks.length}</p>
          <p className="text-xs text-muted-foreground">En retard</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-primary">{pendingTasks.length}</p>
          <p className="text-xs text-muted-foreground">En attente</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-timer-safe">{doneTasks.length}</p>
          <p className="text-xs text-muted-foreground">Complétées</p>
        </div>
      </div>

      {/* Overdue tasks — urgent */}
      {overdueTasks.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-timer-danger animate-pulse-danger" />
            <h2 className="text-sm font-bold text-timer-danger uppercase tracking-wide">
              En retard ({overdueTasks.length})
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
            À faire
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
            <p className="font-semibold text-foreground">Zone impeccable ! 🎉</p>
            <p className="text-sm mt-1">Toutes les tâches sont complétées</p>
          </div>
        ) : pendingTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucune tâche en attente</p>
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
                Complétées aujourd'hui
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

      {/* My validations today */}
      {myValidations.length > 0 && (
        <section className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Mes validations</h2>
            <span className="ml-auto text-xs text-muted-foreground">{myValidations.length} aujourd'hui</span>
          </div>
          <div className="space-y-1.5">
            {myValidations.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-border/30 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span>{ZONE_EMOJI[task.zone]}</span>
                  <span className="text-foreground truncate">{task.name}</span>
                </div>
                <span className="text-timer-safe font-medium flex-shrink-0">
                  {task.validatedAt?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Team in zone */}
      {zoneStaff.length > 1 && (
        <section className="glass-card rounded-xl p-4">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            Équipe {zone}
          </h2>
          <div className="flex flex-wrap gap-2">
            {zoneStaff.map((u) => (
              <div
                key={u.id}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                  u.id === currentUser?.id ? 'bg-primary/15 text-primary border border-primary/25' : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {ZONE_EMOJI[u.zone]} {u.name}
                {u.id === currentUser?.id && <span className="text-[10px] opacity-70">(moi)</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
