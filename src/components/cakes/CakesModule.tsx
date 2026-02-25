import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, Trash2, ToggleLeft, ToggleRight, Send, History } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type Category = 'patisserie' | 'desserts' | 'pains';

interface CakeRef {
  id: string;
  name: string;
  category: Category;
  is_active: boolean;
  display_order: number;
  is_custom: boolean;
}

interface ProductionLog {
  id: string;
  reference_id: string;
  reference_name: string;
  category: string;
  quantity: number;
  logged_by_name: string;
  note: string | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<Category, string> = {
  patisserie: '🧁 Pâtisserie',
  pains: '🍞 Pains',
  desserts: '🍮 Desserts',
};

const CATEGORY_COLORS: Record<Category, string> = {
  patisserie: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
  pains: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  desserts: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
};

// ─── Staff Production View ───────────────────────────────────────────────────
function ProductionView() {
  const { currentUser } = useApp();
  const [refs, setRefs] = useState<CakeRef[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [activeCategory, setActiveCategory] = useState<Category>('patisserie');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [logs, setLogs] = useState<ProductionLog[]>([]);

  useEffect(() => {
    loadRefs();
  }, []);

  const loadRefs = async () => {
    const { data } = await supabase
      .from('cake_references')
      .select('*')
      .eq('is_active', true)
      .order('display_order');
    if (data) setRefs(data as unknown as CakeRef[]);
  };

  const loadHistory = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('cake_production_logs')
      .select('*')
      .gte('created_at', today + 'T00:00:00')
      .order('created_at', { ascending: false });
    if (data) setLogs(data as unknown as ProductionLog[]);
    setShowHistory(true);
  };

  const filtered = refs.filter(r => r.category === activeCategory);

  const updateQty = (id: string, delta: number) => {
    setQuantities(prev => {
      const cur = prev[id] || 0;
      const next = Math.max(0, cur + delta);
      return { ...prev, [id]: next };
    });
  };

  const setQty = (id: string, val: number) => {
    setQuantities(prev => ({ ...prev, [id]: Math.max(0, val) }));
  };

  const hasAny = Object.values(quantities).some(q => q > 0);

  const handleSubmit = async () => {
    if (!currentUser) return;
    setSubmitting(true);
    const entries = Object.entries(quantities).filter(([, q]) => q > 0);
    const inserts = entries.map(([refId, qty]) => {
      const ref = refs.find(r => r.id === refId);
      return {
        reference_id: refId,
        reference_name: ref?.name ?? '',
        category: ref?.category ?? 'patisserie',
        quantity: qty,
        logged_by: currentUser.id,
        logged_by_name: currentUser.name,
      };
    });

    const { error } = await supabase.from('cake_production_logs').insert(inserts);
    if (!error) {
      setQuantities({});
      setSuccessMsg(`${entries.length} référence(s) enregistrée(s) ✓`);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
    setSubmitting(false);
  };

  // Today totals
  const todayTotals = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.reference_name] = (acc[l.reference_name] || 0) + l.quantity;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Category tabs */}
      <Tabs value={activeCategory} onValueChange={v => setActiveCategory(v as Category)}>
        <TabsList className="grid w-full grid-cols-3">
          {(['patisserie', 'pains', 'desserts'] as Category[]).map(cat => (
            <TabsTrigger key={cat} value={cat} className="text-xs sm:text-sm">
              {CATEGORY_LABELS[cat]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Product list */}
      <div className="space-y-2">
        {filtered.map(ref => {
          const qty = quantities[ref.id] || 0;
          return (
            <div key={ref.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{ref.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(ref.id, -1)} disabled={qty === 0}>
                  <Minus className="w-4 h-4" />
                </Button>
                <Input
                  type="number"
                  min={0}
                  value={qty}
                  onChange={e => setQty(ref.id, parseInt(e.target.value) || 0)}
                  className="w-16 h-8 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(ref.id, 1)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">Aucune référence active dans cette catégorie.</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={loadHistory}>
          <History className="w-4 h-4 mr-2" /> Historique du jour
        </Button>
        <Button className="flex-1" disabled={!hasAny || submitting} onClick={handleSubmit}>
          <Send className="w-4 h-4 mr-2" /> Enregistrer
        </Button>
      </div>

      {successMsg && (
        <div className="text-center text-sm font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in">{successMsg}</div>
      )}

      {/* History dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Production du jour</DialogTitle>
          </DialogHeader>
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">Aucune entrée aujourd'hui.</p>
          ) : (
            <>
              {/* Totals */}
              <div className="space-y-1 mb-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Totaux</h4>
                {Object.entries(todayTotals).map(([name, total]) => (
                  <div key={name} className="flex justify-between text-sm">
                    <span>{name}</span>
                    <span className="font-bold">{total}</span>
                  </div>
                ))}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Heure</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead>Par</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">{format(new Date(log.created_at), 'HH:mm', { locale: fr })}</TableCell>
                      <TableCell className="text-sm">{log.reference_name}</TableCell>
                      <TableCell className="text-right font-bold">{log.quantity}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.logged_by_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Admin View ──────────────────────────────────────────────────────────────
function AdminView() {
  const [refs, setRefs] = useState<CakeRef[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('patisserie');
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [activeTab, setActiveTab] = useState<'refs' | 'logs'>('refs');

  useEffect(() => { loadRefs(); }, []);

  const loadRefs = async () => {
    const { data } = await supabase
      .from('cake_references')
      .select('*')
      .order('category')
      .order('display_order');
    if (data) setRefs(data as unknown as CakeRef[]);
  };

  const loadLogs = async () => {
    const { data } = await supabase
      .from('cake_production_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setLogs(data as unknown as ProductionLog[]);
  };

  const toggleActive = async (ref: CakeRef) => {
    await supabase.from('cake_references').update({ is_active: !ref.is_active } as any).eq('id', ref.id);
    loadRefs();
  };

  const deleteRef = async (id: string) => {
    await supabase.from('cake_references').delete().eq('id', id);
    loadRefs();
  };

  const addRef = async () => {
    if (!newName.trim()) return;
    const maxOrder = refs.filter(r => r.category === newCategory).length;
    await supabase.from('cake_references').insert({
      name: newName.trim(),
      category: newCategory,
      display_order: maxOrder + 1,
      is_custom: true,
    } as any);
    setNewName('');
    setShowAdd(false);
    loadRefs();
  };

  const grouped = refs.reduce<Record<Category, CakeRef[]>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {} as Record<Category, CakeRef[]>);

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v as any); if (v === 'logs') loadLogs(); }}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="refs">Références</TabsTrigger>
          <TabsTrigger value="logs">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="refs" className="space-y-4 mt-4">
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" /> Ajouter une référence
          </Button>

          {(['patisserie', 'pains', 'desserts'] as Category[]).map(cat => (
            <div key={cat}>
              <h3 className="text-sm font-bold mb-2">{CATEGORY_LABELS[cat]}</h3>
              <div className="space-y-1">
                {(grouped[cat] || []).map(ref => (
                  <div key={ref.id} className={`flex items-center gap-2 p-2 rounded-lg border ${ref.is_active ? 'bg-card border-border' : 'bg-muted/50 border-border/50 opacity-60'}`}>
                    <button onClick={() => toggleActive(ref)} className="flex-shrink-0">
                      {ref.is_active
                        ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                        : <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                      }
                    </button>
                    <span className="flex-1 text-sm">{ref.name}</span>
                    {ref.is_custom && (
                      <Badge variant="outline" className="text-xs">Custom</Badge>
                    )}
                    <button onClick={() => deleteRef(ref.id)} className="text-destructive hover:text-destructive/80">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {(!grouped[cat] || grouped[cat].length === 0) && (
                  <p className="text-xs text-muted-foreground pl-2">Aucune référence.</p>
                )}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          {logs.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Aucun historique.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Cat.</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                  <TableHead>Par</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{format(new Date(log.created_at), 'dd/MM HH:mm', { locale: fr })}</TableCell>
                    <TableCell className="text-sm">{log.reference_name}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${CATEGORY_COLORS[log.category as Category] || ''}`}>
                        {CATEGORY_LABELS[log.category as Category]?.split(' ')[1] || log.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">{log.quantity}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.logged_by_name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle référence</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nom du produit" value={newName} onChange={e => setNewName(e.target.value)} />
            <div className="flex gap-2">
              {(['patisserie', 'pains', 'desserts'] as Category[]).map(cat => (
                <Button
                  key={cat}
                  variant={newCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNewCategory(cat)}
                >
                  {CATEGORY_LABELS[cat]}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button onClick={addRef} disabled={!newName.trim()}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Module ─────────────────────────────────────────────────────────────
export function CakesModule({ isAdmin = false }: { isAdmin?: boolean }) {
  return isAdmin ? <AdminView /> : <ProductionView />;
}
