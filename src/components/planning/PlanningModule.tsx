import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import { TEAM_LABELS, TEAM_CSS } from '../../data/initialData';
import { Team } from '../../types';
import {
  Calendar, ChevronLeft, ChevronRight, Plus, X, Sun, Moon, Pencil,
  Users, Copy, AlertTriangle, Clock, Inbox, CheckCircle2, XCircle,
  Hourglass, CalendarDays, Settings2,
} from 'lucide-react';
import { ManagerAvailabilityView } from './AvailabilityModule';

// ─── Types ───────────────────────────────────────────────────────────────────

type RequestType = 'day_off' | 'availability_note';
type RequestStatus = 'pending' | 'approved' | 'rejected';

interface AvailabilityRequest {
  id: string;
  user_id: string;
  user_name: string;
  date: string;
  type: RequestType;
  note: string;
  status: RequestStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

type ShiftType = 'ouverture' | 'fermeture' | 'custom';

interface PlanningShift {
  id: string;
  date: string;
  shift_type: ShiftType;
  shift_start: string;
  shift_end: string;
  user_id: string | null;
  user_name: string;
  team: string;
  note?: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SHIFT_PRESETS: Record<'ouverture' | 'fermeture', { label: string; start: string; end: string }> = {
  ouverture: { label: 'Ouverture', start: '07:00', end: '15:30' },
  fermeture: { label: 'Fermeture', start: '15:00', end: '22:30' },
};

// Badge colour per shift type
const SHIFT_COLOR: Record<ShiftType, string> = {
  ouverture: 'bg-blue-500/15 text-blue-600 border-blue-400/30 dark:text-blue-300',
  fermeture: 'bg-violet-500/15 text-violet-600 border-violet-400/30 dark:text-violet-300',
  custom:    'bg-muted text-muted-foreground border-border',
};

const SHIFT_ICON: Record<ShiftType, React.ReactNode> = {
  ouverture: <Sun className="w-3 h-3" />,
  fermeture: <Moon className="w-3 h-3" />,
  custom:    <Settings2 className="w-3 h-3" />,
};

const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const TEAMS: Team[] = ['BAR', 'KITCHEN', 'FLOOR', 'ATELIER'];

const TYPE_LABELS: Record<RequestType, string> = {
  day_off: '🏖️ Congé / Jour off',
  availability_note: '📝 Note de disponibilité',
};

const STATUS_STYLE: Record<RequestStatus, { label: string; icon: React.ReactNode; classes: string }> = {
  pending:  { label: 'En attente', icon: <Hourglass className="w-3 h-3" />,    classes: 'bg-muted text-muted-foreground border-border' },
  approved: { label: 'Approuvée',  icon: <CheckCircle2 className="w-3 h-3" />, classes: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30' },
  rejected: { label: 'Refusée',    icon: <XCircle className="w-3 h-3" />,       classes: 'bg-destructive/10 text-destructive border-destructive/30' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function isToday(d: string) { return d === new Date().toISOString().split('T')[0]; }
function isPast(d: string)  { return d < new Date().toISOString().split('T')[0]; }

function fmtTime(t: string) {
  // "07:00:00" → "7h00"
  const [h, m] = t.split(':');
  return `${parseInt(h)}h${m === '00' ? '' : m}`;
}

// ─── Assign Shift Modal (standalone, for Owner/Manager) ───────────────────────

interface AssignShiftModalProps {
  defaultDate?: string;
  onClose: () => void;
  onSave: (shift: Omit<PlanningShift, 'id'>) => Promise<void>;
  users: { id: string; name: string; team: Team; teams?: Team[] }[];
}

function AssignShiftModal({ defaultDate, onClose, onSave, users }: AssignShiftModalProps) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().split('T')[0]);
  const [shiftType, setShiftType] = useState<ShiftType>('ouverture');
  const [customStart, setCustomStart] = useState('08:00');
  const [customEnd, setCustomEnd] = useState('16:00');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedUser = users.find(u => u.id === selectedUserId);
  const team: Team = (selectedUser?.team ?? 'BAR') as Team;

  const startTime = shiftType === 'custom' ? customStart : SHIFT_PRESETS[shiftType as 'ouverture' | 'fermeture'].start;
  const endTime   = shiftType === 'custom' ? customEnd   : SHIFT_PRESETS[shiftType as 'ouverture' | 'fermeture'].end;

  const handleSave = async () => {
    if (!selectedUserId || !date) return;
    if (!selectedUser) return;
    setSaving(true);
    await onSave({
      date,
      shift_type: shiftType,
      shift_start: startTime,
      shift_end: endTime,
      user_id: selectedUserId,
      user_name: selectedUser.name,
      team,
      note: note || null,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl animate-slide-up overflow-y-auto max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-bold text-foreground text-[17px]">Assigner un shift</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Remplis les informations ci-dessous</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Membre */}
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
              Membre *
            </label>
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            >
              <option value="">— Choisir un membre —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({TEAM_LABELS[u.team]})</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            />
          </div>

          {/* Type de shift */}
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
              Type de shift *
            </label>
            <div className="flex flex-col gap-2">
              {(['ouverture', 'fermeture', 'custom'] as ShiftType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setShiftType(type)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                    shiftType === type
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  <span className={`flex-shrink-0 p-1.5 rounded-lg border ${SHIFT_COLOR[type]}`}>
                    {SHIFT_ICON[type]}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-[13px] capitalize">
                      {type === 'ouverture' ? 'Ouverture' : type === 'fermeture' ? 'Fermeture' : 'Personnalisé'}
                    </p>
                    {type !== 'custom' && (
                      <p className="text-[11px] opacity-70">{SHIFT_PRESETS[type].start} – {SHIFT_PRESETS[type].end}</p>
                    )}
                    {type === 'custom' && (
                      <p className="text-[11px] opacity-70">Définir les horaires manuellement</p>
                    )}
                  </div>
                  {shiftType === type && (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Horaires custom */}
          {shiftType === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Début *
                </label>
                <input
                  type="time"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Fin *
                </label>
                <input
                  type="time"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                />
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Note (optionnel)
            </label>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="ex: remplaçant, formation..."
              className="w-full bg-muted text-foreground text-[14px] rounded-xl px-3 py-2.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors placeholder:text-muted-foreground/60"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground text-[14px] font-semibold hover:bg-muted/80 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={!selectedUserId || !date || saving}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-[14px] font-bold hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              {saving ? 'Enregistrement...' : 'Assigner'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shift Chip ───────────────────────────────────────────────────────────────

function ShiftChip({ shift, onRemove, canEdit }: { shift: PlanningShift; onRemove: () => void; canEdit: boolean }) {
  const type = (shift.shift_type ?? 'custom') as ShiftType;
  const colorCls = SHIFT_COLOR[type] ?? SHIFT_COLOR.custom;
  return (
    <div className={`group flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-medium ${colorCls}`}>
      {SHIFT_ICON[type]}
      <span className="truncate max-w-[72px]">
        {shift.user_name} <span className="opacity-60">{fmtTime(shift.shift_start)}–{fmtTime(shift.shift_end)}</span>
      </span>
      {canEdit && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto -mr-0.5 hover:text-destructive"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Day Cell ─────────────────────────────────────────────────────────────────

function DayCell({
  date, shifts, onAdd, onRemove, canEdit,
}: {
  date: string;
  shifts: PlanningShift[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  canEdit: boolean;
}) {
  const past = isPast(date);
  const today = isToday(date);
  return (
    <div className={`min-h-[64px] p-1.5 rounded-lg border flex flex-col gap-1 transition-colors ${
      today  ? 'border-primary/40 bg-primary/5'
      : past ? 'border-border/30 bg-muted/20 opacity-60'
             : 'border-border/40 bg-card/60 hover:border-primary/20'
    }`}>
      {shifts.map(s => (
        <ShiftChip key={s.id} shift={s} onRemove={() => onRemove(s.id)} canEdit={canEdit && !past} />
      ))}
      {canEdit && !past && (
        <button
          onClick={onAdd}
          className="flex items-center justify-center w-full py-1 rounded-md text-[10px] text-muted-foreground/40 hover:text-primary hover:bg-primary/5 transition-colors border border-dashed border-border/30 hover:border-primary/30 mt-auto"
        >
          <Plus className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Staff Row View (personal view for staff members) ─────────────────────────

function StaffWeekView({ shifts, weekDates }: { shifts: PlanningShift[]; weekDates: string[] }) {
  if (shifts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="font-semibold text-foreground text-sm">Aucun shift planifié</p>
        <p className="text-xs mt-1">Tes shifts apparaîtront ici quand le manager les aura assignés.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {weekDates.map(date => {
        const dayShifts = shifts.filter(s => s.date === date);
        const past = isPast(date);
        const today = isToday(date);
        return (
          <div
            key={date}
            className={`rounded-xl p-3 border transition-colors ${
              today  ? 'border-primary/40 bg-primary/5'
              : past ? 'border-border/30 bg-muted/20 opacity-60'
                     : 'border-border/40 bg-card'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className={`text-[13px] font-bold ${today ? 'text-primary' : 'text-foreground'}`}>
                  {new Date(date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
                </p>
                {today && <span className="text-[10px] bg-primary/15 text-primary px-1.5 rounded-full font-semibold">Aujourd'hui</span>}
              </div>
              {dayShifts.length === 0 && (
                <span className="text-[11px] text-muted-foreground italic">Repos</span>
              )}
            </div>
            {dayShifts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {dayShifts.map(s => {
                  const type = (s.shift_type ?? 'custom') as ShiftType;
                  return (
                    <div key={s.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-semibold ${SHIFT_COLOR[type]}`}>
                      {SHIFT_ICON[type]}
                      <span className="capitalize">
                        {type === 'ouverture' ? 'Ouverture' : type === 'fermeture' ? 'Fermeture' : 'Personnalisé'}
                      </span>
                      <span className="opacity-70">{fmtTime(s.shift_start)} – {fmtTime(s.shift_end)}</span>
                      {s.note && <span className="text-[10px] opacity-60 ml-1">· {s.note}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PlanningModule() {
  const { users, currentUser } = useApp();
  const [weekOffset, setWeekOffset]       = useState(0);
  const [shifts, setShifts]               = useState<PlanningShift[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [prefillDate, setPrefillDate]     = useState<string | undefined>(undefined);
  const [activeTeam, setActiveTeam]       = useState<Team>('BAR');
  const [activeView, setActiveView]       = useState<'planning' | 'requests' | 'availabilities'>('planning');
  const [requests, setRequests]           = useState<AvailabilityRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  const weekDates  = getWeekDates(weekOffset);
  const weekStart  = weekDates[0];
  const weekEnd    = weekDates[6];

  const canEdit = currentUser?.role === 'manager' ||
                  currentUser?.role === 'owner'   ||
                  currentUser?.role === 'admin';

  const isStaff = !canEdit;

  // ── Load planning shifts ─────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const query = supabase
        .from('planning_shifts')
        .select('*')
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .order('date');

      // Staff only see their own shifts
      const { data } = await query;
      if (data) setShifts(data as PlanningShift[]);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`planning-${weekStart}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_shifts' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [weekStart, weekEnd]);

  // ── Load availability requests ───────────────────────────────────────────────
  const loadRequests = async () => {
    setRequestsLoading(true);
    const { data } = await supabase
      .from('availability_requests')
      .select('*')
      .order('date', { ascending: true });
    if (data) setRequests(data as AvailabilityRequest[]);
    setRequestsLoading(false);
  };

  useEffect(() => {
    loadRequests();
    const channel = supabase
      .channel('manager-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability_requests' }, () => loadRequests())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── CRUD ─────────────────────────────────────────────────────────────────────
  const addShift = async (shift: Omit<PlanningShift, 'id'>) => {
    const { data } = await supabase.from('planning_shifts').insert(shift).select().single();
    if (data) setShifts(prev => [...prev, data as PlanningShift]);
  };

  const removeShift = async (id: string) => {
    await supabase.from('planning_shifts').delete().eq('id', id);
    setShifts(prev => prev.filter(s => s.id !== id));
  };

  const reviewRequest = async (id: string, status: 'approved' | 'rejected') => {
    await supabase
      .from('availability_requests')
      .update({ status, reviewed_by: currentUser?.name ?? 'Manager', reviewed_at: new Date().toISOString() })
      .eq('id', id);
    setRequests(prev => prev.map(r =>
      r.id === id ? { ...r, status, reviewed_by: currentUser?.name ?? 'Manager', reviewed_at: new Date().toISOString() } : r
    ));
  };

  const copyPreviousWeek = async () => {
    const prevDates = getWeekDates(weekOffset - 1);
    const { data: prevShifts } = await supabase
      .from('planning_shifts')
      .select('*')
      .gte('date', prevDates[0])
      .lte('date', prevDates[6]);
    if (!prevShifts || prevShifts.length === 0) return;
    const newShifts = (prevShifts as PlanningShift[]).map(s => {
      const dayIndex = prevDates.indexOf(s.date);
      return {
        date: weekDates[dayIndex],
        shift_type: s.shift_type,
        shift_start: s.shift_start,
        shift_end: s.shift_end,
        user_id: s.user_id,
        user_name: s.user_name,
        team: s.team,
        note: s.note,
      };
    });
    const { data } = await supabase.from('planning_shifts').insert(newShifts).select();
    if (data) setShifts(prev => [...prev, ...(data as PlanningShift[])]);
  };

  // ── Filtered data ────────────────────────────────────────────────────────────
  const getShiftsForCell = (date: string, team: Team) =>
    shifts.filter(s => s.date === date && s.team === team);

  const myShifts = shifts.filter(s => s.user_id === currentUser?.id);

  const staffForTeam = users.filter(u =>
    u.role === 'staff' || u.role === 'chef' || u.role === 'manager'
  );

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const pendingCount    = pendingRequests.length;

  // ── Legend ───────────────────────────────────────────────────────────────────
  const LEGEND: { type: ShiftType; label: string; hours: string }[] = [
    { type: 'ouverture', label: 'Ouverture', hours: '7h – 15h30' },
    { type: 'fermeture', label: 'Fermeture', hours: '15h – 22h30' },
    { type: 'custom',    label: 'Personnalisé', hours: 'Horaires libres' },
  ];

  return (
    <div className="space-y-4">

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[20px] font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Planning
          </h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {shifts.length} shift{shifts.length !== 1 ? 's' : ''} planifié{shifts.length !== 1 ? 's' : ''} cette semaine
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <button
                onClick={copyPreviousWeek}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-xs font-medium hover:bg-muted transition-colors text-secondary-foreground"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Copier sem. précédente</span>
              </button>
              <button
                onClick={() => { setPrefillDate(undefined); setShowAssignModal(true); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-[13px] font-semibold"
              >
                <Plus className="w-4 h-4" />
                Assigner un shift
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── View toggle ───────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl">
        <button
          onClick={() => setActiveView('planning')}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
            activeView === 'planning' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Planning
        </button>
        <button
          onClick={() => setActiveView('availabilities')}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
            activeView === 'availabilities' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          Disponibilités
        </button>
        {canEdit && (
          <button
            onClick={() => setActiveView('requests')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeView === 'requests' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            Demandes
            {pendingCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── AVAILABILITIES VIEW ──────────────────────────────────────────────── */}
      {activeView === 'availabilities' && (
        <div className="rounded-xl p-4 bg-card border border-border">
          <ManagerAvailabilityView />
        </div>
      )}

      {/* ── REQUESTS VIEW ────────────────────────────────────────────────────── */}
      {activeView === 'requests' && canEdit && (
        <div className="space-y-3">
          {requestsLoading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Chargement...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Inbox className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-semibold text-foreground text-sm">Aucune demande</p>
              <p className="text-xs mt-1">Les demandes du staff apparaîtront ici.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingRequests.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Hourglass className="w-3.5 h-3.5" />
                    En attente ({pendingCount})
                  </p>
                  {pendingRequests.map(req => (
                    <div key={req.id} className="bg-card rounded-xl p-3 space-y-2 border border-border mb-2">
                      <div className="flex items-start gap-2 justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground">{req.user_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {TYPE_LABELS[req.type]} · {new Date(req.date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => reviewRequest(req.id, 'approved')} className="p-1.5 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20 transition-colors" title="Approuver">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => reviewRequest(req.id, 'rejected')} className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors" title="Refuser">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground bg-secondary/60 rounded-lg px-2.5 py-1.5 italic">"{req.note}"</p>
                    </div>
                  ))}
                </div>
              )}
              {requests.filter(r => r.status !== 'pending').length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-4">Traitées</p>
                  {requests.filter(r => r.status !== 'pending').map(req => {
                    const statusStyle = STATUS_STYLE[req.status];
                    return (
                      <div key={req.id} className="bg-card rounded-xl p-3 space-y-1.5 opacity-80 border border-border mb-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-foreground">{req.user_name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {TYPE_LABELS[req.type]} · {new Date(req.date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </p>
                          </div>
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusStyle.classes}`}>
                            {statusStyle.icon}
                            {statusStyle.label}
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground italic">"{req.note}"</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PLANNING VIEW ────────────────────────────────────────────────────── */}
      {activeView === 'planning' && (
        <>
          {/* Legend */}
          <div className="flex items-center gap-2 flex-wrap">
            {LEGEND.map(({ type, label, hours }) => (
              <div key={type} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold ${SHIFT_COLOR[type]}`}>
                {SHIFT_ICON[type]}
                {label}
                <span className="opacity-60">· {hours}</span>
              </div>
            ))}
          </div>

          {/* Week nav */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-card rounded-xl border border-border">
            <button onClick={() => setWeekOffset(o => o - 1)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">
                {new Date(weekStart + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                {' — '}
                {new Date(weekEnd + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <button onClick={() => setWeekOffset(o => o + 1)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* ── STAFF personal view ─────────────────────────────────────────── */}
          {isStaff && (
            <StaffWeekView
              shifts={myShifts}
              weekDates={weekDates}
            />
          )}

          {/* ── MANAGER/OWNER full grid ─────────────────────────────────────── */}
          {canEdit && (
            <>
              {/* Team tabs */}
              <div className="flex gap-1 p-1 bg-secondary rounded-xl overflow-x-auto">
                {TEAMS.map(team => (
                  <button
                    key={team}
                    onClick={() => setActiveTeam(team)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium flex-shrink-0 transition-all ${
                      activeTeam === team ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {TEAM_LABELS[team]}
                  </button>
                ))}
              </div>

              {/* Staff count */}
              <div className="flex items-center gap-2 px-1">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {users.filter(u => u.team === activeTeam).length}
                  </span>{' '}
                  membre{users.filter(u => u.team === activeTeam).length !== 1 ? 's' : ''} dans l'équipe {TEAM_LABELS[activeTeam]}
                </span>
              </div>

              {loading ? (
                <div className="text-center py-10 text-muted-foreground text-sm">Chargement...</div>
              ) : (
                <div className="overflow-x-auto -mx-1 px-1">
                  <table className="w-full min-w-[640px]">
                    <thead>
                      <tr>
                        <th className="w-5 pb-2" />
                        {weekDates.map((date, i) => (
                          <th key={date} className="pb-2 px-1">
                            <div className={`text-center ${isToday(date) ? 'text-primary' : isPast(date) ? 'text-muted-foreground/40' : 'text-foreground'}`}>
                              <p className="text-[10px] font-semibold uppercase tracking-wide">{WEEK_DAYS[i]}</p>
                              <p className={`text-sm font-bold mt-0.5 w-7 h-7 flex items-center justify-center mx-auto rounded-full ${
                                isToday(date) ? 'bg-primary text-primary-foreground' : ''
                              }`}>
                                {new Date(date + 'T00:00').getDate()}
                              </p>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* One row per staff member in the active team */}
                      {users
                        .filter(u => u.team === activeTeam && (u.role === 'staff' || u.role === 'chef'))
                        .map(member => (
                          <tr key={member.id}>
                            <td className="pr-2 py-1 align-top">
                              <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
                                <span>{member.name.split(' ')[0]}</span>
                              </div>
                            </td>
                            {weekDates.map(date => (
                              <td key={date} className="px-1 py-1 align-top">
                                <DayCell
                                  date={date}
                                  shifts={shifts.filter(s => s.date === date && s.user_id === member.id)}
                                  onAdd={() => { setPrefillDate(date); setShowAssignModal(true); }}
                                  onRemove={removeShift}
                                  canEdit={canEdit}
                                />
                              </td>
                            ))}
                          </tr>
                        ))
                      }
                      {/* Fallback if no staff in team */}
                      {users.filter(u => u.team === activeTeam && (u.role === 'staff' || u.role === 'chef')).length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-muted-foreground text-xs">
                            Aucun membre dans l'équipe {TEAM_LABELS[activeTeam]}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Assign shift modal ───────────────────────────────────────────────── */}
      {showAssignModal && canEdit && (
        <AssignShiftModal
          defaultDate={prefillDate}
          onClose={() => { setShowAssignModal(false); setPrefillDate(undefined); }}
          onSave={addShift}
          users={staffForTeam}
        />
      )}
    </div>
  );
}
