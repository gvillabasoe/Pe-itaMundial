interface DeltaChipProps {
  deltaRank: number | null;
  deltaPoints: number | null;
}

export function DeltaChip({ deltaRank, deltaPoints }: DeltaChipProps) {
  if (deltaRank === null && deltaPoints === null) {
    return <span className="deltaChip neutral">Sin histórico</span>;
  }

  const isUp = (deltaRank ?? 0) > 0 || (deltaPoints ?? 0) > 0;
  const isDown = (deltaRank ?? 0) < 0 || (deltaPoints ?? 0) < 0;
  const tone = isUp ? 'up' : isDown ? 'down' : 'neutral';

  return (
    <span className={`deltaChip ${tone}`}>
      {deltaRank !== null ? `Δ pos ${deltaRank > 0 ? '+' : ''}${deltaRank}` : 'Δ pos 0'}
      {deltaPoints !== null ? ` · Δ pts ${deltaPoints > 0 ? '+' : ''}${deltaPoints}` : ''}
    </span>
  );
}
