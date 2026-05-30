import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

export const useGigStore = defineStore('gigs', () => {
  const gigs = ref([])
  const currentGig = ref(null)
  const loading = ref(false)

  async function fetchMyGigs() {
    loading.value = true
    const authStore = useAuthStore()
    const { data, error } = await supabase
      .from('gig_members')
      .select('gig_id, role, gigs(id, name, description, invite_code, created_at, owner_id)')
      .eq('user_id', authStore.user.id)
      .order('created_at', { foreignTable: 'gigs', ascending: false })
    if (error) throw error
    gigs.value = (data ?? []).map((m) => ({ ...m.gigs, role: m.role }))
    loading.value = false
  }

  async function createGig(name, description) {
    const authStore = useAuthStore()
    const inviteCode = generateCode()

    const { data: gig, error: gigErr } = await supabase
      .from('gigs')
      .insert({ name, description, owner_id: authStore.user.id, invite_code: inviteCode })
      .select()
      .single()
    if (gigErr) throw gigErr

    const { error: memberErr } = await supabase
      .from('gig_members')
      .insert({ gig_id: gig.id, user_id: authStore.user.id, role: 'owner' })
    if (memberErr) throw memberErr

    gigs.value.unshift({ ...gig, role: 'owner' })
    return gig
  }

  async function joinGig(inviteCode) {
    const authStore = useAuthStore()

    const { data: gig, error: findErr } = await supabase
      .from('gigs')
      .select('*')
      .eq('invite_code', inviteCode.trim().toUpperCase())
      .single()
    if (findErr || !gig) throw new Error('Invalid invite code.')

    // Check if already a member
    const { data: existing } = await supabase
      .from('gig_members')
      .select('id')
      .eq('gig_id', gig.id)
      .eq('user_id', authStore.user.id)
      .maybeSingle()
    if (existing) throw new Error('You are already a member of this gig.')

    const { error: memberErr } = await supabase
      .from('gig_members')
      .insert({ gig_id: gig.id, user_id: authStore.user.id, role: 'member' })
    if (memberErr) throw memberErr

    gigs.value.unshift({ ...gig, role: 'member' })
    return gig
  }

  async function fetchGig(gigId) {
    const { data, error } = await supabase
      .from('gigs')
      .select('*, gig_members(user_id, role, profiles(id, display_name, avatar_url))')
      .eq('id', gigId)
      .single()
    if (error) throw error
    currentGig.value = data
    return data
  }

  async function updateGigStatus(gigId, status) {
    const { data, error } = await supabase
      .from('gigs')
      .update({ status })
      .eq('id', gigId)
      .select()
      .single()
    if (error) throw error
    currentGig.value = { ...currentGig.value, status }
    return data
  }

  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  return { gigs, currentGig, loading, fetchMyGigs, createGig, joinGig, fetchGig, updateGigStatus }
})
