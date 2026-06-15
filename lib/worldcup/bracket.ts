import { WORLD_CUP_MATCHES, type MatchStage, type WorldCupMatch } from "@/lib/worldcup/schedule";
import { resolveKnockoutMatchTeams } from "@/lib/worldcup/resolve-knockout";
import type { AdminResults, KnockoutRoundKey } from "@/lib/admin-results";
import type { KnockoutPick, Team } from "@/lib/data";

// ════════════════════════════════════════════════════════════
// Estructura del cuadro de fase final (bracket) y utilidades para
// responder: "al pinchar una selección/partido, ¿qué porras la tienen
// avanzando a la siguiente ronda?".
//
// Modelo de la app (ver lib/scoring.ts):
//   knockoutPicks[roundKey] = equipos que el usuario cree que AVANZAN
//   DESDE esa ronda a la siguiente. Es decir:
//     - knockoutPicks.dieciseisavos → "creo que estos 16 pasan a OCTAVOS"
//     - knockoutPicks.octavos       → "creo que estos 8 pasan a CUARTOS"
//     - knockoutPicks.cuartos       → "...4 a SEMIS"
//     - knockoutPicks.semis         → "...2 a la FINAL"
//
// Por tanto, para un partido de una fase dada, "quién tiene a X en la
// siguiente ronda" = qué porras incluyen X en knockoutPicks[clave de ESA
// fase]. Mapa fase del partido → clave de pick:
// ════════════════════════════════════════════════════════════

export const STAGE_TO_PICK_ROUND: Partial<Record<MatchStage, KnockoutRoundKey>> = {
  "round-of-32": "dieciseisavos",
  "round-of-16": "octavos",
  "quarter-final": "cuartos",
  "semi-final": "semis",
  // La final no tiene "siguiente ronda"; el campeón se gestiona en el podio.
};

export const STAGE_NEXT_LABEL: Partial<Record<MatchStage, string>> = {
  "round-of-32": "Octavos",
  "round-of-16": "Cuartos",
  "quarter-final": "Semifinales",
  "semi-final": "Final",
};

export interface BracketMatch {
  id: number;
  stage: MatchStage;
  roundLabel: string;
  hostCity: string;
  homeTeam: string; // resuelto si se conoce, si no el placeholder
  awayTeam: string;
  homeIsPlaceholder: boolean;
  awayIsPlaceholder: boolean;
  statusShort: string;
  score: { home: number | null; away: number | null };
  kickoff: string | null;
}

// Columnas del bracket en orden de presentación (de 32avos a final).
export const BRACKET_COLUMNS: { stage: MatchStage; label: string }[] = [
  { stage: "round-of-32", label: "Ronda de 32" },
  { stage: "round-of-16", label: "Octavos" },
  { stage: "quarter-final", label: "Cuartos" },
  { stage: "semi-final", label: "Semifinales" },
  { stage: "final", label: "Final" },
];

const PLACEHOLDER_RE = /^(Ganador|Perdedor|1\.º|2\.º|Mejor|TBD)/i;

export function isPlaceholderTeam(name: string): boolean {
  return !name || PLACEHOLDER_RE.test(name.trim());
}

interface MatchResultLike {
  statusShort?: string;
  score?: { home: number | null; away: number | null };
}

/**
 * Construye las columnas del bracket con los equipos resueltos (cuando ya se
 * conocen vía admin) y el marcador/estado de cada partido si está disponible.
 */
export function buildBracket(
  admin: AdminResults,
  resultByMatchId: Map<number, MatchResultLike>,
  kickoffByMatchId?: Map<number, string>
): { stage: MatchStage; label: string; matches: BracketMatch[] }[] {
  const knockout = WORLD_CUP_MATCHES.filter((m) => m.stage !== "group");
  const byStage = new Map<MatchStage, WorldCupMatch[]>();
  for (const m of knockout) {
    const list = byStage.get(m.stage) || [];
    list.push(m);
    byStage.set(m.stage, list);
  }

  return BRACKET_COLUMNS.filter((c) => c.stage !== "final" || byStage.has("final"))
    .map((col) => {
      const matches = (byStage.get(col.stage) || [])
        .sort((a, b) => a.id - b.id)
        .map((m): BracketMatch => {
          const resolved = resolveKnockoutMatchTeams(m, admin);
          const result = resultByMatchId.get(m.id);
          return {
            id: m.id,
            stage: m.stage,
            roundLabel: m.roundLabel,
            hostCity: m.hostCity,
            homeTeam: resolved.homeTeam,
            awayTeam: resolved.awayTeam,
            homeIsPlaceholder: isPlaceholderTeam(resolved.homeTeam),
            awayIsPlaceholder: isPlaceholderTeam(resolved.awayTeam),
            statusShort: result?.statusShort || "NS",
            score: result?.score || { home: null, away: null },
            kickoff: kickoffByMatchId?.get(m.id) || null,
          };
        });
      return { stage: col.stage, label: col.label, matches };
    });
}

export interface PoolAdvancement {
  teamId: string;
  teamName: string;
  username: string;
  /** true si esta porra incluyó a la selección en la ronda consultada */
  picked: boolean;
}

/**
 * Para una selección y la fase de un partido, devuelve por cada porra si la
 * tiene avanzando a la SIGUIENTE ronda (es decir, si la incluyó en
 * knockoutPicks[clave-de-esa-fase]). Devuelve null si la fase no tiene
 * "siguiente ronda" (final) o el equipo es aún un placeholder.
 */
export function poolsAdvancingTeam(
  participants: Team[],
  team: string,
  stage: MatchStage
): { pickRound: KnockoutRoundKey; nextLabel: string; pools: PoolAdvancement[] } | null {
  if (isPlaceholderTeam(team)) return null;
  const pickRound = STAGE_TO_PICK_ROUND[stage];
  const nextLabel = STAGE_NEXT_LABEL[stage];
  if (!pickRound || !nextLabel) return null;

  const norm = (s: string) => s.trim().toLowerCase();
  const target = norm(team);

  const pools: PoolAdvancement[] = participants.map((p) => {
    const picks: KnockoutPick[] = p.knockoutPicks?.[pickRound] || [];
    const picked = picks.some((pick) => norm(pick.country) === target);
    return { teamId: p.id, teamName: p.name, username: p.username, picked };
  });

  return { pickRound, nextLabel, pools };
}
