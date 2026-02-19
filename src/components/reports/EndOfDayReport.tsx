import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DayReport } from '../../types';
import { TEAM_LABELS } from '../../data/initialData';
import { supabase } from '../../integrations/supabase/client';
import {
  FileText, Clock, CheckCircle, AlertTriangle, Users,
  Calendar, ChevronDown, ChevronUp, Edit3, Package, Download,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Export helpers ───────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportCSV(dateFrom: string, dateTo: string) {
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .gte('created_at', dateFrom + 'T00:00:00')
    .lte('created_at', dateTo + 'T23:59:59')
    .order('created_at', { ascending: true });

  if (!tasks) return;

  const header = ['Date', 'Tâche', 'Équipe', 'Assigné à', 'Statut', 'Points', 'Validé à'];
  const rows = tasks.map((t) => [
    t.created_at ? t.created_at.split('T')[0] : '',
    t.name,
    t.team,
    t.assigned_user_name || '',
    t.status,
    String(t.points ?? 0),
    t.validated_at ? t.validated_at.split('T')[0] : '',
  ]);

  const csv = [header, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadBlob(csv, `rapport-tasks-${dateFrom}.csv`, 'text/csv;charset=utf-8;');
}

async function exportPDF(dateFrom: string, dateTo: string, restaurantName: string) {
  const [tasksRes, rankingsRes, incidentsRes] = await Promise.all([
    supabase.from('tasks').select('*').gte('created_at', dateFrom + 'T00:00:00').lte('created_at', dateTo + 'T23:59:59').order('created_at'),
    supabase.rpc('get_staff_rankings'),
    supabase.from('incidents').select('*').gte('created_at', dateFrom + 'T00:00:00').lte('created_at', dateTo + 'T23:59:59').order('created_at'),
  ]);

  const tasks = tasksRes.data ?? [];
  const rankings = rankingsRes.data ?? [];
  const incidents = incidentsRes.data ?? [];

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const primary = [13, 40, 5] as [number, number, number]; // dark green
  const accent = [102, 222, 128] as [number, number, number]; // spring green

  // Header
  doc.setFillColor(...primary);
  doc.rect(0, 0, 210, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Staff&B — Rapport', 14, 10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${restaurantName}  ·  ${dateFrom}${dateFrom !== dateTo ? ' → ' + dateTo : ''}`, 14, 16);

  let y = 30;

  // Section 1 — Tasks
  doc.setTextColor(...primary);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Tâches', 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Tâche', 'Équipe', 'Assigné', 'Statut', 'Pts']],
    body: tasks.map((t) => [
      t.created_at?.split('T')[0] ?? '',
      t.name,
      t.team,
      t.assigned_user_name ?? '',
      t.status,
      String(t.points ?? 0),
    ]),
    headStyles: { fillColor: primary, textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 250, 245] },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Section 2 — Leaderboard
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setTextColor(...primary);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Classement staff', 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Rang', 'Nom', 'Équipe', 'Score', 'Rang équipe']],
    body: (rankings as any[]).map((r) => [
      String(r.overall_rank),
      r.name,
      r.team,
      String(r.score),
      String(r.team_rank),
    ]),
    headStyles: { fillColor: primary, textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 250, 245] },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Section 3 — Incidents
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setTextColor(...primary);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Incidents', 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Type', 'Sévérité', 'Statut', 'Résolu par']],
    body: incidents.map((i) => [
      i.created_at?.split('T')[0] ?? '',
      i.type,
      i.severity,
      i.status,
      i.resolved_by ?? '',
    ]),
    headStyles: { fillColor: primary, textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 250, 245] },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated by Staff&B — ${new Date().toLocaleString('fr-FR')}   ·   Page ${i}/${pageCount}`,
      14,
      doc.internal.pageSize.height - 8
    );
  }

  doc.save(`rapport-staffb-${dateFrom}.pdf`);
}

// ─── Export Panel ─────────────────────────────────────────────────────────────
function ExportPanel({ restaurantName }: { restaurantName: string }) {
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const handle = async (type: 'csv' | 'pdf') => {
    if (type === 'csv') { setLoadingCsv(true); await exportCSV(dateFrom, dateTo); setLoadingCsv(false); }
    else { setLoadingPdf(true); await exportPDF(dateFrom, dateTo, restaurantName); setLoadingPdf(false); }
  };

  return (
    <div className="glass-card rounded-xl p-4 space-y-3 border border-border">
      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
        <Download className="w-3.5 h-3.5 text-primary" />
        Exporter les données
      </h4>
      <div className="flex gap-2 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground font-medium">Du</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="text-xs bg-secondary border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground font-medium">Au</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="text-xs bg-secondary border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => handle('csv')} disabled={loadingCsv}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary border border-border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50">
          <Download className="w-3.5 h-3.5" />
          {loadingCsv ? 'Export…' : 'CSV'}
        </button>
        <button onClick={() => handle('pdf')} disabled={loadingPdf}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
          <FileText className="w-3.5 h-3.5" />
          {loadingPdf ? 'Génération…' : 'PDF'}
        </button>
      </div>
    </div>
  );
}


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
  const { dayReports, dayCloseState, triggerCloseDay, saveManagerNotes, currentUser, restaurantName } = useApp();
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

      {/* Export panel */}
      <ExportPanel restaurantName={restaurantName ?? 'Staff&B'} />
    </div>
  );
}
