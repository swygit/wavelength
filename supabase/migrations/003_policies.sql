-- ============================================================================
-- Wavelength: Row Level Security Policies
-- ============================================================================

-- Drop all existing RLS policies so this file is safe to re-run
do $$ declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles','gigs','gig_members','songs','votes',
        'reactions','comments','user_notifications','folders',
        'folder_gigs','gig_roles','arrangement_sections','arrangement_entries',
        'setlist_sections'
      )
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- ─── Profiles ────────────────────────────────────────────────────────────────
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

-- ─── Gigs ────────────────────────────────────────────────────────────────────
create policy "Authenticated users can create gigs"
  on public.gigs for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can update gigs"
  on public.gigs for update
  to authenticated
  using (owner_id = auth.uid());

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

-- ─── Gig Members ────────────────────────────────────────────────────────────
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

-- ─── Songs ───────────────────────────────────────────────────────────────────
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

-- ─── Votes ───────────────────────────────────────────────────────────────────
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

-- ─── Reactions ───────────────────────────────────────────────────────────────
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

-- ─── Comments ────────────────────────────────────────────────────────────────
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

-- ─── User Notifications ─────────────────────────────────────────────────────
create policy "Users can view their own notifications"
  on public.user_notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can update their own notifications"
  on public.user_notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Folders ─────────────────────────────────────────────────────────────────
create policy "Users can view their own folders"
  on public.folders for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can create their own folders"
  on public.folders for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their own folders"
  on public.folders for update
  to authenticated
  using (user_id = auth.uid());

create policy "Users can delete their own folders"
  on public.folders for delete
  to authenticated
  using (user_id = auth.uid());

-- ─── Folder Gigs ────────────────────────────────────────────────────────────
create policy "Users can view their own folder_gigs"
  on public.folder_gigs for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can add gigs to their folders"
  on public.folder_gigs for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.folders
      where folders.id = folder_gigs.folder_id
        and folders.user_id = auth.uid()
    )
  );

create policy "Users can update their own folder_gigs"
  on public.folder_gigs for update
  to authenticated
  using (user_id = auth.uid());

create policy "Users can remove gigs from their folders"
  on public.folder_gigs for delete
  to authenticated
  using (user_id = auth.uid());

-- ─── Gig Roles ──────────────────────────────────────────────────────────────
create policy "Gig members can view gig roles"
  on public.gig_roles for select
  to authenticated
  using (public.is_gig_member(gig_id));

create policy "Gig members can create gig roles"
  on public.gig_roles for insert
  to authenticated
  with check (public.is_gig_member(gig_id));

create policy "Gig members can update gig roles"
  on public.gig_roles for update
  to authenticated
  using (public.is_gig_member(gig_id));

create policy "Gig members can delete gig roles"
  on public.gig_roles for delete
  to authenticated
  using (public.is_gig_member(gig_id));

-- ─── Arrangement Sections ───────────────────────────────────────────────────
create policy "Gig members can view arrangement sections"
  on public.arrangement_sections for select
  to authenticated
  using (
    exists (
      select 1 from public.songs
      where songs.id = arrangement_sections.song_id
        and public.is_gig_member(songs.gig_id)
    )
  );

create policy "Gig members can create arrangement sections"
  on public.arrangement_sections for insert
  to authenticated
  with check (
    exists (
      select 1 from public.songs
      where songs.id = arrangement_sections.song_id
        and public.is_gig_member(songs.gig_id)
    )
  );

create policy "Gig members can update arrangement sections"
  on public.arrangement_sections for update
  to authenticated
  using (
    exists (
      select 1 from public.songs
      where songs.id = arrangement_sections.song_id
        and public.is_gig_member(songs.gig_id)
    )
  );

create policy "Gig members can delete arrangement sections"
  on public.arrangement_sections for delete
  to authenticated
  using (
    exists (
      select 1 from public.songs
      where songs.id = arrangement_sections.song_id
        and public.is_gig_member(songs.gig_id)
    )
  );

-- ─── Arrangement Entries ────────────────────────────────────────────────────
create policy "Gig members can view arrangement entries"
  on public.arrangement_entries for select
  to authenticated
  using (
    exists (
      select 1 from public.arrangement_sections sec
      join public.songs s on s.id = sec.song_id
      where sec.id = arrangement_entries.section_id
        and public.is_gig_member(s.gig_id)
    )
  );

create policy "Gig members can create arrangement entries"
  on public.arrangement_entries for insert
  to authenticated
  with check (
    exists (
      select 1 from public.arrangement_sections sec
      join public.songs s on s.id = sec.song_id
      where sec.id = arrangement_entries.section_id
        and public.is_gig_member(s.gig_id)
    )
  );

create policy "Gig members can update arrangement entries"
  on public.arrangement_entries for update
  to authenticated
  using (
    exists (
      select 1 from public.arrangement_sections sec
      join public.songs s on s.id = sec.song_id
      where sec.id = arrangement_entries.section_id
        and public.is_gig_member(s.gig_id)
    )
  );

create policy "Gig members can delete arrangement entries"
  on public.arrangement_entries for delete
  to authenticated
  using (
    exists (
      select 1 from public.arrangement_sections sec
      join public.songs s on s.id = sec.song_id
      where sec.id = arrangement_entries.section_id
        and public.is_gig_member(s.gig_id)
    )
  );

-- ─── Setlist Sections ───────────────────────────────────────────────────────
create policy "Gig members can view setlist sections"
  on public.setlist_sections for select
  to authenticated
  using (public.is_gig_member(gig_id));

create policy "Gig members can create setlist sections"
  on public.setlist_sections for insert
  to authenticated
  with check (public.is_gig_member(gig_id));

create policy "Gig members can update setlist sections"
  on public.setlist_sections for update
  to authenticated
  using (public.is_gig_member(gig_id));

create policy "Gig members can delete setlist sections"
  on public.setlist_sections for delete
  to authenticated
  using (public.is_gig_member(gig_id));
