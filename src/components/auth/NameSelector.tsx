import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';
import { TEAM_CSS, TEAM_LABELS } from '../../data/initialData';
import { ChevronRight, Search, Wine, ChefHat, Layers, Settings, Users } from 'lucide-react';

interface NameSelectorProps {
  onSelect: (user: User) => void;
}

const TEAM_ICONS: Record<string, React.ReactNode> = {
  BAR: <Wine className="w-4 h-4" />,
  KITCHEN: <ChefHat className="w-4 h-4" />,
  FLOOR: <Users className="w-4 h-4" />,
  ATELIER: <Layers className="w-4 h-4" />,
  MANAGEMENT: <Settings className="w-4 h-4" />,
};

export function NameSelector({ onSelect }: NameSelectorProps) {
  const { users } = useApp();
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const teams = ['BAR', 'KITCHEN', 'ATELIER', 'MANAGEMENT'];

  const filteredUsers = users.filter((u) => {
    const matchTeam = !selectedTeam || u.team === selectedTeam;
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase());
    return matchTeam && matchSearch;
  });

  const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Team filter */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-medium">Team</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTeam(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              !selectedTeam ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
            }`}
          >
            All
          </button>
          {teams.map((team) => (
            <button
              key={team}
              onClick={() => setSelectedTeam(team === selectedTeam ? null : team)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all team-badge ${TEAM_CSS[team]} ${
                selectedTeam === team ? 'ring-1 ring-current' : 'opacity-60 hover:opacity-100'
              }`}
            >
              {TEAM_ICONS[team]}
              {TEAM_LABELS[team]}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search..."
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
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center team-card ${TEAM_CSS[user.team]} flex-shrink-0`}>
                {user.photo ? (
                  <img src={user.photo} alt={user.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <span className="text-xs font-bold">{getInitials(user.name)}</span>
                )}
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-foreground leading-tight">{user.name}</p>
                <p className="text-xs text-muted-foreground leading-tight flex items-center gap-1">
                  {TEAM_ICONS[user.team]}
                  <span>
                    {user.role === 'owner' ? 'Owner' : user.role === 'manager' ? 'Manager' : TEAM_LABELS[user.team]}
                  </span>
                  {!user.pinSet && <span className="ml-1 text-amber-400">· New</span>}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
          </button>
        ))}
        {filteredUsers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No results found</p>
        )}
      </div>
    </div>
  );
}
