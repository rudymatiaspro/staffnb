import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Product, ProductCategory, PRODUCT_CATEGORIES, UnitType, StockUpdateReason } from '../../types';
import {
  Package, Plus, Search, AlertTriangle, CheckCircle, Edit2, Trash2,
  ChevronDown, ChevronUp, X, Minus, BarChart2, Phone, Mail,
} from 'lucide-react';

const ALL_CATEGORIES = Object.values(PRODUCT_CATEGORIES).flat() as ProductCategory[];
const ALL_GROUPS = Object.keys(PRODUCT_CATEGORIES) as (keyof typeof PRODUCT_CATEGORIES)[];

function getStockStatus(p: Product) {
  if (p.currentStock <= p.minThreshold) return 'critical';
  if (p.currentStock <= p.minThreshold * 1.5) return 'warning';
  return 'healthy';
}

function StockBadge({ status }: { status: string }) {
  if (status === 'critical') return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">
      <AlertTriangle className="w-3 h-3" /> LOW STOCK
    </span>
  );
  if (status === 'warning') return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 border border-amber-200">
      <AlertTriangle className="w-3 h-3" /> WARNING
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
      <CheckCircle className="w-3 h-3" /> OK
    </span>
  );
}

const STOCK_REASONS: StockUpdateReason[] = ['Delivery received', 'Consumed', 'Damaged', 'Inventory correction'];

// ─── Product Form ─────────────────────────────────────────────────────────────
interface ProductFormData {
  name: string;
  category: ProductCategory;
  brand: string;
  supplier: string;
  supplierContact: string;
  unit: UnitType;
  currentStock: number;
  minThreshold: number;
  notes: string;
}

function ProductForm({ initial, onSave, onCancel }: {
  initial?: Partial<ProductFormData>;
  onSave: (data: ProductFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ProductFormData>({
    name: initial?.name || '',
    category: initial?.category || 'Red Wine',
    brand: initial?.brand || '',
    supplier: initial?.supplier || '',
    supplierContact: initial?.supplierContact || '',
    unit: initial?.unit || 'btl',
    currentStock: initial?.currentStock ?? 0,
    minThreshold: initial?.minThreshold ?? 5,
    notes: initial?.notes || '',
  });

  const set = (k: keyof ProductFormData, v: string | number) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Product Name *</label>
          <input
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Château Margaux"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Brand</label>
          <input
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.brand}
            onChange={(e) => set('brand', e.target.value)}
            placeholder="Brand name"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Category *</label>
          <select
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
          >
            {ALL_GROUPS.map((group) => (
              <optgroup key={group} label={group}>
                {PRODUCT_CATEGORIES[group].map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Unit</label>
          <div className="flex gap-2">
            {(['btl', 'pcs'] as UnitType[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => set('unit', u)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                  form.unit === u
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-input text-muted-foreground hover:bg-secondary'
                }`}
              >
                {u === 'btl' ? 'Bottles (btl)' : 'Pieces (pcs)'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Supplier</label>
          <input
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.supplier}
            onChange={(e) => set('supplier', e.target.value)}
            placeholder="Supplier / Distributor"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Supplier Contact</label>
          <input
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.supplierContact}
            onChange={(e) => set('supplierContact', e.target.value)}
            placeholder="Phone or email"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Current Stock</label>
          <input
            type="number" min={0}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.currentStock}
            onChange={(e) => set('currentStock', Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Min. Threshold (alert)</label>
          <input
            type="number" min={0}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.minThreshold}
            onChange={(e) => set('minThreshold', Number(e.target.value))}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
        <textarea
          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring min-h-[60px] resize-none"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Optional notes..."
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-muted-foreground border border-input hover:bg-secondary transition-colors">
          Cancel
        </button>
        <button
          onClick={() => { if (form.name) onSave(form); }}
          disabled={!form.name}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          Save Product
        </button>
      </div>
    </div>
  );
}

// ─── Stock Update Modal ───────────────────────────────────────────────────────
function StockUpdateModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { updateStock } = useApp();
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState<StockUpdateReason>('Delivery received');
  const [isPos, setIsPos] = useState(true);

  const actualDelta = isPos ? Math.abs(delta) : -Math.abs(delta);
  const newStock = Math.max(0, product.currentStock + actualDelta);

  const handleSubmit = () => {
    if (delta === 0) return;
    updateStock(product.id, actualDelta, reason);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-foreground">Update Stock</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{product.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-secondary">
          <span className="text-sm text-muted-foreground">Current stock</span>
          <span className="font-bold text-foreground text-lg">{product.currentStock} {product.unit}</span>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setIsPos(true)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${isPos ? 'bg-emerald-600 text-white' : 'bg-secondary text-muted-foreground'}`}
            >
              + Add
            </button>
            <button
              onClick={() => setIsPos(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${!isPos ? 'bg-red-500 text-white' : 'bg-secondary text-muted-foreground'}`}
            >
              − Remove
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDelta((d) => Math.max(0, d - 1))}
              className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number" min={0}
              value={delta}
              onChange={(e) => setDelta(Math.max(0, Number(e.target.value)))}
              className="flex-1 text-center text-2xl font-bold border border-input rounded-xl py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={() => setDelta((d) => d + 1)}
              className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Reason</label>
            <select
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
              value={reason}
              onChange={(e) => setReason(e.target.value as StockUpdateReason)}
            >
              {STOCK_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {delta > 0 && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-secondary mb-4">
            <span className="text-xs text-muted-foreground">New stock will be</span>
            <span className={`font-bold text-lg ${isPos ? 'text-emerald-600' : 'text-red-500'}`}>
              {newStock} {product.unit}
            </span>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={delta === 0}
          className="w-full py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          Confirm Update
        </button>
      </div>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ product, canEdit, onEdit, onDelete, onUpdateStock }: {
  product: Product;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateStock: () => void;
}) {
  const status = getStockStatus(product);
  const pct = Math.min(100, Math.round((product.currentStock / Math.max(1, product.minThreshold * 2)) * 100));

  const cardBorder = status === 'critical' ? 'border-red-300 bg-red-50/50' :
                     status === 'warning' ? 'border-amber-300 bg-amber-50/50' :
                     'border-border bg-card';

  return (
    <div className={`rounded-xl border p-4 transition-all ${cardBorder}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-foreground truncate">{product.name}</h3>
            <StockBadge status={status} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{product.category}{product.brand ? ` · ${product.brand}` : ''}</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
              <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-100 transition-colors">
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        )}
      </div>

      {/* Stock bar */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-muted-foreground">Stock</span>
          <span className="text-xs font-bold text-foreground">{product.currentStock} / {product.minThreshold * 2} {product.unit}</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: status === 'critical' ? 'rgb(239 68 68)' : status === 'warning' ? 'rgb(245 158 11)' : 'rgb(16 185 129)',
            }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">Min. threshold: {product.minThreshold} {product.unit}</p>
      </div>

      {/* Supplier row */}
      {(product.supplier || product.supplierContact) && (
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3">
          {product.supplier && <span className="truncate">{product.supplier}</span>}
          {product.supplierContact && (
            <span className="flex items-center gap-1 flex-shrink-0">
              {product.supplierContact.includes('@') ? <Mail className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
              {product.supplierContact}
            </span>
          )}
        </div>
      )}

      {product.notes && (
        <p className="text-[11px] text-muted-foreground italic mb-3 line-clamp-2">{product.notes}</p>
      )}

      {canEdit && (
        <button
          onClick={onUpdateStock}
          className="w-full py-1.5 rounded-lg bg-secondary hover:bg-muted text-xs font-medium text-foreground transition-colors flex items-center justify-center gap-1.5"
        >
          <BarChart2 className="w-3.5 h-3.5" />
          Update Stock
        </button>
      )}
    </div>
  );
}

// ─── Main Catalogue Component ─────────────────────────────────────────────────
interface ProductCatalogueProps {
  canEdit?: boolean;  // manager or owner
  canDelete?: boolean; // owner only
}

export function ProductCatalogue({ canEdit = false, canDelete = false }: ProductCatalogueProps) {
  const { products, addProduct, updateProduct, deleteProduct } = useApp();
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('ALL');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['BEVERAGES', 'FOOD', 'SUPPLIES']));

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.brand || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.supplier || '').toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (filterGroup === 'ALL') return true;
      const group = ALL_GROUPS.find((g) => PRODUCT_CATEGORIES[g].includes(p.category as ProductCategory));
      return group === filterGroup;
    });
  }, [products, search, filterGroup]);

  const criticalCount = products.filter((p) => getStockStatus(p) === 'critical').length;
  const warningCount = products.filter((p) => getStockStatus(p) === 'warning').length;

  const toggleGroup = (g: string) => setExpandedGroups((prev) => {
    const next = new Set(prev);
    if (next.has(g)) next.delete(g); else next.add(g);
    return next;
  });

  const handleSaveNew = (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    addProduct(data);
    setShowAddForm(false);
  };

  const handleSaveEdit = (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingProduct) {
      updateProduct({ ...editingProduct, ...data });
      setEditingProduct(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Product Catalogue
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{products.length} products</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        )}
      </div>

      {/* Alert banner */}
      {(criticalCount > 0 || warningCount > 0) && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${criticalCount > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${criticalCount > 0 ? 'text-red-500' : 'text-amber-500'}`} />
          <p className="text-xs font-medium">
            {criticalCount > 0 && <span className="text-red-600">{criticalCount} product{criticalCount > 1 ? 's' : ''} critically low. </span>}
            {warningCount > 0 && <span className="text-amber-600">{warningCount} product{warningCount > 1 ? 's' : ''} running low.</span>}
          </p>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 p-1 bg-secondary rounded-xl">
          {['ALL', ...ALL_GROUPS].map((g) => (
            <button
              key={g}
              onClick={() => setFilterGroup(g)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${filterGroup === g ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {g === 'ALL' ? 'All' : g.charAt(0) + g.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="glass-card rounded-xl p-5 animate-slide-up">
          <h3 className="text-sm font-bold text-foreground mb-4">New Product</h3>
          <ProductForm onSave={handleSaveNew} onCancel={() => setShowAddForm(false)} />
        </div>
      )}

      {/* Edit form */}
      {editingProduct && (
        <div className="glass-card rounded-xl p-5 animate-slide-up">
          <h3 className="text-sm font-bold text-foreground mb-4">Edit: {editingProduct.name}</h3>
          <ProductForm
            initial={editingProduct}
            onSave={handleSaveEdit}
            onCancel={() => setEditingProduct(null)}
          />
        </div>
      )}

      {/* Products grouped */}
      {products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-semibold text-foreground">No products yet</p>
          <p className="text-sm mt-1">{canEdit ? 'Add your first product to get started' : 'No products have been added yet'}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">No products match your search</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ALL_GROUPS.map((group) => {
            const groupProducts = filtered.filter((p) =>
              PRODUCT_CATEGORIES[group].includes(p.category as ProductCategory)
            );
            if (groupProducts.length === 0) return null;
            const expanded = expandedGroups.has(group);
            const groupCritical = groupProducts.filter((p) => getStockStatus(p) === 'critical').length;

            return (
              <div key={group} className="glass-card rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleGroup(group)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-secondary/50 transition-colors"
                >
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex-1">{group}</span>
                  <span className="text-xs text-muted-foreground">{groupProducts.length} items</span>
                  {groupCritical > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">
                      {groupCritical} alert{groupCritical > 1 ? 's' : ''}
                    </span>
                  )}
                  {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {expanded && (
                  <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 animate-slide-up">
                    {groupProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        canEdit={canEdit}
                        onEdit={() => setEditingProduct(product)}
                        onDelete={() => setDeleteConfirm(product.id)}
                        onUpdateStock={() => setStockProduct(product)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stock update modal */}
      {stockProduct && <StockUpdateModal product={stockProduct} onClose={() => setStockProduct(null)} />}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Delete Product</h3>
                <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-input text-sm font-medium hover:bg-secondary transition-colors">
                Cancel
              </button>
              <button
                onClick={() => { if (canDelete) deleteProduct(deleteConfirm); setDeleteConfirm(null); }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
