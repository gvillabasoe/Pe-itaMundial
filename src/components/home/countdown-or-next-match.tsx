'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatMadridDateLong } from '@/lib/format';

interface CountdownMatch {
  id: string;
  label: string;
  kickoffUtc: string;
  venue: string;
  city: string;
  status: 'scheduled' | 'live' | 'completed';
}

interface CountdownOrNextMatchProps {
  worldCupStartUtc: string;
  matches: CountdownMatch[];
}

function getNextPending(matches: CountdownMatch[], now: Date): CountdownMatch | null {
  return (
    [...matches]
      .filter((match) => match.status !== 'completed')
      .sort((left, right) => new Date(left.kickoffUtc).getTime() - new Date(right.kickoffUtc).getTime())
      .find((match) => new Date(match.kickoffUtc).getTime() >= now.getTime()) ?? null
  );
}

function buildCountdown(targetUtc: string, now: Date) {
  const diff = Math.max(0, new Date(targetUtc).getTime() - now.getTime());
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { totalSeconds, days, hours, minutes, seconds };
}

export function CountdownOrNextMatch({ worldCupStartUtc, matches }: CountdownOrNextMatchProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const countdown = useMemo(() => buildCountdown(worldCupStartUtc, now), [worldCupStartUtc, now]);
  const nextPending = useMemo(() => getNextPending(matches, now), [matches, now]);

  if (countdown.totalSeconds > 0) {
    return (
      <section className="countdownPanel" aria-label="Cuenta atrás oficial al inicio del Mundial">
        <div>
          <div className="eyebrow">Inicio del Mundial</div>
          <h1 className="heroTitle">Cuenta atrás oficial</h1>
        </div>
        <div className="countdownGrid" role="timer" aria-live="polite">
          <div className="countdownCell"><span>{countdown.days}</span><small>días</small></div>
          <div className="countdownCell"><span>{countdown.hours}</span><small>horas</small></div>
          <div className="countdownCell"><span>{countdown.minutes}</span><small>minutos</small></div>
          <div className="countdownCell"><span>{countdown.seconds}</span><small>segundos</small></div>
        </div>
      </section>
    );
  }

  if (nextPending) {
    return (
      <section className="countdownPanel" aria-label="Próximo partido del campeonato">
        <div>
          <div className="eyebrow">Próximo partido</div>
          <h1 className="heroTitle">{nextPending.label}</h1>
          <p className="heroText">{formatMadridDateLong(nextPending.kickoffUtc)} · {nextPending.city} · {nextPending.venue}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="countdownPanel" aria-label="Torneo finalizado">
      <div>
        <div className="eyebrow">Estado del torneo</div>
        <h1 className="heroTitle">Torneo finalizado</h1>
        <p className="heroText">No quedan partidos pendientes.</p>
      </div>
    </section>
  );
}
