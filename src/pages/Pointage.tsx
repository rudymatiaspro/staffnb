import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../integrations/supabase/client';
import { verifyPin } from '../lib/pinCrypto';
import { User } from '../types';
import { Clock, LogIn, LogOut, Calendar, CheckCircle, Edit2, X, Save, Delete } from 'lucide-react';

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
  user_id: string;
  user_name: string;
}

const todayStr = () => new Date().toISOString().split('T')[0];

// ─── PIN verification helper ──────────────────────────────────────────────────
async function identifyByPin(pin: string, users: User[]): Promise<User | null> {
  if (!pin || pin.length !== 6) return null;
  for (const u of users) {
    if (u.role === 'station') continue;
    const { data } = await supabase
      .from('profiles')
      .select('pin_hash, pin_set')
      .eq('id', u.id)
      .maybeSingle();
    if (!data) continue;
    const storedHash = (data as any).pin_hash ?? '';
    let valid = false;
    if (!storedHash) {
      valid = pin === '000111';
    } else if (storedHash.includes(':')) {
      const res = await verifyPin(storedHash, pin);
      valid = res === 'match';
    } else {
      try { valid = storedHash === btoa(pin); } catch { valid = false; }
    }
    if (valid) return u;
  }
  return null;
}

// ─── PIN Pad (6 digits) ───────────────────────────────────────────────────────
const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
function PinPad({ pin, error, onKey, label }: { pin: string; error: boolean; onKey: (k: string) => void; label: string }) {
  return (
    <div className="w-full max-w-[260px] mx-auto">
      <p className="text-center text-xs text-muted-foreground mb-3">{label}</p>
      <div className="flex justify-center gap-2 mb-4">
        {[0,1,2,3,4,5].map((i) => (
          <div key={i} className={`w-3 h-3 rounded-full transition-all duration-200 ${
            i < pin.length ? (error ? 'bg-destructive scale-110' : 'bg-primary scale-110') : 'bg-secondary border-2 border-border'
          }`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((key, i) => (
          <button
            key={i}
            onClick={() => key === '⌫' ? onKey('del') : key ? onKey(key) : undefined}
            className={`h-12 rounded-xl text-base font-semibold transition-all active:scale-95 ${
              key === '' ? 'invisible' :
              key === '⌫' ? 'bg-secondary text-muted-foreground hover:bg-muted' :
              'bg-secondary text-foreground hover:bg-muted'
            }`}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Station Pointage (PIN-based clock in/out) ───────────────────────────────
function StationPointage() {
  const { users, clockAction } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [result, setResult] = useState<{ name: string; action: 'in' | 'out' } | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleKey = useCallback(async (key: string) => {
    if (result) return;
    if (key === 'del') { setPin(p => p.slice(0, -1)); setError(false); return; }
    if (pin.length >= 6) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 6) {
      const user = await identifyByPin(next, users);
      if (!user) {
        setError(true);
        setPin('');
        setTimeout(() => setError(false), 1500);
        return;
      }
      const action = clockAction(user.id);

      // Check planned shift & notify if unplanned
      if (action === 'in') {
        const today = todayStr();
        const { data: planned } = await supabase
          .from('planning_shifts')
          .select('id')
          .eq('user_id', user.id)
          .eq('date', today);
        if (!planned?.length) {
          const { data: managers } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role', ['manager', 'owner', 'admin']);
          if (managers?.length) {
            await supabase.from('notifications').insert(
              managers.map(m => ({
                user_id: m.user_id,
                type: 'unplanned_clockin',
                title: `⚠️ Pointage non planifié — ${user.name}`,
                body: `${user.name} a pointé son entrée sans être planifié aujourd'hui.`,
                ref_type: 'shift',
              }))
            );
          }
        }
      }

      setResult({ name: user.name, action });
      setTimeout(() => { setResult(null); setPin(''); }, 4000);
    }
  }, [pin, result, users, clockAction]);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleKey(e.key);
      if (e.key === 'Backspace') handleKey('del');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleKey]);

  return (
    <div className="space-y-5 px-4 pt-2 pb-4">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-5 text-center">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <p className="text-4xl font-black text-foreground mb-6 tabular-nums">
            {formatTime(now)}
          </p>

          {result ? (
            <div className="py-6 animate-slide-up">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${
                result.action === 'in' ? 'bg-[hsl(var(--timer-safe)/0.15)] border-4 border-[hsl(var(--timer-safe))]' : 'bg-primary/10 border-4 border-primary'
              }`}>
                {result.action === 'in'
                  ? <LogIn className="w-7 h-7 text-[hsl(var(--timer-safe))]" />
                  : <LogOut className="w-7 h-7 text-primary" />}
              </div>
              <h2 className="text-lg font-black text-foreground">
                {result.action === 'in' ? `Bonjour, ${result.name} !` : `À demain, ${result.name} !`}
              </h2>
              <p className={`text-sm font-semibold flex items-center justify-center gap-1.5 mt-2 ${
                result.action === 'in' ? 'text-[hsl(var(--timer-safe))]' : 'text-primary'
              }`}>
                <CheckCircle className="w-4 h-4" />
                {result.action === 'in' ? 'Entrée enregistrée' : 'Sortie enregistrée'}
              </p>
            </div>
          ) : (
            <>
              <PinPad pin={pin} error={error} onKey={handleKey} label="Entrez votre PIN (6 chiffres) pour pointer" />
              {error && (
                <p className="text-xs text-destructive font-medium mt-3">PIN inconnu — réessayez</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Owner Pointage (view all + manual edit) ──────────────────────────────────
function OwnerPointage() {
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editIn, setEditIn] = useState('');
  const [editOut, setEditOut] = useState('');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadShifts = async () => {
    setLoading(true);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const from = sevenDaysAgo.toISOString().split('T')[0];

    const { data } = await supabase
      .from('shifts')
      .select('*')
      .gte('date', from)
      .order('clock_in', { ascending: false });

    setShifts((data ?? []) as ShiftRow[]);
    setLoading(false);
  };

  useEffect(() => { loadShifts(); }, []);

  const startEdit = (shift: ShiftRow) => {
    setEditing(shift.id);
    const cIn = new Date(shift.clock_in);
    setEditIn(cIn.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    if (shift.clock_out) {
      const cOut = new Date(shift.clock_out);
      setEditOut(cOut.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    } else {
      setEditOut('');
    }
  };

  const saveEdit = async (shift: ShiftRow) => {
    // Parse times
    const [hIn, mIn] = editIn.split(':').map(Number);
    const baseDate = new Date(shift.date + 'T00:00:00');
    const newClockIn = new Date(baseDate);
    newClockIn.setHours(hIn, mIn, 0, 0);

    const updates: any = { clock_in: newClockIn.toISOString() };

    if (editOut) {
      const [hOut, mOut] = editOut.split(':').map(Number);
      const newClockOut = new Date(baseDate);
      newClockOut.setHours(hOut, mOut, 0, 0);
      updates.clock_out = newClockOut.toISOString();
      updates.total_minutes = Math.round((newClockOut.getTime() - newClockIn.getTime()) / 60000);
    } else {
      updates.clock_out = null;
      updates.total_minutes = null;
    }

    await supabase.from('shifts').update(updates).eq('id', shift.id);
    setEditing(null);
    await loadShifts();
  };

  const deleteShift = async (id: string) => {
    await supabase.from('shifts').delete().eq('id', id);
    setEditing(null);
    await loadShifts();
  };

  // Group by date
  const byDate = shifts.reduce<Record<string, ShiftRow[]>>((acc, s) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push(s);
    return acc;
  }, {});
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
  const today = todayStr();

  return (
    <div className="space-y-5 px-4 pt-2 pb-4">
      <div className="bg-card rounded-2xl border border-border shadow-sm p-5 text-center">
        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <p className="text-4xl font-black text-foreground mb-2 tabular-nums">{formatTime(now)}</p>
        <p className="text-xs text-muted-foreground">Vue gestionnaire — modification manuelle possible</p>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-bold text-foreground">Tous les pointages (7 derniers jours)</h2>
        </div>

        {loading ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-xs text-muted-foreground">Chargement...</p>
          </div>
        ) : dates.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">Aucun pointage</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dates.map(date => {
              const dayShifts = byDate[date];
              const isToday = date === today;
              const dayLabel = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'short',
              });
              return (
                <div key={date} className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className={`px-4 py-2 flex items-center gap-2 border-b border-border ${isToday ? 'bg-primary/5' : 'bg-secondary/40'}`}>
                    <span className="text-xs font-bold text-foreground capitalize">{dayLabel}</span>
                    {isToday && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">Aujourd'hui</span>}
                  </div>
                  {dayShifts.map(shift => {
                    const isEditing = editing === shift.id;
                    const cIn = new Date(shift.clock_in);
                    const cOut = shift.clock_out ? new Date(shift.clock_out) : null;
                    const mins = shift.total_minutes ?? (cOut ? Math.round((cOut.getTime() - cIn.getTime()) / 60000) : null);

                    return (
                      <div key={shift.id} className="flex items-center gap-3 px-4 py-3 text-sm border-b border-border last:border-b-0">
                        <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-primary mb-0.5">{shift.user_name}</p>
                          {isEditing ? (
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="time"
                                value={editIn}
                                onChange={e => setEditIn(e.target.value)}
                                className="px-2 py-1 rounded-lg border border-border bg-secondary text-foreground text-xs w-24"
                              />
                              <span className="text-muted-foreground">→</span>
                              <input
                                type="time"
                                value={editOut}
                                onChange={e => setEditOut(e.target.value)}
                                className="px-2 py-1 rounded-lg border border-border bg-secondary text-foreground text-xs w-24"
                                placeholder="--:--"
                              />
                            </div>
                          ) : (
                            <div>
                              <span className="font-medium text-foreground">{formatTime(cIn)}</span>
                              <span className="text-muted-foreground mx-2">→</span>
                              {cOut ? (
                                <span className="font-medium text-foreground">{formatTime(cOut)}</span>
                              ) : (
                                <span className="text-primary font-medium text-xs">En cours</span>
                              )}
                            </div>
                          )}
                        </div>
                        {!isEditing && mins !== null && (
                          <span className="text-xs font-bold text-muted-foreground">
                            {Math.floor(mins / 60)}h{String(mins % 60).padStart(2, '0')}
                          </span>
                        )}
                        {isEditing ? (
                          <div className="flex gap-1">
                            <button onClick={() => saveEdit(shift)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary">
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => deleteShift(shift.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive">
                              <Delete className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(shift)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
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

// ─── Staff Pointage (read-only own history) ───────────────────────────────────
function StaffPointage() {
  const { currentUser } = useApp();
  const [history, setHistory] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      setLoading(true);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const from = sevenDaysAgo.toISOString().split('T')[0];

      const { data } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', currentUser.id)
        .gte('date', from)
        .order('clock_in', { ascending: false });

      setHistory((data ?? []) as ShiftRow[]);
      setLoading(false);
    })();
  }, [currentUser]);

  if (!currentUser) return null;

  const today = todayStr();
  const activeShift = history.find(s => s.date === today && !s.clock_out) ?? null;
  const clockInDate = activeShift ? new Date(activeShift.clock_in) : null;
  const elapsed = clockInDate ? now.getTime() - clockInDate.getTime() : 0;

  const byDate = history.reduce<Record<string, ShiftRow[]>>((acc, s) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push(s);
    return acc;
  }, {});
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-5 px-4 pt-2 pb-4">
      {/* Status card */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-5 text-center">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <p className="text-4xl font-black text-foreground mb-4 tabular-nums">{formatTime(now)}</p>

          {activeShift ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                <span className="text-sm font-semibold text-primary">En service</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">Arrivée</p>
                  <p className="text-lg font-bold text-foreground">{formatTime(clockInDate!)}</p>
                </div>
                <div className="bg-secondary rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">Durée</p>
                  <p className="text-lg font-bold text-primary tabular-nums">{formatDuration(elapsed)}</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Pointez depuis la Station pour enregistrer votre présence.</p>
          )}
        </div>
      </div>

      {/* History */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-bold text-foreground">Mon historique (7 derniers jours)</h2>
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
            {dates.map(date => {
              const dayShifts = byDate[date];
              const isToday = date === today;
              const dayLabel = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'short',
              });
              return (
                <div key={date} className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className={`px-4 py-2 flex items-center gap-2 border-b border-border ${isToday ? 'bg-primary/5' : 'bg-secondary/40'}`}>
                    <span className="text-xs font-bold text-foreground capitalize">{dayLabel}</span>
                    {isToday && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">Aujourd'hui</span>}
                  </div>
                  {dayShifts.map(shift => {
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

// ─── Main Pointage Router ─────────────────────────────────────────────────────
export default function Pointage() {
  const { currentUser } = useApp();
  if (!currentUser) return null;

  const role = currentUser.role;

  // Station → PIN-based clock in/out
  if (role === 'station') return <StationPointage />;

  // Owner / God / Admin → view all + manual edit
  if (['owner', 'god', 'admin'].includes(role ?? '')) return <OwnerPointage />;

  // Everyone else → read-only own history
  return <StaffPointage />;
}
