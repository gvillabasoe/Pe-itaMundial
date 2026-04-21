# Pasos 3, 4 y 5 · Conectar la porra a Neon / Postgres

## Qué cambia en estos archivos

Este pack sustituye la persistencia en archivos JSON por Postgres para que funcione bien en Vercel.

### Archivos nuevos

- `lib/db.ts`
- `lib/server/user-teams-db.ts`
- `lib/server/admin-results-db.ts`
- `app/api/ping-db/route.ts`
- `sql/001_neon_init.sql`
- `docs/pasos-3-4-5-neon.md`

### Archivos modificados

- `app/api/user-teams/route.ts`
- `app/api/admin-results/route.ts`
- `.env.example`
- `package.json`

---

## Paso 3 · Añadir la conexión a la base de datos

1. En tu repo, copia estos archivos nuevos y reemplaza los modificados.
2. En la raíz del proyecto, crea o actualiza `.env.local` con:

```env
DATABASE_URL=tu_cadena_de_neon
```

3. Instala dependencias:

```bash
npm install
```

---

## Paso 4 · Crear las tablas en Neon

1. Entra en Neon.
2. Abre el SQL Editor.
3. Pega el contenido de `sql/001_neon_init.sql`.
4. Ejecuta el script.

Eso crea dos tablas:

- `user_teams` para guardar las porras de los usuarios
- `admin_results` para guardar los resultados oficiales del panel Admin

---

## Paso 5 · Subir al repo y desplegar en Vercel

1. Sube los cambios a tu repositorio.
2. En Vercel, añade la variable `DATABASE_URL` en el proyecto.
3. Haz redeploy.
4. Comprueba que esta ruta responde bien:

```text
/api/ping-db
```

Si devuelve `ok: true`, la conexión con Neon está funcionando.

Después de eso:

- `/api/user-teams` guardará las porras en Postgres
- `/api/admin-results` guardará el panel Admin en Postgres
- la persistencia real quedará en Postgres
- si la base aún está vacía, la app puede leer los JSON actuales como fallback inicial

---

## Orden recomendado para probar

1. Probar `/api/ping-db`
2. Entrar en **Mi Porra** y guardar una porra
3. Entrar en **Admin** y guardar resultados
4. Recargar la web para confirmar que los datos persisten

---

## Nota importante

Los archivos `data/user-teams.json` y `data/admin-results.json` pueden quedarse en el repo como referencia o respaldo, pero con este cambio la app ya usa Postgres como fuente real.
