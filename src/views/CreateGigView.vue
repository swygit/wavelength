<template>
  <AppLayout>
    <div class="max-w-lg mx-auto">
      <RouterLink to="/dashboard" class="text-sm text-gray-400 hover:text-white mb-6 inline-flex items-center gap-1">
        ← Back to Dashboard
      </RouterLink>
      <div class="card mt-4">
        <h1 class="text-xl font-bold mb-6">Create a new gig</h1>
        <div v-if="error" class="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">{{ error }}</div>
        <form @submit.prevent="handleCreate" class="space-y-4">
          <div>
            <label class="block text-sm text-gray-300 mb-1">Gig name <span class="text-red-400">*</span></label>
            <input v-model="name" type="text" class="input-field" :placeholder="namePlaceholder" required />
          </div>
          <div>
            <label class="block text-sm text-gray-300 mb-1">Description</label>
            <textarea v-model="description" class="input-field resize-none h-24" :placeholder="descriptionPlaceholder" />
          </div>
          <button type="submit" class="btn-primary w-full" :disabled="loading">
            {{ loading ? 'Creating…' : 'Create gig' }}
          </button>
        </form>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import { useGigStore } from '../stores/gigs'

const router = useRouter()
const gigStore = useGigStore()

const name = ref('')
const description = ref('')
const loading = ref(false)
const error = ref(null)
const namePlaceholder = ref('Summer Tour 2026')
const descriptionPlaceholder = ref("What's this gig about?")

const templates = [
  {
    name: 'Queen at Live Aid (1985)',
    description: 'Planning the setlist for an iconic Live Aid performance. Freddie Mercury\'s legendary 20-minute set featured some of Queen\'s biggest hits. Will your band rise to the occasion?',
  },
  {
    name: 'Jimi Hendrix at Monterey Pop Festival (1967)',
    description: 'A tribute to Jimi\'s unforgettable Monterey Pop debut. Setting the stage with psychedelic rock and revolutionary guitar work that changed music forever.',
  },
  {
    name: 'Woodstock Music & Art Fair (1969)',
    description: 'Assembling the perfect Woodstock setlist for three days of peace, love, and music. What would your band\'s contribution to this legendary festival be?',
  },
]

onMounted(() => {
  const template = templates[Math.floor(Math.random() * templates.length)]
  namePlaceholder.value = template.name
  descriptionPlaceholder.value = template.description
})

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
