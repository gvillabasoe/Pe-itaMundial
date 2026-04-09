import type {
  HomeStats,
  MatchPick,
  OfficialMatch,
  ParticipantGroupBlock,
  ParticipantPageData,
  PickStateTone,
  PoolAppData,
  ScoreBreakdownItem,
  StagePick,
  Team,
} from '@/types/domain';
import { WORLD_CUP_START_UTC } from '@/lib/constants';
import { withDeltas } from '@/lib/deltas';
import { slugify } from '@/lib/slug';

const teams: Team[] = [
  { id: 'mexico', name: 'México', shortName: 'México', flagEmoji: '🇲🇽' },
  { id: 'sudafrica', name: 'Sudáfrica', shortName: 'Sudáfrica', flagEmoji: '🇿🇦' },
  { id: 'corea', name: 'Corea', shortName: 'Corea', flagEmoji: '🇰🇷' },
  { id: 'irlanda', name: 'Irlanda', shortName: 'Irlanda', flagEmoji: '🇮🇪' },
  { id: 'canada', name: 'Canadá', shortName: 'Canadá', flagEmoji: '🇨🇦' },
  { id: 'italia', name: 'Italia', shortName: 'Italia', flagEmoji: '🇮🇹' },
  { id: 'qatar', name: 'Qatar', shortName: 'Qatar', flagEmoji: '🇶🇦' },
  { id: 'suiza', name: 'Suiza', shortName: 'Suiza', flagEmoji: '🇨🇭' },
];

const currentSnapshot = withDeltas(
  [
    { participantId: 'txapeldun', participantSlug: slugify('Txapeldun'), participantName: 'Txapeldun', totalPoints: 132, groupPoints: 54, knockoutPoints: 58, specialPoints: 20 },
    { participantId: 'varmaster', participantSlug: slugify('VARMaster'), participantName: 'VARMaster', totalPoints: 127, groupPoints: 50, knockoutPoints: 56, specialPoints: 21 },
    { participantId: 'golenel90', participantSlug: slugify('GolEnEl90'), participantName: 'GolEnEl90', totalPoints: 118, groupPoints: 46, knockoutPoints: 51, specialPoints: 21 },
    { participantId: 'chiringuito', participantSlug: slugify('Chiringuito'), participantName: 'Chiringuito', totalPoints: 112, groupPoints: 43, knockoutPoints: 47, specialPoints: 22 },
    { participantId: 'lapizarra', participantSlug: slugify('LaPizarra'), participantName: 'LaPizarra', totalPoints: 102, groupPoints: 39, knockoutPoints: 45, specialPoints: 18 },
  ],
  [
    { participantId: 'txapeldun', participantSlug: slugify('Txapeldun'), participantName: 'Txapeldun', totalPoints: 124, groupPoints: 50, knockoutPoints: 55, specialPoints: 19 },
    { participantId: 'varmaster', participantSlug: slugify('VARMaster'), participantName: 'VARMaster', totalPoints: 126, groupPoints: 49, knockoutPoints: 56, specialPoints: 21 },
    { participantId: 'golenel90', participantSlug: slugify('GolEnEl90'), participantName: 'GolEnEl90', totalPoints: 110, groupPoints: 44, knockoutPoints: 47, specialPoints: 19 },
    { participantId: 'chiringuito', participantSlug: slugify('Chiringuito'), participantName: 'Chiringuito', totalPoints: 116, groupPoints: 45, knockoutPoints: 48, specialPoints: 23 },
    { participantId: 'lapizarra', participantSlug: slugify('LaPizarra'), participantName: 'LaPizarra', totalPoints: 100, groupPoints: 38, knockoutPoints: 44, specialPoints: 18 },
  ],
);

const matches: OfficialMatch[] = [
  {
    id: 'm1',
    stage: 'group',
    group: 'A',
    matchNumber: 1,
    homeTeamId: 'mexico',
    awayTeamId: 'sudafrica',
    kickoffUtc: '2026-06-11T19:00:00.000Z',
    venue: 'Estadio Azteca',
    city: 'Ciudad de México',
    status: 'scheduled',
    score: null,
  },
  {
    id: 'm2',
    stage: 'group',
    group: 'A',
    matchNumber: 2,
    homeTeamId: 'corea',
    awayTeamId: 'irlanda',
    kickoffUtc: '2026-06-12T16:00:00.000Z',
    venue: 'BMO Field',
    city: 'Toronto',
    status: 'scheduled',
    score: null,
  },
  {
    id: 'm3',
    stage: 'group',
    group: 'B',
    matchNumber: 3,
    homeTeamId: 'canada',
    awayTeamId: 'italia',
    kickoffUtc: '2026-06-12T19:00:00.000Z',
    venue: 'BC Place',
    city: 'Vancouver',
    status: 'scheduled',
    score: null,
  },
  {
    id: 'm4',
    stage: 'group',
    group: 'B',
    matchNumber: 4,
    homeTeamId: 'qatar',
    awayTeamId: 'suiza',
    kickoffUtc: '2026-06-13T01:00:00.000Z',
    venue: 'MetLife Stadium',
    city: 'Nueva York',
    status: 'scheduled',
    score: null,
  },
  {
    id: 'm5',
    stage: 'group',
    group: 'A',
    matchNumber: 5,
    homeTeamId: 'mexico',
    awayTeamId: 'corea',
    kickoffUtc: '2026-06-14T16:00:00.000Z',
    venue: 'NRG Stadium',
    city: 'Houston',
    status: 'scheduled',
    score: null,
  },
  {
    id: 'm6',
    stage: 'group',
    group: 'B',
    matchNumber: 6,
    homeTeamId: 'italia',
    awayTeamId: 'suiza',
    kickoffUtc: '2026-06-14T19:00:00.000Z',
    venue: 'SoFi Stadium',
    city: 'Los Ángeles',
    status: 'scheduled',
    score: null,
  },
];

function stagePick(slot: number, teamId: string | null, points: number | null, tone: PickStateTone): StagePick {
  return { slot, teamId, points, tone };
}

function matchPick(matchId: string, predictedScore: string | null, predictedSign: '1' | 'X' | '2' | null, isDouble: boolean, points: number | null, tone: PickStateTone): MatchPick {
  return { matchId, predictedScore, predictedSign, isDouble, points, tone };
}

function groupBlock(group: string, standings: Array<{ position: number; teamId: string; points: number | null; tone: PickStateTone }>, matchPicks: MatchPick[]): ParticipantGroupBlock {
  return { group, standings, matchPicks };
}

function scoreBreakdown(items: Array<[string, string, number]>): ScoreBreakdownItem[] {
  return items.map(([key, label, points]) => ({ key, label, points }));
}

function buildParticipantData(
  standing = currentSnapshot[0],
  options: {
    groups: ParticipantGroupBlock[];
    round32: StagePick[];
    round16: StagePick[];
    quarterfinals: StagePick[];
    semifinals: StagePick[];
    final: StagePick[];
    podium: ParticipantPageData['podium'];
    specials: ParticipantPageData['specials'];
    scoreBreakdown: ScoreBreakdownItem[];
  },
): ParticipantPageData {
  return {
    participantId: standing.participantId,
    participantSlug: standing.participantSlug,
    participantName: standing.participantName,
    standing,
    ...options,
  };
}

const participants: ParticipantPageData[] = [
  buildParticipantData(currentSnapshot[0], {
    groups: [
      groupBlock(
        'A',
        [
          { position: 1, teamId: 'mexico', points: 3, tone: 'green' },
          { position: 2, teamId: 'corea', points: 1, tone: 'green' },
          { position: 3, teamId: 'irlanda', points: 0, tone: 'red' },
          { position: 4, teamId: 'sudafrica', points: 0, tone: 'red' },
        ],
        [
          matchPick('m1', '2-1', '1', false, 3, 'green'),
          matchPick('m2', '1-1', 'X', false, 2, 'yellow'),
          matchPick('m5', '1-0', '1', true, 6, 'gold'),
        ],
      ),
      groupBlock(
        'B',
        [
          { position: 1, teamId: 'italia', points: 1, tone: 'green' },
          { position: 2, teamId: 'suiza', points: 0, tone: 'red' },
          { position: 3, teamId: 'canada', points: 0, tone: 'red' },
          { position: 4, teamId: 'qatar', points: 0, tone: 'red' },
        ],
        [
          matchPick('m3', '1-2', '2', false, 2, 'yellow'),
          matchPick('m4', '0-0', 'X', false, null, 'pending'),
          matchPick('m6', '2-1', '1', true, 4, 'silver'),
        ],
      ),
    ],
    round32: [stagePick(1, 'mexico', 6, 'green'), stagePick(2, 'italia', 6, 'green'), stagePick(3, 'suiza', 0, 'red'), stagePick(4, 'corea', null, 'pending')],
    round16: [stagePick(1, 'mexico', 10, 'green'), stagePick(2, 'italia', 10, 'green')],
    quarterfinals: [stagePick(1, 'mexico', 15, 'green'), stagePick(2, 'italia', 0, 'red')],
    semifinals: [stagePick(1, 'italia', 20, 'green'), stagePick(2, 'mexico', 0, 'red')],
    final: [stagePick(1, 'italia', 25, 'green'), stagePick(2, 'mexico', 0, 'red')],
    podium: {
      champion: stagePick(1, 'italia', 50, 'green'),
      runnerUp: stagePick(2, 'mexico', 0, 'red'),
      thirdPlace: stagePick(3, 'canada', 20, 'green'),
    },
    specials: [
      { key: 'mejor-jugador', label: 'Mejor jugador', value: 'Bellingham', points: 20, tone: 'green' },
      { key: 'mejor-jugador-joven', label: 'Mejor jugador joven', value: 'Yamal', points: 20, tone: 'green' },
      { key: 'mejor-portero', label: 'Mejor portero', value: 'Maignan', points: 0, tone: 'red' },
      { key: 'maximo-goleador', label: 'Máximo goleador', value: 'Mbappé', points: 20, tone: 'green' },
      { key: 'seleccion-revelacion', label: 'Selección revelación', value: 'Canadá', points: 10, tone: 'green' },
    ],
    scoreBreakdown: scoreBreakdown([
      ['groups', 'Fase de grupos', 54],
      ['round32', 'Dieciseisavos', 12],
      ['round16', 'Octavos', 20],
      ['quarters', 'Cuartos', 15],
      ['semis', 'Semifinales', 20],
      ['final', 'Final y podio', 11],
      ['specials', 'Especiales', 20],
    ]),
  }),
  buildParticipantData(currentSnapshot[1], {
    groups: [
      groupBlock(
        'A',
        [
          { position: 1, teamId: 'mexico', points: 1, tone: 'green' },
          { position: 2, teamId: 'irlanda', points: 1, tone: 'green' },
          { position: 3, teamId: 'corea', points: 0, tone: 'red' },
          { position: 4, teamId: 'sudafrica', points: 0, tone: 'red' },
        ],
        [
          matchPick('m1', '1-0', '1', true, 4, 'silver'),
          matchPick('m2', '0-1', '2', false, 3, 'green'),
          matchPick('m5', '2-1', '1', false, 2, 'yellow'),
        ],
      ),
      groupBlock(
        'B',
        [
          { position: 1, teamId: 'suiza', points: 1, tone: 'green' },
          { position: 2, teamId: 'italia', points: 0, tone: 'red' },
          { position: 3, teamId: 'canada', points: 0, tone: 'red' },
          { position: 4, teamId: 'qatar', points: 0, tone: 'red' },
        ],
        [
          matchPick('m3', '0-1', '2', false, 3, 'green'),
          matchPick('m4', '1-1', 'X', false, 2, 'yellow'),
          matchPick('m6', '1-1', 'X', true, 6, 'gold'),
        ],
      ),
    ],
    round32: [stagePick(1, 'mexico', 6, 'green'), stagePick(2, 'suiza', 6, 'green'), stagePick(3, 'italia', 0, 'red'), stagePick(4, 'irlanda', null, 'pending')],
    round16: [stagePick(1, 'mexico', 10, 'green'), stagePick(2, 'suiza', 0, 'red')],
    quarterfinals: [stagePick(1, 'mexico', 15, 'green'), stagePick(2, 'suiza', 15, 'green')],
    semifinals: [stagePick(1, 'mexico', 0, 'red'), stagePick(2, 'suiza', 20, 'green')],
    final: [stagePick(1, 'suiza', 25, 'green'), stagePick(2, 'mexico', 0, 'red')],
    podium: {
      champion: stagePick(1, 'suiza', 0, 'red'),
      runnerUp: stagePick(2, 'mexico', 30, 'green'),
      thirdPlace: stagePick(3, 'italia', 20, 'green'),
    },
    specials: [
      { key: 'mejor-jugador', label: 'Mejor jugador', value: 'Pedri', points: 0, tone: 'red' },
      { key: 'mejor-jugador-joven', label: 'Mejor jugador joven', value: 'Yamal', points: 20, tone: 'green' },
      { key: 'mejor-portero', label: 'Mejor portero', value: 'Sommer', points: 20, tone: 'green' },
      { key: 'maximo-goleador', label: 'Máximo goleador', value: 'Mbappé', points: 20, tone: 'green' },
      { key: 'seleccion-revelacion', label: 'Selección revelación', value: 'Suiza', points: 0, tone: 'red' },
    ],
    scoreBreakdown: scoreBreakdown([
      ['groups', 'Fase de grupos', 50],
      ['round32', 'Dieciseisavos', 12],
      ['round16', 'Octavos', 10],
      ['quarters', 'Cuartos', 30],
      ['semis', 'Semifinales', 20],
      ['final', 'Final y podio', 34],
      ['specials', 'Especiales', 21],
    ]),
  }),
  buildParticipantData(currentSnapshot[2], {
    groups: [
      groupBlock(
        'A',
        [
          { position: 1, teamId: 'corea', points: 0, tone: 'red' },
          { position: 2, teamId: 'mexico', points: 1, tone: 'green' },
          { position: 3, teamId: 'irlanda', points: 1, tone: 'green' },
          { position: 4, teamId: 'sudafrica', points: 0, tone: 'red' },
        ],
        [
          matchPick('m1', '1-1', 'X', false, 2, 'yellow'),
          matchPick('m2', '2-1', '1', false, 0, 'red'),
          matchPick('m5', '1-2', '2', true, 0, 'red'),
        ],
      ),
      groupBlock(
        'B',
        [
          { position: 1, teamId: 'italia', points: 1, tone: 'green' },
          { position: 2, teamId: 'canada', points: 0, tone: 'red' },
          { position: 3, teamId: 'suiza', points: 0, tone: 'red' },
          { position: 4, teamId: 'qatar', points: 0, tone: 'red' },
        ],
        [
          matchPick('m3', '2-0', '1', false, 0, 'red'),
          matchPick('m4', '0-1', '2', false, 3, 'green'),
          matchPick('m6', '1-2', '2', false, 2, 'yellow'),
        ],
      ),
    ],
    round32: [stagePick(1, 'mexico', 6, 'green'), stagePick(2, 'italia', 6, 'green')],
    round16: [stagePick(1, 'mexico', 10, 'green'), stagePick(2, 'italia', 10, 'green')],
    quarterfinals: [stagePick(1, 'mexico', 15, 'green'), stagePick(2, 'italia', 15, 'green')],
    semifinals: [stagePick(1, 'italia', 20, 'green'), stagePick(2, 'canada', 0, 'red')],
    final: [stagePick(1, 'italia', 25, 'green'), stagePick(2, 'canada', 0, 'red')],
    podium: {
      champion: stagePick(1, 'italia', 50, 'green'),
      runnerUp: stagePick(2, 'canada', 0, 'red'),
      thirdPlace: stagePick(3, 'mexico', 20, 'green'),
    },
    specials: [
      { key: 'mejor-jugador', label: 'Mejor jugador', value: 'Bellingham', points: 20, tone: 'green' },
      { key: 'mejor-jugador-joven', label: 'Mejor jugador joven', value: 'Yamal', points: 20, tone: 'green' },
      { key: 'mejor-portero', label: 'Mejor portero', value: 'Maignan', points: 20, tone: 'green' },
      { key: 'maximo-goleador', label: 'Máximo goleador', value: 'Lautaro', points: 0, tone: 'red' },
      { key: 'seleccion-revelacion', label: 'Selección revelación', value: 'México', points: 0, tone: 'red' },
    ],
    scoreBreakdown: scoreBreakdown([
      ['groups', 'Fase de grupos', 46],
      ['round32', 'Dieciseisavos', 12],
      ['round16', 'Octavos', 20],
      ['quarters', 'Cuartos', 30],
      ['semis', 'Semifinales', 20],
      ['final', 'Final y podio', 17],
      ['specials', 'Especiales', 21],
    ]),
  }),
  buildParticipantData(currentSnapshot[3], {
    groups: [
      groupBlock(
        'A',
        [
          { position: 1, teamId: 'mexico', points: 3, tone: 'green' },
          { position: 2, teamId: 'irlanda', points: 1, tone: 'green' },
          { position: 3, teamId: 'corea', points: 0, tone: 'red' },
          { position: 4, teamId: 'sudafrica', points: 0, tone: 'red' },
        ],
        [
          matchPick('m1', '2-0', '1', false, 3, 'green'),
          matchPick('m2', '2-0', '1', false, 0, 'red'),
          matchPick('m5', '1-1', 'X', false, 2, 'yellow'),
        ],
      ),
      groupBlock(
        'B',
        [
          { position: 1, teamId: 'canada', points: 0, tone: 'red' },
          { position: 2, teamId: 'italia', points: 1, tone: 'green' },
          { position: 3, teamId: 'suiza', points: 0, tone: 'red' },
          { position: 4, teamId: 'qatar', points: 0, tone: 'red' },
        ],
        [
          matchPick('m3', '1-1', 'X', false, 0, 'red'),
          matchPick('m4', '1-2', '2', true, 6, 'gold'),
          matchPick('m6', '1-0', '1', false, 3, 'green'),
        ],
      ),
    ],
    round32: [stagePick(1, 'mexico', 6, 'green'), stagePick(2, 'italia', 6, 'green')],
    round16: [stagePick(1, 'mexico', 10, 'green'), stagePick(2, 'italia', 0, 'red')],
    quarterfinals: [stagePick(1, 'mexico', 15, 'green')],
    semifinals: [stagePick(1, 'mexico', 20, 'green')],
    final: [stagePick(1, 'mexico', 0, 'red'), stagePick(2, 'italia', 25, 'green')],
    podium: {
      champion: stagePick(1, 'mexico', 0, 'red'),
      runnerUp: stagePick(2, 'italia', 30, 'green'),
      thirdPlace: stagePick(3, 'suiza', 0, 'red'),
    },
    specials: [
      { key: 'mejor-jugador', label: 'Mejor jugador', value: 'Pedri', points: 0, tone: 'red' },
      { key: 'mejor-jugador-joven', label: 'Mejor jugador joven', value: 'Musiala', points: 0, tone: 'red' },
      { key: 'mejor-portero', label: 'Mejor portero', value: 'Sommer', points: 20, tone: 'green' },
      { key: 'maximo-goleador', label: 'Máximo goleador', value: 'Mbappé', points: 20, tone: 'green' },
      { key: 'seleccion-revelacion', label: 'Selección revelación', value: 'Canadá', points: 10, tone: 'green' },
    ],
    scoreBreakdown: scoreBreakdown([
      ['groups', 'Fase de grupos', 43],
      ['round32', 'Dieciseisavos', 12],
      ['round16', 'Octavos', 10],
      ['quarters', 'Cuartos', 15],
      ['semis', 'Semifinales', 20],
      ['final', 'Final y podio', 10],
      ['specials', 'Especiales', 22],
    ]),
  }),
  buildParticipantData(currentSnapshot[4], {
    groups: [
      groupBlock(
        'A',
        [
          { position: 1, teamId: 'mexico', points: 3, tone: 'green' },
          { position: 2, teamId: 'corea', points: 1, tone: 'green' },
          { position: 3, teamId: 'sudafrica', points: 0, tone: 'red' },
          { position: 4, teamId: 'irlanda', points: 0, tone: 'red' },
        ],
        [
          matchPick('m1', '3-1', '1', false, 3, 'green'),
          matchPick('m2', '1-0', '1', false, 3, 'green'),
          matchPick('m5', '2-0', '1', false, 3, 'green'),
        ],
      ),
      groupBlock(
        'B',
        [
          { position: 1, teamId: 'italia', points: 1, tone: 'green' },
          { position: 2, teamId: 'suiza', points: 1, tone: 'green' },
          { position: 3, teamId: 'canada', points: 0, tone: 'red' },
          { position: 4, teamId: 'qatar', points: 0, tone: 'red' },
        ],
        [
          matchPick('m3', '1-2', '2', true, 6, 'gold'),
          matchPick('m4', '0-1', '2', false, 3, 'green'),
          matchPick('m6', '0-1', '2', false, 3, 'green'),
        ],
      ),
    ],
    round32: [stagePick(1, 'mexico', 6, 'green'), stagePick(2, 'italia', 6, 'green')],
    round16: [stagePick(1, 'mexico', 10, 'green'), stagePick(2, 'italia', 10, 'green')],
    quarterfinals: [stagePick(1, 'italia', 15, 'green')],
    semifinals: [stagePick(1, 'italia', 20, 'green')],
    final: [stagePick(1, 'italia', 25, 'green')],
    podium: {
      champion: stagePick(1, 'italia', 50, 'green'),
      runnerUp: stagePick(2, 'mexico', 0, 'red'),
      thirdPlace: stagePick(3, 'suiza', 0, 'red'),
    },
    specials: [
      { key: 'mejor-jugador', label: 'Mejor jugador', value: 'Bellingham', points: 20, tone: 'green' },
      { key: 'mejor-jugador-joven', label: 'Mejor jugador joven', value: 'Yamal', points: 20, tone: 'green' },
      { key: 'mejor-portero', label: 'Mejor portero', value: 'Donnarumma', points: 0, tone: 'red' },
      { key: 'maximo-goleador', label: 'Máximo goleador', value: 'Mbappé', points: 20, tone: 'green' },
      { key: 'seleccion-revelacion', label: 'Selección revelación', value: 'Italia', points: 0, tone: 'red' },
    ],
    scoreBreakdown: scoreBreakdown([
      ['groups', 'Fase de grupos', 39],
      ['round32', 'Dieciseisavos', 12],
      ['round16', 'Octavos', 20],
      ['quarters', 'Cuartos', 15],
      ['semis', 'Semifinales', 20],
      ['final', 'Final y podio', 0],
      ['specials', 'Especiales', 18],
    ]),
  }),
];

const standingsById = new Map(currentSnapshot.map((row) => [row.participantId, row]));

const homeStats: HomeStats = {
  championConsensus: [
    { teamId: 'italia', count: 3, pct: 60 },
    { teamId: 'mexico', count: 1, pct: 20 },
    { teamId: 'suiza', count: 1, pct: 20 },
  ],
  repeatedFinals: [
    { homeTeamId: 'italia', awayTeamId: 'mexico', count: 2, pct: 40 },
    { homeTeamId: 'italia', awayTeamId: 'suiza', count: 1, pct: 20 },
  ],
  mostDoubledMatch: { matchId: 'm4', count: 2, pct: 40 },
  biggestRiser: currentSnapshot.find((row) => row.participantId === 'txapeldun') ?? null,
  biggestFaller: currentSnapshot.find((row) => row.participantId === 'chiringuito') ?? null,
  executiveHighlights: [
    { key: 'leader', label: 'Líder actual', value: 'Txapeldun', secondary: '132 puntos' },
    { key: 'new-leader', label: 'Nuevo líder', value: 'Sí', secondary: 'cambio respecto al snapshot anterior' },
    { key: 'close-gap', label: 'Distancia top 2', value: '5 puntos', secondary: 'Txapeldun vs VARMaster' },
  ],
};

export const demoAppData: PoolAppData = {
  meta: {
    id: 'world-cup-2026',
    name: 'Peñita FIFA World Cup 2026',
    timezone: 'Europe/Madrid',
    entryFeeCents: 2000,
    worldCupStartUtc: WORLD_CUP_START_UTC,
  },
  snapshots: {
    current: {
      id: 'snapshot-2026-04-08',
      publishedAtUtc: '2026-04-08T21:30:00.000Z',
      label: 'Actualización 8 abril',
      sourceLabel: 'Snapshot publicado',
    },
    previous: {
      id: 'snapshot-2026-04-02',
      publishedAtUtc: '2026-04-02T21:10:00.000Z',
      label: 'Actualización 2 abril',
      sourceLabel: 'Snapshot publicado',
    },
  },
  teams,
  standings: currentSnapshot,
  matches,
  homeStats,
  participants,
};

export function findParticipantBySlug(slug: string): ParticipantPageData | undefined {
  return participants.find((participant) => participant.participantSlug === slug);
}

export function findStandingByParticipantId(participantId: string) {
  return standingsById.get(participantId);
}
