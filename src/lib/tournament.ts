import type { OfficialMatch, TournamentStatus } from '@/types/domain';

export function getTournamentStatus(now: Date, worldCupStartUtc: string, matches: OfficialMatch[]): TournamentStatus {
  const start = new Date(worldCupStartUtc).getTime();
  const nowTime = now.getTime();
  const hasStarted = nowTime >= start;
  const pending = matches.some((match) => match.status !== 'completed');

  if (!hasStarted) {
    return 'pre';
  }

  if (pending) {
    return 'live';
  }

  return 'finished';
}

export function getNextPendingMatch(now: Date, matches: OfficialMatch[]): OfficialMatch | null {
  const sorted = [...matches].sort(
    (left, right) => new Date(left.kickoffUtc).getTime() - new Date(right.kickoffUtc).getTime(),
  );

  return (
    sorted.find((match) => match.status !== 'completed' && new Date(match.kickoffUtc).getTime() >= now.getTime()) ??
    sorted.find((match) => match.status !== 'completed') ??
    null
  );
}
