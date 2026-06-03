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

-- Drop all existing RLS policies so this file is safe to re-run
do $$ declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','gigs','gig_members','songs','votes','reactions','comments','user_notifications')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- RLS: users can read all profiles (needed for displaying member names)
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

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
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.gigs
      where gigs.id = gig_members.gig_id
        and gigs.status = 'open'
    )
  );

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
  );

create policy "Owners can delete gigs"
  on public.gigs for delete
  to authenticated
  using (
    owner_id = auth.uid()
    and not exists (
      select 1
      from public.gig_members
      where gig_members.gig_id = gigs.id
        and gig_members.user_id <> auth.uid()
    )
  );

-- Secure invite-based join workflow without exposing all gigs to authenticated users.
create or replace function public.join_gig_by_invite(invite_code_input text)
returns public.gigs
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  normalized_code char(6);
  target_gig public.gigs;
begin
  if caller_id is null then
    raise exception 'Not authenticated.';
  end if;

  normalized_code := upper(btrim(invite_code_input));
  if normalized_code is null or length(normalized_code) <> 6 then
    raise exception 'Invalid invite code.';
  end if;

  select *
  into target_gig
  from public.gigs
  where invite_code = normalized_code;

  if target_gig.id is null then
    raise exception 'Invalid invite code.';
  end if;

  if target_gig.status <> 'open' then
    raise exception 'Voting is closed for this gig. Please contact the owner to reopen it.';
  end if;

  if exists (
    select 1
    from public.gig_members
    where gig_id = target_gig.id
      and user_id = caller_id
  ) then
    raise exception 'You are already a member of this gig.';
  end if;

  insert into public.gig_members (gig_id, user_id, role)
  values (target_gig.id, caller_id, 'member');

  return target_gig;
end;
$$;

revoke all on function public.join_gig_by_invite(text) from public;
grant execute on function public.join_gig_by_invite(text) to authenticated;

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
  setlist_order int,
  song_key      text,
  notes         text,
  is_cancelled  boolean not null default false,
  voice_memo_url text,
  duration_ms  int,
  created_at   timestamptz default now() not null
);

-- Prevent duplicate songs in the same gig.
-- Uses provider IDs when available so near-identical titles do not collide.
create unique index if not exists songs_unique_spotify_per_gig
  on public.songs (gig_id, spotify_id)
  where spotify_id is not null;

create unique index if not exists songs_unique_youtube_per_gig
  on public.songs (gig_id, youtube_id)
  where youtube_id is not null;

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

create policy "Gig members can update song setlist fields"
  on public.songs for update
  to authenticated
  using (
    exists (
      select 1 from public.gig_members
      where gig_members.gig_id = songs.gig_id
        and gig_members.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.gig_members
      where gig_members.gig_id = songs.gig_id
        and gig_members.user_id = auth.uid()
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

create policy "Gig members can vote excluding own songs"
  on public.votes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.songs
      join public.gig_members on gig_members.gig_id = songs.gig_id
      where songs.id = votes.song_id
        and gig_members.user_id = auth.uid()
        and songs.added_by <> auth.uid()
    )
  );

create policy "Users can update their own votes excluding own songs"
  on public.votes for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.songs
      where songs.id = votes.song_id
        and songs.added_by <> auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.songs
      where songs.id = votes.song_id
        and songs.added_by <> auth.uid()
    )
  );

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
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
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

create policy "Users can update their own comments"
  on public.comments for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own comments"
  on public.comments for delete
  to authenticated
  using (user_id = auth.uid());

-- =========================================
-- REALTIME: enable for relevant tables
-- =========================================
do $$ begin
  begin alter publication supabase_realtime add table public.songs;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.votes;     exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.reactions;  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.comments;   exception when duplicate_object then null; end;
end $$;

-- =========================================
-- MEMBER LEAVE + OWNER TRANSFER WORKFLOW
-- =========================================

-- Cleanup side effects when a member leaves a gig.
create or replace function public.cleanup_gig_member_data_on_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Remove departing member interactions on songs in this gig.
  delete from public.votes
  where user_id = old.user_id
    and song_id in (
      select id from public.songs where gig_id = old.gig_id
    );

  delete from public.reactions
  where user_id = old.user_id
    and song_id in (
      select id from public.songs where gig_id = old.gig_id
    );

  delete from public.comments
  where user_id = old.user_id
    and song_id in (
      select id from public.songs where gig_id = old.gig_id
    );

  -- Remove songs added by departing member in this gig.
  -- Cascades remove votes/reactions/comments on those songs.
  delete from public.songs
  where gig_id = old.gig_id
    and added_by = old.user_id;

  return old;
end;
$$;

drop trigger if exists on_gig_member_left_cleanup on public.gig_members;
create trigger on_gig_member_left_cleanup
after delete on public.gig_members
for each row execute procedure public.cleanup_gig_member_data_on_leave();

-- Prevent direct owner leave without transfer.
create or replace function public.prevent_owner_leave_without_transfer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.gigs
    where id = old.gig_id
      and owner_id = old.user_id
  ) then
    raise exception 'Owner must transfer ownership before leaving this gig.';
  end if;

  return old;
end;
$$;

drop trigger if exists on_owner_leave_guard on public.gig_members;
create trigger on_owner_leave_guard
before delete on public.gig_members
for each row execute procedure public.prevent_owner_leave_without_transfer();

-- =========================================
-- USER NOTIFICATIONS (LEADER ASSIGNED)
-- =========================================

-- Atomic gig creation workflow for reliability on slower networks.
create or replace function public.create_gig_with_owner_membership(
  gig_name text,
  gig_description text,
  gig_invite_code char(6)
)
returns public.gigs
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  created_gig public.gigs;
begin
  if caller_id is null then
    raise exception 'Not authenticated.';
  end if;

  if gig_name is null or btrim(gig_name) = '' then
    raise exception 'Gig name is required.';
  end if;

  if gig_invite_code is null or length(gig_invite_code) <> 6 then
    raise exception 'Invite code must be 6 characters.';
  end if;

  insert into public.gigs (name, description, owner_id, invite_code)
  values (btrim(gig_name), nullif(btrim(gig_description), ''), caller_id, upper(gig_invite_code))
  returning * into created_gig;

  insert into public.gig_members (gig_id, user_id, role)
  values (created_gig.id, caller_id, 'owner');

  return created_gig;
end;
$$;

revoke all on function public.create_gig_with_owner_membership(text, text, char) from public;
grant execute on function public.create_gig_with_owner_membership(text, text, char) to authenticated;

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gig_id uuid references public.gigs(id) on delete cascade,
  type text not null check (type in ('leader_assigned')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.user_notifications enable row level security;

create policy "Users can view their own notifications"
  on public.user_notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can update their own notifications"
  on public.user_notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Owner-only transfer-and-leave workflow.
-- Also creates a one-time leader-assigned notification for the new owner.
create or replace function public.transfer_gig_ownership_and_leave(target_gig_id uuid, new_owner_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Not authenticated.';
  end if;

  if target_gig_id is null or new_owner_user_id is null then
    raise exception 'Gig and new owner are required.';
  end if;

  if caller_id = new_owner_user_id then
    raise exception 'Select a different member as the new owner.';
  end if;

  if not exists (
    select 1
    from public.gigs
    where id = target_gig_id
      and owner_id = caller_id
  ) then
    raise exception 'Only the current owner can transfer ownership.';
  end if;

  if not exists (
    select 1
    from public.gig_members
    where gig_id = target_gig_id
      and user_id = new_owner_user_id
  ) then
    raise exception 'New owner must already be a member of this gig.';
  end if;

  update public.gigs
  set owner_id = new_owner_user_id
  where id = target_gig_id;

  update public.gig_members
  set role = 'owner'
  where gig_id = target_gig_id
    and user_id = new_owner_user_id;

  insert into public.user_notifications (user_id, gig_id, type, payload)
  values (
    new_owner_user_id,
    target_gig_id,
    'leader_assigned',
    jsonb_build_object('assigned_by', caller_id)
  );

  delete from public.gig_members
  where gig_id = target_gig_id
    and user_id = caller_id;
end;
$$;

revoke all on function public.transfer_gig_ownership_and_leave(uuid, uuid) from public;
grant execute on function public.transfer_gig_ownership_and_leave(uuid, uuid) to authenticated;

-- =========================================
-- STORAGE (avatars + voice memos)
-- =========================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('voice-memos', 'voice-memos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Authenticated users can read avatar objects" on storage.objects;
create policy "Authenticated users can read avatar objects"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Gig members can read voice memos" on storage.objects;
create policy "Gig members can read voice memos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'voice-memos'
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    and exists (
      select 1
      from public.gig_members
      where gig_members.gig_id = ((storage.foldername(name))[1])::uuid
        and gig_members.user_id = auth.uid()
    )
  );

drop policy if exists "Gig members can upload voice memos" on storage.objects;
create policy "Gig members can upload voice memos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'voice-memos'
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    and exists (
      select 1
      from public.gig_members
      where gig_members.gig_id = ((storage.foldername(name))[1])::uuid
        and gig_members.user_id = auth.uid()
    )
  );

drop policy if exists "Gig members can update voice memos" on storage.objects;
create policy "Gig members can update voice memos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'voice-memos'
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    and exists (
      select 1
      from public.gig_members
      where gig_members.gig_id = ((storage.foldername(name))[1])::uuid
        and gig_members.user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'voice-memos'
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    and exists (
      select 1
      from public.gig_members
      where gig_members.gig_id = ((storage.foldername(name))[1])::uuid
        and gig_members.user_id = auth.uid()
    )
  );

drop policy if exists "Gig members can delete voice memos" on storage.objects;
create policy "Gig members can delete voice memos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'voice-memos'
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    and exists (
      select 1
      from public.gig_members
      where gig_members.gig_id = ((storage.foldername(name))[1])::uuid
        and gig_members.user_id = auth.uid()
    )
  );
