import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Trophy, TrendingUp, CheckCircle, AlertCircle, Target, Minus } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

interface ScoreEvent {
  id: string;
  user_id: string;
  user_name: string;
  type: 'bonus' | 'penalty' | 'collective_penalty';
  reason: string;
  points: number;
  timestamp: Date | string;
  team: string;
}

function EventIcon({ type, reason }: { type: string; reason: string }) {
  if (type === 'penalty' || type === 'collective_penalty') return <Minus className="w-3.5 h-3.5 text-destructive" />;
  if (reason.toLowerCase().includes('urgent')) return <AlertCircle className="w-3.5 h-3.5 text-orange-500" />;
  if (reason.toLowerCase().includes('objectif') || reason.toLowerCase().includes('objective')) return <Target className="w-3.5 h-3.5 text-primary" />;
  return <CheckCircle className="w-3.5 h-3.5 text-primary" />;
}

export function MonScore() {
  const { currentUser, staffRankings } = useApp();
  const [events, setEvents] = useState<ScoreEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Import supabase lazily
  const loadEvents = async () => {
    if (loaded || loading) return;
    setLoading(true);
    const { supabase } = await import('../../integrations/supabase/client');
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data } = await supabase
      .from('score_events')
      .select('*')
      .eq('user_id', currentUser?.id ?? '')
      .gte('timestamp', startOfMonth)
      .order('timestamp', { ascending: false });

    setEvents((data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      user_id: r.user_id as string,
      user_name: r.user_name as string,
      type: r.type as 'bonus' | 'penalty' | 'collective_penalty',
      reason: r.reason as string,
      points: r.points as number,
      timestamp: new Date(r.timestamp as string),
      team: r.team as string,
    })));
    setLoaded(true);
    setLoading(false);
  };

  // Trigger load on mount
  useMemo(() => { loadEvents(); }, [currentUser?.id]);

  if (!currentUser) return null;

  const myRanking = staffRankings.find((r) => r.user_id === currentUser.id);
  const myScore = myRanking?.score ?? currentUser.score ?? 0;
  const myRank = myRanking?.overall_rank ?? null;
  const myTeamRank = myRanking?.team_rank ?? null;

  // Total earned this month
  const monthBonuses = events.filter(e => e.type === 'bonus').reduce((s, e) => s + e.points, 0);
  const monthPenalties = events.filter(e => e.type !== 'bonus').reduce((s, e) => s + e.points, 0);

  // Build chart data (cumulative per day)
  const chartData = useMemo(() => {
    const now = new Date();
    const days = new Array(now.getDate()).fill(0).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), i + 1);
      const dayStr = d.toLocaleDateString('fr-FR', { day: 'numeric' });
      const dayEvents = events.filter(e => {
        const eDate = new Date(e.timestamp);
        return eDate.getDate() === i + 1 && eDate.getMonth() === now.getMonth();
      });
      const dayPoints = dayEvents.reduce((s, e) => s + (e.type === 'bonus' ? e.points : -e.points), 0);
      return { day: dayStr, points: dayPoints };
    });

    // Make cumulative
    let cum = 0;
    return days.map((d) => { cum += d.points; return { ...d, total: cum }; });
  }, [events]);

  const formatDate = (d: Date | string) => {
    const date = new Date(d);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-5 px-4 pt-2">
      {/* Top card */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)' }}>
        <div className="p-5">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full bg-primary-foreground/20 flex items-center justify-center text-xl font-black text-primary-foreground border-2 border-primary-foreground/30 flex-shrink-0">
              {currentUser.photo ? (
                <img src={currentUser.photo} alt="" className="w-full h-full object-cover rounded-full" />
              ) : getInitials(currentUser.name)}
            </div>
            <div className="flex-1">
              <p className="text-primary-foreground/70 text-xs font-medium">{new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
              <p className="text-primary-foreground text-lg font-black leading-tight">{currentUser.name}</p>
            </div>
            <div className="text-center">
              <p className="text-primary-foreground text-3xl font-black leading-none">{myScore}</p>
              <p className="text-primary-foreground/70 text-[10px] font-medium">points</p>
            </div>
          </div>

          {/* Ranks */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-primary-foreground/20 rounded-xl p-2 text-center">
              <p className="text-primary-foreground text-lg font-black">{myRank ? `#${myRank}` : '—'}</p>
              <p className="text-primary-foreground/70 text-[10px]">Général</p>
            </div>
            <div className="bg-primary-foreground/20 rounded-xl p-2 text-center">
              <p className="text-primary-foreground text-lg font-black text-green-300">+{monthBonuses}</p>
              <p className="text-primary-foreground/70 text-[10px]">Bonus mois</p>
            </div>
            <div className="bg-primary-foreground/20 rounded-xl p-2 text-center">
              <p className="text-primary-foreground text-lg font-black text-red-300">-{monthPenalties}</p>
              <p className="text-primary-foreground/70 text-[10px]">Malus mois</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <h3 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            Évolution ce mois
          </h3>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} formatter={(v) => [`${v} pts`, 'Total']} />
              <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#scoreGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Events list */}
      <div>
        <h3 className="text-xs font-bold text-foreground mb-3">Historique du mois</h3>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-xs">Chargement...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium text-foreground">Aucun événement ce mois</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => {
              const isBonus = event.type === 'bonus';
              return (
                <div key={event.id} className="bg-card rounded-xl border border-border flex items-center gap-3 px-4 py-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isBonus ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                    <EventIcon type={event.type} reason={event.reason} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{event.reason || 'Événement score'}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(event.timestamp)}</p>
                  </div>
                  <span className={`text-sm font-black flex-shrink-0 ${isBonus ? 'text-primary' : 'text-destructive'}`}>
                    {isBonus ? '+' : '-'}{event.points}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
