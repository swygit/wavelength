# wavelength

Collaborative setlist planning for bands. Streamline the process of curating, voting on, and finalising song setlists with your bandmates — in one place, in real time.

## Features

- **Gig Workspaces** — Create isolated collaborative spaces per gig, invite bandmates via unique codes
- **Song Search** — Find songs via Spotify (with 30-second preview snippets) or YouTube (embedded video fallback)
- **Voting** — Thumbs up / thumbs down on every song; scores update live
- **Reactions & Comments** — React with emojis, leave inline comments per song
- **Naughty List** — Accountability tracker showing who hasn't finished voting
- **Final Summary** — Ranked setlist analytics view once voting closes

## Tech Stack

- [Vue 3](https://vuejs.org/) (Composition API) + [Vite](https://vite.dev/)
- [Supabase](https://supabase.com/) — Auth, Database (Postgres), Realtime
- [Pinia](https://pinia.vuejs.org/) — State management
- [Vue Router 4](https://router.vuejs.org/)
- [Tailwind CSS v3](https://tailwindcss.com/)

---

## Setup

### 1. Clone & install dependencies

```bash
git clone https://github.com/swygit/wavelength
cd wavelength
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In the **SQL Editor**, run the migration file:
   ```
   supabase/migrations/001_initial_schema.sql
   ```
   This creates all tables, RLS policies, and real-time subscriptions.

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Project → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase Project → Settings → API → `anon public` key |
| `VITE_SPOTIFY_CLIENT_ID` | [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) |
| `VITE_SPOTIFY_CLIENT_SECRET` | Spotify Developer Dashboard |
| `VITE_YOUTUBE_API_KEY` | [Google Cloud Console](https://console.cloud.google.com/) — enable YouTube Data API v3 |

> **Note:** Spotify and YouTube API keys are optional. If not set, the song search panels will show an error message but the rest of the app will function normally.

### 4. Run in development

```bash
npm run dev
```

### 5. Build for production

```bash
npm run build
npm run preview
```

---

## Project Structure

```
src/
├── lib/
│   ├── supabase.js     # Supabase client
│   ├── spotify.js      # Spotify Web API helpers
│   └── youtube.js      # YouTube Data API helpers
├── stores/
│   ├── auth.js         # Auth state (Pinia)
│   ├── gigs.js         # Gig management (Pinia)
│   └── songs.js        # Songs, votes, reactions, comments (Pinia)
├── views/
│   ├── AuthView.vue        # Login / Sign-up
│   ├── DashboardView.vue   # My Gigs list
│   ├── CreateGigView.vue   # New Gig form
│   ├── JoinGigView.vue     # Join via invite code
│   ├── GigView.vue         # Main workspace
│   └── SummaryView.vue     # Final ranked setlist
├── components/
│   ├── AppLayout.vue    # Nav shell
│   ├── AddSongPanel.vue # Search + add songs
│   ├── SongCard.vue     # Individual song with vote/react/comment
│   └── NaughtyList.vue  # Member accountability tracker
├── router.js            # Vue Router
├── main.js              # App entry point
└── style.css            # Tailwind directives + global styles
supabase/
└── migrations/
    └── 001_initial_schema.sql  # Full DB schema + RLS policies
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `profiles` | Extended user info (display name, avatar) |
| `gigs` | Gig workspaces with invite codes |
| `gig_members` | Many-to-many users ↔ gigs with roles |
| `songs` | Songs added to a gig |
| `votes` | Per-user per-song vote (-1, 0, or +1) |
| `reactions` | Emoji reactions on songs |
| `comments` | Text comments on songs |

Row-Level Security is enabled on every table. Real-time subscriptions are enabled for `songs`, `votes`, `reactions`, and `comments`.
