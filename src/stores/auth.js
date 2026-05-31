import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const PROFILE_WRITE_TIMEOUT = 12000
  const AVATAR_UPLOAD_TIMEOUT = 12000
  const SIGNOUT_TIMEOUT = 8000
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
    const { error: localError } = await withTimeout(
      supabase.auth.signOut({ scope: 'local' }),
      SIGNOUT_TIMEOUT,
      'Signing out timed out.'
    )
    if (localError) throw localError

    // Clear in-memory state after local session/token removal succeeds.
    user.value = null
    profile.value = null

    // Best-effort global revocation in background.
    withRetry(
      () => withTimeout(supabase.auth.signOut({ scope: 'global' }), SIGNOUT_TIMEOUT, 'Global sign-out timed out.'),
      1
    )
      .then(({ error }) => {
        if (error) throw error
      })
      .catch((e) => {
        console.warn('Server sign-out failed after local sign-out:', e)
      })
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
      const { data, error } = await withRetry(
        () =>
          withTimeout(
            supabase
              .from('profiles')
              .upsert(
                {
                  id: user.value.id,
                  ...profileUpdates,
                },
                { onConflict: 'id' }
              )
              .select()
              .single(),
            PROFILE_WRITE_TIMEOUT,
            'Saving profile timed out. Please try again.'
          ),
        1
      )
      if (error) throw error
      profile.value = {
        ...data,
        display_name: nextDisplayName || user.value.user_metadata?.display_name || data?.display_name || null,
      }

      // Keep local auth metadata aligned immediately for UI/guards.
      if (nextDisplayName) {
        user.value = {
          ...user.value,
          user_metadata: {
            ...(user.value.user_metadata || {}),
            display_name: nextDisplayName,
          },
        }
      }

      // Sync display name to Auth metadata in the background so save can finish fast.
      if (nextDisplayName && nextDisplayName !== currentDisplayName) {
        withRetry(
          () =>
            withTimeout(
              supabase.auth.updateUser({ data: { display_name: nextDisplayName } }),
              8000,
              'Updating Auth display name timed out.'
            ),
          1
        )
          .then(({ data: authData, error: authError }) => {
            if (authError) throw authError
            if (authData?.user) user.value = authData.user
          })
          .catch((e) => {
            console.warn('Auth display_name sync failed:', e)
          })
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
      AVATAR_UPLOAD_TIMEOUT,
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
