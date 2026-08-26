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
declare v_couple uuid; v_count int;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select id into v_couple from couples where code = upper(p_code);
  if v_couple is null then raise exception 'codigo_invalido'; end if;
  select count(*) into v_count from members where couple_id = v_couple and id <> auth.uid();
  if v_count >= 2 then raise exception 'pareja_llena'; end if;
  insert into members(id, couple_id, name, timezone, city)
    values (auth.uid(), v_couple, p_name, p_timezone, p_city)
    on conflict (id) do update set couple_id = excluded.couple_id, name = excluded.name,
      timezone = excluded.timezone, city = excluded.city;
  return upper(p_code);
end $$;

-- 4) RLS ----------------------------------------------------
alter table couples       enable row level security;
alter table members       enable row level security;
alter table pings         enable row level security;
alter table daily_answers enable row level security;
alter table games         enable row level security;

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

-- games: leer/crear/actualizar dentro de mi pareja
drop policy if exists games_select on games;
create policy games_select on games for select using (couple_id = my_couple_id());
drop policy if exists games_insert on games;
create policy games_insert on games for insert with check (couple_id = my_couple_id());
drop policy if exists games_update on games;
create policy games_update on games for update using (couple_id = my_couple_id()) with check (couple_id = my_couple_id());

-- 5) REALTIME ----------------------------------------------
alter publication supabase_realtime add table pings;
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table daily_answers;
alter publication supabase_realtime add table members;
