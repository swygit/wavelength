<template>
  <AppLayout>
    <div class="max-w-lg mx-auto">
      <RouterLink to="/dashboard" class="text-sm text-gray-400 hover:text-white mb-6 inline-flex items-center gap-1">
        ← Back to Dashboard
      </RouterLink>
      <div class="card mt-4">
        <h1 class="text-xl font-bold mb-2">Join a Gig</h1>
        <p class="text-gray-400 text-sm mb-6">Enter the 6-character invite code shared by the gig organizer.</p>
        <div v-if="error" class="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">{{ error }}</div>
        <form @submit.prevent="handleJoin" class="space-y-4">
          <input
            v-model="code"
            type="text"
            class="input-field text-center text-2xl font-mono tracking-widest uppercase"
            placeholder="ABC123"
            maxlength="6"
            required
          />
          <button type="submit" class="btn-primary w-full" :disabled="loading">
            {{ loading ? 'Joining…' : 'Join Gig' }}
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

const code = ref('')
const loading = ref(false)
const error = ref(null)

async function handleJoin() {
  loading.value = true
  error.value = null
  try {
    const gig = await gigStore.joinGig(code.value)
    router.push(`/gigs/${gig.id}`)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>
