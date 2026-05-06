-- ============================================================
-- Migration 003: users table
-- ============================================================
-- Creates the users table used by normal login and admin login.
--
-- No passwords or generated password hashes are committed here. To create
-- initial users, generate scrypt hashes outside the repo and insert them in
-- your private database console or deployment migration system.
--
-- Hash format expected by the app:
--   scrypt$<N>$<r>$<p>$<salt_b64>$<hash_b64>
-- ============================================================

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

-- Private seed template, for local use only:
--
-- insert into users (id, username, password_hash, display_name, role)
-- values
--   ('u_admin', 'admin', '<GENERATED_SCRYPT_HASH>', 'Admin', 'admin'),
--   ('u_user', 'tester', '<GENERATED_SCRYPT_HASH>', 'Tester', 'user')
-- on conflict (username) do update
--   set password_hash = excluded.password_hash,
--       display_name  = excluded.display_name,
--       role          = excluded.role,
--       updated_at    = now();
