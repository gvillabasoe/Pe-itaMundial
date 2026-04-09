import { CountdownOrNextMatch } from '@/components/home/countdown-or-next-match';
import { ScoringLegend } from '@/components/shared/scoring-legend';
import { QuickParticipantSearch } from '@/components/shared/quick-participant-search';
import { formatCurrency, formatPublishedAt, formatNumber } from '@/lib/format';
import type { PoolAppData } from '@/types/domain';

interface HomeHeaderProps {
  appData: PoolAppData;
}

export function HomeHeader({ appData }: HomeHeaderProps) {
  const participantsCount = appData.standings.length;
  const potTotal = participantsCount * appData.meta.entryFeeCents;
  const nextMatchItems = appData.matches.map((match) => {
    const home = appData.teams.find((team) => team.id === match.homeTeamId)?.name ?? match.homeTeamId;
    const away = appData.teams.find((team) => team.id === match.awayTeamId)?.name ?? match.awayTeamId;
    return {
      id: match.id,
      label: `${home} - ${away}`,
      kickoffUtc: match.kickoffUtc,
      venue: match.venue,
      city: match.city,
      status: match.status,
    };
  });

  return (
    <section className="homeHeaderShell">
      <div className="homeHeaderTop">
        <CountdownOrNextMatch worldCupStartUtc={appData.meta.worldCupStartUtc} matches={nextMatchItems} />
        <div className="homeMetricsPanel">
          <div className="metricCard">
            <span className="metricLabel">Participantes</span>
            <strong className="metricValue">{formatNumber(participantsCount)}</strong>
          </div>
          <div className="metricCard">
            <span className="metricLabel">Bote total</span>
            <strong className="metricValue">{formatCurrency(potTotal)}</strong>
          </div>
          <div className="metricCard">
            <span className="metricLabel">Última actualización</span>
            <strong className="metricValue small">{formatPublishedAt(appData.snapshots.current.publishedAtUtc)}</strong>
          </div>
        </div>
      </div>

      <div className="homeHeaderBottom">
        <ScoringLegend />
        <QuickParticipantSearch
          participants={appData.standings.map((row) => ({ slug: row.participantSlug, name: row.participantName }))}
        />
      </div>
    </section>
  );
}
