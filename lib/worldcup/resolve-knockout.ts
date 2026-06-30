/**
 * Resolución de los "placeholders" de la fase final a nombres reales de país.
 *
 * El calendario oficial (WORLD_CUP_MATCHES) define los partidos de eliminatorias
 * con marcadores de posición: "1.º Grupo H", "2.º Grupo A", "Mejor 3.º A/B/C/D/F",
 * "Ganador 74", "Perdedor 101"...
 *
 * Cuando el admin ya ha cargado los resultados oficiales (posiciones de grupo y/o
 * marcadores de eliminatorias en el panel de Admin → Neon), estos placeholders se
 * sustituyen por el nombre real del país. Si todavía no está determinado, se
 * mantiene el placeholder tal cual.
 *
 * Notas:
 *  - "N.º Grupo X" se resuelve con `adminResults.groupPositions` (posición inequívoca).
 *  - "Ganador N" / "Perdedor N": el ganador se toma de las listas de avance del
 *    admin (Admin → Eliminatorias) — la misma fuente que el ranking — y solo si
 *    esa lista está vacía se decide por el marcador oficial.
 *  - "Mejor 3.º ..." se resuelve como el 3.º del grupo que el admin haya asignado
 *    a ese hueco en `adminResults.bestThirdAssignments` (si todavía no hay
 *    asignación o posiciones, se conserva el placeholder).
 */
import { GROUPS } from "@/lib/data";
import { WORLD_CUP_MATCHES, type MatchStage, type WorldCupMatch } from "@/lib/worldcup/schedule";
import { TEAM_SET, isConfiguredMatchResult, type AdminResults } from "@/lib/admin-results";

const MATCH_BY_ID = new Map<number, WorldCupMatch>(WORLD_CUP_MATCHES.map((m) => [m.id, m]));

/**
 * Equipos que el admin ha marcado como AVANZADOS desde una fase, leídos de la
 * sección Admin → Eliminatorias (las mismas listas que usa el ranking). El
 * ganador de un partido de esa fase es el equipo del cruce que aparece aquí.
 * Es la fuente fiable: no depende de la orientación del marcador ni se rompe en
 * cruces resueltos por penaltis (empate en el marcador). Devuelve null si la
 * lista de esa ronda todavía está vacía (entonces se recurre al marcador).
 */
function advancersFromStage(stage: MatchStage, admin: AdminResults): Set<string> | null {
  const fromRound = (arr: string[] | undefined): Set<string> | null => {
    const clean = (arr || []).filter(Boolean);
    return clean.length ? new Set(clean) : null;
  };
  switch (stage) {
    case "round-of-32": return fromRound(admin.knockoutRounds.octavos);
    case "round-of-16": return fromRound(admin.knockoutRounds.cuartos);
    case "quarter-final": return fromRound(admin.knockoutRounds.semis);
    case "semi-final": return fromRound(admin.knockoutRounds.final);
    case "final": return admin.podium.campeon ? new Set([admin.podium.campeon]) : null;
    case "third-place": return admin.podium.tercero ? new Set([admin.podium.tercero]) : null;
    default: return null;
  }
}

/** Equipo que ocupa una posición concreta de un grupo, solo si es inequívoco. */
function teamAtGroupPosition(group: string, pos: number, admin: AdminResults): string | null {
  const teams = GROUPS[group];
  if (!teams) return null;
  const matches = teams.filter((t) => admin.groupPositions[t] === pos);
  return matches.length === 1 ? matches[0] : null;
}

function resolveSlot(slot: string, admin: AdminResults, visiting: Set<number>): string {
  // Si ya es un país real, no hay nada que resolver.
  if (TEAM_SET.has(slot)) return slot;

  // "1.º Grupo X" … "4.º Grupo X"
  const groupMatch = slot.match(/^([1-4])\.º\s+Grupo\s+([A-L])$/);
  if (groupMatch) {
    const team = teamAtGroupPosition(groupMatch[2], Number(groupMatch[1]), admin);
    return team ?? slot;
  }

  // "Ganador N" / "Perdedor N"
  const winnerMatch = slot.match(/^(Ganador|Perdedor)\s+(\d+)$/);
  if (winnerMatch) {
    const id = Number(winnerMatch[2]);
    if (visiting.has(id)) return slot; // protección anti-ciclos
    const match = MATCH_BY_ID.get(id);
    if (!match) return slot;

    visiting.add(id);
    const homeTeam = resolveSlot(match.homeTeam, admin, visiting);
    const awayTeam = resolveSlot(match.awayTeam, admin, visiting);
    visiting.delete(id);

    const wantWinner = winnerMatch[1] === "Ganador";

    // Fuente principal: las listas de avance del admin (Admin → Eliminatorias),
    // las mismas que usa el ranking. El ganador del cruce N es el equipo de N
    // que figura en la ronda siguiente. Robusto frente a la orientación del
    // marcador y a cruces por penaltis. Si esa lista ya tiene equipos es la
    // verdad: si ninguno de los dos del cruce está en ella, ese avance aún no se
    // ha registrado → se mantiene el placeholder (no se adivina por marcador).
    if (wantWinner && TEAM_SET.has(homeTeam) && TEAM_SET.has(awayTeam)) {
      const advancers = advancersFromStage(match.stage, admin);
      if (advancers) {
        const homeAdv = advancers.has(homeTeam);
        const awayAdv = advancers.has(awayTeam);
        if (homeAdv && !awayAdv) return homeTeam;
        if (awayAdv && !homeAdv) return awayTeam;
        return slot; // la lista todavía no decide este cruce
      }
    }

    // Sin listas de avance para esa ronda (o caso "Perdedor"): decidir por el
    // marcador oficial, si está cargado y no es empate.
    const result = admin.matchResults[String(id)];
    if (!isConfiguredMatchResult(result)) return slot; // sin marcador oficial todavía
    if (result.home === result.away) return slot; // empate: no se puede decidir por marcador

    const homeIsWinner = (result.home as number) > (result.away as number);
    const wantHome = wantWinner ? homeIsWinner : !homeIsWinner;
    const chosen = wantHome ? homeTeam : awayTeam;

    // Solo devolvemos el nombre si el lado elegido es ya un país real.
    return TEAM_SET.has(chosen) ? chosen : slot;
  }

  // "Mejor 3.º ..." → 3.º del grupo que el admin haya asignado a este hueco.
  if (/^Mejor 3\.º/.test(slot)) {
    const group = admin.bestThirdAssignments?.[slot];
    if (group) {
      const team = teamAtGroupPosition(group, 3, admin);
      if (team) return team;
    }
    return slot;
  }

  // Cualquier otro caso no resoluble → placeholder.
  return slot;
}

/** Resuelve un placeholder individual de eliminatorias a país real (o lo deja igual). */
export function resolveKnockoutSlot(slot: string, admin: AdminResults): string {
  return resolveSlot(slot, admin, new Set<number>());
}

/**
 * Devuelve los equipos (local/visitante) de un partido, sustituyendo los
 * placeholders de fase final por nombres reales cuando ya estén determinados.
 */
export function resolveKnockoutMatchTeams(
  match: WorldCupMatch,
  admin: AdminResults
): { homeTeam: string; awayTeam: string } {
  if (match.stage === "group") {
    return { homeTeam: match.homeTeam, awayTeam: match.awayTeam };
  }
  return {
    homeTeam: resolveKnockoutSlot(match.homeTeam, admin),
    awayTeam: resolveKnockoutSlot(match.awayTeam, admin),
  };
}
