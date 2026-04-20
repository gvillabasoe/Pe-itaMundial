"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { CountryWithFlag, EmptyState, Flag, GroupBadge } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import { FIXTURES, GROUPS, GROUP_COLORS, KNOCKOUT_ROUND_DEFS, compareSpecials, computeConsensusSpecials, computeVersusStats } from "@/lib/data";
import { useScoredParticipants } from "@/lib/use-scored-participants";

export default function VersusPage() {
  const { user } = useAuth();
  const { participants } = useScoredParticipants();
  const [mode, setMode] = useState<"general" | "participante">("general");
  const [rivalId, setRivalId] = useState("");
  const [vsTab, setVsTab] = useState("resumen");
  const [vsFilter, setVsFilter] = useState("all");
  const [baseTeamIdx, setBaseTeamIdx] = useState(0);

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

  const userTeams = participants.filter((participant) => participant.userId === user.id);
  const baseTeam = userTeams[baseTeamIdx] || userTeams[0];
  const otherTeams = participants.filter((participant) => participant.userId !== user.id);
  const rival = mode === "participante" ? (otherTeams.find((participant) => participant.id === rivalId) || null) : null;

  const consensusSpecials = useMemo(() => computeConsensusSpecials(participants), [participants]);
  const consensusPoints = useMemo(() => ({
    name: "Consenso",
    username: "General",
    totalPoints: Math.round(participants.reduce((sum, participant) => sum + participant.totalPoints, 0) / Math.max(participants.length, 1)),
    groupPoints: Math.round(participants.reduce((sum, participant) => sum + participant.groupPoints, 0) / Math.max(participants.length, 1)),
    finalPhasePoints: Math.round(participants.reduce((sum, participant) => sum + participant.finalPhasePoints, 0) / Math.max(participants.length, 1)),
    specialPoints: Math.round(participants.reduce((sum, participant) => sum + participant.specialPoints, 0) / Math.max(participants.length, 1)),
  }), [participants]);

  const referenceTeam = mode === "general" ? consensusPoints : rival;
  const referenceName = mode === "general" ? "Consenso" : rival?.name || "—";

  const stats = useMemo(() => {
    if (!baseTeam) return { same: 0, diff: 0, total: 0, equalPct: 0 };
    if (mode === "participante" && rival) return computeVersusStats(baseTeam, rival);

    const average = { same: 0, diff: 0, total: 0, equalPct: 0 };
    let totalSame = 0;
    let totalDiff = 0;

    for (const participant of otherTeams.slice(0, 5)) {
      const result = computeVersusStats(baseTeam, participant);
      totalSame += result.same;
      totalDiff += result.diff;
    }

    const count = Math.min(otherTeams.length, 5);
    average.same = count > 0 ? Math.round(totalSame / count) : 0;
    average.diff = count > 0 ? Math.round(totalDiff / count) : 0;
    average.total = average.same + average.diff;
    average.equalPct = average.total > 0 ? Math.round((average.same / average.total) * 100) : 0;

    return average;
  }, [baseTeam, mode, otherTeams, rival]);

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

  const sections = baseTeam && referenceTeam ? [
    { label: "Fase de grupos", baseValue: baseTeam.groupPoints, referenceValue: referenceTeam.groupPoints },
    { label: "Eliminatorias", baseValue: baseTeam.finalPhasePoints, referenceValue: referenceTeam.finalPhasePoints },
    { label: "Especiales", baseValue: baseTeam.specialPoints, referenceValue: referenceTeam.specialPoints },
  ] : [];

  const biggestDiff = sections.length > 0
    ? sections.reduce((max, section) => Math.abs(section.baseValue - section.referenceValue) > Math.abs(max.baseValue - max.referenceValue) ? section : max).label
    : "—";

  const accentStyle = (active: boolean) => active ? { background: "rgba(240,65,122,0.15)", color: "#F0417A", borderColor: "#F0417A" } : {};
  const tabs = ["Resumen", "Grupos", "Eliminatorias", "Especiales"];

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
              <button key={team.id} className="pill" style={accentStyle(baseTeamIdx === index)} onClick={() => setBaseTeamIdx(index)}>{team.name}</button>
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
          <select className="input-field cursor-pointer" value={rivalId} onChange={(event) => setRivalId(event.target.value)}>
            <option value="">Seleccionar rival...</option>
            {otherTeams.map((team) => <option key={team.id} value={team.id}>{team.name} (@{team.username})</option>)}
          </select>
        </div>
      ) : null}

      {referenceTeam && baseTeam ? (
        <div className="card mb-3 animate-fade-in bg-gradient-to-br from-bg-4 to-[rgba(240,65,122,0.03)]" style={{ border: "1px solid rgba(240,65,122,0.12)" }}>
          <p className="mb-2.5 font-display text-sm font-bold text-text-warm">Resumen</p>
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="% iguales" value={`${stats.equalPct}%`} color="#F0417A" />
            <StatBox label="Picks distintos" value={String(stats.diff)} />
            <StatBox label="Diferencia de puntos" value={`${pointDelta >= 0 ? "+" : ""}${pointDelta}`} color={pointDelta >= 0 ? "#27E6AC" : "#FF7AA5"} />
            <StatBox label="Mayor diferencia" value={biggestDiff} />
          </div>
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
          <button key={item.key} className="pill" style={accentStyle(vsFilter === item.key)} onClick={() => setVsFilter(item.key)}>{item.label}</button>
        ))}
      </div>

      {vsTab === "resumen" && referenceTeam && baseTeam ? (
        <div className="flex flex-col gap-1.5 animate-fade-in">
          {sections.map((section) => {
            const delta = section.baseValue - section.referenceValue;
            return (
              <div key={section.label} className="card !px-3.5 !py-3">
                <p className="mb-1.5 text-[11px] text-text-muted">{section.label}</p>
                <div className="flex items-center justify-between">
                  <div className="text-center"><p className="text-[10px] text-text-muted">{baseTeam.name}</p><p className="font-display text-lg font-extrabold">{section.baseValue}</p></div>
                  <span className="rounded-md px-2.5 py-0.5 font-display text-sm font-bold" style={{ background: delta > 0 ? "#042B22" : delta < 0 ? "#2C0714" : "#07090D", color: delta > 0 ? "#27E6AC" : delta < 0 ? "#FF7AA5" : "#98A3B8" }}>
                    {delta > 0 ? "+" : ""}{delta}
                  </span>
                  <div className="text-center"><p className="text-[10px] text-text-muted">{referenceName}</p><p className="font-display text-lg font-extrabold">{section.referenceValue}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {vsTab === "grupos" && baseTeam ? (
        <div className="flex flex-col gap-1.5 animate-fade-in">
          {Object.entries(GROUPS).map(([group, teams]) => {
            const baseOrder = baseTeam.groupOrderPicks?.[group] || teams;
            const referenceOrder = mode === "participante" && rival ? (rival.groupOrderPicks?.[group] || teams) : teams;
            const rows = baseOrder.map((country, index) => {
              const referenceCountry = referenceOrder[index] || teams[index];
              const same = country === referenceCountry;
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
                  {rows.map((row: any) => (
                    <div key={`${group}-${row.position}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 border-t border-[rgb(var(--divider)/0.06)] py-1">
                      <div className="flex items-center justify-center gap-1"><Flag country={row.country} size="sm" /><span className="truncate text-[11px]">{row.country}</span></div>
                      <span className="w-5 text-center text-[11px] font-bold text-text-muted">{row.position}</span>
                      <div className="flex items-center justify-center gap-1"><Flag country={row.referenceCountry} size="sm" /><span className={`truncate text-[11px] ${!row.same ? "text-accent-versus" : ""}`}>{row.referenceCountry}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {vsTab === "eliminatorias" && baseTeam ? (
        <div className="flex flex-col gap-2 animate-fade-in">
          {KNOCKOUT_ROUND_DEFS.map((round) => {
            const basePicks = baseTeam.knockoutPicks?.[round.key] || [];
            const referencePicks = mode === "participante" && rival ? (rival.knockoutPicks?.[round.key] || []) : [];
            const baseCountries = basePicks.map((pick) => pick.country);
            const referenceCountries = referencePicks.map((pick) => pick.country);
            const rows = baseCountries.map((country) => {
              const inReference = referenceCountries.includes(country);
              if (vsFilter === "diff" && inReference) return null;
              if (vsFilter === "same" && !inReference) return null;
              return { country, same: inReference };
            }).filter(Boolean);

            if (!rows.length) return null;

            return (
              <div key={round.key}>
                <h4 className="mb-1.5 font-display text-sm font-bold text-text-muted">{round.name}</h4>
                <div className="flex flex-wrap gap-1">
                  {rows.map((row: any, index: number) => (
                    <span key={`${round.key}-${index}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px]" style={{ background: row.same ? "#042B22" : "rgba(240,65,122,0.08)", color: row.same ? "#27E6AC" : "#F0417A", border: `1px solid ${row.same ? "#27E6AC33" : "#F0417A33"}` }}>
                      <Flag country={row.country} size="sm" /> {row.country}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="card bg-gold/[0.03] !border-gold/15 !p-3 text-center">
            <p className="mb-1 text-[10px] font-semibold text-gold">Campeón</p>
            <div className="flex items-center justify-center gap-3">
              <div className="text-center"><Flag country={baseTeam.championPick} /><p className="mt-0.5 text-[10px]">{baseTeam.championPick}</p></div>
              <span className="font-display text-sm font-extrabold text-gold">vs</span>
              <div className="text-center">
                <Flag country={mode === "participante" && rival ? rival.championPick : baseTeam.championPick} />
                <p className="mt-0.5 text-[10px]">{mode === "participante" && rival ? rival.championPick : consensusSpecials.mejorJugador ? "Consenso" : "—"}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {vsTab === "especiales" && baseTeam ? (
        <div className="flex flex-col gap-1 animate-fade-in">
          {filteredSpecials.map((item) => (
            <div key={item.label} className="card !px-3 !py-2.5">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-text-muted">{item.label}</p>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="text-center">
                  <p className="text-xs font-semibold text-accent-versus">{item.isCountry ? <CountryWithFlag country={item.baseVal} /> : item.baseVal}</p>
                </div>
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${item.same ? "bg-success/20 text-success" : "bg-accent-versus/20 text-accent-versus"}`}>
                  {item.same ? "=" : "≠"}
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-text-muted">{item.isCountry ? <CountryWithFlag country={item.refVal} /> : item.refVal}</p>
                </div>
              </div>
            </div>
          ))}
          {filteredSpecials.length === 0 ? <EmptyState text={vsFilter === "same" ? "No hay coincidencias en especiales" : "No hay diferencias en especiales"} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-bg-2 p-2.5 text-center">
      <p className="text-[10px] text-text-muted">{label}</p>
      <p className="font-display text-[22px] font-extrabold" style={{ color: color || "rgb(var(--text-primary))" }}>{value}</p>
    </div>
  );
}
