"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { useLiveScoredParticipants } from "@/lib/use-scored-participants";
import { getActiveWindows, getResolvedWindows, scoreTeamWindows, type Ventana } from "@/lib/scoring";
import type { Team } from "@/lib/data";
import type { AdminResults } from "@/lib/admin-results";
import type { CupConfig } from "@/lib/cup/types";
import { computeGroups, type CupGroupsResult, type GoalsMap } from "@/lib/cup/groups";
import { buildBracket, type CupBracket, type TotalsMap } from "@/lib/cup/bracket";

const fetcher = async (url: string): Promise<CupConfig> => {
  const res = await fetch(url, { cache: "no-store" });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload?.error || "No se ha podido cargar la Copa.");
  return payload as CupConfig;
};

export interface UseCupResult {
  config: CupConfig | undefined;
  locked: boolean;
  groups: CupGroupsResult | null;
  bracket: CupBracket | null;
  goals: GoalsMap;
  teamById: Map<string, Team>;
  adminResults: AdminResults;
  liveMatchCount: number;
  active: Record<Ventana, boolean>;
  resolved: Record<Ventana, boolean>;
  isLoading: boolean;
  error: unknown;
  mutateConfig: () => void;
}

export function useCup(): UseCupResult {
  const live = useLiveScoredParticipants();
  const { participants, provisionalParticipants, liveAdminResults, liveMatchCount, isLoading, error } = live;

  const { data: config, mutate } = useSWR<CupConfig>("/api/cup", fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
  });

  // Lista en vivo: usa la provisional (con marcadores en juego) si la hay.
  const teams = useMemo(() => provisionalParticipants ?? participants, [provisionalParticipants, participants]);
  const adminResults = liveAdminResults;

  const teamById = useMemo(() => new Map(teams.map((p) => [p.id, p] as [string, Team])), [teams]);

  // Goles por ventana, en vivo (mismos puntos que el ranking).
  const goals: GoalsMap = useMemo(() => {
    const map: GoalsMap = {};
    teams.forEach((p) => {
      map[p.id] = scoreTeamWindows(p, adminResults);
    });
    return map;
  }, [teams, adminResults]);

  const totals: TotalsMap = useMemo(
    () => Object.fromEntries(teams.map((p) => [p.id, p.totalPoints] as [string, number])),
    [teams]
  );

  // Ventanas activas (en juego) y cerradas (completas).
  const active = useMemo(() => getActiveWindows(adminResults), [adminResults]);
  const resolved = useMemo(() => getResolvedWindows(adminResults), [adminResults]);

  const groups = useMemo(
    () => (config?.locked ? computeGroups(config.groups, goals, active) : null),
    [config, goals, active]
  );

  const bracket = useMemo(() => {
    if (!groups) return null;
    // No se revelan los clasificados hasta que la Jornada 3 esté cerrada.
    const groupsClosed = resolved.J3;
    const gatedResolveRef = (ref: string) => (groupsClosed ? groups.resolveRef(ref) : undefined);
    return buildBracket(gatedResolveRef, goals, active, resolved, totals);
  }, [groups, goals, active, resolved, totals]);

  return {
    config,
    locked: Boolean(config?.locked),
    groups,
    bracket,
    goals,
    teamById,
    adminResults,
    liveMatchCount,
    active,
    resolved,
    isLoading,
    error,
    mutateConfig: () => void mutate(),
  };
}
