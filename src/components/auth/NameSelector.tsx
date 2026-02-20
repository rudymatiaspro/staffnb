import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';
import { ChevronRight, Search } from 'lucide-react';

interface NameSelectorProps {
  onSelect: (user: User) => void;
}

// French role labels
const ROLE_LABELS_FR: Record<string, string> = {
  god:     'Administrateur',
  admin:   'Administrateur',
  owner:   'Propriétaire',
  manager: 'Manager',
  chef:    'Chef de Cuisine',
  staff:   'Staff Salle',
};

// Role sort order (lower = higher priority in list)
// 'station' is excluded from the PIN list — it logs in via email+PIN on AuthLogin
const ROLE_ORDER: Record<string, number> = {
  god:     0,
  admin:   1,
  owner:   2,
  manager: 3,
  chef:    4,
  staff:   5,
};

// Per-profile position overrides (by name) for fine-grained labels
const NAME_POSITION: Record<string, string> = {
  Hoa:   'Chef de Cuisine',
  Quynh: 'Chef Pâtissier',
  Thinh: 'Sous-Chef',
  Ken:   'Sous-Chef',
  Lena:  'Staff Salle',
  Phat:  'Staff Salle',
  Tran:  'Staff Salle',
  Rudy:  'Administrateur',
  Hanh:  'Propriétaire',
  Cuong: 'Manager',
  Quan:  'Manager',
};

function getPositionLabel(user: User): string {
  return NAME_POSITION[user.name] ?? ROLE_LABELS_FR[user.role] ?? user.role;
}

// Avatar background — neutral, no team colour
const AVATAR_COLORS = [
  'bg-primary/15 text-primary',
  'bg-accent/20 text-accent-foreground',
  'bg-muted text-muted-foreground',
];

function avatarClass(name: string): string {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export function NameSelector({ onSelect }: NameSelectorProps) {
  const { users } = useApp();
  const [search, setSearch] = useState('');

  // Station accounts log in via email+PIN on the main auth screen — exclude them here
  const eligibleUsers = users.filter((u) => u.role !== 'station');

  // Sort by role hierarchy then alphabetically
  const sortedUsers = [...eligibleUsers].sort((a, b) => {
    const ro = (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99);
    if (ro !== 0) return ro;
    return a.name.localeCompare(b.name);
  });

  const filteredUsers = sortedUsers.filter((u) =>
    !search || u.name.toLowerCase().includes(search.toLowerCase())
  );

  const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-4 animate-slide-up">
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
      <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
        {filteredUsers.map((user) => (
          <button
            key={user.id}
            onClick={() => onSelect(user)}
            className="w-full flex items-center justify-between p-3 rounded-xl glass-card hover:border-primary/40 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${avatarClass(user.name)}`}>
                {user.photo ? (
                  <img src={user.photo} alt={user.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <span className="text-xs font-bold">{getInitials(user.name)}</span>
                )}
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-foreground leading-tight">{user.name}</p>
                <p className="text-xs text-muted-foreground leading-tight flex items-center gap-1">
                  <span>{getPositionLabel(user)}</span>
                  {!user.pinSet && (
                    <span className="ml-1 text-[hsl(var(--timer-warning))]">· Premier login</span>
                  )}
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
