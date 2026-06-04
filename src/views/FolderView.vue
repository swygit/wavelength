<template>
  <AppLayout>
    <AppLoading v-if="pageLoading" />

    <template v-else>
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <RouterLink to="/dashboard" class="text-sm text-gray-400 hover:text-white inline-flex items-center gap-1 mb-2">
            ← Home
          </RouterLink>
          <h1 class="text-2xl font-bold flex items-center gap-2">
            <span>📁</span>
            <span v-if="!renamingHeader">{{ folder?.name }}</span>
            <input
              v-else
              ref="headerNameInput"
              v-model="headerEditName"
              class="bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-xl text-gray-100 focus:outline-none focus:border-brand-500"
              @keydown.enter="saveHeaderRename"
              @keydown.escape="cancelHeaderRename"
              @blur="saveHeaderRename"
            />
            <button
              v-if="!renamingHeader && folder"
              class="text-gray-500 hover:text-white text-sm px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
              title="Rename folder"
              @click="startHeaderRename"
            >
              ✏️
            </button>
          </h1>
          <p class="text-gray-400 text-sm mt-1">{{ folderGigs.length }} gig{{ folderGigs.length === 1 ? '' : 's' }} in this folder</p>
        </div>
        <div class="flex gap-2">
          <button class="btn-danger text-sm" @click="showDeleteConfirm = true">Delete folder</button>
        </div>
      </div>

      <!-- Search / Filter / Sort controls -->
      <div v-if="folderGigs.length > 0" class="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label for="folderSearch" class="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Search</label>
          <input
            id="folderSearch"
            v-model="searchQuery"
            type="text"
            class="w-full bg-gray-800 border border-gray-700 text-xs rounded px-2 py-1.5 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500"
            placeholder="Search gig name…"
          />
        </div>
        <div>
          <label for="folderFilter" class="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Filter</label>
          <select
            id="folderFilter"
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
          <label for="folderSort" class="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Sort</label>
          <select
            id="folderSort"
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

      <!-- Empty state -->
      <div v-if="folderGigs.length === 0" class="text-center py-16">
        <div class="text-6xl mb-4">📂</div>
        <h2 class="text-xl font-semibold mb-2">This folder is empty</h2>
        <p class="text-gray-400 mb-6">Drag gigs from your dashboard into this folder to organize them.</p>
        <RouterLink to="/dashboard" class="btn-primary">Back to home</RouterLink>
      </div>

      <!-- No results after filter -->
      <div v-else-if="displayedGigs.length === 0" class="text-center py-12">
        <p class="text-gray-400">No gigs match your search or filter.</p>
      </div>

      <!-- Gig cards -->
      <div v-else>
        <div class="flex items-center justify-end mb-3">
          <button
            class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
            :class="selectMode ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700'"
            @click="toggleSelectMode"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            {{ selectMode ? 'Cancel selection' : 'Select gigs' }}
          </button>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div
            v-for="gig in displayedGigs"
            :key="gig.id"
            class="card hover:border-brand-500 transition-colors group h-[7.5rem] overflow-hidden"
            :class="{
              'cursor-pointer': selectMode,
              'border-brand-500 bg-brand-950/30': selectedGigIds.includes(gig.id),
            }"
            @click="selectMode ? toggleGigSelection(gig.id) : null"
          >
            <template v-if="!selectMode">
              <RouterLink :to="`/gigs/${gig.id}`" class="block h-full">
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
            </template>
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

        <!-- Bulk action bar -->
        <div
          v-if="selectMode && selectedGigIds.length > 0"
          class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 shadow-xl flex items-center gap-3"
        >
          <span class="text-sm text-gray-300">{{ selectedGigIds.length }} selected</span>
          <button
            v-if="otherFolders.length"
            class="btn-primary text-sm py-1.5"
            @click="showBulkMoveModal = true"
          >
            Move to folder
          </button>
          <button class="btn-secondary text-sm py-1.5" @click="bulkRemoveFromFolder">
            Move to root
          </button>
          <button class="text-xs text-gray-500 hover:text-white transition-colors" @click="cancelSelect">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Delete folder confirmation modal -->
    <div
      v-if="showDeleteConfirm"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="showDeleteConfirm = false"
    >
      <div class="w-full max-w-md card border border-red-500/40">
        <h2 class="text-lg font-bold mb-2">Delete folder?</h2>
        <p class="text-sm text-gray-300 mb-4">
          This will delete the folder <span class="font-semibold text-white">"{{ folder?.name }}"</span>.
          All gigs inside will be moved back to the root directory. No gigs will be deleted.
        </p>
        <div class="flex justify-end gap-2">
          <button class="btn-secondary text-sm" @click="showDeleteConfirm = false">Cancel</button>
          <button class="btn-danger text-sm" :disabled="deleting" @click="handleDeleteFolder">
            {{ deleting ? 'Deleting…' : 'Delete folder' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Bulk move modal -->
    <div
      v-if="showBulkMoveModal"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="showBulkMoveModal = false"
    >
      <div class="w-full max-w-md card border border-gray-600">
        <h2 class="text-lg font-bold mb-3">Move {{ selectedGigIds.length }} gig{{ selectedGigIds.length === 1 ? '' : 's' }} to folder</h2>
        <div class="space-y-2 max-h-60 overflow-y-auto">
          <button
            v-for="f in otherFolders"
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
    </template>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppLayout from '../components/AppLayout.vue'
import AppLoading from '../components/AppLoading.vue'
import { useFolderStore } from '../stores/folders'
import { useGigStore } from '../stores/gigs'

const route = useRoute()
const router = useRouter()
const folderStore = useFolderStore()
const gigStore = useGigStore()
const { folders } = storeToRefs(folderStore)
const { gigs } = storeToRefs(gigStore)

const folder = ref(null)
const folderGigIds = ref([])
const pageLoading = ref(true)
const showDeleteConfirm = ref(false)
const deleting = ref(false)

// Bulk select state
const selectMode = ref(false)
const selectedGigIds = ref([])
const showBulkMoveModal = ref(false)

// Rename state
const renamingHeader = ref(false)
const headerEditName = ref('')
const headerNameInput = ref(null)

// Search / Filter / Sort
const searchQuery = ref('')
const filterMode = ref('all')
const sortMode = ref('newest')

const folderGigs = computed(() => {
  return gigs.value.filter((g) => folderGigIds.value.includes(g.id))
})

const filteredGigs = computed(() => {
  let list = folderGigs.value
  if (filterMode.value === 'open') list = list.filter((g) => g.status === 'open')
  else if (filterMode.value === 'closed') list = list.filter((g) => g.status === 'closed')
  else if (filterMode.value === 'owner') list = list.filter((g) => g.role === 'owner')
  else if (filterMode.value === 'member') list = list.filter((g) => g.role === 'member')
  return list
})

const searchedGigs = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return filteredGigs.value
  return filteredGigs.value.filter((g) => {
    return (g.name || '').toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q)
  })
})

const displayedGigs = computed(() => {
  const list = [...searchedGigs.value]
  if (sortMode.value === 'newest') return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  if (sortMode.value === 'oldest') return list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  if (sortMode.value === 'nameAsc') return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
  if (sortMode.value === 'nameDesc') return list.sort((a, b) => (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' }))
  return list
})

const otherFolders = computed(() => {
  return folders.value.filter((f) => f.id !== route.params.id)
})

function startHeaderRename() {
  headerEditName.value = folder.value?.name || ''
  renamingHeader.value = true
  nextTick(() => {
    headerNameInput.value?.focus()
    headerNameInput.value?.select()
  })
}

async function saveHeaderRename() {
  if (!renamingHeader.value) return
  const trimmed = headerEditName.value.trim()
  if (trimmed && trimmed !== folder.value?.name) {
    await folderStore.renameFolder(folder.value.id, trimmed)
    folder.value.name = trimmed
  }
  renamingHeader.value = false
}

function cancelHeaderRename() {
  renamingHeader.value = false
}

async function removeFromFolder(gigId) {
  await folderStore.removeGigFromFolder(gigId)
  folderGigIds.value = folderGigIds.value.filter((id) => id !== gigId)
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

async function bulkRemoveFromFolder() {
  try {
    for (const gigId of selectedGigIds.value) {
      await folderStore.removeGigFromFolder(gigId)
      folderGigIds.value = folderGigIds.value.filter((id) => id !== gigId)
    }
  } catch (e) {
    console.error('Bulk remove error:', e)
  }
  cancelSelect()
}

async function bulkMoveToFolder(targetFolderId) {
  try {
    for (const gigId of selectedGigIds.value) {
      await folderStore.moveGigToFolder(gigId, targetFolderId)
      folderGigIds.value = folderGigIds.value.filter((id) => id !== gigId)
    }
  } catch (e) {
    console.error('Bulk move error:', e)
  }
  showBulkMoveModal.value = false
  cancelSelect()
}

async function handleDeleteFolder() {
  deleting.value = true
  try {
    await folderStore.deleteFolder(route.params.id)
    router.push('/dashboard')
  } catch (e) {
    console.error('Delete folder error:', e)
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  try {
    await folderStore.fetchFolders()
    folder.value = folders.value.find((f) => f.id === route.params.id) || null

    if (!folder.value) {
      router.push('/dashboard')
      return
    }

    // Ensure gigs are loaded
    if (!gigs.value.length) {
      await gigStore.fetchMyGigs()
    }

    const folderGigsData = await folderStore.fetchFolderGigs(route.params.id)
    folderGigIds.value = folderGigsData.map((fg) => fg.gig_id)
  } catch (e) {
    console.error('Folder view load error:', e)
  } finally {
    pageLoading.value = false
  }
})
</script>
