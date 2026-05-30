/**
 * Spotify API helpers.
 * Uses the Client Credentials flow to fetch a bearer token, then queries the
 * Search endpoint.  Preview URLs come back inside each track object.
 */

let _spotifyToken = null
let _tokenExpiry = 0

async function getSpotifyToken() {
  if (_spotifyToken && Date.now() < _tokenExpiry) return _spotifyToken

  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID
  const clientSecret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not configured.')
  }

  const creds = btoa(`${clientId}:${clientSecret}`)
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) throw new Error('Failed to get Spotify token')

  const data = await res.json()
  _spotifyToken = data.access_token
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return _spotifyToken
}

/**
 * Search Spotify for tracks.
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function searchSpotifyTracks(query, limit = 10) {
  const token = await getSpotifyToken()

  const url = new URL('https://api.spotify.com/v1/search')
  url.searchParams.set('q', query)
  url.searchParams.set('type', 'track')
  url.searchParams.set('limit', String(limit))

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw new Error('Spotify search failed')

  const data = await res.json()
  return (data.tracks?.items ?? []).map((t) => ({
    source: 'spotify',
    spotifyId: t.id,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(', '),
    album: t.album.name,
    albumArt: t.album.images[0]?.url ?? null,
    previewUrl: t.preview_url,
    externalUrl: t.external_urls.spotify,
    durationMs: t.duration_ms,
  }))
}
