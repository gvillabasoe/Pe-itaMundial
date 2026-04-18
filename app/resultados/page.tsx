"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { AlertCircle, ChevronDown, ChevronUp, MapPin, Search, Wifi, WifiOff } from "lucide-react";
import { EmptyState, Flag, GroupBadge } from "@/components/ui";
import { GROUPS } from "@/lib/data";
import { ALL_HOST_CITIES, getCityBgColor, getCityColor, getZoneForCity, REGION_LABELS, REGION_PALETTES, type Zone } from "@/lib/config/regions";
import { getStatusGroup, getStatusLabel, shouldShowScore } from "@/lib/config/match-status";
import { STAGE_LABELS, STAGE_ORDER, WORLD_CUP_MATCHES, type MatchStage } from "@/lib/worldcup/schedule";

interface ApiFixtureItem {
  apiId: number | null;
  stage: MatchStage;
  roundLabel: string;
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
  zone: Zone;
  homeTeam: string;
  awayTeam: string;
  displayHomeTeam: string;
  displayAwayTeam: string;
  statusShort: string;
  minute: number | null;
  score: { home: number | null; away: number | null };
  group: string | null;
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

function mergeScheduleWithApi(fixtures: ApiFixtureItem[]): MatchView[] {
  const groupMap = buildGroupFixtureMap(fixtures);
  const stageMap = STAGE_ORDER.reduce<Record<MatchStage, ApiFixtureItem[]>>((acc, stage) => {
    acc[stage] = fixtures.filter((fixture) => fixture.stage === stage).sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
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
    let liveFixture: ApiFixtureItem | undefined;

    if (match.stage === "group") {
      const key = `${normalizeKey(match.homeTeam)}|${normalizeKey(match.awayTeam)}`;
      liveFixture = groupMap.get(key);
    } else {
      const stageIndex = stageOffsets[match.stage];
      liveFixture = stageMap[match.stage][stageIndex];
      stageOffsets[match.stage] = stageIndex + 1;
    }

    return {
      id: match.id,
      stage: match.stage,
      roundLabel: match.roundLabel,
      hostCity: match.hostCity,
      zone: match.zone,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      displayHomeTeam: liveFixture?.homeTeam || match.homeTeam,
      displayAwayTeam: liveFixture?.awayTeam || match.awayTeam,
      statusShort: liveFixture?.statusShort || "NS",
      minute: liveFixture?.minute ?? null,
      score: liveFixture?.score || { home: null, away: null },
      group: match.stage === "group" ? getGroupForMatch(match.homeTeam, match.awayTeam) : null,
    };
  });
}

export default function ResultadosPage() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<MatchStage | "all">("all");
  const [zoneFilter, setZoneFilter] = useState<Zone | "all">("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>("group");

  const { data, error } = useSWR<ResultsApiPayload>("/api/results/fixtures", fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
  });

  const connection = error ? "error" : data?.connection || "calendar";
  const mergedMatches = useMemo(() => mergeScheduleWithApi(data?.fixtures || []), [data]);

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
        ].map(normalizeKey);
        return haystack.some((value) => value.includes(query));
      });
    }

    return matches;
  }, [cityFilter, mergedMatches, search, stageFilter, zoneFilter]);

  const groupedByStage = useMemo(() => {
    const groups: Partial<Record<MatchStage, MatchView[]>> = {};
    filteredMatches.forEach((match) => {
      if (!groups[match.stage]) groups[match.stage] = [];
      groups[match.stage]!.push(match);
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
    ? <span className="badge badge-green"><Wifi size={12} /> En vivo</span>
    : connection === "error"
      ? <span className="badge badge-red"><AlertCircle size={12} /> Sin conexión</span>
      : <span className="badge badge-muted"><WifiOff size={12} /> Calendario</span>;

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-4">
      <div className="page-header animate-fade-in">
        <div>
          <h1 className="page-header__title">Resultados</h1>
          <p className="page-header__subtitle">Mundial 2026 · 104 partidos</p>
        </div>
        {connectionNode}
      </div>

      <div className="relative mb-3">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          className="input-field !pl-9"
          placeholder="Buscar equipo, ciudad o nº partido..."
          value={search}
          onChange={(event: any) => setSearch(event.target.value)}
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

      <p className="mb-3 text-[11px] text-text-muted">{filteredMatches.length} partidos</p>

      {filteredMatches.length === 0 ? (
        <EmptyState title="Sin resultados" text="No hay partidos que coincidan con tus filtros." icon={Search} />
      ) : (
        STAGE_ORDER.map((stage) => {
          const matches = groupedByStage[stage];
          if (!matches || matches.length === 0) return null;
          const isOpen = expanded === stage;
          const isFinal = stage === "final";

          return (
            <section key={stage} className="mb-2 animate-fade-in">
              <button
                type="button"
                onClick={() => setExpanded(expanded === stage ? null : stage)}
                className="flex w-full items-center justify-between rounded-[12px] px-3.5 py-3 text-left"
                style={{
                  background: isFinal ? "rgba(212,175,55,0.06)" : "rgb(var(--bg-4))",
                  border: isFinal ? "1px solid rgba(212,175,55,0.2)" : "1px solid rgba(255,255,255,0.06)",
                  color: isFinal ? "#FFD87A" : "rgb(var(--text-warm))",
                }}
              >
                <span className="font-display text-[15px] font-bold">
                  {STAGE_LABELS[stage]} <span className="ml-1 text-[11px] font-normal text-text-muted">({matches.length})</span>
                </span>
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {isOpen ? (
                <div className="mt-1.5 flex flex-col gap-1">
                  {matches.map((match) => <ScheduleMatchCard key={match.id} match={match} />)}
                </div>
              ) : null}
            </section>
          );
        })
      )}

      {connection !== "live" ? (
        <p className="status-note mb-6 mt-4 text-text-muted">
          {connection === "error"
            ? "Sin conexión con la API en este momento. Se muestra el calendario oficial base."
            : "Datos en vivo disponibles cuando empiece el torneo o cuando configures API_SPORTS_KEY en Vercel."}
        </p>
      ) : null}
    </div>
  );
}

function ScheduleMatchCard({ match }: { match: MatchView }) {
  const isSpain = match.displayHomeTeam === "España" || match.displayAwayTeam === "España";
  const statusGroup = getStatusGroup(match.statusShort);
  const showScore = shouldShowScore(match.statusShort, match.score.home, match.score.away);
  const cityColor = getCityColor(match.hostCity);
  const showHomeFlag = KNOWN_TEAMS.has(match.displayHomeTeam);
  const showAwayFlag = KNOWN_TEAMS.has(match.displayAwayTeam);

  const statusBadgeClass =
    statusGroup === "live"
      ? "badge badge-red"
      : statusGroup === "halftime"
        ? "badge badge-amber"
        : statusGroup === "scheduled"
          ? "badge badge-muted"
          : statusGroup === "finished"
            ? "badge badge-muted"
            : statusGroup === "postponed"
              ? "badge badge-amber"
              : "badge badge-red";

  return (
    <article
      className="card !px-3 !py-2.5"
      style={isSpain ? { borderLeft: "4px solid #C1121F" } : undefined}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono text-text-muted">#{match.id}</span>
          {match.group ? <GroupBadge group={match.group} /> : null}
          <span className={statusBadgeClass}>
            {statusGroup === "live" && typeof match.minute === "number" ? `${getStatusLabel(match.statusShort)} · ${match.minute}'` : getStatusLabel(match.statusShort)}
          </span>
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
        <div className="min-w-[54px] rounded-md bg-bg-2 px-2.5 py-1 text-center font-display text-sm font-bold text-text-muted">
          {showScore ? `${match.score.home} - ${match.score.away}` : "vs"}
        </div>
        <div className="flex flex-1 items-center gap-1.5 text-left">
          {showAwayFlag ? <Flag country={match.displayAwayTeam} size="sm" /> : null}
          <span className={`text-xs font-medium ${match.displayAwayTeam === "España" ? "font-semibold text-text-warm" : ""}`}>{match.displayAwayTeam}</span>
        </div>
      </div>
    </article>
  );
}
