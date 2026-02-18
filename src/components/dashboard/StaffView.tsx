import { useApp } from '../../context/AppContext';
import { TaskCard } from '../tasks/TaskCard';
import { BonusScoreCard } from '../zones/BonusScoreCard';
import { Zone } from '../../types';
import { CheckCircle, Clock, Star } from 'lucide-react';

export function StaffView() {
  const { currentUser, getTodayTasks } = useApp();
  const zone = currentUser?.zone as Zone;

  const allTasks = getTodayTasks(zone);
  const pendingTasks = allTasks.filter((t) => t.status !== 'done').sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  const doneTasks = allTasks.filter((t) => t.status === 'done');

  return (
    <div className="space-y-6">
      {/* Bonus score */}
      {zone && zone !== 'MANAGEMENT' && (
        <BonusScoreCard zone={zone} />
      )}

      {/* Pending tasks */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Tâches en attente
          </h2>
          {pendingTasks.length > 0 && (
            <span className="ml-auto text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
              {pendingTasks.length}
            </span>
          )}
        </div>
        {pendingTasks.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Toutes les tâches sont complétées ! 🎉</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingTasks.map((task) => (
              <TaskCard key={task.id} task={task} canComplete />
            ))}
          </div>
        )}
      </section>

      {/* Completed tasks */}
      {doneTasks.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Complétées aujourd'hui
            </h2>
            <span className="ml-auto text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              {doneTasks.length}
            </span>
          </div>
          <div className="space-y-2">
            {doneTasks.map((task) => (
              <TaskCard key={task.id} task={task} canComplete={false} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
