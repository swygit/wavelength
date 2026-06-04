<template>
  <AppLayout>
    <AppLoading v-if="pageLoading" />

    <div v-else-if="loadError" class="card max-w-3xl mx-auto border-red-700/60 bg-red-900/20 text-red-100">
      <h2 class="font-semibold text-base">Could not load arrangement</h2>
      <p class="text-sm text-red-200/90 mt-2">{{ loadError }}</p>
      <RouterLink :to="`/gigs/${gigId}/summary`" class="btn-secondary text-sm mt-4">Back to summary</RouterLink>
    </div>

    <div v-else class="max-w-5xl mx-auto">
      <!-- Header -->
      <div class="mb-6">
        <div class="flex items-center justify-between">
          <RouterLink :to="`/gigs/${gigId}/summary`" class="text-sm text-gray-400 hover:text-white inline-flex items-center gap-1 mb-3">
            ← Back to summary
          </RouterLink>
        </div>
        <div class="flex items-center gap-3">
          <img v-if="song?.album_art" :src="song.album_art" :alt="song.album" class="w-14 h-14 rounded object-cover flex-shrink-0" />
          <div v-else class="w-14 h-14 rounded bg-gray-700 flex items-center justify-center flex-shrink-0 text-2xl">🎵</div>
          <div class="min-w-0">
            <h1 class="text-xl font-bold truncate">{{ song?.title }}</h1>
            <p class="text-sm text-gray-400 truncate">{{ song?.artist }}<span v-if="song?.album" class="text-gray-500"> · {{ song.album }}</span></p>
          </div>
        </div>
      </div>

      <!-- Two-column layout -->
      <div class="grid lg:grid-cols-3 gap-6">
        <!-- Sections (left / main) -->
        <div class="lg:col-span-2">
      <!-- Sections -->
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-semibold text-lg">Sections</h2>
        <div class="flex items-center gap-2">
          <button class="btn-secondary text-xs" :disabled="!sections.length" @click="copyArrangementAsText">
            Export arrangement
          </button>
          <span v-if="exportStatus === 'copied'" class="text-[11px] text-green-400">Copied</span>
          <span v-else-if="exportStatus === 'error'" class="text-[11px] text-red-400">Copy failed</span>
          <button class="btn-secondary text-xs" @click="showAddSection = true">+ Add section</button>
        </div>
      </div>

      <div v-if="!sections.length" class="card text-center py-10 text-gray-400">
        No sections yet. Add sections like Intro, Verse 1, Chorus 1, Bridge, etc.
      </div>

      <div v-else class="space-y-4">
        <template v-for="(section, sectionIdx) in (hasActiveFilters ? filteredSections : sections)" :key="section.id">
        <div v-show="isSectionVisible(section)" class="card">
          <!-- Section header -->
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-700 text-xs font-bold text-white flex-shrink-0">{{ sectionIdx + 1 }}</span>
              <h3 v-if="editingSectionId !== section.id" class="font-semibold">{{ section.name }}</h3>
              <input
                v-else
                ref="sectionNameInput"
                v-model="editSectionName"
                class="bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
                @keydown.enter="saveSectionRename(section)"
                @keydown.escape="editingSectionId = null"
                @blur="saveSectionRename(section)"
              />
            </div>
            <div class="flex items-center gap-1">
              <button
                class="text-gray-500 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
                title="Rename section"
                @click="startSectionRename(section)"
              >
                ✏️
              </button>
              <button
                class="text-gray-500 hover:text-red-400 text-xs px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
                title="Delete section"
                @click="confirmDeleteSection(section)"
              >
                🗑️
              </button>
            </div>
          </div>

          <!-- Enrolled instruments in this section -->
          <draggable
            :model-value="getVisibleRoles(section.id)"
            @update:model-value="onRoleReorder(section.id, $event)"
            :item-key="(roleId) => roleId"
            handle=".role-drag-handle"
            :animation="200"
            class="space-y-3"
          >
            <template #item="{ element: roleId }">
            <div
              class="bg-gray-800/50 border border-gray-700 rounded-lg p-3"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="role-drag-handle cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 select-none">⠿</span>
                  <span>{{ getRoleById(roleId)?.icon }}</span>
                  <span class="text-sm font-medium">{{ getRoleById(roleId)?.name }}</span>
                  <template v-if="getRoleById(roleId)?.profiles">
                    <span class="text-gray-600 text-[10px]">·</span>
                    <img
                      v-if="getRoleById(roleId).profiles.avatar_url"
                      :src="getRoleById(roleId).profiles.avatar_url"
                      :alt="getRoleById(roleId).profiles.display_name"
                      class="w-4 h-4 rounded-full object-cover"
                    />
                    <span
                      v-else
                      class="w-4 h-4 rounded-full bg-brand-700 flex items-center justify-center text-[9px] font-bold text-white"
                    >{{ (getRoleById(roleId).profiles.display_name || '?')[0].toUpperCase() }}</span>
                    <span class="text-xs text-gray-400">{{ getRoleById(roleId).profiles.display_name }}</span>
                  </template>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    v-if="!editingEntries.has(memoKey(section.id, roleId))"
                    class="text-xs text-gray-400 hover:text-white transition-colors"
                    @click="editingEntries.add(memoKey(section.id, roleId))"
                  >
                    Edit
                  </button>
                  <button
                    v-else
                    class="text-xs font-medium px-2 py-0.5 rounded bg-brand-600 hover:bg-brand-500 text-white transition-colors"
                    @click="saveEntry(section.id, roleId)"
                  >
                    Save
                  </button>
                  <button
                    class="text-xs text-gray-500 hover:text-red-400 transition-colors"
                    title="Remove from section"
                    @click="confirmUnenroll(section.id, roleId)"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <!-- Read-only view -->
              <div v-if="!editingEntries.has(memoKey(section.id, roleId))" class="pl-6 space-y-1.5">
                <p v-if="getEntryField(section.id, roleId, 'notes')" class="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{{ getEntryField(section.id, roleId, 'notes') }}</p>
                <div v-if="getEntryField(section.id, roleId, 'voice_memo_url')" class="flex items-center gap-2">
                  <button
                    class="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
                    @click="toggleMemoPlay(section.id, roleId)"
                  >
                    <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="currentColor">
                      <path v-if="playingMemoKey !== memoKey(section.id, roleId)" d="M8 6.5L17 12L8 17.5V6.5Z" />
                      <rect v-else x="6" y="6" width="4" height="12" rx="1" />
                      <rect v-if="playingMemoKey === memoKey(section.id, roleId)" x="14" y="6" width="4" height="12" rx="1" />
                    </svg>
                    {{ playingMemoKey === memoKey(section.id, roleId) ? 'Pause' : 'Play memo' }}
                  </button>
                </div>
                <div v-if="getEntryField(section.id, roleId, 'link_url')">
                  <a
                    href="#"
                    class="text-xs text-brand-400 hover:text-brand-300 underline truncate max-w-[260px] inline-block"
                    :title="getEntryField(section.id, roleId, 'link_url')"
                    @click.prevent="openExternalLink(getEntryField(section.id, roleId, 'link_url'))"
                  >
                    {{ formatLinkDisplay(getEntryField(section.id, roleId, 'link_url')) }}
                  </a>
                </div>
                <p v-if="!getEntryField(section.id, roleId, 'notes') && !getEntryField(section.id, roleId, 'voice_memo_url') && !getEntryField(section.id, roleId, 'link_url')" class="text-xs text-gray-600 italic">No content yet</p>
              </div>

              <!-- Editing view -->
              <div v-else class="pl-6 space-y-3">
                <!-- Notes -->
                <div>
                  <label class="text-[10px] uppercase tracking-wide text-gray-500 mb-1 block">Notes</label>
                  <textarea
                    :value="getEntryField(section.id, roleId, 'notes')"
                    rows="2"
                    class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 resize-none focus:outline-none focus:border-brand-500"
                    placeholder="Add notes for this part…"
                    @input="saveEntryNotes(section.id, roleId, $event.target.value)"
                  />
                </div>
                <!-- Voice memo -->
                <div>
                  <label class="text-[10px] uppercase tracking-wide text-gray-500 mb-1 block">Voice Memo</label>
                  <div class="flex items-center gap-2">
                    <input
                      :ref="el => setMemoInput(section.id, roleId, el)"
                      type="file"
                      accept=".mp3,.wav,.m4a,.ogg,.webm,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/webm"
                      class="hidden"
                      @change="onMemoSelected(section.id, roleId, $event)"
                    />
                    <template v-if="getEntryField(section.id, roleId, 'voice_memo_url')">
                      <button
                        class="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
                        @click="toggleMemoPlay(section.id, roleId)"
                      >
                        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="currentColor">
                          <path v-if="playingMemoKey !== memoKey(section.id, roleId)" d="M8 6.5L17 12L8 17.5V6.5Z" />
                          <rect v-else x="6" y="6" width="4" height="12" rx="1" />
                          <rect v-if="playingMemoKey === memoKey(section.id, roleId)" x="14" y="6" width="4" height="12" rx="1" />
                        </svg>
                        {{ playingMemoKey === memoKey(section.id, roleId) ? 'Pause' : 'Play memo' }}
                      </button>
                      <button class="text-[10px] text-gray-500 hover:text-gray-300" @click="openMemoPicker(section.id, roleId)">
                        Replace
                      </button>
                      <button class="text-[10px] text-gray-500 hover:text-red-400" @click="deleteMemo(section.id, roleId)">
                        Delete
                      </button>
                    </template>
                    <button
                      v-else
                      class="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
                      @click="openMemoPicker(section.id, roleId)"
                    >
                      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="currentColor">
                        <rect x="9" y="3" width="6" height="11" rx="3" />
                        <path d="M5 11a7 7 0 0014 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <path d="M12 18v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                      Upload memo
                    </button>
                    <span v-if="uploadingMemoKey === memoKey(section.id, roleId)" class="text-[10px] text-gray-500">Uploading…</span>
                  </div>
                </div>
                <!-- Link -->
                <div>
                  <label class="text-[10px] uppercase tracking-wide text-gray-500 mb-1 block">Link</label>
                  <input
                    :value="getEntryField(section.id, roleId, 'link_url')"
                    type="url"
                    class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-brand-500"
                    placeholder="Paste a link (chord chart, reference, etc.)…"
                    @input="saveEntryLink(section.id, roleId, $event.target.value)"
                  />
                </div>
              </div>
            </div>
            </template>
          </draggable>

            <!-- No instruments enrolled -->
            <div v-if="getVisibleRoles(section.id).length === 0" class="text-sm text-gray-500 italic">
              {{ sectionFilterRole ? 'This role is not in this section.' : 'No instruments added to this section yet.' }}
            </div>

          <!-- Add instrument to section -->
          <div v-if="getUnenrolledRoles(section.id).length > 0" class="mt-3 pt-3 border-t border-gray-700">
            <div class="relative inline-block">
              <button
                class="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
                @click="openEnrollDropdown = openEnrollDropdown === section.id ? null : section.id"
              >
                + Add role
              </button>
              <div
                v-if="openEnrollDropdown === section.id"
                class="absolute left-0 top-full mt-1 z-20 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[12rem] max-h-48 overflow-y-auto"
              >
                <button
                  v-for="role in getUnenrolledRoles(section.id)"
                  :key="role.id"
                  class="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 transition-colors flex items-center gap-2"
                  @click="handleEnroll(section.id, role.id); openEnrollDropdown = null"
                >
                  <span>{{ role.icon }}</span>
                  <span>{{ role.name }}</span>
                  <template v-if="role.profiles">
                    <span class="text-gray-600">·</span>
                    <img
                      v-if="role.profiles.avatar_url"
                      :src="role.profiles.avatar_url"
                      :alt="role.profiles.display_name"
                      class="w-3.5 h-3.5 rounded-full object-cover"
                    />
                    <span
                      v-else
                      class="w-3.5 h-3.5 rounded-full bg-brand-700 flex items-center justify-center text-[8px] font-bold text-white"
                    >{{ (role.profiles.display_name || '?')[0].toUpperCase() }}</span>
                    <span class="text-gray-400">{{ role.profiles.display_name }}</span>
                  </template>
                </button>
              </div>
            </div>
          </div>
        </div>
        </template>
      </div>
        </div>

        <!-- Sidebar (right) -->
        <div class="space-y-4">
          <!-- Sections overview (draggable reorder) -->
          <div class="card">
            <h2 class="font-semibold text-sm mb-2">Sections</h2>

            <div class="space-y-2 mb-3">
              <div>
                <label class="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Search</label>
                <input
                  v-model="sectionSearch"
                  type="text"
                  class="w-full bg-gray-800 border border-gray-700 text-xs rounded px-2 py-1.5 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500"
                  placeholder="Search sections…"
                />
              </div>
              <div>
                <label class="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Filter</label>
                <select
                  v-model="sectionFilterRole"
                  class="w-full bg-gray-800 border border-gray-700 text-xs rounded px-2 py-1.5 text-gray-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="">All roles</option>
                  <option v-for="role in roles" :key="role.id" :value="role.id">{{ role.icon }} {{ role.name }}</option>
                </select>
              </div>
            </div>

            <div v-if="!sections.length" class="text-xs text-gray-500">No sections yet.</div>
            <draggable
              v-else
              v-model="sections"
              item-key="id"
              handle=".sidebar-section-handle"
              :animation="150"
              class="space-y-1"
              @end="onSectionReorder"
            >
              <template #item="{ element: sec, index: idx }">
                <div class="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-800/60 border border-gray-700/50">
                  <div class="sidebar-section-handle cursor-grab text-gray-500 hover:text-gray-300 flex items-center">
                    <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
                      <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                      <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                      <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                    </svg>
                  </div>
                  <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-700 text-[10px] font-bold text-white flex-shrink-0">{{ idx + 1 }}</span>
                  <span class="text-sm text-gray-200 truncate">{{ sec.name }}</span>
                </div>
              </template>
            </draggable>
          </div>

          <div class="card">
            <h2 class="font-semibold text-sm mb-2">Instrument Roles</h2>
            <div class="flex flex-col gap-1.5">
              <div v-if="!roles.length" class="text-xs text-gray-500">No roles defined yet.</div>
              <div
                v-for="role in roles"
                :key="role.id"
                class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-800/60 border border-gray-700/50"
              >
                <span class="text-sm">{{ role.icon }}</span>
                <span class="text-sm font-medium text-gray-200">{{ role.name }}</span>
                <template v-if="role.profiles">
                  <div class="ml-auto flex items-center gap-1.5">
                    <img
                      v-if="role.profiles.avatar_url"
                      :src="role.profiles.avatar_url"
                      :alt="role.profiles.display_name"
                      class="w-4 h-4 rounded-full object-cover"
                    />
                    <span
                      v-else
                      class="w-4 h-4 rounded-full bg-brand-700 flex items-center justify-center text-[9px] font-bold text-white"
                    >{{ (role.profiles.display_name || '?')[0].toUpperCase() }}</span>
                    <span class="text-xs text-gray-400">{{ role.profiles.display_name }}</span>
                  </div>
                </template>
                <span v-else class="ml-auto text-[10px] text-gray-600 italic">unassigned</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Section modal -->
    <div
      v-if="showAddSection"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="showAddSection = false"
    >
      <div class="w-full max-w-md card border border-gray-600">
        <h2 class="text-lg font-bold mb-3">Add Section</h2>
        <div class="mb-3">
          <label class="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Name</label>
          <input
            ref="sectionInputRef"
            v-model="newSectionName"
            type="text"
            class="input-field"
            placeholder="e.g. Intro, Verse 1, Chorus, Bridge…"
            maxlength="50"
            @keydown.enter="handleCreateSection"
          />
        </div>
        <div class="mb-4">
          <p class="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Quick add:</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="preset in sectionPresets"
              :key="preset"
              class="text-xs px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-300 hover:border-brand-500 hover:text-white transition-colors"
              @click="newSectionName = preset"
            >
              {{ preset }}
            </button>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <button class="btn-secondary text-sm" @click="showAddSection = false">Cancel</button>
          <button class="btn-primary text-sm" :disabled="!newSectionName.trim() || creatingSection" @click="handleCreateSection">
            {{ creatingSection ? 'Adding…' : 'Add section' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete section confirmation -->
    <div
      v-if="sectionToDelete"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="sectionToDelete = null"
    >
      <div class="w-full max-w-md card border border-red-500/40">
        <h2 class="text-lg font-bold mb-2">Delete section?</h2>
        <p class="text-sm text-gray-300 mb-4">
          This will remove <span class="font-semibold text-white">"{{ sectionToDelete.name }}"</span> and all its entries.
        </p>
        <div class="flex justify-end gap-2">
          <button class="btn-secondary text-sm" @click="sectionToDelete = null">Cancel</button>
          <button class="btn-danger text-sm" @click="handleDeleteSection">Delete</button>
        </div>
      </div>
    </div>

    <!-- Remove role from section confirmation -->
    <div
      v-if="unenrollTarget"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="unenrollTarget = null"
    >
      <div class="w-full max-w-md card border border-red-500/40">
        <h2 class="text-lg font-bold mb-2">Remove role from section?</h2>
        <p class="text-sm text-gray-300 mb-4">
          This will remove <span class="font-semibold text-white">{{ getRoleById(unenrollTarget.roleId)?.icon }} {{ getRoleById(unenrollTarget.roleId)?.name }}</span> and any notes, memos, or links for this role in this section.
        </p>
        <div class="flex justify-end gap-2">
          <button class="btn-secondary text-sm" @click="unenrollTarget = null">Cancel</button>
          <button class="btn-danger text-sm" @click="handleUnenroll">Remove</button>
        </div>
      </div>
    </div>

    <!-- In-app link viewer -->
    <teleport to="body">
      <div
        v-if="pendingExternalLink"
        class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col"
        @click.self="pendingExternalLink = null"
      >
        <div class="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
          <span class="text-xs text-gray-400 truncate max-w-[70%]">{{ pendingExternalLink }}</span>
          <div class="flex items-center gap-3">
            <a
              :href="pendingExternalLink"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-brand-400 hover:text-brand-300"
            >Open in new tab ↗</a>
            <button class="text-xs text-gray-400 hover:text-white" @click="pendingExternalLink = null">✕ Close</button>
          </div>
        </div>
        <iframe
          :src="pendingExternalLink"
          class="flex-1 w-full bg-white"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          referrerpolicy="no-referrer"
        />
      </div>
    </teleport>

    <!-- Hidden audio element for memo playback -->
    <audio ref="memoAudioEl" class="hidden" @ended="playingMemoKey = null" />
  </AppLayout>
</template>

<script setup>
import { ref, computed, reactive, onMounted, nextTick, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import draggable from 'vuedraggable'
import AppLayout from '../components/AppLayout.vue'
import AppLoading from '../components/AppLoading.vue'
import { useGigStore } from '../stores/gigs'
import { useSongStore } from '../stores/songs'
import { useArrangementStore } from '../stores/arrangements'

const route = useRoute()
const gigId = route.params.gigId
const songId = route.params.songId

const gigStore = useGigStore()
const songStore = useSongStore()
const arrangementStore = useArrangementStore()

const { songs } = storeToRefs(songStore)
const { roles, sections, entries } = storeToRefs(arrangementStore)

const song = computed(() => songs.value.find((s) => s.id === songId) || null)

const pageLoading = ref(true)
const loadError = ref('')

// Section state
const showAddSection = ref(false)
const newSectionName = ref('')
const creatingSection = ref(false)
const sectionInputRef = ref(null)
const sectionToDelete = ref(null)
const editingSectionId = ref(null)
const editSectionName = ref('')
const sectionNameInput = ref(null)

// Section filter/search
const sectionSearch = ref('')
const sectionFilterRole = ref('')

const isSectionVisible = (section) => {
  if (sectionSearch.value.trim()) {
    const q = sectionSearch.value.trim().toLowerCase()
    if (!section.name.toLowerCase().includes(q)) return false
  }
  return true
}

const filteredSections = computed(() => sections.value.filter(isSectionVisible))

const hasActiveFilters = computed(() => sectionSearch.value.trim() || sectionFilterRole.value)

function getVisibleRoles(sectionId) {
  const enrolled = getEnrolledRoles(sectionId)
  if (!sectionFilterRole.value) return enrolled
  return enrolled.filter((roleId) => roleId === sectionFilterRole.value)
}

function onRoleReorder(sectionId, newOrder) {
  if (!sectionFilterRole.value) {
    // No filter active: full reorder
    sectionRoleOrder[sectionId] = newOrder
    arrangementStore.reorderEntriesInSection(sectionId, newOrder)
  }
  // When filtered to a single role, dragging is a no-op (only one item)
}

// Export state
const exportStatus = ref('idle')
let exportStatusTimer = null

function buildArrangementText() {
  const lines = [
    `Arrangement: ${song.value?.title || 'Untitled'} - ${song.value?.artist || 'Unknown'}`,
    `Generated: ${new Date().toLocaleString()}`,
    '',
  ]

  const filteredRoleName = sectionFilterRole.value
    ? getRoleById(sectionFilterRole.value)?.name
    : null

  if (filteredRoleName) {
    lines.push(`Filtered by role: ${filteredRoleName}`)
    lines.push('')
  }

  if (!sections.value.length) {
    lines.push('No sections defined.')
    return lines.join('\n')
  }

  for (const section of sections.value) {
    const visibleRoleIds = getVisibleRoles(section.id)

    lines.push(`[${section.name}]`)

    if (!visibleRoleIds.length) {
      lines.push('')
      continue
    }

    for (const roleId of visibleRoleIds) {
      const role = getRoleById(roleId)
      const roleName = role ? `${role.icon} ${role.name}` : 'Unknown'
      const notes = getEntryField(section.id, roleId, 'notes')
      const link = getEntryField(section.id, roleId, 'link_url')

      if (!notes && !link) {
        lines.push(`  ${roleName}: (empty)`)
      } else {
        lines.push(`  ${roleName}:`)
        if (notes) lines.push(`    ${notes.replace(/\n/g, '\n    ')}`)
        if (link) lines.push(`    Link: ${link}`)
      }
    }

    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

async function copyArrangementAsText() {
  const text = buildArrangementText()
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    exportStatus.value = 'copied'
  } catch {
    exportStatus.value = 'error'
  }
  if (exportStatusTimer) clearTimeout(exportStatusTimer)
  exportStatusTimer = setTimeout(() => { exportStatus.value = 'idle' }, 2500)
}

// Memo state
const memoInputs = {}
const uploadingMemoKey = ref(null)
const playingMemoKey = ref(null)
const memoAudioEl = ref(null)

// Link state
const editingLinkKey = ref(null)

// Enroll dropdown state
const openEnrollDropdown = ref(null)

// Entry editing state (which role cards are in edit mode)
const editingEntries = reactive(new Set())

// Draft state: local copy of entries for editing
const draftEntries = reactive({}) // key: `${sectionId}_${roleId}` → { notes, voice_memo_url, link_url }

// Role order per section (sectionId → [roleId, ...])
const sectionRoleOrder = reactive({})

// Initialize drafts from fetched entries
function initDrafts() {
  for (const key of Object.keys(draftEntries)) delete draftEntries[key]
  for (const key of Object.keys(sectionRoleOrder)) delete sectionRoleOrder[key]

  // Sort entries by position so role order is preserved
  const sorted = [...entries.value].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  for (const entry of sorted) {
    const key = `${entry.section_id}_${entry.role_id}`
    draftEntries[key] = {
      notes: entry.notes || '',
      voice_memo_url: entry.voice_memo_url || '',
      link_url: entry.link_url || '',
    }
    // Build order arrays
    if (!sectionRoleOrder[entry.section_id]) sectionRoleOrder[entry.section_id] = []
    sectionRoleOrder[entry.section_id].push(entry.role_id)
  }
}

// External link
const pendingExternalLink = ref(null)

const sectionPresets = [
  'Intro', 'Verse 1', 'Verse 2',
  'Pre-Chorus 1', 'Pre-Chorus 2',
  'Chorus 1', 'Chorus 2',
  'Bridge', 'Instrumental', 'Solo',
  'Outro', 'Break', 'Speech',
]

watch(showAddSection, (val) => {
  if (val) {
    newSectionName.value = ''
    nextTick(() => sectionInputRef.value?.focus())
  }
})

function getRoleById(roleId) {
  return roles.value.find((r) => r.id === roleId) || null
}

function getEnrolledRoles(sectionId) {
  return sectionRoleOrder[sectionId] || []
}

function getUnenrolledRoles(sectionId) {
  const enrolled = new Set(getEnrolledRoles(sectionId))
  return roles.value.filter((r) => !enrolled.has(r.id))
}

function getEntryField(sectionId, roleId, field) {
  const key = `${sectionId}_${roleId}`
  const draft = draftEntries[key]
  return draft?.[field] || ''
}

function memoKey(sectionId, roleId) {
  return `${sectionId}_${roleId}`
}

function setMemoInput(sectionId, roleId, el) {
  if (el) memoInputs[memoKey(sectionId, roleId)] = el
}

// ─── Section actions ──────────────────────────────────────────────────────────

function onSectionReorder() {
  const orderedIds = sections.value.map((s) => s.id)
  arrangementStore.reorderSections(orderedIds)
}

async function handleCreateSection() {
  if (!newSectionName.value.trim()) return
  creatingSection.value = true
  try {
    await arrangementStore.createSection(songId, newSectionName.value)
    showAddSection.value = false
  } catch (e) {
    console.error('Create section error:', e)
  } finally {
    creatingSection.value = false
  }
}

function startSectionRename(section) {
  editingSectionId.value = section.id
  editSectionName.value = section.name
  nextTick(() => {
    const input = sectionNameInput.value
    if (Array.isArray(input)) input[0]?.focus()
    else input?.focus()
  })
}

async function saveSectionRename(section) {
  if (editingSectionId.value !== section.id) return
  const trimmed = editSectionName.value.trim()
  if (trimmed && trimmed !== section.name) {
    await arrangementStore.updateSection(section.id, { name: trimmed })
  }
  editingSectionId.value = null
}

function confirmDeleteSection(section) {
  sectionToDelete.value = section
}

async function handleDeleteSection() {
  if (!sectionToDelete.value) return
  const sectionId = sectionToDelete.value.id
  try {
    await arrangementStore.deleteSection(sectionId)
    // Clean draft entries for deleted section
    for (const key of Object.keys(draftEntries)) {
      if (key.startsWith(`${sectionId}_`)) delete draftEntries[key]
    }
  } catch (e) {
    console.error('Delete section error:', e)
  }
  sectionToDelete.value = null
}

// ─── Enroll / Unenroll ────────────────────────────────────────────────────────

const unenrollTarget = ref(null)

async function handleEnroll(sectionId, roleId) {
  const key = `${sectionId}_${roleId}`
  if (!draftEntries[key]) {
    draftEntries[key] = { notes: '', voice_memo_url: '', link_url: '' }
  }
  if (!sectionRoleOrder[sectionId]) sectionRoleOrder[sectionId] = []
  if (!sectionRoleOrder[sectionId].includes(roleId)) {
    sectionRoleOrder[sectionId].push(roleId)
  }
  try {
    await arrangementStore.enrollRole(sectionId, roleId)
  } catch (e) {
    console.error('Enroll error:', e)
  }
}

function confirmUnenroll(sectionId, roleId) {
  unenrollTarget.value = { sectionId, roleId }
}

async function handleUnenroll() {
  if (!unenrollTarget.value) return
  const { sectionId, roleId } = unenrollTarget.value
  const key = `${sectionId}_${roleId}`
  delete draftEntries[key]
  editingEntries.delete(key)
  // Remove from order
  if (sectionRoleOrder[sectionId]) {
    sectionRoleOrder[sectionId] = sectionRoleOrder[sectionId].filter((id) => id !== roleId)
  }
  try {
    await arrangementStore.unenrollRole(sectionId, roleId)
  } catch (e) {
    console.error('Unenroll error:', e)
  }
  unenrollTarget.value = null
}

// ─── Entry content ────────────────────────────────────────────────────────────

function saveEntryNotes(sectionId, roleId, value) {
  const key = `${sectionId}_${roleId}`
  if (draftEntries[key]) {
    draftEntries[key].notes = value || ''
  }
}

function saveEntryLink(sectionId, roleId, value) {
  const key = `${sectionId}_${roleId}`
  if (draftEntries[key]) {
    draftEntries[key].link_url = value || ''
  }
}

async function saveEntry(sectionId, roleId) {
  const key = `${sectionId}_${roleId}`
  const draft = draftEntries[key]
  if (!draft) return
  try {
    // Handle pending memo upload
    if (pendingMemoFiles[key]) {
      uploadingMemoKey.value = key
      const url = await arrangementStore.uploadEntryMemo(sectionId, roleId, gigId, pendingMemoFiles[key])
      draft.voice_memo_url = url
      uploadingMemoKey.value = null
      // Revoke the local blob URL
      if (localMemoUrls[key]) {
        URL.revokeObjectURL(localMemoUrls[key])
        delete localMemoUrls[key]
      }
      delete pendingMemoFiles[key]
    }
    // Handle pending memo deletion
    if (pendingMemoDeletions[key]) {
      const oldUrl = pendingMemoDeletions[key]
      await arrangementStore.deleteEntryMemo(sectionId, roleId, oldUrl)
      draft.voice_memo_url = ''
      delete pendingMemoDeletions[key]
    }

    await arrangementStore.upsertEntry(sectionId, roleId, {
      notes: draft.notes || null,
      voice_memo_url: draft.voice_memo_url || null,
      link_url: draft.link_url || null,
    })
  } catch (e) {
    console.error('Save entry error:', e)
  }
  editingEntries.delete(key)
}

// ─── Voice memo ───────────────────────────────────────────────────────────────

// Pending files to upload on Done (key → File)
const pendingMemoFiles = reactive({})
// Local blob URLs for preview playback (key → blob URL)
const localMemoUrls = reactive({})
// Pending deletions on Done (key → old URL to remove from storage)
const pendingMemoDeletions = reactive({})

function openMemoPicker(sectionId, roleId) {
  const input = memoInputs[memoKey(sectionId, roleId)]
  if (input) input.click()
}

function onMemoSelected(sectionId, roleId, event) {
  const file = event.target.files?.[0]
  if (!file) return
  event.target.value = ''
  const key = memoKey(sectionId, roleId)

  // Revoke old local URL if any
  if (localMemoUrls[key]) {
    URL.revokeObjectURL(localMemoUrls[key])
  }

  // Store file for upload on Done, create local URL for preview
  pendingMemoFiles[key] = file
  const blobUrl = URL.createObjectURL(file)
  localMemoUrls[key] = blobUrl

  if (!draftEntries[key]) draftEntries[key] = { notes: '', voice_memo_url: '', link_url: '' }
  draftEntries[key].voice_memo_url = blobUrl

  // If there was a pending deletion, cancel it (user replaced instead)
  delete pendingMemoDeletions[key]
}

function deleteMemo(sectionId, roleId) {
  const key = memoKey(sectionId, roleId)
  if (playingMemoKey.value === key) {
    memoAudioEl.value?.pause()
    playingMemoKey.value = null
  }

  // If there's a pending file (not yet uploaded), just discard it
  if (pendingMemoFiles[key]) {
    if (localMemoUrls[key]) {
      URL.revokeObjectURL(localMemoUrls[key])
      delete localMemoUrls[key]
    }
    delete pendingMemoFiles[key]
  } else {
    // Mark existing memo for deletion on Done
    const currentUrl = draftEntries[key]?.voice_memo_url || ''
    if (currentUrl) {
      pendingMemoDeletions[key] = currentUrl
    }
  }

  if (draftEntries[key]) {
    draftEntries[key].voice_memo_url = ''
  }
}

function toggleMemoPlay(sectionId, roleId) {
  const key = memoKey(sectionId, roleId)
  if (playingMemoKey.value === key) {
    memoAudioEl.value?.pause()
    playingMemoKey.value = null
  } else {
    const url = getEntryField(sectionId, roleId, 'voice_memo_url')
    if (!url) return
    if (memoAudioEl.value) {
      memoAudioEl.value.src = url
      memoAudioEl.value.play()
    }
    playingMemoKey.value = key
  }
}

// ─── External link ────────────────────────────────────────────────────────────

function openExternalLink(url) {
  pendingExternalLink.value = url
}

function formatLinkDisplay(url) {
  try {
    const u = new URL(url)
    return u.hostname + (u.pathname !== '/' ? u.pathname : '')
  } catch {
    return url
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  try {
    await gigStore.fetchGig(gigId)
    await songStore.fetchSongs(gigId)
    await arrangementStore.fetchRoles(gigId)
    await arrangementStore.fetchSections(songId)
    await arrangementStore.fetchEntries(songId)
    initDrafts()
  } catch (e) {
    loadError.value = e?.message || 'Failed to load arrangement.'
  } finally {
    pageLoading.value = false
  }
})
</script>
