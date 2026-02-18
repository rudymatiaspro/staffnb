import { Task } from '../../types';
import { ZONE_CSS, ZONE_EMOJI } from '../../data/initialData';
import { useApp } from '../../context/AppContext';
import { CheckCircle, Clock, User, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface TaskCardProps {
  task: Task;
  canComplete?: boolean;
  canDelete?: boolean;
  onDelete?: () => void;
  compact?: boolean;
}

function getTimeLeftMs(deadline: Date): number {
  return deadline.getTime() - Date.now();
}

function formatDuration(ms: number): string {
  if (ms <= 0) return 'En retard';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

function getTimerState(ms: number): 'safe' | 'warning' | 'danger' | 'overdue' {
  if (ms <= 0) return 'overdue';
  if (ms <= 5 * 60 * 1000) return 'danger';
  if (ms <= 15 * 60 * 1000) return 'warning';
  return 'safe';
}

function getTimerEmoji(ms: number): string {
  if (ms <= 0) return '⬛';
  if (ms <= 5 * 60 * 1000) return '🔴';
  if (ms <= 15 * 60 * 1000) return '🟠';
  return '🟢';
}

const timerClasses = {
  safe: 'text-timer-safe',
  warning: 'text-timer-warning',
  danger: 'text-timer-danger animate-pulse-danger',
  overdue: 'text-timer-danger animate-pulse-danger',
};

function getStatusStyle(status: Task['status']): { label: string; cls: string } {
  switch (status) {
    case 'done': return { label: '✓ Validé', cls: 'bg-green-500/10 text-green-400 border-green-500/20' };
    case 'overdue': return { label: '⚠ En retard', cls: 'bg-red-500/10 text-red-400 border-red-500/20' };
    case 'in_progress': return { label: '⏳ En cours', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
    default: return { label: '○ En attente', cls: 'bg-muted text-muted-foreground border-border' };
  }
}

export function TaskCard({ task, canComplete = true, canDelete = false, onDelete, compact = false }: TaskCardProps) {
  const { completeTask } = useApp();
  const [timeLeft, setTimeLeft] = useState(getTimeLeftMs(task.deadline));

  useEffect(() => {
    if (task.status === 'done') return;
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeftMs(task.deadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [task.deadline, task.status]);

  const isDone = task.status === 'done';
  const isOverdue = task.status === 'overdue' || (task.status !== 'done' && timeLeft <= 0);
  const timerState = isDone ? 'safe' : getTimerState(timeLeft);
  const statusStyle = getStatusStyle(task.status);

  const cardBg = isDone
    ? 'bg-muted/30 border-border/50 opacity-75'
    : isOverdue
    ? 'bg-red-950/30 border-red-500/25'
    : `zone-card ${ZONE_CSS[task.zone]}`;

  if (compact) {
    return (
      <div className={`rounded-lg p-3 border transition-all ${cardBg}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm flex-shrink-0">{ZONE_EMOJI[task.zone]}</span>
            <p className={`text-xs font-semibold truncate ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {task.name}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!isDone && (
              <span className={`text-xs font-mono font-bold ${timerClasses[timerState]}`}>
                {getTimerEmoji(timeLeft)} {formatDuration(timeLeft)}
              </span>
            )}
            {canComplete && !isDone && (
              <button
                onClick={() => completeTask(task.id)}
                className="p-1 rounded-md bg-primary/15 hover:bg-primary/30 text-primary transition-all active:scale-95"
                title="Valider"
              >
                <CheckCircle className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && onDelete && (
              <button onClick={onDelete} className="p-1 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl p-4 border transition-all animate-slide-up ${cardBg}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{ZONE_EMOJI[task.zone]}</span>
            <h3 className={`font-semibold text-sm leading-tight ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {task.name}
            </h3>
            {task.isPunctual && (
              <span className="text-[10px] bg-primary/15 text-primary border border-primary/20 px-1.5 rounded-full flex-shrink-0">
                Ponctuel
              </span>
            )}
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground leading-relaxed pl-7">{task.description}</p>
          )}
          {task.assignedUserName && !isDone && (
            <p className="text-xs text-muted-foreground pl-7 mt-0.5 flex items-center gap-1">
              <User className="w-3 h-3" /> {task.assignedUserName}
            </p>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-md border flex-shrink-0 ${statusStyle.cls}`}>
          {statusStyle.label}
        </span>
      </div>

      {/* Timer row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!isDone ? (
            <div className={`flex items-center gap-1.5 text-sm font-mono font-bold ${timerClasses[timerState]}`}>
              <Clock className="w-3.5 h-3.5" />
              {getTimerEmoji(timeLeft)} {formatDuration(timeLeft)}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="w-3 h-3" />
              <span>
                {task.validatedBy} ·{' '}
                {task.validatedAt?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canDelete && onDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
              title="Supprimer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {canComplete && !isDone && (
            <button
              onClick={() => completeTask(task.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/15 hover:bg-primary/25 text-primary border border-primary/25 transition-all active:scale-95 select-none"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Valider
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Deadline : {task.deadline.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className={`text-xs px-1.5 py-0.5 rounded zone-badge ${ZONE_CSS[task.zone]}`}>
          {task.zone === 'ALL' ? '🌐 TOUTES ZONES' : task.zone}
        </span>
      </div>
    </div>
  );
}
