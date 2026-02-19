import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { ArrowLeftRight, CheckCircle2, XCircle, Clock, Plus, X, Send, Hourglass, CalendarDays } from 'lucide-react';
import { TEAM_LABELS } from '@/data/initialData';

interface ShiftSwapRequest {
  id: string;
  requester_id: string;
  requester_name: string;
  shift_id: string | null;
  target_user_id: string | null;
  target_user_name: string | null;
  target_shift_id: string | null;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  reviewed_by_name: string | null;
  created_at: string;
  updated_at: string;
}

interface PlanningShift {
  id: string;
  date: string;
  shift_type: string;
  shift_start: string;
  shift_end: string;
  team: string;
  user_id: string | null;
  user_name: string;
}

const STATUS_STYLE = {
  pending:  { label: 'En attente', icon: <Hourglass className="w-3 h-3" />,     cls: 'bg-muted text-muted-foreground border-border' },
  approved: { label: 'Approuvé',   icon: <CheckCircle2 className="w-3 h-3" />,  cls: 'bg-timer-safe/10 text-timer-safe border-timer-safe/30' },
  rejected: { label: 'Refusé',     icon: <XCircle className="w-3 h-3" />,        cls: 'bg-destructive/10 text-destructive border-destructive/30' },
};

function formatShift(s: PlanningShift) {
  return `${new Date(s.date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${s.shift_start.slice(0, 5)}–${s.shift_end.slice(0, 5)} · ${TEAM_LABELS[s.team] ?? s.team}`;
}

// ─── Create Swap Request Form ─────────────────────────────────────────────────

interface CreateSwapFormProps {
  onClose: () => void;
  onSaved: () => void;
}

function CreateSwapForm({ onClose, onSaved }: CreateSwapFormProps) {
  const { currentUser, users } = useApp();
  const [myShifts, setMyShifts] = useState<PlanningShift[]>([]);
  const [targetShifts, setTargetShifts] = useState<PlanningShift[]>([]);
  const [selectedMyShift, setSelectedMyShift] = useState('');
  const [selectedTargetUserId, setSelectedTargetUserId] = useState('');
  const [selectedTargetShift, setSelectedTargetShift] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const maxDate = futureDate.toISOString().split('T')[0];

  useEffect(() => {
    if (!currentUser) return;
    supabase.from('planning_shifts')
      .select('*')
      .eq('user_id', currentUser.id)
      .gte('date', today)
      .lte('date', maxDate)
      .order('date')
      .then(({ data }) => setMyShifts((data ?? []) as PlanningShift[]));
  }, [currentUser?.id]);

  useEffect(() => {
    if (!selectedTargetUserId) { setTargetShifts([]); return; }
    supabase.from('planning_shifts')
      .select('*')
      .eq('user_id', selectedTargetUserId)
      .gte('date', today)
      .lte('date', maxDate)
      .order('date')
      .then(({ data }) => setTargetShifts((data ?? []) as PlanningShift[]));
  }, [selectedTargetUserId]);

  const otherStaff = users.filter(u => u.id !== currentUser?.id && u.role !== 'owner');

  const handleSubmit = async () => {
    if (!currentUser) return;
    if (!selectedMyShift) { setError('Sélectionne ton shift.'); return; }
    setSaving(true);
    setError('');
    const { error: dbErr } = await supabase.from('shift_swap_requests').insert({
      requester_id: currentUser.id,
      requester_name: currentUser.name,
      shift_id: selectedMyShift || null,
      target_user_id: selectedTargetUserId || null,
      target_user_name: otherStaff.find(u => u.id === selectedTargetUserId)?.name ?? null,
      target_shift_id: selectedTargetShift || null,
      note: note.trim() || null,
    });
    setSaving(false);
    if (dbErr) { setError('Erreur lors de la soumission.'); return; }
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-card rounded-2xl w-full max-w-sm p-5 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-primary" />
            Demander un échange
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* My shift */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Mon shift à échanger</p>
          <select
            value={selectedMyShift}
            onChange={e => setSelectedMyShift(e.target.value)}
            className="w-full bg-secondary text-foreground text-xs rounded-xl px-3 py-2.5 border border-border focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            <option value="">-- Choisir un shift --</option>
            {myShifts.map(s => (
              <option key={s.id} value={s.id}>{formatShift(s)}</option>
            ))}
          </select>
          {myShifts.length === 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">Aucun shift à venir.</p>
          )}
        </div>

        {/* Target user */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Avec qui ? (optionnel)</p>
          <select
            value={selectedTargetUserId}
            onChange={e => { setSelectedTargetUserId(e.target.value); setSelectedTargetShift(''); }}
            className="w-full bg-secondary text-foreground text-xs rounded-xl px-3 py-2.5 border border-border focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            <option value="">-- Collègue (optionnel) --</option>
            {otherStaff.map(u => (
              <option key={u.id} value={u.id}>{u.name} · {TEAM_LABELS[u.team] ?? u.team}</option>
            ))}
          </select>
        </div>

        {/* Target shift */}
        {selectedTargetUserId && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Son shift souhaité (optionnel)</p>
            <select
              value={selectedTargetShift}
              onChange={e => setSelectedTargetShift(e.target.value)}
              className="w-full bg-secondary text-foreground text-xs rounded-xl px-3 py-2.5 border border-border focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              <option value="">-- Shift de l'autre --</option>
              {targetShifts.map(s => (
                <option key={s.id} value={s.id}>{formatShift(s)}</option>
              ))}
            </select>
          </div>
        )}

        {/* Note */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Message au Manager</p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Raison de l'échange, contexte..."
            className="w-full bg-secondary text-foreground text-xs rounded-xl px-3 py-2.5 border border-border focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/60 resize-none"
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-medium hover:bg-muted transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !selectedMyShift}
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

// ─── Manager Review Modal ──────────────────────────────────────────────────────

function ReviewModal({ req, onClose, onDone }: { req: ShiftSwapRequest; onClose: () => void; onDone: () => void }) {
  const { currentUser } = useApp();
  const [rejectionReason, setRejectionReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);

  const handleReview = async (approve: boolean) => {
    if (!approve && !rejectionReason.trim()) { return; }
    if (!currentUser) return;
    setSaving(true);
    setAction(approve ? 'approve' : 'reject');

    const updateData: Record<string, unknown> = {
      status: approve ? 'approved' : 'rejected',
      reviewed_by: currentUser.id,
      reviewed_by_name: currentUser.name,
    };
    if (!approve) updateData.rejection_reason = rejectionReason.trim();

    await supabase.from('shift_swap_requests').update(updateData).eq('id', req.id);

    // If approved and has a shift_id, swap user_id on the shifts
    if (approve && req.shift_id && req.target_shift_id && req.target_user_id) {
      // Swap the user_id values between the two shifts
      await supabase.from('planning_shifts').update({
        user_id: req.target_user_id,
        user_name: req.target_user_name ?? '',
      }).eq('id', req.shift_id);

      await supabase.from('planning_shifts').update({
        user_id: req.requester_id,
        user_name: req.requester_name,
      }).eq('id', req.target_shift_id);
    }

    setSaving(false);
    onDone();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-card rounded-2xl w-full max-w-sm p-5 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground text-sm">Traiter la demande</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="bg-secondary/60 rounded-xl p-3 space-y-1.5 text-xs">
          <p className="font-semibold text-foreground">{req.requester_name}</p>
          {req.target_user_name && (
            <p className="text-muted-foreground">Échange avec : <span className="font-medium text-foreground">{req.target_user_name}</span></p>
          )}
          {req.note && <p className="text-muted-foreground italic">"{req.note}"</p>}
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Motif de refus (si refus)</p>
          <textarea
            value={rejectionReason}
            onChange={e => setRejectionReason(e.target.value)}
            rows={2}
            placeholder="Obligatoire si refus..."
            className="w-full bg-secondary text-foreground text-xs rounded-xl px-3 py-2.5 border border-border focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/60 resize-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleReview(false)}
            disabled={saving || !rejectionReason.trim()}
            className="flex-1 py-2.5 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" />
            Refuser
          </button>
          <button
            onClick={() => handleReview(true)}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-timer-safe/15 text-timer-safe text-xs font-semibold hover:bg-timer-safe/25 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approuver
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface ShiftSwapModuleProps {
  canManage?: boolean;
}

export function ShiftSwapModule({ canManage = false }: ShiftSwapModuleProps) {
  const { currentUser } = useApp();
  const [requests, setRequests] = useState<ShiftSwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<ShiftSwapRequest | null>(null);

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    let query = supabase.from('shift_swap_requests').select('*').order('created_at', { ascending: false });
    if (!canManage) query = query.or(`requester_id.eq.${currentUser.id},target_user_id.eq.${currentUser.id}`);
    const { data } = await query;
    setRequests((data ?? []) as ShiftSwapRequest[]);
    setLoading(false);
  }, [currentUser?.id, canManage]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('shift-swaps')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_swap_requests' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const pending = requests.filter(r => r.status === 'pending');
  const resolved = requests.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-primary" />
            Échanges de shifts
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pending.length} demande{pending.length !== 1 ? 's' : ''} en attente
          </p>
        </div>
        {!canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            Demander
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Clock className="w-5 h-5 animate-spin mr-2" />
          Chargement...
        </div>
      )}

      {!loading && requests.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <ArrowLeftRight className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium text-foreground">Aucun échange</p>
          <p className="text-xs mt-1">Les demandes apparaîtront ici</p>
        </div>
      )}

      {/* Pending requests */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Hourglass className="w-3.5 h-3.5" />
            En attente ({pending.length})
          </h3>
          {pending.map(req => (
            <div key={req.id} className="glass-card rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{req.requester_name}</p>
                  {req.target_user_name && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Échange avec : <span className="font-medium">{req.target_user_name}</span>
                    </p>
                  )}
                  {req.note && (
                    <p className="text-[11px] text-muted-foreground/70 italic mt-1">"{req.note}"</p>
                  )}
                </div>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold flex-shrink-0 ${STATUS_STYLE.pending.cls}`}>
                  {STATUS_STYLE.pending.icon}
                  {STATUS_STYLE.pending.label}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                {new Date(req.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
              {canManage && (
                <button
                  onClick={() => setReviewTarget(req)}
                  className="w-full py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Traiter la demande
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Resolved */}
      {resolved.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Historique</h3>
          {resolved.map(req => {
            const s = STATUS_STYLE[req.status];
            return (
              <div key={req.id} className="glass-card rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground">{req.requester_name}</p>
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${s.cls}`}>
                    {s.icon}
                    {s.label}
                  </div>
                </div>
                {req.target_user_name && (
                  <p className="text-[11px] text-muted-foreground">Avec : {req.target_user_name}</p>
                )}
                {req.rejection_reason && (
                  <p className="text-[11px] text-destructive italic">Motif : "{req.rejection_reason}"</p>
                )}
                {req.reviewed_by_name && (
                  <p className="text-[10px] text-muted-foreground/70">Traité par {req.reviewed_by_name}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateSwapForm onClose={() => setShowCreate(false)} onSaved={load} />
      )}
      {reviewTarget && (
        <ReviewModal req={reviewTarget} onClose={() => setReviewTarget(null)} onDone={load} />
      )}
    </div>
  );
}
