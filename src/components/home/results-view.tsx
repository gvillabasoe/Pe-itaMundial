import { Card } from '@/components/shared/card';
import { formatMadridDateLong } from '@/lib/format';
import { STAGE_LABELS } from '@/lib/constants';
import type { OfficialMatch, Team } from '@/types/domain';

interface ResultsViewProps {
  matches: OfficialMatch[];
  teams: Team[];
}

function teamName(teams: Team[], teamId: string) {
  return teams.find((team) => team.id === teamId)?.name ?? teamId;
}

export function ResultsView({ matches, teams }: ResultsViewProps) {
  return (
    <Card title="Partidos oficiales" subtitle="Solo calendario y resultados oficiales en horario de España.">
      <div className="resultsList">
        {matches.map((match) => (
          <article key={match.id} className="resultRow">
            <div className="resultHeader">
              <span className="eyebrow">{STAGE_LABELS[match.stage]}{match.group ? ` · Grupo ${match.group}` : ''}</span>
              <strong>{teamName(teams, match.homeTeamId)} - {teamName(teams, match.awayTeamId)}</strong>
            </div>
            <div className="resultMeta">
              {match.status === 'completed' && match.score
                ? `${match.score.home}-${match.score.away}`
                : formatMadridDateLong(match.kickoffUtc)}
              <span>{match.city}</span>
              <span>{match.venue}</span>
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}
