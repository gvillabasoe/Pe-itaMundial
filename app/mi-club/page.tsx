"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Edit2,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  Plus,
  Shield,
  Star,
  User,
} from "lucide-react";
import { MiPorraBuilder } from "@/components/mi-porra-builder";
import { CountryWithFlag, EmptyState, Flag, GroupBadge } from "@/components/ui";
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

// ════════════════════════════════════════════════════════════
// Fecha límite para editar porras: 10 de junio 2026 a las 21:00 hora Madrid
// España está en CEST (UTC+2) en junio → 21:00 CEST = 19:00 UTC
// ════════════════════════════════════════════════════════════
const EDIT_DEADLINE = new Date("2026-06-10T19:00:00.000Z");

function canEditPorra(): boolean {
  return Date.now() < EDIT_DEADLINE.getTime();
}

function timeUntilDeadline(): string {
  const remaining = EDIT_DEADLINE.getTime() - Date.now();
  if (remaining <= 0) return "Fecha límite superada";
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  if (days > 1) return `Puedes editar hasta el 10 jun a las 21:00 (faltan ${days} días)`;
  if (days === 1) return `Puedes editar hasta el 10 jun a las 21:00 (mañana a las ${hours + 21}h)`;
  return `Edición disponible hasta las 21:00 del 10 jun (${hours}h restantes)`;
}

// ════════════════════════════════════════════════════════════
// Cálculo de progreso de una porra guardada
// Permite mostrar cuánto tiene completado el usuario
// ════════════════════════════════════════════════════════════
interface PorraProgress {
  percent: number;
  filledMatches: number;
  totalMatches: number;
  filledDoubles: number;
  filledPositions: number;
  hasKnockouts: boolean;
  hasPodium: boolean;
  isComplete: boolean;
}

function calculateTeamProgress(team: Team): PorraProgress {
  const groupKeys = Object.keys(GROUPS);
  const totalMatches = FIXTURES.filter((f) => f.stage === "groups").length;

  const filledMatches = Object.values(team.matchPicks || {}).filter(
    (p) => typeof p.home === "number" && typeof p.away === "number"
  ).length;

  const filledDoubles = groupKeys.filter((g) => {
    const d = team.doubleMatches?.[g];
    // doubleMatches es Record<string, string> — basta con que el valor no esté vacío
    return Boolean(d && d.length > 0);
  }).length;

  const filledPositions = groupKeys.filter((g) => {
    const picks = team.groupOrderPicks?.[g] || [];
    return picks.filter(Boolean).length === 4;
  }).length;

  const knockoutRounds = KNOCKOUT_ROUND_DEFS.filter((r) => r.key !== "final");
  const hasKnockouts = knockoutRounds.some((r) => {
    const picks = team.knockoutPicks?.[r.key] || [];
    return picks.some((p) => p.country);
  });

  const hasPodium = Boolean(team.championPick && team.runnerUpPick && team.thirdPlacePick);

  // Peso de cada sección: marcadores (40%), dobles (10%), posiciones (20%), eliminatorias (15%), podio (15%)
  const matchWeight = totalMatches > 0 ? (filledMatches / totalMatches) * 40 : 0;
  const doublesWeight = (filledDoubles / groupKeys.length) * 10;
  const positionsWeight = (filledPositions / groupKeys.length) * 20;
  const knockoutsWeight = hasKnockouts ? 15 : 0;
  const podiumWeight = hasPodium ? 15 : 0;

  const percent = Math.round(matchWeight + doublesWeight + positionsWeight + knockoutsWeight + podiumWeight);

  return {
    percent,
    filledMatches,
    totalMatches,
    filledDoubles,
    filledPositions,
    hasKnockouts,
    hasPodium,
    isComplete: percent >= 95,
  };
}

// ════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════

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
  const { adminResults, participants, isLoading } = useScoredParticipants();
  const [creatingNew, setCreatingNew] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // ── FIX: filter por userId O username para cubrir porras creadas antes del
  //    nuevo sistema de auth (donde userId podría tener formato distinto)
  const userTeams = useMemo(
    () =>
      participants.filter(
        (p) => p.userId === user.id || p.username === user.username
      ),
    [participants, user.id, user.username]
  );

  const canCreateMore = userTeams.length < 3;
  const activeTeam =
    userTeams.find((p) => p.id === selectedTeamId) ?? userTeams[0] ?? null;

  // ── FIX: selectedTeamId NO está en las deps para no resetear al cambiar
  //    de pestaña. Solo reacciona cuando cambia la lista de porras.
  //    No reseteamos a null cuando la lista está vacía temporalmente (SWR loading).
  useEffect(() => {
    if (!userTeams.length) return;
    if (!selectedTeamId || !userTeams.some((p) => p.id === selectedTeamId)) {
      setSelectedTeamId(userTeams[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userTeams]);

  useEffect(() => {
    if (!canCreateMore && creatingNew) setCreatingNew(false);
  }, [canCreateMore, creatingNew]);

  const handleSaved = (teamId: string) => {
    setSelectedTeamId(teamId);
    setCreatingNew(false);
    setEditingTeam(null);
  };

  if (isLoading && !userTeams.length && !creatingNew && !editingTeam) {
    return <LoadingState />;
  }

  // Modo creación nueva porra
  if (!userTeams.length || (creatingNew && canCreateMore)) {
    return (
      <MiPorraBuilder
        user={user}
        onSaved={handleSaved}
        onCancel={userTeams.length > 0 ? () => setCreatingNew(false) : undefined}
      />
    );
  }

  // Modo edición de porra existente
  if (editingTeam) {
    return (
      <MiPorraBuilder
        user={user}
        onSaved={handleSaved}
        onCancel={() => setEditingTeam(null)}
        initialTeam={editingTeam}
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
      onEditTeam={canEditPorra() ? setEditingTeam : undefined}
      canCreateMore={canCreateMore}
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
      if (!onLogin(username, password)) setError("Credenciales incorrectas");
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
        <p className="mt-2 text-xs text-text-muted">
          Entra para crear tu porra, verla en modo lectura y exportarla a CSV.
        </p>
        <div className="mb-3 mt-6 text-left">
          <label className="mb-1 block text-[11px] text-text-muted">@usuario</label>
          <input
            className="input-field"
            placeholder="@usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handle()}
          />
        </div>
        <div className="mb-4 text-left">
          <label className="mb-1 block text-[11px] text-text-muted">Contraseña</label>
          <div className="relative">
            <input
              className="input-field !pr-10"
              type={showPass ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handle()}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
              onClick={() => setShowPass((v) => !v)}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {error && <p className="mb-4 text-sm text-danger">{error}</p>}
        <button
          className="btn btn-primary w-full"
          onClick={handle}
          disabled={loading}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ZONA AUTENTICADA
// ════════════════════════════════════════════════════════════

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
  onEditTeam,
  canCreateMore,
}: {
  user: { id: string; username: string };
  onLogout: () => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  participants: Team[];
  adminResults: AdminResults;
  userTeams: Team[];
  activeTeam: Team | null;
  activeTeamId: string | null;
  onSelectTeam: (id: string) => void;
  onCreateNew?: () => void;
  onEditTeam?: (team: Team) => void;
  canCreateMore: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"resumen" | "partidos" | "grupos" | "eliminatorias" | "especiales">("resumen");
  const [showScores, setShowScores] = useState(false);

  const editAllowed = canEditPorra();

  return (
    <div className="mx-auto max-w-[720px] px-4 pt-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-text-warm">Mi Club</h1>
          <p className="mt-1 text-xs text-text-muted">
            {editAllowed ? timeUntilDeadline() : "Las porras están cerradas desde el 10 jun a las 21:00."}
          </p>
        </div>
        <button className="btn btn-ghost !px-3.5 !py-2 text-xs" onClick={onLogout}>
          <LogOut size={14} /> Cerrar sesión
        </button>
      </div>

      {/* User card */}
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

      {/* Selector de porra si hay más de una */}
      {userTeams.length > 1 && (
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
      )}

      {activeTeam ? (
        <>
          {/* Barra de progreso si la porra está incompleta */}
          <PorraProgressBar team={activeTeam} />

          {/* Cabecera de la porra activa con botón editar */}
          <div className="card mb-3 animate-fade-in">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] text-text-muted">Porra activa</p>
                <p className="font-display text-lg font-bold text-text-warm truncate">
                  {activeTeam.name}
                </p>
                {activeTeam.createdAt && (
                  <p className="text-[10px] text-text-muted mt-0.5">
                    Creada el{" "}
                    {new Date(activeTeam.createdAt).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {editAllowed && onEditTeam ? (
                  <button
                    className="btn btn-ghost !px-3 !py-2 text-xs"
                    onClick={() => onEditTeam(activeTeam)}
                    title="Editar porra"
                  >
                    <Edit2 size={14} />
                    Editar
                  </button>
                ) : (
                  <span className="badge badge-muted text-[10px] flex items-center gap-1">
                    <Lock size={10} /> Cerrada
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-3 flex gap-1.5 overflow-x-auto">
            {(["resumen", "partidos", "grupos", "eliminatorias", "especiales"] as const).map(
              (tab) => (
                <button
                  key={tab}
                  className={`pill capitalize ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              )
            )}
          </div>

          {/* Scores toggle */}
          <div className="mb-3 flex items-center justify-end">
            <button
              className="btn btn-ghost !px-3 !py-1.5 text-xs"
              onClick={() => setShowScores((v) => !v)}
            >
              {showScores ? <EyeOff size={13} /> : <Eye size={13} />}
              {showScores ? "Ocultar puntos" : "Mostrar puntos"}
            </button>
          </div>

          {/* Contenido de la tab activa */}
          {activeTab === "resumen" && (
            <ResumenTab team={activeTeam} adminResults={adminResults} showScores={showScores} />
          )}
          {activeTab === "partidos" && (
            <PartidosTab team={activeTeam} adminResults={adminResults} showScores={showScores} />
          )}
          {activeTab === "grupos" && (
            <GruposTab team={activeTeam} adminResults={adminResults} showScores={showScores} />
          )}
          {activeTab === "eliminatorias" && (
            <EliminatoriasTab team={activeTeam} adminResults={adminResults} showScores={showScores} />
          )}
          {activeTab === "especiales" && (
            <EspecialesTab team={activeTeam} adminResults={adminResults} showScores={showScores} />
          )}

          {/* Export CSV */}
          <div className="mt-4 mb-24 flex justify-center">
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(buildTeamCsv(activeTeam))}`}
              download={buildTeamCsvFilename(activeTeam)}
              className="btn btn-ghost !px-4 !py-2 text-xs"
            >
              <Download size={14} />
              Exportar CSV
            </a>
          </div>
        </>
      ) : (
        <EmptyState text="No tienes porras guardadas todavía." />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// BARRA DE PROGRESO DE LA PORRA
// Solo se muestra si la porra está incompleta (< 95%)
// ════════════════════════════════════════════════════════════

function PorraProgressBar({ team }: { team: Team }) {
  const progress = useMemo(() => calculateTeamProgress(team), [team]);

  if (progress.isComplete) return null;

  return (
    <div className="card mb-3 animate-fade-in">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-semibold text-text-warm">
          Porra incompleta — {progress.percent}% rellenada
        </p>
        <span className="badge badge-amber text-[9px]">Pendiente</span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden mb-2"
        style={{ background: "rgb(var(--bg-muted))" }}
        role="progressbar"
        aria-valuenow={progress.percent}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress.percent}%`,
            background: "linear-gradient(90deg, rgb(var(--amber)), rgb(var(--gold)))",
          }}
        />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-text-muted">
        <span>
          Partidos: {progress.filledMatches}/{progress.totalMatches}
        </span>
        <span>
          Dobles: {progress.filledDoubles}/{Object.keys(GROUPS).length}
        </span>
        <span>
          Posiciones: {progress.filledPositions}/{Object.keys(GROUPS).length}
        </span>
        <span className={progress.hasKnockouts ? "text-success" : ""}>
          Eliminatorias: {progress.hasKnockouts ? "✓" : "—"}
        </span>
        <span className={progress.hasPodium ? "text-success" : ""}>
          Podio: {progress.hasPodium ? "✓" : "—"}
        </span>
      </div>
      {canEditPorra() && (
        <p className="mt-2 text-[10px] text-amber-mid font-medium">
          Puedes completarla antes del 10 de junio a las 21:00 pulsando "Editar".
        </p>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB RESUMEN
// ════════════════════════════════════════════════════════════

function ResumenTab({
  team,
  adminResults,
  showScores,
}: {
  team: Team;
  adminResults: AdminResults;
  showScores: boolean;
}) {
  return (
    <div className="space-y-3 animate-fade-in">
      <div className="grid grid-cols-3 gap-2">
        <div className="card text-center !py-3">
          <p className="text-[10px] text-text-muted">Total</p>
          <p className="font-display text-xl font-black text-gold tabular-nums">
            {showScores ? team.totalPoints : "—"}
          </p>
          <p className="text-[10px] text-text-muted">puntos</p>
        </div>
        <div className="card text-center !py-3">
          <p className="text-[10px] text-text-muted">Grupos</p>
          <p className="font-display text-xl font-black text-text-warm tabular-nums">
            {showScores ? team.groupPoints : "—"}
          </p>
          <p className="text-[10px] text-text-muted">puntos</p>
        </div>
        <div className="card text-center !py-3">
          <p className="text-[10px] text-text-muted">Eliminatorias</p>
          <p className="font-display text-xl font-black text-text-warm tabular-nums">
            {showScores ? team.finalPhasePoints : "—"}
          </p>
          <p className="text-[10px] text-text-muted">puntos</p>
        </div>
      </div>

      <div className="card">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Podio
        </p>
        <div className="space-y-1.5">
          {[
            { label: "🥇 Campeón", pick: team.championPick },
            { label: "🥈 Subcampeón", pick: team.runnerUpPick },
            { label: "🥉 Tercer puesto", pick: team.thirdPlacePick },
          ].map(({ label, pick }) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-text-muted">{label}</span>
              {pick ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-warm">
                  <Flag country={pick} size="sm" />
                  {pick}
                </span>
              ) : (
                <span className="text-[11px] text-text-muted italic">Sin selección</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB PARTIDOS
// ════════════════════════════════════════════════════════════

function PartidosTab({
  team,
  adminResults,
  showScores,
}: {
  team: Team;
  adminResults: AdminResults;
  showScores: boolean;
}) {
  const groupKeys = Object.keys(GROUPS);

  return (
    <div className="space-y-3 animate-fade-in">
      {groupKeys.map((group) => {
        const groupFixtures = FIXTURES.filter((f) => f.group === group);
        return (
          <div key={group} className="card">
            <div className="mb-2 flex items-center gap-2">
              <GroupBadge group={group} />
            </div>
            <div className="space-y-1.5">
              {groupFixtures.map((fixture) => {
                const pick = team.matchPicks?.[fixture.id];
                const isDouble =
                  team.doubleMatches?.[group] === fixture.id ||
                  (Array.isArray(team.doubleMatches?.[group]) &&
                    (team.doubleMatches?.[group] as string[]).includes(fixture.id));
                const adminResult = adminResults.matchResults?.[String(fixture.id)];

                return (
                  <div
                    key={fixture.id}
                    className="rounded-xl p-2 flex items-center justify-between gap-2"
                    style={{
                      background: "rgb(var(--bg-elevated))",
                      borderLeft: isDouble ? "3px solid rgb(var(--gold))" : "3px solid transparent",
                    }}
                  >
                    <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
                      <span className="text-[11px] text-text-warm truncate">{fixture.homeTeam}</span>
                      <Flag country={fixture.homeTeam} size="sm" />
                    </div>
                    <span className="font-display text-sm font-bold text-text-muted px-2 tabular-nums">
                      {pick ? `${pick.home}-${pick.away}` : "·-·"}
                    </span>
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <Flag country={fixture.awayTeam} size="sm" />
                      <span className="text-[11px] text-text-warm truncate">{fixture.awayTeam}</span>
                    </div>
                    {showScores && pick?.points != null && (
                      <span className={`badge text-[9px] ml-1 ${pick.points > 0 ? "badge-green" : "badge-muted"}`}>
                        +{pick.points}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB GRUPOS
// ════════════════════════════════════════════════════════════

function GruposTab({
  team,
  adminResults,
  showScores,
}: {
  team: Team;
  adminResults: AdminResults;
  showScores: boolean;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 animate-fade-in">
      {Object.entries(GROUPS).map(([group, teams]) => {
        const picks = team.groupOrderPicks?.[group] || [];
        return (
          <div key={group} className="card">
            <div className="mb-2 flex items-center gap-2">
              <GroupBadge group={group} />
            </div>
            <div className="space-y-1.5">
              {[1, 2, 3, 4].map((pos) => {
                const picked = picks[pos - 1] || "";
                const officialPos = adminResults.groupPositions?.[picked];
                const isCorrect = officialPos === pos;
                return (
                  <div key={pos} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-text-muted w-6">{pos}.º</span>
                    {picked ? (
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-warm">
                        <Flag country={picked} size="sm" />
                        {picked}
                      </span>
                    ) : (
                      <span className="text-[11px] text-text-muted italic">Sin selección</span>
                    )}
                    {showScores && officialPos != null && officialPos > 0 && (
                      <span className={`ml-auto badge text-[9px] ${isCorrect ? "badge-green" : "badge-muted"}`}>
                        {isCorrect ? "+1" : "0"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB ELIMINATORIAS
// ════════════════════════════════════════════════════════════

function EliminatoriasTab({
  team,
  adminResults,
  showScores,
}: {
  team: Team;
  adminResults: AdminResults;
  showScores: boolean;
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      {KNOCKOUT_ROUND_DEFS.map((round) => {
        const picks = team.knockoutPicks?.[round.key] || [];
        if (picks.length === 0) {
          return (
            <div key={round.key} className="card">
              <p className="text-[11px] font-bold text-text-muted mb-2">{round.name}</p>
              <p className="text-[11px] text-text-muted italic">Sin picks</p>
            </div>
          );
        }
        return (
          <div key={round.key} className="card">
            <p className="text-[11px] font-bold text-text-muted mb-2">{round.name}</p>
            <div className="flex flex-wrap gap-1.5">
              {picks.map((pick, idx) => {
                const adminTeams = new Set(
                  (adminResults.knockoutRounds?.[round.key] || []).filter(Boolean)
                );
                const correct = adminTeams.size > 0 && adminTeams.has(pick.country);
                return (
                  <span
                    key={`${pick.country}-${idx}`}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      background:
                        showScores && adminTeams.size > 0
                          ? correct
                            ? "rgb(var(--success-soft))"
                            : "rgb(var(--danger-soft))"
                          : "rgb(var(--bg-elevated))",
                      color: "rgb(var(--text-warm))",
                      border: "1px solid rgb(var(--border-subtle))",
                    }}
                  >
                    <Flag country={pick.country} size="sm" />
                    {pick.country}
                    {showScores && pick.points != null && pick.points > 0 && (
                      <span className="text-success font-bold">+{pick.points}</span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB ESPECIALES
// ════════════════════════════════════════════════════════════

function EspecialesTab({
  team,
  adminResults,
  showScores,
}: {
  team: Team;
  adminResults: AdminResults;
  showScores: boolean;
}) {
  const fields = [
    { key: "mejorJugador", label: "Mejor Jugador" },
    { key: "mejorJoven", label: "Mejor Jugador Joven" },
    { key: "mejorPortero", label: "Mejor Portero" },
    { key: "maxGoleador", label: "Máximo Goleador" },
    { key: "maxAsistente", label: "Máximo Asistente" },
    { key: "maxGoleadorEsp", label: "Máximo Goleador Español" },
    { key: "primerGolEsp", label: "Primer Goleador Español" },
    { key: "revelacion", label: "Selección Revelación" },
    { key: "decepcion", label: "Selección Decepción" },
    { key: "minutoPrimerGol", label: "Minuto Primer Gol" },
  ] as const;

  return (
    <div className="card animate-fade-in">
      <div className="space-y-2">
        {fields.map(({ key, label }) => {
          const val = team.specials?.[key as keyof typeof team.specials];
          return (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-text-muted">{label}</span>
              <span className="text-[12px] font-medium text-text-warm">
                {val != null && val !== "" ? String(val) : <em className="text-text-faint">—</em>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
