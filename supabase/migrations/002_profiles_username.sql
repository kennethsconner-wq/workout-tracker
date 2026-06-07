-- Axios Workouts — unique usernames + availability checks (Phase 2)
-- Run after 001_initial_schema.sql

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_length check (
    char_length(username) >= 3 and char_length(username) <= 30
  )
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

alter table public.profiles enable row level security;

create policy "Users read own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Backfill profiles for existing auth users (legacy metadata-only accounts).
insert into public.profiles (id, username)
select
  u.id,
  trim(u.raw_user_meta_data->>'display_name')
from auth.users u
where
  coalesce(trim(u.raw_user_meta_data->>'display_name'), '') <> ''
  and not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_profiles_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
begin
  requested_username := trim(new.raw_user_meta_data->>'display_name');

  if requested_username is null or requested_username = '' then
    raise exception 'Username is required.';
  end if;

  insert into public.profiles (id, username)
  values (new.id, requested_username);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_email_available(requested_email text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
stable
as $$
begin
  if requested_email is null or trim(requested_email) = '' then
    return false;
  end if;

  return not exists (
    select 1
    from auth.users u
    where lower(u.email) = lower(trim(requested_email))
  );
end;
$$;

create or replace function public.is_username_available(
  requested_username text,
  exclude_user_id uuid default null
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1
    from public.profiles p
    where lower(p.username) = lower(trim(requested_username))
      and (exclude_user_id is null or p.id <> exclude_user_id)
  );
$$;

create or replace function public.update_profile_username(requested_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_username text;
begin
  normalized_username := trim(requested_username);

  if normalized_username is null or normalized_username = '' then
    raise exception 'Username is required.';
  end if;

  if not public.is_username_available(normalized_username, auth.uid()) then
    raise exception 'Username already taken' using errcode = '23505';
  end if;

  update public.profiles
  set username = normalized_username
  where id = auth.uid();

  if not found then
    insert into public.profiles (id, username)
    values (auth.uid(), normalized_username);
  end if;
end;
$$;

grant execute on function public.is_email_available(text) to anon, authenticated;
grant execute on function public.is_username_available(text, uuid) to anon, authenticated;
grant execute on function public.update_profile_username(text) to authenticated;
