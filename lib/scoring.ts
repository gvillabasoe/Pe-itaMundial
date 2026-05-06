import { FIXTURES, GROUPS, KNOCKOUT_ROUND_DEFS, SCORING, type Fixture, type KnockoutPick, type MatchPick, type Team } from "@/lib/data";
import type { AdminResults, KnockoutRoundKey } from "@/lib/admin-results";
import { KNOCKOUT_ADMIN_COUNTS } from "@/lib/admin-results";
import { WORLD_CUP_MATCHES } from "@/lib/worldcup/schedule";
import { normalizeCountryKey } from "@/lib/flags";

const FIXTURE_BY_ID = new Map(FIXTURES.map((fixture) => [fixture.id, fixture]));
const WORLD_CUP_GROUP_MATCH_ID_BY_PAIR = new Map<string, string>();
const ADMIN_MATCH_ID_BY_FIXTURE_ID = new Map<string, string>();

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
  if (matchId) ADMIN_MATCH_ID_BY_FIXTURE_ID.set(fixture.id, matchId);
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
  return result;
}

function getResultSign(home: number, away: number) {
  if (home === away) return "draw" as const;
  return home > away ? ("home" as const) : ("away" as const);
}

function scoreMatchPick(pick: MatchPick, actualHome: number, actualAway: number, isDouble: boolean) {
  const exact = pick.home === actualHome && pick.away === actualAway;
  if (exact) {
    return { points: isDouble ? SCORING.partidoDobleExacto : SCORING.resultadoExactoTotal, status: "correct" as const };
  }
  const ps = getResultSign(pick.home as number, pick.away as number);
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
    if (pick.home === null || pick.away === null) {
      matchPicks[fixtureId] = { ...pick, points: null, status: "pending" };
      return;
    }
    const fixture = FIXTURE_BY_ID.get(fixtureId) as Fixture | undefined;
    const isDouble = Boolean(fixture?.group && team.doubleMatches?.[fixture.group] === fixtureId);
    const next = scoreMatchPick(pick, actual.home as number, actual.away as number, isDouble);
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
  };

  const scoringPlan: ScoringEntry[] = [
    // Dieciseisavos: reconstruimos los 32 participantes desde los picks de grupo
    {
      getPicks: () => reconstructRound32Participants(team),
      adminKey: "dieciseisavos",
      pts: ptsByKey["dieciseisavos"] ?? 6,
    },
    // Octavos: los 16 que el usuario eligió para avanzar FROM dieciseisavos
    {
      getPicks: () => (team.knockoutPicks?.["dieciseisavos"] || []).map((p) => p.country).filter(Boolean),
      adminKey: "octavos",
      pts: ptsByKey["octavos"] ?? 10,
    },
    // Cuartos: los 8 que el usuario eligió para avanzar FROM octavos
    {
      getPicks: () => (team.knockoutPicks?.["octavos"] || []).map((p) => p.country).filter(Boolean),
      adminKey: "cuartos",
      pts: ptsByKey["cuartos"] ?? 15,
    },
    // Semis: los 4 que el usuario eligió para avanzar FROM cuartos
    {
      getPicks: () => (team.knockoutPicks?.["cuartos"] || []).map((p) => p.country).filter(Boolean),
      adminKey: "semis",
      pts: ptsByKey["semis"] ?? 20,
    },
    // Final: los 2 que el usuario eligió para avanzar FROM semis
    {
      getPicks: () => (team.knockoutPicks?.["semis"] || []).map((p) => p.country).filter(Boolean),
      adminKey: "final",
      pts: ptsByKey["final"] ?? 25,
    },
  ];

  scoringPlan.forEach(({ getPicks, adminKey, pts }) => {
    const configured = isRoundConfigured(adminKey, adminResults);
    if (!configured) return;

    const actualTeams = new Set(adminResults.knockoutRounds[adminKey].filter(Boolean));
    const seen = new Set<string>();

    getPicks().forEach((country) => {
      if (!country || seen.has(country)) return;
      seen.add(country);
      if (actualTeams.has(country)) {
        points += pts;
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

  // knockoutPicks.dieciseisavos: comparar contra admin.dieciseisavos (participaron en esa ronda)
  if (isRoundConfigured("dieciseisavos", adminResults)) {
    const adminD16 = new Set(adminResults.knockoutRounds.dieciseisavos.filter(Boolean));
    const seen = new Set<string>();
    knockoutPicks.dieciseisavos = (knockoutPicks.dieciseisavos || []).map((pick) => {
      const dup = seen.has(pick.country); seen.add(pick.country);
      const correct = !dup && adminD16.has(pick.country);
      return { ...pick, points: correct ? (ptsByKey["dieciseisavos"] ?? 6) : 0, status: correct ? "correct" : "wrong" };
    });
  } else {
    knockoutPicks.dieciseisavos = (knockoutPicks.dieciseisavos || []).map((pick) => ({ ...pick, points: null, status: "pending" }));
  }

  // knockoutPicks.octavos: comparar contra admin.octavos
  if (isRoundConfigured("octavos", adminResults)) {
    const adminO = new Set(adminResults.knockoutRounds.octavos.filter(Boolean));
    const seen = new Set<string>();
    knockoutPicks.octavos = (knockoutPicks.octavos || []).map((pick) => {
      const dup = seen.has(pick.country); seen.add(pick.country);
      const correct = !dup && adminO.has(pick.country);
      return { ...pick, points: correct ? (ptsByKey["octavos"] ?? 10) : 0, status: correct ? "correct" : "wrong" };
    });
  } else {
    knockoutPicks.octavos = (knockoutPicks.octavos || []).map((pick) => ({ ...pick, points: null, status: "pending" }));
  }

  // knockoutPicks.cuartos: comparar contra admin.cuartos
  if (isRoundConfigured("cuartos", adminResults)) {
    const adminC = new Set(adminResults.knockoutRounds.cuartos.filter(Boolean));
    const seen = new Set<string>();
    knockoutPicks.cuartos = (knockoutPicks.cuartos || []).map((pick) => {
      const dup = seen.has(pick.country); seen.add(pick.country);
      const correct = !dup && adminC.has(pick.country);
      return { ...pick, points: correct ? (ptsByKey["cuartos"] ?? 15) : 0, status: correct ? "correct" : "wrong" };
    });
  } else {
    knockoutPicks.cuartos = (knockoutPicks.cuartos || []).map((pick) => ({ ...pick, points: null, status: "pending" }));
  }

  // knockoutPicks.semis: comparar contra admin.semis
  if (isRoundConfigured("semis", adminResults)) {
    const adminS = new Set(adminResults.knockoutRounds.semis.filter(Boolean));
    const seen = new Set<string>();
    knockoutPicks.semis = (knockoutPicks.semis || []).map((pick) => {
      const dup = seen.has(pick.country); seen.add(pick.country);
      const correct = !dup && adminS.has(pick.country);
      return { ...pick, points: correct ? (ptsByKey["semis"] ?? 20) : 0, status: correct ? "correct" : "wrong" };
    });
  } else {
    knockoutPicks.semis = (knockoutPicks.semis || []).map((pick) => ({ ...pick, points: null, status: "pending" }));
  }

  // knockoutPicks.final: comparar contra admin.final
  if (isRoundConfigured("final", adminResults)) {
    const adminF = new Set(adminResults.knockoutRounds.final.filter(Boolean));
    const seen = new Set<string>();
    knockoutPicks.final = (knockoutPicks.final || []).map((pick) => {
      const dup = seen.has(pick.country); seen.add(pick.country);
      const correct = !dup && adminF.has(pick.country);
      return { ...pick, points: correct ? (ptsByKey["final"] ?? 25) : 0, status: correct ? "correct" : "wrong" };
    });
  } else {
    knockoutPicks.final = (knockoutPicks.final || []).map((pick) => ({ ...pick, points: null, status: "pending" }));
  }

  return { points, knockoutPicks };
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
