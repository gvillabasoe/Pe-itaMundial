'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface VersusPickerProps {
  participants: Array<{ slug: string; name: string }>;
  activeLeft: string;
  activeRight: string;
  mode: 'participant' | 'general';
}

export function VersusPicker({ participants, activeLeft, activeRight, mode }: VersusPickerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const update = (next: { a?: string; b?: string; mode?: 'participant' | 'general' }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.a) params.set('a', next.a);
    if (next.b) params.set('b', next.b);
    if (next.mode) params.set('mode', next.mode);
    router.push(`/versus?${params.toString()}`);
  };

  return (
    <div className="versusPicker">
      <label className="fieldControl">
        <span className="fieldLabel">A</span>
        <select className="fieldSelect" value={activeLeft} onChange={(event) => update({ a: event.target.value })}>
          {participants.map((participant) => (
            <option key={participant.slug} value={participant.slug}>{participant.name}</option>
          ))}
        </select>
      </label>
      <label className="fieldControl">
        <span className="fieldLabel">B</span>
        <select className="fieldSelect" value={activeRight} onChange={(event) => update({ b: event.target.value })}>
          {participants.filter((participant) => participant.slug !== activeLeft).map((participant) => (
            <option key={participant.slug} value={participant.slug}>{participant.name}</option>
          ))}
        </select>
      </label>
      <div className="segmentedControl" role="group" aria-label="Modo de comparación">
        <button className={`segmentButton ${mode === 'participant' ? 'isActive' : ''}`} type="button" onClick={() => update({ mode: 'participant' })}>
          Participante
        </button>
        <button className={`segmentButton ${mode === 'general' ? 'isActive' : ''}`} type="button" onClick={() => update({ mode: 'general' })}>
          General
        </button>
      </div>
    </div>
  );
}
