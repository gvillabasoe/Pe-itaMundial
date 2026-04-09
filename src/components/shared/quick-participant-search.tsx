'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { participantHref } from '@/lib/routes';

interface QuickParticipantSearchProps {
  participants: Array<{ slug: string; name: string }>;
}

export function QuickParticipantSearch({ participants }: QuickParticipantSearchProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return participants.slice(0, 5);
    }
    return participants
      .filter((participant) => participant.name.toLowerCase().includes(normalized))
      .slice(0, 6);
  }, [participants, query]);

  return (
    <section className="quickSearchBlock" aria-label="Acceso rápido a participantes">
      <label className="searchLabel" htmlFor="participant-search">
        Acceso rápido a participantes
      </label>
      <input
        id="participant-search"
        className="searchInput"
        type="search"
        placeholder="Buscar participante"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="quickSearchResults">
        {filtered.map((participant) => (
          <Link key={participant.slug} className="quickSearchLink" href={participantHref(participant.slug)}>
            {participant.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
