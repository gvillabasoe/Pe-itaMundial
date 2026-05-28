/**
 * Cálculo de completitud de una porra (Task 3 — barra de progreso en Admin).
 *
 * Es de SOLO LECTURA: no modifica datos ni puntuaciones. Mide cuántos picks ha
 * rellenado una porra sobre el total posible, repartido en dos grupos para el
 * desglose que pide el panel:
 *
 *   • Partidos  = 72 marcadores de fase de grupos + 32 clasificados de fase
 *                 final (dieciseisavos 16 + octavos 8 + cuartos 4 + semis 2 +
 *                 final 2) = 104.
 *   • Especiales = 10 picks especiales + 3 del podio (campeón, subcampeón,
 *                 tercero) = 13.
 *
 * Un pick cuenta como completado si tiene un valor real guardado: marcador con
 * ambos números, país/jugador no vacío, o minuto del primer gol > 0.
 */
import { FIXTURES, GROUPS, KNOCKOUT_ROUND_DEFS, type SpecialPicks, type Team } from "@/lib/data";

const GROUP_MATCH_IDS = FIXTURES.filter((f) => f.stage === "groups").map((f) => f.id);
const GROUP_MATCH_TOTAL = GROUP_MATCH_IDS.length; // 72
const KNOCKOUT_PICK_TOTAL = KNOCKOUT_ROUND_DEFS.reduce((sum, round) => sum + round.count, 0); // 32

export const PARTIDOS_TOTAL = GROUP_MATCH_TOTAL + KNOCKOUT_PICK_TOTAL; // 104

const SPECIAL_KEYS: (keyof SpecialPicks)[] = [
  "mejorJugador", "mejorJoven", "maxGoleador", "maxAsistente", "mejorPortero",
  "maxGoleadorEsp", "primerGolEsp", "revelacion", "decepcion", "minutoPrimerGol",
];
const PODIUM_TOTAL = 3; // campeón, subcampeón, tercero
export const ESPECIALES_TOTAL = SPECIAL_KEYS.length + PODIUM_TOTAL; // 13

export interface PorraCompleteness {
  partidosDone: number;
  partidosTotal: number;
  groupMatchesDone: number;
  groupMatchesTotal: number;
  knockoutDone: number;
  knockoutTotal: number;
  especialesDone: number;
  especialesTotal: number;
  totalDone: number;
  totalTotal: number;
  percent: number; // 0-100
}

function isFilledText(value: unknown): boolean {
  return String(value ?? "").trim() !== "";
}

function isSpecialDone(key: keyof SpecialPicks, specials: SpecialPicks): boolean {
  if (key === "minutoPrimerGol") {
    return typeof specials.minutoPrimerGol === "number" && specials.minutoPrimerGol > 0;
  }
  return isFilledText(specials[key]);
}

export function computePorraCompleteness(team: Team): PorraCompleteness {
  // ── Partidos: marcadores de grupos ──
  let groupMatchesDone = 0;
  for (const id of GROUP_MATCH_IDS) {
    const pick = team.matchPicks?.[id];
    if (pick && typeof pick.home === "number" && typeof pick.away === "number") groupMatchesDone += 1;
  }

  // ── Partidos: clasificados de fase final ──
  let knockoutDone = 0;
  for (const round of KNOCKOUT_ROUND_DEFS) {
    const picks = team.knockoutPicks?.[round.key] || [];
    for (let i = 0; i < round.count; i += 1) {
      if (isFilledText(picks[i]?.country)) knockoutDone += 1;
    }
  }

  // ── Especiales + podio ──
  let especialesDone = 0;
  for (const key of SPECIAL_KEYS) {
    if (team.specials && isSpecialDone(key, team.specials)) especialesDone += 1;
  }
  if (isFilledText(team.championPick)) especialesDone += 1;
  if (isFilledText(team.runnerUpPick)) especialesDone += 1;
  if (isFilledText(team.thirdPlacePick)) especialesDone += 1;

  const partidosDone = groupMatchesDone + knockoutDone;
  const totalDone = partidosDone + especialesDone;
  const totalTotal = PARTIDOS_TOTAL + ESPECIALES_TOTAL;
  const percent = totalTotal > 0 ? Math.round((totalDone / totalTotal) * 100) : 0;

  return {
    partidosDone,
    partidosTotal: PARTIDOS_TOTAL,
    groupMatchesDone,
    groupMatchesTotal: GROUP_MATCH_TOTAL,
    knockoutDone,
    knockoutTotal: KNOCKOUT_PICK_TOTAL,
    especialesDone,
    especialesTotal: ESPECIALES_TOTAL,
    totalDone,
    totalTotal,
    percent,
  };
}
