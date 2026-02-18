import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';
import { ZONE_CSS, ZONE_EMOJI } from '../../data/initialData';
import { ChevronRight } from 'lucide-react';

interface NameSelectorProps {
  onSelect: (user: User) => void;
}

export function NameSelector({ onSelect }: NameSelectorProps) {
  const { users } = useApp();
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const zones = ['BAR', 'CUISINE', 'ATELIER', 'MANAGEMENT'];
  const filteredUsers = selectedZone
    ? users.filter((u) => u.zone === selectedZone)
    : users;

  return (
    <div className="animate-slide-up space-y-6">
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-widest">
          Filtrer par zone
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedZone(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              selectedZone === null
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-muted'
            }`}
          >
            Tous
          </button>
          {zones.map((zone) => (
            <button
              key={zone}
              onClick={() => setSelectedZone(zone === selectedZone ? null : zone)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                selectedZone === zone
                  ? `zone-badge ${ZONE_CSS[zone]} ring-1 ring-current`
                  : `zone-badge ${ZONE_CSS[zone]} opacity-70 hover:opacity-100`
              }`}
            >
              {ZONE_EMOJI[zone]} {zone}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filteredUsers.map((user) => (
          <button
            key={user.id}
            onClick={() => onSelect(user)}
            className="w-full flex items-center justify-between p-4 rounded-xl glass-card hover:border-primary/40 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center zone-card ${ZONE_CSS[user.zone]} text-lg font-bold`}>
                {ZONE_EMOJI[user.zone]}
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">{user.name}</p>
                <p className={`text-xs zone-badge px-2 py-0.5 rounded-md inline-block mt-0.5 ${ZONE_CSS[user.zone]}`}>
                  {user.zone}
                  {user.role === 'manager' && ' · Manager'}
                  {user.role === 'owner' && ' · Owner'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}
