import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import {
  Plus, Pencil, Trash2, RefreshCw, Store, Copy, Check,
  MapPin, Phone, Mail, Users, ChevronRight, X, Loader2,
  Power,
} from 'lucide-react';

interface Restaurant {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
  member_count?: number;
}

function generateCode(name: string): string {
  const prefix = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3)
    .padEnd(3, 'X');
  const num = Math.floor(10 + Math.random() * 90);
  return `${prefix}${num}`;
}

const EMPTY_FORM = {
  name: '', address: '', city: '', country: 'France',
  phone: '', email: '', timezone: 'Europe/Paris', code: '',
};

// ── Toggle Switch ────────────────────────────────────────────────────────────
function ToggleSwitch({
  checked, onChange, loading = false, showLabel = false,
}: {
  checked: boolean;
  onChange: () => void;
  loading?: boolean;
  showLabel?: boolean;
}) {
  return (
    <button
      onClick={onChange}
      disabled={loading}
      className={`relative inline-flex items-center gap-2 group ${loading ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
      title={checked ? 'Désactiver le restaurant' : 'Activer le restaurant'}
    >
      {/* Track */}
      <span
        className={`relative w-10 rounded-full transition-all duration-300 flex-shrink-0 ${checked ? 'bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.4)]' : 'bg-muted-foreground/30'}`}
        style={{ height: '1.375rem' }}
      >
        {/* Thumb */}
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${checked ? 'translate-x-4' : 'translate-x-0'} flex items-center justify-center`}>
          {loading && <Loader2 className="w-2.5 h-2.5 animate-spin text-primary" />}
        </span>
      </span>
      {showLabel && (
        <span className={`text-xs font-semibold transition-colors ${checked ? 'text-primary' : 'text-muted-foreground'}`}>
          {checked ? 'Actif' : 'Inactif'}
        </span>
      )}
    </button>
  );
}

export function RestaurantManagement() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadRestaurants = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase
      .from('restaurants' as any) as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      const withCounts = await Promise.all(
        ((data as unknown) as Restaurant[]).map(async (r) => {
          const { count } = await supabase
            .from('profiles' as any)
            .select('*', { count: 'exact', head: true })
            .eq('restaurant_id', r.id);
          return { ...r, member_count: count ?? 0 };
        })
      );
      setRestaurants(withCounts);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadRestaurants(); }, [loadRestaurants]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, code: generateCode('') });
    setError('');
    setShowForm(true);
  };

  const openEdit = (r: Restaurant) => {
    setEditingId(r.id);
    setForm({
      name: r.name, address: r.address ?? '', city: r.city ?? '',
      country: r.country, phone: r.phone ?? '', email: r.email ?? '',
      timezone: r.timezone, code: r.code,
    });
    setError('');
    setShowForm(true);
  };

  const handleNameChange = (v: string) => {
    setForm((f) => ({ ...f, name: v, code: editingId ? f.code : generateCode(v) }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Le nom est requis.'); return; }
    if (!form.code.trim()) { setError('Le code est requis.'); return; }
    setSaving(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      address: form.address || null,
      city: form.city || null,
      country: form.country,
      phone: form.phone || null,
      email: form.email || null,
      timezone: form.timezone,
    };

    if (editingId) {
      const { error: err } = await (supabase.from('restaurants' as any) as any).update(payload).eq('id', editingId);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await (supabase.from('restaurants' as any) as any).insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }

    setSaving(false);
    setShowForm(false);
    loadRestaurants();
  };

  const handleToggleActive = async (r: Restaurant) => {
    setTogglingId(r.id);
    await (supabase.from('restaurants' as any) as any)
      .update({ is_active: !r.is_active })
      .eq('id', r.id);
    await loadRestaurants();
    setTogglingId(null);
  };

  const handleDelete = async (r: Restaurant) => {
    if (!confirm(`Supprimer le restaurant "${r.name}" ? Cette action est irréversible.`)) return;
    await (supabase.from('restaurants' as any) as any).delete().eq('id', r.id);
    loadRestaurants();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const viewMembers = async (r: Restaurant) => {
    setSelectedRestaurant(r);
    setLoadingMembers(true);
    const { data } = await supabase
      .from('profiles' as any)
      .select('id, name, team, status, pin_set')
      .eq('restaurant_id', r.id)
      .order('name');
    setMembers((data as any[]) ?? []);
    setLoadingMembers(false);
  };

  // ── Members panel ──────────────────────────────────────────────────────────
  if (selectedRestaurant) {
    return (
      <div className="px-4 pt-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedRestaurant(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
          <div>
            <h2 className="text-base font-bold text-foreground">{selectedRestaurant.name}</h2>
            <p className="text-xs text-muted-foreground">Code : <span className="font-mono font-bold">{selectedRestaurant.code}</span></p>
          </div>
        </div>

        {loadingMembers ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucun membre assigné à ce restaurant.</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="glass-card rounded-xl px-3 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.team} · {m.status}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.pin_set ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                  {m.pin_set ? 'PIN défini' : 'PIN par défaut'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Active / inactive split ────────────────────────────────────────────────
  const activeRestaurants = restaurants.filter((r) => r.is_active);
  const inactiveRestaurants = restaurants.filter((r) => !r.is_active);

  return (
    <div className="px-4 pt-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Restaurants</h2>
          <p className="text-xs text-muted-foreground">
            {activeRestaurants.length} actif{activeRestaurants.length > 1 ? 's' : ''}
            {inactiveRestaurants.length > 0 && ` · ${inactiveRestaurants.length} inactif${inactiveRestaurants.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadRestaurants} className="p-2 rounded-xl hover:bg-muted transition-colors" title="Actualiser">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" /> Nouveau
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="glass-card rounded-2xl p-4 space-y-3 border border-primary/20">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-foreground">
              {editingId ? 'Modifier le restaurant' : 'Nouveau restaurant'}
            </h3>
            <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-muted">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Nom *</label>
              <input
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="ex: Café de la Paix"
                className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Code unique *</label>
              <div className="flex gap-1.5">
                <input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  maxLength={8}
                  className="flex-1 px-3 py-2 rounded-xl bg-secondary border border-border text-foreground font-mono text-sm focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, code: generateCode(f.name) }))}
                  className="p-2 rounded-xl bg-muted hover:bg-muted/70 transition-colors"
                  title="Regénérer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ville</label>
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Paris"
                className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Adresse</label>
              <input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="12 rue de la Paix"
                className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Téléphone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+33 1 23 45 67 89"
                className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="contact@resto.fr"
                className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editingId ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : restaurants.length === 0 ? (
        <div className="text-center py-10 space-y-2">
          <Store className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">Aucun restaurant créé</p>
          <button onClick={openCreate} className="text-xs text-primary font-medium hover:underline">
            Créer le premier restaurant →
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active */}
          {activeRestaurants.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase px-1">
                Actifs — {activeRestaurants.length}
              </p>
              {activeRestaurants.map((r) => (
                <RestaurantCard
                  key={r.id}
                  restaurant={r}
                  copiedCode={copiedCode}
                  toggling={togglingId === r.id}
                  onCopy={copyCode}
                  onToggle={handleToggleActive}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onViewMembers={viewMembers}
                />
              ))}
            </div>
          )}

          {/* Inactive */}
          {inactiveRestaurants.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase px-1">
                Inactifs — {inactiveRestaurants.length}
              </p>
              {inactiveRestaurants.map((r) => (
                <RestaurantCard
                  key={r.id}
                  restaurant={r}
                  copiedCode={copiedCode}
                  toggling={togglingId === r.id}
                  onCopy={copyCode}
                  onToggle={handleToggleActive}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onViewMembers={viewMembers}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Restaurant Card ──────────────────────────────────────────────────────────
function RestaurantCard({
  restaurant: r,
  copiedCode,
  toggling,
  onCopy,
  onToggle,
  onEdit,
  onDelete,
  onViewMembers,
}: {
  restaurant: Restaurant;
  copiedCode: string | null;
  toggling: boolean;
  onCopy: (code: string) => void;
  onToggle: (r: Restaurant) => void;
  onEdit: (r: Restaurant) => void;
  onDelete: (r: Restaurant) => void;
  onViewMembers: (r: Restaurant) => void;
}) {
  return (
    <div className={`glass-card rounded-2xl p-4 space-y-3 transition-all duration-300 ${!r.is_active ? 'opacity-55 grayscale-[30%]' : ''}`}>
      {/* Top row: name + toggle */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${r.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
            <Store className={`w-4.5 h-4.5 ${r.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{r.name}</p>
            {r.city && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" />{r.city}
              </p>
            )}
          </div>
        </div>

        {/* Toggle switch */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <ToggleSwitch
            checked={r.is_active}
            onChange={() => onToggle(r)}
            loading={toggling}
            showLabel={true}
          />
        </div>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        {/* Code badge */}
        <button
          onClick={() => onCopy(r.code)}
          className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded-md text-xs font-mono font-bold text-foreground hover:bg-muted/70 transition-colors"
          title="Copier le code"
        >
          {copiedCode === r.code ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
          {r.code}
        </button>
        {r.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.phone}</span>}
        {r.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{r.email}</span>}
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {r.member_count ?? 0} membre{(r.member_count ?? 0) > 1 ? 's' : ''}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 pt-0.5 border-t border-border/40">
        <button
          onClick={() => onViewMembers(r)}
          className="flex items-center gap-1 text-xs text-primary font-medium hover:underline mr-auto"
        >
          Voir l'équipe <ChevronRight className="w-3 h-3" />
        </button>

        <button
          onClick={() => onEdit(r)}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          title="Modifier"
        >
          <Pencil className="w-4 h-4 text-muted-foreground" />
        </button>

        <button
          onClick={() => onDelete(r)}
          className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
          title="Supprimer"
        >
          <Trash2 className="w-4 h-4 text-destructive/70" />
        </button>
      </div>
    </div>
  );
}
