"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { useScoredParticipants } from "@/lib/use-scored-participants";
import { getResolvedWindows, scoreTeamWindows } from "@/lib/scoring";
import type { Team } from "@/lib/data";
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
  isLoading: boolean;
  error: unknown;
  mutateConfig: () => void;
}

export function useCup(): UseCupResult {
  const { participants, adminResults, isLoading, error } = useScoredParticipants();
  const { data: config, mutate } = useSWR<CupConfig>("/api/cup", fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
  });

  const teamById = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants]);

  const goals: GoalsMap = useMemo(() => {
    const map: GoalsMap = {};
    participants.forEach((p) => {
      map[p.id] = scoreTeamWindows(p, adminResults);
    });
    return map;
  }, [participants, adminResults]);

  const totals: TotalsMap = useMemo(
    () => Object.fromEntries(participants.map((p) => [p.id, p.totalPoints])),
    [participants]
  );

  const resolved = useMemo(() => getResolvedWindows(adminResults), [adminResults]);

  const groups = useMemo(
    () => (config?.locked ? computeGroups(config.groups, goals, resolved) : null),
    [config, goals, resolved]
  );

  const bracket = useMemo(
    () => (groups ? buildBracket(groups.resolveRef, goals, resolved, totals) : null),
    [groups, goals, resolved, totals]
  );

  return {
    config,
    locked: Boolean(config?.locked),
    groups,
    bracket,
    goals,
    teamById,
    isLoading,
    error,
    mutateConfig: () => void mutate(),
  };
}
