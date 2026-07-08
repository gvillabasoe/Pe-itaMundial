"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import useSWR from "swr";
import { AlertCircle, ChevronDown, ChevronUp, Clock3, MapPin, RefreshCw, Search, Users, Wifi, WifiOff, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { LiveGroupTables } from "@/components/live-group-tables";
import { KnockoutBracket } from "@/components/knockout-bracket";
import { TopScorers } from "@/components/top-scorers";
import { EmptyState, Flag, GroupBadge, InitialsAvatar, PickChip, Skeleton } from "@/components/ui";
import { FIXTURES, GROUPS, type Fixture, type MatchPick, type Team } from "@/lib/data";
import { useScoredParticipants } from "@/lib/use-scored-participants";
import { getCityBgColor, getCityColor, type Zone } from "@/lib/config/regions";
import { getStatusDisplay, getStatusGroup, isLiveLike, isLivePollingStatus } from "@/lib/config/match-status";
import { STAGE_LABELS, STAGE_ORDER, WORLD_CUP_MATCHES, type MatchStage, type WorldCupMatch } from "@/lib/worldcup/schedule";
import { getKickoffByMatchId } from "@/lib/worldcup/kickoffs";
import { resolveKnockoutMatchTeams } from "@/lib/worldcup/resolve-knockout";
import type { AdminResults } from "@/lib/admin-results";

// ════════════════════════════════════════════════════════════
// TIPOS
// ════════════════════════════════════════════════════════════

interface ApiFixtureItem {
  apiId: number | null;
  stage: MatchStage;
  roundLabel: string;
  competitionLabel?: string | null;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  minute: number | null;
  statusShort: string;
  city: string | null;
  score: { home: number | null; away: number | null };
  goals?: ApiGoalEvent[];
  events?: ApiMatchEvent[];
}

interface ApiGoalEvent {
  minute: number | null;
  player: string;
  side: "home" | "away";
  ownGoal: boolean;
  penalty: boolean;
}

interface ApiMatchEvent {
  minute: number | null;
  type: "goal" | "yellow" | "red" | "yellow-red" | "substitution" | "var" | "penalty-missed";
  side: "home" | "away";
  player: string;
  playerOut?: string;
  ownGoal?: boolean;
  penalty?: boolean;
}

interface ResultsApiPayload {
  source: string;
  connection: "live" | "calendar" | "error";
  updatedAt: string;
  fixtures: ApiFixtureItem[];
  error?: string;
}

interface MatchView {
  id: number;
  /** ID del evento en ESPN, para pedir estadísticas del summary (o null) */
  apiId: number | null;
  stage: MatchStage;
  roundLabel: string;
  hostCity: string;
  zone: Zone | null;
  homeTeam: string;
  awayTeam: string;
  statusShort: string;
  minute: number | null;
  /** ISO 8601 UTC. Sin transformaciones — se renderiza con Intl. */
  kickoff: string;
  score: { home: number | null; away: number | null };
  group: string | null;
  /** Jornada del grupo (1, 2 o 3) — derivada cronológicamente */
  matchday: 1 | 2 | 3 | null;
  /** Goleadores según la API (vacío si el proveedor no los da) */
  goals: ApiGoalEvent[];
  /** Cronología de eventos (goles, tarjetas, cambios) según la API */
  events: ApiMatchEvent[];
}

// ════════════════════════════════════════════════════════════
// FETCHER + UTILS
// ════════════════════════════════════════════════════════════

const fetcher = async (url: string): Promise<ResultsApiPayload> => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`API respondió ${response.status}`);
  }
  return response.json();
};

function normalizeKey(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getGroupForMatch(homeTeam: string, awayTeam: string): string | null {
  for (const [group, teams] of Object.entries(GROUPS)) {
    if (teams.includes(homeTeam) && teams.includes(awayTeam)) return group;
  }
  return null;
}

function getAdminResultOverride(matchId: number, adminResults: AdminResults) {
  const r = adminResults.matchResults[String(matchId)];
  if (typeof r?.home !== "number" || typeof r?.away !== "number") return null;
  return {
    statusShort: r.statusShort || "FT",
    minute: null,
    score: { home: r.home, away: r.away },
  };
}

// ── Resolución de kickoffs ──────────────────────────────────────────────────
// WorldCupMatch no tiene `kickoff` propio: se toma del calendario oficial de
// horarios (lib/worldcup/kickoffs), indexado por id de partido. Las horas ya
// están en UTC y se renderizan en Europe/Madrid (24h) vía Intl.
function getKickoffForMatch(match: WorldCupMatch): string {
  return getKickoffByMatchId(match.id);
}

/**
 * Asignación de jornada (1, 2 o 3) por grupo basada en el orden cronológico
 * de los kickoffs. Cada grupo tiene 6 partidos: los 2 más tempranos = jornada 1,
 * los 2 siguientes = jornada 2, los 2 últimos = jornada 3.
 *
 * Esto es robusto frente a cualquier zona horaria del cliente porque
 * comparamos timestamps ISO 8601 en UTC.
 */
function assignMatchdays(matches: MatchView[]): MatchView[] {
  // Agrupamos por grupo
  const byGroup: Record<string, MatchView[]> = {};
  matches.forEach((m) => {
    if (!m.group || m.stage !== "group") return;
    if (!byGroup[m.group]) byGroup[m.group] = [];
    byGroup[m.group].push(m);
  });

  // Para cada grupo, ordenamos por fecha y asignamos jornada por pares
  const matchdayById = new Map<number, 1 | 2 | 3>();
  Object.values(byGroup).forEach((groupMatches) => {
    const sorted = [...groupMatches].sort(
      (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
    );
    sorted.forEach((m, idx) => {
      const matchday = (Math.floor(idx / 2) + 1) as 1 | 2 | 3;
      matchdayById.set(m.id, matchday);
    });
  });

  // Devolvemos todas con el campo matchday rellenado donde corresponda
  return matches.map((m) => ({
    ...m,
    matchday: matchdayById.get(m.id) ?? null,
  }));
}

/**
 * Une el calendario oficial (fuente de verdad de IDs y sedes) con los datos
 * en vivo de la API y los overrides del admin. Cada match del schedule oficial
 * se enriquece con el score/status más actualizado disponible.
 */
function mergeScheduleWithApi(
  fixtures: ApiFixtureItem[],
  adminResults: AdminResults
): MatchView[] {
  // Index API fixtures por par de equipos para fase de grupos
  const groupApiByPair = new Map<string, ApiFixtureItem>();
  fixtures
    .filter((f) => f.stage === "group")
    .forEach((f) => {
      groupApiByPair.set(`${normalizeKey(f.homeTeam)}|${normalizeKey(f.awayTeam)}`, f);
      groupApiByPair.set(`${normalizeKey(f.awayTeam)}|${normalizeKey(f.homeTeam)}`, f);
    });

  // Index API fixtures de ELIMINATORIAS por par de equipos (ambas orientaciones).
  // Antes se emparejaban por POSICIÓN (orden de WORLD_CUP_MATCHES contra el orden
  // por hora de la API). Como el #id de partido NO va en orden cronológico, los
  // datos en vivo (marcador, estado, cronología) se asignaban al cruce
  // equivocado. Emparejar por los equipos ya resueltos es robusto frente al orden.
  const knockoutApiByPair = new Map<string, ApiFixtureItem>();
  fixtures
    .filter((f) => f.stage !== "group")
    .forEach((f) => {
      knockoutApiByPair.set(`${normalizeKey(f.homeTeam)}|${normalizeKey(f.awayTeam)}`, f);
      knockoutApiByPair.set(`${normalizeKey(f.awayTeam)}|${normalizeKey(f.homeTeam)}`, f);
    });

  const merged: MatchView[] = WORLD_CUP_MATCHES.map((m) => {
    // Task 5: en fase final, sustituir "1.º Grupo H" etc. por el país real
    // cuando el admin ya ha cargado posiciones/resultados oficiales. Si aún no
    // está determinado, se conserva el placeholder original.
    const { homeTeam, awayTeam } = resolveKnockoutMatchTeams(m, adminResults);

    let api: ApiFixtureItem | undefined;
    if (m.stage === "group") {
      api = groupApiByPair.get(`${normalizeKey(m.homeTeam)}|${normalizeKey(m.awayTeam)}`);
    } else {
      // Emparejar por los equipos YA resueltos del cruce. Si todavía son
      // placeholders (ronda sin determinar) no habrá datos en vivo, que es lo
      // correcto: ese partido aún no se juega.
      api = knockoutApiByPair.get(`${normalizeKey(homeTeam)}|${normalizeKey(awayTeam)}`);
    }

    const manual = getAdminResultOverride(m.id, adminResults);
    // En eliminatorias, matchResults puede venir corrupto de una importación con
    // el bug posicional (marcador de otro partido). Damos prioridad al dato de la
    // API ya emparejado por equipos —igual que el cuadro— y solo caemos al
    // marcador manual si la API aún no tiene ese cruce. En grupos se mantiene la
    // prioridad del resultado oficial confirmado por el admin.
    const effectiveResult = m.stage === "group" ? (manual || api) : (api || manual);

    return {
      id: m.id,
      apiId: api?.apiId ?? null,
      stage: m.stage,
      roundLabel: m.roundLabel,
      hostCity: m.hostCity,
      zone: m.zone,
      homeTeam,
      awayTeam,
      statusShort: effectiveResult?.statusShort || "NS",
      minute: effectiveResult?.minute ?? null,
      // El kickoff se deriva del schedule oficial. WorldCupMatch no tiene
      // este campo nativamente: lo resolvemos vía FIXTURES (grupos) o serie
      // ISO determinista (eliminatorias). La API solo aporta score y minuto.
      kickoff: getKickoffForMatch(m),
      score: effectiveResult?.score || { home: null, away: null },
      group: m.stage === "group" ? getGroupForMatch(m.homeTeam, m.awayTeam) : null,
      matchday: null, // se rellena después en assignMatchdays
      goals: api?.goals ?? [],
      events: api?.events ?? [],
    };
  });

  return assignMatchdays(merged);
}

// Formato de fecha consistente — siempre Europe/Madrid para el público objetivo.
// El kickoff en ISO ya tiene la zona horaria, Intl.DateTimeFormat hace la conversión.
const KICKOFF_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatKickoff(iso: string) {
  if (!iso) return "Sin fecha";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return KICKOFF_FORMATTER.format(date);
}

function getStatusBadgeClass(status: string) {
  const group = getStatusGroup(status);
  if (group === "live") return "badge badge-red";
  if (group === "halftime") return "badge badge-amber";
  if (group === "scheduled") return "badge badge-muted";
  if (group === "finished") return "badge badge-green";
  if (group === "postponed") return "badge badge-amber";
  return "badge badge-muted";
}

function getGroupFixtureRef(match: MatchView): { fixture: Fixture; flipped: boolean } | null {
  if (match.stage !== "group") return null;
  const mh = normalizeKey(match.homeTeam);
  const ma = normalizeKey(match.awayTeam);
  for (const f of FIXTURES) {
    const fh = normalizeKey(f.homeTeam);
    const fa = normalizeKey(f.awayTeam);
    if (fh === mh && fa === ma) return { fixture: f, flipped: false };
    if (fh === ma && fa === mh) return { fixture: f, flipped: true };
  }
  return null;
}

function formatPredictionScore(pick: MatchPick | undefined, flipped: boolean): string | null {
  if (!pick) return null;
  const h = flipped ? pick.away : pick.home;
  const a = flipped ? pick.home : pick.away;
  if (typeof h !== "number" || typeof a !== "number") return null;
  return `${h} - ${a}`;
}

// ════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════

export default function ResultadosPage() {
  const { user } = useAuth();
  const { participants, adminResults } = useScoredParticipants();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<MatchStage | "all">("all");
  const [quickFilter, setQuickFilter] = useState<"none" | "live" | "today">("none");
  // Sub-pestañas de Resultados: partidos (por defecto), tablas, cuadro, goleadores
  const [resultsTab, setResultsTab] = useState<"partidos" | "tablas" | "cuadro" | "goleadores">("partidos");
  const [openSection, setOpenSection] = useState<string | null>("group-1");
  const liveMatchRef = useRef<HTMLDivElement | null>(null);
  const didLiveScroll = useRef(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchView | null>(null);
  const didDeepLink = useRef(false);

  const { data, error, isLoading, mutate } = useSWR<ResultsApiPayload>(
    "/api/results/fixtures",
    fetcher,
    {
      // Polling solo si hay partidos en vivo, evita carga innecesaria sobre Neon/API
      refreshInterval: (latest?: ResultsApiPayload) =>
        (latest?.fixtures || []).some((f) => isLivePollingStatus(f.statusShort)) ? 15_000 : 0,
      revalidateOnFocus: true,
      dedupingInterval: 5_000,
      // Reintentos limitados: si la API falla, no entrar en bucle
      onErrorRetry: (_err, _key, _config, revalidate, { retryCount }) => {
        if (retryCount >= 3) return;
        const delay = Math.min(5_000 * (retryCount + 1), 30_000);
        setTimeout(() => revalidate({ retryCount }), delay);
      },
    }
  );

  // Bloqueo de scroll cuando se abre el modal
  useEffect(() => {
    if (!selectedMatch) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedMatch(null);
    };
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onEsc);
    };
  }, [selectedMatch]);

  const connection = error ? "error" : data?.connection || "calendar";

  // Construir vistas + ordenar globalmente por kickoff ascendente
  const merged = useMemo<MatchView[]>(() => {
    const result = mergeScheduleWithApi(data?.fixtures || [], adminResults);
    return result.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
  }, [adminResults, data]);

  // Deep-link: si se abre con ?match=<id> (p. ej. desde el cuadro de la Home),
  // abre el detalle de ese partido, igual que al pulsarlo aquí. Solo una vez.
  useEffect(() => {
    if (didDeepLink.current || merged.length === 0) return;
    const id = new URLSearchParams(window.location.search).get("match");
    if (!id) {
      didDeepLink.current = true;
      return;
    }
    const target = merged.find((m) => String(m.id) === id);
    if (target) {
      setSelectedMatch(target);
      setOpenSection(target.stage === "group" ? `group-${target.matchday}` : target.stage);
      didDeepLink.current = true;
    }
  }, [merged]);

  // Primer partido en vivo (para auto-scroll y para abrir su sección)
  const liveMatch = useMemo(
    () => merged.find((m) => isLiveLike(m.statusShort)) || null,
    [merged]
  );
  const liveSectionKey = useMemo(() => {
    if (!liveMatch) return null;
    if (liveMatch.stage === "group") return `group-${liveMatch.matchday}`;
    return liveMatch.stage;
  }, [liveMatch]);

  // Sección que contiene algún partido de HOY (zona Madrid), para abrirla por
  // defecto cuando no hay ningún partido en vivo.
  const todaySectionKey = useMemo(() => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const isToday = (iso: string) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)) === today;
    const m = merged.find((x) => isToday(x.kickoff));
    if (!m) return null;
    return m.stage === "group" ? `group-${m.matchday}` : m.stage;
  }, [merged]);

  // Al cargar: si hay partido en vivo, abre su sección y desplázate a él.
  // Si no, abre la sección con partidos de hoy. Solo una vez por carga.
  useEffect(() => {
    if (didLiveScroll.current) return;
    if (liveMatch && liveSectionKey) {
      setOpenSection(liveSectionKey);
      didLiveScroll.current = true;
      const t = setTimeout(() => {
        liveMatchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 220);
      return () => clearTimeout(t);
    }
    if (todaySectionKey) {
      setOpenSection(todaySectionKey);
      didLiveScroll.current = true;
    }
  }, [liveMatch, liveSectionKey, todaySectionKey]);

  // Nº de partidos en vivo / hoy para los badges del filtro rápido
  const { liveCount, todayCount } = useMemo(() => {
    const todayMadrid = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    let live = 0, today = 0;
    for (const m of merged) {
      if (isLiveLike(m.statusShort)) live += 1;
      const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(m.kickoff));
      if (d === todayMadrid) today += 1;
    }
    return { liveCount: live, todayCount: today };
  }, [merged]);

  // Si el filtro rápido "En vivo" está activo pero ya no hay partidos en vivo,
  // se desactiva solo para no dejar la lista vacía.
  useEffect(() => {
    if (quickFilter === "live" && liveCount === 0) setQuickFilter("none");
  }, [quickFilter, liveCount]);

  // Filtros en cascada
  const filtered = useMemo(() => {
    let items = [...merged];
    if (quickFilter === "live") {
      items = items.filter((m) => isLiveLike(m.statusShort));
    } else if (quickFilter === "today") {
      const todayMadrid = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      items = items.filter((m) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(m.kickoff)) === todayMadrid);
    }
    if (stageFilter !== "all") items = items.filter((m) => m.stage === stageFilter);
    if (search.trim()) {
      const q = normalizeKey(search);
      items = items.filter((m) =>
        [String(m.id), m.hostCity, m.homeTeam, m.awayTeam].some((v) => normalizeKey(v).includes(q))
      );
    }
    return items;
  }, [merged, stageFilter, search, quickFilter]);

  // Agrupación: fase de grupos partida por jornada, knockouts independientes
  const sections = useMemo(() => {
    const result: Array<{ key: string; title: string; matches: MatchView[] }> = [];

    // Jornadas de grupos
    [1, 2, 3].forEach((md) => {
      const matches = filtered.filter((m) => m.stage === "group" && m.matchday === md);
      if (matches.length) {
        result.push({
          key: `group-${md}`,
          title: `Fase de grupos · Jornada ${md}`,
          matches: matches.sort(
            (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
          ),
        });
      }
    });

    // Resto de fases
    STAGE_ORDER.filter((s) => s !== "group").forEach((stage) => {
      const matches = filtered.filter((m) => m.stage === stage);
      if (matches.length) {
        result.push({
          key: stage,
          title: STAGE_LABELS[stage],
          matches: matches.sort(
            (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
          ),
        });
      }
    });

    return result;
  }, [filtered]);

  return (
    <div className="px-4 pt-5 max-w-[640px] mx-auto">
      <div className="page-header animate-fade-in">
        <div>
          <h1 className="page-header__title">Resultados</h1>
          <p className="text-[11px] text-text-muted">
            {merged.length} partidos · 16 sedes
          </p>
        </div>
        <ConnectionPill
          connection={connection}
          loading={isLoading}
          onRetry={() => void mutate()}
        />
      </div>

      {/* Aviso de error si la API falló */}
      {data?.connection === "error" && data.error && (
        <div className="card mb-3 !py-2.5 !px-3 flex items-center gap-2 animate-fade-in" style={{ borderColor: "rgba(var(--amber), 0.3)", background: "rgb(var(--amber-soft))" }}>
          <AlertCircle size={14} style={{ color: "rgb(var(--amber))" }} />
          <span className="text-[11px] text-amber-mid flex-1">{data.error}</span>
          <button onClick={() => void mutate()} className="text-[11px] font-semibold text-amber-mid bg-transparent border-none cursor-pointer underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Sub-pestañas: Partidos · Tablas · Cuadro · Goleadores */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {([
          ["partidos", "Partidos"],
          ["tablas", "Tablas"],
          ["cuadro", "Cuadro"],
          ["goleadores", "Goleadores"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            className={`pill ${resultsTab === key ? "active" : ""}`}
            onClick={() => setResultsTab(key)}
            style={{ whiteSpace: "nowrap" }}
          >
            {label}
            {key === "partidos" && liveCount > 0 && (
              <span
                className="animate-pulse"
                style={{ marginLeft: 5, display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#ef4444", verticalAlign: "middle" }}
              />
            )}
          </button>
        ))}
      </div>

      {resultsTab === "tablas" && <LiveGroupTables />}
      {resultsTab === "cuadro" && <KnockoutBracket defaultOpen />}
      {resultsTab === "goleadores" && <TopScorers />}

      {resultsTab === "partidos" && (
      <>
      {/* Buscador */}
      <div className="relative mb-3">
        <Search
          size={14}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          aria-hidden="true"
        />
        <input
          className="input-field !pl-9"
          placeholder="Buscar partido, equipo o sede…"
          value={search}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
        />
      </div>

      {/* Filtro rápido: En vivo / Hoy */}
      <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
        {liveCount > 0 && (
          <button
            className={`pill ${quickFilter === "live" ? "active" : ""}`}
            onClick={() => setQuickFilter(quickFilter === "live" ? "none" : "live")}
            style={quickFilter === "live" ? { background: "rgba(220,38,38,0.15)", color: "#ef4444", borderColor: "#ef4444" } : undefined}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span className="animate-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
              En vivo ({liveCount})
            </span>
          </button>
        )}
        <button
          className={`pill ${quickFilter === "today" ? "active" : ""}`}
          onClick={() => setQuickFilter(quickFilter === "today" ? "none" : "today")}
        >
          Hoy{todayCount > 0 ? ` (${todayCount})` : ""}
        </button>
        {quickFilter !== "none" && (
          <button className="pill" onClick={() => setQuickFilter("none")}>
            Quitar filtro
          </button>
        )}
      </div>

      {/* Filtros fase */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        <button
          className={`pill ${stageFilter === "all" ? "active" : ""}`}
          onClick={() => setStageFilter("all")}
        >
          Todas las fases
        </button>
        {STAGE_ORDER.map((s) => (
          <button
            key={s}
            className={`pill ${stageFilter === s ? "active" : ""}`}
            onClick={() => setStageFilter(s)}
          >
            {STAGE_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Lista por secciones */}
      {isLoading && !data ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 80 }} />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <EmptyState text="Sin partidos para los filtros aplicados" />
      ) : (
        sections.map((section) => {
          const open = openSection === section.key;
          return (
            <section key={section.key} className="mb-2">
              <button
                onClick={() => setOpenSection(open ? null : section.key)}
                className="card flex items-center justify-between w-full !py-3 !px-3.5 cursor-pointer text-left"
                aria-expanded={open}
              >
                <span className="font-display text-sm font-bold text-text-warm">
                  {section.title}{" "}
                  <span className="text-[11px] text-text-muted font-normal">
                    · {section.matches.length}
                  </span>
                </span>
                {open ? (
                  <ChevronUp size={16} className="text-text-muted" />
                ) : (
                  <ChevronDown size={16} className="text-text-muted" />
                )}
              </button>
              {open && (
                <div className="mt-1.5 flex flex-col gap-1.5 animate-fade-in">
                  {section.matches.map((m) => (
                    <div key={m.id} ref={liveMatch?.id === m.id ? liveMatchRef : undefined}>
                      <MatchRow
                        match={m}
                        onOpen={() => setSelectedMatch(m)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
      </>
      )}

      {selectedMatch && (
        <MatchOverlay
          match={selectedMatch}
          participants={participants}
          adminResults={adminResults}
          currentUserId={user?.id || ""}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// SUBCOMPONENTES
// ════════════════════════════════════════════════════════════

function ConnectionPill({
  connection,
  loading,
  onRetry,
}: {
  connection: string;
  loading: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <span className="badge badge-muted">
        <RefreshCw size={10} className="animate-spin" /> Cargando
      </span>
    );
  }
  if (connection === "live") {
    return (
      <span className="badge badge-green">
        <Wifi size={10} /> En vivo
      </span>
    );
  }
  if (connection === "error") {
    return (
      <button onClick={onRetry} className="badge badge-red border-none cursor-pointer">
        <AlertCircle size={10} /> Error · reintentar
      </button>
    );
  }
  return (
    <span className="badge badge-muted">
      <WifiOff size={10} /> Calendario
    </span>
  );
}

function MatchRow({ match, onOpen }: { match: MatchView; onOpen: () => void }) {
  const isSpain = match.homeTeam === "España" || match.awayTeam === "España";
  const sg = getStatusGroup(match.statusShort);
  const showScore = sg === "live" || sg === "halftime" || sg === "finished";
  // Restauramos paleta cromática por sede: el color principal del badge
  // viene de la región (oeste/centro/este) y el fondo es una versión
  // claramente más clara. Antes esto se había perdido al simplificar.
  const cityColor = getCityColor(match.hostCity);
  const cityBg = getCityBgColor(match.hostCity);

  return (
    <button
      onClick={onOpen}
      className="card w-full text-left !py-3 !px-3.5 cursor-pointer animate-fade-in"
      style={{
        borderLeft: isSpain ? "3px solid #C1121F" : "3px solid transparent",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono text-text-faint">#{match.id}</span>
          {match.group && <GroupBadge group={match.group} />}
          <span className={getStatusBadgeClass(match.statusShort)}>
            {getStatusDisplay(match.statusShort, {
              elapsed: match.minute,
              kickoff: match.kickoff,
            })}
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold"
          style={{
            background: cityBg,
            color: cityColor,
            border: `1px solid ${cityColor}33`,
          }}
        >
          <MapPin size={9} /> {match.hostCity}
        </span>
      </div>

      <div className="flex items-center justify-center gap-2">
        <div className="flex flex-1 items-center justify-end gap-1.5 text-right">
          <span className="text-xs font-medium text-text-primary truncate">
            {match.homeTeam}
          </span>
          <Flag country={match.homeTeam} size="sm" />
        </div>
        <div
          className="font-display text-sm font-bold rounded-lg px-2.5 py-1 min-w-[56px] text-center tabular-nums"
          style={{
            background: showScore ? "rgb(var(--bg-elevated))" : "rgb(var(--bg-muted))",
            color: showScore ? "rgb(var(--text-primary))" : "rgb(var(--text-muted))",
            border: showScore ? "1px solid rgb(var(--border-default))" : undefined,
          }}
        >
          {showScore ? `${match.score.home}-${match.score.away}` : "vs"}
        </div>
        <div className="flex flex-1 items-center gap-1.5">
          <Flag country={match.awayTeam} size="sm" />
          <span className="text-xs font-medium text-text-primary truncate">
            {match.awayTeam}
          </span>
        </div>
      </div>

      {(sg === "scheduled" || sg === "postponed") && (
        <p className="mt-1.5 text-[10px] text-text-muted text-center flex items-center justify-center gap-1">
          <Clock3 size={10} />
          {formatKickoff(match.kickoff)}
        </p>
      )}
    </button>
  );
}

// ── Predicciones de la peñita en ELIMINATORIAS ──────────────────────────────
// Modelo (Opción A, coherente con el ranking): en cada cruce se muestra, por
// porra, su apuesta de que ese equipo AVANCE (gane el cruce y pase de ronda).
// Los puntos son los que esa porra suma por que el equipo alcance la SIGUIENTE
// ronda (idénticos a los del sistema de puntuación / ranking):
//   Ronda de 32 → +10 (pasar a octavos)   ·  Octavos → +15 (pasar a cuartos)
//   Cuartos     → +20 (pasar a semis)     ·  Semis   → +25 (pasar a la final)
//   Final       → +50 (campeón)           ·  3.er puesto → +20 (tercero)
// Estados por porra: gris 0 (no tiene a ese equipo avanzando en esa ronda),
// verde +pts › (lo tiene y avanza → suma), rojo 0 (lo tenía pero cae en ese cruce).
type KoAdvanceConfig = {
  pickCountries: (t: Team) => string[];
  points: number;
  officialSet: (a: AdminResults) => Set<string>;
  resolved: (a: AdminResults) => boolean;
  nextLabel: string;
};

function getKnockoutAdvanceConfig(stage: MatchStage): KoAdvanceConfig | null {
  const ko = (t: Team, key: string) => (t.knockoutPicks?.[key] || []).map((p) => p.country).filter(Boolean);
  switch (stage) {
    case "round-of-32":
      return {
        pickCountries: (t) => ko(t, "dieciseisavos"),
        points: 10,
        officialSet: (a) => new Set((a.knockoutRounds.octavos || []).filter(Boolean)),
        resolved: (a) => (a.knockoutRounds.octavos || []).filter(Boolean).length >= 16,
        nextLabel: "octavos",
      };
    case "round-of-16":
      return {
        pickCountries: (t) => ko(t, "octavos"),
        points: 15,
        officialSet: (a) => new Set((a.knockoutRounds.cuartos || []).filter(Boolean)),
        resolved: (a) => (a.knockoutRounds.cuartos || []).filter(Boolean).length >= 8,
        nextLabel: "cuartos",
      };
    case "quarter-final":
      return {
        pickCountries: (t) => ko(t, "cuartos"),
        points: 20,
        officialSet: (a) => new Set((a.knockoutRounds.semis || []).filter(Boolean)),
        resolved: (a) => (a.knockoutRounds.semis || []).filter(Boolean).length >= 4,
        nextLabel: "semifinal",
      };
    case "semi-final":
      return {
        pickCountries: (t) => ko(t, "semis"),
        points: 25,
        officialSet: (a) => new Set((a.knockoutRounds.final || []).filter(Boolean)),
        resolved: (a) => (a.knockoutRounds.final || []).filter(Boolean).length >= 2,
        nextLabel: "final",
      };
    case "final":
      return {
        pickCountries: (t) => (t.championPick ? [t.championPick] : []),
        points: 50,
        officialSet: (a) => new Set(a.podium.campeon ? [a.podium.campeon] : []),
        resolved: (a) => Boolean(a.podium.campeon),
        nextLabel: "campeón",
      };
    case "third-place":
      return {
        pickCountries: (t) => (t.thirdPlacePick ? [t.thirdPlacePick] : []),
        points: 20,
        officialSet: (a) => new Set(a.podium.tercero ? [a.podium.tercero] : []),
        resolved: (a) => Boolean(a.podium.tercero),
        nextLabel: "3.er puesto",
      };
    default:
      return null;
  }
}

type KoState = "none" | "hit" | "miss" | "pending";

function KnockoutPickBadge({ state, points }: { state: KoState; points: number }) {
  if (state === "hit") {
    return (
      <span className="font-display text-xs font-bold rounded-md px-2 py-0.5 tabular-nums inline-flex items-center gap-1"
        style={{ background: "rgba(63,157,78,0.16)", color: "#3E9B4F", border: "1px solid rgba(63,157,78,0.3)" }}>
        <span aria-hidden>›</span> +{points}
      </span>
    );
  }
  if (state === "miss") {
    return (
      <span className="font-display text-xs font-bold rounded-md px-2 py-0.5 tabular-nums"
        style={{ background: "rgb(var(--danger) / 0.12)", color: "rgb(var(--danger))", border: "1px solid rgb(var(--danger) / 0.25)" }}>
        0
      </span>
    );
  }
  if (state === "pending") {
    return (
      <span className="font-display text-xs font-bold rounded-md px-2 py-0.5 tabular-nums"
        style={{ background: "rgb(var(--bg-muted))", color: "rgb(var(--text-faint))", border: "1px dashed rgb(var(--border-default))" }}>
        +{points}
      </span>
    );
  }
  return (
    <span className="font-display text-xs font-bold rounded-md px-2 py-0.5 tabular-nums"
      style={{ background: "rgb(var(--bg-muted))", color: "rgb(var(--text-faint))" }}>
      0
    </span>
  );
}

function KnockoutPredictions({ match, participants, adminResults, currentUserId }: {
  match: MatchView;
  participants: Team[];
  adminResults: AdminResults;
  currentUserId: string;
}) {
  const [side, setSide] = useState<"home" | "away">("home");
  const cfg = getKnockoutAdvanceConfig(match.stage);
  const team = side === "home" ? match.homeTeam : match.awayTeam;
  const placeholder = /Grupo|Ganador|Perdedor|Mejor 3/.test(team);

  const rows = useMemo(() => {
    if (!cfg || placeholder) return [] as { team: Team; state: KoState }[];
    const official = cfg.officialSet(adminResults);
    // Este cruce queda decidido en cuanto uno de los dos equipos del partido
    // aparece en la siguiente ronda (avanza exactamente uno por cruce). Así el
    // fallo se pinta en ROJO al resolverse ESTE cruce, sin esperar a que se
    // complete el resto de la ronda.
    const crossResolved = official.has(match.homeTeam) || official.has(match.awayTeam);
    return participants
      .map((t) => {
        const picked = cfg.pickCountries(t).includes(team);
        // Verde: la tenías avanzando y ya está clasificada a la siguiente ronda.
        // Rojo 0: la tenías avanzando pero este cruce ya se resolvió y NO pasó.
        // Pendiente: la tenías avanzando y el cruce aún no está decidido.
        // Gris 0 ("none"): no la tenías avanzando (la diste por eliminada en una
        // ronda previa de tu bracket) → no es fallo.
        let state: KoState = "none";
        if (picked) state = official.has(team) ? "hit" : crossResolved ? "miss" : "pending";
        return { team: t, state };
      })
      .sort((a, b) => a.team.currentRank - b.team.currentRank);
  }, [cfg, placeholder, team, participants, adminResults, match]);

  if (!cfg) return <EmptyState text="Sin predicciones para esta ronda." />;

  const aciertos = rows.filter((r) => r.state === "hit").length;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Toggle Local / Visitante */}
      <div className="flex gap-1.5">
        {(["home", "away"] as const).map((s) => {
          const t = s === "home" ? match.homeTeam : match.awayTeam;
          const active = side === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold cursor-pointer min-w-0"
              style={{
                background: active ? "rgb(var(--bg-elevated))" : "transparent",
                border: `1px solid ${active ? "rgb(var(--accent-participante))" : "rgb(var(--border-default))"}`,
                color: active ? "rgb(var(--text-primary))" : "rgb(var(--text-muted))",
              }}
            >
              <span className="text-[8px] uppercase tracking-wide opacity-70 flex-shrink-0">{s === "home" ? "Local" : "Visitante"}</span>
              <Flag country={t} size="sm" />
              <span className="truncate">{t}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-text-muted">
        {placeholder ? (
          "Equipo por determinar."
        ) : (
          <>
            Pasar a {cfg.nextLabel}: <span className="font-semibold text-text-secondary">+{cfg.points} pts</span>
            {" · "}{aciertos} {aciertos === 1 ? "acierto" : "aciertos"}
          </>
        )}
      </p>

      {placeholder ? (
        <EmptyState text="Cuando se confirme el equipo se mostrarán las predicciones." />
      ) : rows.length === 0 ? (
        <EmptyState text="Sin predicciones todavía." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map(({ team: t, state }) => {
            const isMine = t.userId === currentUserId;
            return (
              <div
                key={t.id}
                className="card flex items-center gap-2.5 !py-2.5 !px-3"
                style={{
                  borderLeft: isMine ? "3px solid rgb(var(--accent-participante))" : undefined,
                  background: isMine ? "rgba(63,157,78,0.04)" : undefined,
                }}
              >
                <span className="font-display text-xs font-bold text-text-faint min-w-[24px]">#{t.currentRank}</span>
                <InitialsAvatar name={t.name} size={36} avatarUrl={t.avatarUrl} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text-primary truncate">{t.name}</p>
                  <p className="text-[10px] text-text-muted truncate">@{t.username}</p>
                </div>
                <KnockoutPickBadge state={state} points={cfg.points} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MatchOverlay({
  match,
  participants,
  adminResults,
  currentUserId,
  onClose,
}: {
  match: MatchView;
  participants: Team[];
  adminResults: AdminResults;
  currentUserId: string;
  onClose: () => void;
}) {
  const ref = getGroupFixtureRef(match);
  // Task 2: el partido inaugural (id 1, México - Sudáfrica) muestra además el
  // pick especial "Minuto Primer Gol" de cada porra junto al marcador previsto.
  const isInaugural = match.id === 1;
  // El primer partido de España (id 14, España - Cabo Verde) no tuvo gol
  // español, así que el pick "Primer Goleador Español" se muestra en el
  // siguiente partido de España (id 38, España - Arabia Saudí).
  const isSpainOpener = match.id === 38;

  // Resultado oficial de los especiales (si el admin ya lo confirmó), para
  // resaltar en verde la porra que acertó. Normalizamos el nombre del goleador
  // para comparar de forma tolerante (mayúsculas/espacios/acentos).
  const normName = (s: string) =>
    s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
  const officialScorer = adminResults.specialResults?.primerGolEsp || "";
  const officialScorerNorm = officialScorer ? normName(officialScorer) : "";
  const officialMinute =
    typeof adminResults.specialResults?.minutoPrimerGol === "number"
      ? adminResults.specialResults.minutoPrimerGol
      : null;

  const rows = useMemo(() => {
    if (!ref) return [];
    return participants.map((t) => {
      const pick = t.matchPicks?.[ref.fixture.id];
      const text = formatPredictionScore(pick, ref.flipped);
      const isDouble = Boolean(
        ref.fixture.group && t.doubleMatches?.[ref.fixture.group] === ref.fixture.id
      );
      return {
        team: t,
        pick,
        text,
        isDouble,
        isMine: t.userId === currentUserId,
      };
    });
  }, [ref, participants, currentUserId]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="rounded-t-3xl w-full max-w-[640px] max-h-[88vh] overflow-y-auto p-5 animate-slide-up bg-bg-1"
        style={{ border: "1px solid rgb(var(--border-default))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-10 h-1 rounded-full mx-auto mb-4"
          style={{ background: "rgb(var(--border-default))" }}
        />

        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-text-faint">#{match.id}</span>
            {match.group && <GroupBadge group={match.group} />}
            <span className="text-[10px] text-text-muted">
              {formatKickoff(match.kickoff)} · {match.hostCity}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 cursor-pointer text-text-muted bg-bg-2 border-none"
            aria-label="Cerrar"
          >
            <X size={17} />
          </button>
        </div>

        {(() => {
          const overlaySg = getStatusGroup(match.statusShort);
          const overlayShowScore =
            (overlaySg === "live" || overlaySg === "finished") &&
            typeof match.score.home === "number" &&
            typeof match.score.away === "number";
          return (
            <div className="mb-5">
              <div className="flex items-center justify-center mb-2.5">
                <span className={getStatusBadgeClass(match.statusShort)}>
                  {getStatusDisplay(match.statusShort, {
                    elapsed: match.minute,
                    kickoff: match.kickoff,
                  })}
                </span>
              </div>
              <div className="flex items-center justify-center gap-3">
                <div className="flex flex-1 items-center justify-end gap-2 text-right">
                  <span className="font-display text-sm font-bold text-text-primary truncate">
                    {match.homeTeam}
                  </span>
                  <Flag country={match.homeTeam} size="md" />
                </div>
                <div
                  className="font-display text-2xl font-black rounded-xl px-4 py-2 min-w-[84px] text-center tabular-nums"
                  style={{
                    background: overlayShowScore ? "rgb(var(--bg-elevated))" : "rgb(var(--bg-muted))",
                    color: overlayShowScore ? "rgb(var(--text-primary))" : "rgb(var(--text-faint))",
                    border: overlayShowScore ? "1px solid rgb(var(--border-default))" : undefined,
                  }}
                >
                  {overlayShowScore ? `${match.score.home}-${match.score.away}` : "vs"}
                </div>
                <div className="flex flex-1 items-center gap-2">
                  <Flag country={match.awayTeam} size="md" />
                  <span className="font-display text-sm font-bold text-text-primary truncate">
                    {match.awayTeam}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Cronología del partido según la API (goles, tarjetas, cambios) */}
        {match.events.length > 0 && (
          <div className="card !py-2.5 !px-3 mb-4">
            <p className="text-[9px] uppercase tracking-widest text-text-muted" style={{ margin: "0 0 8px" }}>
              Cronología
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {match.events.map((ev, i) => {
                const icon =
                  ev.type === "goal" ? (ev.ownGoal ? "⚽🔴" : "⚽")
                  : ev.type === "yellow" ? "🟨"
                  : ev.type === "red" ? "🟥"
                  : ev.type === "yellow-red" ? "🟨🟥"
                  : ev.type === "substitution" ? "🔄"
                  : ev.type === "var" ? "📺"
                  : ev.type === "penalty-missed" ? "❌"
                  : "•";
                const isHome = ev.side === "home";
                const label =
                  ev.type === "substitution"
                    ? `${ev.player}${ev.playerOut ? ` ↔ ${ev.playerOut}` : ""}`
                    : `${ev.player}${ev.type === "goal" && ev.penalty ? " (p)" : ""}${ev.type === "goal" && ev.ownGoal ? " (p.p.)" : ""}${ev.type === "penalty-missed" ? " (penalti fallado)" : ""}`;
                return (
                  <div
                    key={`${ev.type}-${i}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flexDirection: isHome ? "row" : "row-reverse",
                      textAlign: isHome ? "left" : "right",
                    }}
                  >
                    <span className="text-[10px] font-bold tabular-nums text-text-muted" style={{ minWidth: 26, textAlign: isHome ? "left" : "right" }}>
                      {typeof ev.minute === "number" ? `${ev.minute}'` : ""}
                    </span>
                    <span style={{ fontSize: 11 }}>{icon}</span>
                    <span className="text-[11px] text-text-primary" style={{ flex: 1 }}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <h4 className="text-[10px] uppercase tracking-widest font-semibold text-text-muted mb-2 flex items-center gap-1.5">
          <Users size={11} /> Predicciones de la peñita
        </h4>

        {match.stage !== "group" ? (
          <KnockoutPredictions
            match={match}
            participants={participants}
            adminResults={adminResults}
            currentUserId={currentUserId}
          />
        ) : !ref ? (
          <EmptyState text="No se ha podido vincular este partido con los picks del club." />
        ) : rows.length === 0 ? (
          <EmptyState text="Sin predicciones todavía." />
        ) : (
          <div className="flex flex-col gap-1.5">
            {rows
              .sort((a, b) => a.team.currentRank - b.team.currentRank)
              .map(({ team, pick, text, isDouble, isMine }) => (
                <div
                  key={team.id}
                  className="card flex flex-col !py-2.5 !px-3"
                  style={{
                    borderLeft: isMine
                      ? "3px solid rgb(var(--accent-participante))"
                      : undefined,
                    background: isMine ? "rgba(63,157,78,0.04)" : undefined,
                  }}
                >
                  <div className="flex items-center gap-2.5">
                  <span className="font-display text-xs font-bold text-text-faint min-w-[24px]">
                    #{team.currentRank}
                  </span>
                  <InitialsAvatar name={team.name} size={36} avatarUrl={team.avatarUrl} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-text-primary truncate">
                      {team.name}
                    </p>
                    <p className="text-[10px] text-text-muted truncate">@{team.username}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    {text ? (
                      <span
                        className="font-display text-xs font-bold rounded-md px-2 py-0.5 tabular-nums"
                        style={{
                          background: isDouble
                            ? "rgb(var(--gold-soft))"
                            : "rgb(var(--bg-muted))",
                          color: isDouble
                            ? "rgb(var(--gold))"
                            : "rgb(var(--text-secondary))",
                          border: isDouble ? "1px solid rgba(var(--gold),0.3)" : undefined,
                        }}
                      >
                        {text}
                      </span>
                    ) : (
                      <span className="text-[10px] text-text-faint">—</span>
                    )}
                    {isInaugural && (() => {
                      const myMinute =
                        typeof team.specials?.minutoPrimerGol === "number" && team.specials.minutoPrimerGol > 0
                          ? team.specials.minutoPrimerGol
                          : null;
                      const hit = officialMinute !== null && myMinute !== null && myMinute === officialMinute;
                      return (
                        <span
                          className="text-[9px] font-semibold tabular-nums whitespace-nowrap"
                          style={{ color: hit ? "#3E9B4F" : "rgb(var(--text-muted))" }}
                        >
                          Min. 1.<sup>er</sup> gol: {myMinute !== null ? `${myMinute}'` : "—"}
                          {hit ? " ✓" : ""}
                        </span>
                      );
                    })()}
                  </div>
                  {pick && <PickChip status={pick.status} points={pick.points} />}
                  </div>
                  {isSpainOpener && (() => {
                    const myScorer = team.specials?.primerGolEsp || "";
                    const hit = officialScorerNorm !== "" && myScorer !== "" && normName(myScorer) === officialScorerNorm;
                    return (
                      <div
                        className="flex items-center gap-1.5 mt-1.5 pt-1.5"
                        style={{ borderTop: "1px solid rgb(var(--border-subtle))" }}
                      >
                        <span
                          className="text-[9px] font-semibold uppercase tracking-wide flex-shrink-0"
                          style={{ color: hit ? "#3E9B4F" : "rgb(var(--text-faint))" }}
                        >
                          1.<sup>er</sup> goleador ESP
                        </span>
                        <span
                          className="text-[11px] font-semibold truncate"
                          style={{ color: hit ? "#3E9B4F" : "rgb(var(--text-secondary))" }}
                        >
                          {myScorer || "—"}
                          {hit ? " ✓" : ""}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
