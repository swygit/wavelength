export {}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
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
    const apiKey = Deno.env.get('YOUTUBE_API_KEY')
    if (!apiKey) {
      throw new Error('Server YouTube API key is not configured.')
    }

    const body = await req.json().catch(() => ({}))
    const query = typeof body.query === 'string' ? body.query.trim() : ''
    const rawMaxResults = Number(body.maxResults)
    const maxResults = Number.isFinite(rawMaxResults)
      ? Math.min(Math.max(rawMaxResults, 1), 10)
      : 5

    if (!query) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const url = new URL('https://www.googleapis.com/youtube/v3/search')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('q', query)
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('type', 'video')
    url.searchParams.set('videoEmbeddable', 'true')
    url.searchParams.set('videoSyndicated', 'true')
    url.searchParams.set('videoCategoryId', '10')
    url.searchParams.set('maxResults', String(maxResults))

    const youtubeRes = await fetch(url.toString())

    if (!youtubeRes.ok) {
      let message = 'YouTube search failed.'
      try {
        const payload = await youtubeRes.json()
        const apiMessage = payload?.error?.message
        if (apiMessage) {
          message = 'YouTube search failed: ' + apiMessage
        }
      } catch {
        // Ignore parse errors and keep the default message.
      }
      throw new Error(message)
    }

    const youtubeData = await youtubeRes.json()
    const videos = (youtubeData.items ?? []).map((item: any) => ({
      source: 'youtube',
      youtubeId: item.id?.videoId ?? null,
      title: item.snippet?.title ?? null,
      artist: item.snippet?.channelTitle ?? null,
      album: null,
      albumArt: item.snippet?.thumbnails?.medium?.url ?? null,
      previewUrl: null,
      externalUrl: item.id?.videoId ? 'https://www.youtube.com/watch?v=' + item.id.videoId : null,
      durationMs: null,
    }))

    return new Response(JSON.stringify(videos), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'YouTube search failed.' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
