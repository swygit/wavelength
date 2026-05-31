<template>
  <AppLayout>
    <div class="max-w-lg mx-auto">
      <RouterLink to="/dashboard" class="text-sm text-gray-400 hover:text-white mb-6 inline-flex items-center gap-1">
        ← Back to Dashboard
      </RouterLink>

      <div class="card mt-4">
        <h1 class="text-xl font-bold mb-2">Edit profile</h1>
        <p class="text-gray-400 text-sm mb-6">Update your display name and profile photo.</p>

        <div v-if="error" class="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">
          {{ error }}
        </div>

        <div v-if="saved" class="bg-green-900/50 border border-green-700 text-green-300 rounded-lg px-4 py-3 mb-4 text-sm">
          Profile updated.
        </div>

        <form @submit.prevent="handleSave" class="space-y-6">
          <div class="flex flex-col items-center gap-3">
            <button
              type="button"
              class="relative w-24 h-24 rounded-full overflow-hidden bg-gray-800 border-2 border-dashed border-gray-600 hover:border-brand-500 transition-colors focus:outline-none focus:border-brand-500"
              @click="openFilePicker"
              title="Upload photo"
            >
              <img v-if="avatarUrl" :src="avatarUrl" class="w-full h-full object-cover" alt="Avatar preview" />
              <div v-else class="w-full h-full flex items-center justify-center text-3xl text-gray-400">👤</div>
              <div class="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                Change
              </div>
            </button>
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFileChange" />
            <p class="text-xs text-gray-500">Optional — click to upload</p>
          </div>

          <div>
            <label class="block text-sm text-gray-300 mb-1">Display name <span class="text-red-400">*</span></label>
            <input
              v-model="displayName"
              type="text"
              class="input-field"
              placeholder="How your bandmates will see you"
              required
              maxlength="50"
            />
          </div>

          <button type="submit" class="btn-primary w-full" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save profile' }}
          </button>
        </form>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const displayName = ref(authStore.profile?.display_name || '')
const avatarFile = ref(null)
const avatarPreview = ref(null)
const fileInput = ref(null)
const saving = ref(false)
const saved = ref(false)
const error = ref(null)

const avatarUrl = computed(() => avatarPreview.value || authStore.profile?.avatar_url || '')

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
  saved.value = false
  error.value = null

  try {
    const updates = { display_name: displayName.value.trim() }
    if (avatarFile.value) {
      updates.avatar_url = await authStore.uploadAvatar(avatarFile.value)
    }
    await authStore.updateProfile(updates)
    saved.value = true
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}
</script>
