<template>
  <AppLayout>
    <AppLoading v-if="loading" />

    <div v-else-if="loadError" class="card max-w-3xl mx-auto border-red-700/60 bg-red-900/20 text-red-100">
      <h2 class="font-semibold text-base">Could not load summary</h2>
      <p class="text-sm text-red-200/90 mt-2">{{ loadError }}</p>
      <RouterLink :to="`/gigs/${gigId}`" class="btn-secondary text-sm mt-4">Back to gig</RouterLink>
    </div>

    <div v-else-if="gig" class="max-w-5xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <RouterLink :to="`/gigs/${gigId}`" class="text-sm text-gray-400 hover:text-white inline-flex items-center gap-1 mb-2">
            ← Back to gig
          </RouterLink>
          <div class="flex items-center gap-2 mb-2">
            <h1 class="text-2xl font-bold">{{ gig.name }}</h1>
            <span class="text-xs px-2 py-1 rounded-full bg-red-900 text-red-300">Voting Closed</span>
          </div>
          <p v-if="gig.description" class="text-gray-400 text-sm mt-1">{{ gig.description }}</p>
        </div>
        <div class="flex items-center gap-2 self-start sm:self-auto">
          <button class="btn-primary text-xs" @click="showAddSetlistSection = true">+ Add section</button>
          <button class="btn-secondary text-xs" :disabled="!orderedItems.length" @click="copySummaryAsText">
            Export setlist
          </button>
          <span v-if="copyStatus === 'copied'" class="text-[11px] text-green-400">Copied</span>
          <span v-else-if="copyStatus === 'error'" class="text-[11px] text-red-400">Copy failed</span>
        </div>
      </div>

      <!-- KPI summary -->
      <div v-if="orderedSongs.length" class="grid grid-cols-3 gap-3 mb-6">
        <div class="card border-green-700/50 bg-gradient-to-b from-green-900/35 to-gray-900">
          <p class="text-[11px] uppercase tracking-wide text-green-300/90">HIGHEST RATED</p>
          <p class="mt-1 text-sm font-semibold truncate">{{ highestRatedSong?.title || 'No songs yet' }}</p>
          <p class="text-xs text-gray-400 truncate">{{ highestRatedSong?.artist || 'Waiting for data' }}</p>
          <div class="mt-3 inline-flex items-center gap-1.5 rounded-full border border-green-600/50 bg-green-900/30 px-2.5 py-1 text-xs text-green-200">
            <span>👍</span>
            <span>{{ highestRatedUpvotes }}</span>
          </div>
        </div>

        <div class="card border-amber-700/50 bg-gradient-to-b from-amber-900/35 to-gray-900">
          <p class="text-[11px] uppercase tracking-wide text-amber-300/90">Most Popular</p>
          <p class="mt-1 text-sm font-semibold truncate">{{ mostPopularSong?.title || 'No songs yet' }}</p>
          <p class="text-xs text-gray-400 truncate">{{ mostPopularSong?.artist || 'Waiting for data' }}</p>
          <div class="mt-3 flex flex-wrap gap-1.5">
            <span
              v-for="item in mostPopularEmojiBreakdown"
              :key="item.emoji"
              class="inline-flex items-center gap-1 rounded-full border border-amber-600/40 bg-amber-900/30 px-2 py-0.5 text-xs text-amber-200"
            >
              <span>{{ item.emoji }}</span>
              <span>{{ item.count }}</span>
            </span>
            <span v-if="!mostPopularEmojiBreakdown.length" class="text-xs text-gray-400">No emoji reactions yet</span>
          </div>
        </div>

        <div class="card border-rose-700/50 bg-gradient-to-b from-rose-900/30 to-gray-900">
          <p class="text-[11px] uppercase tracking-wide text-rose-300/90">Better Luck Next Time</p>
          <p class="mt-1 text-sm font-semibold truncate">{{ leastEngagedSong?.title || 'No songs yet' }}</p>
          <p class="text-xs text-gray-400 truncate">{{ leastEngagedSong?.artist || 'Waiting for data' }}</p>
          <div class="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span class="inline-flex items-center gap-1 rounded-full border border-rose-600/40 bg-rose-900/30 px-2 py-0.5 text-rose-200">
              <span>💬</span>
              <span>{{ leastEngagedInteractions }} interactions</span>
            </span>
            <span class="inline-flex items-center gap-1 rounded-full border border-rose-600/40 bg-rose-900/30 px-2 py-0.5 text-rose-200">
              <span>🗳️</span>
              <span>{{ leastEngagedScore >= 0 ? '+' : '' }}{{ leastEngagedScore }} score</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Two-column layout -->
      <div class="grid lg:grid-cols-3 gap-6">
        <!-- Song list (left / main) -->
        <div class="lg:col-span-2">
      <!-- Ranked / reorderable items (songs + sections) -->
      <div v-if="!orderedItems.length" class="card text-center py-10 text-gray-400">
        No songs were added to this gig.
      </div>

      <div v-else class="space-y-3">
        <template v-for="(item, idx) in orderedItems" :key="item.id">
          <!-- Setlist Section Card -->
          <div v-if="item._type === 'section'" class="card relative border-amber-700/40 bg-gradient-to-r from-amber-900/20 to-gray-900">
            <div class="flex items-start gap-3">
              <div class="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-base mt-0.5 bg-amber-700 text-white">
                §
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <div v-if="editingSetlistSectionId !== item.id" class="font-semibold truncate">{{ item.name }}</div>
                    <input
                      v-else
                      ref="setlistSectionNameInput"
                      v-model="editSetlistSectionName"
                      class="bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
                      @keydown.enter="saveSetlistSectionRename(item)"
                      @keydown.escape="editingSetlistSectionId = null"
                      @blur="saveSetlistSectionRename(item)"
                    />
                  </div>
                  <div class="flex items-center gap-1">
                    <button
                      class="text-gray-500 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
                      title="Rename section"
                      @click="startSetlistSectionRename(item)"
                    >
                      ✏️
                    </button>
                    <button
                      class="text-gray-500 hover:text-red-400 text-xs px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
                      title="Delete section"
                      @click="confirmDeleteSetlistSection(item)"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <!-- Notes -->
                <div class="mt-2">
                  <div v-if="editingSetlistSectionNotesId !== item.id">
                    <p v-if="item.notes" class="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{{ item.notes }}</p>
                    <button
                      class="text-xs text-gray-500 hover:text-white mt-1"
                      @click="startEditSetlistSectionNotes(item)"
                    >
                      {{ item.notes ? 'Edit notes' : '+ Add notes' }}
                    </button>
                  </div>
                  <div v-else>
                    <textarea
                      ref="setlistSectionNotesInput"
                      v-model="editSetlistSectionNotes"
                      class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-brand-500 resize-none"
                      rows="3"
                      placeholder="Add notes for this section…"
                      @keydown.escape="editingSetlistSectionNotesId = null"
                    ></textarea>
                    <div class="flex items-center gap-2 mt-1">
                      <button class="btn-primary text-xs py-0.5 px-2" @click="saveSetlistSectionNotes(item)">Save</button>
                      <button class="text-xs text-gray-400 hover:text-white" @click="editingSetlistSectionNotesId = null">Cancel</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Song Card (existing) -->
          <div v-else v-show="isSongVisible(item)" class="card relative transition-colors" :class="item.is_cancelled ? 'opacity-60 border-gray-600' : 'cursor-pointer hover:border-brand-500'" @click="!item.is_cancelled && goToArrangement(item.id)">
            <!-- Cross-out toggle: top-right corner -->
            <button
              class="absolute top-3.5 right-4 w-5 h-5 rounded-full flex items-center justify-center transition-all"
              :class="item.is_cancelled ? 'bg-green-500/20 text-green-300 hover:bg-green-500/35' : 'bg-red-500/25 text-red-300 hover:bg-red-500/45'"
              :title="item.is_cancelled ? 'Restore song' : 'Cross out'"
              @click.stop="toggleCancelled(item)"
            >
              <svg v-if="item.is_cancelled" viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <path d="M3 12h18M9 6l-6 6 6 6" />
              </svg>
              <svg v-else viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" />
              </svg>
            </button>
            <div class="flex items-start gap-3">

              <!-- Setlist order badge -->
              <div
                class="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-base mt-1.5"
                :class="item.is_cancelled ? 'bg-gray-700 text-gray-300' : 'bg-brand-700 text-white'"
              >
                {{ item.is_cancelled ? '✕' : songDisplayIndex(item) }}
              </div>

              <!-- Album art -->
              <img v-if="item.album_art" :src="item.album_art" :alt="item.album" class="w-12 h-12 rounded object-cover flex-shrink-0 mt-0.5" />
              <div v-else class="w-12 h-12 rounded bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5 text-xl">🎵</div>

              <!-- Song info + editable fields -->
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div class="font-semibold truncate" :class="item.is_cancelled ? 'line-through text-gray-400' : ''">{{ item.title }}</div>
                    <div class="text-sm text-gray-400 truncate" :class="item.is_cancelled ? 'line-through text-gray-500' : ''">{{ item.artist }}</div>
                    <div v-if="item.votes.filter(v => v.value !== 0).length === 0" class="mt-1">
                      <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-400">No votes</span>
                    </div>
                  </div>
                  <!-- Score -->
                  <div class="text-right flex-shrink-0 pr-6">
                    <div class="text-xs mb-0.5">
                      <span class="px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-300">
                        <template v-if="!item.is_cancelled && popularityRankBySongId[item.id] === 1">🥇 1st</template>
                        <template v-else-if="!item.is_cancelled && popularityRankBySongId[item.id] === 2">🥈 2nd</template>
                        <template v-else-if="!item.is_cancelled && popularityRankBySongId[item.id] === 3">🥉 3rd</template>
                        <template v-else-if="!item.is_cancelled">{{ ordinal(popularityRankBySongId[item.id]) }}</template>
                        <template v-else>—</template>
                      </span>
                    </div>
                    <div class="text-xl font-bold" :class="item.is_cancelled ? 'text-gray-600' : item.score > 0 ? 'text-green-400' : item.score < 0 ? 'text-red-400' : 'text-gray-400'">
                      {{ item.is_cancelled ? '–' : (item.score > 0 ? '+' : '') + item.score }}
                    </div>
                  </div>
                </div>

                <!-- Song key + BPM row -->
                <div class="mt-2 flex flex-wrap gap-2 items-center" @click.stop>
                  <select
                    :value="getDraftKey(item)"
                    class="bg-gray-800 border border-gray-700 text-xs rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-brand-500"
                    @change="updateDraftKey(item, $event.target.value)"
                  >
                    <option value="">Key…</option>
                    <optgroup label="Major">
                      <option v-for="k in majorKeys" :key="k" :value="k">{{ k }}</option>
                    </optgroup>
                    <optgroup label="Minor">
                      <option v-for="k in minorKeys" :key="k" :value="k">{{ k }}</option>
                    </optgroup>
                  </select>

                  <input
                    type="text"
                    inputmode="numeric"
                    :value="getDraftBpm(item)"
                    class="bg-gray-800 border border-gray-700 text-xs rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-brand-500 w-20"
                    placeholder="BPM…"
                    @input="updateDraftBpm(item, $event.target.value)"
                  />
                </div>

                <!-- Save / Discard buttons -->
                <div v-if="hasDraft(item)" class="mt-2 flex items-center gap-2" @click.stop>
                  <button
                    class="btn-primary text-xs py-1 px-3"
                    :disabled="savingIds.has(item.id)"
                    @click="saveDraft(item)"
                  >
                    {{ savingIds.has(item.id) ? 'Saving…' : 'Save' }}
                  </button>
                  <button
                    class="text-xs text-gray-400 hover:text-white"
                    @click="discardDraft(item)"
                  >
                    Discard
                  </button>
                  <span v-if="draftErrors[item.id]" class="text-xs text-red-400">{{ draftErrors[item.id] }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
        </div>

        <!-- Sidebar (right) -->
        <div class="space-y-4">

      <!-- Setlist order card -->
      <div class="card">
        <h2 class="font-semibold text-sm mb-2">Setlist</h2>

        <div class="space-y-2 mb-3">
          <div>
            <label class="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Search</label>
            <input
              v-model="sidebarSearch"
              type="text"
              class="w-full bg-gray-800 border border-gray-700 text-xs rounded px-2 py-1.5 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500"
              placeholder="Search songs…"
            />
          </div>
          <div>
            <label class="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Filter</label>
            <select
              v-model="sidebarFilter"
              class="w-full bg-gray-800 border border-gray-700 text-xs rounded px-2 py-1.5 text-gray-200 focus:outline-none focus:border-brand-500"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="cancelled">Inactive</option>
            </select>
          </div>
        </div>

        <div v-if="!orderedItems.length" class="text-xs text-gray-500">No songs yet.</div>

        <!-- Draggable unified list -->
        <draggable
          v-else
          v-model="orderedItems"
          item-key="id"
          handle=".sidebar-song-handle"
          :animation="150"
          class="space-y-1"
          @end="onReorder"
        >
          <template #item="{ element: item, index: idx }">
            <div
              class="flex items-center gap-2 px-2 py-1.5 rounded-lg"
              :class="item._type === 'section' ? 'bg-amber-900/20 border border-amber-700/40' : 'bg-gray-800/60 border border-gray-700/50'"
              v-show="item._type === 'section' || isSongVisible(item)"
            >
              <div class="sidebar-song-handle cursor-grab text-gray-500 hover:text-gray-300 flex items-center">
                <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
                  <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                  <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                  <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                </svg>
              </div>
              <template v-if="item._type === 'section'">
                <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-700 text-[10px] font-bold text-white flex-shrink-0">§</span>
                <span class="text-sm truncate text-amber-200">{{ item.name }}</span>
              </template>
              <template v-else>
                <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-700 text-[10px] font-bold text-white flex-shrink-0">{{ songDisplayIndex(item) }}</span>
                <span class="text-sm truncate" :class="item.is_cancelled ? 'line-through text-gray-500' : 'text-gray-200'">{{ item.title }}</span>
              </template>
            </div>
          </template>
        </draggable>
      </div>
      <!-- Member participation summary -->
      <div class="card">
        <h2 class="font-semibold mb-4">Member Participation</h2>
        <div class="divide-y divide-gray-700">
          <div v-for="member in memberStats" :key="member.user_id" class="flex flex-col gap-2 py-3">
            <div class="flex items-center gap-3 min-w-0">
              <img
                v-if="member.avatar_url"
                :src="member.avatar_url"
                alt="Member avatar"
                class="w-7 h-7 rounded-full object-cover"
              />
              <div v-else class="w-7 h-7 rounded-full bg-brand-900 flex items-center justify-center text-sm font-bold text-brand-400">
                {{ (member.display_name || 'A')[0].toUpperCase() }}
              </div>
              <div class="min-w-0">
                <span class="text-sm block truncate">{{ member.display_name || 'Unknown' }}</span>
                <span class="text-[11px] text-gray-500">{{ member.songsAdded }} song{{ member.songsAdded === 1 ? '' : 's' }} added</span>
              </div>
            </div>
            <div class="flex items-center text-xs pl-10">
              <span v-if="member.eligibleCount === 0" class="text-gray-400">N/A</span>
              <span v-else-if="member.votedCount === member.eligibleCount" class="text-green-400">✓ {{ member.votedCount }}/{{ member.eligibleCount }} voted</span>
              <span v-else-if="member.votedCount === 0" class="text-red-400">✗ 0/{{ member.eligibleCount }} voted</span>
              <span v-else class="text-yellow-400">{{ member.votedCount }}/{{ member.eligibleCount }} voted</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Band Roles -->
      <div v-if="roles.length" class="card">
        <h2 class="font-semibold text-sm mb-2">Instrument Roles</h2>
        <div class="flex flex-col gap-1.5">
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

    <!-- Add Setlist Section Modal -->
    <div
      v-if="showAddSetlistSection"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="showAddSetlistSection = false"
    >
      <div class="w-full max-w-md card border border-gray-600">
        <h2 class="text-lg font-bold mb-3">Add Section</h2>
        <div class="mb-3">
          <label class="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Name</label>
          <input
            ref="setlistSectionInputRef"
            v-model="newSetlistSectionName"
            type="text"
            class="input-field"
            placeholder="e.g. Break, Speech…"
            maxlength="50"
            @keydown.enter="handleCreateSetlistSection"
          />
        </div>
        <div class="mb-4">
          <p class="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Quick add:</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="preset in setlistSectionPresets"
              :key="preset"
              class="text-xs px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-300 hover:border-brand-500 hover:text-white transition-colors"
              @click="newSetlistSectionName = preset"
            >
              {{ preset }}
            </button>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <button class="btn-secondary text-sm" @click="showAddSetlistSection = false">Cancel</button>
          <button class="btn-primary text-sm" :disabled="!newSetlistSectionName.trim() || creatingSetlistSection" @click="handleCreateSetlistSection">
            {{ creatingSetlistSection ? 'Adding…' : 'Add section' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Setlist Section Confirmation -->
    <div
      v-if="setlistSectionToDelete"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="setlistSectionToDelete = null"
    >
      <div class="w-full max-w-sm card border border-red-700/60">
        <h2 class="text-lg font-bold mb-2">Delete section?</h2>
        <p class="text-sm text-gray-300 mb-4">
          Remove <span class="font-semibold text-white">"{{ setlistSectionToDelete.name }}"</span> from the setlist?
        </p>
        <div class="flex justify-end gap-2">
          <button class="btn-secondary text-sm" @click="setlistSectionToDelete = null">Cancel</button>
          <button class="text-sm px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-medium" @click="handleDeleteSetlistSection">
            Delete
          </button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, reactive, onMounted, nextTick, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import draggable from 'vuedraggable'
import AppLayout from '../components/AppLayout.vue'
import AppLoading from '../components/AppLoading.vue'
import { useGigStore } from '../stores/gigs'
import { useSongStore } from '../stores/songs'
import { useArrangementStore } from '../stores/arrangements'

const route = useRoute()
const router = useRouter()
const gigId = route.params.id

const gigStore = useGigStore()
const songStore = useSongStore()
const arrangementStore = useArrangementStore()

const { currentGig: gig } = storeToRefs(gigStore)
const { songs } = storeToRefs(songStore)
const { roles, setlistSections } = storeToRefs(arrangementStore)
const loading = ref(true)
const loadError = ref('')
const copyStatus = ref('idle')
let copyStatusTimer = null

// ─── Ordered items (songs + setlist sections, unified drag-and-drop) ─────────
const orderedItems = ref([])
const orderedSongs = computed(() => orderedItems.value.filter((i) => i._type !== 'section'))
const finalizedSongs = computed(() => orderedSongs.value.filter((song) => !song.is_cancelled))
const canceledSongs = computed(() => orderedSongs.value.filter((song) => song.is_cancelled))

function songDisplayIndex(item) {
  // Show the song's 1-based index among non-section items only
  let count = 0
  for (const i of orderedItems.value) {
    if (i._type === 'section') continue
    count++
    if (i.id === item.id) return count
  }
  return '?'
}

function initOrder() {
  const sorted = [...songs.value].sort((a, b) => {
    if (a.setlist_order != null && b.setlist_order != null) return a.setlist_order - b.setlist_order
    if (a.setlist_order != null) return -1
    if (b.setlist_order != null) return 1
    return b.score - a.score
  })
  // Tag songs
  const taggedSongs = sorted.map((s) => ({ ...s, _type: 'song' }))
  // Tag sections
  const taggedSections = setlistSections.value.map((s) => ({ ...s, _type: 'section' }))
  // Merge by setlist_order
  const all = [...taggedSongs, ...taggedSections].sort((a, b) => {
    const orderA = a._type === 'section' ? a.setlist_order : a.setlist_order
    const orderB = b._type === 'section' ? b.setlist_order : b.setlist_order
    if (orderA != null && orderB != null) return orderA - orderB
    if (orderA != null) return -1
    if (orderB != null) return 1
    return 0
  })
  orderedItems.value = all
}

async function onReorder() {
  const updates = []
  for (let i = 0; i < orderedItems.value.length; i++) {
    const item = orderedItems.value[i]
    if (item._type === 'section') {
      updates.push(arrangementStore.updateSetlistSection(item.id, { setlist_order: i }))
    } else {
      updates.push(songStore.updateSetlistFields(item.id, { setlist_order: i }))
    }
  }
  await Promise.all(updates)
}

// ─── Sidebar setlist card ─────────────────────────────────────────────────────
const sidebarSearch = ref('')
const sidebarFilter = ref('')

const hasSidebarFilters = computed(() => sidebarSearch.value.trim() || sidebarFilter.value)

function isSongVisible(song) {
  if (sidebarFilter.value === 'active' && song.is_cancelled) return false
  if (sidebarFilter.value === 'cancelled' && !song.is_cancelled) return false
  if (sidebarSearch.value.trim()) {
    const q = sidebarSearch.value.trim().toLowerCase()
    if (!song.title.toLowerCase().includes(q) && !(song.artist && song.artist.toLowerCase().includes(q))) return false
  }
  return true
}

// ─── Draft system for key/bpm ─────────────────────────────────────────────────
const drafts = reactive({}) // songId -> { key, bpm }
const savingIds = reactive(new Set())

function getDraftKey(song) {
  return drafts[song.id]?.key ?? song.song_key ?? ''
}

function getDraftBpm(song) {
  return drafts[song.id]?.bpm ?? (song.bpm != null ? String(song.bpm) : '')
}

function hasDraft(song) {
  const d = drafts[song.id]
  if (!d) return false
  const keyChanged = d.key !== undefined && d.key !== (song.song_key ?? '')
  const currentBpm = song.bpm != null ? String(song.bpm) : ''
  const bpmChanged = d.bpm !== undefined && d.bpm !== currentBpm
  return keyChanged || bpmChanged
}

function updateDraftKey(song, value) {
  if (!drafts[song.id]) drafts[song.id] = {}
  drafts[song.id].key = value
}

function updateDraftBpm(song, value) {
  if (!drafts[song.id]) drafts[song.id] = {}
  drafts[song.id].bpm = value
}

const draftErrors = reactive({}) // songId -> error message
let draftErrorTimers = {}

function setDraftError(songId, msg) {
  draftErrors[songId] = msg
  if (draftErrorTimers[songId]) clearTimeout(draftErrorTimers[songId])
  draftErrorTimers[songId] = setTimeout(() => { delete draftErrors[songId] }, 3000)
}

async function saveDraft(song) {
  const d = drafts[song.id]
  if (!d) return

  // Validate BPM is a positive integer (or empty)
  if (d.bpm !== undefined && d.bpm !== '') {
    if (!/^\d+$/.test(d.bpm)) {
      setDraftError(song.id, 'BPM must be a whole number!')
      return
    }
  }

  savingIds.add(song.id)
  try {
    const fields = {}
    if (d.key !== undefined && d.key !== (song.song_key ?? '')) {
      fields.song_key = d.key || null
    }
    const currentBpm = song.bpm != null ? String(song.bpm) : ''
    if (d.bpm !== undefined && d.bpm !== currentBpm) {
      fields.bpm = d.bpm ? parseInt(d.bpm, 10) : null
    }
    if (Object.keys(fields).length) {
      await songStore.updateSetlistFields(song.id, fields)
    }
    delete drafts[song.id]
  } finally {
    savingIds.delete(song.id)
  }
}

function discardDraft(song) {
  delete drafts[song.id]
}

function goToArrangement(songId) {
  router.push(`/gigs/${gigId}/songs/${songId}/arrangement`)
}

async function toggleCancelled(song) {
  const newVal = !song.is_cancelled
  await songStore.updateSetlistFields(song.id, { is_cancelled: newVal })
  // Update local orderedItems copy
  const item = orderedItems.value.find((i) => i.id === song.id)
  if (item) item.is_cancelled = newVal
}

// ─── Computed ──────────────────────────────────────────────────────────────────
const popularityRankBySongId = computed(() => {
  const sorted = [...orderedSongs.value].sort((a, b) => b.score - a.score)
  const ranks = {}
  sorted.forEach((song, idx) => {
    ranks[song.id] = idx + 1
  })
  return ranks
})

function ordinal(value) {
  if (!value) return '-'
  const mod100 = value % 100
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`
  switch (value % 10) {
    case 1: return `${value}st`
    case 2: return `${value}nd`
    case 3: return `${value}rd`
    default: return `${value}th`
  }
}

const memberStats = computed(() => {
  if (!gig.value?.gig_members) return []
  return gig.value.gig_members.map((m) => {
    const eligibleSongs = songs.value.filter((s) => s.added_by !== m.user_id)
    const votedSongs = eligibleSongs.filter((s) => (s.votes ?? []).some((v) => v.user_id === m.user_id && v.value !== 0))
    return {
      user_id: m.user_id,
      display_name: m.profiles?.display_name,
      avatar_url: m.profiles?.avatar_url,
      votedCount: votedSongs.length,
      eligibleCount: eligibleSongs.length,
      songsAdded: songs.value.filter((s) => s.added_by === m.user_id).length,
    }
  })
})

function upvoteCount(song) {
  return song?.votes?.filter((v) => v.value === 1).length || 0
}

function interactionCount(song) {
  const nonZeroVotes = song?.votes?.filter((v) => v.value !== 0).length || 0
  const reactions = song?.reactions?.length || 0
  const comments = song?.comments?.length || 0
  return nonZeroVotes + reactions + comments
}

function socialInteractionCount(song) {
  const reactions = song?.reactions?.length || 0
  const comments = song?.comments?.length || 0
  return reactions + comments
}

function emojiBreakdown(song) {
  const counts = {}
  for (const reaction of song?.reactions || []) {
    const emoji = reaction.emoji
    if (!emoji) continue
    counts[emoji] = (counts[emoji] || 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([emoji, count]) => ({ emoji, count }))
}

const highestRatedSong = computed(() => {
  if (!orderedSongs.value.length) return null
  return [...orderedSongs.value].sort((a, b) => {
    const upvoteDiff = upvoteCount(b) - upvoteCount(a)
    if (upvoteDiff !== 0) return upvoteDiff
    const scoreDiff = b.score - a.score
    if (scoreDiff !== 0) return scoreDiff
    return interactionCount(b) - interactionCount(a)
  })[0]
})

const highestRatedUpvotes = computed(() => upvoteCount(highestRatedSong.value))

const mostPopularSong = computed(() => {
  if (!orderedSongs.value.length) return null
  return [...orderedSongs.value].sort((a, b) => {
    const reactionDiff = (b.reactions?.length || 0) - (a.reactions?.length || 0)
    if (reactionDiff !== 0) return reactionDiff
    return interactionCount(b) - interactionCount(a)
  })[0]
})

const mostPopularEmojiBreakdown = computed(() => emojiBreakdown(mostPopularSong.value))

const leastEngagedSong = computed(() => {
  if (!orderedSongs.value.length) return null
  return [...orderedSongs.value].sort((a, b) => {
    const interactionDiff = socialInteractionCount(a) - socialInteractionCount(b)
    if (interactionDiff !== 0) return interactionDiff
    return a.score - b.score
  })[0]
})

const leastEngagedInteractions = computed(() => socialInteractionCount(leastEngagedSong.value))
const leastEngagedScore = computed(() => leastEngagedSong.value?.score || 0)

// ─── Setlist Sections ─────────────────────────────────────────────────────────
const showAddSetlistSection = ref(false)
const newSetlistSectionName = ref('')
const creatingSetlistSection = ref(false)
const setlistSectionInputRef = ref(null)
const setlistSectionPresets = ['Break', 'Speech', 'Soundcheck', 'Encore', 'Intermission']

const editingSetlistSectionId = ref(null)
const editSetlistSectionName = ref('')
const setlistSectionNameInput = ref(null)

const editingSetlistSectionNotesId = ref(null)
const editSetlistSectionNotes = ref('')
const setlistSectionNotesInput = ref(null)

const setlistSectionToDelete = ref(null)

watch(showAddSetlistSection, (val) => {
  if (val) {
    newSetlistSectionName.value = ''
    nextTick(() => setlistSectionInputRef.value?.focus())
  }
})

async function handleCreateSetlistSection() {
  if (!newSetlistSectionName.value.trim()) return
  creatingSetlistSection.value = true
  try {
    const order = orderedItems.value.length
    const created = await arrangementStore.createSetlistSection(gigId, newSetlistSectionName.value, order)
    orderedItems.value.push({ ...created, _type: 'section' })
    showAddSetlistSection.value = false
  } catch (e) {
    console.error('Create setlist section error:', e)
  } finally {
    creatingSetlistSection.value = false
  }
}

function startSetlistSectionRename(section) {
  editingSetlistSectionId.value = section.id
  editSetlistSectionName.value = section.name
  nextTick(() => {
    const input = setlistSectionNameInput.value
    if (Array.isArray(input)) input[0]?.focus()
    else input?.focus()
  })
}

async function saveSetlistSectionRename(section) {
  const newName = editSetlistSectionName.value.trim()
  editingSetlistSectionId.value = null
  if (!newName || newName === section.name) return
  await arrangementStore.updateSetlistSection(section.id, { name: newName })
  const item = orderedItems.value.find((i) => i.id === section.id)
  if (item) item.name = newName
}

function startEditSetlistSectionNotes(section) {
  editingSetlistSectionNotesId.value = section.id
  editSetlistSectionNotes.value = section.notes || ''
  nextTick(() => {
    const input = setlistSectionNotesInput.value
    if (Array.isArray(input)) input[0]?.focus()
    else input?.focus()
  })
}

async function saveSetlistSectionNotes(section) {
  const notes = editSetlistSectionNotes.value.trim() || null
  editingSetlistSectionNotesId.value = null
  await arrangementStore.updateSetlistSection(section.id, { notes })
  const item = orderedItems.value.find((i) => i.id === section.id)
  if (item) item.notes = notes
}

function confirmDeleteSetlistSection(section) {
  setlistSectionToDelete.value = section
}

async function handleDeleteSetlistSection() {
  const section = setlistSectionToDelete.value
  setlistSectionToDelete.value = null
  if (!section) return
  await arrangementStore.deleteSetlistSection(section.id)
  orderedItems.value = orderedItems.value.filter((i) => i.id !== section.id)
}

function buildSummaryText() {
  const lines = [
    `Final Setlist: ${gig.value?.name || 'Untitled gig'}`,
    `Generated: ${new Date().toLocaleString()}`,
    '',
  ]

  if (!orderedItems.value.length) {
    lines.push('No songs in this setlist yet.')
    return lines.join('\n')
  }

  let songIndex = 0
  for (const item of orderedItems.value) {
    if (item._type === 'section') {
      lines.push('')
      lines.push(`--- ${item.name} ---`)
      if (item.notes) lines.push(`    ${item.notes}`)
    } else {
      if (item.is_cancelled) continue
      songIndex++
      const meta = []
      if (item.song_key) meta.push(`Key: ${item.song_key}`)
      if (item.bpm) meta.push(`BPM: ${item.bpm}`)
      const suffix = meta.length ? `  [${meta.join(' | ')}]` : ''
      lines.push(`${songIndex}. ${item.title} - ${item.artist}${suffix}`)
    }
  }

  return lines.join('\n').trimEnd()
}

function fallbackCopyText(text) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function updateCopyStatus(nextStatus) {
  copyStatus.value = nextStatus
  if (copyStatusTimer) clearTimeout(copyStatusTimer)
  copyStatusTimer = setTimeout(() => {
    copyStatus.value = 'idle'
  }, 1800)
}

async function copySummaryAsText() {
  const text = buildSummaryText()
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      fallbackCopyText(text)
    }
    updateCopyStatus('copied')
  } catch {
    updateCopyStatus('error')
  }
}

// ─── Musical keys ─────────────────────────────────────────────────────────────
const majorKeys = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const minorKeys = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm']

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  loadError.value = ''
  try {
    await Promise.all([
      gigStore.fetchGig(gigId),
      songStore.fetchSongs(gigId),
      arrangementStore.fetchRoles(gigId),
      arrangementStore.fetchSetlistSections(gigId),
    ])
    initOrder()
  } catch (e) {
    loadError.value = e?.message || 'Something went wrong while loading this summary.'
  } finally {
    loading.value = false
  }
})
</script>

