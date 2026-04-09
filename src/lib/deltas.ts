import type { StandingRow } from '@/types/domain';

interface SnapshotRowInput {
  participantId: string;
  participantSlug: string;
  participantName: string;
  totalPoints: number;
  groupPoints: number;
  knockoutPoints: number;
  specialPoints: number;
}

export function withDeltas(
  current: SnapshotRowInput[],
  previous: SnapshotRowInput[] = [],
): StandingRow[] {
  const previousMap = new Map(previous.map((row, index) => [row.participantId, { row, rank: index + 1 }]));
  const ranked = [...current].sort(
    (left, right) => right.totalPoints - left.totalPoints || left.participantName.localeCompare(right.participantName, 'es'),
  );

  return ranked.map((row, index) => {
    const rank = index + 1;
    const previousMeta = previousMap.get(row.participantId);
    const previousRank = previousMeta?.rank ?? null;
    const deltaRank = previousRank === null ? null : previousRank - rank;
    const previousPoints = previousMeta?.row.totalPoints ?? null;
    const deltaPoints = previousPoints === null ? null : row.totalPoints - previousPoints;

    return {
      participantId: row.participantId,
      participantSlug: row.participantSlug,
      participantName: row.participantName,
      rank,
      totalPoints: row.totalPoints,
      groupPoints: row.groupPoints,
      knockoutPoints: row.knockoutPoints,
      specialPoints: row.specialPoints,
      previousRank,
      deltaRank,
      deltaPoints,
      isLeader: rank === 1,
      isNewLeader: rank === 1 && previousRank !== 1,
    };
  });
}
