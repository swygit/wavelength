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
          <button class="btn-primary text-sm" @click="showCreateFolder = true">+ Add folder</button>
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

      <!-- Empty state (no gigs, no folders) -->
      <div v-else-if="!gigs.length && !folders.length" class="text-center py-16">
        <div class="text-6xl mb-4">🎸</div>
        <h2 class="text-xl font-semibold mb-2">No gigs yet</h2>
        <p class="text-gray-400 mb-6">Create your first gig to start collaborating on a setlist.</p>
        <RouterLink to="/gigs/new" class="btn-primary">Create a gig</RouterLink>
      </div>

      <template v-else>
        <!-- Folders section -->
        <div v-if="folders.length" class="mb-6">
          <div class="grid gap-4 sm:grid-cols-2">
            <FolderCard
              v-for="f in folders"
              :key="f.id"
              :folder="f"
              :gig-count="folderGigCounts[f.id] || 0"
              @open="openFolder"
              @delete="confirmDeleteFolder"
              @rename="handleRenameFolder"
              @drop-gig="handleDropGigOnFolder"
              @reorder="handleFolderReorder"
            />
          </div>
        </div>

        <!-- No gigs prompt (has folders but no gigs) -->
        <div v-if="!gigs.length" class="text-center py-16">
          <div class="text-6xl mb-4">🎸</div>
          <h2 class="text-xl font-semibold mb-2">No gigs yet</h2>
          <p class="text-gray-400 mb-6">Create your first gig to start collaborating on a setlist.</p>
          <RouterLink to="/gigs/new" class="btn-primary">Create a gig</RouterLink>
        </div>

        <!-- Root gigs -->
        <div v-if="rootGigs.length">
          <!-- Search / Filter / Sort controls -->
          <div class="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label for="dashSearch" class="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Search</label>
              <input
                id="dashSearch"
                v-model="searchQuery"
                type="text"
                class="w-full bg-gray-800 border border-gray-700 text-xs rounded px-2 py-1.5 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500"
                placeholder="Search gig name…"
              />
            </div>
            <div>
              <label for="dashFilter" class="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Filter</label>
              <select
                id="dashFilter"
                v-model="filterMode"
                class="w-full bg-gray-800 border border-gray-700 text-xs rounded px-2 py-1.5 text-gray-200 focus:outline-none focus:border-brand-500"
              >
                <option value="all">All gigs</option>
                <option value="open">Voting open</option>
                <option value="closed">Voting closed</option>
                <option value="owner">Owned by you</option>
                <option value="member">Joined as member</option>
              </select>
            </div>
            <div>
              <label for="dashSort" class="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Sort</label>
              <select
                id="dashSort"
                v-model="sortMode"
                class="w-full bg-gray-800 border border-gray-700 text-xs rounded px-2 py-1.5 text-gray-200 focus:outline-none focus:border-brand-500"
              >
                <option value="newest">Date added (newest)</option>
                <option value="oldest">Date added (oldest)</option>
                <option value="nameAsc">Name (A-Z)</option>
                <option value="nameDesc">Name (Z-A)</option>
              </select>
            </div>
          </div>

          <div class="flex items-center justify-between mb-3">
            <span v-if="displayedRootGigs.length !== rootGigs.length" class="text-xs text-gray-500">
              Showing {{ displayedRootGigs.length }} of {{ rootGigs.length }}
            </span>
            <span v-else></span>
            <button
              v-if="folders.length"
              class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
              :class="selectMode ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700'"
              @click="toggleSelectMode"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              {{ selectMode ? 'Cancel selection' : 'Select gigs' }}
            </button>
          </div>

          <!-- No results -->
          <div v-if="displayedRootGigs.length === 0" class="text-center py-12">
            <p class="text-gray-400">No gigs match your search or filter.</p>
          </div>

          <div v-else class="grid gap-4 sm:grid-cols-2">
            <div
              v-for="gig in displayedRootGigs"
              :key="gig.id"
              class="card hover:border-brand-500 transition-colors group h-[7.5rem] overflow-hidden"
              :class="{
                'cursor-grab active:cursor-grabbing': !selectMode,
                'cursor-pointer': selectMode,
                'border-brand-500 bg-brand-950/30': selectedGigIds.includes(gig.id),
              }"
              :draggable="!selectMode"
              @dragstart="!selectMode && handleDragStart($event, gig.id)"
              @dragend="handleDragEnd"
              @click="selectMode ? toggleGigSelection(gig.id) : null"
            >
              <RouterLink v-if="!selectMode" :to="`/gigs/${gig.id}`" class="block h-full">
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
              <div v-else class="flex items-start gap-3">
                <div class="mt-1 w-4 h-4 rounded border flex items-center justify-center shrink-0"
                  :class="selectedGigIds.includes(gig.id) ? 'bg-brand-600 border-brand-500' : 'border-gray-600'"
                >
                  <svg v-if="selectedGigIds.includes(gig.id)" class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between mb-2">
                    <h2 class="font-semibold">{{ gig.name }}</h2>
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
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bulk action bar -->
        <div
          v-if="selectMode && selectedGigIds.length > 0"
          class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 shadow-xl flex items-center gap-3"
        >
          <span class="text-sm text-gray-300">{{ selectedGigIds.length }} selected</span>
          <button
            class="btn-primary text-sm py-1.5"
            @click="showBulkMoveModal = true"
          >
            Move to folder
          </button>
          <button class="btn-secondary text-sm py-1.5" @click="cancelSelect">Cancel</button>
        </div>
      </template>
    </div>

    <!-- Bulk move to folder modal -->
    <div
      v-if="showBulkMoveModal"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="showBulkMoveModal = false"
    >
      <div class="w-full max-w-md card border border-gray-600">
        <h2 class="text-lg font-bold mb-3">Move {{ selectedGigIds.length }} gig{{ selectedGigIds.length === 1 ? '' : 's' }} to folder</h2>
        <div class="space-y-2 max-h-60 overflow-y-auto">
          <button
            v-for="f in folders"
            :key="f.id"
            class="w-full text-left px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
            @click="bulkMoveToFolder(f.id)"
          >
            📁 {{ f.name }}
          </button>
        </div>
        <div class="flex justify-end mt-4">
          <button class="btn-secondary text-sm" @click="showBulkMoveModal = false">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Create folder modal -->
    <div
      v-if="showCreateFolder"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="showCreateFolder = false"
    >
      <div class="w-full max-w-md card border border-gray-600">
        <h2 class="text-lg font-bold mb-3">Create a folder</h2>
        <input
          ref="folderNameInput"
          v-model="newFolderName"
          type="text"
          class="input-field mb-4"
          placeholder="Folder name…"
          maxlength="50"
          @keydown.enter="handleCreateFolder"
        />
        <div class="flex justify-end gap-2">
          <button class="btn-secondary text-sm" @click="showCreateFolder = false">Cancel</button>
          <button class="btn-primary text-sm" :disabled="!newFolderName.trim() || creatingFolder" @click="handleCreateFolder">
            {{ creatingFolder ? 'Creating…' : 'Create' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete folder confirmation modal -->
    <div
      v-if="folderToDelete"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="folderToDelete = null"
    >
      <div class="w-full max-w-md card border border-red-500/40">
        <h2 class="text-lg font-bold mb-2">Delete folder?</h2>
        <p class="text-sm text-gray-300 mb-4">
          This will delete <span class="font-semibold text-white">"{{ folderToDelete.name }}"</span>.
          All gigs inside will be moved back to the root. No gigs will be deleted.
        </p>
        <div class="flex justify-end gap-2">
          <button class="btn-secondary text-sm" @click="folderToDelete = null">Cancel</button>
          <button class="btn-danger text-sm" :disabled="deletingFolder" @click="handleDeleteFolder">
            {{ deletingFolder ? 'Deleting…' : 'Delete folder' }}
          </button>
        </div>
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
import { computed, onMounted, ref, nextTick, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppLayout from '../components/AppLayout.vue'
import AppLoading from '../components/AppLoading.vue'
import FolderCard from '../components/FolderCard.vue'
import { useGigStore } from '../stores/gigs'
import { useAuthStore } from '../stores/auth'
import { useFolderStore } from '../stores/folders'
import { supabase } from '../lib/supabase'

const router = useRouter()
const gigStore = useGigStore()
const authStore = useAuthStore()
const folderStore = useFolderStore()
const { gigs } = storeToRefs(gigStore)
const { folders } = storeToRefs(folderStore)
const pageLoading = ref(true)
const fetchError = ref(null)
const pendingClosedGigNotices = ref([])
const pendingLeaderNotices = ref([])

// Folder state
const gigFolderMap = ref({}) // gigId -> folderId
const showCreateFolder = ref(false)
const newFolderName = ref('')
const creatingFolder = ref(false)
const folderNameInput = ref(null)
const folderToDelete = ref(null)
const deletingFolder = ref(false)

// Bulk select state
const selectMode = ref(false)
const selectedGigIds = ref([])
const showBulkMoveModal = ref(false)

const rootGigs = computed(() => {
  return gigs.value.filter((g) => !gigFolderMap.value[g.id])
})

// Search / Filter / Sort for root gigs
const searchQuery = ref('')
const filterMode = ref('all')
const sortMode = ref('newest')

const filteredRootGigs = computed(() => {
  let list = rootGigs.value
  if (filterMode.value === 'open') list = list.filter((g) => g.status === 'open')
  else if (filterMode.value === 'closed') list = list.filter((g) => g.status === 'closed')
  else if (filterMode.value === 'owner') list = list.filter((g) => g.role === 'owner')
  else if (filterMode.value === 'member') list = list.filter((g) => g.role === 'member')
  return list
})

const searchedRootGigs = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return filteredRootGigs.value
  return filteredRootGigs.value.filter((g) => {
    return (g.name || '').toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q)
  })
})

const displayedRootGigs = computed(() => {
  const list = [...searchedRootGigs.value]
  if (sortMode.value === 'newest') return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  if (sortMode.value === 'oldest') return list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  if (sortMode.value === 'nameAsc') return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
  if (sortMode.value === 'nameDesc') return list.sort((a, b) => (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' }))
  return list
})

const folderGigCounts = computed(() => {
  const counts = {}
  for (const [gigId, folderId] of Object.entries(gigFolderMap.value)) {
    if (folderId) {
      counts[folderId] = (counts[folderId] || 0) + 1
    }
  }
  return counts
})

watch(showCreateFolder, (val) => {
  if (val) {
    newFolderName.value = ''
    nextTick(() => folderNameInput.value?.focus())
  }
})

function openFolder(folderId) {
  router.push(`/folders/${folderId}`)
}

async function handleCreateFolder() {
  if (!newFolderName.value.trim()) return
  creatingFolder.value = true
  try {
    await folderStore.createFolder(newFolderName.value)
    showCreateFolder.value = false
  } catch (e) {
    console.error('Create folder error:', e)
  } finally {
    creatingFolder.value = false
  }
}

async function handleRenameFolder(folderId, newName) {
  try {
    await folderStore.renameFolder(folderId, newName)
  } catch (e) {
    console.error('Rename folder error:', e)
  }
}

function confirmDeleteFolder(folderId) {
  folderToDelete.value = folders.value.find((f) => f.id === folderId) || null
}

async function handleDeleteFolder() {
  if (!folderToDelete.value) return
  deletingFolder.value = true
  try {
    const folderId = folderToDelete.value.id
    await folderStore.deleteFolder(folderId)
    // Remove all gig mappings for this folder
    for (const [gigId, mappedFolderId] of Object.entries(gigFolderMap.value)) {
      if (mappedFolderId === folderId) {
        delete gigFolderMap.value[gigId]
      }
    }
    folderToDelete.value = null
  } catch (e) {
    console.error('Delete folder error:', e)
  } finally {
    deletingFolder.value = false
  }
}

function handleDragStart(event, gigId) {
  event.dataTransfer.setData('text/gig-id', gigId)
  event.dataTransfer.effectAllowed = 'move'
}

function handleDragEnd() {
  // No-op, cleanup handled by drop targets
}

async function handleDropGigOnFolder(folderId, gigId) {
  try {
    await folderStore.addGigToFolder(folderId, gigId)
    gigFolderMap.value = { ...gigFolderMap.value, [gigId]: folderId }
  } catch (e) {
    console.error('Drop gig on folder error:', e)
  }
}

async function handleFolderReorder(draggedId, targetId, side) {
  const ids = folders.value.map((f) => f.id)
  const fromIndex = ids.indexOf(draggedId)
  if (fromIndex === -1) return
  // Remove dragged folder from list
  ids.splice(fromIndex, 1)
  // Find target position after removal
  let toIndex = ids.indexOf(targetId)
  if (toIndex === -1) return
  if (side === 'after') toIndex++
  ids.splice(toIndex, 0, draggedId)
  // Optimistic update
  const folderMap = Object.fromEntries(folders.value.map((f) => [f.id, f]))
  folderStore.folders = ids.map((id, i) => ({ ...folderMap[id], position: i }))
  try {
    await folderStore.reorderFolders(ids)
  } catch (e) {
    console.error('Reorder folders error:', e)
    await folderStore.fetchFolders()
  }
}

function toggleSelectMode() {
  selectMode.value = !selectMode.value
  selectedGigIds.value = []
}

function cancelSelect() {
  selectMode.value = false
  selectedGigIds.value = []
}

function toggleGigSelection(gigId) {
  if (selectedGigIds.value.includes(gigId)) {
    selectedGigIds.value = selectedGigIds.value.filter((id) => id !== gigId)
  } else {
    selectedGigIds.value = [...selectedGigIds.value, gigId]
  }
}

async function bulkMoveToFolder(folderId) {
  try {
    for (const gigId of selectedGigIds.value) {
      await folderStore.addGigToFolder(folderId, gigId)
      gigFolderMap.value = { ...gigFolderMap.value, [gigId]: folderId }
    }
  } catch (e) {
    console.error('Bulk move error:', e)
  }
  showBulkMoveModal.value = false
  cancelSelect()
}

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
    // Load folders and gig-folder mapping
    await folderStore.fetchFolders()
    gigFolderMap.value = await folderStore.getGigFolderMap()
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
