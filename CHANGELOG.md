# CHANGELOG — Peñita Mundial

Cambios integrados y verificados con `tsc --noEmit` (sin errores) y
`next build` (build de producción correcto, 12/12 páginas).

## Cómo aplicar

1. Descomprime este ZIP sobre la raíz del repo (respeta la estructura de
   carpetas, así que sobrescribe los archivos existentes y añade los nuevos).
2. **Ejecuta primero la migración SQL** en Neon → SQL Editor:
   `sql/005_add_user_label_and_active.sql`. Es aditiva e idempotente.
3. `npm install` (no hay dependencias nuevas) y `npm run build` para
   comprobar en local.
4. Commit + push y redeploy en Vercel.

> Orden importante: aplica la migración 005 **antes** de desplegar el código.
> Aun así, el código incluye guardas que evitan romper el login y la carga de
> porras si las columnas nuevas todavía no existen.

---

## 🐛 Bug fix — fecha límite de edición

- **`app/mi-club/page.tsx`** — La constante `EDIT_DEADLINE`
  (`2026-06-10T19:00:00.000Z` = 10 jun 21:00 CEST) ya era correcta. El bug
  estaba en `editDeadlineText()`: la rama `days === 1` calculaba la hora con
  `21 - (24 - hours)`, lo que producía texto erróneo ("mañana a las 7:00").
  Ahora se muestra la fecha absoluta formateada en horario de Madrid con
  `Intl.DateTimeFormat` ("Edición abierta hasta el jueves, 10 de junio,
  21:00 (1 día)"), correcta en cualquier zona horaria del usuario.

## ✨ Nueva funcionalidad — Gestión de usuarios (Admin)

Las contraseñas están hasheadas con **scrypt** y NO se pueden mostrar en
texto plano (es irreversible por diseño). En su lugar se añade un flujo de
**resetear contraseña** que genera una temporal y la muestra una sola vez.

Endpoints nuevos:

- **`app/api/admin/users/list/route.ts`** — Lista usuarios (id, username,
  displayName, role, label, active, createdAt). Nunca expone el hash.
- **`app/api/admin/users/reset-password/route.ts`** — Genera una contraseña
  temporal, la guarda hasheada (scrypt) y la devuelve una vez.
- **`app/api/admin/users/set-label/route.ts`** — Asigna/edita/borra la
  etiqueta (texto libre, máx. 40 caracteres).
- **`app/api/admin/users/set-active/route.ts`** — Da de baja (active=false)
  o reactiva (active=true). Reversible.

Modificado:

- **`app/admin/page.tsx`** — La pestaña **Usuarios** ahora incluye, además
  del alta existente, un listado de todos los usuarios con: chip de etiqueta,
  nombre visible, rol, estado (Activo/Baja), etiqueta editable, botón de
  baja/reactivar y botón de resetear contraseña (muestra la temporal una vez).
  Nota: el email no se guarda en la BBDD de la app (se recoge en el formulario
  de inscripción), por eso no figura como columna.
- **`app/api/auth/login/route.ts`** — Bloquea el login de usuarios dados de
  baja (HTTP 403) y devuelve `label`/`active`. Incluye fallback al SELECT
  clásico si la migración 005 aún no se ha aplicado.
- **`app/api/auth/me/route.ts`** — Propaga `label`/`active` al rehidratar y
  expulsa a un usuario que se haya dado de baja durante la sesión.

## 🏷️ Componente nuevo + visualización de etiquetas

- **`components/UserBadge.tsx`** — Componente reutilizable: nombre + chip
  rojo (fondo `--danger`, texto blanco, redondeado, pequeño). Si la etiqueta
  es null/vacía no pinta nada.
- Usado en:
  - `app/clasificacion/page.tsx` — fila del ranking y detalle de la porra.
  - `app/versus/page.tsx` — tarjeta base del usuario.
  - `app/mi-club/page.tsx` — cabecera "Usuario".

## 🗄️ Datos / propagación de la etiqueta

- **`sql/005_add_user_label_and_active.sql`** — Añade `label text` y
  `active boolean not null default true` a `users` + índice sobre `active`.
- **`lib/data.ts`** — `User` y `Team` reciben `label?: string | null`
  (y `User` también `displayName?`, `role?`, `active?`).
- **`lib/user-teams.ts`** — `sanitizeUserTeam` preserva `label`.
- **`lib/server/user-teams-db.ts`** — Al cargar las porras, inyecta la
  etiqueta del dueño (join con `users.label`). Tolerante a fallos: si la
  columna no existe todavía, no muestra etiquetas pero no rompe la carga.

## ⚠️ Notas / observaciones encontradas

- `PATCH_mi-porra-builder.tsx.txt` (ya en el repo) elimina la validación
  bloqueante al guardar una porra. Es intencionado, pero conviene asegurarse
  de que el banner de advertencia sigue visible para que el usuario no crea
  que ha entregado una porra completa cuando aún está incompleta.
- El email de los participantes no vive en la BBDD; si quisieras gestionarlo
  desde el admin habría que añadir una columna `email` a `users` y recogerlo
  en el alta. No se ha hecho para no salirme del alcance pedido.
