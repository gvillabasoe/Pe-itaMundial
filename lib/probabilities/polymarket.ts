import { GROUPS } from "@/lib/data";
import { getProbabilityMarket, type ProbabilityMarketDefinition } from "@/lib/probabilities/markets";
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

interface RawMarket {
  id?: string;
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
  marketKey: string;
  marketDisplayName: string;
  marketPolymarketLabel: string;
  marketKind: "team" | "open";
  marketGroup: string | null;
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
  "Catar": ["qatar", "catar"],
  "Chequia": ["czechia", "czech republic", "chequia", "republica checa", "república checa"],
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
  "RD Congo": ["dr congo", "congo dr", "rd congo", "rd del congo", "democratic republic of the congo", "drc"],
  "Senegal": ["senegal"],
  "Sudáfrica": ["south africa", "sudafrica", "sudáfrica"],
  "Suecia": ["sweden", "suecia"],
  "Suiza": ["switzerland", "suiza"],
  "Túnez": ["tunisia", "tunez", "túnez"],
  "Turquía": ["turkey", "turkiye", "turquía", "turquia"],
  "Uruguay": ["uruguay"],
  "Uzbekistán": ["uzbekistan", "uzbekistán"],
};

const lastGoodSnapshots = new Map<string, ProbabilitySnapshot>();

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
  const url = `${GAMMA_BASE}/public-search?q=${encodeURIComponent(query)}&limit_per_type=35`;
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

function getMarketText(market: RawMarket): string {
  return [market.question, market.title, market.groupItemTitle, market.description, market.slug]
    .filter(Boolean)
    .join(" ");
}

function marketScore(market: RawMarket, definition: ProbabilityMarketDefinition): number {
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

  if (definition.kind === "open" && matchedBonusTerms === 0) score -= 6;
  if (definition.group && !text.includes(`group ${definition.group.toLowerCase()}`)) score -= 5;

  if (market.active !== false) score += 1;
  if (market.closed) score -= 4;

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
  if (!current || candidate.confidence > current.confidence || (candidate.confidence === current.confidence && candidate.probabilityPct > current.probabilityPct)) {
    map.set(candidate.teamName, candidate);
  }
}

function isQualifiedTeam(teamName: string) {
  return QUALIFIED_TEAM_KEYS.has(normalizeText(teamName));
}

function isRecognizedFavorite(teamName: string) {
  return RECOGNIZED_SHORTLIST_KEYS.has(normalizeText(teamName));
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

function extractTeamCandidates(markets: RawMarket[], definition: ProbabilityMarketDefinition): Map<string, Candidate> {
  const candidates = new Map<string, Candidate>();

  for (const market of markets) {
    const outcomes = parseStringList(market.outcomes);
    const prices = parseNumberList(market.outcomePrices);
    if (!outcomes.length || !prices.length || outcomes.length !== prices.length) continue;

    const score = marketScore(market, definition);
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

function looksLikeOpenCandidateName(name: string): boolean {
  const normalized = normalizeText(name);
  if (isGenericOpenOutcome(name)) return false;
  if (name.length < 2 || name.length > 70) return false;
  if (/^\d+/.test(normalized)) return false;
  if (normalized.includes("world cup") || normalized.includes("fifa") || normalized.includes("polymarket")) return false;
  if (normalized.includes("top goalscorer") || normalized.includes("most assists") || normalized.includes("most clean sheets")) return false;
  return true;
}

function stripOpenMarketText(value: string): string {
  return cleanOpenOutcomeName(value)
    .replace(/^will\s+/i, "")
    .replace(/^can\s+/i, "")
    .replace(/\?+$/g, "")
    .replace(/\s+(?:win|be|finish|record|have|lead|top)\b.*$/i, "")
    .replace(/\s+(?:to win|to be)\b.*$/i, "")
    .trim();
}

function extractOpenCandidateName(market: RawMarket): string | null {
  const groupItemTitle = cleanOpenOutcomeName(market.groupItemTitle || "");
  if (looksLikeOpenCandidateName(groupItemTitle)) return groupItemTitle;

  const title = stripOpenMarketText(market.title || "");
  if (looksLikeOpenCandidateName(title)) return title;

  const question = stripOpenMarketText(market.question || "");
  if (looksLikeOpenCandidateName(question)) return question;

  return null;
}

function extractOpenCandidates(markets: RawMarket[], definition: ProbabilityMarketDefinition): Map<string, Candidate> {
  const candidates = new Map<string, Candidate>();

  for (const market of markets) {
    const outcomes = parseStringList(market.outcomes);
    const prices = parseNumberList(market.outcomePrices);
    if (!outcomes.length || !prices.length || outcomes.length !== prices.length) continue;

    const score = marketScore(market, definition);
    if (score <= 0) continue;

    const validPairs = validOutcomePairs(outcomes, prices);
    if (!validPairs.length) continue;

    const labelledPairs = validPairs
      .map((pair) => ({ teamName: cleanOpenOutcomeName(pair.outcome), probability01: pair.price }))
      .filter((pair) => looksLikeOpenCandidateName(pair.teamName));

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

function mergeCandidates(target: Map<string, Candidate>, source: Map<string, Candidate>) {
  source.forEach((candidate) => updateCandidate(target, candidate));
}

function extractCandidates(markets: RawMarket[], definition: ProbabilityMarketDefinition): Map<string, Candidate> {
  return definition.kind === "team"
    ? extractTeamCandidates(markets, definition)
    : extractOpenCandidates(markets, definition);
}

async function fetchTeamFallbacks(candidates: Map<string, Candidate>, definition: ProbabilityMarketDefinition) {
  const teams = definition.group ? getTeamPool(definition) : FEATURED_TEAMS.map((team) => team.teamName);

  for (const teamName of teams) {
    if (candidates.has(teamName)) continue;
    const query = definition.group
      ? `${teamName} FIFA World Cup Group ${definition.group} Winner`
      : `${teamName} world cup 2026 winner`;

    try {
      const payload = await fetchSearch(query);
      const markets = collectMarkets(payload);
      const extracted = extractCandidates(markets, definition);
      const candidate = extracted.get(teamName);
      if (candidate) updateCandidate(candidates, candidate);
    } catch {
      // ignore team fallback failure for individual outcomes
    }
  }
}

function buildEmptyFeatured() {
  return Object.fromEntries(FEATURED_TEAM_ORDER.map((teamName) => [teamName, null])) as Record<string, number | null>;
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

export async function fetchPolymarketSnapshot(marketKey?: string | null): Promise<ProbabilitySnapshot> {
  const definition = getProbabilityMarket(marketKey);

  try {
    let allMarkets: RawMarket[] = [];

    for (const query of definition.queries) {
      try {
        const payload = await fetchSearch(query);
        allMarkets = allMarkets.concat(collectMarkets(payload));
      } catch {
        // try next query
      }
    }

    const dedupedMarkets = collectMarkets({ markets: allMarkets });
    const candidates = extractCandidates(dedupedMarkets, definition);

    const minimumUsefulCandidates = definition.group ? 2 : definition.kind === "team" ? 3 : 2;
    if (definition.kind === "team" && candidates.size < minimumUsefulCandidates) {
      await fetchTeamFallbacks(candidates, definition);
    }

    if (candidates.size === 0) {
      throw new Error(`No se encontraron mercados relevantes para ${definition.label} en Polymarket`);
    }

    const snapshot = buildSnapshotFromCandidates(candidates, definition);
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
      error: error instanceof Error ? error.message : "Error desconocido en Polymarket",
    };
  }
}
