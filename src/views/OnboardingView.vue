<template>
  <!-- Full-screen saving overlay -->
  <Transition name="fade">
    <div v-if="saving" class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950 gap-6">
      <span class="text-7xl animate-bounce">🎵</span>
      <div class="flex flex-col items-center gap-2">
        <p class="text-xl font-semibold text-white">Setting up your profile…</p>
        <p class="text-sm text-gray-400">Just a moment, {{ displayName }}...</p>
      </div>
      <div class="flex gap-1.5 mt-2">
        <span class="w-2 h-2 rounded-full bg-brand-500 animate-pulse" style="animation-delay: 0ms"></span>
        <span class="w-2 h-2 rounded-full bg-brand-500 animate-pulse" style="animation-delay: 150ms"></span>
        <span class="w-2 h-2 rounded-full bg-brand-500 animate-pulse" style="animation-delay: 300ms"></span>
      </div>
    </div>
  </Transition>

  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-brand-500 tracking-tight">wavelength</h1>
        <p class="text-gray-400 mt-2">Let's set up your profile</p>
      </div>

      <div class="card">
        <h2 class="text-xl font-bold mb-1">Welcome 👋</h2>
        <p class="text-gray-400 text-sm mb-6">Choose a display name and photo before you dive in.</p>

        <div v-if="error" class="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">
          {{ error }}
        </div>

        <form @submit.prevent="handleSave" class="space-y-6">
          <!-- Avatar picker -->
          <div class="flex flex-col items-center gap-3">
            <button
              type="button"
              class="relative w-24 h-24 rounded-full overflow-hidden bg-gray-800 border-2 border-dashed border-gray-600 hover:border-brand-500 transition-colors focus:outline-none focus:border-brand-500"
              @click="openFilePicker"
              title="Upload photo"
            >
              <img v-if="avatarPreview" :src="avatarPreview" class="w-full h-full object-cover" alt="Avatar preview" />
              <div v-else class="w-full h-full flex flex-col items-center justify-center text-gray-400">
                <span class="text-3xl">👤</span>
                <span class="text-xs mt-1">Add photo</span>
              </div>
              <div class="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                Change
              </div>
            </button>
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleFileChange"
            />
            <p class="text-xs text-gray-500">Optional — click to upload</p>
          </div>

          <!-- Display name -->
          <div>
            <label class="block text-sm text-gray-300 mb-1">Display name <span class="text-red-400">*</span></label>
            <input
              v-model="displayName"
              type="text"
              class="input-field"
              placeholder="How your bandmates will see you"
              required
              maxlength="50"
              autofocus
            />
          </div>

          <button type="submit" class="btn-primary w-full" :disabled="saving">
            Get started
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const displayName = ref('')
const avatarFile = ref(null)
const avatarPreview = ref(null)
const fileInput = ref(null)
const saving = ref(false)
const error = ref(null)

function openFilePicker() {
  fileInput.value?.click()
}

function handleFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  avatarFile.value = file
  avatarPreview.value = URL.createObjectURL(file)
}

async function handleSave() {
  if (!displayName.value.trim()) return
  saving.value = true
  error.value = null
  try {
    const finalDisplayName = displayName.value.trim()
    await authStore.updateProfile({ display_name: finalDisplayName })

    // Keep local state aligned so route guards can pass immediately.
    authStore.profile = {
      ...(authStore.profile || {}),
      display_name: finalDisplayName,
    }

    // Avatar upload is optional; do it in the background so onboarding feels instant.
    if (avatarFile.value) {
      authStore
        .uploadAvatar(avatarFile.value)
        .then((avatarUrl) => authStore.updateProfile({ avatar_url: avatarUrl }))
        .catch((e) => {
          console.warn('Background avatar upload failed:', e)
        })
    }

    // Refresh profile in the background without blocking navigation.
    authStore.fetchProfile().catch((e) => {
      console.warn('Background profile refresh failed:', e)
    })

    try {
      sessionStorage.setItem('wavelength.justOnboarded', '1')
    } catch {
      // Ignore storage issues; navigation should still continue.
    }

    window.location.href = '/dashboard'
  } catch (e) {
    error.value = e.message
    saving.value = false
  }
}
</script>

<style scoped>
.fade-enter-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from {
  opacity: 0;
}
</style>
