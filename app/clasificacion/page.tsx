"use client";

import { useMemo, useState } from "react";
import { BarChart3, Lock, Search, Star, X } from "lucide-react";
import { CountryWithFlag, EmptyState, Flag, GroupBadge } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import { FIXTURES, GROUPS, GROUP_COLORS, KNOCKOUT_ROUND_DEFS, type Team } from "@/lib/data";
import { useScoredParticipants } from "@/lib/use-scored-participants";

export default function ClasificacionPage() {
  const { user, favorites, toggleFavorite } = useAuth();
  const { participants } = useScoredParticipants();
  const [filter, setFilter] = useState("all");
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [search, setSearch] = useState("");
  const [authHint, setAuthHint] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = [...participants];
    if (filter === "mine" && user) {
      list = list.filter((participant) => participant.userId === user.id);
    } else if (filter === "top10") {
      list = participants.slice(0, 10);
    } else if (filter === "tied") {
      const counts: Record<number, number> = {};
      participants.forEach((participant) => {
        counts[participant.totalPoints] = (counts[participant.totalPoints] || 0) + 1;
      });
      list = participants.filter((participant) => counts[participant.totalPoints] > 1);
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase();
      list = list.filter((participant) => participant.name.toLowerCase().includes(query) || participant.username.toLowerCase().includes(query));
    }

    return list;
  }, [filter, participants, search, user]);

  const favoriteTeams = useMemo(() => {
    if (!user || !favorites.length) return [];
    return participants.filter((participant) => favorites.includes(participant.id));
  }, [favorites, participants, user]);

  const getMedalColor = (rank: number) => rank === 1 ? "#D4AF37" : rank === 2 ? "#C0C0C0" : rank === 3 ? "#CD7F32" : null;

  const Row = ({ participant, index }: { participant: Team; index: number }) => {
    const medal = getMedalColor(participant.currentRank);
    const mine = user && participant.userId === user.id;
    const favorite = favorites.includes(participant.id);

    return (
      <div
        className="card flex cursor-pointer items-center gap-2.5 !px-3 !py-2.5 animate-fade-in"
        style={{
          animationDelay: `${index * 0.02}s`,
          borderLeft: medal ? `3px solid ${medal}` : mine ? "3px solid #6BBF78" : "3px solid transparent",
          background: mine ? "rgba(107,191,120,0.04)" : undefined,
        }}
        onClick={() => setSelectedTeam(participant)}
      >
        <span className="min-w-[28px] text-center font-display text-base font-extrabold" style={{ color: medal || "#98A3B8" }}>{participant.currentRank}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text-warm">{participant.name}</p>
          <p className="text-[11px] text-text-muted">@{participant.username}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-display text-base font-bold" style={{ color: medal || "rgb(var(--text-primary))" }}>{participant.totalPoints}</span>
          <button
            onClick={(event) => {
              event.stopPropagation();
              if (!user) {
                setAuthHint("Inicia sesión en Mi Club para guardar favoritos.");
                return;
              }
              setAuthHint(null);
              toggleFavorite(participant.id);
            }}
            className="cursor-pointer border-none bg-transparent p-1"
          >
            {favorite ? <Star size={14} fill="#D4AF37" color="#D4AF37" /> : <Star size={14} color="#98A3B8" className="opacity-30" />}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-4">
      <div className="animate-fade-in mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold text-text-warm">Clasificación</h1>
      </div>

      <div className="relative mb-2.5">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input className="input-field !pl-9" placeholder="Buscar equipo o usuario..." value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      <div className="mb-3.5 flex gap-1.5 overflow-x-auto pb-1">
        {[
          { key: "all", label: "Todos" },
          { key: "mine", label: "Mis equipos" },
          { key: "top10", label: "Top 10" },
          { key: "tied", label: "Empatados" },
        ].map((item) => (
          <button
            key={item.key}
            className={`pill ${filter === item.key ? "active" : ""}`}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filter === "mine" && !user ? (
        <div className="card mb-4 text-center !py-6">
          <Lock size={28} className="mx-auto mb-2 text-text-muted opacity-40" />
          <p className="mb-2 text-sm text-text-muted">Inicia sesión para ver tus equipos</p>
          <a href="/mi-club" className="btn btn-ghost text-xs !py-2 no-underline">Ir a Mi Club</a>
        </div>
      ) : null}

      {authHint ? (
        <div className="mb-3 rounded-[12px] border border-gold/20 bg-gold/10 px-3 py-2 text-xs text-gold-light">{authHint}</div>
      ) : null}

      {user && favoriteTeams.length > 0 && !search && filter === "all" ? (
        <div className="mb-4 animate-fade-in">
          <h3 className="mb-2 flex items-center gap-1.5 font-display text-sm font-bold text-gold">
            <Star size={14} className="text-gold" /> Favoritos
          </h3>
          <div className="flex flex-col gap-1">{favoriteTeams.map((participant, index) => <Row key={`fav-${participant.id}`} participant={participant} index={index} />)}</div>
          <div className="soft-divider my-3" />
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState text={search ? "No se encontraron resultados" : "La clasificación se actualizará según avance el torneo"} icon={search ? Search : BarChart3} />
      ) : filter === "mine" && !user ? null : (
        <div className="flex flex-col gap-1">
          {filtered.map((participant, index) => <Row key={participant.id} participant={participant} index={index} />)}
        </div>
      )}

      {selectedTeam ? (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={() => setSelectedTeam(null)}>
          <div className="max-h-[85vh] w-full max-w-[640px] overflow-y-auto rounded-t-[20px] bg-bg-4 p-5 animate-slide-up" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-9 rounded-full" style={{ background: "rgba(var(--divider),0.18)" }} />
            <ParticipantDetail team={selectedTeam} onClose={() => setSelectedTeam(null)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ParticipantDetail({ team, onClose }: { team: Team; onClose: () => void }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl font-extrabold text-text-warm">{team.name}</h3>
          <p className="text-xs text-text-muted">@{team.username}</p>
        </div>
        <button onClick={onClose} className="cursor-pointer rounded-lg border-none bg-bg-2 p-2 text-text-muted"><X size={18} /></button>
      </div>

      <div className="card mb-4 bg-gradient-to-br from-bg-2 to-bg-4 text-center !border-gold/15">
        <p className="mb-0.5 text-[11px] text-text-muted">Puntos</p>
        <p className="font-display text-4xl font-black text-gold-light">{team.totalPoints}</p>
        <span className="badge badge-gold">#{team.currentRank}</span>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          { label: "Fase de grupos", value: team.groupPoints, color: "#27E6AC" },
          { label: "Fase final", value: team.finalPhasePoints, color: "#DFBE38" },
          { label: "Especiales", value: team.specialPoints, color: "#F0417A" },
        ].map((item) => (
          <div key={item.label} className="card text-center !p-3">
            <p className="mb-1 text-[10px] text-text-muted">{item.label}</p>
            <p className="font-display text-xl font-extrabold" style={{ color: item.color }}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 flex gap-2">
        <div className="card flex flex-1 items-center gap-2">
          <Flag country={team.championPick} size="sm" />
          <div>
            <p className="text-[10px] text-text-muted">Campeón</p>
            <p className="text-xs font-semibold">{team.championPick}</p>
          </div>
        </div>
        <div className="card flex flex-1 items-center gap-2">
          <Flag country={team.runnerUpPick} size="sm" />
          <div>
            <p className="text-[10px] text-text-muted">Subcampeón</p>
            <p className="text-xs font-semibold">{team.runnerUpPick}</p>
          </div>
        </div>
      </div>

      <h4 className="mb-2 font-display text-sm font-bold text-text-warm">Especiales</h4>
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        {[
          { label: "Mejor Jugador", value: team.specials.mejorJugador },
          { label: "Mejor Joven", value: team.specials.mejorJoven },
          { label: "Máx. Goleador", value: team.specials.maxGoleador },
          { label: "Máx. Asistente", value: team.specials.maxAsistente },
          { label: "Mejor Portero", value: team.specials.mejorPortero },
          { label: "Goleador ESP", value: team.specials.maxGoleadorEsp },
          { label: "Revelación", value: team.specials.revelacion, isCountry: true },
          { label: "Decepción", value: team.specials.decepcion, isCountry: true },
        ].map((item) => (
          <div key={item.label} className="rounded-lg bg-bg-2 px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-wide text-text-muted">{item.label}</p>
            <p className="mt-0.5 text-xs font-semibold">{item.isCountry ? <CountryWithFlag country={item.value} /> : item.value}</p>
          </div>
        ))}
      </div>
      <div className="mb-4 rounded-lg bg-bg-2 px-2.5 py-2">
        <p className="text-[9px] uppercase tracking-wide text-text-muted">Min. primer gol</p>
        <p className="mt-0.5 text-xs font-semibold">{team.specials.minutoPrimerGol}&apos;</p>
      </div>

      {team.doubleMatches ? (
        <>
          <h4 className="mb-2 font-display text-sm font-bold text-text-warm">Partidos doble puntuación</h4>
          <div className="mb-3 grid grid-cols-2 gap-1.5">
            {Object.entries(team.doubleMatches).map(([group, fixtureId]) => {
              const fixture = FIXTURES.find((item) => item.id === fixtureId);
              if (!fixture) return null;
              return (
                <div key={group} className="rounded-lg bg-bg-2 px-2.5 py-2" style={{ borderLeft: `2px solid ${GROUP_COLORS[group]}` }}>
                  <div className="mb-1 flex items-center gap-1">
                    <GroupBadge group={group} />
                    <span className="badge badge-amber text-[8px] !px-1.5 !py-0">DOBLE</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-[10px]">
                    <Flag country={fixture.homeTeam} size="sm" /><span>{fixture.homeTeam}</span>
                    <span className="text-text-muted">vs</span>
                    <Flag country={fixture.awayTeam} size="sm" /><span>{fixture.awayTeam}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {team.knockoutPicks ? (
        <>
          <h4 className="mb-2 font-display text-sm font-bold text-text-warm">Eliminatorias</h4>
          <div className="mb-3 space-y-2">
            {KNOCKOUT_ROUND_DEFS.map((round) => {
              const picks = team.knockoutPicks[round.key] || [];
              if (!picks.length) return null;
              return (
                <div key={round.key}>
                  <p className="mb-1 text-[10px] text-text-muted">{round.name} ({round.pts} pts)</p>
                  <div className="flex flex-wrap gap-1">
                    {picks.map((pick, index) => (
                      <span key={`${round.key}-${index}`} className="inline-flex items-center gap-1 rounded bg-bg-3 px-1.5 py-0.5 text-[10px]">
                        <Flag country={pick.country} size="sm" /> {pick.country}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
