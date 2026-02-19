import { Task } from '../../types';
import { TEAM_CSS, TEAM_LABELS } from '../../data/initialData';
import { useApp } from '../../context/AppContext';
import { CheckCircle, Clock, User, Trash2, Wine, ChefHat, Layers, Users, Globe } from 'lucide-react';
import { useEffect, useState } from 'react';
import { TaskValidationModal } from './TaskValidationModal';
import { supabase } from '../../integrations/supabase/client';

interface TaskCardProps {
  task: Task;
  canComplete?: boolean;
  canDelete?: boolean;
  onDelete?: () => void;
  compact?: boolean;
}

const TEAM_ICONS: Record<string, React.ReactNode> = {
  BAR: <Wine className="w-3 h-3" />,
  KITCHEN: <ChefHat className="w-3 h-3" />,
  FLOOR: <Users className="w-3 h-3" />,
  ATELIER: <Layers className="w-3 h-3" />,
  MANAGEMENT: <Users className="w-3 h-3" />,
  ALL: <Globe className="w-3 h-3" />,
};

function getTimeLeftMs(deadline: Date): number {
  return deadline.getTime() - Date.now();
}

function formatDuration(ms: number): string {
  if (ms <= 0) return 'EN RETARD';
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
  if (ms <= 15 * 60 * 1000) return 'danger';   // 0-15 min → rouge
  if (ms <= 30 * 60 * 1000) return 'warning';  // 15-30 min → orange
  return 'safe';                                // >30 min → vert
}

function getTimerBadge(ms: number, isDone: boolean): { label: string; cls: string } | null {
  if (isDone) return null;
  if (ms <= 0)                    return { label: 'EN RETARD', cls: 'bg-zinc-950 text-red-400 border-red-700' };
  if (ms <= 15 * 60 * 1000)      return { label: formatDuration(ms), cls: 'bg-red-500/15 text-red-400 border-red-500/30' };
  if (ms <= 30 * 60 * 1000)      return { label: formatDuration(ms), cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30' };
  return                                { label: formatDuration(ms), cls: 'bg-green-500/15 text-green-400 border-green-500/30' };
}

const timerClasses = {
  safe: 'text-timer-safe',
  warning: 'text-timer-warning',
  danger: 'text-timer-danger animate-pulse-danger',
  overdue: 'text-timer-danger animate-pulse-danger',
};

const statusDotColor = {
  safe: 'bg-timer-safe',
  warning: 'bg-timer-warning',
  danger: 'bg-timer-danger',
  overdue: 'bg-timer-danger',
};

export function TaskCard({ task, canComplete = true, canDelete = false, onDelete, compact = false }: TaskCardProps) {
  const { completeTask } = useApp();
  const [timeLeft, setTimeLeft] = useState(getTimeLeftMs(task.deadline));
  const [showValidation, setShowValidation] = useState(false);

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
  const isUrgent = (task as { priority?: string }).priority === 'urgente' ||
                   task.description?.startsWith('[URGENTE]');
  const timerBadge = getTimerBadge(timeLeft, isDone);

  const cardBg = isDone
    ? 'bg-muted/30 border-border/50 opacity-75'
    : isOverdue
    ? 'bg-zinc-950 border-red-800/60'
    : `team-card ${TEAM_CSS[task.team]}`;

  const handleValidated = async (taskId: string, photoUrl: string) => {
    await supabase
      .from('tasks')
      .update({ photo_proof_url: photoUrl })
      .eq('id', taskId);
    completeTask(taskId);
    setShowValidation(false);
  };

  // ── COMPACT MODE ──────────────────────────────────────────────────────────
  if (compact) {
    return (
      <>
        <div className={`rounded-lg p-3 border transition-all ${cardBg}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm flex-shrink-0 text-muted-foreground">{TEAM_ICONS[task.team]}</span>
              <p className={`text-xs font-semibold truncate ${isDone ? 'line-through text-muted-foreground' : isOverdue ? 'text-red-400' : 'text-foreground'}`}>
                {task.name}
              </p>
              {isUrgent && !isDone && (
                <span className="text-[9px] bg-destructive/15 text-destructive border border-destructive/30 px-1 rounded-full flex-shrink-0 font-bold">⚡</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {!isDone && timerBadge && (
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${timerBadge.cls}`}>
                  {timerBadge.label}
                </span>
              )}
              {canComplete && !isDone && (
                <button
                  onClick={() => setShowValidation(true)}
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
        {showValidation && (
          <TaskValidationModal task={task} onClose={() => setShowValidation(false)} onValidated={handleValidated} />
        )}
      </>
    );
  }

  // ── FULL MODE ─────────────────────────────────────────────────────────────
  return (
    <>
      <div className={`rounded-xl p-4 border transition-all animate-slide-up ${cardBg}`}>

        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-base flex-shrink-0 text-muted-foreground">{TEAM_ICONS[task.team]}</span>
              <h3 className={`font-semibold text-sm leading-tight ${isDone ? 'line-through text-muted-foreground' : isOverdue ? 'text-red-400' : 'text-foreground'}`}>
                {task.name}
              </h3>
              {task.isPunctual && (
                <span className="text-[10px] bg-primary/15 text-primary border border-primary/20 px-1.5 rounded-full flex-shrink-0">
                  Ponctuel
                </span>
              )}
              {isUrgent && !isDone && (
                <span className="text-[10px] bg-destructive/15 text-destructive border border-destructive/30 px-1.5 py-0.5 rounded-full flex-shrink-0 flex items-center gap-0.5 font-bold">
                  ⚡ URGENTE
                </span>
              )}
            </div>
            {task.description && (
              <p className="text-xs text-muted-foreground leading-relaxed pl-5">
                {task.description.startsWith('[URGENTE]')
                  ? task.description.slice(9).trim()
                  : task.description}
              </p>
            )}
            {task.assignedUserName && !isDone && (
              <p className="text-xs text-muted-foreground pl-5 mt-0.5 flex items-center gap-1">
                <User className="w-3 h-3" /> {task.assignedUserName}
              </p>
            )}
          </div>

          {/* Timer badge — colour-coded */}
          {timerBadge && (
            <span className={`text-[11px] px-2 py-1 rounded-lg border font-bold flex-shrink-0 font-mono ${timerBadge.cls}`}>
              {timerBadge.label}
            </span>
          )}
          {isDone && (
            <span className="text-[11px] px-2 py-1 rounded-lg border flex-shrink-0 bg-green-500/10 text-green-400 border-green-500/20 font-semibold">
              Terminée ✓
            </span>
          )}
        </div>

        {/* Timer row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {!isDone ? (
              <div className={`flex items-center gap-1.5 text-sm font-mono font-bold ${timerClasses[timerState]}`}>
                <div className={`w-2 h-2 rounded-full ${statusDotColor[timerState]} ${timerState === 'danger' || timerState === 'overdue' ? 'animate-pulse-danger' : ''}`} />
                <Clock className="w-3.5 h-3.5" />
                {formatDuration(timeLeft)}
                {task.points && !isDone && (
                  <span className="ml-1 text-xs text-muted-foreground font-normal">+{task.points}pts</span>
                )}
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
                onClick={() => setShowValidation(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/15 hover:bg-primary/25 text-primary border border-primary/25 transition-all active:scale-95 select-none"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Terminer
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            À faire avant {task.deadline.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded team-badge ${TEAM_CSS[task.team]} flex items-center gap-1`}>
            {TEAM_ICONS[task.team]}
            {task.team === 'ALL' ? 'Toutes les équipes' : TEAM_LABELS[task.team]}
          </span>
        </div>
      </div>

      {/* Validation modal */}
      {showValidation && (
        <TaskValidationModal task={task} onClose={() => setShowValidation(false)} onValidated={handleValidated} />
      )}
    </>
  );
}
