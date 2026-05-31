import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

export const useSongStore = defineStore('songs', () => {
  const songs = ref([])
  const loading = ref(false)
  let realtimeChannel = null
  const VOICE_MEMO_TIMEOUT_MS = 20000

  async function fetchSongs(gigId) {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('songs')
        .select(`
          *,
          votes(id, user_id, value),
          reactions(id, user_id, emoji),
          comments(id, user_id, body, created_at, updated_at, profiles(display_name, avatar_url))
        `)
        .eq('gig_id', gigId)
        .order('created_at', { ascending: true })
      if (error) throw error
      songs.value = (data ?? []).map(enrichSong)
    } finally {
      loading.value = false
    }
  }

  async function addSong(gigId, songData) {
    const authStore = useAuthStore()
    const { data, error } = await supabase
      .from('songs')
      .insert({
        gig_id: gigId,
        added_by: authStore.user.id,
        title: songData.title,
        artist: songData.artist,
        album: songData.album,
        album_art: songData.albumArt,
        preview_url: songData.previewUrl,
        external_url: songData.externalUrl,
        source: songData.source,
        spotify_id: songData.spotifyId ?? null,
        youtube_id: songData.youtubeId ?? null,
        duration_ms: songData.durationMs ?? null,
      })
      .select(`
        *,
        votes(id, user_id, value),
        reactions(id, user_id, emoji),
        comments(id, user_id, body, created_at, updated_at, profiles(display_name, avatar_url))
      `)
      .single()
    if (error) throw error
    songs.value.push(enrichSong(data))
    return data
  }

  async function removeSong(songId) {
    const { error } = await supabase.from('songs').delete().eq('id', songId)
    if (error) throw error
    songs.value = songs.value.filter((s) => s.id !== songId)
  }

  async function castVote(songId, value) {
    const authStore = useAuthStore()
    const userId = authStore.user.id
    const song = songs.value.find((s) => s.id === songId)

    if (song?.added_by === userId) {
      throw new Error('You cannot vote on a song you added.')
    }

    // Upsert the vote (one vote per user per song)
    const { data, error } = await supabase
      .from('votes')
      .upsert({ song_id: songId, user_id: userId, value }, { onConflict: 'song_id,user_id' })
      .select()
      .single()
    if (error) throw error

    if (song) {
      const idx = song.votes.findIndex((v) => v.user_id === userId)
      if (idx >= 0) {
        song.votes = song.votes.map((v, i) => (i === idx ? data : v))
      } else {
        song.votes = [...song.votes, data]
      }
      song.score = calcScore(song.votes)
      song.myVote = value
    }
  }

  async function toggleReaction(songId, emoji) {
    const authStore = useAuthStore()
    const userId = authStore.user.id

    const song = songs.value.find((s) => s.id === songId)
    const existing = song?.reactions.find((r) => r.user_id === userId && r.emoji === emoji)

    if (existing) {
      const { error } = await supabase.from('reactions').delete().eq('id', existing.id)
      if (error) throw error
      if (song) song.reactions = song.reactions.filter((r) => r.id !== existing.id)
    } else {
      const { data, error } = await supabase
        .from('reactions')
        .insert({ song_id: songId, user_id: userId, emoji })
        .select()
        .single()
      if (error) throw error
      if (song && !song.reactions.some((r) => r.id === data.id)) song.reactions.push(data)
    }
  }

  async function addComment(songId, body) {
    const authStore = useAuthStore()
    const { data, error } = await supabase
      .from('comments')
      .insert({ song_id: songId, user_id: authStore.user.id, body })
      .select('id, user_id, body, created_at, updated_at, profiles(display_name, avatar_url)')
      .single()
    if (error) throw error
    const song = songs.value.find((s) => s.id === songId)
    if (song && !song.comments.some((c) => c.id === data.id)) song.comments.push(data)
    return data
  }

  async function updateComment(commentId, body) {
    const { data, error } = await supabase
      .from('comments')
      .update({ body, updated_at: new Date().toISOString() })
      .eq('id', commentId)
      .select('id, user_id, body, created_at, updated_at, profiles(display_name, avatar_url)')
      .single()
    if (error) throw error

    for (const song of songs.value) {
      const idx = song.comments.findIndex((c) => c.id === commentId)
      if (idx >= 0) {
        song.comments = song.comments.map((c, i) => (i === idx ? data : c))
        break
      }
    }

    return data
  }

  function subscribeToGig(gigId) {
    if (realtimeChannel) realtimeChannel.unsubscribe()

    // Build the votes filter only when there are songs to filter on.
    // If songs is empty we omit the filter; the handler already ignores
    // votes for songs not in the local list.
    const songIds = songs.value.map((s) => s.id)

    let channel = supabase.channel(`gig-${gigId}`)

    if (songIds.length > 0) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `song_id=in.(${songIds.join(',')})` }, handleVoteChange)
    } else {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, handleVoteChange)
    }

    realtimeChannel = channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, handleReactionChange)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, handleCommentInsert)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comments' }, handleCommentUpdate)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'songs', filter: `gig_id=eq.${gigId}` }, handleSongInsert)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'songs', filter: `gig_id=eq.${gigId}` }, handleSongDelete)
      .subscribe()
  }

  function unsubscribe() {
    if (realtimeChannel) {
      realtimeChannel.unsubscribe()
      realtimeChannel = null
    }
  }

  function handleVoteChange(payload) {
    const { eventType, new: newRow, old: oldRow } = payload
    const row = newRow || oldRow
    const song = songs.value.find((s) => s.id === row.song_id)
    if (!song) return
    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const idx = song.votes.findIndex((v) => v.id === row.id || v.user_id === row.user_id)
      if (idx >= 0) song.votes[idx] = row
      else song.votes.push(row)
    } else if (eventType === 'DELETE') {
      song.votes = song.votes.filter((v) => v.id !== row.id && v.user_id !== row.user_id)
    }
    song.score = calcScore(song.votes)
  }

  function handleReactionChange(payload) {
    const { eventType, new: newRow, old: oldRow } = payload
    const row = newRow || oldRow
    const song = songs.value.find((s) => s.id === row.song_id)
    if (!song) return
    if (eventType === 'INSERT') {
      if (!song.reactions.some((r) => r.id === row.id)) song.reactions.push(row)
    }
    else if (eventType === 'DELETE') song.reactions = song.reactions.filter((r) => r.id !== row.id)
  }

  async function handleCommentInsert(payload) {
    const row = payload.new
    const song = songs.value.find((s) => s.id === row.song_id)
    if (!song) return
    // Fetch with profile
    const { data } = await supabase
      .from('comments')
      .select('id, user_id, body, created_at, updated_at, profiles(display_name, avatar_url)')
      .eq('id', row.id)
      .single()
    if (data && !song.comments.some((c) => c.id === data.id)) song.comments.push(data)
  }

  async function handleCommentUpdate(payload) {
    const row = payload.new
    for (const song of songs.value) {
      const idx = song.comments.findIndex((c) => c.id === row.id)
      if (idx < 0) continue
      const { data } = await supabase
        .from('comments')
        .select('id, user_id, body, created_at, updated_at, profiles(display_name, avatar_url)')
        .eq('id', row.id)
        .single()
      if (data) {
        song.comments = song.comments.map((c, i) => (i === idx ? data : c))
      }
      break
    }
  }

  async function handleSongInsert(payload) {
    const row = payload.new
    if (songs.value.some((s) => s.id === row.id)) return
    const { data } = await supabase
      .from('songs')
      .select('*, votes(id, user_id, value), reactions(id, user_id, emoji), comments(id, user_id, body, created_at, updated_at, profiles(display_name, avatar_url))')
      .eq('id', row.id)
      .single()
    if (data) songs.value.push(enrichSong(data))
  }

  function handleSongDelete(payload) {
    songs.value = songs.value.filter((s) => s.id !== payload.old.id)
  }

  function enrichSong(song) {
    const authStore = useAuthStore()
    const userId = authStore.user?.id
    return {
      ...song,
      score: calcScore(song.votes ?? []),
      myVote: (song.votes ?? []).find((v) => v.user_id === userId)?.value ?? null,
    }
  }

  function calcScore(votes) {
    return (votes ?? []).reduce((sum, v) => sum + (v.value ?? 0), 0)
  }

  async function updateSetlistFields(songId, fields) {
    // fields: any subset of { setlist_order, song_key, notes, is_cancelled, voice_memo_url }
    const allowed = {}
    for (const key of ['setlist_order', 'song_key', 'notes', 'is_cancelled', 'voice_memo_url']) {
      if (key in fields) allowed[key] = fields[key]
    }
    const { error } = await supabase.from('songs').update(allowed).eq('id', songId)
    if (error) throw error
    const song = songs.value.find((s) => s.id === songId)
    if (song) Object.assign(song, allowed)
  }

  async function uploadVoiceMemo(songId, gigId, blob) {
    const fileName = blob?.name || ''
    const nameExt = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : ''
    const type = (blob?.type || '').toLowerCase()
    const ext = nameExt || (type.includes('ogg') ? 'ogg' : type.includes('webm') ? 'webm' : type.includes('wav') ? 'wav' : type.includes('mpeg') || type.includes('mp3') ? 'mp3' : 'm4a')
    const mimeByExt = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      m4a: 'audio/mp4',
      ogg: 'audio/ogg',
      webm: 'audio/webm',
    }
    const contentType = type || mimeByExt[ext] || 'audio/mpeg'
    const path = `${gigId}/${songId}-${Date.now()}.${ext}`
    const { error: upErr } = await withTimeout(
      supabase.storage.from('voice-memos').upload(path, blob, { upsert: true, contentType }),
      VOICE_MEMO_TIMEOUT_MS,
      'Voice memo upload timed out. Please try again.'
    )
    if (upErr) throw upErr
    const { data } = supabase.storage.from('voice-memos').getPublicUrl(path)
    await withTimeout(
      updateSetlistFields(songId, { voice_memo_url: data.publicUrl }),
      VOICE_MEMO_TIMEOUT_MS,
      'Saving voice memo link timed out. Please try again.'
    )
    return data.publicUrl
  }

  function withTimeout(promise, timeoutMs, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
    ])
  }

  function extractVoiceMemoPath(url) {
    if (!url) return ''
    try {
      const pathname = new URL(url).pathname
      const markers = [
        '/storage/v1/object/public/voice-memos/',
        '/storage/v1/object/sign/voice-memos/',
        '/storage/v1/object/authenticated/voice-memos/',
      ]
      for (const marker of markers) {
        const idx = pathname.indexOf(marker)
        if (idx >= 0) return decodeURIComponent(pathname.slice(idx + marker.length))
      }
    } catch { /* ignore */ }
    return ''
  }

  async function pruneStaleMemos() {
    const songsWithMemo = songs.value.filter((s) => s.voice_memo_url)
    await Promise.all(
      songsWithMemo.map(async (song) => {
        const path = extractVoiceMemoPath(song.voice_memo_url)
        if (!path) return
        const { error } = await supabase.storage.from('voice-memos').createSignedUrl(path, 60)
        if (error) {
          // File no longer exists in storage — clear the DB reference
          try {
            await updateSetlistFields(song.id, { voice_memo_url: null })
          } catch { /* best effort */ }
        }
      })
    )
  }

  return {
    songs, loading,
    fetchSongs, addSong, removeSong, castVote, toggleReaction, addComment, updateComment,
    subscribeToGig, unsubscribe,
    updateSetlistFields, uploadVoiceMemo, pruneStaleMemos,
  }
})
