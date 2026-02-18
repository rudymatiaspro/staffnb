import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TaskCard } from '../tasks/TaskCard';
import { BonusScoreCard } from '../zones/BonusScoreCard';
import { CreateTaskModal } from '../tasks/CreateTaskModal';
import { Zone } from '../../types';
import { ZONE_CSS, ZONE_EMOJI } from '../../data/initialData';
import {
  Plus, LayoutGrid, List, Activity, CheckCircle, Clock,
  AlertTriangle, Users, ChevronDown, ChevronUp
} from 'lucide-react';

const ZONES: Zone[] = ['BAR', 'CUISINE', 'ATELIER'];

type ManagerTab = 'tasks' | 'activity' | 'scores';

export function ManagerView() {
  const { getTodayTasks, deleteTask, validationLog, getZoneScore, users } = useApp();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filterZone, setFilterZone] = useState<Zone | 'ALL'>('ALL');
  const [activeTab, setActiveTab] = useState<ManagerTab>('tasks');
  const [expandedZones, setExpandedZones] = useState<Set<Zone>>(new Set(ZONES));

  const allTasks = getTodayTasks();
  const filteredTasks = filterZone === 'ALL'
    ? allTasks
    : allTasks.filter((t) => t.zone === filterZone || t.zone === 'ALL');

  const pendingCount = allTasks.filter((t) => t.status === 'pending').length;
  const overdueCount = allTasks.filter((t) => t.status === 'overdue').length;
  const doneCount = allTasks.filter((t) => t.status === 'done').length;
  const todayLog = validationLog.filter((v) => {
    const today = new Date().toISOString().split('T')[0];
    return v.validatedAt.toISOString().split('T')[0] === today;
  });

  const toggleZone = (zone: Zone) => {
    setExpandedZones((prev) => {
      const next = new Set(prev);
      if (next.has(zone)) next.delete(zone);
      else next.add(zone);
      return next;
    });
  };

  const tabs = [
    { id: 'tasks' as ManagerTab, label: 'Tâches', icon: <CheckCircle className="w-3.5 h-3.5" /> },
    { id: 'scores' as ManagerTab, label: 'Scores', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'activity' as ManagerTab, label: 'Activité', icon: <Users className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-primary">{pendingCount}</p>
          <p className="text-xs text-muted-foreground">En attente</p>
        </div>
        <div className={`rounded-xl p-3 text-center ${overdueCount > 0 ? 'bg-destructive/10 border border-destructive/20' : 'glass-card'}`}>
          <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-timer-danger' : 'text-foreground'}`}>{overdueCount}</p>
          <p className="text-xs text-muted-foreground">En retard</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-timer-safe">{doneCount}</p>
          <p className="text-xs text-muted-foreground">Complétées</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium flex-1 justify-center transition-all ${
              activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* === TASKS TAB === */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setFilterZone('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterZone === 'ALL' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'}`}
              >
                Toutes
              </button>
              {[...ZONES, 'ALL' as Zone].map((zone) => (
                <button
                  key={zone}
                  onClick={() => setFilterZone(zone === filterZone ? 'ALL' : zone)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all zone-badge ${ZONE_CSS[zone]} ${filterZone === zone ? 'ring-1 ring-current' : 'opacity-70 hover:opacity-100'}`}
                >
                  {ZONE_EMOJI[zone]} {zone}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
                className="p-2 rounded-lg bg-secondary hover:bg-muted transition-colors"
                title={view === 'grid' ? 'Vue liste' : 'Vue colonnes'}
              >
                {view === 'grid'
                  ? <List className="w-4 h-4 text-muted-foreground" />
                  : <LayoutGrid className="w-4 h-4 text-muted-foreground" />}
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nouvelle tâche</span>
                <span className="sm:hidden">+</span>
              </button>
            </div>
          </div>

          {/* Grid view — zones side by side */}
          {view === 'grid' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {([...ZONES, 'ALL' as Zone]).filter((z) => filterZone === 'ALL' || filterZone === z).map((zone) => {
                const zoneTasks = zone === 'ALL'
                  ? allTasks.filter((t) => t.zone === 'ALL')
                  : allTasks.filter((t) => t.zone === zone || t.zone === 'ALL');
                const pending = zoneTasks.filter((t) => t.status !== 'done').sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
                const done = zoneTasks.filter((t) => t.status === 'done');
                const overdue = zoneTasks.filter((t) => t.status === 'overdue');
                const expanded = expandedZones.has(zone);

                return (
                  <div key={zone} className={`rounded-xl border zone-card ${ZONE_CSS[zone]}`}>
                    <button
                      className="w-full flex items-center gap-2 p-4 text-left"
                      onClick={() => toggleZone(zone)}
                    >
                      <span className="text-lg">{ZONE_EMOJI[zone]}</span>
                      <div className="flex-1">
                        <h3 className="font-bold text-sm text-foreground">{zone}</h3>
                        <p className="text-xs text-muted-foreground">{done.length}/{zoneTasks.length} complétées</p>
                      </div>
                      {overdue.length > 0 && (
                        <span className="text-xs bg-red-500/15 text-timer-danger border border-red-500/20 px-2 py-0.5 rounded-full font-medium">
                          {overdue.length} retard
                        </span>
                      )}
                      {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    {expanded && (
                      <div className="px-4 pb-4 space-y-2 animate-slide-up">
                        {pending.map((task) => (
                          <TaskCard key={task.id} task={task} canComplete canDelete onDelete={() => deleteTask(task.id)} compact />
                        ))}
                        {done.map((task) => (
                          <TaskCard key={task.id} task={task} canComplete={false} canDelete onDelete={() => deleteTask(task.id)} compact />
                        ))}
                        {zoneTasks.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">Aucune tâche</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* List view — flat list sorted by urgency */
            <div className="space-y-3">
              {/* Overdue first */}
              {filteredTasks.filter(t => t.status === 'overdue').map(task => (
                <TaskCard key={task.id} task={task} canComplete canDelete onDelete={() => deleteTask(task.id)} />
              ))}
              {/* Then pending */}
              {filteredTasks.filter(t => t.status === 'pending')
                .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
                .map(task => (
                  <TaskCard key={task.id} task={task} canComplete canDelete onDelete={() => deleteTask(task.id)} />
                ))}
              {/* Then done */}
              {filteredTasks.filter(t => t.status === 'done').map(task => (
                <TaskCard key={task.id} task={task} canComplete={false} canDelete onDelete={() => deleteTask(task.id)} />
              ))}
              {filteredTasks.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Aucune tâche pour aujourd'hui</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* === SCORES TAB === */}
      {activeTab === 'scores' && (
        <div className="space-y-4">
          {ZONES.map((zone) => (
            <BonusScoreCard key={zone} zone={zone} />
          ))}
        </div>
      )}

      {/* === ACTIVITY TAB === */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          {/* Who validated what */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-4 h-4 text-timer-safe" />
              <h3 className="text-sm font-semibold text-foreground">Validations du jour</h3>
              <span className="ml-auto text-xs text-muted-foreground">{todayLog.length} total</span>
            </div>
            {todayLog.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune validation pour le moment</p>
            ) : (
              <div className="space-y-2">
                {todayLog.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm">{ZONE_EMOJI[v.zone]}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{v.taskName}</p>
                        <p className="text-xs text-muted-foreground">{v.zone} · par {v.validatedBy}</p>
                      </div>
                    </div>
                    <span className="text-xs text-timer-safe font-medium flex-shrink-0">
                      {v.validatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Malus log per zone */}
          {ZONES.map((zone) => {
            const score = getZoneScore(zone);
            if (score.malusEvents.length === 0) return null;
            return (
              <div key={zone} className={`rounded-xl p-4 zone-card ${ZONE_CSS[zone]}`}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-timer-danger" />
                  <h3 className="text-sm font-semibold text-foreground">Malus {zone}</h3>
                  <span className="ml-auto text-xs text-timer-danger font-bold">-{score.totalMalus} pts</span>
                </div>
                <div className="space-y-1.5">
                  {score.malusEvents.map((me) => (
                    <div key={me.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{me.taskName}</span>
                      <div className="flex items-center gap-2 text-timer-danger">
                        <span>{me.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="font-bold">-{me.points}pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Staff activity */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Activité par personne</h3>
            </div>
            {ZONES.map((zone) => {
              const zoneStaff = users.filter((u) => u.zone === zone && u.role === 'staff');
              return (
                <div key={zone} className="mb-3 last:mb-0">
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                    {ZONE_EMOJI[zone]} {zone}
                  </p>
                  <div className="space-y-1.5">
                    {zoneStaff.map((staff) => {
                      const staffValidations = todayLog.filter((v) => v.validatedBy === staff.name);
                      return (
                        <div key={staff.id} className="flex items-center justify-between text-xs py-1">
                          <span className="text-foreground">{staff.name}</span>
                          <div className="flex items-center gap-2">
                            {staffValidations.length > 0 ? (
                              <span className="text-timer-safe font-medium">
                                {staffValidations.length} tâche{staffValidations.length > 1 ? 's' : ''} validée{staffValidations.length > 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Aucune validation</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showCreateModal && <CreateTaskModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
}
