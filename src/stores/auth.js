import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const profile = ref(null)
  const loading = ref(true)

  const isAuthenticated = computed(() => !!user.value)

  async function init() {
    loading.value = true
    try {
      const { data: { session } } = await supabase.auth.getSession()
      user.value = session?.user ?? null
      if (user.value) await fetchProfile()
    } catch (e) {
      console.error('Auth init error:', e)
    } finally {
      loading.value = false
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      user.value = session?.user ?? null
      if (user.value) {
        await fetchProfile()
      } else {
        profile.value = null
      }
    })
  }

  async function fetchProfile() {
    if (!user.value) return
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.value.id)
        .single()
      const authDisplayName = user.value.user_metadata?.display_name || null
      profile.value = {
        ...(data || {}),
        display_name: authDisplayName || data?.display_name || null,
      }
    } catch (e) {
      console.error('fetchProfile error:', e)
      profile.value = {
        display_name: user.value.user_metadata?.display_name || null,
        avatar_url: null,
      }
    }
  }

  async function signUp(email, password, displayName) {
    const normalizedEmail = normalizeEmail(email)
    const payload = {
      email: normalizedEmail,
      password,
    }
    if (displayName?.trim()) {
      payload.options = { data: { display_name: displayName.trim() } }
    }
    const { data, error } = await supabase.auth.signUp(payload)
    if (error) throw error
    return data
  }

  async function signIn(email, password) {
    const normalizedEmail = normalizeEmail(email)
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
    if (error) throw error
    return data
  }

  function normalizeEmail(email) {
    return String(email ?? '')
      .trim()
      .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
      .toLowerCase()
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  async function updateProfile(updates) {
    if (!user.value) return
    const nextDisplayName = updates.display_name?.trim()
    const currentDisplayName = user.value.user_metadata?.display_name?.trim?.() || ''
    const profileUpdates = {}

    if (nextDisplayName) {
      profileUpdates.display_name = nextDisplayName
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'avatar_url')) {
      profileUpdates.avatar_url = updates.avatar_url
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { data, error } = await withTimeout(
        supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', user.value.id)
          .select()
          .single(),
        3000,
        'Saving profile timed out. Please try again.'
      )
      if (error) throw error
      let authSyncWarning = null

      // Best-effort sync to Auth UI display name. Do not block profile save on this.
      if (nextDisplayName && nextDisplayName !== currentDisplayName) {
        try {
          const { data: authData, error: authError } = await withRetry(
            () =>
              withTimeout(
                supabase.auth.updateUser({
                  data: { display_name: nextDisplayName },
                }),
                3000,
                'Updating Auth display name timed out.'
              ),
            1
          )
          if (authError) throw authError
          user.value = authData?.user || user.value
        } catch (e) {
          authSyncWarning = e.message
          console.warn('Auth display_name sync failed:', e)
        }
      }

      profile.value = {
        ...data,
        display_name: nextDisplayName || user.value.user_metadata?.display_name || data?.display_name || null,
      }
      return { warning: authSyncWarning }
    }

    profile.value = {
      ...(profile.value || {}),
      display_name: user.value.user_metadata?.display_name || profile.value?.display_name || null,
    }
  }

  async function uploadAvatar(file) {
    if (!user.value) throw new Error('Not authenticated')
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${user.value.id}/avatar.${ext}`
    const { error } = await withTimeout(
      supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type }),
      3000,
      'Uploading avatar timed out. Please check your connection and storage setup.'
    )
    if (error) throw error
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  }

  function withTimeout(promise, timeoutMs, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
    ])
  }

  async function withRetry(fn, retries = 1) {
    let lastError
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await fn()
      } catch (e) {
        lastError = e
      }
    }
    throw lastError
  }

  return { user, profile, loading, isAuthenticated, init, signUp, signIn, signOut, updateProfile, fetchProfile, uploadAvatar }
})
