"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, Eye, EyeOff, LogOut, Plus, Shield, Star, Trash2, User } from "lucide-react";
import { MiPorraBuilder } from "@/components/mi-porra-builder";
import { CountryWithFlag, EmptyState, Flag, GroupBadge } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import { FIXTURES, GROUPS, GROUP_COLORS, KNOCKOUT_ROUND_DEFS, type Team } from "@/lib/data";
import type { AdminResults } from "@/lib/admin-results";
import { buildTeamCsv, buildTeamCsvFilename } from "@/lib/export-team-csv";
import { useScoredParticipants } from "@/lib/use-scored-participants";

export default function MiClubPage() {
  const { user, login, logout, favorites, toggleFavorite } = useAuth();

  if (!user) {
    return <LoginView onLogin={login} />;
  }

  return (
    <AuthenticatedMiClub
      user={user}
      onLogout={logout}
      favorites={favorites}
      toggleFavorite={toggleFavorite}
    />
  );
}

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
  const { adminResults, participants, isLoading, error, userTeamsStore, mutateUserTeams } = useScoredParticipants();
  const [creatingNew, setCreatingNew] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const userTeams = useMemo(
    () => participants.filter((participant) => participant.source === "user" && participant.userId === user.id),
    [participants, user.id]
  );
  const canCreateMore = userTeams.length < 3;
  const activeTeam = userTeams.find((participant) => participant.id === selectedTeamId) || userTeams[0] || null;

  useEffect(() => {
    if (!userTeams.length) {
      setSelectedTeamId(null);
      return;
    }

    if (!selectedTeamId || !userTeams.some((participant) => participant.id === selectedTeamId)) {
      setSelectedTeamId(userTeams[0].id);
    }
  }, [selectedTeamId, userTeams]);

  useEffect(() => {
    if (!canCreateMore && creatingNew) {
      setCreatingNew(false);
    }
  }, [canCreateMore, creatingNew]);

  const handleSaved = async (teamId: string) => {
    setActionError("");
    const refreshedStore = await mutateUserTeams();
    const refreshedEntries = refreshedStore?.entries ?? userTeamsStore.entries;
    const savedTeam = refreshedEntries.find((entry) => entry.userId === user.id && entry.id === teamId);
    setSelectedTeamId(savedTeam?.id ?? teamId);
    setCreatingNew(false);
  };

  const handleDelete = async (team: Team) => {
    if (deletePendingId) return;

    const confirmed = window.confirm(`¿Seguro que quieres eliminar la porra \"${team.name}\"?`);
    if (!confirmed) return;

    setActionError("");
    setDeletePendingId(team.id);

    try {
      const response = await fetch("/api/user-teams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: team.id, userId: user.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se ha podido eliminar la porra.");
      }

      const refreshedStore = await mutateUserTeams();
      const refreshedEntries = refreshedStore?.entries ?? userTeamsStore.entries;
      const remainingTeams = refreshedEntries.filter((entry) => entry.userId === user.id);
      setSelectedTeamId(remainingTeams[0]?.id ?? null);
      setCreatingNew(false);
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : "No se ha podido eliminar la porra.");
    } finally {
      setDeletePendingId(null);
    }
  };

  const loadErrorMessage = error instanceof Error ? error.message : "";

  if (isLoading && !creatingNew && userTeams.length === 0) {
    return <LoadingState />;
  }

  if (creatingNew && canCreateMore) {
    return (
      <MiPorraBuilder
        user={user}
        onSaved={handleSaved}
        onCancel={() => setCreatingNew(false)}
      />
    );
  }

  if (!userTeams.length) {
    return (
      <EmptyMiClubState
        user={user}
        onLogout={onLogout}
        onCreateNew={canCreateMore ? () => setCreatingNew(true) : undefined}
        canCreateMore={canCreateMore}
        errorMessage={actionError || loadErrorMessage}
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
      onDeleteActive={activeTeam ? () => handleDelete(activeTeam) : undefined}
      deletePending={Boolean(activeTeam && deletePendingId === activeTeam.id)}
      actionError={actionError}
    />
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[72vh] items-center justify-center px-4">
      <div className="card w-full max-w-[360px] text-center !py-8 animate-fade-in">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[16px] border border-gold/15 bg-gold/10 text-gold-light">
          <User size={22} />
        </div>
        <p className="font-display text-lg font-bold text-text-warm">Cargando Mi Club</p>
        <p className="mt-2 text-sm text-text-muted">Recuperando tus porras guardadas…</p>
      </div>
    </div>
  );
}

function EmptyMiClubState({
  user,
  onLogout,
  onCreateNew,
  canCreateMore,
  errorMessage,
}: {
  user: { id: string; username: string };
  onLogout: () => void;
  onCreateNew?: () => void;
  canCreateMore: boolean;
  errorMessage?: string;
}) {
  return (
    <div className="mx-auto max-w-[720px] px-4 pt-4">
      <div className="mb-4 flex items-center justify-between gap-3 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-text-warm">Mi Club</h1>
          <p className="mt-1 text-xs text-text-muted">Cuando guardes una porra aparecerá aquí en modo solo lectura.</p>
        </div>
        <button className="btn btn-ghost !px-3.5 !py-2 text-xs" onClick={onLogout}>
          <LogOut size={14} /> Cerrar sesión
        </button>
      </div>

      <div className="card mb-3 flex flex-wrap items-center gap-3 animate-fade-in">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-accent-participante/10">
          <User size={20} className="text-accent-participante" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-text-muted">Usuario</p>
          <p className="text-sm font-semibold">@{user.username}</p>
        </div>
        <span className="badge badge-muted text-[10px]">0/3 porras</span>
        {onCreateNew ? (
          <button className="btn btn-ghost !px-3 !py-2 text-xs" onClick={onCreateNew}>
            <Plus size={14} /> Crear porra
          </button>
        ) : canCreateMore ? null : (
          <span className="badge badge-muted text-[10px]">Límite alcanzado</span>
        )}
      </div>

      <div className="card card-glow mb-4 bg-gradient-to-br from-bg-4 to-bg-2 !border-gold/10 !p-5 animate-fade-in">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] border border-gold/15 bg-gold/10 text-gold-light">
            <User size={28} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Tarjeta de identificación</p>
            <h2 className="mt-2 font-display text-[26px] font-extrabold text-text-warm">@{user.username}</h2>
            <p className="mt-1 text-sm text-text-muted">Todavía no has creado ninguna porra. Aquí se mostrará tu ficha en cuanto guardes la primera.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="badge badge-muted text-[10px]">0/3 porras</span>
              <span className="badge badge-gold text-[10px]">Pendiente de crear</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: "Campeón", value: "—" },
            { label: "Subcampeón", value: "—" },
            { label: "3.º puesto", value: "—" },
          ].map((item) => (
            <div key={item.label} className="card text-center !p-3">
              <p className="text-[9px] text-text-muted">{item.label}</p>
              <p className="mt-1 font-display text-lg font-bold text-text-warm">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <EmptyState
        title="Tu club está vacío"
        text="Crea tu primera porra para empezar. No volveremos a consultar tus porras hasta que guardes o elimines una de forma explícita."
        icon={User}
        action={
          onCreateNew ? (
            <button className="btn btn-primary !px-5 !py-3 text-sm" onClick={onCreateNew}>
              <Plus size={16} /> Crear porra
            </button>
          ) : null
        }
      />

      {errorMessage ? <p className="mt-3 text-center text-xs text-text-muted">{errorMessage}</p> : null}
    </div>
  );
}

function LoginView({ onLogin }: { onLogin: (username: string, password: string) => boolean }) {
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
      if (!onLogin(username, password)) {
        setError("Credenciales incorrectas");
      }
      setLoading(false);
    }, 600);
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="card w-full max-w-[360px] bg-gradient-to-b from-bg-4 to-bg-2 text-center !p-7 animate-fade-in">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[14px] border border-gold/20 bg-gold/10">
          <Shield size={28} className="text-gold" />
        </div>
        <h2 className="font-display text-[22px] font-extrabold text-text-warm">Mi Club</h2>
        <p className="mt-2 text-xs text-text-muted">Entra para crear tu porra, verla en modo lectura y exportarla a CSV.</p>
        <div className="mb-3 mt-6 text-left">
          <label className="mb-1 block text-[11px] text-text-muted">@usuario</label>
          <input className="input-field" placeholder="@usuario" value={username} onChange={(event) => setUsername(event.target.value)} />
        </div>
        <div className="mb-4 text-left">
          <label className="mb-1 block text-[11px] text-text-muted">Contraseña</label>
          <div className="relative">
            <input
              className="input-field !pr-10"
              type={showPass ? "text" : "password"}
              placeholder="Contraseña"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-2.5 top-1/2 -translate-y-1/2 border-none bg-transparent text-text-muted">
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {error ? <p className="mb-3 text-xs text-danger">{error}</p> : null}
        <button className="btn btn-primary w-full !py-3.5" onClick={handle} disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
        <Link href="/admin/login" className="btn btn-ghost mt-2 w-full !py-3 text-sm no-underline">
          <Shield size={14} /> Acceso Admin
        </Link>
      </div>
    </div>
  );
}

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
  onDeleteActive,
  deletePending,
  actionError,
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
  onDeleteActive?: () => void;
  deletePending?: boolean;
  actionError?: string;
}) {
  const [activeTab, setActiveTab] = useState("resumen");
  const tabs = ["Resumen", "Partidos", "Grupos", "Eliminatorias", "Especiales", "Favoritos"];

  const exportCsv = () => {
    if (!activeTeam) return;
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
  };

  if (!activeTeam) {
    return (
      <div className="mx-auto max-w-[640px] px-4 pt-4">
        <EmptyState text="Todavía no tienes ninguna porra guardada." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 pt-4">
      <div className="mb-4 flex items-center justify-between gap-3 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-text-warm">Mi Club</h1>
          <p className="mt-1 text-xs text-text-muted">Tus porras entregadas quedan en modo solo lectura.</p>
        </div>
        <button className="btn btn-ghost !px-3.5 !py-2 text-xs" onClick={onLogout}>
          <LogOut size={14} /> Cerrar sesión
        </button>
      </div>

      {actionError ? <p className="mb-3 text-center text-xs text-text-muted">{actionError}</p> : null}

      <div className="card mb-3 flex flex-wrap items-center gap-3 animate-fade-in">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-accent-participante/10">
          <User size={20} className="text-accent-participante" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-text-muted">Usuario</p>
          <p className="text-sm font-semibold">@{user.username}</p>
        </div>
        <span className="badge badge-green text-[10px]">{userTeams.length}/3 porras</span>
        {onCreateNew ? (
          <button className="btn btn-ghost !px-3 !py-2 text-xs" onClick={onCreateNew}>
            <Plus size={14} /> Crear nueva porra
          </button>
        ) : canCreateMore ? null : (
          <span className="badge badge-muted text-[10px]">Límite alcanzado</span>
        )}
      </div>

      {userTeams.length > 1 ? (
        <div className="mb-3 flex gap-1.5 overflow-x-auto">
          {userTeams.map((team) => (
            <button
              key={team.id}
              className={`pill ${activeTeamId === team.id ? "active" : ""}`}
              onClick={() => onSelectTeam(team.id)}
            >
              {team.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="card card-glow mb-2 bg-gradient-to-br from-bg-4 to-bg-2 text-center !border-gold/10 !py-5 animate-fade-in">
        <div className="mb-2 flex flex-wrap items-center justify-center gap-2 text-[11px] text-text-muted">
          <span className="inline-flex items-center gap-1"><Flag country={activeTeam.championPick} size="sm" />Campeón: {activeTeam.championPick || "—"}</span>
          <span className="inline-flex items-center gap-1"><Flag country={activeTeam.runnerUpPick} size="sm" />Subcampeón: {activeTeam.runnerUpPick || "—"}</span>
          <span className="inline-flex items-center gap-1"><Flag country={activeTeam.thirdPlacePick} size="sm" />3.º: {activeTeam.thirdPlacePick || "—"}</span>
        </div>
        <p className="font-display text-[40px] font-black text-gold-light">{activeTeam.totalPoints}</p>
        <span className="badge badge-gold mt-1">#{activeTeam.currentRank} de {participants.length}</span>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="badge badge-muted text-[10px]">Solo lectura</span>
          {onDeleteActive ? (
            <button className="btn btn-ghost !px-3 !py-2 text-xs text-danger" onClick={onDeleteActive} disabled={deletePending}>
              <Trash2 size={14} /> {deletePending ? "Eliminando..." : "Eliminar porra"}
            </button>
          ) : null}
          <button className="btn btn-ghost !px-3 !py-2 text-xs" onClick={exportCsv}>
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-1.5">
        {[
          { label: "Fase de grupos", value: activeTeam.groupPoints },
          { label: "Fase final", value: activeTeam.finalPhasePoints },
          { label: "Especiales", value: activeTeam.specialPoints },
        ].map((item) => (
          <div key={item.label} className="card text-center !p-2.5">
            <p className="text-[9px] text-text-muted">{item.label}</p>
            <p className="font-display text-lg font-bold">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-3.5 flex gap-0.5 overflow-x-auto rounded-[10px] bg-bg-3 p-[3px]">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`whitespace-nowrap rounded-lg border-none px-3.5 py-2 text-xs font-medium transition-all ${activeTab === tab.toLowerCase() ? "bg-bg-5 text-text-primary" : "bg-transparent text-text-muted"}`}
            onClick={() => setActiveTab(tab.toLowerCase())}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="animate-fade-in">
        {activeTab === "resumen" ? <TabResumen team={activeTeam} /> : null}
        {activeTab === "partidos" ? <TabPartidos team={activeTeam} /> : null}
        {activeTab === "grupos" ? <TabGrupos team={activeTeam} /> : null}
        {activeTab === "eliminatorias" ? <TabEliminatorias team={activeTeam} /> : null}
        {activeTab === "especiales" ? <TabEspeciales team={activeTeam} /> : null}
        {activeTab === "favoritos" ? <TabFavoritos favorites={favorites} toggleFavorite={toggleFavorite} participants={participants} /> : null}
      </div>
    </div>
  );
}

function TabResumen({ team }: { team: Team }) {
  return (
    <div>
      {[
        { label: "Puntos totales", value: team.totalPoints, highlight: true },
        { label: "Puntos fase de grupos", value: team.groupPoints },
        { label: "Puntos eliminatorias", value: team.finalPhasePoints },
        { label: "Puntos especiales", value: team.specialPoints },
      ].map((item) => (
        <div key={item.label} className="flex justify-between border-b border-[rgb(var(--divider)/0.06)] py-2.5">
          <span className={`text-sm ${item.highlight ? "font-semibold text-text-warm" : "text-text-muted"}`}>{item.label}</span>
          <span className={`font-display text-sm ${item.highlight ? "font-extrabold text-gold-light" : "font-semibold"}`}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function TabPartidos({ team }: { team: Team }) {
  const [selectedGroup, setSelectedGroup] = useState("A");
  const fixtures = FIXTURES.filter((fixture) => fixture.group === selectedGroup);
  const doubleMatchId = team.doubleMatches?.[selectedGroup];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="mb-1 flex gap-1 overflow-x-auto pb-1">
        {Object.keys(GROUPS).map((group) => (
          <button
            key={group}
            className={`pill !px-2.5 !py-1 ${selectedGroup === group ? "active" : ""}`}
            onClick={() => setSelectedGroup(group)}
            style={selectedGroup === group ? { background: `${GROUP_COLORS[group]}22`, color: GROUP_COLORS[group], borderColor: GROUP_COLORS[group] } : undefined}
          >
            {group}
          </button>
        ))}
      </div>

      {fixtures.map((fixture) => {
        const pick = team.matchPicks?.[fixture.id];
        const isDouble = fixture.id === doubleMatchId;

        return (
          <div key={fixture.id} className="card !px-3 !py-2.5" style={{ borderLeft: isDouble ? "3px solid #DFBE38" : "3px solid transparent" }}>
            <div className="mb-1 flex items-center gap-1.5">
              <GroupBadge group={selectedGroup} />
              <span className="text-[10px] text-text-muted">{fixture.round}</span>
              {isDouble ? <span className="badge badge-amber text-[8px] !px-1.5 !py-0">DOBLE</span> : null}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1"><Flag country={fixture.homeTeam} size="sm" /><span className="truncate text-[11px]">{fixture.homeTeam}</span></div>
              {pick ? (
                <span className="rounded bg-bg-2 px-2 py-0.5 font-display text-sm font-bold text-text-muted">{pick.home} - {pick.away}</span>
              ) : (
                <span className="text-[11px] text-text-muted">—</span>
              )}
              <div className="flex min-w-0 items-center gap-1"><span className="truncate text-[11px]">{fixture.awayTeam}</span><Flag country={fixture.awayTeam} size="sm" /></div>
            </div>
            <div className="mt-1 text-center"><span className="badge badge-muted text-[9px]">Pendiente</span></div>
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
              {order.map((country, index) => (
                <div key={`${group}-${country}-${index}`} className="flex items-center gap-1.5">
                  <span className="w-3.5 text-[11px] font-bold text-text-muted">{index + 1}</span>
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
            <h4 className="mb-1.5 font-display text-sm font-bold text-text-muted">{round.name} <span className="text-[10px] font-normal">({round.pts} pts)</span></h4>
            <div className="flex flex-wrap gap-1">
              {picks.map((pick, index) => (
                <div key={`${round.key}-${index}`} className="card flex items-center gap-1.5 !px-2.5 !py-1.5">
                  <Flag country={pick.country} size="sm" /><span className="text-[11px]">{pick.country || "Pendiente"}</span>
                  <span className={`badge text-[9px] ${pick.status === "correct" ? "badge-green" : pick.status === "wrong" ? "badge-red" : "badge-muted"}`}>
                    {pick.status === "correct" ? `${round.pts} pts` : pick.status === "wrong" ? "0 pts" : "Pendiente"}
                  </span>
                </div>
              ))}
              {!picks.length ? <span className="text-[11px] text-text-muted">Sin picks</span> : null}
            </div>
          </div>
        );
      })}
      <div className="card bg-gold/[0.03] !border-gold/15 !p-4 text-center">
        <p className="mb-2 text-[11px] font-semibold text-gold">Podio final</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center"><Flag country={team.championPick} /><p className="mt-0.5 text-[11px]">Campeón</p><p className="text-[10px] text-text-muted">{team.championPick}</p></div>
          <div className="text-center"><Flag country={team.runnerUpPick} /><p className="mt-0.5 text-[11px]">Subcampeón</p><p className="text-[10px] text-text-muted">{team.runnerUpPick}</p></div>
          <div className="text-center"><Flag country={team.thirdPlacePick} /><p className="mt-0.5 text-[11px]">3.º puesto</p><p className="text-[10px] text-text-muted">{team.thirdPlacePick}</p></div>
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
            <p className="mt-0.5 text-sm font-semibold">{item.isCountry ? <CountryWithFlag country={String(item.value)} /> : item.value}</p>
          </div>
          <div className="text-right">
            <span className="badge badge-muted">{item.points} pts</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TabFavoritos({ favorites, toggleFavorite, participants }: { favorites: string[]; toggleFavorite: (id: string) => void; participants: Team[] }) {
  const favoriteTeams = participants.filter((participant) => favorites.includes(participant.id));
  if (!favoriteTeams.length) return <EmptyState text="Aún no tienes favoritos. Márcalos desde la clasificación." icon={Star} />;

  return (
    <div className="flex flex-col gap-1">
      {favoriteTeams.map((participant) => (
        <div key={participant.id} className="card flex items-center gap-2.5 !px-3 !py-2.5">
          <span className="min-w-[28px] text-center font-display text-base font-extrabold text-text-muted">#{participant.currentRank}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text-warm">{participant.name}</p>
            <p className="text-[11px] text-text-muted">@{participant.username} · {participant.totalPoints} pts</p>
          </div>
          <button type="button" onClick={() => toggleFavorite(participant.id)} className="cursor-pointer border-none bg-transparent p-1">
            <Star size={14} fill="#D4AF37" color="#D4AF37" />
          </button>
        </div>
      ))}
    </div>
  );
}
