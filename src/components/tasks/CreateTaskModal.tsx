import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Team } from '../../types';
import { X, Clock, Users, AlignLeft, Calendar, Zap, RefreshCw, Camera, Plus, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';

interface CreateTaskModalProps {
  onClose: () => void;
}

const TEAM_OPTIONS: { value: Team; label: string }[] = [
  { value: 'FLOOR',      label: 'Restaurant' },
  { value: 'KITCHEN',    label: 'Cuisine' },
  { value: 'ATELIER',    label: 'Pâtisserie' },
  { value: 'MANAGEMENT', label: 'Managers' },
  { value: 'ALL',        label: 'Tous' },
];

const DAYS = [
  { key: 'lundi',    label: 'L' },
  { key: 'mardi',    label: 'M' },
  { key: 'mercredi', label: 'Me' },
  { key: 'jeudi',    label: 'J' },
  { key: 'vendredi', label: 'V' },
  { key: 'samedi',   label: 'S' },
  { key: 'dimanche', label: 'D' },
];

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="w-8 text-center text-[15px] font-bold text-foreground">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function CreateTaskModal({ onClose }: CreateTaskModalProps) {
  const { currentUser, users } = useApp();

  // Base fields
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [team, setTeam]               = useState<Team>('ALL');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [deadlineDate, setDeadlineDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [deadlineTime, setDeadlineTime] = useState('09:00');
  const [priority, setPriority]       = useState<'normale' | 'urgente'>('normale');
  const [submitting, setSubmitting]   = useState(false);

  // Recurrence
  const [isRecurring, setIsRecurring]       = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState<string[]>([]);
  const [occurrences, setOccurrences]       = useState(1);
  const [recurrenceTimes, setRecurrenceTimes] = useState<string[]>(['09:00']);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  // Photo proofs
  const [requirePhotos, setRequirePhotos] = useState(false);
  const [photoCount, setPhotoCount]       = useState(1);
  const [photoTitles, setPhotoTitles]     = useState<string[]>(['']);

  // Only show staff/chef for assignment
  const assignableUsers = users.filter((u) =>
    (team === 'ALL' || u.team === team) &&
    (u.role === 'staff' || u.role === 'chef')
  );

  // Handle occurrences stepper — keep times array in sync
  const handleOccurrencesChange = (v: number) => {
    setOccurrences(v);
    setRecurrenceTimes((prev) => {
      const next = [...prev];
      while (next.length < v) next.push('09:00');
      while (next.length > v) next.pop();
      return next;
    });
  };

  // Handle photo count stepper — keep titles array in sync
  const handlePhotoCountChange = (v: number) => {
    setPhotoCount(v);
    setPhotoTitles((prev) => {
      const next = [...prev];
      while (next.length < v) next.push('');
      while (next.length > v) next.pop();
      return next;
    });
  };

  const toggleDay = (day: string) => {
    setRecurrenceDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);

    try {
      let deadlineTs: string;
      if (isRecurring) {
        // Use first recurrence time as the deadline reference, today's date
        const today = new Date().toISOString().split('T')[0];
        const firstTime = recurrenceTimes[0] || '09:00';
        deadlineTs = `${today}T${firstTime}:00`;
      } else {
        deadlineTs = `${deadlineDate}T${deadlineTime}:00`;
      }

      const assignedUser = users.find((u) => u.id === assignedUserId);

      const { error } = await supabase.from('tasks').insert({
        name: name.trim(),
        team: team as 'BAR' | 'KITCHEN' | 'FLOOR' | 'ATELIER' | 'MANAGEMENT' | 'ALL',
        description: description.trim() || null,
        deadline: deadlineTs,
        status: 'pending',
        is_recurring: isRecurring,
        is_punctual: !isRecurring,
        assigned_user_id: assignedUserId || null,
        assigned_user_name: assignedUser?.name || null,
        created_by: currentUser?.id || null,
        points: priority === 'urgente' ? 20 : 10,
        priority: priority,
        // Recurrence
        recurrence_days: isRecurring ? recurrenceDays : [],
        recurrence_times: isRecurring ? recurrenceTimes : [],
        recurrence_end_date: isRecurring && recurrenceEndDate ? recurrenceEndDate : null,
        // Photo proofs
        photo_proofs_required: requirePhotos ? photoCount : 0,
        photo_proofs_titles: requirePhotos ? photoTitles.filter(Boolean) : [],
      });

      if (error) throw error;
      onClose();
    } catch (err) {
      console.error('Erreur création tâche:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-md border border-border shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
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

          {/* 1. Titre */}
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

          {/* 2. Description */}
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

          {/* 3. Équipe */}
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

          {/* 4. Assignée à */}
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Assignée à
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

          {/* 5. Date + Heure limite (masqué si récurrence ON) */}
          {!isRecurring && (
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
                  required={!isRecurring}
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
                  required={!isRecurring}
                  className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                />
              </div>
            </div>
          )}

          {/* 6. Priorité */}
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

          {/* 7. RÉCURRENCE */}
          <div className="rounded-xl border border-border overflow-hidden">
            {/* Toggle header */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/50">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-primary" />
                <span className="text-[14px] font-semibold text-foreground">Tâche récurrente</span>
              </div>
              <Switch
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
            </div>

            {isRecurring && (
              <div className="px-4 py-4 flex flex-col gap-4 border-t border-border">

                {/* A. Jours de la semaine */}
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                    Jours
                  </label>
                  <div className="flex gap-1.5">
                    {DAYS.map((d) => (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => toggleDay(d.key)}
                        className={`w-9 h-9 rounded-lg text-[12px] font-bold border transition-all ${
                          recurrenceDays.includes(d.key)
                            ? 'bg-green-800 text-white border-green-700'
                            : 'bg-muted text-muted-foreground border-border hover:border-green-600'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* B. Occurrences par jour */}
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                    Combien de fois par jour ?
                  </label>
                  <Stepper value={occurrences} min={1} max={10} onChange={handleOccurrencesChange} />
                </div>

                {/* Champs d'heure dynamiques */}
                <div className="flex flex-col gap-2">
                  {recurrenceTimes.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <label className="text-[13px] text-muted-foreground w-16 shrink-0">
                        {occurrences === 1 ? 'Heure' : `Heure ${i + 1}`}
                      </label>
                      <input
                        type="time"
                        value={t}
                        onChange={(e) => {
                          const updated = [...recurrenceTimes];
                          updated[i] = e.target.value;
                          setRecurrenceTimes(updated);
                        }}
                        className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
                      />
                    </div>
                  ))}
                </div>

                {/* C. Date de fin (optionnel) */}
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Jusqu'au <span className="text-muted-foreground/60 normal-case font-normal">(optionnel)</span>
                  </label>
                  <input
                    type="date"
                    value={recurrenceEndDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
                  />
                </div>

              </div>
            )}
          </div>

          {/* 8. PREUVES PHOTO */}
          <div className="rounded-xl border border-border overflow-hidden">
            {/* Toggle header */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/50">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" />
                <span className="text-[14px] font-semibold text-foreground">Photos obligatoires</span>
              </div>
              <Switch
                checked={requirePhotos}
                onCheckedChange={setRequirePhotos}
              />
            </div>

            {requirePhotos && (
              <div className="px-4 py-4 flex flex-col gap-3 border-t border-border">

                {/* Stepper nombre de photos */}
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                    Nombre de photos
                  </label>
                  <Stepper value={photoCount} min={1} max={5} onChange={handlePhotoCountChange} />
                </div>

                {/* Titres dynamiques */}
                <div className="flex flex-col gap-2">
                  {photoTitles.map((title, i) => (
                    <div key={i}>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => {
                          const updated = [...photoTitles];
                          updated[i] = e.target.value;
                          setPhotoTitles(updated);
                        }}
                        placeholder={
                          i === 0 ? 'Ex : Vue d\'ensemble des WC' :
                          i === 1 ? 'Ex : Sol nettoyé' :
                          i === 2 ? 'Ex : Poubelles vidées' :
                          `Titre photo ${i + 1}`
                        }
                        maxLength={80}
                        className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
                      />
                      <p className="text-[11px] text-muted-foreground mt-0.5 ml-1">Photo {i + 1}</p>
                    </div>
                  ))}
                </div>

              </div>
            )}
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
