"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download, Edit2, Eye, EyeOff, Lock, LogOut, Plus,
  Shield, Trash2, User, X,
} from "lucide-react";
import { MiPorraBuilder } from "@/components/mi-porra-builder";
import { EmptyState, Flag, GroupBadge } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import { AvatarUploader } from "@/components/avatar-uploader";
import { UserBadge } from "@/components/UserBadge";
import { FIXTURES, GROUPS, KNOCKOUT_ROUND_DEFS, type Team } from "@/lib/data";
import type { AdminResults } from "@/lib/admin-results";
import { buildTeamCsv, buildTeamCsvFilename } from "@/lib/export-team-csv";
import { useScoredParticipants, notifyUserTeamsUpdated } from "@/lib/use-scored-participants";

// ── Fecha límite de edición: 10 junio 2026 21:00 CEST = 19:00 UTC ──
const EDIT_DEADLINE = new Date("2026-06-10T19:00:00.000Z");

// Etiqueta absoluta SIEMPRE en hora de Madrid, válida para cualquier zona
// horaria del usuario. Resultado: "jueves, 10 de junio, 21:00".
const DEADLINE_LABEL = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
}).format(EDIT_DEADLINE);

function canEditPorra() { return Date.now() < EDIT_DEADLINE.getTime(); }
function editDeadlineText() {
  const remaining = EDIT_DEADLINE.getTime() - Date.now();
  if (remaining <= 0) return "Edición cerrada (10 jun, 21:00)";
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  // La hora límite es SIEMPRE las 21:00: no se calcula, se muestra fija.
  if (days >= 1) return `Edición abierta hasta el ${DEADLINE_LABEL} (${days} día${days > 1 ? "s" : ""})`;
  return `Edición abierta hasta hoy a las 21:00 (${hours}h)`;
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
  const { user, loginAsync, logout, favorites, toggleFavorite } = useAuth();
  if (!user) return <LoginView onLogin={loginAsync} />;
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

  // La creación combina el límite por usuario (3) con el switch global del
  // Admin (allowNewPorras). Los usuarios SIN ninguna porra solo pueden crear
  // si el switch está habilitado.
  const newPorrasAllowed = adminResults.allowNewPorras !== false;
  const canCreateMore = userTeams.length < 3 && newPorrasAllowed;
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

  if (!userTeams.length && !newPorrasAllowed) {
    return (
      <div className="flex min-h-[72vh] items-center justify-center px-4">
        <div className="card w-full max-w-[360px] text-center !py-8 animate-fade-in">
          <p className="font-display text-lg font-bold text-text-warm">Porras cerradas</p>
          <p className="mt-2 text-sm text-text-muted">
            La creación de nuevas porras está deshabilitada por el administrador.
          </p>
        </div>
      </div>
    );
  }

  if ((!userTeams.length && newPorrasAllowed) || (creatingNew && canCreateMore)) {
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
      newPorrasAllowed={newPorrasAllowed}
      onEditTeam={canEditPorra() ? setEditingTeam : undefined}
      onDeleted={handleDeleted}
      canCreateMore={canCreateMore}
    />
  );
}

// ════════════════════════════════════════════════════════════
// LOGIN VIEW — con acceso de admin restaurado
// ════════════════════════════════════════════════════════════

function LoginView({ onLogin }: { onLogin: (username: string, password: string) => Promise<boolean> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!username || !password) { setError("Completa los campos"); return; }
    setLoading(true);
    setError("");
    try {
      const ok = await onLogin(username, password);
      // Solo mostramos error si el login terminó y falló
      if (!ok) setError("Credenciales incorrectas");
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
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
            onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void handle()} />
        </div>
        <div className="mb-4 text-left">
          <label className="mb-1 block text-[11px] text-text-muted">Contraseña</label>
          <div className="relative">
            <input className="input-field !pr-10" type={showPass ? "text" : "password"}
              placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void handle()} />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
              onClick={() => setShowPass((v) => !v)}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {error && <p className="mb-4 text-sm text-danger">{error}</p>}
        <button className="btn btn-primary w-full" onClick={() => void handle()} disabled={loading}>
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
  onSelectTeam, onCreateNew, newPorrasAllowed, onEditTeam, onDeleted, canCreateMore,
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
  newPorrasAllowed: boolean;
  onEditTeam?: (team: Team) => void;
  onDeleted: (teamId: string) => void;
  canCreateMore: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"resumen" | "partidos" | "grupos" | "eliminatorias" | "especiales">("resumen");
  const [showScores, setShowScores] = useState(true);
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
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <AvatarUploader name={activeTeam?.name || user.username} size={64} />
            <div className="min-w-0">
              <p className="text-[10px] text-text-muted leading-tight">Usuario</p>
              <UserBadge
                username={<span className="text-sm font-semibold truncate">@{user.username}</span>}
                label={activeTeam?.label ?? userTeams[0]?.label ?? null}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge badge-green text-[10px]">{userTeams.length}/3 porras</span>
            {onCreateNew ? (
              <button className="btn btn-ghost !px-2.5 !py-1.5 text-xs" onClick={onCreateNew}>
                <Plus size={13} /> Nueva porra
              </button>
            ) : !newPorrasAllowed ? (
              <span className="badge badge-muted text-[10px]">Creación cerrada</span>
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
              className={`pill pill-club ${activeTeamId === team.id ? "active" : ""}`}
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
              <button key={tab} className={`pill pill-club capitalize ${activeTab === tab ? "active" : ""}`}
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
        body: JSON.stringify({ teamId: team.id, userId: team.userId }),
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
  // ── Cuadro de eliminatorias del usuario (mismo estilo que el Cuadro de Resultados) ──
  // Partimos de los 32 en orden de bracket (roundOf32Teams) y resolvemos cada
  // cruce con los equipos que el usuario eligió para avanzar en cada ronda. Los
  // puntos se reflejan comparando cada selección con la ronda real del admin.
  const COL_W = 208;
  const CONN_W = 20;

  const r32Teams = useMemo(() => {
    if (team.roundOf32Teams && team.roundOf32Teams.length >= 2) return team.roundOf32Teams;
    // Fallback (orden no-bracket): 1.º y 2.º de cada grupo + mejores terceros.
    const out: string[] = [];
    for (const g of Object.keys(GROUPS)) {
      const p = team.groupOrderPicks?.[g] || [];
      if (p[0]) out.push(p[0]);
      if (p[1]) out.push(p[1]);
    }
    for (const g of (team.bestThirdGroups || [])) {
      const p = team.groupOrderPicks?.[g] || [];
      if (p[2]) out.push(p[2]);
    }
    return out;
  }, [team]);

  const sets = useMemo(() => {
    const toSet = (key: string) =>
      new Set((team.knockoutPicks?.[key] || []).map((p) => p.country).filter(Boolean));
    return {
      d16: toSet("dieciseisavos"),
      oct: toSet("octavos"),
      cuartos: toSet("cuartos"),
      semis: toSet("semis"),
      champ: new Set([team.championPick].filter(Boolean) as string[]),
    };
  }, [team]);

  const bracket = useMemo(() => {
    const toPairs = (arr: string[]) => {
      const out: [string, string][] = [];
      for (let i = 0; i < arr.length; i += 2) out.push([arr[i] || "", arr[i + 1] || ""]);
      return out;
    };
    const advancer = (pair: [string, string] | undefined, set: Set<string>) =>
      pair ? pair.find((t) => t && set.has(t)) || "" : "";
    const nextRound = (matches: [string, string][], set: Set<string>): [string, string][] => {
      const out: [string, string][] = [];
      for (let i = 0; i < matches.length; i += 2) {
        out.push([advancer(matches[i], set), advancer(matches[i + 1], set)]);
      }
      return out;
    };
    const r32 = toPairs(r32Teams);                  // 16 cruces
    const octavos = nextRound(r32, sets.d16);       // 8
    const cuartos = nextRound(octavos, sets.oct);   // 4
    const semis = nextRound(cuartos, sets.cuartos); // 2
    const finalPair = (nextRound(semis, sets.semis)[0] || ["", ""]) as [string, string];
    return { r32, octavos, cuartos, semis, finalPair };
  }, [r32Teams, sets]);

  if (r32Teams.length < 2) {
    return (
      <div className="card animate-fade-in">
        <p className="text-[12px] text-text-muted">Completa la fase de grupos y guarda la porra para ver tu cuadro de eliminatorias.</p>
      </div>
    );
  }

  const adminSet = (key: string) => new Set((adminResults.knockoutRounds?.[key as keyof typeof adminResults.knockoutRounds] || []).filter(Boolean));

  const columns: { label: string; matches: [string, string][]; adminKey: string; pts: number; winnerSet: Set<string> }[] = [
    { label: "Ronda de 32", matches: bracket.r32, adminKey: "dieciseisavos", pts: 6, winnerSet: sets.d16 },
    { label: "Octavos", matches: bracket.octavos, adminKey: "octavos", pts: 10, winnerSet: sets.oct },
    { label: "Cuartos", matches: bracket.cuartos, adminKey: "cuartos", pts: 15, winnerSet: sets.cuartos },
    { label: "Semifinal", matches: bracket.semis, adminKey: "semis", pts: 20, winnerSet: sets.semis },
    { label: "Final", matches: [bracket.finalPair], adminKey: "final", pts: 25, winnerSet: sets.champ },
  ];

  const podiumPts =
    (adminResults.podium?.campeon && team.championPick === adminResults.podium.campeon ? 50 : 0) +
    (adminResults.podium?.subcampeon && team.runnerUpPick === adminResults.podium.subcampeon ? 30 : 0) +
    (adminResults.podium?.tercero && team.thirdPlacePick === adminResults.podium.tercero ? 20 : 0);

  return (
    <div className="animate-fade-in">
      <p className="text-[11px] text-text-muted mb-2">
        Desliza para recorrer tu cuadro. La selección marcada con › es la que hiciste avanzar.{showScores ? " En verde, aciertos (con sus puntos); en rojo, fallos." : ""}
      </p>
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "stretch", minWidth: "min-content" }}>
          {columns.map((col, ci) => {
            const aset = adminSet(col.adminKey);
            const hasData = aset.size > 0 && showScores;
            const isFinalCol = col.label === "Final";
            return (
              <div key={col.label} style={{ display: "flex", alignItems: "stretch", flexShrink: 0 }}>
                <div style={{ width: COL_W, flexShrink: 0, display: "flex", flexDirection: "column" }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-faint" style={{ padding: "0 2px 8px", textAlign: "center" }}>
                    {col.label}
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around", gap: 12 }}>
                    {col.matches.map((m, mi) => (
                      <KnockoutPickCard
                        key={`${col.label}-${mi}`}
                        home={m[0]}
                        away={m[1]}
                        winnerSet={col.winnerSet}
                        adminSet={aset}
                        hasData={hasData}
                        pts={col.pts}
                      />
                    ))}
                    {isFinalCol && (
                      <div className="rounded-xl" style={{ background: "rgb(var(--bg-2))", border: "1px solid rgb(var(--border-subtle))", padding: "8px 10px" }}>
                        <p className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "#C99625" }}>Campeón</p>
                        <PodiumPickRow country={team.championPick} ok={Boolean(adminResults.podium?.campeon && team.championPick === adminResults.podium.campeon)} pts={50} hasData={showScores && Boolean(adminResults.podium?.campeon)} />
                        <p className="text-[9px] font-bold uppercase tracking-wider mt-2 mb-1.5" style={{ color: "#CD7F32" }}>3.er puesto</p>
                        <PodiumPickRow country={team.thirdPlacePick} ok={Boolean(adminResults.podium?.tercero && team.thirdPlacePick === adminResults.podium.tercero)} pts={20} hasData={showScores && Boolean(adminResults.podium?.tercero)} />
                      </div>
                    )}
                  </div>
                </div>
                {ci < columns.length - 1 && (
                  <div style={{ width: CONN_W, flexShrink: 0, display: "flex", flexDirection: "column", paddingTop: 18 }}>
                    <KOConnectors pairCount={columns[ci + 1].matches.length} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[9px] text-text-faint">
        <span className="inline-flex items-center gap-1"><span style={{ color: "rgb(var(--accent-participante))", fontWeight: 900 }}>›</span> Pasa de ronda (tu pick)</span>
        {showScores && (
          <>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: "rgb(var(--success-soft))", border: "1px solid rgba(var(--success),0.3)" }} /> Acertado</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: "rgb(var(--danger-soft))", border: "1px solid rgba(var(--danger),0.3)" }} /> Fallado</span>
          </>
        )}
      </div>
      {showScores && (
        <p className="mt-2 text-[11px] text-text-muted">
          Puntos de eliminatorias + podio reflejados en el cuadro. Podio: <span className="font-bold text-text-warm">{podiumPts}</span> pts.
        </p>
      )}
    </div>
  );
}

function KnockoutPickCard({ home, away, winnerSet, adminSet, hasData, pts }: { home: string; away: string; winnerSet: Set<string>; adminSet: Set<string>; hasData: boolean; pts: number }) {
  const row = (country: string) => {
    const isPlaceholder = !country;
    const isWinner = !isPlaceholder && winnerSet.has(country);
    const correct = hasData && !isPlaceholder && adminSet.has(country);
    const wrong = hasData && !isPlaceholder && !adminSet.has(country);
    let bg = "transparent";
    if (correct) bg = "rgb(var(--success-soft))";
    else if (wrong) bg = "rgb(var(--danger-soft))";
    return (
      <div className="flex items-center gap-2" style={{ padding: "5px 8px", borderRadius: 7, background: bg }}>
        {isPlaceholder ? (
          <>
            <span style={{ width: 16, height: 16, borderRadius: "50%", background: "rgb(var(--bg-3))", flexShrink: 0 }} />
            <span className="text-[10px] text-text-faint italic truncate" style={{ flex: 1 }}>Por definir</span>
          </>
        ) : (
          <>
            <Flag country={country} size="sm" />
            <span className={`text-[11px] truncate ${isWinner ? "font-bold text-text-warm" : "text-text-primary"}`} style={{ flex: 1 }}>{country}</span>
            {isWinner && <span style={{ color: "rgb(var(--accent-participante))", fontWeight: 900, fontSize: 12, flexShrink: 0 }}>›</span>}
            {correct && <span className="text-[10px] font-bold tabular-nums" style={{ color: "rgb(var(--success))", flexShrink: 0 }}>+{pts}</span>}
          </>
        )}
      </div>
    );
  };
  return (
    <div className="rounded-xl" style={{ background: "rgb(var(--bg-2))", border: "1px solid rgb(var(--border-subtle))" }}>
      {row(home)}
      <div style={{ height: 1, background: "rgb(var(--border-subtle))", margin: "0 8px" }} />
      {row(away)}
    </div>
  );
}

function PodiumPickRow({ country, ok, pts, hasData }: { country: string; ok: boolean; pts: number; hasData: boolean }) {
  if (!country) return <p className="text-[10px] text-text-faint italic">Sin elegir</p>;
  const bg = hasData ? (ok ? "rgb(var(--success-soft))" : "rgb(var(--danger-soft))") : "transparent";
  return (
    <div className="flex items-center gap-2" style={{ padding: "4px 6px", borderRadius: 7, background: bg }}>
      <Flag country={country} size="sm" />
      <span className="text-[11px] text-text-primary truncate" style={{ flex: 1 }}>{country}</span>
      {hasData && ok && <span className="text-[10px] font-bold tabular-nums" style={{ color: "rgb(var(--success))" }}>+{pts}</span>}
    </div>
  );
}

function KOConnectors({ pairCount }: { pairCount: number }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around" }}>
      {Array.from({ length: Math.max(1, pairCount) }).map((_, i) => (
        <div key={i} style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <div style={{ width: 10, height: "50%", borderTop: "1.5px solid rgb(var(--border-default))", borderBottom: "1.5px solid rgb(var(--border-default))", borderRight: "1.5px solid rgb(var(--border-default))", borderTopRightRadius: 8, borderBottomRightRadius: 8 }} />
          <div style={{ flex: 1, height: 1.5, background: "rgb(var(--border-default))" }} />
        </div>
      ))}
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
