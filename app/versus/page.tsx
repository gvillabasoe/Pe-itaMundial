"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { CountryWithFlag, EmptyState, Flag, GroupBadge, PickChip } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import {
  FIXTURES,
  GROUPS,
  KNOCKOUT_ROUND_DEFS,
  compareSpecials,
  computeConsensusSpecials,
  computeVersusStats,
  type Team,
} from "@/lib/data";
import { KNOCKOUT_ADMIN_COUNTS } from "@/lib/admin-results";
import { getSpecialsBreakdown, scoreMatchPickAgainstAdmin, type MatchPickPointStatus } from "@/lib/scoring";
import { useScoredParticipants } from "@/lib/use-scored-participants";

// ════════════════════════════════════════════════════════════
// HELPERS DE CONSENSO
// Para el modo "General", comparamos cada pick del usuario
// contra el pick más repetido entre todos los participantes.
// Para puntos/distancias usamos el valor medio.
// ════════════════════════════════════════════════════════════

/** Moda (valor más repetido). Si hay empate devuelve el primero encontrado. */
function mode(values: string[]): string {
  if (!values.length) return "";
  const freq: Record<string, number> = {};
  values.forEach((v) => { if (v) freq[v] = (freq[v] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

/** Consenso de posiciones de grupo: pick más repetido en cada posición */
function computeConsensusGroupOrder(teams: Team[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const group of Object.keys(GROUPS)) {
    const byPos: string[][] = [[], [], [], []];
    teams.forEach((t) => {
      const picks = t.groupOrderPicks?.[group] || [];
      picks.forEach((country, idx) => {
        if (country && idx < 4) byPos[idx].push(country);
      });
    });
    result[group] = byPos.map((pos) => mode(pos));
  }
  return result;
}

/** Reconstruye los 32 participantes de dieciseisavos a partir de los picks de grupo:
 *  1.º + 2.º de cada uno de los 12 grupos (24) + mejores 3.º elegidos (8) = 32. */
function reconstructRound32Participants(team: Team): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const group of Object.keys(GROUPS)) {
    const picks = team.groupOrderPicks?.[group] || [];
    [0, 1].forEach((i) => {
      if (picks[i] && !seen.has(picks[i])) {
        result.push(picks[i]);
        seen.add(picks[i]);
      }
    });
  }
  for (const group of (team.bestThirdGroups || [])) {
    const picks = team.groupOrderPicks?.[group] || [];
    if (picks[2] && !seen.has(picks[2])) {
      result.push(picks[2]);
      seen.add(picks[2]);
    }
  }
  return result;
}

/** Devuelve los picks "para una ronda" según el modelo shift:
 *   dieciseisavos → reconstructed 32 (de groupOrderPicks + bestThirdGroups)
 *   octavos       → knockoutPicks.dieciseisavos (16)
 *   cuartos       → knockoutPicks.octavos (8)
 *   semis         → knockoutPicks.cuartos (4)
 *   final         → knockoutPicks.semis (2) */
function getRoundParticipants(team: Team, roundKey: string): string[] {
  if (roundKey === "dieciseisavos") return reconstructRound32Participants(team);
  const sourceMap: Record<string, string> = {
    octavos: "dieciseisavos",
    cuartos: "octavos",
    semis: "cuartos",
    final: "semis",
  };
  const sourceKey = sourceMap[roundKey];
  if (!sourceKey) return [];
  return (team.knockoutPicks?.[sourceKey as never] || []).map((p) => p.country).filter(Boolean);
}

/** Consenso de eliminatorias: los N equipos más repetidos por ronda.
 *  Usa el modelo shift — para dieciseisavos toma los 32 reconstruidos de cada
 *  participante; para octavos toma sus 16 advance picks de dieciseisavos; etc. */
function computeConsensusKnockouts(teams: Team[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const round of KNOCKOUT_ROUND_DEFS) {
    const freq: Record<string, number> = {};
    teams.forEach((t) => {
      getRoundParticipants(t, round.key).forEach((country) => {
        if (country) freq[country] = (freq[country] || 0) + 1;
      });
    });
    const adminCount = KNOCKOUT_ADMIN_COUNTS[round.key as keyof typeof KNOCKOUT_ADMIN_COUNTS] ?? round.count;
    result[round.key] = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, adminCount)
      .map(([team]) => team);
  }
  return result;
}

/** Consenso del campeón: el más elegido */
function consensusChampion(teams: Team[]): string {
  return mode(teams.map((t) => t.championPick).filter(Boolean));
}

// ── Partido doble (doble puntuación) ────────────────────────────────────────
// Cada porra elige 1 partido doble por grupo (team.doubleMatches[group] = fixtureId).

/** Para cada grupo, el fixtureId de partido doble MÁS elegido entre todas las
 *  porras, con cuántas porras lo eligieron y cuántas votaron en total. */
function computeConsensusDoubles(
  teams: Team[]
): Record<string, { fixtureId: string; count: number; voters: number }> {
  const result: Record<string, { fixtureId: string; count: number; voters: number }> = {};
  for (const group of Object.keys(GROUPS)) {
    const freq: Record<string, number> = {};
    let voters = 0;
    teams.forEach((t) => {
      const fid = t.doubleMatches?.[group];
      if (fid) { freq[fid] = (freq[fid] || 0) + 1; voters += 1; }
    });
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    result[group] = top
      ? { fixtureId: top[0], count: top[1], voters }
      : { fixtureId: "", count: 0, voters };
  }
  return result;
}

/** Entre las porras que eligieron `fixtureId` como su partido doble, devuelve
 *  el marcador más repetido para ese partido y cuántas lo predijeron así. */
function consensusScoreAmongDoublers(
  teams: Team[],
  fixtureId: string
): { score: { home: number; away: number } | null; count: number; doublers: number } {
  if (!fixtureId) return { score: null, count: 0, doublers: 0 };
  const freq: Record<string, number> = {};
  let doublers = 0;
  teams.forEach((t) => {
    // ¿Esta porra marcó este fixture como doble (en cualquier grupo)?
    const isDoubler = Object.values(t.doubleMatches || {}).includes(fixtureId);
    if (!isDoubler) return;
    doublers += 1;
    const pick = t.matchPicks?.[fixtureId];
    if (pick && typeof pick.home === "number" && typeof pick.away === "number") {
      freq[`${pick.home}-${pick.away}`] = (freq[`${pick.home}-${pick.away}`] || 0) + 1;
    }
  });
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  if (!top) return { score: null, count: 0, doublers };
  const [h, a] = top[0].split("-").map(Number);
  return { score: { home: h, away: a }, count: top[1], doublers };
}

/** Nombre corto de un fixture de grupos: "México - Sudáfrica" */
function fixtureLabel(fixtureId: string): string {
  const f = FIXTURES.find((x) => x.id === fixtureId);
  return f ? `${f.homeTeam} - ${f.awayTeam}` : "—";
}

/** Consenso de picks de partidos: marcador más repetido por fixture */
function computeConsensusMatchPicks(teams: Team[]): Record<string, { home: number | null; away: number | null }> {
  const result: Record<string, { home: number | null; away: number | null }> = {};
  for (const fixture of FIXTURES) {
    const scores: string[] = [];
    teams.forEach((t) => {
      const pick = t.matchPicks?.[fixture.id];
      if (pick && typeof pick.home === "number" && typeof pick.away === "number") {
        scores.push(`${pick.home}-${pick.away}`);
      }
    });
    if (!scores.length) {
      result[fixture.id] = { home: null, away: null };
      continue;
    }
    const freq: Record<string, number> = {};
    scores.forEach((s) => { freq[s] = (freq[s] || 0) + 1; });
    const [topScore] = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const [h, a] = topScore[0].split("-").map(Number);
    result[fixture.id] = { home: h, away: a };
  }
  return result;
}

// ════════════════════════════════════════════════════════════
// PÁGINA
// ════════════════════════════════════════════════════════════

// Fixtures de grupos agrupados por letra de grupo (orden A→L), para la pestaña
// "Partidos" del Versus. Cada grupo tiene sus 6 partidos en orden de fixture.
const FIXTURES_BY_GROUP: Array<{ group: string; fixtures: typeof FIXTURES }> = Object.keys(GROUPS).map(
  (group) => ({ group, fixtures: FIXTURES.filter((f) => f.group === group) })
);

/** Formatea un marcador previsto "h - a" o "—" si está incompleto. */
function formatScorePick(pick: { home: number | null; away: number | null } | null | undefined): string {
  if (!pick || typeof pick.home !== "number" || typeof pick.away !== "number") return "—";
  return `${pick.home} - ${pick.away}`;
}

export default function VersusPage() {
  const { user } = useAuth();
  const { participants, adminResults } = useScoredParticipants();
  const [mode, setMode] = useState<"general" | "participante">("general");
  const [rivalId, setRivalId] = useState("");
  const [vsTab, setVsTab] = useState("resumen");
  const [vsFilter, setVsFilter] = useState("all");
  const [baseTeamIdx, setBaseTeamIdx] = useState(0);

  // ────────────────────────────────────────────────────────────────────
  // ⚠️ TODOS los hooks deben llamarse SIEMPRE en el mismo orden y la
  // misma cantidad en cada render. Por eso TODOS los useMemo van ANTES
  // del `if (!user) return …`. Cada hook gestiona internamente el caso
  // `user === null` devolviendo un valor seguro.
  // ────────────────────────────────────────────────────────────────────

  // Variables derivadas (no son hooks, pero con guard de user para no
  // romper si user es null durante el primer render tras un recargo).
  const userTeams = user
    ? participants.filter((p) => p.userId === user.id || p.username === user.username)
    : [];
  const baseTeam = userTeams[baseTeamIdx] || userTeams[0];
  const otherTeams = user
    ? participants.filter((p) => p.userId !== user.id && p.username !== user.username)
    : [];
  const rival = mode === "participante" ? (otherTeams.find((p) => p.id === rivalId) || null) : null;

  // ── Consensus computations ──────────────────────────────────────────────
  const consensusSpecials = useMemo(() => computeConsensusSpecials(participants), [participants]);
  const consensusGroupOrder = useMemo(() => computeConsensusGroupOrder(participants), [participants]);
  const consensusKnockouts = useMemo(() => computeConsensusKnockouts(participants), [participants]);
  const consensusChamp = useMemo(() => consensusChampion(participants), [participants]);
  const consensusMatchPicks = useMemo(() => computeConsensusMatchPicks(participants), [participants]);
  const consensusDoubles = useMemo(() => computeConsensusDoubles(participants), [participants]);

  // ── Puntos de referencia: media en modo general, equipo rival en participante ──
  const consensusPoints = useMemo(() => {
    const n = Math.max(participants.length, 1);
    return {
      name: "Consenso",
      username: "General",
      totalPoints: Math.round(participants.reduce((s, p) => s + p.totalPoints, 0) / n),
      groupPoints: Math.round(participants.reduce((s, p) => s + p.groupPoints, 0) / n),
      finalPhasePoints: Math.round(participants.reduce((s, p) => s + p.finalPhasePoints, 0) / n),
      specialPoints: Math.round(participants.reduce((s, p) => s + p.specialPoints, 0) / n),
    };
  }, [participants]);

  const referenceTeam = mode === "general" ? consensusPoints : rival;
  const referenceName = mode === "general" ? "Consenso" : rival?.name || "—";

  // ── Stats generales de coincidencia ────────────────────────────────────
  const stats = useMemo(() => {
    if (!baseTeam) return { same: 0, diff: 0, total: 0, equalPct: 0 };
    if (mode === "participante" && rival) return computeVersusStats(baseTeam, rival);

    // General: comparar contra consenso de picks
    let same = 0;
    let total = 0;

    // Partidos de grupo
    for (const fixture of FIXTURES) {
      const myPick = baseTeam.matchPicks?.[fixture.id];
      const consPick = consensusMatchPicks[fixture.id];
      if (myPick && typeof myPick.home === "number" && consPick?.home != null) {
        total++;
        if (myPick.home === consPick.home && myPick.away === consPick.away) same++;
      }
    }

    // Posiciones de grupo
    for (const group of Object.keys(GROUPS)) {
      const myOrder = baseTeam.groupOrderPicks?.[group] || [];
      const consOrder = consensusGroupOrder[group] || [];
      for (let i = 0; i < 4; i++) {
        if (myOrder[i] && consOrder[i]) {
          total++;
          if (myOrder[i] === consOrder[i]) same++;
        }
      }
    }

    // Picks de eliminatorias (comparar set de equipos por ronda usando shift)
    for (const round of KNOCKOUT_ROUND_DEFS) {
      const myPicks = new Set(getRoundParticipants(baseTeam, round.key));
      const consPicks = new Set(consensusKnockouts[round.key] || []);
      const union = new Set([...myPicks, ...consPicks]);
      union.forEach((t) => {
        if (t) {
          total++;
          if (myPicks.has(t) && consPicks.has(t)) same++;
        }
      });
    }

    const diff = total - same;
    return { same, diff, total, equalPct: total > 0 ? Math.round((same / total) * 100) : 0 };
  }, [baseTeam, mode, rival, consensusMatchPicks, consensusGroupOrder, consensusKnockouts]);

  const pointDelta = baseTeam && referenceTeam ? baseTeam.totalPoints - referenceTeam.totalPoints : 0;

  const specialsComparison = useMemo(() => {
    if (!baseTeam) return [];
    return compareSpecials(baseTeam, mode === "participante" ? rival : null, consensusSpecials);
  }, [baseTeam, consensusSpecials, mode, rival]);

  const filteredSpecials = useMemo(() => {
    if (vsFilter === "diff") return specialsComparison.filter((item) => !item.same);
    if (vsFilter === "same") return specialsComparison.filter((item) => item.same);
    return specialsComparison;
  }, [specialsComparison, vsFilter]);

  // Desglose de puntos por especial (Task 2). El consenso no es una porra real,
  // así que solo se muestran puntos del rival cuando estamos en modo participante.
  const baseSpecialPoints = useMemo(() => {
    const map = new Map<string, { status: "correct" | "wrong" | "pending"; points: number }>();
    if (baseTeam) getSpecialsBreakdown(baseTeam, adminResults).forEach((s) => map.set(s.key, { status: s.status, points: s.points }));
    return map;
  }, [baseTeam, adminResults]);
  const rivalSpecialPoints = useMemo(() => {
    const map = new Map<string, { status: "correct" | "wrong" | "pending"; points: number }>();
    if (mode === "participante" && rival) getSpecialsBreakdown(rival, adminResults).forEach((s) => map.set(s.key, { status: s.status, points: s.points }));
    return map;
  }, [mode, rival, adminResults]);

  // ── Early return: SOLO después de declarar todos los hooks ─────────────
  if (!user) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="card max-w-[320px] text-center !p-8 animate-fade-in">
          <Lock size={36} className="mx-auto mb-3 text-accent-versus" />
          <h2 className="mb-1 font-display text-xl font-extrabold text-text-warm">Acceso restringido</h2>
          <p className="mb-4 text-sm text-text-muted">Inicia sesión para acceder a Versus</p>
          <Link href="/mi-club" className="btn no-underline" style={{ background: "#F0417A", color: "white" }}>Entrar a Mi Club</Link>
        </div>
      </div>
    );
  }

  // ── Variables NO-hook (puras derivaciones) ─────────────────────────────
  const sections = baseTeam && referenceTeam ? [
    { label: "Fase de grupos", baseValue: baseTeam.groupPoints, referenceValue: referenceTeam.groupPoints },
    { label: "Eliminatorias", baseValue: baseTeam.finalPhasePoints, referenceValue: referenceTeam.finalPhasePoints },
    { label: "Especiales", baseValue: baseTeam.specialPoints, referenceValue: referenceTeam.specialPoints },
  ] : [];

  const biggestDiff = sections.length > 0
    ? sections.reduce((max, s) => Math.abs(s.baseValue - s.referenceValue) > Math.abs(max.baseValue - max.referenceValue) ? s : max).label
    : "—";

  const accentStyle = (active: boolean) =>
    active ? { background: "rgba(240,65,122,0.15)", color: "#F0417A", borderColor: "#F0417A" } : {};
  const tabs = ["Resumen", "Partidos", "Dobles", "Grupos", "Eliminatorias", "Especiales"];

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-4">
      <div className="animate-fade-in mb-4">
        <h1 className="font-display text-2xl font-extrabold text-text-warm">Versus</h1>
      </div>

      {userTeams.length > 1 ? (
        <div className="mb-2.5">
          <label className="mb-1 block text-[11px] text-text-muted">Tu equipo base</label>
          <div className="flex gap-1.5 overflow-x-auto">
            {userTeams.map((team, index) => (
              <button key={team.id} className="pill" style={accentStyle(baseTeamIdx === index)}
                onClick={() => setBaseTeamIdx(index)}>
                {team.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {baseTeam ? (
        <div className="card mb-3 flex items-center gap-3 animate-fade-in" style={{ borderLeft: "3px solid #F0417A" }}>
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-warm">{baseTeam.name}</p>
            <p className="text-[11px] text-text-muted">@{user.username} · #{baseTeam.currentRank}</p>
          </div>
          <span className="font-display text-xl font-extrabold text-accent-versus">{baseTeam.totalPoints}</span>
        </div>
      ) : null}

      <div className="mb-3 flex gap-1.5">
        <button className="pill" style={accentStyle(mode === "general")} onClick={() => setMode("general")}>General</button>
        <button className="pill" style={accentStyle(mode === "participante")} onClick={() => setMode("participante")}>Participante</button>
      </div>

      {mode === "participante" ? (
        <div className="mb-3">
          <label className="mb-1 block text-[11px] text-text-muted">Rival</label>
          <select className="input-field cursor-pointer" value={rivalId}
            onChange={(e) => setRivalId(e.target.value)}>
            <option value="">Seleccionar rival...</option>
            {otherTeams.map((team) => (
              <option key={team.id} value={team.id}>{team.name} (@{team.username})</option>
            ))}
          </select>
        </div>
      ) : null}

      {referenceTeam && baseTeam ? (
        <div className="card mb-3 animate-fade-in bg-gradient-to-br from-bg-4 to-[rgba(240,65,122,0.03)]"
          style={{ border: "1px solid rgba(240,65,122,0.12)" }}>
          <p className="mb-2.5 font-display text-sm font-bold text-text-warm">Resumen vs {referenceName}</p>
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="% iguales" value={`${stats.equalPct}%`} color="#F0417A" />
            <StatBox label="Picks distintos" value={String(stats.diff)} />
            <StatBox
              label="Diferencia de puntos"
              value={`${pointDelta >= 0 ? "+" : ""}${pointDelta}`}
              color={pointDelta >= 0 ? "#27E6AC" : "#FF7AA5"}
            />
            <StatBox label="Mayor diferencia" value={biggestDiff} />
          </div>
          {mode === "general" && (
            <p className="mt-2.5 text-[10px] text-text-muted text-center">
              Consenso = pick o puntuación más frecuente/media entre todos los participantes
            </p>
          )}
        </div>
      ) : null}

      <div className="mb-2.5 flex gap-0.5 overflow-x-auto rounded-[10px] bg-bg-3 p-[3px]">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`whitespace-nowrap rounded-lg border-none px-3.5 py-2 text-xs font-medium transition-all ${vsTab === tab.toLowerCase() ? "bg-bg-5 text-text-primary" : "bg-transparent text-text-muted"}`}
            onClick={() => setVsTab(tab.toLowerCase())}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mb-3.5 flex gap-1.5">
        {[
          { key: "all", label: "Ver todo" },
          { key: "diff", label: "Solo diferencias" },
          { key: "same", label: "Solo coincidencias" },
        ].map((item) => (
          <button key={item.key} className="pill" style={accentStyle(vsFilter === item.key)}
            onClick={() => setVsFilter(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      {/* ── TAB: RESUMEN ── */}
      {vsTab === "resumen" && referenceTeam && baseTeam ? (
        <div className="flex flex-col gap-1.5 animate-fade-in">
          {sections.map((section) => {
            const delta = section.baseValue - section.referenceValue;
            return (
              <div key={section.label} className="card !px-3.5 !py-3">
                <p className="mb-1.5 text-[11px] text-text-muted">{section.label}</p>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-[10px] text-text-muted">{baseTeam.name}</p>
                    <p className="font-display text-lg font-extrabold">{section.baseValue}</p>
                  </div>
                  <span className="rounded-md px-2.5 py-0.5 font-display text-sm font-bold"
                    style={{
                      background: delta > 0 ? "#042B22" : delta < 0 ? "#2C0714" : "#07090D",
                      color: delta > 0 ? "#27E6AC" : delta < 0 ? "#FF7AA5" : "#98A3B8",
                    }}>
                    {delta > 0 ? "+" : ""}{delta}
                  </span>
                  <div className="text-center">
                    <p className="text-[10px] text-text-muted">{referenceName}</p>
                    <p className="font-display text-lg font-extrabold">{section.referenceValue}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ── TAB: PARTIDOS ──
          Marcadores previstos de fase de grupos con los puntos obtenidos por
          cada porra en cada partido (verde = exacto, ámbar = signo, rojo =
          fallo, neutro = sin jugar). Izquierda = tu porra, derecha = rival/consenso.
      */}
      {vsTab === "partidos" && baseTeam ? (
        <div className="flex flex-col gap-2.5 animate-fade-in">
          <p className="text-[10px] text-text-muted text-center -mt-1">
            Puntos por partido · <span className="text-success font-semibold">exacto</span> ·{" "}
            <span className="text-amber font-semibold">signo</span> ·{" "}
            <span className="text-danger font-semibold">fallo</span> · — sin jugar
          </p>
          {FIXTURES_BY_GROUP.map(({ group, fixtures }) => {
            const rows = fixtures.map((fixture) => {
              const basePick = baseTeam.matchPicks?.[fixture.id];
              const refPick = mode === "participante" && rival
                ? rival.matchPicks?.[fixture.id]
                : consensusMatchPicks[fixture.id];

              // Estado/puntos: la porra base y el rival ya vienen puntuados; el
              // consenso se puntúa al vuelo (sin bonus de partido doble).
              const baseScore = { points: basePick?.points ?? null, status: (basePick?.status ?? "pending") as MatchPickPointStatus };
              const refScore = mode === "participante" && rival
                ? { points: (refPick as typeof basePick)?.points ?? null, status: ((refPick as typeof basePick)?.status ?? "pending") as MatchPickPointStatus }
                : scoreMatchPickAgainstAdmin(fixture.id, refPick as { home: number | null; away: number | null } | undefined, false, adminResults);

              const baseText = formatScorePick(basePick);
              const refText = formatScorePick(refPick as { home: number | null; away: number | null } | undefined);
              const same = baseText !== "—" && baseText === refText;
              if (vsFilter === "diff" && same) return null;
              if (vsFilter === "same" && !same) return null;
              return { fixture, baseText, refText, baseScore, refScore, same };
            }).filter(Boolean) as Array<{
              fixture: typeof FIXTURES[number];
              baseText: string; refText: string;
              baseScore: { points: number | null; status: MatchPickPointStatus };
              refScore: { points: number | null; status: MatchPickPointStatus };
              same: boolean;
            }>;

            if (!rows.length) return null;

            return (
              <div key={group} className="card !p-3">
                <div className="mb-2 flex items-center justify-between">
                  <GroupBadge group={group} />
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-2 text-[9px] font-semibold uppercase tracking-wide text-text-muted" style={{ width: "62%" }}>
                    <span className="text-center text-accent-versus">Tú</span>
                    <span className="w-4" />
                    <span className="text-center">{referenceName}</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  {rows.map((row) => (
                    <div key={row.fixture.id}
                      className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-[rgb(var(--divider)/0.5)] py-2 first:border-0">
                      {/* Tu porra */}
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="font-display text-xs font-bold tabular-nums text-text-primary">{row.baseText}</span>
                        <PickChip status={row.baseScore.status} points={row.baseScore.points} />
                      </div>
                      {/* Partido */}
                      <div className="flex flex-col items-center gap-0.5 px-1">
                        <div className="flex items-center gap-1">
                          <Flag country={row.fixture.homeTeam} size="sm" />
                          <span className="text-[9px] text-text-faint">vs</span>
                          <Flag country={row.fixture.awayTeam} size="sm" />
                        </div>
                      </div>
                      {/* Rival / consenso */}
                      <div className="flex items-center justify-start gap-1.5">
                        <PickChip status={row.refScore.status} points={row.refScore.points} />
                        <span className="font-display text-xs font-bold tabular-nums text-text-secondary">{row.refText}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {FIXTURES_BY_GROUP.every(({ fixtures }) =>
            fixtures.every((fixture) => {
              const b = formatScorePick(baseTeam.matchPicks?.[fixture.id]);
              const rPick = mode === "participante" && rival ? rival.matchPicks?.[fixture.id] : consensusMatchPicks[fixture.id];
              const r = formatScorePick(rPick as { home: number | null; away: number | null } | undefined);
              const same = b !== "—" && b === r;
              return vsFilter === "diff" ? same : vsFilter === "same" ? !same : false;
            })
          ) ? (
            <EmptyState text={vsFilter === "same" ? "No hay coincidencias en partidos" : "No hay diferencias en partidos"} />
          ) : null}
        </div>
      ) : null}

      {/* ── TAB: DOBLES ──
          Partido doble (doble puntuación) elegido por cada porra en cada grupo.
          Compara tu doble con el del rival/consenso y muestra, dentro de los que
          eligieron ese mismo partido como doble, el marcador más repetido.
      */}
      {vsTab === "dobles" && baseTeam ? (
        <div className="flex flex-col gap-2.5 animate-fade-in">
          <p className="-mt-1 text-center text-[10px] text-text-muted">
            Cada porra marca 1 partido doble por grupo. Comparativa: tu doble vs{" "}
            {mode === "participante" ? "el del rival" : "el más elegido (consenso)"}.
          </p>
          {Object.keys(GROUPS).map((group) => {
            const baseDoubleId = baseTeam.doubleMatches?.[group] || "";
            // Referencia: doble del rival, o el doble más elegido (consenso) del grupo.
            const refDoubleId = mode === "participante" && rival
              ? (rival.doubleMatches?.[group] || "")
              : (consensusDoubles[group]?.fixtureId || "");

            const same = Boolean(baseDoubleId && refDoubleId && baseDoubleId === refDoubleId);
            if (vsFilter === "diff" && same) return null;
            if (vsFilter === "same" && !same) return null;

            const consInfo = consensusDoubles[group];

            // Marcador más elegido entre quienes doblan TU partido y, si difiere,
            // entre quienes doblan el de la referencia.
            const baseDoubleScore = consensusScoreAmongDoublers(participants, baseDoubleId);
            const refDoubleScore = consensusScoreAmongDoublers(participants, refDoubleId);

            // Puntos de tu pick en tu partido doble (ya calculados, con bonus doble).
            const basePick = baseDoubleId ? baseTeam.matchPicks?.[baseDoubleId] : null;
            const baseStatus = (basePick?.status ?? "pending") as MatchPickPointStatus;

            return (
              <div key={group} className="card !p-3.5">
                <div className="mb-2.5 flex items-center justify-between">
                  <GroupBadge group={group} />
                  <span className={`text-[10px] font-bold ${same ? "text-success" : "text-accent-versus"}`}>
                    {same ? "Mismo doble" : "Doble distinto"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Tu doble */}
                  <div className="rounded-xl p-2.5" style={{ background: "rgba(240,65,122,0.06)", border: "1px solid rgba(240,65,122,0.15)" }}>
                    <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-accent-versus">Tu doble</p>
                    {baseDoubleId ? (
                      <>
                        <p className="text-[11px] font-semibold text-text-warm leading-tight">{fixtureLabel(baseDoubleId)}</p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="font-display text-sm font-extrabold tabular-nums">{formatScorePick(basePick)}</span>
                          <span className="badge badge-gold !px-1.5 !py-0 text-[9px]">×2</span>
                          <PickChip status={baseStatus} points={basePick?.points ?? null} />
                        </div>
                      </>
                    ) : <p className="text-[11px] text-text-muted">—</p>}
                  </div>

                  {/* Doble de referencia */}
                  <div className="rounded-xl p-2.5" style={{ background: "rgb(var(--bg-muted))", border: "1px solid rgb(var(--border-subtle))" }}>
                    <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-text-muted">
                      {mode === "participante" ? `Doble de ${referenceName}` : "Doble más elegido"}
                    </p>
                    {refDoubleId ? (
                      <>
                        <p className="text-[11px] font-semibold text-text-warm leading-tight">{fixtureLabel(refDoubleId)}</p>
                        {mode === "general" && consInfo && consInfo.voters > 0 ? (
                          <p className="mt-1 text-[9px] text-text-muted tabular-nums">
                            {consInfo.count}/{consInfo.voters} porras lo doblan
                          </p>
                        ) : null}
                        {mode === "participante" && rival ? (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="font-display text-sm font-extrabold tabular-nums text-text-secondary">
                              {formatScorePick(rival.matchPicks?.[refDoubleId])}
                            </span>
                            <span className="badge badge-gold !px-1.5 !py-0 text-[9px]">×2</span>
                            <PickChip status={(rival.matchPicks?.[refDoubleId]?.status ?? "pending") as MatchPickPointStatus} points={rival.matchPicks?.[refDoubleId]?.points ?? null} />
                          </div>
                        ) : null}
                      </>
                    ) : <p className="text-[11px] text-text-muted">—</p>}
                  </div>
                </div>

                {/* Resultado más elegido dentro de cada doble */}
                <div className="mt-2.5 flex flex-col gap-1 border-t border-[rgb(var(--divider)/0.5)] pt-2.5">
                  {baseDoubleId && baseDoubleScore.score ? (
                    <p className="text-[10px] text-text-muted">
                      <span className="font-semibold text-text-secondary">{fixtureLabel(baseDoubleId)}:</span>{" "}
                      resultado más elegido entre quienes lo doblan ·{" "}
                      <span className="font-display font-bold text-text-primary tabular-nums">
                        {baseDoubleScore.score.home} - {baseDoubleScore.score.away}
                      </span>{" "}
                      <span className="text-text-faint tabular-nums">({baseDoubleScore.count}/{baseDoubleScore.doublers})</span>
                    </p>
                  ) : null}
                  {refDoubleId && refDoubleId !== baseDoubleId && refDoubleScore.score ? (
                    <p className="text-[10px] text-text-muted">
                      <span className="font-semibold text-text-secondary">{fixtureLabel(refDoubleId)}:</span>{" "}
                      resultado más elegido entre quienes lo doblan ·{" "}
                      <span className="font-display font-bold text-text-primary tabular-nums">
                        {refDoubleScore.score.home} - {refDoubleScore.score.away}
                      </span>{" "}
                      <span className="text-text-faint tabular-nums">({refDoubleScore.count}/{refDoubleScore.doublers})</span>
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ── TAB: GRUPOS ── */}
      {vsTab === "grupos" && baseTeam ? (
        <div className="flex flex-col gap-1.5 animate-fade-in">
          {Object.entries(GROUPS).map(([group]) => {
            const baseOrder = baseTeam.groupOrderPicks?.[group] || [];
            // En general: consenso; en participante: picks del rival
            const referenceOrder = mode === "participante" && rival
              ? (rival.groupOrderPicks?.[group] || [])
              : (consensusGroupOrder[group] || []);

            const rows = baseOrder.map((country, index) => {
              const referenceCountry = referenceOrder[index] || "";
              const same = Boolean(country && referenceCountry && country === referenceCountry);
              if (vsFilter === "diff" && same) return null;
              if (vsFilter === "same" && !same) return null;
              return { position: index + 1, country, referenceCountry, same };
            }).filter(Boolean);

            if (!rows.length) return null;

            return (
              <div key={group} className="card !p-3">
                <GroupBadge group={group} />
                <div className="mt-2">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
                    <p className="text-center text-[10px] font-semibold text-accent-versus">Tu pick</p>
                    <p className="w-5 text-center text-[10px] text-text-muted">Pos.</p>
                    <p className="text-center text-[10px] font-semibold text-text-muted">{referenceName}</p>
                  </div>
                  {(rows as Array<{ position: number; country: string; referenceCountry: string; same: boolean }>).map((row) => (
                    <div key={`${group}-${row.position}`}
                      className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 border-t border-[rgb(var(--divider)/0.06)] py-1">
                      <div className="flex items-center justify-center gap-1">
                        {row.country ? <><Flag country={row.country} size="sm" /><span className="truncate text-[11px]">{row.country}</span></> : <span className="text-[11px] text-text-muted">—</span>}
                      </div>
                      <span className="w-5 text-center text-[11px] font-bold text-text-muted">{row.position}</span>
                      <div className="flex items-center justify-center gap-1">
                        {row.referenceCountry
                          ? <><Flag country={row.referenceCountry} size="sm" /><span className={`truncate text-[11px] ${!row.same ? "text-accent-versus" : ""}`}>{row.referenceCountry}</span></>
                          : <span className="text-[11px] text-text-muted">—</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ── TAB: ELIMINATORIAS ──
          Muestra los picks de TU porra y los compara contra el rival/consenso.
          El número máximo de equipos a mostrar usa KNOCKOUT_ADMIN_COUNTS
          (32/16/8/4) para reflejar todos los participantes en cada ronda.
      */}
      {vsTab === "eliminatorias" && baseTeam ? (
        <div className="flex flex-col gap-3 animate-fade-in">
          {KNOCKOUT_ROUND_DEFS.map((round) => {
            const adminCount = KNOCKOUT_ADMIN_COUNTS[round.key as keyof typeof KNOCKOUT_ADMIN_COUNTS] ?? round.count;
            // ── Modelo shift: para dieciseisavos toma 32 reconstruidos; para
            //    octavos/cuartos/semis/final toma los advance picks de la ronda
            //    anterior. Así comparamos 32/32, 16/16, 8/8, 4/4, 2/2 — no
            //    16/32 ni 8/16 como antes.
            const baseCountries = new Set(getRoundParticipants(baseTeam, round.key));

            // Referencia: picks del rival o consenso
            let refCountries: Set<string>;
            if (mode === "participante" && rival) {
              refCountries = new Set(getRoundParticipants(rival, round.key));
            } else {
              refCountries = new Set((consensusKnockouts[round.key] || []).filter(Boolean));
            }

            // Union de todos los equipos relevantes para la comparación
            const allTeams = new Set([...baseCountries, ...refCountries]);

            // Resultado oficial del admin para esta ronda → puntos por acierto.
            const adminRoundTeams = new Set((adminResults.knockoutRounds[round.key] || []).filter(Boolean));
            const roundConfigured = adminRoundTeams.size >= adminCount;
            const statusFor = (inSet: boolean): MatchPickPointStatus => {
              if (!roundConfigured) return "pending";
              return inSet ? "correct" : "wrong";
            };

            // Filtrar según vsFilter
            const rows = Array.from(allTeams).map((country) => {
              const inBase = baseCountries.has(country);
              const inRef = refCountries.has(country);
              const same = inBase && inRef;
              if (vsFilter === "diff" && same) return null;
              if (vsFilter === "same" && !same) return null;
              const hit = adminRoundTeams.has(country);
              return { country, inBase, inRef, same, hit };
            }).filter(Boolean) as Array<{ country: string; inBase: boolean; inRef: boolean; same: boolean; hit: boolean }>;

            if (!rows.length) return null;

            return (
              <div key={round.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="font-display text-sm font-bold text-text-muted">{round.name}</h4>
                  <span className="text-[10px] text-text-muted">
                    {baseCountries.size}/{adminCount} equipos
                  </span>
                </div>
                {/* Grid de comparación pick a pick */}
                <div className="card !p-3">
                  <div className="grid grid-cols-[1fr_auto_1fr] text-[10px] text-text-muted font-semibold mb-2">
                    <span className="text-accent-versus text-center">Tu pick</span>
                    <span className="w-6 text-center">≡</span>
                    <span className="text-center">{referenceName}</span>
                  </div>
                  <div className="space-y-1">
                    {rows.map((row, idx) => (
                      <div key={`${round.key}-${idx}`}
                        className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 py-0.5 border-t border-[rgb(var(--divider)/0.06)] first:border-0">
                        <div className="flex items-center justify-center gap-1">
                          {row.inBase
                            ? <><Flag country={row.country} size="sm" /><span className="truncate text-[11px]">{row.country}</span><PickChip status={statusFor(true)} points={row.hit ? round.pts : 0} /></>
                            : <span className="text-[11px] text-text-faint">—</span>}
                        </div>
                        <span className={`w-6 text-center text-[11px] font-bold ${row.same ? "text-success" : "text-accent-versus"}`}>
                          {row.same ? "=" : "≠"}
                        </span>
                        <div className="flex items-center justify-center gap-1">
                          {row.inRef
                            ? <><Flag country={row.country} size="sm" /><span className={`truncate text-[11px] ${!row.same ? "text-accent-versus" : ""}`}>{row.country}</span>{mode === "participante" ? <PickChip status={statusFor(true)} points={row.hit ? round.pts : 0} /> : null}</>
                            : <span className="text-[11px] text-text-faint">—</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Campeón */}
          <div className="card bg-gold/[0.03] !border-gold/15 !p-3 text-center">
            <p className="mb-2 text-[10px] font-semibold text-gold uppercase tracking-widest">Campeón elegido</p>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-[10px] text-accent-versus mb-1">Tu pick</p>
                {baseTeam.championPick
                  ? <><Flag country={baseTeam.championPick} size="md" /><p className="mt-1 text-[11px] font-semibold">{baseTeam.championPick}</p></>
                  : <p className="text-[11px] text-text-muted">—</p>}
              </div>
              <span className="font-display text-sm font-extrabold text-gold">vs</span>
              <div className="text-center">
                <p className="text-[10px] text-text-muted mb-1">{referenceName}</p>
                {mode === "participante" && rival?.championPick
                  ? <><Flag country={rival.championPick} size="md" /><p className="mt-1 text-[11px] font-semibold">{rival.championPick}</p></>
                  : consensusChamp
                  ? <><Flag country={consensusChamp} size="md" /><p className="mt-1 text-[11px] font-semibold">{consensusChamp}</p></>
                  : <p className="text-[11px] text-text-muted">—</p>}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── TAB: ESPECIALES ── */}
      {vsTab === "especiales" && baseTeam ? (
        <div className="flex flex-col gap-1 animate-fade-in">
          {filteredSpecials.map((item) => {
            const basePts = baseSpecialPoints.get(item.key);
            const refPts = rivalSpecialPoints.get(item.key);
            return (
            <div key={item.label} className="card !px-3 !py-2.5">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-text-muted">{item.label}</p>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <p className="text-xs font-semibold text-accent-versus">
                    {item.isCountry ? <CountryWithFlag country={item.baseVal} /> : (item.baseVal || "—")}
                  </p>
                  {basePts ? <PickChip status={basePts.status} points={basePts.points} /> : null}
                </div>
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${item.same ? "bg-success/20 text-success" : "bg-accent-versus/20 text-accent-versus"}`}>
                  {item.same ? "=" : "≠"}
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-xs font-semibold text-text-muted">
                    {item.isCountry ? <CountryWithFlag country={item.refVal} /> : (item.refVal || "—")}
                  </p>
                  {mode === "participante" && refPts ? <PickChip status={refPts.status} points={refPts.points} /> : null}
                </div>
              </div>
            </div>
            );
          })}
          {filteredSpecials.length === 0 ? (
            <EmptyState text={vsFilter === "same" ? "No hay coincidencias en especiales" : "No hay diferencias en especiales"} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-bg-2 p-2.5 text-center">
      <p className="text-[10px] text-text-muted">{label}</p>
      <p className="font-display text-[20px] font-extrabold" style={{ color: color || "rgb(var(--text-primary))" }}>
        {value}
      </p>
    </div>
  );
}
