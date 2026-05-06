alter table user_teams add column if not exists username text;
alter table user_teams add column if not exists team_name text;
alter table user_teams add column if not exists entry jsonb;
alter table user_teams add column if not exists locked boolean not null default true;
alter table user_teams add column if not exists source text not null default 'user';
alter table user_teams add column if not exists created_at timestamptz not null default now();
alter table user_teams add column if not exists updated_at timestamptz not null default now();
alter table user_teams alter column entry set default '{}'::jsonb;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'user_teams'
      and column_name = 'data'
  ) then
    execute $sql$
      update user_teams
      set entry = coalesce(
        entry,
        data::jsonb,
        jsonb_build_object(
          'id', id,
          'userId', user_id,
          'username', coalesce(username, ''),
          'name', coalesce(team_name, '')
        )
      )
      where entry is null
    $sql$;

    execute $sql$
      update user_teams
      set
        username = coalesce(nullif(username, ''), nullif(entry->>'username', ''), nullif(data->>'username', '')),
        team_name = coalesce(nullif(team_name, ''), nullif(entry->>'name', ''), nullif(data->>'name', '')),
        locked = coalesce(locked, true),
        source = coalesce(nullif(source, ''), 'user'),
        created_at = coalesce(created_at, now()),
        updated_at = coalesce(updated_at, now())
      where
        username is null or username = ''
        or team_name is null or team_name = ''
        or locked is null
        or source is null or source = ''
        or created_at is null
        or updated_at is null
    $sql$;
  else
    execute $sql$
      update user_teams
      set entry = coalesce(
        entry,
        jsonb_build_object(
          'id', id,
          'userId', user_id,
          'username', coalesce(username, ''),
          'name', coalesce(team_name, '')
        )
      )
      where entry is null
    $sql$;

    execute $sql$
      update user_teams
      set
        username = coalesce(nullif(username, ''), nullif(entry->>'username', '')),
        team_name = coalesce(nullif(team_name, ''), nullif(entry->>'name', '')),
        locked = coalesce(locked, true),
        source = coalesce(nullif(source, ''), 'user'),
        created_at = coalesce(created_at, now()),
        updated_at = coalesce(updated_at, now())
      where
        username is null or username = ''
        or team_name is null or team_name = ''
        or locked is null
        or source is null or source = ''
        or created_at is null
        or updated_at is null
    $sql$;
  end if;
end $$;

create index if not exists idx_user_teams_user_id on user_teams (user_id);
create index if not exists idx_user_teams_created_at on user_teams (created_at desc);
