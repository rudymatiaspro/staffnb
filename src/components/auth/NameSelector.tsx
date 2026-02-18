import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';
import { ZONE_CSS, ZONE_EMOJI, ZONE_LABELS } from '../../data/initialData';
import { ChevronRight, Search } from 'lucide-react';

interface NameSelectorProps {
  onSelect: (user: User) => void;
}

export function NameSelector({ onSelect }: NameSelectorProps) {
  const { users } = useApp();
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const zones = ['BAR', 'CUISINE', 'ATELIER', 'MANAGEMENT'];

  const filteredUsers = users.filter((u) => {
    const matchZone = !selectedZone || u.zone === selectedZone;
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase());
    return matchZone && matchSearch;
  });

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Zone filter */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-medium">Zone</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedZone(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              !selectedZone ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
            }`}
          >
            Tous
          </button>
          {zones.map((zone) => (
            <button
              key={zone}
              onClick={() => setSelectedZone(zone === selectedZone ? null : zone)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all zone-badge ${ZONE_CSS[zone]} ${
                selectedZone === zone ? 'ring-1 ring-current' : 'opacity-60 hover:opacity-100'
              }`}
            >
              {ZONE_EMOJI[zone]} {zone}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* User list */}
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {filteredUsers.map((user) => (
          <button
            key={user.id}
            onClick={() => onSelect(user)}
            className="w-full flex items-center justify-between p-3 rounded-xl glass-card hover:border-primary/40 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center zone-card ${ZONE_CSS[user.zone]} text-base flex-shrink-0`}>
                {ZONE_EMOJI[user.zone]}
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-foreground leading-tight">{user.name}</p>
                <p className="text-xs text-muted-foreground leading-tight">
                  {user.role === 'owner' ? '👑 Owner' : user.role === 'manager' ? '🔵 Manager' : user.zone}
                  {!user.pinSet && <span className="ml-1 text-timer-warning">· Nouveau</span>}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
          </button>
        ))}
        {filteredUsers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Aucun résultat</p>
        )}
      </div>
    </div>
  );
}
