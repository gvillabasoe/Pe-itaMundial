// ════════════════════════════════════════════════════════════
// MODO COPA — goles por jornada (ventana)
// ════════════════════════════════════════════════════════════
// Convierte el scoring de cada porra en los "goles" de cada ventana del
// Mundial entre porras. Es una capa fina sobre lib/scoring (única fuente de
// verdad), de modo que la suma de las 8 ventanas cuadra con el total.

import type { AdminResults } from "@/lib/admin-results";
import type { Team } from "@/lib/data";
import { scoreParticipants, scoreTeamWindows, sumWindows, type Ventana } from "@/lib/scoring";
import type { GoalsByWindow } from "@/lib/cup/types";

// Goles de una porra en cada ventana.
export function goalsByWindow(team: Team, adminResults: AdminResults): GoalsByWindow {
  return { teamId: team.id, goals: scoreTeamWindows(team, adminResults) };
}

// Goles de todas las porras.
export function goalsForAll(teams: Team[], adminResults: AdminResults): GoalsByWindow[] {
  return teams.map((team) => goalsByWindow(team, adminResults));
}

// Goles de una porra en una ventana concreta (el marcador de su cruce).
export function goalsFor(team: Team, adminResults: AdminResults, ventana: Ventana): number {
  return scoreTeamWindows(team, adminResults)[ventana];
}

// ── Test de cuadre ──────────────────────────────────────────
// Verifica que, con resultados cargados, la suma de las 8 ventanas de cada
// porra es exactamente su total. Si adminResults aún no está configurado,
// no hay goles repartibles y se considera correcto (suma 0).
export interface WindowSumCheck {
  teamId: string;
  name: string;
  total: number;
  suma: number;
  ok: boolean;
}

export function verifyWindowSums(teams: Team[], adminResults: AdminResults): WindowSumCheck[] {
  const scored = scoreParticipants(teams, adminResults);
  const totalById = new Map(scored.map((t) => [t.id, t.totalPoints] as [string, number]));
  return teams.map((team) => {
    const suma = sumWindows(scoreTeamWindows(team, adminResults));
    const total = adminResults.configured ? totalById.get(team.id) ?? 0 : suma;
    return { teamId: team.id, name: team.name, total, suma, ok: suma === total };
  });
}
