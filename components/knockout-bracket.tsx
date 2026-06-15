"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { GitBranch, ChevronDown, ChevronUp, X, Check, Minus } from "lucide-react";
import { CountryWithFlag } from "@/components/ui";
import { useScoredParticipants } from "@/lib/use-scored-participants";
import {
  buildBracket,
  isPlaceholderTeam,
  poolsAdvancingTeam,
  type BracketMatch,
} from "@/lib/worldcup/bracket";
import { sanitizeFixtures } from "@/lib/admin-import-fixtures";
import { WORLD_CUP_MATCHES, type MatchStage } from "@/lib/worldcup/schedule";

// ════════════════════════════════════════════════════════════
// Cuadro de fase final (bracket). Sección plegable en Resultados.
// Al pinchar una selección de cualquier cruce, abre un panel con qué
// porras la tienen avanzando a la siguiente ronda.
// Reutiliza el payload de /api/results/fixtures (misma key SWR) para los
// marcadores; los equipos resueltos salen de los resultados del admin.
// ════════════════════════════════════════════════════════════

interface FixturesPayload {
  fixtures?: unknown;
}

const fetcher = async (url: string): Promise<FixturesPayload> => {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("No se han podido cargar los partidos.");
  return r.json();
};

const MATCH_BY_ID = new Map(WORLD_CUP_MATCHES.map((m) => [m.id, m]));

interface SelectedTeam {
  team: string;
  stage: MatchStage;
  matchId: number;
}

export function KnockoutBracket() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedTeam | null>(null);
  const { adminResults, participants } = useScoredParticipants();

  const { data } = useSWR<FixturesPayload>("/api/results/fixtures", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 15_000,
  });

  // Mapa matchId → resultado (estado + marcador) desde la API, orientado al
  // orden del calendario por pareja de equipos resuelta.
  const resultByMatchId = useMemo(() => {
    const map = new Map<number, { statusShort: string; score: { home: number | null; away: number | null } }>();
    const fixtures = sanitizeFixtures(data?.fixtures);
    const norm = (s: string) => s.trim().toLowerCase();
    // Index de la API por pareja normalizada
    const apiByPair = new Map<string, { statusShort: string; score: { home: number | null; away: number | null }; home: string; away: string }>();
    for (const f of fixtures) {
      apiByPair.set(`${norm(f.homeTeam)}|${norm(f.awayTeam)}`, {
        statusShort: f.statusShort,
        score: f.score,
        home: f.homeTeam,
        away: f.awayTeam,
      });
    }
    // Para cada partido knockout resuelto, buscar su fixture en ambos órdenes
    const bracket = buildBracket(adminResults, new Map());
    for (const col of bracket) {
      for (const bm of col.matches) {
        if (bm.homeIsPlaceholder || bm.awayIsPlaceholder) continue;
        const direct = apiByPair.get(`${norm(bm.homeTeam)}|${norm(bm.awayTeam)}`);
        const reversed = apiByPair.get(`${norm(bm.awayTeam)}|${norm(bm.homeTeam)}`);
        if (direct) {
          map.set(bm.id, { statusShort: direct.statusShort, score: direct.score });
        } else if (reversed) {
          map.set(bm.id, { statusShort: reversed.statusShort, score: { home: reversed.score.away, away: reversed.score.home } });
        }
      }
    }
    return map;
  }, [data, adminResults]);

  const columns = useMemo(
    () => buildBracket(adminResults, resultByMatchId),
    [adminResults, resultByMatchId]
  );

  const advancement = useMemo(() => {
    if (!selected) return null;
    return poolsAdvancingTeam(participants, selected.team, selected.stage);
  }, [selected, participants]);

  const handleTeamClick = (team: string, stage: MatchStage, matchId: number) => {
    if (isPlaceholderTeam(team)) return;
    if (selected && selected.team === team && selected.matchId === matchId) {
      setSelected(null);
    } else {
      setSelected({ team, stage, matchId });
    }
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
        <div style={{ padding: "0 14px 14px" }}>
          <p className="text-[10px] text-text-muted mb-3" style={{ margin: "0 0 10px" }}>
            Toca una selección para ver qué porras la tienen avanzando a la siguiente ronda.
          </p>

          <div style={{ overflowX: "auto", paddingBottom: 6 }}>
            <div style={{ display: "flex", gap: 12, minWidth: "min-content" }}>
              {columns.map((col) => (
                <div key={col.stage} style={{ minWidth: 150, flexShrink: 0 }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gold mb-2" style={{ margin: "0 0 8px" }}>
                    {col.label}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {col.matches.map((m) => (
                      <BracketMatchCard
                        key={m.id}
                        match={m}
                        selectedTeam={selected?.matchId === m.id ? selected.team : null}
                        onTeamClick={(team) => handleTeamClick(team, m.stage, m.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selected && advancement && (
            <AdvancementPanel
              team={selected.team}
              nextLabel={advancement.nextLabel}
              pools={advancement.pools}
              onClose={() => setSelected(null)}
            />
          )}
          {selected && !advancement && (
            <div className="card !py-2.5 !px-3 mt-3" style={{ background: "rgba(255,255,255,0.03)" }}>
              <p className="text-[11px] text-text-muted" style={{ margin: 0 }}>
                Es la final: el campeón se gestiona en el podio, no como avance de ronda.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BracketMatchCard({
  match,
  selectedTeam,
  onTeamClick,
}: {
  match: BracketMatch;
  selectedTeam: string | null;
  onTeamClick: (team: string) => void;
}) {
  const isFinished = ["FT", "AET", "PEN"].includes(match.statusShort);
  const isLive = ["1H", "HT", "2H", "ET", "P", "LIVE", "BT"].includes(match.statusShort);

  const renderSide = (team: string, isPlaceholder: boolean, score: number | null) => {
    const isSel = selectedTeam !== null && selectedTeam === team;
    return (
      <button
        type="button"
        disabled={isPlaceholder}
        onClick={() => onTeamClick(team)}
        className="flex items-center justify-between gap-1 w-full text-left bg-transparent border-none"
        style={{
          padding: "4px 6px",
          borderRadius: 6,
          cursor: isPlaceholder ? "default" : "pointer",
          background: isSel ? "rgba(201,150,37,0.18)" : "transparent",
        }}
      >
        {isPlaceholder ? (
          <span className="text-[10px] text-text-faint italic truncate">{team}</span>
        ) : (
          <CountryWithFlag country={team} size="sm" textClassName="text-[11px] text-text-primary truncate" />
        )}
        {typeof score === "number" && (
          <span className="text-[11px] font-bold tabular-nums text-text-warm" style={{ flexShrink: 0 }}>{score}</span>
        )}
      </button>
    );
  };

  return (
    <div
      className="rounded-lg border"
      style={{
        borderColor: isLive ? "rgba(220,38,38,0.4)" : "rgb(var(--border-subtle))",
        background: "rgb(var(--bg-2))",
      }}
    >
      {renderSide(match.homeTeam, match.homeIsPlaceholder, match.score.home)}
      <div style={{ height: 1, background: "rgb(var(--border-subtle))" }} />
      {renderSide(match.awayTeam, match.awayIsPlaceholder, match.score.away)}
      {(isLive || isFinished) && (
        <div className="text-[8px] uppercase tracking-wider text-center" style={{ padding: "1px 0 3px", color: isLive ? "#ef4444" : "rgb(var(--text-faint))" }}>
          {isLive ? "En vivo" : "Final"}
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
  const total = pools.length;

  return (
    <div className="card !py-3 !px-3 mt-3 animate-fade-in" style={{ border: "1px solid rgba(201,150,37,0.3)" }}>
      <div className="flex items-center gap-2 mb-2">
        <CountryWithFlag country={team} size="sm" textClassName="text-[13px] font-bold text-text-warm" />
        <span className="text-[11px] text-text-muted" style={{ flex: 1 }}>
          → pasa a {nextLabel}
        </span>
        <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-text-muted p-1" aria-label="Cerrar">
          <X size={14} />
        </button>
      </div>

      <p className="text-[11px] mb-2" style={{ margin: "0 0 8px" }}>
        <span className="font-bold text-gold">{withPick.length}</span>
        <span className="text-text-muted"> de {total} porras tienen a {team} en {nextLabel}.</span>
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 240, overflowY: "auto" }}>
        {pools
          .slice()
          .sort((a, b) => (a.picked === b.picked ? a.teamName.localeCompare(b.teamName, "es") : a.picked ? -1 : 1))
          .map((p) => (
            <div
              key={p.teamId}
              className="flex items-center gap-2"
              style={{ padding: "3px 6px", borderRadius: 6, background: p.picked ? "rgba(62,155,79,0.07)" : "transparent" }}
            >
              {p.picked ? (
                <Check size={13} style={{ color: "#3E9B4F", flexShrink: 0 }} />
              ) : (
                <Minus size={13} style={{ color: "rgb(var(--text-faint))", flexShrink: 0 }} />
              )}
              <span className={`text-[11px] truncate ${p.picked ? "text-text-primary font-medium" : "text-text-faint"}`} style={{ flex: 1 }}>
                {p.teamName}
              </span>
              <span className="text-[9px] text-text-faint truncate">@{p.username}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
