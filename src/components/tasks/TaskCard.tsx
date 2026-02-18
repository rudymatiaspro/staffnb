import { Task } from '../../types';
import { ZONE_CSS, ZONE_EMOJI } from '../../data/initialData';
import { useApp } from '../../context/AppContext';
import { CheckCircle, Clock, User, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface TaskCardProps {
  task: Task;
  canComplete?: boolean;
  canDelete?: boolean;
  onDelete?: () => void;
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

function getTimerClass(ms: number): string {
  if (ms <= 0) return 'timer-danger animate-pulse-danger';
  if (ms <= 5 * 60 * 1000) return 'timer-danger';
  if (ms <= 15 * 60 * 1000) return 'timer-warning';
  return 'timer-safe';
}

function getTimerLabel(ms: number): string {
  if (ms <= 0) return '⬛ EN RETARD';
  if (ms <= 5 * 60 * 1000) return '🔴';
  if (ms <= 15 * 60 * 1000) return '🟠';
  return '🟢';
}

function getStatusBadge(status: Task['status']) {
  switch (status) {
    case 'done': return { label: '✓ Validé', className: 'bg-green-500/10 text-green-400 border-green-500/20' };
    case 'overdue': return { label: '⚠ En retard', className: 'bg-destructive/10 text-destructive border-destructive/20' };
    case 'in_progress': return { label: '⏳ En cours', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
    default: return { label: '○ En attente', className: 'bg-muted text-muted-foreground border-border' };
  }
}

export function TaskCard({ task, canComplete = true, canDelete = false, onDelete }: TaskCardProps) {
  const { completeTask, currentUser } = useApp();
  const [timeLeft, setTimeLeft] = useState(task.deadline.getTime() - Date.now());

  useEffect(() => {
    if (task.status === 'done') return;
    const interval = setInterval(() => {
      setTimeLeft(task.deadline.getTime() - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [task.deadline, task.status]);

  const isOverdue = task.status === 'overdue' || timeLeft <= 0;
  const isDone = task.status === 'done';
  const statusBadge = getStatusBadge(task.status);
  const timerClass = getTimerClass(timeLeft);

  const handleComplete = () => {
    if (!isDone && currentUser) {
      completeTask(task.id);
    }
  };

  return (
    <div
      className={`rounded-xl p-4 border transition-all animate-slide-up ${
        isDone
          ? 'opacity-60 glass-card'
          : isOverdue
          ? 'timer-overdue border-destructive/30 bg-destructive/5'
          : `zone-card ${ZONE_CSS[task.zone]}`
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{ZONE_EMOJI[task.zone]}</span>
            <h3 className={`font-semibold text-sm leading-tight ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {task.name}
            </h3>
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{task.description}</p>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-md border flex-shrink-0 ${statusBadge.className}`}>
          {statusBadge.label}
        </span>
      </div>

      {/* Timer + Zone badges */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {!isDone && (
            <div className={`flex items-center gap-1.5 text-sm font-mono font-bold ${timerClass}`}>
              <Clock className="w-3.5 h-3.5" />
              <span>{getTimerLabel(timeLeft)} {formatDuration(timeLeft)}</span>
            </div>
          )}
          {isDone && task.validatedBy && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="w-3 h-3" />
              <span>{task.validatedBy} · {task.validatedAt?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canDelete && onDelete && (
            <button
              onClick={onDelete}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1"
            >
              ✕
            </button>
          )}
          {canComplete && !isDone && (
            <button
              onClick={handleComplete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/15 hover:bg-primary/25 text-primary border border-primary/25 transition-all active:scale-95"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Valider
            </button>
          )}
        </div>
      </div>

      {/* Deadline time */}
      <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Deadline : {task.deadline.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className={`text-xs px-1.5 py-0.5 rounded zone-badge ${ZONE_CSS[task.zone]}`}>
          {task.zone}
        </span>
      </div>
    </div>
  );
}
