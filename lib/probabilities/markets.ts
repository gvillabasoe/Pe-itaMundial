export type ProbabilityMarketKind = "team" | "open";

export interface ProbabilityMarketDefinition {
  key: string;
  label: string;
  polymarketLabel: string;
  kind: ProbabilityMarketKind;
  group?: string;
  queries: readonly string[];
  requiredTerms: readonly string[];
  bonusTerms?: readonly string[];
  excludeTerms?: readonly string[];
  maxItems?: number;
  minDisplayProbability?: number;
}

const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;

export const DEFAULT_PROBABILITY_MARKET_KEY = "world-cup-winner";

const groupMarkets = GROUP_LETTERS.map((group) => ({
  key: `group-${group.toLowerCase()}-winner`,
  label: `Ganador Grupo ${group}`,
  polymarketLabel: `FIFA World Cup Group ${group} Winner`,
  kind: "team" as const,
  group,
  queries: [
    `FIFA World Cup Group ${group} Winner`,
    `2026 FIFA World Cup Group ${group} Winner`,
    `World Cup Group ${group} Winner`,
  ],
  requiredTerms: ["world cup", `group ${group.toLowerCase()}`, "winner"],
  bonusTerms: ["2026", "fifa"],
  excludeTerms: ["top goalscorer", "most assists", "most assits", "clean sheets", "cleen sheets", "golden boot"],
  maxItems: 4,
  minDisplayProbability: 0,
}));

export const PROBABILITY_MARKETS: ProbabilityMarketDefinition[] = [
  {
    key: DEFAULT_PROBABILITY_MARKET_KEY,
    label: "Ganar Mundial",
    polymarketLabel: "2026 FIFA World Cup Winner",
    kind: "team",
    queries: [
      "fifa world cup 2026 winner",
      "2026 fifa world cup winner",
      "world cup 2026 winner",
      "2026 world cup champion",
      "2026 fifa world cup",
    ],
    requiredTerms: ["world cup"],
    bonusTerms: ["2026", "winner", "champion", "fifa", "outright"],
    excludeTerms: ["group", "top goalscorer", "most assists", "most assits", "clean sheets", "cleen sheets", "golden boot", "golden glove"],
    maxItems: 10,
    minDisplayProbability: 2,
  },
  {
    key: "top-goalscorer",
    label: "Máximo Goleador",
    polymarketLabel: "2026 FIFA World Cup: Top Goalscorer",
    kind: "open",
    queries: [
      "2026 FIFA World Cup Top Goalscorer",
      "FIFA World Cup Top Goalscorer",
      "World Cup 2026 Top Goalscorer",
      "World Cup 2026 Golden Boot",
    ],
    requiredTerms: ["world cup"],
    bonusTerms: ["top goalscorer", "goalscorer", "golden boot", "2026", "fifa"],
    excludeTerms: ["group", "winner", "most assists", "most assits", "clean sheets", "cleen sheets", "golden glove"],
    maxItems: 10,
    minDisplayProbability: 1,
  },
  {
    key: "most-assists",
    label: "Máximo Asistidor",
    polymarketLabel: "FIFA World Cup: Most Assists",
    kind: "open",
    queries: [
      "FIFA World Cup Most Assists",
      "FIFA World Cup Most Assits",
      "World Cup 2026 Most Assists",
      "2026 FIFA World Cup Most Assists",
    ],
    requiredTerms: ["world cup"],
    bonusTerms: ["most assists", "most assits", "assists", "assits", "2026", "fifa"],
    excludeTerms: ["group", "winner", "top goalscorer", "goalscorer", "clean sheets", "cleen sheets", "golden boot", "golden glove"],
    maxItems: 10,
    minDisplayProbability: 1,
  },
  {
    key: "most-clean-sheets-gk",
    label: "Portero menos goleado",
    polymarketLabel: "FIFA World Cup: Most Clean Sheets (GK)",
    kind: "open",
    queries: [
      "FIFA World Cup Most Clean Sheets GK",
      "FIFA World Cup Most Cleen Sheets GK",
      "World Cup 2026 Most Clean Sheets Goalkeeper",
      "2026 FIFA World Cup Most Clean Sheets",
    ],
    requiredTerms: ["world cup"],
    bonusTerms: ["most clean sheets", "most cleen sheets", "clean sheets", "cleen sheets", "goalkeeper", "keeper", "gk", "golden glove", "2026", "fifa"],
    excludeTerms: ["group", "winner", "top goalscorer", "goalscorer", "most assists", "most assits", "golden boot"],
    maxItems: 10,
    minDisplayProbability: 1,
  },
  ...groupMarkets,
];

export const PROBABILITY_MARKET_BY_KEY = Object.fromEntries(
  PROBABILITY_MARKETS.map((market) => [market.key, market])
) as Record<string, ProbabilityMarketDefinition>;

export function getProbabilityMarket(key?: string | null): ProbabilityMarketDefinition {
  if (key && PROBABILITY_MARKET_BY_KEY[key]) {
    return PROBABILITY_MARKET_BY_KEY[key];
  }
  return PROBABILITY_MARKET_BY_KEY[DEFAULT_PROBABILITY_MARKET_KEY];
}
