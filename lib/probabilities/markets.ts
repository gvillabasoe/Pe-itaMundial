export type ProbabilityMarketKind = "team" | "open" | "groups";

export interface ProbabilityMarketDefinition {
  key: string;
  label: string;
  polymarketLabel: string;
  kind: ProbabilityMarketKind;
  group?: string;
  eventSlug?: string;
  queries: readonly string[];
  requiredTerms: readonly string[];
  bonusTerms?: readonly string[];
  excludeTerms?: readonly string[];
  maxItems?: number;
  minDisplayProbability?: number;
}

export const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;

export const DEFAULT_PROBABILITY_MARKET_KEY = "world-cup-winner";
export const GROUPS_PROBABILITY_MARKET_KEY = "groups";

export const GROUP_PROBABILITY_MARKETS: ProbabilityMarketDefinition[] = GROUP_LETTERS.map((group) => ({
  key: `group-${group.toLowerCase()}-winner`,
  label: `Grupo ${group}`,
  polymarketLabel: `FIFA World Cup Group ${group} Winner`,
  kind: "team" as const,
  group,
  eventSlug: `fifa-world-cup-group-${group.toLowerCase()}-winner`,
  queries: [],
  requiredTerms: ["fifa world cup", `group ${group.toLowerCase()}`, "winner"],
  bonusTerms: ["2026", "fifa", "group", "winner"],
  excludeTerms: ["club world cup", "mundial de clubes", "copa america", "top goalscorer", "most assists", "most assits", "clean sheets", "cleen sheets", "golden boot"],
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
      "world cup 2026 winner",
      "2026 world cup champion",
      "2026 fifa world cup",
    ],
    requiredTerms: ["world cup"],
    bonusTerms: ["2026", "winner", "champion", "fifa", "outright"],
    excludeTerms: ["group", "top goalscorer", "most assists", "most assits", "clean sheets", "cleen sheets", "golden boot", "golden glove", "club world cup", "mundial de clubes"],
    maxItems: 10,
    minDisplayProbability: 2,
  },
  {
    key: "top-goalscorer",
    label: "Máximo Goleador",
    polymarketLabel: "2026 FIFA World Cup: Top Goalscorer",
    kind: "open",
    eventSlug: "2026-fifa-world-cup-top-goalscorer",
    queries: [],
    requiredTerms: ["2026 fifa world cup", "top goalscorer"],
    bonusTerms: ["top goalscorer", "goalscorer", "golden boot", "2026", "fifa"],
    excludeTerms: ["club world cup", "mundial de clubes", "nation of top goalscorer", "top scorer nation", "top scorer (nation)", "group", "winner", "most assists", "most assits", "clean sheets", "cleen sheets", "golden glove"],
    maxItems: 10,
    minDisplayProbability: 0,
  },
  {
    key: "most-assists",
    label: "Máximo Asistidor",
    polymarketLabel: "FIFA World Cup: Most Assists",
    kind: "open",
    eventSlug: "fifa-world-cup-most-assists",
    queries: [],
    requiredTerms: ["fifa world cup", "most assists"],
    bonusTerms: ["most assists", "most assits", "assists", "assits", "2026", "fifa"],
    excludeTerms: ["club world cup", "mundial de clubes", "group", "winner", "top goalscorer", "goalscorer", "clean sheets", "cleen sheets", "golden boot", "golden glove"],
    maxItems: 10,
    minDisplayProbability: 0,
  },
  {
    key: "most-clean-sheets-gk",
    label: "Portero menos goleado",
    polymarketLabel: "FIFA World Cup: Most Clean Sheets (GK)",
    kind: "open",
    eventSlug: "fifa-world-cup-most-clean-sheets-gk",
    queries: [],
    requiredTerms: ["fifa world cup", "most clean sheets"],
    bonusTerms: ["most clean sheets", "most cleen sheets", "clean sheets", "cleen sheets", "goalkeeper", "keeper", "gk", "golden glove", "2026", "fifa"],
    excludeTerms: ["club world cup", "mundial de clubes", "group", "winner", "top goalscorer", "goalscorer", "most assists", "most assits", "golden boot"],
    maxItems: 10,
    minDisplayProbability: 0,
  },
  {
    key: GROUPS_PROBABILITY_MARKET_KEY,
    label: "Grupos",
    polymarketLabel: "FIFA World Cup Group Winners",
    kind: "groups",
    queries: [],
    requiredTerms: ["fifa world cup", "group", "winner"],
    bonusTerms: ["2026", "fifa", "group", "winner"],
    excludeTerms: ["club world cup", "mundial de clubes", "copa america"],
    maxItems: 4,
    minDisplayProbability: 0,
  },
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
