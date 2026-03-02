/**
 * MembresModule — GOD/Admin only
 * Full member management: create, edit, disable, delete profiles + PIN management.
 */
import { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  Users, Plus, Trash2, Edit2, Check, X, Shield,
  Lock, Unlock, RefreshCw, AlertCircle, Ban, Search,
  Eye, EyeOff, ChevronDown, ChevronUp, Loader2, UserX, UserCheck,
  KeyRound,
} from 'lucide-react';
import { hashPin } from '../../lib/pinCrypto';
import { TEAM_CSS, TEAM_LABELS } from '../../data/initialData';
import type { Team } from '../../types';

type UserRole = 'owner' | 'admin' | 'manager' | 'chef' | 'staff';
type AccountStatus = 'active' | 'suspended' | 'disabled';

const ROLE_LABELS: Record<string, string> = {
  god:     'Divinité',
  admin:   'Administrateur',
  owner:   'Propriétaire',
  manager: 'Manager',
  chef:    'Chef',
  staff:   'Équipier',
  station: 'Station',
};

const ROLE_COLORS: Record<string, string> = {
  god:     'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800',
  admin:   'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
  owner:   'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800',
  manager: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
  chef:    'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800',
  staff:   'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-950/30 dark:text-slate-300 dark:border-slate-700',
  station: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-800',
};

const STATUS_COLORS: Record<AccountStatus, string> = {
  active:    'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300',
  suspended: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300',
  disabled:  'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300',
};

const STATUS_LABELS: Record<AccountStatus, string> = {
  active:    '● Actif',
  suspended: '⏸ Suspendu',
  disabled:  '✕ Désactivé',
};

const TEAMS: Team[] = ['BAR', 'KITCHEN', 'FLOOR', 'ATELIER', 'MANAGEMENT'];
const ASSIGNABLE_ROLES: UserRole[] = ['owner', 'manager', 'chef', 'staff'];

interface MemberRow {
  id: string;
  name: string;
  role: string;
  team: string;
  photo_url: string | null;
  phone: string | null;
  pin_hash: string | null;
  pin_set: boolean;
  pin_locked: boolean;
  pin_attempts: number;
  pin_force_reset: boolean;
  status: AccountStatus;
  internal_note: string | null;
}

interface NewMemberForm {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  team: Team;
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function pinDisplay(pinHash: string | null): string {
  if (!pinHash) return '—';
  if (pinHash.includes(':')) return '🔐 PBKDF2';
  try { return atob(pinHash); } catch { return pinHash; }
}

export function MembresModule() {
  const { supabaseUser } = useAuth();
  const { users, removeUser, updateUser } = useApp();

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<NewMemberForm>({ name: '', email: '', password: '', role: 'staff', team: 'BAR' });
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; role: string; team: Team; status: AccountStatus; note: string }>({
    name: '', role: 'staff', team: 'BAR', status: 'active', note: '',
  });

  // PIN reset modal
  const [pinResetId, setPinResetId] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);
  const [pinSaving, setPinSaving] = useState(false);

  const [showPins, setShowPins] = useState<Record<string, boolean>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const loadMembers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, team, photo_url, phone, pin_hash, pin_set, pin_locked, pin_attempts, pin_force_reset, status, internal_note')
      .order('name');

    const { data: roles } = await supabase.from('user_roles').select('user_id, role');
    const roleMap = Object.fromEntries((roles ?? []).map((r: any) => [r.user_id, r.role]));

    const rows: MemberRow[] = (profiles ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      role: roleMap[p.id] ?? 'staff',
      team: p.team,
      photo_url: p.photo_url,
      phone: p.phone,
      pin_hash: p.pin_hash,
      pin_set: p.pin_set,
      pin_locked: p.pin_locked,
      pin_attempts: p.pin_attempts,
      pin_force_reset: p.pin_force_reset,
      status: (p.status ?? 'active') as AccountStatus,
      internal_note: p.internal_note,
    }));

    setMembers(rows);
    setLoading(false);
  };

  useEffect(() => { loadMembers(); }, []);

  // ── Filters
  const filtered = members.filter(m => {
    const matchSearch = search === '' ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.phone ?? '').includes(search);
    const matchRole = filterRole === 'all' || m.role === filterRole;
    const matchStatus = filterStatus === 'all' || m.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  // ── Create member
  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) {
      showFeedback('error', 'Nom, email et mot de passe (min 6 caractères) requis.');
      return;
    }
    setSaving(true);
    try {
      const token = await getToken();
      const res = await supabase.functions.invoke('manage-account', {
        headers: { Authorization: `Bearer ${token}` },
        body: { action: 'create', name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password, role: form.role, team: form.team },
      });
      if (res.data?.success) {
        showFeedback('success', `✅ Compte "${form.name}" créé.`);
        setForm({ name: '', email: '', password: '', role: 'staff', team: 'BAR' });
        setShowAdd(false);
        await loadMembers();
      } else {
        showFeedback('error', res.data?.error || 'Erreur création');
      }
    } catch (e) { showFeedback('error', String(e)); }
    finally { setSaving(false); }
  };

  // ── Edit member
  const startEdit = (m: MemberRow) => {
    setEditingId(m.id);
    setEditForm({ name: m.name, role: m.role, team: m.team as Team, status: m.status, note: m.internal_note ?? '' });
  };

  const handleUpdate = async (userId: string) => {
    setActionLoading(userId);
    try {
      const token = await getToken();
      const res = await supabase.functions.invoke('manage-account', {
        headers: { Authorization: `Bearer ${token}` },
        body: { action: 'update_role', userId, role: editForm.role, team: editForm.team, name: editForm.name, status: editForm.status, internal_note: editForm.note },
      });
      if (res.data?.success) {
        showFeedback('success', '✅ Profil mis à jour');
        setEditingId(null);
        await loadMembers();
      } else {
        showFeedback('error', res.data?.error || 'Erreur');
      }
    } catch (e) { showFeedback('error', String(e)); }
    finally { setActionLoading(null); }
  };

  // ── Unlock PIN
  const handleUnlock = async (userId: string) => {
    setActionLoading(userId + '_unlock');
    const { error } = await supabase.from('profiles').update({ pin_locked: false, pin_attempts: 0, pin_locked_at: null } as any).eq('id', userId);
    if (!error) { showFeedback('success', '✅ Compte débloqué'); await loadMembers(); }
    else showFeedback('error', 'Erreur déblocage');
    setActionLoading(null);
  };

  // ── Force PIN reset
  const handleForceReset = async (userId: string) => {
    setActionLoading(userId + '_reset');
    const { error } = await supabase.from('profiles').update({ pin_force_reset: true } as any).eq('id', userId);
    if (!error) { showFeedback('success', '✅ Réinitialisation PIN forcée'); await loadMembers(); }
    else showFeedback('error', 'Erreur');
    setActionLoading(null);
  };

  // ── Set new PIN directly
  const handleSetPin = async () => {
    if (!pinResetId || newPin.length < 6) return;
    setPinSaving(true);
    try {
      const hash = await hashPin(newPin);
      const { error } = await supabase.from('profiles').update({
        pin_hash: hash, pin_set: true, pin_locked: false, pin_attempts: 0, pin_force_reset: false,
      } as any).eq('id', pinResetId);
      if (!error) {
        showFeedback('success', `✅ PIN défini pour ce membre`);
        setPinResetId(null);
        setNewPin('');
        await loadMembers();
      } else {
        showFeedback('error', 'Erreur PIN');
      }
    } catch (e) { showFeedback('error', String(e)); }
    finally { setPinSaving(false); }
  };

  // ── Delete account
  const handleDelete = async (userId: string) => {
    setActionLoading(userId + '_del');
    try {
      const token = await getToken();
      const res = await supabase.functions.invoke('manage-account', {
        headers: { Authorization: `Bearer ${token}` },
        body: { action: 'delete', userId },
      });
      if (res.data?.success) {
        showFeedback('success', '✅ Compte supprimé');
        setDeleteConfirmId(null);
        removeUser(userId);
        await loadMembers();
      } else {
        showFeedback('error', res.data?.error || 'Erreur suppression');
      }
    } catch (e) { showFeedback('error', String(e)); }
    finally { setActionLoading(null); }
  };

  const alertCount = members.filter(m => m.pin_locked || m.pin_force_reset).length;

  return (
    <div className="space-y-4">

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium animate-slide-up ${feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
          {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {feedback.msg}
        </div>
      )}

      {/* Alerts */}
      {alertCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {alertCount} compte{alertCount > 1 ? 's' : ''} nécessite{alertCount === 1 ? '' : 'nt'} une attention (PIN bloqué ou réinitialisation forcée)
        </div>
      )}

      {/* Header + Add button */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par nom ou téléphone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouveau</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="text-xs px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-foreground focus:outline-none focus:border-primary"
        >
          <option value="all">Tous les rôles</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-xs px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-foreground focus:outline-none focus:border-primary"
        >
          <option value="all">Tous statuts</option>
          <option value="active">Actifs</option>
          <option value="suspended">Suspendus</option>
          <option value="disabled">Désactivés</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} membre{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="glass-card rounded-xl p-4 space-y-3 animate-slide-up border border-primary/20">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Nouveau membre</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nom *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Prénom Nom" className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email *</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@domaine.com" className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Mot de passe * (min 6 car.)</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••" className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Rôle</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary">
                {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Équipe</label>
              <select value={form.team} onChange={e => setForm(f => ({ ...f, team: e.target.value as Team }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary">
                {TEAMS.map(t => <option key={t} value={t}>{TEAM_LABELS[t] ?? t}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleCreate} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Créer
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg bg-secondary text-foreground text-sm hover:bg-muted transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* PIN reset modal */}
      {pinResetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-xs shadow-2xl border border-border space-y-4 animate-slide-up">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Définir un nouveau PIN</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Le nouveau PIN sera haché (PBKDF2) avant d'être enregistré.
            </p>
            <div className="relative">
              <input
                type={showNewPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="4 ou 6 chiffres"
                className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button type="button" onClick={() => setShowNewPin(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showNewPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSetPin} disabled={pinSaving || newPin.length < 4} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40">
                {pinSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Enregistrer
              </button>
              <button onClick={() => { setPinResetId(null); setNewPin(''); }} className="px-4 py-2.5 rounded-xl bg-secondary text-foreground text-sm hover:bg-muted">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Aucun membre trouvé</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const isEditing = editingId === m.id;
            const isGod = m.role === 'god';
            const isCurrentUser = m.id === supabaseUser?.id;
            const isLocked = m.pin_locked;
            const needsReset = m.pin_force_reset;

            return (
              <div key={m.id} className={`glass-card rounded-xl overflow-hidden transition-all ${isLocked ? 'ring-1 ring-destructive/40' : ''}`}>
                {/* Header row */}
                <div className="flex items-center gap-3 p-3.5">
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary-foreground bg-gradient-to-br from-primary to-accent ${m.photo_url ? 'p-0 overflow-hidden' : ''}`}>
                    {m.photo_url ? <img src={m.photo_url} alt={m.name} className="w-full h-full object-cover" /> : getInitials(m.name)}
                  </div>

                  {/* Name + badges */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">{m.name}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${ROLE_COLORS[m.role] ?? ROLE_COLORS.staff}`}>
                        {ROLE_LABELS[m.role] ?? m.role}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_COLORS[m.status]}`}>
                        {STATUS_LABELS[m.status]}
                      </span>
                      {isLocked && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-destructive/10 text-destructive border border-destructive/20">🔒 Bloqué</span>}
                      {needsReset && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300">⚠ Reset PIN</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {TEAM_LABELS[m.team as Team] ?? m.team}
                      {m.phone ? ` · ${m.phone}` : ''}
                    </p>
                  </div>

                  {/* Actions */}
                  {!isGod && !isEditing && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isLocked && (
                        <button onClick={() => handleUnlock(m.id)} disabled={actionLoading === m.id + '_unlock'} title="Débloquer" className="p-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors dark:bg-green-950/30 dark:text-green-300">
                          {actionLoading === m.id + '_unlock' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <button onClick={() => setPinResetId(m.id)} title="Modifier PIN" className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleForceReset(m.id)} disabled={actionLoading === m.id + '_reset'} title="Forcer reset PIN" className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                        {actionLoading === m.id + '_reset' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => startEdit(m)} title="Modifier" className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {!isCurrentUser && (
                        deleteConfirmId === m.id ? (
                          <>
                            <button onClick={() => handleDelete(m.id)} disabled={!!actionLoading} className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                              {actionLoading === m.id + '_del' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => setDeleteConfirmId(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => setDeleteConfirmId(m.id)} title="Supprimer" className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                    </div>
                  )}
                  {isEditing && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleUpdate(m.id)} disabled={actionLoading === m.id} className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90">
                        {actionLoading === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Edit form */}
                {isEditing && (
                  <div className="border-t border-border px-3.5 pb-3.5 pt-3 grid grid-cols-2 gap-2.5 animate-slide-up">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-xs text-muted-foreground mb-1 block">Nom</label>
                      <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Rôle</label>
                      <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} className="w-full px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary">
                        {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Équipe</label>
                      <select value={editForm.team} onChange={e => setEditForm(f => ({ ...f, team: e.target.value as Team }))} className="w-full px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary">
                        {TEAMS.map(t => <option key={t} value={t}>{TEAM_LABELS[t] ?? t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Statut</label>
                      <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as AccountStatus }))} className="w-full px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary">
                        <option value="active">Actif</option>
                        <option value="suspended">Suspendu</option>
                        <option value="disabled">Désactivé</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground mb-1 block">Note interne</label>
                      <input type="text" value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} placeholder="Note visible uniquement par les admins…" className="w-full px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary" />
                    </div>
                    {/* PIN info */}
                    <div className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-2">
                      <Shield className="w-3.5 h-3.5 text-primary" />
                      PIN actuel : <span className="font-mono">{pinDisplay(m.pin_hash)}</span>
                      <span className="text-[10px]">({m.pin_attempts} tentatives)</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
