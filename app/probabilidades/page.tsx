"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Image from "next/image";
import { AlertCircle, Crown, RefreshCw, Sparkles, TrendingUp, Wifi, WifiOff } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState, Flag, SectionTitle } from "@/components/ui";
import { FEATURED_TEAM_BY_NAME, FEATURED_TEAMS } from "@/lib/probabilities/team-config";

interface ProbabilityRankingItem {
  teamName: string;
  probability01: number;
  probabilityPct: number;
  featured: boolean;
  color?: string;
}

interface ProbabilityResponse {
  source: "polymarket";
  updatedAt: string;
  stale: boolean;
  marketMode: "multi" | "binary" | "mixed" | "unknown";
  marketLabel: string | null;
  featured: Record<string, number | null>;
  ranking: ProbabilityRankingItem[];
  error?: string;
}

interface HistoryPoint {
  label: string;
  stamp: string;
  [key: string]: string | number | null;
}

const HISTORY_TEAMS = FEATURED_TEAMS.slice(0, 6);

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
  return new Date(value).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTeamColor(teamName: string) {
  return FEATURED_TEAM_BY_NAME[teamName]?.color || "#D4AF37";
}

export default function ProbabilidadesPage() {
  const { data, error, isLoading, mutate } = useSWR<ProbabilityResponse>("/api/probabilities", fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: true,
  });

  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const lastStampRef = useRef<string | null>(null);

  useEffect(() => {
    if (!data?.updatedAt || !data.ranking.length) return;
    if (lastStampRef.current === data.updatedAt) return;
    lastStampRef.current = data.updatedAt;

    const point: HistoryPoint = {
      stamp: data.updatedAt,
      label: formatUpdatedAt(data.updatedAt),
    };

    HISTORY_TEAMS.forEach((team) => {
      point[team.teamKey] = data.featured[team.teamName] ?? null;
    });

    setHistory((prev) => {
      const next = [...prev, point];
      return next.length > 24 ? next.slice(-24) : next;
    });
  }, [data]);

  const ranking = data?.ranking ?? [];
  const heroTeam = ranking[0] ?? null;
  const shortlist = ranking.slice(0, 10);
  const spotlightTeams = ranking.slice(1, 5);
  const topProbability = heroTeam?.probabilityPct || 1;
  const hasRanking = shortlist.length > 0;

  const state = isLoading && !data
    ? "loading"
    : hasRanking
      ? data?.stale
        ? "stale"
        : "ok"
      : "empty";

  const historyTeams = useMemo(() => {
    return HISTORY_TEAMS.filter((team) => history.some((point) => point[team.teamKey] != null));
  }, [history]);

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-4">
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

      {state === "loading" ? (
        <div className="animate-pulse space-y-3">
          <div className="card h-[180px]" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="card h-[112px]" />
            ))}
          </div>
          <div className="card h-[280px]" />
        </div>
      ) : null}

      {state === "empty" ? (
        <EmptyState
          title="Mercado no disponible"
          text={data?.error || error?.message || "Polymarket no ha devuelto datos válidos."}
          icon={AlertCircle}
          action={
            <button type="button" className="btn btn-ghost" onClick={() => void mutate()}>
              <RefreshCw size={14} /> Reintentar
            </button>
          }
        />
      ) : null}

      {hasRanking && heroTeam ? (
        <section className="card card-glow mb-4 animate-fade-in overflow-hidden" style={{ borderColor: `${getTeamColor(heroTeam.teamName)}33` }}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--divider)/0.18)] bg-[rgb(var(--bg-2)/0.75)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                <Crown size={12} style={{ color: getTeamColor(heroTeam.teamName) }} />
                Favorita del mercado
              </div>
              <h2 className="font-display text-[34px] font-black leading-none text-text-warm sm:text-[42px]">{heroTeam.teamName}</h2>
            </div>
            <div className="rounded-[24px] border border-[rgb(var(--divider)/0.16)] bg-[rgb(var(--bg-2)/0.72)] px-5 py-4 text-center shadow-[0_18px_32px_rgba(var(--shadow-color)/0.16)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Probabilidad</p>
              <p className="font-display text-[44px] font-black leading-none" style={{ color: getTeamColor(heroTeam.teamName) }}>
                {formatProbability(heroTeam.probabilityPct)}
                <span className="ml-1 text-[22px] text-text-muted">%</span>
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
            {data?.stale ? <span className="badge badge-amber">Se muestran últimos datos válidos</span> : null}
          </div>
        </section>
      ) : null}

      {hasRanking && spotlightTeams.length ? (
        <section className="mb-4 grid grid-cols-2 gap-3 animate-fade-in" style={{ animationDelay: "0.04s" }}>
          {spotlightTeams.map((team) => {
            const color = getTeamColor(team.teamName);
            return (
              <div key={team.teamName} className="card !p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Flag country={team.teamName} size="md" />
                    <p className="text-sm font-semibold text-text-warm">{team.teamName}</p>
                  </div>
                  <Sparkles size={15} style={{ color }} />
                </div>
                <p className="font-display text-[28px] font-black leading-none" style={{ color }}>
                  {formatProbability(team.probabilityPct)}
                  <span className="ml-1 text-sm text-text-muted">%</span>
                </p>
              </div>
            );
          })}
        </section>
      ) : null}

      {hasRanking ? (
        <section className="mb-4 animate-fade-in" style={{ animationDelay: "0.08s" }}>
          <SectionTitle icon={TrendingUp} accent="#D4AF37">Top 10</SectionTitle>
          <div className="card !p-3">
            <div className="space-y-2.5">
              {shortlist.map((item, index) => {
                const color = getTeamColor(item.teamName);
                const scaledWidth = Math.max(10, (item.probabilityPct / topProbability) * 100);
                const isLeader = index === 0;
                return (
                  <div
                    key={`${item.teamName}-${index}`}
                    className="rounded-[18px] border border-[rgb(var(--divider)/0.12)] bg-[rgb(var(--bg-2)/0.7)] px-3.5 py-3"
                    style={isLeader ? { borderColor: `${color}33`, background: `linear-gradient(135deg, ${color}14, rgb(var(--bg-2)/0.72))` } : undefined}
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgb(var(--divider)/0.14)] bg-[rgb(var(--bg-3)/0.92)] font-display text-sm font-black text-text-muted">
                        {index + 1}
                      </span>
                      <Flag country={item.teamName} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-warm">{item.teamName}</span>
                      <span className="font-display text-base font-black" style={{ color }}>
                        {formatProbability(item.probabilityPct)}%
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full border border-[rgb(var(--divider)/0.08)] bg-[rgb(var(--bg-3)/0.9)]">
                      <div className="h-full rounded-full transition-all" style={{ width: `${scaledWidth}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {hasRanking && history.length > 1 && historyTeams.length ? (
        <section className="mb-6 animate-fade-in" style={{ animationDelay: "0.12s" }}>
          <SectionTitle icon={TrendingUp} accent="#D4AF37">Evolución reciente</SectionTitle>
          <div className="card !p-3.5">
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={history}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} width={34} tickFormatter={(value) => `${value}%`} />
                <Tooltip
                  contentStyle={{
                    background: "rgb(var(--bg-4))",
                    border: "1px solid rgb(var(--divider) / 0.16)",
                    borderRadius: 18,
                    color: "rgb(var(--text-primary))",
                    boxShadow: "0 20px 40px rgba(var(--shadow-color) / 0.22)",
                  }}
                  labelStyle={{ color: "rgb(var(--text-muted))", fontSize: 11 }}
                  formatter={(value, name) => {
                    const key = String(name ?? "");
                    const team = historyTeams.find((item) => item.teamKey === key);
                    const displayValue = value == null ? "—" : Array.isArray(value) ? value.join(" - ") : `${value}%`;
                    return [displayValue, team?.teamName || key] as [string, string];
                  }}
                />
                {historyTeams.map((team) => (
                  <Line
                    key={team.teamKey}
                    type="monotone"
                    dataKey={team.teamKey}
                    stroke={team.color}
                    strokeWidth={team.isPrimary ? 3 : 2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 flex flex-wrap justify-center gap-2.5">
              {historyTeams.map((team) => (
                <span key={team.teamKey} className="inline-flex items-center gap-1 text-[10px] text-text-muted">
                  <span className="inline-block h-[3px] w-4 rounded-full" style={{ background: team.color }} />
                  {team.teamName}
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
