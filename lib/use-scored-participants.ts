"use client";

import { useEffect, useMemo } from "react";
import useSWR from "swr";
import { PARTICIPANTS, type Team } from "@/lib/data";
import { createDefaultAdminResults, sanitizeAdminResults, type AdminResults } from "@/lib/admin-results";
import { createEmptyUserTeamsStore, hasRealUserTeams, sanitizeUserTeamsStore, type UserTeamsStore } from "@/lib/user-teams";
import { scoreParticipants } from "@/lib/scoring";

const ADMIN_RESULTS_EVENT = "penita-admin-results-updated";
const USER_TEAMS_EVENT = "penita-user-teams-updated";

const adminFetcher = async (url: string): Promise<AdminResults> => {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || "No se han podido cargar los resultados del admin.");
  }
  return sanitizeAdminResults(payload);
};

const userTeamsFetcher = async (url: string): Promise<UserTeamsStore> => {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || "No se han podido cargar las porras guardadas.");
  }
  return sanitizeUserTeamsStore(payload);
};

export function notifyAdminResultsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ADMIN_RESULTS_EVENT));
}

export function notifyUserTeamsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(USER_TEAMS_EVENT));
}

export function useUserTeamsStore() {
  const { data, error, isLoading, mutate } = useSWR<UserTeamsStore>("/api/user-teams", userTeamsFetcher, {
    fallbackData: createEmptyUserTeamsStore(),
    revalidateOnFocus: true,
    // Limit retries on error — prevents infinite loop when Neon has cold-start or
    // transient connection issues. After 3 failures, stop until user explicitly retries.
    onErrorRetry: (_error, _key, _config, revalidate, { retryCount }) => {
      if (retryCount >= 3) return;
      const delay = Math.min(5000 * (retryCount + 1), 30_000);
      setTimeout(() => revalidate({ retryCount }), delay);
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleRefresh = () => {
      void mutate();
    };

    window.addEventListener(USER_TEAMS_EVENT, handleRefresh);
    return () => {
      window.removeEventListener(USER_TEAMS_EVENT, handleRefresh);
    };
  }, [mutate]);

  return {
    store: useMemo(() => sanitizeUserTeamsStore(data), [data]),
    error,
    isLoading,
    mutate,
  };
}

export function useScoredParticipants() {
  const { data, error, isLoading, mutate } = useSWR<AdminResults>("/api/admin-results", adminFetcher, {
    fallbackData: createDefaultAdminResults(),
    revalidateOnFocus: true,
  });
  const userTeams = useUserTeamsStore();

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleRefresh = () => {
      void mutate();
    };

    window.addEventListener(ADMIN_RESULTS_EVENT, handleRefresh);
    return () => {
      window.removeEventListener(ADMIN_RESULTS_EVENT, handleRefresh);
    };
  }, [mutate]);

  const adminResults = useMemo(() => sanitizeAdminResults(data), [data]);
  const sourceParticipants = useMemo<Team[]>(() => {
    if (hasRealUserTeams(userTeams.store)) {
      return userTeams.store.entries;
    }
    return PARTICIPANTS;
  }, [userTeams.store]);
  const participants = useMemo<Team[]>(() => scoreParticipants(sourceParticipants, adminResults), [sourceParticipants, adminResults]);

  return {
    adminResults,
    participants,
    isLoading: isLoading || userTeams.isLoading,
    error: error || userTeams.error,
    mutate,
    userTeamsStore: userTeams.store,
    mutateUserTeams: userTeams.mutate,
    hasRealParticipants: hasRealUserTeams(userTeams.store),
  };
}
