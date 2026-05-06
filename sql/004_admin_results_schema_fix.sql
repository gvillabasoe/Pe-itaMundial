create table if not exists admin_results (
  id integer primary key default 1 check (id = 1),
  data jsonb not null,
  saved_at timestamptz null,
  updated_at timestamptz not null default now()
);

alter table admin_results add column if not exists data jsonb;
alter table admin_results add column if not exists saved_at timestamptz;
alter table admin_results add column if not exists updated_at timestamptz;

do $$
declare
  legacy_payload_column text;
begin
  select column_name
  into legacy_payload_column
  from information_schema.columns
  where table_schema = current_schema()
    and table_name = 'admin_results'
    and column_name in ('payload', 'result', 'results', 'admin_data', 'json', 'content', 'body', 'value')
    and (data_type in ('json', 'jsonb') or udt_name in ('json', 'jsonb'))
  order by array_position(array['payload', 'result', 'results', 'admin_data', 'json', 'content', 'body', 'value'], column_name)
  limit 1;

  if legacy_payload_column is not null then
    execute format(
      'update admin_results set data = coalesce(data, %I::jsonb) where data is null',
      legacy_payload_column
    );
  end if;
end $$;

do $$
declare
  has_match_results boolean;
  has_group_positions boolean;
  has_knockout_rounds boolean;
  has_podium boolean;
  has_special_results boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'admin_results'
      and column_name = 'match_results'
  ) into has_match_results;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'admin_results'
      and column_name = 'group_positions'
  ) into has_group_positions;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'admin_results'
      and column_name = 'knockout_rounds'
  ) into has_knockout_rounds;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'admin_results'
      and column_name = 'podium'
  ) into has_podium;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'admin_results'
      and column_name = 'special_results'
  ) into has_special_results;

  if has_match_results or has_group_positions or has_knockout_rounds or has_podium or has_special_results then
    execute format(
      $sql$
      update admin_results
      set data = jsonb_strip_nulls(
        jsonb_build_object(
          'version', 2,
          'configured', false,
          'savedAt', coalesce(
            nullif(data->>'savedAt', ''),
            case
              when saved_at is not null then to_char(saved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
              else null
            end
          ),
          'matchResults', %s,
          'groupPositions', %s,
          'knockoutRounds', %s,
          'podium', %s,
          'specialResults', %s
        )
      )
      where data is null
        or jsonb_typeof(data) <> 'object'
        or not (data ? 'matchResults')
        or not (data ? 'groupPositions')
        or not (data ? 'knockoutRounds')
        or not (data ? 'podium')
        or not (data ? 'specialResults')
      $sql$,
      case when has_match_results then 'coalesce(data->''matchResults'', match_results, ''{}''::jsonb)' else 'coalesce(data->''matchResults'', ''{}''::jsonb)' end,
      case when has_group_positions then 'coalesce(data->''groupPositions'', group_positions, ''{}''::jsonb)' else 'coalesce(data->''groupPositions'', ''{}''::jsonb)' end,
      case when has_knockout_rounds then 'coalesce(data->''knockoutRounds'', knockout_rounds, ''{}''::jsonb)' else 'coalesce(data->''knockoutRounds'', ''{}''::jsonb)' end,
      case when has_podium then 'coalesce(data->''podium'', podium, ''{}''::jsonb)' else 'coalesce(data->''podium'', ''{}''::jsonb)' end,
      case when has_special_results then 'coalesce(data->''specialResults'', special_results, ''{}''::jsonb)' else 'coalesce(data->''specialResults'', ''{}''::jsonb)' end
    );
  end if;
end $$;

update admin_results
set data = '{}'::jsonb
where data is null or jsonb_typeof(data) <> 'object';

update admin_results
set updated_at = now()
where updated_at is null;

alter table admin_results alter column data set default '{}'::jsonb;
alter table admin_results alter column updated_at set default now();
alter table admin_results alter column data set not null;
alter table admin_results alter column updated_at set not null;

do $$
declare
  legacy_column record;
begin
  for legacy_column in
    select column_name
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'admin_results'
      and column_name not in ('id', 'data', 'saved_at', 'updated_at')
      and is_nullable = 'NO'
      and column_default is null
  loop
    begin
      execute format('alter table admin_results alter column %I drop not null', legacy_column.column_name);
    exception when others then
      null;
    end;
  end loop;
end $$;
