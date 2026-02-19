import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../integrations/supabase/client';
import { Incident, IncidentType, IncidentSeverity, IncidentStatus, IncidentLocation, Team } from '../../types';
import { AlertTriangle, Plus, Check, Clock, ShieldCheck, X, Search, Camera } from 'lucide-react';
import { useRef } from 'react';

const INCIDENT_TYPES: IncidentType[] = [
  'Equipment failure', 'Customer complaint', 'Hygiene issue',
  'Accident / Injury', 'Security concern', 'Other',
];

const TYPE_LABELS: Record<IncidentType, string> = {
  'Equipment failure': 'Panne équipement',
  'Customer complaint': 'Plainte client',
  'Hygiene issue': 'Problème hygiène',
  'Accident / Injury': 'Accident / Blessure',
  'Security concern': 'Sécurité',
  'Other': 'Autre',
};

const INCIDENT_LOCATIONS: IncidentLocation[] = ['Bar', 'Kitchen', 'Atelier', 'Floor', 'Other'];

const SEVERITY_CONFIG: Record<string, { label: string; labelFr: string; color: string }> = {
  low:      { label: 'Info',     labelFr: 'Info',     color: 'text-muted-foreground bg-secondary border-border' },
  medium:   { label: 'Moyen',    labelFr: 'Moyen',    color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900' },
  high:     { label: 'Grave',    labelFr: 'Grave',    color: 'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900' },
  critical: { label: 'Critique', labelFr: 'Critique', color: 'text-destructive bg-destructive/10 border-destructive/30' },
};

const STATUS_CONFIG: Record<string, { labelFr: string; icon: React.ReactNode; color: string }> = {
  open:        { labelFr: 'Ouvert',    icon: <AlertTriangle className="w-3 h-3" />, color: 'text-destructive' },
  in_progress: { labelFr: 'En cours', icon: <Clock className="w-3 h-3" />,         color: 'text-amber-500' },
  resolved:    { labelFr: 'Résolu',   icon: <Check className="w-3 h-3" />,          color: 'text-primary' },
};

async function postIncidentToChat(incident: Incident & { title?: string }, reporterName: string, team: Team) {
  const severityEmoji = incident.severity === 'critical' ? '🚨' : incident.severity === 'high' ? '⚠️' : incident.severity === 'medium' ? '⚡' : 'ℹ️';
  const severityLabel = SEVERITY_CONFIG[incident.severity]?.labelFr ?? incident.severity;
  const title = (incident as { title?: string }).title || incident.type;
  const content = `${severityEmoji} [${severityLabel.toUpperCase()}] — ${title}\nSignalé par ${reporterName} · ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} → Voir le ticket #${incident.id.slice(0, 8)}`;

  // Post in #général
  await supabase.from('messages').insert({
    channel: 'general',
    content,
    sender_id: incident.reporterUserId ?? '',
    sender_name: reporterName,
    sender_team: team,
  }).then(() => {});

  // For critical: also post in team channel
  if (incident.severity === 'critical' || incident.severity === 'high') {
    const teamChannel = team.toLowerCase();
    if (teamChannel !== 'general' && teamChannel !== 'all') {
      await supabase.from('messages').insert({
        channel: teamChannel,
        content,
        sender_id: incident.reporterUserId ?? '',
        sender_name: reporterName,
        sender_team: team,
      }).then(() => {});
    }
  }
}

export function IncidentModule() {
  const { incidents, currentUser, addIncident, updateIncident, deleteIncident } = useApp();
  const role = currentUser?.role;
  const canManage = role === 'owner' || role === 'admin' || role === 'manager';
  const canDelete = role === 'owner' || role === 'admin';

  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<IncidentStatus | 'all'>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [managingId, setManagingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [newStatus, setNewStatus] = useState<IncidentStatus>('in_progress');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  let filtered = [...incidents];
  if (filterStatus !== 'all') filtered = filtered.filter(i => i.status === filterStatus);
  if (filterSeverity !== 'all') filtered = filtered.filter(i => i.severity === filterSeverity);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(i =>
      i.type.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      (i as { title?: string }).title?.toLowerCase().includes(q)
    );
  }
  filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const openCount = incidents.filter(i => i.status === 'open').length;
  const highCount = incidents.filter(i => (i.severity === 'high' || (i as { severity: string }).severity === 'critical') && i.status !== 'resolved').length;

  const handleSubmitIncident = async (data: {
    title: string; type: IncidentType; description: string;
    location: IncidentLocation; severity: string; anonymous: boolean; photoUrl?: string; team: Team;
  }) => {
    const incident = {
      type: data.type,
      description: data.description,
      location: data.location,
      severity: data.severity as IncidentSeverity,
      team: data.team,
      status: 'open' as IncidentStatus,
      reporterName: data.anonymous ? undefined : currentUser?.name,
      reporterUserId: data.anonymous ? undefined : currentUser?.id,
      anonymous: data.anonymous,
    };
    addIncident(incident);

    // Post to chat
    if (currentUser) {
      const fullIncident = { ...incident, id: 'pending', title: data.title, createdAt: new Date(), updatedAt: new Date() } as Incident & { title?: string };
      await postIncidentToChat(fullIncident, currentUser.name, data.team);
    }
    setShowForm(false);
  };

  return (
    <div className="space-y-4 px-4 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Tickets Incidents
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {openCount} ouvert{openCount > 1 ? 's' : ''}
            {highCount > 0 && <span className="text-destructive font-medium"> · {highCount} urgents</span>}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" />
          Signaler
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text" placeholder="Rechercher..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as IncidentStatus | 'all')}
          className="text-xs border border-border rounded-xl px-2 py-1.5 bg-background text-foreground">
          <option value="all">Tous statuts</option>
          <option value="open">Ouvert</option>
          <option value="in_progress">En cours</option>
          <option value="resolved">Résolu</option>
        </select>
        <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
          className="text-xs border border-border rounded-xl px-2 py-1.5 bg-background text-foreground">
          <option value="all">Toutes gravités</option>
          <option value="low">Info</option>
          <option value="medium">Moyen</option>
          <option value="high">Grave</option>
          <option value="critical">Critique</option>
        </select>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm font-medium text-foreground">Aucun incident</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(incident => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              canManage={canManage}
              canDelete={canDelete}
              isManaging={managingId === incident.id}
              resolutionNote={resolutionNote}
              newStatus={newStatus}
              onManage={() => { setManagingId(incident.id); setResolutionNote(incident.resolutionNote || ''); setNewStatus(incident.status === 'open' ? 'in_progress' : incident.status); }}
              onCancelManage={() => setManagingId(null)}
              onSaveManage={() => { updateIncident(incident.id, { status: newStatus, resolutionNote, resolvedBy: currentUser?.name, resolvedAt: newStatus === 'resolved' ? new Date() : undefined }); setManagingId(null); }}
              onResolutionChange={setResolutionNote}
              onStatusChange={setNewStatus}
              onDelete={() => setDeleteConfirmId(incident.id)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <CreateIncidentModal
          onClose={() => setShowForm(false)}
          onSubmit={handleSubmitIncident}
          currentUser={currentUser}
        />
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-border">
            <h3 className="text-sm font-bold text-foreground mb-2">Supprimer cet incident ?</h3>
            <p className="text-xs text-muted-foreground mb-5">Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-secondary">Annuler</button>
              <button onClick={() => { deleteIncident(deleteConfirmId); setDeleteConfirmId(null); }} className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold hover:opacity-90">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IncidentCard({ incident, canManage, canDelete, isManaging, resolutionNote, newStatus, onManage, onCancelManage, onSaveManage, onResolutionChange, onStatusChange, onDelete }: {
  incident: Incident; canManage: boolean; canDelete: boolean; isManaging: boolean;
  resolutionNote: string; newStatus: IncidentStatus;
  onManage: () => void; onCancelManage: () => void; onSaveManage: () => void;
  onResolutionChange: (v: string) => void; onStatusChange: (v: IncidentStatus) => void; onDelete: () => void;
}) {
  const sev = SEVERITY_CONFIG[incident.severity] ?? SEVERITY_CONFIG.low;
  const st = STATUS_CONFIG[incident.status] ?? STATUS_CONFIG.open;
  const title = (incident as { title?: string }).title || TYPE_LABELS[incident.type] || incident.type;

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className={`flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold border ${sev.color}`}>{sev.labelFr.toUpperCase()}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{incident.description}</p>
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-medium flex-shrink-0 ${st.color}`}>
          {st.icon} {st.labelFr}
        </div>
      </div>

      {(incident as { photo_url?: string }).photo_url && (
        <img src={(incident as { photo_url?: string }).photo_url} alt="Photo incident" className="w-full rounded-lg object-cover max-h-40" />
      )}

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{incident.anonymous ? 'Anonyme' : (incident.reporterName || 'Inconnu')}</span>
        <span>{incident.createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      {incident.resolutionNote && (
        <div className="text-xs text-muted-foreground bg-secondary/60 rounded-lg px-3 py-2">
          <span className="font-medium text-foreground">Résolution : </span>{incident.resolutionNote}
          {incident.resolvedBy && <span className="ml-1 opacity-60">— {incident.resolvedBy}</span>}
        </div>
      )}

      {canManage && !isManaging && incident.status !== 'resolved' && (
        <button onClick={onManage} className="w-full text-xs text-primary font-medium py-1.5 rounded-lg hover:bg-primary/10 transition-colors border border-primary/20">
          Gérer
        </button>
      )}

      {canManage && isManaging && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex gap-2">
            {(['in_progress', 'resolved'] as IncidentStatus[]).map(s => (
              <button key={s} onClick={() => onStatusChange(s)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${newStatus === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-secondary'}`}>
                {STATUS_CONFIG[s].labelFr}
              </button>
            ))}
          </div>
          <textarea placeholder="Note de résolution..." value={resolutionNote} onChange={e => onResolutionChange(e.target.value)}
            rows={2} className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
          <div className="flex gap-2">
            <button onClick={onCancelManage} className="flex-1 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary">Annuler</button>
            <button onClick={onSaveManage} className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90">Sauvegarder</button>
          </div>
        </div>
      )}

      {canDelete && (
        <button onClick={onDelete} className="w-full text-xs text-destructive font-medium py-1 rounded-lg hover:bg-destructive/10 transition-colors">
          Supprimer
        </button>
      )}
    </div>
  );
}

function CreateIncidentModal({ onClose, onSubmit, currentUser }: {
  onClose: () => void;
  onSubmit: (data: { title: string; type: IncidentType; description: string; location: IncidentLocation; severity: string; anonymous: boolean; photoUrl?: string; team: Team }) => void;
  currentUser: { id: string; name: string; team: string } | null;
}) {
  const [form, setForm] = useState({
    title: '',
    type: 'Equipment failure' as IncidentType,
    description: '',
    location: 'Bar' as IncidentLocation,
    severity: 'medium',
    anonymous: false,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Le titre est requis.'); return; }
    if (!form.description.trim()) { setError('La description est requise.'); return; }
    setUploading(true);
    let photoUrl: string | undefined;

    if (photoFile) {
      const ext = photoFile.name.split('.').pop() || 'jpg';
      const path = `incidents/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('task-proofs').upload(path, photoFile, { upsert: true });
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('task-proofs').getPublicUrl(path);
        photoUrl = publicUrl;
      }
    }

    setUploading(false);
    onSubmit({ ...form, photoUrl, team: (currentUser?.team || 'ALL') as Team });
  };

  const severities = [
    { id: 'low', label: 'Info' },
    { id: 'medium', label: 'Moyen' },
    { id: 'high', label: 'Grave' },
    { id: 'critical', label: 'Critique' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl p-5 max-w-md w-full shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Signaler un incident
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="space-y-3">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Titre *</label>
            <input value={form.title} onChange={e => { setForm(p => ({ ...p, title: e.target.value })); setError(''); }}
              placeholder="Ex: Friteuse en panne..." maxLength={100}
              className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Type</label>
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as IncidentType }))}
              className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground">
              {INCIDENT_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Gravité</label>
            <div className="grid grid-cols-4 gap-1.5">
              {severities.map(s => (
                <button key={s.id} onClick={() => setForm(p => ({ ...p, severity: s.id }))}
                  className={`py-1.5 rounded-xl text-xs font-medium border transition-colors ${form.severity === s.id ? SEVERITY_CONFIG[s.id].color + ' border-current' : 'border-border text-muted-foreground hover:bg-secondary'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Lieu</label>
            <select value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value as IncidentLocation }))}
              className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground">
              {INCIDENT_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Description *</label>
            <textarea placeholder="Décrivez ce qui s'est passé..." value={form.description}
              onChange={e => { setForm(p => ({ ...p, description: e.target.value })); setError(''); }}
              rows={3} maxLength={1000}
              className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
            {error && <p className="text-[10px] text-destructive mt-1">{error}</p>}
          </div>

          {/* Photo */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Photo (optionnel)</label>
            {photoPreview ? (
              <div className="relative rounded-xl overflow-hidden max-h-32">
                <img src={photoPreview} alt="preview" className="w-full object-cover" />
                <button onClick={() => { setPhotoFile(null); setPhotoPreview(''); }}
                  className="absolute top-1 right-1 p-1 bg-black/60 rounded-full">
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="w-full py-3 rounded-xl border-2 border-dashed border-border flex items-center justify-center gap-2 text-xs text-muted-foreground hover:border-primary hover:bg-primary/5 transition-colors">
                <Camera className="w-4 h-4" /> Ajouter une photo
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
          </div>

          {/* Anonymous */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.anonymous} onChange={e => setForm(p => ({ ...p, anonymous: e.target.checked }))} className="rounded" />
            <span className="text-xs text-muted-foreground">Signaler anonymement</span>
          </label>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-secondary">Annuler</button>
            <button onClick={handleSubmit} disabled={uploading}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50">
              {uploading ? 'Envoi...' : 'Envoyer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
