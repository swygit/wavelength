<template>
  <AppLayout>
    <AppLoading v-if="loading" />

    <div v-else-if="gig" class="max-w-3xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <div>
          <RouterLink :to="`/gigs/${gigId}`" class="text-sm text-gray-400 hover:text-white inline-flex items-center gap-1 mb-2">
            ← Back to gig
          </RouterLink>
          <h1 class="text-2xl font-bold">Final Setlist</h1>
          <p class="text-gray-400 text-sm mt-1">{{ gig.name }}</p>
        </div>
        <span class="text-xs px-2 py-1 rounded-full bg-red-900 text-red-300">Voting Closed</span>
      </div>

      <!-- Ranked songs -->
      <div class="space-y-3">
        <div v-if="!sortedSongs.length" class="card text-center py-10 text-gray-400">
          No songs were added to this gig.
        </div>

        <div
          v-for="(song, idx) in sortedSongs"
          :key="song.id"
          class="card flex items-center gap-4"
        >
          <!-- Rank badge -->
          <div class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg"
            :class="idx === 0 ? 'bg-yellow-500 text-gray-900' : idx === 1 ? 'bg-gray-400 text-gray-900' : idx === 2 ? 'bg-amber-700 text-gray-100' : 'bg-gray-700 text-gray-300'"
          >
            {{ idx + 1 }}
          </div>

          <!-- Album art -->
          <img v-if="song.album_art" :src="song.album_art" :alt="song.album" class="w-12 h-12 rounded object-cover flex-shrink-0" />
          <div v-else class="w-12 h-12 rounded bg-gray-700 flex items-center justify-center flex-shrink-0 text-xl">🎵</div>

          <!-- Song info -->
          <div class="flex-1 min-w-0">
            <div class="font-semibold truncate">{{ song.title }}</div>
            <div class="text-sm text-gray-400 truncate">{{ song.artist }}</div>
            <div class="text-xs text-gray-500 mt-1">{{ song.album }}</div>
          </div>

          <!-- Score -->
          <div class="text-right flex-shrink-0">
            <div class="text-2xl font-bold" :class="song.score > 0 ? 'text-green-400' : song.score < 0 ? 'text-red-400' : 'text-gray-400'">
              {{ song.score > 0 ? '+' : '' }}{{ song.score }}
            </div>
            <div class="text-xs text-gray-500">{{ totalVoters }} voters</div>
          </div>
        </div>
      </div>

      <!-- Member participation summary -->
      <div class="card mt-8">
        <h2 class="font-semibold mb-4">Member Participation</h2>
        <div class="divide-y divide-gray-700">
          <div v-for="member in memberStats" :key="member.user_id" class="flex items-center justify-between py-3">
            <div class="flex items-center gap-3">
              <img
                v-if="member.avatar_url"
                :src="member.avatar_url"
                alt="Member avatar"
                class="w-8 h-8 rounded-full object-cover"
              />
              <div v-else class="w-8 h-8 rounded-full bg-brand-900 flex items-center justify-center text-sm font-bold text-brand-400">
                {{ (member.display_name || 'A')[0].toUpperCase() }}
              </div>
              <span class="text-sm">{{ member.display_name || 'Unknown' }}</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <span v-if="member.votedCount === songs.length" class="text-green-400">✓ Voted all</span>
              <span v-else-if="member.votedCount === 0" class="text-red-400">✗ No votes</span>
              <span v-else class="text-yellow-400">{{ member.votedCount }}/{{ songs.length }} voted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppLayout from '../components/AppLayout.vue'
import AppLoading from '../components/AppLoading.vue'
import { useGigStore } from '../stores/gigs'
import { useSongStore } from '../stores/songs'
import { supabase } from '../lib/supabase'

const route = useRoute()
const gigId = route.params.id

const gigStore = useGigStore()
const songStore = useSongStore()

const { currentGig: gig } = storeToRefs(gigStore)
const { songs } = storeToRefs(songStore)
const loading = ref(true)

const sortedSongs = computed(() => [...songs.value].sort((a, b) => b.score - a.score))

const totalVoters = computed(() => {
  if (!songs.value.length) return 0
  const voters = new Set(songs.value.flatMap((s) => s.votes.map((v) => v.user_id)))
  return voters.size
})

const memberStats = computed(() => {
  if (!gig.value?.gig_members) return []
  return gig.value.gig_members.map((m) => {
    const votedSongs = songs.value.filter((s) => s.votes.some((v) => v.user_id === m.user_id))
    return {
      user_id: m.user_id,
      display_name: m.profiles?.display_name,
      avatar_url: m.profiles?.avatar_url,
      votedCount: votedSongs.length,
    }
  })
})

onMounted(async () => {
  await gigStore.fetchGig(gigId)
  await songStore.fetchSongs(gigId)
  loading.value = false
})
</script>
