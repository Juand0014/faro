-- ============================================================
-- Faro · esquema Supabase (pegar en SQL Editor > New query > Run)
-- Diseñado para 2 personas por "pareja". Todo protegido con RLS.
-- ============================================================

-- 1) TABLAS -------------------------------------------------
create table if not exists couples (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists members (
  id         uuid primary key references auth.users(id) on delete cascade,
  couple_id  uuid not null references couples(id) on delete cascade,
  name       text not null,
  timezone   text not null default 'UTC',
  city       text,
  last_seen  timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists members_couple_idx on members(couple_id);

create table if not exists pings (
  id         bigint generated always as identity primary key,
  couple_id  uuid not null references couples(id) on delete cascade,
  from_id    uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists pings_couple_idx on pings(couple_id);

create table if not exists daily_answers (
  id         bigint generated always as identity primary key,
  couple_id  uuid not null references couples(id) on delete cascade,
  member_id  uuid not null,
  day        date not null,
  prompt     text not null,
  answer     text not null,
  created_at timestamptz not null default now(),
  unique (couple_id, member_id, day)
);

create table if not exists games (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references couples(id) on delete cascade,
  type       text not null,               -- 'ttt' | 'c4' | ...
  state      jsonb not null,
  turn       uuid,                         -- member cuyo turno es
  status     text not null default 'active', -- active | won | draw
  winner     uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists games_couple_type_idx on games(couple_id, type);
create unique index if not exists games_one_active_per_type on games (couple_id, type) where status = 'active';
alter table games replica identity full;

create table if not exists chat_messages (
  id         bigint generated always as identity primary key,
  couple_id  uuid not null references couples(id) on delete cascade,
  from_id    uuid not null,
  body       text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_couple_idx on chat_messages(couple_id, created_at);
alter table chat_messages replica identity full;

create table if not exists looks (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references couples(id) on delete cascade,
  designer_id  uuid not null,
  title        text not null default '',
  outfit       jsonb not null,
  rating       smallint,
  note         text not null default '',
  status       text not null default 'sent',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (rating is null or (rating >= 1 and rating <= 10)),
  check (status in ('sent', 'rated'))
);
create index if not exists looks_couple_idx on looks(couple_id, created_at desc);
create index if not exists looks_designer_idx on looks(designer_id);
alter table looks replica identity full;

-- 2) HELPER: mi couple_id (SECURITY DEFINER evita recursión en RLS)
create or replace function my_couple_id()
returns uuid language sql stable security definer set search_path = public as $$
  select couple_id from members where id = auth.uid()
$$;

-- 3) EMPAREJAMIENTO por código (RPC) ------------------------
create or replace function create_couple(p_name text, p_timezone text, p_city text default null)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_code text; v_couple uuid;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  -- código de 6 caracteres sin ambigüedades
  v_code := upper(substr(translate(encode(extensions.gen_random_bytes(6),'base64'),'0O1lI/+=','23456789'),1,6));
  insert into couples(code) values (v_code) returning id into v_couple;
  insert into members(id, couple_id, name, timezone, city)
    values (auth.uid(), v_couple, p_name, p_timezone, p_city)
    on conflict (id) do update set couple_id = excluded.couple_id, name = excluded.name,
      timezone = excluded.timezone, city = excluded.city;
  return v_code;
end $$;

create or replace function join_couple(p_code text, p_name text, p_timezone text, p_city text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_couple uuid;
  v_count int;
  v_old uuid;
  v_name text;
  v_code text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  v_name := trim(p_name);
  v_code := upper(trim(p_code));
  if v_name = '' then raise exception 'nombre_vacio'; end if;

  select id into v_couple from couples where code = v_code;
  if v_couple is null then raise exception 'codigo_invalido'; end if;

  if exists (select 1 from members where id = auth.uid() and couple_id = v_couple) then
    update members
      set name = v_name, timezone = p_timezone, city = p_city, last_seen = now()
      where id = auth.uid();
    return v_code;
  end if;

  -- mismo nombre = mismo asiento (cambio de celular / computadora)
  select id into v_old
    from members
    where couple_id = v_couple
      and lower(trim(name)) = lower(v_name)
      and id <> auth.uid()
    order by last_seen desc
    limit 1;

  if v_old is not null then
    update pings set from_id = auth.uid() where from_id = v_old;
    update daily_answers set member_id = auth.uid() where member_id = v_old;
    update chat_messages set from_id = auth.uid() where from_id = v_old;
    update looks set designer_id = auth.uid() where designer_id = v_old;
    update games
      set turn = case when turn = v_old then auth.uid() else turn end,
          winner = case when winner = v_old then auth.uid() else winner end,
          state = replace(coalesce(state::text, '{}'), v_old::text, auth.uid()::text)::jsonb
      where couple_id = v_couple;
    delete from push_subs where user_id = v_old;
    delete from members where id = v_old;
  else
    select count(*) into v_count from members where couple_id = v_couple and id <> auth.uid();
    if v_count >= 2 then raise exception 'pareja_llena'; end if;
  end if;

  insert into members(id, couple_id, name, timezone, city)
    values (auth.uid(), v_couple, v_name, p_timezone, p_city)
    on conflict (id) do update set couple_id = excluded.couple_id, name = excluded.name,
      timezone = excluded.timezone, city = excluded.city, last_seen = now();
  return v_code;
end $$;

-- 4) RLS ----------------------------------------------------
alter table couples       enable row level security;
alter table members       enable row level security;
alter table pings         enable row level security;
alter table daily_answers enable row level security;
alter table games         enable row level security;
alter table chat_messages enable row level security;
alter table looks         enable row level security;

-- couples: solo la mía
drop policy if exists couples_select on couples;
create policy couples_select on couples for select using (id = my_couple_id());

-- members: solo los de mi pareja; puedo actualizar mi propia fila
drop policy if exists members_select on members;
create policy members_select on members for select using (couple_id = my_couple_id());
drop policy if exists members_update on members;
create policy members_update on members for update using (id = auth.uid()) with check (id = auth.uid());

-- pings: leer los de mi pareja, insertar los míos
drop policy if exists pings_select on pings;
create policy pings_select on pings for select using (couple_id = my_couple_id());
drop policy if exists pings_insert on pings;
create policy pings_insert on pings for insert with check (couple_id = my_couple_id() and from_id = auth.uid());

-- daily_answers: solo mi pareja; inserto/actualizo lo mío
drop policy if exists answers_select on daily_answers;
create policy answers_select on daily_answers for select using (couple_id = my_couple_id());
drop policy if exists answers_insert on daily_answers;
create policy answers_insert on daily_answers for insert with check (couple_id = my_couple_id() and member_id = auth.uid());
drop policy if exists answers_update on daily_answers;
create policy answers_update on daily_answers for update using (member_id = auth.uid()) with check (member_id = auth.uid());

-- chat: leer/escribir/borrar (la limpieza nocturna) dentro de mi pareja
drop policy if exists chat_select on chat_messages;
create policy chat_select on chat_messages for select using (couple_id = my_couple_id());
drop policy if exists chat_insert on chat_messages;
create policy chat_insert on chat_messages for insert with check (couple_id = my_couple_id() and from_id = auth.uid());
drop policy if exists chat_delete on chat_messages;
create policy chat_delete on chat_messages for delete using (couple_id = my_couple_id());

drop policy if exists looks_select on looks;
create policy looks_select on looks for select using (couple_id = my_couple_id());
drop policy if exists looks_insert on looks;
create policy looks_insert on looks for insert with check (couple_id = my_couple_id() and designer_id = auth.uid());
drop policy if exists looks_update on looks;
create policy looks_update on looks for update to authenticated
  using (couple_id = my_couple_id()) with check (couple_id = my_couple_id());

-- Un look enviado es un recuerdo: el cliente solo puede escribir la puntuación.
-- join_couple es SECURITY DEFINER y conserva permiso para reasignar designer_id al cambiar de dispositivo.
alter table looks drop constraint if exists looks_outfit_size;
alter table looks add constraint looks_outfit_size
  check (octet_length(outfit::text) <= 65536);

revoke update on looks from anon, authenticated;
grant update (rating, note, status) on looks to authenticated;

create or replace function guard_look_update()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  -- join_couple corre como postgres por SECURITY DEFINER. service_role queda como
  -- escape explícito para migraciones; authenticated no puede elevar current_role.
  if current_role in ('postgres', 'service_role') then return new; end if;

  if new.designer_id is distinct from old.designer_id
    or new.couple_id is distinct from old.couple_id
    or new.title is distinct from old.title
    or new.outfit is distinct from old.outfit
    or new.created_at is distinct from old.created_at then
    raise exception 'look_inmutable';
  end if;
  if auth.uid() = old.designer_id then raise exception 'no_autopuntuas'; end if;
  if old.status <> 'sent' or new.status <> 'rated' or new.rating is null then
    raise exception 'puntuacion_invalida';
  end if;
  new.note := left(coalesce(new.note, ''), 200);
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists guard_look_update_trigger on looks;
create trigger guard_look_update_trigger before update on looks
for each row execute function guard_look_update();

-- games: leer/crear/actualizar dentro de mi pareja
drop policy if exists games_select on games;
create policy games_select on games for select using (couple_id = my_couple_id());
drop policy if exists games_insert on games;
create policy games_insert on games for insert with check (couple_id = my_couple_id());
drop policy if exists games_update on games;
create policy games_update on games for update using (couple_id = my_couple_id()) with check (couple_id = my_couple_id());

-- push: cada dispositivo guarda su suscripción
create table if not exists push_subs (
  endpoint   text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  couple_id  uuid not null references couples(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
alter table push_subs enable row level security;
drop policy if exists push_own on push_subs;
create policy push_own on push_subs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 5) REALTIME ----------------------------------------------
alter publication supabase_realtime add table pings;
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table daily_answers;
alter publication supabase_realtime add table members;
alter publication supabase_realtime add table chat_messages;
alter publication supabase_realtime add table looks;

-- 6) SOPA DE LETRAS ----------------------------------------
-- Reclamo atómico: bloquea la partida para que una palabra solo pueda pertenecer
-- a quien llegue primero, incluso si ambos la marcan casi al mismo tiempo.
create or replace function claim_word_search_word(p_game_id uuid, p_word text)
returns games language plpgsql security definer set search_path = public as $$
declare
  v_game games%rowtype;
  v_word text;
  v_found jsonb;
  v_players uuid[];
  v_scores bigint[];
  v_claimed integer;
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  v_word := regexp_replace(upper(trim(p_word)), '[^A-ZÑ]', '', 'g');

  select * into v_game
    from games
    where id = p_game_id and couple_id = my_couple_id() and type = 'wordsearch'
    for update;
  if not found then raise exception 'partida_invalida'; end if;
  if v_game.status <> 'active' then return v_game; end if;
  if not exists (
    select 1 from jsonb_array_elements_text(v_game.state->'words') as target
    where target = v_word
  ) then raise exception 'palabra_invalida'; end if;

  v_found := coalesce(v_game.state->'found', '{}'::jsonb);
  if v_found ? v_word then return v_game; end if;
  v_found := jsonb_set(v_found, array[v_word], to_jsonb(auth.uid()::text), true);
  v_game.state := jsonb_set(v_game.state, '{found}', v_found, true);

  select count(*) into v_claimed from jsonb_object_keys(v_found);
  if v_claimed = jsonb_array_length(v_game.state->'words') then
    select array_agg(player order by score desc), array_agg(score order by score desc)
      into v_players, v_scores
      from (
        select value::uuid as player, count(*) as score
        from jsonb_each_text(v_found)
        group by value
      ) totals;
    if cardinality(v_scores) = 1 or v_scores[1] > v_scores[2] then
      v_game.status := 'won';
      v_game.winner := v_players[1];
    else
      v_game.status := 'draw';
      v_game.winner := null;
    end if;
  end if;

  update games set state = v_game.state, status = v_game.status,
    winner = v_game.winner, updated_at = now()
    where id = v_game.id
    returning * into v_game;
  return v_game;
end $$;

revoke all on function claim_word_search_word(uuid, text) from public;
grant execute on function claim_word_search_word(uuid, text) to authenticated;

-- 7) PARCHÍS ------------------------------------------------
-- El servidor es la fuente del dado y serializa cada acción con FOR UPDATE.
create or replace function parchis_has_legal_move(p_state jsonb, p_seat text)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  v_rival text := case when p_seat = 'a' then 'b' else 'a' end;
  v_start integer := case when p_seat = 'a' then 5 else 39 end;
  v_rival_start integer := case when p_seat = 'a' then 39 else 5 end;
  v_remaining jsonb := coalesce(p_state->'remaining', '[]'::jsonb);
  v_steps integer;
  v_piece integer;
  v_from integer;
  v_to integer;
  v_cell integer;
  v_mine integer;
  v_enemy integer;
  v_exit boolean;
begin
  if p_seat not in ('a', 'b') or p_state->>'phase' not in ('move', 'bonus') then return false; end if;
  v_exit := p_state->>'phase' = 'move' and (
    exists (
      select 1 from jsonb_array_elements_text(v_remaining) die(value)
      where value::integer = 5
    ) or (jsonb_array_length(v_remaining) = 2
      and (v_remaining->>0)::integer + (v_remaining->>1)::integer = 5)
  );
  if v_exit and exists (
    select 1 from jsonb_array_elements_text(p_state#>array['pieces', p_seat]) position
    where position::integer = -1
  ) then
    select count(*) into v_mine
      from jsonb_array_elements_text(p_state#>array['pieces', p_seat]) position
      where position::integer between 0 and 63
        and ((v_start - 1 + position::integer) % 68) + 1 = v_start;
    select count(*) into v_enemy
      from jsonb_array_elements_text(p_state#>array['pieces', v_rival]) position
      where position::integer between 0 and 63
        and (((case when v_rival = 'a' then 5 else 39 end) - 1 + position::integer) % 68) + 1 = v_start;
    if v_mine < 2 and v_enemy < 2 then return true; end if;
  end if;

  for v_steps in
    select distinct value::integer
    from (
      select value from jsonb_array_elements_text(v_remaining) die(value)
      where p_state->>'phase' = 'move'
      union all
      select p_state->>'bonus' where p_state->>'phase' = 'bonus'
    ) options
    where value is not null and value::integer > 0
  loop
    for v_piece, v_from in
      select (ordinal - 1)::integer, position::integer
      from jsonb_array_elements_text(p_state#>array['pieces', p_seat])
        with ordinality piece(position, ordinal)
    loop
      if v_from < 0 or v_from >= 71 or v_from + v_steps > 71 then continue; end if;
      v_to := v_from + v_steps;
      if exists (
        select 1 from generate_series(v_from + 1, least(v_to, 63)) route(position)
        where exists (
          select 1
          from (
            select 'a'::text seat, value::integer position
              from jsonb_array_elements_text(p_state#>'{pieces,a}') value
            union all
            select 'b'::text seat, value::integer position
              from jsonb_array_elements_text(p_state#>'{pieces,b}') value
          ) occupied
          where occupied.position between 0 and 63
            and (((case when occupied.seat = 'a' then 5 else 39 end) - 1 + occupied.position) % 68) + 1
              = ((v_start - 1 + route.position) % 68) + 1
          group by occupied.seat having count(*) >= 2
        )
      ) then continue; end if;

      if v_to between 64 and 70 and exists (
        select 1 from jsonb_array_elements_text(p_state#>array['pieces', p_seat]) position
        where position::integer = v_to
      ) then continue; end if;
      if v_to <= 63 then
        v_cell := ((v_start - 1 + v_to) % 68) + 1;
        select count(*) into v_mine
          from jsonb_array_elements_text(p_state#>array['pieces', p_seat])
            with ordinality piece(position, ordinal)
          where ordinal - 1 <> v_piece and position::integer between 0 and 63
            and ((v_start - 1 + position::integer) % 68) + 1 = v_cell;
        select count(*) into v_enemy
          from jsonb_array_elements_text(p_state#>array['pieces', v_rival]) position
          where position::integer between 0 and 63
            and (((case when v_rival = 'a' then 5 else 39 end) - 1 + position::integer) % 68) + 1 = v_cell;
        if v_mine >= 2 or v_enemy >= 2
          or (v_mine = 1 and v_cell = v_rival_start)
          or (v_enemy = 1 and v_cell = any(array[5,12,17,22,29,34,39,46,51,56,63,68])) then
          continue;
        end if;
      end if;
      return true;
    end loop;
  end loop;
  return false;
end $$;

create or replace function roll_parchis(p_game_id uuid)
returns games language plpgsql security definer set search_path = public as $$
declare
  v_game games%rowtype;
  v_dice_a integer;
  v_dice_b integer;
  v_streak integer;
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  perform set_config('app.parchis_rpc', 'on', true);
  select * into v_game from games
    where id = p_game_id and couple_id = my_couple_id() and type = 'parchis'
    for update;
  if not found then raise exception 'partida_invalida'; end if;
  if v_game.status <> 'active' or v_game.turn is distinct from auth.uid()
    or v_game.state->>'phase' <> 'roll' then
    raise exception 'turno_invalido';
  end if;

  v_dice_a := floor(random() * 6)::integer + 1;
  v_dice_b := floor(random() * 6)::integer + 1;
  v_streak := case when v_dice_a = v_dice_b
    then least(3, coalesce((v_game.state->>'doublesStreak')::integer, 0) + 1)
    else 0 end;
  v_game.state := jsonb_set(v_game.state, '{version}', '2', true);
  v_game.state := jsonb_set(v_game.state, '{phase}', '"move"', false);
  v_game.state := jsonb_set(v_game.state, '{dice}', jsonb_build_array(v_dice_a, v_dice_b), false);
  v_game.state := jsonb_set(v_game.state, '{remaining}', jsonb_build_array(v_dice_a, v_dice_b), true);
  v_game.state := jsonb_set(v_game.state, '{doublesStreak}', to_jsonb(v_streak), true);
  v_game.state := v_game.state - 'sixStreak';
  v_game.state := jsonb_set(v_game.state, '{bonus}', '0', false);
  v_game.state := jsonb_set(v_game.state, '{bonusChain}', '0', false);
  v_game.state := jsonb_set(
    v_game.state, '{seq}', to_jsonb(coalesce((v_game.state->>'seq')::integer, 0) + 1), false
  );

  update games set state = v_game.state, updated_at = now()
    where id = v_game.id returning * into v_game;
  return v_game;
end $$;

create or replace function pass_parchis(p_game_id uuid, p_expected_seq integer)
returns games language plpgsql security definer set search_path = public as $$
declare
  v_game games%rowtype;
  v_partner uuid;
  v_streak integer;
  v_dice_a integer;
  v_dice_b integer;
  v_seat text;
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  perform set_config('app.parchis_rpc', 'on', true);
  select * into v_game from games
    where id = p_game_id and couple_id = my_couple_id() and type = 'parchis'
    for update;
  if not found then raise exception 'partida_invalida'; end if;
  if v_game.status <> 'active' or v_game.turn is distinct from auth.uid()
    or v_game.state->>'phase' <> 'move'
    or coalesce((v_game.state->>'seq')::integer, -1) <> p_expected_seq then
    raise exception 'estado_desactualizado';
  end if;
  v_seat := case when v_game.state->>'first' = auth.uid()::text then 'a' else 'b' end;
  if parchis_has_legal_move(v_game.state, v_seat) then
    raise exception 'movimientos_disponibles';
  end if;

  select id into v_partner from members
    where couple_id = v_game.couple_id and id <> auth.uid()
    order by last_seen desc limit 1;
  if v_partner is null then raise exception 'pareja_no_disponible'; end if;
  v_dice_a := coalesce((v_game.state#>>'{dice,0}')::integer, 0);
  v_dice_b := coalesce((v_game.state#>>'{dice,1}')::integer, 0);
  v_streak := coalesce((v_game.state->>'doublesStreak')::integer, 0);
  v_game.turn := case when v_dice_a = v_dice_b and v_dice_a > 0 and v_streak < 3
    then auth.uid() else v_partner end;
  if v_game.turn <> auth.uid() then v_streak := 0; end if;

  v_game.state := jsonb_set(v_game.state, '{phase}', '"roll"', false);
  v_game.state := jsonb_set(v_game.state, '{dice}', 'null', false);
  v_game.state := jsonb_set(v_game.state, '{remaining}', '[]', false);
  v_game.state := jsonb_set(v_game.state, '{doublesStreak}', to_jsonb(v_streak), false);
  v_game.state := jsonb_set(v_game.state, '{bonus}', '0', false);
  v_game.state := jsonb_set(v_game.state, '{bonusChain}', '0', false);
  v_game.state := jsonb_set(v_game.state, '{seq}', to_jsonb(p_expected_seq + 1), false);
  update games set state = v_game.state, turn = v_game.turn, updated_at = now()
    where id = v_game.id returning * into v_game;
  return v_game;
end $$;

create or replace function move_parchis(
  p_game_id uuid,
  p_expected_seq integer,
  p_piece integer,
  p_steps integer,
  p_state jsonb,
  p_next_turn uuid,
  p_status text,
  p_winner uuid default null
)
returns games language plpgsql security definer set search_path = public as $$
declare
  v_game games%rowtype;
  v_seat text;
  v_rival text;
  v_phase text;
  v_steps integer;
  v_from integer;
  v_to integer;
  v_piece_count integer;
  v_changed integer;
  v_partner uuid;
  v_expected_turn uuid;
  v_earned_bonus integer;
  v_bonus_chain integer;
  v_won boolean;
  v_remaining jsonb;
  v_expected_remaining jsonb;
  v_use_ordinal bigint;
  v_dice_a integer;
  v_dice_b integer;
  v_expected_consume jsonb;
  v_home_count integer;
  v_start_cell integer;
  v_start_own integer;
  v_start_enemy integer;
  v_exit_available boolean;
  v_dest_cell integer;
  v_dest_mine integer;
  v_dest_enemy integer;
  v_expected_capture integer;
  v_bonus_probe jsonb;
  v_bonus_possible boolean;
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  perform set_config('app.parchis_rpc', 'on', true);
  select * into v_game from games
    where id = p_game_id and couple_id = my_couple_id() and type = 'parchis'
    for update;
  if not found then raise exception 'partida_invalida'; end if;
  if v_game.status <> 'active' or v_game.turn is distinct from auth.uid()
    or coalesce((v_game.state->>'seq')::integer, -1) <> p_expected_seq then
    raise exception 'estado_desactualizado';
  end if;
  v_phase := v_game.state->>'phase';
  if v_phase not in ('move', 'bonus') then raise exception 'fase_invalida'; end if;
  if p_status not in ('active', 'won') then raise exception 'estado_final_invalido'; end if;

  v_seat := case when v_game.state->>'first' = auth.uid()::text then 'a' else 'b' end;
  v_rival := case when v_seat = 'a' then 'b' else 'a' end;
  v_piece_count := (v_game.state->>'pieceCount')::integer;
  if not (p_state ?& array[
      'version', 'first', 'pieceCount', 'phase', 'dice', 'remaining', 'doublesStreak',
      'bonus', 'bonusChain', 'pieces', 'last', 'seq'
    ])
    or (p_state->>'version')::integer is distinct from 2
    or v_piece_count not in (2, 3, 4)
    or p_state#>array['pieces', v_seat] is null
    or p_state#>array['pieces', v_rival] is null
    or p_piece < 0 or p_piece >= v_piece_count
    or jsonb_array_length(p_state#>array['pieces', v_seat]) <> v_piece_count
    or jsonb_array_length(p_state#>array['pieces', v_rival]) <> v_piece_count
    or p_state->>'first' is distinct from v_game.state->>'first'
    or p_state->>'pieceCount' is distinct from v_game.state->>'pieceCount'
    or (p_state->>'seq')::integer is distinct from p_expected_seq + 1 then
    raise exception 'movimiento_invalido';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(p_state#>array['pieces', v_seat]) position
    where position::integer < -1 or position::integer > 71
  ) or exists (
    select 1 from jsonb_array_elements_text(p_state#>array['pieces', v_rival]) position
    where position::integer < -1 or position::integer > 71
  ) then raise exception 'posicion_invalida'; end if;

  v_remaining := coalesce(v_game.state->'remaining', '[]'::jsonb);
  v_exit_available := v_phase = 'move' and (
    exists (
      select 1 from jsonb_array_elements_text(v_remaining) die(value)
      where value::integer = 5
    )
    or (jsonb_array_length(v_remaining) = 2
      and (v_remaining->>0)::integer + (v_remaining->>1)::integer = 5)
  );
  v_steps := p_steps;
  if v_steps is null or v_steps < 1 or v_steps > 20 then
    raise exception 'distancia_invalida';
  end if;
  if v_phase = 'bonus' then
    if v_steps is distinct from (v_game.state->>'bonus')::integer then
      raise exception 'bonus_invalido';
    end if;
    v_expected_remaining := v_remaining;
    v_expected_consume := '[]'::jsonb;
  else
    select ordinal into v_use_ordinal
      from jsonb_array_elements_text(v_remaining) with ordinality die(value, ordinal)
      where value::integer = v_steps order by ordinal limit 1;
    if v_use_ordinal is not null then
      select coalesce(jsonb_agg(value order by ordinal), '[]'::jsonb)
        into v_expected_remaining
        from jsonb_array_elements(v_remaining) with ordinality die(value, ordinal)
        where ordinal <> v_use_ordinal;
      v_expected_consume := jsonb_build_array(v_steps);
    elsif v_steps = 5 and jsonb_array_length(v_remaining) = 2
      and (v_remaining->>0)::integer + (v_remaining->>1)::integer = 5 then
      v_expected_remaining := '[]'::jsonb;
      v_expected_consume := v_remaining;
    else
      raise exception 'dado_no_disponible';
    end if;
  end if;
  v_from := (v_game.state#>>array['pieces', v_seat, p_piece::text])::integer;
  v_to := (p_state#>>array['pieces', v_seat, p_piece::text])::integer;
  if v_exit_available then
    v_start_cell := case when v_seat = 'a' then 5 else 39 end;
    select count(*) into v_home_count
      from jsonb_array_elements_text(v_game.state#>array['pieces', v_seat]) position
      where position::integer = -1;
    select count(*) into v_start_own
      from jsonb_array_elements_text(v_game.state#>array['pieces', v_seat]) position
      where position::integer between 0 and 63
        and (((case when v_seat = 'a' then 5 else 39 end) - 1 + position::integer) % 68) + 1 = v_start_cell;
    select count(*) into v_start_enemy
      from jsonb_array_elements_text(v_game.state#>array['pieces', v_rival]) position
      where position::integer between 0 and 63
        and (((case when v_rival = 'a' then 5 else 39 end) - 1 + position::integer) % 68) + 1 = v_start_cell;
    if v_home_count > 0 and v_start_own < 2 and v_start_enemy < 2 and v_from <> -1 then
      raise exception 'salida_obligatoria';
    end if;
  end if;
  if not ((v_from = -1 and v_steps = 5 and v_to = 0)
    or (v_from >= 0 and v_from < 71 and v_to = v_from + v_steps and v_to <= 71)) then
    raise exception 'distancia_invalida';
  end if;
  if v_from >= 0 and exists (
    select 1
    from generate_series(v_from + 1, least(v_to, 63)) route(position)
    where exists (
      select 1
      from (
        select 'a'::text seat, value::integer position
          from jsonb_array_elements_text(v_game.state#>'{pieces,a}') value
        union all
        select 'b'::text seat, value::integer position
          from jsonb_array_elements_text(v_game.state#>'{pieces,b}') value
      ) piece
      where piece.position between 0 and 63
        and (((case when piece.seat = 'a' then 5 else 39 end) - 1 + piece.position) % 68) + 1
          = (((case when v_seat = 'a' then 5 else 39 end) - 1 + route.position) % 68) + 1
      group by piece.seat
      having count(*) >= 2
    )
  ) then raise exception 'puente_bloqueado'; end if;

  v_expected_capture := null;
  if v_to between 0 and 63 then
    v_dest_cell := (((case when v_seat = 'a' then 5 else 39 end) - 1 + v_to) % 68) + 1;
    select count(*) into v_dest_mine
      from jsonb_array_elements_text(v_game.state#>array['pieces', v_seat])
        with ordinality piece(position, ordinal)
      where ordinal - 1 <> p_piece and position::integer between 0 and 63
        and (((case when v_seat = 'a' then 5 else 39 end) - 1 + position::integer) % 68) + 1 = v_dest_cell;
    select count(*), min((ordinal - 1)::integer) into v_dest_enemy, v_expected_capture
      from jsonb_array_elements_text(v_game.state#>array['pieces', v_rival])
        with ordinality piece(position, ordinal)
      where position::integer between 0 and 63
        and (((case when v_rival = 'a' then 5 else 39 end) - 1 + position::integer) % 68) + 1 = v_dest_cell;
    if v_dest_mine >= 2 or v_dest_enemy >= 2 then raise exception 'destino_bloqueado'; end if;
    if v_dest_mine = 1 and v_dest_cell = (case when v_rival = 'a' then 5 else 39 end) then
      raise exception 'puente_en_salida_rival';
    end if;
    if v_dest_enemy = 1 and v_dest_cell = any(array[5,12,17,22,29,34,39,46,51,56,63,68])
      and not (v_from = -1 and v_dest_cell = v_start_cell) then
      raise exception 'seguro_ocupado';
    end if;
    if v_dest_enemy = 0 then v_expected_capture := null; end if;
  elsif v_to < 71 and exists (
    select 1 from jsonb_array_elements_text(v_game.state#>array['pieces', v_seat]) position
    where position::integer = v_to
  ) then raise exception 'pasillo_ocupado'; end if;
  if p_state#>>'{last,seat}' is distinct from v_seat
    or (p_state#>>'{last,piece}')::integer <> p_piece
    or (p_state#>>'{last,from}')::integer <> v_from
    or (p_state#>>'{last,to}')::integer <> v_to
    or (p_state#>>'{last,steps}')::integer <> v_steps
    or p_state#>'{last,consume}' is distinct from v_expected_consume
    or p_state#>'{last,capture}' is distinct from coalesce(to_jsonb(v_expected_capture), 'null'::jsonb)
    or p_state->'remaining' is distinct from v_expected_remaining then
    raise exception 'resumen_movimiento_invalido';
  end if;

  select count(*) into v_changed
    from generate_series(0, v_piece_count - 1) index
    where index <> p_piece
      and v_game.state#>>array['pieces', v_seat, index::text]
        is distinct from p_state#>>array['pieces', v_seat, index::text];
  if v_changed <> 0 then raise exception 'fichas_propias_invalidas'; end if;

  select count(*) into v_changed
    from generate_series(0, v_piece_count - 1) index
    where v_game.state#>>array['pieces', v_rival, index::text]
      is distinct from p_state#>>array['pieces', v_rival, index::text];
  if v_changed > 1 then raise exception 'captura_invalida'; end if;
  if (v_expected_capture is null and v_changed <> 0)
    or (v_expected_capture is not null and (
      v_changed <> 1
      or (p_state#>>array['pieces', v_rival, v_expected_capture::text])::integer <> -1
    )) then raise exception 'captura_invalida'; end if;
  if v_changed = 1 and exists (
    select 1 from generate_series(0, v_piece_count - 1) index
    where v_game.state#>>array['pieces', v_rival, index::text]
      is distinct from p_state#>>array['pieces', v_rival, index::text]
      and (p_state#>>array['pieces', v_rival, index::text])::integer <> -1
  ) then raise exception 'captura_invalida'; end if;

  select id into v_partner from members
    where couple_id = v_game.couple_id and id <> auth.uid()
    order by last_seen desc limit 1;
  if v_partner is null then raise exception 'pareja_no_disponible'; end if;
  v_won := not exists (
    select 1 from jsonb_array_elements_text(p_state#>array['pieces', v_seat]) position
    where position::integer <> 71
  );
  v_earned_bonus := case when v_changed = 1 then 20 when v_to = 71 then 10 else 0 end;
  if (p_state#>>'{last,bonus}')::integer is distinct from v_earned_bonus then
    raise exception 'resumen_bonus_invalido';
  end if;
  v_bonus_chain := coalesce((v_game.state->>'bonusChain')::integer, 0);
  v_bonus_probe := jsonb_set(
    jsonb_set(p_state, '{phase}', '"bonus"', true),
    '{bonus}', to_jsonb(v_earned_bonus), true
  );
  v_bonus_possible := v_earned_bonus > 0
    and v_bonus_chain < 4
    and parchis_has_legal_move(v_bonus_probe, v_seat);
  v_dice_a := coalesce((v_game.state#>>'{dice,0}')::integer, 0);
  v_dice_b := coalesce((v_game.state#>>'{dice,1}')::integer, 0);
  v_expected_turn := case
    when v_won then null
    when v_earned_bonus > 0 and v_bonus_chain < 4 then auth.uid()
    when jsonb_array_length(v_expected_remaining) > 0 then auth.uid()
    when v_dice_a = v_dice_b and v_dice_a > 0
      and (v_game.state->>'doublesStreak')::integer < 3 then auth.uid()
    else v_partner end;

  if v_won then
    if p_status <> 'won' or p_winner is distinct from auth.uid()
      or p_next_turn is not null or p_state->>'phase' <> 'over'
      or (p_state->>'bonus')::integer is distinct from 0
      or p_state->'dice' is distinct from 'null'::jsonb
      or p_state->'remaining' is distinct from '[]'::jsonb
      or (p_state->>'doublesStreak')::integer is distinct from 0 then
      raise exception 'victoria_invalida';
    end if;
  elsif p_status <> 'active' or p_winner is not null then
    raise exception 'estado_final_invalido';
  elsif v_earned_bonus > 0 and v_bonus_chain < 4 then
    -- El cliente puede perder el bonus si no existe destino legal, pero nunca inventarlo
    -- ni transferir el turno a una tercera persona.
    if p_state->>'phase' = 'bonus' then
      if not v_bonus_possible then raise exception 'bonus_sin_destino'; end if;
      if p_next_turn is distinct from auth.uid()
        or (p_state->>'bonus')::integer is distinct from v_earned_bonus
        or (p_state->>'bonusChain')::integer is distinct from v_bonus_chain + 1
        or p_state->>'dice' is distinct from v_game.state->>'dice'
        or p_state->'remaining' is distinct from v_expected_remaining
        or p_state->>'doublesStreak' is distinct from v_game.state->>'doublesStreak' then
        raise exception 'bonus_invalido';
      end if;
    elsif not v_bonus_possible and p_state->>'phase' = 'move'
      and jsonb_array_length(v_expected_remaining) > 0 then
      if p_next_turn is distinct from auth.uid()
        or (p_state->>'bonus')::integer is distinct from 0
        or (p_state->>'bonusChain')::integer is distinct from v_bonus_chain + 1
        or p_state->'dice' is distinct from v_game.state->'dice'
        or p_state->'remaining' is distinct from v_expected_remaining
        or p_state->>'doublesStreak' is distinct from v_game.state->>'doublesStreak' then
        raise exception 'cierre_bonus_invalido';
      end if;
    elsif not v_bonus_possible and p_state->>'phase' = 'roll' then
      if (p_state->>'bonus')::integer is distinct from 0
        or (p_state->>'bonusChain')::integer is distinct from 0
        or p_state->'dice' is distinct from 'null'::jsonb
        or p_state->'remaining' is distinct from '[]'::jsonb
        or p_next_turn is distinct from (
          case when v_dice_a = v_dice_b and v_dice_a > 0
            and (v_game.state->>'doublesStreak')::integer < 3 then auth.uid() else v_partner end
        )
        or (p_state->>'doublesStreak')::integer is distinct from (
          case when p_next_turn = auth.uid()
            then (v_game.state->>'doublesStreak')::integer else 0 end
        ) then raise exception 'cierre_bonus_invalido'; end if;
    else raise exception 'fase_siguiente_invalida';
    end if;
  else
    if (jsonb_array_length(v_expected_remaining) > 0 and (
        p_state->>'phase' <> 'move'
        or p_state->'dice' is distinct from v_game.state->'dice'
        or p_state->'remaining' is distinct from v_expected_remaining
        or p_next_turn is distinct from auth.uid()
        or p_state->>'doublesStreak' is distinct from v_game.state->>'doublesStreak'
      )) or (jsonb_array_length(v_expected_remaining) = 0 and (
        p_state->>'phase' <> 'roll'
        or p_state->'dice' is distinct from 'null'::jsonb
        or p_state->'remaining' is distinct from '[]'::jsonb
        or p_next_turn is distinct from v_expected_turn
        or (p_state->>'doublesStreak')::integer is distinct from (
          case when v_expected_turn = auth.uid()
            then (v_game.state->>'doublesStreak')::integer else 0 end
        )
      ))
      or (p_state->>'bonus')::integer is distinct from 0
      or (p_state->>'bonusChain')::integer is distinct from 0
      then
      raise exception 'turno_siguiente_invalido';
    end if;
  end if;

  p_state := jsonb_build_object(
    'version', p_state->'version',
    'first', p_state->'first',
    'pieceCount', p_state->'pieceCount',
    'phase', p_state->'phase',
    'dice', p_state->'dice',
    'remaining', p_state->'remaining',
    'doublesStreak', p_state->'doublesStreak',
    'bonus', p_state->'bonus',
    'bonusChain', p_state->'bonusChain',
    'pieces', p_state->'pieces',
    'last', p_state->'last',
    'seq', p_state->'seq'
  );
  update games set state = p_state, turn = p_next_turn, status = p_status,
    winner = p_winner, updated_at = now()
    where id = v_game.id returning * into v_game;
  return v_game;
end $$;

revoke all on function parchis_has_legal_move(jsonb, text) from public;
revoke all on function roll_parchis(uuid) from public;
revoke all on function pass_parchis(uuid, integer) from public;
drop function if exists move_parchis(uuid, integer, integer, jsonb, uuid, text, uuid);
revoke all on function move_parchis(uuid, integer, integer, integer, jsonb, uuid, text, uuid) from public;
grant execute on function roll_parchis(uuid) to authenticated;
grant execute on function pass_parchis(uuid, integer) to authenticated;
grant execute on function move_parchis(uuid, integer, integer, integer, jsonb, uuid, text, uuid) to authenticated;

create or replace function guard_parchis_direct_update()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if old.type = 'parchis'
    and current_setting('app.parchis_rpc', true) is distinct from 'on'
    and current_role not in ('postgres', 'service_role') then
    if old.status = 'active' and new.status = 'abandoned'
      and new.type is not distinct from old.type
      and new.couple_id is not distinct from old.couple_id
      and new.turn is not distinct from old.turn
      and new.winner is not distinct from old.winner
      and new.state->>'stoppedBy' = auth.uid()::text
      and (new.state - 'stoppedBy') = (old.state - 'rematch') then
      return new;
    end if;
    if old.status <> 'active' and new.status = old.status
      and new.turn is not distinct from old.turn
      and new.winner is not distinct from old.winner
      and (new.state - 'rematch') = (old.state - 'rematch') then
      return new;
    end if;
    raise exception 'usa_rpc_parchis';
  end if;
  return new;
end $$;

drop trigger if exists guard_parchis_direct_update_trigger on games;
create trigger guard_parchis_direct_update_trigger
before update on games for each row execute function guard_parchis_direct_update();

-- 8) DOMINÓ -------------------------------------------------
-- Las manos y el pozo viven fuera de `games`, cuya fila se publica por Realtime.
create table if not exists domino_private (
  game_id     uuid primary key references games(id) on delete cascade,
  state       jsonb not null,
  updated_at  timestamptz not null default now()
);
alter table domino_private enable row level security;
revoke all on table domino_private from public, anon, authenticated;
grant select, insert, update, delete on table domino_private to service_role;

-- Único punto de escritura del motor. El FOR UPDATE serializa la comprobación de
-- seq y ambas escrituras pertenecen a la misma transacción PostgreSQL.
create or replace function domino_commit(
  p_game_id uuid,
  p_expected_seq integer,
  p_public_state jsonb,
  p_private_state jsonb,
  p_next_turn uuid,
  p_status text
)
returns games language plpgsql security invoker set search_path = public as $$
declare
  v_game games%rowtype;
  v_has_private boolean;
begin
  if current_role <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_expected_seq is null or p_expected_seq < 0 then raise exception 'seq_invalido'; end if;
  if p_status not in ('active', 'won') then raise exception 'estado_invalido'; end if;
  if p_public_state is null
    or p_public_state::text ~* '"(hands|hand|boneyard|private|private_state|privateState|secret|token|password|deck|tiles)"[[:space:]]*:'
    or not (p_public_state ?& array[
      'version', 'first', 'phase', 'config', 'confirmations', 'seats', 'scores',
      'roundNo', 'turnSeat', 'opener', 'board', 'ends', 'handCounts',
      'boneyardCount', 'passes', 'result', 'roundPips', 'winnerTeam', 'seq', 'lastEvents'
    ])
    or (p_public_state - array[
      'version', 'first', 'phase', 'config', 'confirmations', 'seats', 'scores',
      'roundNo', 'turnSeat', 'opener', 'board', 'ends', 'handCounts',
      'boneyardCount', 'passes', 'result', 'roundPips', 'winnerTeam', 'seq', 'lastEvents'
    ]) <> '{}'::jsonb then
    raise exception 'estado_publico_inseguro';
  end if;
  if coalesce(p_public_state->>'seq', '') !~ '^[0-9]+$'
    or (p_public_state->>'seq')::integer <= p_expected_seq then
    raise exception 'seq_publico_invalido';
  end if;

  perform set_config('app.domino_rpc', 'on', true);
  select * into v_game from games where id = p_game_id and type = 'domino' for update;
  if not found then raise exception 'partida_invalida'; end if;
  if v_game.status <> 'active'
    or coalesce((v_game.state->>'seq')::integer, -1) <> p_expected_seq then
    raise exception 'estado_desactualizado';
  end if;
  if p_public_state->>'phase' not in ('lobby', 'play', 'between', 'over')
    or p_public_state->>'version' <> '1'
    or not exists (
      select 1 from members
      where id::text = p_public_state->>'first' and couple_id = v_game.couple_id
    )
    or (p_status = 'won') is distinct from (p_public_state->>'phase' = 'over')
    or (p_status = 'won') is distinct from (p_public_state->'winnerTeam' <> 'null'::jsonb)
  then
    raise exception 'estado_publico_invalido';
  end if;
  if p_next_turn is not null and not exists (
    select 1 from members where id = p_next_turn and couple_id = v_game.couple_id
  ) then
    raise exception 'turno_fuera_de_pareja';
  end if;

  select exists(select 1 from domino_private where game_id = p_game_id) into v_has_private;
  if p_private_state is null then
    if v_has_private then raise exception 'estado_privado_requerido'; end if;
  else
    if coalesce((p_private_state->>'seq')::integer, -1)
      <> coalesce((p_public_state->>'seq')::integer, -2) then
      raise exception 'seq_privado_invalido';
    end if;
    insert into domino_private(game_id, state, updated_at)
      values (p_game_id, p_private_state, now())
      on conflict (game_id) do update set state = excluded.state, updated_at = excluded.updated_at;
  end if;

  p_public_state := jsonb_build_object(
    'version', p_public_state->'version',
    'first', p_public_state->'first',
    'phase', p_public_state->'phase',
    'config', p_public_state->'config',
    'confirmations', p_public_state->'confirmations',
    'seats', p_public_state->'seats',
    'scores', p_public_state->'scores',
    'roundNo', p_public_state->'roundNo',
    'turnSeat', p_public_state->'turnSeat',
    'opener', p_public_state->'opener',
    'board', p_public_state->'board',
    'ends', p_public_state->'ends',
    'handCounts', p_public_state->'handCounts',
    'boneyardCount', p_public_state->'boneyardCount',
    'passes', p_public_state->'passes',
    'result', p_public_state->'result',
    'roundPips', p_public_state->'roundPips',
    'winnerTeam', p_public_state->'winnerTeam',
    'seq', p_public_state->'seq',
    'lastEvents', p_public_state->'lastEvents'
  );
  update games set state = p_public_state, turn = p_next_turn, status = p_status,
    winner = null, updated_at = now()
    where id = p_game_id returning * into v_game;
  return v_game;
end $$;

revoke all on function domino_commit(uuid, integer, jsonb, jsonb, uuid, text) from public, anon, authenticated;
grant execute on function domino_commit(uuid, integer, jsonb, jsonb, uuid, text) to service_role;

-- Nunca se permite introducir secretos en una fila pública, ni saltarse el motor
-- durante una partida. Se conservan las formas actuales de detener y pedir revancha.
create or replace function guard_domino_update()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (old.type = 'domino' or new.type = 'domino')
    and (new.type is distinct from old.type or new.couple_id is distinct from old.couple_id) then
    raise exception 'domino_identidad_inmutable';
  end if;

  if new.type = 'domino' and (
    new.state is null
    or new.state::text ~* '"(hands|hand|boneyard|private|private_state|privateState|secret|token|password|deck|tiles)"[[:space:]]*:'
    or new.state ? 'round'
  ) then
    raise exception 'estado_publico_inseguro';
  end if;

  if tg_op = 'INSERT' and new.type = 'domino' and (
    new.status <> 'active'
    or new.turn is not null
    or new.winner is not null
    or not (new.state ?& array[
      'version', 'first', 'phase', 'config', 'confirmations', 'seats', 'scores',
      'roundNo', 'turnSeat', 'opener', 'board', 'ends', 'handCounts',
      'boneyardCount', 'passes', 'result', 'roundPips', 'winnerTeam', 'seq', 'lastEvents'
    ])
    or (new.state - array[
      'version', 'first', 'phase', 'config', 'confirmations', 'seats', 'scores',
      'roundNo', 'turnSeat', 'opener', 'board', 'ends', 'handCounts',
      'boneyardCount', 'passes', 'result', 'roundPips', 'winnerTeam', 'seq', 'lastEvents'
    ]) <> '{}'::jsonb
    or new.state->>'phase' <> 'lobby'
    or new.state->>'version' <> '1'
    or not exists (
      select 1 from members
      where id::text = new.state->>'first' and couple_id = new.couple_id
    )
    or jsonb_typeof(new.state->'config') <> 'object'
    or new.state#>>'{config,mode}' not in ('duel', 'partners')
    or new.state#>>'{config,blockedRule}' not in ('general', 'patio')
    or (
      new.state#>>'{config,mode}' = 'partners'
      and coalesce(new.state#>>'{config,handSize}', '') !~ '^[1-7]$'
    )
    or (
      new.state#>>'{config,mode}' = 'duel'
      and coalesce(new.state#>>'{config,handSize}', '') !~ '^([1-9]|1[0-4])$'
    )
    or coalesce(new.state#>>'{config,target}', '') !~ '^[1-9][0-9]*$'
    or coalesce(new.state#>>'{config,capicuaBonus}', '') !~ '^[0-9]+$'
    or jsonb_typeof(new.state#>'{config,drawFromBoneyard}') <> 'boolean'
    or (
      (new.state#>>'{config,mode}' = 'partners' and new.state#>>'{config,handSize}' = '7')
      or (new.state#>>'{config,mode}' = 'duel' and new.state#>>'{config,handSize}' = '14')
    ) and new.state#>>'{config,drawFromBoneyard}' = 'true'
    or new.state->'confirmations' <> '[]'::jsonb
    or new.state->'seats' <> '[]'::jsonb
    or new.state->'scores' <> '[0,0]'::jsonb
    or new.state->'board' <> '[]'::jsonb
    or new.state->'handCounts' is distinct from (
      case when new.state#>>'{config,mode}' = 'partners'
        then '[0,0,0,0]'::jsonb else '[0,0]'::jsonb end
    )
    or new.state->'lastEvents' <> '[]'::jsonb
    or new.state->'ends' <> 'null'::jsonb
    or new.state->'turnSeat' <> 'null'::jsonb
    or new.state->'opener' <> 'null'::jsonb
    or new.state->'result' <> 'null'::jsonb
    or new.state->'roundPips' <> 'null'::jsonb
    or new.state->'winnerTeam' <> 'null'::jsonb
    or new.state->>'seq' <> '0'
    or new.state->>'roundNo' <> '0'
    or new.state->>'boneyardCount' <> '0'
    or new.state->>'passes' <> '0'
  ) then
    raise exception 'lobby_domino_invalido';
  end if;

  if tg_op = 'UPDATE' and old.type = 'domino'
    and current_setting('app.domino_rpc', true) is distinct from 'on'
    and current_role not in ('postgres', 'service_role') then
    if old.status = 'active' and new.status = 'abandoned'
      and new.type is not distinct from old.type
      and new.couple_id is not distinct from old.couple_id
      and new.turn is not distinct from old.turn
      and new.winner is not distinct from old.winner
      and new.state->>'stoppedBy' = auth.uid()::text
      and (new.state - 'stoppedBy') = (old.state - 'rematch') then
      return new;
    end if;
    if old.status <> 'active' and new.status = old.status
      and new.turn is not distinct from old.turn
      and new.winner is not distinct from old.winner
      and (new.state - 'rematch') = (old.state - 'rematch') then
      return new;
    end if;
    raise exception 'usa_funcion_domino';
  end if;
  return new;
end $$;

drop trigger if exists guard_domino_update_trigger on games;
create trigger guard_domino_update_trigger
before insert or update on games for each row execute function guard_domino_update();
