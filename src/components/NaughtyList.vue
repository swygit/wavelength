<template>
  <div class="card">
    <h2 class="font-semibold mb-3">Members</h2>

    <div class="space-y-2 mb-4">
      <div
        v-for="member in memberList"
        :key="member.user_id"
        class="flex items-center justify-between text-sm"
      >
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-full bg-brand-900 flex items-center justify-center text-xs font-bold text-brand-400">
            {{ (member.display_name || 'A')[0].toUpperCase() }}
          </div>
          <span>{{ member.display_name || 'Unknown' }}</span>
          <span v-if="member.role === 'owner'" class="text-xs text-yellow-400">👑</span>
        </div>
        <span
          class="text-xs px-2 py-0.5 rounded-full"
          :class="member.hasVotedAll ? 'bg-green-900 text-green-300' : member.hasVotedSome ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900/60 text-red-300'"
        >
          {{ member.hasVotedAll ? '✓ Done' : member.hasVotedSome ? `${member.votedCount}/${totalSongs}` : 'No votes' }}
        </span>
      </div>
    </div>

    <!-- Naughty list -->
    <div v-if="naughtyList.length" class="border-t border-gray-700 pt-3">
      <h3 class="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">🎅 Naughty List</h3>
      <p class="text-xs text-gray-400 mb-2">Haven't finished voting:</p>
      <div class="space-y-1">
        <div
          v-for="member in naughtyList"
          :key="member.user_id"
          class="text-xs text-red-300 flex items-center gap-1"
        >
          <span>😈</span>
          <span>{{ member.display_name || 'Unknown' }}</span>
          <span class="text-gray-500">({{ member.votedCount }}/{{ totalSongs }})</span>
        </div>
      </div>
    </div>

    <!-- All done message -->
    <div v-else-if="memberList.length > 0" class="border-t border-gray-700 pt-3 text-xs text-green-400">
      🎉 Everyone has voted!
    </div>

    <!-- Invite code reminder -->
    <div class="border-t border-gray-700 pt-3 mt-3">
      <p class="text-xs text-gray-500 mb-1">Share invite code:</p>
      <div class="font-mono text-brand-400 text-lg tracking-widest font-bold text-center py-2 bg-gray-800 rounded-lg">
        {{ gig.invite_code }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  gig: { type: Object, required: true },
  songs: { type: Array, default: () => [] },
})

const totalSongs = computed(() => props.songs.length)

const memberList = computed(() => {
  if (!props.gig?.gig_members) return []
  return props.gig.gig_members.map((m) => {
    const votedSongs = props.songs.filter((s) => s.votes?.some((v) => v.user_id === m.user_id))
    const votedCount = votedSongs.length
    return {
      user_id: m.user_id,
      display_name: m.profiles?.display_name,
      role: m.role,
      votedCount,
      hasVotedAll: totalSongs.value > 0 && votedCount === totalSongs.value,
      hasVotedSome: votedCount > 0 && votedCount < totalSongs.value,
    }
  })
})

const naughtyList = computed(() =>
  memberList.value.filter((m) => m.votedCount < totalSongs.value)
)
</script>
