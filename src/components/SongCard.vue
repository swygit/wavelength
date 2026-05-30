<template>
  <div class="card">
    <!-- Song header -->
    <div class="flex gap-3 mb-3">
      <!-- Album art -->
      <div class="relative flex-shrink-0">
        <img v-if="song.album_art" :src="song.album_art" :alt="song.album" class="w-14 h-14 rounded object-cover" />
        <div v-else class="w-14 h-14 rounded bg-gray-700 flex items-center justify-center text-2xl">🎵</div>

        <!-- Play button overlay -->
        <button
          v-if="song.preview_url || song.youtube_id"
          class="absolute inset-0 flex items-center justify-center bg-black/60 rounded opacity-0 hover:opacity-100 transition-opacity"
          @click="togglePlay"
        >
          <span class="text-white text-xl">{{ isPlaying ? '⏸' : '▶' }}</span>
        </button>
      </div>

      <!-- Info -->
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="font-semibold truncate">{{ song.title }}</div>
            <div class="text-sm text-gray-400 truncate">{{ song.artist }}</div>
            <div class="text-xs text-gray-500 truncate">{{ song.album }}</div>
            <div class="mt-1">
              <span v-if="song.source === 'spotify'" class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-900/60 text-green-300">
                <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
                  <path d="M7.5 10.2C10.8 9.2 13.8 9.4 16.7 10.7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
                  <path d="M8.2 13.1C10.7 12.4 13 12.5 15.2 13.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                  <path d="M8.9 15.7C10.6 15.2 12.1 15.3 13.6 15.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                </svg>
                Spotify
              </span>
              <span v-else-if="song.source === 'youtube'" class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-900/60 text-red-300">
                <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <rect x="3" y="6" width="18" height="12" rx="3" fill="currentColor" />
                  <path d="M10 9.5L15 12L10 14.5V9.5Z" fill="#0f172a" />
                </svg>
                YouTube
              </span>
            </div>
          </div>

          <!-- Score badge -->
          <div class="flex-shrink-0 text-right">
            <div class="text-lg font-bold" :class="song.score > 0 ? 'text-green-400' : song.score < 0 ? 'text-red-400' : 'text-gray-400'">
              {{ song.score > 0 ? '+' : '' }}{{ song.score }}
            </div>
            <div class="text-xs text-gray-500">score</div>
          </div>
        </div>
      </div>
    </div>

    <!-- YouTube embed -->
    <div v-if="isPlaying && song.youtube_id && !song.preview_url" class="mb-3 aspect-video rounded-lg overflow-hidden">
      <iframe
        :src="`https://www.youtube.com/embed/${song.youtube_id}?autoplay=1`"
        class="w-full h-full"
        allow="autoplay; encrypted-media"
        allowfullscreen
      />
    </div>

    <!-- Hidden audio for Spotify preview -->
    <audio
      v-if="song.preview_url"
      ref="audioRef"
      :src="song.preview_url"
      @ended="isPlaying = false"
    />

    <!-- Voting controls -->
    <div v-if="votingOpen" class="flex items-center gap-2 mb-3">
      <button
        class="flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-all"
        :class="song.myVote === 1 ? 'bg-green-600 border-green-600 text-white' : 'border-gray-600 text-gray-300 hover:border-green-500 hover:text-green-400'"
        @click="vote(1)"
      >
        👍 Up
      </button>
      <button
        class="flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-all"
        :class="song.myVote === -1 ? 'bg-red-600 border-red-600 text-white' : 'border-gray-600 text-gray-300 hover:border-red-500 hover:text-red-400'"
        @click="vote(-1)"
      >
        👎 Down
      </button>
    </div>

    <!-- Reactions row -->
    <div class="flex flex-wrap gap-2 mb-3">
      <button
        v-for="emoji in reactionEmojis"
        :key="emoji"
        class="flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-all"
        :class="hasMyReaction(emoji) ? 'bg-brand-700 border-brand-500 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'"
        @click="react(emoji)"
      >
        {{ emoji }} {{ reactionCount(emoji) || '' }}
      </button>
    </div>

    <!-- Comments section -->
    <div class="border-t border-gray-700 pt-3">
      <button
        class="text-xs text-gray-400 hover:text-white mb-2 transition-colors"
        @click="showComments = !showComments"
      >
        💬 {{ song.comments?.length || 0 }} comment{{ song.comments?.length === 1 ? '' : 's' }}
        {{ showComments ? '▲' : '▼' }}
      </button>

      <div v-if="showComments" class="space-y-2 mb-2">
        <div v-for="comment in song.comments" :key="comment.id" class="flex gap-2 text-sm">
          <div class="w-6 h-6 rounded-full bg-brand-900 flex items-center justify-center text-xs font-bold text-brand-400 flex-shrink-0 mt-0.5">
            {{ (comment.profiles?.display_name || 'A')[0].toUpperCase() }}
          </div>
          <div>
            <span class="font-medium text-xs text-gray-300">{{ comment.profiles?.display_name || 'Unknown' }}</span>
            <p class="text-gray-300 mt-0.5">{{ comment.body }}</p>
          </div>
        </div>
      </div>

      <form @submit.prevent="submitComment" class="flex gap-2">
        <input
          v-model="commentText"
          type="text"
          class="input-field text-xs flex-1 py-1"
          placeholder="Add a comment…"
        />
        <button type="submit" class="btn-secondary text-xs px-2 py-1" :disabled="!commentText.trim()">Post</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useSongStore } from '../stores/songs'
import { useAuthStore } from '../stores/auth'

const props = defineProps({
  song: { type: Object, required: true },
  votingOpen: { type: Boolean, default: true },
})

const songStore = useSongStore()
const authStore = useAuthStore()

const audioRef = ref(null)
const isPlaying = ref(false)
const showComments = ref(false)
const commentText = ref('')

const reactionEmojis = ['❤️', '🔥', '👏', '😮', '🎸', '🤘']

function hasMyReaction(emoji) {
  return props.song.reactions?.some((r) => r.user_id === authStore.user?.id && r.emoji === emoji)
}

function reactionCount(emoji) {
  return props.song.reactions?.filter((r) => r.emoji === emoji).length || 0
}

function togglePlay() {
  if (props.song.preview_url && audioRef.value) {
    if (isPlaying.value) {
      audioRef.value.pause()
    } else {
      audioRef.value.play()
    }
    isPlaying.value = !isPlaying.value
  } else if (props.song.youtube_id) {
    isPlaying.value = !isPlaying.value
  }
}

async function vote(value) {
  // Toggle off if same vote
  const newValue = props.song.myVote === value ? 0 : value
  await songStore.castVote(props.song.id, newValue)
}

async function react(emoji) {
  await songStore.toggleReaction(props.song.id, emoji)
}

async function submitComment() {
  if (!commentText.value.trim()) return
  await songStore.addComment(props.song.id, commentText.value.trim())
  commentText.value = ''
  showComments.value = true
}
</script>
