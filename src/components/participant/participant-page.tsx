import Link from 'next/link';
import { Card } from '@/components/shared/card';
import { DeltaChip } from '@/components/shared/delta-chip';
import { EmptyState } from '@/components/shared/empty-state';
import { ScoreStateBadge } from '@/components/shared/score-state-badge';
import { formatNumber } from '@/lib/format';
import { versusHref } from '@/lib/routes';
import type { ParticipantPageData, PoolAppData, StagePick } from '@/types/domain';

interface ParticipantPageProps {
  appData: PoolAppData;
  participant: ParticipantPageData | null;
}

function teamName(appData: PoolAppData, teamId: string | null) {
  if (!teamId) return 'Pendiente';
  return appData.teams.find((team) => team.id === teamId)?.name ?? teamId;
}

function StageSection({ title, picks, appData }: { title: string; picks: StagePick[]; appData: PoolAppData }) {
  if (!picks.length) {
    return <EmptyState title="Sin picks" text="Este bloque todavía no tiene contenido." />;
  }

  return (
    <div className="pickGrid">
      {picks.map((pick) => (
        <article key={`${title}-${pick.slot}`} className="pickCard">
          <div className="pickHeader">
            <span className="pickSlot">Slot {pick.slot}</span>
            <ScoreStateBadge tone={pick.tone} compact />
          </div>
          <strong>{teamName(appData, pick.teamId)}</strong>
          <span className="pickPoints">{pick.points === null ? '?' : `${pick.points} pts`}</span>
        </article>
      ))}
    </div>
  );
}

export function ParticipantPage({ appData, participant }: ParticipantPageProps) {
  if (!participant) {
    return <EmptyState title="Participante no encontrado" text="Revisa el slug o vuelve a Home." />;
  }

  const leader = appData.standings[0];
  const defaultRival = appData.standings.find((row) => row.participantId !== participant.participantId) ?? leader;

  return (
    <div className="pageStack">
      <section className="heroPanel">
        <div>
          <div className="eyebrow">Participante</div>
          <h1 className="heroTitle">{participant.participantName}</h1>
          <p className="heroText">Vista individual con picks, desglose y puntos, sin repetir la leyenda visual de scoring fuera de Home.</p>
        </div>
        <div className="heroSummaryGrid">
          <article className="metricCard large">
            <span className="metricLabel">Posición actual</span>
            <strong className="metricValue">#{participant.standing.rank}</strong>
            <DeltaChip deltaRank={participant.standing.deltaRank} deltaPoints={participant.standing.deltaPoints} />
          </article>
          <article className="metricCard">
            <span className="metricLabel">Puntos totales</span>
            <strong className="metricValue">{formatNumber(participant.standing.totalPoints)}</strong>
          </article>
          <article className="metricCard">
            <span className="metricLabel">Grupos / KO / Especiales</span>
            <strong className="metricValue small">
              {participant.standing.groupPoints} / {participant.standing.knockoutPoints} / {participant.standing.specialPoints}
            </strong>
          </article>
          <article className="metricCard">
            <span className="metricLabel">Acceso útil</span>
            <Link className="inlineLink" href={versusHref(participant.participantSlug, defaultRival.participantSlug)}>
              Abrir versus con {defaultRival.participantName}
            </Link>
          </article>
        </div>
      </section>

      <Card title="Grupos" subtitle="Picks por grupo, posiciones y resultados.">
        <div className="stackSection">
          {participant.groups.map((group) => (
            <section key={group.group} className="groupBlock">
              <header className="groupBlockHeader">
                <strong>Grupo {group.group}</strong>
              </header>
              <div className="groupStandingsGrid">
                {group.standings.map((row) => (
                  <article key={`${group.group}-${row.position}`} className="miniListCard">
                    <span className="pickSlot">{row.position}</span>
                    <strong>{teamName(appData, row.teamId)}</strong>
                    <div className="inlineMeta">
                      <ScoreStateBadge tone={row.tone} compact />
                      <span>{row.points === null ? '?' : `${row.points} pts`}</span>
                    </div>
                  </article>
                ))}
              </div>
              <div className="resultsList compact">
                {group.matchPicks.map((pick) => {
                  const match = appData.matches.find((candidate) => candidate.id === pick.matchId);
                  return (
                    <article key={pick.matchId} className="resultRow compact">
                      <div className="resultHeader">
                        <strong>
                          {match ? `${teamName(appData, match.homeTeamId)} - ${teamName(appData, match.awayTeamId)}` : pick.matchId}
                        </strong>
                        <ScoreStateBadge tone={pick.tone} compact />
                      </div>
                      <div className="resultMeta">
                        <span>Resultado: {pick.predictedScore ?? 'Pendiente'}</span>
                        <span>Signo: {pick.predictedSign ?? 'Pendiente'}</span>
                        <span>DOB: {pick.isDouble ? 'Sí' : 'No'}</span>
                        <span>{pick.points === null ? '?' : `${pick.points} pts`}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </Card>

      <Card title="Fases" subtitle="La estructura actual de Participante se conserva, pero con jerarquía más limpia y compresión mejor resuelta en móvil.">
        <div className="stackSection">
          <section>
            <h3 className="sectionMiniTitle">Dieciseisavos</h3>
            <StageSection title="Dieciseisavos" picks={participant.round32} appData={appData} />
          </section>
          <section>
            <h3 className="sectionMiniTitle">Octavos</h3>
            <StageSection title="Octavos" picks={participant.round16} appData={appData} />
          </section>
          <section>
            <h3 className="sectionMiniTitle">Cuartos</h3>
            <StageSection title="Cuartos" picks={participant.quarterfinals} appData={appData} />
          </section>
          <section>
            <h3 className="sectionMiniTitle">Semifinales</h3>
            <StageSection title="Semifinales" picks={participant.semifinals} appData={appData} />
          </section>
          <section>
            <h3 className="sectionMiniTitle">Final</h3>
            <StageSection title="Final" picks={participant.final} appData={appData} />
          </section>
        </div>
      </Card>

      <div className="twoColumnGrid">
        <Card title="Podio">
          <div className="pickGrid">
            <article className="pickCard">
              <div className="pickHeader"><span className="pickSlot">Campeón</span><ScoreStateBadge tone={participant.podium.champion.tone} compact /></div>
              <strong>{teamName(appData, participant.podium.champion.teamId)}</strong>
              <span className="pickPoints">{participant.podium.champion.points ?? '?'} pts</span>
            </article>
            <article className="pickCard">
              <div className="pickHeader"><span className="pickSlot">Subcampeón</span><ScoreStateBadge tone={participant.podium.runnerUp.tone} compact /></div>
              <strong>{teamName(appData, participant.podium.runnerUp.teamId)}</strong>
              <span className="pickPoints">{participant.podium.runnerUp.points ?? '?'} pts</span>
            </article>
            <article className="pickCard">
              <div className="pickHeader"><span className="pickSlot">Tercer puesto</span><ScoreStateBadge tone={participant.podium.thirdPlace.tone} compact /></div>
              <strong>{teamName(appData, participant.podium.thirdPlace.teamId)}</strong>
              <span className="pickPoints">{participant.podium.thirdPlace.points ?? '?'} pts</span>
            </article>
          </div>
        </Card>

        <Card title="Especiales">
          <div className="stackList">
            {participant.specials.map((item) => (
              <div key={item.key} className="stackListRow static">
                <span>{item.label}: {item.value}</span>
                <div className="inlineMeta">
                  <ScoreStateBadge tone={item.tone} compact />
                  <strong>{item.points ?? '?'} pts</strong>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Desglose de puntos">
        <div className="stackList">
          {participant.scoreBreakdown.map((item) => (
            <div key={item.key} className="stackListRow static">
              <span>{item.label}</span>
              <strong>{item.points} pts</strong>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
