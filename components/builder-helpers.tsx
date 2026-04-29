"use client";

import type { ReactNode } from "react";

/**
 * Helpers visuales para "Crear mi Porra".
 *
 * IMPORTANTE: Estos componentes son ENVOLTORIOS visuales puros.
 * NO modifican la lógica del builder, ni el método de input,
 * ni el orden de los campos.
 *
 * Uso recomendado dentro de MiPorraBuilder:
 *   <BuilderStepper currentStep={2} totalSteps={6} labels={[...]} />
 *   <BuilderFieldGroup title="Equipos por grupo" hint="Ordena del 1.º al 4.º">
 *     ...inputs originales sin tocar...
 *   </BuilderFieldGroup>
 *   <BuilderFloatingCTA visible={canSave}>
 *     <button>Guardar</button>
 *   </BuilderFloatingCTA>
 */

// ─── Stepper / progreso visual ──────────────────────

export function BuilderStepper({
  currentStep,
  totalSteps,
  labels,
}: {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
}) {
  const pct = Math.round(((currentStep - 1) / Math.max(1, totalSteps - 1)) * 100);
  return (
    <div className="mb-5 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Paso {currentStep} de {totalSteps}
        </span>
        <span className="text-[10px] font-semibold tabular-nums text-gold">{pct}%</span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: "rgb(var(--bg-muted))" }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, rgb(var(--gold-light)), rgb(var(--gold)))",
          }}
        />
      </div>
      {labels && labels.length === totalSteps && (
        <div className="mt-2 flex items-center justify-between text-[9px] text-text-muted">
          {labels.map((label, idx) => (
            <span
              key={idx}
              className={`flex-1 text-center ${
                idx + 1 === currentStep ? "font-semibold text-gold" : ""
              } ${idx + 1 < currentStep ? "text-success" : ""}`}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Grupo de campos con título y hint ──────────────

export function BuilderFieldGroup({
  title,
  hint,
  required,
  optional,
  children,
}: {
  title: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="field-group animate-fade-in">
      <h3 className="field-group__title">
        {title}
        {required && (
          <span className="required-asterisk" aria-label="campo obligatorio">
            *
          </span>
        )}
        {optional && <span className="optional-tag">Opcional</span>}
      </h3>
      {hint && <p className="field-group__hint">{hint}</p>}
      <div>{children}</div>
    </section>
  );
}

// ─── Mensaje de validación inline (amistoso) ────────

export function BuilderHelperText({
  kind = "info",
  children,
}: {
  kind?: "info" | "error" | "success";
  children: ReactNode;
}) {
  const color =
    kind === "error"
      ? "rgb(var(--danger))"
      : kind === "success"
      ? "rgb(var(--success))"
      : "rgb(var(--text-muted))";
  return (
    <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color }} role={kind === "error" ? "alert" : undefined}>
      {children}
    </p>
  );
}

// ─── CTA flotante siempre visible ───────────────────

export function BuilderFloatingCTA({
  children,
  visible = true,
  disabled = false,
}: {
  children: ReactNode;
  visible?: boolean;
  disabled?: boolean;
}) {
  if (!visible) return null;
  return (
    <div className="floating-cta animate-slide-up" aria-disabled={disabled}>
      {children}
    </div>
  );
}

// ─── Separador visual de secciones ──────────────────

export function BuilderDivider({ label }: { label?: string }) {
  if (!label) {
    return <div className="my-4" style={{ borderTop: "1px dashed rgb(var(--border-default))" }} />;
  }
  return (
    <div className="my-4 flex items-center gap-3">
      <div className="flex-1" style={{ borderTop: "1px dashed rgb(var(--border-default))" }} />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <div className="flex-1" style={{ borderTop: "1px dashed rgb(var(--border-default))" }} />
    </div>
  );
}
