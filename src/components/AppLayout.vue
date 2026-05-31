<template>
  <div class="min-h-screen flex flex-col">
    <!-- Nav bar -->
    <nav class="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
      <div class="max-w-5xl mx-auto px-3 sm:px-4 py-2 sm:py-0 sm:h-14 flex items-start sm:items-center justify-between gap-2">
        <RouterLink to="/dashboard" class="text-brand-500 font-bold text-lg sm:text-xl tracking-tight">wavelength</RouterLink>
        <div class="flex items-center justify-end gap-2 sm:gap-3 flex-wrap">
          <RouterLink
            to="/profile"
            class="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors"
            title="Edit profile"
          >
            <img
              v-if="authStore.profile?.avatar_url"
              :src="authStore.profile.avatar_url"
              alt="Profile avatar"
              class="w-7 h-7 rounded-full object-cover"
            />
            <div v-else class="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-xs">👤</div>
            <span class="text-xs sm:text-sm text-gray-300 hidden sm:block max-w-[10rem] truncate">{{ authStore.profile?.display_name || authStore.user?.email }}</span>
          </RouterLink>
          <button class="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors whitespace-nowrap" @click="handleSignOut">Sign out</button>
        </div>
      </div>
    </nav>

    <!-- Main content -->
    <main class="flex-1 max-w-5xl mx-auto w-full px-3 sm:px-4 py-5 sm:py-8">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const router = useRouter()

async function handleSignOut() {
  await authStore.signOut()
  router.push('/auth')
}
</script>
