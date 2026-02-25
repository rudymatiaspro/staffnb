import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Shield, Save, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MODULES = [
  { key: 'tasks', label: 'Tâches', emoji: '📋' },
  { key: 'stock', label: 'Stock', emoji: '📦' },
  { key: 'cakes', label: 'Cakes', emoji: '🧁' },
  { key: 'menu', label: 'Menu', emoji: '🍽️' },
  { key: 'haccp', label: 'HACCP', emoji: '🌡️' },
  { key: 'incidents', label: 'Incidents', emoji: '⚠️' },
  { key: 'orders', label: 'Commandes', emoji: '📦' },
  { key: 'planning', label: 'Planning', emoji: '📅' },
  { key: 'chat', label: 'Chat', emoji: '💬' },
  { key: 'pointage', label: 'Pointage', emoji: '⏱️' },
  { key: 'scores', label: 'Scores', emoji: '🏆' },
  { key: 'objectives', label: 'Objectifs', emoji: '🎯' },
  { key: 'reports', label: 'Rapports', emoji: '📈' },
  { key: 'members', label: 'Membres', emoji: '👥' },
] as const;

const ROLES = [
  { key: 'god', label: 'Divinité', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  { key: 'admin', label: 'Admin', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  { key: 'owner', label: 'Propriétaire', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  { key: 'station', label: 'Station', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300' },
  { key: 'manager', label: 'Manager', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  { key: 'chef', label: 'Chef', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  { key: 'staff', label: 'Équipier', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300' },
  { key: 'sous_chef', label: 'Sous-Chef', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
] as const;

const ACTIONS = [
  { key: 'can_read', label: 'Lire', shortLabel: 'L' },
  { key: 'can_create', label: 'Créer', shortLabel: 'C' },
  { key: 'can_update', label: 'Modifier', shortLabel: 'M' },
  { key: 'can_delete', label: 'Supprimer', shortLabel: 'S' },
  { key: 'can_reset', label: 'Reset', shortLabel: 'R' },
] as const;

type ActionKey = typeof ACTIONS[number]['key'];

interface Permission {
  id: string;
  role: string;
  module: string;
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_reset: boolean;
}

interface BackOfficePermissionsProps {
  isGodOrAdmin: boolean;
}

export function BackOfficePermissions({ isGodOrAdmin }: BackOfficePermissionsProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('all');

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('role_permissions')
      .select('*')
      .order('role')
      .order('module');
    if (data) setPermissions(data as Permission[]);
    setLoading(false);
    setDirty(false);
  }, []);

  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

  const togglePermission = (id: string, action: ActionKey) => {
    // Don't allow editing god/admin if not god/admin
    const perm = permissions.find(p => p.id === id);
    if (!perm) return;
    if ((perm.role === 'god' || perm.role === 'admin') && !isGodOrAdmin) return;

    setPermissions(prev => prev.map(p =>
      p.id === id ? { ...p, [action]: !p[action] } : p
    ));
    setDirty(true);
    setSaved(false);
  };

  const saveAll = async () => {
    setSaving(true);
    const promises = permissions.map(p =>
      supabase.from('role_permissions').update({
        can_read: p.can_read,
        can_create: p.can_create,
        can_update: p.can_update,
        can_delete: p.can_delete,
        can_reset: p.can_reset,
      }).eq('id', p.id)
    );
    await Promise.all(promises);
    setSaving(false);
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const getPermission = (role: string, module: string) =>
    permissions.find(p => p.role === role && p.module === module);

  const filteredRoles = selectedRole === 'all' ? ROLES : ROLES.filter(r => r.key === selectedRole);
  const isProtectedRole = (role: string) => (role === 'god' || role === 'admin') && !isGodOrAdmin;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Matrice des Permissions</h2>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <CheckCircle className="w-3.5 h-3.5" /> Sauvegardé
            </span>
          )}
          <Button
            size="sm"
            onClick={saveAll}
            disabled={!dirty || saving}
            className="gap-1.5"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>

      {/* Role filter */}
      <div className="flex flex-wrap gap-1.5">
        <Badge
          variant={selectedRole === 'all' ? 'default' : 'outline'}
          className="cursor-pointer text-xs"
          onClick={() => setSelectedRole('all')}
        >
          Tous les rôles
        </Badge>
        {ROLES.map(r => (
          <Badge
            key={r.key}
            variant={selectedRole === r.key ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => setSelectedRole(r.key)}
          >
            {r.label}
          </Badge>
        ))}
      </div>

      {/* Compact matrix — scrollable on mobile */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left py-2 px-3 font-semibold text-muted-foreground sticky left-0 bg-muted/50 z-10 min-w-[120px]">
                Module
              </th>
              {filteredRoles.map(role => (
                <th key={role.key} colSpan={5} className="text-center py-2 px-1 font-semibold border-l border-border">
                  <Badge variant="secondary" className={`text-[10px] ${role.color}`}>
                    {role.label}
                  </Badge>
                </th>
              ))}
            </tr>
            <tr className="bg-muted/30">
              <th className="sticky left-0 bg-muted/30 z-10" />
              {filteredRoles.map(role => (
                ACTIONS.map(action => (
                  <th key={`${role.key}-${action.key}`} className="text-center py-1 px-0.5 text-[10px] text-muted-foreground font-medium border-l border-border first:border-l-0" style={{ minWidth: 32 }}>
                    {action.shortLabel}
                  </th>
                ))
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((mod, idx) => (
              <tr key={mod.key} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                <td className="py-2 px-3 font-medium text-foreground sticky left-0 z-10" style={{ background: 'inherit' }}>
                  <span className="mr-1.5">{mod.emoji}</span>{mod.label}
                </td>
                {filteredRoles.map(role => {
                  const perm = getPermission(role.key, mod.key);
                  const locked = isProtectedRole(role.key);
                  return ACTIONS.map(action => (
                    <td key={`${role.key}-${mod.key}-${action.key}`} className="text-center py-1 px-0.5 border-l border-border">
                      {perm ? (
                        <div className="flex justify-center">
                          <Switch
                            checked={perm[action.key]}
                            onCheckedChange={() => togglePermission(perm.id, action.key)}
                            disabled={locked}
                            className="scale-[0.6] data-[state=checked]:bg-primary"
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ));
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground pt-1">
        {ACTIONS.map(a => (
          <span key={a.key}><strong>{a.shortLabel}</strong> = {a.label}</span>
        ))}
      </div>

      {!isGodOrAdmin && (
        <p className="text-xs text-muted-foreground italic">
          ⚠️ Les permissions des rôles Divinité et Administrateur ne sont modifiables que par un compte God ou Admin.
        </p>
      )}
    </div>
  );
}
