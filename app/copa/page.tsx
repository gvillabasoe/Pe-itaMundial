"use client";

import { useMemo, useState } from "react";
import { Crown, Trophy } from "lucide-react";
import { GROUP_COLORS } from "@/lib/data";
import { EmptyState, InitialsAvatar, Skeleton } from "@/components/ui";
import { GROUP_LABELS } from "@/lib/cup/template";
import { useCup } from "@/lib/cup/use-cup";
import type { BracketMatch } from "@/lib/cup/types";
import type { Ventana } from "@/lib/scoring";

// Colores de grupo: los mismos que en Resultados (A..L) + dos para M y N.
const EXTRA_GROUP_COLORS: Record<string, string> = { M: "#3F7D6B", N: "#9C5B8B" };
function groupColor(label: string): string {
  return GROUP_COLORS[label] || EXTRA_GROUP_COLORS[label] || "#7A7A7A";
}

const TABS = [
  { key: "grupos", label: "Grupos" },
  { key: "calendario", label: "Calendario" },
  { key: "cuadro", label: "Cuadro" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const JORNADAS: { key: Ventana; label: string }[] = [
  { key: "J1", label: "Jornada 1" },
  { key: "J2", label: "Jornada 2" },
  { key: "J3", label: "Jornada 3" },
];

export default function CopaPage() {
  const { config, locked, groups, bracket, teamById, isLoading, mutateConfig } = useCup();
  const [tab, setTab] = useState<TabKey>("grupos");
  const [jornada, setJornada] = useState<Ventana>("J1");

  const name = (id?: string) => (id ? teamById.get(id)?.name ?? "—" : "—");
  const avatar = (id?: string) => (id ? teamById.get(id)?.avatarUrl ?? null : null);

  function TeamCell({ id, size = 24 }: { id?: string; size?: number }) {
    return (
      <span className="inline-flex items-center gap-2 min-w-0">
        <InitialsAvatar name={name(id)} size={size} avatarUrl={avatar(id)} />
        <span className="truncate text-sm">{name(id)}</span>
      </span>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4">
      <header className="mb-4 flex items-center gap-2">
        <Crown size={22} className="text-gold" />
        <h1 className="font-display text-xl font-bold text-text-warm">Copa · Mundial entre porras</h1>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !locked ? (
        <EmptyState
          icon={Trophy}
          title="La Copa aún no ha empezado"
          text="El organizador todavía no ha hecho el sorteo de grupos."
        />
      ) : (
        <>
          <div className="mb-4 flex gap-1 rounded-xl bg-bg-2 p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  tab === t.key ? "bg-bg-1 text-text-warm shadow-sm" : "text-text-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Grupos ── */}
          {tab === "grupos" && groups && (
            <div className="space-y-4">
              {GROUP_LABELS.map((label) => {
                const rows = groups.standings[label] || [];
                const color = groupColor(label);
                return (
                  <div key={label} className="card overflow-hidden p-0">
                    <div className="flex items-center gap-2 px-3 py-2" style={{ background: `${color}1F`, borderBottom: `1px solid ${color}38` }}>
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: color, color: "#fff" }}>
                        {label}
                      </span>
                      <span className="text-sm font-bold" style={{ color }}>Grupo {label}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] uppercase text-text-muted">
                          <th className="px-2 py-1 text-left font-medium">#</th>
                          <th className="px-2 py-1 text-left font-medium">Porra</th>
                          <th className="px-1 py-1 text-center font-medium">PJ</th>
                          <th className="px-1 py-1 text-center font-medium">GF</th>
                          <th className="px-1 py-1 text-center font-medium">GC</th>
                          <th className="px-1 py-1 text-center font-medium">DG</th>
                          <th className="px-2 py-1 text-center font-medium">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={r.teamId} className="border-t border-border-subtle">
                            <td className="px-2 py-1.5 text-text-muted">{i + 1}</td>
                            <td className="px-2 py-1.5"><TeamCell id={r.teamId} /></td>
                            <td className="px-1 py-1.5 text-center text-text-muted">{r.pj}</td>
                            <td className="px-1 py-1.5 text-center">{r.gf}</td>
                            <td className="px-1 py-1.5 text-center">{r.gc}</td>
                            <td className="px-1 py-1.5 text-center">{r.dg > 0 ? `+${r.dg}` : r.dg}</td>
                            <td className="px-2 py-1.5 text-center font-bold">{r.pts}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
              <p className="px-1 text-[11px] text-text-muted">
                Goles a favor = puntos de la porra en esas jornadas. Clasifican los 2 primeros de cada grupo y los 4 mejores terceros.
              </p>
            </div>
          )}

          {/* ── Calendario ── */}
          {tab === "calendario" && groups && (
            <div>
              <div className="mb-3 flex gap-1 rounded-xl bg-bg-2 p-1">
                {JORNADAS.map((j) => (
                  <button
                    key={j.key}
                    type="button"
                    onClick={() => setJornada(j.key)}
                    className={`flex-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${
                      jornada === j.key ? "bg-bg-1 text-text-warm shadow-sm" : "text-text-muted"
                    }`}
                  >
                    {j.label}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {GROUP_LABELS.flatMap((label) =>
                  (groups.fixtures[label] || [])
                    .filter((fx) => fx.ventana === jornada)
                    .map((fx, idx) => (
                      <div key={`${label}-${jornada}-${idx}`} className="card flex items-center gap-2 px-3 py-2">
                        <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: `${groupColor(label)}1F`, color: groupColor(label) }}>
                          {label}
                        </span>
                        <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
                          <span className="truncate text-sm">{name(fx.homeId)}</span>
                          <InitialsAvatar name={name(fx.homeId)} size={22} avatarUrl={avatar(fx.homeId)} />
                        </div>
                        <span className="flex-shrink-0 rounded-md bg-bg-2 px-2 py-0.5 text-sm font-bold tabular-nums">
                          {fx.homeGoals === null ? "·" : fx.homeGoals} - {fx.awayGoals === null ? "·" : fx.awayGoals}
                        </span>
                        <div className="flex flex-1 items-center gap-2 min-w-0">
                          <InitialsAvatar name={name(fx.awayId)} size={22} avatarUrl={avatar(fx.awayId)} />
                          <span className="truncate text-sm">{name(fx.awayId)}</span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {/* ── Cuadro ── */}
          {tab === "cuadro" && bracket && (
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-3" style={{ minWidth: 760 }}>
                {(
                  [
                    { label: "Dieciseisavos", matches: bracket.r32 },
                    { label: "Octavos", matches: bracket.r16 },
                    { label: "Cuartos", matches: bracket.qf },
                    { label: "Semifinales", matches: bracket.sf },
                    { label: "Final", matches: [bracket.final] },
                    { label: "3.er puesto", matches: [bracket.third] },
                  ] as { label: string; matches: BracketMatch[] }[]
                ).map((col) => (
                  <div key={col.label} className="flex-1" style={{ minWidth: 150 }}>
                    <p className="mb-2 text-center text-[11px] font-semibold uppercase text-text-muted">{col.label}</p>
                    <div className="space-y-2">
                      {col.matches.map((m) => (
                        <BracketCard key={m.id} m={m} name={name} avatar={avatar} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <AdminPanel locked={locked} rosterCount={config?.roster.length ?? 0} onChange={mutateConfig} getRoster={() => Array.from(teamById.keys())} />
    </div>
  );
}

function refLabel(ref: string): string {
  if (ref.startsWith("T")) return `3.º (${ref.slice(1)})`;
  if (ref[0] === "1" || ref[0] === "2") return `${ref[0]}.º ${ref.slice(1)}`;
  return "Por definir";
}

function BracketCard({
  m,
  name,
  avatar,
}: {
  m: BracketMatch;
  name: (id?: string) => string;
  avatar: (id?: string) => string | null;
}) {
  const Side = ({ id, ref, goals }: { id?: string; ref: string; goals?: number | null }) => {
    const isWinner = Boolean(m.winnerId) && m.winnerId === id;
    return (
      <div className={`flex items-center gap-1.5 ${isWinner ? "font-bold text-gold" : ""}`}>
        {id ? <InitialsAvatar name={name(id)} size={18} avatarUrl={avatar(id)} /> : null}
        <span className="flex-1 truncate text-xs">{id ? name(id) : (m.ronda === "R32" ? refLabel(ref) : "Por definir")}</span>
        <span className="text-xs tabular-nums">{goals === null || goals === undefined ? "" : goals}</span>
      </div>
    );
  };
  return (
    <div className="card space-y-1 px-2 py-1.5">
      <Side id={m.homeId} ref={m.homeRef} goals={m.homeGoals} />
      <div className="h-px bg-border-subtle" />
      <Side id={m.awayId} ref={m.awayRef} goals={m.awayGoals} />
    </div>
  );
}

function AdminPanel({
  locked,
  rosterCount,
  onChange,
  getRoster,
}: {
  locked: boolean;
  rosterCount: number;
  onChange: () => void;
  getRoster: () => string[];
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/cup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || `Error ${res.status}`);
      onChange();
      setMsg("Hecho.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se ha podido completar la acción.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="mt-6 rounded-xl border border-border-subtle p-3 text-sm">
      <summary className="cursor-pointer text-text-muted">Administración (solo organizador)</summary>
      <div className="mt-3 space-y-2">
        {locked ? (
          <>
            <p className="text-text-muted">Sorteo hecho con {rosterCount} porras.</p>
            <button type="button" disabled={busy} onClick={() => void post({ action: "reset" })} className="btn btn-ghost !py-2 text-sm">
              Deshacer sorteo
            </button>
          </>
        ) : (
          <>
            <p className="text-text-muted">Genera el sorteo con las porras actuales. Una vez hecho, queda congelado.</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void post({ action: "draw", roster: getRoster() })}
              className="btn btn-primary !py-2 text-sm"
            >
              Generar sorteo
            </button>
          </>
        )}
        {msg && <p className="text-[12px] text-text-muted">{msg}</p>}
      </div>
    </details>
  );
}
