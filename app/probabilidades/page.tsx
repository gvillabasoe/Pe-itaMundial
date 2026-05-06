"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Image from "next/image";
import { AlertCircle, Crown, RefreshCw, Sparkles, TrendingUp, Wifi, WifiOff } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CountryWithFlag, EmptyState, Flag, SectionTitle } from "@/components/ui";
import { DEFAULT_PROBABILITY_MARKET_KEY, GROUPS_PROBABILITY_MARKET_KEY, PROBABILITY_MARKETS } from "@/lib/probabilities/markets";
import { FEATURED_TEAM_BY_NAME, FEATURED_TEAMS, getProbabilityColorForName } from "@/lib/probabilities/team-config";

interface ProbabilityRankingItem {
  teamName: string;
  probability01: number;
  probabilityPct: number;
  featured: boolean;
  color?: string;
}

interface ProbabilityGroupResponse {
  group: string;
  marketKey: string;
  marketDisplayName: string;
  marketPolymarketLabel: string;
  marketLabel: string | null;
  marketMode: "multi" | "binary" | "mixed" | "unknown";
  stale: boolean;
  ranking: ProbabilityRankingItem[];
  error?: string;
}

interface ProbabilityResponse {
  source: "polymarket";
  updatedAt: string;
  stale: boolean;
  marketKey: string;
  marketDisplayName: string;
  marketPolymarketLabel: string;
  marketKind: "team" | "open" | "groups";
  marketGroup: string | null;
  marketMode: "multi" | "binary" | "mixed" | "unknown";
  marketLabel: string | null;
  featured: Record<string, number | null>;
  ranking: ProbabilityRankingItem[];
  groups?: ProbabilityGroupResponse[];
  error?: string;
}

interface HistoryPoint {
  label: string;
  stamp: string;
  [key: string]: string | number | null;
}

const HISTORY_TEAMS = FEATURED_TEAMS.slice(0, 6);
const HISTORY_STORAGE_KEY = "penita_prob_history";
const HISTORY_MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 horas

// ── Mercados: renombrar "Ganar Mundial" y ocultar los dos eliminados ──
// Se filtra/mapea en display para no tocar lib/probabilities/markets.ts
const EXCLUDED_MARKET_PATTERNS = ["asistid", "portero menos"];
const displayMarkets = PROBABILITY_MARKETS
  .filter((m) => !EXCLUDED_MARKET_PATTERNS.some((p) => m.label.toLowerCase().includes(p)))
  .map((m) =>
    m.label.toLowerCase().includes("ganar mundial")
      ? { ...m, label: "Campeón del Mundo" }
      : m
  );

const fetcher = async (url: string): Promise<ProbabilityResponse> => {
  const response = await fetch(url, { cache: "no-store" });
  return response.json();
};

function formatProbability(value: number | null | undefined) {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatUpdatedAt(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function formatHistoryLabel(isoStamp: string) {
  const d = new Date(isoStamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return `Ayer ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function getDefaultTeamColor(teamName: string) {
  return FEATURED_TEAM_BY_NAME[teamName]?.color || "#D4AF37";
}

function getTeamColor(teamName: string, index = 0) {
  return FEATURED_TEAM_BY_NAME[teamName]?.color || getProbabilityColorForName(teamName, index);
}

function getRankingColor(item: ProbabilityRankingItem | null | undefined, index = 0, useDefaultWinnerColors = false) {
  const teamName = item?.teamName || "";
  if (useDefaultWinnerColors) return getDefaultTeamColor(teamName);
  return item?.color || getTeamColor(teamName, index);
}

// ── Persistencia del historial en localStorage ──────────────────────────

function loadStoredHistory(): HistoryPoint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: HistoryPoint[] = JSON.parse(raw);
    const cutoff = Date.now() - HISTORY_MAX_AGE_MS;
    return parsed.filter((p) => new Date(p.stamp).getTime() > cutoff);
  } catch {
    return [];
  }
}

function saveHistory(points: HistoryPoint[]) {
  if (typeof window === "undefined") return;
  try {
    const cutoff = Date.now() - HISTORY_MAX_AGE_MS;
    const pruned = points
      .filter((p) => new Date(p.stamp).getTime() > cutoff)
      .slice(-200); // máx 200 puntos
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    // localStorage lleno — ignorar
  }
}

// ════════════════════════════════════════════════════════════
// PÁGINA
// ════════════════════════════════════════════════════════════

export default function ProbabilidadesPage() {
  const [selectedMarket, setSelectedMarket] = useState(DEFAULT_PROBABILITY_MARKET_KEY);

  const activeMarket = useMemo(
    () => displayMarkets.find((m) => m.key === selectedMarket) || displayMarkets[0],
    [selectedMarket]
  );

  const { data, error, isLoading, mutate } = useSWR<ProbabilityResponse>(
    `/api/probabilities?market=${selectedMarket}`,
    fetcher,
    { refreshInterval: 60000, revalidateOnFocus: true }
  );

  // ── Historial: cargado desde localStorage al montar ──
  const [history, setHistory] = useState<HistoryPoint[]>(() => loadStoredHistory());
  const lastStampRef = useRef<string | null>(null);

  // Reset si cambia de mercado (pero sólo si no es el principal)
  useEffect(() => {
    if (selectedMarket !== DEFAULT_PROBABILITY_MARKET_KEY) {
      // No borramos el historial del mercado principal, solo no lo mostramos
      return;
    }
    // Al montar en el mercado principal, cargamos localStorage
    const stored = loadStoredHistory();
    setHistory(stored);
    if (stored.length > 0) {
      lastStampRef.current = stored[stored.length - 1].stamp;
    }
  }, [selectedMarket]);

  useEffect(() => {
    if (selectedMarket !== DEFAULT_PROBABILITY_MARKET_KEY) return;
    if (!data?.updatedAt || !data.ranking.length) return;
    if (lastStampRef.current === data.updatedAt) return;
    lastStampRef.current = data.updatedAt;

    const point: HistoryPoint = {
      stamp: data.updatedAt,
      label: formatHistoryLabel(data.updatedAt),
    };
    HISTORY_TEAMS.forEach((team) => {
      point[team.teamKey] = data.featured[team.teamName] ?? null;
    });

    setHistory((prev) => {
      const next = [...prev, point];
      saveHistory(next);
      return next.slice(-200);
    });
  }, [data, selectedMarket]);

  const isDefaultMarket = selectedMarket === DEFAULT_PROBABILITY_MARKET_KEY;
  const isGroupsMarket = selectedMarket === GROUPS_PROBABILITY_MARKET_KEY || data?.marketKind === "groups";
  const isOpenMarket = data?.marketKind === "open";
  const groups = data?.groups ?? [];
  const hasGroupRankings = groups.some((g) => g.ranking.length > 0);

  const ranking = isGroupsMarket ? [] : data?.ranking ?? [];
  const heroTeam = ranking[0] ?? null;
  const shortlist = ranking.slice(0, 10);
  const spotlightTeams = ranking.slice(1, 5);
  const topProbability = heroTeam?.probabilityPct || 1;
  const hasRanking = !isGroupsMarket && shortlist.length > 0;
  const heroColor = getRankingColor(heroTeam, 0, isDefaultMarket);
  const leaderLabel = data?.marketKind === "open" ? "Líder del mercado" : "Favorita del mercado";

  const state = isLoading && !data
    ? "loading"
    : isGroupsMarket
    ? hasGroupRankings ? (data?.stale ? "stale" : "ok") : "empty"
    : hasRanking
    ? data?.stale ? "stale" : "ok"
    : "empty";

  const historyTeams = useMemo(
    () => HISTORY_TEAMS.filter((team) => history.some((p) => p[team.teamKey] != null)),
    [history]
  );

  // Calcular labels del eje X de forma que no se solapen en desktop
  const chartData = useMemo(() => {
    if (history.length <= 12) return history;
    // Si hay muchos puntos, submuestrear labels para legibilidad
    return history.map((p, i) => ({
      ...p,
      label: i % Math.ceil(history.length / 12) === 0 ? p.label : "",
    }));
  }, [history]);

  const showChart = isDefaultMarket;

  return (
    /* Desktop: max-w más ancho con layout de 2 columnas */
    <div className="mx-auto max-w-[640px] px-4 pt-4 lg:max-w-[1100px]">

      {/* ── Header ── */}
      <div className="page-header animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-[rgb(var(--divider)/0.18)] bg-bg-4 shadow-[0_14px_30px_rgba(var(--shadow-color)/0.18)]">
            <Image src="/Logo_Porra_Mundial_2026.webp" alt="Peñita Mundial" width={40} height={40} className="object-contain" />
          </div>
          <div>
            <h1 className="page-header__title">Probabilidades</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {state === "ok" ? (
            <span className="badge badge-green"><Wifi size={12} /> En vivo</span>
          ) : state === "stale" ? (
            <span className="badge badge-amber"><AlertCircle size={12} /> Retrasado</span>
          ) : (
            <span className="badge badge-muted"><WifiOff size={12} /> Sin datos</span>
          )}
          <button type="button" className="btn btn-ghost !px-3 !py-2 text-xs" onClick={() => void mutate()}>
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </div>

      {/* ── Selector de mercado ── */}
      <section className="card mb-4 animate-fade-in !p-3.5" style={{ animationDelay: "0.02s" }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Mercado Polymarket</p>
            <p className="mt-1 text-sm font-semibold text-text-warm">{activeMarket.label}</p>
          </div>
          {selectedMarket === DEFAULT_PROBABILITY_MARKET_KEY ? <span className="badge badge-amber">Principal</span> : null}
        </div>
        {/* Grid de mercados — 2 col en desktop */}
        <div className="flex flex-wrap gap-2">
          {displayMarkets.map((market) => {
            const isSelected = selectedMarket === market.key;
            return (
              <button
                key={market.key}
                type="button"
                className="rounded-full border px-3 py-1.5 text-[11px] font-semibold transition hover:border-gold/40"
                style={isSelected
                  ? { borderColor: "rgba(212,175,55,0.48)", background: "rgba(212,175,55,0.12)", color: "rgb(var(--text-primary))" }
                  : { borderColor: "rgb(var(--divider) / 0.14)", background: "rgb(var(--bg-2) / 0.62)", color: "rgb(var(--text-muted))" }}
                onClick={() => setSelectedMarket(market.key)}
              >
                {market.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Layout principal: 1 col en móvil, 2 col en desktop cuando hay ranking ── */}
      <div className={hasRanking && !isGroupsMarket ? "lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 lg:items-start" : ""}>
        <div>
          {state === "loading" ? (
            <div className="animate-pulse space-y-3">
              <div className="card h-[180px]" />
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-[112px]" />)}
              </div>
              <div className="card h-[280px]" />
            </div>
          ) : null}

          {state === "empty" ? (
            <EmptyState
              title={`${activeMarket.label} no disponible`}
              text={data?.error || error?.message || "Sin datos disponibles"}
              icon={AlertCircle}
              action={
                <button type="button" className="btn btn-ghost" onClick={() => void mutate()}>
                  <RefreshCw size={14} /> Reintentar
                </button>
              }
            />
          ) : null}

          {/* Grupos — 2 columnas en tablet/desktop */}
          {isGroupsMarket && hasGroupRankings ? (
            <div className="mb-6 animate-fade-in" style={{ animationDelay: "0.04s" }}>
              <div className="grid gap-4 sm:grid-cols-2">
                {groups.map((group) => (
                  <GroupRankingSection key={group.group} group={group} />
                ))}
              </div>
            </div>
          ) : null}

          {/* Hero — favorita */}
          {hasRanking && heroTeam ? (
            <section
              className="card card-glow mb-4 animate-fade-in overflow-hidden"
              style={{ borderColor: `${heroColor}33`, animationDelay: "0.02s" }}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--divider)/0.18)] bg-[rgb(var(--bg-2)/0.75)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    <Crown size={12} style={{ color: heroColor }} />
                    {leaderLabel}
                  </div>
                  {isOpenMarket ? (
                    <span className="font-display text-[28px] font-black leading-none text-text-warm sm:text-[34px]">
                      {heroTeam.teamName}
                    </span>
                  ) : (
                    <CountryWithFlag
                      country={heroTeam.teamName}
                      size="lg"
                      textClassName="font-display text-[28px] font-black leading-none text-text-warm sm:text-[34px]"
                    />
                  )}
                </div>
                <div className="rounded-[20px] border border-[rgb(var(--divider)/0.16)] bg-[rgb(var(--bg-2)/0.72)] px-4 py-3 text-center shadow-[0_18px_32px_rgba(var(--shadow-color)/0.16)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Probabilidad</p>
                  <p className="font-display text-[36px] font-black leading-none" style={{ color: heroColor }}>
                    {formatProbability(heroTeam.probabilityPct)}
                    <span className="ml-1 text-[18px] text-text-muted">%</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                <span className="badge badge-muted">Actualizado {formatUpdatedAt(data?.updatedAt)}</span>
                {data?.marketLabel ? (
                  <span className="badge badge-muted">
                    {data.marketMode === "multi" ? "Mercado global" : data.marketMode === "binary" ? "Mercados binarios" : "Modo mixto"}
                  </span>
                ) : null}
                {data?.stale ? <span className="badge badge-amber">Últimos datos válidos</span> : null}
              </div>
            </section>
          ) : null}

          {/* Spotlight 2-4 */}
          {hasRanking && spotlightTeams.length ? (
            <section className="mb-4 grid grid-cols-2 gap-3 animate-fade-in" style={{ animationDelay: "0.04s" }}>
              {spotlightTeams.map((team, index) => {
                const color = getRankingColor(team, index + 1, isDefaultMarket);
                return (
                  <div key={team.teamName} className="card !p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {isOpenMarket ? null : <Flag country={team.teamName} size="md" />}
                        <p className="truncate text-sm font-semibold text-text-warm">{team.teamName}</p>
                      </div>
                      <Sparkles size={15} style={{ color }} />
                    </div>
                    <p className="font-display text-[26px] font-black leading-none" style={{ color }}>
                      {formatProbability(team.probabilityPct)}
                      <span className="ml-1 text-sm text-text-muted">%</span>
                    </p>
                  </div>
                );
              })}
            </section>
          ) : null}
        </div>

        {/* ── Columna derecha en desktop: Top 10 ── */}
        {hasRanking ? (
          <section className="mb-4 animate-fade-in" style={{ animationDelay: "0.08s" }}>
            <SectionTitle icon={TrendingUp} accent="#D4AF37">Top 10</SectionTitle>
            <div className="card !p-3">
              <div className="space-y-2.5">
                {shortlist.map((item, index) => {
                  const color = getRankingColor(item, index, isDefaultMarket);
                  const scaledWidth = Math.max(10, (item.probabilityPct / topProbability) * 100);
                  const isLeader = index === 0;
                  return (
                    <div
                      key={`${item.teamName}-${index}`}
                      className="rounded-[16px] border border-[rgb(var(--divider)/0.12)] bg-[rgb(var(--bg-2)/0.7)] px-3 py-2.5"
                      style={isLeader ? { borderColor: `${color}33`, background: `linear-gradient(135deg, ${color}14, rgb(var(--bg-2)/0.72))` } : undefined}
                    >
                      <div className="mb-1.5 flex items-center gap-2.5">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[rgb(var(--divider)/0.14)] bg-[rgb(var(--bg-3)/0.92)] font-display text-xs font-black text-text-muted">
                          {index + 1}
                        </span>
                        {isOpenMarket ? null : <Flag country={item.teamName} size="sm" />}
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-text-warm">{item.teamName}</span>
                        <span className="font-display text-sm font-black" style={{ color }}>
                          {formatProbability(item.probabilityPct)}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full border border-[rgb(var(--divider)/0.08)] bg-[rgb(var(--bg-3)/0.9)]">
                        <div className="h-full rounded-full transition-all" style={{ width: `${scaledWidth}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {/* ── Gráfico de evolución — SIEMPRE visible en mercado principal ──
          Se muestra aunque no haya datos aún (estado de espera).
          Datos: últimas 48h desde localStorage. */}
      {showChart ? (
        <section className="mb-6 animate-fade-in" style={{ animationDelay: "0.12s" }}>
          <SectionTitle icon={TrendingUp} accent="#D4AF37">Evolución (últimas 48h)</SectionTitle>
          <div className="card !p-3.5">
            {history.length < 2 ? (
              <div className="flex h-[230px] items-center justify-center flex-col gap-3">
                {isLoading ? (
                  <div className="animate-pulse text-center">
                    <div className="h-2 w-32 rounded bg-text-muted/20 mx-auto mb-2" />
                    <p className="text-[11px] text-text-muted">Cargando historial…</p>
                  </div>
                ) : (
                  <>
                    <TrendingUp size={28} className="text-text-faint" />
                    <p className="text-[12px] text-text-muted text-center">
                      El gráfico se irá completando con datos en tiempo real.<br />
                      Vuelve mañana para ver la evolución completa.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 9, fill: "rgb(var(--text-muted))" }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "rgb(var(--text-muted))" }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgb(var(--bg-4))",
                        border: "1px solid rgb(var(--divider) / 0.16)",
                        borderRadius: 16,
                        color: "rgb(var(--text-primary))",
                        boxShadow: "0 20px 40px rgba(var(--shadow-color) / 0.22)",
                        fontSize: 11,
                      }}
                      labelStyle={{ color: "rgb(var(--text-muted))", fontSize: 10 }}
                      formatter={(value, name) => {
                        const key = String(name ?? "");
                        const team = historyTeams.find((t) => t.teamKey === key);
                        const displayValue = value == null
                          ? "—"
                          : Array.isArray(value) ? value.join(" - ") : `${value}%`;
                        return [displayValue, team?.teamName || key] as [string, string];
                      }}
                    />
                    {historyTeams.map((team) => (
                      <Line
                        key={team.teamKey}
                        type="monotone"
                        dataKey={team.teamKey}
                        stroke={team.color}
                        strokeWidth={team.isPrimary ? 3 : 1.5}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-3 flex flex-wrap justify-center gap-2.5">
                  {historyTeams.map((team) => (
                    <span key={team.teamKey} className="inline-flex items-center gap-1.5 text-[10px] text-text-muted">
                      <span className="inline-block h-[3px] w-4 rounded-full" style={{ background: team.color }} />
                      <Flag country={team.teamName} size="sm" />
                      <span>{team.teamName}</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// GRUPOS — compactos, 2 columnas en la grid padre
// ════════════════════════════════════════════════════════════

function GroupRankingSection({ group }: { group: ProbabilityGroupResponse }) {
  const topProbability = group.ranking[0]?.probabilityPct || 1;

  return (
    <section className="card !p-3">
      <h3 className="mb-2 font-display text-sm font-bold text-text-warm">Grupo {group.group}</h3>
      {group.ranking.length ? (
        <div className="space-y-2">
          {group.ranking.map((item, index) => {
            const color = getRankingColor(item, index);
            const scaledWidth = Math.max(8, (item.probabilityPct / topProbability) * 100);
            const isLeader = index === 0;
            return (
              <div
                key={`${group.group}-${item.teamName}-${index}`}
                className="rounded-[12px] border border-[rgb(var(--divider)/0.12)] bg-[rgb(var(--bg-2)/0.7)] px-3 py-2"
                style={isLeader ? { borderColor: `${color}33`, background: `linear-gradient(135deg, ${color}14, rgb(var(--bg-2)/0.72))` } : undefined}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[rgb(var(--divider)/0.14)] bg-[rgb(var(--bg-3)/0.92)] font-display text-[11px] font-black text-text-muted">
                    {index + 1}
                  </span>
                  <Flag country={item.teamName} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-text-warm">{item.teamName}</span>
                  <span className="font-display text-sm font-black shrink-0" style={{ color }}>
                    {formatProbability(item.probabilityPct)}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full border border-[rgb(var(--divider)/0.08)] bg-[rgb(var(--bg-3)/0.9)]">
                  <div className="h-full rounded-full transition-all" style={{ width: `${scaledWidth}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="py-4 text-center text-xs text-text-muted">Sin datos</p>
      )}
    </section>
  );
}
