import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

export const useGigStore = defineStore('gigs', () => {
  const gigs = ref([])
  const currentGig = ref(null)
  const loading = ref(false)
  const READ_TIMEOUT = 15000
  const WRITE_TIMEOUT = 8000

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
        READ_TIMEOUT,
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
    const cleanName = name?.trim()
    const cleanDescription = description?.trim() || null

    // Preferred path: single RPC call avoids partial success and is faster over high latency.
    const { data: rpcGig, error: rpcErr } = await withTimeout(
      supabase.rpc('create_gig_with_owner_membership', {
        gig_name: cleanName,
        gig_description: cleanDescription,
        gig_invite_code: inviteCode,
      }),
      WRITE_TIMEOUT,
      'Creating gig timed out. Please try again.'
    )

    if (!rpcErr && rpcGig) {
      gigs.value.unshift({ ...rpcGig, role: 'owner' })
      return rpcGig
    }

    const isMissingRpc =
      rpcErr &&
      (rpcErr.code === 'PGRST202' ||
        rpcErr.message?.toLowerCase?.().includes('create_gig_with_owner_membership'))

    if (!isMissingRpc) {
      throw new Error(rpcErr?.message || 'Failed to create gig.')
    }

    // Backward-compatible fallback for databases that do not yet have the RPC.
    const { data: gig, error: gigErr } = await withTimeout(
      supabase
        .from('gigs')
        .insert({ name: cleanName, description: cleanDescription, owner_id: authStore.user.id, invite_code: inviteCode })
        .select()
        .single(),
      WRITE_TIMEOUT,
      'Creating gig timed out. Please try again.'
    )
    if (gigErr) throw gigErr

    const { error: memberErr } = await withTimeout(
      supabase
        .from('gig_members')
        .insert({ gig_id: gig.id, user_id: authStore.user.id, role: 'owner' }),
      WRITE_TIMEOUT,
      'Finalizing gig setup timed out. Please try again.'
    )
    if (memberErr) throw new Error(memberErr.message || 'Failed to add you as gig member.')

    gigs.value.unshift({ ...gig, role: 'owner' })
    return gig
  }

  async function joinGig(inviteCode) {
    const code = inviteCode.trim().toUpperCase()
    const { data: gig, error } = await withTimeout(
      supabase.rpc('join_gig_by_invite', {
        invite_code_input: code,
      }),
      WRITE_TIMEOUT,
      'Joining gig timed out. Please try again.'
    )

    if (error) {
      const message = error.message || 'Failed to join gig.'
      if (message.includes('Invalid invite code.')) throw new Error('Invalid invite code.')
      if (message.includes('already a member')) throw new Error('You are already a member of this gig.')
      if (message.includes('Voting is closed')) {
        throw new Error('Voting is closed for this gig. Please contact the owner to reopen it.')
      }
      throw new Error(message)
    }

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
      READ_TIMEOUT,
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
      WRITE_TIMEOUT,
      'Updating voting status timed out. Please try again.'
    )
    if (error) throw error
    currentGig.value = { ...currentGig.value, status }
    gigs.value = gigs.value.map((g) => (g.id === gigId ? { ...g, status } : g))
    return data
  }

  async function leaveGig(gigId) {
    const authStore = useAuthStore()
    const { error } = await withTimeout(
      supabase
        .from('gig_members')
        .delete()
        .eq('gig_id', gigId)
        .eq('user_id', authStore.user.id),
      WRITE_TIMEOUT,
      'Leaving gig timed out. Please try again.'
    )
    if (error) throw new Error(error.message || 'Failed to leave gig.')

    gigs.value = gigs.value.filter((g) => g.id !== gigId)
    if (currentGig.value?.id === gigId) currentGig.value = null
  }

  async function transferOwnershipAndLeave(gigId, newOwnerUserId) {
    const { error } = await withTimeout(
      supabase.rpc('transfer_gig_ownership_and_leave', {
        target_gig_id: gigId,
        new_owner_user_id: newOwnerUserId,
      }),
      WRITE_TIMEOUT,
      'Transferring ownership timed out. Please try again.'
    )
    if (error) throw new Error(error.message || 'Failed to transfer ownership and leave gig.')

    gigs.value = gigs.value.filter((g) => g.id !== gigId)
    if (currentGig.value?.id === gigId) currentGig.value = null
  }

  async function deleteGig(gigId) {
    const { error } = await withTimeout(
      supabase
        .from('gigs')
        .delete()
        .eq('id', gigId),
      WRITE_TIMEOUT,
      'Deleting gig timed out. Please try again.'
    )
    if (error) throw new Error(error.message || 'Failed to delete gig.')

    gigs.value = gigs.value.filter((g) => g.id !== gigId)
    if (currentGig.value?.id === gigId) currentGig.value = null
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

  return {
    gigs,
    currentGig,
    loading,
    fetchMyGigs,
    createGig,
    joinGig,
    fetchGig,
    updateGigStatus,
    leaveGig,
    transferOwnershipAndLeave,
    deleteGig,
  }
})
