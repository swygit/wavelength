<template>
  <div class="card">
    <h2 class="font-semibold mb-3">Add Songs</h2>

    <!-- Search source tabs -->
    <div class="flex gap-1 mb-3 bg-gray-800 rounded-lg p-1">
      <button
        v-for="src in sources"
        :key="src.id"
        class="flex-1 py-1.5 text-xs font-medium rounded transition-colors"
        :class="activeSource === src.id ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'"
        @click="activeSource = src.id"
      >
        {{ src.label }}
      </button>
    </div>

    <!-- Search input -->
    <form @submit.prevent="handleSearch" class="flex gap-2 mb-3">
      <input
        v-model="query"
        type="text"
        class="input-field flex-1 text-sm"
        :placeholder="activeSource === 'spotify' ? 'Search Spotify tracks…' : 'Search YouTube videos…'"
        :disabled="searching"
      />
      <button type="submit" class="btn-primary text-sm px-3" :disabled="!query.trim() || searching">
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
</template>

<script setup>
import { ref } from 'vue'
import { searchSpotifyTracks } from '../lib/spotify'
import { searchYouTubeVideos } from '../lib/youtube'
import { useSongStore } from '../stores/songs'

const props = defineProps({ gigId: { type: String, required: true } })

const songStore = useSongStore()

const sources = [
  { id: 'spotify', label: '🎵 Spotify' },
  { id: 'youtube', label: '▶ YouTube' },
]

const activeSource = ref('spotify')
const query = ref('')
const results = ref([])
const searching = ref(false)
const searchError = ref(null)
const adding = ref(null)

async function handleSearch() {
  if (!query.value.trim()) return
  searching.value = true
  searchError.value = null
  results.value = []
  try {
    if (activeSource.value === 'spotify') {
      results.value = await searchSpotifyTracks(query.value)
    } else {
      results.value = await searchYouTubeVideos(query.value)
    }
  } catch (e) {
    searchError.value = e.message
  } finally {
    searching.value = false
  }
}

async function addSong(song) {
  const key = song.spotifyId || song.youtubeId
  adding.value = key
  try {
    await songStore.addSong(props.gigId, song)
    results.value = results.value.filter((r) => (r.spotifyId || r.youtubeId) !== key)
  } catch (e) {
    searchError.value = e.message
  } finally {
    adding.value = null
  }
}
</script>
