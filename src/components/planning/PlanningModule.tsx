import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import { TEAM_LABELS, TEAM_CSS } from '../../data/initialData';
import { Team } from '../../types';
import {
  Calendar, ChevronLeft, ChevronRight, Plus, X, Sun, Moon,
  Users, Copy, AlertTriangle, Clock, Inbox, CheckCircle2, XCircle, Hourglass
} from 'lucide-react';

// ─── Availability Request Types ───────────────────────────────────────────────

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

const TYPE_LABELS: Record<RequestType, string> = {
  day_off: '🏖️ Congé / Jour off',
  availability_note: '📝 Note de disponibilité',
};

const STATUS_STYLE: Record<RequestStatus, { label: string; icon: React.ReactNode; classes: string }> = {
  pending:  { label: 'En attente', icon: <Hourglass className="w-3 h-3" />,    classes: 'bg-muted text-muted-foreground border-border' },
  approved: { label: 'Approuvée',  icon: <CheckCircle2 className="w-3 h-3" />, classes: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30' },
  rejected: { label: 'Refusée',    icon: <XCircle className="w-3 h-3" />,       classes: 'bg-destructive/10 text-destructive border-destructive/30' },
};

// ─── Types ───────────────────────────────────────────────────────────────────

type ShiftType = 'morning' | 'evening';

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

const SHIFT_PRESETS: Record<ShiftType, { label: string; start: string; end: string; icon: React.ReactNode; color: string }> = {
  morning: {
    label: 'Matin',
    start: '07:00',
    end: '15:30',
    icon: <Sun className="w-3.5 h-3.5" />,
    color: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400',
  },
  evening: {
    label: 'Soir',
    start: '15:00',
    end: '22:30',
    icon: <Moon className="w-3.5 h-3.5" />,
    color: 'bg-indigo-500/15 text-indigo-700 border-indigo-500/30 dark:text-indigo-400',
  },
};

const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const TEAMS: Team[] = ['BAR', 'KITCHEN', 'FLOOR', 'ATELIER'];
const MIN_STAFF_PER_SHIFT = 1; // alert threshold

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

function isToday(d: string) {
  return d === new Date().toISOString().split('T')[0];
}

function isPast(d: string) {
  return d < new Date().toISOString().split('T')[0];
}

// ─── Add Shift Modal ──────────────────────────────────────────────────────────

interface AddShiftModalProps {
  date: string;
  shiftType: ShiftType;
  team: Team;
  onClose: () => void;
  onSave: (shift: Omit<PlanningShift, 'id'>) => Promise<void>;
  users: { id: string; name: string; team: Team; teams?: Team[] }[];
}

function AddShiftModal({ date, shiftType, team, onClose, onSave, users }: AddShiftModalProps) {
  const preset = SHIFT_PRESETS[shiftType];
  const [selectedUserId, setSelectedUserId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const teamUsers = users.filter(u =>
    u.team === team || (u.teams && u.teams.includes(team))
  );

  const handleSave = async () => {
    if (!selectedUserId) return;
    const user = users.find(u => u.id === selectedUserId);
    if (!user) return;
    setSaving(true);
    await onSave({
      date,
      shift_type: shiftType,
      shift_start: preset.start,
      shift_end: preset.end,
      user_id: selectedUserId,
      user_name: user.name,
      team,
      note: note || null,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-card rounded-2xl w-full max-w-sm p-5 space-y-4 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-foreground text-sm">Ajouter un shift</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Shift badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${preset.color}`}>
          {preset.icon}
          {preset.label} · {preset.start} – {preset.end}
        </div>

        {/* Team */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Équipe</p>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold team-badge ${TEAM_CSS[team]}`}>
            {TEAM_LABELS[team]}
          </div>
        </div>

        {/* Staff picker */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Employé·e</p>
          {teamUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Aucun membre dans cette équipe</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {teamUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left ${
                    selectedUserId === u.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-secondary-foreground border-border hover:border-primary/40'
                  }`}
                >
                  {u.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Note */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Note (optionnel)</p>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="ex: remplaçant, formation..."
            className="w-full bg-secondary text-foreground text-xs rounded-xl px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-medium hover:bg-muted transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedUserId || saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {saving ? 'Enregistrement...' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shift Chip ───────────────────────────────────────────────────────────────

function ShiftChip({
  shift,
  onRemove,
  canEdit,
}: {
  shift: PlanningShift;
  onRemove: () => void;
  canEdit: boolean;
}) {
  const preset = SHIFT_PRESETS[shift.shift_type];
  return (
    <div className={`group flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-medium ${preset.color}`}>
      {preset.icon}
      <span className="truncate max-w-[60px]">{shift.user_name}</span>
      {canEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto -mr-0.5 hover:text-destructive"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Day Cell ─────────────────────────────────────────────────────────────────

interface DayCellProps {
  date: string;
  team: Team;
  shiftType: ShiftType;
  shifts: PlanningShift[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  canEdit: boolean;
}

function DayCell({ date, team: _team, shiftType: _type, shifts, onAdd, onRemove, canEdit }: DayCellProps) {
  const past = isPast(date);
  const today = isToday(date);

  return (
    <div
      className={`min-h-[60px] p-1.5 rounded-lg border transition-colors flex flex-col gap-1 ${
        today
          ? 'border-primary/40 bg-primary/5'
          : past
          ? 'border-border/30 bg-muted/20 opacity-60'
          : 'border-border/40 bg-card/60 hover:border-primary/20'
      }`}
    >
      {shifts.map(s => (
        <ShiftChip key={s.id} shift={s} onRemove={() => onRemove(s.id)} canEdit={canEdit && !past} />
      ))}
      {canEdit && !past && (
        <button
          onClick={onAdd}
          className="flex items-center justify-center w-full py-1 rounded-md text-[10px] text-muted-foreground/50 hover:text-primary hover:bg-primary/5 transition-colors border border-dashed border-border/30 hover:border-primary/30 mt-auto"
        >
          <Plus className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PlanningModule() {
  const { users, currentUser } = useApp();
  const [weekOffset, setWeekOffset] = useState(0);
  const [shifts, setShifts] = useState<PlanningShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ date: string; shiftType: ShiftType; team: Team } | null>(null);
  const [activeTeam, setActiveTeam] = useState<Team>('BAR');
  const [activeView, setActiveView] = useState<'planning' | 'requests'>('planning');
  const [requests, setRequests] = useState<AvailabilityRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  const weekDates = getWeekDates(weekOffset);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const canEdit = currentUser?.role === 'manager' || currentUser?.role === 'owner';

  // ── Load from DB ────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('planning_shifts')
        .select('*')
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .order('date');
      if (data) setShifts(data as PlanningShift[]);
      setLoading(false);
    };
    load();

    // Realtime subscription
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

  // ── CRUD ────────────────────────────────────────────────────────────────────
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
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status, reviewed_by: currentUser?.name ?? 'Manager', reviewed_at: new Date().toISOString() } : r));
  };

  // ── Copy previous week ──────────────────────────────────────────────────────
  const copyPreviousWeek = async () => {
    const prevDates = getWeekDates(weekOffset - 1);
    const { data: prevShifts } = await supabase
      .from('planning_shifts')
      .select('*')
      .gte('date', prevDates[0])
      .lte('date', prevDates[6]);

    if (!prevShifts || prevShifts.length === 0) return;

    const newShifts = (prevShifts as PlanningShift[]).map((s) => {
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

  // ── Stats & alerts ──────────────────────────────────────────────────────────
  const getShiftsForCell = (date: string, team: Team, shiftType: ShiftType) =>
    shifts.filter(s => s.date === date && s.team === team && s.shift_type === shiftType);

  const underCoveredDays = weekDates.filter(date => {
    if (isPast(date)) return false;
    return TEAMS.some(team =>
      (['morning', 'evening'] as ShiftType[]).some(st =>
        getShiftsForCell(date, team, st).length < MIN_STAFF_PER_SHIFT
      )
    );
  });

  const staffForTeam = users.filter(u => u.role === 'staff' && (u.team === activeTeam || (u.teams && u.teams.includes(activeTeam))));
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const pendingCount = pendingRequests.length;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Planning
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {shifts.length} shift{shifts.length > 1 ? 's' : ''} planifié{shifts.length > 1 ? 's' : ''} cette semaine
          </p>
        </div>
        {canEdit && (
          <button
            onClick={copyPreviousWeek}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-xs font-medium hover:bg-muted transition-colors text-secondary-foreground"
          >
            <Copy className="w-3.5 h-3.5" />
            Copier sem. précédente
          </button>
        )}
      </div>

      {/* ── View toggle (Planning / Demandes) ── */}
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
      </div>

      {/* ── REQUESTS VIEW ── */}
      {activeView === 'requests' && (
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
                  <div className="space-y-2">
                    {pendingRequests.map(req => (
                      <div key={req.id} className="glass-card rounded-xl p-3 space-y-2 border border-border">
                        <div className="flex items-start gap-2 justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground">{req.user_name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {TYPE_LABELS[req.type]} · {new Date(req.date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => reviewRequest(req.id, 'approved')}
                              className="p-1.5 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20 transition-colors"
                              title="Approuver"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => reviewRequest(req.id, 'rejected')}
                              className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                              title="Refuser"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground bg-secondary/60 rounded-lg px-2.5 py-1.5 italic">
                          "{req.note}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {requests.filter(r => r.status !== 'pending').length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-4">Traitées</p>
                  <div className="space-y-2">
                    {requests.filter(r => r.status !== 'pending').map(req => {
                      const statusStyle = STATUS_STYLE[req.status];
                      return (
                        <div key={req.id} className="glass-card rounded-xl p-3 space-y-1.5 opacity-80">
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
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PLANNING VIEW ── */}
      {activeView === 'planning' && <>

      {/* ── Shift legend ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {(Object.entries(SHIFT_PRESETS) as [ShiftType, typeof SHIFT_PRESETS[ShiftType]][]).map(([key, preset]) => (
          <div key={key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${preset.color}`}>
            {preset.icon}
            {preset.label} · {preset.start} – {preset.end}
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>8h30 / 7h30</span>
        </div>
      </div>

      {/* ── Under-coverage alert ── */}
      {underCoveredDays.length > 0 && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/25 text-destructive">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold">Sous-effectif détecté</p>
            <p className="mt-0.5 opacity-80">
              {underCoveredDays.length} jour{underCoveredDays.length > 1 ? 's' : ''} avec des créneaux sans personnel assigné.
            </p>
          </div>
        </div>
      )}

      {/* ── Week nav ── */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 glass-card rounded-xl">
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

      {/* ── Team tabs ── */}
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

      {/* ── Staff count for team ── */}
      <div className="flex items-center gap-2 px-1">
        <Users className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{staffForTeam.length}</span> membre{staffForTeam.length > 1 ? 's' : ''} dans l'équipe {TEAM_LABELS[activeTeam]}
        </span>
      </div>

      {/* ── Weekly grid ── */}
      {loading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Chargement...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <th className="w-20 text-left pb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shift</span>
                </th>
                {weekDates.map((date, i) => (
                  <th key={date} className="pb-2 px-1">
                    <div className={`text-center ${isToday(date) ? 'text-primary' : isPast(date) ? 'text-muted-foreground/50' : 'text-foreground'}`}>
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
              {(['morning', 'evening'] as ShiftType[]).map(shiftType => {
                const preset = SHIFT_PRESETS[shiftType];
                return (
                  <tr key={shiftType}>
                    <td className="pr-2 py-1 align-top">
                      <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-semibold ${preset.color}`}>
                        {preset.icon}
                        <div>
                          <p>{preset.label}</p>
                          <p className="opacity-70">{preset.start}–{preset.end}</p>
                        </div>
                      </div>
                    </td>
                    {weekDates.map(date => (
                      <td key={date} className="px-1 py-1 align-top">
                        <DayCell
                          date={date}
                          team={activeTeam}
                          shiftType={shiftType}
                          shifts={getShiftsForCell(date, activeTeam, shiftType)}
                          onAdd={() => setModal({ date, shiftType, team: activeTeam })}
                          onRemove={removeShift}
                          canEdit={canEdit}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal ── */}
      {modal && (
        <AddShiftModal
          date={modal.date}
          shiftType={modal.shiftType}
          team={modal.team}
          onClose={() => setModal(null)}
          onSave={addShift}
          users={users.filter(u => u.role === 'staff' || u.role === 'manager')}
        />
      )}
      </>}

    </div>
  );
}
