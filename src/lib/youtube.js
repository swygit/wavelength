/**
 * YouTube Data API v3 helpers.
 * Used as a fallback when a Spotify preview is unavailable.
 */

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

/**
 * Search YouTube for a video matching the given song.
 * @param {string} query
 * @param {number} maxResults
 * @returns {Promise<Array>}
 */
export async function searchYouTubeVideos(query, maxResults = 5) {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY
  if (!apiKey) throw new Error('YouTube API key not configured.')

  const url = new URL(YOUTUBE_API_BASE + '/search')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('q', query)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('type', 'video')
  url.searchParams.set('videoEmbeddable', 'true')
  url.searchParams.set('videoSyndicated', 'true')
  url.searchParams.set('videoCategoryId', '10') // Music category
  url.searchParams.set('maxResults', String(maxResults))

  const res = await fetch(url.toString())
  if (!res.ok) {
    let message = 'YouTube search failed'
    try {
      const err = await res.json()
      const apiMessage = err?.error?.message
      if (apiMessage) message = `YouTube search failed: ${apiMessage}`
    } catch {
      // Ignore parse errors and keep default message.
    }
    throw new Error(message)
  }

  const data = await res.json()
  return (data.items ?? []).map((item) => ({
    source: 'youtube',
    youtubeId: item.id.videoId,
    title: item.snippet.title,
    artist: item.snippet.channelTitle,
    album: null,
    albumArt: item.snippet.thumbnails?.medium?.url ?? null,
    previewUrl: null,
    externalUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    durationMs: null,
  }))
}

/**
 * Returns the YouTube embed URL for a given video ID.
 * @param {string} videoId
 * @returns {string}
 */
export function getYouTubeEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1`
}
