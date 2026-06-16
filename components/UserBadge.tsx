import type { ReactNode } from "react";

// ════════════════════════════════════════════════════════════
// UserBadge — muestra un nombre de usuario y, si tiene etiqueta,
// un chip dorado (mismo estilo que las etiquetas de grupo) a su
// derecha. Si `label` es null/vacío no pinta nada.
//
// Uso:
//   <UserBadge username={`@${user.username}`} label={user.label} />
//   <UserBadge username={team.name} label={team.label} />
//
// Pensado para reutilizar en rankings, listados, versus, perfil, etc.
// ════════════════════════════════════════════════════════════
export function UserBadge({
  username,
  label,
  className = "",
  chipClassName = "",
}: {
  /** Nombre a mostrar. Puede ser texto o un nodo (ej. ya con "@"). */
  username: ReactNode;
  /** Etiqueta opcional. Si es null/vacía no se renderiza el chip. */
  label?: string | null;
  /** Clases extra para el contenedor. */
  className?: string;
  /** Clases extra para el chip (por si quieres ajustarlo en algún sitio). */
  chipClassName?: string;
}) {
  const text = (label ?? "").trim();

  return (
    <span className={`inline-flex items-center gap-1 min-w-0 max-w-full ${className}`}>
      <span className="truncate min-w-0">{username}</span>
      {text ? (
        <span
          title={text}
          style={{
            // Mismo patrón que las etiquetas de grupo (GroupBadge): fondo
            // tintado suave, texto del color saturado y borde fino con un
            // brillo interior. Aquí en dorado, el acento premium de la app.
            background: "rgba(var(--gold), 0.12)",
            color: "rgb(var(--gold))",
            borderColor: "rgba(var(--gold), 0.38)",
          }}
          className={
            // flex-shrink-0: el chip nunca se encoge; quien cede espacio es
            // el nombre (truncate). Así el bloque respeta su columna y no se
            // solapa con los puntos del ranking.
            "inline-flex flex-shrink-0 items-center rounded-full border px-1.5 py-px " +
            "text-[8px] font-bold uppercase tracking-wide leading-none " +
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] whitespace-nowrap " +
            chipClassName
          }
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}

export default UserBadge;
