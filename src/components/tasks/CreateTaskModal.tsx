import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Team } from '../../types';
import { X, Clock, Users } from 'lucide-react';
import { TEAM_LABELS } from '../../data/initialData';

interface CreateTaskModalProps {
  onClose: () => void;
}

export function CreateTaskModal({ onClose }: CreateTaskModalProps) {
  const { createPunctualTask, currentUser, users } = useApp();
  const [name, setName] = useState('');
  const [team, setTeam] = useState<Team>('BAR');
  const [description, setDescription] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');

  const teams: Team[] = ['BAR', 'KITCHEN', 'ATELIER', 'ALL'];
  const staffInTeam = users.filter((u) => u.team === team && u.role === 'staff');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !deadlineTime) return;

    const [h, m] = deadlineTime.split(':').map(Number);
    const deadline = new Date();
    deadline.setHours(h, m, 0, 0);

    const assignedUser = users.find((u) => u.id === assignedUserId);

    createPunctualTask({
      name: name.trim(),
      team,
      description: description.trim(),
      deadline,
      status: deadline < new Date() ? 'overdue' : 'pending',
      isRecurring: false,
      isPunctual: true,
      assignedUserId: assignedUserId || undefined,
      assignedUserName: assignedUser?.name,
      createdBy: currentUser?.name || 'Manager',
      points: 10,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="glass-card rounded-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">New Task</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Task Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Clean the fridges..."
              required
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                <Users className="w-3 h-3 inline mr-1" />Team
              </label>
              <select
                value={team}
                onChange={(e) => { setTeam(e.target.value as Team); setAssignedUserId(''); }}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
              >
                {teams.map((t) => (
                  <option key={t} value={t}>{TEAM_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                <Clock className="w-3 h-3 inline mr-1" />Deadline
              </label>
              <input
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {team !== 'ALL' && staffInTeam.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Assign to (optional)
              </label>
              <select
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
              >
                <option value="">Whole team</option>
                {staffInTeam.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional instructions..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
