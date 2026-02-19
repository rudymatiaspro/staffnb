import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import {
  Sun, Moon, Calendar, Clock, ChevronLeft, ChevronRight,
  Plus, X, Send, Trash2, CheckCircle2, XCircle, Hourglass,
} from 'lucide-react';
import { TEAM_LABELS } from '@/data/initialData';
import { Team } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type ShiftType = 'morning' | 'evening';
type RequestType = 'day_off' | 'availability_note';
type RequestStatus = 'pending' | 'approved' | 'rejected';

interface PlanningShift {
  id: string;
  date: string;
  shift_type: ShiftType;
  shift_start: string;
  shift_end: string;
  team: string;
  note?: string | null;
}

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

const STATUS_STYLE: Record<RequestStatus, { label: string; icon: React.ReactNode; classes: string }> = {
  pending:  { label: 'En attente', icon: <Hourglass className="w-3 h-3" />,    classes: 'bg-muted text-muted-foreground border-border' },
  approved: { label: 'Approuvée',  icon: <CheckCircle2 className="w-3 h-3" />, classes: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30' },
  rejected: { label: 'Refusée',    icon: <XCircle className="w-3 h-3" />,       classes: 'bg-destructive/10 text-destructive border-destructive/30' },
};

const TYPE_LABELS: Record<RequestType, string> = {
  day_off: '🏖️ Congé / Jour off',
  availability_note: '📝 Note de disponibilité',
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

function isToday(d: string) { return d === new Date().toISOString().split('T')[0]; }
function isPast(d: string)  { return d < new Date().toISOString().split('T')[0]; }
function formatTime(t: string) { return t.slice(0, 5); }

// ─── Request Form Modal ────────────────────────────────────────────────────────

interface RequestFormProps {
  preselectedDate?: string;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  userName: string;
}

function RequestForm({ preselectedDate, onClose, onSaved, userId, userName }: RequestFormProps) {
  const [date, setDate] = useState(preselectedDate ?? '');
  const [type, setType] = useState<RequestType>('day_off');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Validate inputs
  const validate = () => {
    if (!date) return 'Veuillez choisir une date.';
    if (isPast(date) && !isToday(date)) return 'La date ne peut pas être dans le passé.';
    if (note.trim().length === 0) return 'Veuillez ajouter une note.';
    if (note.trim().length > 500) return 'La note est trop longue (500 caractères max).';
    return '';
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError('');
    const { error: dbError } = await supabase.from('availability_requests').insert({
      user_id: userId,
      user_name: userName,
      date,
      type,
      note: note.trim(),
    });
    setSaving(false);
    if (dbError) { setError('Erreur lors de l\'envoi. Réessaie.'); return; }
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-card rounded-2xl w-full max-w-sm p-5 space-y-4 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground text-sm">Nouvelle demande</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Type */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Type de demande</p>
          <div className="grid grid-cols-1 gap-2">
            {(Object.entries(TYPE_LABELS) as [RequestType, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setType(key)}
                className={`px-3 py-2.5 rounded-xl text-xs font-medium border transition-all text-left ${
                  type === key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary text-secondary-foreground border-border hover:border-primary/40'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Date concernée</p>
          <input
            type="date"
            value={date}
            min={new Date().toISOString().split('T')[0]}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-secondary text-foreground text-xs rounded-xl px-3 py-2.5 border border-border focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>

        {/* Note */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">
            Note <span className="text-muted-foreground/60">({note.trim().length}/500)</span>
          </p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={type === 'day_off' ? 'ex: rendez-vous médical, événement personnel...' : 'ex: disponible uniquement le matin, pas avant 10h...'}
            className="w-full bg-secondary text-foreground text-xs rounded-xl px-3 py-2.5 border border-border focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/60 resize-none"
          />
        </div>

        {/* Error */}
        {error && <p className="text-xs text-destructive">{error}</p>}

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
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            {saving ? 'Envoi...' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Request Card ──────────────────────────────────────────────────────────────

function RequestCard({ req, onDelete }: { req: AvailabilityRequest; onDelete: (id: string) => void }) {
  const statusStyle = STATUS_STYLE[req.status];
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await supabase.from('availability_requests').delete().eq('id', req.id);
    onDelete(req.id);
  };

  return (
    <div className="glass-card rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">{TYPE_LABELS[req.type]}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {new Date(req.date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusStyle.classes}`}>
            {statusStyle.icon}
            {statusStyle.label}
          </div>
          {req.status === 'pending' && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Annuler la demande"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground bg-secondary/60 rounded-lg px-2.5 py-1.5 italic">
        "{req.note}"
      </p>
      {req.reviewed_by && (
        <p className="text-[10px] text-muted-foreground/70">
          Réponse de {req.reviewed_by} · {new Date(req.reviewed_at!).toLocaleDateString('fr-FR')}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function StaffShiftsView() {
  const { currentUser } = useApp();
  const [weekOffset, setWeekOffset] = useState(0);
  const [shifts, setShifts] = useState<PlanningShift[]>([]);
  const [requests, setRequests] = useState<AvailabilityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState<string | undefined>();
  const [activeSection, setActiveSection] = useState<'planning' | 'requests'>('planning');

  const weekDates = getWeekDates(weekOffset);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  // Load shifts for current week
  useEffect(() => {
    if (!currentUser) return;
    const loadShifts = async () => {
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
    loadShifts();

    const channel = supabase
      .channel(`staff-shifts-${currentUser.id}-${weekStart}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_shifts' }, () => loadShifts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id, weekStart, weekEnd]);

  // Load all requests (not filtered to week — staff see their full list)
  const loadRequests = async () => {
    if (!currentUser) return;
    const { data } = await supabase
      .from('availability_requests')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('date', { ascending: false });
    if (data) setRequests(data as AvailabilityRequest[]);
  };

  useEffect(() => {
    loadRequests();
    if (!currentUser) return;

    const channel = supabase
      .channel(`staff-requests-${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability_requests' }, () => loadRequests())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  // Group shifts by date
  const shiftsByDate = weekDates.reduce<Record<string, PlanningShift[]>>((acc, date) => {
    acc[date] = shifts.filter(s => s.date === date);
    return acc;
  }, {});

  const totalShifts = shifts.length;
  const nextShift = shifts.filter(s => !isPast(s.date) || isToday(s.date))[0];
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const openForm = (date?: string) => {
    setFormDate(date);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Mon Planning
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalShifts} shift{totalShifts !== 1 ? 's' : ''} cette semaine
          </p>
        </div>
        <button
          onClick={() => openForm()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Demande
        </button>
      </div>

      {/* Section toggle */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl">
        <button
          onClick={() => setActiveSection('planning')}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
            activeSection === 'planning' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Shifts
        </button>
        <button
          onClick={() => setActiveSection('requests')}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
            activeSection === 'requests' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Demandes
          {pendingCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* ── PLANNING SECTION ── */}
      {activeSection === 'planning' && (
        <>
          {/* Next shift banner */}
          {nextShift && weekOffset === 0 && (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${SHIFT_STYLE[nextShift.shift_type].bg}`}>
              <div className={SHIFT_STYLE[nextShift.shift_type].color}>
                {SHIFT_STYLE[nextShift.shift_type].icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${SHIFT_STYLE[nextShift.shift_type].color}`}>
                  {isToday(nextShift.date) ? "Aujourd'hui" : new Date(nextShift.date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  {' · '}{SHIFT_STYLE[nextShift.shift_type].label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(nextShift.shift_start)} – {formatTime(nextShift.shift_end)}
                  <span className="ml-2 px-1.5 py-0.5 bg-secondary rounded text-[10px] font-medium">
                    {TEAM_LABELS[nextShift.team as Team] ?? nextShift.team}
                  </span>
                </p>
                {nextShift.note && <p className="text-[10px] text-muted-foreground/70 mt-1 italic">📝 {nextShift.note}</p>}
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

          {/* Week day list */}
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
                      today ? 'border-primary/40 bg-primary/5' : past ? 'border-border/30 bg-muted/10 opacity-50' : 'border-border/50 bg-card/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        today ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                      }`}>
                        {new Date(date + 'T00:00').getDate()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${today ? 'text-primary' : 'text-foreground'}`}>
                          {WEEK_DAYS_FULL[i]}
                          {today && <span className="ml-1.5 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">Aujourd'hui</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{WEEK_DAYS_SHORT[i]} {new Date(date + 'T00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
                      </div>
                      {/* Quick request button on future days */}
                      {!past && (
                        <button
                          onClick={() => openForm(date)}
                          className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                          title="Faire une demande pour ce jour"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
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
                                {shift.note && <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">📝 {shift.note}</p>}
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

          {!loading && totalShifts === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-semibold text-foreground text-sm">Aucun shift planifié</p>
              <p className="text-xs mt-1">Aucun shift ne t'a été assigné pour cette semaine.</p>
            </div>
          )}
        </>
      )}

      {/* ── REQUESTS SECTION ── */}
      {activeSection === 'requests' && (
        <div className="space-y-3">
          <button
            onClick={() => openForm()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-primary/40 text-primary text-xs font-medium hover:bg-primary/5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouvelle demande de congé / disponibilité
          </button>

          {requests.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Send className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-semibold text-foreground text-sm">Aucune demande</p>
              <p className="text-xs mt-1">Tes demandes apparaîtront ici.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map(req => (
                <RequestCard
                  key={req.id}
                  req={req}
                  onDelete={id => setRequests(prev => prev.filter(r => r.id !== id))}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Form Modal ── */}
      {showForm && currentUser && (
        <RequestForm
          preselectedDate={formDate}
          onClose={() => setShowForm(false)}
          onSaved={loadRequests}
          userId={currentUser.id}
          userName={currentUser.name}
        />
      )}
    </div>
  );
}
