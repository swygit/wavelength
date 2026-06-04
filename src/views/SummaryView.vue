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
          <button class="btn-secondary text-xs" :disabled="!orderedSongs.length" @click="copySummaryAsText">
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
      <!-- Ranked / reorderable songs -->
      <div v-if="!orderedSongs.length" class="card text-center py-10 text-gray-400">
        No songs were added to this gig.
      </div>

      <div v-else class="space-y-3">
        <template v-for="(song, idx) in orderedSongs" :key="song.id">
          <div v-show="isSongVisible(song)" class="card relative cursor-pointer hover:border-brand-500 transition-colors" :class="song.is_cancelled ? 'opacity-60 border-gray-600' : ''" @click="goToArrangement(song.id)">
            <!-- Cross-out toggle: top-right corner -->
            <button
              class="absolute top-3.5 right-4 w-5 h-5 rounded-full flex items-center justify-center transition-all"
              :class="song.is_cancelled ? 'bg-green-500/20 text-green-300 hover:bg-green-500/35' : 'bg-red-500/25 text-red-300 hover:bg-red-500/45'"
              :title="song.is_cancelled ? 'Restore song' : 'Cross out'"
              @click.stop="toggleCancelled(song)"
            >
              <svg v-if="song.is_cancelled" viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
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
                :class="song.is_cancelled ? 'bg-gray-700 text-gray-300' : 'bg-brand-700 text-white'"
              >
                {{ song.is_cancelled ? '✕' : idx + 1 }}
              </div>

              <!-- Album art -->
              <img v-if="song.album_art" :src="song.album_art" :alt="song.album" class="w-12 h-12 rounded object-cover flex-shrink-0 mt-0.5" />
              <div v-else class="w-12 h-12 rounded bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5 text-xl">🎵</div>

              <!-- Song info + editable fields -->
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div class="font-semibold truncate" :class="song.is_cancelled ? 'line-through text-gray-400' : ''">{{ song.title }}</div>
                    <div class="text-sm text-gray-400 truncate" :class="song.is_cancelled ? 'line-through text-gray-500' : ''">{{ song.artist }}</div>
                    <div v-if="song.votes.filter(v => v.value !== 0).length === 0" class="mt-1">
                      <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-400">No votes</span>
                    </div>
                  </div>
                  <!-- Score -->
                  <div class="text-right flex-shrink-0 pr-6">
                    <div class="text-xs mb-0.5">
                      <span class="px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-300">
                        <template v-if="!song.is_cancelled && popularityRankBySongId[song.id] === 1">🥇 1st</template>
                        <template v-else-if="!song.is_cancelled && popularityRankBySongId[song.id] === 2">🥈 2nd</template>
                        <template v-else-if="!song.is_cancelled && popularityRankBySongId[song.id] === 3">🥉 3rd</template>
                        <template v-else-if="!song.is_cancelled">{{ ordinal(popularityRankBySongId[song.id]) }}</template>
                        <template v-else>—</template>
                      </span>
                    </div>
                    <div class="text-xl font-bold" :class="song.is_cancelled ? 'text-gray-600' : song.score > 0 ? 'text-green-400' : song.score < 0 ? 'text-red-400' : 'text-gray-400'">
                      {{ song.is_cancelled ? '–' : (song.score > 0 ? '+' : '') + song.score }}
                    </div>
                  </div>
                </div>

                <!-- Song key + BPM row -->
                <div class="mt-2 flex flex-wrap gap-2 items-center" @click.stop>
                  <select
                    :value="getDraftKey(song)"
                    class="bg-gray-800 border border-gray-700 text-xs rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-brand-500"
                    @change="updateDraftKey(song, $event.target.value)"
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
                    :value="getDraftBpm(song)"
                    class="bg-gray-800 border border-gray-700 text-xs rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-brand-500 w-20"
                    placeholder="BPM…"
                    @input="updateDraftBpm(song, $event.target.value)"
                  />
                </div>

                <!-- Save / Discard buttons -->
                <div v-if="hasDraft(song)" class="mt-2 flex items-center gap-2" @click.stop>
                  <button
                    class="btn-primary text-xs py-1 px-3"
                    :disabled="savingIds.has(song.id)"
                    @click="saveDraft(song)"
                  >
                    {{ savingIds.has(song.id) ? 'Saving…' : 'Save' }}
                  </button>
                  <button
                    class="text-xs text-gray-400 hover:text-white"
                    @click="discardDraft(song)"
                  >
                    Discard
                  </button>
                  <span v-if="draftErrors[song.id]" class="text-xs text-red-400">{{ draftErrors[song.id] }}</span>
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

        <div v-if="!orderedSongs.length" class="text-xs text-gray-500">No songs yet.</div>

        <!-- Draggable always -->
        <draggable
          v-else
          v-model="orderedSongs"
          item-key="id"
          handle=".sidebar-song-handle"
          :animation="150"
          class="space-y-1"
          @end="onReorder"
        >
          <template #item="{ element: song, index: idx }">
            <div v-show="isSongVisible(song)" class="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-800/60 border border-gray-700/50">
              <div class="sidebar-song-handle cursor-grab text-gray-500 hover:text-gray-300 flex items-center">
                <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
                  <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                  <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                  <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                </svg>
              </div>
              <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-700 text-[10px] font-bold text-white flex-shrink-0">{{ idx + 1 }}</span>
              <span class="text-sm truncate" :class="song.is_cancelled ? 'line-through text-gray-500' : 'text-gray-200'">{{ song.title }}</span>
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
  </AppLayout>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
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
const { roles } = storeToRefs(arrangementStore)
const loading = ref(true)
const loadError = ref('')
const copyStatus = ref('idle')
let copyStatusTimer = null

// ─── Ordered songs (drag-and-drop) ───────────────────────────────────────────
const orderedSongs = ref([])
const finalizedSongs = computed(() => orderedSongs.value.filter((song) => !song.is_cancelled))
const canceledSongs = computed(() => orderedSongs.value.filter((song) => song.is_cancelled))

function initOrder() {
  const sorted = [...songs.value].sort((a, b) => {
    if (a.setlist_order != null && b.setlist_order != null) return a.setlist_order - b.setlist_order
    if (a.setlist_order != null) return -1
    if (b.setlist_order != null) return 1
    return b.score - a.score
  })
  orderedSongs.value = sorted
}

async function onReorder() {
  const updates = orderedSongs.value.map((s, i) =>
    songStore.updateSetlistFields(s.id, { setlist_order: i })
  )
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
  await songStore.updateSetlistFields(song.id, { is_cancelled: !song.is_cancelled })
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

function buildSummaryText() {
  const lines = [
    `Final Setlist: ${gig.value?.name || 'Untitled gig'}`,
    `Generated: ${new Date().toLocaleString()}`,
    '',
  ]

  if (!finalizedSongs.value.length) {
    lines.push('No songs in this setlist yet.')
    return lines.join('\n')
  }

  for (const [index, song] of finalizedSongs.value.entries()) {
    const meta = []
    if (song.song_key) meta.push(`Key: ${song.song_key}`)
    if (song.bpm) meta.push(`BPM: ${song.bpm}`)
    const suffix = meta.length ? `  [${meta.join(' | ')}]` : ''
    lines.push(`${index + 1}. ${song.title} - ${song.artist}${suffix}`)
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
    ])
    initOrder()
  } catch (e) {
    loadError.value = e?.message || 'Something went wrong while loading this summary.'
  } finally {
    loading.value = false
  }
})
</script>

