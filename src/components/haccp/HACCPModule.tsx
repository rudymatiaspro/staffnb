import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import { Thermometer, Plus, AlertTriangle, CheckCircle, Download, X, ShieldCheck, Trash2 } from 'lucide-react';
import { PinEntry } from '../auth/PinEntry';
import { verifyPin } from '../../lib/pinCrypto';
import { logAudit } from '../../lib/auditLogger';

// ─── Zone presets with fixed thresholds ─────────────────────────────────────

type Zone = 'Frigo' | 'Congélateur' | 'Plat chaud' | 'Livraison';

const ZONE_CONFIG: Record<Zone, { min?: number; max: number; hint: string }> = {
  'Frigo':       { min: 0,   max: 4,   hint: '0°C à 4°C' },
  'Congélateur': { max: -18, hint: '< -18°C' },
  'Plat chaud':  { min: 63,  max: 999, hint: '> 63°C' },
  'Livraison':   { min: 0,   max: 8,   hint: '0°C à 8°C' },
};

const ZONES = Object.keys(ZONE_CONFIG) as Zone[];

function isAlert(zone: Zone, temp: number): boolean {
  const cfg = ZONE_CONFIG[zone];
  if (zone === 'Plat chaud') return temp < (cfg.min ?? 63);
  if (zone === 'Congélateur') return temp > cfg.max;
  return temp > cfg.max || (cfg.min !== undefined && temp < cfg.min);
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface HACCPLog {
  id: string;
  zone: Zone;
  temperature: number;
  observation: string;
  status: 'ok' | 'alert';
  signed_by_pin: boolean;
  user_id: string | null;
  logged_by: string;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function last7Days(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  canExport?: boolean;
  canManageLocations?: boolean;
  canDelete?: boolean;
}

export function HACCPModule({ canExport = false, canDelete = false }: Props) {
  const { currentUser } = useApp();
  const [logs, setLogs] = useState<HACCPLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingEntry, setPendingEntry] = useState<Omit<HACCPLog, 'id' | 'created_at'> | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [zone, setZone] = useState<Zone>('Frigo');
  const [tempInput, setTempInput] = useState('');
  const [observation, setObservation] = useState('');
  const [formTime, setFormTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [formError, setFormError] = useState('');
  const [alertPreview, setAlertPreview] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('temperature_logs')
      .select('*')
      .gte('created_at', last7Days())
      .order('created_at', { ascending: false });
    if (data) {
      setLogs(data.map(r => ({
        id: r.id,
        zone: (r.location_name as Zone) ?? 'Frigo',
        temperature: Number(r.temperature),
        observation: r.note ?? '',
        status: r.is_alert ? 'alert' : 'ok',
        signed_by_pin: true,
        user_id: r.logged_by_user_id ?? null,
        logged_by: r.logged_by,
        created_at: r.created_at,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Update alert preview in real-time
  useEffect(() => {
    if (!tempInput) { setAlertPreview(false); return; }
    const t = parseFloat(tempInput);
    if (isNaN(t)) { setAlertPreview(false); return; }
    setAlertPreview(isAlert(zone, t));
  }, [zone, tempInput]);

  const handleValidate = () => {
    setFormError('');
    const t = parseFloat(tempInput);
    if (isNaN(t)) { setFormError('Entrez une température valide'); return; }
    if (!currentUser) return;

    const alert = isAlert(zone, t);
    const entry: Omit<HACCPLog, 'id' | 'created_at'> = {
      zone,
      temperature: t,
      observation,
      status: alert ? 'alert' : 'ok',
      signed_by_pin: false,
      user_id: currentUser.id,
      logged_by: currentUser.name,
    };
    setPendingEntry(entry);
    setShowPinEntry(true);
  };

  const handlePinSuccess = async (pin: string) => {
    if (!pendingEntry || !currentUser) return;
    setSaving(true);

    // Verify PIN
    const storedHash = currentUser.pin ?? '';
    let pinOk = false;
    if (!storedHash) {
      pinOk = pin === '154154'; // default
    } else {
      const res = await verifyPin(storedHash, pin);
      pinOk = res === 'match' || res === 'legacy'; // legacy = old btoa
    }

    if (!pinOk) {
      setSaving(false);
      setShowPinEntry(false);
      setFormError('PIN incorrect — contrôle non signé');
      return;
    }

    // Find or create the location in temperature_locations
    const { data: locData } = await supabase
      .from('temperature_locations')
      .select('id')
      .eq('name', pendingEntry.zone)
      .limit(1);

    let locationId = locData?.[0]?.id;
    if (!locationId) {
      const cfg = ZONE_CONFIG[pendingEntry.zone];
      const { data: newLoc } = await supabase
        .from('temperature_locations')
        .insert({
          name: pendingEntry.zone,
          max_threshold: cfg.max,
          min_threshold: cfg.min ?? null,
          is_custom: false,
        })
        .select('id')
        .single();
      locationId = newLoc?.id;
    }

    if (!locationId) { setSaving(false); return; }

    const { error } = await supabase.from('temperature_logs').insert({
      location_id: locationId,
      location_name: pendingEntry.zone,
      temperature: pendingEntry.temperature,
      unit: '°C',
      is_alert: pendingEntry.status === 'alert',
      note: pendingEntry.observation || null,
      logged_by: currentUser.name,
      logged_by_user_id: currentUser.id,
    });

    if (!error) {
      // Notify manager if alert
      if (pendingEntry.status === 'alert') {
        const { data: managers } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['manager', 'admin', 'owner']);
        if (managers) {
          await supabase.from('notifications').insert(
            managers.map(m => ({
              user_id: m.user_id,
              type: 'haccp',
              title: `🌡️ Alerte HACCP — ${pendingEntry.zone}`,
              body: `Température hors norme : ${pendingEntry.temperature}°C relevée par ${currentUser.name}.${pendingEntry.observation ? ` Note : ${pendingEntry.observation}` : ''}`,
              ref_type: 'haccp',
            }))
          );
        }
      }

      await logAudit(currentUser.id, currentUser.name, 'haccp_logged', 'temperature_log', undefined, {
        zone: pendingEntry.zone,
        temperature: pendingEntry.temperature,
        status: pendingEntry.status,
      });

      // Reset form
      setZone('Frigo');
      setTempInput('');
      setObservation('');
      setFormTime(new Date().toTimeString().slice(0, 5));
      setShowForm(false);
      fetchLogs();
    }

    setSaving(false);
    setShowPinEntry(false);
    setPendingEntry(null);
  };

  const handleDeleteLog = async (logId: string) => {
    await supabase.from('temperature_logs').delete().eq('id', logId);
    setDeletingId(null);
    // Notify via day report
    if (currentUser) {
      await logAudit(currentUser.id, currentUser.name, 'haccp_deleted', 'temperature_log', logId, { deleted_by: currentUser.name });
      // Insert notification for managers
      const { data: managers } = await supabase.from('user_roles').select('user_id').in('role', ['manager', 'admin', 'owner', 'god']);
      if (managers) {
        await supabase.from('notifications').insert(
          managers.map(m => ({
            user_id: m.user_id,
            type: 'haccp',
            title: '🗑️ Relevé HACCP supprimé',
            body: `Un relevé HACCP a été supprimé par ${currentUser.name}.`,
          }))
        );
      }
    }
    fetchLogs();
  };

  const exportCSV = () => {
    const headers = 'Zone,Température (°C),Statut,Contrôleur,Observation,Date/Heure\n';
    const rows = logs.map(l =>
      `"${l.zone}",${l.temperature},${l.status === 'alert' ? 'ALERTE' : 'OK'},"${l.logged_by}","${l.observation ?? ''}","${fmt(l.created_at)}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `haccp-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const alertCount = logs.filter(l => l.status === 'alert').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-primary" />
            HACCP — Contrôles Températures
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            7 derniers jours · {logs.length} relevés
            {alertCount > 0 && <span className="text-destructive font-medium"> · {alertCount} alerte{alertCount > 1 ? 's' : ''}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {canExport && (
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" /> Nouveau relevé
          </button>
        </div>
      </div>

      {/* Zone summary cards */}
      <div className="grid grid-cols-2 gap-2">
        {ZONES.map(z => {
          const lastLog = logs.filter(l => l.zone === z).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
          return (
            <div key={z} className={`rounded-xl p-3 border text-center ${lastLog?.status === 'alert' ? 'bg-destructive/10 border-destructive/30' : 'bg-card border-border'}`}>
              <p className="text-[10px] text-muted-foreground font-medium">{z}</p>
              <p className="text-[9px] text-muted-foreground/60 mb-1">{ZONE_CONFIG[z].hint}</p>
              {lastLog ? (
                <>
                  <p className={`text-xl font-black ${lastLog.status === 'alert' ? 'text-destructive' : 'text-[hsl(var(--timer-safe))]'}`}>
                    {lastLog.temperature}°C
                  </p>
                  <p className="text-[9px] text-muted-foreground">{fmt(lastLog.created_at)}</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground/50 mt-2 italic">Pas de données</p>
              )}
            </div>
          );
        })}
      </div>

      {/* History table */}
      {loading ? (
        <p className="text-xs text-muted-foreground text-center py-6">Chargement…</p>
      ) : logs.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Thermometer className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm font-medium">Aucun relevé de température</p>
          <p className="text-xs mt-1">Commencez à enregistrer pour la conformité HACCP</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <div
              key={log.id}
              className={`rounded-xl p-3 border flex items-center gap-3 ${log.status === 'alert' ? 'bg-destructive/10 border-destructive/30' : 'bg-[hsl(var(--timer-safe)/0.05)] border-[hsl(var(--timer-safe)/0.2)]'}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${log.status === 'alert' ? 'bg-destructive/20' : 'bg-[hsl(var(--timer-safe)/0.2)]'}`}>
                {log.status === 'alert'
                  ? <AlertTriangle className="w-4 h-4 text-destructive" />
                  : <CheckCircle className="w-4 h-4 text-[hsl(var(--timer-safe))]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{log.zone}</span>
                  {log.status === 'alert' && (
                    <span className="text-[9px] font-bold text-destructive bg-destructive/15 px-1.5 py-0.5 rounded">ALERTE</span>
                  )}
                  {log.signed_by_pin && (
                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                      <ShieldCheck className="w-2.5 h-2.5" /> signé
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">{log.logged_by}{log.observation ? ` · ${log.observation}` : ''}</p>
              </div>
              <div className="text-right flex-shrink-0 flex items-center gap-2">
                <div>
                  <p className={`text-sm font-black ${log.status === 'alert' ? 'text-destructive' : 'text-[hsl(var(--timer-safe))]'}`}>
                    {log.temperature}°C
                  </p>
                  <p className="text-[9px] text-muted-foreground">{fmt(log.created_at)}</p>
                </div>
                {canDelete && (
                  <button
                    onClick={() => setDeletingId(log.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Supprimer ce relevé"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-border">
            <h3 className="text-sm font-bold text-foreground mb-2">Supprimer ce relevé ?</h3>
            <p className="text-xs text-muted-foreground mb-5">Cette action est irréversible. Les managers seront notifiés dans le rapport du jour.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingId(null)} className="flex-1 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-secondary">Annuler</button>
              <button onClick={() => handleDeleteLog(deletingId)} className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold hover:opacity-90">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* New entry form modal */}
      {showForm && !showPinEntry && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-border animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-primary" />
                Relevé de température
              </h3>
              <button onClick={() => { setShowForm(false); setFormError(''); }} className="p-1 rounded-lg hover:bg-secondary">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Zone */}
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Zone *</label>
                <div className="grid grid-cols-2 gap-2">
                  {ZONES.map(z => (
                    <button
                      key={z}
                      onClick={() => setZone(z)}
                      className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all text-left ${zone === z ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border text-foreground hover:border-primary/40'}`}
                    >
                      {z}
                      <span className="block text-[9px] opacity-70 mt-0.5">{ZONE_CONFIG[z].hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Temperature */}
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Température (°C) *</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="ex: 3.5"
                  value={tempInput}
                  onChange={e => setTempInput(e.target.value)}
                  className="w-full text-sm border border-border rounded-xl px-3 py-2.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {alertPreview && (
                  <p className="text-[10px] text-destructive mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Hors norme — une alerte sera envoyée au manager
                  </p>
                )}
                {tempInput && !alertPreview && !isNaN(parseFloat(tempInput)) && (
                  <p className="text-[10px] text-[hsl(var(--timer-safe))] mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Dans la plage autorisée
                  </p>
                )}
              </div>

              {/* Heure */}
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Heure du contrôle</label>
                <input
                  type="time"
                  value={formTime}
                  onChange={e => setFormTime(e.target.value)}
                  className="w-full text-sm border border-border rounded-xl px-3 py-2.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Contrôleur (auto) */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary text-xs text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Contrôleur : <span className="font-semibold text-foreground">{currentUser?.name}</span>
              </div>

              {/* Observations */}
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Observations (optionnel)</label>
                <textarea
                  value={observation}
                  onChange={e => setObservation(e.target.value)}
                  placeholder="ex: frigo laissé ouvert, maintenance en cours…"
                  rows={2}
                  className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {formError && (
                <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{formError}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setShowForm(false); setFormError(''); }}
                  className="flex-1 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-secondary"
                >
                  Annuler
                </button>
                <button
                  onClick={handleValidate}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-90"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Valider avec PIN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PIN entry to sign */}
      {showPinEntry && currentUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-border animate-slide-up">
            <PinEntry
              user={currentUser}
              isFirstTime={false}
              onSuccess={async (pin) => {
                await handlePinSuccess(pin);
              }}
              onBack={() => { setShowPinEntry(false); setPendingEntry(null); }}
            />
            {saving && (
              <p className="text-xs text-muted-foreground text-center mt-3">Enregistrement…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
