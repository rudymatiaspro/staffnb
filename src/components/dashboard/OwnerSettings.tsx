import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Zone } from '../../types';
import { ZONE_CSS, ZONE_EMOJI, ZONE_LABELS, INITIAL_GAMIFICATION } from '../../data/initialData';
import { Users, Settings2, Repeat, Trophy, Plus, Trash2, RotateCcw } from 'lucide-react';

type Tab = 'staff' | 'templates' | 'gamification';

const ZONES: Zone[] = ['BAR', 'CUISINE', 'ATELIER', 'MANAGEMENT'];

export function OwnerSettings() {
  const {
    users, resetPin, removeUser, addUser,
    templates, deleteTemplate, createTemplate,
    gamificationSettings, updateGamificationSettings,
  } = useApp();

  const [activeTab, setActiveTab] = useState<Tab>('staff');
  const [newUserName, setNewUserName] = useState('');
  const [newUserZone, setNewUserZone] = useState<Zone>('BAR');
  const [gamifSettings, setGamifSettings] = useState(gamificationSettings);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTplName, setNewTplName] = useState('');
  const [newTplZone, setNewTplZone] = useState<Zone>('BAR');
  const [newTplTime, setNewTplTime] = useState('09:00');
  const [newTplFreq, setNewTplFreq] = useState<'daily' | 'weekly'>('daily');

  const tabs = [
    { id: 'staff' as Tab, label: 'Personnel', icon: <Users className="w-4 h-4" /> },
    { id: 'templates' as Tab, label: 'Tâches récurrentes', icon: <Repeat className="w-4 h-4" /> },
    { id: 'gamification' as Tab, label: 'Gamification', icon: <Trophy className="w-4 h-4" /> },
  ];

  const handleAddUser = () => {
    if (!newUserName.trim()) return;
    addUser({ name: newUserName.trim(), role: 'staff', zone: newUserZone, pinSet: false, pin: '' });
    setNewUserName('');
    setShowAddUser(false);
  };

  const handleAddTemplate = () => {
    if (!newTplName.trim()) return;
    createTemplate({
      name: newTplName.trim(),
      zone: newTplZone,
      frequency: newTplFreq,
      time: newTplTime,
      days: newTplFreq === 'weekly' ? [1] : undefined,
    });
    setNewTplName('');
    setShowAddTemplate(false);
  };

  const handleSaveGamification = () => {
    updateGamificationSettings(gamifSettings);
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
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Staff tab */}
      {activeTab === 'staff' && (
        <div className="space-y-3">
          {ZONES.map((zone) => {
            const zoneUsers = users.filter((u) => u.zone === zone);
            if (zoneUsers.length === 0) return null;
            return (
              <div key={zone} className={`rounded-xl p-4 zone-card ${ZONE_CSS[zone]} space-y-2`}>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <span>{ZONE_EMOJI[zone]}</span> {zone}
                </h3>
                {zoneUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between gap-2 py-1">
                    <div>
                      <p className="text-sm font-medium text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.role} · PIN: {user.pinSet ? '••••' : 'Non défini'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => resetPin(user.id)}
                        className="text-xs px-2 py-1 rounded-md bg-secondary hover:bg-muted transition-colors flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        title="Réinitialiser le PIN"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset PIN
                      </button>
                      {user.role === 'staff' && (
                        <button
                          onClick={() => removeUser(user.id)}
                          className="text-xs px-2 py-1 rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
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
              <input
                type="text"
                placeholder="Nom du membre"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              />
              <select
                value={newUserZone}
                onChange={(e) => setNewUserZone(e.target.value as Zone)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              >
                {ZONES.map((z) => <option key={z} value={z}>{ZONE_LABELS[z]}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={() => setShowAddUser(false)} className="flex-1 py-2 rounded-lg bg-secondary text-sm">Annuler</button>
                <button onClick={handleAddUser} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Ajouter</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Templates tab */}
      {activeTab === 'templates' && (
        <div className="space-y-3">
          {templates.map((tpl) => (
            <div key={tpl.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl zone-card ${ZONE_CSS[tpl.zone]}`}>
              <div>
                <p className="text-sm font-semibold text-foreground">{tpl.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ZONE_EMOJI[tpl.zone]} {tpl.zone} · {tpl.frequency === 'daily' ? 'Quotidien' : 'Hebdo'} · {tpl.time}
                </p>
              </div>
              <button
                onClick={() => deleteTemplate(tpl.id)}
                className="text-xs p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
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
            Ajouter un modèle
          </button>

          {showAddTemplate && (
            <div className="glass-card rounded-xl p-4 space-y-3 animate-slide-up">
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
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                >
                  {(['BAR', 'CUISINE', 'ATELIER', 'ALL'] as Zone[]).map((z) => (
                    <option key={z} value={z}>{ZONE_LABELS[z]}</option>
                  ))}
                </select>
                <input
                  type="time"
                  value={newTplTime}
                  onChange={(e) => setNewTplTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <select
                value={newTplFreq}
                onChange={(e) => setNewTplFreq(e.target.value as 'daily' | 'weekly')}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              >
                <option value="daily">Quotidien</option>
                <option value="weekly">Hebdomadaire (lundi)</option>
              </select>
              <div className="flex gap-2">
                <button onClick={() => setShowAddTemplate(false)} className="flex-1 py-2 rounded-lg bg-secondary text-sm">Annuler</button>
                <button onClick={handleAddTemplate} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Créer</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Gamification tab */}
      {activeTab === 'gamification' && (
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Bonus de base (points/jour)
              </label>
              <input
                type="number"
                value={gamifSettings.dailyBonusBase}
                onChange={(e) => setGamifSettings({ ...gamifSettings, dailyBonusBase: +e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Malus par tâche en retard (points)
              </label>
              <input
                type="number"
                value={gamifSettings.malusPerLateTask}
                onChange={(e) => setGamifSettings({ ...gamifSettings, malusPerLateTask: +e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Heure de remise à zéro des bonus
              </label>
              <input
                type="time"
                value={gamifSettings.bonusResetTime}
                onChange={(e) => setGamifSettings({ ...gamifSettings, bonusResetTime: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={handleSaveGamification}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Sauvegarder
            </button>
          </div>

          <div className="glass-card rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Paramètres actuels</h3>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Bonus de base : <span className="text-foreground font-medium">{gamificationSettings.dailyBonusBase} pts</span></p>
              <p>Malus par retard : <span className="text-destructive font-medium">-{gamificationSettings.malusPerLateTask} pts</span></p>
              <p>Remise à zéro : <span className="text-foreground font-medium">{gamificationSettings.bonusResetTime}</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
