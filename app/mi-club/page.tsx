"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, EyeOff, LogOut, Plus, Shield, Star, User } from "lucide-react";
import { MiPorraBuilder } from "@/components/mi-porra-builder";
import {
  CountryWithFlag,
  EmptyState,
  Flag,
  GroupBadge,
  InitialsAvatar,
  Medal,
  PickChip,
  Skeleton,
} from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import {
  FIXTURES,
  GROUPS,
  GROUP_COLORS,
  KNOCKOUT_ROUND_DEFS,
  type Team,
} from "@/lib/data";
import type { AdminResults } from "@/lib/admin-results";
import { buildTeamCsv, buildTeamCsvFilename } from "@/lib/export-team-csv";
import { useScoredParticipants } from "@/lib/use-scored-participants";
import { useToast } from "@/components/toast-provider";

export default function MiClubPage() {
  const { user, login, logout, favorites, toggleFavorite } = useAuth();
  if (!user) return <LoginView onLogin={login} />;
  return (
    <AuthenticatedMiClub
      user={user}
      onLogout={logout}
      favorites={favorites}
      toggleFavorite={toggleFavorite}
    />
  );
}

// ─── Authenticated container ─────────────────────────

function AuthenticatedMiClub({
  user,
  onLogout,
  favorites,
  toggleFavorite,
}: {
  user: { id: string; username: string };
  onLogout: () => void;
  favorites: string[];
  toggleFavorite: (teamId: string) => void;
}) {
  const { adminResults, participants, isLoading } = useScoredParticipants();
  const [creatingNew, setCreatingNew] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Solo mostrar el spinner de carga inicial. Las revalidaciones de SWR
  // (revalidateOnFocus) NO deben volver a poner la UI en loading: causaría
  // el ciclo de refresco que ya corregimos en iteraciones anteriores.
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!isLoading) initialLoadDone.current = true;
  }, [isLoading]);

  const userTeams = useMemo(
    () => participants.filter((p) => p.userId === user.id),
    [participants, user.id]
  );
  const canCreateMore = userTeams.length < 3;
  const activeTeam =
    userTeams.find((p) => p.id === selectedTeamId) || userTeams[0] || null;

  // Guardia en setState para evitar bucle de re-render cuando userTeams es []
  useEffect(() => {
    if (!userTeams.length) {
      if (selectedTeamId !== null) setSelectedTeamId(null);
      return;
    }
    if (!selectedTeamId || !userTeams.some((p) => p.id === selectedTeamId)) {
      setSelectedTeamId(userTeams[0].id);
    }
  }, [selectedTeamId, userTeams]);

  useEffect(() => {
    if (!canCreateMore && creatingNew) setCreatingNew(false);
  }, [canCreateMore, creatingNew]);

  const handleSaved = (teamId: string) => {
    setSelectedTeamId(teamId);
    setCreatingNew(false);
  };

  if (!initialLoadDone.current && isLoading && !creatingNew) {
    return <LoadingState />;
  }

  if (!userTeams.length || (creatingNew && canCreateMore)) {
    return (
      <MiPorraBuilder
        user={user}
        onSaved={handleSaved}
        onCancel={userTeams.length > 0 ? () => setCreatingNew(false) : undefined}
      />
    );
  }

  return (
    <PrivateZone
      user={user}
      onLogout={onLogout}
      favorites={favorites}
      toggleFavorite={toggleFavorite}
      participants={participants}
      adminResults={adminResults}
      userTeams={userTeams}
      activeTeam={activeTeam}
      activeTeamId={selectedTeamId}
      onSelectTeam={setSelectedTeamId}
      onCreateNew={canCreateMore ? () => setCreatingNew(true) : undefined}
      canCreateMore={canCreateMore}
    />
  );
}

// ─── Loading skeleton ────────────────────────────────

function LoadingState() {
  return (
    <div className="px-4 pt-5 max-w-[640px] mx-auto">
      <Skeleton style={{ height: 32, width: 140 }} className="mb-5" />
      <Skeleton style={{ height: 64 }} className="mb-3" />
      <Skeleton style={{ height: 180 }} className="mb-3" />
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Skeleton style={{ height: 60 }} />
        <Skeleton style={{ height: 60 }} />
        <Skeleton style={{ height: 60 }} />
      </div>
      <Skeleton style={{ height: 240 }} />
    </div>
  );
}

// ─── Login view ──────────────────────────────────────

function LoginView({
  onLogin,
}: {
  onLogin: (username: string, password: string) => boolean;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = () => {
    if (!username || !password) {
      setError("Completa los campos");
      return;
    }
    setLoading(true);
    setError("");
    window.setTimeout(() => {
      if (!onLogin(username, password)) setError("Credenciales incorrectas");
      setLoading(false);
    }, 500);
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="card-elevated rounded-3xl w-full max-w-[380px] !p-8 text-center animate-fade-in">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-soft border border-gold/20">
          <Shield size={26} className="text-gold" />
        </div>
        <h2 className="font-display text-[22px] font-extrabold text-text-warm">Mi Club</h2>
        <p className="mt-2 text-xs text-text-muted">
          Entra para crear tu porra, verla en modo lectura y exportarla a CSV.
        </p>

        <div className="mb-3 mt-6 text-left">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-text-muted">
            Usuario
          </label>
          <input
            className="input-field"
            placeholder="@usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handle()}
            autoComplete="username"
          />
        </div>

        <div className="mb-4 text-left">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-text-muted">
            Contraseña
          </label>
          <div className="relative">
            <input
              className="input-field !pr-10"
              type={showPass ? "text" : "password"}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handle()}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPass((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted bg-transparent border-none cursor-pointer"
              aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && <p className="mb-3 text-xs text-danger">{error}</p>}

        <button className="btn btn-primary w-full" onClick={handle} disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <Link
          href="/admin/login"
          className="btn btn-ghost mt-2 w-full !py-3 text-sm no-underline"
        >
          <Shield size={14} /> Acceso admin
        </Link>
      </div>
    </div>
  );
}

// ─── Private zone ────────────────────────────────────

function PrivateZone({
  user,
  onLogout,
  favorites,
  toggleFavorite,
  participants,
  adminResults,
  userTeams,
  activeTeam,
  activeTeamId,
  onSelectTeam,
  onCreateNew,
  canCreateMore,
}: {
  user: { id: string; username: string };
  onLogout: () => void;
  favorites: string[];
  toggleFavorite: (teamId: string) => void;
  participants: Team[];
  adminResults: AdminResults;
  userTeams: Team[];
  activeTeam: Team | null;
  activeTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
  onCreateNew?: () => void;
  canCreateMore: boolean;
}) {
  const [activeTab, setActiveTab] = useState("resumen");
  const tabs = ["Resumen", "Partidos", "Grupos", "Eliminatorias", "Especiales", "Favoritos"];
  const toast = useToast();

  const exportCsv = () => {
    if (!activeTeam) return;
    try {
      const csv = buildTeamCsv(activeTeam, adminResults);
      const filename = buildTeamCsvFilename(activeTeam);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("CSV exportado correctamente");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al exportar CSV");
    }
  };

  if (!activeTeam) {
    return (
      <div className="mx-auto max-w-[640px] px-4 pt-4">
        <EmptyState text="Todavía no tienes ninguna porra guardada." />
      </div>
    );
  }

  const hasMedal = activeTeam.currentRank >= 1 && activeTeam.currentRank <= 3;

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-4">
      <div className="page-header animate-fade-in">
        <div>
          <h1 className="page-header__title">Mi Club</h1>
          <p className="text-[11px] text-text-muted">@{user.username}</p>
        </div>
        <div className="flex items-center gap-2">
          {onCreateNew ? (
            <button className="btn btn-ghost !px-3 !py-2 text-xs" onClick={onCreateNew}>
              <Plus size={14} /> Crear nueva porra
            </button>
          ) : !canCreateMore ? (
            <span className="badge badge-muted text-[10px]">Límite (3) alcanzado</span>
          ) : null}
          <button className="btn btn-ghost !px-3 !py-2 text-xs" onClick={onLogout}>
            <LogOut size={14} /> Salir
          </button>
        </div>
      </div>

      {userTeams.length > 1 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {userTeams.map((t) => (
            <button
              key={t.id}
              className={`pill ${activeTeamId === t.id ? "active" : ""}`}
              onClick={() => onSelectTeam(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* Hero card de la porra activa */}
      <div className="premium-hero mb-3 text-center animate-fade-in">
        <div className="relative">
          <div className="mb-3 flex items-center justify-center gap-2">
            <InitialsAvatar name={activeTeam.name} size={40} />
            <div className="text-left">
              <p className="font-display text-base font-bold text-text-primary">
                {activeTeam.name}
              </p>
              <p className="text-[10px] text-text-muted">Tu porra</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mb-3 text-[10px] text-text-muted">
            <span className="inline-flex items-center gap-1">
              <Flag country={activeTeam.championPick} size="sm" /> {activeTeam.championPick || "—"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Flag country={activeTeam.runnerUpPick} size="sm" /> {activeTeam.runnerUpPick || "—"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Flag country={activeTeam.thirdPlacePick} size="sm" /> {activeTeam.thirdPlacePick || "—"}
            </span>
          </div>

          <p className="font-display text-[44px] font-black text-gold leading-none tabular-nums">
            {activeTeam.totalPoints}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-text-muted mt-1">
            puntos totales
          </p>

          <div className="mt-3 flex items-center justify-center gap-2">
            {hasMedal && <Medal rank={activeTeam.currentRank} />}
            <span className="badge badge-gold">
              #{activeTeam.currentRank} de {participants.length}
            </span>
            <span className="badge badge-muted text-[10px]">Solo lectura</span>
            <button className="btn btn-ghost !px-3 !py-1.5 text-[11px]" onClick={exportCsv}>
              <Download size={12} /> CSV
            </button>
          </div>
        </div>
      </div>

      {/* Stats por sección */}
      <div className="mb-4 grid grid-cols-3 gap-1.5">
        {[
          { label: "Grupos", value: activeTeam.groupPoints, color: "rgb(var(--success))" },
          { label: "Eliminatorias", value: activeTeam.finalPhasePoints, color: "rgb(var(--gold))" },
          { label: "Especiales", value: activeTeam.specialPoints, color: "rgb(var(--accent-versus))" },
        ].map((item) => (
          <div key={item.label} className="card text-center !p-3">
            <p className="text-[9px] uppercase tracking-wider text-text-muted">{item.label}</p>
            <p
              className="font-display text-xl font-bold tabular-nums mt-0.5"
              style={{ color: item.color }}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-3.5 flex gap-0.5 overflow-x-auto rounded-xl p-[3px] bg-bg-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`whitespace-nowrap rounded-lg border-none px-3.5 py-2 text-xs font-medium transition-all ${
              activeTab === tab.toLowerCase()
                ? "bg-bg-1 text-text-primary shadow-sm"
                : "bg-transparent text-text-muted"
            }`}
            onClick={() => setActiveTab(tab.toLowerCase())}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="animate-fade-in">
        {activeTab === "resumen" && <TabResumen team={activeTeam} />}
        {activeTab === "partidos" && <TabPartidos team={activeTeam} />}
        {activeTab === "grupos" && <TabGrupos team={activeTeam} />}
        {activeTab === "eliminatorias" && <TabEliminatorias team={activeTeam} />}
        {activeTab === "especiales" && <TabEspeciales team={activeTeam} />}
        {activeTab === "favoritos" && (
          <TabFavoritos
            favorites={favorites}
            toggleFavorite={toggleFavorite}
            participants={participants}
          />
        )}
      </div>
    </div>
  );
}

// ─── Tabs ────────────────────────────────────────────

function TabResumen({ team }: { team: Team }) {
  return (
    <div>
      {[
        { label: "Puntos totales", value: team.totalPoints, highlight: true },
        { label: "Puntos fase de grupos", value: team.groupPoints },
        { label: "Puntos eliminatorias", value: team.finalPhasePoints },
        { label: "Puntos especiales", value: team.specialPoints },
      ].map((item) => (
        <div
          key={item.label}
          className="flex justify-between py-2.5 border-b"
          style={{ borderColor: "rgb(var(--border-subtle))" }}
        >
          <span
            className={`text-sm ${
              item.highlight ? "font-semibold text-text-warm" : "text-text-muted"
            }`}
          >
            {item.label}
          </span>
          <span
            className={`font-display text-sm tabular-nums ${
              item.highlight ? "font-extrabold text-gold" : "font-semibold text-text-primary"
            }`}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function TabPartidos({ team }: { team: Team }) {
  const [selectedGroup, setSelectedGroup] = useState("A");
  const fixtures = FIXTURES.filter((f) => f.group === selectedGroup);
  const doubleId = team.doubleMatches?.[selectedGroup];

  // Punteo en cabeza para que el usuario vea su total acumulado del grupo
  const groupTotal = fixtures.reduce((acc, f) => {
    const p = team.matchPicks?.[f.id]?.points;
    return acc + (typeof p === "number" ? p : 0);
  }, 0);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex gap-1 overflow-x-auto pb-1 flex-1">
          {Object.keys(GROUPS).map((g) => (
            <button
              key={g}
              className={`pill !px-2.5 !py-1 ${selectedGroup === g ? "active" : ""}`}
              onClick={() => setSelectedGroup(g)}
              style={
                selectedGroup === g
                  ? {
                      background: `${GROUP_COLORS[g]}1F`,
                      color: GROUP_COLORS[g],
                      borderColor: GROUP_COLORS[g],
                    }
                  : undefined
              }
            >
              {g}
            </button>
          ))}
        </div>
        <span className="badge badge-gold whitespace-nowrap">
          {groupTotal} pts
        </span>
      </div>

      {fixtures.map((fixture) => {
        const pick = team.matchPicks?.[fixture.id];
        const isDouble = fixture.id === doubleId;

        return (
          <div
            key={fixture.id}
            className="card !px-3 !py-2.5"
            style={{ borderLeft: isDouble ? "3px solid rgb(var(--gold))" : "3px solid transparent" }}
          >
            <div className="mb-1 flex items-center gap-1.5">
              <GroupBadge group={selectedGroup} />
              <span className="text-[10px] text-text-muted">{fixture.round}</span>
              {isDouble && <span className="badge badge-gold text-[8px] !px-1.5 !py-0">DOBLE</span>}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1 flex-1">
                <Flag country={fixture.homeTeam} size="sm" />
                <span className="truncate text-[11px] text-text-primary">{fixture.homeTeam}</span>
              </div>

              {pick ? (
                <span
                  className="rounded px-2 py-0.5 font-display text-sm font-bold tabular-nums"
                  style={{
                    background: "rgb(var(--bg-muted))",
                    color: "rgb(var(--text-secondary))",
                  }}
                >
                  {pick.home} - {pick.away}
                </span>
              ) : (
                <span className="text-[11px] text-text-muted">—</span>
              )}

              <div className="flex min-w-0 items-center gap-1 flex-1 justify-end">
                <span className="truncate text-[11px] text-text-primary">{fixture.awayTeam}</span>
                <Flag country={fixture.awayTeam} size="sm" />
              </div>
            </div>

            {/* Estado del pick INLINE — Phase 3 */}
            <div className="mt-1.5 flex justify-end">
              {pick ? (
                <PickChip status={pick.status} points={pick.points} />
              ) : (
                <PickChip status="pending" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TabGrupos({ team }: { team: Team }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Object.entries(GROUPS).map(([group, teams]) => {
        const order = team.groupOrderPicks?.[group] || teams;
        return (
          <div key={group} className="card !p-2.5">
            <GroupBadge group={group} />
            <div className="mt-2 flex flex-col gap-1">
              {order.map((country, idx) => (
                <div key={`${group}-${country}-${idx}`} className="flex items-center gap-1.5">
                  <span className="w-3.5 text-[11px] font-bold text-text-muted">{idx + 1}</span>
                  <Flag country={country} size="sm" />
                  <span className="truncate text-[11px]">{country}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TabEliminatorias({ team }: { team: Team }) {
  return (
    <div className="flex flex-col gap-2.5">
      {KNOCKOUT_ROUND_DEFS.map((round) => {
        const picks = team.knockoutPicks?.[round.key] || [];
        return (
          <div key={round.key}>
            <h4 className="mb-1.5 font-display text-sm font-bold text-text-warm">
              {round.name}{" "}
              <span className="text-[10px] font-normal text-text-muted">({round.pts} pts)</span>
            </h4>
            <div className="flex flex-wrap gap-1">
              {picks.map((pick, i) => (
                <div key={`${round.key}-${i}`} className="card flex items-center gap-1.5 !px-2.5 !py-1.5">
                  <Flag country={pick.country} size="sm" />
                  <span className="text-[11px]">{pick.country || "Pendiente"}</span>
                  <PickChip status={pick.status} points={pick.points} />
                </div>
              ))}
              {!picks.length && <span className="text-[11px] text-text-muted">Sin picks</span>}
            </div>
          </div>
        );
      })}
      <div
        className="card text-center !p-4"
        style={{
          background: "rgba(var(--gold-soft), 0.6)",
          border: "1px solid rgba(var(--gold), 0.18)",
        }}
      >
        <p className="mb-2 text-[11px] font-semibold text-gold uppercase tracking-widest">
          Podio final
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <Flag country={team.championPick} />
            <p className="mt-0.5 text-[11px] font-semibold">Campeón</p>
            <p className="text-[10px] text-text-muted">{team.championPick}</p>
          </div>
          <div className="text-center">
            <Flag country={team.runnerUpPick} />
            <p className="mt-0.5 text-[11px] font-semibold">Subcampeón</p>
            <p className="text-[10px] text-text-muted">{team.runnerUpPick}</p>
          </div>
          <div className="text-center">
            <Flag country={team.thirdPlacePick} />
            <p className="mt-0.5 text-[11px] font-semibold">3.º puesto</p>
            <p className="text-[10px] text-text-muted">{team.thirdPlacePick}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabEspeciales({ team }: { team: Team }) {
  const items = [
    { label: "Mejor Jugador", value: team.specials.mejorJugador, points: 20 },
    { label: "Mejor Jugador Joven", value: team.specials.mejorJoven, points: 20 },
    { label: "Máximo Goleador", value: team.specials.maxGoleador, points: 20 },
    { label: "Máximo Asistente", value: team.specials.maxAsistente, points: 20 },
    { label: "Mejor Portero", value: team.specials.mejorPortero, points: 20 },
    { label: "Máx. Goleador Español", value: team.specials.maxGoleadorEsp, points: 10 },
    { label: "Primer Gol Español", value: team.specials.primerGolEsp, points: 10 },
    { label: "Selección Revelación", value: team.specials.revelacion, points: 10, isCountry: true },
    { label: "Selección Decepción", value: team.specials.decepcion, points: 10, isCountry: true },
    { label: "Min. Primer Gol", value: `${team.specials.minutoPrimerGol}'`, points: 50 },
  ];
  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <div key={item.label} className="card flex items-center justify-between !px-3 !py-2.5">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-muted">{item.label}</p>
            <p className="mt-0.5 text-sm font-semibold text-text-primary">
              {item.isCountry ? <CountryWithFlag country={String(item.value)} /> : item.value}
            </p>
          </div>
          <span className="badge badge-muted">{item.points} pts</span>
        </div>
      ))}
    </div>
  );
}

function TabFavoritos({
  favorites,
  toggleFavorite,
  participants,
}: {
  favorites: string[];
  toggleFavorite: (id: string) => void;
  participants: Team[];
}) {
  const favoriteTeams = participants.filter((p) => favorites.includes(p.id));
  if (!favoriteTeams.length) {
    return (
      <EmptyState text="Aún no tienes favoritos. Márcalos desde la clasificación." icon={Star} />
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {favoriteTeams.map((p) => (
        <div key={p.id} className="card flex items-center gap-2.5 !px-3 !py-2.5">
          <span className="min-w-[28px] text-center font-display text-base font-extrabold text-text-muted">
            #{p.currentRank}
          </span>
          <InitialsAvatar name={p.name} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text-warm">{p.name}</p>
            <p className="text-[11px] text-text-muted">
              @{p.username} · {p.totalPoints} pts
            </p>
          </div>
          <button
            type="button"
            onClick={() => toggleFavorite(p.id)}
            className="cursor-pointer border-none bg-transparent p-1.5 rounded-md hover:bg-bg-2"
            aria-label="Quitar de favoritos"
          >
            <Star size={14} fill="rgb(var(--gold))" color="rgb(var(--gold))" />
          </button>
        </div>
      ))}
    </div>
  );
}
