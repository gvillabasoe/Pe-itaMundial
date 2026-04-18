"use client";

import { useState, useMemo } from "react";
import { Lock, Swords } from "lucide-react";
import { Flag, GroupBadge, CountryWithFlag, EmptyState } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import { PARTICIPANTS, GROUPS, GROUP_COLORS, KNOCKOUT_ROUND_DEFS, FIXTURES, computeVersusStats, computeConsensusSpecials, compareSpecials } from "@/lib/data";
import type { Team } from "@/lib/data";
import Link from "next/link";

export default function VersusPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<"general" | "participante">("general");
  const [rivalId, setRivalId] = useState("");
  const [vsTab, setVsTab] = useState("resumen");
  const [vsFilter, setVsFilter] = useState("all");
  const [baseTeamIdx, setBaseTeamIdx] = useState(0);

  if (!user) {
    return (
      <div className="px-4 flex items-center justify-center min-h-[70vh]">
        <div className="card text-center !p-8 max-w-[320px] animate-fade-in">
          <Lock size={36} className="text-accent-versus mx-auto mb-3" />
          <h2 className="font-display text-xl font-extrabold text-text-warm mb-1">Acceso restringido</h2>
          <p className="text-sm text-text-muted mb-4">Inicia sesión para acceder a Versus</p>
          <Link href="/mi-club" className="btn no-underline" style={{ background: "#F0417A", color: "white" }}>Entrar a Mi Club</Link>
        </div>
      </div>
    );
  }

  const userTeams = PARTICIPANTS.filter(p => p.userId === user.id);
  const baseTeam = userTeams[baseTeamIdx] || userTeams[0];
  const otherTeams = PARTICIPANTS.filter(p => p.userId !== user.id);
  const rival = mode === "participante" ? (otherTeams.find(t => t.id === rivalId) || null) : null;

  // Real consensus
  const consensusSpecials = useMemo(() => computeConsensusSpecials(PARTICIPANTS), []);
  const consensusPoints = useMemo(() => ({
    name: "Consenso", username: "General",
    totalPoints: Math.round(PARTICIPANTS.reduce((a, p) => a + p.totalPoints, 0) / PARTICIPANTS.length),
    groupPoints: Math.round(PARTICIPANTS.reduce((a, p) => a + p.groupPoints, 0) / PARTICIPANTS.length),
    finalPhasePoints: Math.round(PARTICIPANTS.reduce((a, p) => a + p.finalPhasePoints, 0) / PARTICIPANTS.length),
    specialPoints: Math.round(PARTICIPANTS.reduce((a, p) => a + p.specialPoints, 0) / PARTICIPANTS.length),
  }), []);

  const ref = mode === "general" ? consensusPoints : rival;
  const refName = mode === "general" ? "Consenso" : (rival?.name || "—");

  // Real stats
  const stats = useMemo(() => {
    if (!baseTeam) return { same: 0, diff: 0, total: 0, equalPct: 0 };
    if (mode === "participante" && rival) return computeVersusStats(baseTeam, rival);
    // For consensus mode, compare base vs "average" — use first-pass heuristic
    const avgStats = { same: 0, diff: 0, total: 0, equalPct: 0 };
    let totalS = 0, totalD = 0;
    for (const other of otherTeams.slice(0, 5)) {
      const s = computeVersusStats(baseTeam, other);
      totalS += s.same; totalD += s.diff;
    }
    const cnt = Math.min(otherTeams.length, 5);
    avgStats.same = cnt > 0 ? Math.round(totalS / cnt) : 0;
    avgStats.diff = cnt > 0 ? Math.round(totalD / cnt) : 0;
    avgStats.total = avgStats.same + avgStats.diff;
    avgStats.equalPct = avgStats.total > 0 ? Math.round((avgStats.same / avgStats.total) * 100) : 0;
    return avgStats;
  }, [baseTeam, rival, mode, otherTeams]);

  const pointDelta = baseTeam && ref ? baseTeam.totalPoints - ref.totalPoints : 0;

  // Specials comparison
  const specialsComparison = useMemo(() => {
    if (!baseTeam) return [];
    return compareSpecials(baseTeam, mode === "participante" ? rival : null, consensusSpecials);
  }, [baseTeam, rival, mode, consensusSpecials]);

  const filteredSpecials = useMemo(() => {
    if (vsFilter === "diff") return specialsComparison.filter(s => !s.same);
    if (vsFilter === "same") return specialsComparison.filter(s => s.same);
    return specialsComparison;
  }, [specialsComparison, vsFilter]);

  // Biggest diff section
  const sections = baseTeam && ref ? [
    { label: "Fase de grupos", bv: baseTeam.groupPoints, rv: ref.groupPoints },
    { label: "Eliminatorias", bv: baseTeam.finalPhasePoints, rv: ref.finalPhasePoints },
    { label: "Especiales", bv: baseTeam.specialPoints, rv: ref.specialPoints },
  ] : [];
  const biggestDiff = sections.length > 0
    ? sections.reduce((max, s) => Math.abs(s.bv - s.rv) > Math.abs(max.bv - max.rv) ? s : max).label
    : "—";

  const accentS = (a: boolean) => a ? { background: "rgba(240,65,122,0.15)", color: "#F0417A", borderColor: "#F0417A" } : {};
  const vsTabs = ["Resumen", "Grupos", "Eliminatorias", "Especiales"];

  return (
    <div className="px-4 pt-4 max-w-[640px] mx-auto">
      <div className="animate-fade-in mb-4">
        <h1 className="font-display text-2xl font-extrabold text-text-warm mb-0.5">Versus</h1>
        <p className="text-xs text-text-muted">Cara a cara</p>
      </div>

      {/* Base team selector */}
      {userTeams.length > 1 && (
        <div className="mb-2.5">
          <label className="text-[11px] text-text-muted mb-1 block">Tu equipo base</label>
          <div className="flex gap-1.5 overflow-x-auto">
            {userTeams.map((t, i) => (
              <button key={t.id} className="pill" style={accentS(baseTeamIdx === i)} onClick={() => setBaseTeamIdx(i)}>{t.name}</button>
            ))}
          </div>
        </div>
      )}

      {baseTeam && (
        <div className="card flex items-center gap-3 mb-3 animate-fade-in" style={{ borderLeft: "3px solid #F0417A" }}>
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-warm">{baseTeam.name}</p>
            <p className="text-[11px] text-text-muted">@{user.username} · #{baseTeam.currentRank}</p>
          </div>
          <span className="font-display text-xl font-extrabold text-accent-versus">{baseTeam.totalPoints}</span>
        </div>
      )}

      {/* Mode */}
      <div className="flex gap-1.5 mb-3">
        <button className="pill" style={accentS(mode === "general")} onClick={() => setMode("general")}>General</button>
        <button className="pill" style={accentS(mode === "participante")} onClick={() => setMode("participante")}>Participante</button>
      </div>

      {mode === "participante" && (
        <div className="mb-3">
          <label className="text-[11px] text-text-muted mb-1 block">Rival</label>
          <select className="input-field cursor-pointer" value={rivalId} onChange={(e: any) => setRivalId(e.target.value)}>
            <option value="">Seleccionar rival...</option>
            {otherTeams.map(t => <option key={t.id} value={t.id}>{t.name} (@{t.username})</option>)}
          </select>
        </div>
      )}

      {/* Duel summary */}
      {ref && baseTeam && (
        <div className="card mb-3 animate-fade-in bg-gradient-to-br from-bg-4 to-[rgba(240,65,122,0.03)]" style={{ border: "1px solid rgba(240,65,122,0.12)" }}>
          <p className="font-display text-sm font-bold text-text-warm mb-2.5">Resumen del duelo</p>
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="% iguales" val={`${stats.equalPct}%`} color="#F0417A" />
            <StatBox label="Picks distintos" val={String(stats.diff)} />
            <StatBox label="Diferencia de puntos" val={`${pointDelta >= 0 ? "+" : ""}${pointDelta}`} color={pointDelta >= 0 ? "#27E6AC" : "#FF7AA5"} />
            <StatBox label="Mayor diferencia" val={biggestDiff} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0.5 bg-bg-3 rounded-[10px] p-[3px] overflow-x-auto mb-2.5">
        {vsTabs.map(t => (
          <button key={t} className={`px-3.5 py-2 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap transition-all border-none ${vsTab === t.toLowerCase() ? "bg-bg-5 text-text-primary" : "text-text-muted bg-transparent"}`}
            onClick={() => setVsTab(t.toLowerCase())}>{t}</button>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-1.5 mb-3.5">
        {[{ key: "all", label: "Ver todo" }, { key: "diff", label: "Solo diferencias" }, { key: "same", label: "Solo coincidencias" }].map(f => (
          <button key={f.key} className="pill" style={accentS(vsFilter === f.key)} onClick={() => setVsFilter(f.key)}>{f.label}</button>
        ))}
      </div>

      {/* Tab content */}
      {vsTab === "resumen" && ref && baseTeam && (
        <div className="flex flex-col gap-1.5 animate-fade-in">
          {sections.map((s, si) => {
            const d = s.bv - s.rv;
            return (
              <div key={si} className="card !py-3 !px-3.5">
                <p className="text-[11px] text-text-muted mb-1.5">{s.label}</p>
                <div className="flex items-center justify-between">
                  <div className="text-center"><p className="text-[10px] text-text-muted">{baseTeam.name}</p><p className="font-display text-lg font-extrabold">{s.bv}</p></div>
                  <span className="font-display text-sm font-bold px-2.5 py-0.5 rounded-md" style={{ background: d > 0 ? "#042B22" : d < 0 ? "#2C0714" : "#07090D", color: d > 0 ? "#27E6AC" : d < 0 ? "#FF7AA5" : "#98A3B8" }}>
                    {d > 0 ? "+" : ""}{d}
                  </span>
                  <div className="text-center"><p className="text-[10px] text-text-muted">{refName}</p><p className="font-display text-lg font-extrabold">{s.rv}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {vsTab === "grupos" && baseTeam && (
        <div className="flex flex-col gap-1.5 animate-fade-in">
          {Object.entries(GROUPS).map(([g, teams]) => {
            const baseOrder = baseTeam.groupOrderPicks?.[g] || teams;
            const refOrder = (mode === "participante" && rival) ? (rival.groupOrderPicks?.[g] || teams) : teams;
            const rows = baseOrder.map((t, i) => {
              const refTeam = refOrder[i] || teams[i];
              const same = t === refTeam;
              if (vsFilter === "diff" && same) return null;
              if (vsFilter === "same" && !same) return null;
              return { pos: i + 1, baseTeam: t, refTeam, same };
            }).filter(Boolean);
            if (!rows.length) return null;
            return (
              <div key={g} className="card !p-3">
                <GroupBadge group={g} />
                <div className="mt-2">
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-1 items-center">
                    <p className="text-[10px] font-semibold text-accent-versus text-center">Tu pick</p>
                    <p className="text-[10px] text-text-muted text-center w-5">Pos.</p>
                    <p className="text-[10px] font-semibold text-text-muted text-center">{refName}</p>
                  </div>
                  {rows.map((r: any) => (
                    <div key={r.pos} className="grid grid-cols-[1fr_auto_1fr] gap-1 items-center py-1 border-t border-white/[0.04]">
                      <div className="flex items-center gap-1 justify-center">
                        <Flag country={r.baseTeam} size="sm" /><span className="text-[11px] truncate">{r.baseTeam}</span>
                      </div>
                      <span className="text-[11px] font-bold text-text-muted w-5 text-center">{r.pos}</span>
                      <div className="flex items-center gap-1 justify-center">
                        <Flag country={r.refTeam} size="sm" /><span className={`text-[11px] truncate ${!r.same ? "text-accent-versus" : ""}`}>{r.refTeam}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {vsTab === "eliminatorias" && baseTeam && (
        <div className="flex flex-col gap-2 animate-fade-in">
          {KNOCKOUT_ROUND_DEFS.map(rd => {
            const basePicks = baseTeam.knockoutPicks?.[rd.key] || [];
            const refPicks = (mode === "participante" && rival) ? (rival.knockoutPicks?.[rd.key] || []) : [];
            const baseCountries = basePicks.map(p => p.country);
            const refCountries = refPicks.map(p => p.country);
            const rows = baseCountries.map(c => {
              const inRef = refCountries.includes(c);
              if (vsFilter === "diff" && inRef) return null;
              if (vsFilter === "same" && !inRef) return null;
              return { country: c, same: inRef };
            }).filter(Boolean);
            if (!rows.length) return null;
            return (
              <div key={rd.key}>
                <h4 className="font-display text-sm font-bold text-text-muted mb-1.5">{rd.name}</h4>
                <div className="flex flex-wrap gap-1">
                  {rows.map((r: any, i: number) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]"
                      style={{ background: r.same ? "#042B22" : "rgba(240,65,122,0.08)", color: r.same ? "#27E6AC" : "#F0417A", border: `1px solid ${r.same ? "#27E6AC33" : "#F0417A33"}` }}>
                      <Flag country={r.country} size="sm" /> {r.country}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {/* Champion comparison */}
          <div className="card !p-3 text-center !border-gold/15 bg-gold/[0.03]">
            <p className="text-[10px] text-gold font-semibold mb-1">Campeón</p>
            <div className="flex items-center justify-center gap-3">
              <div className="text-center"><Flag country={baseTeam.championPick} /><p className="text-[10px] mt-0.5">{baseTeam.championPick}</p></div>
              <span className="font-display text-sm font-extrabold text-gold">vs</span>
              <div className="text-center">
                <Flag country={mode === "participante" && rival ? rival.championPick : baseTeam.championPick} />
                <p className="text-[10px] mt-0.5">{mode === "participante" && rival ? rival.championPick : consensusSpecials.mejorJugador ? "Consenso" : "—"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {vsTab === "especiales" && baseTeam && (
        <div className="flex flex-col gap-1 animate-fade-in">
          {filteredSpecials.map((s, i) => (
            <div key={i} className="card !py-2.5 !px-3">
              <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">{s.label}</p>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                <div className="text-center">
                  <p className="text-xs font-semibold text-accent-versus">{s.isCountry ? <CountryWithFlag country={s.baseVal} /> : s.baseVal}</p>
                </div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${s.same ? "bg-success/20 text-success" : "bg-accent-versus/20 text-accent-versus"}`}>
                  {s.same ? "=" : "≠"}
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-text-muted">{s.isCountry ? <CountryWithFlag country={s.refVal} /> : s.refVal}</p>
                </div>
              </div>
            </div>
          ))}
          {filteredSpecials.length === 0 && <EmptyState text={vsFilter === "same" ? "No hay coincidencias en especiales" : "No hay diferencias en especiales"} />}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, val, color }: { label: string; val: string; color?: string }) {
  return (
    <div className="p-2.5 bg-bg-2 rounded-lg text-center">
      <p className="text-[10px] text-text-muted">{label}</p>
      <p className="font-display text-[22px] font-extrabold" style={{ color: color || "#F6F7FB" }}>{val}</p>
    </div>
  );
}
