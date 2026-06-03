# wavelength

Collaborative setlist planning for bands. Build candidate songs together, vote in real time, and lock a final show-ready setlist.

## Features

- Gig workspaces with invite codes
- Real-time voting, emoji reactions, and comments
- Spotify search with preview snippets and YouTube fallback
- Naughty List for unfinished voting
- Summary view for ranking, ordering, notes, key, and voice memos
- Profile onboarding and avatar support
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

## Architecture (Current)

High-level flow:

1. App boots in src/main.js, creates Vue app + Pinia + Router.
2. Auth store initializes before mount (session restore + profile fetch).
3. Router guards enforce auth/guest routes and onboarding completion.
4. Views use Pinia stores for data reads/writes.
5. Supabase handles persistence, RLS authorization, realtime updates, and file storage.

Frontend layers:

- Routing layer: src/router.js
    - Public: /, /auth
    - Protected: /onboarding, /dashboard, /profile, /gigs/new, /join, /gigs/:id, /gigs/:id/summary
- State layer: src/stores
    - auth.js: session, profile, sign-in/up/out, profile/avatar update
    - gigs.js: create/join/list/fetch gigs, update voting status, leave gig, transfer ownership, delete gig
    - songs.js: songs, votes, reactions, comments, setlist fields, realtime subscriptions, voice memo upload
- Service layer: src/lib
    - supabase.js: client bootstrap via VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
    - spotify.js: calls spotify-search Edge Function
    - youtube.js: calls youtube-search Edge Function

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a Supabase project.
2. Run migration in SQL Editor:

```sql
supabase/migrations/001_initial_schema.sql
```

This creates core tables, functions, triggers, RLS policies, and realtime publication entries.

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
│   │   ├── NaughtyList.vue
│   │   ├── SongCard.vue
│   │   ├── SongPlayer.vue
│   │   └── VoiceMemo.vue
│   ├── lib/
│   │   ├── spotify.js
│   │   ├── supabase.js
│   │   └── youtube.js
│   ├── stores/
│   │   ├── auth.js
│   │   ├── gigs.js
│   │   └── songs.js
│   └── views/
│       ├── AuthView.vue
│       ├── CreateGigView.vue
│       ├── DashboardView.vue
│       ├── GigView.vue
│       ├── JoinGigView.vue
│       ├── LandingView.vue
│       ├── OnboardingView.vue
│       ├── ProfileView.vue
│       └── SummaryView.vue
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql
```

## Database Architecture

Primary entities:

- profiles
    - 1:1 with auth.users
    - display_name, avatar_url, timestamps
- gigs
    - workspace per show
    - owner_id, invite_code, status (open/closed)
- gig_members
    - membership bridge table
    - role (owner/member), unique (gig_id, user_id)
- songs
    - songs proposed in a gig
    - metadata + setlist_order + song_key + notes + voice_memo_url
- votes
    - one vote per user per song
    - value in (-1, 0, 1)
- reactions
    - per-song emoji reactions
    - unique (song_id, user_id, emoji)
- comments
    - per-song threaded text entries (flat list)

### Functions and triggers

- public.handle_new_user trigger on auth.users insert
    - auto-creates profiles row
- public.handle_auth_user_updated trigger on auth.users metadata update
    - syncs display_name into profiles
- public.is_gig_member(uuid)
    - security definer helper to evaluate membership in RLS policies
- public.cleanup_gig_member_data_on_leave trigger on gig_members delete
    - removes departing member's votes, reactions, comments, and songs for that gig
- public.prevent_owner_leave_without_transfer trigger on gig_members delete
    - blocks delete if the departing user is still the gig owner
- public.transfer_gig_ownership_and_leave(target_gig_id, new_owner_user_id)
    - atomically transfers ownership, creates a leader_assigned notification for the new owner, and removes the old owner from gig_members

### Row-Level Security (RLS)

RLS is enabled on all application tables.

Policy model summary:

- profiles: authenticated read; users update only own profile
- gigs: owner can insert/update; owner can delete only when no other members exist; members can select relevant gigs
- gig_members: users can join/leave self; members can view roster for their gigs
- songs: gig members can read/insert/update; owner or adder can delete
- votes: members can read; users can upsert/delete own votes; users cannot vote on own songs
- reactions: members can read/insert; users delete own reactions
- comments: members can read/insert; users update/delete own comments

### Realtime

The migration adds these tables to supabase_realtime publication:

- public.songs
- public.votes
- public.reactions
- public.comments

### Notifications

- user_notifications table stores in-app notices per user
- Type supported: leader_assigned
- RLS: users can only read and update their own notifications
- Dashboard shows an unread leader_assigned notice as a modal on first login after promotion; dismissed notices are marked read_at

### Storage usage

- avatars bucket: profile avatar uploads
- voice-memos bucket: per-song audio notes

Storage bucket creation and storage policies are expected to be configured in Supabase project settings.
