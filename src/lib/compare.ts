import type {
  ComparisonWinner,
  ParticipantPageData,
  PickStateTone,
  PoolAppData,
  SpecialPick,
  StagePick,
  VersusBlock,
  VersusRow,
} from '@/types/domain';

function winnerFromPoints(leftPoints: number, rightPoints: number): ComparisonWinner {
  if (leftPoints === rightPoints) return 'tie';
  return leftPoints > rightPoints ? 'left' : 'right';
}

function normalizePoints(points: number | null): number {
  return points ?? 0;
}

function teamName(appData: PoolAppData, teamId: string | null): string {
  if (!teamId) return 'Pendiente';
  return appData.teams.find((team) => team.id === teamId)?.name ?? teamId;
}

function buildValue(label: string, points: number | null, tone: PickStateTone) {
  return { label, value: label, points, tone };
}

function compareStageRows(
  appData: PoolAppData,
  leftLabel: string,
  rightLabel: string,
  leftPicks: StagePick[],
  rightPicks: StagePick[],
): VersusRow[] {
  const maxSlots = Math.max(leftPicks.length, rightPicks.length);

  return Array.from({ length: maxSlots }, (_, index) => {
    const left = leftPicks[index] ?? { slot: index + 1, teamId: null, points: null, tone: 'pending' as const };
    const right = rightPicks[index] ?? { slot: index + 1, teamId: null, points: null, tone: 'pending' as const };
    const leftPoints = normalizePoints(left.points);
    const rightPoints = normalizePoints(right.points);

    return {
      key: `${leftLabel}-${rightLabel}-${index + 1}`,
      label: `Slot ${index + 1}`,
      left: buildValue(teamName(appData, left.teamId), left.points, left.tone),
      right: buildValue(teamName(appData, right.teamId), right.points, right.tone),
      winner: winnerFromPoints(leftPoints, rightPoints),
    };
  });
}

function compareSpecialRows(left: SpecialPick[], right: SpecialPick[]): VersusRow[] {
  const maxRows = Math.max(left.length, right.length);

  return Array.from({ length: maxRows }, (_, index) => {
    const leftItem = left[index] ?? { key: `left-${index}`, label: 'Pendiente', value: 'Pendiente', points: null, tone: 'pending' as const };
    const rightItem = right[index] ?? { key: `right-${index}`, label: leftItem.label, value: 'Pendiente', points: null, tone: 'pending' as const };
    return {
      key: leftItem.key,
      label: leftItem.label,
      left: buildValue(leftItem.value, leftItem.points, leftItem.tone),
      right: buildValue(rightItem.value, rightItem.points, rightItem.tone),
      winner: winnerFromPoints(normalizePoints(leftItem.points), normalizePoints(rightItem.points)),
    };
  });
}

function compareGroupRows(appData: PoolAppData, left: ParticipantPageData, right: ParticipantPageData): VersusRow[] {
  const rows: VersusRow[] = [];

  left.groups.forEach((group) => {
    group.matchPicks.forEach((pick) => {
      const rightGroup = right.groups.find((candidate) => candidate.group === group.group);
      const rightPick = rightGroup?.matchPicks.find((candidate) => candidate.matchId === pick.matchId);
      const match = appData.matches.find((candidate) => candidate.id === pick.matchId);
      const label = match
        ? `${teamName(appData, match.homeTeamId)} - ${teamName(appData, match.awayTeamId)}`
        : pick.matchId;

      rows.push({
        key: `${group.group}-${pick.matchId}`,
        label,
        left: buildValue(pick.predictedScore ?? 'Pendiente', pick.points, pick.tone),
        right: buildValue(rightPick?.predictedScore ?? 'Pendiente', rightPick?.points ?? null, rightPick?.tone ?? 'pending'),
        winner: winnerFromPoints(normalizePoints(pick.points), normalizePoints(rightPick?.points ?? null)),
      });
    });
  });

  return rows;
}

function sumRows(rows: VersusRow[], side: 'left' | 'right'): number {
  return rows.reduce((total, row) => total + normalizePoints(row[side].points), 0);
}

function block(key: string, title: string, rows: VersusRow[]): VersusBlock {
  const leftPoints = sumRows(rows, 'left');
  const rightPoints = sumRows(rows, 'right');

  return {
    key,
    title,
    rows,
    leftPoints,
    rightPoints,
    winner: winnerFromPoints(leftPoints, rightPoints),
  };
}

export function buildVersusBlocks(appData: PoolAppData, left: ParticipantPageData, right: ParticipantPageData): VersusBlock[] {
  const podiumRows: VersusRow[] = [
    {
      key: 'podium-champion',
      label: 'Campeón',
      left: buildValue(teamName(appData, left.podium.champion.teamId), left.podium.champion.points, left.podium.champion.tone),
      right: buildValue(teamName(appData, right.podium.champion.teamId), right.podium.champion.points, right.podium.champion.tone),
      winner: winnerFromPoints(normalizePoints(left.podium.champion.points), normalizePoints(right.podium.champion.points)),
    },
    {
      key: 'podium-runner-up',
      label: 'Subcampeón',
      left: buildValue(teamName(appData, left.podium.runnerUp.teamId), left.podium.runnerUp.points, left.podium.runnerUp.tone),
      right: buildValue(teamName(appData, right.podium.runnerUp.teamId), right.podium.runnerUp.points, right.podium.runnerUp.tone),
      winner: winnerFromPoints(normalizePoints(left.podium.runnerUp.points), normalizePoints(right.podium.runnerUp.points)),
    },
    {
      key: 'podium-third-place',
      label: 'Tercer puesto',
      left: buildValue(teamName(appData, left.podium.thirdPlace.teamId), left.podium.thirdPlace.points, left.podium.thirdPlace.tone),
      right: buildValue(teamName(appData, right.podium.thirdPlace.teamId), right.podium.thirdPlace.points, right.podium.thirdPlace.tone),
      winner: winnerFromPoints(normalizePoints(left.podium.thirdPlace.points), normalizePoints(right.podium.thirdPlace.points)),
    },
  ];

  return [
    block('groups', 'Grupos', compareGroupRows(appData, left, right)),
    block('round16', 'Fases', [
      ...compareStageRows(appData, left.participantName, right.participantName, left.round32, right.round32),
      ...compareStageRows(appData, left.participantName, right.participantName, left.round16, right.round16),
      ...compareStageRows(appData, left.participantName, right.participantName, left.quarterfinals, right.quarterfinals),
      ...compareStageRows(appData, left.participantName, right.participantName, left.semifinals, right.semifinals),
      ...compareStageRows(appData, left.participantName, right.participantName, left.final, right.final),
    ]),
    block('podium', 'Podio', podiumRows),
    block('specials', 'Especiales', compareSpecialRows(left.specials, right.specials)),
  ];
}
