import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import { Flag, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface ScoreEvent {
  id: string;
  userId: string;
  userName: string;
  team: string;
  type: string;
  reason: string;
  points: number;
  timestamp: Date;
}

interface Contest {
  id: string;
  scoreEventId: string | null;
  contestantId: string;
  contestantName: string;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  arbiterName: string | null;
  arbiterNote: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  // joined
  scoreEvent?: ScoreEvent;
}

interface MalusContestModuleProps {
  canArbitrate?: boolean;  // manager/owner/admin
}

export function MalusContestModule({ canArbitrate = false }: MalusContestModuleProps) {
  const { currentUser } = useApp();
  const [myScoreEvents, setMyScoreEvents] = useState<ScoreEvent[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(false);
  const [showContest, setShowContest] = useState<string | null>(null);
  const [contestReason, setContestReason] = useState('');
  const [arbitreNote, setArbitreNote] = useState('');
  const [arbitreContest, setArbitreContest] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // Fetch my negative score events
      const { data: evts } = await supabase
        .from('score_events')
        .select('*')
        .eq('user_id', currentUser.id)
        .lt('points', 0)
        .order('timestamp', { ascending: false })
        .limit(50);

      setMyScoreEvents((evts ?? []).map(r => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        team: r.team,
        type: r.type,
        reason: r.reason,
        points: r.points,
        timestamp: new Date(r.timestamp),
      })));

      // Fetch contests
      const { data: ctsts } = canArbitrate
        ? await supabase.from('malus_contests').select('*').order('created_at', { ascending: false })
        : await supabase.from('malus_contests').select('*').eq('contestant_id', currentUser.id).order('created_at', { ascending: false });

      setContests((ctsts ?? []).map(r => ({
        id: r.id,
        scoreEventId: r.score_event_id,
        contestantId: r.contestant_id,
        contestantName: r.contestant_name,
        reason: r.reason,
        status: r.status as Contest['status'],
        arbiterName: r.arbiter_name,
        arbiterNote: r.arbiter_note,
        createdAt: new Date(r.created_at),
        resolvedAt: r.resolved_at ? new Date(r.resolved_at) : null,
      })));
    } finally {
      setLoading(false);
    }
  }, [currentUser, canArbitrate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const submitContest = async (eventId: string) => {
    if (!currentUser || !contestReason.trim()) return;
    const { error } = await supabase.from('malus_contests').insert({
      score_event_id: eventId,
      contestant_id: currentUser.id,
      contestant_name: currentUser.name,
      reason: contestReason.trim(),
    });
    if (!error) {
      setContestReason('');
      setShowContest(null);
      fetchData();
    }
  };

  const resolveContest = async (contestId: string, accepted: boolean) => {
    if (!currentUser) return;
    const { error } = await supabase.from('malus_contests').update({
      status: accepted ? 'accepted' : 'rejected',
      arbiter_id: currentUser.id,
      arbiter_name: currentUser.name,
      arbiter_note: arbitreNote.trim() || null,
      resolved_at: new Date().toISOString(),
    }).eq('id', contestId);
    if (!error) {
      setArbitreNote('');
      setArbitreContest(null);
      fetchData();
    }
  };

  // Which events can still be contested (no pending/accepted contest)
  const contestedEventIds = new Set(contests.filter(c => c.status !== 'rejected').map(c => c.scoreEventId));
  const contestableEvents = myScoreEvents.filter(e => !contestedEventIds.has(e.id));
  const pendingContests = contests.filter(c => c.status === 'pending');

  const statusBadge = (status: Contest['status']) => {
    if (status === 'pending') return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">En attente</span>;
    if (status === 'accepted') return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-timer-safe/15 text-timer-safe font-medium">Acceptée</span>;
    return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium">Refusée</span>;
  };

  return (
    <div className="space-y-5">
      {/* ── Arbitrage (Manager/Owner) ── */}
      {canArbitrate && pendingContests.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-foreground">Contestations à traiter ({pendingContests.length})</h2>
          </div>
          {pendingContests.map(ct => (
            <div key={ct.id} className="glass-card rounded-xl p-4 border border-amber-500/20 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{ct.contestantName}</p>
                  <p className="text-xs text-muted-foreground">{ct.createdAt.toLocaleDateString('fr-FR')}</p>
                </div>
                {statusBadge(ct.status)}
              </div>
              <div className="p-3 rounded-lg bg-secondary">
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-medium">Motif de contestation</p>
                <p className="text-sm text-foreground">{ct.reason}</p>
              </div>

              {arbitreContest === ct.id ? (
                <div className="space-y-2">
                  <textarea
                    value={arbitreNote}
                    onChange={e => setArbitreNote(e.target.value)}
                    placeholder="Note de l'arbitre (optionnel)…"
                    rows={2}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-secondary border border-border text-foreground focus:outline-none focus:border-primary resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => resolveContest(ct.id, true)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-timer-safe/15 text-timer-safe text-xs font-semibold hover:bg-timer-safe/25 transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Accepter — annuler malus
                    </button>
                    <button
                      onClick={() => resolveContest(ct.id, false)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-destructive/15 text-destructive text-xs font-semibold hover:bg-destructive/25 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Refuser
                    </button>
                  </div>
                  <button onClick={() => setArbitreContest(null)} className="w-full text-xs text-muted-foreground py-1">Annuler</button>
                </div>
              ) : (
                <button
                  onClick={() => setArbitreContest(ct.id)}
                  className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  Trancher cette contestation
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Staff: mes malus contestables ── */}
      {!canArbitrate && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-destructive" />
            <h2 className="text-sm font-bold text-foreground">Mes pénalités récentes</h2>
          </div>
          {contestableEvents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Aucune pénalité à contester</p>
            </div>
          )}
          {contestableEvents.map(evt => (
            <div key={evt.id} className="glass-card rounded-xl p-4 border border-destructive/15 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{evt.reason || 'Pénalité'}</p>
                  <p className="text-xs text-muted-foreground">{evt.timestamp.toLocaleDateString('fr-FR')} · {evt.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <span className="text-lg font-black text-destructive">{evt.points}pts</span>
              </div>

              {showContest === evt.id ? (
                <div className="space-y-2">
                  <textarea
                    value={contestReason}
                    onChange={e => setContestReason(e.target.value)}
                    placeholder="Expliquez pourquoi cette pénalité est injustifiée…"
                    rows={3}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-secondary border border-border text-foreground focus:outline-none focus:border-primary resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setShowContest(null)} className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs">Annuler</button>
                    <button
                      onClick={() => submitContest(evt.id)}
                      disabled={!contestReason.trim()}
                      className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-30"
                    >
                      Soumettre
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowContest(evt.id)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <Flag className="w-3 h-3" /> Contester cette pénalité
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Historique des contestations ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-bold text-foreground">
            {canArbitrate ? 'Toutes les contestations' : 'Mes contestations'}
          </h2>
          <span className="text-xs text-muted-foreground ml-auto">{contests.length} total</span>
        </div>
        {contests.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground text-center py-4">Aucune contestation</p>
        )}
        {contests.filter(c => c.status !== 'pending').map(ct => (
          <div key={ct.id} className="glass-card rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">{ct.contestantName}</p>
              {statusBadge(ct.status)}
            </div>
            <p className="text-xs text-muted-foreground">{ct.reason}</p>
            {ct.arbiterNote && (
              <div className="px-2 py-1.5 rounded-lg bg-secondary">
                <p className="text-xs text-muted-foreground">Arbitre: {ct.arbiterName} — {ct.arbiterNote}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
