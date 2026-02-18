import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Zone, User } from '../../types';
import { ZONE_CSS, ZONE_EMOJI, ZONE_LABELS, INITIAL_GAMIFICATION } from '../../data/initialData';
import { Users, Repeat, Trophy, Plus, Trash2, RotateCcw, Edit2, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

type Tab = 'staff' | 'templates' | 'gamification';
const ZONES: Zone[] = ['BAR', 'CUISINE', 'ATELIER', 'MANAGEMENT'];

export function OwnerSettings() {
  const {
    users, resetPin, removeUser, addUser, updateUser,
    templates, deleteTemplate, createTemplate,
    gamificationSettings, updateGamificationSettings,
  } = useApp();

  const [activeTab, setActiveTab] = useState<Tab>('staff');
  const [gamifSettings, setGamifSettings] = useState(gamificationSettings);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserZone, setNewUserZone] = useState<Zone>('BAR');
  const [newUserRole, setNewUserRole] = useState<'staff' | 'manager'>('staff');
  const [newTplName, setNewTplName] = useState('');
  const [newTplZone, setNewTplZone] = useState<Zone>('BAR');
  const [newTplTime, setNewTplTime] = useState('09:00');
  const [newTplFreq, setNewTplFreq] = useState<'daily' | 'weekly'>('daily');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [expandedZones, setExpandedZones] = useState<Set<Zone>>(new Set(ZONES));

  const toggleZone = (z: Zone) => {
    setExpandedZones(prev => {
      const next = new Set(prev);
      if (next.has(z)) next.delete(z); else next.add(z);
      return next;
    });
  };

  const tabs = [
    { id: 'staff' as Tab, label: 'Personnel', icon: <Users className="w-4 h-4" /> },
    { id: 'templates' as Tab, label: 'Tâches récurrentes', icon: <Repeat className="w-4 h-4" /> },
    { id: 'gamification' as Tab, label: 'Gamification', icon: <Trophy className="w-4 h-4" /> },
  ];

  const handleAddUser = () => {
    if (!newUserName.trim()) return;
    addUser({ name: newUserName.trim(), role: newUserRole, zone: newUserZone, pinSet: false, pin: '' });
    setNewUserName(''); setShowAddUser(false);
  };

  const handleAddTemplate = () => {
    if (!newTplName.trim()) return;
    createTemplate({
      name: newTplName.trim(), zone: newTplZone, frequency: newTplFreq, time: newTplTime,
      days: newTplFreq === 'weekly' ? [1] : undefined,
    });
    setNewTplName(''); setShowAddTemplate(false);
  };

  const startEdit = (user: User) => {
    setEditingUser(user.id);
    setEditName(user.name);
  };

  const saveEdit = (user: User) => {
    if (editName.trim()) updateUser({ ...user, name: editName.trim() });
    setEditingUser(null);
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-1 justify-center ${
              activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ======= STAFF TAB ======= */}
      {activeTab === 'staff' && (
        <div className="space-y-3">
          {ZONES.map((zone) => {
            const zoneUsers = users.filter((u) => u.zone === zone);
            if (zoneUsers.length === 0) return null;
            const expanded = expandedZones.has(zone);
            return (
              <div key={zone} className={`rounded-xl zone-card ${ZONE_CSS[zone]}`}>
                <button
                  className="w-full flex items-center gap-3 p-4"
                  onClick={() => toggleZone(zone)}
                >
                  <span className="text-lg">{ZONE_EMOJI[zone]}</span>
                  <span className="font-bold text-sm text-foreground">{zone}</span>
                  <span className="text-xs text-muted-foreground">{zoneUsers.length} membre{zoneUsers.length > 1 ? 's' : ''}</span>
                  <span className="ml-auto">
                    {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </span>
                </button>
                {expanded && (
                  <div className="px-4 pb-4 space-y-2 animate-slide-up">
                    {zoneUsers.map((user) => (
                      <div key={user.id} className="flex items-center gap-2 py-2 border-t border-border/30">
                        {editingUser === user.id ? (
                          <>
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="flex-1 px-2 py-1 rounded-lg bg-secondary border border-primary text-foreground text-sm focus:outline-none"
                              autoFocus
                              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(user); if (e.key === 'Escape') setEditingUser(null); }}
                            />
                            <button onClick={() => saveEdit(user)} className="p-1 rounded text-timer-safe hover:bg-timer-safe/10"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditingUser(null)} className="p-1 rounded text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{user.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {user.role === 'owner' ? '👑 Owner' : user.role === 'manager' ? '🔵 Manager' : '👤 Staff'} ·
                                PIN : {user.pinSet ? '••••' : <span className="text-timer-warning">Non défini</span>}
                              </p>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                              {user.role !== 'owner' && (
                                <button onClick={() => startEdit(user)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground" title="Renommer">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => resetPin(user.id)}
                                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-secondary hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                title="Réinitialiser le PIN"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span className="hidden sm:inline">Reset PIN</span>
                              </button>
                              {user.role === 'staff' && (
                                <button
                                  onClick={() => removeUser(user.id)}
                                  className="p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={() => setShowAddUser(!showAddUser)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            Ajouter un membre
          </button>

          {showAddUser && (
            <div className="glass-card rounded-xl p-4 space-y-3 animate-slide-up">
              <h3 className="text-sm font-semibold text-foreground">Nouveau membre</h3>
              <input
                type="text"
                placeholder="Prénom"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newUserZone}
                  onChange={(e) => setNewUserZone(e.target.value as Zone)}
                  className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                >
                  {ZONES.map((z) => <option key={z} value={z}>{ZONE_LABELS[z]}</option>)}
                </select>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'staff' | 'manager')}
                  className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAddUser(false)} className="flex-1 py-2.5 rounded-lg bg-secondary text-sm text-secondary-foreground">Annuler</button>
                <button onClick={handleAddUser} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Ajouter</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======= TEMPLATES TAB ======= */}
      {activeTab === 'templates' && (
        <div className="space-y-3">
          {templates.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Aucun modèle de tâche</p>
          )}
          {templates.map((tpl) => (
            <div key={tpl.id} className={`flex items-center gap-3 p-4 rounded-xl zone-card ${ZONE_CSS[tpl.zone]}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span>{ZONE_EMOJI[tpl.zone]}</span>
                  <p className="text-sm font-semibold text-foreground truncate">{tpl.name}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tpl.frequency === 'daily' ? '📅 Quotidien' : '📅 Hebdomadaire (lundi)'} · ⏰ {tpl.time}
                </p>
                {tpl.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{tpl.description}</p>
                )}
              </div>
              <button
                onClick={() => deleteTemplate(tpl.id)}
                className="p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <button
            onClick={() => setShowAddTemplate(!showAddTemplate)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            Ajouter un modèle récurrent
          </button>

          {showAddTemplate && (
            <div className="glass-card rounded-xl p-4 space-y-3 animate-slide-up">
              <h3 className="text-sm font-semibold text-foreground">Nouveau modèle</h3>
              <input
                type="text"
                placeholder="Nom de la tâche"
                value={newTplName}
                onChange={(e) => setNewTplName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newTplZone}
                  onChange={(e) => setNewTplZone(e.target.value as Zone)}
                  className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                >
                  {(['BAR', 'CUISINE', 'ATELIER', 'ALL'] as Zone[]).map((z) => (
                    <option key={z} value={z}>{ZONE_LABELS[z]}</option>
                  ))}
                </select>
                <input
                  type="time"
                  value={newTplTime}
                  onChange={(e) => setNewTplTime(e.target.value)}
                  className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <select
                value={newTplFreq}
                onChange={(e) => setNewTplFreq(e.target.value as 'daily' | 'weekly')}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              >
                <option value="daily">Quotidien (tous les jours)</option>
                <option value="weekly">Hebdomadaire (lundi)</option>
              </select>
              <div className="flex gap-2">
                <button onClick={() => setShowAddTemplate(false)} className="flex-1 py-2.5 rounded-lg bg-secondary text-sm text-secondary-foreground">Annuler</button>
                <button onClick={handleAddTemplate} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Créer</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======= GAMIFICATION TAB ======= */}
      {activeTab === 'gamification' && (
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-5 space-y-5">
            <h3 className="text-sm font-semibold text-foreground">Règles de gamification</h3>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                🏆 Bonus de base par jour (points)
              </label>
              <input
                type="number"
                min="0"
                max="1000"
                value={gamifSettings.dailyBonusBase}
                onChange={(e) => setGamifSettings({ ...gamifSettings, dailyBonusBase: Math.max(0, +e.target.value) })}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">Chaque zone commence la journée avec ce score</p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                ⚠ Malus par tâche en retard (points)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={gamifSettings.malusPerLateTask}
                onChange={(e) => setGamifSettings({ ...gamifSettings, malusPerLateTask: Math.max(0, +e.target.value) })}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">Appliqué automatiquement quand une tâche passe en retard</p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                🕐 Heure de remise à zéro
              </label>
              <input
                type="time"
                value={gamifSettings.bonusResetTime}
                onChange={(e) => setGamifSettings({ ...gamifSettings, bonusResetTime: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">Les scores sont remis à zéro chaque jour à cette heure</p>
            </div>

            <button
              onClick={() => updateGamificationSettings(gamifSettings)}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              💾 Sauvegarder les paramètres
            </button>
          </div>

          {/* Current settings recap */}
          <div className="glass-card rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Paramètres actuels</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Bonus de base</span>
                <span className="text-timer-safe font-bold">{gamificationSettings.dailyBonusBase} pts/jour</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Malus par retard</span>
                <span className="text-timer-danger font-bold">-{gamificationSettings.malusPerLateTask} pts</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Remise à zéro</span>
                <span className="text-foreground font-medium">{gamificationSettings.bonusResetTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tâches max avant 0pt</span>
                <span className="text-foreground font-medium">
                  {gamificationSettings.malusPerLateTask > 0
                    ? Math.floor(gamificationSettings.dailyBonusBase / gamificationSettings.malusPerLateTask)
                    : '∞'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
