<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-brand-500 tracking-tight">wavelength</h1>
        <p class="text-gray-400 mt-2">Collaborative setlist planning for bands</p>
      </div>

      <div class="card">
        <!-- Tab switcher -->
        <div class="flex border-b border-gray-700 mb-6">
          <button
            class="flex-1 py-2 text-sm font-semibold transition-colors"
            :class="tab === 'login' ? 'text-brand-500 border-b-2 border-brand-500' : 'text-gray-400 hover:text-gray-200'"
            @click="tab = 'login'"
          >
            Sign In
          </button>
          <button
            class="flex-1 py-2 text-sm font-semibold transition-colors"
            :class="tab === 'signup' ? 'text-brand-500 border-b-2 border-brand-500' : 'text-gray-400 hover:text-gray-200'"
            @click="tab = 'signup'"
          >
            Sign Up
          </button>
        </div>

        <!-- Error banner -->
        <div v-if="error" class="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">
          {{ error }}
        </div>

        <!-- Sign In form -->
        <form v-if="tab === 'login'" @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label class="block text-sm text-gray-300 mb-1">Email</label>
            <input v-model="form.email" type="email" class="input-field" placeholder="Your email address" required />
          </div>
          <div>
            <label class="block text-sm text-gray-300 mb-1">Password</label>
            <input v-model="form.password" type="password" class="input-field" placeholder="Your password" required />
          </div>
          <button type="submit" class="btn-primary w-full" :disabled="loading">
            {{ loading ? 'Signing in…' : 'Sign In' }}
          </button>
        </form>

        <!-- Sign Up form -->
        <form v-else @submit.prevent="handleSignUp" class="space-y-4">
          <div>
            <label class="block text-sm text-gray-300 mb-1">Email</label>
            <input v-model="form.email" type="email" class="input-field" placeholder="Your email address" required />
          </div>
          <div>
            <label class="block text-sm text-gray-300 mb-1">Password</label>
            <input v-model="form.password" type="password" class="input-field" placeholder="Your password" required minlength="6" />
          </div>
          <button type="submit" class="btn-primary w-full" :disabled="loading">
            {{ loading ? 'Creating account…' : 'Create Account' }}
          </button>
        </form>

        <!-- Email confirmation notice -->
        <div v-if="signedUp" class="mt-4 bg-green-900/50 border border-green-700 text-green-300 rounded-lg px-4 py-3 text-sm">
          Success! Account created successfully.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const tab = ref('login')
const loading = ref(false)
const error = ref(null)
const signedUp = ref(false)

const form = reactive({ email: '', password: '' })

async function handleLogin() {
  loading.value = true
  error.value = null
  try {
    await authStore.signIn(form.email, form.password)
    const redirect = route.query.redirect || '/dashboard'
    router.push(redirect)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function handleSignUp() {
  loading.value = true
  error.value = null
  try {
    await authStore.signUp(form.email, form.password)
    signedUp.value = true
    tab.value = 'login'
    setTimeout(() => {
      signedUp.value = false
    }, 3000)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>
