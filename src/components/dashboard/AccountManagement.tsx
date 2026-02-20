import { useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  Users, Plus, Trash2, Edit2, Check, X, ShieldCheck,
  ChevronDown, ChevronUp, AlertTriangle, Loader2, UserCog,
} from 'lucide-react';
import { TEAM_CSS, TEAM_LABELS } from '../../data/initialData';
import type { Team } from '../../types';

type UserRole = 'god' | 'owner' | 'admin' | 'manager' | 'chef' | 'staff';

const ROLE_LABELS: Record<UserRole, string> = {
  god:     'Administrateur',
  owner:   'Propriétaire',
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

const TEAMS: Team[] = ['BAR', 'KITCHEN', 'FLOOR', 'ATELIER', 'MANAGEMENT'];
const ASSIGNABLE_ROLES: UserRole[] = ['owner', 'manager', 'chef', 'staff'];

interface NewUserForm {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  team: Team;
}

export function AccountManagement() {
  const { users, updateUser, removeUser } = useApp();
  const { supabaseUser } = useAuth();

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('staff');
  const [editTeam, setEditTeam] = useState<Team>('BAR');
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [expandedRoles, setExpandedRoles] = useState<Set<UserRole>>(new Set(['owner', 'manager', 'staff']));

  const [form, setForm] = useState<NewUserForm>({
    name: '', email: '', password: '', role: 'staff', team: 'BAR',
  });

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

  // ── Create a new account via Edge Function ───────────────────────────────────
  const handleCreateAccount = async () => {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) {
      showFeedback('error', 'Nom, email et mot de passe (min 6 caractères) requis.');
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { showFeedback('error', 'Non authentifié'); return; }

      const res = await supabase.functions.invoke('manage-account', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          action: 'create',
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: form.role,
          team: form.team,
        },
      });

      if (res.error || !res.data?.success) {
        showFeedback('error', res.data?.error || res.error?.message || 'Erreur création');
      } else {
        showFeedback('success', `✅ Compte "${form.name}" créé avec succès`);
        setForm({ name: '', email: '', password: '', role: 'staff', team: 'BAR' });
        setShowAdd(false);
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (e) {
      showFeedback('error', String(e));
    } finally {
      setLoading(false);
    }
  };

  // ── Update role & team ───────────────────────────────────────────────────────
  const handleUpdateRole = async (userId: string) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { showFeedback('error', 'Non authentifié'); return; }

      const res = await supabase.functions.invoke('manage-account', {
        headers: { Authorization: `Bearer ${token}` },
        body: { action: 'update_role', userId, role: editRole, team: editTeam, name: editName },
      });

      if (res.error || !res.data?.success) {
        showFeedback('error', res.data?.error || 'Erreur mise à jour');
      } else {
        const user = users.find(u => u.id === userId);
        if (user) updateUser({ ...user, role: editRole as any, team: editTeam, name: editName.trim() || user.name });
        showFeedback('success', '✅ Compte mis à jour');
        setEditingId(null);
      }
    } catch (e) {
      showFeedback('error', String(e));
    } finally {
      setLoading(false);
    }
  };

  // ── Delete account ───────────────────────────────────────────────────────────
  const handleDeleteAccount = async (userId: string) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
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
    } catch (e) {
      showFeedback('error', String(e));
    } finally {
      setLoading(false);
    }
  };

  // Group users by role
  const groupedUsers = ASSIGNABLE_ROLES.reduce<Record<UserRole, typeof users>>((acc, role) => {
    acc[role] = users.filter(u => u.role === role);
    return acc;
  }, {} as Record<UserRole, typeof users>);
  // Also show god/admin
  const godUsers = users.filter(u => u.role === ('god' as any) || u.role === 'admin');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <UserCog className="w-4 h-4 text-primary" />
            Gestion des comptes
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{users.length} comptes actifs</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" />
          Nouveau compte
        </button>
      </div>

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
            <input
              type="text"
              placeholder="Prénom"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
            />
            <input
              type="email"
              placeholder="Email (ex: prenom@staffandb.app)"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
            />
            <input
              type="password"
              placeholder="Mot de passe (min 6 caractères)"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
                className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              >
                {ASSIGNABLE_ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              <select
                value={form.team}
                onChange={e => setForm(f => ({ ...f, team: e.target.value as Team }))}
                className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              >
                {TEAMS.map(t => (
                  <option key={t} value={t}>{TEAM_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setShowAdd(false); setForm({ name: '', email: '', password: '', role: 'staff', team: 'BAR' }); }}
              className="flex-1 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm"
            >
              Annuler
            </button>
            <button
              onClick={handleCreateAccount}
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Créer le compte
            </button>
          </div>
        </div>
      )}

      {/* Admins (god/admin) — read-only display */}
      {godUsers.length > 0 && (
        <div className="rounded-xl border border-primary/30 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-primary/5">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-primary">Administrateurs système</span>
            <span className="text-xs text-muted-foreground ml-auto">{godUsers.length}</span>
          </div>
          <div className="divide-y divide-border">
            {godUsers.map(user => (
              <div key={user.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">
                  {user.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{user.name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[(user.role as UserRole) ?? 'staff']}`}>
                    {ROLE_LABELS[(user.role as UserRole) ?? 'staff']}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">Protégé</span>
              </div>
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
                  <div key={user.id} className="px-4 py-3">
                    {editingId === user.id ? (
                      <div className="space-y-2">
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
                        <div className="flex gap-2">
                          <button onClick={() => setEditingId(null)} className="flex-1 py-2 rounded-lg bg-secondary text-xs text-secondary-foreground">
                            Annuler
                          </button>
                          <button
                            onClick={() => handleUpdateRole(user.id)}
                            disabled={loading}
                            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Sauvegarder
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 team-badge ${TEAM_CSS[user.team]}`}>
                          {user.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[role]}`}>
                              {ROLE_LABELS[role]}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{TEAM_LABELS[user.team]}</span>
                            <span className="text-[10px] text-muted-foreground">· PIN: {user.pinSet ? '••••' : <span className="text-destructive">non défini</span>}</span>
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => {
                              setEditingId(user.id);
                              setEditRole(user.role as UserRole);
                              setEditTeam(user.team);
                              setEditName(user.name);
                            }}
                            className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                            title="Modifier"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {/* Don't allow deleting yourself */}
                          {user.id !== supabaseUser?.id && (
                            <button
                              onClick={() => setDeleteConfirmId(user.id)}
                              className="p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-border animate-slide-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Supprimer ce compte ?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {users.find(u => u.id === deleteConfirmId)?.name} — cette action est irréversible.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-secondary"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDeleteAccount(deleteConfirmId)}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
