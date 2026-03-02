import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../integrations/supabase/client';
import {
  Camera, User, Phone, Calendar, Shield, Check, Loader2, X, Globe,
  Clock, ListTodo, AlertTriangle, ChevronRight, Users, Star,
  LogIn, LogOut, CheckCircle, XCircle, Timer, Pencil,
} from 'lucide-react';
import { hashPin, verifyPin, isLegacyHash } from '../lib/pinCrypto';
import { switchLanguage, LANG_META, type SupportedLang } from '../i18n/index';
import { TEAM_CSS, TEAM_LABELS } from '../data/initialData';
import type { Team } from '../types';

const ROLE_LABELS: Record<string, string> = {
  god: 'Administrateur',
  owner: 'Propriétaire',
  manager: 'Manager',
  chef: 'Chef',
  staff: 'Staff',
  admin: 'Administrateur',
};

const ALL_TEAMS: Team[] = ['BAR', 'KITCHEN', 'FLOOR', 'ATELIER', 'MANAGEMENT'];

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(d: string | Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(minutes: number | null | undefined) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

type Tab = 'infos' | 'teams' | 'history';

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function TabButton({ id, active, icon: Icon, label, onClick }: { id: Tab; active: boolean; icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-semibold transition-all border-b-2 ${
        active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

// ─── Tab: Personal Info ───────────────────────────────────────────────────────
function InfoTab({ currentUser, updateUser }: { currentUser: any; updateUser: any }) {
  const [phone, setPhone] = useState(currentUser?.phone ?? '');
  const [birthDate, setBirthDate] = useState(currentUser?.birth_date ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.photo ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  // Language
  const [currentLang, setCurrentLang] = useState<SupportedLang>(
    (localStorage.getItem('i18n_lang') as SupportedLang) ?? 'fr'
  );
  const [langSaving, setLangSaving] = useState(false);

  // PIN change
  const [showPinChange, setShowPinChange] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStep, setPinStep] = useState<'old' | 'new' | 'confirm'>('old');
  const [pinError, setPinError] = useState('');
  const [pinSaved, setPinSaved] = useState(false);
  const [pinSaving, setPinSaving] = useState(false);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${currentUser.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(publicUrl);
      await supabase.from('profiles').update({ photo_url: publicUrl }).eq('id', currentUser.id);
      if (updateUser) updateUser({ ...currentUser, photo: publicUrl });
    }
    setAvatarUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('profiles').update({ phone, birth_date: birthDate || null }).eq('id', currentUser.id);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSwitchLang = async (lang: SupportedLang) => {
    setLangSaving(true);
    await switchLanguage(lang);
    setCurrentLang(lang);
    if (currentUser?.id) await supabase.from('profiles').update({ language_preference: lang }).eq('id', currentUser.id);
    setLangSaving(false);
  };

  const handlePinDigit = (d: string, setter: (fn: (prev: string) => string) => void) => {
    setter((prev) => prev.length < 6 ? prev + d : prev);
  };

  const handlePinValidate = async () => {
    if (pinStep === 'old') {
      const storedHash = currentUser.pin ?? '';
      let valid = false;
      if (!storedHash) valid = oldPin === '154154';
      else if (storedHash.includes(':')) valid = (await verifyPin(storedHash, oldPin)) === 'match';
      else if (isLegacyHash(storedHash)) valid = storedHash === btoa(oldPin);
      else valid = storedHash === oldPin;
      if (!valid) { setPinError('PIN actuel incorrect.'); setOldPin(''); return; }
      setPinError(''); setPinStep('new');
    } else if (pinStep === 'new') {
      if (newPin.length !== 6) return;
      setPinStep('confirm');
    } else {
      if (confirmPin !== newPin) { setPinError('Les PINs ne correspondent pas.'); setConfirmPin(''); return; }
      setPinSaving(true);
      const hash = await hashPin(newPin);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      await supabase.functions.invoke('update-pin', {
        body: { profileId: currentUser.id, pinHash: hash, pinSet: true },
      });
      setPinSaving(false); setPinSaved(true);
      setTimeout(() => { setShowPinChange(false); setPinStep('old'); setOldPin(''); setNewPin(''); setConfirmPin(''); setPinSaved(false); }, 2000);
    }
  };

  const activePinValue = pinStep === 'old' ? oldPin : pinStep === 'new' ? newPin : confirmPin;
  const activePinSetter = pinStep === 'old' ? setOldPin : pinStep === 'new' ? setNewPin : setConfirmPin;
  const pinStepLabel = pinStep === 'old' ? 'Saisir votre PIN actuel' : pinStep === 'new' ? 'Choisir un nouveau PIN' : 'Confirmer le nouveau PIN';

  return (
    <div className="space-y-4">
      {/* Avatar */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="relative">
          {avatarUrl ? (
            <img src={avatarUrl} alt={currentUser.name} className="w-20 h-20 rounded-full object-cover border-2 border-border" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-black text-primary-foreground border-2 border-border">
              {getInitials(currentUser.name)}
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={avatarUploading}
            className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg border-2 border-card"
          >
            {avatarUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-foreground">{currentUser.name}</p>
          <p className="text-xs text-muted-foreground">{ROLE_LABELS[currentUser.role] ?? currentUser.role}</p>
          {currentUser.score !== undefined && (
            <div className="flex items-center justify-center gap-1 mt-1">
              <Star className="w-3 h-3 text-primary fill-primary" />
              <span className="text-xs font-bold text-foreground">{currentUser.score} pts</span>
            </div>
          )}
        </div>
      </div>

      {/* Personal info */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wide">Informations personnelles</span>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Prénom &amp; Nom</label>
            <div className="px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground font-medium">{currentUser.name}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Rôle</label>
            <div className="px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground font-medium">{ROLE_LABELS[currentUser.role] ?? currentUser.role}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <Phone className="w-3 h-3" /> Téléphone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06 12 34 56 78"
              className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Date de naissance
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
            {saved ? 'Sauvegardé !' : saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Security */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wide">Sécurité</span>
        </div>
        <div className="p-4">
          {!showPinChange ? (
            <button
              onClick={() => setShowPinChange(true)}
              className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors flex items-center justify-center gap-2"
            >
              <Shield className="w-3.5 h-3.5" /> Changer mon PIN
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{pinStepLabel}</p>
                <button onClick={() => { setShowPinChange(false); setPinStep('old'); setOldPin(''); setNewPin(''); setConfirmPin(''); setPinError(''); }} className="p-1 rounded-lg hover:bg-secondary">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
              {pinSaved ? (
                <div className="text-center py-4">
                  <Check className="w-10 h-10 text-primary mx-auto mb-2" />
                  <p className="text-sm font-bold text-foreground">PIN mis à jour !</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-center gap-4">
                    {[0,1,2,3].map((i) => (
                      <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${activePinValue.length > i ? 'bg-primary border-primary' : 'border-border'}`} />
                    ))}
                  </div>
                  {pinError && <p className="text-xs text-destructive text-center">{pinError}</p>}
                  <div className="grid grid-cols-3 gap-2">
                    {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
                      <button
                        key={i}
                        onClick={() => d === '⌫' ? activePinSetter((p) => p.slice(0,-1)) : d ? handlePinDigit(d, activePinSetter) : undefined}
                        className={`h-12 rounded-xl text-base font-semibold transition-all active:scale-95 ${d === '' ? 'invisible' : 'bg-secondary text-foreground hover:bg-muted'}`}
                      >{d}</button>
                    ))}
                  </div>
                  <button
                    onClick={handlePinValidate}
                    disabled={activePinValue.length !== 4 || pinSaving}
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {pinSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    {pinStep === 'confirm' ? 'Confirmer' : 'Suivant'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Language */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wide">Langue de l'application</span>
          {langSaving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />}
        </div>
        <div className="p-3 grid grid-cols-3 gap-2">
          {(Object.entries(LANG_META) as [SupportedLang, { flag: string; label: string }][]).map(([code, { flag, label }]) => (
            <button
              key={code}
              onClick={() => handleSwitchLang(code)}
              disabled={langSaving}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all border ${
                currentLang === code ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <span className="text-lg">{flag}</span>
              <span className="truncate w-full text-center">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Multi-team assignments ──────────────────────────────────────────────
interface RoomInfo { id: string; name: string; team_key: string; }

function TeamsTab({ currentUser }: { currentUser: any }) {
  const [assignedTeams, setAssignedTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Room name customization
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  useEffect(() => {
    loadTeams();
    loadRooms();
  }, [currentUser.id]);

  const loadTeams = async () => {
    setLoading(true);
    const { data } = await supabase.from('profile_teams').select('team').eq('profile_id', currentUser.id);
    if (data && data.length > 0) {
      setAssignedTeams(data.map((r: any) => r.team as Team));
    } else {
      setAssignedTeams([currentUser.team]);
    }
    setLoading(false);
  };

  const loadRooms = async () => {
    const { data } = await supabase.from('rooms').select('id, name, team_key').order('display_order');
    if (data) setRooms(data);
  };

  const getTeamName = (teamKey: string) => {
    const room = rooms.find(r => r.team_key === teamKey);
    return room?.name || TEAM_LABELS[teamKey] || teamKey;
  };

  const toggleTeam = (team: Team) => {
    setAssignedTeams(prev =>
      prev.includes(team) ? prev.filter(t => t !== team) : [...prev, team]
    );
  };

  const handleSave = async () => {
    if (assignedTeams.length === 0) return;
    setSaving(true);
    await supabase.from('profile_teams').delete().eq('profile_id', currentUser.id);
    await supabase.from('profile_teams').insert(assignedTeams.map(t => ({ profile_id: currentUser.id, team: t })));
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const startEditName = (teamKey: string) => {
    setEditingTeam(teamKey);
    setEditName(getTeamName(teamKey));
  };

  const saveTeamName = async () => {
    if (!editingTeam || !editName.trim()) return;
    setNameSaving(true);
    const room = rooms.find(r => r.team_key === editingTeam);
    if (room) {
      await supabase.from('rooms').update({ name: editName.trim() }).eq('id', room.id);
      setRooms(prev => prev.map(r => r.id === room.id ? { ...r, name: editName.trim() } : r));
    }
    setNameSaving(false);
    setEditingTeam(null);
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wide">Mes équipes</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Sélectionnez les équipes dont vous souhaitez voir les tâches dans votre tableau de bord.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ALL_TEAMS.map(team => {
              const active = assignedTeams.includes(team);
              const isEditing = editingTeam === team;
              return (
                <div key={team} className={`flex items-center rounded-xl border-2 transition-all overflow-hidden ${
                  active ? 'border-primary bg-primary/8' : 'border-border bg-secondary/50'
                }`}>
                  <button
                    onClick={() => toggleTeam(team)}
                    className="flex items-center gap-2.5 px-3 py-3 flex-1 text-left min-w-0"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${active ? 'bg-primary' : 'bg-border'}`} />
                    <p className={`text-xs font-semibold truncate ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {getTeamName(team)}
                    </p>
                    {active && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0 ml-auto" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); startEditName(team); }}
                    className="px-2 py-3 flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    title="Renommer"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {assignedTeams.length === 0 && (
            <p className="text-xs text-destructive text-center py-2">Sélectionnez au moins une équipe.</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving || assignedTeams.length === 0}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
            {saved ? 'Sauvegardé !' : saving ? 'Sauvegarde...' : 'Sauvegarder mes équipes'}
          </button>
        </div>
      </div>

      {/* Primary team info */}
      <div className="bg-secondary/40 rounded-xl px-4 py-3 flex items-start gap-2">
        <div className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0">ℹ️</div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Votre équipe principale (<strong className="text-foreground">{getTeamName(currentUser.team)}</strong>) est définie par votre administrateur.
        </p>
      </div>

      {/* Edit team name modal */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">Renommer l'équipe</h3>
              <button onClick={() => setEditingTeam(null)} className="p-1 rounded-lg hover:bg-secondary">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveTeamName(); if (e.key === 'Escape') setEditingTeam(null); }}
              className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setEditingTeam(null)} className="flex-1 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-secondary">Annuler</button>
              <button
                onClick={saveTeamName}
                disabled={nameSaving || !editName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {nameSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: History ─────────────────────────────────────────────────────────────
type HistorySection = 'shifts' | 'tasks' | 'incidents';

function HistoryTab({ currentUser }: { currentUser: any }) {
  const [section, setSection] = useState<HistorySection>('shifts');
  const [shifts, setShifts] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadAll(); }, [currentUser.id]);

  const loadAll = async () => {
    setLoading(true);
    const [shiftRes, taskRes, incidentRes] = await Promise.all([
      supabase.from('shifts').select('*').eq('user_id', currentUser.id).order('date', { ascending: false }).limit(30),
      supabase.from('tasks').select('*').eq('assigned_user_id', currentUser.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('incidents').select('*').eq('reporter_user_id', currentUser.id).order('created_at', { ascending: false }).limit(20),
    ]);
    setShifts(shiftRes.data ?? []);
    setTasks(taskRes.data ?? []);
    setIncidents(incidentRes.data ?? []);
    setLoading(false);
  };

  const sectionBtns: { id: HistorySection; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'shifts', label: 'Pointages', icon: Clock, count: shifts.length },
    { id: 'tasks', label: 'Tâches', icon: ListTodo, count: tasks.length },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle, count: incidents.length },
  ];

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="flex border-b border-border">
          {sectionBtns.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-all border-b-2 -mb-px ${
                section === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${section === id ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="divide-y divide-border/50 max-h-[420px] overflow-y-auto">
          {/* SHIFTS */}
          {section === 'shifts' && (
            shifts.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun pointage enregistré.</div>
            ) : shifts.map((s: any) => (
              <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${s.clock_out ? 'bg-primary/10' : 'bg-[hsl(var(--timer-safe)/0.15)]'}`}>
                  {s.clock_out ? <LogOut className="w-4 h-4 text-primary" /> : <LogIn className="w-4 h-4 text-[hsl(var(--timer-safe))]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{fmtDate(s.date)}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtTime(s.clock_in)} → {s.clock_out ? fmtTime(s.clock_out) : <span className="text-[hsl(var(--timer-safe))] font-semibold">En cours</span>}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
                    <Timer className="w-3 h-3 text-muted-foreground" />
                    {fmtDuration(s.total_minutes)}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* TASKS */}
          {section === 'tasks' && (
            tasks.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Aucune tâche assignée.</div>
            ) : tasks.map((t: any) => {
              const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
                done:    { color: 'text-[hsl(var(--timer-safe))]', icon: CheckCircle, label: 'Faite' },
                pending: { color: 'text-muted-foreground', icon: Clock, label: 'En attente' },
                overdue: { color: 'text-destructive', icon: XCircle, label: 'En retard' },
                in_progress: { color: 'text-primary', icon: Timer, label: 'En cours' },
              };
              const cfg = statusConfig[t.status] ?? statusConfig.pending;
              const Icon = cfg.icon;
              return (
                <div key={t.id} className="px-4 py-3 flex items-start gap-3">
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(t.created_at)} · {TEAM_LABELS[t.team as Team] ?? t.team}
                      {t.points ? ` · ${t.points} pts` : ''}
                    </p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${cfg.color} bg-current/10`}>
                    {cfg.label}
                  </span>
                </div>
              );
            })
          )}

          {/* INCIDENTS */}
          {section === 'incidents' && (
            incidents.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun incident signalé.</div>
            ) : incidents.map((inc: any) => {
              const sevColors: Record<string, string> = {
                low: 'text-muted-foreground bg-secondary',
                medium: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
                high: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30',
                critical: 'text-destructive bg-destructive/10',
              };
              const statColors: Record<string, string> = {
                open: 'text-destructive',
                in_progress: 'text-primary',
                resolved: 'text-[hsl(var(--timer-safe))]',
              };
              const statLabels: Record<string, string> = { open: 'Ouvert', in_progress: 'En cours', resolved: 'Résolu' };
              return (
                <div key={inc.id} className="px-4 py-3 flex items-start gap-3">
                  <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${sevColors[inc.severity]?.split(' ')[0] ?? 'text-muted-foreground'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{inc.title || inc.type}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(inc.created_at)} · {inc.location}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${sevColors[inc.severity] ?? ''}`}>
                      {inc.severity}
                    </span>
                    <span className={`text-[10px] font-semibold ${statColors[inc.status] ?? ''}`}>
                      {statLabels[inc.status] ?? inc.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Profil Page ─────────────────────────────────────────────────────────
export default function Profil() {
  const { currentUser, updateUser } = useApp();
  const [tab, setTab] = useState<Tab>('infos');

  if (!currentUser) return null;

  return (
    <div className="space-y-0 pb-8">
      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border flex px-4 mb-4">
        <TabButton id="infos" active={tab === 'infos'} icon={User} label="Infos" onClick={() => setTab('infos')} />
        <TabButton id="teams" active={tab === 'teams'} icon={Users} label="Mes équipes" onClick={() => setTab('teams')} />
        <TabButton id="history" active={tab === 'history'} icon={Clock} label="Historique" onClick={() => setTab('history')} />
      </div>

      <div className="px-4">
        {tab === 'infos' && <InfoTab currentUser={currentUser} updateUser={updateUser} />}
        {tab === 'teams' && <TeamsTab currentUser={currentUser} />}
        {tab === 'history' && <HistoryTab currentUser={currentUser} />}
      </div>
    </div>
  );
}
