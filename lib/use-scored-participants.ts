"use client";

import { useEffect, useMemo } from "react";
import useSWR from "swr";
import { PARTICIPANTS, type Team } from "@/lib/data";
import { createDefaultAdminResults, sanitizeAdminResults, type AdminResults } from "@/lib/admin-results";
import { scoreParticipants } from "@/lib/scoring";

const ADMIN_RESULTS_EVENT = "penita-admin-results-updated";

const fetcher = async (url: string): Promise<AdminResults> => {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || "No se han podido cargar los resultados del admin.");
  }
  return sanitizeAdminResults(payload);
};

export function notifyAdminResultsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ADMIN_RESULTS_EVENT));
}

export function useScoredParticipants() {
  const { data, error, isLoading, mutate } = useSWR<AdminResults>("/api/admin-results", fetcher, {
    fallbackData: createDefaultAdminResults(),
    revalidateOnFocus: true,
  });

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
  const participants = useMemo<Team[]>(() => scoreParticipants(PARTICIPANTS, adminResults), [adminResults]);

  return {
    adminResults,
    participants,
    isLoading,
    error,
    mutate,
  };
}
