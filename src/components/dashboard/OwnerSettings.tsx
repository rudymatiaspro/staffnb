import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Team, User } from '../../types';
import { TEAM_CSS, TEAM_LABELS } from '../../data/initialData';
import { Users, Repeat, Trophy, Plus, Trash2, RotateCcw, Edit2, Check, X, ChevronDown, ChevronUp, Save, Wine, ChefHat, Layers, Settings, PersonStanding } from 'lucide-react';

type Tab = 'staff' | 'templates' | 'gamification';
const TEAMS: Team[] = ['BAR', 'KITCHEN', 'FLOOR', 'ATELIER', 'MANAGEMENT'];

const TEAM_ICON_ELS: Record<string, React.ReactNode> = {
  BAR: <Wine className="w-4 h-4" />,
  KITCHEN: <ChefHat className="w-4 h-4" />,
  FLOOR: <PersonStanding className="w-4 h-4" />,
  ATELIER: <Layers className="w-4 h-4" />,
  MANAGEMENT: <Settings className="w-4 h-4" />,
};

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
  const [newUserTeam, setNewUserTeam] = useState<Team>('BAR');
  const [newUserRole, setNewUserRole] = useState<'staff' | 'manager'>('staff');
  const [newTplName, setNewTplName] = useState('');
  const [newTplTeam, setNewTplTeam] = useState<Team>('BAR');
  const [newTplTime, setNewTplTime] = useState('09:00');
  const [newTplFreq, setNewTplFreq] = useState<'daily' | 'weekly'>('daily');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [expandedTeams, setExpandedTeams] = useState<Set<Team>>(new Set(TEAMS));

  const toggleTeam = (t: Team) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  const tabs = [
    { id: 'staff' as Tab, label: 'Staff', icon: <Users className="w-4 h-4" /> },
    { id: 'templates' as Tab, label: 'Templates', icon: <Repeat className="w-4 h-4" /> },
    { id: 'gamification' as Tab, label: 'Scoring', icon: <Trophy className="w-4 h-4" /> },
  ];

  const handleAddUser = () => {
    if (!newUserName.trim()) return;
    addUser({ name: newUserName.trim(), role: newUserRole, team: newUserTeam, pinSet: false, pin: '' });
    setNewUserName(''); setShowAddUser(false);
  };

  const handleAddTemplate = () => {
    if (!newTplName.trim()) return;
    createTemplate({
      name: newTplName.trim(), team: newTplTeam, frequency: newTplFreq, time: newTplTime,
      days: newTplFreq === 'weekly' ? [1] : undefined,
      points: 10,
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
          {TEAMS.map((team) => {
            const teamUsers = users.filter((u) => u.team === team);
            if (teamUsers.length === 0) return null;
            const expanded = expandedTeams.has(team);
            return (
              <div key={team} className={`rounded-xl team-card ${TEAM_CSS[team]}`}>
                <button
                  className="w-full flex items-center gap-3 p-4"
                  onClick={() => toggleTeam(team)}
                >
                  <span className="text-muted-foreground">{TEAM_ICON_ELS[team]}</span>
                  <span className="font-bold text-sm text-foreground">{TEAM_LABELS[team]}</span>
                  <span className="text-xs text-muted-foreground">{teamUsers.length} member{teamUsers.length > 1 ? 's' : ''}</span>
                  <span className="ml-auto">
                    {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </span>
                </button>
                {expanded && (
                  <div className="px-4 pb-4 space-y-2 animate-slide-up">
                    {teamUsers.map((user) => (
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
                                {user.role === 'owner' ? 'Owner' : user.role === 'manager' ? 'Manager' : 'Staff'} ·
                                PIN: {user.pinSet ? '••••' : <span className="text-amber-400">Not set</span>}
                              </p>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                              {user.role !== 'owner' && (
                                <button onClick={() => startEdit(user)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground" title="Rename">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => resetPin(user.id)}
                                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-secondary hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                title="Reset PIN"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span className="hidden sm:inline">Reset PIN</span>
                              </button>
                              {user.role === 'staff' && (
                                <button
                                  onClick={() => removeUser(user.id)}
                                  className="p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                                  title="Remove"
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
            Add team member
          </button>

          {showAddUser && (
            <div className="glass-card rounded-xl p-4 space-y-3 animate-slide-up">
              <h3 className="text-sm font-semibold text-foreground">New Member</h3>
              <input
                type="text"
                placeholder="First name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newUserTeam}
                  onChange={(e) => setNewUserTeam(e.target.value as Team)}
                  className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                >
                  {TEAMS.map((t) => <option key={t} value={t}>{TEAM_LABELS[t]}</option>)}
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
                <button onClick={() => setShowAddUser(false)} className="flex-1 py-2.5 rounded-lg bg-secondary text-sm text-secondary-foreground">Cancel</button>
                <button onClick={handleAddUser} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Add</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======= TEMPLATES TAB ======= */}
      {activeTab === 'templates' && (
        <div className="space-y-3">
          {templates.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No recurring templates</p>
          )}
          {templates.map((tpl) => (
            <div key={tpl.id} className={`flex items-center gap-3 p-4 rounded-xl team-card ${TEAM_CSS[tpl.team]}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-muted-foreground">{TEAM_ICON_ELS[tpl.team]}</span>
                  <p className="text-sm font-semibold text-foreground truncate">{tpl.name}</p>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Repeat className="w-3 h-3" />
                  {tpl.frequency === 'daily' ? 'Daily' : 'Weekly (Monday)'} · {tpl.time}
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
            Add recurring template
          </button>

          {showAddTemplate && (
            <div className="glass-card rounded-xl p-4 space-y-3 animate-slide-up">
              <h3 className="text-sm font-semibold text-foreground">New Template</h3>
              <input
                type="text"
                placeholder="Task name"
                value={newTplName}
                onChange={(e) => setNewTplName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newTplTeam}
                  onChange={(e) => setNewTplTeam(e.target.value as Team)}
                  className="px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                >
                  {(['BAR', 'KITCHEN', 'FLOOR', 'ATELIER', 'ALL'] as Team[]).map((t) => (
                    <option key={t} value={t}>{TEAM_LABELS[t]}</option>
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
                <option value="daily">Daily (every day)</option>
                <option value="weekly">Weekly (Monday)</option>
              </select>
              <div className="flex gap-2">
                <button onClick={() => setShowAddTemplate(false)} className="flex-1 py-2.5 rounded-lg bg-secondary text-sm text-secondary-foreground">Cancel</button>
                <button onClick={handleAddTemplate} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Create</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======= GAMIFICATION TAB ======= */}
      {activeTab === 'gamification' && (
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-5 space-y-5">
            <h3 className="text-sm font-semibold text-foreground">Individual Bonuses</h3>

            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'pointsOnTime', label: 'Task on time', suffix: '+pts' },
                { key: 'pointsEarly', label: 'Task early', suffix: '+pts' },
                { key: 'pointsWithPhoto', label: 'With photo', suffix: '+pts' },
                { key: 'pointsClockIn', label: 'Clock-in on time', suffix: '+pts' },
                { key: 'pointsPerfectDay', label: 'Perfect day', suffix: '+pts' },
              ].map(({ key, label, suffix }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={(gamifSettings as unknown as Record<string, number>)[key]}
                      onChange={(e) => setGamifSettings({ ...gamifSettings, [key]: Math.max(0, +e.target.value) })}
                      className="w-full px-2 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                    />
                    <span className="text-xs text-timer-safe font-medium w-8 flex-shrink-0">{suffix}</span>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-sm font-semibold text-foreground pt-2 border-t border-border">Penalties</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'penaltyOverdue', label: 'Task overdue', suffix: '-pts' },
                { key: 'penaltyLateClock', label: 'Late clock-in', suffix: '-pts' },
                { key: 'penaltyNoClock', label: 'No clock-in', suffix: '-pts' },
                { key: 'malusPerLateTask', label: 'Team penalty/task', suffix: '-pts' },
              ].map(({ key, label, suffix }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={(gamifSettings as unknown as Record<string, number>)[key]}
                      onChange={(e) => setGamifSettings({ ...gamifSettings, [key]: Math.max(0, +e.target.value) })}
                      className="w-full px-2 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                    />
                    <span className="text-xs text-timer-danger font-medium w-8 flex-shrink-0">{suffix}</span>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-sm font-semibold text-foreground pt-2 border-t border-border">General</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Daily base bonus</label>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={gamifSettings.dailyBonusBase}
                  onChange={(e) => setGamifSettings({ ...gamifSettings, dailyBonusBase: Math.max(0, +e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Reset time</label>
                <input
                  type="time"
                  value={gamifSettings.bonusResetTime}
                  onChange={(e) => setGamifSettings({ ...gamifSettings, bonusResetTime: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <button
              onClick={() => updateGamificationSettings(gamifSettings)}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
