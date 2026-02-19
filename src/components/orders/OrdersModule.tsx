import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../integrations/supabase/client';
import {
  ShoppingCart, Plus, ChevronDown, ChevronUp, Check, X,
  Package, Truck, AlertCircle, RefreshCw, Clock, Search,
  ChevronRight, FileText, Loader2, RotateCcw,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderUnit = 'kg' | 'g' | 'L' | 'cL' | 'pcs' | 'carton' | 'caisse';
type OrderStatus = 'draft' | 'pending' | 'validated' | 'received' | 'rejected';

interface OrderItem {
  id?: string;
  productId?: string;
  productName: string;
  quantity: number;
  unit: OrderUnit;
  unitPrice?: number;
}

interface Order {
  id: string;
  orderNumber: string;
  supplier: string;
  status: OrderStatus;
  createdByName: string;
  createdBy?: string;
  validatedByName?: string;
  validatedAt?: string;
  rejectionReason?: string;
  notes?: string;
  isRecurring: boolean;
  recurrenceFreq?: string;
  nextOccurrence?: string;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}

interface ReceiptItem {
  orderItemId: string;
  productName: string;
  orderedQty: number;
  receivedQty: number;
  unit: OrderUnit;
}

const UNITS: OrderUnit[] = ['kg', 'g', 'L', 'cL', 'pcs', 'carton', 'caisse'];

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Brouillon',    color: 'text-muted-foreground', bg: 'bg-muted/30' },
  pending:   { label: 'En attente',   color: 'text-amber-600',        bg: 'bg-amber-500/10' },
  validated: { label: 'Validée',      color: 'text-primary',          bg: 'bg-primary/10' },
  received:  { label: 'Reçue',        color: 'text-timer-safe',       bg: 'bg-timer-safe/10' },
  rejected:  { label: 'Refusée',      color: 'text-destructive',      bg: 'bg-destructive/10' },
};

// ─── Generate order number ─────────────────────────────────────────────────────
function generateOrderNumber(supplier: string, seq: number): string {
  const prefix = supplier.replace(/\s+/g, '').toUpperCase().slice(0, 6) || 'CMD';
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}${dateStr}-${String(seq).padStart(2, '0')}`;
}

// ─── Validation form ─────────────────────────────────────────────────────────
function ValidationModal({ order, onClose, onValidate, canManage }: {
  order: Order;
  onClose: () => void;
  onValidate: (approved: boolean, reason?: string) => void;
  canManage: boolean;
}) {
  const [reason, setReason] = useState('');
  const [refusing, setRefusing] = useState(false);

  if (!canManage) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-5 w-full max-w-sm shadow-xl animate-slide-up">
        <h3 className="text-sm font-bold text-foreground mb-1">Valider la commande</h3>
        <p className="text-xs text-muted-foreground mb-4">
          {order.orderNumber} · {order.supplier}
        </p>

        {refusing ? (
          <div className="space-y-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motif du refus (obligatoire)…"
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm text-foreground resize-none focus:outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              <button onClick={() => setRefusing(false)} className="flex-1 py-2 rounded-xl bg-secondary text-sm font-medium">Annuler</button>
              <button
                onClick={() => reason.trim() && onValidate(false, reason.trim())}
                disabled={!reason.trim()}
                className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold disabled:opacity-50"
              >Refuser</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 rounded-xl bg-secondary text-sm font-medium">Annuler</button>
            <button onClick={() => setRefusing(true)} className="flex-1 py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-semibold">Refuser</button>
            <button onClick={() => onValidate(true)} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold">Valider</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Receipt form ─────────────────────────────────────────────────────────────
function ReceiptModal({ order, items, onClose, onSubmit }: {
  order: Order;
  items: OrderItem[];
  onClose: () => void;
  onSubmit: (receiptItems: ReceiptItem[], gapNote: string, hasGap: boolean) => void;
}) {
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>(
    items.map((it) => ({
      orderItemId: it.id ?? '',
      productName: it.productName,
      orderedQty: it.quantity,
      receivedQty: it.quantity,
      unit: it.unit,
    }))
  );
  const [gapNote, setGapNote] = useState('');

  const hasGap = receiptItems.some((it) => it.receivedQty !== it.orderedQty);

  const updateQty = (idx: number, val: string) => {
    const n = parseFloat(val) || 0;
    setReceiptItems((prev) => prev.map((it, i) => i === idx ? { ...it, receivedQty: n } : it));
  };

  const canSubmit = !hasGap || gapNote.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-5 w-full max-w-md shadow-xl animate-slide-up max-h-[85vh] flex flex-col">
        <h3 className="text-sm font-bold text-foreground mb-1 flex-shrink-0">Réceptionner la commande</h3>
        <p className="text-xs text-muted-foreground mb-4 flex-shrink-0">{order.orderNumber} · {order.supplier}</p>

        <div className="overflow-y-auto flex-1 space-y-3 mb-4">
          {receiptItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-secondary">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{item.productName}</p>
                <p className="text-[11px] text-muted-foreground">Commandé : {item.orderedQty} {item.unit}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={item.receivedQty}
                  onChange={(e) => updateQty(idx, e.target.value)}
                  className={`w-16 text-center px-2 py-1 rounded-lg text-xs font-semibold border focus:outline-none focus:border-primary bg-background ${
                    item.receivedQty !== item.orderedQty ? 'border-amber-400 text-amber-600' : 'border-border text-foreground'
                  }`}
                />
                <span className="text-[11px] text-muted-foreground">{item.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {hasGap && (
          <div className="mb-4 flex-shrink-0">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-amber-600">Écart détecté — noter l'écart (obligatoire)</span>
            </div>
            <textarea
              value={gapNote}
              onChange={(e) => setGapNote(e.target.value)}
              placeholder="Décrivez l'écart constaté…"
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-secondary border border-amber-400 text-sm text-foreground resize-none focus:outline-none focus:border-primary"
            />
          </div>
        )}

        <div className="flex gap-2 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl bg-secondary text-sm font-medium">Annuler</button>
          <button
            onClick={() => canSubmit && onSubmit(receiptItems, gapNote, hasGap)}
            disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Truck className="w-3.5 h-3.5" />
            Valider la réception
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Order card ───────────────────────────────────────────────────────────────
function OrderCard({
  order,
  canManage,
  onValidate,
  onReceive,
  onExpand,
  expanded,
}: {
  order: Order;
  canManage: boolean;
  onValidate: (order: Order) => void;
  onReceive: (order: Order) => void;
  onExpand: () => void;
  expanded: boolean;
}) {
  const cfg = STATUS_CONFIG[order.status];

  return (
    <div className="glass-card rounded-xl border border-border overflow-hidden">
      <button onClick={onExpand} className="w-full p-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-mono font-semibold text-muted-foreground">{order.orderNumber}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
              {order.isRecurring && (
                <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <RotateCcw className="w-2.5 h-2.5" /> Récurrent
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-foreground">{order.supplier || 'Fournisseur non défini'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Par {order.createdByName} · {new Date(order.createdAt).toLocaleDateString('fr-FR')}</p>
          </div>
          <div className="flex items-center gap-2">
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border/50 space-y-3 animate-slide-up">
          {/* Items */}
          {order.items && order.items.length > 0 && (
            <div className="space-y-1.5 pt-3">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-foreground font-medium">{item.productName}</span>
                  <span className="text-muted-foreground font-mono">{item.quantity} {item.unit}</span>
                </div>
              ))}
            </div>
          )}

          {order.notes && (
            <div className="text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">
              📝 {order.notes}
            </div>
          )}

          {order.status === 'rejected' && order.rejectionReason && (
            <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 flex gap-2">
              <X className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{order.rejectionReason}</span>
            </div>
          )}

          {/* Actions */}
          {canManage && order.status === 'pending' && (
            <button
              onClick={() => onValidate(order)}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2"
            >
              <Check className="w-3.5 h-3.5" /> Réviser & valider
            </button>
          )}
          {canManage && order.status === 'validated' && (
            <button
              onClick={() => onReceive(order)}
              className="w-full py-2.5 rounded-xl bg-timer-safe/20 text-timer-safe text-xs font-bold flex items-center justify-center gap-2 border border-timer-safe/30"
            >
              <Truck className="w-3.5 h-3.5" /> Réceptionner
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Create order form ────────────────────────────────────────────────────────
function CreateOrderForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { currentUser, products } = useApp();
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [items, setItems] = useState<OrderItem[]>([{ productName: '', quantity: 1, unit: 'pcs' }]);
  const [loading, setLoading] = useState(false);
  const [productSearch, setProductSearch] = useState<string[]>(['']);

  const addItem = () => {
    setItems((prev) => [...prev, { productName: '', quantity: 1, unit: 'pcs' }]);
    setProductSearch((prev) => [...prev, '']);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setProductSearch((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof OrderItem, value: string | number) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const selectProduct = (idx: number, product: { id: string; name: string; supplier?: string }) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, productId: product.id, productName: product.name } : it));
    if (!supplier && product.supplier) setSupplier(product.supplier);
    setProductSearch((prev) => prev.map((s, i) => i === idx ? '' : s));
  };

  const handleSubmit = async () => {
    if (!currentUser) return;
    const validItems = items.filter((it) => it.productName.trim());
    if (!supplier.trim() || validItems.length === 0) return;

    setLoading(true);
    try {
      // Count today's orders for sequence number
      const today = new Date().toISOString().slice(0, 10);
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00`);

      const orderNumber = generateOrderNumber(supplier, (count ?? 0) + 1);

      const nextOcc = isRecurring ? (() => {
        const d = new Date();
        if (recurrenceFreq === 'daily') d.setDate(d.getDate() + 1);
        else if (recurrenceFreq === 'weekly') d.setDate(d.getDate() + 7);
        else d.setMonth(d.getMonth() + 1);
        return d.toISOString().slice(0, 10);
      })() : null;

      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          supplier: supplier.trim(),
          status: 'pending',
          created_by: currentUser.id,
          created_by_name: currentUser.name,
          notes: notes.trim() || null,
          is_recurring: isRecurring,
          recurrence_freq: isRecurring ? recurrenceFreq : null,
          next_occurrence: nextOcc,
        })
        .select()
        .single();

      if (error || !order) throw error;

      // Insert items
      await supabase.from('order_items').insert(
        validItems.map((it) => ({
          order_id: order.id,
          product_id: it.productId ?? null,
          product_name: it.productName.trim(),
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unitPrice ?? null,
        }))
      );

      onCreated();
      onClose();
    } catch (err) {
      console.error('Create order error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-5 w-full max-w-lg shadow-xl animate-slide-up max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h3 className="text-sm font-bold text-foreground">Nouvelle commande</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-4">
          {/* Supplier */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Fournisseur *</label>
            <input
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="ex: Metro, Transgourmet…"
              className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">Produits *</label>
              <button onClick={addItem} className="text-xs text-primary font-semibold flex items-center gap-1">
                <Plus className="w-3 h-3" /> Ajouter
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => {
                const search = productSearch[idx] || '';
                const matches = search.length >= 2 ? products.filter((p) =>
                  p.name.toLowerCase().includes(search.toLowerCase())
                ).slice(0, 5) : [];

                return (
                  <div key={idx} className="p-3 rounded-xl bg-secondary space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          value={item.productName || search}
                          onChange={(e) => {
                            setProductSearch((prev) => prev.map((s, i) => i === idx ? e.target.value : s));
                            updateItem(idx, 'productName', e.target.value);
                          }}
                          placeholder="Nom du produit"
                          className="w-full px-2.5 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                        />
                        {matches.length > 0 && (
                          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                            {matches.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => selectProduct(idx, p)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-secondary transition-colors flex items-center gap-2"
                              >
                                <Package className="w-3 h-3 text-muted-foreground" />
                                <span className="font-medium">{p.name}</span>
                                {p.supplier && <span className="text-muted-foreground ml-auto">{p.supplier}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {items.length > 1 && (
                        <button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive flex-shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2.5 py-2 rounded-lg bg-background border border-border text-xs text-foreground text-center focus:outline-none focus:border-primary"
                      />
                      <select
                        value={item.unit}
                        onChange={(e) => updateItem(idx, 'unit', e.target.value as OrderUnit)}
                        className="flex-1 px-2.5 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                      >
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice ?? ''}
                        onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || undefined)}
                        placeholder="Prix/u"
                        className="w-20 px-2.5 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes (optionnel)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Instructions spéciales, urgence…"
              className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-xs text-foreground resize-none focus:outline-none focus:border-primary"
            />
          </div>

          {/* Recurring */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary">
            <input
              type="checkbox"
              id="recurring"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4 rounded accent-primary"
            />
            <label htmlFor="recurring" className="text-xs font-medium text-foreground flex-1">Commande récurrente</label>
            {isRecurring && (
              <select
                value={recurrenceFreq}
                onChange={(e) => setRecurrenceFreq(e.target.value as 'daily' | 'weekly' | 'monthly')}
                className="px-2 py-1 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none"
              >
                <option value="daily">Quotidien</option>
                <option value="weekly">Hebdo</option>
                <option value="monthly">Mensuel</option>
              </select>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-4 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-secondary text-sm font-medium">Annuler</button>
          <button
            onClick={handleSubmit}
            disabled={loading || !supplier.trim() || items.every((it) => !it.productName.trim())}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main module ──────────────────────────────────────────────────────────────
interface OrdersModuleProps {
  canManage?: boolean; // manager / owner can validate & receive
}

export function OrdersModule({ canManage = false }: OrdersModuleProps) {
  const { currentUser } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [validateTarget, setValidateTarget] = useState<Order | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<Order | null>(null);
  const [receiveItems, setReceiveItems] = useState<OrderItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select(`*, order_items(*)`)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setOrders(data.map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        supplier: o.supplier,
        status: o.status as OrderStatus,
        createdByName: o.created_by_name,
        createdBy: o.created_by ?? undefined,
        validatedByName: o.validated_by_name ?? undefined,
        validatedAt: o.validated_at ?? undefined,
        rejectionReason: o.rejection_reason ?? undefined,
        notes: o.notes ?? undefined,
        isRecurring: o.is_recurring,
        recurrenceFreq: o.recurrence_freq ?? undefined,
        nextOccurrence: o.next_occurrence ?? undefined,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
        items: (o.order_items ?? []).map((it: {
          id: string; product_id: string | null; product_name: string;
          quantity: number; unit: string; unit_price: number | null;
        }) => ({
          id: it.id,
          productId: it.product_id ?? undefined,
          productName: it.product_name,
          quantity: it.quantity,
          unit: it.unit as OrderUnit,
          unitPrice: it.unit_price ?? undefined,
        })),
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
    // Realtime subscription
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchOrders]);

  // ─── Validate order ──────────────────────────────────────────────────────────
  const handleValidate = async (approved: boolean, reason?: string) => {
    if (!validateTarget || !currentUser) return;
    const update: { status: OrderStatus; validated_by?: string; validated_by_name?: string; validated_at?: string; rejection_reason?: string } = approved
      ? { status: 'validated' as const, validated_by: currentUser.id, validated_by_name: currentUser.name, validated_at: new Date().toISOString() }
      : { status: 'rejected' as const, rejection_reason: reason };
    await supabase.from('orders').update(update).eq('id', validateTarget.id);
    setValidateTarget(null);
    fetchOrders();
  };

  // ─── Receive order ────────────────────────────────────────────────────────────
  const openReceive = (order: Order) => {
    setReceiveTarget(order);
    setReceiveItems(order.items ?? []);
  };

  const handleReceive = async (receiptItems: ReceiptItem[], gapNote: string, hasGap: boolean) => {
    if (!receiveTarget || !currentUser) return;

    // 1. Create receipt
    const { data: receipt, error } = await supabase
      .from('order_receipts')
      .insert({
        order_id: receiveTarget.id,
        received_by: currentUser.id,
        received_by_name: currentUser.name,
        has_gap: hasGap,
        gap_note: hasGap ? gapNote : null,
      })
      .select()
      .single();

    if (error || !receipt) { console.error(error); return; }

    // 2. Insert receipt items
    if (receiptItems.length > 0) {
      await supabase.from('order_receipt_items').insert(
        receiptItems.map((it) => ({
          receipt_id: receipt.id,
          order_item_id: it.orderItemId,
          product_name: it.productName,
          ordered_qty: it.orderedQty,
          received_qty: it.receivedQty,
          unit: it.unit,
        }))
      );
    }

    // 3. Update order status
    await supabase.from('orders').update({ status: 'received' }).eq('id', receiveTarget.id);

    // 4. Update stock for received items (for products linked to catalogue)
    const order = orders.find((o) => o.id === receiveTarget.id);
    if (order?.items) {
      for (const ri of receiptItems) {
        if (ri.receivedQty > 0) {
          const item = order.items?.find((it) => it.id === ri.orderItemId);
          if (item?.productId) {
            await supabase.from('stock_logs').insert({
              product_id: item.productId,
              delta: ri.receivedQty,
              reason: 'Delivery received',
              updated_by: currentUser.name,
            });
            // Update current_stock
            const { data: prod } = await supabase.from('products').select('current_stock').eq('id', item.productId).single();
            if (prod) {
              await supabase.from('products').update({
                current_stock: prod.current_stock + ri.receivedQty,
              }).eq('id', item.productId);
            }
          }
        }
      }
    }

    setReceiveTarget(null);
    fetchOrders();
  };

  // ─── Filtered list ────────────────────────────────────────────────────────────
  const filtered = orders.filter((o) => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchSearch = !search || o.supplier.toLowerCase().includes(search.toLowerCase()) || o.orderNumber.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  // ─── Status tabs ──────────────────────────────────────────────────────────────
  const statusTabs: { id: OrderStatus | 'all'; label: string; count?: number }[] = [
    { id: 'all', label: 'Toutes' },
    { id: 'pending', label: 'En attente', count: pendingCount },
    { id: 'validated', label: 'Validées' },
    { id: 'received', label: 'Reçues' },
    { id: 'rejected', label: 'Refusées' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Commandes</h2>
          {pendingCount > 0 && canManage && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/25">
              {pendingCount} à valider
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchOrders} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" /> Créer
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher fournisseur, numéro…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground"
        />
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {statusTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-all ${
              filterStatus === tab.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                filterStatus === tab.id ? 'bg-primary-foreground/20' : 'bg-amber-500/20 text-amber-600'
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Chargement…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">Aucune commande</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Créez votre première commande</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              canManage={canManage}
              onValidate={setValidateTarget}
              onReceive={openReceive}
              onExpand={() => setExpandedId(expandedId === order.id ? null : order.id)}
              expanded={expandedId === order.id}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateOrderForm
          onClose={() => setShowCreate(false)}
          onCreated={fetchOrders}
        />
      )}
      {validateTarget && (
        <ValidationModal
          order={validateTarget}
          canManage={canManage}
          onClose={() => setValidateTarget(null)}
          onValidate={handleValidate}
        />
      )}
      {receiveTarget && (
        <ReceiptModal
          order={receiveTarget}
          items={receiveItems}
          onClose={() => setReceiveTarget(null)}
          onSubmit={handleReceive}
        />
      )}
    </div>
  );
}
