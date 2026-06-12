"use client";

import { useState } from "react";
import { CloudDownload, Loader2, Undo2, Zap } from "lucide-react";
import type { AdminMatchResult, AdminResults } from "@/lib/admin-results";
import {
  importFinishedResultsFromApi,
  revertImportedResults,
} from "@/lib/admin-import-fixtures";
import { notifyAdminResultsUpdated } from "@/lib/use-scored-participants";

// ════════════════════════════════════════════════════════════
// Control "Resultados automáticos desde la API" del panel Admin.
//
// SWITCH (persistente, activo por defecto):
//   ON  → los partidos finalizados según la API se completan y puntúan
//         SOLOS en toda la app (clasificación, resultados, progreso).
//         El merge ocurre en el servidor (/api/admin-results) al vuelo:
//         no se guarda nada automáticamente y lo que el admin confirme
//         a mano SIEMPRE tiene prioridad.
//   OFF → modo manual: solo puntúa lo que el admin guarde. Para ayudar,
//         en este modo sigue disponible el botón de importación puntual
//         con su deshacer (rellena el formulario; guarda el admin).
//
// Uso en app/admin/page.tsx (mismas props de siempre):
//   <ImportFinishedFromApi form={form} onApply={(next) => { touchForm(); setForm(next); }} />
// ════════════════════════════════════════════════════════════

interface ImportFinishedFromApiProps {
  form: AdminResults;
  /** Recibe el formulario actualizado (sin guardar) */
  onApply: (next: AdminResults) => void;
}

interface LastImport {
  applied: Record<string, AdminMatchResult>;
  previous: Record<string, AdminMatchResult>;
}

type FeedbackTone = "ok" | "warn" | "error";

export function ImportFinishedFromApi({ form, onApply }: ImportFinishedFromApiProps) {
  const [savingSwitch, setSavingSwitch] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lastImport, setLastImport] = useState<LastImport | null>(null);
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; message: string } | null>(null);

  const autoOn = form.autoImportApi;

  const handleToggle = async () => {
    const next = !autoOn;
    setSavingSwitch(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin-results/auto-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || `Error ${res.status}`);
      // El switch va aparte del "Guardar cambios": solo tocamos ese campo
      // del formulario; las ediciones en curso del admin no se alteran.
      onApply({ ...form, autoImportApi: next });
      notifyAdminResultsUpdated();
      setFeedback({
        tone: "ok",
        message: next
          ? "Automático activado: los finalizados puntúan solos desde la API. Lo que confirmes a mano siempre tiene prioridad."
          : "Modo manual: a partir de ahora solo puntúa lo que guardes tú.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: `No se ha podido guardar el ajuste: ${error instanceof Error ? error.message : "error"}`,
      });
    } finally {
      setSavingSwitch(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setFeedback(null);
    try {
      const summary = await importFinishedResultsFromApi(form);
      if (summary.imported > 0) {
        onApply(summary.next);
        setLastImport({ applied: summary.applied, previous: summary.previous });
        const extra =
          summary.skippedConfigured > 0
            ? ` · ${summary.skippedConfigured} ya confirmados (no se tocan)`
            : "";
        setFeedback({
          tone: "ok",
          message: `${summary.imported} marcador${summary.imported === 1 ? "" : "es"} importado${summary.imported === 1 ? "" : "s"}${extra}. Revisa y pulsa "Guardar cambios" — o vuelve a pulsar para deshacer.`,
        });
      } else if (summary.skippedConfigured > 0) {
        setFeedback({ tone: "warn", message: `Nada nuevo: los ${summary.skippedConfigured} finalizados ya estaban confirmados.` });
      } else {
        setFeedback({ tone: "warn", message: "La API aún no da ningún partido por finalizado." });
      }
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? `No se ha podido importar: ${error.message}` : "No se ha podido importar desde la API.",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleRevert = () => {
    if (!lastImport) return;
    const summary = revertImportedResults(form, lastImport.applied, lastImport.previous);
    onApply(summary.next);
    setLastImport(null);
    const extra =
      summary.keptEdited > 0
        ? ` · ${summary.keptEdited} editado${summary.keptEdited === 1 ? "" : "s"} a mano después (se respetan)`
        : "";
    setFeedback({
      tone: "ok",
      message:
        summary.reverted === 0
          ? "Nada que deshacer: los importados los editaste a mano después y se respetan."
          : `Importación deshecha: ${summary.reverted} partido${summary.reverted === 1 ? "" : "s"} devuelto${summary.reverted === 1 ? "" : "s"} a lo que había${extra}.`,
    });
  };

  const reverting = lastImport !== null;

  return (
    <div className="card mb-3" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* ── Switch ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          role="switch"
          aria-checked={autoOn}
          onClick={() => void handleToggle()}
          disabled={savingSwitch}
          style={{
            position: "relative",
            width: 44,
            height: 24,
            borderRadius: 999,
            border: "1px solid " + (autoOn ? "rgba(201,150,37,0.5)" : "rgb(var(--border-default))"),
            background: autoOn ? "rgba(201,150,37,0.35)" : "rgba(255,255,255,0.06)",
            cursor: savingSwitch ? "wait" : "pointer",
            transition: "background 160ms ease",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: autoOn ? 22 : 2,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: autoOn ? "#C99625" : "rgb(var(--text-muted))",
              transition: "left 160ms ease, background 160ms ease",
            }}
          />
        </button>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <p className="text-[12px] font-semibold text-text-warm" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
            {savingSwitch ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} style={{ color: autoOn ? "#C99625" : "rgb(var(--text-muted))" }} />}
            Resultados automáticos desde la API
            <span
              className="text-[9px] font-bold uppercase tracking-widest"
              style={{ color: autoOn ? "#3E9B4F" : "rgb(var(--text-muted))" }}
            >
              {autoOn ? "Activado" : "Apagado"}
            </span>
          </p>
          <p className="text-[11px] text-text-muted" style={{ margin: 0 }}>
            {autoOn
              ? "Los partidos finalizados se completan y puntúan solos en toda la app. Lo que confirmes a mano tiene prioridad."
              : "Modo manual: solo puntúa lo que tú guardes. Puedes usar la importación puntual de abajo."}
          </p>
        </div>
      </div>

      {/* ── Importación puntual (solo en modo manual) ── */}
      {!autoOn && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className={`btn ${reverting ? "btn-primary" : ""}`}
            onClick={() => (reverting ? handleRevert() : void handleImport())}
            disabled={importing}
            aria-pressed={reverting}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {importing ? <Loader2 size={16} className="animate-spin" /> : reverting ? <Undo2 size={16} /> : <CloudDownload size={16} />}
            {importing ? "Importando..." : reverting ? "Deshacer importación" : "Importar finalizados ahora"}
          </button>
          <p className="text-[11px] text-text-muted" style={{ flex: "1 1 200px", margin: 0 }}>
            Rellena el formulario una vez; revisas y pulsas Guardar. No pisa resultados confirmados.
          </p>
        </div>
      )}

      {feedback ? (
        <p
          role="status"
          className="text-[11px]"
          style={{
            margin: 0,
            color:
              feedback.tone === "error"
                ? "rgb(var(--danger))"
                : feedback.tone === "warn"
                  ? "#C99625"
                  : "#3E9B4F",
          }}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
