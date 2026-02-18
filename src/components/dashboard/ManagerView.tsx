import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TaskCard } from '../tasks/TaskCard';
import { BonusScoreCard } from '../zones/BonusScoreCard';
import { CreateTaskModal } from '../tasks/CreateTaskModal';
import { Zone } from '../../types';
import { ZONE_CSS, ZONE_EMOJI } from '../../data/initialData';
import { Plus, LayoutGrid, List, AlertTriangle } from 'lucide-react';

const ZONES: Zone[] = ['BAR', 'CUISINE', 'ATELIER'];

export function ManagerView() {
  const { getTodayTasks, deleteTask } = useApp();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filterZone, setFilterZone] = useState<Zone | 'ALL'>('ALL');

  const allTasks = getTodayTasks();
  const filteredTasks = filterZone === 'ALL' ? allTasks : allTasks.filter((t) => t.zone === filterZone || t.zone === 'ALL');

  const pendingCount = allTasks.filter((t) => t.status !== 'done').length;
  const overdueCount = allTasks.filter((t) => t.status === 'overdue').length;
  const doneCount = allTasks.filter((t) => t.status === 'done').length;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
          <p className="text-xs text-muted-foreground">En attente</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-destructive">{overdueCount}</p>
          <p className="text-xs text-muted-foreground">En retard</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-timer-safe">{doneCount}</p>
          <p className="text-xs text-muted-foreground">Complétées</p>
        </div>
      </div>

      {/* Zone bonus scores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ZONES.map((zone) => (
          <BonusScoreCard key={zone} zone={zone} compact />
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterZone('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterZone === 'ALL' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'}`}
          >
            Toutes
          </button>
          {ZONES.map((zone) => (
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
            title={view === 'grid' ? 'Vue liste' : 'Vue grille'}
          >
            {view === 'grid' ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Nouvelle tâche
          </button>
        </div>
      </div>

      {/* Tasks */}
      {view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ZONES.filter((z) => filterZone === 'ALL' || filterZone === z).map((zone) => {
            const zoneTasks = filteredTasks.filter((t) => t.zone === zone || t.zone === 'ALL');
            const pending = zoneTasks.filter((t) => t.status !== 'done').sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
            const done = zoneTasks.filter((t) => t.status === 'done');
            return (
              <div key={zone} className={`rounded-xl p-4 zone-card ${ZONE_CSS[zone]} space-y-3`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{ZONE_EMOJI[zone]}</span>
                  <h3 className="font-bold text-sm text-foreground">{zone}</h3>
                  <span className="ml-auto text-xs text-muted-foreground">{pending.length} / {zoneTasks.length}</span>
                </div>
                {pending.map((task) => (
                  <TaskCard key={task.id} task={task} canComplete canDelete onDelete={() => deleteTask(task.id)} />
                ))}
                {done.map((task) => (
                  <TaskCard key={task.id} task={task} canComplete={false} canDelete onDelete={() => deleteTask(task.id)} />
                ))}
                {zoneTasks.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Aucune tâche</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks
            .sort((a, b) => {
              if (a.status === 'done' && b.status !== 'done') return 1;
              if (a.status !== 'done' && b.status === 'done') return -1;
              return a.deadline.getTime() - b.deadline.getTime();
            })
            .map((task) => (
              <TaskCard key={task.id} task={task} canComplete canDelete onDelete={() => deleteTask(task.id)} />
            ))}
          {filteredTasks.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-sm">Aucune tâche pour aujourd'hui</p>
            </div>
          )}
        </div>
      )}

      {showCreateModal && <CreateTaskModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
}
