import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Zone } from '../../types';
import { X, Clock, MapPin } from 'lucide-react';
import { ZONE_LABELS } from '../../data/initialData';

interface CreateTaskModalProps {
  onClose: () => void;
}

export function CreateTaskModal({ onClose }: CreateTaskModalProps) {
  const { createPunctualTask, currentUser, users } = useApp();
  const [name, setName] = useState('');
  const [zone, setZone] = useState<Zone>('BAR');
  const [description, setDescription] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');

  const zones: Zone[] = ['BAR', 'CUISINE', 'ATELIER', 'ALL'];
  const staffInZone = users.filter((u) => u.zone === zone && u.role === 'staff');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !deadlineTime) return;

    const [h, m] = deadlineTime.split(':').map(Number);
    const deadline = new Date();
    deadline.setHours(h, m, 0, 0);

    const assignedUser = users.find((u) => u.id === assignedUserId);

    createPunctualTask({
      name: name.trim(),
      zone,
      description: description.trim(),
      deadline,
      status: deadline < new Date() ? 'overdue' : 'pending',
      isRecurring: false,
      isPunctual: true,
      assignedUserId: assignedUserId || undefined,
      assignedUserName: assignedUser?.name,
      createdBy: currentUser?.name || 'Manager',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="glass-card rounded-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Nouvelle tâche ponctuelle</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Nom de la tâche
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Nettoyer les frigos..."
              required
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                <MapPin className="w-3 h-3 inline mr-1" />Zone
              </label>
              <select
                value={zone}
                onChange={(e) => { setZone(e.target.value as Zone); setAssignedUserId(''); }}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
              >
                {zones.map((z) => (
                  <option key={z} value={z}>{ZONE_LABELS[z]}</option>
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

          {zone !== 'ALL' && staffInZone.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Assigner à (optionnel)
              </label>
              <select
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
              >
                <option value="">Toute la zone</option>
                {staffInZone.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Description (optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instructions supplémentaires..."
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
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Créer la tâche
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
