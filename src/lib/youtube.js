/**
 * YouTube Data API v3 helpers.
 * Uses a server-side Supabase Edge Function to keep API keys out of the client.
 */

import { supabase } from './supabase'

/**
 * Search YouTube for a video matching the given song.
 * @param {string} query
 * @param {number} maxResults
 * @returns {Promise<Array>}
 */
export async function searchYouTubeVideos(query, maxResults = 5) {
  const { data, error } = await supabase.functions.invoke('youtube-search', {
    body: { query, maxResults },
  })

  if (error) {
    throw new Error(error.message || 'YouTube search failed')
  }

  if (!Array.isArray(data)) {
    throw new Error('YouTube search failed')
  }

  return data
}

/**
 * Returns the YouTube embed URL for a given video ID.
 * @param {string} videoId
 * @returns {string}
 */
export function getYouTubeEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1`
}
