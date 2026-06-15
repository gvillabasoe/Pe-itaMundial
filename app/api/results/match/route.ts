import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ════════════════════════════════════════════════════════════
// Proxy al endpoint SUMMARY de ESPN para estadísticas de un partido
// (posesión, tiros, córners, faltas...). Se pide BAJO DEMANDA al abrir
// el detalle de un partido — nunca para los 104 a la vez.
//
//   GET /api/results/match?event=<espnEventId>
//
// El summary de fútbol de ESPN expone las estadísticas por equipo en
// boxscore.teams[].statistics[] con { name, displayValue }. Como es un
// endpoint NO OFICIAL, el parser es defensivo: si la estructura no es la
// esperada, devuelve stats: [] y la UI simplemente no muestra el bloque.
// ════════════════════════════════════════════════════════════

const SUMMARY_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary";
const TIMEOUT_MS = 9000;
const CACHE_TTL_MS = 30_000;

// Caché en memoria por evento (las stats no cambian más rápido que esto)
const cache = new Map<string, { until: number; payload: MatchStatsPayload }>();

export interface MatchStatItem {
  label: string;
  home: string;
  away: string;
}
interface MatchStatsPayload {
  event: string;
  available: boolean;
  stats: MatchStatItem[];
  error?: string;
}

// Etiquetas legibles en español para las stats más habituales de ESPN.
// La clave es el `name` (o `abbreviation`) que usa ESPN; si no está aquí,
// se usa el displayName que venga.
const STAT_LABELS: Record<string, string> = {
  possessionPct: "Posesión",
  totalShots: "Tiros",
  shotsOnTarget: "Tiros a puerta",
  wonCorners: "Córners",
  foulsCommitted: "Faltas",
  yellowCards: "Tarjetas amarillas",
  redCards: "Tarjetas rojas",
  offsides: "Fueras de juego",
  totalPasses: "Pases",
  accuratePasses: "Pases completados",
  saves: "Paradas",
};

// Orden de presentación preferido (lo demás va detrás, en orden de la API)
const STAT_ORDER = [
  "possessionPct", "totalShots", "shotsOnTarget", "wonCorners",
  "foulsCommitted", "offsides", "yellowCards", "redCards", "saves",
];

function parseSummaryStats(data: unknown): MatchStatItem[] {
  const boxscore = (data as Record<string, unknown>)?.boxscore as Record<string, unknown> | undefined;
  const teams = Array.isArray(boxscore?.teams) ? (boxscore!.teams as Array<Record<string, unknown>>) : [];
  if (teams.length < 2) return [];

  // ESPN no garantiza el orden home/away en boxscore.teams; usamos homeAway si está
  const findTeam = (which: "home" | "away") =>
    teams.find((t) => String((t.homeAway as string) || "").toLowerCase() === which) || null;
  const home = findTeam("home") || teams[0];
  const away = findTeam("away") || teams[1];

  const statsOf = (t: Record<string, unknown>): Map<string, string> => {
    const arr = Array.isArray(t.statistics) ? (t.statistics as Array<Record<string, unknown>>) : [];
    const map = new Map<string, string>();
    for (const s of arr) {
      const key = String(s.name || s.abbreviation || "").trim();
      const value = String(s.displayValue ?? s.value ?? "").trim();
      if (key && value) map.set(key, value);
    }
    return map;
  };

  const homeStats = statsOf(home);
  const awayStats = statsOf(away);
  if (homeStats.size === 0 && awayStats.size === 0) return [];

  const keys = new Set<string>([...homeStats.keys(), ...awayStats.keys()]);
  const ordered = [...keys].sort((a, b) => {
    const ia = STAT_ORDER.indexOf(a);
    const ib = STAT_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return ordered.map((key) => ({
    label: STAT_LABELS[key] || key,
    home: homeStats.get(key) ?? "—",
    away: awayStats.get(key) ?? "—",
  }));
}

export async function GET(request: Request) {
  const event = new URL(request.url).searchParams.get("event")?.trim() || "";
  if (!event) {
    return NextResponse.json(
      { event: "", available: false, stats: [], error: "Falta el parámetro event" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const now = Date.now();
  const cached = cache.get(event);
  if (cached && now < cached.until) {
    return NextResponse.json(cached.payload, { headers: { "Cache-Control": "public, s-maxage=30" } });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SUMMARY_BASE}?event=${encodeURIComponent(event)}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      const payload: MatchStatsPayload = { event, available: false, stats: [], error: `ESPN summary respondió ${res.status}` };
      return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
    }
    const data = await res.json();
    const stats = parseSummaryStats(data);
    const payload: MatchStatsPayload = { event, available: stats.length > 0, stats };
    cache.set(event, { until: now + CACHE_TTL_MS, payload });
    return NextResponse.json(payload, { headers: { "Cache-Control": "public, s-maxage=30" } });
  } catch (error) {
    const payload: MatchStatsPayload = {
      event,
      available: false,
      stats: [],
      error: error instanceof Error && error.name === "AbortError" ? "ESPN summary: timeout" : "ESPN summary: error de red",
    };
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } finally {
    clearTimeout(timeout);
  }
}
