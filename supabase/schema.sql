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
create or replace function roll_parchis(p_game_id uuid)
returns games language plpgsql security definer set search_path = public as $$
declare
  v_game games%rowtype;
  v_dice integer;
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

  v_dice := floor(random() * 6)::integer + 1;
  v_streak := case when v_dice = 6
    then least(3, coalesce((v_game.state->>'sixStreak')::integer, 0) + 1)
    else 0 end;
  v_game.state := jsonb_set(v_game.state, '{phase}', '"move"', false);
  v_game.state := jsonb_set(v_game.state, '{dice}', to_jsonb(v_dice), false);
  v_game.state := jsonb_set(v_game.state, '{sixStreak}', to_jsonb(v_streak), false);
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
  v_dice integer;
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

  select id into v_partner from members
    where couple_id = v_game.couple_id and id <> auth.uid()
    order by last_seen desc limit 1;
  if v_partner is null then raise exception 'pareja_no_disponible'; end if;
  v_dice := coalesce((v_game.state->>'dice')::integer, 0);
  v_streak := coalesce((v_game.state->>'sixStreak')::integer, 0);
  v_game.turn := case when v_dice = 6 and v_streak < 3 then auth.uid() else v_partner end;
  if v_game.turn <> auth.uid() then v_streak := 0; end if;

  v_game.state := jsonb_set(v_game.state, '{phase}', '"roll"', false);
  v_game.state := jsonb_set(v_game.state, '{dice}', 'null', false);
  v_game.state := jsonb_set(v_game.state, '{sixStreak}', to_jsonb(v_streak), false);
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
      'version', 'first', 'pieceCount', 'phase', 'dice', 'sixStreak',
      'bonus', 'bonusChain', 'pieces', 'last', 'seq'
    ])
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
    where position::integer < -1 or position::integer > 75
  ) or exists (
    select 1 from jsonb_array_elements_text(p_state#>array['pieces', v_rival]) position
    where position::integer < -1 or position::integer > 75
  ) then raise exception 'posicion_invalida'; end if;

  v_steps := case when v_phase = 'bonus'
    then (v_game.state->>'bonus')::integer else (v_game.state->>'dice')::integer end;
  v_from := (v_game.state#>>array['pieces', v_seat, p_piece::text])::integer;
  v_to := (p_state#>>array['pieces', v_seat, p_piece::text])::integer;
  if not ((v_from = -1 and v_steps = 5 and v_to = 0)
    or (v_from >= 0 and v_from < 75 and v_to = v_from + v_steps and v_to <= 75)) then
    raise exception 'distancia_invalida';
  end if;
  if p_state#>>'{last,seat}' is distinct from v_seat
    or (p_state#>>'{last,piece}')::integer <> p_piece
    or (p_state#>>'{last,from}')::integer <> v_from
    or (p_state#>>'{last,to}')::integer <> v_to
    or (p_state#>>'{last,steps}')::integer <> v_steps then
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
    where position::integer <> 75
  );
  v_earned_bonus := case when v_changed = 1 then 20 when v_to = 75 then 10 else 0 end;
  v_bonus_chain := coalesce((v_game.state->>'bonusChain')::integer, 0);
  v_expected_turn := case
    when v_won then null
    when v_earned_bonus > 0 and v_bonus_chain < 4 then auth.uid()
    when (v_game.state->>'dice')::integer = 6
      and (v_game.state->>'sixStreak')::integer < 3 then auth.uid()
    else v_partner end;

  if v_won then
    if p_status <> 'won' or p_winner is distinct from auth.uid()
      or p_next_turn is not null or p_state->>'phase' <> 'over'
      or (p_state->>'bonus')::integer is distinct from 0 then
      raise exception 'victoria_invalida';
    end if;
  elsif p_status <> 'active' or p_winner is not null then
    raise exception 'estado_final_invalido';
  elsif v_earned_bonus > 0 and v_bonus_chain < 4 then
    -- El cliente puede perder el bonus si no existe destino legal, pero nunca inventarlo
    -- ni transferir el turno a una tercera persona.
    if p_state->>'phase' = 'bonus' then
      if p_next_turn is distinct from auth.uid()
        or (p_state->>'bonus')::integer is distinct from v_earned_bonus
        or (p_state->>'bonusChain')::integer is distinct from v_bonus_chain + 1
        or p_state->>'dice' is distinct from v_game.state->>'dice'
        or p_state->>'sixStreak' is distinct from v_game.state->>'sixStreak' then
        raise exception 'bonus_invalido';
      end if;
    elsif p_state->>'phase' = 'roll' then
      if (p_state->>'bonus')::integer is distinct from 0
        or (p_state->>'bonusChain')::integer is distinct from 0
        or p_state->'dice' is distinct from 'null'::jsonb
        or p_next_turn is distinct from (
          case when (v_game.state->>'dice')::integer = 6
            and (v_game.state->>'sixStreak')::integer < 3 then auth.uid() else v_partner end
        )
        or (p_state->>'sixStreak')::integer is distinct from (
          case when p_next_turn = auth.uid()
            then (v_game.state->>'sixStreak')::integer else 0 end
        ) then raise exception 'cierre_bonus_invalido'; end if;
    else raise exception 'fase_siguiente_invalida';
    end if;
  else
    if p_state->>'phase' <> 'roll'
      or (p_state->>'bonus')::integer is distinct from 0
      or (p_state->>'bonusChain')::integer is distinct from 0
      or p_state->'dice' is distinct from 'null'::jsonb
      or p_next_turn is distinct from v_expected_turn
      or (p_state->>'sixStreak')::integer is distinct from (
        case when v_expected_turn = auth.uid()
          then (v_game.state->>'sixStreak')::integer else 0 end
      ) then
      raise exception 'turno_siguiente_invalido';
    end if;
  end if;

  update games set state = p_state, turn = p_next_turn, status = p_status,
    winner = p_winner, updated_at = now()
    where id = v_game.id returning * into v_game;
  return v_game;
end $$;

revoke all on function roll_parchis(uuid) from public;
revoke all on function pass_parchis(uuid, integer) from public;
revoke all on function move_parchis(uuid, integer, integer, jsonb, uuid, text, uuid) from public;
grant execute on function roll_parchis(uuid) to authenticated;
grant execute on function pass_parchis(uuid, integer) to authenticated;
grant execute on function move_parchis(uuid, integer, integer, jsonb, uuid, text, uuid) to authenticated;

create or replace function guard_parchis_direct_update()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if old.type = 'parchis'
    and current_setting('app.parchis_rpc', true) is distinct from 'on'
    and current_role not in ('postgres', 'service_role') then
    if old.status = 'active' and new.status = 'abandoned' then
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
