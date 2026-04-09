import Link from 'next/link';
import { Card } from '@/components/shared/card';
import { DeltaChip } from '@/components/shared/delta-chip';
import { EmptyState } from '@/components/shared/empty-state';
import { ScoreStateBadge } from '@/components/shared/score-state-badge';
import { VersusPicker } from '@/components/versus/versus-picker';
import { buildVersusBlocks } from '@/lib/compare';
import { formatNumber } from '@/lib/format';
import { participantHref } from '@/lib/routes';
import type { ParticipantPageData, PoolAppData } from '@/types/domain';

interface VersusPageProps {
  appData: PoolAppData;
  left: ParticipantPageData | null;
  right: ParticipantPageData | null;
  mode: 'participant' | 'general';
}

export function VersusPage({ appData, left, right, mode }: VersusPageProps) {
  if (!left || !right) {
    return <EmptyState title="Versus no disponible" text="Selecciona dos participantes válidos." />;
  }

  const generalReference = appData.standings[0];
  const effectiveRight = mode === 'general'
    ? appData.participants.find((participant) => participant.participantId === generalReference.participantId) ?? right
    : right;
  const blocks = buildVersusBlocks(appData, left, effectiveRight);

  return (
    <div className="pageStack">
      <section className="heroPanel">
        <div>
          <div className="eyebrow">Versus</div>
          <h1 className="heroTitle">{left.participantName} vs {mode === 'general' ? 'General' : effectiveRight.participantName}</h1>
          <p className="heroText">Comparación por bloques, puntos y estado visual unificado.</p>
        </div>
        <div className="heroSummaryGrid">
          <article className="metricCard">
            <span className="metricLabel">{left.participantName}</span>
            <strong className="metricValue">{formatNumber(left.standing.totalPoints)}</strong>
            <DeltaChip deltaRank={left.standing.deltaRank} deltaPoints={left.standing.deltaPoints} />
          </article>
          <article className="metricCard">
            <span className="metricLabel">{mode === 'general' ? 'General' : effectiveRight.participantName}</span>
            <strong className="metricValue">{formatNumber(effectiveRight.standing.totalPoints)}</strong>
            <DeltaChip deltaRank={effectiveRight.standing.deltaRank} deltaPoints={effectiveRight.standing.deltaPoints} />
          </article>
          <article className="metricCard large">
            <span className="metricLabel">Accesos</span>
            <div className="ctaColumn">
              <Link className="inlineLink" href={participantHref(left.participantSlug)}>Abrir {left.participantName}</Link>
              <Link className="inlineLink" href={participantHref(effectiveRight.participantSlug)}>Abrir {mode === 'general' ? 'referencia general' : effectiveRight.participantName}</Link>
            </div>
          </article>
        </div>
      </section>

      <VersusPicker
        participants={appData.standings.map((row) => ({ slug: row.participantSlug, name: row.participantName }))}
        activeLeft={left.participantSlug}
        activeRight={effectiveRight.participantSlug}
        mode={mode}
      />

      <div className="stackSection">
        {blocks.map((block) => (
          <Card
            key={block.key}
            title={block.title}
            aside={<span className={`winnerBadge ${block.winner}`}>{block.winner === 'tie' ? 'Empate' : block.winner === 'left' ? left.participantName : mode === 'general' ? 'General' : effectiveRight.participantName}</span>}
          >
            <div className="versusBlockHeader">
              <strong>{left.participantName}: {block.leftPoints}</strong>
              <strong>{mode === 'general' ? 'General' : effectiveRight.participantName}: {block.rightPoints}</strong>
            </div>
            <div className="versusRows">
              {block.rows.map((row) => (
                <article key={row.key} className="versusRow">
                  <div className="versusLabel">{row.label}</div>
                  <div className="versusSide">
                    <strong>{row.left.value}</strong>
                    <div className="inlineMeta">
                      <ScoreStateBadge tone={row.left.tone} compact />
                      <span>{row.left.points ?? '?'}</span>
                    </div>
                  </div>
                  <div className="versusSide">
                    <strong>{row.right.value}</strong>
                    <div className="inlineMeta">
                      <ScoreStateBadge tone={row.right.tone} compact />
                      <span>{row.right.points ?? '?'}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
