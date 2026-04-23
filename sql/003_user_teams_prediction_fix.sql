do $$
declare
  prediction_data_type text;
  prediction_udt_name text;
begin
  -- Si la columna entry no existe todavía, créala para poder reutilizar el JSON completo.
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'user_teams'
      and column_name = 'entry'
  ) then
    alter table user_teams add column entry jsonb;
  end if;

  -- Si prediction es JSON legacy, úsala para rellenar entry cuando falte.
  select data_type, udt_name
  into prediction_data_type, prediction_udt_name
  from information_schema.columns
  where table_schema = current_schema()
    and table_name = 'user_teams'
    and column_name = 'prediction'
  limit 1;

  if prediction_data_type in ('json', 'jsonb') or prediction_udt_name in ('json', 'jsonb') then
    update user_teams
    set entry = coalesce(entry, prediction::jsonb)
    where entry is null;
  end if;

  update user_teams
  set entry = '{}'::jsonb
  where entry is null or jsonb_typeof(entry) <> 'object';

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
