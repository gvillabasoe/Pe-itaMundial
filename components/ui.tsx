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

  useEffect(() => {
    setImgError(false);
  }, [country, flagPath]);
  const px = FLAG_SIZES[size];

  if (flagPath && !imgError) {
    return (
      <Image
        src={flagPath}
        alt={country}
        width={px}
        height={Math.round(px * 0.67)}
        className={`rounded-[4px] border object-cover shadow-[0_4px_10px_rgba(var(--shadow-color),0.12)] ${className}`}
        style={{ borderColor: "rgba(var(--divider),0.1)", background: "rgba(var(--surface-soft),0.05)" }}
        onError={() => setImgError(true)}
      />
    );
  }

  const fontSize = size === "sm" ? "text-sm" : size === "lg" ? "text-[20px]" : "text-base";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[6px] border px-1.5 py-0.5 leading-none shadow-[0_4px_10px_rgba(var(--shadow-color),0.08)] ${fontSize} ${className}`}
      style={{ borderColor: "rgba(var(--divider),0.1)", background: "rgba(var(--surface-soft),0.06)" }}
      role="img"
      aria-label={country}
    >
      {emoji}
    </span>
  );
}

export function CountryWithFlag({ country, size = "sm" }: { country: string; size?: "sm" | "md" }) {
  if (!country) return null;
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <Flag country={country} size={size} />
      <span>{country}</span>
    </span>
  );
}

export function GroupBadge({ group }: { group: string }) {
  const color = GROUP_COLORS[group] || "#98A3B8";
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      style={{ background: `${color}1F`, color, borderColor: `${color}38` }}
    >
      Grupo {group}
    </span>
  );
}

export function SectionTitle({ children, accent, icon: Icon, right }: { children: ReactNode; accent?: string; icon?: LucideIcon; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon ? (
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-[rgb(var(--divider)/0.08)] bg-[rgb(var(--bg-3)/0.7)] shadow-[0_8px_18px_rgba(var(--shadow-color),0.08)]">
            <Icon size={17} style={{ color: accent || "#D4AF37" }} />
          </span>
        ) : null}
        <div>
          <h2 className="font-display text-lg font-bold text-text-warm">{children}</h2>
          <div className="mt-1 h-[2px] w-12 rounded-full" style={{ background: `linear-gradient(90deg, ${accent || "#D4AF37"}, transparent)` }} />
        </div>
      </div>
      {right}
    </div>
  );
}

export function EmptyState({ text, title = "Nada que mostrar", icon: Icon, action }: { text: string; title?: string; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <div className="empty-state">
      {Icon ? (
        <span className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-[16px] border border-[rgb(var(--divider)/0.08)] bg-[rgb(var(--bg-3)/0.72)] text-text-muted shadow-[0_12px_24px_rgba(var(--shadow-color),0.12)]">
          <Icon size={22} className="opacity-70" />
        </span>
      ) : null}
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
