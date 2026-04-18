"use client";

import { useState, useMemo } from "react";
import { BarChart3, Star, X, Search, Lock } from "lucide-react";
import { Flag, GroupBadge, CountryWithFlag, EmptyState, DemoBadge } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import { PARTICIPANTS, FIXTURES, GROUPS, GROUP_COLORS, KNOCKOUT_ROUND_DEFS } from "@/lib/data";
import type { Team } from "@/lib/data";

export default function ClasificacionPage() {
  const { user, favorites, toggleFavorite } = useAuth();
  const [filter, setFilter] = useState("all");
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [search, setSearch] = useState("");
  const [authHint, setAuthHint] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = [...PARTICIPANTS];
    if (filter === "mine" && user) list = list.filter(p => p.userId === user.id);
    else if (filter === "top10") list = PARTICIPANTS.slice(0, 10);
    else if (filter === "tied") {
      const c: Record<number, number> = {};
      PARTICIPANTS.forEach(p => { c[p.totalPoints] = (c[p.totalPoints] || 0) + 1; });
      list = PARTICIPANTS.filter(p => c[p.totalPoints] > 1);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q));
    }
    return list;
  }, [filter, user, search]);

  const favTeams = useMemo(() => {
    if (!user || !favorites.length) return [];
    return PARTICIPANTS.filter(p => favorites.includes(p.id));
  }, [user, favorites]);

  const mc = (r: number) => r === 1 ? "#D4AF37" : r === 2 ? "#C0C0C0" : r === 3 ? "#CD7F32" : null;

  const Row = ({ p, idx }: { p: Team; idx: number }) => {
    const medal = mc(p.currentRank);
    const mine = user && p.userId === user.id;
    const fav = favorites.includes(p.id);
    return (
      <div className="card flex items-center gap-2.5 !py-2.5 !px-3 cursor-pointer animate-fade-in"
        style={{ animationDelay: `${idx * 0.02}s`, borderLeft: medal ? `3px solid ${medal}` : mine ? "3px solid #6BBF78" : "3px solid transparent", background: mine ? "rgba(107,191,120,0.04)" : undefined }}
        onClick={() => setSelectedTeam(p)}>
        <span className="font-display text-base font-extrabold min-w-[28px] text-center" style={{ color: medal || "#98A3B8" }}>{p.currentRank}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-warm truncate">{p.name}</p>
          <p className="text-[11px] text-text-muted">@{p.username}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-display text-base font-bold" style={{ color: medal || "#F6F7FB" }}>{p.totalPoints}</span>
          <button onClick={(e: any) => { e.stopPropagation(); if (!user) { setAuthHint("Inicia sesión en Mi Club para guardar favoritos."); return; } setAuthHint(null); toggleFavorite(p.id); }} className="p-1 bg-transparent border-none cursor-pointer">
            {fav ? <Star size={14} fill="#D4AF37" color="#D4AF37" /> : <Star size={14} color="#98A3B8" className="opacity-30" />}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="px-4 pt-4 max-w-[640px] mx-auto">
      <div className="animate-fade-in mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-text-warm mb-0.5">Clasificación</h1>
          <p className="text-xs text-text-muted">Ranking general de la porra</p>
        </div>
        <DemoBadge />
      </div>

      {/* Search */}
      <div className="relative mb-2.5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input className="input-field !pl-9" placeholder="Buscar equipo o usuario..." value={search} onChange={(e: any) => setSearch(e.target.value)} />
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-3.5 overflow-x-auto pb-1">
        {[
          { key: "all", label: "Todos" },
          { key: "mine", label: "Mis equipos" },
          { key: "top10", label: "Top 10" },
          { key: "tied", label: "Empatados" },
        ].map(f => (
          <button key={f.key} className={`pill ${filter === f.key ? "active" : ""}`}
            onClick={() => {
              if (f.key === "mine" && !user) { /* show nothing, filter stays */ }
              setFilter(f.key);
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* "Mis equipos" without login */}
      {filter === "mine" && !user && (
        <div className="card text-center !py-6 mb-4">
          <Lock size={28} className="mx-auto mb-2 text-text-muted opacity-40" />
          <p className="text-sm text-text-muted mb-2">Inicia sesión para ver tus equipos</p>
          <a href="/mi-club" className="btn btn-ghost text-xs !py-2 no-underline">Ir a Mi Club</a>
        </div>
      )}


      {authHint ? (
        <div className="mb-3 rounded-[12px] border border-gold/20 bg-gold/10 px-3 py-2 text-xs text-gold-light">{authHint}</div>
      ) : null}
      {/* Favorites section */}
      {user && favTeams.length > 0 && !search && filter === "all" && (
        <div className="mb-4 animate-fade-in">
          <h3 className="font-display text-sm font-bold text-gold mb-2 flex items-center gap-1.5">
            <Star size={14} className="text-gold" /> Favoritos
          </h3>
          <div className="flex flex-col gap-1">{favTeams.map((p, i) => <Row key={`fav-${p.id}`} p={p} idx={i} />)}</div>
          <div className="border-b border-white/[0.06] my-3" />
        </div>
      )}

      {/* Main list */}
      {filtered.length === 0 ? (
        <EmptyState text={search ? "No se encontraron resultados" : "La clasificación se actualizará según avance el torneo"} icon={search ? Search : BarChart3} />
      ) : (
        !(filter === "mine" && !user) && (
          <div className="flex flex-col gap-1">
            {filtered.map((p, i) => <Row key={p.id} p={p} idx={i} />)}
          </div>
        )
      )}

      {/* Detail Modal */}
      {selectedTeam && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-end justify-center" onClick={() => setSelectedTeam(null)}>
          <div className="bg-bg-4 rounded-t-[20px] w-full max-w-[640px] max-h-[85vh] overflow-y-auto p-5 animate-slide-up" onClick={(e: any) => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-white/20 mx-auto mb-4" />
            <ParticipantDetail team={selectedTeam} onClose={() => setSelectedTeam(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function ParticipantDetail({ team, onClose }: { team: Team; onClose: () => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-xl font-extrabold text-text-warm">{team.name}</h3>
          <p className="text-xs text-text-muted">@{team.username}</p>
        </div>
        <button onClick={onClose} className="bg-bg-2 border-none rounded-lg p-2 cursor-pointer text-text-muted"><X size={18} /></button>
      </div>

      {/* Total */}
      <div className="card text-center mb-4 bg-gradient-to-br from-bg-2 to-bg-4 !border-gold/15">
        <p className="text-[11px] text-text-muted mb-0.5">Puntos totales</p>
        <p className="font-display text-4xl font-black text-gold-light">{team.totalPoints}</p>
        <span className="badge badge-gold">#{team.currentRank}</span>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: "Fase de grupos", val: team.groupPoints, color: "#27E6AC" },
          { label: "Fase final", val: team.finalPhasePoints, color: "#DFBE38" },
          { label: "Especiales", val: team.specialPoints, color: "#F0417A" },
        ].map((k, i) => (
          <div key={i} className="card text-center !p-3">
            <p className="text-[10px] text-text-muted mb-1">{k.label}</p>
            <p className="font-display text-xl font-extrabold" style={{ color: k.color }}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Champion + Runner-up */}
      <div className="flex gap-2 mb-3">
        <div className="card flex-1 flex items-center gap-2">
          <Flag country={team.championPick} size="sm" />
          <div><p className="text-[10px] text-text-muted">Campeón</p><p className="text-xs font-semibold">{team.championPick}</p></div>
        </div>
        <div className="card flex-1 flex items-center gap-2">
          <Flag country={team.runnerUpPick} size="sm" />
          <div><p className="text-[10px] text-text-muted">Subcampeón</p><p className="text-xs font-semibold">{team.runnerUpPick}</p></div>
        </div>
      </div>

      {/* Specials */}
      <h4 className="font-display text-sm font-bold mb-2 text-text-warm">Picks especiales</h4>
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {[
          { label: "Mejor Jugador", val: team.specials.mejorJugador },
          { label: "Mejor Joven", val: team.specials.mejorJoven },
          { label: "Máx. Goleador", val: team.specials.maxGoleador },
          { label: "Máx. Asistente", val: team.specials.maxAsistente },
          { label: "Mejor Portero", val: team.specials.mejorPortero },
          { label: "Goleador ESP", val: team.specials.maxGoleadorEsp },
          { label: "Revelación", val: team.specials.revelacion, isC: true },
          { label: "Decepción", val: team.specials.decepcion, isC: true },
        ].map((s, i) => (
          <div key={i} className="py-2 px-2.5 bg-bg-2 rounded-lg">
            <p className="text-[9px] text-text-muted uppercase tracking-wide">{s.label}</p>
            <p className="text-xs font-semibold mt-0.5">{s.isC ? <CountryWithFlag country={s.val} /> : s.val}</p>
          </div>
        ))}
      </div>
      <div className="py-2 px-2.5 bg-bg-2 rounded-lg mb-4">
        <p className="text-[9px] text-text-muted uppercase tracking-wide">Min. primer gol</p>
        <p className="text-xs font-semibold mt-0.5">{team.specials.minutoPrimerGol}&apos;</p>
      </div>

      {/* Double matches */}
      {team.doubleMatches && (
        <>
          <h4 className="font-display text-sm font-bold mb-2 text-text-warm">Partidos doble puntuación</h4>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {Object.entries(team.doubleMatches).map(([g, fId]) => {
              const fx = FIXTURES.find(f => f.id === fId);
              if (!fx) return null;
              return (
                <div key={g} className="py-2 px-2.5 bg-bg-2 rounded-lg" style={{ borderLeft: `2px solid ${GROUP_COLORS[g]}` }}>
                  <div className="flex items-center gap-1 mb-1">
                    <GroupBadge group={g} />
                    <span className="badge badge-amber text-[8px] !py-0 !px-1.5">DOBLE</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] flex-wrap">
                    <Flag country={fx.homeTeam} size="sm" /><span>{fx.homeTeam}</span>
                    <span className="text-text-muted">vs</span>
                    <Flag country={fx.awayTeam} size="sm" /><span>{fx.awayTeam}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Knockout picks summary */}
      {team.knockoutPicks && (
        <>
          <h4 className="font-display text-sm font-bold mb-2 text-text-warm">Picks eliminatorias</h4>
          <div className="space-y-2 mb-3">
            {KNOCKOUT_ROUND_DEFS.map(rd => {
              const picks = team.knockoutPicks[rd.key] || [];
              if (!picks.length) return null;
              return (
                <div key={rd.key}>
                  <p className="text-[10px] text-text-muted mb-1">{rd.name} ({rd.pts} pts)</p>
                  <div className="flex flex-wrap gap-1">
                    {picks.map((pk, pi) => (
                      <span key={pi} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-bg-3 rounded text-[10px]">
                        <Flag country={pk.country} size="sm" /> {pk.country}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
