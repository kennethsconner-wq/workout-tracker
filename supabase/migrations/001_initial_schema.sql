-- Axios Workouts — initial cloud schema (Phase 0)
-- Run in Supabase Dashboard → SQL Editor, or via Supabase CLI.

-- Workout templates
create table if not exists public.workouts (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  data jsonb not null,
  primary key (id, user_id)
);

create index if not exists workouts_user_updated_idx
  on public.workouts (user_id, updated_at desc)
  where deleted_at is null;

-- Logged workout sessions
create table if not exists public.logged_workouts (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  data jsonb not null,
  primary key (id, user_id)
);

create index if not exists logged_workouts_user_updated_idx
  on public.logged_workouts (user_id, updated_at desc)
  where deleted_at is null;

-- Exercise library catalog
create table if not exists public.exercise_library (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  data jsonb not null,
  primary key (id, user_id)
);

create index if not exists exercise_library_user_updated_idx
  on public.exercise_library (user_id, updated_at desc)
  where deleted_at is null;

-- Row Level Security
alter table public.workouts enable row level security;
alter table public.logged_workouts enable row level security;
alter table public.exercise_library enable row level security;

create policy "Users manage own workouts"
  on public.workouts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own logged workouts"
  on public.logged_workouts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own exercise library"
  on public.exercise_library
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at on row changes
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workouts_set_updated_at on public.workouts;
create trigger workouts_set_updated_at
  before update on public.workouts
  for each row execute function public.set_updated_at();

drop trigger if exists logged_workouts_set_updated_at on public.logged_workouts;
create trigger logged_workouts_set_updated_at
  before update on public.logged_workouts
  for each row execute function public.set_updated_at();

drop trigger if exists exercise_library_set_updated_at on public.exercise_library;
create trigger exercise_library_set_updated_at
  before update on public.exercise_library
  for each row execute function public.set_updated_at();
