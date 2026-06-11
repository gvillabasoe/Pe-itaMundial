"use client";

import { useState } from "react";
import { CloudDownload, Loader2, Undo2 } from "lucide-react";
import type { AdminMatchResult, AdminResults } from "@/lib/admin-results";
import {
  importFinishedResultsFromApi,
  revertImportedResults,
} from "@/lib/admin-import-fixtures";

// ════════════════════════════════════════════════════════════
// Botón conmutable "Importar finalizados desde la API" / "Deshacer
// importación" para el panel Admin.
//
// - Importar: rellena en el formulario los marcadores de los partidos
//   que la API da por FINALIZADOS y que el admin no haya confirmado.
// - Deshacer: devuelve esos partidos a lo que había antes de importar.
//   Si el admin editó a mano alguno de ellos DESPUÉS de importar, esa
//   edición se respeta y no se revierte.
// - No guarda nada en ningún caso: tras importar o deshacer, el admin
//   revisa y pulsa "Guardar cambios" como siempre. El flujo de guardado,
//   la validación y el scoring no se tocan.
//
// Nota: el deshacer está disponible mientras permanezcas en la pestaña
// Resultados (al cambiar de pestaña o recargar, la referencia de la
// importación se descarta).
//
// Uso en app/admin/page.tsx, dentro de la pestaña Resultados:
//   <ImportFinishedFromApi
//     form={form}
//     onApply={(next) => { touchForm(); setForm(next); }}
//   />
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
  const [importing, setImporting] = useState(false);
  const [lastImport, setLastImport] = useState<LastImport | null>(null);
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; message: string } | null>(null);

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
          message: `${summary.imported} marcador${summary.imported === 1 ? "" : "es"} importado${summary.imported === 1 ? "" : "s"}${extra}. Revisa y pulsa "Guardar cambios" — o vuelve a pulsar el botón para deshacer.`,
        });
      } else if (summary.skippedConfigured > 0) {
        setFeedback({
          tone: "warn",
          message: `Nada nuevo: los ${summary.skippedConfigured} finalizados ya estaban confirmados.`,
        });
      } else {
        setFeedback({
          tone: "warn",
          message: "La API aún no da ningún partido por finalizado.",
        });
      }
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? `No se ha podido importar: ${error.message}`
            : "No se ha podido importar desde la API.",
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

    if (summary.reverted === 0 && summary.keptEdited > 0) {
      setFeedback({
        tone: "warn",
        message: `Nada que deshacer: los ${summary.keptEdited} importados los editaste a mano después y se respetan.`,
      });
      return;
    }
    const extra =
      summary.keptEdited > 0
        ? ` · ${summary.keptEdited} editado${summary.keptEdited === 1 ? "" : "s"} a mano después (se respetan)`
        : "";
    setFeedback({
      tone: "ok",
      message: `Importación deshecha: ${summary.reverted} partido${summary.reverted === 1 ? "" : "s"} devuelto${summary.reverted === 1 ? "" : "s"} a lo que había${extra}. Recuerda pulsar "Guardar cambios" si quieres persistirlo.`,
    });
  };

  const reverting = lastImport !== null;

  return (
    <div className="card mb-3" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
      <button
        type="button"
        className={`btn ${reverting ? "btn-primary" : ""}`}
        onClick={() => (reverting ? handleRevert() : void handleImport())}
        disabled={importing}
        aria-pressed={reverting}
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        {importing ? (
          <Loader2 size={16} className="animate-spin" />
        ) : reverting ? (
          <Undo2 size={16} />
        ) : (
          <CloudDownload size={16} />
        )}
        {importing
          ? "Importando..."
          : reverting
            ? "Deshacer importación"
            : "Importar finalizados desde la API"}
      </button>
      <p className="text-[11px] text-text-muted" style={{ flex: "1 1 220px", margin: 0 }}>
        {reverting
          ? "Importación aplicada (sin guardar). Pulsa el botón para revertir a lo que había, o \"Guardar cambios\" para confirmarla."
          : "Rellena los marcadores de partidos finalizados según la API en vivo. No pisa resultados ya confirmados ni guarda nada hasta que pulses Guardar."}
      </p>
      {feedback ? (
        <p
          role="status"
          className="text-[11px]"
          style={{
            margin: 0,
            width: "100%",
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
