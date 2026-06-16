"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Footprints, ChevronDown, ChevronUp, Star } from "lucide-react";
import { useScoredParticipants } from "@/lib/use-scored-participants";

// ════════════════════════════════════════════════════════════
// Carrera del Pichichi (Bota de Oro). Agrega los goles por jugador a
// partir de los goleadores que da la API en todos los partidos, y marca
// a quién apostó cada porra como máximo goleador (specials.maxGoleador).
// Plegable; reutiliza el payload de /api/results/fixtures (misma key SWR).
// Solo informativo: los nombres de jugador varían entre fuentes.
// ════════════════════════════════════════════════════════════

interface FixturesPayload {
  fixtures?: unknown;
}

const fetcher = async (url: string): Promise<FixturesPayload> => {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("No se han podido cargar los partidos.");
  return r.json();
};

const normName = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

interface ScorerRow {
  player: string;
  goals: number;
  backedBy: string[]; // nombres de porras que lo eligieron como máximo goleador
}

export function TopScorers({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
  const [open, setOpen] = useState(defaultOpen);
  const { participants } = useScoredParticipants();

  const { data } = useSWR<FixturesPayload>("/api/results/fixtures", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 15_000,
  });

  const scorers = useMemo<ScorerRow[]>(() => {
    // Leemos los goles directamente del payload: sanitizeFixtures descarta el
    // campo goals, así que aquí accedemos al array crudo de fixtures.
    const raw = Array.isArray(data?.fixtures) ? (data!.fixtures as Array<Record<string, unknown>>) : [];
    // Conteo de goles por jugador (ignora goles en propia: no cuentan al pichichi)
    const counts = new Map<string, { display: string; goals: number }>();
    for (const f of raw) {
      const goals = Array.isArray(f.goals) ? f.goals : [];
      for (const g of goals as Array<Record<string, unknown>>) {
        if (g.ownGoal === true) continue;
        const name = String(g.player || "").trim();
        if (!name || name === "—") continue;
        const key = normName(name);
        const prev = counts.get(key);
        if (prev) prev.goals += 1;
        else counts.set(key, { display: name, goals: 1 });
      }
    }
    if (counts.size === 0) return [];

    // Picks de máximo goleador por porra
    const backers = new Map<string, string[]>();
    for (const p of participants) {
      const pick = p.specials?.maxGoleador;
      if (!pick) continue;
      const key = normName(pick);
      const arr = backers.get(key) || [];
      arr.push(p.name);
      backers.set(key, arr);
    }

    const rows: ScorerRow[] = [...counts.entries()].map(([key, v]) => ({
      player: v.display,
      goals: v.goals,
      backedBy: backers.get(key) || [],
    }));
    rows.sort((a, b) => (b.goals - a.goals) || a.player.localeCompare(b.player, "es"));
    return rows.slice(0, 15);
  }, [data, participants]);

  return (
    <div className="card mb-3 !p-0 overflow-hidden animate-fade-in">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 cursor-pointer bg-transparent border-none text-left"
        style={{ padding: "12px 14px" }}
        aria-expanded={open}
      >
        <Footprints size={15} style={{ color: "#C99625", flexShrink: 0 }} />
        <span className="text-[13px] font-semibold text-text-warm" style={{ flex: 1 }}>
          Carrera por la Bota de Oro
        </span>
        {open ? <ChevronUp size={15} className="text-text-muted" /> : <ChevronDown size={15} className="text-text-muted" />}
      </button>

      {open && (
        <div style={{ padding: "0 14px 14px" }}>
          {scorers.length === 0 ? (
            <p className="text-[11px] text-text-muted" style={{ margin: "4px 0 0" }}>
              Aún no hay goles registrados. La tabla se irá llenando con el torneo.
            </p>
          ) : (
            <>
              <p className="text-[10px] text-text-muted" style={{ margin: "0 0 10px" }}>
                Máximos goleadores del torneo. La estrella marca a quién eligió cada porra como Bota de Oro.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {scorers.map((s, i) => (
                  <div
                    key={s.player}
                    className="flex items-center gap-2.5"
                    style={{ padding: "5px 6px", borderRadius: 8, background: i < 3 ? "rgba(201,150,37,0.06)" : undefined }}
                  >
                    <span className="font-display text-xs font-bold text-text-faint tabular-nums" style={{ minWidth: 20, textAlign: "center" }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-text-primary truncate">{s.player}</p>
                      {s.backedBy.length > 0 && (
                        <p className="text-[9px] text-text-muted truncate flex items-center gap-1">
                          <Star size={9} style={{ color: "#C99625", fill: "#C99625", flexShrink: 0 }} />
                          {s.backedBy.join(", ")}
                        </p>
                      )}
                    </div>
                    <span className="font-display text-sm font-black text-gold tabular-nums" style={{ flexShrink: 0 }}>
                      {s.goals}
                      <span className="text-[9px] font-semibold text-text-muted" style={{ marginLeft: 2 }}>
                        {s.goals === 1 ? "gol" : "goles"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
