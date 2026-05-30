<template>
  <AppLayout>
    <div class="max-w-lg mx-auto">
      <RouterLink to="/dashboard" class="text-sm text-gray-400 hover:text-white mb-6 inline-flex items-center gap-1">
        ← Back to Dashboard
      </RouterLink>
      <div class="card mt-4">
        <h1 class="text-xl font-bold mb-6">Create a New Gig</h1>
        <div v-if="error" class="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">{{ error }}</div>
        <form @submit.prevent="handleCreate" class="space-y-4">
          <div>
            <label class="block text-sm text-gray-300 mb-1">Gig Name <span class="text-red-400">*</span></label>
            <input v-model="name" type="text" class="input-field" placeholder="Summer Tour 2026" required />
          </div>
          <div>
            <label class="block text-sm text-gray-300 mb-1">Description</label>
            <textarea v-model="description" class="input-field resize-none h-24" placeholder="What's this gig about?" />
          </div>
          <button type="submit" class="btn-primary w-full" :disabled="loading">
            {{ loading ? 'Creating…' : 'Create Gig' }}
          </button>
        </form>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import { useGigStore } from '../stores/gigs'

const router = useRouter()
const gigStore = useGigStore()

const name = ref('')
const description = ref('')
const loading = ref(false)
const error = ref(null)

async function handleCreate() {
  loading.value = true
  error.value = null
  try {
    const gig = await gigStore.createGig(name.value.trim(), description.value.trim())
    router.push(`/gigs/${gig.id}`)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>
