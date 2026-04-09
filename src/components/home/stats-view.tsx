import { Card } from '@/components/shared/card';
import { DeltaChip } from '@/components/shared/delta-chip';
import { formatPercent } from '@/lib/format';
import { participantHref } from '@/lib/routes';
import type { HomeStats, OfficialMatch, Team } from '@/types/domain';
import Link from 'next/link';

interface StatsViewProps {
  stats: HomeStats;
  teams: Team[];
  matches: OfficialMatch[];
}

function teamName(teams: Team[], teamId: string) {
  return teams.find((team) => team.id === teamId)?.name ?? teamId;
}

export function StatsView({ stats, teams, matches }: StatsViewProps) {
  const champion = stats.championConsensus[0];
  const final = stats.repeatedFinals[0];
  const doubledMatch = stats.mostDoubledMatch ? matches.find((match) => match.id === stats.mostDoubledMatch?.matchId) : null;

  return (
    <div className="statsGrid">
      <Card title="Consenso de campeón">
        {champion ? (
          <>
            <div className="metricValue">{teamName(teams, champion.teamId)}</div>
            <div className="metricMeta">{champion.count} elecciones · {formatPercent(champion.pct)}</div>
          </>
        ) : null}
      </Card>

      <Card title="Final más repetida">
        {final ? (
          <>
            <div className="metricValue small">{teamName(teams, final.homeTeamId)} - {teamName(teams, final.awayTeamId)}</div>
            <div className="metricMeta">{final.count} elecciones · {formatPercent(final.pct)}</div>
          </>
        ) : null}
      </Card>

      <Card title="Partido con más dobles">
        {doubledMatch && stats.mostDoubledMatch ? (
          <>
            <div className="metricValue small">{teamName(teams, doubledMatch.homeTeamId)} - {teamName(teams, doubledMatch.awayTeamId)}</div>
            <div className="metricMeta">{stats.mostDoubledMatch.count} dobles · {formatPercent(stats.mostDoubledMatch.pct)}</div>
          </>
        ) : null}
      </Card>

      <Card title="Quién sube / quién baja">
        <div className="stackList">
          {stats.biggestRiser ? (
            <Link className="stackListRow" href={participantHref(stats.biggestRiser.participantSlug)}>
              <span>{stats.biggestRiser.participantName}</span>
              <DeltaChip deltaRank={stats.biggestRiser.deltaRank} deltaPoints={stats.biggestRiser.deltaPoints} />
            </Link>
          ) : null}
          {stats.biggestFaller ? (
            <Link className="stackListRow" href={participantHref(stats.biggestFaller.participantSlug)}>
              <span>{stats.biggestFaller.participantName}</span>
              <DeltaChip deltaRank={stats.biggestFaller.deltaRank} deltaPoints={stats.biggestFaller.deltaPoints} />
            </Link>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
