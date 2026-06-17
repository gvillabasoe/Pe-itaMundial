"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { Footprints, Star, X } from "lucide-react";
import { useScoredParticipants } from "@/lib/use-scored-participants";
import { useAuth } from "@/components/auth-provider";
import { Flag, InitialsAvatar } from "@/components/ui";

// ════════════════════════════════════════════════════════════
// Bota de Oro — Top 10 de goleadores del torneo.
// Agrega los goles por jugador desde los goleadores que da la API (campo
// goals[].player, ignorando goles en propia) y deduce el país del jugador
// según el lado del partido (side → homeTeam/awayTeam). Al pulsar un jugador
// se muestran las porras que lo eligieron como máximo goleador
// (specials.maxGoleador). Reutiliza el payload de /api/results/fixtures.
// ════════════════════════════════════════════════════════════

interface FixturesPayload {
  fixtures?: unknown;
}

const fetcher = async (url: string): Promise<FixturesPayload> => {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("No se han podido cargar los partidos.");
  return r.json();
};

const GOLD = "#C99625";

const normName = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

interface Backer {
  name: string;
  avatarUrl: string | null;
  mine: boolean;
}

interface ScorerRow {
  player: string;
  country: string;
  goals: number;
  backedBy: Backer[];
}

export function TopScorers() {
  const { participants } = useScoredParticipants();
  const { user } = useAuth();
  const [selected, setSelected] = useState<ScorerRow | null>(null);

  const { data } = useSWR<FixturesPayload>("/api/results/fixtures", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 15_000,
  });

  const scorers = useMemo<ScorerRow[]>(() => {
    const raw = Array.isArray(data?.fixtures) ? (data!.fixtures as Array<Record<string, unknown>>) : [];
    // Goles por jugador (+ país según el lado del partido). Ignora goles en propia.
    const counts = new Map<string, { display: string; country: string; goals: number }>();
    for (const f of raw) {
      const goals = Array.isArray(f.goals) ? f.goals : [];
      const home = String(f.homeTeam || "");
      const away = String(f.awayTeam || "");
      for (const g of goals as Array<Record<string, unknown>>) {
        if (g.ownGoal === true) continue;
        const name = String(g.player || "").trim();
        if (!name || name === "—") continue;
        const key = normName(name);
        const country = g.side === "away" ? away : home;
        const prev = counts.get(key);
        if (prev) {
          prev.goals += 1;
          if (!prev.country && country) prev.country = country;
        } else {
          counts.set(key, { display: name, country, goals: 1 });
        }
      }
    }
    if (counts.size === 0) return [];

    // Porras que eligieron a cada jugador como máximo goleador.
    const backers = new Map<string, Backer[]>();
    for (const p of participants) {
      const pick = p.specials?.maxGoleador;
      if (!pick) continue;
      const key = normName(pick);
      const arr = backers.get(key) || [];
      arr.push({
        name: p.name,
        avatarUrl: p.avatarUrl ?? null,
        mine: Boolean(user && (p.userId === user.id || p.username === user.username)),
      });
      backers.set(key, arr);
    }

    const rows: ScorerRow[] = [...counts.entries()].map(([key, v]) => ({
      player: v.display,
      country: v.country,
      goals: v.goals,
      backedBy: backers.get(key) || [],
    }));
    rows.sort((a, b) => b.goals - a.goals || a.player.localeCompare(b.player, "es"));
    return rows.slice(0, 10);
  }, [data, participants, user]);

  return (
    <div className="card mb-3 !p-0 overflow-hidden animate-fade-in">
      <div className="flex items-center gap-2" style={{ padding: "12px 14px" }}>
        <Footprints size={15} style={{ color: GOLD, flexShrink: 0 }} />
        <span className="text-[13px] font-semibold text-text-warm" style={{ flex: 1 }}>
          Bota de Oro · Top 10
        </span>
      </div>

      <div style={{ padding: "0 12px 12px" }}>
        {scorers.length === 0 ? (
          <p className="text-[11px] text-text-muted" style={{ margin: "2px 0 0", padding: "0 2px" }}>
            Aún no hay goles registrados. La tabla se irá llenando con el torneo.
          </p>
        ) : (
          <>
            <p className="text-[10px] text-text-muted" style={{ margin: "0 0 10px", padding: "0 2px" }}>
              Top 10 del torneo. Toca un jugador para ver qué porras lo eligieron como Bota de Oro.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {scorers.map((s, i) => (
                <button
                  key={s.player}
                  type="button"
                  onClick={() => setSelected(s)}
                  className="flex w-full items-center gap-3 text-left"
                  style={{ padding: "10px 8px", borderRadius: 12, background: i < 3 ? "rgba(201,150,37,0.07)" : "rgb(var(--bg-2))" }}
                >
                  <span className="font-display text-sm font-black text-text-faint tabular-nums" style={{ minWidth: 18, textAlign: "center" }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-[15px] font-bold text-text-warm truncate">{s.player}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-muted min-w-0">
                      <Flag country={s.country} size="sm" />
                      <span className="truncate">{s.country || "—"}</span>
                    </p>
                  </div>
                  {s.backedBy.length > 0 && (
                    <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "rgba(201,150,37,0.14)", color: GOLD }}>
                      <Star size={10} style={{ fill: GOLD, color: GOLD }} />
                      {s.backedBy.length}
                    </span>
                  )}
                  <span className="font-display flex-shrink-0 text-lg font-black tabular-nums" style={{ color: GOLD }}>
                    {s.goals}
                    <span className="text-[9px] font-semibold text-text-muted" style={{ marginLeft: 3 }}>
                      {s.goals === 1 ? "gol" : "goles"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {selected && <ScorerDetail row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ScorerDetail({ row, onClose }: { row: ScorerRow; onClose: () => void }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center" style={{ background: "rgba(10,12,20,0.55)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="rounded-t-3xl w-full max-w-[640px] max-h-[88vh] overflow-y-auto p-5 animate-slide-up bg-bg-1" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Flag country={row.country} size="md" />
            <div className="min-w-0">
              <p className="font-display text-lg font-black text-text-warm truncate">{row.player}</p>
              <p className="text-[12px] text-text-muted truncate">{row.country || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-display text-xl font-black tabular-nums" style={{ color: GOLD }}>
              {row.goals}
              <span className="text-[10px] font-semibold text-text-muted" style={{ marginLeft: 3 }}>{row.goals === 1 ? "gol" : "goles"}</span>
            </span>
            <button type="button" onClick={onClose} className="rounded-lg bg-bg-2 p-1.5 text-text-muted" aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
        </div>

        <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-text-warm">
          <Star size={13} style={{ fill: GOLD, color: GOLD }} />
          Lo eligieron como Bota de Oro
          {row.backedBy.length > 0 && <span className="text-text-muted font-normal">· {row.backedBy.length}</span>}
        </p>

        {row.backedBy.length === 0 ? (
          <p className="text-[12px] text-text-muted">Ninguna porra eligió a este jugador como máximo goleador.</p>
        ) : (
          <div className="space-y-1.5">
            {row.backedBy.map((b, idx) => (
              <div
                key={`${b.name}-${idx}`}
                className="card flex items-center gap-2.5 !py-2 !px-3"
                style={{ background: b.mine ? "rgba(63,157,78,0.06)" : undefined, borderColor: b.mine ? "rgb(var(--accent-participante) / 0.35)" : undefined }}
              >
                <InitialsAvatar name={b.name} size={26} avatarUrl={b.avatarUrl} />
                <span className={`flex-1 truncate text-sm ${b.mine ? "font-bold" : ""}`} style={b.mine ? { color: "rgb(var(--accent-participante))" } : undefined}>
                  {b.name}
                </span>
                {b.mine && (
                  <span className="flex-shrink-0 rounded px-1 py-px text-[8px] font-black uppercase" style={{ background: "rgba(63,157,78,0.16)", color: "rgb(var(--accent-participante))" }}>
                    Tú
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
