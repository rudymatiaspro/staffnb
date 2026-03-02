import { useState, useEffect, useCallback, useMemo } from 'react';
import { Delete, Clock, CheckCircle, LogIn, LogOut, AlertTriangle, Zap, ListTodo, X, Power } from 'lucide-react';
import logo from '../assets/logo.svg';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Task, User } from '../types';
import { supabase } from '../integrations/supabase/client';
import { verifyPin } from '../lib/pinCrypto';


// ─── Live Clock ───────────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-center select-none">
      <p className="text-6xl font-black text-foreground tabular-nums tracking-tight">
        {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
      <p className="text-sm text-muted-foreground mt-1 capitalize">
        {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </div>
  );
}

// ─── Urgency helpers ──────────────────────────────────────────────────────────
function getUrgency(task: Task): 'safe' | 'soon' | 'urgent' | 'overdue' {
  if (task.status === 'overdue') return 'overdue';
  const diff = task.deadline.getTime() - Date.now();
  const minutes = diff / 60000;
  if (minutes <= 0) return 'overdue';
  if (minutes <= 15) return 'urgent';
  if (minutes <= 45) return 'soon';
  return 'safe';
}

const URGENCY_CONFIG = {
  safe:    { bg: 'bg-[hsl(var(--timer-safe)/0.12)]',    border: 'border-[hsl(var(--timer-safe))]',    text: 'text-[hsl(var(--timer-safe))]',    badge: 'bg-[hsl(var(--timer-safe))]',    label: 'Dans les temps',  icon: CheckCircle },
  soon:    { bg: 'bg-amber-500/10',                       border: 'border-amber-400',                   text: 'text-amber-400',                   badge: 'bg-amber-400',                   label: 'Bientôt',        icon: Clock },
  urgent:  { bg: 'bg-orange-500/10',                      border: 'border-orange-500',                  text: 'text-orange-500',                  badge: 'bg-orange-500',                  label: 'URGENT',         icon: AlertTriangle },
  overdue: { bg: 'bg-destructive/10',                     border: 'border-destructive',                 text: 'text-destructive',                 badge: 'bg-destructive',                 label: 'EN RETARD',      icon: Zap },
};

function formatCountdown(task: Task): string {
  const diff = task.deadline.getTime() - Date.now();
  if (diff <= 0) {
    const abs = Math.abs(diff);
    const m = Math.floor(abs / 60000);
    const h = Math.floor(m / 60);
    if (h > 0) return `−${h}h${String(m % 60).padStart(2, '0')}`;
    return `−${m}min`;
  }
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h${String(m % 60).padStart(2, '0')}`;
  return `${m}min`;
}

const TEAM_LABELS: Record<string, string> = {
  FLOOR: 'Salle', KITCHEN: 'Cuisine', BAR: 'Bar',
  ATELIER: 'Atelier', MANAGEMENT: 'Management', ALL: 'Tous',
};

// ─── Validate staff PIN via Supabase (4-digit individual PIN) ─────────────────
async function validateStaffPin6(pin: string, users: User[]): Promise<User | null> {
  if (!pin || pin.length !== 6) return null;
  for (const u of users) {
    if (u.role === 'station') continue; // skip station device account
    // Fetch pin_hash from DB
    const { data } = await supabase
      .from('profiles')
      .select('pin_hash, pin_set')
      .eq('id', u.id)
      .maybeSingle();
    if (!data) continue;
    const storedHash = (data as any).pin_hash ?? '';
    let valid = false;
    if (!storedHash) {
      valid = pin === '000111'; // default PIN
    } else if (storedHash.includes(':')) {
      const res = await verifyPin(storedHash, pin);
      valid = res === 'match';
    } else {
      // legacy btoa
      try { valid = storedHash === btoa(pin); } catch { valid = false; }
    }
    if (valid) return u;
  }
  return null;
}

// ─── PIN Pad ──────────────────────────────────────────────────────────────────
// digits: 6 for staff identification, 6 for station device lock
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'];

interface PinPadProps {
  pin: string;
  error: boolean;
  onKey: (k: string) => void;
  label?: string;
  compact?: boolean;
  digits?: 4 | 6;
}
function PinPad({ pin, error, onKey, label, compact, digits = 4 }: PinPadProps) {
  return (
    <div className={compact ? 'w-full max-w-[220px]' : 'w-full max-w-xs'}>
      {label && <p className="text-center text-xs text-muted-foreground mb-3">{label}</p>}
      <div className="flex justify-center gap-2 mb-4">
        {Array.from({ length: digits }).map((_, i) => (
          <div key={i} className={`rounded-full transition-all duration-200 ${compact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} ${
            i < pin.length ? error ? 'bg-destructive scale-110' : 'bg-primary scale-110' : 'bg-secondary border-2 border-border'
          }`} />
        ))}
      </div>
      <div className={`grid grid-cols-3 ${compact ? 'gap-2' : 'gap-3'}`}>
        {KEYS.map((key) => (
          <button
            key={key}
            onClick={() => onKey(key)}
            className={`pin-btn ${compact ? 'h-10 text-base' : ''} ${key === 'clear' ? 'text-xs text-muted-foreground' : ''}`}
          >
            {key === 'del' ? <Delete className={compact ? 'w-4 h-4 mx-auto' : 'w-5 h-5 mx-auto'} /> : key === 'clear' ? 'CLR' : key}
          </button>
        ))}
      </div>
    </div>
  );
}


// ─── Hero Task Card ───────────────────────────────────────────────────────────
interface HeroTaskProps {
  task: Task;
  onValidate: () => void;
}
function HeroTaskCard({ task, onValidate }: HeroTaskProps) {
  const [countdown, setCountdown] = useState(formatCountdown(task));
  const urgency = getUrgency(task);
  const cfg = URGENCY_CONFIG[urgency];
  const Icon = cfg.icon;

  useEffect(() => {
    const id = setInterval(() => setCountdown(formatCountdown(task)), 1000);
    return () => clearInterval(id);
  }, [task]);

  return (
    <div className={`rounded-2xl border-2 ${cfg.border} ${cfg.bg} p-5 relative overflow-hidden transition-all`}>
      {/* Pulse animation for urgent/overdue */}
      {(urgency === 'urgent' || urgency === 'overdue') && (
        <div className={`absolute inset-0 rounded-2xl border-2 ${cfg.border} animate-ping opacity-20 pointer-events-none`} />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${cfg.badge}`}>
              {cfg.label}
            </span>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {TEAM_LABELS[task.team] || task.team}
            </span>
          </div>
          <h2 className="text-xl font-black text-foreground leading-tight truncate">{task.name}</h2>
          {task.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
          )}
          {task.assignedUserName && (
            <p className="text-xs text-muted-foreground mt-2">👤 {task.assignedUserName}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`text-2xl font-black tabular-nums ${cfg.text}`}>{countdown}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {task.deadline.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      <button
        onClick={onValidate}
        className={`mt-4 w-full py-3 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90 active:scale-95 ${cfg.badge}`}
      >
        <Icon className="w-4 h-4 inline mr-2" />
        Valider avec mon PIN
      </button>
    </div>
  );
}

// ─── Task List ────────────────────────────────────────────────────────────────
interface TaskRowProps {
  task: Task;
  onValidate: (task: Task) => void;
}
function TaskRow({ task, onValidate }: TaskRowProps) {
  const urgency = getUrgency(task);
  const cfg = URGENCY_CONFIG[urgency];

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${
      task.status === 'done' ? 'border-border/30 opacity-50' : `border-border ${cfg.bg}`
    }`}>
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.status === 'done' ? 'bg-[hsl(var(--timer-safe))]' : cfg.badge}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {task.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {task.deadline.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          {task.assignedUserName && ` · ${task.assignedUserName}`}
        </p>
      </div>
      {task.status !== 'done' && (
        <button
          onClick={() => onValidate(task)}
          className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors flex-shrink-0"
        >
          Valider
        </button>
      )}
      {task.status === 'done' && <CheckCircle className="w-4 h-4 text-[hsl(var(--timer-safe))] flex-shrink-0" />}
    </div>
  );
}

// ─── Main Station Page ────────────────────────────────────────────────────────
type StationMode = 'idle' | 'clock_confirmed' | 'task_pin' | 'task_confirmed';

export default function Station() {
  const { clockAction, getTodayTasks, completeTask, users, logout } = useApp();
  const { signOut } = useAuth();


  // Clock-in/out state
  const [clockPin, setClockPin] = useState('');
  const [clockState, setClockState] = useState<'idle' | 'confirmed'>('idle');
  const [clockResult, setClockResult] = useState<{ name: string; action: 'in' | 'out' } | null>(null);
  const [clockError, setClockError] = useState(false);

  // Task validation state
  const [taskToValidate, setTaskToValidate] = useState<Task | null>(null);
  const [taskPin, setTaskPin] = useState('');
  const [taskError, setTaskError] = useState(false);
  const [taskResult, setTaskResult] = useState<{ taskName: string; userName: string } | null>(null);

  // Tasks
  const allTasks = getTodayTasks();
  const pendingTasks = useMemo(() =>
    allTasks
      .filter(t => t.status === 'pending' || t.status === 'overdue')
      .sort((a, b) => a.deadline.getTime() - b.deadline.getTime()),
    [allTasks]
  );

  const heroTask = pendingTasks[0] ?? null;

  // ── Clock-in/out PIN logic (4-digit individual staff PIN) ────────────────
  const handleClockKey = useCallback(async (key: string) => {
    if (clockState !== 'idle') return;
    if (key === 'clear') { setClockPin(''); setClockError(false); return; }
    if (key === 'del') { setClockPin(p => p.slice(0, -1)); setClockError(false); return; }
    if (clockPin.length >= 4) return;
    const next = clockPin + key;
    setClockPin(next);
    if (next.length === 4) {
      setTimeout(async () => {
        // Verify 4-digit individual staff PIN via Supabase
        const user = await validateStaffPin4(next, users);
        if (!user) {
          setClockError(true);
          setClockPin('');
          setTimeout(() => setClockError(false), 1500);
          return;
        }
        const action = clockAction(user.id);

        // ── Planning integration: check if shift is planned ─────────────
        if (action === 'in') {
          const today = new Date().toISOString().split('T')[0];
          const { data: plannedShifts } = await supabase
            .from('planning_shifts')
            .select('id, shift_start, shift_end')
            .eq('user_id', user.id)
            .eq('date', today);

          const isPlanned = (plannedShifts?.length ?? 0) > 0;
          if (!isPlanned) {
            const { data: managers } = await supabase
              .from('user_roles')
              .select('user_id')
              .in('role', ['manager', 'owner', 'admin']);
            if (managers?.length) {
              await supabase.from('notifications').insert(
                managers.map((m) => ({
                  user_id: m.user_id,
                  type: 'unplanned_clockin',
                  title: `⚠️ Pointage non planifié — ${user.name}`,
                  body: `${user.name} a pointé son entrée sans être planifié aujourd'hui.`,
                  ref_type: 'shift',
                }))
              );
            }
          }
        }

        setClockResult({ name: user.name, action });
        setClockState('confirmed');
        setTimeout(() => { setClockState('idle'); setClockPin(''); setClockResult(null); }, 4000);
      }, 100);
    }
  }, [clockPin, clockState, clockAction, users]);

  // ── Task validation PIN logic (4-digit individual staff PIN) ─────────────
  const handleTaskKey = useCallback(async (key: string) => {
    if (key === 'clear') { setTaskPin(''); setTaskError(false); return; }
    if (key === 'del') { setTaskPin(p => p.slice(0, -1)); setTaskError(false); return; }
    if (taskPin.length >= 4) return;
    const next = taskPin + key;
    setTaskPin(next);
    if (next.length === 4) {
      setTimeout(async () => {
        const user = await validateStaffPin4(next, users);
        if (!user || !taskToValidate) {
          setTaskError(true);
          setTaskPin('');
          setTimeout(() => setTaskError(false), 1500);
          return;
        }
        completeTask(taskToValidate.id);
        try {
          await supabase.from('tasks').update({
            status: 'done',
            validated_by: user.name,
            validated_at: new Date().toISOString(),
          }).eq('id', taskToValidate.id);
        } catch (e) { console.error('Task update error', e); }

        setTaskResult({ taskName: taskToValidate.name, userName: user.name });
        setTaskPin('');
        setTaskToValidate(null);
        setTimeout(() => setTaskResult(null), 4000);
      }, 100);
    }
  }, [taskPin, taskToValidate, completeTask, users]);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (taskToValidate) {
        if (e.key >= '0' && e.key <= '9') handleTaskKey(e.key);
        if (e.key === 'Backspace') handleTaskKey('del');
        if (e.key === 'Escape') { setTaskToValidate(null); setTaskPin(''); }
      } else {
        if (e.key >= '0' && e.key <= '9') handleClockKey(e.key);
        if (e.key === 'Backspace') handleClockKey('del');
        if (e.key === 'Escape') handleClockKey('clear');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleClockKey, handleTaskKey, taskToValidate]);

  const showingTaskResult = taskResult !== null;
  const showingClockResult = clockState === 'confirmed';

  return (
    <div className="min-h-screen bg-background flex flex-col select-none">

      {/* ── Task validation result overlay ────────────────────────────────── */}
      {showingTaskResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card rounded-3xl p-8 text-center max-w-xs mx-4 shadow-2xl border border-[hsl(var(--timer-safe))]">
            <div className="w-20 h-20 rounded-full bg-[hsl(var(--timer-safe)/0.15)] border-4 border-[hsl(var(--timer-safe))] flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-[hsl(var(--timer-safe))]" />
            </div>
            <h2 className="text-xl font-black text-foreground mb-1">Tâche validée !</h2>
            <p className="text-sm text-muted-foreground mb-1">{taskResult?.taskName}</p>
            <p className="text-sm font-semibold text-primary">par {taskResult?.userName}</p>
          </div>
        </div>
      )}

      {/* ── Task PIN modal ────────────────────────────────────────────────── */}
      {taskToValidate && !showingTaskResult && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card rounded-3xl p-6 max-w-xs w-full mx-4 shadow-2xl border border-border">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-black text-foreground">Valider la tâche</h3>
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{taskToValidate.name}</p>
              </div>
              <button onClick={() => { setTaskToValidate(null); setTaskPin(''); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex justify-center">
              <PinPad
                pin={taskPin}
                error={taskError}
                onKey={handleTaskKey}
                label="Entrez votre PIN (4 chiffres) pour valider"
                compact
                digits={4}
              />
            </div>
            {taskError && (
              <p className="text-center text-xs text-destructive mt-3 font-medium">PIN incorrect — réessayez</p>
            )}
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <img src={logo} alt="Staff&B" className="h-8" />
        <LiveClock />
        <button
          onClick={() => { logout(); signOut(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-muted-foreground text-xs font-medium hover:text-foreground hover:border-destructive/40 transition-all"
          title="Déconnexion"
        >
          <Power className="w-3.5 h-3.5" />
          Déconnexion
        </button>
      </div>


      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-0 overflow-hidden">

        {/* Left: Clock in/out ──────────────────────────────────────────── */}
        <div className="w-80 flex-shrink-0 flex flex-col items-center justify-center px-6 border-r border-border">
          {showingClockResult ? (
            <div className="text-center animate-slide-up w-full max-w-xs">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                clockResult?.action === 'in' ? 'bg-[hsl(var(--timer-safe)/0.15)] border-4 border-[hsl(var(--timer-safe))]' : 'bg-primary/10 border-4 border-primary'
              }`}>
                {clockResult?.action === 'in'
                  ? <LogIn className="w-9 h-9 text-[hsl(var(--timer-safe))]" />
                  : <LogOut className="w-9 h-9 text-primary" />}
              </div>
              <h2 className="text-xl font-black text-foreground mb-1">
                {clockResult?.action === 'in' ? `Bonjour, ${clockResult?.name} !` : `À demain, ${clockResult?.name} !`}
              </h2>
              <p className={`text-sm font-semibold flex items-center justify-center gap-1.5 mt-2 ${
                clockResult?.action === 'in' ? 'text-[hsl(var(--timer-safe))]' : 'text-primary'
              }`}>
                <CheckCircle className="w-4 h-4" />
                {clockResult?.action === 'in' ? 'Pointage entrée enregistré' : 'Pointage sortie enregistré'}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground mb-5">Pointage</p>
              <PinPad
                pin={clockPin}
                error={clockError}
                onKey={handleClockKey}
                label="Entrez votre PIN (4 chiffres)"
                digits={4}
              />
              {clockError && (
                <p className="text-xs text-destructive font-medium mt-3 animate-wiggle">PIN inconnu — réessayez</p>
              )}
            </>
          )}
        </div>

        {/* Right: Tasks ──────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden px-6 py-4 gap-4">

          {/* Hero task */}
          {heroTask ? (
            <HeroTaskCard task={heroTask} onValidate={() => setTaskToValidate(heroTask)} />
          ) : (
            <div className="rounded-2xl border-2 border-[hsl(var(--timer-safe))] bg-[hsl(var(--timer-safe)/0.08)] p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[hsl(var(--timer-safe)/0.2)] flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-[hsl(var(--timer-safe))]" />
              </div>
              <div>
                <h2 className="text-lg font-black text-foreground">Toutes les tâches sont à jour !</h2>
                <p className="text-sm text-muted-foreground">Aucune tâche en attente pour le moment.</p>
              </div>
            </div>
          )}

          {/* Task list */}
          <div className="flex-1 overflow-y-auto space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <ListTodo className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Tâches du jour ({allTasks.filter(t => t.status === 'done').length}/{allTasks.length})
              </span>
            </div>
            {allTasks
              .sort((a, b) => {
                // done last, then by deadline
                if (a.status === 'done' && b.status !== 'done') return 1;
                if (a.status !== 'done' && b.status === 'done') return -1;
                return a.deadline.getTime() - b.deadline.getTime();
              })
              .map(task => (
                <TaskRow key={task.id} task={task} onValidate={setTaskToValidate} />
              ))}
            {allTasks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Aucune tâche planifiée aujourd'hui.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
