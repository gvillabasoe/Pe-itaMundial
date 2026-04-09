export type HomeTab = 'clasificacion' | 'resultados' | 'estadisticas';
export type TournamentStatus = 'pre' | 'live' | 'finished';
export type MatchStatus = 'scheduled' | 'live' | 'completed';
export type StageKey =
  | 'group'
  | 'round32'
  | 'round16'
  | 'quarterfinal'
  | 'semifinal'
  | 'thirdPlace'
  | 'final';
export type PickStateTone = 'green' | 'yellow' | 'gold' | 'silver' | 'red' | 'pending';
export type ComparisonWinner = 'left' | 'right' | 'tie';

export interface Team {
  id: string;
  name: string;
  shortName: string;
  flagEmoji: string;
}

export interface TournamentMeta {
  id: string;
  name: string;
  timezone: 'Europe/Madrid';
  entryFeeCents: number;
  worldCupStartUtc: string;
}

export interface SnapshotMeta {
  id: string;
  publishedAtUtc: string;
  label: string;
  sourceLabel: string;
}

export interface StandingRow {
  participantId: string;
  participantSlug: string;
  participantName: string;
  rank: number;
  totalPoints: number;
  groupPoints: number;
  knockoutPoints: number;
  specialPoints: number;
  deltaRank: number | null;
  deltaPoints: number | null;
  previousRank: number | null;
  isLeader: boolean;
  isNewLeader: boolean;
}

export interface OfficialScore {
  home: number;
  away: number;
}

export interface OfficialMatch {
  id: string;
  stage: StageKey;
  group: string | null;
  matchNumber: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoffUtc: string;
  venue: string;
  city: string;
  status: MatchStatus;
  score: OfficialScore | null;
}

export interface ConsensusTeamChoice {
  teamId: string;
  count: number;
  pct: number;
}

export interface ConsensusFinalChoice {
  homeTeamId: string;
  awayTeamId: string;
  count: number;
  pct: number;
}

export interface MostDoubledMatch {
  matchId: string;
  count: number;
  pct: number;
}

export interface ExecutiveHighlight {
  key: string;
  label: string;
  value: string;
  secondary: string;
}

export interface HomeStats {
  championConsensus: ConsensusTeamChoice[];
  repeatedFinals: ConsensusFinalChoice[];
  mostDoubledMatch: MostDoubledMatch | null;
  biggestRiser: StandingRow | null;
  biggestFaller: StandingRow | null;
  executiveHighlights: ExecutiveHighlight[];
}

export interface StagePick {
  slot: number;
  teamId: string | null;
  points: number | null;
  tone: PickStateTone;
}

export interface GroupStandingPick {
  position: number;
  teamId: string;
  points: number | null;
  tone: PickStateTone;
}

export interface MatchPick {
  matchId: string;
  predictedScore: string | null;
  predictedSign: '1' | 'X' | '2' | null;
  isDouble: boolean;
  points: number | null;
  tone: PickStateTone;
}

export interface ParticipantGroupBlock {
  group: string;
  standings: GroupStandingPick[];
  matchPicks: MatchPick[];
}

export interface SpecialPick {
  key: string;
  label: string;
  value: string;
  points: number | null;
  tone: PickStateTone;
}

export interface ScoreBreakdownItem {
  key: string;
  label: string;
  points: number;
}

export interface ParticipantPageData {
  participantId: string;
  participantSlug: string;
  participantName: string;
  standing: StandingRow;
  groups: ParticipantGroupBlock[];
  round32: StagePick[];
  round16: StagePick[];
  quarterfinals: StagePick[];
  semifinals: StagePick[];
  final: StagePick[];
  podium: {
    champion: StagePick;
    runnerUp: StagePick;
    thirdPlace: StagePick;
  };
  specials: SpecialPick[];
  scoreBreakdown: ScoreBreakdownItem[];
}

export interface VersusValue {
  label: string;
  value: string;
  points: number | null;
  tone: PickStateTone;
}

export interface VersusRow {
  key: string;
  label: string;
  left: VersusValue;
  right: VersusValue;
  winner: ComparisonWinner;
}

export interface VersusBlock {
  key: string;
  title: string;
  leftPoints: number;
  rightPoints: number;
  winner: ComparisonWinner;
  rows: VersusRow[];
}

export interface PoolAppData {
  meta: TournamentMeta;
  snapshots: {
    current: SnapshotMeta;
    previous: SnapshotMeta | null;
  };
  teams: Team[];
  standings: StandingRow[];
  matches: OfficialMatch[];
  homeStats: HomeStats;
  participants: ParticipantPageData[];
}
