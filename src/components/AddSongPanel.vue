<template>
  <div class="card">
    <h2 class="font-semibold mb-3">Add Songs</h2>

    <!-- Search source tabs -->
    <div class="flex gap-1 mb-3 bg-gray-800 rounded-lg p-1">
      <button
        v-for="src in sources"
        :key="src.id"
        class="flex-1 py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
        :class="activeSource === src.id ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'"
        @click="activeSource = src.id"
      >
        <svg
          v-if="src.id === 'spotify'"
          viewBox="0 0 24 24"
          class="w-4 h-4"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
          <path d="M7.5 10.2C10.8 9.2 13.8 9.4 16.7 10.7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          <path d="M8.2 13.1C10.7 12.4 13 12.5 15.2 13.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          <path d="M8.9 15.7C10.6 15.2 12.1 15.3 13.6 15.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <svg
          v-else
          viewBox="0 0 24 24"
          class="w-4 h-4"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect x="3" y="6" width="18" height="12" rx="3" fill="currentColor" />
          <path d="M10 9.5L15 12L10 14.5V9.5Z" fill="#0f172a" />
        </svg>
        {{ src.label }}
      </button>
    </div>

    <!-- Search input -->
    <form @submit.prevent="handleSearch" class="flex flex-col sm:flex-row gap-2 mb-3">
      <input
        v-model="query"
        type="text"
        class="input-field flex-1 text-sm"
        :placeholder="activeSource === 'spotify' ? 'Search Spotify tracks…' : 'Search YouTube videos…'"
        :disabled="searching"
      />
      <button type="submit" class="btn-primary text-sm px-3 w-full sm:w-auto" :disabled="!query.trim() || searching">
        {{ searching ? '…' : 'Search' }}
      </button>
    </form>

    <!-- Error -->
    <div v-if="searchError" class="text-red-400 text-xs mb-2">{{ searchError }}</div>

    <!-- Results -->
    <div v-if="results.length" class="space-y-2 max-h-64 overflow-y-auto pr-1">
      <div
        v-for="result in results"
        :key="result.spotifyId || result.youtubeId"
        class="flex items-center gap-3 p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
      >
        <img v-if="result.albumArt" :src="result.albumArt" class="w-10 h-10 rounded object-cover flex-shrink-0" />
        <div v-else class="w-10 h-10 rounded bg-gray-700 flex items-center justify-center text-lg flex-shrink-0">��</div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">{{ result.title }}</div>
          <div class="text-xs text-gray-400 truncate">{{ result.artist }}</div>
        </div>
        <button
          class="btn-primary text-xs px-2 py-1 flex-shrink-0"
          :disabled="adding === (result.spotifyId || result.youtubeId)"
          @click="addSong(result)"
        >
          {{ adding === (result.spotifyId || result.youtubeId) ? '…' : '+ Add' }}
        </button>
      </div>
    </div>
  </div>

  <teleport to="body">
    <div
      v-if="showDuplicateSongNotice"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="showDuplicateSongNotice = false"
    >
      <div class="w-full max-w-lg card border border-brand-500/40">
        <p class="text-xs uppercase tracking-wide text-brand-300">Song Already Added</p>
        <h2 class="text-lg font-bold mt-1">This song is already in the playlist.</h2>
        <p class="text-sm text-gray-300 mt-3 leading-relaxed">
          Pick another song!
        </p>
        <div class="mt-5 flex flex-col sm:flex-row sm:justify-end gap-2">
          <button class="btn-primary text-sm w-full sm:w-auto" @click="showDuplicateSongNotice = false">Got it</button>
        </div>
      </div>
    </div>
  </teleport>

  <teleport to="body">
    <div
      v-if="showSimilarSongNotice"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="cancelSimilarSong"
    >
      <div class="w-full max-w-lg card border border-amber-500/40">
        <p class="text-xs uppercase tracking-wide text-amber-300">Possible Duplicate Song</p>
        <h2 class="text-lg font-bold mt-1">This looks similar to a song already in the setlist!</h2>
        <p class="text-sm text-gray-300 mt-3 leading-relaxed">
          Existing song:
          <span class="font-semibold text-white">{{ similarSongMatch?.title }}</span>
          <span v-if="similarSongMatch?.artist" class="text-gray-200"> by {{ similarSongMatch.artist }}</span>
        </p>
        <p class="text-sm text-gray-300 mt-2">Add this song anyway?</p>
        <div class="mt-5 flex flex-col sm:flex-row sm:justify-end gap-2">
          <button class="btn-secondary text-sm w-full sm:w-auto" @click="cancelSimilarSong">Cancel</button>
          <button class="btn-primary text-sm w-full sm:w-auto" @click="confirmAddSimilarSong">Add anyway</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref } from 'vue'
import { searchSpotifyTracks } from '../lib/spotify'
import { searchYouTubeVideos } from '../lib/youtube'
import { decodeSongTextFields } from '../lib/text'
import { isDuplicateSongError, useSongStore } from '../stores/songs'

const props = defineProps({ gigId: { type: String, required: true } })

const songStore = useSongStore()

const sources = [
  { id: 'spotify', label: 'Spotify' },
  { id: 'youtube', label: 'YouTube' },
]

const activeSource = ref('spotify')
const query = ref('')
const results = ref([])
const searching = ref(false)
const searchError = ref(null)
const adding = ref(null)
const showDuplicateSongNotice = ref(false)
const showSimilarSongNotice = ref(false)
const pendingSimilarSong = ref(null)
const similarSongMatch = ref(null)

async function handleSearch() {
  if (!query.value.trim()) return
  searching.value = true
  searchError.value = null
  results.value = []
  try {
    if (activeSource.value === 'spotify') {
      results.value = (await searchSpotifyTracks(query.value)).map(decodeSongTextFields)
    } else {
      results.value = (await searchYouTubeVideos(query.value)).map(decodeSongTextFields)
    }
  } catch (e) {
    searchError.value = e.message
  } finally {
    searching.value = false
  }
}

async function addSong(song) {
  await addSongInternal(song, false)
}

async function addSongInternal(song, skipSimilarCheck) {
  const key = song.spotifyId || song.youtubeId
  adding.value = key
  searchError.value = null
  try {
    if (!skipSimilarCheck) {
      const similar = songStore.findSimilarSongInGig(props.gigId, song)
      if (similar) {
        pendingSimilarSong.value = song
        similarSongMatch.value = similar
        showSimilarSongNotice.value = true
        return
      }
    }

    await songStore.addSong(props.gigId, song)
    results.value = results.value.filter((r) => (r.spotifyId || r.youtubeId) !== key)
  } catch (e) {
    if (isDuplicateSongError(e)) {
      showDuplicateSongNotice.value = true
      return
    }

    searchError.value = e.message
  } finally {
    adding.value = null
  }
}

function cancelSimilarSong() {
  showSimilarSongNotice.value = false
  pendingSimilarSong.value = null
  similarSongMatch.value = null
}

async function confirmAddSimilarSong() {
  const song = pendingSimilarSong.value
  showSimilarSongNotice.value = false
  pendingSimilarSong.value = null
  similarSongMatch.value = null
  if (!song) return
  await addSongInternal(song, true)
}
</script>
