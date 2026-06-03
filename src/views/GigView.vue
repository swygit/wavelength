<template>
  <AppLayout>
    <AwayNotification :model-value="showActivityNotif" :summary="activitySummary" @close="closeActivityNotif" />

    <AppLoading v-if="pageLoading" />

    <div v-else-if="gig" class="max-w-5xl mx-auto">
      <!-- Gig header -->
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <RouterLink to="/dashboard" class="text-sm text-gray-400 hover:text-white inline-flex items-center gap-1 mb-2">
            ← Dashboard
          </RouterLink>
          <div class="flex items-center gap-2 mb-2">
            <h1 class="text-2xl font-bold">{{ gig.name }}</h1>
            <span class="text-xs px-2 py-1 rounded-full"
              :class="gig.status === 'open' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'"
            >
              {{ gig.status === 'open' ? 'Voting Open' : 'Voting Closed' }}
            </span>
          </div>
          <p v-if="gig.description" class="text-gray-400 text-sm mt-1">{{ gig.description }}</p>
        </div>
        <div class="flex flex-wrap gap-2 items-center">
          <!-- Owner controls -->
          <template v-if="isOwner">
            <button v-if="gig.status === 'open'" class="btn-danger text-sm h-[2.375rem] inline-flex items-center" @click="showCloseModal = true">Close voting</button>
            <button v-if="gig.status === 'closed'" class="btn-secondary text-sm h-[2.375rem] inline-flex items-center" @click="reopenVoting">Reopen voting</button>
            <RouterLink v-if="gig.status === 'closed'" :to="`/gigs/${gig.id}/summary`" class="btn-primary text-sm h-[2.375rem] inline-flex items-center">View summary</RouterLink>
            <button
              class="text-sm h-[2.375rem] px-3 rounded-lg border border-amber-600/70 bg-amber-900/30 text-amber-200 hover:bg-amber-900/45 transition-colors inline-flex items-center disabled:opacity-60 disabled:cursor-not-allowed"
              :disabled="transferableMembers.length === 0"
              :title="transferableMembers.length === 0 ? 'No other members to transfer to' : undefined"
              @click="openOwnerLeaveModal"
            >
              Transfer & leave
            </button>
            <button
              v-if="canDeleteGig"
              class="btn-danger text-sm px-3 py-0 h-[2.375rem] flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
              :disabled="deleteSaving"
              aria-label="Delete gig"
              title="Delete gig"
              @click="showDeleteModal = true"
            >
              <svg v-if="!deleteSaving" viewBox="0 0 24 24" class="w-[1.25rem] h-[1.25rem] shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <path d="M4 7H20" />
                <path d="M9 7V5H15V7" />
                <path d="M8 7L9 19H15L16 7" />
              </svg>
              <svg v-else viewBox="0 0 24 24" class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke-dasharray="56" stroke-dashoffset="14" />
              </svg>
            </button>
          </template>
          <template v-else>
            <RouterLink v-if="gig.status === 'closed'" :to="`/gigs/${gig.id}/summary`" class="btn-secondary text-sm h-[2.375rem] inline-flex items-center">View summary</RouterLink>
            <button
              class="text-sm h-[2.375rem] px-3 rounded-lg border border-amber-600/70 bg-amber-900/30 text-amber-200 hover:bg-amber-900/45 transition-colors inline-flex items-center disabled:opacity-60 disabled:cursor-not-allowed"
              :disabled="leaveSaving"
              @click="showLeaveModal = true"
            >
              {{ leaveSaving ? 'Leaving…' : 'Leave gig' }}
            </button>
          </template>
        </div>
      </div>

      <div class="mb-4">
        <AddSongPanel v-if="gig.status === 'open'" :gig-id="gigId" />
      </div>

      <!-- Two-column layout -->
      <div class="grid lg:grid-cols-3 gap-6">
        <!-- Song list (left / main) -->
        <div class="lg:col-span-2 space-y-4">
          <!-- Songs -->
          <AppLoading v-if="songStore.loading" />
          <div v-else-if="!songs.length" class="card text-center py-10 text-gray-400">
            <div class="text-4xl mb-3">🎵</div>
            <p>No songs yet. Search and add songs above.</p>
          </div>
          <div v-else-if="!filteredAndSortedSongs.length" class="card text-center py-10 text-gray-400">
            <div class="text-4xl mb-3">🔎</div>
            <p>No songs match your current search, filter, or sort settings.</p>
          </div>
          <SongCard
            v-else
            v-for="song in filteredAndSortedSongs"
            :key="song.id"
            :song="song"
            :voting-open="gig.status === 'open'"
            :selected="song.id === selectedSongId"
            :members-map="membersMap"
            :added-order="songAddedOrderMap[song.id]"
            @select="selectSong"
            @deleted="onSongDeleted"
          />
        </div>

        <!-- Sidebar (right) -->
        <div class="space-y-4">
          <div class="card">
            <div class="flex items-center justify-between mb-3">
              <h2 class="font-semibold">Songs Added</h2>
              <span class="text-xs text-gray-400">{{ filteredSongs.length }}/{{ songs.length }}</span>
            </div>

            <div class="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div class="sm:col-span-2">
                <label for="songsSearch" class="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Search</label>
                <input
                  id="songsSearch"
                  v-model="songsSearch"
                  type="text"
                  class="w-full bg-gray-800 border border-gray-700 text-xs rounded px-2 py-1.5 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500"
                  placeholder="Search title or artist…"
                />
              </div>

              <div>
                <label for="songsFilter" class="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Filter</label>
                <select
                  id="songsFilter"
                  v-model="songsFilter"
                  class="w-full bg-gray-800 border border-gray-700 text-xs rounded px-2 py-1.5 text-gray-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="all">All songs</option>
                  <option value="notVoted">Songs not voted on</option>
                  <option value="voted">Songs voted on</option>
                  <option value="addedByYou">Songs added by you</option>
                  <option value="notAddedByYou">Songs not added by you</option>
                </select>
              </div>

              <div>
                <label for="songsSort" class="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Sort</label>
                <select
                  id="songsSort"
                  v-model="songsSort"
                  class="w-full bg-gray-800 border border-gray-700 text-xs rounded px-2 py-1.5 text-gray-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="dateAddedNewest">Date added (newest first)</option>
                  <option value="dateAddedOldest">Date added (oldest first)</option>
                  <option value="titleAsc">Title (A-Z)</option>
                  <option value="titleDesc">Title (Z-A)</option>
                </select>
              </div>
            </div>

            <div v-if="!songs.length" class="text-xs text-gray-400">No songs added yet.</div>
            <div v-else-if="!filteredSongs.length" class="text-xs text-gray-400">No songs match this filter.</div>

            <div v-else class="max-h-[17.5rem] overflow-y-auto pr-1 space-y-1">
              <button
                v-for="song in filteredAndSortedSongs"
                :key="song.id"
                type="button"
                class="w-full text-left rounded-lg border px-2.5 py-2 transition-colors"
                :class="song.id === selectedSongId
                  ? 'border-brand-500/60 bg-brand-900/20'
                  : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800'"
                @click="selectSong(song)"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-start gap-2 min-w-0">
                    <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-700 text-[11px] font-semibold text-gray-200 mt-0.5">
                      {{ songAddedOrderMap[song.id] }}
                    </span>
                    <div class="min-w-0">
                      <p class="text-sm text-gray-100 truncate">{{ song.title }}</p>
                      <p class="text-xs text-gray-400 truncate">{{ song.artist || 'Unknown artist' }}</p>
                    </div>
                  </div>

                  <span
                    class="text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0"
                    :class="voteStatusBySongId[song.id].tone"
                  >
                    {{ voteStatusBySongId[song.id].label }}
                  </span>
                </div>
              </button>
            </div>
          </div>

          <div ref="songPlayerRef">
            <SongPlayer v-if="selectedSong" :song="selectedSong" @clear="selectedSongId = null" />
          </div>

          <NaughtyList :gig="gig" :songs="songs" />
        </div>
      </div>
    </div>

    <div v-else-if="!pageLoading" class="text-center py-16 text-gray-400">{{ gigError || 'Gig not found.' }}</div>

    <teleport to="body">
      <div
        v-if="deletedSongNotice"
        class="fixed inset-x-0 bottom-4 z-50 flex justify-end px-4 pointer-events-none"
      >
        <div class="w-[min(92vw,24rem)] card border border-red-500/40 bg-gray-900/95 shadow-xl pointer-events-auto">
          <p class="text-xs uppercase tracking-wide text-red-300">Song removed!</p>
          <p class="text-sm text-gray-100 mt-1 leading-relaxed">
            {{ deletedSongNotice.title }}
            <span v-if="deletedSongNotice.artist" class="text-gray-300"> by {{ deletedSongNotice.artist }}</span>
          </p>
        </div>
      </div>
    </teleport>

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

    <!-- Leave gig confirmation modal (member) -->
    <div
      v-if="showLeaveModal"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="showLeaveModal = false"
    >
      <div class="w-full max-w-md card border border-gray-700">
        <h2 class="text-lg font-bold mb-2">Leave this gig?</h2>
        <p class="text-sm text-gray-300 mb-2">You will be removed from this workspace.</p>
        <p class="text-xs text-gray-400 mb-6">Your songs, votes, reactions, and comments in this gig will be removed.</p>
        <div v-if="leaveError" class="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-3 py-2 mb-4 text-xs">
          {{ leaveError }}
        </div>
        <div class="flex justify-end gap-2">
          <button class="btn-secondary text-sm" @click="showLeaveModal = false">Cancel</button>
          <button class="btn-danger text-sm" :disabled="leaveSaving" @click="leaveAsMember">
            {{ leaveSaving ? 'Leaving…' : 'Yes, leave gig' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Transfer ownership and leave modal (owner) -->
    <div
      v-if="showOwnerLeaveModal"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="showOwnerLeaveModal = false"
    >
      <div class="w-full max-w-md card border border-gray-700">
        <h2 class="text-lg font-bold mb-2">Transfer ownership and leave</h2>
        <p class="text-sm text-gray-300 mb-3">Pick a new leader before leaving this gig.</p>

        <label class="text-xs text-gray-400 block mb-1" for="newOwner">New leader</label>
        <select id="newOwner" v-model="selectedNewOwnerId" class="input-field text-sm">
          <option value="">Select a member…</option>
          <option v-for="member in transferableMembers" :key="member.user_id" :value="member.user_id">
            {{ member.profiles?.display_name || 'Unknown member' }}
          </option>
        </select>

        <p class="text-xs text-gray-400 mt-3 mb-6">Your songs, votes, reactions, and comments in this gig will be removed after you leave.</p>

        <div v-if="leaveError" class="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-3 py-2 mb-4 text-xs">
          {{ leaveError }}
        </div>
        <div class="flex justify-end gap-2">
          <button class="btn-secondary text-sm" @click="showOwnerLeaveModal = false">Cancel</button>
          <button class="btn-danger text-sm" :disabled="leaveSaving || !selectedNewOwnerId" @click="transferAndLeave">
            {{ leaveSaving ? 'Processing…' : 'Transfer & Leave' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete gig confirmation modal (owner only when solo) -->
    <div
      v-if="showDeleteModal"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="showDeleteModal = false"
    >
      <div class="w-full max-w-md card border border-gray-700">
        <h2 class="text-lg font-bold mb-2">Delete this gig?</h2>
        <p class="text-sm text-gray-300 mb-2">This action is permanent and cannot be undone.</p>
        <p class="text-xs text-gray-400 mb-6">This is only available when you are the only member in the gig.</p>
        <div v-if="deleteError" class="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-3 py-2 mb-4 text-xs">
          {{ deleteError }}
        </div>
        <div class="flex justify-end gap-2">
          <button class="btn-secondary text-sm" @click="showDeleteModal = false">Cancel</button>
          <button class="btn-danger text-sm" :disabled="deleteSaving" @click="deleteGigAsOwner">
            {{ deleteSaving ? 'Deleting…' : 'Yes, delete gig' }}
          </button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppLayout from '../components/AppLayout.vue'
import AppLoading from '../components/AppLoading.vue'
import AddSongPanel from '../components/AddSongPanel.vue'
import SongCard from '../components/SongCard.vue'
import SongPlayer from '../components/SongPlayer.vue'
import NaughtyList from '../components/NaughtyList.vue'
import AwayNotification from '../components/AwayNotification.vue'
import { useGigStore } from '../stores/gigs'
import { useSongStore } from '../stores/songs'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'
import confetti from 'canvas-confetti'

const route = useRoute()
const router = useRouter()
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
const selectedSongId = ref(null)
const songsSearch = ref('')
const songsFilter = ref('all')
const songsSort = ref('dateAddedNewest')
const showLeaveModal = ref(false)
const showOwnerLeaveModal = ref(false)
const leaveSaving = ref(false)
const leaveError = ref('')
const selectedNewOwnerId = ref('')
const showDeleteModal = ref(false)
const deleteSaving = ref(false)
const deleteError = ref('')
const deletedSongNotice = ref(null)
let deletedSongNoticeTimer = null
let membershipChannel = null
const songPlayerRef = ref(null)
const showActivityNotif = ref(false)
const activitySummary = ref({
  new_songs: 0,
  vote_updates: [],
  reaction_updates: [],
  comment_updates: [],
})

const isOwner = computed(() => gig.value?.owner_id === authStore.user?.id)
const selectedSong = computed(() => songs.value.find((song) => song.id === selectedSongId.value) || null)
const songAddedOrderMap = computed(() => {
  const map = {}
  songs.value.forEach((song, idx) => {
    map[song.id] = idx + 1
  })
  return map
})
const voteStatusBySongId = computed(() => {
  const map = {}
  const myUserId = authStore.user?.id

  for (const song of songs.value) {
    if (!myUserId || song.added_by === myUserId) {
      map[song.id] = {
        label: 'Added by you',
        tone: 'border-gray-600 text-gray-300 bg-gray-800/80',
      }
      continue
    }

    const hasVoted = (song.votes || []).some((vote) => vote.user_id === myUserId && vote.value !== 0)
    map[song.id] = hasVoted
      ? { label: 'Voted', tone: 'border-green-600/60 text-green-200 bg-green-900/30' }
      : { label: 'Not voted', tone: 'border-red-600/60 text-red-200 bg-red-900/30' }
  }

  return map
})
const filteredSongs = computed(() => {
  if (songsFilter.value === 'all') return songs.value

  const myUserId = authStore.user?.id

  return songs.value.filter((song) => {
    const isAddedByMe = myUserId && song.added_by === myUserId
    const hasVoted = (song.votes || []).some((vote) => vote.user_id === myUserId && vote.value !== 0)

    if (songsFilter.value === 'addedByYou') return Boolean(isAddedByMe)
    if (songsFilter.value === 'notAddedByYou') return !isAddedByMe
    if (songsFilter.value === 'voted') return !isAddedByMe && hasVoted
    if (songsFilter.value === 'notVoted') return !isAddedByMe && !hasVoted

    return true
  })
})
const searchedFilteredSongs = computed(() => {
  const query = songsSearch.value.trim().toLowerCase()
  if (!query) return filteredSongs.value

  return filteredSongs.value.filter((song) => {
    const title = (song.title || '').toLowerCase()
    const artist = (song.artist || '').toLowerCase()
    return title.includes(query) || artist.includes(query)
  })
})
const filteredAndSortedSongs = computed(() => {
  const list = [...searchedFilteredSongs.value]

  if (songsSort.value === 'dateAddedNewest') {
    return list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
  }

  if (songsSort.value === 'titleAsc') {
    return list.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }))
  }

  if (songsSort.value === 'titleDesc') {
    return list.sort((a, b) => (b.title || '').localeCompare(a.title || '', undefined, { sensitivity: 'base' }))
  }

  // Default: keep add order as oldest first.
  return list.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
})
const membersMap = computed(() => {
  const map = {}
  for (const m of gig.value?.gig_members ?? []) {
    map[m.user_id] = m.profiles
  }
  return map
})

const transferableMembers = computed(() =>
  (gig.value?.gig_members ?? []).filter((member) => member.user_id !== authStore.user?.id)
)
const canDeleteGig = computed(() => isOwner.value && transferableMembers.value.length === 0)

onMounted(async () => {
  try {
    await gigStore.fetchGig(gigId)
    await songStore.fetchSongs(gigId)
    songStore.subscribeToGig(gigId)
    subscribeMembershipChanges()

    // Fetch activity summary while user was away
    const summary = await songStore.getActivitySummary(gigId)
    if (summary && (summary.new_songs > 0 || summary.vote_updates?.length > 0 || summary.reaction_updates?.length > 0 || summary.comment_updates?.length > 0)) {
      activitySummary.value = summary
      showActivityNotif.value = true
    }
    // Update last_visited_at now so next visit can detect new activity
    await songStore.updateLastVisited(gigId)
  } catch (e) {
    gigError.value = e.message
  } finally {
    pageLoading.value = false
  }
})

onBeforeUnmount(() => {
  songStore.unsubscribe()
  if (membershipChannel) {
    membershipChannel.unsubscribe()
    membershipChannel = null
  }
})

function subscribeMembershipChanges() {
  if (membershipChannel) membershipChannel.unsubscribe()

  membershipChannel = supabase
    .channel(`gig-membership-${gigId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gig_members', filter: `gig_id=eq.${gigId}` }, refreshGig)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gigs', filter: `id=eq.${gigId}` }, refreshGig)
    .subscribe()
}

function closeActivityNotif() {
  showActivityNotif.value = false
}

async function refreshGig() {
  try {
    await gigStore.fetchGig(gigId)
  } catch {
    // Best effort refresh to keep participant list up to date.
  }
}

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
    confetti({
      particleCount: 160,
      spread: 90,
      origin: { y: 0.55 },
      colors: ['#6366f1', '#a78bfa', '#34d399', '#fbbf24', '#f472b6'],
    })
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

async function selectSong(song) {
  selectedSongId.value = song?.id ?? null

  if (!song) return

  await nextTick()
  if (songPlayerRef.value?.scrollIntoView) {
    songPlayerRef.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function onSongDeleted(songMeta) {
  if (deletedSongNoticeTimer) {
    clearTimeout(deletedSongNoticeTimer)
    deletedSongNoticeTimer = null
  }

  deletedSongNotice.value = {
    title: songMeta?.title || 'Song',
    artist: songMeta?.artist || '',
  }

  deletedSongNoticeTimer = setTimeout(() => {
    deletedSongNotice.value = null
    deletedSongNoticeTimer = null
  }, 2800)
}

function openOwnerLeaveModal() {
  leaveError.value = ''
  selectedNewOwnerId.value = ''
  showOwnerLeaveModal.value = true
}

async function leaveAsMember() {
  leaveError.value = ''
  leaveSaving.value = true
  try {
    await gigStore.leaveGig(gigId)
    songStore.unsubscribe()
    await router.push('/dashboard')
  } catch (e) {
    leaveError.value = e.message || 'Failed to leave gig.'
  } finally {
    leaveSaving.value = false
  }
}

async function transferAndLeave() {
  if (!selectedNewOwnerId.value) {
    leaveError.value = 'Choose a new leader before leaving.'
    return
  }

  leaveError.value = ''
  leaveSaving.value = true
  try {
    await gigStore.transferOwnershipAndLeave(gigId, selectedNewOwnerId.value)
    songStore.unsubscribe()
    await router.push('/dashboard')
  } catch (e) {
    leaveError.value = e.message || 'Failed to transfer ownership and leave gig.'
  } finally {
    leaveSaving.value = false
  }
}

async function deleteGigAsOwner() {
  deleteError.value = ''
  deleteSaving.value = true
  try {
    await gigStore.deleteGig(gigId)
    songStore.unsubscribe()
    await router.push('/dashboard')
  } catch (e) {
    deleteError.value = e.message || 'Failed to delete gig.'
  } finally {
    deleteSaving.value = false
  }
}
</script>
