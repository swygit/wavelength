<template>
  <div class="flex items-center gap-2">
    <input
      ref="fileInput"
      type="file"
      accept=".mp3,.wav,.m4a,.ogg,.webm,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/webm"
      class="hidden"
      @change="onFileSelected"
    />

    <!-- Existing memo: playback + replace upload -->
    <template v-if="song.voice_memo_url">
      <audio ref="audioEl" :src="playbackUrl" preload="metadata" class="hidden" @ended="playing = false" @error="handleAudioError" />
      <button
        class="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
        @click="togglePlay"
      >
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
          <path v-if="!playing" d="M8 6.5L17 12L8 17.5V6.5Z" />
          <rect v-else x="6" y="6" width="4" height="12" rx="1" />
          <rect v-if="playing" x="14" y="6" width="4" height="12" rx="1" />
        </svg>
        {{ playing ? 'Pause' : 'Memo' }}
      </button>
      <button class="text-[10px] text-gray-500 hover:text-gray-300" :disabled="uploading" @click="openFilePicker">
        Replace
      </button>
    </template>

    <!-- Upload button -->
    <template v-else>
      <button
        class="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400"
        :disabled="uploading"
        @click="openFilePicker"
      >
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0014 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M12 18v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Add voice memo
      </button>
    </template>

    <span v-if="uploading" class="text-[10px] text-gray-500">Uploading…</span>
    <span v-if="memoError" class="text-[10px] text-red-400">{{ memoError }}</span>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useSongStore } from '../stores/songs'
import { supabase } from '../lib/supabase'

const props = defineProps({
  song: { type: Object, required: true },
  gigId: { type: String, required: true },
})

const songStore = useSongStore()

const uploading = ref(false)
const playing = ref(false)
const memoError = ref('')
const playbackUrl = ref(props.song.voice_memo_url || '')

const audioEl = ref(null)
const fileInput = ref(null)

const ALLOWED_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'ogg', 'webm'])
const ALLOWED_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/vnd.wave',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/webm',
])

function openFilePicker() {
  memoError.value = ''
  fileInput.value?.click()
}

async function onFileSelected(event) {
  const file = event.target.files?.[0]
  if (!file) return

  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  const mimeType = (file.type || '').toLowerCase()
  const isAllowedExtension = ALLOWED_EXTENSIONS.has(extension)
  const isAllowedMime = mimeType ? ALLOWED_MIME_TYPES.has(mimeType) : false

  if (!isAllowedExtension && !isAllowedMime) {
    memoError.value = 'Unsupported file type. Please use mp3, wav, m4a, ogg, or webm.'
    event.target.value = ''
    return
  }

  uploading.value = true
  memoError.value = ''
  try {
    await songStore.uploadVoiceMemo(props.song.id, props.gigId, file)
  } catch (e) {
    memoError.value = e.message || 'Upload failed.'
  } finally {
    uploading.value = false
    event.target.value = ''
  }
}

function togglePlay() {
  if (!audioEl.value) return
  if (playing.value) {
    audioEl.value.pause()
    playing.value = false
  } else {
    playMemo()
  }
}

async function playMemo() {
  if (!audioEl.value) return
  memoError.value = ''
  try {
    const resolvedUrl = await resolvePlayableUrl(props.song.voice_memo_url)
    if (resolvedUrl) {
      playbackUrl.value = resolvedUrl
      audioEl.value.src = resolvedUrl
    }

    // Ensure the latest URL is loaded before attempting playback.
    audioEl.value.load()
    await audioEl.value.play()
    playing.value = true
  } catch {
    playing.value = false
    memoError.value = 'Unable to play this memo. Try mp3/wav or replace the file.'
  }
}

function handleAudioError() {
  playing.value = false
  memoError.value = 'Unable to load this memo audio. Try mp3/wav or replace the file.'
}

function extractVoiceMemoPath(url) {
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) {
    return String(url).replace(/^\/+/, '')
  }

  try {
    const pathname = new URL(url).pathname
    const markers = [
      '/storage/v1/object/public/voice-memos/',
      '/storage/v1/object/sign/voice-memos/',
      '/storage/v1/object/authenticated/voice-memos/',
    ]
    for (const marker of markers) {
      const idx = pathname.indexOf(marker)
      if (idx >= 0) {
        return decodeURIComponent(pathname.slice(idx + marker.length))
      }
    }
  } catch {
    return ''
  }

  return ''
}

async function resolvePlayableUrl(rawUrl) {
  if (!rawUrl) return ''
  const path = extractVoiceMemoPath(rawUrl)
  if (!path) return rawUrl

  const { data, error } = await supabase.storage.from('voice-memos').createSignedUrl(path, 3600)
  if (error || !data?.signedUrl) {
    return rawUrl
  }
  return data.signedUrl
}

watch(
  () => props.song.voice_memo_url,
  (nextUrl) => {
    playbackUrl.value = nextUrl || ''
    playing.value = false
    memoError.value = ''
    if (audioEl.value) {
      audioEl.value.pause()
      audioEl.value.currentTime = 0
    }
  }
)
</script>
