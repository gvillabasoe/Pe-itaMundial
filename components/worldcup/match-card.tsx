"use client";

import Image from "next/image";
import { MapPin } from "lucide-react";
import type { WorldCupMatch } from "@/lib/worldcup/schedule";
import { getFlagForTeam } from "@/lib/worldcup/normalize-team";
import { getCityColor, getCityBgColor, getZoneForCity, REGION_LABELS } from "@/lib/worldcup/zones";
import { useEffect, useState } from "react";

function getFlagFallbackLabel(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() || "")
    .join("");

  return letters || name.slice(0, 2).toUpperCase() || "--";
}

function TeamFlag({ name, size = 20 }: { name: string; size?: number }) {
  const src = getFlagForTeam(name);
  const [err, setErr] = useState(false);

  useEffect(() => {
    setErr(false);
  }, [name, src]);

  if (!src || err) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-[6px] border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] leading-none shadow-[0_4px_10px_rgba(var(--shadow-color),0.08)]"
        style={{ borderColor: "rgba(var(--divider),0.1)", background: "rgba(var(--surface-soft),0.06)", minWidth: size, minHeight: Math.round(size * 0.67) }}
        aria-label={name}
        title={name}
      >
        {getFlagFallbackLabel(name)}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={name}
      width={size}
      height={Math.round(size * 0.67)}
      className="rounded-[4px] border object-cover shadow-[0_4px_10px_rgba(var(--shadow-color),0.12)]"
      style={{ borderColor: "rgba(var(--divider),0.1)", background: "rgba(var(--surface-soft),0.05)" }}
      onError={() => setErr(true)}
    />
  );
}

export function MatchCard({ match, highlightSpain = true }: { match: WorldCupMatch; highlightSpain?: boolean }) {
  const isSpain = match.homeTeam === "España" || match.awayTeam === "España";
  const cityColor = getCityColor(match.hostCity);
  const zone = getZoneForCity(match.hostCity);

  return (
    <div className={`card !py-2.5 !px-3 mb-1 ${isSpain && highlightSpain ? "!border-l-[3px]" : ""}`}
      style={isSpain && highlightSpain ? { borderLeftColor: "#C1121F" } : undefined}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-text-muted font-mono">#{match.id}</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold"
          style={{ background: getCityBgColor(match.hostCity), color: cityColor, border: `1px solid ${cityColor}33` }}>
          <MapPin size={9} /> {match.hostCity}
        </span>
      </div>
      <div className="flex items-center justify-center gap-2">
        <div className="flex-1 text-right flex items-center justify-end gap-1.5">
          <span className={`text-xs font-medium ${isSpain && match.homeTeam === "España" ? "text-text-warm font-semibold" : ""}`}>{match.homeTeam}</span>
          <TeamFlag name={match.homeTeam} />
        </div>
        <div className="font-display text-sm font-bold text-text-muted bg-bg-2 rounded-md px-2.5 py-1 min-w-[42px] text-center">
          vs
        </div>
        <div className="flex-1 text-left flex items-center gap-1.5">
          <TeamFlag name={match.awayTeam} />
          <span className={`text-xs font-medium ${isSpain && match.awayTeam === "España" ? "text-text-warm font-semibold" : ""}`}>{match.awayTeam}</span>
        </div>
      </div>
      {zone ? <div className="mt-2 text-[10px] text-text-muted">Zona: {REGION_LABELS[zone]}</div> : null}
    </div>
  );
}
