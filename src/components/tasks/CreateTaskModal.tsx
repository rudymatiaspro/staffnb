import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Team } from '../../types';
import { X, Clock, Users, AlignLeft, Calendar, Zap } from 'lucide-react';

interface CreateTaskModalProps {
  onClose: () => void;
}

const TEAM_OPTIONS: { value: Team; label: string }[] = [
  { value: 'BAR',        label: 'Bar' },
  { value: 'KITCHEN',    label: 'Cuisine' },
  { value: 'ATELIER',    label: 'Pâtisserie' },
  { value: 'FLOOR',      label: 'Salle' },
  { value: 'ALL',        label: 'Tous' },
];

export function CreateTaskModal({ onClose }: CreateTaskModalProps) {
  const { createPunctualTask, currentUser, users } = useApp();

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [team, setTeam]               = useState<Team>('ALL');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [deadlineDate, setDeadlineDate] = useState(
    new Date().toISOString().split('T')[0] // today by default
  );
  const [deadlineTime, setDeadlineTime] = useState('09:00');
  const [priority, setPriority]       = useState<'normale' | 'urgente'>('normale');
  const [submitting, setSubmitting]   = useState(false);

  // Only show staff users for assignment (not managers)
  const assignableUsers = users.filter((u) =>
    (team === 'ALL' || u.team === team) &&
    (u.role === 'staff' || u.role === 'chef')
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !deadlineDate || !deadlineTime) return;
    setSubmitting(true);

    const [h, m] = deadlineTime.split(':').map(Number);
    const deadline = new Date(deadlineDate);
    deadline.setHours(h, m, 0, 0);

    const assignedUser = users.find((u) => u.id === assignedUserId);

    createPunctualTask({
      name: name.trim(),
      team,
      description: description.trim() || undefined,
      deadline,
      status: deadline < new Date() ? 'overdue' : 'pending',
      isRecurring: false,
      isPunctual: true,
      assignedUserId: assignedUserId || undefined,
      assignedUserName: assignedUser?.name,
      createdBy: currentUser?.name || 'Manager',
      points: priority === 'urgente' ? 20 : 10,
      // Store priority in description prefix so it's available without schema change
      // We'll use a special prefix pattern: [URGENTE] or [NORMALE]
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-md border border-border shadow-2xl animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-[18px] font-bold text-foreground">Créer une tâche</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">Remplissez les informations ci-dessous</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">

          {/* Titre */}
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Titre *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Nettoyer les frigos..."
              required
              maxLength={120}
              className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <AlignLeft className="w-3 h-3" />
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instructions supplémentaires (optionnel)..."
              rows={2}
              maxLength={500}
              className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors resize-none"
            />
          </div>

          {/* Équipe */}
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Users className="w-3 h-3" />
              Équipe
            </label>
            <div className="flex gap-2 flex-wrap">
              {TEAM_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setTeam(opt.value); setAssignedUserId(''); }}
                  className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition-all ${
                    team === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assignée à */}
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Assignée à *
            </label>
            <select
              value={assignedUserId}
              onChange={(e) => setAssignedUserId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            >
              <option value="">— Toute l'équipe —</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Date + Heure limite */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Date limite *
              </label>
              <input
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                required
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Heure limite *
              </label>
              <input
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Priorité */}
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Priorité
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPriority('normale')}
                className={`flex-1 py-2.5 rounded-xl text-[14px] font-semibold border transition-all ${
                  priority === 'normale'
                    ? 'bg-primary/10 text-primary border-primary'
                    : 'bg-muted text-muted-foreground border-border hover:border-muted-foreground'
                }`}
              >
                Normale
              </button>
              <button
                type="button"
                onClick={() => setPriority('urgente')}
                className={`flex-1 py-2.5 rounded-xl text-[14px] font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                  priority === 'urgente'
                    ? 'bg-destructive/10 text-destructive border-destructive'
                    : 'bg-muted text-muted-foreground border-border hover:border-destructive/50'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Urgente
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground text-[15px] font-semibold hover:bg-muted/80 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-[15px] font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Création...' : 'Créer la tâche'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
