import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

export const useSongStore = defineStore('songs', () => {
  const songs = ref([])
  const loading = ref(false)
  let realtimeChannel = null

  async function fetchSongs(gigId) {
    loading.value = true
    const { data, error } = await supabase
      .from('songs')
      .select(`
        *,
        votes(id, user_id, value),
        reactions(id, user_id, emoji),
        comments(id, user_id, body, created_at, profiles(display_name, avatar_url))
      `)
      .eq('gig_id', gigId)
      .order('created_at', { ascending: true })
    if (error) throw error
    songs.value = (data ?? []).map(enrichSong)
    loading.value = false
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
        comments(id, user_id, body, created_at, profiles(display_name, avatar_url))
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

    // Upsert the vote (one vote per user per song)
    const { data, error } = await supabase
      .from('votes')
      .upsert({ song_id: songId, user_id: userId, value }, { onConflict: 'song_id,user_id' })
      .select()
      .single()
    if (error) throw error

    const song = songs.value.find((s) => s.id === songId)
    if (song) {
      const idx = song.votes.findIndex((v) => v.user_id === userId)
      if (idx >= 0) song.votes[idx] = data
      else song.votes.push(data)
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
      if (song) song.reactions.push(data)
    }
  }

  async function addComment(songId, body) {
    const authStore = useAuthStore()
    const { data, error } = await supabase
      .from('comments')
      .insert({ song_id: songId, user_id: authStore.user.id, body })
      .select('id, user_id, body, created_at, profiles(display_name, avatar_url)')
      .single()
    if (error) throw error
    const song = songs.value.find((s) => s.id === songId)
    if (song) song.comments.push(data)
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
      const idx = song.votes.findIndex((v) => v.id === row.id)
      if (idx >= 0) song.votes[idx] = row
      else song.votes.push(row)
    } else if (eventType === 'DELETE') {
      song.votes = song.votes.filter((v) => v.id !== row.id)
    }
    song.score = calcScore(song.votes)
  }

  function handleReactionChange(payload) {
    const { eventType, new: newRow, old: oldRow } = payload
    const row = newRow || oldRow
    const song = songs.value.find((s) => s.id === row.song_id)
    if (!song) return
    if (eventType === 'INSERT') song.reactions.push(row)
    else if (eventType === 'DELETE') song.reactions = song.reactions.filter((r) => r.id !== row.id)
  }

  async function handleCommentInsert(payload) {
    const row = payload.new
    const song = songs.value.find((s) => s.id === row.song_id)
    if (!song) return
    // Fetch with profile
    const { data } = await supabase
      .from('comments')
      .select('id, user_id, body, created_at, profiles(display_name, avatar_url)')
      .eq('id', row.id)
      .single()
    if (data) song.comments.push(data)
  }

  async function handleSongInsert(payload) {
    const row = payload.new
    if (songs.value.some((s) => s.id === row.id)) return
    const { data } = await supabase
      .from('songs')
      .select('*, votes(id, user_id, value), reactions(id, user_id, emoji), comments(id, user_id, body, created_at, profiles(display_name, avatar_url))')
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

  return {
    songs, loading,
    fetchSongs, addSong, removeSong, castVote, toggleReaction, addComment,
    subscribeToGig, unsubscribe,
  }
})
