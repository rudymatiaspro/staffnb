import { useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useApp } from '../../context/AppContext';
import { Team, User } from '../../types';
import { TEAM_CSS, TEAM_LABELS } from '../../data/initialData';
import { Users, Repeat, Trophy, Plus, Trash2, RotateCcw, Edit2, Check, X, ChevronDown, ChevronUp, Save, Wine, ChefHat, Layers, Settings, PersonStanding, KeyRound, Delete, ShieldCheck, Download, ClipboardList } from 'lucide-react';
import { AuditTrailView } from './AuditTrailView';

type Tab = 'staff' | 'templates' | 'gamification' | 'pins' | 'audit';
const TEAMS: Team[] = ['BAR', 'KITCHEN', 'FLOOR', 'ATELIER', 'MANAGEMENT'];

const TEAM_ICON_ELS: Record<string, React.ReactNode> = {
  BAR: <Wine className="w-4 h-4" />,
  KITCHEN: <ChefHat className="w-4 h-4" />,
  FLOOR: <PersonStanding className="w-4 h-4" />,
  ATELIER: <Layers className="w-4 h-4" />,
  MANAGEMENT: <Settings className="w-4 h-4" />,
};

export function OwnerSettings({ readOnly = false }: { readOnly?: boolean }) {
  const {
    users, resetPin, removeUser, addUser, updateUser,
    templates, deleteTemplate, createTemplate,
    gamificationSettings, updateGamificationSettings,
    setStationPin, resetStationPin,
  } = useApp();

  const [activeTab, setActiveTab] = useState<Tab>('staff');
  const [gamifSettings, setGamifSettings] = useState(gamificationSettings);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserTeams, setNewUserTeams] = useState<Team[]>(['BAR']);
  const [newUserRole, setNewUserRole] = useState<'staff' | 'manager'>('staff');
  const [newTplName, setNewTplName] = useState('');
  const [newTplTeam, setNewTplTeam] = useState<Team>('BAR');
  const [newTplTime, setNewTplTime] = useState('09:00');
  const [newTplFreq, setNewTplFreq] = useState<'daily' | 'weekly'>('daily');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [expandedTeams, setExpandedTeams] = useState<Set<Team>>(new Set(TEAMS));
  // Station PIN state
  const [pinModalUser, setPinModalUser] = useState<User | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirmInput, setPinConfirmInput] = useState('');
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter');
  const [pinError, setPinError] = useState('');
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);

  const handleSeedStaff = async () => {
    setSeedLoading(true);
    setSeedResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setSeedResult('❌ Non authentifié'); return; }
      const res = await supabase.functions.invoke('seed-staff', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.error) {
        setSeedResult(`❌ Erreur: ${res.error.message}`);
      } else {
        const s = res.data?.summary;
        setSeedResult(`✅ ${s?.created ?? 0} créés, ${s?.skipped ?? 0} existants, ${s?.errors ?? 0} erreurs`);
      }
    } catch (e) {
      setSeedResult(`❌ Exception: ${String(e)}`);
    } finally {
      setSeedLoading(false);
    }
  };

  const toggleNewUserTeam = (t: Team) => {
    setNewUserTeams(prev =>

      prev.includes(t) ? (prev.length > 1 ? prev.filter(x => x !== t) : prev) : [...prev, t]
    );
  };

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
    { id: 'pins' as Tab, label: 'Station PINs', icon: <KeyRound className="w-4 h-4" /> },
    { id: 'audit' as Tab, label: 'Audit', icon: <ClipboardList className="w-4 h-4" /> },
  ];

  const handleAddUser = () => {
    if (!newUserName.trim()) return;
    const primaryTeam = newUserTeams[0] ?? 'BAR';
    addUser({ name: newUserName.trim(), role: newUserRole, team: primaryTeam, teams: newUserTeams, pinSet: false, pin: '' });
    setNewUserName(''); setNewUserTeams(['BAR']); setShowAddUser(false);
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

  // Station PIN helpers
  const openPinModal = (user: User) => {
    setPinModalUser(user);
    setPinInput('');
    setPinConfirmInput('');
    setPinStep('enter');
    setPinError('');
  };

  const closePinModal = () => {
    setPinModalUser(null);
    setPinInput('');
    setPinConfirmInput('');
    setPinStep('enter');
    setPinError('');
  };

  const handlePinKey = (key: string, isConfirm: boolean) => {
    const current = isConfirm ? pinConfirmInput : pinInput;
    const setter = isConfirm ? setPinConfirmInput : setPinInput;
    if (key === 'del') { setter(current.slice(0, -1)); setPinError(''); return; }
    if (key === 'clear') { setter(''); setPinError(''); return; }
    if (current.length >= 6) return;
    setter(current + key);
  };

  const handlePinSubmit = () => {
    if (pinStep === 'enter') {
      if (pinInput.length !== 6) { setPinError('Le PIN station doit être exactement 6 chiffres'); return; }
      setPinStep('confirm');
      setPinError('');
    } else {
      if (pinConfirmInput !== pinInput) {
        setPinError('PINs do not match — try again');
        setPinConfirmInput('');
        return;
      }
      if (pinModalUser) {
        // Validate no duplicate station PINs
        const duplicate = users.find((u) => u.id !== pinModalUser.id && u.stationPin === pinInput && u.stationPinSet);
        if (duplicate) {
          setPinError(`PIN already used by ${duplicate.name}`);
          setPinInput('');
          setPinConfirmInput('');
          setPinStep('enter');
          return;
        }
        setStationPin(pinModalUser.id, pinInput);
        closePinModal();
      }
    }
  };

  const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'] as const;

  return (
    <div className="space-y-4">
      {readOnly && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          <span>Mode lecture seule — Owner peut consulter mais pas modifier</span>
        </div>
      )}
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
            // Show users whose primary team OR any of their teams includes this team
            const teamUsers = users.filter((u) => {
              const userTeams = u.teams && u.teams.length > 0 ? u.teams : [u.team];
              return userTeams.includes(team);
            });
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
                               <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                 <span className="text-xs text-muted-foreground">
                                   {user.role === 'owner' ? 'Owner' : user.role === 'manager' ? 'Manager' : 'Staff'} · PIN: {user.pinSet ? '••••' : <span className="text-amber-400">Not set</span>}
                                 </span>
                               </div>
                               {/* Secondary teams badges */}
                               {user.teams && user.teams.length > 1 && (
                                 <div className="flex flex-wrap gap-1 mt-1">
                                   {user.teams.map(t => (
                                     <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium team-badge ${TEAM_CSS[t]}`}>
                                       {TEAM_LABELS[t]}
                                     </span>
                                   ))}
                                 </div>
                               )}
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

          {/* Seed Staff button (admin only) */}
          <div className="pt-1 pb-1 flex flex-col gap-2">
            <button
              onClick={handleSeedStaff}
              disabled={seedLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-all text-sm font-medium disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {seedLoading ? 'Création en cours…' : 'Seed — Créer les 11 comptes staff'}
            </button>
            {seedResult && (
              <p className="text-xs text-center text-muted-foreground">{seedResult}</p>
            )}
          </div>

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
              {/* Role selector */}
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as 'staff' | 'manager')}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary"
              >
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
              </select>
              {/* Multi-team selection */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Teams <span className="text-primary">(select one or more)</span></p>
                <div className="grid grid-cols-2 gap-2">
                  {TEAMS.map((t) => {
                    const selected = newUserTeams.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleNewUserTeam(t)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                          selected
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-secondary text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 ${selected ? 'bg-primary border-primary' : 'border-border'}`}>
                          {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        </span>
                        {TEAM_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
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

      {/* ======= STATION PINs TAB ======= */}
      {activeTab === 'pins' && (
        <div className="space-y-4">
          {/* Explanation banner */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/15">
            <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Station PINs — Clock In/Out</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Each staff member needs a unique 4-digit station PIN to clock in and out at <strong>/station</strong>.
                This is separate from their app login PIN.
              </p>
            </div>
          </div>

          {/* Staff list by team */}
          {TEAMS.filter((t) => t !== 'MANAGEMENT').map((team) => {
            const teamUsers = users.filter((u) => u.team === team && u.role !== 'owner');
            if (teamUsers.length === 0) return null;
            return (
              <div key={team} className={`rounded-xl team-card ${TEAM_CSS[team]}`}>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
                  <span className="text-muted-foreground">{TEAM_ICON_ELS[team]}</span>
                  <span className="font-bold text-sm text-foreground">{TEAM_LABELS[team]}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {teamUsers.filter((u) => u.stationPinSet).length}/{teamUsers.length} PINs set
                  </span>
                </div>
                <div className="px-4 py-2 space-y-0.5">
                  {teamUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-3 py-2.5 border-b border-border/20 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <KeyRound className="w-3 h-3" />
                          {user.stationPinSet
                            ? <span className="text-timer-safe font-medium">PIN set ••••</span>
                            : <span className="text-amber-500 font-medium">No PIN — cannot clock in</span>}
                        </p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => openPinModal(user)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors font-medium"
                        >
                          <KeyRound className="w-3 h-3" />
                          {user.stationPinSet ? 'Change PIN' : 'Set PIN'}
                        </button>
                        {user.stationPinSet && (
                          <button
                            onClick={() => resetStationPin(user.id)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Clear station PIN"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Link to station */}
          <a
            href="/station"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary transition-all text-sm w-full"
          >
            <ShieldCheck className="w-4 h-4" />
            Open Clock In/Out Station ↗
          </a>
        </div>
      )}

      {/* ======= AUDIT TAB ======= */}
      {activeTab === 'audit' && (
        <AuditTrailView />
      )}

      {/* ======= STATION PIN MODAL ======= */}
      {pinModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-6 w-full max-w-xs shadow-2xl animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
                  {pinStep === 'enter' ? 'New Station PIN' : 'Confirm PIN'}
                </p>
                <p className="text-base font-bold text-foreground">{pinModalUser.name}</p>
              </div>
              <button onClick={closePinModal} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex gap-1 mb-4">
              <div className={`flex-1 h-1 rounded-full transition-all ${pinStep === 'enter' ? 'bg-primary' : 'bg-primary'}`} />
              <div className={`flex-1 h-1 rounded-full transition-all ${pinStep === 'confirm' ? 'bg-primary' : 'bg-secondary'}`} />
            </div>

            <p className="text-xs text-muted-foreground mb-4 text-center">
              {pinStep === 'enter' ? 'Saisissez un PIN station à 6 chiffres' : 'Ressaisissez le même PIN pour confirmer'}
            </p>

            {/* PIN dots */}
            <div className="flex justify-center gap-2.5 mb-4">
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const val = pinStep === 'enter' ? pinInput : pinConfirmInput;
                return (
                  <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                      i < val.length ? 'bg-primary scale-110' : 'bg-secondary border-2 border-border'
                    }`}
                  />
                );
              })}
            </div>

            {/* Error */}
            {pinError && (
              <p className="text-xs text-destructive font-medium text-center mb-3 animate-wiggle">{pinError}</p>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {PIN_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => handlePinKey(key, pinStep === 'confirm')}
                  className="pin-btn h-12 text-base"
                >
                  {key === 'del' ? <Delete className="w-4 h-4 mx-auto" /> : key === 'clear' ? 'CLR' : key}
                </button>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={pinStep === 'enter' ? closePinModal : () => { setPinStep('enter'); setPinConfirmInput(''); setPinError(''); }}
                className="flex-1 py-2.5 rounded-xl border border-input text-sm font-medium hover:bg-secondary transition-colors"
              >
                {pinStep === 'enter' ? 'Annuler' : 'Retour'}
              </button>
              <button
                onClick={handlePinSubmit}
                disabled={pinStep === 'enter' ? pinInput.length !== 6 : pinConfirmInput.length !== 6}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {pinStep === 'enter' ? 'Suivant →' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
