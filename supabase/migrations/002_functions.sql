-- ============================================================================
-- Wavelength: Functions & Triggers
-- ============================================================================

-- ─── Auto-create profile on sign-up ─────────────────────────────────────────
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

-- ─── Sync display_name on auth user update ──────────────────────────────────
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

-- ─── Membership helper (avoids RLS recursion) ───────────────────────────────
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

-- ─── Join gig by invite code ────────────────────────────────────────────────
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

-- ─── Atomic gig creation with owner membership ─────────────────────────────
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

-- ─── Transfer ownership and leave ──────────────────────────────────────────
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

-- ─── Cleanup data when member leaves ────────────────────────────────────────
create or replace function public.cleanup_gig_member_data_on_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

-- ─── Prevent owner leaving without transfer ─────────────────────────────────
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

-- ─── Vote timestamp tracking ────────────────────────────────────────────────
create or replace function public.update_vote_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.value != 0 and old.value != new.value then
    new.voted_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_vote_updated on public.votes;
create trigger on_vote_updated
before update on public.votes
for each row execute procedure public.update_vote_timestamp();

-- ─── Activity summary (away notification) ───────────────────────────────────
create or replace function public.get_gig_activity_summary(
  target_gig_id uuid,
  caller_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  last_visit timestamptz;
  result jsonb;
begin
  select coalesce(last_visited_at, joined_at) into last_visit
  from public.gig_members
  where gig_id = target_gig_id
    and user_id = caller_id;

  if last_visit is null then
    return jsonb_build_object(
      'new_songs', 0,
      'vote_updates', jsonb_build_array(),
      'reaction_updates', jsonb_build_array(),
      'comment_updates', jsonb_build_array()
    );
  end if;

  with new_songs_count as (
    select count(*) as count
    from public.songs
    where gig_id = target_gig_id
      and created_at > last_visit
      and is_cancelled = false
      and added_by != caller_id
  ),
  vote_updates as (
    select
      s.id,
      s.title,
      count(distinct v.user_id) as vote_count
    from public.songs s
    inner join public.votes v on v.song_id = s.id
      and v.voted_at > last_visit
      and v.value != 0
      and v.user_id != caller_id
    where s.gig_id = target_gig_id
      and s.added_by = caller_id
      and s.is_cancelled = false
    group by s.id, s.title
  ),
  reaction_updates as (
    select
      s.id,
      s.title,
      count(distinct r.id) as reaction_count
    from public.songs s
    inner join public.reactions r on r.song_id = s.id
      and r.created_at > last_visit
      and r.user_id != caller_id
    where s.gig_id = target_gig_id
      and s.added_by = caller_id
      and s.is_cancelled = false
    group by s.id, s.title
  ),
  comment_updates as (
    select
      s.id,
      s.title,
      count(distinct c.id) as comment_count
    from public.songs s
    inner join public.comments c on c.song_id = s.id
      and c.created_at > last_visit
      and c.user_id != caller_id
    where s.gig_id = target_gig_id
      and s.added_by = caller_id
      and s.is_cancelled = false
    group by s.id, s.title
  )
  select jsonb_build_object(
    'new_songs', (select count from new_songs_count),
    'vote_updates', coalesce((
      select jsonb_agg(
        jsonb_build_object('song_id', id, 'title', title, 'count', vote_count)
      )
      from vote_updates
    ), jsonb_build_array()),
    'reaction_updates', coalesce((
      select jsonb_agg(
        jsonb_build_object('song_id', id, 'title', title, 'count', reaction_count)
      )
      from reaction_updates
    ), jsonb_build_array()),
    'comment_updates', coalesce((
      select jsonb_agg(
        jsonb_build_object('song_id', id, 'title', title, 'count', comment_count)
      )
      from comment_updates
    ), jsonb_build_array())
  ) into result;

  return result;
end;
$$;

-- ─── Update last_visited_at ─────────────────────────────────────────────────
create or replace function public.update_last_visited(
  target_gig_id uuid,
  caller_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.gig_members
  set last_visited_at = now()
  where gig_id = target_gig_id
    and user_id = caller_id;
end;
$$;
