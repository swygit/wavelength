<template>
  <AppLayout>
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold">Your Gigs</h1>
          <p class="text-gray-400 text-sm mt-1">Select a gig or create a new one</p>
        </div>
        <div class="flex gap-2">
          <RouterLink to="/join" class="btn-secondary text-sm">Join Gig</RouterLink>
          <RouterLink to="/gigs/new" class="btn-primary text-sm">+ New Gig</RouterLink>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-16 text-gray-400">Loading your gigs…</div>

      <!-- Empty state -->
      <div v-else-if="!gigs.length" class="text-center py-16">
        <div class="text-6xl mb-4">🎸</div>
        <h2 class="text-xl font-semibold mb-2">No gigs yet</h2>
        <p class="text-gray-400 mb-6">Create your first gig to start collaborating on a setlist.</p>
        <RouterLink to="/gigs/new" class="btn-primary">Create a Gig</RouterLink>
      </div>

      <!-- Gig cards -->
      <div v-else class="grid gap-4 sm:grid-cols-2">
        <RouterLink
          v-for="gig in gigs"
          :key="gig.id"
          :to="`/gigs/${gig.id}`"
          class="card hover:border-brand-500 transition-colors group"
        >
          <div class="flex items-start justify-between mb-2">
            <h2 class="font-semibold group-hover:text-brand-400 transition-colors">{{ gig.name }}</h2>
            <span class="text-xs px-2 py-1 rounded-full"
              :class="gig.status === 'open' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-300'"
            >
              {{ gig.status === 'open' ? 'Voting Open' : 'Closed' }}
            </span>
          </div>
          <p v-if="gig.description" class="text-sm text-gray-400 mb-3 line-clamp-2">{{ gig.description }}</p>
          <div class="flex items-center gap-3 text-xs text-gray-500">
            <span>{{ gig.role === 'owner' ? '👑 Owner' : '🎵 Member' }}</span>
            <span>Invite: <span class="font-mono text-brand-400">{{ gig.invite_code }}</span></span>
          </div>
        </RouterLink>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppLayout from '../components/AppLayout.vue'
import { useGigStore } from '../stores/gigs'

const gigStore = useGigStore()
const { gigs, loading } = storeToRefs(gigStore)

onMounted(() => gigStore.fetchMyGigs())
</script>
