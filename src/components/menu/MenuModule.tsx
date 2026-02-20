import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import { CheckCircle, XCircle, Hash, ChefHat, AlertTriangle, Loader2, Plus, Copy, RefreshCw } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MenuItem {
  id: string;
  name: string;
  category: 'Entrée' | 'Plat' | 'Dessert';
  status: 'available' | 'out_of_stock' | 'limited';
  portions_left: number | null;
  display_order: number;
  date: string;
}

const TODAY = new Date().toISOString().split('T')[0];
const YESTERDAY = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
})();

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  available:    { label: 'Disponible', color: 'text-[hsl(var(--timer-safe))]',    bg: 'bg-[hsl(var(--timer-safe)/0.1)]',    icon: <CheckCircle className="w-4 h-4" /> },
  limited:      { label: 'Limité',     color: 'text-[hsl(var(--timer-warning))]', bg: 'bg-[hsl(var(--timer-warning)/0.1)]', icon: <Hash className="w-4 h-4" /> },
  out_of_stock: { label: 'Rupture',    color: 'text-destructive',                 bg: 'bg-destructive/10',                  icon: <XCircle className="w-4 h-4" /> },
};

const DEFAULT_ITEMS: Omit<MenuItem, 'id' | 'date'>[] = [
  { name: 'Entrée du jour', category: 'Entrée', status: 'available', portions_left: null, display_order: 0 },
  { name: 'Plat du chef',   category: 'Plat',   status: 'available', portions_left: null, display_order: 1 },
  { name: 'Dessert maison', category: 'Dessert', status: 'available', portions_left: null, display_order: 2 },
];

// ─── MenuItemRow ──────────────────────────────────────────────────────────────
function MenuItemRow({
  item, canEdit, saving, onUpdate, onDelete,
}: {
  item: MenuItem;
  canEdit: boolean;
  saving: boolean;
  onUpdate: (id: string, updates: Partial<MenuItem>) => void;
  onDelete?: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[item.status];
  const isOut = item.status === 'out_of_stock';

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isOut ? 'opacity-50 border-border' : 'border-border'} bg-card`}>
      {/* Name */}
      <div className="flex-1 min-w-0">
        {canEdit ? (
          <input
            type="text"
            value={item.name}
            onBlur={(e) => { if (e.target.value !== item.name) onUpdate(item.id, { name: e.target.value }); }}
            onChange={() => {}}
            defaultValue={item.name}
            className="text-sm font-medium bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none w-full text-foreground"
          />
        ) : (
          <p className={`text-sm font-medium ${isOut ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {item.name}
          </p>
        )}
        {item.status === 'limited' && item.portions_left !== null && (
          <p className="text-xs text-[hsl(var(--timer-warning))] mt-0.5 font-medium">
            {item.portions_left} portion{item.portions_left > 1 ? 's' : ''} restante{item.portions_left > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Status badge (read-only) */}
      {!canEdit && (
        <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg font-medium ${cfg.color} ${cfg.bg}`}>
          {cfg.icon}
          {cfg.label}
        </span>
      )}

      {/* Controls (editor only) */}
      {canEdit && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={item.status}
            onChange={(e) => onUpdate(item.id, {
              status: e.target.value as MenuItem['status'],
              portions_left: e.target.value !== 'limited' ? null : (item.portions_left ?? 5),
            })}
            className="text-xs bg-secondary border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="available">✅ Disponible</option>
            <option value="limited">🔢 Limité</option>
            <option value="out_of_stock">❌ Rupture</option>
          </select>

          {item.status === 'limited' && (
            <input
              type="number"
              min={1}
              max={99}
              defaultValue={item.portions_left ?? 5}
              onBlur={(e) => onUpdate(item.id, { portions_left: Math.min(99, Math.max(1, parseInt(e.target.value) || 1)) })}
              className="w-16 text-xs bg-secondary border border-border rounded-lg px-2 py-1.5 text-center text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          )}

          {/* Saving indicator */}
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}

          {/* Delete */}
          {onDelete && (
            <button
              onClick={() => onDelete(item.id)}
              className="text-muted-foreground hover:text-destructive transition-colors p-1"
              title="Supprimer"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AddItemRow ───────────────────────────────────────────────────────────────
function AddItemRow({
  onAdd,
}: {
  onAdd: (name: string, category: MenuItem['category']) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MenuItem['category']>('Plat');

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), category);
    setName('');
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded-xl border border-dashed border-border bg-secondary/30">
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as MenuItem['category'])}
        className="text-xs bg-secondary border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none"
      >
        <option value="Entrée">🥗 Entrée</option>
        <option value="Plat">🍽️ Plat</option>
        <option value="Dessert">🍮 Dessert</option>
      </select>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        placeholder="Nom du plat…"
        className="flex-1 text-xs bg-transparent border-b border-border focus:border-primary focus:outline-none text-foreground placeholder:text-muted-foreground py-1"
      />
      <button
        onClick={handleAdd}
        disabled={!name.trim()}
        className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
      >
        <Plus className="w-3 h-3" />
        Ajouter
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function MenuModule({ canEdit = false }: { canEdit?: boolean }) {
  const { currentUser } = useApp();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isYesterdayData, setIsYesterdayData] = useState(false);
  const [creating, setCreating] = useState(false);

  // ── Fetch ──
  const fetchMenu = useCallback(async () => {
    setLoading(true);

    // Try today first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: todayData, error: todayErr } = await (supabase as any)
      .from('daily_menu_items')
      .select('*')
      .eq('date', TODAY)
      .order('display_order');

    if (!todayErr && todayData && todayData.length > 0) {
      setItems(todayData as MenuItem[]);
      setIsYesterdayData(false);
      setLoading(false);
      return;
    }

    // Fallback: try yesterday
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: yestData } = await (supabase as any)
      .from('daily_menu_items')
      .select('*')
      .eq('date', YESTERDAY)
      .order('display_order');

    if (yestData && yestData.length > 0) {
      setItems(yestData as MenuItem[]);
      setIsYesterdayData(true);
    } else {
      setItems([]);
      setIsYesterdayData(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  // ── Realtime ──
  useEffect(() => {
    const channel = supabase
      .channel('menu-changes-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_menu_items' }, () => {
        fetchMenu();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchMenu]);

  // ── Create today's menu (copy from yesterday or defaults) ──
  const handleCreateToday = useCallback(async () => {
    setCreating(true);
    const source = isYesterdayData ? items : DEFAULT_ITEMS;
    const inserts = source.map((it, idx) => ({
      name: it.name,
      category: it.category,
      status: 'available',
      portions_left: null,
      display_order: idx,
      date: TODAY,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('daily_menu_items').insert(inserts);
    await fetchMenu();
    setCreating(false);
  }, [items, isYesterdayData, fetchMenu]);

  // ── Update handler ──
  const handleUpdate = useCallback(async (id: string, updates: Partial<MenuItem>) => {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, ...updates } : it));
    setSavingId(id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('daily_menu_items')
      .update({
        ...updates,
        updated_by: currentUser?.name ?? '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) {
      console.error('Menu update error:', error);
      fetchMenu();
    }
    setSavingId(null);
  }, [currentUser, fetchMenu]);

  // ── Add item ──
  const handleAddItem = useCallback(async (name: string, category: MenuItem['category']) => {
    const maxOrder = items.filter(i => i.date === TODAY).reduce((m, i) => Math.max(m, i.display_order), -1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('daily_menu_items').insert({
      name,
      category,
      status: 'available',
      portions_left: null,
      display_order: maxOrder + 1,
      date: TODAY,
    });
    if (!error) fetchMenu();
  }, [items, fetchMenu]);

  // ── Delete item ──
  const handleDeleteItem = useCallback(async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('daily_menu_items').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  // ── Group by category ──
  const categories: ('Entrée' | 'Plat' | 'Dessert')[] = ['Entrée', 'Plat', 'Dessert'];
  const grouped = categories.map((cat) => ({
    cat,
    items: items.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  const CATEGORY_EMOJI: Record<string, string> = { 'Entrée': '🥗', 'Plat': '🍽️', 'Dessert': '🍮' };

  // ── Alert counters ──
  const outCount = items.filter((i) => i.status === 'out_of_stock').length;
  const lowCount = items.filter((i) => i.status === 'limited' && (i.portions_left ?? 10) <= 2).length;

  const showingToday = !isYesterdayData && items.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <ChefHat className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Menu du jour</h2>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && showingToday && (
            <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">Mode édition</span>
          )}
          {canEdit && (
            <button
              onClick={fetchMenu}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
              title="Rafraîchir"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Yesterday banner + Create Today button */}
      {isYesterdayData && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[hsl(var(--timer-warning)/0.08)] border border-[hsl(var(--timer-warning)/0.2)]">
          <AlertTriangle className="w-4 h-4 text-[hsl(var(--timer-warning))] flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-[hsl(var(--timer-warning))]">Menu d'hier affiché</p>
            <p className="text-xs text-muted-foreground">Aucun menu n'a été configuré pour aujourd'hui.</p>
          </div>
          {canEdit && (
            <button
              onClick={handleCreateToday}
              disabled={creating}
              className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity flex-shrink-0"
            >
              {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
              Créer le menu du jour
            </button>
          )}
        </div>
      )}

      {/* No menu at all + create from scratch */}
      {items.length === 0 && canEdit && (
        <div className="text-center py-8 space-y-3">
          <ChefHat className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm text-muted-foreground">Aucun menu pour aujourd'hui</p>
          <button
            onClick={handleCreateToday}
            disabled={creating}
            className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity mx-auto"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Créer le menu du jour
          </button>
        </div>
      )}

      {/* Alerts summary */}
      {showingToday && (outCount > 0 || lowCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {outCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
              <XCircle className="w-3.5 h-3.5" />
              {outCount} plat{outCount > 1 ? 's' : ''} en rupture
            </div>
          )}
          {lowCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[hsl(var(--timer-warning)/0.1)] border border-[hsl(var(--timer-warning)/0.2)] text-[hsl(var(--timer-warning))] text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              {lowCount} plat{lowCount > 1 ? 's' : ''} à 2 portions
            </div>
          )}
        </div>
      )}

      {/* Menu sections */}
      {grouped.map(({ cat, items: catItems }) => (
        <section key={cat} className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-base">{CATEGORY_EMOJI[cat]}</span>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{cat}s</h3>
            <span className="text-xs text-muted-foreground/60">({catItems.length})</span>
          </div>
          <div className="space-y-2">
            {catItems.map((item) => (
              <MenuItemRow
                key={item.id}
                item={item}
                canEdit={canEdit && !isYesterdayData}
                saving={savingId === item.id}
                onUpdate={handleUpdate}
                onDelete={canEdit && !isYesterdayData ? handleDeleteItem : undefined}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Add item (only for today's menu in edit mode) */}
      {canEdit && showingToday && (
        <AddItemRow onAdd={handleAddItem} />
      )}

      {/* Empty read-only state */}
      {items.length === 0 && !canEdit && (
        <div className="text-center py-12 text-muted-foreground">
          <ChefHat className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Aucun plat au menu aujourd'hui</p>
        </div>
      )}
    </div>
  );
}
