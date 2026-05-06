import { FEATURED_TEAM_BY_NAME, FEATURED_TEAM_ORDER, FEATURED_TEAMS } from "@/lib/probabilities/team-config";
import { QUALIFIED_TEAMS_2026 } from "@/lib/worldcup/qualified-teams";

const GAMMA_BASE = process.env.POLYMARKET_GAMMA_BASE || "https://gamma-api.polymarket.com";
const REQUEST_TIMEOUT_MS = 6000;
const MAX_RANKING_ITEMS = 10;
const MINIMUM_DISPLAY_PROBABILITY = 2;
const SEARCH_QUERIES = [
  "fifa world cup 2026 winner",
  "world cup 2026 winner",
  "2026 world cup champion",
  "2026 fifa world cup",
] as const;

interface RawMarket {
  id?: string;
  slug?: string;
  question?: string;
  title?: string;
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
  markets?: RawMarket[];
}

interface RawSearchPayload {
  markets?: RawMarket[];
  events?: RawEvent[];
}

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

export interface ProbabilitySnapshot {
  source: "polymarket";
  updatedAt: string;
  stale: boolean;
  marketMode: "multi" | "binary" | "mixed" | "unknown";
  marketLabel: string | null;
  featured: Record<string, number | null>;
  ranking: ProbabilityRankingItem[];
  error?: string;
}

const TEAM_ALIASES: Record<string, string[]> = {
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

let lastGoodSnapshot: ProbabilitySnapshot | null = null;

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

async function fetchSearch(query: string): Promise<RawSearchPayload> {
  const url = `${GAMMA_BASE}/public-search?q=${encodeURIComponent(query)}&limit_per_type=20`;
  const response = await withTimeout(fetch(url, { next: { revalidate: 300 } } as any), REQUEST_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`Polymarket search failed with ${response.status}`);
  }
  return response.json();
}

function collectMarkets(payload: RawSearchPayload): RawMarket[] {
  const dedupe = new Map<string, RawMarket>();
  const add = (market: RawMarket) => {
    const key = market.id || market.slug || market.question || market.title;
    if (!key) return;
    if (!dedupe.has(key)) dedupe.set(key, market);
  };

  (payload.markets || []).forEach(add);
  (payload.events || []).forEach((event) => {
    (event.markets || []).forEach(add);
  });

  return Array.from(dedupe.values());
}

function yesIndex(outcomes: string[]): number {
  const normalized = outcomes.map((outcome) => normalizeText(outcome));
  const idx = normalized.findIndex((outcome) => outcome === "yes");
  return idx >= 0 ? idx : 0;
}

function marketScore(market: RawMarket): number {
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

function findCanonicalTeam(text: string): string | null {
  const haystack = normalizeText(text);
  let bestMatch: { teamName: string; aliasLength: number } | null = null;

  for (const [teamName, aliases] of Object.entries(TEAM_ALIASES)) {
    for (const alias of aliases) {
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

function shouldDisplayCandidate(candidate: Candidate) {
  if (!isQualifiedTeam(candidate.teamName)) return false;
  return candidate.probabilityPct >= MINIMUM_DISPLAY_PROBABILITY || isRecognizedFavorite(candidate.teamName);
}

function extractCandidates(markets: RawMarket[]): Map<string, Candidate> {
  const candidates = new Map<string, Candidate>();

  for (const market of markets) {
    const outcomes = parseStringList(market.outcomes);
    const prices = parseNumberList(market.outcomePrices);
    if (!outcomes.length || !prices.length || outcomes.length !== prices.length) continue;

    const score = marketScore(market);
    if (score <= 0) continue;

    const validPairs = outcomes
      .map((outcome, index) => ({ outcome, price: prices[index] }))
      .filter((pair) => Number.isFinite(pair.price) && pair.price > 0 && pair.price <= 1);

    if (!validPairs.length) continue;

    const teamOutcomes = validPairs
      .map((pair) => ({ teamName: findCanonicalTeam(pair.outcome), probability01: pair.price }))
      .filter((pair): pair is { teamName: string; probability01: number } => Boolean(pair.teamName));

    const uniqueTeams = Array.from(new Set(teamOutcomes.map((pair) => pair.teamName)));
    const label = market.question || market.title || market.groupItemTitle || market.slug || "Mercado Polymarket";

    if (uniqueTeams.length >= 3) {
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

    const teamFromText = findCanonicalTeam([market.question, market.title, market.groupItemTitle, market.slug].filter(Boolean).join(" "));
    if (!teamFromText) continue;

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

async function fetchFeaturedFallbacks(candidates: Map<string, Candidate>) {
  for (const team of FEATURED_TEAMS) {
    if (candidates.has(team.teamName)) continue;
    const query = `${team.teamName} world cup 2026 winner`;
    try {
      const payload = await fetchSearch(query);
      const markets = collectMarkets(payload);
      const extracted = extractCandidates(markets);
      const candidate = extracted.get(team.teamName);
      if (candidate) updateCandidate(candidates, candidate);
    } catch {
      // ignore featured fallback failure for individual team
    }
  }
}

function buildSnapshotFromCandidates(candidates: Map<string, Candidate>): ProbabilitySnapshot {
  const qualifiedCandidates = Array.from(candidates.values())
    .filter((candidate) => isQualifiedTeam(candidate.teamName))
    .sort((a, b) => b.probabilityPct - a.probabilityPct);

  const displayCandidates = qualifiedCandidates.filter(shouldDisplayCandidate);
  const rankingSource = (displayCandidates.length > 0 ? displayCandidates : qualifiedCandidates).slice(0, MAX_RANKING_ITEMS);

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
    marketMode: modes.size > 1 ? "mixed" : modes.has("multi") ? "multi" : modes.has("binary") ? "binary" : "unknown",
    marketLabel: topCandidate?.marketLabel || null,
    featured,
    ranking,
  };
}

export async function fetchPolymarketSnapshot(): Promise<ProbabilitySnapshot> {
  try {
    let allMarkets: RawMarket[] = [];

    for (const query of SEARCH_QUERIES) {
      try {
        const payload = await fetchSearch(query);
        allMarkets = allMarkets.concat(collectMarkets(payload));
      } catch {
        // try next query
      }
    }

    const dedupedMarkets = collectMarkets({ markets: allMarkets });
    const candidates = extractCandidates(dedupedMarkets);

    if (candidates.size < 3) {
      await fetchFeaturedFallbacks(candidates);
    }

    if (candidates.size === 0) {
      throw new Error("No se encontraron mercados relevantes en Polymarket");
    }

    const snapshot = buildSnapshotFromCandidates(candidates);
    lastGoodSnapshot = snapshot;
    return snapshot;
  } catch (error) {
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
      marketMode: "unknown",
      marketLabel: null,
      featured: Object.fromEntries(FEATURED_TEAM_ORDER.map((teamName) => [teamName, null])) as Record<string, number | null>,
      ranking: [],
      error: error instanceof Error ? error.message : "Error desconocido en Polymarket",
    };
  }
}
