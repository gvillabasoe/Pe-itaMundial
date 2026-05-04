"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import useSWR from "swr";
import { AlertCircle, ChevronDown, ChevronUp, Clock3, MapPin, RefreshCw, Search, Users, Wifi, WifiOff, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { EmptyState, Flag, GroupBadge, InitialsAvatar, PickChip, Skeleton } from "@/components/ui";
import { FIXTURES, GROUPS, type Fixture, type MatchPick, type Team } from "@/lib/data";
import { useScoredParticipants } from "@/lib/use-scored-participants";
import { REGION_LABELS, REGION_PALETTES, type Zone } from "@/lib/config/regions";
import { getStatusDisplay, getStatusGroup, isLivePollingStatus } from "@/lib/config/match-status";
import { STAGE_LABELS, STAGE_ORDER, WORLD_CUP_MATCHES, type MatchStage, type WorldCupMatch } from "@/lib/worldcup/schedule";
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

// ── Resolución de kickoffs (WorldCupMatch no tiene `kickoff` propio) ─

function buildIsoSeries(startDate: string, hoursUtc: number[], count: number): string[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const values: string[] = [];
  let h = 0;
  let d = 0;
  for (let i = 0; i < count; i += 1) {
    const slot = new Date(start);
    slot.setUTCDate(start.getUTCDate() + d);
    slot.setUTCHours(hoursUtc[h], 0, 0, 0);
    values.push(slot.toISOString());
    h += 1;
    if (h >= hoursUtc.length) {
      h = 0;
      d += 1;
    }
  }
  return values;
}

const GROUP_KICKOFF_BY_PAIR = new Map<string, string>();
FIXTURES.forEach((f) => {
  if (!f.kickoff) return;
  const key1 = `${normalizeKey(f.homeTeam)}|${normalizeKey(f.awayTeam)}`;
  const key2 = `${normalizeKey(f.awayTeam)}|${normalizeKey(f.homeTeam)}`;
  GROUP_KICKOFF_BY_PAIR.set(key1, f.kickoff);
  GROUP_KICKOFF_BY_PAIR.set(key2, f.kickoff);
});

const KNOCKOUT_KICKOFF_FALLBACKS: Record<Exclude<MatchStage, "group">, string[]> = {
  "round-of-32": buildIsoSeries("2026-06-28", [16, 19], 16),
  "round-of-16": buildIsoSeries("2026-07-06", [16, 19], 8),
  "quarter-final": buildIsoSeries("2026-07-11", [16, 19], 4),
  "semi-final": buildIsoSeries("2026-07-15", [19], 2),
  "third-place": buildIsoSeries("2026-07-18", [18], 1),
  final: buildIsoSeries("2026-07-19", [19], 1),
};

const KNOCKOUT_KICKOFF_BY_ID = new Map<number, string>();
(Object.keys(KNOCKOUT_KICKOFF_FALLBACKS) as Array<Exclude<MatchStage, "group">>).forEach((stage) => {
  WORLD_CUP_MATCHES.filter((m) => m.stage === stage).forEach((m, i) => {
    KNOCKOUT_KICKOFF_BY_ID.set(m.id, KNOCKOUT_KICKOFF_FALLBACKS[stage][i]);
  });
});

/**
 * Devuelve el kickoff ISO para un partido del calendario oficial.
 * - Grupos: lookup por par de equipos en FIXTURES (mock con kickoffs reales).
 * - Eliminatorias: lookup por id en serie ISO determinista.
 */
function getKickoffForMatch(match: WorldCupMatch): string {
  if (match.stage === "group") {
    const key = `${normalizeKey(match.homeTeam)}|${normalizeKey(match.awayTeam)}`;
    return GROUP_KICKOFF_BY_PAIR.get(key) || "2026-06-11T19:00:00.000Z";
  }
  return KNOCKOUT_KICKOFF_BY_ID.get(match.id) || "2026-07-19T19:00:00.000Z";
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

  // Index API fixtures por stage (para knockouts, asignación posicional)
  const apiByStage = new Map<MatchStage, ApiFixtureItem[]>();
  STAGE_ORDER.forEach((s) => {
    const list = fixtures
      .filter((f) => f.stage === s)
      .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
    apiByStage.set(s, list);
  });
  const stageOffsets = new Map<MatchStage, number>();
  STAGE_ORDER.forEach((s) => stageOffsets.set(s, 0));

  const merged: MatchView[] = WORLD_CUP_MATCHES.map((m) => {
    let api: ApiFixtureItem | undefined;

    if (m.stage === "group") {
      api = groupApiByPair.get(`${normalizeKey(m.homeTeam)}|${normalizeKey(m.awayTeam)}`);
    } else {
      const list = apiByStage.get(m.stage) || [];
      const idx = stageOffsets.get(m.stage) ?? 0;
      api = list[idx];
      stageOffsets.set(m.stage, idx + 1);
    }

    const manual = getAdminResultOverride(m.id, adminResults);
    const effectiveResult = manual || api;

    return {
      id: m.id,
      stage: m.stage,
      roundLabel: m.roundLabel,
      hostCity: m.hostCity,
      zone: m.zone,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      statusShort: effectiveResult?.statusShort || "NS",
      minute: effectiveResult?.minute ?? null,
      // El kickoff se deriva del schedule oficial. WorldCupMatch no tiene
      // este campo nativamente: lo resolvemos vía FIXTURES (grupos) o serie
      // ISO determinista (eliminatorias). La API solo aporta score y minuto.
      kickoff: getKickoffForMatch(m),
      score: effectiveResult?.score || { home: null, away: null },
      group: m.stage === "group" ? getGroupForMatch(m.homeTeam, m.awayTeam) : null,
      matchday: null, // se rellena después en assignMatchdays
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
  const [zoneFilter, setZoneFilter] = useState<Zone | "all">("all");
  const [openSection, setOpenSection] = useState<string | null>("group-1");
  const [selectedMatch, setSelectedMatch] = useState<MatchView | null>(null);

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

  // Filtros en cascada
  const filtered = useMemo(() => {
    let items = [...merged];
    if (stageFilter !== "all") items = items.filter((m) => m.stage === stageFilter);
    if (zoneFilter !== "all") items = items.filter((m) => m.zone === zoneFilter);
    if (search.trim()) {
      const q = normalizeKey(search);
      items = items.filter((m) =>
        [String(m.id), m.hostCity, m.homeTeam, m.awayTeam].some((v) => normalizeKey(v).includes(q))
      );
    }
    return items;
  }, [merged, stageFilter, zoneFilter, search]);

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

      {/* Filtros región */}
      <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
        <button
          className={`pill ${zoneFilter === "all" ? "active" : ""}`}
          onClick={() => setZoneFilter("all")}
        >
          Todas las regiones
        </button>
        {(Object.keys(REGION_PALETTES) as Zone[]).map((z) => {
          const palette = REGION_PALETTES[z] as { primary?: string };
          const accent = palette?.primary;
          return (
            <button
              key={z}
              className={`pill ${zoneFilter === z ? "active" : ""}`}
              onClick={() => setZoneFilter(z)}
              style={
                zoneFilter === z && accent
                  ? { background: `${accent}22`, color: accent, borderColor: accent }
                  : undefined
              }
            >
              {REGION_LABELS[z]}
            </button>
          );
        })}
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
                    <MatchRow
                      key={m.id}
                      match={m}
                      onOpen={() => setSelectedMatch(m)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}

      {selectedMatch && (
        <MatchOverlay
          match={selectedMatch}
          participants={participants}
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
            background: "rgb(var(--bg-muted))",
            color: "rgb(var(--text-secondary))",
            border: "1px solid rgb(var(--border-subtle))",
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

function MatchOverlay({
  match,
  participants,
  currentUserId,
  onClose,
}: {
  match: MatchView;
  participants: Team[];
  currentUserId: string;
  onClose: () => void;
}) {
  const ref = getGroupFixtureRef(match);

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

        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="flex items-center gap-2 flex-1 justify-end">
            <span className="font-display text-sm font-bold text-text-primary">
              {match.homeTeam}
            </span>
            <Flag country={match.homeTeam} size="md" />
          </div>
          <span className="font-display text-xl font-black text-text-faint">vs</span>
          <div className="flex items-center gap-2 flex-1">
            <Flag country={match.awayTeam} size="md" />
            <span className="font-display text-sm font-bold text-text-primary">
              {match.awayTeam}
            </span>
          </div>
        </div>

        <h4 className="text-[10px] uppercase tracking-widest font-semibold text-text-muted mb-2 flex items-center gap-1.5">
          <Users size={11} /> Predicciones de la peñita
        </h4>

        {!ref ? (
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
                  className="card flex items-center gap-2.5 !py-2.5 !px-3"
                  style={{
                    borderLeft: isMine
                      ? "3px solid rgb(var(--accent-participante))"
                      : undefined,
                    background: isMine ? "rgba(63,157,78,0.04)" : undefined,
                  }}
                >
                  <span className="font-display text-xs font-bold text-text-faint min-w-[24px]">
                    #{team.currentRank}
                  </span>
                  <InitialsAvatar name={team.name} size={28} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-text-primary truncate">
                      {team.name}
                    </p>
                    <p className="text-[10px] text-text-muted">@{team.username}</p>
                  </div>
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
                  {pick && <PickChip status={pick.status} points={pick.points} />}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
