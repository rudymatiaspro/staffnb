import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import { Trophy, TrendingUp, TrendingDown, Star, Award, Zap } from 'lucide-react';

interface ScoreEvent {
  id: string;
  userId: string;
  userName: string;
  team: string;
  type: 'bonus' | 'penalty' | 'collective_penalty';
  reason: string;
  points: number;
  timestamp: Date;
}

interface ScoreEventsViewProps {
  userId?: string; // if given, show only this user's events
  showAll?: boolean; // manager/owner: show everyone
}

export function ScoreEventsView({ userId, showAll = false }: ScoreEventsViewProps) {
  const { currentUser, users } = useApp();
  const [events, setEvents] = useState<ScoreEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'bonus' | 'penalty'>('all');

  const targetId = userId ?? currentUser?.id;

  const fetchEvents = useCallback(async () => {
    if (!targetId && !showAll) return;
    setLoading(true);
    let query = supabase.from('score_events').select('*').order('timestamp', { ascending: false }).limit(200);
    if (!showAll && targetId) query = query.eq('user_id', targetId);
    const { data } = await query;
    setEvents((data ?? []).map(r => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      team: r.team,
      type: r.type as ScoreEvent['type'],
      reason: r.reason,
      points: r.points,
      timestamp: new Date(r.timestamp),
    })));
    setLoading(false);
  }, [targetId, showAll]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const filtered = events.filter(e => {
    if (filter === 'bonus') return e.points > 0;
    if (filter === 'penalty') return e.points < 0;
    return true;
  });

  // Stats
  const totalPositive = events.filter(e => e.points > 0).reduce((s, e) => s + e.points, 0);
  const totalNegative = events.filter(e => e.points < 0).reduce((s, e) => s + e.points, 0);
  const totalNet = totalPositive + totalNegative;

  // Leaderboard by user (for showAll)
  const leaderboard = showAll
    ? Object.values(
        events.reduce((acc, e) => {
          if (!acc[e.userId]) acc[e.userId] = { userId: e.userId, userName: e.userName, team: e.team, net: 0 };
          acc[e.userId].net += e.points;
          return acc;
        }, {} as Record<string, { userId: string; userName: string; team: string; net: number }>)
      ).sort((a, b) => b.net - a.net)
    : [];

  return (
    <div className="space-y-5">
      {/* Global score card */}
      <div className="glass-card rounded-2xl p-5 border border-border">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Score total</p>
            <div className="flex items-end gap-2 mt-1">
              <span className={`text-5xl font-black tracking-tight ${totalNet >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                {totalNet > 0 ? '+' : ''}{totalNet}
              </span>
              <span className="text-sm text-muted-foreground mb-1">pts</span>
            </div>
          </div>
          <Trophy className="w-8 h-8 text-amber-400 opacity-80" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-timer-safe/10 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-timer-safe">+{totalPositive}</p>
            <p className="text-xs text-muted-foreground">Bonus gagnés</p>
          </div>
          <div className="bg-destructive/10 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-destructive">{totalNegative}</p>
            <p className="text-xs text-muted-foreground">Pénalités reçues</p>
          </div>
        </div>
      </div>

      {/* Leaderboard (for managers/owners) */}
      {showAll && leaderboard.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-foreground">Classement</h3>
          </div>
          <div className="space-y-2">
            {leaderboard.slice(0, 10).map((entry, idx) => (
              <div key={entry.userId} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                <span className={`text-sm font-black w-6 text-center ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-muted-foreground' : idx === 2 ? 'text-amber-700' : 'text-muted-foreground'}`}>
                  #{idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{entry.userName}</p>
                  <p className="text-xs text-muted-foreground">{entry.team}</p>
                </div>
                <span className={`text-sm font-bold ${entry.net >= 0 ? 'text-timer-safe' : 'text-destructive'}`}>
                  {entry.net > 0 ? '+' : ''}{entry.net}pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl">
        {(['all', 'bonus', 'penalty'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${filter === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
          >
            {f === 'all' ? 'Tout' : f === 'bonus' ? '✅ Bonus' : '❌ Pénalités'}
          </button>
        ))}
      </div>

      {/* Events list */}
      <div className="space-y-2">
        {loading && <p className="text-sm text-muted-foreground text-center py-4">Chargement…</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Aucun événement</p>
        )}
        {filtered.map(evt => (
          <div key={evt.id} className={`flex items-center gap-3 p-3 rounded-xl border ${evt.points > 0 ? 'bg-timer-safe/5 border-timer-safe/20' : 'bg-destructive/5 border-destructive/20'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${evt.points > 0 ? 'bg-timer-safe/20' : 'bg-destructive/20'}`}>
              {evt.points > 0 ? <TrendingUp className="w-4 h-4 text-timer-safe" /> : <TrendingDown className="w-4 h-4 text-destructive" />}
            </div>
            <div className="flex-1 min-w-0">
              {showAll && <p className="text-xs font-semibold text-foreground">{evt.userName}</p>}
              <p className="text-sm text-foreground truncate">{evt.reason || evt.type}</p>
              <p className="text-[10px] text-muted-foreground">
                {evt.timestamp.toLocaleDateString('fr-FR')} · {evt.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <span className={`text-sm font-black flex-shrink-0 ${evt.points > 0 ? 'text-timer-safe' : 'text-destructive'}`}>
              {evt.points > 0 ? '+' : ''}{evt.points}pts
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
