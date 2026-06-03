const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

let spotifyToken: string | null = null
let spotifyTokenExpiryMs = 0

async function getSpotifyToken() {
  if (spotifyToken && Date.now() < spotifyTokenExpiryMs) {
    return spotifyToken
  }

  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID')
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error('Server Spotify credentials are not configured.')
  }

  const basic = btoa(clientId + ':' + clientSecret)
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + basic,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!tokenRes.ok) {
    throw new Error('Failed to get Spotify token.')
  }

  const tokenData = await tokenRes.json()
  spotifyToken = tokenData.access_token
  spotifyTokenExpiryMs = Date.now() + (Number(tokenData.expires_in ?? 0) - 60) * 1000

  if (!spotifyToken) {
    throw new Error('Failed to get Spotify token.')
  }

  return spotifyToken
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const query = typeof body.query === 'string' ? body.query.trim() : ''
    const rawLimit = Number(body.limit)
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 20) : 10

    if (!query) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const token = await getSpotifyToken()

    const url = new URL('https://api.spotify.com/v1/search')
    url.searchParams.set('q', query)
    url.searchParams.set('type', 'track')
    url.searchParams.set('limit', String(limit))

    const spotifyRes = await fetch(url.toString(), {
      headers: { Authorization: 'Bearer ' + token },
    })

    if (!spotifyRes.ok) {
      throw new Error('Spotify search failed.')
    }

    const spotifyData = await spotifyRes.json()
    const tracks = (spotifyData.tracks?.items ?? []).map((t: any) => ({
      source: 'spotify',
      spotifyId: t.id,
      title: t.name,
      artist: Array.isArray(t.artists) ? t.artists.map((a: any) => a.name).join(', ') : null,
      album: t.album?.name ?? null,
      albumArt: t.album?.images?.[0]?.url ?? null,
      previewUrl: t.preview_url ?? null,
      externalUrl: t.external_urls?.spotify ?? null,
      durationMs: t.duration_ms ?? null,
    }))

    return new Response(JSON.stringify(tracks), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Spotify search failed.' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
