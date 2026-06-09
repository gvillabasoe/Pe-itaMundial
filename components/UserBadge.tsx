import type { ReactNode } from "react";

// ════════════════════════════════════════════════════════════
// UserBadge — muestra un nombre de usuario y, si tiene etiqueta,
// un chip rojo a su derecha. Si `label` es null/vacío no pinta nada.
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
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="truncate">{username}</span>
      {text ? (
        <span
          title={text}
          style={{ background: "rgb(var(--danger))", color: "#fff" }}
          className={
            "inline-flex items-center rounded-full px-1.5 py-0.5 " +
            "text-[10px] font-semibold uppercase leading-none tracking-wide " +
            "whitespace-nowrap " +
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
