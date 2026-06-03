<template>
  <div class="card">
    <div class="flex items-start justify-between gap-3 mb-3">
      <div class="min-w-0">
        <h3 class="font-semibold text-sm">Now Playing</h3>
        <p class="text-sm truncate">{{ song.title }}</p>
        <p class="text-xs text-gray-400 truncate">{{ song.artist }}</p>
      </div>
      <button class="text-xs text-gray-400 hover:text-white" @click="$emit('clear')">Clear</button>
    </div>

    <div v-if="showPreviewAudio" class="rounded-lg border border-gray-700 p-3 bg-gray-900/60">
      <audio :src="song.preview_url" class="w-full" controls autoplay />
      <p class="text-xs text-gray-500 mt-2">Spotify preview (30s)</p>
    </div>

    <div v-else-if="isSpotifyEmbed" class="rounded-lg overflow-hidden border border-gray-700">
      <iframe
        :src="spotifyEmbedUrl"
        class="w-full"
        height="152"
        frameborder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    </div>

    <div v-else-if="isYouTubeEmbed" class="aspect-video rounded-lg overflow-hidden border border-gray-700">
      <iframe
        :src="youtubeEmbedUrl"
        class="w-full h-full"
        title="YouTube player"
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
      />
    </div>

    <div v-else class="rounded-lg border border-gray-700 p-3 bg-gray-900/60 text-xs text-gray-400">
      No playable source available for this song.
    </div>

    <div class="mt-3 text-xs text-gray-400 flex items-center justify-between gap-2">
      <span>If embed fails, open directly:</span>
      <a
        v-if="normalizedExternalUrl"
        :href="normalizedExternalUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-gray-200 hover:text-white underline"
        @click.prevent="openExternalLink(normalizedExternalUrl)"
      >
        Open source
      </a>
    </div>
  </div>

  <ExternalLinkNotice
    :model-value="Boolean(pendingExternalUrl)"
    :url="pendingExternalUrl || ''"
    @cancel="pendingExternalUrl = null"
    @confirm="confirmExternalLink"
  />
</template>

<script setup>
import { computed, ref } from 'vue'
import ExternalLinkNotice from './ExternalLinkNotice.vue'
import { normalizeExternalUrl } from '../lib/text'

const props = defineProps({
  song: { type: Object, required: true },
})

defineEmits(['clear'])

const normalizedSpotifyId = computed(() => normalizeSpotifyTrackId(props.song.spotify_id))
const normalizedYouTubeId = computed(() => normalizeYouTubeId(props.song.youtube_id || props.song.external_url))
const normalizedExternalUrl = computed(() => normalizeExternalUrl(props.song.external_url))
const pendingExternalUrl = ref(null)

const showPreviewAudio = computed(() => Boolean(props.song.preview_url))
const isSpotifyEmbed = computed(() => !showPreviewAudio.value && Boolean(normalizedSpotifyId.value))
const isYouTubeEmbed = computed(() => !showPreviewAudio.value && !isSpotifyEmbed.value && Boolean(normalizedYouTubeId.value))

const spotifyEmbedUrl = computed(() => {
  if (!normalizedSpotifyId.value) return ''
  return `https://open.spotify.com/embed/track/${normalizedSpotifyId.value}`
})

const youtubeEmbedUrl = computed(() => {
  if (!normalizedYouTubeId.value) return ''
  return `https://www.youtube.com/embed/${normalizedYouTubeId.value}?autoplay=1&playsinline=1&rel=0&modestbranding=1`
})

function openExternalLink(url) {
  pendingExternalUrl.value = normalizeExternalUrl(url)
}

function confirmExternalLink() {
  if (pendingExternalUrl.value && typeof window !== 'undefined') {
    window.open(pendingExternalUrl.value, '_blank', 'noopener,noreferrer')
  }
  pendingExternalUrl.value = null
}

function normalizeSpotifyTrackId(value) {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('spotify:track:')) {
    return trimmed.split(':').pop() || null
  }

  if (trimmed.includes('open.spotify.com/track/')) {
    const part = trimmed.split('/track/')[1] || ''
    return part.split('?')[0] || null
  }

  return trimmed
}

function normalizeYouTubeId(value) {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.includes('watch?v=')) {
    return (trimmed.split('watch?v=')[1] || '').split('&')[0] || null
  }

  if (trimmed.includes('youtu.be/')) {
    return (trimmed.split('youtu.be/')[1] || '').split('?')[0] || null
  }

  if (trimmed.includes('/embed/')) {
    return (trimmed.split('/embed/')[1] || '').split('?')[0] || null
  }

  return trimmed
}
</script>