"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Activity, BookOpen, ChevronRight, Shield, Swords, Trophy, TrendingUp } from "lucide-react";
import { Countdown, MatchupWithFlags, SectionTitle } from "@/components/ui";
import { ACTIVITY, SCORING } from "@/lib/data";
import { useScoredParticipants } from "@/lib/use-scored-participants";

const QUICK_LINKS = [
  {
    href: "/resultados",
    label: "Resultados",
    icon: Trophy,
    color: "#D4AF37",
    cardStyle: {},
  },
  {
    href: "/probabilidades",
    label: "Probabilidades",
    icon: TrendingUp,
    color: "#C1121F",
    cardStyle: { borderColor: "rgba(193,18,31,0.18)", background: "linear-gradient(135deg, rgba(193,18,31,0.09), rgba(255,255,255,0.02))" },
  },
  {
    href: "/mi-club",
    label: "Mi Club",
    icon: Shield,
    color: "#6BBF78",
    cardStyle: {},
  },
  {
    href: "/versus",
    label: "Versus",
    icon: Swords,
    color: "#F0417A",
    cardStyle: { borderColor: "rgba(240,65,122,0.16)", background: "linear-gradient(135deg, rgba(240,65,122,0.08), rgba(255,255,255,0.02))" },
  },
] as const;

export default function HomePage() {
  const { participants, hasRealParticipants, userTeamsStore } = useScoredParticipants();
  const top3 = participants.slice(0, 3);
  const medalColors = ["#D4AF37", "#C0C0C0", "#CD7F32"];
  const medalBg = ["rgba(212,175,55,0.09)", "rgba(192,192,192,0.07)", "rgba(205,127,50,0.08)"];
  const submittedStats = useMemo(() => getSubmittedStats(userTeamsStore.entries), [userTeamsStore.entries]);
  const prizeRows = [
    { label: "1º clasificado", percentage: 70, amount: submittedStats.prizePool * 0.7 },
    { label: "2º clasificado", percentage: 20, amount: submittedStats.prizePool * 0.2 },
    { label: "3º clasificado", percentage: 10, amount: submittedStats.prizePool * 0.1 },
  ];

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-3">
      <section className="premium-hero mb-4 animate-fade-in">
        <div className="relative z-[1] flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="premium-kicker mb-3">IV Edición · Porra Mundial 2026</span>
              <h1 className="font-display text-[34px] font-black leading-none tracking-[-0.05em] text-text-warm sm:text-[40px]">
                Peñita Mundial
              </h1>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-gold/20 bg-bg-4 shadow-[0_16px_30px_rgba(var(--shadow-color)/0.18)]">
              <Image src="/Logo_Porra_Mundial_2026.webp" alt="Peñita Mundial" width={48} height={48} className="object-contain" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Participantes", value: String(submittedStats.participants) },
              { label: "Premio", value: formatCurrency(submittedStats.prizePool) },
              { label: "Porras", value: String(submittedStats.porras) },
            ].map((item) => (
              <div key={item.label} className="stat-tile text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">{item.label}</p>
                <p className="mt-1 font-display text-[22px] font-black leading-none text-text-warm sm:text-[24px]">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[22px] border border-gold/15 bg-[linear-gradient(135deg,rgba(212,175,55,0.1),rgba(255,255,255,0.03))] p-4 shadow-[0_18px_36px_rgba(var(--shadow-color)/0.18)]">
            <div className="mb-3 flex items-center justify-center">
              <MatchupWithFlags
                homeCountry="México"
                awayCountry="Sudáfrica"
                size="md"
                textClassName="font-display text-[16px] font-bold text-text-warm"
              />
            </div>
            <p className="mb-4 text-center text-[11px] font-medium text-gold">11 junio 2026 · 21:00 (Madrid)</p>
            <Countdown target="2026-06-11T19:00:00Z" />
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
            <Link href="/resultados" className="btn btn-primary no-underline">
              Resultados <ChevronRight size={16} />
            </Link>
            <Link href="/probabilidades" className="btn btn-ghost no-underline">
              Probabilidades <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="mb-4 animate-fade-in" style={{ animationDelay: "0.04s" }}>
        <div className="grid grid-cols-2 gap-2.5">
          {QUICK_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="card !p-3.5 text-left no-underline hover:!border-gold/20"
              style={item.cardStyle}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgb(var(--divider)/0.1)] bg-[rgb(var(--bg-3)/0.74)]">
                  <item.icon size={18} style={{ color: item.color }} />
                </span>
                <ChevronRight size={16} className="text-text-muted" />
              </div>
              <p className="mt-3 text-sm font-semibold text-text-warm">{item.label}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-4 animate-fade-in" style={{ animationDelay: "0.08s" }}>
        <SectionTitle icon={Trophy} accent="#D4AF37">Top 3</SectionTitle>
        <div className="flex flex-col gap-2">
          {top3.map((team, index) => (
            <div
              key={team.id}
              className="card flex items-center gap-3 !px-4 !py-3.5"
              style={{ background: medalBg[index], borderLeft: `3px solid ${medalColors[index]}` }}
            >
              <div className="min-w-[34px] text-center">
                <span className="font-display text-[24px] font-black leading-none" style={{ color: medalColors[index] }}>
                  {index + 1}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-warm">{team.name}</p>
                <p className="text-[11px] text-text-muted">@{team.username}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-[22px] font-black leading-none" style={{ color: medalColors[index] }}>
                  {team.totalPoints}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-text-muted">pts</p>
              </div>
            </div>
          ))}
        </div>
        <Link href="/clasificacion" className="btn btn-ghost mt-3 w-full text-sm no-underline">
          Ver clasificación <ChevronRight size={16} />
        </Link>
      </section>

      <section className="mb-4 animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <SectionTitle icon={Trophy} accent="#D4AF37">Premios</SectionTitle>
        <div className="flex flex-col gap-2">
          {prizeRows.map((row, index) => (
            <div
              key={row.label}
              className="card flex items-center gap-3 !px-4 !py-3.5"
              style={{ background: medalBg[index], borderLeft: `3px solid ${medalColors[index]}` }}
            >
              <div className="min-w-[34px] text-center">
                <span className="font-display text-[24px] font-black leading-none" style={{ color: medalColors[index] }}>
                  {index + 1}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-warm">{row.label}</p>
                <p className="text-[11px] text-text-muted">{row.percentage}% del bote</p>
              </div>
              <div className="text-right">
                <p className="font-display text-[22px] font-black leading-none" style={{ color: medalColors[index] }}>
                  {formatCurrency(row.amount)}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-text-muted">premio</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {!hasRealParticipants ? (
        <section className="mb-6 animate-fade-in" style={{ animationDelay: "0.12s" }}>
          <SectionTitle icon={Activity} accent="#98A3B8">Actividad</SectionTitle>
          <div className="card !p-3.5">
            {ACTIVITY.map((item, index) => (
              <div key={index} className="activity-row">
                <p className="pr-3 text-xs leading-5 text-text-muted">{item.text}</p>
                <span className="shrink-0 whitespace-nowrap text-[10px] font-medium text-text-muted/70">{item.time}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-6 animate-fade-in" style={{ animationDelay: "0.18s" }}>
        <SectionTitle icon={BookOpen} accent="#D9B449">Sistema de puntuación</SectionTitle>

        <div className="card mb-2.5">
          <h3 className="mb-3 font-display text-sm font-bold text-text-warm">Partidos</h3>
          <div className="space-y-1.5">
            <ScoringRow label="Signo acertado (1-X-2)" pts={SCORING.signo} />
            <ScoringRow label="Resultado exacto" pts={SCORING.resultadoExacto} note={`Total: ${SCORING.resultadoExactoTotal} (signo + exacto)`} />
          </div>
        </div>

        <div className="card mb-2.5">
          <h3 className="mb-3 font-display text-sm font-bold text-text-warm">
            Partido doble <span className="text-[10px] font-normal text-text-muted">(1 por grupo)</span>
          </h3>
          <div className="space-y-1.5">
            <ScoringRow label="Solo signo acertado" pts={SCORING.partidoDobleSigno} />
            <ScoringRow label="Resultado exacto" pts={SCORING.partidoDobleExacto} note="Total acumulado" />
          </div>
        </div>

        <div className="card mb-2.5">
          <h3 className="mb-3 font-display text-sm font-bold text-text-warm">Fase de grupos</h3>
          <ScoringRow label="Posición final acertada en grupo" pts={SCORING.posicionGrupo} note="Por cada posición correcta" />
        </div>

        <div className="card mb-2.5">
          <h3 className="mb-3 font-display text-sm font-bold text-text-warm">Eliminatorias</h3>
          <div className="space-y-1.5">
            <ScoringRow label="Equipo en Dieciseisavos" pts={SCORING.eliminatorias.dieciseisavos} />
            <ScoringRow label="Equipo en Octavos" pts={SCORING.eliminatorias.octavos} />
            <ScoringRow label="Equipo en Cuartos" pts={SCORING.eliminatorias.cuartos} />
            <ScoringRow label="Equipo en Semifinales" pts={SCORING.eliminatorias.semis} />
            <ScoringRow label="Equipo en Final" pts={SCORING.eliminatorias.final} />
          </div>
        </div>

        <div className="card mb-2.5">
          <h3 className="mb-3 font-display text-sm font-bold text-text-warm">Posiciones finales</h3>
          <div className="space-y-1.5">
            <ScoringRow label="Tercer puesto" pts={SCORING.posicionesFinales.tercero} />
            <ScoringRow label="Subcampeón" pts={SCORING.posicionesFinales.subcampeon} />
            <ScoringRow label="Campeón" pts={SCORING.posicionesFinales.campeon} accent />
          </div>
        </div>

        <div className="card">
          <h3 className="mb-3 font-display text-sm font-bold text-text-warm">Especiales</h3>
          <div className="space-y-1.5">
            {[
              { label: "Mejor Jugador", pts: SCORING.especiales.mejorJugador },
              { label: "Mejor Jugador Joven", pts: SCORING.especiales.mejorJoven },
              { label: "Máximo Goleador", pts: SCORING.especiales.maxGoleador },
              { label: "Máximo Asistente", pts: SCORING.especiales.maxAsistente },
              { label: "Mejor Portero", pts: SCORING.especiales.mejorPortero },
              { label: "Máx. Goleador Español", pts: SCORING.especiales.maxGoleadorEsp },
              { label: "Primer Gol Español", pts: SCORING.especiales.primerGolEsp },
              { label: "Selección Revelación", pts: SCORING.especiales.revelacion },
              { label: "Selección Decepción", pts: SCORING.especiales.decepcion },
              { label: "Minuto primer gol del Mundial", pts: SCORING.especiales.minutoPrimerGol },
            ].map((row) => (
              <ScoringRow key={row.label} label={row.label} pts={row.pts} accent={row.pts >= 50} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function getPorraPrice(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return 20;
  if (count === 2) return 35;
  return 40;
}

function getSubmittedStats(entries: Array<{ userId?: string; username?: string }>) {
  const porrasByParticipant = new Map<string, number>();

  entries.forEach((entry) => {
    const participantKey = entry.userId || entry.username;
    if (!participantKey) return;
    porrasByParticipant.set(participantKey, (porrasByParticipant.get(participantKey) || 0) + 1);
  });

  const prizePool = Array.from(porrasByParticipant.values()).reduce((total, count) => total + getPorraPrice(count), 0);

  return {
    participants: porrasByParticipant.size,
    porras: entries.length,
    prizePool,
  };
}

function formatCurrency(value: number) {
  const rounded = Number(value.toFixed(2));
  const hasDecimals = !Number.isInteger(rounded);

  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(rounded);
}

function ScoringRow({ label, pts, note, accent }: { label: string; pts: number; note?: string; accent?: boolean }) {
  return (
    <div className="metric-row">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-text-muted">{label}</p>
        {note ? <p className="text-[10px] text-text-muted/70">{note}</p> : null}
      </div>
      <span className={`ml-2 font-display text-sm font-bold ${accent ? "text-gold-light" : "text-text-primary"}`}>
        {pts} <span className="text-[10px] font-normal text-text-muted">pts</span>
      </span>
    </div>
  );
}
