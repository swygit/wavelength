<template>
  <AppLayout>
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold">Your gigs</h1>
          <p class="text-gray-400 text-sm mt-1">Select a gig or create a new one</p>
        </div>
        <div class="flex gap-2">
          <RouterLink to="/join" class="btn-secondary text-sm">Join gig</RouterLink>
          <RouterLink to="/gigs/new" class="btn-primary text-sm">+ New gig</RouterLink>
        </div>
      </div>

      <!-- Loading -->
      <AppLoading v-if="pageLoading" />

      <!-- Fetch error -->
      <div v-else-if="fetchError" class="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
        {{ fetchError }}
      </div>

      <!-- Empty state -->
      <div v-else-if="!gigs.length" class="text-center py-16">
        <div class="text-6xl mb-4">🎸</div>
        <h2 class="text-xl font-semibold mb-2">No gigs yet</h2>
        <p class="text-gray-400 mb-6">Create your first gig to start collaborating on a setlist.</p>
        <RouterLink to="/gigs/new" class="btn-primary">Create a gig</RouterLink>
      </div>

      <!-- Gig cards -->
      <div v-else class="grid gap-4 sm:grid-cols-2">
        <RouterLink
          v-for="gig in gigs"
          :key="gig.id"
          :to="`/gigs/${gig.id}`"
          class="card hover:border-brand-500 transition-colors group"
        >
          <div class="flex items-start justify-between mb-2">
            <h2 class="font-semibold group-hover:text-brand-400 transition-colors">{{ gig.name }}</h2>
            <span class="text-xs px-2 py-1 rounded-full"
              :class="gig.status === 'open' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'"
            >
              {{ gig.status === 'open' ? 'Voting Open' : 'Voting Closed' }}
            </span>
          </div>
          <p v-if="gig.description" class="text-sm text-gray-400 mb-3 line-clamp-2">{{ gig.description }}</p>
          <div class="flex items-center gap-3 text-xs text-gray-500">
            <span>{{ gig.role === 'owner' ? '👑 Owner' : '🎵 Member' }}</span>
            <span>Invite: <span class="font-mono text-brand-400">{{ gig.invite_code }}</span></span>
          </div>
        </RouterLink>
      </div>
    </div>

    <div
      v-if="activeLeaderNotice"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="dismissLeaderNotice"
    >
      <div class="w-full max-w-lg card border border-yellow-500/40">
        <p class="text-xs uppercase tracking-wide text-yellow-300">Leadership Update</p>
        <h2 class="text-lg font-bold mt-1">You were assigned as group leader</h2>
        <p class="text-sm text-gray-300 mt-3 leading-relaxed">
          You are now leading <span class="font-semibold text-white">{{ activeLeaderNotice.gigName }}</span>. You can manage voting and transfer leadership when needed.
        </p>
        <div class="mt-5 flex flex-col sm:flex-row sm:justify-end gap-2">
          <button class="btn-secondary text-sm w-full sm:w-auto" @click="dismissLeaderNotice">Not now</button>
          <RouterLink
            :to="`/gigs/${activeLeaderNotice.gigId}`"
            class="btn-primary text-sm w-full sm:w-auto"
            @click="openGigFromLeaderNotice"
          >
            Open gig
          </RouterLink>
        </div>
      </div>
    </div>

    <div
      v-else-if="activeClosedGigNotice"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="dismissClosedGigNotice"
    >
      <div class="w-full max-w-lg card border border-brand-500/40">
        <p class="text-xs uppercase tracking-wide text-brand-300">Voting Closed</p>
        <h2 class="text-lg font-bold mt-1">{{ activeClosedGigNotice.name }} is ready for final planning</h2>
        <p class="text-sm text-gray-300 mt-3 leading-relaxed">
          Voting has been closed by the owner. You can now view analytics, arrange the song order, and add song keys, notes, and voice memos.
        </p>
        <div class="mt-5 flex flex-col sm:flex-row sm:justify-end gap-2">
          <button class="btn-secondary text-sm w-full sm:w-auto" @click="dismissClosedGigNotice">Not now</button>
          <RouterLink
            :to="`/gigs/${activeClosedGigNotice.id}/summary`"
            class="btn-primary text-sm w-full sm:w-auto"
            @click="viewSummaryFromNotice"
          >
            View analytics
          </RouterLink>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppLayout from '../components/AppLayout.vue'
import AppLoading from '../components/AppLoading.vue'
import { useGigStore } from '../stores/gigs'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'

const gigStore = useGigStore()
const authStore = useAuthStore()
const { gigs } = storeToRefs(gigStore)
const pageLoading = ref(true)
const fetchError = ref(null)
const pendingClosedGigNotices = ref([])
const pendingLeaderNotices = ref([])

const closedNoticeStorageKey = computed(() => `wavelength.closedGigNotices.${authStore.user?.id || 'anon'}`)
const activeClosedGigNotice = computed(() => pendingClosedGigNotices.value[0] || null)
const activeLeaderNotice = computed(() => pendingLeaderNotices.value[0] || null)

async function fetchLeaderAssignmentNotices() {
  if (!authStore.user?.id) {
    pendingLeaderNotices.value = []
    return
  }

  const { data, error } = await withTimeout(
    supabase
      .from('user_notifications')
      .select('id, gig_id, created_at, gigs(name)')
      .eq('user_id', authStore.user.id)
      .eq('type', 'leader_assigned')
      .is('read_at', null)
      .order('created_at', { ascending: true }),
    15000,
    'Loading notifications timed out.'
  )

  if (error) throw new Error(error.message || 'Failed to load leader notifications.')

  pendingLeaderNotices.value = (data ?? []).map((notice) => ({
    id: notice.id,
    gigId: notice.gig_id,
    gigName: notice.gigs?.name || 'your gig',
  }))
}

async function markLeaderNoticeRead(noticeId) {
  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', noticeId)

  if (error) {
    throw new Error(error.message || 'Failed to update leader notification.')
  }
}

function getSeenClosedGigIds() {
  try {
    const raw = localStorage.getItem(closedNoticeStorageKey.value)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed)
  } catch {
    return new Set()
  }
}

function saveSeenClosedGigIds(ids) {
  try {
    localStorage.setItem(closedNoticeStorageKey.value, JSON.stringify([...ids]))
  } catch {
    // Ignore storage errors so dashboard remains usable.
  }
}

function markClosedGigSeen(gigId) {
  const seen = getSeenClosedGigIds()
  seen.add(gigId)
  saveSeenClosedGigIds(seen)
}

function queueClosedGigNotices() {
  const seen = getSeenClosedGigIds()
  pendingClosedGigNotices.value = gigs.value.filter(
    (gig) => gig.status === 'closed' && gig.role !== 'owner' && !seen.has(gig.id)
  )
}

function dismissClosedGigNotice() {
  const current = activeClosedGigNotice.value
  if (!current) return
  markClosedGigSeen(current.id)
  pendingClosedGigNotices.value = pendingClosedGigNotices.value.slice(1)
}

async function dismissLeaderNotice() {
  const current = activeLeaderNotice.value
  if (!current) return
  try {
    await markLeaderNoticeRead(current.id)
  } catch {
    // Keep moving so users are not blocked by transient notification errors.
  }
  pendingLeaderNotices.value = pendingLeaderNotices.value.slice(1)
}

async function openGigFromLeaderNotice() {
  await dismissLeaderNotice()
}

function viewSummaryFromNotice() {
  dismissClosedGigNotice()
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
  ])
}

onMounted(async () => {
  let justOnboarded = false
  try {
    justOnboarded = sessionStorage.getItem('wavelength.justOnboarded') === '1'
    if (justOnboarded) {
      sessionStorage.removeItem('wavelength.justOnboarded')
      pageLoading.value = false
    }
  } catch {
    // Ignore storage access issues and use default loading behavior.
  }

  try {
    await gigStore.fetchMyGigs()
    queueClosedGigNotices()
  } catch (e) {
    fetchError.value = e.message
  } finally {
    if (!justOnboarded) {
      pageLoading.value = false
    }
  }

  // Load notifications after primary page content is ready.
  try {
    await fetchLeaderAssignmentNotices()
  } catch (e) {
    console.warn('Leader notification fetch failed:', e)
  }
})
</script>
