import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DayReport } from '../../types';
import { TEAM_LABELS } from '../../data/initialData';
import {
  FileText, Clock, CheckCircle, AlertTriangle, Users,
  Calendar, ChevronDown, ChevronUp, Edit3, Package,
} from 'lucide-react';

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function CountdownTimer({ readyAt }: { readyAt: Date }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => setRemaining(Math.max(0, readyAt.getTime() - Date.now()));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [readyAt]);

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);

  if (remaining === 0) return <span className="text-xs text-timer-safe font-medium">Report ready!</span>;

  return (
    <span className="text-xs font-bold text-foreground tabular-nums">
      {mins}:{secs.toString().padStart(2, '0')}
    </span>
  );
}

// ─── Single Report View ───────────────────────────────────────────────────────
function ReportDetail({ report, onSaveNotes }: { report: DayReport; onSaveNotes: (notes: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(report.managerNotes);
  const totalRate = report.totalTasks > 0
    ? Math.round((report.completedTasks / report.totalTasks) * 100)
    : 0;

  const criticalAlerts = report.stockAlerts.filter((a) => a.status === 'critical');
  const warningAlerts = report.stockAlerts.filter((a) => a.status === 'warning');

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-secondary/40 transition-colors"
      >
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{formatDate(report.date)}</p>
          <p className="text-[11px] text-muted-foreground">
            Generated at {formatTime(report.generatedAt)} · {report.triggeredBy === 'manual' ? `by ${report.triggeredByUser}` : 'automatic'}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-sm font-black ${totalRate >= 70 ? 'text-timer-safe' : totalRate >= 40 ? 'text-timer-warning' : 'text-timer-danger'}`}>
            {totalRate}%
          </p>
          <p className="text-[10px] text-muted-foreground">completion</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-5 space-y-5 border-t border-border animate-slide-up">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 pt-4">
            <div className="text-center p-3 rounded-xl bg-secondary">
              <p className="text-xl font-black text-foreground">{report.totalTasks}</p>
              <p className="text-[10px] text-muted-foreground">Tasks assigned</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-secondary">
              <p className="text-xl font-black text-timer-safe">{report.completedTasks}</p>
              <p className="text-[10px] text-muted-foreground">Completed</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-secondary">
              <p className="text-xl font-black text-foreground">{totalRate}%</p>
              <p className="text-[10px] text-muted-foreground">Rate</p>
            </div>
          </div>

          {/* Team breakdown */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Team Completion</h4>
            <div className="space-y-2">
              {Object.entries(report.teamCompletionRates).filter(([t]) => t !== 'ALL' && t !== 'MANAGEMENT').map(([team, rate]) => (
                <div key={team} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{TEAM_LABELS[team] || team}</span>
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${rate}%`,
                        background: rate >= 70 ? 'hsl(var(--timer-safe))' : rate >= 40 ? 'hsl(var(--timer-warning))' : 'hsl(var(--timer-danger))',
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold text-foreground w-8 text-right">{rate}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stock alerts */}
          {report.stockAlerts.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> Stock Alerts
              </h4>
              <div className="space-y-1.5">
                {criticalAlerts.map((a) => (
                  <div key={a.productId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                    <span className="text-xs font-medium text-red-700">{a.productName}</span>
                    <span className="text-xs text-red-600">{a.currentStock} left (min: {a.minThreshold})</span>
                  </div>
                ))}
                {warningAlerts.map((a) => (
                  <div key={a.productId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                    <span className="text-xs font-medium text-amber-700">{a.productName}</span>
                    <span className="text-xs text-amber-600">{a.currentStock} left (min: {a.minThreshold})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Staff performance */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Staff Performance
            </h4>
            <div className="space-y-1.5">
              {report.staffPerformance
                .sort((a, b) => b.tasksCompleted - a.tasksCompleted)
                .map((s) => (
                  <div key={s.userId} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0">
                    <span className="font-medium text-foreground">{s.userName}</span>
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span><span className="text-timer-safe font-bold">{s.tasksCompleted}</span> tasks</span>
                      <span className="text-primary font-bold">+{s.pointsEarned} pts</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Manager notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5" /> Manager Notes
              </h4>
              {!editingNotes && (
                <button onClick={() => setEditingNotes(true)} className="text-xs text-primary hover:underline">Edit</button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none min-h-[80px] focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Add manager notes for this shift..."
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingNotes(false)} className="px-3 py-1.5 rounded-lg text-xs border border-input hover:bg-secondary transition-colors">Cancel</button>
                  <button onClick={() => { onSaveNotes(notes); setEditingNotes(false); }} className="px-3 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">Save</button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                {report.managerNotes || 'No notes added.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reports History ──────────────────────────────────────────────────────────
export function ReportsView({ canCloseDay = false }: { canCloseDay?: boolean }) {
  const { dayReports, dayCloseState, triggerCloseDay, saveManagerNotes, currentUser } = useApp();
  const [showConfirm, setShowConfirm] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const todayReport = dayReports.find((r) => r.date === today);
  const todayClosed = dayCloseState?.date === today && dayCloseState.triggered;
  const closeDayDisabled = !!todayReport || todayClosed;

  const handleCloseDay = () => {
    if (currentUser) {
      triggerCloseDay(currentUser.name);
      setShowConfirm(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            End of Day Reports
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{dayReports.length} reports stored</p>
        </div>
        {canCloseDay && !closeDayDisabled && (
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-accent-foreground text-xs font-bold hover:opacity-90 transition-opacity"
          >
            <Clock className="w-3.5 h-3.5" />
            Close Day
          </button>
        )}
        {todayClosed && !todayReport && dayCloseState?.reportReadyAt && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary border border-border">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Report at {formatTime(dayCloseState.reportReadyAt)} —</span>
            <CountdownTimer readyAt={dayCloseState.reportReadyAt} />
          </div>
        )}
        {todayReport && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-timer-safe/10 border border-timer-safe/20">
            <CheckCircle className="w-3.5 h-3.5 text-timer-safe" />
            <span className="text-xs text-timer-safe font-medium">Today's report is ready</span>
          </div>
        )}
      </div>

      {/* Close Day confirmation */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Close Today's Shift?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">This will generate the end of day report in 10 minutes.</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-5 p-3 rounded-xl bg-secondary">
              Any data updated <strong>after report generation</strong> will be counted in the next day's report.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-input text-sm font-medium hover:bg-secondary transition-colors">
                Cancel
              </button>
              <button onClick={handleCloseDay} className="flex-1 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-bold hover:opacity-90 transition-opacity">
                Yes, Close Day
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report list */}
      {dayReports.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-semibold text-foreground">No reports yet</p>
          <p className="text-sm mt-1">Reports are generated at end of day or when you close the shift</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dayReports
            .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
            .map((report) => (
              <ReportDetail
                key={report.id}
                report={report}
                onSaveNotes={(notes) => saveManagerNotes(report.id, notes)}
              />
            ))}
        </div>
      )}

      {/* Auto report info */}
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-secondary border border-border">
        <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          Reports are automatically generated at <strong>23:30</strong> if no manual close was triggered.
        </p>
      </div>
    </div>
  );
}
