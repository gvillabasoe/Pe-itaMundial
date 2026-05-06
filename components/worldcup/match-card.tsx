"use client";

import { MapPin } from "lucide-react";
import type { WorldCupMatch } from "@/lib/worldcup/schedule";
import { getCityColor, getCityBgColor, getZoneForCity, REGION_LABELS } from "@/lib/worldcup/zones";
import { Flag } from "@/components/ui";

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
          <Flag country={match.homeTeam} size="sm" />
        </div>
        <div className="font-display text-sm font-bold text-text-muted bg-bg-2 rounded-md px-2.5 py-1 min-w-[42px] text-center">
          vs
        </div>
        <div className="flex-1 text-left flex items-center gap-1.5">
          <Flag country={match.awayTeam} size="sm" />
          <span className={`text-xs font-medium ${isSpain && match.awayTeam === "España" ? "text-text-warm font-semibold" : ""}`}>{match.awayTeam}</span>
        </div>
      </div>
      {zone ? <div className="mt-2 text-[10px] text-text-muted">Zona: {REGION_LABELS[zone]}</div> : null}
    </div>
  );
}
