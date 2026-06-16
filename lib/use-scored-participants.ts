"use client";

import { useEffect, useMemo } from "react";
import useSWR from "swr";
import { PARTICIPANTS, type Team } from "@/lib/data";
import {
  createDefaultAdminResults,
  sanitizeAdminResults,
  type AdminResults,
} from "@/lib/admin-results";
import {
  createEmptyUserTeamsStore,
  hasRealUserTeams,
  sanitizeUserTeamsStore,
  type UserTeamsStore,
} from "@/lib/user-teams";
import { scoreParticipants } from "@/lib/scoring";
import {
  FINISHED_STATUSES,
  IN_PLAY_STATUSES,
  applyApiResultsToAdminResults,
} from "@/lib/admin-import-fixtures";

const ADMIN_RESULTS_EVENT = "penita-admin-results-updated";
const USER_TEAMS_EVENT = "penita-user-teams-updated";

// Helper compartido para cortar reintentos en bucle si Neon tiene cold-start.
// Sin este límite, SWR reintenta indefinidamente con backoff exponencial,
// lo que combinado con revalidateOnFocus puede crear el "loop" de carga.
const limitedRetry = (
  _err: unknown,
  _key: string,
  _config: unknown,
  revalidate: (opts: { retryCount: number }) => void,
  { retryCount }: { retryCount: number }
) => {
  if (retryCount >= 3) return;
  const delay = Math.min(5000 * (retryCount + 1), 30_000);
  setTimeout(() => revalidate({ retryCount }), delay);
};

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

// Fetcher propio para /api/auth/avatars. NO se puede reutilizar adminFetcher:
// ese pasa la respuesta por sanitizeAdminResults(), que reconstruye un objeto
// AdminResults limpio y descarta la clave `avatars`. Aquí devolvemos el mapa
// { userId: avatarUrl } tal cual lo manda el endpoint.
type AvatarsPayload = { avatars: Record<string, string> };
const avatarsFetcher = async (url: string): Promise<AvatarsPayload> => {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error("No se han podido cargar las fotos de perfil.");
  }
  const avatars =
    payload && typeof payload === "object" && payload.avatars && typeof payload.avatars === "object"
      ? (payload.avatars as Record<string, string>)
      : {};
  return { avatars };
};

// Inyecta la foto de perfil del dueño en cada participante (por userId).
function applyAvatars(list: Team[], avatars: Record<string, string> | null | undefined): Team[] {
  if (!avatars) return list;
  return list.map((p) => (avatars[p.userId] ? { ...p, avatarUrl: avatars[p.userId] } : p));
}

export function notifyAdminResultsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ADMIN_RESULTS_EVENT));
}

export function notifyUserTeamsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(USER_TEAMS_EVENT));
}

export function useUserTeamsStore() {
  const { data, error, isLoading, mutate } = useSWR<UserTeamsStore>(
    "/api/user-teams",
    userTeamsFetcher,
    {
      fallbackData: createEmptyUserTeamsStore(),
      revalidateOnFocus: true,
      dedupingInterval: 10_000,
      onErrorRetry: limitedRetry,
    }
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handle = () => {
      void mutate();
    };
    window.addEventListener(USER_TEAMS_EVENT, handle);
    return () => window.removeEventListener(USER_TEAMS_EVENT, handle);
  }, [mutate]);

  return {
    store: useMemo(() => sanitizeUserTeamsStore(data), [data]),
    error,
    isLoading,
    mutate,
  };
}

export function useScoredParticipants() {
  const { data, error, isLoading, mutate } = useSWR<AdminResults>(
    "/api/admin-results",
    adminFetcher,
    {
      fallbackData: createDefaultAdminResults(),
      revalidateOnFocus: true,
      dedupingInterval: 10_000,
      onErrorRetry: limitedRetry,
    }
  );
  const userTeams = useUserTeamsStore();

  // Mapa userId → avatarUrl, para mostrar la foto de cada participante.
  const { data: avatarsData } = useSWR<AvatarsPayload>(
    "/api/auth/avatars",
    avatarsFetcher,
    { revalidateOnFocus: true, dedupingInterval: 30_000, onErrorRetry: limitedRetry }
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handle = () => {
      void mutate();
    };
    window.addEventListener(ADMIN_RESULTS_EVENT, handle);
    return () => window.removeEventListener(ADMIN_RESULTS_EVENT, handle);
  }, [mutate]);

  const adminResults = useMemo(() => sanitizeAdminResults(data), [data]);
  const avatarsById = useMemo(() => avatarsData?.avatars ?? null, [avatarsData]);
  const sourceParticipants = useMemo<Team[]>(() => {
    if (hasRealUserTeams(userTeams.store)) {
      return userTeams.store.entries;
    }
    return PARTICIPANTS;
  }, [userTeams.store]);
  const participants = useMemo<Team[]>(() => {
    const scored = scoreParticipants(sourceParticipants, adminResults);
    return applyAvatars(scored, avatarsById);
  }, [sourceParticipants, adminResults, avatarsById]);

  return {
    adminResults,
    avatarsById,
    participants,
    isLoading: isLoading || userTeams.isLoading,
    error: error || userTeams.error,
    mutate,
    userTeamsStore: userTeams.store,
    mutateUserTeams: userTeams.mutate,
    hasRealParticipants: hasRealUserTeams(userTeams.store),
  };
}

// ════════════════════════════════════════════════════════════
// RANKING EN VIVO
//
// Mientras hay partidos EN JUEGO, calcula una clasificación provisional:
// el scoring oficial de siempre, pero alimentado además con los marcadores
// en directo de la API como si los partidos acabaran ahora mismo. Es solo
// lectura: no guarda nada y desaparece cuando no hay partidos en juego.
// ════════════════════════════════════════════════════════════

interface LiveFixturesPayload {
  connection?: string;
  fixtures?: unknown;
}

const fixturesFetcher = async (url: string): Promise<LiveFixturesPayload> => {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error("No se han podido cargar los partidos en vivo.");
  return payload as LiveFixturesPayload;
};

const LIVE_OVERLAY_STATUSES = new Set<string>([...FINISHED_STATUSES, ...IN_PLAY_STATUSES]);

export function useLiveScoredParticipants() {
  const base = useScoredParticipants();

  const { data: fixturesPayload } = useSWR<LiveFixturesPayload>(
    "/api/results/fixtures",
    fixturesFetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
      dedupingInterval: 15_000,
      onErrorRetry: limitedRetry,
    }
  );

  const sourceParticipants = useMemo<Team[]>(() => {
    if (hasRealUserTeams(base.userTeamsStore)) return base.userTeamsStore.entries;
    return PARTICIPANTS;
  }, [base.userTeamsStore]);

  const { liveMatchCount, provisionalParticipants } = useMemo(() => {
    const fixtures = Array.isArray(fixturesPayload?.fixtures) ? fixturesPayload?.fixtures : [];
    if (!fixtures || fixtures.length === 0) {
      return { liveMatchCount: 0, provisionalParticipants: null as Team[] | null };
    }
    const inPlay = fixtures.filter((f) =>
      IN_PLAY_STATUSES.has(String((f as Record<string, unknown>)?.statusShort ?? ""))
    ).length;
    if (inPlay === 0) {
      return { liveMatchCount: 0, provisionalParticipants: null as Team[] | null };
    }
    const { merged, filled } = applyApiResultsToAdminResults(
      base.adminResults,
      fixtures,
      LIVE_OVERLAY_STATUSES
    );
    if (filled.length === 0) {
      return { liveMatchCount: inPlay, provisionalParticipants: null as Team[] | null };
    }
    return {
      liveMatchCount: inPlay,
      provisionalParticipants: applyAvatars(
        scoreParticipants(sourceParticipants, merged),
        base.avatarsById
      ),
    };
  }, [fixturesPayload, base.adminResults, sourceParticipants, base.avatarsById]);

  return {
    ...base,
    /** Nº de partidos en juego ahora mismo según la API */
    liveMatchCount,
    /** Clasificación provisional con los marcadores en vivo (o null si no procede) */
    provisionalParticipants,
  };
}
