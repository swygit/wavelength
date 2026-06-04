-- Wavelength Folders Schema
-- Personal folder system for organizing gigs per user

-- =========================================
-- FOLDERS
-- =========================================
create table if not exists public.folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  position   int not null default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.folders enable row level security;

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

-- =========================================
-- FOLDER_GIGS (junction table)
-- =========================================
create table if not exists public.folder_gigs (
  id         uuid primary key default gen_random_uuid(),
  folder_id  uuid not null references public.folders(id) on delete cascade,
  gig_id     uuid not null references public.gigs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  position   int not null default 0,
  added_at   timestamptz default now() not null,
  unique(folder_id, gig_id, user_id)
);

alter table public.folder_gigs enable row level security;

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

-- Index for fast lookups
create index if not exists idx_folders_user_id on public.folders(user_id);
create index if not exists idx_folder_gigs_user_id on public.folder_gigs(user_id);
create index if not exists idx_folder_gigs_folder_id on public.folder_gigs(folder_id);
