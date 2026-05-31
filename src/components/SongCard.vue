<template>
  <div class="card relative" :class="selected ? 'ring-1 ring-brand-500/70' : ''">
    <div class="sm:hidden flex items-center justify-between gap-2 mb-3">
      <div v-if="!votingOpen" class="h-8 min-w-[4.5rem] rounded-full bg-gray-700/90 px-2 border border-gray-600 flex flex-col items-center justify-center leading-none">
        <span class="text-[9px] uppercase tracking-wide text-gray-300">Score</span>
        <span class="text-xs font-semibold" :class="song.score > 0 ? 'text-green-400' : song.score < 0 ? 'text-red-400' : 'text-gray-200'">
          {{ song.score > 0 ? '+' : '' }}{{ song.score }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="song.preview_url || song.youtube_id || song.spotify_id"
          class="w-8 h-8 rounded-full bg-gray-500 text-white flex items-center justify-center hover:bg-gray-400"
          aria-label="Play song"
          @click="selectForPlayback"
        >
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
            <path d="M8 6.5L17 12L8 17.5V6.5Z" />
          </svg>
        </button>

        <button
          v-if="isSongAdder && votingOpen"
          class="w-8 h-8 rounded-full bg-red-800/90 text-red-100 flex items-center justify-center hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label="Delete song"
          :disabled="isDeleting"
          @click="confirmDeleteSong"
        >
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M4 7H20" />
            <path d="M9 7V5H15V7" />
            <path d="M8 7L9 19H15L16 7" />
          </svg>
        </button>
      </div>
    </div>

    <div class="absolute top-3 right-3 hidden sm:flex items-center gap-2">
      <div v-if="!votingOpen" class="h-8 min-w-[4.5rem] rounded-full bg-gray-700/90 px-2 border border-gray-600 flex flex-col items-center justify-center leading-none">
        <span class="text-[9px] uppercase tracking-wide text-gray-300">Score</span>
        <span class="text-xs font-semibold" :class="song.score > 0 ? 'text-green-400' : song.score < 0 ? 'text-red-400' : 'text-gray-200'">
          {{ song.score > 0 ? '+' : '' }}{{ song.score }}
        </span>
      </div>

      <button
        v-if="song.preview_url || song.youtube_id || song.spotify_id"
        class="w-8 h-8 rounded-full bg-gray-500 text-white flex items-center justify-center hover:bg-gray-400"
        aria-label="Play song"
        @click="selectForPlayback"
      >
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
          <path d="M8 6.5L17 12L8 17.5V6.5Z" />
        </svg>
      </button>

      <button
        v-if="isSongAdder && votingOpen"
        class="w-8 h-8 rounded-full bg-red-800/90 text-red-100 flex items-center justify-center hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
        aria-label="Delete song"
        :disabled="isDeleting"
        @click="confirmDeleteSong"
      >
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M4 7H20" />
          <path d="M9 7V5H15V7" />
          <path d="M8 7L9 19H15L16 7" />
        </svg>
      </button>
    </div>

    <!-- Delete confirmation modal -->
    <teleport to="body">
      <div
        v-if="showDeleteModal"
        class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="showDeleteModal = false"
      >
        <div class="w-full max-w-md card border border-gray-700">
          <h2 class="text-lg font-bold mb-2">Delete this song?</h2>
          <p class="text-sm text-gray-300 mb-1">{{ song.title }} — {{ song.artist }}</p>
          <p class="text-xs text-gray-400 mb-6">This will permanently delete all votes, reactions, and comments on it.</p>
          <div v-if="deleteError" class="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-3 py-2 mb-4 text-xs">
            {{ deleteError }}
          </div>
          <div class="flex justify-end gap-2">
            <button class="btn-secondary text-sm" @click="showDeleteModal = false">Cancel</button>
            <button class="btn-danger text-sm" :disabled="isDeleting" @click="deleteSong">
              {{ isDeleting ? 'Deleting…' : 'Yes, delete song' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- Song header -->
    <div class="flex gap-3 mb-3">
      <!-- Album art -->
      <div class="relative flex-shrink-0">
        <img v-if="song.album_art" :src="song.album_art" :alt="song.album" class="w-14 h-14 rounded object-cover" />
        <div v-else class="w-14 h-14 rounded bg-gray-700 flex items-center justify-center text-2xl">🎵</div>

        <!-- Play button overlay -->
      </div>

      <!-- Info -->
      <div class="flex-1 min-w-0 sm:pr-40">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="font-semibold truncate">{{ song.title }}</div>
            <div class="text-sm text-gray-400 truncate">{{ song.artist }}</div>
            <div class="text-xs text-gray-500 truncate">{{ song.album }}</div>
            <!-- Added by -->
            <div v-if="adderProfile" class="flex items-center gap-1 mt-1.5">
              <img
                v-if="adderProfile.avatar_url"
                :src="adderProfile.avatar_url"
                :alt="adderProfile.display_name"
                class="w-4 h-4 rounded-full object-cover flex-shrink-0"
              />
              <div v-else class="w-4 h-4 rounded-full bg-brand-900 flex items-center justify-center text-[9px] font-bold text-brand-400 flex-shrink-0">
                {{ (adderProfile.display_name || 'A')[0].toUpperCase() }}
              </div>
              <span class="text-[10px] text-gray-500 truncate">{{ adderProfile.display_name }}</span>
            </div>
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

        </div>
      </div>
    </div>

    <!-- Voting controls -->
    <div v-if="votingOpen" class="flex items-center gap-2 mb-3">
      <button
        class="flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-all"
        :class="isSongAdder
          ? 'border-gray-700 text-gray-500 cursor-not-allowed opacity-60'
          : (song.myVote === 1
            ? 'bg-green-600 border-green-600 text-white'
            : 'border-gray-600 text-gray-300 hover:border-green-500 hover:text-green-400')"
        :disabled="isSongAdder"
        @click="vote(1)"
      >
        👍 Up
      </button>
      <button
        class="flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-all"
        :class="isSongAdder
          ? 'border-gray-700 text-gray-500 cursor-not-allowed opacity-60'
          : (song.myVote === -1
            ? 'bg-red-600 border-red-600 text-white'
            : 'border-gray-600 text-gray-300 hover:border-red-500 hover:text-red-400')"
        :disabled="isSongAdder"
        @click="vote(-1)"
      >
        👎 Down
      </button>
    </div>

    <div v-if="votingOpen && isSongAdder" class="mb-3 text-xs text-gray-400 bg-gray-800/70 border border-gray-700 rounded-lg px-3 py-2">
      You added this song, so you cannot vote on it.
    </div>

    <div v-if="deleteError" class="mb-3 text-xs text-red-300 bg-red-900/40 border border-red-800 rounded-lg px-3 py-2">
      {{ deleteError }}
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
          <img
            v-if="comment.profiles?.avatar_url"
            :src="comment.profiles.avatar_url"
            :alt="comment.profiles?.display_name || 'User avatar'"
            class="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5"
          />
          <div v-else class="w-6 h-6 rounded-full bg-brand-900 flex items-center justify-center text-xs font-bold text-brand-400 flex-shrink-0 mt-0.5">
            {{ (comment.profiles?.display_name || 'A')[0].toUpperCase() }}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-medium text-xs text-gray-300">{{ comment.profiles?.display_name || 'Unknown' }}</span>
              <span v-if="isEditedComment(comment)" class="text-[10px] text-gray-500">(Edited)</span>
              <button
                v-if="canEditComment(comment) && editingCommentId !== comment.id"
                type="button"
                class="text-[10px] text-gray-500 hover:text-white"
                @click="startEditComment(comment)"
              >
                Edit
              </button>
            </div>

            <template v-if="editingCommentId === comment.id">
              <form class="flex flex-col sm:flex-row gap-1 mt-1" @submit.prevent="saveEditedComment(comment)">
                <input
                  v-model="editCommentText"
                  type="text"
                  class="input-field text-xs flex-1 py-1"
                />
                <button type="submit" class="btn-secondary text-xs px-2 py-1 w-full sm:w-auto" :disabled="!editCommentText.trim()">Save</button>
                <button type="button" class="btn-secondary text-xs px-2 py-1 w-full sm:w-auto" @click="cancelEditComment">Cancel</button>
              </form>
            </template>
            <p v-else class="text-gray-300 mt-0.5">{{ comment.body }}</p>
          </div>
        </div>
        <div v-if="commentError" class="text-[10px] text-red-400">{{ commentError }}</div>
      </div>

      <form @submit.prevent="submitComment" class="flex flex-col sm:flex-row gap-2">
        <input
          v-model="commentText"
          type="text"
          class="input-field text-xs flex-1 py-1"
          placeholder="Add a comment…"
        />
        <button type="submit" class="btn-secondary text-xs px-2 py-1 w-full sm:w-auto" :disabled="!commentText.trim()">Post</button>
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
  selected: { type: Boolean, default: false },
  membersMap: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['select'])

const songStore = useSongStore()
const authStore = useAuthStore()

const showComments = ref(false)
const commentText = ref('')
const editingCommentId = ref(null)
const editCommentText = ref('')
const commentError = ref('')
const showDeleteModal = ref(false)
const isDeleting = ref(false)
const deleteError = ref('')
const isSongAdder = computed(() => props.song.added_by === authStore.user?.id)
const adderProfile = computed(() => props.membersMap[props.song.added_by] ?? null)

const reactionEmojis = ['❤️', '🔥', '👏', '😮', '🎸', '🤘']

function hasMyReaction(emoji) {
  return props.song.reactions?.some((r) => r.user_id === authStore.user?.id && r.emoji === emoji)
}

function reactionCount(emoji) {
  return props.song.reactions?.filter((r) => r.emoji === emoji).length || 0
}

function selectForPlayback() {
  emit('select', props.song)
}

function confirmDeleteSong() {
  deleteError.value = ''
  showDeleteModal.value = true
}

async function deleteSong() {
  isDeleting.value = true
  try {
    await songStore.removeSong(props.song.id)
    showDeleteModal.value = false
  } catch (e) {
    deleteError.value = e.message || 'Failed to delete song.'
  } finally {
    isDeleting.value = false
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

function canEditComment(comment) {
  return comment.user_id === authStore.user?.id
}

function startEditComment(comment) {
  commentError.value = ''
  editingCommentId.value = comment.id
  editCommentText.value = comment.body
}

function cancelEditComment() {
  editingCommentId.value = null
  editCommentText.value = ''
}

async function saveEditedComment(comment) {
  if (!editCommentText.value.trim()) return
  commentError.value = ''
  try {
    await songStore.updateComment(comment.id, editCommentText.value.trim())
    cancelEditComment()
  } catch (e) {
    commentError.value = e.message || 'Failed to update comment.'
  }
}

function isEditedComment(comment) {
  if (!comment?.updated_at || !comment?.created_at) return false
  return new Date(comment.updated_at).getTime() > new Date(comment.created_at).getTime()
}
</script>
