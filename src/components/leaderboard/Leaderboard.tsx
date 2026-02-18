import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';
import { TEAM_CSS, TEAM_LABELS } from '../../data/initialData';
import { Trophy, Medal, TrendingUp, Wine, ChefHat, Layers, PersonStanding, Settings, Users } from 'lucide-react';

type Period = 'week' | 'month' | 'alltime';

const TEAM_ICONS: Record<string, React.ReactNode> = {
  BAR: <Wine className="w-3 h-3" />,
  KITCHEN: <ChefHat className="w-3 h-3" />,
  FLOOR: <PersonStanding className="w-3 h-3" />,
  ATELIER: <Layers className="w-3 h-3" />,
  MANAGEMENT: <Settings className="w-3 h-3" />,
  ALL: <Users className="w-3 h-3" />,
};

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

// Deterministic demo score based on user id + period
function getDemoScore(user: User, period: Period): number {
  const seed = user.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const base = ((seed * 17) % 200) + 80;
  if (period === 'month') return base * 5 + ((seed * 3) % 100);
  if (period === 'alltime') return base * 22 + ((seed * 7) % 500);
  return base;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center bg-amber-400/20 border border-amber-400">
      <Trophy className="w-3.5 h-3.5 text-amber-400" />
    </div>
  );
  if (rank === 2) return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'hsl(220 10% 65% / 0.15)', border: '1px solid hsl(220 10% 65%)' }}>
      <Medal className="w-3.5 h-3.5" style={{ color: 'hsl(220 10% 65%)' }} />
    </div>
  );
  if (rank === 3) return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'hsl(25 65% 50% / 0.15)', border: '1px solid hsl(25 65% 50%)' }}>
      <Medal className="w-3.5 h-3.5" style={{ color: 'hsl(25 65% 50%)' }} />
    </div>
  );
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center bg-secondary">
      <span className="text-xs font-bold text-muted-foreground">{rank}</span>
    </div>
  );
}

function Avatar({ user, rank }: { user: User; rank: number }) {
  const rankClass = rank === 1 ? 'rank-gold' : rank === 2 ? 'rank-silver' : rank === 3 ? 'rank-bronze' : '';
  const teamColor = TEAM_CSS[user.team] || '';

  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden flex-shrink-0 ${rankClass}`}
      style={!user.photo ? {
        background: `hsl(var(--team-${user.team.toLowerCase()}) / 0.18)`,
        color: `hsl(var(--team-${user.team.toLowerCase()}))`,
      } : undefined}
    >
      {user.photo
        ? <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
        : getInitials(user.name)
      }
    </div>
  );
}

export function Leaderboard() {
  const { users, currentUser } = useApp();
  const [period, setPeriod] = useState<Period>('week');

  const staffUsers = users.filter((u) => u.role === 'staff');

  const ranked = useMemo(() => {
    return [...staffUsers]
      .map((u) => ({ user: u, score: getDemoScore(u, period) }))
      .sort((a, b) => b.score - a.score);
  }, [staffUsers, period]);

  const topScore = ranked[0]?.score || 1;
  const myEntry = ranked.find((e) => e.user.id === currentUser?.id);
  const myRank = myEntry ? ranked.indexOf(myEntry) + 1 : null;

  const periods: { id: Period; label: string }[] = [
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'alltime', label: 'All Time' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-foreground">Leaderboard</h2>
        </div>
        {myRank && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
            <TrendingUp className="w-3 h-3 text-primary" />
            <span className="text-xs font-semibold text-primary">You're #{myRank}</span>
          </div>
        )}
      </div>

      {/* Period toggle */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl">
        {periods.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              period === p.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Top 3 podium */}
      {ranked.length >= 3 && (
        <div className="grid grid-cols-3 gap-2 mb-2">
          {/* 2nd */}
          <div className="flex flex-col items-center gap-2 pt-4">
            <Avatar user={ranked[1].user} rank={2} />
            <div className="text-center">
              <p className="text-xs font-semibold text-foreground truncate max-w-[70px]">{ranked[1].user.name}</p>
              <p className="text-sm font-bold text-foreground">{ranked[1].score}</p>
              <p className="text-[10px] text-muted-foreground">pts</p>
            </div>
            <div className="w-full h-12 rounded-t-lg flex items-end justify-center pb-1" style={{ background: 'hsl(220 10% 65% / 0.2)' }}>
              <span className="text-xs font-bold" style={{ color: 'hsl(220 10% 55%)' }}>2</span>
            </div>
          </div>
          {/* 1st */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <Avatar user={ranked[0].user} rank={1} />
              <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                <Trophy className="w-4 h-4 text-amber-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-foreground truncate max-w-[70px]">{ranked[0].user.name}</p>
              <p className="text-base font-black text-foreground">{ranked[0].score}</p>
              <p className="text-[10px] text-muted-foreground">pts</p>
            </div>
            <div className="w-full h-16 rounded-t-lg flex items-end justify-center pb-1 bg-amber-400/20">
              <span className="text-sm font-black text-amber-500">1</span>
            </div>
          </div>
          {/* 3rd */}
          <div className="flex flex-col items-center gap-2 pt-6">
            <Avatar user={ranked[2].user} rank={3} />
            <div className="text-center">
              <p className="text-xs font-semibold text-foreground truncate max-w-[70px]">{ranked[2].user.name}</p>
              <p className="text-sm font-bold text-foreground">{ranked[2].score}</p>
              <p className="text-[10px] text-muted-foreground">pts</p>
            </div>
            <div className="w-full h-8 rounded-t-lg flex items-end justify-center pb-1" style={{ background: 'hsl(25 65% 50% / 0.18)' }}>
              <span className="text-xs font-bold" style={{ color: 'hsl(25 55% 45%)' }}>3</span>
            </div>
          </div>
        </div>
      )}

      {/* Full ranking list */}
      <div className="glass-card rounded-xl divide-y divide-border">
        {ranked.map((entry, idx) => {
          const rank = idx + 1;
          const isMe = entry.user.id === currentUser?.id;
          const pct = Math.round((entry.score / topScore) * 100);

          return (
            <div
              key={entry.user.id}
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                isMe ? 'bg-primary/5' : 'hover:bg-secondary/50'
              }`}
            >
              <RankBadge rank={rank} />

              <Avatar user={entry.user} rank={rank} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-semibold truncate ${isMe ? 'text-primary' : 'text-foreground'}`}>
                    {entry.user.name}
                    {isMe && <span className="text-xs font-normal text-muted-foreground ml-1">(you)</span>}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md team-badge ${TEAM_CSS[entry.user.team]} flex items-center gap-1 flex-shrink-0`}>
                    {TEAM_ICONS[entry.user.team]}
                    {TEAM_LABELS[entry.user.team]}
                  </span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: rank === 1
                        ? 'hsl(43 100% 55%)'
                        : rank === 2
                        ? 'hsl(220 10% 65%)'
                        : rank === 3
                        ? 'hsl(25 65% 50%)'
                        : 'hsl(var(--primary))',
                    }}
                  />
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-foreground">{entry.score}</p>
                <p className="text-[10px] text-muted-foreground">pts</p>
              </div>
            </div>
          );
        })}

        {ranked.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <Trophy className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No data yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
