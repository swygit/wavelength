-- Wavelength Database Schema
-- Run this migration in your Supabase SQL Editor

-- =========================================
-- PROFILES
-- =========================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Keep profiles.display_name synchronized with auth.users metadata updates
create or replace function public.handle_auth_user_updated()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
  set display_name = new.raw_user_meta_data->>'display_name',
      updated_at = now()
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of raw_user_meta_data on auth.users
  for each row execute procedure public.handle_auth_user_updated();

-- RLS: users can read all profiles (needed for displaying member names)
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- =========================================
-- GIGS
-- =========================================
create table if not exists public.gigs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  invite_code char(6) not null unique,
  status      text not null default 'open' check (status in ('open', 'closed')),
  created_at  timestamptz default now() not null
);

alter table public.gigs enable row level security;

-- RLS
create policy "Authenticated users can create gigs"
  on public.gigs for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can update gigs"
  on public.gigs for update
  to authenticated
  using (owner_id = auth.uid());

create policy "Owners can delete gigs"
  on public.gigs for delete
  to authenticated
  using (owner_id = auth.uid());

-- =========================================
-- GIG MEMBERS
-- =========================================
create table if not exists public.gig_members (
  id       uuid primary key default gen_random_uuid(),
  gig_id   uuid not null references public.gigs(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  role     text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz default now() not null,
  unique(gig_id, user_id)
);

alter table public.gig_members enable row level security;

-- Helper to check membership without triggering RLS recursion on gig_members
create or replace function public.is_gig_member(target_gig_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.gig_members
    where gig_id = target_gig_id
      and user_id = auth.uid()
  );
$$;

create policy "Members can view all members of their gigs"
  on public.gig_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_gig_member(gig_members.gig_id)
  );

create policy "Authenticated users can join gigs"
  on public.gig_members for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Members can leave gigs"
  on public.gig_members for delete
  to authenticated
  using (user_id = auth.uid());

-- Now that public.gig_members exists, create gigs select policy
create policy "Gig members can view their gigs"
  on public.gigs for select
  to authenticated
  using (
    exists (
      select 1 from public.gig_members
      where gig_members.gig_id = gigs.id
        and gig_members.user_id = auth.uid()
    )
    or invite_code is not null  -- allow lookup by invite_code to join
  );

-- =========================================
-- SONGS
-- =========================================
create table if not exists public.songs (
  id           uuid primary key default gen_random_uuid(),
  gig_id       uuid not null references public.gigs(id) on delete cascade,
  added_by     uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  artist       text,
  album        text,
  album_art    text,
  preview_url  text,
  external_url text,
  source       text not null check (source in ('spotify', 'youtube', 'manual')),
  spotify_id   text,
  youtube_id   text,
  duration_ms  int,
  created_at   timestamptz default now() not null
);

alter table public.songs enable row level security;

create policy "Gig members can view songs"
  on public.songs for select
  to authenticated
  using (
    exists (
      select 1 from public.gig_members
      where gig_members.gig_id = songs.gig_id
        and gig_members.user_id = auth.uid()
    )
  );

create policy "Gig members can add songs"
  on public.songs for insert
  to authenticated
  with check (
    added_by = auth.uid()
    and exists (
      select 1 from public.gig_members
      where gig_members.gig_id = songs.gig_id
        and gig_members.user_id = auth.uid()
    )
  );

create policy "Song adder or gig owner can remove songs"
  on public.songs for delete
  to authenticated
  using (
    added_by = auth.uid()
    or exists (
      select 1 from public.gigs
      where gigs.id = songs.gig_id and gigs.owner_id = auth.uid()
    )
  );

-- =========================================
-- VOTES
-- =========================================
create table if not exists public.votes (
  id       uuid primary key default gen_random_uuid(),
  song_id  uuid not null references public.songs(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  value    smallint not null check (value in (-1, 0, 1)),
  created_at timestamptz default now() not null,
  unique(song_id, user_id)
);

alter table public.votes enable row level security;

create policy "Gig members can view votes"
  on public.votes for select
  to authenticated
  using (
    exists (
      select 1 from public.songs
      join public.gig_members on gig_members.gig_id = songs.gig_id
      where songs.id = votes.song_id
        and gig_members.user_id = auth.uid()
    )
  );

create policy "Gig members can vote"
  on public.votes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.songs
      join public.gig_members on gig_members.gig_id = songs.gig_id
      where songs.id = votes.song_id
        and gig_members.user_id = auth.uid()
    )
  );

create policy "Users can update their own votes"
  on public.votes for update
  to authenticated
  using (user_id = auth.uid());

create policy "Users can remove their own votes"
  on public.votes for delete
  to authenticated
  using (user_id = auth.uid());

-- =========================================
-- REACTIONS
-- =========================================
create table if not exists public.reactions (
  id       uuid primary key default gen_random_uuid(),
  song_id  uuid not null references public.songs(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  emoji    text not null,
  created_at timestamptz default now() not null,
  unique(song_id, user_id, emoji)
);

alter table public.reactions enable row level security;

create policy "Gig members can view reactions"
  on public.reactions for select
  to authenticated
  using (
    exists (
      select 1 from public.songs
      join public.gig_members on gig_members.gig_id = songs.gig_id
      where songs.id = reactions.song_id
        and gig_members.user_id = auth.uid()
    )
  );

create policy "Gig members can add reactions"
  on public.reactions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.songs
      join public.gig_members on gig_members.gig_id = songs.gig_id
      where songs.id = reactions.song_id
        and gig_members.user_id = auth.uid()
    )
  );

create policy "Users can remove their own reactions"
  on public.reactions for delete
  to authenticated
  using (user_id = auth.uid());

-- =========================================
-- COMMENTS
-- =========================================
create table if not exists public.comments (
  id       uuid primary key default gen_random_uuid(),
  song_id  uuid not null references public.songs(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  body     text not null,
  created_at timestamptz default now() not null
);

alter table public.comments enable row level security;

create policy "Gig members can view comments"
  on public.comments for select
  to authenticated
  using (
    exists (
      select 1 from public.songs
      join public.gig_members on gig_members.gig_id = songs.gig_id
      where songs.id = comments.song_id
        and gig_members.user_id = auth.uid()
    )
  );

create policy "Gig members can add comments"
  on public.comments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.songs
      join public.gig_members on gig_members.gig_id = songs.gig_id
      where songs.id = comments.song_id
        and gig_members.user_id = auth.uid()
    )
  );

create policy "Users can delete their own comments"
  on public.comments for delete
  to authenticated
  using (user_id = auth.uid());

-- =========================================
-- REALTIME: enable for relevant tables
-- =========================================
alter publication supabase_realtime add table public.songs;
alter publication supabase_realtime add table public.votes;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.comments;
