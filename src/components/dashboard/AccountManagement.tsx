import { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  Users, Plus, Trash2, Edit2, Check, X, ShieldCheck,
  ChevronDown, ChevronUp, AlertTriangle, Loader2, UserCog,
  Eye, EyeOff, Lock, Unlock, RefreshCw, AlertCircle, Ban,
} from 'lucide-react';
import { TEAM_CSS, TEAM_LABELS } from '../../data/initialData';
import type { Team } from '../../types';

type UserRole = 'god' | 'owner' | 'admin' | 'manager' | 'chef' | 'staff';
type AccountStatus = 'active' | 'suspended' | 'disabled';

const ROLE_LABELS: Record<UserRole, string> = {
  god:     'Administrateur',
  owner:   'Propriétaire (Master)',
  admin:   'Admin',
  manager: 'Manager',
  chef:    'Chef',
  staff:   'Staff',
};

const ROLE_COLORS: Record<UserRole, string> = {
  god:     'bg-primary/10 text-primary border border-primary/20',
  owner:   'bg-accent/20 text-accent-foreground border border-accent/30',
  admin:   'bg-primary/10 text-primary border border-primary/20',
  manager: 'bg-secondary text-secondary-foreground border border-border',
  chef:    'bg-muted text-muted-foreground border border-border',
  staff:   'bg-secondary text-muted-foreground border border-border',
};

const STATUS_LABELS: Record<AccountStatus, string> = {
  active:    'Actif',
  suspended: 'Suspendu',
  disabled:  'Désactivé',
};

const STATUS_COLORS: Record<AccountStatus, string> = {
  active:    'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800',
  suspended: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800',
  disabled:  'bg-destructive/10 text-destructive border border-destructive/20',
};

const TEAMS: Team[] = ['BAR', 'KITCHEN', 'FLOOR', 'ATELIER', 'MANAGEMENT'];
const ASSIGNABLE_ROLES: UserRole[] = ['owner', 'manager', 'chef', 'staff'];

interface NewUserForm {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  team: Team;
}

interface ProfileExtra {
  id: string;
  pin_hash?: string | null;
  status?: AccountStatus;
  pin_locked?: boolean;
  pin_attempts?: number;
  pin_force_reset?: boolean;
  internal_note?: string | null;
}

// Decode PBKDF2 hash to get original PIN — not possible (one-way).
// We display the raw stored value for legacy/plain PINs, or "chiffré" for PBKDF2.
function pinDisplay(pinHash?: string | null): string {
  if (!pinHash) return '—';
  if (pinHash.includes(':')) return '🔐 PBKDF2'; // one-way hash
  try { return atob(pinHash); } catch { return pinHash; } // legacy base64
}

export function AccountManagement() {
  const { users, updateUser, removeUser } = useApp();
  const { supabaseUser } = useAuth();

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('staff');
  const [editTeam, setEditTeam] = useState<Team>('BAR');
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState<AccountStatus>('active');
  const [editNote, setEditNote] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [expandedRoles, setExpandedRoles] = useState<Set<UserRole>>(new Set(['owner', 'manager', 'staff']));
  const [showPin, setShowPin] = useState<Record<string, boolean>>({});
  const [profileExtras, setProfileExtras] = useState<Record<string, ProfileExtra>>({});
  const [showDisabled, setShowDisabled] = useState(false);

  const [form, setForm] = useState<NewUserForm>({
    name: '', email: '', password: '', role: 'staff', team: 'BAR',
  });

  // Load extra profile data (PIN hashes, status, lockout)
  useEffect(() => {
    loadProfileExtras();
  }, [users]);

  const loadProfileExtras = async () => {
    const ids = users.map(u => u.id);
    if (ids.length === 0) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, pin_hash, pin_locked, pin_attempts, pin_force_reset, internal_note')
      .in('id', ids) as any;
    if (data) {
      const map: Record<string, ProfileExtra> = {};
      data.forEach((p: any) => { map[p.id] = p; });
      setProfileExtras(map);
    }
  };

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const toggleRole = (role: UserRole) => {
    setExpandedRoles(prev => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role); else next.add(role);
      return next;
    });
  };

  const togglePinVisible = (userId: string) => {
    setShowPin(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  // ── Create account ────────────────────────────────────────────────────────────
  const handleCreateAccount = async () => {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) {
      showFeedback('error', 'Nom, email et mot de passe (min 6 caractères) requis.');
      return;
    }
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) { showFeedback('error', 'Non authentifié'); return; }

      const res = await supabase.functions.invoke('manage-account', {
        headers: { Authorization: `Bearer ${token}` },
        body: { action: 'create', name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password, role: form.role, team: form.team },
      });

      if (res.error || !res.data?.success) {
        showFeedback('error', res.data?.error || res.error?.message || 'Erreur création');
      } else {
        showFeedback('success', `✅ Compte "${form.name}" créé avec succès`);
        setForm({ name: '', email: '', password: '', role: 'staff', team: 'BAR' });
        setShowAdd(false);
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (e) { showFeedback('error', String(e)); }
    finally { setLoading(false); }
  };

  // ── Update role, team, status, note ─────────────────────────────────────────
  const handleUpdateAccount = async (userId: string) => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) { showFeedback('error', 'Non authentifié'); return; }

      const res = await supabase.functions.invoke('manage-account', {
        headers: { Authorization: `Bearer ${token}` },
        body: { action: 'update_role', userId, role: editRole, team: editTeam, name: editName, status: editStatus, internal_note: editNote },
      });

      if (res.error || !res.data?.success) {
        showFeedback('error', res.data?.error || 'Erreur mise à jour');
      } else {
        const user = users.find(u => u.id === userId);
        if (user) updateUser({ ...user, role: editRole as any, team: editTeam, name: editName.trim() || user.name });
        showFeedback('success', '✅ Compte mis à jour');
        setEditingId(null);
        await loadProfileExtras();
      }
    } catch (e) { showFeedback('error', String(e)); }
    finally { setLoading(false); }
  };

  // ── Unlock PIN (reset attempts) ───────────────────────────────────────────────
  const handleUnlockPin = async (userId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ pin_locked: false, pin_attempts: 0, pin_locked_at: null } as any)
        .eq('id', userId);
      if (error) showFeedback('error', 'Erreur déblocage');
      else { showFeedback('success', '✅ Compte débloqué'); await loadProfileExtras(); }
    } catch (e) { showFeedback('error', String(e)); }
    finally { setLoading(false); }
  };

  // ── Force PIN reset at next login ─────────────────────────────────────────────
  const handleForceReset = async (userId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ pin_force_reset: true } as any)
        .eq('id', userId);
      if (error) showFeedback('error', 'Erreur');
      else { showFeedback('success', '✅ Réinitialisation PIN forcée à la prochaine connexion'); await loadProfileExtras(); }
    } catch (e) { showFeedback('error', String(e)); }
    finally { setLoading(false); }
  };

  // ── Delete account ────────────────────────────────────────────────────────────
  const handleDeleteAccount = async (userId: string) => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) { showFeedback('error', 'Non authentifié'); return; }

      const res = await supabase.functions.invoke('manage-account', {
        headers: { Authorization: `Bearer ${token}` },
        body: { action: 'delete', userId },
      });

      if (res.error || !res.data?.success) {
        showFeedback('error', res.data?.error || 'Erreur suppression');
      } else {
        removeUser(userId);
        showFeedback('success', '✅ Compte supprimé');
        setDeleteConfirmId(null);
      }
    } catch (e) { showFeedback('error', String(e)); }
    finally { setLoading(false); }
  };

  // Count alerts
  const lockedAccounts = users.filter(u => profileExtras[u.id]?.pin_locked);
  const userRoleStr = (u: typeof users[0]) => u.role as string;
  const defaultPinAccounts = users.filter(u => !profileExtras[u.id]?.pin_hash && userRoleStr(u) !== 'god' && userRoleStr(u) !== 'admin');

  // Group by role
  const groupedUsers = ASSIGNABLE_ROLES.reduce<Record<UserRole, typeof users>>((acc, role) => {
    acc[role] = users.filter(u => u.role === role && (profileExtras[u.id]?.status ?? 'active') !== 'disabled');
    return acc;
  }, {} as Record<UserRole, typeof users>);
  const godUsers = users.filter(u => (u.role as string) === 'god' || (u.role as string) === 'admin');
  const disabledUsers = users.filter(u => (profileExtras[u.id]?.status) === 'disabled');

  const renderUserRow = (user: typeof users[0], isGodRow = false) => {
    const extra = profileExtras[user.id];
    const status: AccountStatus = (extra?.status as AccountStatus) ?? 'active';
    const isLocked = extra?.pin_locked ?? false;
    const forceReset = extra?.pin_force_reset ?? false;
    const pinVisible = showPin[user.id];

    if (editingId === user.id && !isGodRow) {
      return (
        <div className="px-4 py-3 space-y-2 bg-secondary/30">
          <input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            placeholder="Prénom"
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={editRole}
              onChange={e => setEditRole(e.target.value as UserRole)}
              className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
            >
              {ASSIGNABLE_ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <select
              value={editTeam}
              onChange={e => setEditTeam(e.target.value as Team)}
              className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
            >
              {TEAMS.map(t => (
                <option key={t} value={t}>{TEAM_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <select
            value={editStatus}
            onChange={e => setEditStatus(e.target.value as AccountStatus)}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
          >
            {(['active', 'suspended', 'disabled'] as AccountStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <textarea
            value={editNote}
            onChange={e => setEditNote(e.target.value)}
            placeholder="Note interne (visible Admin/Owner/Manager uniquement)…"
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary resize-none"
          />
          <div className="flex gap-2">
            <button onClick={() => setEditingId(null)} className="flex-1 py-2 rounded-lg bg-secondary text-xs text-secondary-foreground">
              Annuler
            </button>
            <button
              onClick={() => handleUpdateAccount(user.id)}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Sauvegarder
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={`px-4 py-3 ${status === 'disabled' ? 'opacity-60' : ''}`}>
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isGodRow ? 'bg-gradient-to-br from-primary to-accent text-primary-foreground' : `team-badge ${TEAM_CSS[user.team]}`}`}>
            {user.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground">{user.name}</p>
              {!isGodRow && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[status]}`}>
                  {STATUS_LABELS[status]}
                </span>
              )}
              {isLocked && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Bloqué
                </span>
              )}
              {forceReset && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300">
                  Reset requis
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[(user.role as UserRole) ?? 'staff']}`}>
                {ROLE_LABELS[(user.role as UserRole) ?? 'staff']}
              </span>
              {!isGodRow && <span className="text-[10px] text-muted-foreground">{TEAM_LABELS[user.team]}</span>}
              {/* PIN display (clear text for ADMIN/GOD) */}
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                PIN:{' '}
                {pinVisible ? (
                  <span className="font-mono font-semibold text-foreground">{pinDisplay(extra?.pin_hash)}</span>
                ) : (
                  <span>••••</span>
                )}
                <button onClick={() => togglePinVisible(user.id)} className="text-muted-foreground hover:text-foreground transition-colors ml-0.5">
                  {pinVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </span>
            </div>
            {extra?.internal_note && (
              <p className="text-[10px] text-muted-foreground mt-1 italic truncate">📝 {extra.internal_note}</p>
            )}
          </div>

          {/* Actions */}
          {!isGodRow && (
            <div className="flex flex-col gap-1 flex-shrink-0">
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setEditingId(user.id);
                    setEditRole(user.role as UserRole);
                    setEditTeam(user.team);
                    setEditName(user.name);
                    setEditStatus(status);
                    setEditNote(extra?.internal_note ?? '');
                  }}
                  className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                  title="Modifier"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {isLocked && (
                  <button
                    onClick={() => handleUnlockPin(user.id)}
                    className="p-1.5 rounded-lg bg-green-50 dark:bg-green-950/30 hover:opacity-80 text-green-700 dark:text-green-300 transition-colors"
                    title="Débloquer le compte"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleForceReset(user.id)}
                  className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 hover:opacity-80 text-amber-700 dark:text-amber-300 transition-colors"
                  title="Forcer reset PIN à la prochaine connexion"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                {deleteConfirmId === user.id ? (
                  <>
                    <button
                      onClick={() => handleDeleteAccount(user.id)}
                      disabled={loading}
                      className="p-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setDeleteConfirmId(null)} className="p-1.5 rounded-lg bg-secondary text-secondary-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(user.id)}
                    className="p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                    title="Supprimer le compte"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
          {isGodRow && (
            <div className="flex items-center gap-1">
              <button onClick={() => togglePinVisible(user.id)} className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors" title="Voir/masquer PIN">
                {showPin[user.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <span className="text-[10px] text-muted-foreground">Protégé</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <UserCog className="w-4 h-4 text-primary" />
            Gestion des comptes
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{users.length} comptes · {disabledUsers.length} désactivé{disabledUsers.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" />
          Nouveau compte
        </button>
      </div>

      {/* Security alerts */}
      {lockedAccounts.length > 0 && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-semibold">{lockedAccounts.length} compte{lockedAccounts.length > 1 ? 's' : ''} bloqué{lockedAccounts.length > 1 ? 's' : ''}</span> après 5 tentatives PIN incorrectes.{' '}
            {lockedAccounts.map(u => u.name).join(', ')}
          </div>
        </div>
      )}
      {defaultPinAccounts.length > 0 && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-semibold">{defaultPinAccounts.length} compte{defaultPinAccounts.length > 1 ? 's' : ''} avec PIN 000111 par défaut</span> — jamais modifié.{' '}
            {defaultPinAccounts.map(u => u.name).join(', ')}
          </div>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className={`px-4 py-3 rounded-xl text-xs font-medium ${feedback.type === 'success' ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>
          {feedback.msg}
        </div>
      )}

      {/* Add account form */}
      {showAdd && (
        <div className="glass-card rounded-xl p-4 space-y-3 border border-primary/20 animate-slide-up">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            Créer un nouveau compte
          </h3>
          <div className="grid grid-cols-1 gap-2">
            <input type="text" placeholder="Prénom" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary" />
            <input type="email" placeholder="Email (ex: prenom@staffnb.app)" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary" />
            <input type="password" placeholder="Mot de passe (min 6 caractères)" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary" />
            <div className="grid grid-cols-2 gap-2">
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))} className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary">
                {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <select value={form.team} onChange={e => setForm(f => ({ ...f, team: e.target.value as Team }))} className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary">
                {TEAMS.map(t => <option key={t} value={t}>{TEAM_LABELS[t]}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowAdd(false); setForm({ name: '', email: '', password: '', role: 'staff', team: 'BAR' }); }} className="flex-1 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm">Annuler</button>
            <button onClick={handleCreateAccount} disabled={loading} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Créer le compte
            </button>
          </div>
        </div>
      )}

      {/* Admins (god/admin) */}
      {godUsers.length > 0 && (
        <div className="rounded-xl border border-primary/30 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-primary/5">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-primary">Administrateurs système</span>
            <span className="text-xs text-muted-foreground ml-auto">{godUsers.length}</span>
          </div>
          <div className="divide-y divide-border">
            {godUsers.map(user => (
              <div key={user.id}>{renderUserRow(user, true)}</div>
            ))}
          </div>
        </div>
      )}

      {/* Users grouped by role */}
      {ASSIGNABLE_ROLES.map(role => {
        const group = groupedUsers[role];
        if (group.length === 0) return null;
        const expanded = expandedRoles.has(role);
        return (
          <div key={role} className="rounded-xl border border-border overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-4 py-3 bg-secondary/50 hover:bg-secondary transition-colors"
              onClick={() => toggleRole(role)}
            >
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${ROLE_COLORS[role]}`}>
                {ROLE_LABELS[role]}
              </span>
              <span className="text-xs text-muted-foreground">{group.length} compte{group.length > 1 ? 's' : ''}</span>
              <span className="ml-auto text-muted-foreground">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </button>
            {expanded && (
              <div className="divide-y divide-border">
                {group.map(user => (
                  <div key={user.id}>{renderUserRow(user)}</div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Disabled accounts — hidden by default */}
      {disabledUsers.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 bg-secondary/30 hover:bg-secondary/50 transition-colors"
            onClick={() => setShowDisabled(d => !d)}
          >
            <Ban className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Comptes désactivés</span>
            <span className="text-xs text-muted-foreground">{disabledUsers.length}</span>
            <span className="ml-auto text-muted-foreground">
              {showDisabled ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>
          {showDisabled && (
            <div className="divide-y divide-border">
              {disabledUsers.map(user => (
                <div key={user.id}>{renderUserRow(user)}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
