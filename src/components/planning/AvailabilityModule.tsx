import { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import { CalendarDays, ChevronLeft, ChevronRight, Check, X, Clock } from 'lucide-react';

type AvailabilityType = 'day_off' | 'available' | 'partial';

interface AvailRequest {
  id: string;
  date: string;
  type: string;
  note: string;
  status: string;
  user_name: string;
  user_id: string;
}

function getWeekDates(offset: number): string[] {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  day_off:   { label: 'Congé',       color: 'text-timer-danger',   bg: 'bg-destructive/15 border-destructive/30' },
  available: { label: 'Disponible',  color: 'text-timer-safe',     bg: 'bg-timer-safe/15 border-timer-safe/30' },
  partial:   { label: 'Partiel',     color: 'text-amber-600',      bg: 'bg-amber-500/15 border-amber-400/40' },
};

// ─── Staff: own availability week grid ───────────────────────────────────────
export function StaffAvailabilityView() {
  const { currentUser } = useApp();
  const [weekOffset, setWeekOffset] = useState(0);
  const [requests, setRequests] = useState<AvailRequest[]>([]);
  const [selected, setSelected] = useState<Record<string, AvailabilityType>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dates = getWeekDates(weekOffset);

  useEffect(() => {
    if (!currentUser) return;
    fetchRequests();
  }, [currentUser, weekOffset]);

  async function fetchRequests() {
    if (!currentUser) return;
    const { data } = await supabase
      .from('availability_requests')
      .select('*')
      .eq('user_id', currentUser.id)
      .gte('date', dates[0])
      .lte('date', dates[6]);
    if (data) {
      setRequests(data);
      const sel: Record<string, AvailabilityType> = {};
      const nts: Record<string, string> = {};
      data.forEach((r) => {
        sel[r.date] = r.type as AvailabilityType;
        nts[r.date] = r.note || '';
      });
      setSelected(sel);
      setNotes(nts);
    }
  }

  const toggle = (date: string, type: AvailabilityType) => {
    setSelected((prev) => ({ ...prev, [date]: prev[date] === type ? 'available' : type }));
  };

  const handleSave = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      for (const date of dates) {
        const type = selected[date];
        if (!type) continue;
        const existing = requests.find((r) => r.date === date);
        if (existing) {
          await supabase.from('availability_requests')
            .update({ type, note: notes[date] || '', status: 'pending' })
            .eq('id', existing.id);
        } else {
          await supabase.from('availability_requests').insert({
            user_id: currentUser.id,
            user_name: currentUser.name,
            date,
            type,
            note: notes[date] || '',
            status: 'pending',
          });
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await fetchRequests();
    } finally {
      setSaving(false);
    }
  };

  const weekLabel = (() => {
    const start = new Date(dates[0] + 'T12:00:00');
    const end = new Date(dates[6] + 'T12:00:00');
    return `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          Mes disponibilités
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset((p) => p - 1)} className="p-1.5 rounded-lg hover:bg-secondary"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-xs text-muted-foreground font-medium">{weekLabel}</span>
          <button onClick={() => setWeekOffset((p) => p + 1)} className="p-1.5 rounded-lg hover:bg-secondary"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {dates.map((date, i) => {
          const type = selected[date];
          const cfg = type ? TYPE_CONFIG[type] : null;
          const isPast = date < new Date().toISOString().split('T')[0];
          const req = requests.find((r) => r.date === date);
          const status = req?.status;

          return (
            <div key={date} className={`rounded-xl p-2 border text-center ${cfg ? cfg.bg : 'bg-card border-border'} ${isPast ? 'opacity-50' : ''}`}>
              <p className="text-[10px] font-bold text-muted-foreground mb-1">{DAY_LABELS[i]}</p>
              <p className="text-xs font-semibold text-foreground mb-2">{new Date(date + 'T12:00:00').getDate()}</p>

              {!isPast && (
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => toggle(date, 'day_off')}
                    className={`w-full py-1 rounded-lg text-[9px] font-bold border transition-all ${type === 'day_off' ? 'bg-destructive/20 border-destructive/40 text-timer-danger' : 'border-transparent text-muted-foreground hover:bg-muted'}`}
                  >
                    Congé
                  </button>
                  <button
                    onClick={() => toggle(date, 'available')}
                    className={`w-full py-1 rounded-lg text-[9px] font-bold border transition-all ${type === 'available' ? 'bg-timer-safe/20 border-timer-safe/40 text-timer-safe' : 'border-transparent text-muted-foreground hover:bg-muted'}`}
                  >
                    Dispo
                  </button>
                </div>
              )}

              {status && (
                <p className={`text-[8px] mt-1 font-medium ${status === 'approved' ? 'text-timer-safe' : status === 'rejected' ? 'text-timer-danger' : 'text-muted-foreground'}`}>
                  {status === 'approved' ? '✓ Approuvé' : status === 'rejected' ? '✗ Refusé' : '⏳ En attente'}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving || Object.keys(selected).length === 0}
        className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saved ? <><Check className="w-3.5 h-3.5" /> Enregistré</> : saving ? 'Enregistrement…' : 'Enregistrer les disponibilités'}
      </button>
    </div>
  );
}

// ─── Manager: read-only team availability view ────────────────────────────────
export function ManagerAvailabilityView() {
  const { users } = useApp();
  const [weekOffset, setWeekOffset] = useState(0);
  const [requests, setRequests] = useState<AvailRequest[]>([]);

  const dates = getWeekDates(weekOffset);
  const staffUsers = users.filter((u) => u.role === 'staff');

  useEffect(() => {
    fetchAll();
  }, [weekOffset]);

  async function fetchAll() {
    const { data } = await supabase
      .from('availability_requests')
      .select('*')
      .gte('date', dates[0])
      .lte('date', dates[6]);
    if (data) setRequests(data);
  }

  const approve = async (id: string) => {
    await supabase.from('availability_requests').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', id);
    fetchAll();
  };

  const reject = async (id: string) => {
    await supabase.from('availability_requests').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id);
    fetchAll();
  };

  const weekLabel = (() => {
    const start = new Date(dates[0] + 'T12:00:00');
    const end = new Date(dates[6] + 'T12:00:00');
    return `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          Disponibilités équipe
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset((p) => p - 1)} className="p-1.5 rounded-lg hover:bg-secondary"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-xs text-muted-foreground font-medium">{weekLabel}</span>
          <button onClick={() => setWeekOffset((p) => p + 1)} className="p-1.5 rounded-lg hover:bg-secondary"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-timer-safe inline-block" /> Disponible</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" /> Congé</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Partiel</span>
      </div>

      {/* Grid: staff × days */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead>
            <tr>
              <th className="text-left py-1.5 px-2 text-muted-foreground font-medium w-24">Staff</th>
              {dates.map((date, i) => (
                <th key={date} className="text-center py-1.5 px-1 text-muted-foreground font-medium">
                  <span>{DAY_LABELS[i]}</span>
                  <br />
                  <span className="font-bold text-foreground">{new Date(date + 'T12:00:00').getDate()}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staffUsers.map((user) => (
              <tr key={user.id} className="border-t border-border/30">
                <td className="py-2 px-2 font-medium text-foreground truncate max-w-[96px]">{user.name}</td>
                {dates.map((date) => {
                  const req = requests.find((r) => r.user_id === user.id && r.date === date);
                  if (!req) return <td key={date} className="py-2 px-1 text-center text-muted-foreground">—</td>;
                  const cfg = TYPE_CONFIG[req.type] ?? TYPE_CONFIG.available;
                  return (
                    <td key={date} className="py-2 px-1 text-center">
                      <div className={`inline-flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg border text-[9px] font-bold ${cfg.bg} ${cfg.color}`}>
                        <span>{cfg.label}</span>
                        {req.status === 'pending' && (
                          <div className="flex gap-1 mt-0.5">
                            <button onClick={() => approve(req.id)} className="text-timer-safe hover:text-timer-safe/80"><Check className="w-2.5 h-2.5" /></button>
                            <button onClick={() => reject(req.id)} className="text-timer-danger hover:text-timer-danger/80"><X className="w-2.5 h-2.5" /></button>
                          </div>
                        )}
                        {req.status !== 'pending' && (
                          <span className={`text-[8px] ${req.status === 'approved' ? 'text-timer-safe' : 'text-timer-danger'}`}>
                            {req.status === 'approved' ? '✓' : '✗'}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {staffUsers.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-6">Aucun membre staff trouvé</p>
      )}
    </div>
  );
}
