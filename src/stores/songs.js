import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'
import { decodeSongTextFields } from '../lib/text'

export const DUPLICATE_SONG_ERROR = 'This song has already been added to this gig.'
const TITLE_NOISE_WORDS = new Set([
  'official', 'music', 'video', 'lyrics', 'lyric', 'audio', 'live', 'visualizer',
  'remaster', 'remastered', 'version', 'edit', 'hd', '4k', 'mv', 'performance',
  'mono', 'stereo', 'feat', 'ft', 'explicit', 'clean', 'karaoke',
])

export function isDuplicateSongError(errorLike) {
  const message = (errorLike?.message || '').toLowerCase()
  const details = (errorLike?.details || '').toLowerCase()
  const hint = (errorLike?.hint || '').toLowerCase()
  const code = errorLike?.code || ''

  if (code === '23505') return true

  return [message, details, hint].some((text) => (
    text.includes('songs_unique_spotify_per_gig')
    || text.includes('songs_unique_youtube_per_gig')
    || text.includes('duplicate key value violates unique constraint')
    || text.includes(DUPLICATE_SONG_ERROR.toLowerCase())
  ))
}

function normalizeText(value) {
  if (typeof value !== 'string') return ''
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .trim()
}

function normalizeTitleForTokens(title) {
  return normalizeText(title)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[-_:|/]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeTitle(title) {
  const normalized = normalizeTitleForTokens(title)
  if (!normalized) return []

  return normalized
    .split(' ')
    .filter((token) => token.length > 1 && !TITLE_NOISE_WORDS.has(token) && !/^\d{4}$/.test(token))
}

function titleSimilarityScore(titleA, titleB) {
  const tokensA = tokenizeTitle(titleA)
  const tokensB = tokenizeTitle(titleB)
  if (!tokensA.length || !tokensB.length) return 0

  const setA = new Set(tokensA)
  const setB = new Set(tokensB)
  const intersection = [...setA].filter((token) => setB.has(token)).length
  const union = new Set([...setA, ...setB]).size
  const minLen = Math.min(setA.size, setB.size)

  if (!union || !minLen) return 0

  const jaccard = intersection / union
  const containment = intersection / minLen

  return Math.max(jaccard, containment)
}

function artistSimilarityScore(artistA, artistB) {
  const a = normalizeText(artistA)
  const b = normalizeText(artistB)
  if (!a || !b) return 0
  if (a === b) return 1

  const tokensA = new Set(a.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean))
  const tokensB = new Set(b.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean))
  const intersection = [...tokensA].filter((token) => tokensB.has(token)).length
  const union = new Set([...tokensA, ...tokensB]).size
  return union ? intersection / union : 0
}

export const useSongStore = defineStore('songs', () => {
  const songs = ref([])
  const loading = ref(false)
  let realtimeChannel = null
  const VOICE_MEMO_TIMEOUT_MS = 20000
  const SONG_WRITE_TIMEOUT_MS = 10000

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
    const normalizedSongData = decodeSongTextFields(songData)

    const duplicateCheckQuery = supabase
      .from('songs')
      .select('id')
      .eq('gig_id', gigId)
      .limit(1)

    if (songData.spotifyId) {
      duplicateCheckQuery.eq('spotify_id', songData.spotifyId)
    } else if (songData.youtubeId) {
      duplicateCheckQuery.eq('youtube_id', songData.youtubeId)
    } else {
      duplicateCheckQuery
        .eq('source', songData.source)
        .eq('title', normalizedSongData.title || '')
        .eq('artist', normalizedSongData.artist || null)
    }

    const { data: duplicateSong, error: duplicateSongError } = await withTimeout(
      duplicateCheckQuery.maybeSingle(),
      SONG_WRITE_TIMEOUT_MS,
      'Checking for duplicate song timed out. Please try again.'
    )

    if (duplicateSongError) {
      if (isDuplicateSongError(duplicateSongError)) {
        throw new Error(DUPLICATE_SONG_ERROR)
      }
      throw new Error(duplicateSongError.message || 'Failed to validate song duplication.')
    }

    if (duplicateSong?.id) {
      throw new Error(DUPLICATE_SONG_ERROR)
    }

    const payload = {
      gig_id: gigId,
      added_by: authStore.user.id,
      title: normalizedSongData.title,
      artist: normalizedSongData.artist,
      album: normalizedSongData.album,
      album_art: songData.albumArt,
      preview_url: songData.previewUrl,
      external_url: songData.externalUrl,
      source: songData.source,
      spotify_id: songData.spotifyId ?? null,
      youtube_id: songData.youtubeId ?? null,
      duration_ms: songData.durationMs ?? null,
    }

    const appendOrUpdateSong = (song) => {
      const enriched = enrichSong(song)
      const exists = songs.value.some((s) => s.id === enriched.id)
      if (!exists) songs.value.push(enriched)
      return song
    }

    const recoverAddedSong = async () => {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('songs')
            .select(`
              *,
              votes(id, user_id, value),
              reactions(id, user_id, emoji),
              comments(id, user_id, body, created_at, updated_at, profiles(display_name, avatar_url))
            `)
            .eq('gig_id', gigId)
            .eq('added_by', authStore.user.id)
            .eq('title', payload.title)
            .eq('source', payload.source)
            .order('created_at', { ascending: false })
            .limit(5),
          SONG_WRITE_TIMEOUT_MS,
          'Checking song add status timed out. Please try again.'
        )
        if (error || !data?.length) return null

        const recovered = data.find((song) =>
          (song.artist || null) === (payload.artist || null)
          && (song.spotify_id || null) === (payload.spotify_id || null)
          && (song.youtube_id || null) === (payload.youtube_id || null)
        ) || data[0]

        return appendOrUpdateSong(recovered)
      } catch {
        return null
      }
    }

    let data
    let error
    try {
      const result = await withTimeout(
        supabase
          .from('songs')
          .insert(payload)
          .select(`
            *,
            votes(id, user_id, value),
            reactions(id, user_id, emoji),
            comments(id, user_id, body, created_at, updated_at, profiles(display_name, avatar_url))
          `)
          .single(),
        SONG_WRITE_TIMEOUT_MS,
        'Adding song timed out. Please try again.'
      )
      data = result.data
      error = result.error
    } catch (e) {
      if (isDuplicateSongError(e)) {
        throw new Error(DUPLICATE_SONG_ERROR)
      }

      const recovered = await recoverAddedSong()
      if (recovered) return recovered
      throw e
    }

    if (isDuplicateSongError(error)) {
      throw new Error(DUPLICATE_SONG_ERROR)
    }

    if (error) throw error

    return appendOrUpdateSong(data)
  }

  function findSimilarSongInGig(gigId, songData) {
    const incoming = decodeSongTextFields(songData)
    const incomingTitle = incoming?.title || ''
    if (!incomingTitle.trim()) return null

    let bestMatch = null
    let bestScore = 0

    for (const existingSong of songs.value) {
      if (existingSong.gig_id !== gigId) continue
      if (existingSong.spotify_id && songData.spotifyId && existingSong.spotify_id === songData.spotifyId) continue
      if (existingSong.youtube_id && songData.youtubeId && existingSong.youtube_id === songData.youtubeId) continue

      const titleScore = titleSimilarityScore(incomingTitle, existingSong.title || '')
      const artistScore = artistSimilarityScore(incoming.artist || '', existingSong.artist || '')

      const isLikelySimilar = titleScore >= 0.9 || (titleScore >= 0.75 && artistScore >= 0.3)
      if (!isLikelySimilar) continue

      const combined = titleScore + artistScore * 0.15
      if (combined > bestScore) {
        bestScore = combined
        bestMatch = existingSong
      }
    }

    return bestMatch
  }

  async function removeSong(songId, options = {}) {
    const onSuccess = typeof options.onSuccess === 'function' ? options.onSuccess : null
    const { error } = await supabase.from('songs').delete().eq('id', songId)
    if (error) throw error
    const removedSong = songs.value.find((s) => s.id === songId) || null
    if (onSuccess) onSuccess(removedSong)
    songs.value = songs.value.filter((s) => s.id !== songId)
    return removedSong
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
    const normalizedSong = decodeSongTextFields(song)
    return {
      ...normalizedSong,
      score: calcScore(normalizedSong.votes ?? []),
      myVote: (normalizedSong.votes ?? []).find((v) => v.user_id === userId)?.value ?? null,
    }
  }

  function calcScore(votes) {
    return (votes ?? []).reduce((sum, v) => sum + (v.value ?? 0), 0)
  }

  async function updateSetlistFields(songId, fields) {
    // fields: any subset of { setlist_order, song_key, is_cancelled, bpm }
    const allowed = {}
    for (const key of ['setlist_order', 'song_key', 'is_cancelled', 'bpm']) {
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

  async function getActivitySummary(gigId) {
    const authStore = useAuthStore()
    const userId = authStore.user?.id
    if (!userId) return null

    try {
      const { data, error } = await supabase.rpc('get_gig_activity_summary', {
        target_gig_id: gigId,
        caller_id: userId,
      })
      if (error) throw error
      return data
    } catch (e) {
      console.error('Failed to fetch activity summary:', e)
      return null
    }
  }

  async function updateLastVisited(gigId) {
    const authStore = useAuthStore()
    const userId = authStore.user?.id
    if (!userId) return

    try {
      await supabase.rpc('update_last_visited', {
        target_gig_id: gigId,
        caller_id: userId,
      })
    } catch (e) {
      console.error('Failed to update last visited:', e)
    }
  }

  return {
    songs, loading,
    fetchSongs, addSong, removeSong, castVote, toggleReaction, addComment, updateComment,
    subscribeToGig, unsubscribe,
    findSimilarSongInGig,
    updateSetlistFields, uploadVoiceMemo, pruneStaleMemos,
    getActivitySummary, updateLastVisited,
  }
})
