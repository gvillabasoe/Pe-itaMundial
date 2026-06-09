-- ============================================================
-- Migración 005: Etiqueta + estado activo/baja en `users`
-- ============================================================
-- Idempotente y aditiva: no modifica ni borra datos existentes.
-- Todos los usuarios actuales quedan con active = true.
--
-- Cómo aplicar:
--   1. Entra en Neon -> SQL Editor
--   2. Pega este script entero
--   3. Pulsa Run
-- ============================================================

-- label: etiqueta de texto libre opcional (NULL = sin etiqueta).
alter table users add column if not exists label text;

-- active: si es false, el usuario está dado de baja y no puede iniciar sesión.
alter table users add column if not exists active boolean not null default true;

-- Índice para filtrar rápido por estado en el panel admin.
create index if not exists idx_users_active on users (active);

-- ── Verificación ──────────────────────────────────────────
--   select id, username, role, label, active
--   from users
--   order by created_at;
