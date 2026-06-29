import { FIXTURES, GROUPS, KNOCKOUT_ROUND_DEFS, SCORING, type Fixture, type KnockoutPick, type MatchPick, type SpecialPicks, type Team } from "@/lib/data";
import type { AdminResults, KnockoutRoundKey } from "@/lib/admin-results";
import { KNOCKOUT_ADMIN_COUNTS } from "@/lib/admin-results";
import { WORLD_CUP_MATCHES } from "@/lib/worldcup/schedule";
import { normalizeCountryKey } from "@/lib/flags";

// ── Ventanas de puntuación para el "Mundial entre porras" (Modo Copa) ──
// Cada ventana es un periodo de marcador independiente. El reparto es:
//   J1/J2 = puntos de los partidos de esa jornada
//   J3    = partidos de la jornada 3 + puntos por posición de grupo
//   R32..SF = puntos de cada ronda eliminatoria
//   FINAL = final/3.er puesto + podio + especiales
export type Ventana = "J1" | "J2" | "J3" | "R32" | "R16" | "QF" | "SF" | "FINAL";
export const VENTANAS: Ventana[] = ["J1", "J2", "J3", "R32", "R16", "QF", "SF", "FINAL"];

const FIXTURE_BY_ID = new Map(FIXTURES.map((fixture) => [fixture.id, fixture]));
const WORLD_CUP_GROUP_MATCH_ID_BY_PAIR = new Map<string, string>();
const ADMIN_MATCH_ID_BY_FIXTURE_ID = new Map<string, string>();
// ¿Está el fixture invertido respecto al calendario oficial? (local/visitante al revés)
const FIXTURE_FLIP_VS_SCHEDULE = new Map<string, boolean>();
const WORLD_CUP_GROUP_MATCH_BY_ID = new Map(
  WORLD_CUP_MATCHES.filter((m) => m.stage === "group").map((m) => [String(m.id), m])
);

function buildMatchKey(homeTeam: string, awayTeam: string) {
  return `${normalizeCountryKey(homeTeam)}|${normalizeCountryKey(awayTeam)}`;
}

WORLD_CUP_MATCHES.filter((match) => match.stage === "group").forEach((match) => {
  const matchIdStr = String(match.id);
  WORLD_CUP_GROUP_MATCH_ID_BY_PAIR.set(buildMatchKey(match.homeTeam, match.awayTeam), matchIdStr);
  WORLD_CUP_GROUP_MATCH_ID_BY_PAIR.set(buildMatchKey(match.awayTeam, match.homeTeam), matchIdStr);
});

FIXTURES.forEach((fixture) => {
  const matchId = WORLD_CUP_GROUP_MATCH_ID_BY_PAIR.get(buildMatchKey(fixture.homeTeam, fixture.awayTeam));
  if (matchId) {
    ADMIN_MATCH_ID_BY_FIXTURE_ID.set(fixture.id, matchId);
    const scheduleMatch = WORLD_CUP_GROUP_MATCH_BY_ID.get(matchId);
    // El fixture está "invertido" si su local no coincide con el local oficial.
    const flipped = scheduleMatch ? normalizeCountryKey(fixture.homeTeam) !== normalizeCountryKey(scheduleMatch.homeTeam) : false;
    FIXTURE_FLIP_VS_SCHEDULE.set(fixture.id, flipped);
  }
});

if (process.env.NODE_ENV !== "production" && typeof window === "undefined") {
  const unmapped = FIXTURES.filter((f) => f.stage === "groups" && !ADMIN_MATCH_ID_BY_FIXTURE_ID.has(f.id));
  if (unmapped.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(`[scoring] ${unmapped.length} fixtures sin matchId del schedule oficial:`, unmapped.map((f) => `${f.id} (${f.homeTeam} vs ${f.awayTeam})`));
  }
}

function cloneMatchPicks(matchPicks: Record<string, MatchPick>) {
  return Object.fromEntries(Object.entries(matchPicks || {}).map(([k, v]) => [k, { ...v }]));
}

function cloneKnockoutPicks(knockoutPicks: Record<string, KnockoutPick[]>) {
  return Object.fromEntries(
    Object.entries(knockoutPicks || {}).map(([k, picks]) => [k, (picks || []).map((p) => ({ ...p }))])
  );
}

function cloneTeam(team: Team): Team {
  return {
    ...team,
    matchPicks: cloneMatchPicks(team.matchPicks),
    doubleMatches: { ...(team.doubleMatches || {}) },
    knockoutPicks: cloneKnockoutPicks(team.knockoutPicks),
    groupOrderPicks: Object.fromEntries(Object.entries(team.groupOrderPicks || {}).map(([k, v]) => [k, [...v]])),
    specials: { ...team.specials },
    thirdPlacePick: team.thirdPlacePick,
    roundOf32Teams: team.roundOf32Teams ? [...team.roundOf32Teams] : undefined,
    bestThirdGroups: team.bestThirdGroups ? [...team.bestThirdGroups] : undefined,
    bestThirdAssignments: team.bestThirdAssignments ? { ...team.bestThirdAssignments } : undefined,
    createdAt: team.createdAt,
    locked: team.locked,
    source: team.source,
  };
}

function isGroupConfigured(group: string, adminResults: AdminResults) {
  const positions = GROUPS[group].map((t) => adminResults.groupPositions[t]).filter((v) => v > 0);
  if (positions.length !== 4) return false;
  const unique = new Set(positions);
  return unique.size === 4 && unique.has(1) && unique.has(2) && unique.has(3) && unique.has(4);
}

// Usa KNOCKOUT_ADMIN_COUNTS: la ronda está configurada cuando el admin ha llenado
// los N slots que le corresponden (32 para dieciseisavos, 16 para octavos, etc.)
function isRoundConfigured(roundKey: KnockoutRoundKey, adminResults: AdminResults) {
  const required = KNOCKOUT_ADMIN_COUNTS[roundKey] || 0;
  const selected = adminResults.knockoutRounds[roundKey].filter(Boolean);
  return selected.length >= required;
}

function isSpecialConfigured(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value);
  return String(value ?? "").trim() !== "";
}

function resolveGroupMatchResult(fixtureId: string, adminResults: AdminResults) {
  const matchId = ADMIN_MATCH_ID_BY_FIXTURE_ID.get(fixtureId);
  if (!matchId) return null;
  const result = adminResults.matchResults[matchId];
  if (typeof result?.home !== "number" || typeof result?.away !== "number") return null;
  // matchResults está en orientación del calendario oficial; lo orientamos a la
  // del fixture (donde el usuario hizo su pronóstico) para puntuar correctamente.
  return FIXTURE_FLIP_VS_SCHEDULE.get(fixtureId)
    ? { home: result.away, away: result.home }
    : { home: result.home, away: result.away };
}

function getResultSign(home: number, away: number) {
  if (home === away) return "draw" as const;
  return home > away ? ("home" as const) : ("away" as const);
}

function scoreMatchPick(pick: { home: number; away: number }, actualHome: number, actualAway: number, isDouble: boolean) {
  const exact = pick.home === actualHome && pick.away === actualAway;
  if (exact) {
    return { points: isDouble ? SCORING.partidoDobleExacto : SCORING.resultadoExactoTotal, status: "correct" as const };
  }
  const ps = getResultSign(pick.home, pick.away);
  const as_ = getResultSign(actualHome, actualAway);
  if (ps === as_) {
    return { points: isDouble ? SCORING.partidoDobleSigno : SCORING.signo, status: "sign" as const };
  }
  return { points: 0, status: "wrong" as const };
}

function scoreGroupMatchPicks(team: Team, adminResults: AdminResults) {
  let points = 0;
  const matchPicks = cloneMatchPicks(team.matchPicks);
  Object.entries(matchPicks).forEach(([fixtureId, pick]) => {
    const actual = resolveGroupMatchResult(fixtureId, adminResults);
    if (!actual) {
      matchPicks[fixtureId] = { ...pick, points: null, status: "pending" };
      return;
    }
    if (typeof pick.home !== "number" || typeof pick.away !== "number") {
      matchPicks[fixtureId] = { ...pick, points: null, status: "pending" };
      return;
    }
    const fixture = FIXTURE_BY_ID.get(fixtureId) as Fixture | undefined;
    const isDouble = Boolean(fixture?.group && team.doubleMatches?.[fixture.group] === fixtureId);
    const next = scoreMatchPick({ home: pick.home, away: pick.away }, actual.home as number, actual.away as number, isDouble);
    matchPicks[fixtureId] = { ...pick, points: next.points, status: next.status };
    points += next.points;
  });
  return { points, matchPicks };
}

function scoreGroupPositions(team: Team, adminResults: AdminResults) {
  let points = 0;
  Object.keys(GROUPS).forEach((group) => {
    if (!isGroupConfigured(group, adminResults)) return;
    const picks = team.groupOrderPicks[group] || [];
    picks.forEach((country, idx) => {
      if (adminResults.groupPositions[country] === idx + 1) points += SCORING.posicionGrupo;
    });
  });
  return points;
}

// ════════════════════════════════════════════════════════════
// RECONSTRUCCIÓN DE LOS 32 PARTICIPANTES EN DIECISEISAVOS
//
// El usuario no almacena explícitamente los 32 participantes de
// dieciseisavos: se derivan de los picks de grupo.
//   - 1.º y 2.º de cada uno de los 12 grupos = 24 equipos
//   - Los 8 mejores terceros elegidos por el usuario = 8 equipos
//   Total = 32 equipos
// ════════════════════════════════════════════════════════════
function reconstructRound32Participants(team: Team): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  // Top 2 de cada grupo
  for (const group of Object.keys(GROUPS)) {
    const picks = team.groupOrderPicks?.[group] || [];
    [0, 1].forEach((i) => {
      if (picks[i] && !seen.has(picks[i])) {
        result.push(picks[i]);
        seen.add(picks[i]);
      }
    });
  }

  // Mejores terceros elegidos
  for (const group of (team.bestThirdGroups || [])) {
    const picks = team.groupOrderPicks?.[group] || [];
    if (picks[2] && !seen.has(picks[2])) {
      result.push(picks[2]);
      seen.add(picks[2]);
    }
  }

  return result;
}

// ════════════════════════════════════════════════════════════
// SCORING DE ELIMINATORIAS — MODELO CORRECTO
//
// Los puntos se otorgan por acertar que un equipo LLEGA a una ronda,
// no por que la gane. El mapeo de picks→admin es:
//
//  Ronda          | Fuente de picks del usuario              | Admin referencia
//  dieciseisavos  | reconstructRound32Participants() — 32    | admin.dieciseisavos (32)
//  octavos        | knockoutPicks.dieciseisavos — 16 picks   | admin.octavos (16)
//  cuartos        | knockoutPicks.octavos — 8 picks          | admin.cuartos (8)
//  semis          | knockoutPicks.cuartos — 4 picks          | admin.semis (4)
//  final          | knockoutPicks.semis — 2 picks            | admin.final (2)
//
// Ejemplo:
//  - Tienes España en tu reconstructed 32 y España está en admin.dieciseisavos → +6
//  - Tienes España en knockoutPicks.dieciseisavos (elegiste que avanzara) y
//    España está en admin.octavos → +10 (independiente del +6 anterior)
//  - etc. Cada ronda puntúa de forma independiente.
// ════════════════════════════════════════════════════════════
function scoreKnockoutRounds(team: Team, adminResults: AdminResults) {
  let points = 0;
  // Puntos por ventana eliminatoria, para el desglose del Modo Copa.
  const koByWindow = { R32: 0, R16: 0, QF: 0, SF: 0, FINAL_KO: 0 };
  const knockoutPicks = cloneKnockoutPicks(team.knockoutPicks);

  // --- Obtener pts por ronda ---
  const ptsByKey = KNOCKOUT_ROUND_DEFS.reduce<Record<string, number>>((acc, r) => {
    acc[r.key] = r.pts;
    return acc;
  }, {});

  // Plan de scoring: [picks_fuente, admin_referencia, pts]
  type ScoringEntry = {
    getPicks: () => string[];
    adminKey: KnockoutRoundKey;
    pts: number;
    win: keyof typeof koByWindow;
  };

  const scoringPlan: ScoringEntry[] = [
    // Dieciseisavos: reconstruimos los 32 participantes desde los picks de grupo
    {
      getPicks: () => reconstructRound32Participants(team),
      adminKey: "dieciseisavos",
      pts: ptsByKey["dieciseisavos"] ?? 6,
      win: "R32",
    },
    // Octavos: los 16 que el usuario eligió para avanzar FROM dieciseisavos
    {
      getPicks: () => (team.knockoutPicks?.["dieciseisavos"] || []).map((p) => p.country).filter(Boolean),
      adminKey: "octavos",
      pts: ptsByKey["octavos"] ?? 10,
      win: "R16",
    },
    // Cuartos: los 8 que el usuario eligió para avanzar FROM octavos
    {
      getPicks: () => (team.knockoutPicks?.["octavos"] || []).map((p) => p.country).filter(Boolean),
      adminKey: "cuartos",
      pts: ptsByKey["cuartos"] ?? 15,
      win: "QF",
    },
    // Semis: los 4 que el usuario eligió para avanzar FROM cuartos
    {
      getPicks: () => (team.knockoutPicks?.["cuartos"] || []).map((p) => p.country).filter(Boolean),
      adminKey: "semis",
      pts: ptsByKey["semis"] ?? 20,
      win: "SF",
    },
    // Final: los 2 que el usuario eligió para avanzar FROM semis
    {
      getPicks: () => (team.knockoutPicks?.["semis"] || []).map((p) => p.country).filter(Boolean),
      adminKey: "final",
      pts: ptsByKey["final"] ?? 25,
      win: "FINAL_KO",
    },
  ];

  scoringPlan.forEach(({ getPicks, adminKey, pts, win }) => {
    // Puntúa con los equipos YA marcados en la ronda, aunque no esté completa:
    // cada equipo clasificado suma en cuanto el admin lo añade.
    const actualTeams = new Set(adminResults.knockoutRounds[adminKey].filter(Boolean));
    if (actualTeams.size === 0) return;

    const seen = new Set<string>();

    getPicks().forEach((country) => {
      if (!country || seen.has(country)) return;
      seen.add(country);
      if (actualTeams.has(country)) {
        points += pts;
        koByWindow[win] += pts;
      }
    });
  });

  // ── Actualizar status de knockoutPicks para display ──────────────────
  // Para la pestaña de Eliminatorias en Mi Club, marcamos el status de cada
  // pick según corresponde a su ronda de puntuación.
  //
  // NOTA: El display en EliminatoriasTab (mi-club) calcula la corrección
  // directamente desde adminResults, por lo que estos campos son auxiliares.
  // Los actualizamos de todas formas para consistencia.

  // knockoutPicks.dieciseisavos: correcto si ya está en admin.dieciseisavos; fallo
  // solo si la ronda está completa y no aparece; si no, pendiente.
  {
    const adminD16 = new Set(adminResults.knockoutRounds.dieciseisavos.filter(Boolean));
    const completeD16 = isRoundConfigured("dieciseisavos", adminResults);
    const seen = new Set<string>();
    knockoutPicks.dieciseisavos = (knockoutPicks.dieciseisavos || []).map((pick) => {
      const dup = seen.has(pick.country); seen.add(pick.country);
      const correct = !dup && adminD16.has(pick.country);
      const points = correct ? (ptsByKey["dieciseisavos"] ?? 6) : completeD16 ? 0 : null;
      const status = correct ? "correct" : completeD16 ? "wrong" : "pending";
      return { ...pick, points, status };
    });
  }

  // knockoutPicks.octavos: correcto si ya está en admin.octavos; fallo solo si está completa.
  {
    const adminO = new Set(adminResults.knockoutRounds.octavos.filter(Boolean));
    const completeO = isRoundConfigured("octavos", adminResults);
    const seen = new Set<string>();
    knockoutPicks.octavos = (knockoutPicks.octavos || []).map((pick) => {
      const dup = seen.has(pick.country); seen.add(pick.country);
      const correct = !dup && adminO.has(pick.country);
      const points = correct ? (ptsByKey["octavos"] ?? 10) : completeO ? 0 : null;
      const status = correct ? "correct" : completeO ? "wrong" : "pending";
      return { ...pick, points, status };
    });
  }

  // knockoutPicks.cuartos: correcto si ya está en admin.cuartos; fallo solo si está completa.
  {
    const adminC = new Set(adminResults.knockoutRounds.cuartos.filter(Boolean));
    const completeC = isRoundConfigured("cuartos", adminResults);
    const seen = new Set<string>();
    knockoutPicks.cuartos = (knockoutPicks.cuartos || []).map((pick) => {
      const dup = seen.has(pick.country); seen.add(pick.country);
      const correct = !dup && adminC.has(pick.country);
      const points = correct ? (ptsByKey["cuartos"] ?? 15) : completeC ? 0 : null;
      const status = correct ? "correct" : completeC ? "wrong" : "pending";
      return { ...pick, points, status };
    });
  }

  // knockoutPicks.semis: correcto si ya está en admin.semis; fallo solo si está completa.
  {
    const adminS = new Set(adminResults.knockoutRounds.semis.filter(Boolean));
    const completeS = isRoundConfigured("semis", adminResults);
    const seen = new Set<string>();
    knockoutPicks.semis = (knockoutPicks.semis || []).map((pick) => {
      const dup = seen.has(pick.country); seen.add(pick.country);
      const correct = !dup && adminS.has(pick.country);
      const points = correct ? (ptsByKey["semis"] ?? 20) : completeS ? 0 : null;
      const status = correct ? "correct" : completeS ? "wrong" : "pending";
      return { ...pick, points, status };
    });
  }

  // knockoutPicks.final: correcto si ya está en admin.final; fallo solo si está completa.
  {
    const adminF = new Set(adminResults.knockoutRounds.final.filter(Boolean));
    const completeF = isRoundConfigured("final", adminResults);
    const seen = new Set<string>();
    knockoutPicks.final = (knockoutPicks.final || []).map((pick) => {
      const dup = seen.has(pick.country); seen.add(pick.country);
      const correct = !dup && adminF.has(pick.country);
      const points = correct ? (ptsByKey["final"] ?? 25) : completeF ? 0 : null;
      const status = correct ? "correct" : completeF ? "wrong" : "pending";
      return { ...pick, points, status };
    });
  }

  return { points, knockoutPicks, pointsByWindow: koByWindow };
}

function scorePodium(team: Team, adminResults: AdminResults) {
  let points = 0;
  if (adminResults.podium.campeon && team.championPick === adminResults.podium.campeon) points += SCORING.posicionesFinales.campeon;
  if (adminResults.podium.subcampeon && team.runnerUpPick === adminResults.podium.subcampeon) points += SCORING.posicionesFinales.subcampeon;
  if (adminResults.podium.tercero && team.thirdPlacePick === adminResults.podium.tercero) points += SCORING.posicionesFinales.tercero;
  return points;
}

function scoreSpecials(team: Team, adminResults: AdminResults) {
  let points = 0;
  const sr = adminResults.specialResults;
  if (isSpecialConfigured(sr.mejorJugador) && team.specials.mejorJugador === sr.mejorJugador) points += SCORING.especiales.mejorJugador;
  if (isSpecialConfigured(sr.mejorJoven) && team.specials.mejorJoven === sr.mejorJoven) points += SCORING.especiales.mejorJoven;
  if (isSpecialConfigured(sr.maxGoleador) && team.specials.maxGoleador === sr.maxGoleador) points += SCORING.especiales.maxGoleador;
  if (isSpecialConfigured(sr.maxAsistente) && team.specials.maxAsistente === sr.maxAsistente) points += SCORING.especiales.maxAsistente;
  if (isSpecialConfigured(sr.mejorPortero) && team.specials.mejorPortero === sr.mejorPortero) points += SCORING.especiales.mejorPortero;
  if (isSpecialConfigured(sr.maxGoleadorEsp) && team.specials.maxGoleadorEsp === sr.maxGoleadorEsp) points += SCORING.especiales.maxGoleadorEsp;
  if (isSpecialConfigured(sr.primerGolEsp) && team.specials.primerGolEsp === sr.primerGolEsp) points += SCORING.especiales.primerGolEsp;
  if (isSpecialConfigured(sr.revelacion) && team.specials.revelacion === sr.revelacion) points += SCORING.especiales.revelacion;
  if (isSpecialConfigured(sr.decepcion) && team.specials.decepcion === sr.decepcion) points += SCORING.especiales.decepcion;
  if (typeof sr.minutoPrimerGol === "number" && team.specials.minutoPrimerGol === sr.minutoPrimerGol) points += SCORING.especiales.minutoPrimerGol;
  return points;
}

export function scoreParticipants(participants: Team[], adminResults: AdminResults) {
  const baseTeams = participants.map((p) => cloneTeam(p));

  if (!adminResults.configured) {
    baseTeams.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.finalPhasePoints !== a.finalPhasePoints) return b.finalPhasePoints - a.finalPhasePoints;
      if (b.groupPoints !== a.groupPoints) return b.groupPoints - a.groupPoints;
      return a.name.localeCompare(b.name, "es");
    });
    let r = 1;
    baseTeams.forEach((team, i) => {
      if (i > 0 && team.totalPoints < baseTeams[i - 1].totalPoints) r = i + 1;
      team.currentRank = r;
    });
    return baseTeams;
  }

  const scored = baseTeams.map((p) => {
    const t = cloneTeam(p);
    const matchScores = scoreGroupMatchPicks(t, adminResults);
    const groupPos = scoreGroupPositions(t, adminResults);
    const ko = scoreKnockoutRounds(t, adminResults);
    const podium = scorePodium(t, adminResults);
    const specials = scoreSpecials(t, adminResults);
    t.matchPicks = matchScores.matchPicks;
    t.groupPoints = matchScores.points + groupPos;
    t.knockoutPicks = ko.knockoutPicks;
    t.finalPhasePoints = ko.points + podium;
    t.specialPoints = specials;
    t.totalPoints = t.groupPoints + t.finalPhasePoints + t.specialPoints;
    return t;
  });

  scored.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.finalPhasePoints !== a.finalPhasePoints) return b.finalPhasePoints - a.finalPhasePoints;
    if (b.groupPoints !== a.groupPoints) return b.groupPoints - a.groupPoints;
    return a.name.localeCompare(b.name, "es");
  });

  let r = 1;
  scored.forEach((t, i) => {
    if (i > 0 && t.totalPoints < scored[i - 1].totalPoints) r = i + 1;
    t.currentRank = r;
  });

  return scored;
}

// ════════════════════════════════════════════════════════════
// HELPERS PÚBLICOS PARA DESGLOSE DE PUNTOS POR PICK (Versus — Task 2)
//
// Reutilizan exactamente la misma lógica de puntuación de arriba; son de solo
// lectura y NO alteran el cálculo de la clasificación.
// ════════════════════════════════════════════════════════════

export type MatchPickPointStatus = "correct" | "sign" | "wrong" | "pending";

/**
 * Puntúa un marcador concreto (de cualquier porra o del consenso) contra el
 * resultado oficial del admin para un fixture de grupos. Devuelve puntos null y
 * estado "pending" si el partido aún no tiene resultado o el pick está vacío.
 */
export function scoreMatchPickAgainstAdmin(
  fixtureId: string,
  pick: { home: number | null; away: number | null } | null | undefined,
  isDouble: boolean,
  adminResults: AdminResults
): { points: number | null; status: MatchPickPointStatus } {
  if (!pick || typeof pick.home !== "number" || typeof pick.away !== "number") {
    return { points: null, status: "pending" };
  }
  const actual = resolveGroupMatchResult(fixtureId, adminResults);
  if (!actual || typeof actual.home !== "number" || typeof actual.away !== "number") {
    return { points: null, status: "pending" };
  }
  return scoreMatchPick({ home: pick.home, away: pick.away }, actual.home, actual.away, isDouble);
}

export interface SpecialBreakdownItem {
  key: keyof SpecialPicks;
  label: string;
  isCountry: boolean;
  value: string;
  status: "correct" | "wrong" | "pending";
  points: number;
  max: number;
}

const SPECIAL_BREAKDOWN_META: { key: keyof SpecialPicks; label: string; isCountry: boolean; max: number }[] = [
  { key: "mejorJugador", label: "Mejor Jugador", isCountry: false, max: SCORING.especiales.mejorJugador },
  { key: "mejorJoven", label: "Mejor Joven", isCountry: false, max: SCORING.especiales.mejorJoven },
  { key: "maxGoleador", label: "Máx. Goleador", isCountry: false, max: SCORING.especiales.maxGoleador },
  { key: "maxAsistente", label: "Máx. Asistente", isCountry: false, max: SCORING.especiales.maxAsistente },
  { key: "mejorPortero", label: "Mejor Portero", isCountry: false, max: SCORING.especiales.mejorPortero },
  { key: "maxGoleadorEsp", label: "Goleador ESP", isCountry: false, max: SCORING.especiales.maxGoleadorEsp },
  { key: "primerGolEsp", label: "Primer Gol ESP", isCountry: false, max: SCORING.especiales.primerGolEsp },
  { key: "revelacion", label: "Revelación", isCountry: true, max: SCORING.especiales.revelacion },
  { key: "decepcion", label: "Decepción", isCountry: true, max: SCORING.especiales.decepcion },
  { key: "minutoPrimerGol", label: "Min. 1.er gol", isCountry: false, max: SCORING.especiales.minutoPrimerGol },
];

/**
 * Desglose por pick especial de una porra: valor elegido, puntos obtenidos y
 * estado (correct/wrong/pending) según el resultado oficial del admin.
 */
export function getSpecialsBreakdown(team: Team, adminResults: AdminResults): SpecialBreakdownItem[] {
  const sr = adminResults.specialResults;
  return SPECIAL_BREAKDOWN_META.map((meta) => {
    const rawValue = team.specials[meta.key];
    const value =
      meta.key === "minutoPrimerGol"
        ? (typeof rawValue === "number" && rawValue > 0 ? `${rawValue}'` : "")
        : String(rawValue ?? "");

    const official = sr[meta.key];
    const officialConfigured =
      meta.key === "minutoPrimerGol"
        ? typeof official === "number"
        : String(official ?? "").trim() !== "";

    let status: "correct" | "wrong" | "pending" = "pending";
    let points = 0;
    if (officialConfigured) {
      const hit = rawValue === official;
      status = hit ? "correct" : "wrong";
      points = hit ? meta.max : 0;
    }

    return { key: meta.key, label: meta.label, isCountry: meta.isCountry, value, status, points, max: meta.max };
  });
}

// ════════════════════════════════════════════════════════════
// MODO COPA — desglose de puntos por ventana
// ════════════════════════════════════════════════════════════
// Reparte los puntos de una porra en las 8 ventanas (los "goles" de cada
// jornada del Mundial entre porras). Reutiliza EXACTAMENTE las mismas
// funciones internas que scoreParticipants, así que se cumple por
// construcción que la suma de las 8 ventanas == totalPoints de la porra
// cuando hay resultados (adminResults.configured).
//
// Reparto (confirmado con el formato de la Copa):
//   J1    = puntos de los partidos de la Jornada 1 + minuto del primer gol
//   J2    = puntos de los partidos de la Jornada 2 + primer goleador español
//   J3    = puntos de los partidos de la Jornada 3 + posición de grupo
//   R32   = puntos de dieciseisavos
//   R16   = puntos de octavos
//   QF    = puntos de cuartos
//   SF    = puntos de semifinales
//   FINAL = puntos de final/3.er puesto (ronda final) + podio + resto de especiales
export function scoreTeamWindows(team: Team, adminResults: AdminResults): Record<Ventana, number> {
  const w: Record<Ventana, number> = { J1: 0, J2: 0, J3: 0, R32: 0, R16: 0, QF: 0, SF: 0, FINAL: 0 };
  // Sin resultados aún: no hay goles repartibles por ventana.
  if (!adminResults.configured) return w;

  const t = cloneTeam(team);

  // ── Grupos, repartidos por jornada según fixture.round ──
  const ms = scoreGroupMatchPicks(t, adminResults);
  Object.entries(ms.matchPicks).forEach(([fixtureId, pick]) => {
    const pts = typeof pick.points === "number" ? pick.points : 0;
    if (!pts) return;
    const fixture = FIXTURE_BY_ID.get(fixtureId);
    if (!fixture || fixture.stage !== "groups") return;
    const round = fixture.round || "";
    if (round.includes("1")) w.J1 += pts;
    else if (round.includes("2")) w.J2 += pts;
    else if (round.includes("3")) w.J3 += pts;
  });

  // Posición de grupo → se atribuye a la Jornada 3 (se resuelve al cerrar grupos).
  w.J3 += scoreGroupPositions(t, adminResults);

  // ── Eliminatorias, por ronda ──
  const ko = scoreKnockoutRounds(t, adminResults);
  w.R32 += ko.pointsByWindow.R32;
  w.R16 += ko.pointsByWindow.R16;
  w.QF += ko.pointsByWindow.QF;
  w.SF += ko.pointsByWindow.SF;

  // ── Especiales, repartidos por ventana ──
  // Por regla del torneo: el minuto del primer gol del Mundial cuenta en la
  // Jornada 1 y el primer goleador español en la Jornada 2. El resto de
  // especiales se cuentan en FINAL. Usamos getSpecialsBreakdown (mismos
  // puntos que scoreSpecials) para no romper el cuadre.
  let specialsFinal = 0;
  getSpecialsBreakdown(t, adminResults).forEach((item) => {
    if (item.key === "minutoPrimerGol") w.J1 += item.points;
    else if (item.key === "primerGolEsp") w.J2 += item.points;
    else specialsFinal += item.points;
  });

  // ── Final/3.er puesto + podio + resto de especiales ──
  w.FINAL += ko.pointsByWindow.FINAL_KO + scorePodium(t, adminResults) + specialsFinal;

  return w;
}

// Suma de las ventanas (= goles totales repartidos). Útil para tests de cuadre.
export function sumWindows(windows: Record<Ventana, number>): number {
  return VENTANAS.reduce((acc, k) => acc + (windows[k] || 0), 0);
}

// ── MODO COPA — ventanas ya resueltas ──────────────────────
// Indica qué ventanas tienen ya resultado, para saber si un cruce de la Copa
// está "jugado". Grupos: una jornada está resuelta cuando TODOS sus partidos
// de grupo tienen marcador. Eliminatorias: cuando la ronda del admin está
// completa. FINAL: cuando la ronda final está completa.
export function getResolvedWindows(adminResults: AdminResults): Record<Ventana, boolean> {
  const groupJornadaResolved = (n: number) => {
    const fixtures = FIXTURES.filter((f) => f.stage === "groups" && f.round === `Jornada ${n}`);
    if (fixtures.length === 0) return false;
    return fixtures.every((f) => resolveGroupMatchResult(f.id, adminResults) !== null);
  };
  return {
    J1: groupJornadaResolved(1),
    J2: groupJornadaResolved(2),
    J3: groupJornadaResolved(3),
    R32: isRoundConfigured("dieciseisavos", adminResults),
    R16: isRoundConfigured("octavos", adminResults),
    QF: isRoundConfigured("cuartos", adminResults),
    SF: isRoundConfigured("semis", adminResults),
    FINAL: isRoundConfigured("final", adminResults),
  };
}

// ── MODO COPA — ventanas ya empezadas (para puntuar en vivo) ──
// A diferencia de getResolvedWindows (jornada/ronda COMPLETA), aquí una
// ventana está "activa" en cuanto tiene algún resultado, para que la Copa
// sume puntos en directo como el ranking aunque la jornada no haya acabado.
export function getActiveWindows(adminResults: AdminResults): Record<Ventana, boolean> {
  const groupJornadaStarted = (n: number) => {
    const fixtures = FIXTURES.filter((f) => f.stage === "groups" && f.round === `Jornada ${n}`);
    return fixtures.some((f) => resolveGroupMatchResult(f.id, adminResults) !== null);
  };
  const roundStarted = (key: KnockoutRoundKey) =>
    (adminResults.knockoutRounds[key] || []).some(Boolean);
  const sr = adminResults.specialResults;
  const finalStarted =
    roundStarted("final") ||
    Boolean(adminResults.podium.campeon || adminResults.podium.subcampeon || adminResults.podium.tercero) ||
    Object.entries(sr).some(([k, v]) => (k === "minutoPrimerGol" ? v != null : Boolean(v)));
  return {
    J1: groupJornadaStarted(1),
    J2: groupJornadaStarted(2),
    J3: groupJornadaStarted(3),
    R32: roundStarted("dieciseisavos"),
    R16: roundStarted("octavos"),
    QF: roundStarted("cuartos"),
    SF: roundStarted("semis"),
    FINAL: finalStarted,
  };
}

// MODO COPA — puntos por posición de grupo de una porra (para el detalle de J3).
export function scoreGroupPositionPoints(team: Team, adminResults: AdminResults): number {
  return scoreGroupPositions(team, adminResults);
}

// Resultado oficial de un partido de grupo por su fixtureId (o null si no hay).
// Útil para mostrar el marcador real junto a los puntos del usuario.
export function getGroupMatchResult(
  fixtureId: string,
  adminResults: AdminResults
): { home: number; away: number } | null {
  const r = resolveGroupMatchResult(fixtureId, adminResults);
  if (!r || typeof r.home !== "number" || typeof r.away !== "number") return null;
  return { home: r.home, away: r.away };
}

// Orientación del fixture frente al calendario oficial (para alinear la
// visualización con la pantalla de Resultados sin tocar los pronósticos).
export function isFixtureFlipped(fixtureId: string): boolean {
  return FIXTURE_FLIP_VS_SCHEDULE.get(fixtureId) ?? false;
}

// Equipos del partido en el orden del calendario oficial (local/visitante real).
export function getScheduleTeams(fixtureId: string): { homeTeam: string; awayTeam: string } | null {
  const fixture = FIXTURE_BY_ID.get(fixtureId);
  if (!fixture) return null;
  return FIXTURE_FLIP_VS_SCHEDULE.get(fixtureId)
    ? { homeTeam: fixture.awayTeam, awayTeam: fixture.homeTeam }
    : { homeTeam: fixture.homeTeam, awayTeam: fixture.awayTeam };
}
