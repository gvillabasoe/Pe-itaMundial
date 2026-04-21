create table if not exists user_teams (
  id text primary key,
  user_id text not null,
  username text not null,
  team_name text not null,
  entry jsonb not null,
  locked boolean not null default true,
  source text not null default 'user' check (source in ('user', 'demo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_teams_user_id on user_teams (user_id);
create index if not exists idx_user_teams_created_at on user_teams (created_at desc);

create table if not exists admin_results (
  id integer primary key default 1 check (id = 1),
  data jsonb not null,
  saved_at timestamptz null,
  updated_at timestamptz not null default now()
);
