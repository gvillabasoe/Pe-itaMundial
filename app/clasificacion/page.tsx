"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BarChart3, ChevronDown, ChevronUp, Lock, Search, Star, X } from "lucide-react";
import {
  CountryWithFlag, EmptyState, Flag, GroupBadge,
  InitialsAvatar, Medal, PickChip, Skeleton,
} from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import { FIXTURES, GROUPS, type Team } from "@/lib/data";
import { useScoredParticipants } from "@/lib/use-scored-participants";

export default function ClasificacionPage() {
  const { user, favorites, toggleFavorite } = useAuth();
  const { participants, isLoading } = useScoredParticipants();
  const [filter, setFilter] = useState("all");
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [search, setSearch] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // ── Bloqueado hasta iniciar sesión — mismo patrón que Versus ──
  if (!user) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="card max-w-[320px] text-center !p-8 animate-fade-in">
          <Lock size={36} className="mx-auto mb-3 text-accent-clasificacion" />
          <h2 className="mb-1 font-display text-xl font-extrabold text-text-warm">Acceso restringido</h2>
          <p className="mb-4 text-sm text-text-muted">Inicia sesión para ver el ranking</p>
          <Link href="/mi-club" className="btn no-underline"
            style={{ background: "rgb(var(--accent-clasificacion))", color: "white" }}>
            Entrar a Mi Club
          </Link>
        </div>
      </div>
    );
  }

  const filtered = useMemo(() => {
    let list = [...participants];
    if (filter === "mine") list = list.filter((p) => p.userId === user.id || p.username === user.username);
    else if (filter === "top10") list = participants.slice(0, 10);
    else if (filter === "tied") {
      const counts: Record<number, number> = {};
      participants.forEach((p) => { counts[p.totalPoints] = (counts[p.totalPoints] || 0) + 1; });
      list = participants.filter((p) => counts[p.totalPoints] > 1);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q));
    }
    return list;
  }, [filter, participants, search, user]);

  const favoriteTeams = useMemo(() => {
    if (!user || !favorites.length) return [];
    return participants.filter((p) => favorites.includes(p.id));
  }, [favorites, participants, user]);

  return (
    <div className="px-4 pt-5 max-w-[640px] mx-auto">
      <div className="page-header animate-fade-in">
        <h1 className="page-header__title">Ranking</h1>
      </div>

      <div className="relative mb-3">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" aria-hidden="true" />
        <input className="input-field !pl-9" placeholder="Buscar equipo o jugador..."
          value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar en la clasificación" />
      </div>

      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {[
          { key: "all", label: "Todos" },
          { key: "mine", label: "Mis equipos" },
          { key: "top10", label: "Top 10" },
          { key: "tied", label: "Empatados" },
        ].map((f) => (
          <button key={f.key} className={`pill ${filter === f.key ? "active" : ""}`}
            onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {favoriteTeams.length > 0 && filter === "all" && !search.trim() && (
        <section className="mb-4 animate-fade-in">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-2 flex items-center gap-1.5">
            <Star size={11} className="text-gold" /> Favoritos
          </h3>
          <div className="flex flex-col gap-1">
            {favoriteTeams.map((p) => (
              <ParticipantRow key={`fav-${p.id}`} participant={p}
                isMine={user?.id === p.userId || user?.username === p.username}
                isFavorite onToggleFavorite={() => user && toggleFavorite(p.id)}
                onOpen={() => setSelectedTeam(p)}
                expanded={expandedRow === `fav-${p.id}`}
                onToggleExpand={() => setExpandedRow(expandedRow === `fav-${p.id}` ? null : `fav-${p.id}`)} />
            ))}
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} style={{ height: 56 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState text="Sin resultados" icon={BarChart3} />
      ) : (
        <div className="flex flex-col gap-1">
          {filtered.map((p) => (
            <ParticipantRow key={p.id} participant={p}
              isMine={user?.id === p.userId || user?.username === p.username}
              isFavorite={favorites.includes(p.id)}
              onToggleFavorite={() => user && toggleFavorite(p.id)}
              onOpen={() => setSelectedTeam(p)}
              expanded={expandedRow === p.id}
              onToggleExpand={() => setExpandedRow(expandedRow === p.id ? null : p.id)} />
          ))}
        </div>
      )}

      {selectedTeam && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center"
          style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)" }}
          onClick={() => setSelectedTeam(null)} role="dialog" aria-modal="true">
          <div className="rounded-t-3xl w-full max-w-[640px] max-h-[88vh] overflow-y-auto p-5 animate-slide-up bg-bg-1"
            style={{ border: "1px solid rgb(var(--border-default))" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "rgb(var(--border-default))" }} />
            <ParticipantDetail team={selectedTeam} onClose={() => setSelectedTeam(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function ParticipantRow({ participant, isMine, isFavorite, onToggleFavorite, onOpen, expanded, onToggleExpand }: {
  participant: Team; isMine: boolean; isFavorite: boolean;
  onToggleFavorite: () => void; onOpen: () => void;
  expanded: boolean; onToggleExpand: () => void;
}) {
  const rank = participant.currentRank;
  const hasMedal = rank >= 1 && rank <= 3;

  return (
    <div className="flex flex-col">
      <div className="card flex items-center gap-2.5 !py-3 !px-3.5 cursor-pointer animate-fade-in"
        style={{
          borderLeft: hasMedal
            ? `3px solid ${rank === 1 ? "#C99625" : rank === 2 ? "#9CA3AF" : "#A66830"}`
            : isMine ? "3px solid rgb(var(--accent-participante))" : "3px solid transparent",
          background: isMine ? "rgba(63,157,78,0.04)" : undefined,
        }}
        onClick={onOpen} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}>
        <div className="flex items-center gap-1.5 min-w-[36px]">
          {hasMedal ? <Medal rank={rank} /> : (
            <span className="font-display text-sm font-extrabold text-text-faint min-w-[20px] text-center">{rank}</span>
          )}
        </div>
        <InitialsAvatar name={participant.name} size={36} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{participant.name}</p>
          <p className="text-[10px] text-text-muted">@{participant.username}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="font-display text-base font-bold text-text-warm tabular-nums">{participant.totalPoints}</span>
            <span className="text-[9px] text-text-muted ml-0.5">pts</span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className="p-1.5 bg-transparent border-none cursor-pointer rounded-md hover:bg-bg-2 transition-colors"
            aria-label={isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}>
            {isFavorite ? <Star size={14} fill="rgb(var(--gold))" color="rgb(var(--gold))" /> : <Star size={14} className="text-text-faint" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            className="p-1.5 bg-transparent border-none cursor-pointer rounded-md hover:bg-bg-2 transition-colors text-text-muted"
            aria-label={expanded ? "Contraer" : "Expandir"} aria-expanded={expanded}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-1 mb-1 px-3.5 py-3 rounded-xl animate-slide-down"
          style={{ background: "rgb(var(--bg-elevated))", border: "1px solid rgb(var(--border-subtle))" }}>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <BreakdownStat label="Grupos" value={participant.groupPoints} />
            <BreakdownStat label="Eliminatorias" value={participant.finalPhasePoints} />
            <BreakdownStat label="Especiales" value={participant.specialPoints} />
          </div>
          <MatchBreakdown team={participant} />
        </div>
      )}
    </div>
  );
}

function BreakdownStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center p-2 rounded-lg" style={{ background: "rgb(var(--bg-surface))" }}>
      <p className="text-[9px] uppercase tracking-wider text-text-muted mb-0.5">{label}</p>
      <p className="font-display text-base font-bold text-text-primary tabular-nums">{value}</p>
    </div>
  );
}

function MatchBreakdown({ team }: { team: Team }) {
  const groupedFixtures = useMemo(() => {
    const map: Record<string, typeof FIXTURES> = {};
    FIXTURES.forEach((f) => {
      if (!f.group) return;
      if (!map[f.group]) map[f.group] = [];
      map[f.group].push(f);
    });
    return map;
  }, []);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  return (
    <div>
      <p className="text-[9px] uppercase tracking-widest font-semibold text-text-muted mb-2">Picks por grupo</p>
      <div className="flex flex-wrap gap-1 mb-2">
        {Object.keys(groupedFixtures).map((g) => (
          <button key={g} className={`pill !py-1 !px-2.5 text-[10px] ${openGroup === g ? "active" : ""}`}
            onClick={() => setOpenGroup(openGroup === g ? null : g)}>{g}</button>
        ))}
      </div>
      {openGroup && (
        <div className="flex flex-col gap-1 animate-fade-in">
          {groupedFixtures[openGroup].map((fixture) => {
            const pick = team.matchPicks?.[fixture.id];
            if (!pick) return null;
            const isDouble = team.doubleMatches?.[openGroup] === fixture.id;
            const hasScore = typeof pick.home === "number" && typeof pick.away === "number";
            return (
              <div key={fixture.id} className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg text-[11px]"
                style={{ background: "rgb(var(--bg-surface))" }}>
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <Flag country={fixture.homeTeam} size="sm" />
                  <span className="truncate">{fixture.homeTeam}</span>
                </div>
                <span className="font-display text-xs font-bold tabular-nums px-2 py-0.5 rounded-md"
                  style={{
                    background: isDouble ? "rgb(var(--gold-soft))" : "rgb(var(--bg-muted))",
                    color: isDouble ? "rgb(var(--gold))" : "rgb(var(--text-secondary))",
                    border: isDouble ? "1px solid rgba(var(--gold),0.3)" : undefined,
                  }}>
                  {hasScore ? `${pick.home}-${pick.away}` : "·-·"}
                </span>
                <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
                  <span className="truncate">{fixture.awayTeam}</span>
                  <Flag country={fixture.awayTeam} size="sm" />
                </div>
                <PickChip status={pick.status} points={pick.points} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ParticipantDetail({ team, onClose }: { team: Team; onClose: () => void }) {
  const hasMedal = team.currentRank >= 1 && team.currentRank <= 3;
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <InitialsAvatar name={team.name} size={44} />
          <div>
            <h3 className="font-display text-xl font-black tracking-tight text-text-warm">{team.name}</h3>
            <p className="text-xs text-text-muted mt-0.5">@{team.username}</p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-xl p-2 cursor-pointer text-text-muted bg-bg-2 border-none" aria-label="Cerrar">
          <X size={17} />
        </button>
      </div>
      <div className="card-elevated rounded-2xl text-center py-5 mb-4"
        style={{ background: "linear-gradient(135deg, rgba(var(--gold-soft), 1), rgba(var(--bg-surface), 1))", border: "1px solid rgba(var(--gold), 0.18)" }}>
        <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Puntos totales</p>
        <p className="font-display text-5xl font-black text-gold tabular-nums">{team.totalPoints}</p>
        <div className="mt-2 flex items-center justify-center gap-2">
          {hasMedal && <Medal rank={team.currentRank} />}
          <span className="badge badge-gold">#{team.currentRank}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: "Grupos", val: team.groupPoints, color: "rgb(var(--success))" },
          { label: "Eliminatorias", val: team.finalPhasePoints, color: "rgb(var(--gold))" },
          { label: "Especiales", val: team.specialPoints, color: "rgb(var(--accent-versus))" },
        ].map((k) => (
          <div key={k.label} className="card text-center !p-3">
            <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1">{k.label}</p>
            <p className="font-display text-2xl font-bold tabular-nums" style={{ color: k.color }}>{k.val}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="card flex items-center gap-2.5">
          <Flag country={team.championPick} size="md" />
          <div>
            <p className="text-[9px] text-text-muted uppercase tracking-wider">Campeón</p>
            <p className="text-sm font-semibold text-text-primary">{team.championPick}</p>
          </div>
        </div>
        <div className="card flex items-center gap-2.5">
          <Flag country={team.runnerUpPick} size="md" />
          <div>
            <p className="text-[9px] text-text-muted uppercase tracking-wider">Subcampeón</p>
            <p className="text-sm font-semibold text-text-primary">{team.runnerUpPick}</p>
          </div>
        </div>
      </div>
      <h4 className="text-[10px] text-text-muted uppercase tracking-widest mb-2">Picks especiales</h4>
      <div className="grid grid-cols-2 gap-1.5">
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
          <div key={i} className="py-2 px-2.5 rounded-xl"
            style={{ background: "rgb(var(--bg-elevated))", border: "1px solid rgb(var(--border-subtle))" }}>
            <p className="text-[9px] text-text-muted uppercase tracking-wider mb-0.5">{s.label}</p>
            <p className="text-xs font-semibold text-text-primary">
              {s.isC ? <CountryWithFlag country={String(s.val)} size="sm" /> : s.val || "—"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
