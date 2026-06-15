"use client";

import { useMemo, useRef, useState } from "react";
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
// Cuadro de la fase final estilo "bracket" (inspirado en Apple Sports).
// Navegación por pestañas de ronda; cada ronda muestra tarjetas grandes
// con estadio, banderas, fecha/hora y marcador, y conectores en llave
// hacia los cruces de la ronda siguiente (mostrada desplazada a la
// derecha). Al tocar una selección, panel de qué porras la tienen
// avanzando a la siguiente ronda.
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

// Pestañas de ronda (la final y el 3.er puesto se agrupan en "Final")
const ROUND_TABS: { stage: MatchStage; label: string; short: string }[] = [
  { stage: "round-of-32", label: "Ronda de 32", short: "32avos" },
  { stage: "round-of-16", label: "Octavos de final", short: "Octavos" },
  { stage: "quarter-final", label: "Cuartos de final", short: "Cuartos" },
  { stage: "semi-final", label: "Semifinal", short: "Semis" },
  { stage: "final", label: "Final", short: "Final" },
];

const NEXT_STAGE: Partial<Record<MatchStage, MatchStage>> = {
  "round-of-32": "round-of-16",
  "round-of-16": "quarter-final",
  "quarter-final": "semi-final",
  "semi-final": "final",
};

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

export function KnockoutBracket() {
  const [open, setOpen] = useState(false);
  const [activeStage, setActiveStage] = useState<MatchStage>("round-of-32");
  const [selected, setSelected] = useState<SelectedTeam | null>(null);
  const { adminResults, participants } = useScoredParticipants();

  const { data } = useSWR<FixturesPayload>("/api/results/fixtures", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 15_000,
  });

  // Mapa matchId → resultado (estado + marcador) desde la API
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

  const advancement = useMemo(() => {
    if (!selected) return null;
    return poolsAdvancingTeam(participants, selected.team, selected.stage);
  }, [selected, participants]);

  const handleTeamClick = (team: string, stage: MatchStage, matchId: number) => {
    if (isPlaceholderTeam(team)) return;
    setSelected((cur) => (cur && cur.team === team && cur.matchId === matchId ? null : { team, stage, matchId }));
  };

  const currentMatches = matchesByStage.get(activeStage) || [];
  const nextStage = NEXT_STAGE[activeStage];
  const nextMatches = nextStage ? matchesByStage.get(nextStage) || [] : [];

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
          {/* Pestañas de ronda */}
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ padding: "0 14px 8px" }}>
            {ROUND_TABS.map((tab) => (
              <button
                key={tab.stage}
                className={`pill ${activeStage === tab.stage ? "active" : ""}`}
                onClick={() => { setActiveStage(tab.stage); setSelected(null); }}
                style={{ whiteSpace: "nowrap" }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <p className="text-[10px] text-text-muted" style={{ padding: "0 14px 10px", margin: 0 }}>
            Toca una selección para ver qué porras la tienen avanzando.
          </p>

          {/* Bracket: ronda actual + ronda siguiente desplazada */}
          {activeStage === "final" ? (
            <FinalColumn matches={currentMatches} onTeamClick={handleTeamClick} selected={selected} />
          ) : (
            <div style={{ overflowX: "auto", padding: "0 14px" }}>
              <div style={{ display: "flex", gap: 0, minWidth: "min-content", alignItems: "stretch" }}>
                {/* Columna ronda actual */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14, flexShrink: 0, width: 248 }}>
                  {currentMatches.map((m) => (
                    <BracketCard
                      key={m.id}
                      match={m}
                      selectedTeam={selected?.matchId === m.id ? selected.team : null}
                      onTeamClick={(t) => handleTeamClick(t, m.stage, m.id)}
                    />
                  ))}
                </div>

                {/* Conectores + columna ronda siguiente (cada cruce centrado entre sus 2 orígenes) */}
                {nextStage && nextMatches.length > 0 && (
                  <div style={{ display: "flex", flexShrink: 0 }}>
                    <Connectors pairCount={nextMatches.length} />
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", gap: 14, width: 248, flexShrink: 0 }}>
                      {nextMatches.map((m) => (
                        <BracketCard
                          key={m.id}
                          match={m}
                          dimmed
                          selectedTeam={selected?.matchId === m.id ? selected.team : null}
                          onTeamClick={(t) => handleTeamClick(t, m.stage, m.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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
        </div>
      )}
    </div>
  );
}

// Conectores tipo "llave": une cada par consecutivo de la ronda actual hacia
// un partido de la ronda siguiente.
function Connectors({ pairCount }: { pairCount: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", width: 18, flexShrink: 0 }}>
      {Array.from({ length: pairCount }).map((_, i) => (
        <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", position: "relative" }}>
          <div
            style={{
              width: 10,
              height: "52%",
              borderTop: "1.5px solid rgb(var(--border-default))",
              borderBottom: "1.5px solid rgb(var(--border-default))",
              borderRight: "1.5px solid rgb(var(--border-default))",
              borderTopRightRadius: 8,
              borderBottomRightRadius: 8,
            }}
          />
          <div style={{ width: 8, height: "1.5px", background: "rgb(var(--border-default))" }} />
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
            <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgb(var(--bg-3))", flexShrink: 0 }} />
            <span className="text-[11px] text-text-faint italic truncate" style={{ flex: 1 }}>{team}</span>
          </>
        ) : (
          <>
            <Flag country={team} size="sm" />
            <span className="text-[12px] text-text-primary truncate" style={{ flex: 1 }}>{team}</span>
          </>
        )}
        {typeof score === "number" && (
          <span className="text-[12px] font-bold tabular-nums text-text-warm" style={{ flexShrink: 0 }}>{score}</span>
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
        opacity: dimmed ? 0.92 : 1,
      }}
    >
      {/* Cabecera: estadio + fecha */}
      <div className="flex items-center gap-1.5" style={{ padding: "7px 8px 4px" }}>
        <span style={{ width: 3, height: 12, borderRadius: 2, background: accent, flexShrink: 0 }} />
        <span className="text-[10px] text-text-muted truncate" style={{ flex: 1 }}>{match.hostCity}</span>
        {isLive ? (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase" style={{ color: "#ef4444" }}>
            <span className="animate-pulse" style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444" }} />
            Vivo
          </span>
        ) : isFinished ? (
          <span className="text-[9px] uppercase text-text-faint">Final</span>
        ) : (
          <span className="text-[9px] text-text-faint whitespace-nowrap">{formatKickoff(match.kickoff)}</span>
        )}
      </div>
      {side(match.homeTeam, match.homeIsPlaceholder, match.score.home)}
      {side(match.awayTeam, match.awayIsPlaceholder, match.score.away)}
    </div>
  );
}

// Columna final: Final (con trofeo) + 3.er puesto
function FinalColumn({
  matches,
  onTeamClick,
  selected,
}: {
  matches: BracketMatch[];
  onTeamClick: (team: string, stage: MatchStage, matchId: number) => void;
  selected: SelectedTeam | null;
}) {
  const final = matches.find((m) => m.stage === "final");
  // El 3.er puesto vive en otra "stage"; lo recuperamos del schedule completo
  const third = WORLD_CUP_MATCHES.find((m) => m.stage === "third-place");

  return (
    <div style={{ padding: "0 14px", display: "flex", flexDirection: "column", gap: 14 }}>
      {final && (
        <div>
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Trophy size={15} style={{ color: "#C99625" }} />
            <span className="text-[12px] font-bold uppercase tracking-wider text-gold">Gran Final</span>
          </div>
          <BracketCard
            match={final}
            selectedTeam={selected?.matchId === final.id ? selected.team : null}
            onTeamClick={(t) => onTeamClick(t, final.stage, final.id)}
          />
        </div>
      )}
      {third && (
        <div>
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Medal size={14} style={{ color: "#CD7F32" }} />
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#CD7F32" }}>Tercer puesto</span>
          </div>
          <div className="rounded-xl" style={{ background: "rgb(var(--bg-2))", border: "1px solid rgb(var(--border-subtle))", padding: "8px" }}>
            <p className="text-[10px] text-text-muted text-center" style={{ margin: 0 }}>
              Perdedores de semifinales
            </p>
          </div>
        </div>
      )}
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
