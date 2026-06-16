"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { GitBranch, ChevronDown, ChevronUp, X, Check, Minus, Trophy, Medal } from "lucide-react";
import { CountryWithFlag, Flag } from "@/components/ui";
import { getCityColor } from "@/lib/config/regions";
import { useScoredParticipants } from "@/lib/use-scored-participants";
import {
  buildBracket,
  isPlaceholderTeam,
  poolsAdvancingTeam,
  type BracketMatch,
} from "@/lib/worldcup/bracket";
import { sanitizeFixtures } from "@/lib/admin-import-fixtures";
import { getKickoffByMatchId } from "@/lib/worldcup/kickoffs";
import { WORLD_CUP_MATCHES, type MatchStage } from "@/lib/worldcup/schedule";

// ════════════════════════════════════════════════════════════
// Cuadro de la fase final en formato bracket CONTINUO: todas las
// rondas en columnas conectadas por llaves, con scroll horizontal de
// un tirón (Ronda de 32 → Octavos → Cuartos → Semis → Final).
// Al abrir, se posiciona automáticamente en la ronda activa según la
// fecha actual (la última ronda cuyo primer partido ya ha empezado).
// Al tocar una selección, panel de qué porras la tienen avanzando.
// ════════════════════════════════════════════════════════════

interface FixturesPayload {
  fixtures?: unknown;
}

const fetcher = async (url: string): Promise<FixturesPayload> => {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("No se han podido cargar los partidos.");
  return r.json();
};

const KICKOFF_BY_ID = new Map(
  WORLD_CUP_MATCHES.filter((m) => m.stage !== "group").map((m) => [m.id, getKickoffByMatchId(m.id)])
);

// Columnas del bracket (la final + 3.er puesto se agrupan en la última)
const COLUMN_STAGES: { stage: MatchStage; label: string }[] = [
  { stage: "round-of-32", label: "Ronda de 32" },
  { stage: "round-of-16", label: "Octavos" },
  { stage: "quarter-final", label: "Cuartos" },
  { stage: "semi-final", label: "Semifinal" },
  { stage: "final", label: "Final" },
];

const NEXT_STAGE: Partial<Record<MatchStage, MatchStage>> = {
  "round-of-32": "round-of-16",
  "round-of-16": "quarter-final",
  "quarter-final": "semi-final",
  "semi-final": "final",
};

// Primer kickoff (ms) de cada ronda, derivado del calendario real.
const ROUND_START_MS: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  for (const { stage } of COLUMN_STAGES) {
    const dates = WORLD_CUP_MATCHES.filter((m) => m.stage === stage)
      .map((m) => Date.parse(getKickoffByMatchId(m.id) || ""))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    if (dates.length) out[stage] = dates[0];
  }
  return out;
})();

// Ronda activa según la fecha: la última cuyo primer partido ya empezó.
function activeStageForDate(now: number): MatchStage {
  let active: MatchStage = "round-of-32";
  for (const { stage } of COLUMN_STAGES) {
    const start = ROUND_START_MS[stage];
    if (start != null && now >= start) active = stage;
  }
  return active;
}

const COLUMN_WIDTH = 230;
const CONNECTOR_WIDTH = 22;

function formatKickoff(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Madrid" }).format(d);
  const time = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Madrid" }).format(d);
  return `${day} · ${time}`;
}

interface SelectedTeam {
  team: string;
  stage: MatchStage;
  matchId: number;
}

export function KnockoutBracket({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
  const [open, setOpen] = useState(defaultOpen);
  const [selected, setSelected] = useState<SelectedTeam | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const didAutoScroll = useRef(false);
  const { adminResults, participants } = useScoredParticipants();

  const { data } = useSWR<FixturesPayload>("/api/results/fixtures", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 15_000,
  });

  const resultByMatchId = useMemo(() => {
    const map = new Map<number, { statusShort: string; score: { home: number | null; away: number | null } }>();
    const fixtures = sanitizeFixtures(data?.fixtures);
    const norm = (s: string) => s.trim().toLowerCase();
    const apiByPair = new Map<string, { statusShort: string; score: { home: number | null; away: number | null } }>();
    for (const f of fixtures) {
      apiByPair.set(`${norm(f.homeTeam)}|${norm(f.awayTeam)}`, { statusShort: f.statusShort, score: f.score });
    }
    const bracket = buildBracket(adminResults, new Map());
    for (const col of bracket) {
      for (const bm of col.matches) {
        if (bm.homeIsPlaceholder || bm.awayIsPlaceholder) continue;
        const direct = apiByPair.get(`${norm(bm.homeTeam)}|${norm(bm.awayTeam)}`);
        const reversed = apiByPair.get(`${norm(bm.awayTeam)}|${norm(bm.homeTeam)}`);
        if (direct) map.set(bm.id, { statusShort: direct.statusShort, score: direct.score });
        else if (reversed) map.set(bm.id, { statusShort: reversed.statusShort, score: { home: reversed.score.away, away: reversed.score.home } });
      }
    }
    return map;
  }, [data, adminResults]);

  const columns = useMemo(
    () => buildBracket(adminResults, resultByMatchId, KICKOFF_BY_ID),
    [adminResults, resultByMatchId]
  );

  const matchesByStage = useMemo(() => {
    const m = new Map<MatchStage, BracketMatch[]>();
    for (const col of columns) m.set(col.stage, col.matches);
    return m;
  }, [columns]);

  // Orden de cada ronda alineado con los cruces reales: cada partido de la
  // ronda siguiente define (vía sourceMatchIds) qué dos de la actual se
  // cruzan, así las llaves unen a los equipos que de verdad se enfrentan.
  const orderedByStage = useMemo(() => {
    const out = new Map<MatchStage, BracketMatch[]>();
    // La última ronda con cruces "hacia adelante" es semifinal → final
    for (let i = COLUMN_STAGES.length - 1; i >= 0; i--) {
      const stage = COLUMN_STAGES[i].stage;
      const cur = matchesByStage.get(stage) || [];
      const nextStage = NEXT_STAGE[stage];
      const next = nextStage ? out.get(nextStage) || matchesByStage.get(nextStage) || [] : [];
      if (next.length === 0) {
        out.set(stage, [...cur].sort((a, b) => a.id - b.id));
        continue;
      }
      const byId = new Map(cur.map((m) => [m.id, m]));
      const orderedCur: BracketMatch[] = [];
      const used = new Set<number>();
      for (const n of next) {
        for (const srcId of n.sourceMatchIds) {
          const src = byId.get(srcId);
          if (src && !used.has(srcId)) { orderedCur.push(src); used.add(srcId); }
        }
      }
      for (const m of cur) if (!used.has(m.id)) orderedCur.push(m);
      out.set(stage, orderedCur);
    }
    return out;
  }, [matchesByStage]);

  const activeStage = useMemo(() => activeStageForDate(Date.now()), []);

  // Auto-scroll a la ronda activa al abrir
  useEffect(() => {
    if (!open || didAutoScroll.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const idx = COLUMN_STAGES.findIndex((c) => c.stage === activeStage);
    if (idx <= 0) { didAutoScroll.current = true; return; }
    // Desplazar para dejar la ronda activa cerca del inicio visible
    const target = idx * (COLUMN_WIDTH + CONNECTOR_WIDTH);
    el.scrollTo({ left: target, behavior: "smooth" });
    didAutoScroll.current = true;
  }, [open, activeStage]);

  const advancement = useMemo(() => {
    if (!selected) return null;
    return poolsAdvancingTeam(participants, selected.team, selected.stage);
  }, [selected, participants]);

  const handleTeamClick = (team: string, stage: MatchStage, matchId: number) => {
    if (isPlaceholderTeam(team)) return;
    setSelected((cur) => (cur && cur.team === team && cur.matchId === matchId ? null : { team, stage, matchId }));
  };

  return (
    <div className="card mb-3 !p-0 overflow-hidden animate-fade-in">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 cursor-pointer bg-transparent border-none text-left"
        style={{ padding: "12px 14px" }}
        aria-expanded={open}
      >
        <GitBranch size={15} style={{ color: "#C99625", flexShrink: 0 }} />
        <span className="text-[13px] font-semibold text-text-warm" style={{ flex: 1 }}>
          Cuadro de la fase final
        </span>
        {open ? <ChevronUp size={15} className="text-text-muted" /> : <ChevronDown size={15} className="text-text-muted" />}
      </button>

      {open && (
        <div style={{ padding: "0 0 14px" }}>
          <p className="text-[10px] text-text-muted" style={{ padding: "0 14px 10px", margin: 0 }}>
            Desliza para recorrer el cuadro. Toca una selección para ver qué porras la tienen avanzando.
          </p>

          <div ref={scrollRef} style={{ overflowX: "auto", padding: "0 14px 4px", WebkitOverflowScrolling: "touch" }}>
            <div style={{ display: "flex", alignItems: "stretch", minWidth: "min-content" }}>
              {COLUMN_STAGES.map((col, colIdx) => {
                const stage = col.stage;
                const matches = orderedByStage.get(stage) || [];
                const isActive = stage === activeStage;
                const nextStage = NEXT_STAGE[stage];
                const showConnectors = !!nextStage && (orderedByStage.get(nextStage) || []).length > 0;

                return (
                  <div key={stage} style={{ display: "flex", alignItems: "stretch", flexShrink: 0 }}>
                    {/* Columna de la ronda */}
                    <div style={{ width: COLUMN_WIDTH, flexShrink: 0, display: "flex", flexDirection: "column" }}>
                      <div
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: isActive ? "#C99625" : "rgb(var(--text-faint))", padding: "0 2px 8px", textAlign: "center" }}
                      >
                        {col.label}
                        {isActive && <span style={{ marginLeft: 5, fontSize: 8 }}>● EN CURSO</span>}
                      </div>
                      {stage === "final" ? (
                        <FinalColumnInline matches={matches} selected={selected} onTeamClick={handleTeamClick} />
                      ) : (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around", gap: 12 }}>
                          {matches.map((m) => (
                            <BracketCard
                              key={m.id}
                              match={m}
                              dimmed={!isActive}
                              selectedTeam={selected?.matchId === m.id ? selected.team : null}
                              onTeamClick={(t) => handleTeamClick(t, m.stage, m.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Conectores hacia la ronda siguiente */}
                    {showConnectors && colIdx < COLUMN_STAGES.length - 1 && (
                      <div style={{ width: CONNECTOR_WIDTH, flexShrink: 0, display: "flex", flexDirection: "column", paddingTop: 22 }}>
                        <Connectors pairCount={(orderedByStage.get(nextStage!) || []).length} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {selected && advancement && (
            <div style={{ padding: "0 14px" }}>
              <AdvancementPanel
                team={selected.team}
                nextLabel={advancement.nextLabel}
                pools={advancement.pools}
                onClose={() => setSelected(null)}
              />
            </div>
          )}
          {selected && !advancement && (
            <div style={{ padding: "0 14px" }}>
              <div className="card !py-2.5 !px-3 mt-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                <p className="text-[11px] text-text-muted" style={{ margin: 0 }}>
                  Es la final: el campeón se gestiona en el podio, no como avance de ronda.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Conectores tipo "llave": une cada par consecutivo de la ronda actual hacia
// un partido de la ronda siguiente.
function Connectors({ pairCount }: { pairCount: number }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around" }}>
      {Array.from({ length: pairCount }).map((_, i) => (
        <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", position: "relative" }}>
          <div
            style={{
              width: 11,
              height: "50%",
              borderTop: "1.5px solid rgb(var(--border-default))",
              borderBottom: "1.5px solid rgb(var(--border-default))",
              borderRight: "1.5px solid rgb(var(--border-default))",
              borderTopRightRadius: 8,
              borderBottomRightRadius: 8,
            }}
          />
          <div style={{ flex: 1, height: "1.5px", background: "rgb(var(--border-default))" }} />
        </div>
      ))}
    </div>
  );
}

function statusMeta(statusShort: string) {
  const isFinished = ["FT", "AET", "PEN"].includes(statusShort);
  const isLive = ["1H", "HT", "2H", "ET", "P", "LIVE", "BT"].includes(statusShort);
  return { isFinished, isLive };
}

function BracketCard({
  match,
  selectedTeam,
  onTeamClick,
  dimmed,
}: {
  match: BracketMatch;
  selectedTeam: string | null;
  onTeamClick: (team: string) => void;
  dimmed?: boolean;
}) {
  const { isFinished, isLive } = statusMeta(match.statusShort);
  const accent = getCityColor(match.hostCity);

  const side = (team: string, isPlaceholder: boolean, score: number | null) => {
    const isSel = selectedTeam !== null && selectedTeam === team;
    return (
      <button
        type="button"
        disabled={isPlaceholder}
        onClick={() => onTeamClick(team)}
        className="flex items-center gap-2 w-full text-left bg-transparent border-none"
        style={{ padding: "5px 8px", borderRadius: 7, cursor: isPlaceholder ? "default" : "pointer", background: isSel ? "rgba(201,150,37,0.18)" : "transparent" }}
      >
        {isPlaceholder ? (
          <>
            <span style={{ width: 17, height: 17, borderRadius: "50%", background: "rgb(var(--bg-3))", flexShrink: 0 }} />
            <span className="text-[10px] text-text-faint italic truncate" style={{ flex: 1 }}>{team}</span>
          </>
        ) : (
          <>
            <Flag country={team} size="sm" />
            <span className="text-[11px] text-text-primary truncate" style={{ flex: 1 }}>{team}</span>
          </>
        )}
        {typeof score === "number" && (
          <span className="text-[11px] font-bold tabular-nums text-text-warm" style={{ flexShrink: 0 }}>{score}</span>
        )}
      </button>
    );
  };

  return (
    <div
      className="rounded-xl"
      style={{
        background: "rgb(var(--bg-2))",
        border: `1px solid ${isLive ? "rgba(220,38,38,0.4)" : "rgb(var(--border-subtle))"}`,
        opacity: dimmed ? 0.85 : 1,
      }}
    >
      <div className="flex items-center gap-1.5" style={{ padding: "6px 8px 3px" }}>
        <span style={{ width: 3, height: 11, borderRadius: 2, background: accent, flexShrink: 0 }} />
        <span className="text-[9px] text-text-muted truncate" style={{ flex: 1 }}>{match.hostCity}</span>
        {isLive ? (
          <span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase" style={{ color: "#ef4444" }}>
            <span className="animate-pulse" style={{ width: 4, height: 4, borderRadius: "50%", background: "#ef4444" }} />
            Vivo
          </span>
        ) : isFinished ? (
          <span className="text-[8px] uppercase text-text-faint">Final</span>
        ) : (
          <span className="text-[8px] text-text-faint whitespace-nowrap">{formatKickoff(match.kickoff)}</span>
        )}
      </div>
      {side(match.homeTeam, match.homeIsPlaceholder, match.score.home)}
      {side(match.awayTeam, match.awayIsPlaceholder, match.score.away)}
    </div>
  );
}

// Columna final inline: Final (con trofeo) + 3.er puesto
function FinalColumnInline({
  matches,
  selected,
  onTeamClick,
}: {
  matches: BracketMatch[];
  selected: SelectedTeam | null;
  onTeamClick: (team: string, stage: MatchStage, matchId: number) => void;
}) {
  const final = matches.find((m) => m.stage === "final") || matches[0];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
      {final && (
        <div>
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <Trophy size={13} style={{ color: "#C99625" }} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold">Gran Final</span>
          </div>
          <BracketCard
            match={final}
            selectedTeam={selected?.matchId === final.id ? selected.team : null}
            onTeamClick={(t) => onTeamClick(t, final.stage, final.id)}
          />
        </div>
      )}
      <div>
        <div className="flex items-center justify-center gap-1.5 mb-1.5">
          <Medal size={12} style={{ color: "#CD7F32" }} />
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#CD7F32" }}>3.er puesto</span>
        </div>
        <div className="rounded-xl" style={{ background: "rgb(var(--bg-2))", border: "1px solid rgb(var(--border-subtle))", padding: "8px" }}>
          <p className="text-[9px] text-text-muted text-center" style={{ margin: 0 }}>Perdedores de semifinales</p>
        </div>
      </div>
    </div>
  );
}

function AdvancementPanel({
  team,
  nextLabel,
  pools,
  onClose,
}: {
  team: string;
  nextLabel: string;
  pools: { teamId: string; teamName: string; username: string; picked: boolean }[];
  onClose: () => void;
}) {
  const withPick = pools.filter((p) => p.picked);
  return (
    <div className="card !py-3 !px-3 mt-3 animate-fade-in" style={{ border: "1px solid rgba(201,150,37,0.3)" }}>
      <div className="flex items-center gap-2 mb-2">
        <CountryWithFlag country={team} size="sm" textClassName="text-[13px] font-bold text-text-warm" />
        <span className="text-[11px] text-text-muted" style={{ flex: 1 }}>→ pasa a {nextLabel}</span>
        <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-text-muted p-1" aria-label="Cerrar">
          <X size={14} />
        </button>
      </div>
      <p className="text-[11px] mb-2" style={{ margin: "0 0 8px" }}>
        <span className="font-bold text-gold">{withPick.length}</span>
        <span className="text-text-muted"> de {pools.length} porras tienen a {team} en {nextLabel}.</span>
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 240, overflowY: "auto" }}>
        {pools
          .slice()
          .sort((a, b) => (a.picked === b.picked ? a.teamName.localeCompare(b.teamName, "es") : a.picked ? -1 : 1))
          .map((p) => (
            <div key={p.teamId} className="flex items-center gap-2" style={{ padding: "3px 6px", borderRadius: 6, background: p.picked ? "rgba(62,155,79,0.07)" : "transparent" }}>
              {p.picked ? <Check size={13} style={{ color: "#3E9B4F", flexShrink: 0 }} /> : <Minus size={13} style={{ color: "rgb(var(--text-faint))", flexShrink: 0 }} />}
              <span className={`text-[11px] truncate ${p.picked ? "text-text-primary font-medium" : "text-text-faint"}`} style={{ flex: 1 }}>{p.teamName}</span>
              <span className="text-[9px] text-text-faint truncate">@{p.username}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
