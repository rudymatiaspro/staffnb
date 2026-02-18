import { useApp } from '../../context/AppContext';
import { Team } from '../../types';
import { TEAM_CSS, TEAM_LABELS } from '../../data/initialData';
import { Trophy, TrendingDown, AlertTriangle, Medal } from 'lucide-react';

interface TeamScoreCardProps {
  team: Team;
  compact?: boolean;
}

export function BonusScoreCard({ team, compact = false }: TeamScoreCardProps) {
  const { getTeamScore } = useApp();
  const score = getTeamScore(team);
  const percentage = score.baseBonus > 0 ? Math.max(0, Math.min(100, (score.currentBonus / score.baseBonus) * 100)) : 0;

  const colorClass =
    percentage >= 80 ? 'text-timer-safe' :
    percentage >= 50 ? 'text-timer-warning' :
    'text-timer-danger';

  const barColor =
    percentage >= 80 ? 'bg-timer-safe' :
    percentage >= 50 ? 'bg-timer-warning' :
    'bg-timer-danger';

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl team-card ${TEAM_CSS[team]} border`}>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{TEAM_LABELS[team]}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="flex-1 h-1 bg-background/30 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${percentage}%` }} />
            </div>
          </div>
        </div>
        <span className={`text-sm font-bold font-mono ${colorClass}`}>{score.currentBonus}pt</span>
        {score.malusEvents.length > 0 && <AlertTriangle className="w-3 h-3 text-timer-danger" />}
      </div>
    );
  }

  return (
    <div className={`rounded-2xl p-5 team-card ${TEAM_CSS[team]}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Medal className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{TEAM_LABELS[team]}</p>
              <p className="text-sm font-semibold text-foreground">Daily ShiftScore</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-bold font-mono ${colorClass}`}>{score.currentBonus}</p>
          <p className="text-xs text-muted-foreground">/ {score.baseBonus} pts</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 bg-background/30 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{Math.round(percentage)}% of base bonus</span>
        </div>
        {score.malusEvents.length > 0 && (
          <div className="flex items-center gap-1 text-timer-danger">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>{score.malusEvents.length} penalties · -{score.totalMalus} pts</span>
          </div>
        )}
      </div>

      {/* Recent malus events */}
      {score.malusEvents.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/30 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Penalties</p>
          {score.malusEvents.slice(-3).reverse().map((me) => (
            <div key={me.id} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate">{me.taskName}</span>
              <span className="text-timer-danger font-bold flex-shrink-0 ml-2">-{me.points}pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
