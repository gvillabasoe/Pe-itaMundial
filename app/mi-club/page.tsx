"use client";

import { useState } from "react";
import { Shield, LogOut, Eye, EyeOff, User, Star } from "lucide-react";
import { Flag, GroupBadge, CountryWithFlag, EmptyState } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import { PARTICIPANTS, FIXTURES, GROUPS, GROUP_COLORS, KNOCKOUT_ROUND_DEFS } from "@/lib/data";
import type { Team } from "@/lib/data";

export default function MiClubPage() {
  const { user, login, logout } = useAuth();
  if (!user) return <LoginView onLogin={login} />;
  return <PrivateZone user={user} onLogout={logout} />;
}

function LoginView({ onLogin }: { onLogin: (u: string, p: string) => boolean }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = () => {
    if (!username || !password) { setError("Completa los campos"); return; }
    setLoading(true); setError("");
    setTimeout(() => { if (!onLogin(username, password)) setError("Credenciales incorrectas"); setLoading(false); }, 600);
  };

  return (
    <div className="px-4 flex items-center justify-center min-h-[80vh]">
      <div className="card w-full max-w-[360px] !p-7 text-center bg-gradient-to-b from-bg-4 to-bg-2 animate-fade-in">
        <div className="w-14 h-14 rounded-[14px] mx-auto mb-4 bg-gold/10 flex items-center justify-center border border-gold/20">
          <Shield size={28} className="text-gold" />
        </div>
        <h2 className="font-display text-[22px] font-extrabold text-text-warm mb-0.5">Mi Club</h2>
        <p className="text-xs text-text-muted mb-6">Acceso privado</p>
        <div className="text-left mb-3">
          <label className="text-[11px] text-text-muted mb-1 block">@usuario</label>
          <input className="input-field" placeholder="@usuario" value={username} onChange={(e: any) => setUsername(e.target.value)} />
        </div>
        <div className="text-left mb-4">
          <label className="text-[11px] text-text-muted mb-1 block">Contraseña</label>
          <div className="relative">
            <input className="input-field !pr-10" type={showPass ? "text" : "password"} placeholder="Contraseña" value={password} onChange={(e: any) => setPassword(e.target.value)} />
            <button onClick={() => setShowPass(!showPass)} className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-text-muted">
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-danger mb-3">{error}</p>}
        <button className="btn btn-primary w-full !py-3.5" onClick={handle} disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
        <p className="text-[10px] text-text-muted mt-4 opacity-50">Prueba: Carlos_M / cualquier contraseña</p>
      </div>
    </div>
  );
}

function PrivateZone({ user, onLogout }: { user: { id: string; username: string }; onLogout: () => void }) {
  const { favorites, toggleFavorite } = useAuth();
  const [activeTab, setActiveTab] = useState("resumen");
  const [activeTeamIdx, setActiveTeamIdx] = useState(0);
  const userTeams = PARTICIPANTS.filter(p => p.userId === user.id);
  const team = userTeams[activeTeamIdx] || userTeams[0];
  const tabs = ["Resumen", "Partidos", "Grupos", "Eliminatorias", "Especiales", "Favoritos"];

  return (
    <div className="px-4 pt-4 max-w-[640px] mx-auto">
      <div className="flex items-center justify-between mb-4 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-text-warm">Mi Club</h1>
          <p className="text-xs text-text-muted">Tus equipos y picks</p>
        </div>
        <button className="btn btn-ghost !py-2 !px-3.5 text-xs" onClick={onLogout}><LogOut size={14} /> Cerrar sesión</button>
      </div>

      <div className="card flex items-center gap-3 mb-3 animate-fade-in">
        <div className="w-10 h-10 rounded-[10px] bg-accent-participante/10 flex items-center justify-center">
          <User size={20} className="text-accent-participante" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-text-muted">Identidad Pública</p>
          <p className="text-sm font-semibold">@{user.username}</p>
        </div>
        <span className="badge badge-green text-[10px]">Activo</span>
      </div>

      {userTeams.length > 1 && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto">
          {userTeams.map((t, i) => (
            <button key={t.id} className={`pill ${activeTeamIdx === i ? "active" : ""}`} onClick={() => setActiveTeamIdx(i)}>{t.name}</button>
          ))}
        </div>
      )}

      {team && (
        <>
          <div className="card card-glow mb-2 text-center !py-5 bg-gradient-to-br from-bg-4 to-bg-2 !border-gold/10 animate-fade-in">
            <p className="text-sm font-semibold mb-0.5">{team.name}</p>
            <div className="flex items-center justify-center gap-1 mb-2">
              <Flag country={team.championPick} size="sm" />
              <span className="text-[11px] text-text-muted">Campeón: {team.championPick}</span>
            </div>
            <p className="font-display text-[40px] font-black text-gold-light">{team.totalPoints}</p>
            <span className="badge badge-gold mt-1">#{team.currentRank} de {PARTICIPANTS.length}</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {[{ label: "Fase de grupos", val: team.groupPoints }, { label: "Fase final", val: team.finalPhasePoints }, { label: "Especiales", val: team.specialPoints }].map((k, i) => (
              <div key={i} className="card text-center !p-2.5">
                <p className="text-[9px] text-text-muted">{k.label}</p>
                <p className="font-display text-lg font-bold">{k.val}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-0.5 bg-bg-3 rounded-[10px] p-[3px] overflow-x-auto mb-3.5">
            {tabs.map(t => (
              <button key={t} className={`px-3.5 py-2 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap transition-all border-none ${activeTab === t.toLowerCase() ? "bg-bg-5 text-text-primary" : "text-text-muted bg-transparent"}`}
                onClick={() => setActiveTab(t.toLowerCase())}>{t}</button>
            ))}
          </div>

          <div className="animate-fade-in">
            {activeTab === "resumen" && <TabResumen team={team} />}
            {activeTab === "partidos" && <TabPartidos team={team} />}
            {activeTab === "grupos" && <TabGrupos team={team} />}
            {activeTab === "eliminatorias" && <TabEliminatorias team={team} />}
            {activeTab === "especiales" && <TabEspeciales team={team} />}
            {activeTab === "favoritos" && <TabFavoritos favorites={favorites} toggleFavorite={toggleFavorite} />}
          </div>
        </>
      )}
    </div>
  );
}

function TabResumen({ team }: { team: Team }) {
  return (
    <div>
      {[
        { label: "Puntos totales", val: team.totalPoints, hl: true },
        { label: "Puntos fase de grupos", val: team.groupPoints },
        { label: "Puntos eliminatorias", val: team.finalPhasePoints },
        { label: "Puntos especiales", val: team.specialPoints },
      ].map((it, i) => (
        <div key={i} className="flex justify-between py-2.5 border-b border-white/[0.04]">
          <span className={`text-sm ${it.hl ? "text-text-warm font-semibold" : "text-text-muted"}`}>{it.label}</span>
          <span className={`font-display text-sm ${it.hl ? "font-extrabold text-gold-light" : "font-semibold"}`}>{it.val}</span>
        </div>
      ))}
    </div>
  );
}

function TabPartidos({ team }: { team: Team }) {
  const [selGroup, setSelGroup] = useState("A");
  const gFixtures = FIXTURES.filter(f => f.group === selGroup);
  const dblId = team.doubleMatches?.[selGroup];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1 overflow-x-auto pb-1 mb-1">
        {Object.keys(GROUPS).map(g => (
          <button key={g} className={`pill !px-2.5 !py-1 ${selGroup === g ? "active" : ""}`}
            onClick={() => setSelGroup(g)}
            style={selGroup === g ? { background: `${GROUP_COLORS[g]}22`, color: GROUP_COLORS[g], borderColor: GROUP_COLORS[g] } : {}}>
            {g}
          </button>
        ))}
      </div>
      {gFixtures.map(f => {
        const pick = team.matchPicks?.[f.id];
        const isD = f.id === dblId;
        return (
          <div key={f.id} className="card !py-2.5 !px-3" style={{ borderLeft: isD ? "3px solid #DFBE38" : "3px solid transparent" }}>
            <div className="flex items-center gap-1.5 mb-1">
              <GroupBadge group={selGroup} />
              <span className="text-[10px] text-text-muted">{f.round}</span>
              {isD && <span className="badge badge-amber text-[8px] !py-0 !px-1.5">DOBLE</span>}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1"><Flag country={f.homeTeam} size="sm" /><span className="text-[11px]">{f.homeTeam}</span></div>
              {pick ? (
                <span className="font-display text-sm font-bold text-text-muted bg-bg-2 rounded px-2 py-0.5">{pick.home} - {pick.away}</span>
              ) : <span className="text-[11px] text-text-muted">—</span>}
              <div className="flex items-center gap-1"><span className="text-[11px]">{f.awayTeam}</span><Flag country={f.awayTeam} size="sm" /></div>
            </div>
            <div className="text-center mt-1"><span className="badge badge-muted text-[9px]">Pendiente</span></div>
          </div>
        );
      })}
    </div>
  );
}

function TabGrupos({ team }: { team: Team }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Object.entries(GROUPS).map(([g, teams]) => {
        const userOrder = team.groupOrderPicks?.[g] || teams;
        return (
          <div key={g} className="card !p-2.5">
            <GroupBadge group={g} />
            <div className="mt-2 flex flex-col gap-1">
              {userOrder.map((t, i) => (
                <div key={t} className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-text-muted w-3.5">{i + 1}</span>
                  <Flag country={t} size="sm" />
                  <span className="text-[11px] truncate">{t}</span>
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
      {KNOCKOUT_ROUND_DEFS.map(rd => {
        const picks = team.knockoutPicks?.[rd.key] || [];
        return (
          <div key={rd.key}>
            <h4 className="font-display text-sm font-bold text-text-muted mb-1.5">{rd.name} <span className="text-[10px] font-normal">({rd.pts} pts)</span></h4>
            <div className="flex flex-wrap gap-1">
              {picks.map((p, pi) => (
                <div key={pi} className="card !py-1.5 !px-2.5 flex items-center gap-1.5">
                  <Flag country={p.country} size="sm" /><span className="text-[11px]">{p.country}</span>
                  <span className="badge badge-muted text-[9px]">Pendiente</span>
                </div>
              ))}
              {!picks.length && <span className="text-[11px] text-text-muted">Sin picks</span>}
            </div>
          </div>
        );
      })}
      <div className="card !p-4 text-center !border-gold/15 bg-gold/[0.03]">
        <p className="text-[11px] text-gold font-semibold mb-2">Final pronosticada</p>
        <div className="flex items-center justify-center gap-3">
          <div className="text-center"><Flag country={team.championPick} /><p className="text-[11px] mt-0.5">{team.championPick}</p></div>
          <span className="font-display text-base font-extrabold text-gold">vs</span>
          <div className="text-center"><Flag country={team.runnerUpPick} /><p className="text-[11px] mt-0.5">{team.runnerUpPick}</p></div>
        </div>
        <p className="text-xs font-semibold text-gold-light mt-2">Campeón: {team.championPick}</p>
      </div>
    </div>
  );
}

function TabEspeciales({ team }: { team: Team }) {
  const items = [
    { label: "Mejor Jugador", val: team.specials.mejorJugador, pts: 20 },
    { label: "Mejor Jugador Joven", val: team.specials.mejorJoven, pts: 20 },
    { label: "Máximo Goleador", val: team.specials.maxGoleador, pts: 20 },
    { label: "Máximo Asistente", val: team.specials.maxAsistente, pts: 20 },
    { label: "Mejor Portero", val: team.specials.mejorPortero, pts: 20 },
    { label: "Máx. Goleador Español", val: team.specials.maxGoleadorEsp, pts: 10 },
    { label: "Primer Gol Español", val: team.specials.primerGolEsp, pts: 10 },
    { label: "Selección Revelación", val: team.specials.revelacion, pts: 10, isC: true },
    { label: "Selección Decepción", val: team.specials.decepcion, pts: 10, isC: true },
    { label: "Min. Primer Gol", val: `${team.specials.minutoPrimerGol}'`, pts: 50 },
  ];
  return (
    <div className="flex flex-col gap-1">
      {items.map((s, i) => (
        <div key={i} className="card !py-2.5 !px-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wide">{s.label}</p>
            <p className="text-sm font-semibold mt-0.5">{s.isC ? <CountryWithFlag country={s.val} /> : s.val}</p>
          </div>
          <div className="text-right">
            <span className="badge badge-muted">Pendiente</span>
            <p className="text-[10px] text-text-muted mt-0.5">{s.pts} pts</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TabFavoritos({ favorites, toggleFavorite }: { favorites: string[]; toggleFavorite: (id: string) => void }) {
  const favTeams = PARTICIPANTS.filter(p => favorites.includes(p.id));
  if (!favTeams.length) return <EmptyState text="Aún no tienes favoritos. Márcalos desde la Clasificación." icon={Star} />;
  return (
    <div className="flex flex-col gap-1">
      {favTeams.map(p => (
        <div key={p.id} className="card !py-2.5 !px-3 flex items-center gap-2.5">
          <span className="font-display text-base font-extrabold text-text-muted min-w-[28px] text-center">#{p.currentRank}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-warm truncate">{p.name}</p>
            <p className="text-[11px] text-text-muted">@{p.username} · {p.totalPoints} pts</p>
          </div>
          <button onClick={() => toggleFavorite(p.id)} className="p-1 bg-transparent border-none cursor-pointer">
            <Star size={14} fill="#D4AF37" color="#D4AF37" />
          </button>
        </div>
      ))}
    </div>
  );
}
