import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import { Shield, Clock, CheckCircle, XCircle, Filter, ChevronDown } from 'lucide-react';

interface AuditLog {
  id: string;
  created_at: string;
  user_id: string | null;
  user_name: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
}

const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  login:                    { label: 'Connexion',           icon: <CheckCircle className="w-3 h-3" />,  color: 'text-[hsl(var(--timer-safe))]' },
  logout:                   { label: 'Déconnexion',         icon: <XCircle className="w-3 h-3" />,      color: 'text-muted-foreground' },
  task_completed:           { label: 'Tâche validée',       icon: <CheckCircle className="w-3 h-3" />,  color: 'text-primary' },
  order_created:            { label: 'Commande créée',      icon: <CheckCircle className="w-3 h-3" />,  color: 'text-amber-500' },
  order_approved_chef:      { label: 'Commande approuvée (Chef)', icon: <CheckCircle className="w-3 h-3" />, color: 'text-[hsl(var(--timer-safe))]' },
  order_confirmed_manager:  { label: 'Commande confirmée', icon: <CheckCircle className="w-3 h-3" />,  color: 'text-primary' },
  order_rejected:           { label: 'Commande rejetée',   icon: <XCircle className="w-3 h-3" />,      color: 'text-destructive' },
  haccp_logged:             { label: 'Relevé HACCP',        icon: <CheckCircle className="w-3 h-3" />,  color: 'text-blue-500' },
  pin_changed:              { label: 'PIN changé',          icon: <Shield className="w-3 h-3" />,       color: 'text-primary' },
  pin_reset:                { label: 'PIN réinitialisé',    icon: <Shield className="w-3 h-3" />,       color: 'text-amber-500' },
  shift_added:              { label: 'Shift ajouté',        icon: <CheckCircle className="w-3 h-3" />,  color: 'text-[hsl(var(--timer-safe))]' },
  shift_deleted:            { label: 'Shift supprimé',      icon: <XCircle className="w-3 h-3" />,      color: 'text-destructive' },
  incident_created:         { label: 'Incident signalé',   icon: <XCircle className="w-3 h-3" />,      color: 'text-destructive' },
  incident_resolved:        { label: 'Incident résolu',    icon: <CheckCircle className="w-3 h-3" />,  color: 'text-[hsl(var(--timer-safe))]' },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const ALL_ACTIONS = Object.keys(ACTION_LABELS);

export function AuditTrailView() {
  const { users } = useApp();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (filterAction !== 'all') query = query.eq('action', filterAction);
    if (filterUser !== 'all') query = query.eq('user_id', filterUser);

    const { data } = await query;
    setLogs((data ?? []).map(r => ({
      id: r.id,
      created_at: r.created_at,
      user_id: r.user_id,
      user_name: r.user_name,
      action: r.action,
      target_type: r.target_type,
      target_id: r.target_id,
      details: r.details as Record<string, unknown> | null,
    })));
    setLoading(false);
  }, [filterAction, filterUser]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Journal d'audit
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">50 dernières actions · traçabilité complète</p>
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
        >
          <Filter className="w-3.5 h-3.5" />
          Filtres
          <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="glass-card rounded-xl p-4 space-y-3 animate-slide-up">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Type d'action</label>
            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              className="w-full text-xs border border-border rounded-lg px-2 py-2 bg-background text-foreground"
            >
              <option value="all">Toutes les actions</option>
              {ALL_ACTIONS.map(a => (
                <option key={a} value={a}>{ACTION_LABELS[a]?.label ?? a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Utilisateur</label>
            <select
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              className="w-full text-xs border border-border rounded-lg px-2 py-2 bg-background text-foreground"
            >
              <option value="all">Tous les utilisateurs</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Log list */}
      {loading ? (
        <p className="text-xs text-muted-foreground text-center py-6">Chargement…</p>
      ) : logs.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Clock className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm">Aucune action enregistrée</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {logs.map(log => {
            const meta = ACTION_LABELS[log.action] ?? { label: log.action, icon: <CheckCircle className="w-3 h-3" />, color: 'text-muted-foreground' };
            return (
              <div key={log.id} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-card border border-border">
                <div className={`mt-0.5 flex-shrink-0 ${meta.color}`}>{meta.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-foreground">{log.user_name}</span>
                    <span className={`text-xs ${meta.color}`}>{meta.label}</span>
                    {log.target_type && (
                      <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{log.target_type}</span>
                    )}
                  </div>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                      {Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{fmt(log.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
