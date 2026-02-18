import { useApp } from '../../context/AppContext';
import { Zone } from '../../types';
import { ZONE_CSS, ZONE_EMOJI, ZONE_LABELS } from '../../data/initialData';
import { Trophy, TrendingDown } from 'lucide-react';

interface BonusScoreCardProps {
  zone: Zone;
  compact?: boolean;
}

export function BonusScoreCard({ zone, compact = false }: BonusScoreCardProps) {
  const { getZoneScore } = useApp();
  const score = getZoneScore(zone);
  const percentage = Math.max(0, Math.min(100, (score.currentBonus / score.baseBonus) * 100));

  const getScoreColor = () => {
    if (percentage >= 80) return 'text-timer-safe';
    if (percentage >= 50) return 'text-timer-warning';
    return 'text-timer-danger';
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg zone-card ${ZONE_CSS[zone]}`}>
        <Trophy className="w-3.5 h-3.5" style={{ color: `hsl(var(--zone-${zone.toLowerCase()}-light, var(--zone-all-light)))` }} />
        <span className="text-xs font-bold" style={{ color: `hsl(var(--zone-${zone.toLowerCase()}-light, var(--zone-all-light)))` }}>
          {score.currentBonus}pts
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl p-4 zone-card ${ZONE_CSS[zone]}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{ZONE_EMOJI[zone]}</span>
          <div>
            <p className="text-xs text-muted-foreground">Bonus du jour</p>
            <p className="text-sm font-semibold text-foreground">{zone}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold font-mono ${getScoreColor()}`}>{score.currentBonus}</p>
          <p className="text-xs text-muted-foreground">/ {score.baseBonus} pts</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-background/40 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            percentage >= 80 ? 'bg-timer-safe' : percentage >= 50 ? 'bg-timer-warning' : 'bg-timer-danger'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {score.malusEvents.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
          <TrendingDown className="w-3 h-3" />
          <span>{score.malusEvents.length} malus · -{score.totalMalus} pts</span>
        </div>
      )}
    </div>
  );
}
