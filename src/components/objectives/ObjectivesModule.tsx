import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { TeamObjective, Team } from '../../types';
import { Target, Plus, X, Trophy, TrendingUp, Calendar } from 'lucide-react';
import { TEAM_LABELS } from '../../data/initialData';

interface Props {
  canManage?: boolean;
  teamFilter?: Team;
}

function getProgressColor(pct: number) {
  if (pct >= 100) return 'hsl(var(--timer-safe))';
  if (pct >= 80) return 'hsl(var(--timer-safe))';
  if (pct >= 50) return 'hsl(var(--timer-warning))';
  return 'hsl(var(--timer-danger))';
}

function getProgressLabel(pct: number) {
  if (pct >= 100) return 'text-timer-safe';
  if (pct >= 50) return 'text-amber-500';
  return 'text-timer-danger';
}

export function ObjectivesModule({ canManage = false, teamFilter }: Props) {
  const { objectives, currentUser, getTodayTasks, addObjective, updateObjective, deleteObjective } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);
  const allTasks = getTodayTasks();

  // Auto-track task completion rate
  const taskCompletionRate = allTasks.length > 0
    ? Math.round((allTasks.filter(t => t.status === 'done').length / allTasks.length) * 100)
    : 0;

  // Auto-update objectives that track task completion
  useEffect(() => {
    objectives.forEach(obj => {
      if (obj.autoTrack && obj.autoTrackMetric === 'task_completion') {
        const prev = obj.currentValue;
        if (prev !== taskCompletionRate) {
          updateObjective(obj.id, { currentValue: taskCompletionRate });
        }
      }
    });
  }, [taskCompletionRate]);

  let filtered = objectives;
  if (teamFilter) {
    filtered = filtered.filter(o => o.team === teamFilter || o.team === 'ALL');
  }
  filtered = [...filtered].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  // Show celebration for newly completed objectives
  useEffect(() => {
    const justCompleted = filtered.find(o =>
      !o.completedAt && (o.currentValue / o.targetValue) >= 1
    );
    if (justCompleted) {
      setCelebration(justCompleted.id);
      const timer = setTimeout(() => setCelebration(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [filtered]);

  const activeObjectives = filtered.filter(o => !o.completedAt || (o.currentValue / o.targetValue) < 1);
  const completedObjectives = filtered.filter(o => o.completedAt || (o.currentValue / o.targetValue) >= 1);

  return (
    <div className="space-y-4">
      {/* Celebration banner */}
      {celebration && (
        <div className="rounded-xl p-4 bg-gradient-to-r from-amber-400/20 to-timer-safe/20 border border-amber-300/40 animate-slide-up">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">Goal reached! Great work team.</p>
              <p className="text-xs text-muted-foreground">Keep up the amazing performance!</p>
            </div>
            <button onClick={() => setCelebration(null)} className="ml-auto p-1 rounded-lg hover:bg-secondary"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Team Objectives
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeObjectives.length} active · {completedObjectives.length} completed
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => { setEditingId(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" />
            New Objective
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Target className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm font-medium text-foreground">No objectives set</p>
          {canManage && <p className="text-xs mt-1">Create team objectives to track progress</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(obj => {
            const pct = Math.min(100, Math.round((obj.currentValue / obj.targetValue) * 100));
            const isComplete = pct >= 100;
            const deadline = new Date(obj.deadline);
            const isOverdue = deadline < new Date() && !isComplete;

            return (
              <div key={obj.id} className={`glass-card rounded-xl p-4 space-y-3 ${isComplete ? 'border border-timer-safe/30 bg-timer-safe/5' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground">{obj.title}</span>
                      {obj.team !== 'ALL' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground">{TEAM_LABELS[obj.team as Team] || obj.team}</span>
                      )}
                      {isComplete && <Trophy className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    {obj.description && <p className="text-[10px] text-muted-foreground mt-0.5">{obj.description}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-black ${getProgressLabel(pct)}`}>{pct}%</p>
                    <p className="text-[9px] text-muted-foreground">{obj.currentValue}/{obj.targetValue}{obj.unit !== '%' ? ` ${obj.unit}` : ''}</p>
                  </div>
                </div>

                <div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: getProgressColor(pct) }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span className={isOverdue ? 'text-timer-danger font-medium' : ''}>
                      {isOverdue ? 'Overdue · ' : 'Due '}
                      {deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  {obj.autoTrack && (
                    <span className="flex items-center gap-1 text-primary">
                      <TrendingUp className="w-3 h-3" />
                      Auto-tracked
                    </span>
                  )}
                </div>

                {canManage && !isComplete && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => { setEditingId(obj.id); setShowForm(true); }}
                      className="flex-1 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(obj.id)}
                      className="px-3 py-1.5 rounded-lg text-xs text-timer-danger hover:bg-destructive/10"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <ObjectiveFormModal
          editingObjective={editingId ? objectives.find(o => o.id === editingId) : undefined}
          onClose={() => { setShowForm(false); setEditingId(null); }}
          onSubmit={(data) => {
            if (editingId) {
              updateObjective(editingId, data);
            } else {
              addObjective({ ...data, createdBy: currentUser?.name, createdByUserId: currentUser?.id });
            }
            setShowForm(false);
            setEditingId(null);
          }}
          taskCompletionRate={taskCompletionRate}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-border">
            <h3 className="text-sm font-bold text-foreground mb-2">Delete Objective?</h3>
            <p className="text-xs text-muted-foreground mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={() => { deleteObjective(deleteId); setDeleteId(null); }} className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold hover:opacity-90">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ObjectiveFormModal({ editingObjective, onClose, onSubmit, taskCompletionRate }: {
  editingObjective?: TeamObjective;
  onClose: () => void;
  onSubmit: (data: Partial<TeamObjective>) => void;
  taskCompletionRate: number;
}) {
  const TEAMS_LIST = ['ALL', 'BAR', 'KITCHEN', 'FLOOR', 'ATELIER'] as const;
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const [form, setForm] = useState<{
    title: string; description: string; targetValue: string; currentValue: string;
    unit: string; team: string; deadline: string; autoTrack: boolean; autoTrackMetric: string;
  }>({
    title: editingObjective?.title || '',
    description: editingObjective?.description || '',
    targetValue: String(editingObjective?.targetValue || 95),
    currentValue: String(editingObjective?.currentValue || 0),
    unit: editingObjective?.unit || '%',
    team: editingObjective?.team || 'ALL',
    deadline: editingObjective?.deadline || nextWeek,
    autoTrack: editingObjective?.autoTrack || false,
    autoTrackMetric: editingObjective?.autoTrackMetric || 'task_completion',
  });
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.targetValue || isNaN(parseFloat(form.targetValue))) { setError('Target value is required'); return; }
    if (!form.deadline) { setError('Deadline is required'); return; }
    onSubmit({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      targetValue: parseFloat(form.targetValue),
      currentValue: form.autoTrack ? taskCompletionRate : parseFloat(form.currentValue || '0'),
      unit: form.unit,
      team: form.team as Team | 'ALL',
      deadline: form.deadline,
      autoTrack: form.autoTrack,
      autoTrackMetric: form.autoTrack ? form.autoTrackMetric : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl p-6 max-w-md w-full shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-foreground">{editingObjective ? 'Edit Objective' : 'New Objective'}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">Title <span className="text-timer-danger">*</span></label>
            <input type="text" placeholder="e.g. Complete 95% of daily tasks" value={form.title}
              onChange={e => { setForm(p => ({ ...p, title: e.target.value })); setError(''); }}
              className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">Description</label>
            <input type="text" placeholder="Optional description" value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Target Value <span className="text-timer-danger">*</span></label>
              <input type="number" min="0" value={form.targetValue}
                onChange={e => setForm(p => ({ ...p, targetValue: e.target.value }))}
                className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Unit</label>
              <input type="text" placeholder="% or number" value={form.unit}
                onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Team</label>
              <select value={form.team} onChange={e => setForm(p => ({ ...p, team: e.target.value }))}
                className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground">
                {TEAMS_LIST.map(t => <option key={t} value={t}>{t === 'ALL' ? 'All Teams' : TEAM_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Deadline <span className="text-timer-danger">*</span></label>
              <input type="date" min={today} value={form.deadline}
                onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
                className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-secondary/60 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.autoTrack}
                onChange={e => setForm(p => ({ ...p, autoTrack: e.target.checked }))}
                className="rounded" />
              <span className="text-xs font-medium text-foreground">Auto-track from task completion rate</span>
            </label>
            {form.autoTrack && (
              <p className="text-[10px] text-muted-foreground pl-5">
                Currently: {taskCompletionRate}% of today's tasks completed
              </p>
            )}
          </div>

          {!form.autoTrack && (
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Current Value</label>
              <input type="number" min="0" value={form.currentValue}
                onChange={e => setForm(p => ({ ...p, currentValue: e.target.value }))}
                className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          )}

          {error && <p className="text-[10px] text-timer-danger">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-secondary">Cancel</button>
            <button onClick={handleSubmit} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90">
              {editingObjective ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
