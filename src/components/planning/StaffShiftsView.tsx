import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { Sun, Moon, Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { TEAM_LABELS } from '@/data/initialData';
import { Team } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type ShiftType = 'morning' | 'evening';

interface PlanningShift {
  id: string;
  date: string;
  shift_type: ShiftType;
  shift_start: string;
  shift_end: string;
  team: string;
  note?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFT_STYLE: Record<ShiftType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  morning: {
    label: 'Matin',
    icon: <Sun className="w-4 h-4" />,
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/25',
  },
  evening: {
    label: 'Soir',
    icon: <Moon className="w-4 h-4" />,
    color: 'text-indigo-700 dark:text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/25',
  },
};

const WEEK_DAYS_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const WEEK_DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekDates(offset = 0): string[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function isToday(d: string) {
  return d === new Date().toISOString().split('T')[0];
}

function isPast(d: string) {
  return d < new Date().toISOString().split('T')[0];
}

function formatTime(t: string) {
  // DB returns "07:00:00" — trim seconds
  return t.slice(0, 5);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StaffShiftsView() {
  const { currentUser } = useApp();
  const [weekOffset, setWeekOffset] = useState(0);
  const [shifts, setShifts] = useState<PlanningShift[]>([]);
  const [loading, setLoading] = useState(true);

  const weekDates = getWeekDates(weekOffset);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  useEffect(() => {
    if (!currentUser) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('planning_shifts')
        .select('*')
        .eq('user_id', currentUser.id)
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .order('date')
        .order('shift_type');
      if (data) setShifts(data as PlanningShift[]);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`staff-planning-${currentUser.id}-${weekStart}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_shifts' }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id, weekStart, weekEnd]);

  // Group shifts by date for easy rendering
  const shiftsByDate = weekDates.reduce<Record<string, PlanningShift[]>>((acc, date) => {
    acc[date] = shifts.filter(s => s.date === date);
    return acc;
  }, {});

  const totalShifts = shifts.length;
  const upcomingShifts = shifts.filter(s => !isPast(s.date));

  // Find next shift
  const nextShift = upcomingShifts.find(s => !isPast(s.date) || isToday(s.date));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Mon Planning
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {totalShifts} shift{totalShifts !== 1 ? 's' : ''} cette semaine
        </p>
      </div>

      {/* Next shift banner */}
      {nextShift && weekOffset === 0 && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${SHIFT_STYLE[nextShift.shift_type].bg}`}>
          <div className={SHIFT_STYLE[nextShift.shift_type].color}>
            {SHIFT_STYLE[nextShift.shift_type].icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold ${SHIFT_STYLE[nextShift.shift_type].color}`}>
              {isToday(nextShift.date) ? "Aujourd'hui" : new Date(nextShift.date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}
              {SHIFT_STYLE[nextShift.shift_type].label}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(nextShift.shift_start)} – {formatTime(nextShift.shift_end)}
              {nextShift.team && (
                <span className="ml-2 px-1.5 py-0.5 bg-secondary rounded text-[10px] font-medium">
                  {TEAM_LABELS[nextShift.team as Team] ?? nextShift.team}
                </span>
              )}
            </p>
            {nextShift.note && (
              <p className="text-[10px] text-muted-foreground/70 mt-1 italic">📝 {nextShift.note}</p>
            )}
          </div>
        </div>
      )}

      {/* Week nav */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 glass-card rounded-xl">
        <button onClick={() => setWeekOffset(o => o - 1)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">
            {new Date(weekStart + 'T00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            {' — '}
            {new Date(weekEnd + 'T00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <button onClick={() => setWeekOffset(o => o + 1)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Week list */}
      {loading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Chargement...</div>
      ) : (
        <div className="space-y-2">
          {weekDates.map((date, i) => {
            const dayShifts = shiftsByDate[date];
            const past = isPast(date);
            const today = isToday(date);

            return (
              <div
                key={date}
                className={`rounded-xl border p-3 transition-colors ${
                  today
                    ? 'border-primary/40 bg-primary/5'
                    : past
                    ? 'border-border/30 bg-muted/10 opacity-50'
                    : 'border-border/50 bg-card/60'
                }`}
              >
                {/* Day header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    today ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                  }`}>
                    {new Date(date + 'T00:00').getDate()}
                  </div>
                  <div>
                    <p className={`text-xs font-semibold ${today ? 'text-primary' : 'text-foreground'}`}>
                      {WEEK_DAYS_FULL[i]}
                      {today && <span className="ml-1.5 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">Aujourd'hui</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{WEEK_DAYS_SHORT[i]} {new Date(date + 'T00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
                  </div>
                </div>

                {/* Shifts */}
                {dayShifts.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/50 pl-9 italic">Pas de shift</p>
                ) : (
                  <div className="space-y-1.5 pl-9">
                    {dayShifts.map(shift => {
                      const style = SHIFT_STYLE[shift.shift_type];
                      return (
                        <div key={shift.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${style.bg}`}>
                          <span className={style.color}>{style.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs font-semibold ${style.color}`}>{style.label}</span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(shift.shift_start)} – {formatTime(shift.shift_end)}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 bg-secondary rounded font-medium text-muted-foreground">
                                {TEAM_LABELS[shift.team as Team] ?? shift.team}
                              </span>
                            </div>
                            {shift.note && (
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">📝 {shift.note}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state for the week */}
      {!loading && totalShifts === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-semibold text-foreground text-sm">Aucun shift planifié</p>
          <p className="text-xs mt-1">Aucun shift ne t'a été assigné pour cette semaine.</p>
        </div>
      )}
    </div>
  );
}
