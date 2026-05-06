import { GROUPS } from "@/lib/data";
import {
  DEFAULT_PROBABILITY_MARKET_KEY,
  GROUPS_PROBABILITY_MARKET_KEY,
  GROUP_PROBABILITY_MARKETS,
  getProbabilityMarket,
  type ProbabilityMarketDefinition,
} from "@/lib/probabilities/markets";
import {
  FEATURED_TEAM_BY_NAME,
  FEATURED_TEAM_ORDER,
  FEATURED_TEAMS,
  getProbabilityColorForName,
} from "@/lib/probabilities/team-config";
import { QUALIFIED_TEAMS_2026 } from "@/lib/worldcup/qualified-teams";

const GAMMA_BASE = process.env.POLYMARKET_GAMMA_BASE || "https://gamma-api.polymarket.com";
const REQUEST_TIMEOUT_MS = 6000;
const DEFAULT_MAX_RANKING_ITEMS = 10;
const WINNER_MAX_RANKING_ITEMS = 10;
const WINNER_MINIMUM_DISPLAY_PROBABILITY = 2;
const WINNER_SEARCH_QUERIES = [
  "fifa world cup 2026 winner",
  "world cup 2026 winner",
  "2026 world cup champion",
  "2026 fifa world cup",
] as const;

interface RawMarket {
  id?: string;
  conditionId?: string;
  slug?: string;
  question?: string;
  title?: string;
  description?: string;
  groupItemTitle?: string;
  outcomes?: string[] | string;
  outcomePrices?: number[] | string;
  active?: boolean;
  closed?: boolean;
  volume?: number | string;
  volumeNum?: number;
  liquidity?: number | string;
  liquidityNum?: number;
}

interface RawEvent {
  id?: string;
  slug?: string;
  title?: string;
  description?: string;
  active?: boolean;
  closed?: boolean;
  markets?: RawMarket[];
}

interface RawSearchPayload {
  markets?: RawMarket[];
  events?: RawEvent[];
}

type MarketMode = "multi" | "binary" | "mixed" | "unknown";

interface Candidate {
  teamName: string;
  probability01: number;
  probabilityPct: number;
  confidence: number;
  mode: "multi" | "binary";
  marketLabel: string | null;
  marketSlug: string | null;
}

export interface ProbabilityRankingItem {
  teamName: string;
  probability01: number;
  probabilityPct: number;
  featured: boolean;
  color?: string;
}

export interface ProbabilityGroupSnapshot {
  group: string;
  marketKey: string;
  marketDisplayName: string;
  marketPolymarketLabel: string;
  marketLabel: string | null;
  marketMode: MarketMode;
  stale: boolean;
  ranking: ProbabilityRankingItem[];
  error?: string;
}

export interface ProbabilitySnapshot {
  source: "polymarket";
  updatedAt: string;
  stale: boolean;
  marketKey: string;
  marketDisplayName: string;
  marketPolymarketLabel: string;
  marketKind: "team" | "open" | "groups";
  marketGroup: string | null;
  marketMode: MarketMode;
  marketLabel: string | null;
  featured: Record<string, number | null>;
  ranking: ProbabilityRankingItem[];
  groups?: ProbabilityGroupSnapshot[];
  error?: string;
}

const WINNER_TEAM_ALIASES: Record<string, string[]> = {
  "Alemania": ["germany", "alemania", "deutschland"],
  "Arabia Saudí": ["saudi arabia", "arabia saudi", "arabia saudita"],
  "Argelia": ["algeria", "argelia"],
  "Argentina": ["argentina"],
  "Australia": ["australia"],
  "Austria": ["austria"],
  "Bélgica": ["belgium", "belgica", "bélgica"],
  "Bolivia": ["bolivia"],
  "Bosnia y Herzegovina": ["bosnia and herzegovina", "bosnia-herzegovina", "bosnia y herzegovina"],
  "Brasil": ["brazil", "brasil"],
  "Cabo Verde": ["cape verde", "cabo verde"],
  "Canadá": ["canada", "canadá"],
  "Colombia": ["colombia"],
  "Corea del Sur": ["south korea", "korea republic", "republic of korea", "corea del sur", "corea"],
  "Costa de Marfil": ["ivory coast", "cote divoire", "côte d'ivoire", "costa de marfil", "costa marfil"],
  "Croacia": ["croatia", "croacia"],
  "Curazao": ["curacao", "curaçao", "curazao"],
  "Ecuador": ["ecuador"],
  "Egipto": ["egypt", "egipto"],
  "Escocia": ["scotland", "escocia"],
  "España": ["spain", "espana", "españa"],
  "Estados Unidos": ["united states", "usa", "usmnt", "estados unidos", "eeuu"],
  "Francia": ["france", "francia"],
  "Ghana": ["ghana"],
  "Haití": ["haiti", "haití"],
  "Inglaterra": ["england", "inglaterra"],
  "Irak": ["iraq", "irak"],
  "Irán": ["iran", "irán", "ir iran"],
  "Italia": ["italy", "italia"],
  "Jamaica": ["jamaica"],
  "Japón": ["japan", "japon", "japón"],
  "Jordania": ["jordan", "jordania"],
  "Marruecos": ["morocco", "marruecos"],
  "México": ["mexico", "méxico"],
  "Noruega": ["norway", "noruega"],
  "Nueva Zelanda": ["new zealand", "nueva zelanda"],
  "Países Bajos": ["netherlands", "paises bajos", "países bajos", "holland", "holanda"],
  "Panamá": ["panama", "panamá"],
  "Paraguay": ["paraguay"],
  "Portugal": ["portugal"],
  "RD Congo": ["dr congo", "congo dr", "rd congo", "rd del congo", "democratic republic of the congo"],
  "Senegal": ["senegal"],
  "Sudáfrica": ["south africa", "sudafrica", "sudáfrica"],
  "Suecia": ["sweden", "suecia"],
  "Suiza": ["switzerland", "suiza"],
  "Túnez": ["tunisia", "tunez", "túnez"],
  "Turquía": ["turkey", "turkiye", "turquía", "turquia"],
  "Uruguay": ["uruguay"],
  "Uzbekistán": ["uzbekistan", "uzbekistán"],
};

const TEAM_ALIASES: Record<string, string[]> = {
  ...WINNER_TEAM_ALIASES,
  "Catar": ["qatar", "catar"],
  "Chequia": ["czechia", "czech republic", "chequia", "republica checa", "república checa"],
  "RD Congo": ["dr congo", "congo dr", "rd congo", "rd del congo", "democratic republic of the congo", "drc"],
};

const lastGoodSnapshots = new Map<string, ProbabilitySnapshot>();
const lastGoodGroupSnapshots = new Map<string, ProbabilityGroupSnapshot>();

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const QUALIFIED_TEAM_KEYS = new Set(QUALIFIED_TEAMS_2026.map((team) => normalizeText(team)));
const RECOGNIZED_SHORTLIST_KEYS = new Set(FEATURED_TEAM_ORDER.map((team) => normalizeText(team)));
const TEAM_NAME_AND_ALIAS_KEYS = new Set(
  Object.entries(TEAM_ALIASES).flatMap(([teamName, aliases]) => [teamName, ...aliases].map((value) => normalizeText(value)))
);

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item));
    } catch {
      return [];
    }
  }
  return [];
}

function parseNumberList(value: unknown): number[] {
  if (Array.isArray(value)) return value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((item) => Number(item)).filter((item) => Number.isFinite(item));
    } catch {
      return [];
    }
  }
  return [];
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Polymarket timeout")), ms)),
  ]);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await withTimeout(fetch(url, { next: { revalidate: 300 } } as any), REQUEST_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`Polymarket request failed with ${response.status}`);
  }
  return response.json();
}

async function fetchSearch(query: string, limit = 35): Promise<RawSearchPayload> {
  const url = `${GAMMA_BASE}/public-search?q=${encodeURIComponent(query)}&limit_per_type=${limit}`;
  return fetchJson<RawSearchPayload>(url);
}

function asEventList(payload: RawEvent | RawEvent[] | null | undefined): RawEvent[] {
  if (!payload) return [];
  return Array.isArray(payload) ? payload : [payload];
}

async function fetchEventBySlug(slug: string): Promise<RawEvent | null> {
  const encodedSlug = encodeURIComponent(slug);
  const urls = [
    `${GAMMA_BASE}/events?slug=${encodedSlug}&active=true&closed=false`,
    `${GAMMA_BASE}/events/slug/${encodedSlug}`,
  ];

  for (const url of urls) {
    try {
      const payload = await fetchJson<RawEvent | RawEvent[]>(url);
      const events = asEventList(payload);
      const exact = events.find((event) => normalizeText(event.slug || "") === normalizeText(slug));
      if (exact) return exact;
      if (events.length === 1 && !events[0]?.slug) return events[0];
    } catch {
      // try next slug endpoint
    }
  }

  return null;
}

function collectMarkets(payload: RawSearchPayload): RawMarket[] {
  const dedupe = new Map<string, RawMarket>();
  const add = (market: RawMarket) => {
    const key = market.id || market.conditionId || market.slug || market.question || market.title;
    if (!key) return;
    if (!dedupe.has(key)) dedupe.set(key, market);
  };

  (payload.markets || []).forEach(add);
  (payload.events || []).forEach((event) => {
    (event.markets || []).forEach(add);
  });

  return Array.from(dedupe.values());
}

function collectEventMarkets(event: RawEvent): RawMarket[] {
  return collectMarkets({ markets: event.markets || [] });
}

function yesIndex(outcomes: string[]): number {
  const normalized = outcomes.map((outcome) => normalizeText(outcome));
  const idx = normalized.findIndex((outcome) => outcome === "yes");
  return idx >= 0 ? idx : 0;
}

function getMarketText(market: RawMarket): string {
  return [market.question, market.title, market.groupItemTitle, market.description, market.slug]
    .filter(Boolean)
    .join(" ");
}

function getEventText(event: RawEvent): string {
  return [event.title, event.description, event.slug]
    .filter(Boolean)
    .join(" ");
}

function hasExcludedTournament(text: string) {
  const normalized = normalizeText(text);
  return normalized.includes("club world cup") || normalized.includes("mundial de clubes") || normalized.includes("copa america");
}

function isVerifiedEvent(event: RawEvent, definition: ProbabilityMarketDefinition): boolean {
  const slug = normalizeText(event.slug || "");
  const expectedSlug = normalizeText(definition.eventSlug || "");
  const text = normalizeText(getEventText(event));

  if (!expectedSlug || slug !== expectedSlug) return false;
  if (!text.includes("world cup") || hasExcludedTournament(getEventText(event))) return false;
  if (!text.includes("2026") && !text.includes("fifa")) return false;
  if (definition.group && !text.includes(`group ${definition.group.toLowerCase()}`)) return false;

  if (definition.key === "top-goalscorer") return text.includes("top goalscorer");
  if (definition.key === "most-assists") return text.includes("most assists") || text.includes("most assits");
  if (definition.key === "most-clean-sheets-gk") return text.includes("most clean sheets") || text.includes("most cleen sheets");
  if (definition.group) return text.includes("winner");

  return true;
}

function activityScore(market: RawMarket): number {
  let score = 0;
  if (market.active !== false) score += 1;
  if (market.closed) score -= 4;

  const volume = Number(market.volumeNum ?? market.volume ?? 0);
  const liquidity = Number(market.liquidityNum ?? market.liquidity ?? 0);
  if (Number.isFinite(volume) && volume > 0) score += Math.min(Math.log10(volume + 1), 2);
  if (Number.isFinite(liquidity) && liquidity > 0) score += Math.min(Math.log10(liquidity + 1), 1.5);

  return score;
}

function winnerMarketScore(market: RawMarket): number {
  const text = normalizeText([market.question, market.title, market.groupItemTitle, market.slug].filter(Boolean).join(" "));
  let score = 0;
  if (text.includes("world cup") || text.includes("fifa")) score += 3;
  if (text.includes("2026")) score += 3;
  if (text.includes("winner") || text.includes("champion") || text.includes("win")) score += 2;
  if (text.includes("outright")) score += 1;
  if (text.includes("vs") || text.includes("match") || text.includes("game")) score -= 5;
  if (market.active !== false) score += 1;
  if (market.closed) score -= 2;
  const volume = Number(market.volumeNum ?? market.volume ?? 0);
  const liquidity = Number(market.liquidityNum ?? market.liquidity ?? 0);
  if (Number.isFinite(volume) && volume > 0) score += Math.min(Math.log10(volume + 1), 2);
  if (Number.isFinite(liquidity) && liquidity > 0) score += Math.min(Math.log10(liquidity + 1), 1.5);
  return score;
}

function marketScore(market: RawMarket, definition: ProbabilityMarketDefinition, verifiedEvent = false): number {
  if (verifiedEvent) return 8 + activityScore(market);

  const text = normalizeText(getMarketText(market));
  let score = 0;

  for (const term of definition.requiredTerms) {
    score += text.includes(normalizeText(term)) ? 4 : -3;
  }

  let matchedBonusTerms = 0;
  for (const term of definition.bonusTerms || []) {
    if (text.includes(normalizeText(term))) {
      matchedBonusTerms += 1;
      score += 2;
    }
  }

  for (const term of definition.excludeTerms || []) {
    if (text.includes(normalizeText(term))) score -= 7;
  }

  if (hasExcludedTournament(text)) score -= 10;
  if (definition.kind === "open" && matchedBonusTerms === 0) score -= 6;
  if (definition.group && !text.includes(`group ${definition.group.toLowerCase()}`)) score -= 5;

  return score + activityScore(market);
}

function findCanonicalTeam(text: string, aliases: Record<string, string[]> = TEAM_ALIASES): string | null {
  const haystack = normalizeText(text);
  let bestMatch: { teamName: string; aliasLength: number } | null = null;

  for (const [teamName, teamAliases] of Object.entries(aliases)) {
    for (const alias of teamAliases) {
      const normalizedAlias = normalizeText(alias);
      const pattern = new RegExp(`(^|\\s)${normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`);
      if (pattern.test(haystack)) {
        if (!bestMatch || normalizedAlias.length > bestMatch.aliasLength) {
          bestMatch = { teamName, aliasLength: normalizedAlias.length };
        }
      }
    }
  }

  return bestMatch?.teamName || null;
}

function updateCandidate(map: Map<string, Candidate>, candidate: Candidate) {
  const current = map.get(candidate.teamName);
  if (!current || candidate.confidence > current.confidence || (candidate.confidence === current.confidence && candidate.probabilityPct > current.probabilityPct)) {
    map.set(candidate.teamName, candidate);
  }
}

function updateWinnerCandidate(map: Map<string, Candidate>, candidate: Candidate) {
  const current = map.get(candidate.teamName);
  if (!current || candidate.confidence > current.confidence) {
    map.set(candidate.teamName, candidate);
  }
}

function isQualifiedTeam(teamName: string) {
  return QUALIFIED_TEAM_KEYS.has(normalizeText(teamName));
}

function isRecognizedFavorite(teamName: string) {
  return RECOGNIZED_SHORTLIST_KEYS.has(normalizeText(teamName));
}

function winnerShouldDisplayCandidate(candidate: Candidate) {
  if (!isQualifiedTeam(candidate.teamName)) return false;
  return candidate.probabilityPct >= WINNER_MINIMUM_DISPLAY_PROBABILITY || isRecognizedFavorite(candidate.teamName);
}

function getTeamPool(definition: ProbabilityMarketDefinition): readonly string[] {
  if (definition.group && GROUPS[definition.group]) return GROUPS[definition.group];
  return QUALIFIED_TEAMS_2026;
}

function isAllowedTeam(teamName: string, definition: ProbabilityMarketDefinition) {
  if (definition.group) return getTeamPool(definition).includes(teamName);
  return isQualifiedTeam(teamName);
}

function shouldDisplayCandidate(candidate: Candidate, definition: ProbabilityMarketDefinition) {
  const minimum = definition.minDisplayProbability ?? 0;
  if (definition.kind === "open") return candidate.probabilityPct >= minimum;
  if (!isAllowedTeam(candidate.teamName, definition)) return false;
  if (definition.group) return true;
  return candidate.probabilityPct >= minimum || isRecognizedFavorite(candidate.teamName);
}

function validOutcomePairs(outcomes: string[], prices: number[]) {
  return outcomes
    .map((outcome, index) => ({ outcome, price: prices[index] }))
    .filter((pair) => Number.isFinite(pair.price) && pair.price > 0 && pair.price <= 1);
}

function marketLabel(market: RawMarket) {
  return market.question || market.title || market.groupItemTitle || market.slug || "Mercado Polymarket";
}

function extractWinnerCandidates(markets: RawMarket[]): Map<string, Candidate> {
  const candidates = new Map<string, Candidate>();

  for (const market of markets) {
    const outcomes = parseStringList(market.outcomes);
    const prices = parseNumberList(market.outcomePrices);
    if (!outcomes.length || !prices.length || outcomes.length !== prices.length) continue;

    const score = winnerMarketScore(market);
    if (score <= 0) continue;

    const validPairs = outcomes
      .map((outcome, index) => ({ outcome, price: prices[index] }))
      .filter((pair) => Number.isFinite(pair.price) && pair.price > 0 && pair.price <= 1);

    if (!validPairs.length) continue;

    const teamOutcomes = validPairs
      .map((pair) => ({ teamName: findCanonicalTeam(pair.outcome, WINNER_TEAM_ALIASES), probability01: pair.price }))
      .filter((pair): pair is { teamName: string; probability01: number } => Boolean(pair.teamName));

    const uniqueTeams = Array.from(new Set(teamOutcomes.map((pair) => pair.teamName)));
    const label = market.question || market.title || market.groupItemTitle || market.slug || "Mercado Polymarket";

    if (uniqueTeams.length >= 3) {
      for (const pair of teamOutcomes) {
        updateWinnerCandidate(candidates, {
          teamName: pair.teamName,
          probability01: pair.probability01,
          probabilityPct: Number((pair.probability01 * 100).toFixed(1)),
          confidence: score + 5,
          mode: "multi",
          marketLabel: label,
          marketSlug: market.slug || market.id || null,
        });
      }
      continue;
    }

    const teamFromText = findCanonicalTeam([market.question, market.title, market.groupItemTitle, market.slug].filter(Boolean).join(" "), WINNER_TEAM_ALIASES);
    if (!teamFromText) continue;

    const idx = yesIndex(outcomes);
    const probability01 = prices[idx];
    if (!Number.isFinite(probability01) || probability01 <= 0 || probability01 > 1) continue;

    updateWinnerCandidate(candidates, {
      teamName: teamFromText,
      probability01,
      probabilityPct: Number((probability01 * 100).toFixed(1)),
      confidence: score + 2,
      mode: "binary",
      marketLabel: label,
      marketSlug: market.slug || market.id || null,
    });
  }

  return candidates;
}

function extractTeamCandidates(markets: RawMarket[], definition: ProbabilityMarketDefinition, verifiedEvent = false): Map<string, Candidate> {
  const candidates = new Map<string, Candidate>();

  for (const market of markets) {
    const outcomes = parseStringList(market.outcomes);
    const prices = parseNumberList(market.outcomePrices);
    if (!outcomes.length || !prices.length || outcomes.length !== prices.length) continue;

    const score = marketScore(market, definition, verifiedEvent);
    if (score <= 0) continue;

    const validPairs = validOutcomePairs(outcomes, prices);
    if (!validPairs.length) continue;

    const teamOutcomes = validPairs
      .map((pair) => ({ teamName: findCanonicalTeam(pair.outcome), probability01: pair.price }))
      .filter((pair): pair is { teamName: string; probability01: number } => Boolean(pair.teamName && isAllowedTeam(pair.teamName, definition)));

    const uniqueTeams = Array.from(new Set(teamOutcomes.map((pair) => pair.teamName)));
    const label = marketLabel(market);
    const minimumTeams = definition.group ? 2 : 3;

    if (uniqueTeams.length >= minimumTeams) {
      for (const pair of teamOutcomes) {
        updateCandidate(candidates, {
          teamName: pair.teamName,
          probability01: pair.probability01,
          probabilityPct: Number((pair.probability01 * 100).toFixed(1)),
          confidence: score + 5,
          mode: "multi",
          marketLabel: label,
          marketSlug: market.slug || market.id || null,
        });
      }
      continue;
    }

    const teamFromText = findCanonicalTeam(getMarketText(market));
    if (!teamFromText || !isAllowedTeam(teamFromText, definition)) continue;

    const idx = yesIndex(outcomes);
    const probability01 = prices[idx];
    if (!Number.isFinite(probability01) || probability01 <= 0 || probability01 > 1) continue;

    updateCandidate(candidates, {
      teamName: teamFromText,
      probability01,
      probabilityPct: Number((probability01 * 100).toFixed(1)),
      confidence: score + 2,
      mode: "binary",
      marketLabel: label,
      marketSlug: market.slug || market.id || null,
    });
  }

  return candidates;
}

function cleanOpenOutcomeName(value: string): string {
  return String(value || "")
    .replace(/^\s*[•\-–—]+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericOpenOutcome(name: string): boolean {
  const normalized = normalizeText(name);
  return (
    !normalized ||
    normalized === "yes" ||
    normalized === "no" ||
    normalized === "other" ||
    normalized === "others" ||
    normalized === "the field" ||
    normalized === "field" ||
    normalized === "any other" ||
    normalized === "any other player" ||
    normalized === "none"
  );
}

function isTeamNameOrAlias(name: string): boolean {
  return TEAM_NAME_AND_ALIAS_KEYS.has(normalizeText(name));
}

function looksLikePlayerCandidateName(name: string): boolean {
  const normalized = normalizeText(name);
  if (isGenericOpenOutcome(name)) return false;
  if (isTeamNameOrAlias(name)) return false;
  if (name.length < 2 || name.length > 70) return false;
  if (/^\d+/.test(normalized)) return false;
  if (normalized.includes("world cup") || normalized.includes("fifa") || normalized.includes("polymarket")) return false;
  if (normalized.includes("top goalscorer") || normalized.includes("most assists") || normalized.includes("most clean sheets")) return false;
  if (normalized.includes("nation") || normalized.includes("country") || normalized.includes("team")) return false;
  return true;
}

function stripOpenMarketText(value: string): string {
  return cleanOpenOutcomeName(value)
    .replace(/^2026\s+fifa\s+world\s+cup\s*:\s*top\s+goalscorer\s*[-–—:]\s*/i, "")
    .replace(/^fifa\s+world\s+cup\s*:\s*most\s+assists\s*[-–—:]\s*/i, "")
    .replace(/^fifa\s+world\s+cup\s*:\s*most\s+clean\s+sheets\s*(?:\(gk\))?\s*[-–—:]\s*/i, "")
    .replace(/^will\s+/i, "")
    .replace(/^can\s+/i, "")
    .replace(/\?+$/g, "")
    .replace(/\s+(?:win|be|finish|record|have|lead|top)\b.*$/i, "")
    .replace(/\s+(?:to win|to be)\b.*$/i, "")
    .trim();
}

function extractOpenCandidateName(market: RawMarket): string | null {
  const groupItemTitle = cleanOpenOutcomeName(market.groupItemTitle || "");
  if (looksLikePlayerCandidateName(groupItemTitle)) return groupItemTitle;

  const title = stripOpenMarketText(market.title || "");
  if (looksLikePlayerCandidateName(title)) return title;

  const question = stripOpenMarketText(market.question || "");
  if (looksLikePlayerCandidateName(question)) return question;

  return null;
}

function extractOpenCandidates(markets: RawMarket[], definition: ProbabilityMarketDefinition, verifiedEvent = false): Map<string, Candidate> {
  const candidates = new Map<string, Candidate>();

  for (const market of markets) {
    const outcomes = parseStringList(market.outcomes);
    const prices = parseNumberList(market.outcomePrices);
    if (!outcomes.length || !prices.length || outcomes.length !== prices.length) continue;

    const score = marketScore(market, definition, verifiedEvent);
    if (score <= 0) continue;

    const validPairs = validOutcomePairs(outcomes, prices);
    if (!validPairs.length) continue;

    const labelledPairs = validPairs
      .map((pair) => ({ teamName: cleanOpenOutcomeName(pair.outcome), probability01: pair.price }))
      .filter((pair) => looksLikePlayerCandidateName(pair.teamName));

    const uniqueNames = Array.from(new Set(labelledPairs.map((pair) => pair.teamName)));
    const label = marketLabel(market);

    if (uniqueNames.length >= 3) {
      for (const pair of labelledPairs) {
        updateCandidate(candidates, {
          teamName: pair.teamName,
          probability01: pair.probability01,
          probabilityPct: Number((pair.probability01 * 100).toFixed(1)),
          confidence: score + 5,
          mode: "multi",
          marketLabel: label,
          marketSlug: market.slug || market.id || null,
        });
      }
      continue;
    }

    const candidateName = extractOpenCandidateName(market);
    if (!candidateName) continue;

    const idx = yesIndex(outcomes);
    const probability01 = prices[idx];
    if (!Number.isFinite(probability01) || probability01 <= 0 || probability01 > 1) continue;

    updateCandidate(candidates, {
      teamName: candidateName,
      probability01,
      probabilityPct: Number((probability01 * 100).toFixed(1)),
      confidence: score + 2,
      mode: "binary",
      marketLabel: label,
      marketSlug: market.slug || market.id || null,
    });
  }

  return candidates;
}

function extractCandidates(markets: RawMarket[], definition: ProbabilityMarketDefinition, verifiedEvent = false): Map<string, Candidate> {
  return definition.kind === "team"
    ? extractTeamCandidates(markets, definition, verifiedEvent)
    : extractOpenCandidates(markets, definition, verifiedEvent);
}

async function fetchWinnerFeaturedFallbacks(candidates: Map<string, Candidate>) {
  for (const team of FEATURED_TEAMS) {
    if (candidates.has(team.teamName)) continue;
    const query = `${team.teamName} world cup 2026 winner`;
    try {
      const payload = await fetchSearch(query, 20);
      const markets = collectMarkets(payload);
      const extracted = extractWinnerCandidates(markets);
      const candidate = extracted.get(team.teamName);
      if (candidate) updateWinnerCandidate(candidates, candidate);
    } catch {
      // ignore featured fallback failure for individual team
    }
  }
}

function buildEmptyFeatured() {
  return Object.fromEntries(FEATURED_TEAM_ORDER.map((teamName) => [teamName, null])) as Record<string, number | null>;
}

function buildWinnerSnapshotFromCandidates(candidates: Map<string, Candidate>, definition: ProbabilityMarketDefinition): ProbabilitySnapshot {
  const qualifiedCandidates = Array.from(candidates.values())
    .filter((candidate) => isQualifiedTeam(candidate.teamName))
    .sort((a, b) => b.probabilityPct - a.probabilityPct);

  const displayCandidates = qualifiedCandidates.filter(winnerShouldDisplayCandidate);
  const rankingSource = (displayCandidates.length > 0 ? displayCandidates : qualifiedCandidates).slice(0, WINNER_MAX_RANKING_ITEMS);

  const ranking = rankingSource.map((candidate) => ({
    teamName: candidate.teamName,
    probability01: candidate.probability01,
    probabilityPct: candidate.probabilityPct,
    featured: Boolean(FEATURED_TEAM_BY_NAME[candidate.teamName]),
    color: FEATURED_TEAM_BY_NAME[candidate.teamName]?.color,
  }));

  const featured = Object.fromEntries(
    FEATURED_TEAM_ORDER.map((teamName) => {
      const candidate = qualifiedCandidates.find((item) => item.teamName === teamName);
      return [teamName, candidate ? candidate.probabilityPct : null];
    })
  ) as Record<string, number | null>;

  const modes = new Set(qualifiedCandidates.map((candidate) => candidate.mode));
  const topCandidate = ranking.length ? candidates.get(ranking[0].teamName) : null;

  return {
    source: "polymarket",
    updatedAt: new Date().toISOString(),
    stale: false,
    marketKey: definition.key,
    marketDisplayName: definition.label,
    marketPolymarketLabel: definition.polymarketLabel,
    marketKind: "team",
    marketGroup: null,
    marketMode: modes.size > 1 ? "mixed" : modes.has("multi") ? "multi" : modes.has("binary") ? "binary" : "unknown",
    marketLabel: topCandidate?.marketLabel || null,
    featured,
    ranking,
  };
}

function buildSnapshotFromCandidates(candidates: Map<string, Candidate>, definition: ProbabilityMarketDefinition): ProbabilitySnapshot {
  const allowedCandidates = Array.from(candidates.values())
    .filter((candidate) => definition.kind === "open" || isAllowedTeam(candidate.teamName, definition))
    .sort((a, b) => b.probabilityPct - a.probabilityPct);

  const displayCandidates = allowedCandidates.filter((candidate) => shouldDisplayCandidate(candidate, definition));
  const limit = definition.maxItems ?? DEFAULT_MAX_RANKING_ITEMS;
  const rankingSource = (displayCandidates.length > 0 ? displayCandidates : allowedCandidates).slice(0, limit);

  const ranking = rankingSource.map((candidate, index) => ({
    teamName: candidate.teamName,
    probability01: candidate.probability01,
    probabilityPct: candidate.probabilityPct,
    featured: Boolean(FEATURED_TEAM_BY_NAME[candidate.teamName]),
    color: getProbabilityColorForName(candidate.teamName, index),
  }));

  const featured = Object.fromEntries(
    FEATURED_TEAM_ORDER.map((teamName) => {
      const candidate = allowedCandidates.find((item) => item.teamName === teamName);
      return [teamName, candidate ? candidate.probabilityPct : null];
    })
  ) as Record<string, number | null>;

  const modes = new Set(allowedCandidates.map((candidate) => candidate.mode));
  const topCandidate = ranking.length ? candidates.get(ranking[0].teamName) : null;

  return {
    source: "polymarket",
    updatedAt: new Date().toISOString(),
    stale: false,
    marketKey: definition.key,
    marketDisplayName: definition.label,
    marketPolymarketLabel: definition.polymarketLabel,
    marketKind: definition.kind,
    marketGroup: definition.group || null,
    marketMode: modes.size > 1 ? "mixed" : modes.has("multi") ? "multi" : modes.has("binary") ? "binary" : "unknown",
    marketLabel: topCandidate?.marketLabel || null,
    featured,
    ranking,
  };
}

async function readDirectEventSnapshot(definition: ProbabilityMarketDefinition): Promise<ProbabilitySnapshot> {
  if (!definition.eventSlug) {
    throw new Error(`No hay slug configurado para ${definition.label}`);
  }

  const event = await fetchEventBySlug(definition.eventSlug);
  if (!event || !isVerifiedEvent(event, definition)) {
    throw new Error(`Sin datos disponibles para ${definition.label}`);
  }

  const markets = collectEventMarkets(event);
  const candidates = extractCandidates(markets, definition, true);

  if (candidates.size === 0) {
    throw new Error(`Sin datos disponibles para ${definition.label}`);
  }

  return buildSnapshotFromCandidates(candidates, definition);
}

async function fetchWorldCupWinnerSnapshot(definition: ProbabilityMarketDefinition): Promise<ProbabilitySnapshot> {
  try {
    let allMarkets: RawMarket[] = [];

    for (const query of WINNER_SEARCH_QUERIES) {
      try {
        const payload = await fetchSearch(query, 20);
        allMarkets = allMarkets.concat(collectMarkets(payload));
      } catch {
        // try next query
      }
    }

    const dedupedMarkets = collectMarkets({ markets: allMarkets });
    const candidates = extractWinnerCandidates(dedupedMarkets);

    if (candidates.size < 3) {
      await fetchWinnerFeaturedFallbacks(candidates);
    }

    if (candidates.size === 0) {
      throw new Error("No se encontraron mercados relevantes en Polymarket");
    }

    const snapshot = buildWinnerSnapshotFromCandidates(candidates, definition);
    lastGoodSnapshots.set(definition.key, snapshot);
    return snapshot;
  } catch (error) {
    const lastGoodSnapshot = lastGoodSnapshots.get(definition.key);
    if (lastGoodSnapshot) {
      return {
        ...lastGoodSnapshot,
        updatedAt: new Date().toISOString(),
        stale: true,
        error: error instanceof Error ? error.message : "Error desconocido en Polymarket",
      };
    }

    return {
      source: "polymarket",
      updatedAt: new Date().toISOString(),
      stale: true,
      marketKey: definition.key,
      marketDisplayName: definition.label,
      marketPolymarketLabel: definition.polymarketLabel,
      marketKind: "team",
      marketGroup: null,
      marketMode: "unknown",
      marketLabel: null,
      featured: buildEmptyFeatured(),
      ranking: [],
      error: error instanceof Error ? error.message : "Error desconocido en Polymarket",
    };
  }
}

async function fetchSingleEventMarketSnapshot(definition: ProbabilityMarketDefinition): Promise<ProbabilitySnapshot> {
  try {
    const snapshot = await readDirectEventSnapshot(definition);
    lastGoodSnapshots.set(definition.key, snapshot);
    return snapshot;
  } catch (error) {
    const lastGoodSnapshot = lastGoodSnapshots.get(definition.key);
    if (lastGoodSnapshot) {
      return {
        ...lastGoodSnapshot,
        updatedAt: new Date().toISOString(),
        stale: true,
        error: error instanceof Error ? error.message : "Error desconocido en Polymarket",
      };
    }

    return {
      source: "polymarket",
      updatedAt: new Date().toISOString(),
      stale: true,
      marketKey: definition.key,
      marketDisplayName: definition.label,
      marketPolymarketLabel: definition.polymarketLabel,
      marketKind: definition.kind,
      marketGroup: definition.group || null,
      marketMode: "unknown",
      marketLabel: null,
      featured: buildEmptyFeatured(),
      ranking: [],
      error: error instanceof Error ? error.message : "Sin datos disponibles",
    };
  }
}

function toGroupSnapshot(snapshot: ProbabilitySnapshot, definition: ProbabilityMarketDefinition): ProbabilityGroupSnapshot {
  return {
    group: definition.group || "",
    marketKey: definition.key,
    marketDisplayName: definition.label,
    marketPolymarketLabel: definition.polymarketLabel,
    marketLabel: snapshot.marketLabel,
    marketMode: snapshot.marketMode,
    stale: snapshot.stale,
    ranking: snapshot.ranking,
    error: snapshot.error,
  };
}

async function fetchGroupSnapshot(definition: ProbabilityMarketDefinition): Promise<ProbabilityGroupSnapshot> {
  try {
    const snapshot = await readDirectEventSnapshot(definition);
    const groupSnapshot = toGroupSnapshot(snapshot, definition);
    lastGoodGroupSnapshots.set(definition.key, groupSnapshot);
    return groupSnapshot;
  } catch (error) {
    const lastGoodGroupSnapshot = lastGoodGroupSnapshots.get(definition.key);
    if (lastGoodGroupSnapshot) {
      return {
        ...lastGoodGroupSnapshot,
        stale: true,
        error: error instanceof Error ? error.message : "Error desconocido en Polymarket",
      };
    }

    return {
      group: definition.group || "",
      marketKey: definition.key,
      marketDisplayName: definition.label,
      marketPolymarketLabel: definition.polymarketLabel,
      marketLabel: null,
      marketMode: "unknown",
      stale: true,
      ranking: [],
      error: error instanceof Error ? error.message : "Sin datos disponibles",
    };
  }
}

async function fetchGroupsSnapshot(definition: ProbabilityMarketDefinition): Promise<ProbabilitySnapshot> {
  const groups = await Promise.all(GROUP_PROBABILITY_MARKETS.map((groupDefinition) => fetchGroupSnapshot(groupDefinition)));
  const hasAnyRanking = groups.some((group) => group.ranking.length > 0);
  const allStale = groups.length > 0 && groups.every((group) => group.stale);
  const hasErrors = groups.some((group) => group.error);

  const snapshot: ProbabilitySnapshot = {
    source: "polymarket",
    updatedAt: new Date().toISOString(),
    stale: allStale,
    marketKey: definition.key,
    marketDisplayName: definition.label,
    marketPolymarketLabel: definition.polymarketLabel,
    marketKind: "groups",
    marketGroup: null,
    marketMode: "mixed",
    marketLabel: null,
    featured: buildEmptyFeatured(),
    ranking: [],
    groups,
    error: !hasAnyRanking && hasErrors ? "Sin datos disponibles" : undefined,
  };

  if (hasAnyRanking) lastGoodSnapshots.set(definition.key, snapshot);
  return snapshot;
}

export async function fetchPolymarketSnapshot(marketKey?: string | null): Promise<ProbabilitySnapshot> {
  const definition = getProbabilityMarket(marketKey);

  if (definition.key === DEFAULT_PROBABILITY_MARKET_KEY) {
    return fetchWorldCupWinnerSnapshot(definition);
  }

  if (definition.key === GROUPS_PROBABILITY_MARKET_KEY) {
    return fetchGroupsSnapshot(definition);
  }

  return fetchSingleEventMarketSnapshot(definition);
}
