<template>
  <AppLayout>
    <AppLoading v-if="pageLoading" />

    <div v-else-if="gig" class="max-w-5xl mx-auto">
      <!-- Gig header -->
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <RouterLink to="/dashboard" class="text-sm text-gray-400 hover:text-white inline-flex items-center gap-1 mb-2">
            ← Dashboard
          </RouterLink>
          <h1 class="text-2xl font-bold">{{ gig.name }}</h1>
          <p v-if="gig.description" class="text-gray-400 text-sm mt-1">{{ gig.description }}</p>
        </div>
        <div class="flex flex-wrap gap-2 items-center">
          <!-- Status -->
          <span class="text-xs px-2 py-1 rounded-full"
            :class="gig.status === 'open' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'"
          >
            {{ gig.status === 'open' ? 'Voting Open' : 'Voting Closed' }}
          </span>

          <!-- Owner controls -->
          <template v-if="isOwner">
            <button v-if="gig.status === 'open'" class="btn-danger text-sm" @click="showCloseModal = true">Close Voting</button>
            <button v-if="gig.status === 'closed'" class="btn-secondary text-sm" @click="reopenVoting">Reopen Voting</button>
            <RouterLink v-if="gig.status === 'closed'" :to="`/gigs/${gig.id}/summary`" class="btn-primary text-sm">View Summary</RouterLink>
          </template>
          <template v-else>
            <RouterLink v-if="gig.status === 'closed'" :to="`/gigs/${gig.id}/summary`" class="btn-secondary text-sm">View Summary</RouterLink>
          </template>
        </div>
      </div>

      <!-- Two-column layout -->
      <div class="grid lg:grid-cols-3 gap-6">
        <!-- Song list (left / main) -->
        <div class="lg:col-span-2 space-y-4">
          <!-- Add Song -->
          <AddSongPanel :gig-id="gigId" />

          <!-- Songs -->
          <AppLoading v-if="songStore.loading" />
          <div v-else-if="!songs.length" class="card text-center py-10 text-gray-400">
            <div class="text-4xl mb-3">🎵</div>
            <p>No songs yet. Search and add songs above.</p>
          </div>
          <SongCard
            v-else
            v-for="song in songs"
            :key="song.id"
            :song="song"
            :voting-open="gig.status === 'open'"
          />
        </div>

        <!-- Sidebar (right) -->
        <div class="space-y-4">
          <!-- Members + Naughty List -->
          <NaughtyList :gig="gig" :songs="songs" />
        </div>
      </div>
    </div>

    <div v-else-if="!pageLoading" class="text-center py-16 text-gray-400">{{ gigError || 'Gig not found.' }}</div>

    <!-- Close voting confirmation modal -->
    <div
      v-if="showCloseModal"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="showCloseModal = false"
    >
      <div class="w-full max-w-md card border border-gray-700">
        <h2 class="text-lg font-bold mb-2">Close voting?</h2>
        <p class="text-sm text-gray-300 mb-2">Members can no longer cast votes once voting is closed.</p>
        <p class="text-xs text-gray-400 mb-6">You can reopen voting later if needed.</p>
        <div v-if="statusError" class="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-3 py-2 mb-4 text-xs">
          {{ statusError }}
        </div>
        <div class="flex justify-end gap-2">
          <button class="btn-secondary text-sm" @click="showCloseModal = false">Cancel</button>
          <button class="btn-danger text-sm" :disabled="statusSaving" @click="confirmCloseVoting">
            {{ statusSaving ? 'Closing…' : 'Yes, close voting' }}
          </button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppLayout from '../components/AppLayout.vue'
import AppLoading from '../components/AppLoading.vue'
import AddSongPanel from '../components/AddSongPanel.vue'
import SongCard from '../components/SongCard.vue'
import NaughtyList from '../components/NaughtyList.vue'
import { useGigStore } from '../stores/gigs'
import { useSongStore } from '../stores/songs'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const gigId = route.params.id

const gigStore = useGigStore()
const songStore = useSongStore()
const authStore = useAuthStore()

const { currentGig: gig } = storeToRefs(gigStore)
const { songs } = storeToRefs(songStore)

const gigError = ref(null)
const pageLoading = ref(true)
const showCloseModal = ref(false)
const statusSaving = ref(false)
const statusError = ref(null)

const isOwner = computed(() => gig.value?.owner_id === authStore.user?.id)

onMounted(async () => {
  try {
    await gigStore.fetchGig(gigId)
    await songStore.fetchSongs(gigId)
    songStore.subscribeToGig(gigId)
  } catch (e) {
    gigError.value = e.message
  } finally {
    pageLoading.value = false
  }
})

onBeforeUnmount(() => {
  songStore.unsubscribe()
})

async function closeVoting() {
  statusError.value = null
  statusSaving.value = true
  try {
    await Promise.race([
      gigStore.updateGigStatus(gigId, 'closed'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out. Please try again.')), 3000)),
    ])
  } catch (e) {
    statusError.value = e.message || 'Failed to close voting.'
    throw e
  } finally {
    statusSaving.value = false
  }
}

async function confirmCloseVoting() {
  try {
    await closeVoting()
    showCloseModal.value = false
  } catch {}
}

async function reopenVoting() {
  statusError.value = null
  statusSaving.value = true
  try {
    await Promise.race([
      gigStore.updateGigStatus(gigId, 'open'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out. Please try again.')), 3000)),
    ])
  } catch (e) {
    gigError.value = e.message || 'Failed to reopen voting.'
  } finally {
    statusSaving.value = false
  }
}
</script>
