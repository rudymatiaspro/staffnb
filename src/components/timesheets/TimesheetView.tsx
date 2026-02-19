import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Shift } from '../../types';
import { TEAM_LABELS } from '../../data/initialData';
import { Clock, Calendar, Download, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { ChangePinSection } from '../profile/ChangePinSection';

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

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

function ShiftRow({ shift }: { shift: Shift }) {
  const duration = shift.totalMinutes ?? (shift.clockOut
    ? Math.round((shift.clockOut.getTime() - shift.clockIn.getTime()) / 60000)
    : null);
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0 text-xs">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{shift.userName}</p>
        <p className="text-muted-foreground">{TEAM_LABELS[shift.team] || shift.team}</p>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>{formatTime(shift.clockIn)}</span>
        <span>→</span>
        <span>{shift.clockOut ? formatTime(shift.clockOut) : <span className="text-timer-safe font-medium">Active</span>}</span>
      </div>
      {duration !== null && (
        <span className="font-bold text-foreground">{formatDuration(duration)}</span>
      )}
    </div>
  );
}

interface TimesheetViewProps {
  userId?: string;   // if set: show only this user's shifts
  teamFilter?: string; // if set: show only this team's shifts
  canExport?: boolean;
  showPinChange?: boolean; // show the change PIN section
}

export function TimesheetView({ userId, teamFilter, canExport = false, showPinChange = false }: TimesheetViewProps) {
  const { users, shifts, currentUser } = useApp();
  const [weekOffset, setWeekOffset] = useState(0);
  const weekDates = getWeekDates(weekOffset);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const filtered = shifts.filter((s) => {
    if (userId && s.userId !== userId) return false;
    if (teamFilter && s.team !== teamFilter) return false;
    return weekDates.includes(s.date);
  });

  const byDate = weekDates.reduce<Record<string, Shift[]>>((acc, d) => {
    acc[d] = filtered.filter((s) => s.date === d);
    return acc;
  }, {});

  const totalMinutes = filtered.reduce((sum, s) => {
    const m = s.totalMinutes ?? (s.clockOut
      ? Math.round((s.clockOut.getTime() - s.clockIn.getTime()) / 60000)
      : 0);
    return sum + m;
  }, 0);

  const exportCSV = () => {
    const rows = [['Name', 'Team', 'Date', 'Clock In', 'Clock Out', 'Duration (min)']];
    filtered.forEach((s) => {
      rows.push([
        s.userName,
        TEAM_LABELS[s.team] || s.team,
        s.date,
        formatTime(s.clockIn),
        s.clockOut ? formatTime(s.clockOut) : 'Active',
        (s.totalMinutes ?? '').toString(),
      ]);
    });
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheets-${weekStart}-${weekEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isToday = (d: string) => d === new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Timesheets
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filtered.length} shifts · {totalMinutes > 0 ? formatDuration(totalMinutes) : '0h 00m'} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-xs font-medium hover:bg-muted transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Week nav */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 glass-card rounded-xl">
        <button onClick={() => setWeekOffset((o) => o - 1)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">
            {new Date(weekStart + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            {' — '}
            {new Date(weekEnd + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <button
          onClick={() => setWeekOffset((o) => Math.min(0, o + 1))}
          disabled={weekOffset >= 0}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Days */}
      {filtered.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-semibold text-foreground">No shifts this week</p>
          <p className="text-sm mt-1">Clock-in data will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {weekDates.map((date) => {
            const dayShifts = byDate[date];
            if (dayShifts.length === 0) return null;
            const dayTotal = dayShifts.reduce((sum, s) => {
              return sum + (s.totalMinutes ?? (s.clockOut ? Math.round((s.clockOut.getTime() - s.clockIn.getTime()) / 60000) : 0));
            }, 0);
            const dayLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

            return (
              <div key={date} className={`glass-card rounded-xl overflow-hidden ${isToday(date) ? 'border-primary/30 ring-1 ring-primary/20' : ''}`}>
                <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/50 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{dayLabel}</span>
                    {isToday(date) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">Today</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">{dayShifts.length} shift{dayShifts.length > 1 ? 's' : ''} · {formatDuration(dayTotal)}</span>
                </div>
                <div className="px-4 py-1">
                  {dayShifts.map((s) => <ShiftRow key={s.id} shift={s} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PIN change section — only for the user's own profile tab */}
      {showPinChange && currentUser && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-2 border-t border-border pt-4">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">Sécurité</h2>
          </div>
          <ChangePinSection />
        </div>
      )}
    </div>
  );
}
