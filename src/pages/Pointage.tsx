import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../integrations/supabase/client';
import { Clock, LogIn, LogOut, Calendar, CheckCircle } from 'lucide-react';

function formatTime(d: Date) {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
}

interface ShiftRow {
  id: string;
  date: string;
  clock_in: string;
  clock_out: string | null;
  total_minutes: number | null;
}

export default function Pointage() {
  const { currentUser } = useApp();
  const [activeShift, setActiveShift] = useState<ShiftRow | null>(null);
  const [history, setHistory] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);
  const [now, setNow] = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  const loadShifts = async () => {
    if (!currentUser) return;
    setLoading(true);

    // Get today's active shift
    const { data: todayShifts } = await supabase
      .from('shifts')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('date', todayStr)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1);

    setActiveShift(todayShifts?.[0] as ShiftRow ?? null);

    // Get last 7 days history
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const from = sevenDaysAgo.toISOString().split('T')[0];

    const { data: historyData } = await supabase
      .from('shifts')
      .select('*')
      .eq('user_id', currentUser.id)
      .gte('date', from)
      .order('clock_in', { ascending: false });

    setHistory((historyData ?? []) as ShiftRow[]);
    setLoading(false);
  };

  useEffect(() => { loadShifts(); }, [currentUser]);

  const handleClockIn = async () => {
    if (!currentUser || actioning) return;
    setActioning(true);
    const now = new Date();
    await supabase.from('shifts').insert({
      user_id: currentUser.id,
      user_name: currentUser.name,
      team: currentUser.team,
      clock_in: now.toISOString(),
      date: todayStr,
    });
    await loadShifts();
    setActioning(false);
  };

  const handleClockOut = async () => {
    if (!currentUser || !activeShift || actioning) return;
    setActioning(true);
    const clockInDate = new Date(activeShift.clock_in);
    const clockOutDate = new Date();
    const totalMinutes = Math.round((clockOutDate.getTime() - clockInDate.getTime()) / 60000);
    await supabase.from('shifts').update({
      clock_out: clockOutDate.toISOString(),
      total_minutes: totalMinutes,
    }).eq('id', activeShift.id);
    await loadShifts();
    setActioning(false);
  };

  if (!currentUser) return null;

  const clockInDate = activeShift ? new Date(activeShift.clock_in) : null;
  const elapsed = clockInDate ? now.getTime() - clockInDate.getTime() : 0;

  // Group history by date
  const byDate = history.reduce<Record<string, ShiftRow[]>>((acc, s) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push(s);
    return acc;
  }, {});

  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-5 px-4 pt-2 pb-4">
      {/* Clock-in card */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-5 text-center">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <p className="text-4xl font-black text-foreground mb-4 tabular-nums">
            {formatTime(now)}
          </p>

          {activeShift ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                <span className="text-sm font-semibold text-primary">En service</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-secondary rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">Arrivée</p>
                  <p className="text-lg font-bold text-foreground">{formatTime(clockInDate!)}</p>
                </div>
                <div className="bg-secondary rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">Durée</p>
                  <p className="text-lg font-bold text-primary tabular-nums">{formatDuration(elapsed)}</p>
                </div>
              </div>
              <button
                onClick={handleClockOut}
                disabled={actioning}
                className="w-full py-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive font-bold text-sm flex items-center justify-center gap-2 hover:bg-destructive/20 transition-colors active:scale-[0.98] disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                Pointer le départ
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-5">Vous n'êtes pas encore pointé aujourd'hui.</p>
              <button
                onClick={handleClockIn}
                disabled={actioning}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                Pointer l'arrivée
              </button>
            </>
          )}
        </div>
      </div>

      {/* History */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-bold text-foreground">Historique (7 derniers jours)</h2>
        </div>

        {loading ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-xs text-muted-foreground">Chargement...</p>
          </div>
        ) : dates.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">Aucun pointage</p>
            <p className="text-xs text-muted-foreground mt-1">Votre historique apparaîtra ici</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dates.map((date) => {
              const dayShifts = byDate[date];
              const isToday = date === todayStr;
              const dayLabel = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'short',
              });

              return (
                <div key={date} className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className={`px-4 py-2 flex items-center gap-2 border-b border-border ${isToday ? 'bg-primary/5' : 'bg-secondary/40'}`}>
                    <span className="text-xs font-bold text-foreground capitalize">{dayLabel}</span>
                    {isToday && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">Aujourd'hui</span>}
                  </div>
                  {dayShifts.map((shift) => {
                    const cIn = new Date(shift.clock_in);
                    const cOut = shift.clock_out ? new Date(shift.clock_out) : null;
                    const mins = shift.total_minutes ?? (cOut ? Math.round((cOut.getTime() - cIn.getTime()) / 60000) : null);

                    return (
                      <div key={shift.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                        <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                        <div className="flex-1">
                          <span className="font-medium text-foreground">{formatTime(cIn)}</span>
                          <span className="text-muted-foreground mx-2">→</span>
                          {cOut ? (
                            <span className="font-medium text-foreground">{formatTime(cOut)}</span>
                          ) : (
                            <span className="text-primary font-medium text-xs">En cours</span>
                          )}
                        </div>
                        {mins !== null && (
                          <span className="text-xs font-bold text-muted-foreground">
                            {Math.floor(mins / 60)}h{String(mins % 60).padStart(2, '0')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
