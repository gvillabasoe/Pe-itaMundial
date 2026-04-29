"use client";

import Image from "next/image";
import { GROUP_COLORS } from "@/lib/data";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";

// ⚠️ NO TOCAR — estructura de banderas conservada exactamente como estaba.
// Mapa de emojis Unicode + excepción de Inglaterra como imagen PNG.

const FLAG_EMOJI: Record<string, string> = {
  "México": "🇲🇽", "Sudáfrica": "🇿🇦", "Corea del Sur": "🇰🇷", "Chequia": "🇨🇿",
  "Canadá": "🇨🇦", "Bosnia y Herzegovina": "🇧🇦", "Catar": "🇶🇦", "Suiza": "🇨🇭",
  "Brasil": "🇧🇷", "Marruecos": "🇲🇦", "Haití": "🇭🇹", "Escocia": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "Estados Unidos": "🇺🇸", "Paraguay": "🇵🇾", "Australia": "🇦🇺", "Turquía": "🇹🇷",
  "Alemania": "🇩🇪", "Curazao": "🇨🇼", "Costa de Marfil": "🇨🇮", "Ecuador": "🇪🇨",
  "Países Bajos": "🇳🇱", "Japón": "🇯🇵", "Suecia": "🇸🇪", "Túnez": "🇹🇳",
  "Bélgica": "🇧🇪", "Egipto": "🇪🇬", "Irán": "🇮🇷", "Nueva Zelanda": "🇳🇿",
  "España": "🇪🇸", "Cabo Verde": "🇨🇻", "Arabia Saudí": "🇸🇦", "Uruguay": "🇺🇾",
  "Francia": "🇫🇷", "Senegal": "🇸🇳", "Irak": "🇮🇶", "Noruega": "🇳🇴",
  "Argentina": "🇦🇷", "Argelia": "🇩🇿", "Austria": "🇦🇹", "Jordania": "🇯🇴",
  "Portugal": "🇵🇹", "RD Congo": "🇨🇩", "Uzbekistán": "🇺🇿", "Colombia": "🇨🇴",
  "Inglaterra": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Croacia": "🇭🇷", "Ghana": "🇬🇭", "Panamá": "🇵🇦",
};

const EMOJI_SIZES: Record<string, string> = {
  sm: "text-base leading-none",
  md: "text-xl leading-none",
  lg: "text-[28px] leading-none",
};

const IMG_SIZES = { sm: 20, md: 28, lg: 36 };

export function Flag({ country, size = "md", className = "" }: { country: string; size?: "sm" | "md" | "lg"; className?: string }) {
  // ⚠️ Inglaterra → PNG (única excepción) — NO tocar
  if (country === "Inglaterra") {
    const px = IMG_SIZES[size];
    return (
      <Image
        src="/flags/Inglaterra.png"
        alt="Inglaterra"
        width={px}
        height={Math.round(px * 0.67)}
        className={`rounded-[3px] object-cover ${className}`}
      />
    );
  }

  const emoji = FLAG_EMOJI[country];
  if (emoji) {
    return (
      <span className={`${EMOJI_SIZES[size]} ${className}`} role="img" aria-label={country}>
        {emoji}
      </span>
    );
  }

  const px = IMG_SIZES[size];
  return (
    <span
      className={`inline-flex items-center justify-center rounded text-[9px] ${className}`}
      style={{
        width: px,
        height: Math.round(px * 0.67),
        background: "rgb(var(--bg-muted))",
        color: "rgb(var(--text-muted))",
      }}
      aria-label={country}
    >
      ?
    </span>
  );
}

export function CountryWithFlag({ country, size = "sm", className = "" }: { country: string; size?: "sm" | "md"; className?: string }) {
  if (!country) return null;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Flag country={country} size={size} />
      <span>{country}</span>
    </span>
  );
}

export function GroupBadge({ group }: { group: string }) {
  const color = GROUP_COLORS[group] ?? "#7B879C";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold tracking-widest uppercase"
      style={{ background: `${color}22`, color, border: `1px solid ${color}40` }}
    >
      Grupo {group}
    </span>
  );
}

export function SectionTitle({ children, accent, icon: Icon, right }: { children: React.ReactNode; accent?: string; icon?: LucideIcon; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} style={{ color: accent ?? "rgb(var(--gold))" }} />}
        <h2 className="font-display text-base font-bold tracking-tight text-text-warm">{children}</h2>
      </div>
      {right}
    </div>
  );
}

export function EmptyState({ text, icon: Icon }: { text: string; icon?: LucideIcon }) {
  return (
    <div className="card text-center py-10">
      {Icon && <Icon size={28} className="mx-auto mb-2.5 text-text-faint" />}
      <p className="text-sm text-text-muted">{text}</p>
    </div>
  );
}

export function DemoBadge() {
  return <span className="badge badge-muted text-[9px]">Demo</span>;
}

// ─── Pick chip (Phase 3 nuevo) ─────────────────────

export type PickStatus = "correct" | "sign" | "wrong" | "pending";

export function PickChip({ status, points, className = "" }: { status: PickStatus; points?: number | null; className?: string }) {
  const config = {
    correct: { cls: "pick-chip-correct", icon: "⭐", label: points != null ? `+${points}` : "Exacto" },
    sign: { cls: "pick-chip-sign", icon: "✅", label: points != null ? `+${points}` : "Signo" },
    wrong: { cls: "pick-chip-wrong", icon: "❌", label: "0" },
    pending: { cls: "pick-chip-pending", icon: "·", label: "—" },
  }[status];

  return (
    <span className={`pick-chip ${config.cls} ${className}`} aria-label={`Estado: ${status}`}>
      <span aria-hidden="true">{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

// ─── Skeleton ──────────────────────────────────────

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function SkeletonText({ lines = 1, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} style={{ height: 12, width: i === lines - 1 ? "60%" : "100%" }} />
      ))}
    </div>
  );
}

// ─── Initials Avatar ───────────────────────────────

export function InitialsAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("") || "?";

  const hash = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = hash % 360;
  const bg = `hsl(${hue}, 45%, 92%)`;
  const fg = `hsl(${hue}, 50%, 30%)`;

  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-display font-bold flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: Math.max(10, Math.round(size * 0.35)),
        border: "1px solid rgba(0,0,0,0.04)",
      }}
      aria-label={name}
    >
      {initials}
    </span>
  );
}

// ─── Medal ─────────────────────────────────────────

export function Medal({ rank, size = 18 }: { rank: number; size?: number }) {
  if (rank > 3 || rank < 1) return null;
  const emoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
  return (
    <span style={{ fontSize: size, lineHeight: 1 }} role="img" aria-label={`Puesto ${rank}`}>
      {emoji}
    </span>
  );
}

// ─── Countdown ─────────────────────────────────────

export function Countdown({ target }: { target: string }) {
  const [diff, setDiff] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    const t = new Date(target).getTime();
    const tick = () => {
      const rem = Math.max(0, t - Date.now());
      setDiff({
        d: Math.floor(rem / 86400000),
        h: Math.floor((rem % 86400000) / 3600000),
        m: Math.floor((rem % 3600000) / 60000),
        s: Math.floor((rem % 60000) / 1000),
      });
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [target]);

  const units = [
    { val: diff.d, label: "días" },
    { val: diff.h, label: "h" },
    { val: diff.m, label: "min" },
    { val: diff.s, label: "seg" },
  ];

  return (
    <div className="flex gap-2 justify-center">
      {units.map((u, i) => (
        <div key={i} className="text-center">
          <div
            className={`font-display text-[26px] font-black rounded-xl px-3 py-2 min-w-[54px] tabular-nums ${i === 3 ? "animate-count-pulse" : ""}`}
            style={{
              background: "rgb(var(--gold-soft))",
              color: "rgb(var(--gold))",
              border: "1px solid rgba(var(--gold), 0.2)",
            }}
          >
            {String(u.val).padStart(2, "0")}
          </div>
          <span className="text-[9px] text-text-muted mt-1 block uppercase tracking-widest">{u.label}</span>
        </div>
      ))}
    </div>
  );
}
