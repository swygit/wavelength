# wavelength

Collaborative setlist planning for bands. Build candidate songs together, vote in real time, arrange parts, and lock a final show-ready setlist.

## Features

- **Gig workspaces** with invite codes and open/closed status
- **Real-time voting**, emoji reactions, and threaded comments on songs
- **Spotify search** with preview snippets and YouTube fallback
- **Naughty List** showing members who haven't finished voting
- **Summary view** with drag-reorder setlist, BPM, key selection, and popularity ranking
- **Song arrangements** – create sections (Intro, Verse, Chorus…), assign roles to members, add notes per entry
- **Gig roles** – define instrument/part roles per gig and assign members
- **Folders** – organise gigs into personal folders on the dashboard
- **Voice memos** – record and attach audio memos to arrangement sections
- **Profile onboarding** and avatar support
- **Away notifications** – mark yourself as away so bandmates know
- Members can leave a gig; their songs, votes, reactions, and comments are removed on leave
- Owner must assign a new leader before leaving (transfer and leave flow)
- Owner can delete a gig when they are the only member
- Dashboard notification when a member is promoted to group leader

## Tech Stack

- Vue 3 + Vite
- Pinia for client state management
- Vue Router 4 for navigation and route guards
- Supabase for Auth, Postgres, Realtime, and Storage
- Tailwind CSS v3 for styling
- vuedraggable for drag-and-drop reordering

## Architecture

High-level flow:

1. App boots in `src/main.js`, creates Vue app + Pinia + Router.
2. Auth store initializes before mount (session restore + profile fetch).
3. Router guards enforce auth/guest routes and onboarding completion.
4. Views use Pinia stores for data reads/writes.
5. Supabase handles persistence, RLS authorization, realtime updates, and file storage.

### Routing (`src/router.js`)

| Path | View | Access |
|------|------|--------|
| `/` | LandingView | Public |
| `/auth` | AuthView | Guest only |
| `/onboarding` | OnboardingView | Auth |
| `/dashboard` | DashboardView | Auth |
| `/profile` | ProfileView | Auth |
| `/gigs/new` | CreateGigView | Auth |
| `/join` | JoinGigView | Auth |
| `/gigs/:id` | GigView | Auth |
| `/gigs/:id/summary` | SummaryView | Auth |
| `/gigs/:gigId/songs/:songId/arrangement` | ArrangementView | Auth |
| `/folders/:id` | FolderView | Auth |

### State Layer (`src/stores/`)

| Store | Responsibilities |
|-------|-----------------|
| `auth.js` | Session, profile, sign-in/up/out, profile/avatar update |
| `gigs.js` | Create/join/list/fetch gigs, update voting status, leave gig, transfer ownership, delete gig, gig roles |
| `songs.js` | Songs, votes, reactions, comments, setlist fields (order, key, BPM, cancel), realtime subscriptions, voice memo upload |
| `arrangements.js` | Arrangement sections & entries CRUD, section reorder, role assignments |
| `folders.js` | Personal folder CRUD, assign/remove gigs to folders |

### Views (`src/views/`)

| View | Purpose |
|------|---------|
| `LandingView` | Marketing/landing page |
| `AuthView` | Sign in / sign up |
| `OnboardingView` | First-time profile setup |
| `DashboardView` | Gig list, folders, notifications |
| `ProfileView` | Edit profile & avatar |
| `CreateGigView` | Create a new gig workspace |
| `JoinGigView` | Join via invite code |
| `GigView` | Song pool, voting, reactions, comments |
| `SummaryView` | Setlist ordering, key/BPM, popularity ranking |
| `ArrangementView` | Song arrangement builder – sections, drag-reorder roles, entries, export |
| `FolderView` | View gigs within a folder |

### Components (`src/components/`)

| Component | Purpose |
|-----------|---------|
| `AppLayout` | Shared layout shell (nav, sidebar) |
| `AppLoading` | Full-page loading spinner |
| `AddSongPanel` | Spotify/YouTube search panel for adding songs |
| `SongCard` | Song display card with vote/reaction/comment UI |
| `SongPlayer` | Embedded audio/video player |
| `NaughtyList` | Members who haven't finished voting |
| `VoiceMemo` | Record & playback voice memos |
| `AwayNotification` | Away status banner |
| `ExternalLinkNotice` | Confirmation before opening external links |
| `FolderCard` | Folder display card on dashboard |

### Service Layer (`src/lib/`)

| Module | Purpose |
|--------|---------|
| `supabase.js` | Client bootstrap via `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |
| `spotify.js` | Calls `spotify-search` Edge Function |
| `youtube.js` | Calls `youtube-search` Edge Function |
| `text.js` | Text utility helpers |

## Database Migrations

Migrations are split into separate concerns under `supabase/migrations/`:

| File | Contents |
|------|----------|
| `001_tables.sql` | All CREATE TABLE statements and indexes |
| `002_functions.sql` | Database functions and triggers |
| `003_policies.sql` | Row Level Security policies |
| `004_storage.sql` | Storage buckets (avatars, voice-memos) and their policies |
| `005_realtime.sql` | Realtime publication subscriptions |

### Key Tables

- `profiles` – user profiles with display name, avatar, instrument
- `gigs` – gig workspaces with owner, status, invite code
- `gig_members` – membership join table with last-visited tracking
- `gig_roles` – instrument/part roles defined per gig
- `songs` – candidate songs with Spotify/YouTube metadata, setlist order, key, BPM
- `votes` – per-song votes with score
- `reactions` – emoji reactions on songs
- `comments` – threaded comments on songs
- `arrangement_sections` – ordered sections within a song arrangement
- `arrangement_entries` – role assignments within arrangement sections, with drag-reorder position
- `folders` – personal gig folders
- `folder_gigs` – many-to-many folder ↔ gig assignments
- `user_notifications` – in-app notifications

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a Supabase project.
2. Run migrations in order in the SQL Editor:

```
supabase/migrations/001_tables.sql
supabase/migrations/002_functions.sql
supabase/migrations/003_policies.sql
supabase/migrations/004_storage.sql
supabase/migrations/005_realtime.sql
```

### 3. Configure environment variables

For local development, create `.env.development.local` in project root:

```env
VITE_SUPABASE_URL=https://your-dev-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-dev-anon-key
```

For production, create `.env.production.local`:

```env
VITE_SUPABASE_URL=https://your-prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-prod-anon-key
```

Notes:

- Only Supabase URL and anon key are needed in client env.
- Spotify and YouTube API keys are stored server-side in Supabase Edge Function secrets (see step 4 below).
- Never commit .env.local files; add them to .gitignore.

### 4. Deploy Supabase Edge Functions and set secrets

1. Create two Edge Functions in your Supabase project:
   - `spotify-search`: handles Spotify API token fetch and track search
   - `youtube-search`: handles YouTube video search

2. Set the following Edge Function secrets in Supabase project settings:
   - `SPOTIFY_CLIENT_ID`: your Spotify app client ID
   - `SPOTIFY_CLIENT_SECRET`: your Spotify app client secret
   - `YOUTUBE_API_KEY`: your YouTube Data API v3 key

These secrets are never exposed to the client; all API calls are made server-side.

### 5. Create required Supabase Storage buckets

- avatars (used by profile avatar upload)
- voice-memos (used by song voice memo upload)

Configure bucket/public access and storage policies based on your deployment security needs.

### 6. Run locally

```bash
npm run dev
```

### 7. Build and preview

```bash
npm run build
npm run preview
```

## NPM Scripts

- npm run dev: start Vite dev server
- npm run build: production build
- npm run preview: preview production build

## Project Structure

```text
wavelength/
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── src/
│   ├── App.vue
│   ├── main.js
│   ├── router.js
│   ├── style.css
│   ├── components/
│   │   ├── AddSongPanel.vue
│   │   ├── AppLayout.vue
│   │   ├── AppLoading.vue
│   │   ├── AwayNotification.vue
│   │   ├── ExternalLinkNotice.vue
│   │   ├── FolderCard.vue
│   │   ├── NaughtyList.vue
│   │   ├── SongCard.vue
│   │   ├── SongPlayer.vue
│   │   └── VoiceMemo.vue
│   ├── lib/
│   │   ├── spotify.js
│   │   ├── supabase.js
│   │   ├── text.js
│   │   └── youtube.js
│   ├── stores/
│   │   ├── arrangements.js
│   │   ├── auth.js
│   │   ├── folders.js
│   │   ├── gigs.js
│   │   └── songs.js
│   └── views/
│       ├── ArrangementView.vue
│       ├── AuthView.vue
│       ├── CreateGigView.vue
│       ├── DashboardView.vue
│       ├── FolderView.vue
│       ├── GigView.vue
│       ├── JoinGigView.vue
│       ├── LandingView.vue
│       ├── OnboardingView.vue
│       ├── ProfileView.vue
│       └── SummaryView.vue
└── supabase/
    ├── functions/
    │   ├── spotify-search/index.ts
    │   └── youtube-search/index.ts
    └── migrations/
        ├── 001_tables.sql
        ├── 002_functions.sql
        ├── 003_policies.sql
        ├── 004_storage.sql
        └── 005_realtime.sql
```

## Database Architecture

### Tables

#### `profiles`
- **PK:** `id` (uuid) → references `auth.users(id)` on delete cascade
- User profile created automatically on sign-up via trigger. Stores display name and avatar URL. 1:1 relationship with Supabase Auth.
- Columns: `display_name`, `avatar_url`, `created_at`, `updated_at`

#### `gigs`
- **PK:** `id` (uuid)
- **FK:** `owner_id` → `auth.users(id)`
- A gig is a collaborative workspace where band members propose songs, vote, and build a setlist for a specific show. Each gig has a unique 6-character invite code and an open/closed status.
- Columns: `name`, `description`, `owner_id`, `invite_code` (unique), `status` (open/closed), `created_at`

#### `gig_members`
- **PK:** `id` (uuid)
- **FKs:** `gig_id` → `gigs(id)`, `user_id` → `profiles(id)`
- Bridge table for gig membership. Each row represents one user belonging to one gig. Tracks the member's role (owner/member) and when they last visited the gig.
- Columns: `role` (owner/member), `joined_at`, `last_visited_at`
- **Unique:** `(gig_id, user_id)`

#### `songs`
- **PK:** `id` (uuid)
- **FKs:** `gig_id` → `gigs(id)`, `added_by` → `auth.users(id)`
- Songs proposed by members into a gig's pool. Stores Spotify/YouTube metadata, source type, and setlist fields (order, key, BPM, cancelled status). Unique partial indexes prevent the same Spotify or YouTube track being added twice to the same gig.
- Columns: `title`, `artist`, `album`, `album_art`, `preview_url`, `external_url`, `source` (spotify/youtube/manual), `spotify_id`, `youtube_id`, `setlist_order`, `song_key`, `bpm`, `is_cancelled`, `duration_ms`, `created_at`

#### `votes`
- **PK:** `id` (uuid)
- **FKs:** `song_id` → `songs(id)`, `user_id` → `auth.users(id)`
- One vote per user per song. Members rate songs with -1 (nay), 0 (abstain), or 1 (yay). Votes drive the popularity ranking on the Summary page.
- Columns: `value` (-1/0/1), `created_at`, `updated_at`, `voted_at`
- **Unique:** `(song_id, user_id)`

#### `reactions`
- **PK:** `id` (uuid)
- **FKs:** `song_id` → `songs(id)`, `user_id` → `auth.users(id)`
- Emoji reactions on songs, similar to Slack reactions. Each user can add one of each emoji per song.
- Columns: `emoji`, `created_at`
- **Unique:** `(song_id, user_id, emoji)`

#### `comments`
- **PK:** `id` (uuid)
- **FKs:** `song_id` → `songs(id)`, `user_id` → `profiles(id)`
- Flat-list text comments on songs. Members discuss song choices, suggest keys, or leave general notes.
- Columns: `body`, `created_at`, `updated_at`

#### `user_notifications`
- **PK:** `id` (uuid)
- **FKs:** `user_id` → `auth.users(id)`, `gig_id` → `gigs(id)`
- In-app notifications for users. Currently supports the `leader_assigned` type (shown as a modal on dashboard when a member is promoted to group leader).
- Columns: `type`, `payload` (jsonb), `created_at`, `read_at`

#### `folders`
- **PK:** `id` (uuid)
- **FK:** `user_id` → `auth.users(id)`
- Personal folders for organising gigs on the dashboard. Each user manages their own set of folders with a custom sort order.
- Columns: `name`, `position`, `created_at`, `updated_at`

#### `folder_gigs`
- **PK:** `id` (uuid)
- **FKs:** `folder_id` → `folders(id)`, `gig_id` → `gigs(id)`, `user_id` → `auth.users(id)`
- Junction table linking gigs to folders. A gig can appear in multiple folders. The `user_id` FK scopes the assignment so each user controls their own folder contents independently.
- Columns: `position`, `added_at`
- **Unique:** `(folder_id, gig_id, user_id)`

#### `gig_roles`
- **PK:** `id` (uuid)
- **FKs:** `gig_id` → `gigs(id)`, `member_id` → `profiles(id)` (nullable, on delete set null)
- Instrument/part roles defined per gig (e.g. "Lead Guitar", "Drums", "Vocals"). Each role has an icon emoji and a sort position. Optionally assigned to a specific member. Used by the arrangement system to allocate entries per section.
- Columns: `name`, `icon`, `position`, `member_id`, `created_at`

#### `arrangement_sections`
- **PK:** `id` (uuid)
- **FK:** `song_id` → `songs(id)`
- Ordered sections within a song's arrangement (e.g. Intro, Verse 1, Chorus, Bridge). Members collaboratively define the structure of how a song will be performed.
- Columns: `name`, `position`, `created_at`

#### `arrangement_entries`
- **PK:** `id` (uuid)
- **FKs:** `section_id` → `arrangement_sections(id)`, `role_id` → `gig_roles(id)`
- The content cell at the intersection of a section and a role. Stores what a specific instrument/part does in a specific section — text notes, a voice memo recording, or a reference link. Roles within a section can be reordered via drag-and-drop; the `position` column persists the display order.
- Columns: `notes`, `voice_memo_url`, `link_url`, `position`, `created_at`, `updated_at`
- **Unique:** `(section_id, role_id)`

### Entity Relationships

```text
auth.users
  └── profiles (1:1)
  └── gigs (1:many via owner_id)
  └── gig_members (1:many via user_id)
  └── songs (1:many via added_by)
  └── votes (1:many via user_id)
  └── reactions (1:many via user_id)
  └── user_notifications (1:many via user_id)
  └── folders (1:many via user_id)

gigs
  └── gig_members (1:many)
  └── songs (1:many)
  └── gig_roles (1:many)

songs
  └── votes (1:many)
  └── reactions (1:many)
  └── comments (1:many)
  └── arrangement_sections (1:many)

arrangement_sections
  └── arrangement_entries (1:many)

gig_roles
  └── arrangement_entries (1:many via role_id)

folders
  └── folder_gigs (1:many)
```

### Functions and Triggers

- **`handle_new_user`** – trigger on `auth.users` insert; auto-creates a `profiles` row
- **`handle_auth_user_updated`** – trigger on `auth.users` metadata update; syncs `display_name` into profiles
- **`is_gig_member(uuid)`** – security definer helper used in RLS policies to check membership
- **`cleanup_gig_member_data_on_leave`** – trigger on `gig_members` delete; removes departing member's votes, reactions, comments, and songs for that gig
- **`prevent_owner_leave_without_transfer`** – trigger on `gig_members` delete; blocks deletion if the user is still the gig owner
- **`transfer_gig_ownership_and_leave(gig_id, new_owner_user_id)`** – atomically transfers ownership, creates a `leader_assigned` notification, and removes the old owner from `gig_members`

### Row-Level Security (RLS)

RLS is enabled on all tables. Policy summary:

| Table | Select | Insert | Update | Delete |
|-------|--------|--------|--------|--------|
| `profiles` | Authenticated users | Own row | Own row | – |
| `gigs` | Members | Owner | Owner | Owner (solo only) |
| `gig_members` | Own or co-members | Self-join (open gigs) | – | Self-leave |
| `songs` | Gig members | Gig members | Gig members | Adder or owner |
| `votes` | Gig members | Own (not own songs) | Own (not own songs) | Own |
| `reactions` | Gig members | Gig members | – | Own |
| `comments` | Gig members | Gig members | Own | Own |
| `user_notifications` | Own | – | Own | – |
| `folders` | Own | Own | Own | Own |
| `folder_gigs` | Own | Own (own folder) | Own | Own |
| `gig_roles` | Gig members | Gig members | Gig members | Gig members |
| `arrangement_sections` | Gig members | Gig members | Gig members | Gig members |
| `arrangement_entries` | Gig members | Gig members | Gig members | Gig members |

### Realtime

Tables added to `supabase_realtime` publication:

- `public.songs`
- `public.votes`
- `public.reactions`
- `public.comments`

### Storage

| Bucket | Public | Purpose |
|--------|--------|---------|
| `avatars` | Yes | Profile avatar uploads (folder per user) |
| `voice-memos` | Yes | Arrangement voice memo recordings (folder per gig) |

Storage policies enforce that users can only upload/modify files in their own avatar folder, and only gig members can access voice memos within their gig's folder.
