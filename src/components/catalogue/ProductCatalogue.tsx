import { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Product, ProductCategory, PRODUCT_CATEGORIES, UnitType, StockUpdateReason } from '../../types';
import {
  Package, Plus, Search, AlertTriangle, CheckCircle, Edit2, Trash2,
  ChevronDown, ChevronUp, X, Minus, BarChart2, Phone, Mail,
  Download, Upload, FileText, AlertCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../integrations/supabase/client';

const ALL_CATEGORIES = Object.values(PRODUCT_CATEGORIES).flat() as ProductCategory[];
const ALL_GROUPS = Object.keys(PRODUCT_CATEGORIES) as (keyof typeof PRODUCT_CATEGORIES)[];

// ─── CSV template columns ──────────────────────────────────────────────────────
const TEMPLATE_COLUMNS = ['Nom', 'Catégorie', 'Sous-catégorie', 'Unité', 'Prix unitaire', 'Fournisseur', 'Référence fournisseur', 'Seuil alerte stock'];
const REQUIRED_COLS = ['Nom', 'Catégorie', 'Fournisseur'];

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

// ─── Import preview row ────────────────────────────────────────────────────────
interface ImportRow {
  name: string;
  category: string;
  subcategory: string;
  unit: string;
  unitPrice: number | null;
  supplier: string;
  supplierRef: string;
  minThreshold: number;
}

// ─── CSV Download helper ───────────────────────────────────────────────────────
function downloadCsvTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_COLUMNS,
    ['Eau minérale 1L', 'Food', 'Boissons', 'pcs', 1.2, 'Metro', 'METRO-EAU-001', 10],
    ['Vin rouge Bordeaux', 'Food', 'Vins', 'btl', 8.5, 'Transgourmet', 'TG-VIN-042', 5],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Catalogue');
  XLSX.writeFile(wb, 'modele_catalogue.xlsx');
}

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
          <label className="block text-xs font-medium text-muted-foreground mb-1">Nom *</label>
          <input
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Ex: Eau minérale 1L"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Marque</label>
          <input
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.brand}
            onChange={(e) => set('brand', e.target.value)}
            placeholder="Marque"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Catégorie *</label>
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
          <label className="block text-xs font-medium text-muted-foreground mb-1">Unité</label>
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
                {u === 'btl' ? 'Bouteilles (btl)' : 'Pièces (pcs)'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Fournisseur</label>
          <input
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.supplier}
            onChange={(e) => set('supplier', e.target.value)}
            placeholder="Metro, Transgourmet…"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Contact fournisseur</label>
          <input
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.supplierContact}
            onChange={(e) => set('supplierContact', e.target.value)}
            placeholder="Téléphone ou email"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Stock actuel</label>
          <input
            type="number" min={0}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.currentStock}
            onChange={(e) => set('currentStock', Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Seuil d'alerte</label>
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
          placeholder="Notes optionnelles..."
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-muted-foreground border border-input hover:bg-secondary transition-colors">
          Annuler
        </button>
        <button
          onClick={() => { if (form.name) onSave(form); }}
          disabled={!form.name}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          Enregistrer
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
            <h3 className="font-bold text-foreground">Mise à jour stock</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{product.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-secondary">
          <span className="text-sm text-muted-foreground">Stock actuel</span>
          <span className="font-bold text-foreground text-lg">{product.currentStock} {product.unit}</span>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setIsPos(true)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${isPos ? 'bg-emerald-600 text-white' : 'bg-secondary text-muted-foreground'}`}
            >
              + Ajouter
            </button>
            <button
              onClick={() => setIsPos(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${!isPos ? 'bg-red-500 text-white' : 'bg-secondary text-muted-foreground'}`}
            >
              − Retirer
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
            <label className="block text-xs font-medium text-muted-foreground mb-1">Raison</label>
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
            <span className="text-xs text-muted-foreground">Nouveau stock</span>
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
          Confirmer
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
        <p className="text-[10px] text-muted-foreground mt-0.5">Seuil min. : {product.minThreshold} {product.unit}</p>
      </div>

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
          Modifier le stock
        </button>
      )}
    </div>
  );
}

// ─── Import Modal ─────────────────────────────────────────────────────────────
function ImportCatalogueModal({
  rows,
  onConfirm,
  onCancel,
  loading,
}: {
  rows: ImportRow[];
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const preview = rows.slice(0, 5);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl w-full max-w-lg border border-border shadow-xl animate-slide-up max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-foreground">Aperçu de l'import</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{rows.length} produit(s) détecté(s)</p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          <p className="text-xs text-muted-foreground mb-3">
            Aperçu des 5 premières lignes :
          </p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  {['Nom', 'Catégorie', 'Unité', 'Fournisseur', 'Seuil'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-foreground">{row.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.category || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.unit || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.supplier || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.minThreshold || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 5 && (
            <p className="text-[11px] text-muted-foreground mt-2 text-center">+ {rows.length - 5} autres lignes…</p>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-border flex-shrink-0">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-secondary text-sm font-medium text-muted-foreground">
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="text-xs">Import en cours…</span>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                Confirmer l'import
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Catalogue Component ─────────────────────────────────────────────────
interface ProductCatalogueProps {
  canEdit?: boolean;
  canDelete?: boolean;
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

  // Import state
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importError, setImportError] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

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

  // ─── Parse import file ────────────────────────────────────────────────────────
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!rows || rows.length < 2) {
          setImportError('Fichier vide ou format invalide.');
          return;
        }

        const header = (rows[0] as string[]).map((h) => String(h).trim());

        // Check required columns
        for (const col of REQUIRED_COLS) {
          if (!header.includes(col)) {
            setImportError(`Colonne "${col}" manquante. Téléchargez le modèle.`);
            return;
          }
        }

        const colIdx = (name: string) => header.indexOf(name);

        const parsed: ImportRow[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as unknown[];
          const name = String(row[colIdx('Nom')] ?? '').trim();
          if (!name) continue;
          parsed.push({
            name,
            category: String(row[colIdx('Catégorie')] ?? '').trim(),
            subcategory: String(row[colIdx('Sous-catégorie')] ?? '').trim(),
            unit: String(row[colIdx('Unité')] ?? 'pcs').trim(),
            unitPrice: row[colIdx('Prix unitaire')] != null ? parseFloat(String(row[colIdx('Prix unitaire')])) : null,
            supplier: String(row[colIdx('Fournisseur')] ?? '').trim(),
            supplierRef: String(row[colIdx('Référence fournisseur')] ?? '').trim(),
            minThreshold: parseInt(String(row[colIdx('Seuil alerte stock')] ?? '0')) || 0,
          });
        }

        if (parsed.length === 0) {
          setImportError('Aucune ligne valide trouvée dans le fichier.');
          return;
        }

        setImportRows(parsed);
      } catch {
        setImportError('Impossible de lire le fichier. Utilisez un CSV ou Excel (.xlsx).');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    if (importRows.length === 0) return;
    setImportLoading(true);
    try {
      for (const row of importRows) {
        // Try to find existing product by supplier_ref or name
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .or(`supplier_ref.eq.${row.supplierRef},name.ilike.${row.name}`)
          .limit(1)
          .maybeSingle();

        const payload = {
          name: row.name,
          category: row.category || 'Food',
          supplier: row.supplier || null,
          unit: (['btl', 'pcs'].includes(row.unit) ? row.unit : 'pcs') as 'btl' | 'pcs',
          min_threshold: row.minThreshold,
          current_stock: 0,
          notes: row.subcategory ? `Sous-catégorie: ${row.subcategory}` : null,
          supplier_ref: row.supplierRef || null,
          subcategory: row.subcategory || null,
        };

        if (existing?.id) {
          await supabase.from('products').update(payload).eq('id', existing.id);
        } else {
          await supabase.from('products').insert(payload);
        }
      }
      setImportRows([]);
    } catch (err) {
      console.error('Import error:', err);
    }
    setImportLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Catalogue Produits
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{products.length} produits</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Download template */}
          <button
            onClick={downloadCsvTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary text-foreground text-xs font-medium hover:bg-muted transition-colors border border-border"
          >
            <Download className="w-3.5 h-3.5" />
            Modèle CSV
          </button>

          {/* Import */}
          {canEdit && (
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary text-foreground text-xs font-semibold cursor-pointer hover:bg-muted transition-colors border border-border">
              <Upload className="w-3.5 h-3.5" />
              Importer catalogue
              <input
                ref={importRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleImportFile}
              />
            </label>
          )}

          {/* Add manually */}
          {canEdit && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Ajouter
            </button>
          )}
        </div>
      </div>

      {/* Import error */}
      {importError && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-destructive">{importError}</p>
            <button
              onClick={downloadCsvTemplate}
              className="text-xs text-destructive underline mt-0.5"
            >
              📄 Télécharger le modèle CSV
            </button>
          </div>
        </div>
      )}

      {/* Alert banner */}
      {(criticalCount > 0 || warningCount > 0) && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${criticalCount > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${criticalCount > 0 ? 'text-red-500' : 'text-amber-500'}`} />
          <p className="text-xs font-medium">
            {criticalCount > 0 && <span className="text-red-600">{criticalCount} produit{criticalCount > 1 ? 's' : ''} en rupture critique. </span>}
            {warningCount > 0 && <span className="text-amber-600">{warningCount} produit{warningCount > 1 ? 's' : ''} stock bas.</span>}
          </p>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Rechercher produits..."
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
              {g === 'ALL' ? 'Tous' : g.charAt(0) + g.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="glass-card rounded-xl p-5 animate-slide-up">
          <h3 className="text-sm font-bold text-foreground mb-4">Nouveau produit</h3>
          <ProductForm onSave={handleSaveNew} onCancel={() => setShowAddForm(false)} />
        </div>
      )}

      {/* Edit form */}
      {editingProduct && (
        <div className="glass-card rounded-xl p-5 animate-slide-up">
          <h3 className="text-sm font-bold text-foreground mb-4">Modifier : {editingProduct.name}</h3>
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
          <p className="font-semibold text-foreground">Aucun produit</p>
          <p className="text-sm mt-1">{canEdit ? 'Ajoutez votre premier produit ou importez un catalogue' : 'Aucun produit ajouté'}</p>
          {canEdit && (
            <button
              onClick={downloadCsvTemplate}
              className="mt-3 flex items-center gap-1.5 mx-auto px-4 py-2 rounded-xl bg-secondary text-xs font-medium"
            >
              <FileText className="w-3.5 h-3.5" />
              Télécharger le modèle CSV
            </button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">Aucun produit ne correspond à la recherche</p>
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
                  <span className="text-xs text-muted-foreground">{groupProducts.length} articles</span>
                  {groupCritical > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">
                      {groupCritical} alerte{groupCritical > 1 ? 's' : ''}
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

      {/* Modals */}
      {stockProduct && <StockUpdateModal product={stockProduct} onClose={() => setStockProduct(null)} />}

      {importRows.length > 0 && (
        <ImportCatalogueModal
          rows={importRows}
          onConfirm={handleImportConfirm}
          onCancel={() => { setImportRows([]); setImportError(''); }}
          loading={importLoading}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Supprimer le produit</h3>
                <p className="text-xs text-muted-foreground">Cette action est irréversible.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-input text-sm font-medium hover:bg-secondary transition-colors">
                Annuler
              </button>
              <button
                onClick={() => { if (canDelete) deleteProduct(deleteConfirm); setDeleteConfirm(null); }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
