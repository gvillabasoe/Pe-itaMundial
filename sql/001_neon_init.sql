create table if not exists user_teams (
  id text primary key,
  user_id text not null,
  username text,
  team_name text,
  entry jsonb,
  locked boolean not null default true,
  source text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_teams add column if not exists user_id text;
alter table user_teams add column if not exists username text;
alter table user_teams add column if not exists team_name text;
alter table user_teams add column if not exists entry jsonb;
alter table user_teams add column if not exists locked boolean;
alter table user_teams add column if not exists source text;
alter table user_teams add column if not exists created_at timestamptz;
alter table user_teams add column if not exists updated_at timestamptz;

do $$
declare
  legacy_json_column text;
begin
  select c.column_name
  into legacy_json_column
  from information_schema.columns c
  where c.table_schema = current_schema()
    and c.table_name = 'user_teams'
    and c.column_name in ('prediction', 'data', 'payload', 'team_data', 'team', 'porra', 'content', 'json')
    and c.data_type in ('json', 'jsonb')
  order by case c.column_name
    when 'prediction' then 1
    when 'data' then 2
    when 'payload' then 3
    when 'team_data' then 4
    when 'team' then 5
    when 'porra' then 6
    when 'content' then 7
    when 'json' then 8
    else 100
  end
  limit 1;

  if legacy_json_column is not null then
    execute format(
      'update user_teams set entry = coalesce(entry, %I::jsonb) where entry is null',
      legacy_json_column
    );
  end if;
end $$;

update user_teams
set entry = jsonb_strip_nulls(
  jsonb_build_object(
    'id', id,
    'userId', user_id,
    'username', nullif(btrim(username), ''),
    'name', nullif(btrim(team_name), ''),
    'createdAt', to_char(coalesce(created_at, now()) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'locked', coalesce(locked, true),
    'source', case when source in ('user', 'demo') then source else 'user' end
  )
)
where entry is null or jsonb_typeof(entry) <> 'object';

update user_teams
set entry = '{}'::jsonb
where entry is null or jsonb_typeof(entry) <> 'object';

update user_teams
set user_id = coalesce(nullif(btrim(user_id), ''), nullif(entry->>'userId', ''), id)
where user_id is null or btrim(user_id) = '';

update user_teams
set username = coalesce(nullif(btrim(username), ''), nullif(entry->>'username', ''), nullif(btrim(user_id), ''), 'usuario')
where username is null or btrim(username) = '';

update user_teams
set team_name = coalesce(nullif(btrim(team_name), ''), nullif(entry->>'name', ''), id, 'Mi porra')
where team_name is null or btrim(team_name) = '';

update user_teams
set locked = true
where locked is null;

update user_teams
set source = case
  when source in ('user', 'demo') then source
  when entry->>'source' in ('user', 'demo') then entry->>'source'
  else 'user'
end
where source is null or btrim(source) = '' or source not in ('user', 'demo');

update user_teams
set created_at = now()
where created_at is null;

update user_teams
set updated_at = now()
where updated_at is null;

update user_teams
set entry = jsonb_set(entry, '{id}', to_jsonb(id), true)
where coalesce(entry->>'id', '') = '';

update user_teams
set entry = jsonb_set(entry, '{userId}', to_jsonb(user_id), true)
where coalesce(entry->>'userId', '') = '';

update user_teams
set entry = jsonb_set(entry, '{username}', to_jsonb(username), true)
where coalesce(entry->>'username', '') = '';

update user_teams
set entry = jsonb_set(entry, '{name}', to_jsonb(team_name), true)
where coalesce(entry->>'name', '') = '';

update user_teams
set entry = jsonb_set(
  entry,
  '{createdAt}',
  to_jsonb(to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  true
)
where coalesce(entry->>'createdAt', '') = '';

update user_teams
set entry = jsonb_set(entry, '{locked}', to_jsonb(coalesce(locked, true)), true)
where entry->'locked' is null;

update user_teams
set entry = jsonb_set(entry, '{source}', to_jsonb(source), true)
where coalesce(entry->>'source', '') = '';

alter table user_teams alter column entry set default '{}'::jsonb;
alter table user_teams alter column locked set default true;
alter table user_teams alter column source set default 'user';
alter table user_teams alter column created_at set default now();
alter table user_teams alter column updated_at set default now();

do $$
declare
  prediction_data_type text;
  prediction_udt_name text;
begin
  select data_type, udt_name
  into prediction_data_type, prediction_udt_name
  from information_schema.columns
  where table_schema = current_schema()
    and table_name = 'user_teams'
    and column_name = 'prediction'
  limit 1;

  if prediction_data_type is null then
    return;
  end if;

  if prediction_data_type in ('json', 'jsonb') or prediction_udt_name in ('json', 'jsonb') then
    execute format(
      'update user_teams set prediction = coalesce(prediction, %s, %s) where prediction is null',
      case when prediction_data_type = 'json' or prediction_udt_name = 'json' then 'entry::json' else 'entry' end,
      case when prediction_data_type = 'json' or prediction_udt_name = 'json' then '''{}''::json' else '''{}''::jsonb' end
    );

    execute format(
      'alter table user_teams alter column prediction set default %s',
      case when prediction_data_type = 'json' or prediction_udt_name = 'json' then '''{}''::json' else '''{}''::jsonb' end
    );
  elsif prediction_data_type in ('text', 'character varying', 'character') or prediction_udt_name in ('text', 'varchar', 'bpchar') then
    execute $sql$
      update user_teams
      set prediction = coalesce(nullif(btrim(prediction), ''), entry::text, '{}')
      where prediction is null or btrim(prediction) = ''
    $sql$;

    execute $$alter table user_teams alter column prediction set default '{}'$$;
  else
    execute $$alter table user_teams alter column prediction drop not null$$;
  end if;
end $$;

alter table user_teams alter column user_id set not null;
alter table user_teams alter column username set not null;
alter table user_teams alter column team_name set not null;
alter table user_teams alter column entry set not null;
alter table user_teams alter column locked set not null;
alter table user_teams alter column source set not null;
alter table user_teams alter column created_at set not null;
alter table user_teams alter column updated_at set not null;

do $$
declare
  legacy_column record;
begin
  for legacy_column in
    select column_name
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'user_teams'
      and column_name not in ('id', 'user_id', 'username', 'team_name', 'entry', 'locked', 'source', 'created_at', 'updated_at', 'prediction')
      and is_nullable = 'NO'
      and column_default is null
  loop
    execute format('alter table user_teams alter column %I drop not null', legacy_column.column_name);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_teams_source_check'
      and conrelid = 'user_teams'::regclass
  ) then
    alter table user_teams
      add constraint user_teams_source_check
      check (source in ('user', 'demo'));
  end if;
end $$;

create index if not exists idx_user_teams_user_id on user_teams (user_id);
create index if not exists idx_user_teams_created_at on user_teams (created_at desc);

create table if not exists admin_results (
  id integer primary key default 1 check (id = 1),
  data jsonb not null,
  saved_at timestamptz null,
  updated_at timestamptz not null default now()
);
