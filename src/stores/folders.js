import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

export const useFolderStore = defineStore('folders', () => {
  const folders = ref([])
  const loading = ref(false)
  const READ_TIMEOUT = 15000
  const WRITE_TIMEOUT = 8000

  function withTimeout(promise, timeoutMs, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
    ])
  }

  async function fetchFolders() {
    loading.value = true
    try {
      const authStore = useAuthStore()
      const { data, error } = await withTimeout(
        supabase
          .from('folders')
          .select('id, name, position, created_at, updated_at')
          .eq('user_id', authStore.user.id)
          .order('position', { ascending: true }),
        READ_TIMEOUT,
        'Loading folders timed out.'
      )
      if (error) throw new Error(error.message || 'Failed to load folders.')
      folders.value = data ?? []
    } finally {
      loading.value = false
    }
  }

  async function fetchFolderGigs(folderId) {
    const authStore = useAuthStore()
    const { data, error } = await withTimeout(
      supabase
        .from('folder_gigs')
        .select('gig_id, position')
        .eq('folder_id', folderId)
        .eq('user_id', authStore.user.id)
        .order('position', { ascending: true }),
      READ_TIMEOUT,
      'Loading folder gigs timed out.'
    )
    if (error) throw new Error(error.message || 'Failed to load folder gigs.')
    return data ?? []
  }

  async function createFolder(name) {
    const authStore = useAuthStore()
    const maxPosition = folders.value.reduce((max, f) => Math.max(max, f.position), -1)
    const { data, error } = await withTimeout(
      supabase
        .from('folders')
        .insert({ user_id: authStore.user.id, name: name.trim(), position: maxPosition + 1 })
        .select()
        .single(),
      WRITE_TIMEOUT,
      'Creating folder timed out.'
    )
    if (error) throw new Error(error.message || 'Failed to create folder.')
    folders.value.push(data)
    return data
  }

  async function renameFolder(folderId, newName) {
    const { error } = await withTimeout(
      supabase
        .from('folders')
        .update({ name: newName.trim(), updated_at: new Date().toISOString() })
        .eq('id', folderId),
      WRITE_TIMEOUT,
      'Renaming folder timed out.'
    )
    if (error) throw new Error(error.message || 'Failed to rename folder.')
    const folder = folders.value.find((f) => f.id === folderId)
    if (folder) folder.name = newName.trim()
  }

  async function deleteFolder(folderId) {
    const authStore = useAuthStore()
    // First remove all gig associations (they go back to root)
    await withTimeout(
      supabase
        .from('folder_gigs')
        .delete()
        .eq('folder_id', folderId)
        .eq('user_id', authStore.user.id),
      WRITE_TIMEOUT,
      'Removing gigs from folder timed out.'
    )
    // Then delete the folder itself
    const { error } = await withTimeout(
      supabase.from('folders').delete().eq('id', folderId),
      WRITE_TIMEOUT,
      'Deleting folder timed out.'
    )
    if (error) throw new Error(error.message || 'Failed to delete folder.')
    folders.value = folders.value.filter((f) => f.id !== folderId)
  }

  async function addGigToFolder(folderId, gigId) {
    const authStore = useAuthStore()
    // Remove from any existing folder first (a gig can only be in one folder per user)
    await withTimeout(
      supabase
        .from('folder_gigs')
        .delete()
        .eq('gig_id', gigId)
        .eq('user_id', authStore.user.id),
      WRITE_TIMEOUT,
      'Moving gig timed out.'
    )
    const { error } = await withTimeout(
      supabase
        .from('folder_gigs')
        .insert({ folder_id: folderId, gig_id: gigId, user_id: authStore.user.id, position: 0 }),
      WRITE_TIMEOUT,
      'Adding gig to folder timed out.'
    )
    if (error) throw new Error(error.message || 'Failed to add gig to folder.')
  }

  async function removeGigFromFolder(gigId) {
    const authStore = useAuthStore()
    const { error } = await withTimeout(
      supabase
        .from('folder_gigs')
        .delete()
        .eq('gig_id', gigId)
        .eq('user_id', authStore.user.id),
      WRITE_TIMEOUT,
      'Removing gig from folder timed out.'
    )
    if (error) throw new Error(error.message || 'Failed to remove gig from folder.')
  }

  async function moveGigToFolder(gigId, targetFolderId) {
    // If targetFolderId is null, remove from folder (back to root)
    if (!targetFolderId) {
      return removeGigFromFolder(gigId)
    }
    return addGigToFolder(targetFolderId, gigId)
  }

  async function reorderFolders(orderedIds) {
    // Update positions based on new order
    const updates = orderedIds.map((id, index) =>
      supabase.from('folders').update({ position: index }).eq('id', id)
    )
    await withTimeout(
      Promise.all(updates),
      WRITE_TIMEOUT,
      'Reordering folders timed out.'
    )
    // Update local state
    const folderMap = Object.fromEntries(folders.value.map((f) => [f.id, f]))
    folders.value = orderedIds.map((id, index) => ({ ...folderMap[id], position: index }))
  }

  async function getGigFolderMap() {
    const authStore = useAuthStore()
    const { data, error } = await withTimeout(
      supabase
        .from('folder_gigs')
        .select('gig_id, folder_id')
        .eq('user_id', authStore.user.id),
      READ_TIMEOUT,
      'Loading gig folder assignments timed out.'
    )
    if (error) throw new Error(error.message || 'Failed to load gig folder map.')
    const map = {}
    for (const row of data ?? []) {
      map[row.gig_id] = row.folder_id
    }
    return map
  }

  return {
    folders,
    loading,
    fetchFolders,
    fetchFolderGigs,
    createFolder,
    renameFolder,
    deleteFolder,
    addGigToFolder,
    removeGigFromFolder,
    moveGigToFolder,
    reorderFolders,
    getGigFolderMap,
  }
})
