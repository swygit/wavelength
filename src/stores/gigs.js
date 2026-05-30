import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

export const useGigStore = defineStore('gigs', () => {
  const gigs = ref([])
  const currentGig = ref(null)
  const loading = ref(false)
  const REQUEST_TIMEOUT = 3000

  async function fetchMyGigs() {
    loading.value = true
    try {
      const authStore = useAuthStore()
      const { data, error } = await withTimeout(
        supabase
          .from('gig_members')
          .select('gig_id, role, gigs(id, name, description, invite_code, created_at, owner_id, status)')
          .eq('user_id', authStore.user.id)
          .order('created_at', { foreignTable: 'gigs', ascending: false }),
        REQUEST_TIMEOUT,
        'Loading gigs timed out. Please try again.'
      )
      if (error) {
        throw new Error(error.message || 'Failed to load gigs.')
      }
      gigs.value = (data ?? []).map((m) => ({ ...m.gigs, role: m.role }))
    } finally {
      loading.value = false
    }
  }

  async function createGig(name, description) {
    const authStore = useAuthStore()
    const inviteCode = generateCode()

    const { data: gig, error: gigErr } = await withTimeout(
      supabase
        .from('gigs')
        .insert({ name, description, owner_id: authStore.user.id, invite_code: inviteCode })
        .select()
        .single(),
      REQUEST_TIMEOUT,
      'Creating gig timed out. Please try again.'
    )
    if (gigErr) throw gigErr

    const { error: memberErr } = await withTimeout(
      supabase
        .from('gig_members')
        .insert({ gig_id: gig.id, user_id: authStore.user.id, role: 'owner' }),
      REQUEST_TIMEOUT,
      'Joining your new gig timed out. Please try again.'
    )
    if (memberErr) throw new Error(memberErr.message || 'Failed to add you as gig member.')

    gigs.value.unshift({ ...gig, role: 'owner' })
    return gig
  }

  async function joinGig(inviteCode) {
    const authStore = useAuthStore()

    const { data: gig, error: findErr } = await withTimeout(
      supabase
        .from('gigs')
        .select('*')
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .single(),
      REQUEST_TIMEOUT,
      'Looking up invite code timed out. Please try again.'
    )
    if (findErr || !gig) throw new Error('Invalid invite code.')

    // Check if already a member
    const { data: existing } = await withTimeout(
      supabase
        .from('gig_members')
        .select('id')
        .eq('gig_id', gig.id)
        .eq('user_id', authStore.user.id)
        .maybeSingle(),
      REQUEST_TIMEOUT,
      'Checking existing membership timed out. Please try again.'
    )
    if (existing) throw new Error('You are already a member of this gig.')

    const { error: memberErr } = await withTimeout(
      supabase
        .from('gig_members')
        .insert({ gig_id: gig.id, user_id: authStore.user.id, role: 'member' }),
      REQUEST_TIMEOUT,
      'Joining gig timed out. Please try again.'
    )
    if (memberErr) throw memberErr

    gigs.value.unshift({ ...gig, role: 'member' })
    return gig
  }

  async function fetchGig(gigId) {
    const { data, error } = await withTimeout(
      supabase
        .from('gigs')
        .select('*, gig_members(user_id, role, profiles(id, display_name, avatar_url))')
        .eq('id', gigId)
        .single(),
      REQUEST_TIMEOUT,
      'Loading gig timed out. Please try again.'
    )
    if (error) throw error
    currentGig.value = data
    return data
  }

  async function updateGigStatus(gigId, status) {
    const { data, error } = await withTimeout(
      supabase
        .from('gigs')
        .update({ status })
        .eq('id', gigId)
        .select()
        .single(),
      REQUEST_TIMEOUT,
      'Updating voting status timed out. Please try again.'
    )
    if (error) throw error
    currentGig.value = { ...currentGig.value, status }
    gigs.value = gigs.value.map((g) => (g.id === gigId ? { ...g, status } : g))
    return data
  }

  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  function withTimeout(promise, timeoutMs, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
    ])
  }

  return { gigs, currentGig, loading, fetchMyGigs, createGig, joinGig, fetchGig, updateGigStatus }
})
