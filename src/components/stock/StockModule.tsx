import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import { verifyPin } from '../../lib/pinCrypto';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Package, Search, AlertTriangle, CheckCircle, XCircle,
  TrendingUp, X, ChevronDown, Loader2, ClipboardList,
  History, FileText, RefreshCw, ArrowUpDown,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StockRow {
  id: string;
  product_id: string;
  current_quantity: number;
  unit: string | null;
  alert_threshold: number;
  max_threshold: number | null;
  last_updated: string;
  product: {
    id: string;
    name: string;
    category: string;
    supplier?: string | null;
  };
}

interface StockEntry {
  id: string;
  product_id: string;
  quantity: number;
  type: string;
  reason: string | null;
  note: string | null;
  order_id: string | null;
  created_by: string | null;
  created_at: string;
  creator?: { name: string } | null;
}

interface InventoryItem {
  product_id: string;
  product_name: string;
  category: string;
  theoretical: number;
  unit: string;
  counted: number;
}

type StockStatus = 'ok' | 'low' | 'out' | 'over';

function getStatus(s: StockRow): StockStatus {
  if (s.current_quantity === 0) return 'out';
  if (s.current_quantity <= s.alert_threshold) return 'low';
  if (s.max_threshold && s.current_quantity > s.max_threshold) return 'over';
  return 'ok';
}

const STATUS_CONFIG: Record<StockStatus, { label: string; dot: string; badge: string }> = {
  ok:   { label: 'OK',       dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  low:  { label: 'Bas',      dot: 'bg-amber-500',   badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  out:  { label: 'Rupture',  dot: 'bg-destructive', badge: 'bg-destructive/10 text-destructive' },
  over: { label: 'Sur-stock',dot: 'bg-blue-500',    badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
};

const TYPE_LABELS: Record<string, string> = {
  delivery:              'Livraison',
  manual_adjustment:     'Ajustement manuel',
  inventory_correction:  'Correction inventaire',
  loss:                  'Perte / Casse',
  internal_use:          'Consommation interne',
};

const ADJUSTMENT_REASONS = [
  { value: 'inventory_correction', label: 'Correction d\'inventaire' },
  { value: 'loss',                 label: 'Perte / Casse' },
  { value: 'internal_use',         label: 'Consommation interne' },
  { value: 'manual_adjustment',    label: 'Autre' },
];

// ─── PIN pad component ────────────────────────────────────────────────────────
function PinPad({ onConfirm, onCancel }: { onConfirm: (pin: string) => void; onCancel: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const digits = ['1','2','3','4','5','6','7','8','9','','0','del'];

  const handle = (d: string) => {
    if (d === 'del') { setPin((p) => p.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError('');
    if (next.length === 4) setTimeout(() => onConfirm(next), 120);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground text-center">Confirmez votre identité pour valider</p>
      <div className="flex justify-center gap-4">
        {[0,1,2,3].map((i) => (
          <div key={i} className={`w-3.5 h-3.5 rounded-full transition-all ${i < pin.length ? 'bg-primary scale-125' : 'bg-border'}`} />
        ))}
      </div>
      {error && <p className="text-xs text-destructive text-center">{error}</p>}
      <div className="grid grid-cols-3 gap-2">
        {digits.map((d, i) => {
          if (d === '') return <div key={i} />;
          return (
            <button key={i} onClick={() => handle(d)}
              className="h-12 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold text-lg active:scale-95 transition-all">
              {d === 'del' ? '⌫' : d}
            </button>
          );
        })}
      </div>
      <button onClick={onCancel} className="w-full text-sm text-muted-foreground hover:underline">Annuler</button>
    </div>
  );
}

// ─── Manual Adjustment Modal ──────────────────────────────────────────────────
function AdjustmentModal({
  stock, onClose, onDone,
}: { stock: StockRow; onClose: () => void; onDone: () => void }) {
  const { currentUser } = useApp();
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState<string>(ADJUSTMENT_REASONS[0].value);
  const [note, setNote] = useState('');
  const [step, setStep] = useState<'form' | 'pin'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const projected = stock.current_quantity + delta;

  const handleConfirmPin = async (pin: string) => {
    if (!currentUser) return;
    setLoading(true);
    setError('');
    try {
      // Verify PIN
      const { data: profile } = await supabase.from('profiles').select('pin_hash').eq('id', currentUser.id).single();
      let pinOk = false;
      if (profile?.pin_hash) {
        const res = await verifyPin(profile.pin_hash, pin);
        pinOk = res === 'match' || res === 'legacy';
      } else {
        pinOk = true; // No PIN set
      }
      if (!pinOk) { setError('PIN incorrect. Réessayez.'); setStep('form'); setLoading(false); return; }

      // Guard: stock cannot go negative
      if (projected < 0) {
        setError('Le stock ne peut pas être négatif.');
        setStep('form');
        setLoading(false);
        return;
      }

      // Insert entry
      await supabase.from('stock_entries').insert([{
        product_id: stock.product_id,
        quantity: delta,
        type: 'manual_adjustment',
        reason,
        note: note.trim() || null,
        created_by: currentUser.id,
      }]);

      // Update stock
      await supabase.from('stock').update({
        current_quantity: Math.max(0, projected),
        last_updated: new Date().toISOString(),
      }).eq('id', stock.id);

      onDone();
    } catch (e) {
      console.error(e);
      setError('Erreur lors de l\'ajustement.');
      setStep('form');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-sm font-bold text-foreground">Ajustement manuel</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          {step === 'form' ? (
            <>
              <div className="bg-muted/40 rounded-xl p-3 space-y-1">
                <p className="text-xs font-semibold text-foreground">{stock.product.name}</p>
                <p className="text-xs text-muted-foreground">Stock actuel : <span className="font-mono font-bold text-foreground">{stock.current_quantity} {stock.unit ?? ''}</span></p>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Type d'ajustement</label>
                <select value={reason} onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background text-foreground text-sm px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary">
                  {ADJUSTMENT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Quantité (+ ajout · − retrait)</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setDelta((d) => d - 1)}
                    className="w-10 h-10 rounded-xl bg-muted hover:bg-muted/80 font-bold text-lg flex items-center justify-center">−</button>
                  <input type="number" value={delta}
                    onChange={(e) => setDelta(Number(e.target.value))}
                    className="flex-1 text-center rounded-xl border border-border bg-background text-foreground font-mono font-bold text-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary" />
                  <button onClick={() => setDelta((d) => d + 1)}
                    className="w-10 h-10 rounded-xl bg-muted hover:bg-muted/80 font-bold text-lg flex items-center justify-center">+</button>
                </div>
                {projected < 0 && (
                  <p className="text-xs text-destructive mt-1">⚠️ Le stock ne peut pas être négatif.</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Nouveau stock : <span className={`font-mono font-bold ${projected < 0 ? 'text-destructive' : 'text-foreground'}`}>{projected} {stock.unit ?? ''}</span>
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Commentaire (optionnel)</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={200}
                  className="w-full rounded-xl border border-border bg-background text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>

              {error && <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}

              <button
                onClick={() => { if (projected < 0) { setError('Le stock ne peut pas être négatif.'); return; } if (delta === 0) { setError('Veuillez saisir une quantité.'); return; } setStep('pin'); }}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40">
                Confirmer l'ajustement
              </button>
            </>
          ) : (
            <PinPad onConfirm={handleConfirmPin} onCancel={() => setStep('form')} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Product detail + history modal ──────────────────────────────────────────
function ProductDetailModal({
  stock, onClose, onAdjust,
}: { stock: StockRow; onClose: () => void; onAdjust: () => void }) {
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('stock_entries')
      .select('*, creator:profiles!stock_entries_created_by_fkey(name)')
      .eq('product_id', stock.product_id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { setEntries((data as StockEntry[]) ?? []); setLoading(false); });
  }, [stock.product_id]);

  const status = getStatus(stock);
  const sc = STATUS_CONFIG[status];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl w-full max-w-md border border-border shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-foreground">{stock.product.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{stock.product.category}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 p-4 border-b border-border flex-shrink-0">
          <div className="bg-muted/40 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">Stock</p>
            <p className="text-lg font-bold font-mono text-foreground">{stock.current_quantity}</p>
            <p className="text-xs text-muted-foreground">{stock.unit ?? 'u.'}</p>
          </div>
          <div className="bg-muted/40 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">Seuil alerte</p>
            <p className="text-lg font-bold font-mono text-foreground">{stock.alert_threshold}</p>
            <p className="text-xs text-muted-foreground">{stock.unit ?? 'u.'}</p>
          </div>
          <div className="bg-muted/40 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">Statut</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.badge}`}>{sc.label}</span>
          </div>
        </div>

        {/* History */}
        <div className="overflow-y-auto flex-1 p-4">
          <div className="flex items-center gap-2 mb-3">
            <History className="w-3.5 h-3.5 text-muted-foreground" />
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Historique des mouvements</h4>
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : entries.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Aucun mouvement enregistré.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((e) => (
                <div key={e.id} className="flex items-start justify-between bg-muted/30 rounded-xl px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">{TYPE_LABELS[e.type] ?? e.type}</p>
                    {(e.reason || e.note) && <p className="text-xs text-muted-foreground truncate">{e.reason || e.note}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(e.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' })} ·{' '}
                      {(e.creator as { name?: string } | null)?.name ?? '—'}
                    </p>
                  </div>
                  <span className={`ml-3 text-sm font-mono font-bold flex-shrink-0 ${e.quantity >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                    {e.quantity >= 0 ? '+' : ''}{e.quantity} {stock.unit ?? ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex-shrink-0">
          <button onClick={onAdjust}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
            Ajustement manuel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inventory Session Modal ──────────────────────────────────────────────────
function InventoryModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { currentUser } = useApp();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'count' | 'report' | 'pin'>('count');
  const [pinError, setPinError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: stockData } = await supabase
        .from('stock')
        .select('*, product:products(id, name, category)')
        .order('product(name)', { ascending: true });

      setItems(
        (stockData ?? []).map((s: StockRow) => ({
          product_id: s.product_id,
          product_name: s.product?.name ?? '?',
          category: s.product?.category ?? '?',
          theoretical: s.current_quantity,
          unit: s.unit ?? '',
          counted: s.current_quantity,
        }))
      );
      setLoading(false);
    })();
  }, []);

  const handlePinConfirm = async (pin: string) => {
    if (!currentUser) return;
    setSaving(true);
    setPinError('');
    try {
      const { data: profile } = await supabase.from('profiles').select('pin_hash').eq('id', currentUser.id).single();
      let pinOk = false;
      if (profile?.pin_hash) {
        const res = await verifyPin(profile.pin_hash, pin);
        pinOk = res === 'match' || res === 'legacy';
      } else { pinOk = true; }

      if (!pinOk) { setPinError('PIN incorrect.'); setSaving(false); return; }

      // Create session
      const { data: session } = await supabase.from('inventory_sessions').insert([{
        started_by: currentUser.id,
        validated_by: currentUser.id,
        validated_at: new Date().toISOString(),
        status: 'validated',
      }]).select().single();

      if (!session) throw new Error('Session creation failed');

      // Insert items
      await supabase.from('inventory_items').insert(
        items.map((it) => ({
          session_id: session.id,
          product_id: it.product_id,
          theoretical_quantity: it.theoretical,
          counted_quantity: it.counted,
        }))
      );

      // Apply corrections: update stock for each product + log entry
      for (const it of items) {
        const variance = it.counted - it.theoretical;
        if (variance !== 0) {
          await supabase.from('stock').update({
            current_quantity: Math.max(0, it.counted),
            last_updated: new Date().toISOString(),
          }).eq('product_id', it.product_id);

          await supabase.from('stock_entries').insert([{
            product_id: it.product_id,
            quantity: variance,
            type: 'inventory_correction',
            inventory_session_id: session.id,
            created_by: currentUser.id,
          }]);
        }
      }

      onDone();
    } catch (e) {
      console.error(e);
      setPinError('Erreur lors de la validation.');
    }
    setSaving(false);
  };

  const exportInventoryPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`RAPPORT INVENTAIRE — ${new Date().toLocaleDateString('fr-FR')} — ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Validé par : ${currentUser?.name ?? '—'} (${currentUser?.role ?? ''})`, 14, 30);
    autoTable(doc, {
      startY: 38,
      head: [['Produit', 'Catégorie', 'Théorique', 'Compté', 'Écart']],
      body: items.map((it) => {
        const v = it.counted - it.theoretical;
        return [it.product_name, it.category, `${it.theoretical} ${it.unit}`, `${it.counted} ${it.unit}`, v === 0 ? 'OK ✅' : `${v > 0 ? '+' : ''}${v} ${it.unit} ⚠️`];
      }),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [45, 106, 79] },
    });
    doc.save(`inventaire-${new Date().toISOString().slice(0,10)}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl w-full max-w-lg border border-border shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <h3 className="text-sm font-bold text-foreground">📋 Inventaire</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        {step === 'count' && (
          <>
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : items.map((it, idx) => (
                <div key={it.product_id} className="bg-muted/30 rounded-xl px-3 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{it.product_name}</p>
                    <p className="text-xs text-muted-foreground">{it.category} · Théo : <span className="font-mono">{it.theoretical} {it.unit}</span></p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setItems((prev) => prev.map((p, i) => i === idx ? { ...p, counted: Math.max(0, p.counted - 1) } : p))}
                      className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 font-bold flex items-center justify-center text-sm">−</button>
                    <input type="number" value={it.counted} min={0}
                      onChange={(e) => setItems((prev) => prev.map((p, i) => i === idx ? { ...p, counted: Math.max(0, Number(e.target.value)) } : p))}
                      className="w-16 text-center rounded-lg border border-border bg-background text-foreground font-mono text-sm px-2 py-1.5 focus:outline-none" />
                    <button onClick={() => setItems((prev) => prev.map((p, i) => i === idx ? { ...p, counted: p.counted + 1 } : p))}
                      className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 font-bold flex items-center justify-center text-sm">+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-border flex-shrink-0">
              <button onClick={() => setStep('report')} disabled={loading}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40">
                Voir le rapport →
              </button>
            </div>
          </>
        )}

        {step === 'report' && (
          <>
            <div className="overflow-y-auto flex-1 p-4 space-y-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Rapport d'inventaire</h4>
              {items.map((it) => {
                const v = it.counted - it.theoretical;
                return (
                  <div key={it.product_id} className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${v === 0 ? 'bg-emerald-500/5' : 'bg-amber-500/5'}`}>
                    <div>
                      <p className="text-xs font-medium text-foreground">{it.product_name}</p>
                      <p className="text-xs text-muted-foreground">Théo : {it.theoretical} · Compté : {it.counted} {it.unit}</p>
                    </div>
                    <span className={`text-xs font-mono font-bold ml-3 ${v === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {v === 0 ? '✅ OK' : `${v > 0 ? '+' : ''}${v} ⚠️`}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t border-border flex-shrink-0 flex gap-2">
              <button onClick={exportInventoryPDF}
                className="flex-1 py-2.5 rounded-xl border border-border text-foreground text-sm font-semibold hover:bg-muted transition-colors flex items-center justify-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Exporter PDF
              </button>
              <button onClick={() => setStep('pin')}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
                Appliquer → PIN
              </button>
            </div>
          </>
        )}

        {step === 'pin' && (
          <div className="p-6">
            {pinError && <p className="text-xs text-destructive text-center mb-3">{pinError}</p>}
            {saving ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Application des corrections…</p>
              </div>
            ) : (
              <PinPad onConfirm={handlePinConfirm} onCancel={() => setStep('report')} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main StockModule ─────────────────────────────────────────────────────────
export function StockModule() {
  const { currentUser } = useApp();
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedStock, setSelectedStock] = useState<StockRow | null>(null);
  const [adjustingStock, setAdjustingStock] = useState<StockRow | null>(null);
  const [showInventory, setShowInventory] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const isManager = currentUser?.role === 'manager' || currentUser?.role === 'admin' || currentUser?.role === 'owner';

  const fetchStock = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('stock')
      .select('*, product:products(id, name, category, supplier)')
      .order('product(name)', { ascending: true });
    setStockRows((data as StockRow[]) ?? []);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { fetchStock(); }, [fetchStock]);

  // Derive unique categories
  const categories = Array.from(new Set(stockRows.map((s) => s.product?.category).filter(Boolean)));

  const filtered = stockRows.filter((s) => {
    const name = s.product?.name?.toLowerCase() ?? '';
    const cat = s.product?.category ?? '';
    const status = getStatus(s);
    if (search && !name.includes(search.toLowerCase())) return false;
    if (filterCategory && cat !== filterCategory) return false;
    if (filterStatus && status !== filterStatus) return false;
    return true;
  });

  const counts = {
    ok:  stockRows.filter((s) => getStatus(s) === 'ok').length,
    low: stockRows.filter((s) => getStatus(s) === 'low').length,
    out: stockRows.filter((s) => getStatus(s) === 'out').length,
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">📦 Gestion du Stock</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dernière mise à jour : {lastUpdated.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchStock} className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors" title="Actualiser">
            <RefreshCw className="w-4 h-4" />
          </button>
          {isManager && (
            <button onClick={() => setShowInventory(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity">
              <ClipboardList className="w-3.5 h-3.5" /> Inventaire
            </button>
          )}
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterStatus('')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${filterStatus === '' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-transparent'}`}>
          <ArrowUpDown className="w-3 h-3" /> Tous ({stockRows.length})
        </button>
        <button onClick={() => setFilterStatus('ok')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${filterStatus === 'ok' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-transparent'}`}>
          <CheckCircle className="w-3 h-3" /> OK ({counts.ok})
        </button>
        <button onClick={() => setFilterStatus('low')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${filterStatus === 'low' ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-transparent'}`}>
          <AlertTriangle className="w-3 h-3" /> Bas ({counts.low})
        </button>
        <button onClick={() => setFilterStatus('out')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${filterStatus === 'out' ? 'bg-destructive text-white border-destructive' : 'bg-destructive/10 text-destructive border-transparent'}`}>
          <XCircle className="w-3 h-3" /> Rupture ({counts.out})
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div className="relative">
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="">Toutes catégories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Stock list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <Package className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
          <p className="text-sm text-muted-foreground">Aucun produit en stock trouvé.</p>
          <p className="text-xs text-muted-foreground">Ajoutez des produits via le Catalogue, puis associez leur stock.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const status = getStatus(s);
            const sc = STATUS_CONFIG[status];
            const pct = s.alert_threshold > 0 ? Math.min(100, (s.current_quantity / s.alert_threshold) * 100) : 100;
            return (
              <div key={s.id} className="glass-card rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{s.product?.name}</p>
                      <p className="text-xs text-muted-foreground">{s.product?.category} · {s.unit ?? 'u.'}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${sc.badge}`}>{sc.label}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/30 rounded-lg px-3 py-2">
                    <p className="text-muted-foreground">Stock actuel</p>
                    <p className="font-mono font-bold text-foreground">{s.current_quantity} {s.unit ?? ''}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg px-3 py-2">
                    <p className="text-muted-foreground">Seuil d'alerte</p>
                    <p className="font-mono font-bold text-foreground">{s.alert_threshold} {s.unit ?? ''}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${
                      status === 'out' ? 'bg-destructive' :
                      status === 'low' ? 'bg-amber-500' :
                      'bg-emerald-500'
                    }`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Mis à jour : {new Date(s.last_updated).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>

                <div className="flex gap-2 pt-1">
                  {isManager && (
                    <button onClick={() => setAdjustingStock(s)}
                      className="flex-1 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Ajustement
                    </button>
                  )}
                  <button onClick={() => setSelectedStock(s)}
                    className="flex-1 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1">
                    <History className="w-3 h-3" /> Détail
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {selectedStock && !adjustingStock && (
        <ProductDetailModal
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
          onAdjust={() => { setAdjustingStock(selectedStock); setSelectedStock(null); }}
        />
      )}
      {adjustingStock && (
        <AdjustmentModal
          stock={adjustingStock}
          onClose={() => setAdjustingStock(null)}
          onDone={() => { setAdjustingStock(null); fetchStock(); }}
        />
      )}
      {showInventory && (
        <InventoryModal
          onClose={() => setShowInventory(false)}
          onDone={() => { setShowInventory(false); fetchStock(); }}
        />
      )}
    </div>
  );
}
