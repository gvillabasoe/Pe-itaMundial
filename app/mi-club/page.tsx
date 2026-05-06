"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download, Edit2, Eye, EyeOff, Lock, LogOut, Plus,
  Shield, Trash2, User, X,
} from "lucide-react";
import { MiPorraBuilder } from "@/components/mi-porra-builder";
import { EmptyState, Flag, GroupBadge } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import { FIXTURES, GROUPS, KNOCKOUT_ROUND_DEFS, type Team } from "@/lib/data";
import type { AdminResults } from "@/lib/admin-results";
import { buildTeamCsv, buildTeamCsvFilename } from "@/lib/export-team-csv";
import { EDIT_DEADLINE, isPastEditDeadline } from "@/lib/edit-deadline";
import { useScoredParticipants, notifyUserTeamsUpdated } from "@/lib/use-scored-participants";

// Fecha limite de edicion: 10 junio 2026 21:00 CEST = 19:00 UTC.
function canEditPorra() { return !isPastEditDeadline(); }
function editDeadlineText() {
  const remaining = EDIT_DEADLINE.getTime() - Date.now();
  if (remaining <= 0) return "Edición cerrada desde el 10 jun a las 21:00";
  const days = Math.floor(remaining / 86400000);
  if (days > 1) return `Edición abierta hasta el 10 jun 21:00 (${days} días)`;
  const hours = Math.floor((remaining % 86400000) / 3600000);
  if (days === 1) return `Edición abierta hasta mañana a las ${21 - (24 - hours)}:00`;
  return `Edición abierta hasta las 21:00 del 10 jun (${hours}h)`;
}

// ── Progreso de una porra incompleta ──
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

  const filledDoubles = groupKeys.filter((g) => Boolean(team.doubleMatches?.[g])).length;

  const filledPositions = groupKeys.filter((g) => {
    const picks = team.groupOrderPicks?.[g] || [];
    return picks.filter(Boolean).length === 4;
  }).length;

  const hasKnockouts = KNOCKOUT_ROUND_DEFS.filter((r) => r.key !== "final").some((r) => {
    const picks = team.knockoutPicks?.[r.key] || [];
    return picks.some((p) => p.country);
  });

  const hasPodium = Boolean(team.championPick && team.runnerUpPick && team.thirdPlacePick);

  const matchW = totalMatches > 0 ? (filledMatches / totalMatches) * 40 : 0;
  const doubleW = (filledDoubles / groupKeys.length) * 10;
  const posW = (filledPositions / groupKeys.length) * 20;
  const kW = hasKnockouts ? 15 : 0;
  const pW = hasPodium ? 15 : 0;
  const percent = Math.round(matchW + doubleW + posW + kW + pW);

  return {
    percent, filledMatches, totalMatches, filledDoubles, filledPositions,
    hasKnockouts, hasPodium, isComplete: percent >= 95,
  };
}

// ════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════

export default function MiClubPage() {
  const { user, login, logout, favorites, toggleFavorite } = useAuth();
  if (!user) return <LoginView onLogin={login} />;
  return (
    <AuthenticatedMiClub
      user={user} onLogout={logout} favorites={favorites} toggleFavorite={toggleFavorite}
    />
  );
}

function AuthenticatedMiClub({
  user, onLogout, favorites, toggleFavorite,
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

  // FIX: filtrar por userId O username para cubrir porras creadas antes del nuevo sistema de auth
  const userTeams = useMemo(
    () => participants.filter((p) => p.userId === user.id || p.username === user.username),
    [participants, user.id, user.username]
  );

  const canCreateMore = userTeams.length < 3;
  const activeTeam = userTeams.find((p) => p.id === selectedTeamId) ?? userTeams[0] ?? null;

  // FIX: no incluir selectedTeamId en deps para evitar reset al refetch de SWR
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
    setSelectedTeamId(teamId); setCreatingNew(false); setEditingTeam(null);
  };

  const handleDeleted = (teamId: string) => {
    const remaining = userTeams.filter((p) => p.id !== teamId);
    setSelectedTeamId(remaining.length ? remaining[0].id : null);
    notifyUserTeamsUpdated();
  };

  if (isLoading && !userTeams.length && !creatingNew && !editingTeam) {
    return (
      <div className="flex min-h-[72vh] items-center justify-center px-4">
        <div className="card w-full max-w-[360px] text-center !py-8 animate-fade-in">
          <p className="font-display text-lg font-bold text-text-warm">Cargando Mi Club…</p>
        </div>
      </div>
    );
  }

  if (!userTeams.length || (creatingNew && canCreateMore)) {
    return (
      <MiPorraBuilder user={user} onSaved={handleSaved}
        onCancel={userTeams.length > 0 ? () => setCreatingNew(false) : undefined} />
    );
  }

  if (editingTeam) {
    return (
      <MiPorraBuilder user={user} onSaved={handleSaved}
        onCancel={() => setEditingTeam(null)} initialTeam={editingTeam} />
    );
  }

  return (
    <PrivateZone
      user={user} onLogout={onLogout} favorites={favorites} toggleFavorite={toggleFavorite}
      participants={participants} adminResults={adminResults}
      userTeams={userTeams} activeTeam={activeTeam} activeTeamId={selectedTeamId}
      onSelectTeam={setSelectedTeamId}
      onCreateNew={canCreateMore ? () => setCreatingNew(true) : undefined}
      onEditTeam={canEditPorra() ? setEditingTeam : undefined}
      onDeleted={handleDeleted}
      canCreateMore={canCreateMore}
    />
  );
}

// ════════════════════════════════════════════════════════════
// LOGIN VIEW — con acceso de admin restaurado
// ════════════════════════════════════════════════════════════

function LoginView({ onLogin }: { onLogin: (username: string, password: string) => boolean }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = () => {
    if (!username || !password) { setError("Completa los campos"); return; }
    setLoading(true); setError("");
    window.setTimeout(() => {
      if (!onLogin(username, password)) setError("Credenciales incorrectas");
      setLoading(false);
    }, 600);
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="card w-full max-w-[360px] text-center !p-7 animate-fade-in">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[14px] border border-gold/20 bg-gold/10">
          <User size={28} className="text-gold" />
        </div>
        <h2 className="font-display text-[22px] font-extrabold text-text-warm">Mi Club</h2>
        <p className="mt-2 text-xs text-text-muted">
          Entra para crear tu porra, verla y exportarla.
        </p>

        <div className="mb-3 mt-6 text-left">
          <label className="mb-1 block text-[11px] text-text-muted">@usuario</label>
          <input className="input-field" placeholder="@usuario" value={username}
            onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handle()} />
        </div>
        <div className="mb-4 text-left">
          <label className="mb-1 block text-[11px] text-text-muted">Contraseña</label>
          <div className="relative">
            <input className="input-field !pr-10" type={showPass ? "text" : "password"}
              placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handle()} />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
              onClick={() => setShowPass((v) => !v)}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {error && <p className="mb-4 text-sm text-danger">{error}</p>}
        <button className="btn btn-primary w-full" onClick={handle} disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>

        {/* ← Acceso de Admin restaurado */}
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgb(var(--border-subtle))" }}>
          <a href="/admin/login"
            className="inline-flex items-center gap-2 text-[11px] text-text-muted hover:text-text-secondary transition-colors">
            <Shield size={13} /> Acceso administrador
          </a>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ZONA AUTENTICADA
// ════════════════════════════════════════════════════════════

function PrivateZone({
  user, onLogout, favorites, toggleFavorite,
  participants, adminResults, userTeams, activeTeam, activeTeamId,
  onSelectTeam, onCreateNew, onEditTeam, onDeleted, canCreateMore,
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
  onDeleted: (teamId: string) => void;
  canCreateMore: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"resumen" | "partidos" | "grupos" | "eliminatorias" | "especiales">("resumen");
  const [showScores, setShowScores] = useState(false);
  const editAllowed = canEditPorra();

  return (
    <div className="mx-auto max-w-[720px] px-4 pt-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3 animate-fade-in">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold text-text-warm">Mi Club</h1>
          <p className="mt-0.5 text-[11px] text-text-muted leading-snug">
            {editAllowed ? editDeadlineText() : "Edición cerrada (10 jun 21:00)"}
          </p>
        </div>
        <button className="btn btn-ghost !px-3 !py-2 text-xs flex-shrink-0" onClick={onLogout}>
          <LogOut size={14} />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>

      {/* User card — FIX MÓVIL: layout vertical en xs, horizontal en sm+ */}
      <div className="card mb-3 animate-fade-in">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent-participante/10 flex-shrink-0">
              <User size={18} className="text-accent-participante" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-text-muted leading-tight">Usuario</p>
              <p className="text-sm font-semibold truncate">@{user.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge badge-green text-[10px]">{userTeams.length}/3 porras</span>
            {onCreateNew ? (
              <button className="btn btn-ghost !px-2.5 !py-1.5 text-xs" onClick={onCreateNew}>
                <Plus size={13} /> Nueva porra
              </button>
            ) : !canCreateMore ? (
              <span className="badge badge-muted text-[10px]">Límite alcanzado</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Selector de porra + botón eliminar */}
      {userTeams.length > 1 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto">
          {userTeams.map((team) => (
            <button key={team.id}
              className={`pill ${activeTeamId === team.id ? "active" : ""}`}
              onClick={() => onSelectTeam(team.id)}>
              {team.name}
            </button>
          ))}
        </div>
      )}

      {activeTeam ? (
        <>
          {/* Barra de progreso si incompleta */}
          <PorraProgressBar team={activeTeam} />

          {/* Cabecera de la porra activa */}
          <div className="card mb-3 animate-fade-in">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-text-muted">Porra activa</p>
                <p className="font-display text-base font-bold text-text-warm truncate">{activeTeam.name}</p>
                {activeTeam.createdAt && (
                  <p className="text-[10px] text-text-muted mt-0.5">
                    Creada {new Date(activeTeam.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {editAllowed && onEditTeam ? (
                  <button className="btn btn-ghost !px-2.5 !py-1.5 text-xs"
                    onClick={() => onEditTeam(activeTeam)}>
                    <Edit2 size={13} /> Editar
                  </button>
                ) : (
                  <span className="badge badge-muted text-[10px] flex items-center gap-1">
                    <Lock size={9} /> Cerrada
                  </span>
                )}
                {/* ← Botón eliminar porra */}
                <DeletePorraButton team={activeTeam} onDeleted={onDeleted} />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-2 flex gap-1.5 overflow-x-auto">
            {(["resumen", "partidos", "grupos", "eliminatorias", "especiales"] as const).map((tab) => (
              <button key={tab} className={`pill capitalize ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}>{tab}</button>
            ))}
          </div>

          <div className="mb-3 flex items-center justify-end">
            <button className="btn btn-ghost !px-3 !py-1.5 text-xs"
              onClick={() => setShowScores((v) => !v)}>
              {showScores ? <EyeOff size={13} /> : <Eye size={13} />}
              {showScores ? "Ocultar puntos" : "Ver puntos"}
            </button>
          </div>

          {activeTab === "resumen" && <ResumenTab team={activeTeam} adminResults={adminResults} showScores={showScores} />}
          {activeTab === "partidos" && <PartidosTab team={activeTeam} adminResults={adminResults} showScores={showScores} />}
          {activeTab === "grupos" && <GruposTab team={activeTeam} adminResults={adminResults} showScores={showScores} />}
          {activeTab === "eliminatorias" && <EliminatoriasTab team={activeTeam} adminResults={adminResults} showScores={showScores} />}
          {activeTab === "especiales" && <EspecialesTab team={activeTeam} />}

          <div className="mt-4 mb-24 flex justify-center">
            <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(buildTeamCsv(activeTeam))}`}
              download={buildTeamCsvFilename(activeTeam)} className="btn btn-ghost !px-4 !py-2 text-xs">
              <Download size={14} /> Exportar CSV
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
// BOTÓN ELIMINAR PORRA — con modal de confirmación
// ════════════════════════════════════════════════════════════

function DeletePorraButton({ team, onDeleted }: { team: Team; onDeleted: (id: string) => void }) {
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    setDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/user-teams/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: team.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Error al eliminar");
      setShowModal(false);
      onDeleted(team.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar la porra");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        className="btn btn-ghost !px-2.5 !py-1.5 text-xs"
        style={{ color: "rgb(var(--danger))" }}
        onClick={() => setShowModal(true)}
        title="Eliminar porra"
      >
        <Trash2 size={13} />
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)" }}
          onClick={() => !deleting && setShowModal(false)}
        >
          <div
            className="card w-full max-w-[360px] animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[10px]"
                style={{ background: "rgb(var(--danger-soft))" }}>
                <Trash2 size={20} style={{ color: "rgb(var(--danger))" }} />
              </div>
              <button className="text-text-muted" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <h3 className="font-display text-base font-bold text-text-warm">Eliminar porra</h3>
            <p className="mt-2 text-sm text-text-muted">
              ¿Estás seguro de que quieres eliminar{" "}
              <strong className="text-text-primary">"{team.name}"</strong>?
              Esta acción no se puede deshacer.
            </p>
            {error && <p className="mt-2 text-xs text-danger">{error}</p>}
            <div className="mt-5 flex gap-2 justify-end">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)} disabled={deleting}>
                Cancelar
              </button>
              <button
                className="btn"
                style={{ background: "rgb(var(--danger))", color: "#fff" }}
                onClick={() => void handleConfirm()}
                disabled={deleting}
              >
                <Trash2 size={15} />
                {deleting ? "Eliminando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
// BARRA DE PROGRESO
// ════════════════════════════════════════════════════════════

function PorraProgressBar({ team }: { team: Team }) {
  const progress = useMemo(() => calculateTeamProgress(team), [team]);
  if (progress.isComplete) return null;

  return (
    <div className="card mb-3 animate-fade-in">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-semibold text-text-warm">
          Porra incompleta — {progress.percent}%
        </p>
        <span className="badge badge-amber text-[9px]">Pendiente</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: "rgb(var(--bg-muted))" }}
        role="progressbar" aria-valuenow={progress.percent}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress.percent}%`, background: "linear-gradient(90deg, rgb(var(--amber)), rgb(var(--gold)))" }} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-text-muted">
        <span>Partidos: {progress.filledMatches}/{progress.totalMatches}</span>
        <span>Dobles: {progress.filledDoubles}/{Object.keys(GROUPS).length}</span>
        <span>Posiciones: {progress.filledPositions}/{Object.keys(GROUPS).length}</span>
        <span className={progress.hasKnockouts ? "text-success" : ""}>Eliminatorias: {progress.hasKnockouts ? "✓" : "—"}</span>
        <span className={progress.hasPodium ? "text-success" : ""}>Podio: {progress.hasPodium ? "✓" : "—"}</span>
      </div>
      {canEditPorra() && (
        <p className="mt-2 text-[10px] font-medium" style={{ color: "rgb(var(--amber))" }}>
          Puedes completarla antes del 10 jun a las 21:00 pulsando "Editar".
        </p>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════════════════════

function ResumenTab({ team, adminResults, showScores }: { team: Team; adminResults: AdminResults; showScores: boolean }) {
  return (
    <div className="space-y-3 animate-fade-in">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Total", val: team.totalPoints },
          { label: "Grupos", val: team.groupPoints },
          { label: "Elim.", val: team.finalPhasePoints },
        ].map(({ label, val }) => (
          <div key={label} className="card text-center !py-3">
            <p className="text-[10px] text-text-muted">{label}</p>
            <p className="font-display text-xl font-black text-gold tabular-nums">{showScores ? val : "—"}</p>
            <p className="text-[10px] text-text-muted">pts</p>
          </div>
        ))}
      </div>
      <div className="card">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">Podio</p>
        <div className="space-y-1.5">
          {[
            { label: "🥇 Campeón", pick: team.championPick },
            { label: "🥈 Subcampeón", pick: team.runnerUpPick },
            { label: "🥉 Tercer puesto", pick: team.thirdPlacePick },
          ].map(({ label, pick }) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-text-muted">{label}</span>
              {pick
                ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-warm">
                    <Flag country={pick} size="sm" /> {pick}
                  </span>
                : <span className="text-[11px] text-text-muted italic">Sin selección</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PartidosTab({ team, adminResults, showScores }: { team: Team; adminResults: AdminResults; showScores: boolean }) {
  return (
    <div className="space-y-3 animate-fade-in">
      {Object.entries(GROUPS).map(([group]) => {
        const groupFixtures = FIXTURES.filter((f) => f.group === group);
        return (
          <div key={group} className="card">
            <div className="mb-2"><GroupBadge group={group} /></div>
            <div className="space-y-1.5">
              {groupFixtures.map((fixture) => {
                const pick = team.matchPicks?.[fixture.id];
                const isDouble = team.doubleMatches?.[group] === fixture.id;
                const hasScore = pick && typeof pick.home === "number" && typeof pick.away === "number";
                return (
                  <div key={fixture.id} className="rounded-xl p-2 flex items-center justify-between gap-2"
                    style={{
                      background: "rgb(var(--bg-elevated))",
                      borderLeft: isDouble ? "3px solid rgb(var(--gold))" : "3px solid transparent",
                    }}>
                    <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
                      <span className="text-[11px] text-text-warm truncate">{fixture.homeTeam}</span>
                      <Flag country={fixture.homeTeam} size="sm" />
                    </div>
                    <span className="font-display text-sm font-bold text-text-muted px-1.5 tabular-nums">
                      {hasScore ? `${pick.home}-${pick.away}` : "·-·"}
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

function GruposTab({ team, adminResults, showScores }: { team: Team; adminResults: AdminResults; showScores: boolean }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 animate-fade-in">
      {Object.entries(GROUPS).map(([group]) => {
        const picks = team.groupOrderPicks?.[group] || [];
        return (
          <div key={group} className="card">
            <div className="mb-2"><GroupBadge group={group} /></div>
            <div className="space-y-1.5">
              {[1, 2, 3, 4].map((pos) => {
                const picked = picks[pos - 1] || "";
                const officialPos = adminResults.groupPositions?.[picked];
                const isCorrect = officialPos === pos;
                return (
                  <div key={pos} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-text-muted w-6">{pos}.º</span>
                    {picked
                      ? <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-warm">
                          <Flag country={picked} size="sm" /> {picked}
                        </span>
                      : <span className="text-[11px] text-text-muted italic">Sin selección</span>}
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

function EliminatoriasTab({ team, adminResults, showScores }: { team: Team; adminResults: AdminResults; showScores: boolean }) {
  return (
    <div className="space-y-4 animate-fade-in">
      {KNOCKOUT_ROUND_DEFS.map((round) => {
        const picks = team.knockoutPicks?.[round.key] || [];
        return (
          <div key={round.key} className="card">
            <p className="text-[11px] font-bold text-text-muted mb-2">{round.name}</p>
            {picks.length === 0
              ? <p className="text-[11px] text-text-muted italic">Sin picks</p>
              : <div className="flex flex-wrap gap-1.5">
                  {picks.map((pick, idx) => {
                    const adminTeams = new Set((adminResults.knockoutRounds?.[round.key] || []).filter(Boolean));
                    const correct = adminTeams.size > 0 && adminTeams.has(pick.country);
                    return (
                      <span key={`${pick.country}-${idx}`}
                        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          background: showScores && adminTeams.size > 0
                            ? (correct ? "rgb(var(--success-soft))" : "rgb(var(--danger-soft))")
                            : "rgb(var(--bg-elevated))",
                          color: "rgb(var(--text-warm))",
                          border: "1px solid rgb(var(--border-subtle))",
                        }}>
                        <Flag country={pick.country} size="sm" /> {pick.country}
                        {showScores && pick.points != null && pick.points > 0 &&
                          <span className="text-success font-bold ml-0.5">+{pick.points}</span>}
                      </span>
                    );
                  })}
                </div>}
          </div>
        );
      })}
    </div>
  );
}

function EspecialesTab({ team }: { team: Team }) {
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
