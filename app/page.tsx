"use client";

import Image from "next/image";
import Link from "next/link";
import { Activity, BookOpen, ChevronRight, Shield, Swords, Trophy, Zap } from "lucide-react";
import { Countdown, DemoBadge, Flag, SectionTitle } from "@/components/ui";
import { ACTIVITY, MINI_POLL, PARTICIPANTS, SCORING } from "@/lib/data";
import { useState } from "react";

export default function HomePage() {
  const [pollVote, setPollVote] = useState<string | null>(null);
  const top3 = PARTICIPANTS.slice(0, 3);
  const medalColors = ["#D4AF37", "#C0C0C0", "#CD7F32"];
  const medalBg = ["rgba(212,175,55,0.08)", "rgba(192,192,192,0.06)", "rgba(205,127,50,0.06)"];
  const totalVotes = Object.values(MINI_POLL.votes).reduce((acc, votes) => acc + votes, 0);

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-3">
      <div className="animate-fade-in text-center mb-7 pt-4">
        <div className="mb-1 flex items-center justify-center gap-3.5">
          <div>
            <h1 className="font-display text-[28px] font-black tracking-tight text-text-warm">Peñita Mundial</h1>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">IV Edición</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-gold/20 bg-bg-4">
            <Image
              src="/Logo_Porra_Mundial_2026.webp"
              alt="Peñita Mundial"
              width={44}
              height={44}
              className="object-contain"
            />
          </div>
        </div>
      </div>

      <div className="card card-glow mb-4 animate-fade-in text-center bg-gradient-to-br from-bg-4 to-bg-2 !border-gold/10">
        <p className="mb-2.5 font-display text-[10px] font-bold uppercase tracking-[0.15em] text-gold-dark">
          Cuenta atrás para el inicio de la Copa del Mundo
        </p>
        <div className="mb-2 flex items-center justify-center gap-1.5">
          <Flag country="México" size="sm" />
          <span className="text-sm font-semibold text-text-muted">vs</span>
          <Flag country="Sudáfrica" size="sm" />
        </div>
        <p className="mb-0.5 text-sm text-text-muted">México vs Sudáfrica</p>
        <p className="mb-3 text-[11px] text-gold">11 junio 2026 · 21:00 (Madrid)</p>
        <Countdown target="2026-06-11T19:00:00Z" />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4 animate-fade-in" style={{ animationDelay: "0.05s" }}>
        <Link href="/resultados" className="card !p-3 text-center no-underline transition-all hover:!border-gold/20">
          <Trophy size={20} className="mx-auto mb-1.5 text-gold" />
          <p className="text-[11px] font-semibold text-text-warm">Resultados</p>
          <p className="text-[9px] text-text-muted">104 partidos</p>
        </Link>
        <Link href="/mi-club" className="card !p-3 text-center no-underline transition-all hover:!border-gold/20">
          <Shield size={20} className="mx-auto mb-1.5 text-accent-participante" />
          <p className="text-[11px] font-semibold text-text-warm">Mi Club</p>
          <p className="text-[9px] text-text-muted">Acceso privado</p>
        </Link>
        <Link href="/versus" className="card !p-3 text-center no-underline transition-all hover:!border-gold/20">
          <Swords size={20} className="mx-auto mb-1.5 text-accent-versus" />
          <p className="text-[11px] font-semibold text-text-warm">Versus</p>
          <p className="text-[9px] text-text-muted">Cara a cara</p>
        </Link>
      </div>

      <div className="mb-4 animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <SectionTitle icon={Trophy} accent="#D4AF37" right={<DemoBadge />}>Top 3</SectionTitle>
        <div className="flex flex-col gap-1.5">
          {top3.map((team, index) => (
            <div
              key={team.id}
              className="card flex items-center gap-3 !px-3.5 !py-3"
              style={{ background: medalBg[index], borderLeft: `3px solid ${medalColors[index]}` }}
            >
              <span className="min-w-[28px] font-display text-[22px] font-black" style={{ color: medalColors[index] }}>
                {index + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-text-warm">{team.name}</p>
                <p className="text-[11px] text-text-muted">@{team.username}</p>
              </div>
              <span className="font-display text-lg font-extrabold" style={{ color: medalColors[index] }}>
                {team.totalPoints} <span className="text-[11px] font-normal">pts</span>
              </span>
            </div>
          ))}
        </div>
        <Link href="/clasificacion" className="btn btn-ghost mt-2.5 w-full text-sm no-underline">
          Ver clasificación completa <ChevronRight size={16} />
        </Link>
      </div>

      <div className="mb-4 animate-fade-in" style={{ animationDelay: "0.2s" }}>
        <SectionTitle icon={Zap} accent="#DFBE38">Encuesta abierta</SectionTitle>
        <div className="card !border-amber-mid/20">
          <p className="mb-3 text-sm font-semibold text-text-warm">{MINI_POLL.title}</p>
          <div className="flex flex-col gap-1.5">
            {MINI_POLL.options.map((option) => {
              const pct = Math.round(((MINI_POLL.votes[option] || 0) / totalVotes) * 100);
              const voted = pollVote === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPollVote(option)}
                  className="relative flex w-full items-center gap-2.5 overflow-hidden rounded-lg px-3 py-2.5 text-left text-sm transition-all"
                  style={{
                    border: voted ? "1px solid #DFBE38" : "1px solid rgba(255,255,255,0.06)",
                    background: voted ? "rgba(223,190,56,0.08)" : "rgb(var(--bg-2))",
                  }}
                >
                  {pollVote ? (
                    <div
                      className="absolute inset-y-0 left-0 transition-all duration-500"
                      style={{ width: `${pct}%`, background: voted ? "rgba(223,190,56,0.1)" : "rgba(255,255,255,0.03)" }}
                    />
                  ) : null}
                  <span className="relative flex-1" style={{ fontWeight: voted ? 600 : 400 }}>{option}</span>
                  {pollVote ? <span className="relative text-xs font-semibold text-text-muted">{pct}%</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mb-6 animate-fade-in" style={{ animationDelay: "0.3s" }}>
        <SectionTitle icon={Activity} accent="#98A3B8">Actividad reciente</SectionTitle>
        <div className="flex flex-col">
          {ACTIVITY.map((item, index) => (
            <div key={index} className="flex items-center justify-between border-b border-white/[0.04] py-2">
              <p className="text-xs text-text-muted">{item.text}</p>
              <span className="ml-2 whitespace-nowrap text-[10px] text-text-muted/60">{item.time}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6 animate-fade-in" style={{ animationDelay: "0.4s" }}>
        <SectionTitle icon={BookOpen} accent="#D9B449">Sistema de puntuación</SectionTitle>

        <div className="card mb-2">
          <h3 className="mb-2 font-display text-sm font-bold text-text-warm">Partidos</h3>
          <div className="space-y-1.5">
            <ScoringRow label="Signo acertado (1-X-2)" pts={SCORING.signo} />
            <ScoringRow label="Resultado exacto" pts={SCORING.resultadoExacto} note={`Total: ${SCORING.resultadoExactoTotal} (signo + exacto)`} />
          </div>
        </div>

        <div className="card mb-2">
          <h3 className="mb-2 font-display text-sm font-bold text-text-warm">Partido doble <span className="text-[10px] font-normal text-text-muted">(1 por grupo)</span></h3>
          <div className="space-y-1.5">
            <ScoringRow label="Solo signo acertado" pts={SCORING.partidoDobleSigno} />
            <ScoringRow label="Resultado exacto" pts={SCORING.partidoDobleExacto} note="Total acumulado" />
          </div>
        </div>

        <div className="card mb-2">
          <h3 className="mb-2 font-display text-sm font-bold text-text-warm">Fase de grupos</h3>
          <ScoringRow label="Posición final acertada en grupo" pts={SCORING.posicionGrupo} note="Por cada posición correcta" />
        </div>

        <div className="card mb-2">
          <h3 className="mb-2 font-display text-sm font-bold text-text-warm">Eliminatorias</h3>
          <div className="space-y-1.5">
            <ScoringRow label="Equipo en Dieciseisavos" pts={SCORING.eliminatorias.dieciseisavos} />
            <ScoringRow label="Equipo en Octavos" pts={SCORING.eliminatorias.octavos} />
            <ScoringRow label="Equipo en Cuartos" pts={SCORING.eliminatorias.cuartos} />
            <ScoringRow label="Equipo en Semifinales" pts={SCORING.eliminatorias.semis} />
            <ScoringRow label="Equipo en Final" pts={SCORING.eliminatorias.final} />
          </div>
        </div>

        <div className="card mb-2">
          <h3 className="mb-2 font-display text-sm font-bold text-text-warm">Posiciones finales</h3>
          <div className="space-y-1.5">
            <ScoringRow label="Tercer puesto" pts={SCORING.posicionesFinales.tercero} />
            <ScoringRow label="Subcampeón" pts={SCORING.posicionesFinales.subcampeon} />
            <ScoringRow label="Campeón" pts={SCORING.posicionesFinales.campeon} accent />
          </div>
        </div>

        <div className="card mb-2">
          <h3 className="mb-2 font-display text-sm font-bold text-text-warm">Especiales</h3>
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
            ].map((row) => <ScoringRow key={row.label} label={row.label} pts={row.pts} accent={row.pts >= 50} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoringRow({ label, pts, note, accent }: { label: string; pts: number; note?: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-text-muted">{label}</p>
        {note ? <p className="text-[10px] text-text-muted/60">{note}</p> : null}
      </div>
      <span className={`ml-2 font-display text-sm font-bold ${accent ? "text-gold-light" : "text-text-primary"}`}>
        {pts} <span className="text-[10px] font-normal text-text-muted">pts</span>
      </span>
    </div>
  );
}
