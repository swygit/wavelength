import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

export const useArrangementStore = defineStore('arrangements', () => {
  const roles = ref([])
  const sections = ref([])
  const entries = ref([])
  const setlistSections = ref([])
  const loading = ref(false)

  const READ_TIMEOUT = 15000
  const WRITE_TIMEOUT = 8000

  function withTimeout(promise, timeoutMs, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
    ])
  }

  // ─── Roles (per gig) ────────────────────────────────────────────────────────

  async function fetchRoles(gigId) {
    const { data, error } = await withTimeout(
      supabase
        .from('gig_roles')
        .select('*, profiles:member_id(id, display_name, avatar_url)')
        .eq('gig_id', gigId)
        .order('position', { ascending: true }),
      READ_TIMEOUT,
      'Loading roles timed out.'
    )
    if (error) throw new Error(error.message)
    roles.value = data ?? []
  }

  async function createRole(gigId, name, icon = '🎵', memberId = null) {
    const maxPos = roles.value.reduce((max, r) => Math.max(max, r.position), -1)
    const row = { gig_id: gigId, name: name.trim(), icon, position: maxPos + 1 }
    if (memberId) row.member_id = memberId
    const { data, error } = await withTimeout(
      supabase
        .from('gig_roles')
        .insert(row)
        .select('*, profiles:member_id(id, display_name, avatar_url)')
        .single(),
      WRITE_TIMEOUT,
      'Creating role timed out.'
    )
    if (error) throw new Error(error.message)
    roles.value.push(data)
    return data
  }

  async function updateRole(roleId, fields) {
    const allowed = {}
    for (const key of ['name', 'icon', 'position', 'member_id']) {
      if (key in fields) allowed[key] = fields[key]
    }
    const { data, error } = await withTimeout(
      supabase
        .from('gig_roles')
        .update(allowed)
        .eq('id', roleId)
        .select('*, profiles:member_id(id, display_name, avatar_url)')
        .single(),
      WRITE_TIMEOUT,
      'Updating role timed out.'
    )
    if (error) throw new Error(error.message)
    const idx = roles.value.findIndex((r) => r.id === roleId)
    if (idx !== -1) roles.value[idx] = data
  }

  async function deleteRole(roleId) {
    const { error } = await withTimeout(
      supabase.from('gig_roles').delete().eq('id', roleId),
      WRITE_TIMEOUT,
      'Deleting role timed out.'
    )
    if (error) throw new Error(error.message)
    roles.value = roles.value.filter((r) => r.id !== roleId)
    entries.value = entries.value.filter((e) => e.role_id !== roleId)
  }

  // ─── Sections (per song) ────────────────────────────────────────────────────

  async function fetchSections(songId) {
    const { data, error } = await withTimeout(
      supabase
        .from('arrangement_sections')
        .select('*')
        .eq('song_id', songId)
        .order('position', { ascending: true }),
      READ_TIMEOUT,
      'Loading sections timed out.'
    )
    if (error) throw new Error(error.message)
    sections.value = data ?? []
  }

  async function createSection(songId, name) {
    const maxPos = sections.value.reduce((max, s) => Math.max(max, s.position), -1)
    const { data, error } = await withTimeout(
      supabase
        .from('arrangement_sections')
        .insert({ song_id: songId, name: name.trim(), position: maxPos + 1 })
        .select()
        .single(),
      WRITE_TIMEOUT,
      'Creating section timed out.'
    )
    if (error) throw new Error(error.message)
    sections.value.push(data)
    return data
  }

  async function updateSection(sectionId, fields) {
    const allowed = {}
    for (const key of ['name', 'position']) {
      if (key in fields) allowed[key] = fields[key]
    }
    const { error } = await withTimeout(
      supabase.from('arrangement_sections').update(allowed).eq('id', sectionId),
      WRITE_TIMEOUT,
      'Updating section timed out.'
    )
    if (error) throw new Error(error.message)
    const section = sections.value.find((s) => s.id === sectionId)
    if (section) Object.assign(section, allowed)
  }

  async function deleteSection(sectionId) {
    const { error } = await withTimeout(
      supabase.from('arrangement_sections').delete().eq('id', sectionId),
      WRITE_TIMEOUT,
      'Deleting section timed out.'
    )
    if (error) throw new Error(error.message)
    sections.value = sections.value.filter((s) => s.id !== sectionId)
    entries.value = entries.value.filter((e) => e.section_id !== sectionId)
  }

  async function reorderSections(orderedIds) {
    const updates = orderedIds.map((id, index) =>
      supabase.from('arrangement_sections').update({ position: index }).eq('id', id)
    )
    await withTimeout(Promise.all(updates), WRITE_TIMEOUT, 'Reordering sections timed out.')
    const sectionMap = Object.fromEntries(sections.value.map((s) => [s.id, s]))
    sections.value = orderedIds.map((id, i) => ({ ...sectionMap[id], position: i }))
  }

  // ─── Entries (per section + role) ───────────────────────────────────────────

  async function fetchEntries(songId) {
    // Fetch all entries for sections of this song
    const sectionIds = sections.value.map((s) => s.id)
    if (!sectionIds.length) {
      entries.value = []
      return
    }
    const { data, error } = await withTimeout(
      supabase
        .from('arrangement_entries')
        .select('*')
        .in('section_id', sectionIds),
      READ_TIMEOUT,
      'Loading arrangement entries timed out.'
    )
    if (error) throw new Error(error.message)
    entries.value = data ?? []
  }

  async function upsertEntry(sectionId, roleId, fields) {
    const existing = entries.value.find(
      (e) => e.section_id === sectionId && e.role_id === roleId
    )
    if (existing) {
      const allowed = {}
      for (const key of ['notes', 'voice_memo_url', 'link_url', 'position']) {
        if (key in fields) allowed[key] = fields[key]
      }
      allowed.updated_at = new Date().toISOString()
      const { error } = await withTimeout(
        supabase.from('arrangement_entries').update(allowed).eq('id', existing.id),
        WRITE_TIMEOUT,
        'Updating entry timed out.'
      )
      if (error) throw new Error(error.message)
      Object.assign(existing, allowed)
    } else {
      const { data, error } = await withTimeout(
        supabase
          .from('arrangement_entries')
          .insert({
            section_id: sectionId,
            role_id: roleId,
            notes: fields.notes || null,
            voice_memo_url: fields.voice_memo_url || null,
            link_url: fields.link_url || null,
            position: fields.position ?? 0,
          })
          .select()
          .single(),
        WRITE_TIMEOUT,
        'Creating entry timed out.'
      )
      if (error) throw new Error(error.message)
      entries.value.push(data)
    }
  }

  async function removeEntry(sectionId, roleId) {
    const existing = entries.value.find(
      (e) => e.section_id === sectionId && e.role_id === roleId
    )
    if (!existing) return
    const { error } = await withTimeout(
      supabase.from('arrangement_entries').delete().eq('id', existing.id),
      WRITE_TIMEOUT,
      'Removing entry timed out.'
    )
    if (error) throw new Error(error.message)
    entries.value = entries.value.filter((e) => e.id !== existing.id)
  }

  async function enrollRole(sectionId, roleId) {
    // Create a blank entry to "enroll" an instrument into a section, at the end
    const currentEntries = entries.value.filter((e) => e.section_id === sectionId)
    const nextPos = currentEntries.length
    await upsertEntry(sectionId, roleId, { position: nextPos })
  }

  async function reorderEntriesInSection(sectionId, orderedRoleIds) {
    const updates = orderedRoleIds.map((roleId, idx) => {
      const entry = entries.value.find(
        (e) => e.section_id === sectionId && e.role_id === roleId
      )
      if (entry) {
        entry.position = idx
        return supabase.from('arrangement_entries').update({ position: idx }).eq('id', entry.id)
      }
      return null
    }).filter(Boolean)
    await Promise.all(updates)
  }

  async function unenrollRole(sectionId, roleId) {
    await removeEntry(sectionId, roleId)
  }

  function getEntry(sectionId, roleId) {
    return entries.value.find(
      (e) => e.section_id === sectionId && e.role_id === roleId
    ) || null
  }

  function getEnrolledRoles(sectionId) {
    return entries.value
      .filter((e) => e.section_id === sectionId)
      .map((e) => e.role_id)
  }

  // ─── Voice memo upload for arrangement entries ──────────────────────────────

  async function uploadMemoFile(sectionId, roleId, gigId, blob) {
    const fileName = blob?.name || ''
    const nameExt = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : ''
    const type = (blob?.type || '').toLowerCase()
    const ext = nameExt || (type.includes('ogg') ? 'ogg' : type.includes('webm') ? 'webm' : type.includes('wav') ? 'wav' : type.includes('mpeg') || type.includes('mp3') ? 'mp3' : 'm4a')
    const path = `${gigId}/arrangements/${sectionId}_${roleId}_${Date.now()}.${ext}`

    const { error: uploadError } = await withTimeout(
      supabase.storage.from('voice-memos').upload(path, blob, {
        contentType: blob.type || 'audio/mpeg',
        upsert: false,
      }),
      WRITE_TIMEOUT,
      'Uploading voice memo timed out.'
    )
    if (uploadError) throw new Error(uploadError.message)

    const { data } = supabase.storage.from('voice-memos').getPublicUrl(path)
    return data.publicUrl
  }

  async function uploadEntryMemo(sectionId, roleId, gigId, blob) {
    const fileName = blob?.name || ''
    const nameExt = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : ''
    const type = (blob?.type || '').toLowerCase()
    const ext = nameExt || (type.includes('ogg') ? 'ogg' : type.includes('webm') ? 'webm' : type.includes('wav') ? 'wav' : type.includes('mpeg') || type.includes('mp3') ? 'mp3' : 'm4a')
    const path = `${gigId}/arrangements/${sectionId}_${roleId}_${Date.now()}.${ext}`

    const { error: uploadError } = await withTimeout(
      supabase.storage.from('voice-memos').upload(path, blob, {
        contentType: blob.type || 'audio/mpeg',
        upsert: false,
      }),
      WRITE_TIMEOUT,
      'Uploading voice memo timed out.'
    )
    if (uploadError) throw new Error(uploadError.message)

    const { data } = supabase.storage.from('voice-memos').getPublicUrl(path)
    await upsertEntry(sectionId, roleId, { voice_memo_url: data.publicUrl })
    return data.publicUrl
  }

  async function deleteEntryMemo(sectionId, roleId, fallbackUrl) {
    const entry = entries.value.find((e) => e.section_id === sectionId && e.role_id === roleId)
    const url = entry?.voice_memo_url || fallbackUrl
    if (url) {
      // Extract storage path from public URL
      const marker = '/object/public/voice-memos/'
      const idx = url.indexOf(marker)
      if (idx !== -1) {
        const storagePath = decodeURIComponent(url.slice(idx + marker.length))
        await supabase.storage.from('voice-memos').remove([storagePath])
      }
    }
    await upsertEntry(sectionId, roleId, { voice_memo_url: null })
  }

  // ─── Setlist Sections (per gig, interspersed with songs) ────────────────────

  async function fetchSetlistSections(gigId) {
    const { data, error } = await withTimeout(
      supabase
        .from('setlist_sections')
        .select('*')
        .eq('gig_id', gigId)
        .order('setlist_order', { ascending: true }),
      READ_TIMEOUT,
      'Loading setlist sections timed out.'
    )
    if (error) throw new Error(error.message)
    setlistSections.value = data ?? []
  }

  async function createSetlistSection(gigId, name, setlistOrder) {
    const { data, error } = await withTimeout(
      supabase
        .from('setlist_sections')
        .insert({ gig_id: gigId, name: name.trim(), setlist_order: setlistOrder ?? 0 })
        .select()
        .single(),
      WRITE_TIMEOUT,
      'Creating setlist section timed out.'
    )
    if (error) throw new Error(error.message)
    setlistSections.value.push(data)
    return data
  }

  async function updateSetlistSection(sectionId, fields) {
    const allowed = {}
    for (const key of ['name', 'notes', 'setlist_order']) {
      if (key in fields) allowed[key] = fields[key]
    }
    allowed.updated_at = new Date().toISOString()
    const { data, error } = await withTimeout(
      supabase
        .from('setlist_sections')
        .update(allowed)
        .eq('id', sectionId)
        .select()
        .single(),
      WRITE_TIMEOUT,
      'Updating setlist section timed out.'
    )
    if (error) throw new Error(error.message)
    const idx = setlistSections.value.findIndex((s) => s.id === sectionId)
    if (idx !== -1) setlistSections.value[idx] = data
    return data
  }

  async function deleteSetlistSection(sectionId) {
    const { error } = await withTimeout(
      supabase.from('setlist_sections').delete().eq('id', sectionId),
      WRITE_TIMEOUT,
      'Deleting setlist section timed out.'
    )
    if (error) throw new Error(error.message)
    setlistSections.value = setlistSections.value.filter((s) => s.id !== sectionId)
  }

  async function reorderSetlistSections(updates) {
    // updates: array of { id, setlist_order }
    const promises = updates.map(({ id, setlist_order }) =>
      supabase.from('setlist_sections').update({ setlist_order }).eq('id', id)
    )
    await withTimeout(Promise.all(promises), WRITE_TIMEOUT, 'Reordering setlist sections timed out.')
    for (const { id, setlist_order } of updates) {
      const sec = setlistSections.value.find((s) => s.id === id)
      if (sec) sec.setlist_order = setlist_order
    }
  }

  function $reset() {
    roles.value = []
    sections.value = []
    entries.value = []
    setlistSections.value = []
  }

  return {
    roles,
    sections,
    entries,
    setlistSections,
    loading,
    fetchRoles,
    createRole,
    updateRole,
    deleteRole,
    fetchSections,
    createSection,
    updateSection,
    deleteSection,
    reorderSections,
    fetchEntries,
    upsertEntry,
    removeEntry,
    enrollRole,
    reorderEntriesInSection,
    unenrollRole,
    getEntry,
    getEnrolledRoles,
    uploadEntryMemo,
    deleteEntryMemo,
    uploadMemoFile,
    fetchSetlistSections,
    createSetlistSection,
    updateSetlistSection,
    deleteSetlistSection,
    reorderSetlistSections,
    $reset,
  }
})
