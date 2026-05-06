-- ============================================================
-- Migración 002: Asegurar columnas y constraints en user_teams
-- ============================================================
-- Idempotente: se puede ejecutar múltiples veces sin efecto
-- secundario. Soluciona el error de columna `username` faltante
-- y refuerza integridad de datos.
--
-- Cómo aplicar:
--   1. Entra en Neon → SQL Editor
--   2. Pega este script entero
--   3. Pulsa Run
-- ============================================================

-- ── 1. Asegurar columnas en user_teams ────────────────────
alter table if exists user_teams
  add column if not exists username  text        not null default '',
  add column if not exists team_name text        not null default '',
  add column if not exists locked    boolean     not null default true,
  add column if not exists source    text        not null default 'user';

-- ── 2. Índices recomendados ───────────────────────────────
create index if not exists idx_user_teams_user_id    on user_teams (user_id);
create index if not exists idx_user_teams_created_at on user_teams (created_at desc);
create index if not exists idx_user_teams_username   on user_teams (username);

-- ── 3. Asegurar tabla admin_results ───────────────────────
create table if not exists admin_results (
  id          integer primary key,
  data        jsonb       not null,
  saved_at    timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── 4. Verificación rápida ────────────────────────────────
-- Ejecuta esto después para confirmar que todo está bien:
--
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_name = 'user_teams'
--   order by ordinal_position;
--
-- Deberías ver: id, user_id, username, team_name, entry,
-- locked, source, created_at, updated_at.
