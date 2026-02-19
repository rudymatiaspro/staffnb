import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import { CheckCircle, XCircle, Hash, ChefHat, AlertTriangle, Loader2 } from 'lucide-react';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  available: { label: 'Disponible', color: 'text-[hsl(var(--timer-safe))]', bg: 'bg-[hsl(var(--timer-safe)/0.1)]', icon: <CheckCircle className="w-4 h-4" /> },
  limited:   { label: 'Limité',     color: 'text-[hsl(var(--timer-warning))]', bg: 'bg-[hsl(var(--timer-warning)/0.1)]', icon: <Hash className="w-4 h-4" /> },
  out_of_stock: { label: 'Rupture', color: 'text-destructive', bg: 'bg-destructive/10', icon: <XCircle className="w-4 h-4" /> },
};

// ─── MenuItemRow ──────────────────────────────────────────────────────────────
function MenuItemRow({
  item,
  canEdit,
  onUpdate,
}: {
  item: MenuItem;
  canEdit: boolean;
  onUpdate: (id: string, updates: Partial<MenuItem>) => void;
}) {
  const cfg = STATUS_CONFIG[item.status];
  const isOut = item.status === 'out_of_stock';

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isOut ? 'opacity-50 border-border' : 'border-border'} bg-card`}>
      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isOut ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {item.name}
        </p>
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
          {/* Status selector */}
          <select
            value={item.status}
            onChange={(e) => onUpdate(item.id, { status: e.target.value as MenuItem['status'], portions_left: e.target.value !== 'limited' ? null : item.portions_left })}
            className="text-xs bg-secondary border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="available">✅ Disponible</option>
            <option value="limited">🔢 Limité</option>
            <option value="out_of_stock">❌ Rupture</option>
          </select>

          {/* Portions input */}
          {item.status === 'limited' && (
            <input
              type="number"
              min={1}
              max={10}
              value={item.portions_left ?? 5}
              onChange={(e) => onUpdate(item.id, { portions_left: Math.min(10, Math.max(1, parseInt(e.target.value) || 1)) })}
              className="w-16 text-xs bg-secondary border border-border rounded-lg px-2 py-1.5 text-center text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function MenuModule({ canEdit = false }: { canEdit?: boolean }) {
  const { currentUser } = useApp();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // ── Fetch ──
  const fetchMenu = useCallback(async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('daily_menu_items')
      .select('*')
      .eq('date', TODAY)
      .order('display_order');

    if (!error && data) {
      setItems(data as MenuItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  // ── Realtime ──
  useEffect(() => {
    const channel = supabase
      .channel('menu-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_menu_items' }, () => {
        fetchMenu();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchMenu]);

  // ── Update handler ──
  const handleUpdate = useCallback(async (id: string, updates: Partial<MenuItem>) => {
    // Optimistic update
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, ...updates } : it));
    setSaving(id);

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
      fetchMenu(); // revert
    }
    setSaving(null);
  }, [currentUser, fetchMenu]);

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
        {canEdit && <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">Mode édition</span>}
      </div>

      {/* Alerts summary */}
      {(outCount > 0 || lowCount > 0) && (
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
              <div key={item.id} className="relative">
                <MenuItemRow item={item} canEdit={canEdit} onUpdate={handleUpdate} />
                {saving === item.id && (
                  <div className="absolute top-2 right-2">
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <ChefHat className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Aucun plat au menu aujourd'hui</p>
        </div>
      )}
    </div>
  );
}
