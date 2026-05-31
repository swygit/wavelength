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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.value.id)
        .maybeSingle()
      if (error) throw error

      let profileRow = data
      if (!profileRow) {
        const fallbackDisplayName = user.value.user_metadata?.display_name || null

        const { data: created, error: createError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: user.value.id,
              display_name: fallbackDisplayName,
            },
            { onConflict: 'id' }
          )
          .select('*')
          .single()
        if (createError) throw createError
        profileRow = created
      }

      const authDisplayName = user.value.user_metadata?.display_name || null
      profile.value = {
        ...(profileRow || {}),
        display_name: authDisplayName || profileRow?.display_name || null,
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

  async function signInWithGoogle(redirectTo) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    })
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
    // Clear local auth state immediately to avoid route-guard race conditions.
    user.value = null
    profile.value = null
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
      profile.value = {
        ...data,
        display_name: nextDisplayName || user.value.user_metadata?.display_name || data?.display_name || null,
      }

      // Sync display name to Auth metadata — awaited so it completes before navigation.
      if (nextDisplayName && nextDisplayName !== currentDisplayName) {
        try {
          const { data: authData, error: authError } = await withTimeout(
            supabase.auth.updateUser({ data: { display_name: nextDisplayName } }),
            8000,
            'Updating Auth display name timed out.'
          )
          if (authError) throw authError
          if (authData?.user) user.value = authData.user
        } catch (e) {
          console.warn('Auth display_name sync failed:', e)
        }
      }
      return
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

  return { user, profile, loading, isAuthenticated, init, signUp, signIn, signInWithGoogle, signOut, updateProfile, fetchProfile, uploadAvatar }
})
