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

        <div class="my-5 flex items-center gap-3">
          <div class="h-px flex-1 bg-gray-700" />
          <span class="text-[11px] uppercase tracking-[0.16em] text-gray-500">or continue with</span>
          <div class="h-px flex-1 bg-gray-700" />
        </div>

        <button
          type="button"
          class="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-600 bg-gray-800/70 px-4 py-2.5 text-sm font-semibold text-gray-100 transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="loading"
          @click="handleGoogleSignIn"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true">
            <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.4l2.7-2.6C17 3.4 14.8 2.5 12 2.5a9.5 9.5 0 1 0 0 19c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.9H12Z"/>
            <path fill="#34A853" d="M2.5 7.7 5.7 10c.8-2.3 3-4 5.8-4 1.9 0 3.2.8 3.9 1.4l2.7-2.6C16.6 3.4 14.8 2.5 12 2.5c-3.6 0-6.8 2-8.4 5.2Z"/>
            <path fill="#FBBC05" d="M12 21.5c2.7 0 4.9-.9 6.5-2.4l-3-2.4c-.8.6-1.9 1.1-3.5 1.1-3.9 0-5.3-2.6-5.5-3.9l-3.1 2.4c1.5 3.3 4.8 5.2 8.6 5.2Z"/>
            <path fill="#4285F4" d="M21.2 12.1c0-.6-.1-1.1-.2-1.9H12v3.9h5.5c-.3 1.2-1 2.1-2 2.7l3 2.4c1.8-1.7 2.7-4.1 2.7-7.1Z"/>
          </svg>
          {{ loading ? 'Please wait...' : 'Continue with Google' }}
        </button>

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

async function handleGoogleSignIn() {
  loading.value = true
  error.value = null
  try {
    await authStore.signInWithGoogle(`${window.location.origin}/dashboard`)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>
