-- ============================================================================
-- Wavelength: Storage Buckets & Policies
-- ============================================================================

-- ─── Buckets ─────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('voice-memos', 'voice-memos', true)
on conflict (id) do update set public = excluded.public;

-- ─── Avatar storage policies ────────────────────────────────────────────────
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

-- ─── Voice memo storage policies ────────────────────────────────────────────
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
