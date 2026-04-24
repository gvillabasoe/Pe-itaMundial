"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import useSWR from "swr";
import { AlertCircle, ChevronDown, ChevronUp, Clock3, Lock, MapPin, Search, Users, Wifi, WifiOff, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { CountryWithFlag, EmptyState, Flag, GroupBadge, MatchupWithFlags } from "@/components/ui";
import { FIXTURES, GROUPS, type Fixture, type MatchPick, type Team } from "@/lib/data";
import { useScoredParticipants } from "@/lib/use-scored-participants";
import { ALL_HOST_CITIES, getCityBgColor, getCityColor, getZoneForCity, REGION_LABELS, REGION_PALETTES, type Zone } from "@/lib/config/regions";
import { getStatusDisplay, getStatusGroup, isLivePollingStatus } from "@/lib/config/match-status";
import { STAGE_LABELS, STAGE_ORDER, WORLD_CUP_MATCHES, type MatchStage, type WorldCupMatch } from "@/lib/worldcup/schedule";
import type { AdminResults } from "@/lib/admin-results";

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
  competitionLabel: string | null;
  hostCity: string;
  zone: Zone | null;
  homeTeam: string;
  awayTeam: string;
  displayHomeTeam: string;
  displayAwayTeam: string;
  statusShort: string;
  minute: number | null;
  kickoff: string;
  score: { home: number | null; away: number | null };
  group: string | null;
}

type PredictionKind = "score" | "winner" | "finalists";

interface MatchPredictionRow {
  teamId: string;
  participantName: string;
  username: string;
  currentRank: number;
  totalPoints: number;
  predictionText: string | null;
  predictionTeams?: string[];
  secondaryText?: string | null;
  secondaryCountry?: string | null;
  isDouble: boolean;
  isMine: boolean;
  kind: PredictionKind;
}

interface MatchPredictionDataset {
  rows: MatchPredictionRow[];
  note?: string | null;
  emptyTitle: string;
  emptyText: string;
}

const fetcher = async (url: string): Promise<ResultsApiPayload> => {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok && data?.connection === "error") {
    return data;
  }
  return data;
};

const KNOWN_TEAMS = new Set(Object.values(GROUPS).flat());

const KNOCKOUT_PICK_STAGE_KEY: Partial<Record<MatchStage, string>> = {
  "round-of-32": "dieciseisavos",
  "round-of-16": "octavos",
  "quarter-final": "cuartos",
  "semi-final": "semis",
  final: "final",
};

const KNOCKOUT_STAGE_INDEX_BY_ID = new Map<number, number>();
(["round-of-32", "round-of-16", "quarter-final", "semi-final"] as MatchStage[]).forEach((stage) => {
  WORLD_CUP_MATCHES
    .filter((match) => match.stage === stage)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach((match, index) => {
      KNOCKOUT_STAGE_INDEX_BY_ID.set(match.id, index);
    });
});

function normalizeKey(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildIsoSeries(startDate: string, hoursUtc: number[], count: number): string[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const values: string[] = [];
  let hourIndex = 0;
  let dayOffset = 0;

  for (let index = 0; index < count; index += 1) {
    const slot = new Date(start);
    slot.setUTCDate(start.getUTCDate() + dayOffset);
    slot.setUTCHours(hoursUtc[hourIndex], 0, 0, 0);
    values.push(slot.toISOString());

    hourIndex += 1;
    if (hourIndex >= hoursUtc.length) {
      hourIndex = 0;
      dayOffset += 1;
    }
  }

  return values;
}

const GROUP_FALLBACK_KICKOFFS = new Map(
  FIXTURES.map((fixture) => [`${normalizeKey(fixture.homeTeam)}|${normalizeKey(fixture.awayTeam)}`, fixture.kickoff])
);

const KNOCKOUT_FALLBACKS: Record<Exclude<MatchStage, "group">, string[]> = {
  "round-of-32": buildIsoSeries("2026-06-28", [16, 19], 16),
  "round-of-16": buildIsoSeries("2026-07-06", [16, 19], 8),
  "quarter-final": buildIsoSeries("2026-07-11", [16, 19], 4),
  "semi-final": buildIsoSeries("2026-07-15", [19], 2),
  "third-place": buildIsoSeries("2026-07-18", [18], 1),
  final: buildIsoSeries("2026-07-19", [19], 1),
};

const KNOCKOUT_FALLBACK_BY_ID = new Map<number, string>();
(
  Object.keys(KNOCKOUT_FALLBACKS) as Array<Exclude<MatchStage, "group">>
).forEach((stage) => {
  WORLD_CUP_MATCHES.filter((match) => match.stage === stage).forEach((match, index) => {
    KNOCKOUT_FALLBACK_BY_ID.set(match.id, KNOCKOUT_FALLBACKS[stage][index]);
  });
});

function getGroupForMatch(homeTeam: string, awayTeam: string): string | null {
  for (const [group, teams] of Object.entries(GROUPS)) {
    if (teams.includes(homeTeam) && teams.includes(awayTeam)) return group;
  }
  return null;
}

function buildGroupFixtureMap(fixtures: ApiFixtureItem[]) {
  const map = new Map<string, ApiFixtureItem>();
  fixtures
    .filter((fixture) => fixture.stage === "group")
    .forEach((fixture) => {
      const key = `${normalizeKey(fixture.homeTeam)}|${normalizeKey(fixture.awayTeam)}`;
      map.set(key, fixture);
    });
  return map;
}

function getFallbackKickoff(match: WorldCupMatch): string {
  if (match.stage === "group") {
    const key = `${normalizeKey(match.homeTeam)}|${normalizeKey(match.awayTeam)}`;
    return GROUP_FALLBACK_KICKOFFS.get(key) || "2026-06-11T19:00:00Z";
  }

  return KNOCKOUT_FALLBACK_BY_ID.get(match.id) || "2026-07-19T19:00:00Z";
}

function getAdminResultOverride(matchId: number, adminResults: AdminResults) {
  const manualResult = adminResults.matchResults[String(matchId)];
  if (typeof manualResult?.home !== "number" || typeof manualResult?.away !== "number") {
    return null;
  }

  return {
    statusShort: manualResult.statusShort || "FT",
    minute: null,
    score: {
      home: manualResult.home,
      away: manualResult.away,
    },
  };
}

function mergeScheduleWithApi(fixtures: ApiFixtureItem[], adminResults: AdminResults): MatchView[] {
  const groupMap = buildGroupFixtureMap(fixtures);
  const stageMap = STAGE_ORDER.reduce<Record<MatchStage, ApiFixtureItem[]>>((acc, stage) => {
    acc[stage] = fixtures
      .filter((fixture) => fixture.stage === stage)
      .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
    return acc;
  }, {
    group: [],
    "round-of-32": [],
    "round-of-16": [],
    "quarter-final": [],
    "semi-final": [],
    "third-place": [],
    final: [],
  });

  const stageOffsets = STAGE_ORDER.reduce<Record<MatchStage, number>>((acc, stage) => {
    acc[stage] = 0;
    return acc;
  }, {
    group: 0,
    "round-of-32": 0,
    "round-of-16": 0,
    "quarter-final": 0,
    "semi-final": 0,
    "third-place": 0,
    final: 0,
  });

  return WORLD_CUP_MATCHES.map((match) => {
    let apiFixture: ApiFixtureItem | undefined;

    if (match.stage === "group") {
      const key = `${normalizeKey(match.homeTeam)}|${normalizeKey(match.awayTeam)}`;
      apiFixture = groupMap.get(key);
    } else {
      const stageIndex = stageOffsets[match.stage];
      apiFixture = stageMap[match.stage][stageIndex];
      stageOffsets[match.stage] = stageIndex + 1;
    }

    const manualResult = getAdminResultOverride(match.id, adminResults);
    const effectiveFixture = manualResult || apiFixture;

    return {
      id: match.id,
      stage: match.stage,
      roundLabel: match.roundLabel,
      competitionLabel: null,
      hostCity: match.hostCity,
      zone: match.zone,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      displayHomeTeam: apiFixture?.homeTeam || match.homeTeam,
      displayAwayTeam: apiFixture?.awayTeam || match.awayTeam,
      statusShort: effectiveFixture?.statusShort || "NS",
      minute: effectiveFixture?.minute ?? null,
      kickoff: apiFixture?.kickoff || getFallbackKickoff(match),
      score: effectiveFixture?.score || { home: null, away: null },
      group: match.stage === "group" ? getGroupForMatch(match.homeTeam, match.awayTeam) : null,
    } as MatchView;
  });
}

function formatKickoff(kickoff: string) {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(kickoff));
}

function getStatusBadgeClass(statusShort: string) {
  const statusGroup = getStatusGroup(statusShort);

  if (statusGroup === "live") return "badge badge-red";
  if (statusGroup === "halftime") return "badge badge-amber";
  if (statusGroup === "scheduled") return "badge badge-muted";
  if (statusGroup === "finished") return "badge badge-muted";
  if (statusGroup === "postponed") return "badge badge-amber";
  return "badge badge-red";
}

function getGroupFixtureReference(match: MatchView): { fixture: Fixture; flipped: boolean } | null {
  if (match.stage !== "group") return null;

  const matchHome = normalizeKey(match.homeTeam);
  const matchAway = normalizeKey(match.awayTeam);

  for (const fixture of FIXTURES) {
    const fixtureHome = normalizeKey(fixture.homeTeam);
    const fixtureAway = normalizeKey(fixture.awayTeam);

    if (fixtureHome === matchHome && fixtureAway === matchAway) {
      return { fixture, flipped: false };
    }

    if (fixtureHome === matchAway && fixtureAway === matchHome) {
      return { fixture, flipped: true };
    }
  }

  return null;
}

function formatPredictionScore(pick: MatchPick | undefined, flipped: boolean): string | null {
  if (!pick) return null;
  const home = flipped ? pick.away : pick.home;
  const away = flipped ? pick.home : pick.away;
  return `${home} - ${away}`;
}

function buildPredictionDataset(match: MatchView, currentUserId: string, participantsByRank: Team[]): MatchPredictionDataset {
  if (match.stage === "group") {
    const reference = getGroupFixtureReference(match);

    if (!reference) {
      return {
        rows: [],
        emptyTitle: "Sin pronósticos disponibles",
        emptyText: "No se ha podido vincular este partido con los picks guardados del club.",
      };
    }

    const rows = participantsByRank.map((team) => ({
      teamId: team.id,
      participantName: team.name,
      username: team.username,
      currentRank: team.currentRank,
      totalPoints: team.totalPoints,
      predictionText: formatPredictionScore(team.matchPicks?.[reference.fixture.id], reference.flipped),
      secondaryText: null,
      isDouble: Boolean(reference.fixture.group && team.doubleMatches?.[reference.fixture.group] === reference.fixture.id),
      isMine: team.userId === currentUserId,
      kind: "score" as const,
    }));

    return {
      rows,
      emptyTitle: "Sin pronósticos",
      emptyText: "Todavía no hay marcadores pronosticados para este partido.",
    };
  }

  if (match.stage === "third-place") {
    return {
      rows: [],
      note: "Sin picks por partido.",
      emptyTitle: "Sin detalle disponible",
      emptyText: "Este cruce no tiene pronósticos por partido en el modelo actual de la porra.",
    };
  }

  if (match.stage === "final") {
    const rows = participantsByRank.map((team) => {
      const finalists = team.knockoutPicks?.final?.slice(0, 2).map((pick) => pick.country).filter(Boolean) || [];
      const home = team.championPick || finalists[0] || null;
      const away = team.runnerUpPick || finalists[1] || null;

      return {
        teamId: team.id,
        participantName: team.name,
        username: team.username,
        currentRank: team.currentRank,
        totalPoints: team.totalPoints,
        predictionText: home && away ? `${home} vs ${away}` : null,
        predictionTeams: home && away ? [home, away] : [],
        secondaryText: team.championPick ? `Campeón: ${team.championPick}` : null,
        secondaryCountry: team.championPick || null,
        isDouble: false,
        isMine: team.userId === currentUserId,
        kind: "finalists" as const,
      };
    });

    return {
      rows,
      note: "Finalistas y campeón.",
      emptyTitle: "Sin pronósticos",
      emptyText: "No hay finalistas cargados para esta final en los picks del club.",
    };
  }

  const stageKey = KNOCKOUT_PICK_STAGE_KEY[match.stage];
  const stageIndex = KNOCKOUT_STAGE_INDEX_BY_ID.get(match.id);

  if (!stageKey || typeof stageIndex !== "number") {
    return {
      rows: [],
      emptyTitle: "Sin detalle disponible",
      emptyText: "No se ha podido mapear este cruce.",
    };
  }

  const rows = participantsByRank.map((team) => {
    const winner = team.knockoutPicks?.[stageKey]?.[stageIndex]?.country ?? null;
    return {
      teamId: team.id,
      participantName: team.name,
      username: team.username,
      currentRank: team.currentRank,
      totalPoints: team.totalPoints,
      predictionText: winner ? `Pasa ${winner}` : null,
      predictionTeams: winner ? [winner] : [],
      secondaryText: null,
      secondaryCountry: null,
      isDouble: false,
      isMine: team.userId === currentUserId,
      kind: "winner" as const,
    };
  });

  return {
    rows,
    note: "Se muestra el clasificado pronosticado.",
    emptyTitle: "Sin pronósticos",
    emptyText: "Todavía no hay clasificados pronosticados para este cruce.",
  };
}

function getRankAccent(rank: number) {
  if (rank === 1) return { background: "rgba(212,175,55,0.14)", color: "#D4AF37", border: "1px solid rgba(212,175,55,0.26)" };
  if (rank === 2) return { background: "rgba(192,192,192,0.12)", color: "#C0C0C0", border: "1px solid rgba(192,192,192,0.22)" };
  if (rank === 3) return { background: "rgba(205,127,50,0.12)", color: "#CD7F32", border: "1px solid rgba(205,127,50,0.22)" };
  return { background: "rgba(var(--bg-2),0.82)", color: "rgb(var(--text-muted))", border: "1px solid rgba(var(--divider),0.08)" };
}

function getPredictionPillStyle(row: MatchPredictionRow) {
  if (!row.predictionText) {
    return {
      background: "rgba(var(--bg-2),0.82)",
      color: "rgb(var(--text-muted))",
      border: "1px solid rgba(var(--divider),0.08)",
    };
  }

  if (row.kind === "score") {
    return {
      background: "rgba(var(--bg-2),0.92)",
      color: "rgb(var(--text-warm))",
      border: "1px solid rgba(var(--divider),0.08)",
    };
  }

  if (row.kind === "finalists") {
    return {
      background: "rgba(212,175,55,0.12)",
      color: "#D4AF37",
      border: "1px solid rgba(212,175,55,0.22)",
    };
  }

  return {
    background: "rgba(39,230,172,0.10)",
    color: "#27E6AC",
    border: "1px solid rgba(39,230,172,0.22)",
  };
}

export default function ResultadosPage() {
  const { user } = useAuth();
  const { adminResults, participants } = useScoredParticipants();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<MatchStage | "all">("all");
  const [zoneFilter, setZoneFilter] = useState<Zone | "all">("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>("group");
  const participantsByRank = useMemo(() => {
    return [...participants].sort((a, b) => {
      if (a.currentRank !== b.currentRank) return a.currentRank - b.currentRank;
      if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints;
      return a.name.localeCompare(b.name, "es");
    });
  }, [participants]);

  const [selectedMatch, setSelectedMatch] = useState<MatchView | null>(null);
  const [lockedMatch, setLockedMatch] = useState<MatchView | null>(null);

  const { data, error } = useSWR<ResultsApiPayload>("/api/results/fixtures", fetcher, {
    refreshInterval: (latestData?: ResultsApiPayload) => (latestData?.fixtures || []).some((fixture: ApiFixtureItem) => isLivePollingStatus(fixture.statusShort)) ? 15000 : 0,
    revalidateOnFocus: true,
  });


  useEffect(() => {
    if (!user) {
      setSelectedMatch(null);
    }
  }, [user]);

  useEffect(() => {
    const hasOverlay = Boolean(selectedMatch || lockedMatch);
    if (!hasOverlay) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedMatch(null);
        setLockedMatch(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [lockedMatch, selectedMatch]);

  const connection = error ? "error" : data?.connection || "calendar";
  const hasWorldCupApiRows = Boolean(data?.fixtures?.some((fixture) => fixture.apiId !== null));
  const mergedMatches = useMemo(() => mergeScheduleWithApi(data?.fixtures || [], adminResults), [adminResults, data]);

  const filteredMatches = useMemo(() => {
    let matches = [...mergedMatches];

    if (stageFilter !== "all") {
      matches = matches.filter((match) => match.stage === stageFilter);
    }

    if (zoneFilter !== "all") {
      matches = matches.filter((match) => match.zone === zoneFilter);
    }

    if (cityFilter !== "all") {
      matches = matches.filter((match) => match.hostCity === cityFilter);
    }

    if (search.trim()) {
      const query = normalizeKey(search);
      matches = matches.filter((match) => {
        const haystack = [
          String(match.id),
          match.hostCity,
          match.displayHomeTeam,
          match.displayAwayTeam,
          match.homeTeam,
          match.awayTeam,
          match.competitionLabel || "",
        ].map(normalizeKey);
        return haystack.some((value) => value.includes(query));
      });
    }

    return matches;
  }, [cityFilter, mergedMatches, search, stageFilter, zoneFilter]);

  const filteredWorldCupCount = filteredMatches.length;

  const groupedByStage = useMemo(() => {
    const groups: Partial<Record<MatchStage, MatchView[]>> = {};

    filteredMatches.forEach((match) => {
        if (!groups[match.stage]) groups[match.stage] = [];
        groups[match.stage]!.push(match);
      });

    Object.values(groups).forEach((matches) => {
      matches?.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
    });

    return groups;
  }, [filteredMatches]);

  const regionOptions: Array<{ key: Zone | "all"; label: string; color?: string }> = [
    { key: "all", label: "Todas" },
    { key: "west", label: REGION_LABELS.west, color: REGION_PALETTES.west.primary },
    { key: "central", label: REGION_LABELS.central, color: REGION_PALETTES.central.primary },
    { key: "east", label: REGION_LABELS.east, color: REGION_PALETTES.east.primary },
  ] as const;

  const connectionNode = connection === "live"
    ? <span className="badge badge-green"><Wifi size={12} /> API conectada</span>
    : connection === "error"
      ? <span className="badge badge-red"><AlertCircle size={12} /> Sin conexión</span>
      : <span className="badge badge-muted"><WifiOff size={12} /> Calendario base</span>;

  const handleSelectMatch = (match: MatchView) => {
    if (!user) {
      setLockedMatch(match);
      return;
    }

    setSelectedMatch(match);
  };

  return (
    <>
      <div className="mx-auto max-w-[640px] px-4 pt-4">
        <div className="page-header animate-fade-in">
          <div>
            <h1 className="page-header__title">Resultados</h1>
          </div>
          {connectionNode}
        </div>

        <div className="relative mb-3">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            className="input-field !pl-9"
            placeholder="Buscar equipo, ciudad, competición o nº partido..."
            value={search}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
          />
        </div>

        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          <button className={`pill ${stageFilter === "all" ? "active" : ""}`} onClick={() => setStageFilter("all")}>Todos</button>
          {STAGE_ORDER.map((stage) => (
            <button key={stage} className={`pill ${stageFilter === stage ? "active" : ""}`} onClick={() => setStageFilter(stage)}>
              {STAGE_LABELS[stage]}
            </button>
          ))}
        </div>

        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {regionOptions.map((region) => (
            <button
              key={region.key}
              className={`pill ${zoneFilter === region.key ? "active" : ""}`}
              onClick={() => {
                setZoneFilter(region.key as Zone | "all");
                setCityFilter("all");
              }}
              style={zoneFilter === region.key && region.color ? { background: `${region.color}22`, color: region.color, borderColor: region.color } : undefined}
            >
              {region.label}
            </button>
          ))}
        </div>

        {zoneFilter !== "all" ? (
          <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
            <button className={`pill !px-2 !py-1 text-[10px] ${cityFilter === "all" ? "active" : ""}`} onClick={() => setCityFilter("all")}>Todas</button>
            {ALL_HOST_CITIES.filter((city) => getZoneForCity(city) === zoneFilter).map((city) => (
              <button key={city} className={`pill !px-2 !py-1 text-[10px] ${cityFilter === city ? "active" : ""}`} onClick={() => setCityFilter(city)}>
                {city}
              </button>
            ))}
          </div>
        ) : null}

        <p className="mb-3 text-[11px] text-text-muted">
          {filteredWorldCupCount} partidos del Mundial
        </p>


        {filteredWorldCupCount === 0 ? (
          <EmptyState title="Sin resultados" text="No hay partidos del Mundial que coincidan con tus filtros." icon={Search} />
        ) : (
          <>
            {STAGE_ORDER.map((stage) => {
              const matches = groupedByStage[stage];
              if (!matches || matches.length === 0) return null;
              const isOpen = expanded === stage;
              const isFinal = stage === "final";

              return (
                <section key={stage} className="mb-2.5 animate-fade-in">
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === stage ? null : stage)}
                    className="flex w-full items-center justify-between rounded-[16px] px-4 py-3 text-left"
                    style={{
                      background: isFinal ? "rgba(212,175,55,0.08)" : "rgb(var(--bg-4))",
                      border: isFinal ? "1px solid rgba(212,175,55,0.22)" : "1px solid rgba(var(--divider),0.08)",
                      color: "rgb(var(--text-warm))",
                    }}
                  >
                    <span className="font-display text-[15px] font-bold">
                      {STAGE_LABELS[stage]} <span className="ml-1 text-[11px] font-normal text-text-muted">({matches.length})</span>
                    </span>
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  {isOpen ? (
                    <div className="mt-2 flex flex-col gap-2">
                      {matches.map((match) => (
                        <ScheduleMatchCard key={`${match.stage}-${match.id}-${match.displayHomeTeam}`} match={match} onSelect={handleSelectMatch} />
                      ))}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </>
        )}

        {connection === "error" ? (
          <p className="status-note mb-6 mt-4 text-text-muted">
            La API no responde ahora mismo. El Mundial se muestra con el calendario base y, si existe un resultado guardado en Admin, ese marcador tiene prioridad visual.
          </p>
        ) : connection === "calendar" ? (
          <p className="status-note mb-6 mt-4 text-text-muted">
            Se muestra el calendario base del Mundial. Añade una API key válida para cargar fixtures oficiales de API-Football.
          </p>
        ) : !hasWorldCupApiRows ? (
          <p className="status-note mb-6 mt-4 text-text-muted">
            API conectada. El Mundial sigue en calendario base hasta que API-Football publique sus fixtures oficiales.
          </p>
        ) : null}
      </div>

      {selectedMatch ? (
        <MatchDetailModal match={selectedMatch} userId={user?.id || ""} participants={participantsByRank} onClose={() => setSelectedMatch(null)} />
      ) : null}

      {lockedMatch ? (
        <AuthRequiredModal match={lockedMatch} onClose={() => setLockedMatch(null)} />
      ) : null}
    </>
  );
}

function ScheduleMatchCard({ match, onSelect }: { match: MatchView; onSelect: (match: MatchView) => void }) {
  const isSpain = match.displayHomeTeam === "España" || match.displayAwayTeam === "España";
  const cityColor = getCityColor(match.hostCity);
  const showHomeFlag = KNOWN_TEAMS.has(match.displayHomeTeam);
  const showAwayFlag = KNOWN_TEAMS.has(match.displayAwayTeam);
  const roundLabel = match.competitionLabel || match.roundLabel;
  const scoreHome = match.score.home ?? 0;
  const scoreAway = match.score.away ?? 0;
  const statusText = getStatusDisplay(match.statusShort, { elapsed: match.minute, kickoff: match.kickoff });
  const statusBadgeClass = getStatusBadgeClass(match.statusShort);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Abrir detalle de ${match.displayHomeTeam} contra ${match.displayAwayTeam}`}
      onClick={() => onSelect(match)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(match);
        }
      }}
      className="card !px-3.5 !py-3 cursor-pointer transition-transform duration-200 hover:-translate-y-[1px] focus:outline-none"
      style={isSpain ? { borderLeft: "4px solid #C1121F" } : undefined}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono text-text-muted">#{match.id}</span>
          {match.group ? <GroupBadge group={match.group} /> : null}
          <span className={statusBadgeClass}>{statusText}</span>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold"
          style={{ background: getCityBgColor(match.hostCity), color: cityColor, border: `1px solid ${cityColor}33` }}
        >
          <MapPin size={9} /> {match.hostCity}
        </span>
      </div>

      <div className="flex items-center justify-center gap-2">
        <div className="flex flex-1 items-center justify-end gap-1.5 text-right">
          <span className={`text-xs font-medium ${match.displayHomeTeam === "España" ? "font-semibold text-text-warm" : ""}`}>{match.displayHomeTeam}</span>
          {showHomeFlag ? <Flag country={match.displayHomeTeam} size="sm" /> : null}
        </div>
        <div className="min-w-[58px] rounded-xl border border-[rgb(var(--divider)/0.08)] bg-bg-2 px-2.5 py-1 text-center font-display text-sm font-bold text-text-muted shadow-[inset_0_1px_0_rgba(var(--surface-soft),0.03)]">
          {`${scoreHome} - ${scoreAway}`}
        </div>
        <div className="flex flex-1 items-center gap-1.5 text-left">
          {showAwayFlag ? <Flag country={match.displayAwayTeam} size="sm" /> : null}
          <span className={`text-xs font-medium ${match.displayAwayTeam === "España" ? "font-semibold text-text-warm" : ""}`}>{match.displayAwayTeam}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[rgb(var(--divider)/0.06)] pt-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="badge badge-muted text-[10px]">{roundLabel}</span>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-text-muted">
          <Clock3 size={11} /> Hora Madrid · {formatKickoff(match.kickoff)}
        </span>
      </div>
    </article>
  );
}

function MatchDetailModal({ match, userId, participants, onClose }: { match: MatchView; userId: string; participants: Team[]; onClose: () => void }) {
  const detail = useMemo(() => buildPredictionDataset(match, userId, participants), [match, participants, userId]);
  const myRows = useMemo(() => detail.rows.filter((row) => row.isMine), [detail.rows]);
  const clubRows = useMemo(() => detail.rows.filter((row) => !row.isMine), [detail.rows]);
  const rowsWithPrediction = useMemo(() => detail.rows.filter((row) => Boolean(row.predictionText)), [detail.rows]);
  const doubleCount = useMemo(() => detail.rows.filter((row) => row.isDouble).length, [detail.rows]);
  const showHomeFlag = KNOWN_TEAMS.has(match.displayHomeTeam);
  const showAwayFlag = KNOWN_TEAMS.has(match.displayAwayTeam);
  const statusText = getStatusDisplay(match.statusShort, { elapsed: match.minute, kickoff: match.kickoff });
  const roundLabel = match.competitionLabel || match.roundLabel;
  const statusBadgeClass = getStatusBadgeClass(match.statusShort);
  const cityColor = getCityColor(match.hostCity);
  const scoreHome = match.score.home ?? 0;
  const scoreAway = match.score.away ?? 0;

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-[640px] overflow-y-auto rounded-t-[24px] bg-bg-4 p-5 animate-fade-in"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${match.displayHomeTeam} vs ${match.displayAwayTeam}`}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[rgba(var(--divider),0.18)]" />

        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Pronósticos del club</p>
            <div className="mt-1">
              <MatchupWithFlags
                homeCountry={match.displayHomeTeam}
                awayCountry={match.displayAwayTeam}
                size="md"
                textClassName="font-display text-[22px] font-extrabold text-text-warm"
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={statusBadgeClass}>{statusText}</span>
              <span className="badge badge-muted text-[10px]">{roundLabel}</span>
                  {match.group ? <GroupBadge group={match.group} /> : null}
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl border border-[rgb(var(--divider)/0.08)] bg-bg-2 p-2 text-text-muted transition-colors hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        <div className="card !p-3.5 !pt-3.5 bg-gradient-to-b from-bg-4 to-bg-2">
          <div className="flex items-center justify-center gap-2">
            <div className="flex flex-1 items-center justify-end gap-2 text-right">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-warm">{match.displayHomeTeam}</p>
              </div>
              {showHomeFlag ? <Flag country={match.displayHomeTeam} size="md" /> : null}
            </div>
            <div className="min-w-[74px] rounded-[16px] border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.06)] px-3 py-2 text-center font-display text-lg font-extrabold text-text-warm">
              {scoreHome} - {scoreAway}
            </div>
            <div className="flex flex-1 items-center gap-2 text-left">
              {showAwayFlag ? <Flag country={match.displayAwayTeam} size="md" /> : null}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-warm">{match.displayAwayTeam}</p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[rgb(var(--divider)/0.06)] pt-3">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold"
              style={{ background: getCityBgColor(match.hostCity), color: cityColor, border: `1px solid ${cityColor}33` }}
            >
              <MapPin size={11} /> {match.hostCity}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-text-muted">
              <Clock3 size={11} /> Hora Madrid · {formatKickoff(match.kickoff)}
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="badge badge-muted text-[10px]">{detail.rows.length} equipos del club</span>
          <span className="badge badge-muted text-[10px]">{rowsWithPrediction.length} con pronóstico</span>
          {doubleCount > 0 ? <span className="badge badge-amber text-[10px]">{doubleCount} dobles</span> : null}
        </div>

        {detail.note ? (
          <div className="mt-3 rounded-[14px] border border-[rgba(212,175,55,0.16)] bg-[rgba(212,175,55,0.08)] px-3.5 py-3 text-[12px] leading-5 text-gold-light">
            {detail.note}
          </div>
        ) : null}

        {detail.rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState title={detail.emptyTitle} text={detail.emptyText} icon={Users} />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {myRows.length > 0 ? (
              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="font-display text-[15px] font-bold text-text-warm">Tus equipos</h4>
                  <span className="text-[11px] text-text-muted">{myRows.length}</span>
                </div>
                <div className="space-y-2">
                  {myRows.map((row) => <PredictionRow key={`mine-${row.teamId}`} row={row} />)}
                </div>
              </section>
            ) : null}

            {clubRows.length > 0 ? (
              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="font-display text-[15px] font-bold text-text-warm">{myRows.length > 0 ? "Resto del club" : "Pronósticos del club"}</h4>
                  <span className="text-[11px] text-text-muted">{clubRows.length}</span>
                </div>
                <div className="space-y-2">
                  {clubRows.map((row) => <PredictionRow key={row.teamId} row={row} />)}
                </div>
              </section>
            ) : myRows.length > 0 ? (
              <EmptyState title="No hay más participantes" text="Solo tus equipos tienen picks cargados para este partido." icon={Users} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function PredictionPillContent({ row }: { row: MatchPredictionRow }) {
  if (!row.predictionText) {
    return <span>Sin pronóstico</span>;
  }

  if (row.kind === "winner" && row.predictionTeams?.[0]) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span>Pasa</span>
        <CountryWithFlag country={row.predictionTeams[0]} size="sm" />
      </span>
    );
  }

  if (row.kind === "finalists" && row.predictionTeams?.length === 2) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <CountryWithFlag country={row.predictionTeams[0]} size="sm" />
        <span className="text-text-muted">vs</span>
        <CountryWithFlag country={row.predictionTeams[1]} size="sm" />
      </span>
    );
  }

  return <span>{row.predictionText}</span>;
}

function PredictionSecondaryContent({ row }: { row: MatchPredictionRow }) {
  if (row.secondaryCountry) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5 text-[11px] leading-5 text-text-muted">
        <span>Campeón:</span>
        <CountryWithFlag country={row.secondaryCountry} size="sm" />
      </span>
    );
  }

  if (!row.secondaryText) {
    return null;
  }

  return <span className="text-[11px] leading-5 text-text-muted">{row.secondaryText}</span>;
}

function PredictionRow({ row }: { row: MatchPredictionRow }) {
  const rankAccent = getRankAccent(row.currentRank);
  const predictionStyle = getPredictionPillStyle(row);

  return (
    <div className="rounded-[18px] border border-[rgb(var(--divider)/0.08)] bg-[rgb(var(--bg-3)/0.78)] px-3.5 py-3 shadow-[0_12px_24px_rgba(var(--shadow-color),0.08)]">
      <div className="flex items-start gap-3">
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] text-[12px] font-extrabold"
          style={rankAccent}
        >
          {row.currentRank}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-warm">{row.participantName}</p>
              <p className="truncate text-[11px] text-text-muted">@{row.username} · {row.totalPoints} pts</p>
            </div>
            {row.isDouble ? <span className="badge badge-amber text-[10px]">Doble puntuación</span> : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex max-w-full flex-wrap items-center rounded-[12px] px-3 py-1.5 text-[12px] font-semibold leading-5"
              style={predictionStyle}
            >
              <PredictionPillContent row={row} />
            </span>
            <PredictionSecondaryContent row={row} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthRequiredModal({ match, onClose }: { match: MatchView; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-[640px] rounded-t-[24px] bg-bg-4 p-5 animate-fade-in"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Acceso privado del club"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[rgba(var(--divider),0.18)]" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Acceso privado</p>
            <div className="mt-1">
              <MatchupWithFlags
                homeCountry={match.displayHomeTeam}
                awayCountry={match.displayAwayTeam}
                size="md"
                textClassName="font-display text-[22px] font-extrabold text-text-warm"
              />
            </div>
            <p className="mt-2 text-sm text-text-muted">Inicia sesión en Mi Club para ver los pronósticos del club.</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-[rgb(var(--divider)/0.08)] bg-bg-2 p-2 text-text-muted transition-colors hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        <div className="card !p-5 text-center bg-gradient-to-b from-bg-4 to-bg-2">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[16px] border border-gold/18 bg-gold/10 text-gold">
            <Lock size={26} />
          </div>
          <h4 className="font-display text-lg font-bold text-text-warm">Detalle bloqueado</h4>
          <p className="mx-auto mt-2 max-w-[28rem] text-sm leading-6 text-text-muted">
            Esta vista solo está disponible para usuarios autenticados dentro del club. Tu sesión actual controla el acceso usando la misma lógica de Mi Club.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/mi-club" className="btn btn-primary !py-3 no-underline">
              Ir a Mi Club
            </Link>
            <button onClick={onClose} className="btn btn-ghost !py-3">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
