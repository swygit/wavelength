<template>
  <teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="$emit('close')"
    >
      <div class="w-full max-w-2xl card border border-brand-500/30 bg-brand-950/40">
        <div class="flex items-start justify-between mb-4">
          <h2 class="text-xl font-bold text-brand-300 flex items-center gap-2">
            <span class="text-2xl">👋</span>
            While you were away...
          </h2>
          <button
            type="button"
            class="text-gray-400 hover:text-white"
            @click="$emit('close')"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="space-y-3 text-sm text-gray-100 max-h-[60vh] overflow-y-auto">
          <!-- New songs -->
          <div v-if="summary.new_songs > 0" class="flex items-start gap-3 p-3 rounded-lg bg-blue-900/20 border border-blue-700/40">
            <span class="text-lg">🎵</span>
            <div>
              <span class="font-semibold text-blue-300">{{ summary.new_songs }} new {{ summary.new_songs === 1 ? 'song' : 'songs' }} added</span>
              <p class="text-gray-400 text-xs mt-1">Check them out in the list below</p>
            </div>
          </div>

          <!-- Vote updates -->
          <div v-for="vote in summary.vote_updates" :key="`vote-${vote.song_id}`" class="flex items-start gap-3 p-3 rounded-lg bg-green-900/20 border border-green-700/40">
            <span class="text-lg">👍</span>
            <div>
              <span class="font-semibold text-green-300">{{ vote.count }} new {{ vote.count === 1 ? 'vote' : 'votes' }} on</span>
              <p class="text-gray-200 truncate">{{ vote.title }}</p>
            </div>
          </div>

          <!-- Reaction updates -->
          <div v-for="reaction in summary.reaction_updates" :key="`reaction-${reaction.song_id}`" class="flex items-start gap-3 p-3 rounded-lg bg-purple-900/20 border border-purple-700/40">
            <span class="text-lg">🎉</span>
            <div>
              <span class="font-semibold text-purple-300">{{ reaction.count }} new {{ reaction.count === 1 ? 'reaction' : 'reactions' }} on</span>
              <p class="text-gray-200 truncate">{{ reaction.title }}</p>
            </div>
          </div>

          <!-- Comment updates -->
          <div v-for="comment in summary.comment_updates" :key="`comment-${comment.song_id}`" class="flex items-start gap-3 p-3 rounded-lg bg-amber-900/20 border border-amber-700/40">
            <span class="text-lg">💬</span>
            <div>
              <span class="font-semibold text-amber-300">{{ comment.count }} new {{ comment.count === 1 ? 'comment' : 'comments' }} on</span>
              <p class="text-gray-200 truncate">{{ comment.title }}</p>
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="btn-primary text-sm"
            @click="$emit('close')"
          >
            Got it, let's go
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  summary: {
    type: Object,
    default: () => ({
      new_songs: 0,
      vote_updates: [],
      reaction_updates: [],
      comment_updates: [],
    }),
  },
})

defineEmits(['close'])
</script>
