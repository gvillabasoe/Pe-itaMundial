"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { getFlagEmoji, getFlagPath } from "@/lib/flags";
import { GROUP_COLORS } from "@/lib/data";

const FLAG_SIZES = { sm: 18, md: 22, lg: 30 } as const;

export function Flag({ country, size = "md", className = "" }: { country: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const flagPath = getFlagPath(country);
  const [imgError, setImgError] = useState(false);
  const emoji = getFlagEmoji(country);
  const px = FLAG_SIZES[size];

  if (flagPath && !imgError) {
    return (
      <Image
        src={flagPath}
        alt={country}
        width={px}
        height={Math.round(px * 0.67)}
        className={`rounded-[3px] object-cover ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  const fontSize = size === "sm" ? "text-base" : size === "lg" ? "text-[28px]" : "text-xl";
  return (
    <span className={`${fontSize} leading-none ${className}`} role="img" aria-label={country}>
      {emoji}
    </span>
  );
}

export function CountryWithFlag({ country, size = "sm" }: { country: string; size?: "sm" | "md" }) {
  if (!country) return null;
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <Flag country={country} size={size} />
      <span>{country}</span>
    </span>
  );
}

export function GroupBadge({ group }: { group: string }) {
  const color = GROUP_COLORS[group] || "#98A3B8";
  return (
    <span
      className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide"
      style={{ background: `${color}22`, color, borderColor: `${color}44` }}
    >
      Grupo {group}
    </span>
  );
}

export function SectionTitle({ children, accent, icon: Icon, right }: { children: ReactNode; accent?: string; icon?: LucideIcon; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {Icon ? <Icon size={18} style={{ color: accent || "#D4AF37" }} /> : null}
        <h2 className="font-display text-lg font-bold text-text-warm">{children}</h2>
      </div>
      {right}
    </div>
  );
}

export function EmptyState({ text, title = "Nada que mostrar", icon: Icon, action }: { text: string; title?: string; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <div className="empty-state">
      {Icon ? <Icon size={28} className="mb-2 opacity-40" /> : null}
      <p className="empty-state__kicker">Estado</p>
      <h3 className="empty-state__title">{title}</h3>
      <p className="empty-state__text">{text}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function Countdown({ target }: { target: string }) {
  const [diff, setDiff] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    const targetTime = new Date(target).getTime();
    const tick = () => {
      const remaining = Math.max(0, targetTime - Date.now());
      setDiff({
        d: Math.floor(remaining / 86400000),
        h: Math.floor((remaining % 86400000) / 3600000),
        m: Math.floor((remaining % 3600000) / 60000),
        s: Math.floor((remaining % 60000) / 1000),
      });
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [target]);

  const items = [
    { label: "días", value: diff.d },
    { label: "horas", value: diff.h },
    { label: "min", value: diff.m },
    { label: "seg", value: diff.s },
  ];

  return (
    <div className="flex justify-center gap-2.5">
      {items.map((item, index) => (
        <div key={item.label} className="text-center">
          <div className={`countdown-chip ${index === 3 ? "animate-count-pulse" : ""}`}>
            {String(item.value).padStart(2, "0")}
          </div>
          <span className="mt-1 block text-[10px] text-text-muted">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function DemoBadge() {
  return <span className="demo-badge">Datos demo</span>;
}
