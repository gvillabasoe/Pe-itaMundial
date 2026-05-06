-- ============================================================
-- Migración 003: Tabla users + seed con canallita y tester
-- ============================================================
-- Idempotente. Crea la tabla users y siembra los dos usuarios
-- iniciales con hashes scrypt pre-generados.
--
-- IMPORTANTE: los hashes son scrypt (NO bcrypt). Esto evita la
-- dependencia de `bcryptjs` y usa el módulo `node:crypto` nativo
-- que ya viene con Node.js sin instalar nada.
--
-- Formato del hash: scrypt$N$r$p$salt_b64$hash_b64
--   N = 16384  (cost factor)
--   r = 8      (block size)
--   p = 1      (parallelization)
--
-- Cómo aplicar:
--   1. Entra en Neon → SQL Editor
--   2. Pega este script entero
--   3. Pulsa Run
--
-- Si ya ejecutaste una versión anterior con bcrypt:
--   Es seguro re-ejecutar este script. El ON CONFLICT actualizará
--   los hashes a scrypt automáticamente.
--
-- Contraseñas en claro (solo para tu referencia):
--   canallita → oyarsexo  (admin)
--   tester    → test1     (user)
-- ============================================================

-- ── 1. Tabla users ────────────────────────────────────────
create table if not exists users (
  id            text primary key,
  username      text not null unique,
  password_hash text not null,
  display_name  text not null,
  role          text not null default 'user'
                check (role in ('user', 'admin')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_users_username on users (lower(username));
create index if not exists idx_users_role     on users (role);

-- ── 2. Seed de usuarios ───────────────────────────────────
-- ON CONFLICT por username: si ya existen, actualiza el hash.
-- Esto permite re-ejecutar el script para rotar la contraseña
-- o migrar de un algoritmo a otro (bcrypt → scrypt).

insert into users (id, username, password_hash, display_name, role)
values
  (
    'u_canallita',
    'canallita',
    'scrypt$16384$8$1$tIbBSM0yB5fkv0TI+VD33w==$NR0o7Z2SuWAZJsswMo+Y6xKw8OBV6T/tyB5G1kSL5i7uPmXe9PURKdO4YixoZ5w2WgOIIZQXvb2ZIZH7IEwnIw==',
    'Canallita',
    'admin'
  ),
  (
    'u_tester',
    'tester',
    'scrypt$16384$8$1$EGds2X1Y4/48LmOZBJCYbg==$PRYRjQJQhGt7Uu0d3SQFN6OItFWIwmwaYOPpzmlNcfk+N8buiJevV7LuJ+gFVWTPfsVRELnvWqnapsnjUzvCPg==',
    'Tester',
    'user'
  )
on conflict (username) do update
  set password_hash = excluded.password_hash,
      display_name  = excluded.display_name,
      role          = excluded.role,
      updated_at    = now();

-- ── 3. Verificación ───────────────────────────────────────
-- Ejecuta esto después para confirmar que todo está bien:
--
--   select id, username, role, display_name, created_at
--   from users
--   order by created_at;
--
-- Deberías ver:
--   u_canallita | canallita | admin | Canallita | <timestamp>
--   u_tester    | tester    | user  | Tester    | <timestamp>
