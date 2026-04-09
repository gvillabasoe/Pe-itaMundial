import Link from 'next/link';
import { Card } from '@/components/shared/card';
import { DeltaChip } from '@/components/shared/delta-chip';
import { formatNumber, formatPercent } from '@/lib/format';
import { participantHref } from '@/lib/routes';
import type { HomeStats, StandingRow, Team } from '@/types/domain';

interface ClassificationViewProps {
  standings: StandingRow[];
  stats: HomeStats;
  teams: Team[];
}

function teamName(teams: Team[], teamId: string) {
  return teams.find((team) => team.id === teamId)?.name ?? teamId;
}

export function ClassificationView({ standings, stats, teams }: ClassificationViewProps) {
  const leader = standings[0];
  const chasers = standings.slice(1, 3);
  const rankingRows = standings.slice(0, 10);
  const champion = stats.championConsensus[0];
  const repeatedFinal = stats.repeatedFinals[0];

  return (
    <div className="homeStack">
      <div className="narrativeGrid">
        <Card title="Líder actual" className="heroCard">
          <div className="metricValue">{leader.participantName}</div>
          <div className="metricMeta">{formatNumber(leader.totalPoints)} puntos</div>
          <DeltaChip deltaRank={leader.deltaRank} deltaPoints={leader.deltaPoints} />
          <div className="ctaRow">
            <Link className="inlineLink" href={participantHref(leader.participantSlug)}>Abrir participante</Link>
          </div>
        </Card>

        <Card title="Perseguidores inmediatos">
          <div className="stackList">
            {chasers.map((row) => (
              <Link key={row.participantId} className="stackListRow" href={participantHref(row.participantSlug)}>
                <span>#{row.rank} {row.participantName}</span>
                <strong>{formatNumber(row.totalPoints)}</strong>
              </Link>
            ))}
          </div>
        </Card>

        <Card title="Consenso de campeón">
          {champion ? (
            <>
              <div className="metricValue">{teamName(teams, champion.teamId)}</div>
              <div className="metricMeta">{champion.count} picks · {formatPercent(champion.pct)}</div>
            </>
          ) : null}
        </Card>

        <Card title="Final más repetida">
          {repeatedFinal ? (
            <>
              <div className="metricValue small">{teamName(teams, repeatedFinal.homeTeamId)} - {teamName(teams, repeatedFinal.awayTeamId)}</div>
              <div className="metricMeta">{repeatedFinal.count} picks · {formatPercent(repeatedFinal.pct)}</div>
            </>
          ) : null}
        </Card>
      </div>

      <Card title="Ranking actual" subtitle="La primera lectura es narrativa; el ranking completo queda por debajo para no aplastar la entrada.">
        <div className="rankingTableWrapper">
          <table className="rankingTable">
            <thead>
              <tr>
                <th>Pos.</th>
                <th>Participante</th>
                <th>Total</th>
                <th>Δ</th>
              </tr>
            </thead>
            <tbody>
              {rankingRows.map((row) => (
                <tr key={row.participantId}>
                  <td>#{row.rank}</td>
                  <td>
                    <Link className="inlineLink" href={participantHref(row.participantSlug)}>
                      {row.participantName}
                    </Link>
                  </td>
                  <td>{formatNumber(row.totalPoints)}</td>
                  <td>
                    <DeltaChip deltaRank={row.deltaRank} deltaPoints={row.deltaPoints} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
