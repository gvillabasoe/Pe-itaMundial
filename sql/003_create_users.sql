-- ============================================================
-- Migración 003: Tabla users + seed con canallita y tester
-- ============================================================
-- Idempotente: se puede ejecutar múltiples veces sin efecto
-- secundario. Crea la tabla users y siembra los dos usuarios
-- iniciales con bcrypt hashes pre-generados.
--
-- Cómo aplicar:
--   1. Entra en Neon → SQL Editor
--   2. Pega este script entero
--   3. Pulsa Run
--
-- Contraseñas en claro (solo para tu referencia):
--   canallita → oyarsexo  (admin)
--   tester    → test1     (user)
--
-- Los hashes son bcrypt rounds=10. Ya están verificados.
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
-- ON CONFLICT por username: si ya existen, solo actualiza el hash.
-- Esto permite re-ejecutar el script para rotar la contraseña.

insert into users (id, username, password_hash, display_name, role)
values
  (
    'u_canallita',
    'canallita',
    '$2b$10$cuMQWDHPxlmnc6GXTUirLOkfLQfLWNZAga4SsJQjYjDXs88QOzETW',
    'Canallita',
    'admin'
  ),
  (
    'u_tester',
    'tester',
    '$2b$10$qclgJ2dkBn3GEx/dEXfZa.0yfVN2e4waivdEG6Jjp0ByfGZ0LK0Na',
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
