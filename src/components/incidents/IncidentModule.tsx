import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Incident, IncidentType, IncidentSeverity, IncidentStatus, IncidentLocation, Team } from '../../types';
import { AlertTriangle, Plus, Filter, ChevronDown, Check, Clock, ShieldCheck, X, Search } from 'lucide-react';

const INCIDENT_TYPES: IncidentType[] = [
  'Equipment failure', 'Customer complaint', 'Hygiene issue',
  'Accident / Injury', 'Security concern', 'Other',
];

const INCIDENT_LOCATIONS: IncidentLocation[] = ['Bar', 'Kitchen', 'Atelier', 'Floor', 'Other'];

const SEVERITY_CONFIG = {
  low: { label: 'Low', color: 'text-muted-foreground bg-secondary border-border' },
  medium: { label: 'Medium', color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900' },
  high: { label: 'High', color: 'text-timer-danger bg-destructive/10 border-destructive/30' },
};

const STATUS_CONFIG = {
  open: { label: 'Open', icon: <AlertTriangle className="w-3 h-3" />, color: 'text-timer-danger' },
  in_progress: { label: 'In Progress', icon: <Clock className="w-3 h-3" />, color: 'text-amber-500' },
  resolved: { label: 'Resolved', icon: <Check className="w-3 h-3" />, color: 'text-timer-safe' },
};

interface Props {
  canManage?: boolean;   // manager/owner
  canDelete?: boolean;   // owner only
  teamFilter?: Team;     // manager: only their team
  showReportButton?: boolean; // staff view
}

export function IncidentModule({ canManage = false, canDelete = false, teamFilter, showReportButton = false }: Props) {
  const { incidents, currentUser, addIncident, updateIncident, deleteIncident } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<IncidentStatus | 'all'>('all');
  const [filterSeverity, setFilterSeverity] = useState<IncidentSeverity | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [managingId, setManagingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [newStatus, setNewStatus] = useState<IncidentStatus>('in_progress');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter incidents
  let filtered = incidents;
  if (teamFilter) {
    filtered = filtered.filter(i => i.team === teamFilter || i.team === 'ALL' as unknown as Team);
  }
  if (filterStatus !== 'all') filtered = filtered.filter(i => i.status === filterStatus);
  if (filterSeverity !== 'all') filtered = filtered.filter(i => i.severity === filterSeverity);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(i =>
      i.type.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.location.toLowerCase().includes(q)
    );
  }
  filtered = [...filtered].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const openCount = incidents.filter(i => i.status === 'open').length;
  const highCount = incidents.filter(i => i.severity === 'high' && i.status !== 'resolved').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Incident Reports
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {openCount} open · {highCount > 0 && <span className="text-timer-danger font-medium">{highCount} high severity</span>}
          </p>
        </div>
        {(showReportButton || canManage) && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            Report Incident
          </button>
        )}
      </div>

      {/* Filters */}
      {canManage && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as IncidentStatus | 'all')}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
          <select
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value as IncidentSeverity | 'all')}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
          >
            <option value="all">All Severity</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      )}

      {/* Incident cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm font-medium text-foreground">No incidents</p>
          <p className="text-xs mt-1">All clear — no incidents reported</p>
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
              onManage={() => {
                setManagingId(incident.id);
                setResolutionNote(incident.resolutionNote || '');
                setNewStatus(incident.status === 'open' ? 'in_progress' : incident.status);
              }}
              onCancelManage={() => setManagingId(null)}
              onSaveManage={() => {
                updateIncident(incident.id, { status: newStatus, resolutionNote, resolvedBy: currentUser?.name });
                setManagingId(null);
              }}
              onResolutionChange={setResolutionNote}
              onStatusChange={setNewStatus}
              onDelete={() => setDeleteConfirmId(incident.id)}
            />
          ))}
        </div>
      )}

      {/* Report form modal */}
      {showForm && (
        <ReportIncidentModal
          onClose={() => setShowForm(false)}
          onSubmit={(data) => {
            addIncident({
              ...data,
              status: 'open',
              team: (currentUser?.team || 'ALL') as Team,
              reporterName: data.anonymous ? undefined : currentUser?.name,
              reporterUserId: data.anonymous ? undefined : currentUser?.id,
            });
            setShowForm(false);
          }}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-border">
            <h3 className="text-sm font-bold text-foreground mb-2">Delete Incident?</h3>
            <p className="text-xs text-muted-foreground mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-secondary">Cancel</button>
              <button
                onClick={() => { deleteIncident(deleteConfirmId); setDeleteConfirmId(null); }}
                className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold hover:opacity-90"
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IncidentCard({
  incident, canManage, canDelete, isManaging,
  resolutionNote, newStatus,
  onManage, onCancelManage, onSaveManage,
  onResolutionChange, onStatusChange, onDelete,
}: {
  incident: Incident;
  canManage: boolean;
  canDelete: boolean;
  isManaging: boolean;
  resolutionNote: string;
  newStatus: IncidentStatus;
  onManage: () => void;
  onCancelManage: () => void;
  onSaveManage: () => void;
  onResolutionChange: (v: string) => void;
  onStatusChange: (v: IncidentStatus) => void;
  onDelete: () => void;
}) {
  const sev = SEVERITY_CONFIG[incident.severity];
  const st = STATUS_CONFIG[incident.status];

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold border ${sev.color}`}>
          {sev.label.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-foreground">{incident.type}</span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground">{incident.location}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{incident.description}</p>
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-medium flex-shrink-0 ${st.color}`}>
          {st.icon}
          {st.label}
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{incident.anonymous ? 'Anonymous' : (incident.reporterName || 'Unknown')}</span>
        <span>{incident.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      {incident.resolutionNote && (
        <div className="text-xs text-muted-foreground bg-secondary/60 rounded-lg px-3 py-2">
          <span className="font-medium text-foreground">Resolution: </span>{incident.resolutionNote}
          {incident.resolvedBy && <span className="ml-1 opacity-60">— {incident.resolvedBy}</span>}
        </div>
      )}

      {canManage && !isManaging && incident.status !== 'resolved' && (
        <button onClick={onManage} className="w-full text-xs text-primary font-medium py-1.5 rounded-lg hover:bg-primary/10 transition-colors border border-primary/20">
          Manage
        </button>
      )}

      {canManage && isManaging && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex gap-2">
            {(['in_progress', 'resolved'] as IncidentStatus[]).map(s => (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${newStatus === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-secondary'}`}
              >
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
          <textarea
            placeholder="Resolution note..."
            value={resolutionNote}
            onChange={e => onResolutionChange(e.target.value)}
            rows={2}
            className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-2">
            <button onClick={onCancelManage} className="flex-1 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary">Cancel</button>
            <button onClick={onSaveManage} className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90">Save</button>
          </div>
        </div>
      )}

      {canDelete && (
        <button onClick={onDelete} className="w-full text-xs text-timer-danger font-medium py-1 rounded-lg hover:bg-destructive/10 transition-colors">
          Delete incident
        </button>
      )}
    </div>
  );
}

function ReportIncidentModal({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (data: { type: IncidentType; description: string; location: IncidentLocation; severity: IncidentSeverity; anonymous: boolean }) => void;
}) {
  const [form, setForm] = useState({
    type: 'Equipment failure' as IncidentType,
    description: '',
    location: 'Bar' as IncidentLocation,
    severity: 'medium' as IncidentSeverity,
    anonymous: false,
  });
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!form.description.trim()) { setError('Description is required'); return; }
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl p-6 max-w-md w-full shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Report Incident
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">Incident Type</label>
            <select
              value={form.type}
              onChange={e => setForm(p => ({ ...p, type: e.target.value as IncidentType }))}
              className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground"
            >
              {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">Location</label>
            <select
              value={form.location}
              onChange={e => setForm(p => ({ ...p, location: e.target.value as IncidentLocation }))}
              className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground"
            >
              {INCIDENT_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">Severity</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as IncidentSeverity[]).map(s => (
                <button
                  key={s}
                  onClick={() => setForm(p => ({ ...p, severity: s }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${form.severity === s ? SEVERITY_CONFIG[s].color + ' border-current' : 'border-border text-muted-foreground hover:bg-secondary'}`}
                >
                  {SEVERITY_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">Description <span className="text-timer-danger">*</span></label>
            <textarea
              placeholder="Describe what happened..."
              value={form.description}
              onChange={e => { setForm(p => ({ ...p, description: e.target.value })); setError(''); }}
              rows={4}
              maxLength={1000}
              className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {error && <p className="text-[10px] text-timer-danger mt-1">{error}</p>}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.anonymous}
              onChange={e => setForm(p => ({ ...p, anonymous: e.target.checked }))}
              className="rounded"
            />
            <span className="text-xs text-muted-foreground">Report anonymously</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-secondary">Cancel</button>
            <button onClick={handleSubmit} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90">Submit Report</button>
          </div>
        </div>
      </div>
    </div>
  );
}
