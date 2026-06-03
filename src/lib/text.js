const NAMED_ENTITIES = {
  '&amp;': '&',
  '&apos;': "'",
  '&#39;': "'",
  '&quot;': '"',
  '&lt;': '<',
  '&gt;': '>',
}

export function decodeHtmlEntities(value) {
  if (typeof value !== 'string') return value ?? ''
  if (!value.includes('&')) return value

  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea')
    textarea.innerHTML = value
    return textarea.value
  }

  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&(amp|apos|quot|lt|gt|#39);/g, (entity) => NAMED_ENTITIES[entity] ?? entity)
}

export function decodeSongTextFields(song) {
  if (!song || typeof song !== 'object') return song

  return {
    ...song,
    title: decodeHtmlEntities(song.title),
    artist: decodeHtmlEntities(song.artist),
    album: decodeHtmlEntities(song.album),
  }
}

export function normalizeExternalUrl(value) {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /^www\./i.test(trimmed)
      ? `https://${trimmed}`
      : null

  if (!candidate) return null

  try {
    const parsed = new URL(candidate)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    return parsed.toString()
  } catch {
    return null
  }
}