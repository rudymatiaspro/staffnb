import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import { Target, Trophy, TrendingUp } from 'lucide-react';
import { TEAM_LABELS } from '../../data/initialData';
import { Team } from '../../types';

interface Objective {
  id: string;
  title: string;
  current_value: number;
  target_value: number;
  unit: string;
  team: string;
  auto_track: boolean;
  auto_track_metric: string | null;
  completed_at: string | null;
}

function getBarColor(pct: number) {
  if (pct >= 100) return 'hsl(var(--timer-safe))';
  if (pct >= 80)  return 'hsl(var(--timer-safe))';
  if (pct >= 50)  return 'hsl(var(--timer-warning))';
  return 'hsl(var(--timer-danger))';
}

function getBarLabel(pct: number): string {
  if (pct >= 100) return 'text-timer-safe';
  if (pct >= 50)  return 'text-amber-500';
  return 'text-timer-danger';
}

interface Props {
  /** If set, only show objectives matching this team (or ALL) */
  team?: Team;
  /** Compact single-bar mode (for home dashboard widget) */
  compact?: boolean;
}

export function DailyObjectiveBar({ team, compact = false }: Props) {
  const { getTodayTasks } = useApp();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);

  // Local task completion rate (used as fallback for auto-tracked objectives)
  const allTasks = getTodayTasks(team);
  const done = allTasks.filter(t => t.status === 'done').length;
  const localCompletionPct = allTasks.length > 0 ? Math.round((done / allTasks.length) * 100) : 0;

  const fetchObjectives = useCallback(async () => {
    const { data } = await supabase
      .from('team_objectives')
      .select('id, title, current_value, target_value, unit, team, auto_track, auto_track_metric, completed_at')
      .order('created_at', { ascending: true });

    if (!data) return;

    let filtered = data as Objective[];
    if (team) {
      filtered = filtered.filter(o => o.team === team || o.team === 'ALL');
    }
    setObjectives(filtered);
    setLoading(false);
  }, [team]);

  useEffect(() => {
    fetchObjectives();

    // Realtime: re-fetch when team_objectives change
    const channel = supabase
      .channel('daily-objective-bar')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_objectives',
      }, () => fetchObjectives())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchObjectives]);

  if (loading || objectives.length === 0) return null;

  // In compact mode: show one aggregated bar (average of all active objectives)
  if (compact) {
    const active = objectives.filter(o => !o.completed_at || (o.current_value / o.target_value) < 1);
    if (active.length === 0) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-timer-safe/10 border border-timer-safe/25">
          <Trophy className="w-3.5 h-3.5 text-timer-safe flex-shrink-0" />
          <span className="text-xs font-semibold text-timer-safe">Tous les objectifs atteints ! 🎉</span>
        </div>
      );
    }

    // Use the first auto-tracked objective as the main progress indicator
    const main = active.find(o => o.auto_track) ?? active[0];
    const rawPct = main.auto_track && main.auto_track_metric === 'task_completion'
      ? localCompletionPct
      : Math.round((main.current_value / main.target_value) * 100);
    const pct = Math.min(100, rawPct);
    const isComplete = pct >= 100;

    return (
      <div className={`glass-card rounded-xl p-3.5 space-y-2 ${isComplete ? 'border border-timer-safe/30 bg-timer-safe/5' : ''}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="text-xs font-semibold text-foreground truncate">{main.title}</span>
            {main.team !== 'ALL' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground flex-shrink-0">
                {TEAM_LABELS[main.team as Team] ?? main.team}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isComplete && <Trophy className="w-3.5 h-3.5 text-amber-400" />}
            <span className={`text-xs font-black ${getBarLabel(pct)}`}>{pct}%</span>
          </div>
        </div>

        {/* Animated bar */}
        <div className="relative h-2.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${pct}%`, background: getBarColor(pct) }}
          />
        {/* Shimmer on active bar */}
          {!isComplete && pct > 5 && (
            <div
              className="absolute inset-y-0 left-0 rounded-full opacity-20 bg-white/60"
              style={{ width: `${pct}%` }}
            />
          )}
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>
            {main.auto_track && main.auto_track_metric === 'task_completion'
              ? `${done} / ${allTasks.length} tâches`
              : `${main.current_value} / ${main.target_value} ${main.unit}`
            }
          </span>
          {active.length > 1 && (
            <span className="flex items-center gap-1">
              <TrendingUp className="w-2.5 h-2.5" />
              +{active.length - 1} autre{active.length > 2 ? 's' : ''}
            </span>
          )}
        </div>

        {isComplete && (
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-timer-safe animate-slide-up">
            <Trophy className="w-3 h-3" />
            Objectif atteint ! Excellent travail 🎉
          </div>
        )}
      </div>
    );
  }

  // Full mode: one card per objective
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Objectifs</h3>
        <span className="text-xs text-muted-foreground">
          {objectives.filter(o => (o.current_value / o.target_value) >= 1).length}/{objectives.length} atteints
        </span>
      </div>

      {objectives.map(obj => {
        const rawPct = obj.auto_track && obj.auto_track_metric === 'task_completion'
          ? localCompletionPct
          : Math.round((obj.current_value / obj.target_value) * 100);
        const pct = Math.min(100, rawPct);
        const isComplete = pct >= 100;

        return (
          <div
            key={obj.id}
            className={`glass-card rounded-xl p-4 space-y-2.5 ${isComplete ? 'border border-timer-safe/30 bg-timer-safe/5' : ''}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Target className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span className="text-xs font-semibold text-foreground truncate">{obj.title}</span>
                {obj.team !== 'ALL' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground flex-shrink-0">
                    {TEAM_LABELS[obj.team as Team] ?? obj.team}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isComplete && <Trophy className="w-3.5 h-3.5 text-amber-400" />}
                <span className={`text-sm font-black ${getBarLabel(pct)}`}>{pct}%</span>
              </div>
            </div>

            {/* Animated progress bar */}
            <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${pct}%`, background: getBarColor(pct) }}
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {obj.auto_track && obj.auto_track_metric === 'task_completion'
                  ? `${done} / ${allTasks.length} tâches complétées`
                  : `${obj.current_value} / ${obj.target_value} ${obj.unit}`
                }
              </span>
              {isComplete ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-timer-safe">
                  <Trophy className="w-3 h-3" />
                  Objectif atteint ! 🎉
                </span>
              ) : (
                obj.auto_track && (
                  <span className="flex items-center gap-1 text-[10px] text-primary">
                    <TrendingUp className="w-2.5 h-2.5" />
                    Auto-suivi
                  </span>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
