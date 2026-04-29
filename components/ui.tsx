"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { getFlagPath } from "@/lib/flags";
import { GROUP_COLORS } from "@/lib/data";

// ════════════════════════════════════════════════════════════════
// ⚠️  ESTRUCTURA DE BANDERAS — CONSERVADA EXACTAMENTE COMO ESTABA
// ════════════════════════════════════════════════════════════════
// Flag usa getFlagPath() para servir PNG desde /public/flags con
// fallback a iniciales. NO tocar.

const FLAG_SIZES = { sm: 18, md: 22, lg: 30 } as const;

function getFlagFallbackLabel(country: string) {
  const letters = country
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() || "")
    .join("");

  return letters || country.slice(0, 2).toUpperCase() || "--";
}

export function Flag({ country, size = "md", className = "" }: { country: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const flagPath = getFlagPath(country);
  const [imgError, setImgError] = useState(false);

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

  const fontSize = size === "sm" ? "text-[9px]" : size === "lg" ? "text-[11px]" : "text-[10px]";
  const fallbackLabel = getFlagFallbackLabel(country);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-[6px] border px-1.5 py-0.5 font-bold uppercase tracking-[0.12em] leading-none shadow-[0_4px_10px_rgba(var(--shadow-color),0.08)] ${fontSize} ${className}`}
      style={{ borderColor: "rgba(var(--divider),0.1)", background: "rgba(var(--surface-soft),0.06)", minWidth: px, minHeight: Math.round(px * 0.67) }}
      aria-label={country}
      title={country}
    >
      {fallbackLabel}
    </span>
  );
}

// ─── CountryWithFlag ──────────────────────────────────

export function CountryWithFlag({ country, size = "sm" }: { country: string; size?: "sm" | "md" }) {
  if (!country) return null;
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <Flag country={country} size={size} />
      <span>{country}</span>
    </span>
  );
}

// ─── GroupBadge ───────────────────────────────────────

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

// ─── SectionTitle ─────────────────────────────────────

export function SectionTitle({ children, accent, icon: Icon, right }: { children: ReactNode; accent?: string; icon?: LucideIcon; right?: ReactNode }) {
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

// ─── EmptyState ───────────────────────────────────────

export function EmptyState({ text, icon: Icon }: { text: string; icon?: LucideIcon }) {
  return (
    <div className="card text-center py-10">
      {Icon && <Icon size={28} className="mx-auto mb-2.5 text-text-faint" />}
      <p className="text-sm text-text-muted">{text}</p>
    </div>
  );
}

// ─── DemoBadge ────────────────────────────────────────

export function DemoBadge() {
  return <span className="badge badge-muted text-[9px]">Demo</span>;
}

// ────────────────────────────────────────────────────────────────
// CountrySelectionPreview — re-export para compatibilidad con
// admin/page.tsx y mi-porra-builder.tsx. Renderiza una lista
// horizontal de banderas + nombre con label opcional.
// ────────────────────────────────────────────────────────────────

interface CountrySelectionPreviewProps {
  countries: Array<string | null | undefined>;
  label?: string;
  emptyText?: string;
  size?: "sm" | "md";
  showRank?: boolean;
  className?: string;
}

export function CountrySelectionPreview({
  countries,
  label,
  emptyText = "Sin selección",
  size = "sm",
  showRank = false,
  className = "",
}: CountrySelectionPreviewProps) {
  const valid = countries.filter((c): c is string => Boolean(c && String(c).trim()));

  if (valid.length === 0) {
    return (
      <div className={`flex items-center gap-2 text-[11px] text-text-muted ${className}`}>
        {label ? <span className="font-semibold uppercase tracking-wider text-[9px]">{label}:</span> : null}
        <span>{emptyText}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {label ? (
        <span className="font-semibold uppercase tracking-wider text-[9px] text-text-muted">{label}:</span>
      ) : null}
      {valid.map((country, index) => (
        <span
          key={`${country}-${index}`}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]"
          style={{
            borderColor: "rgb(var(--border-subtle))",
            background: "rgb(var(--bg-elevated))",
            color: "rgb(var(--text-secondary))",
          }}
        >
          {showRank ? (
            <span className="font-bold text-text-muted">{index + 1}.</span>
          ) : null}
          <Flag country={country} size={size} />
          <span className="font-medium">{country}</span>
        </span>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// MatchupWithFlags — re-export para compatibilidad con app/page.tsx
// Renderiza dos selecciones enfrentadas con un separador "vs".
// ────────────────────────────────────────────────────────────────

interface MatchupWithFlagsProps {
  homeTeam: string;
  awayTeam: string;
  size?: "sm" | "md" | "lg";
  separator?: string;
  highlight?: "home" | "away" | null;
  className?: string;
}

export function MatchupWithFlags({
  homeTeam,
  awayTeam,
  size = "sm",
  separator = "vs",
  highlight = null,
  className = "",
}: MatchupWithFlagsProps) {
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <span
        className={`inline-flex items-center gap-1 ${
          highlight === "home" ? "font-semibold text-text-warm" : ""
        }`}
      >
        <Flag country={homeTeam} size={size} />
        <span className="text-xs">{homeTeam}</span>
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        {separator}
      </span>
      <span
        className={`inline-flex items-center gap-1 ${
          highlight === "away" ? "font-semibold text-text-warm" : ""
        }`}
      >
        <span className="text-xs">{awayTeam}</span>
        <Flag country={awayTeam} size={size} />
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Phase 3 — Componentes nuevos para UI premium light-first
// ────────────────────────────────────────────────────────────────

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

export function InitialsAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("") || "?";

  // Color determinístico desde el nombre — consistente entre renders
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

export function Medal({ rank, size = 18 }: { rank: number; size?: number }) {
  if (rank > 3 || rank < 1) return null;
  const emoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
  return (
    <span style={{ fontSize: size, lineHeight: 1 }} role="img" aria-label={`Puesto ${rank}`}>
      {emoji}
    </span>
  );
}

// ─── Countdown ────────────────────────────────────────

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
