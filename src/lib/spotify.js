/**
 * Spotify API helpers.
 * Queries the server-side Supabase Edge Function so client-side secrets are not required.
 */
import { supabase } from './supabase'

/**
 * Search Spotify for tracks.
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function searchSpotifyTracks(query, limit = 10) {
  const { data, error } = await supabase.functions.invoke('spotify-search', {
    body: { query, limit },
  })

  if (error) {
    throw new Error(error.message || 'Spotify search failed')
  }

  if (!Array.isArray(data)) {
    throw new Error('Spotify search failed')
  }

  return data
}
