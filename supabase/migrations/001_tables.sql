-- ============================================================================
-- Wavelength: Table Definitions
-- ============================================================================

-- ─── PROFILES ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null
);

alter table public.profiles enable row level security;

-- ─── GIGS ────────────────────────────────────────────────────────────────────
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

-- ─── GIG MEMBERS ─────────────────────────────────────────────────────────────
create table if not exists public.gig_members (
  id              uuid primary key default gen_random_uuid(),
  gig_id          uuid not null references public.gigs(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            text not null default 'member' check (role in ('owner', 'member')),
  joined_at       timestamptz default now() not null,
  last_visited_at timestamptz default now(),
  unique(gig_id, user_id)
);

alter table public.gig_members enable row level security;

-- ─── SONGS ───────────────────────────────────────────────────────────────────
create table if not exists public.songs (
  id            uuid primary key default gen_random_uuid(),
  gig_id        uuid not null references public.gigs(id) on delete cascade,
  added_by      uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  artist        text,
  album         text,
  album_art     text,
  preview_url   text,
  external_url  text,
  source        text not null check (source in ('spotify', 'youtube', 'manual')),
  spotify_id    text,
  youtube_id    text,
  setlist_order int,
  song_key      text,
  bpm           int,
  is_cancelled  boolean not null default false,
  duration_ms   int,
  created_at    timestamptz default now() not null
);

alter table public.songs enable row level security;

create unique index if not exists songs_unique_spotify_per_gig
  on public.songs (gig_id, spotify_id)
  where spotify_id is not null;

create unique index if not exists songs_unique_youtube_per_gig
  on public.songs (gig_id, youtube_id)
  where youtube_id is not null;

-- ─── VOTES ───────────────────────────────────────────────────────────────────
create table if not exists public.votes (
  id         uuid primary key default gen_random_uuid(),
  song_id    uuid not null references public.songs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  value      smallint not null check (value in (-1, 0, 1)),
  created_at timestamptz default now() not null,
  updated_at timestamptz,
  voted_at   timestamptz,
  unique(song_id, user_id)
);

alter table public.votes enable row level security;

-- ─── REACTIONS ───────────────────────────────────────────────────────────────
create table if not exists public.reactions (
  id         uuid primary key default gen_random_uuid(),
  song_id    uuid not null references public.songs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz default now() not null,
  unique(song_id, user_id, emoji)
);

alter table public.reactions enable row level security;

-- ─── COMMENTS ────────────────────────────────────────────────────────────────
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  song_id    uuid not null references public.songs(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.comments enable row level security;

-- ─── USER NOTIFICATIONS ──────────────────────────────────────────────────────
create table if not exists public.user_notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  gig_id     uuid references public.gigs(id) on delete cascade,
  type       text not null check (type in ('leader_assigned')),
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

alter table public.user_notifications enable row level security;

-- ─── FOLDERS ─────────────────────────────────────────────────────────────────
create table if not exists public.folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  position   int not null default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.folders enable row level security;

-- ─── FOLDER_GIGS (junction) ──────────────────────────────────────────────────
create table if not exists public.folder_gigs (
  id        uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.folders(id) on delete cascade,
  gig_id    uuid not null references public.gigs(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  position  int not null default 0,
  added_at  timestamptz default now() not null,
  unique(folder_id, gig_id, user_id)
);

alter table public.folder_gigs enable row level security;

-- ─── GIG ROLES (instrument roles per gig) ───────────────────────────────────
create table if not exists public.gig_roles (
  id         uuid primary key default gen_random_uuid(),
  gig_id     uuid not null references public.gigs(id) on delete cascade,
  name       text not null,
  icon       text not null default '🎵',
  position   int not null default 0,
  member_id  uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null
);

alter table public.gig_roles enable row level security;

-- ─── ARRANGEMENT SECTIONS (per song) ────────────────────────────────────────
create table if not exists public.arrangement_sections (
  id         uuid primary key default gen_random_uuid(),
  song_id    uuid not null references public.songs(id) on delete cascade,
  name       text not null,
  position   int not null default 0,
  created_at timestamptz default now() not null
);

alter table public.arrangement_sections enable row level security;

-- ─── ARRANGEMENT ENTRIES (content per section + role) ────────────────────────
create table if not exists public.arrangement_entries (
  id             uuid primary key default gen_random_uuid(),
  section_id     uuid not null references public.arrangement_sections(id) on delete cascade,
  role_id        uuid not null references public.gig_roles(id) on delete cascade,
  notes          text,
  voice_memo_url text,
  link_url       text,
  position       int not null default 0,
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null,
  unique(section_id, role_id)
);

alter table public.arrangement_entries enable row level security;


-- ============================================================================
-- INDEXES
-- ============================================================================

create index if not exists idx_folders_user_id on public.folders(user_id);
create index if not exists idx_folder_gigs_user_id on public.folder_gigs(user_id);
create index if not exists idx_folder_gigs_folder_id on public.folder_gigs(folder_id);
create index if not exists idx_gig_roles_gig_id on public.gig_roles(gig_id);
create index if not exists idx_gig_roles_member_id on public.gig_roles(member_id);
create index if not exists idx_arrangement_sections_song_id on public.arrangement_sections(song_id);
create index if not exists idx_arrangement_entries_section_id on public.arrangement_entries(section_id);
create index if not exists idx_arrangement_entries_role_id on public.arrangement_entries(role_id);
