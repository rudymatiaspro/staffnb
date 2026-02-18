import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TemperatureLocation, TemperatureLog } from '../../types';
import { Thermometer, Plus, AlertTriangle, CheckCircle, Download, Filter, X } from 'lucide-react';

interface Props {
  canExport?: boolean;
  canManageLocations?: boolean;
}

function getStatusColor(log: TemperatureLog) {
  return log.isAlert
    ? 'bg-destructive/10 border-destructive/30 text-timer-danger'
    : 'bg-timer-safe/10 border-timer-safe/30 text-timer-safe';
}

export function HACCPModule({ canExport = false, canManageLocations = false }: Props) {
  const { tempLocations, tempLogs, currentUser, addTempLog, addTempLocation } = useApp();
  const [showLogForm, setShowLogForm] = useState(false);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [logForm, setLogForm] = useState({ locationId: '', temperature: '', note: '' });
  const [logError, setLogError] = useState('');
  const [locationForm, setLocationForm] = useState({ name: '', minThreshold: '', maxThreshold: '' });
  const [locError, setLocError] = useState('');

  const filtered = tempLogs
    .filter(l => filterLocation === 'all' || l.locationId === filterLocation)
    .filter(l => !filterDateFrom || l.createdAt >= new Date(filterDateFrom))
    .filter(l => !filterDateTo || l.createdAt <= new Date(filterDateTo + 'T23:59:59'))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const alertCount = tempLogs.filter(l => l.isAlert).length;

  const handleLogSubmit = () => {
    if (!logForm.locationId) { setLogError('Select a location'); return; }
    const temp = parseFloat(logForm.temperature);
    if (isNaN(temp)) { setLogError('Enter a valid temperature'); return; }
    const location = tempLocations.find(l => l.id === logForm.locationId);
    if (!location) { setLogError('Location not found'); return; }
    const isAlert = temp > location.maxThreshold || (location.minThreshold !== undefined && location.minThreshold !== null && temp < location.minThreshold);
    addTempLog({
      locationId: location.id,
      locationName: location.name,
      temperature: temp,
      unit: '°C',
      isAlert,
      note: logForm.note || undefined,
      loggedBy: currentUser?.name || 'Unknown',
      loggedByUserId: currentUser?.id,
    });
    setLogForm({ locationId: '', temperature: '', note: '' });
    setShowLogForm(false);
  };

  const handleLocationSubmit = () => {
    if (!locationForm.name.trim()) { setLocError('Name is required'); return; }
    const max = parseFloat(locationForm.maxThreshold);
    if (isNaN(max)) { setLocError('Max threshold is required'); return; }
    addTempLocation({
      name: locationForm.name.trim(),
      minThreshold: locationForm.minThreshold ? parseFloat(locationForm.minThreshold) : undefined,
      maxThreshold: max,
      isCustom: true,
    });
    setLocationForm({ name: '', minThreshold: '', maxThreshold: '' });
    setShowLocationForm(false);
  };

  const exportCSV = () => {
    const headers = 'Location,Temperature (°C),Alert,Logged By,Note,Date/Time\n';
    const rows = filtered.map(l =>
      `"${l.locationName}",${l.temperature},${l.isAlert ? 'YES' : 'NO'},"${l.loggedBy}","${l.note || ''}","${l.createdAt.toLocaleString('en-GB')}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `haccp-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-primary" />
            HACCP Temperature Log
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tempLogs.length} entries · {alertCount > 0 && <span className="text-timer-danger font-medium">{alertCount} alerts</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-secondary">
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          )}
          {canManageLocations && (
            <button onClick={() => setShowLocationForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-secondary">
              <Plus className="w-3.5 h-3.5" />
              Add Location
            </button>
          )}
          <button onClick={() => setShowLogForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90">
            <Thermometer className="w-3.5 h-3.5" />
            Log Temp
          </button>
        </div>
      </div>

      {/* Locations overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tempLocations.map(loc => {
          const lastLog = tempLogs.filter(l => l.locationId === loc.id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
          return (
            <div key={loc.id} className={`rounded-xl p-3 border text-center ${lastLog?.isAlert ? 'bg-destructive/10 border-destructive/30' : 'glass-card'}`}>
              <p className="text-[10px] text-muted-foreground truncate">{loc.name}</p>
              {lastLog ? (
                <>
                  <p className={`text-xl font-black mt-1 ${lastLog.isAlert ? 'text-timer-danger' : 'text-timer-safe'}`}>
                    {lastLog.temperature}°C
                  </p>
                  <p className="text-[9px] text-muted-foreground">{lastLog.createdAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">No data</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filterLocation}
          onChange={e => setFilterLocation(e.target.value)}
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
        >
          <option value="all">All Locations</option>
          {tempLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground" />
        <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground" />
      </div>

      {/* Log list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Thermometer className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm font-medium text-foreground">No temperature logs</p>
          <p className="text-xs mt-1">Start logging temperatures for HACCP compliance</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => (
            <div key={log.id} className={`rounded-xl p-3 border flex items-center gap-3 ${log.isAlert ? 'bg-destructive/10 border-destructive/30' : 'bg-timer-safe/5 border-timer-safe/20'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${log.isAlert ? 'bg-destructive/20' : 'bg-timer-safe/20'}`}>
                {log.isAlert
                  ? <AlertTriangle className="w-4 h-4 text-timer-danger" />
                  : <CheckCircle className="w-4 h-4 text-timer-safe" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{log.locationName}</span>
                  {log.isAlert && (
                    <span className="text-[9px] font-bold text-timer-danger bg-destructive/15 px-1.5 py-0.5 rounded">ALERT</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">By {log.loggedBy}{log.note && ` · ${log.note}`}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-black ${log.isAlert ? 'text-timer-danger' : 'text-timer-safe'}`}>{log.temperature}°C</p>
                <p className="text-[9px] text-muted-foreground">{log.createdAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log Temperature Modal */}
      {showLogForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-border">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-primary" />
                Log Temperature
              </h3>
              <button onClick={() => setShowLogForm(false)} className="p-1 rounded-lg hover:bg-secondary"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Location</label>
                <select
                  value={logForm.locationId}
                  onChange={e => { setLogForm(p => ({ ...p, locationId: e.target.value })); setLogError(''); }}
                  className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground"
                >
                  <option value="">Select location...</option>
                  {tempLocations.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.name} (max {l.maxThreshold}°C{l.minThreshold !== undefined && l.minThreshold !== null ? `, min ${l.minThreshold}°C` : ''})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 3.5"
                  value={logForm.temperature}
                  onChange={e => { setLogForm(p => ({ ...p, temperature: e.target.value })); setLogError(''); }}
                  className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {logForm.locationId && logForm.temperature && (() => {
                  const loc = tempLocations.find(l => l.id === logForm.locationId);
                  const temp = parseFloat(logForm.temperature);
                  if (!loc || isNaN(temp)) return null;
                  const isAlert = temp > loc.maxThreshold || (loc.minThreshold !== undefined && loc.minThreshold !== null && temp < loc.minThreshold);
                  return isAlert
                    ? <p className="text-[10px] text-timer-danger mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> This will trigger an alert!</p>
                    : <p className="text-[10px] text-timer-safe mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Within safe range</p>;
                })()}
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Note (optional)</label>
                <input
                  type="text"
                  placeholder="Optional note..."
                  value={logForm.note}
                  onChange={e => setLogForm(p => ({ ...p, note: e.target.value }))}
                  className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {logError && <p className="text-[10px] text-timer-danger">{logError}</p>}
              <div className="flex gap-3">
                <button onClick={() => setShowLogForm(false)} className="flex-1 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-secondary">Cancel</button>
                <button onClick={handleLogSubmit} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90">Log</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Location Modal */}
      {showLocationForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-border">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-foreground">Add Custom Location</h3>
              <button onClick={() => setShowLocationForm(false)} className="p-1 rounded-lg hover:bg-secondary"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Location Name</label>
                <input type="text" placeholder="e.g. Fridge 3 (Storage)" value={locationForm.name}
                  onChange={e => { setLocationForm(p => ({ ...p, name: e.target.value })); setLocError(''); }}
                  className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Min Threshold (°C)</label>
                  <input type="number" step="0.1" placeholder="Optional" value={locationForm.minThreshold}
                    onChange={e => setLocationForm(p => ({ ...p, minThreshold: e.target.value }))}
                    className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Max Threshold (°C) <span className="text-timer-danger">*</span></label>
                  <input type="number" step="0.1" placeholder="e.g. 4" value={locationForm.maxThreshold}
                    onChange={e => { setLocationForm(p => ({ ...p, maxThreshold: e.target.value })); setLocError(''); }}
                    className="w-full text-xs border border-border rounded-xl px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              {locError && <p className="text-[10px] text-timer-danger">{locError}</p>}
              <div className="flex gap-3">
                <button onClick={() => setShowLocationForm(false)} className="flex-1 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-secondary">Cancel</button>
                <button onClick={handleLocationSubmit} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90">Add</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
