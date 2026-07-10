import { getEntityDirectories } from '../../bootstrap/config.js'

export function isLikelyVectorOrFragmentUri(uri) {
  const value = String(uri || '').toLowerCase()
  if (!value) return false
  return value.includes('/heluo/vector/') || value.includes('/processed/vector/')
}

export function isDataJsonLdUri(uri) {
  return String(uri || '').toLowerCase().startsWith('/processed/json-ld/')
}

function isPersonPrimaryUri(uri) {
  const value = String(uri || '').toLowerCase()
  if (!value || isLikelyVectorOrFragmentUri(value)) return false
  return (
    value.includes('/heluo/persons/') ||
    value.includes('/person/') ||
    value.includes('/persons/')
  )
}

function isBookPrimaryUri(uri) {
  const value = String(uri || '').toLowerCase()
  if (!value || isLikelyVectorOrFragmentUri(value)) return false
  return (
    value.includes('/processed/json-ld/book/') ||
    value.includes('/heluo/books/') ||
    value.includes('/book/') ||
    value.includes('/books/')
  )
}

function isPlacePrimaryUri(uri) {
  const value = String(uri || '').toLowerCase()
  if (!value || isLikelyVectorOrFragmentUri(value)) return false
  return (
    value.includes('/processed/json-ld/place/') ||
    value.includes('/heluo/places/') ||
    value.includes('/place/') ||
    value.includes('/places/')
  )
}

function isConceptPrimaryUri(uri) {
  const value = String(uri || '').toLowerCase()
  if (!value || isLikelyVectorOrFragmentUri(value)) return false
  return (
    value.includes('/processed/json-ld/concept/') ||
    value.includes('/heluo/concepts/') ||
    value.includes('/concept/')
  )
}

function isAncientBookPrimaryUri(uri) {
  const value = String(uri || '').toLowerCase()
  if (!value || isLikelyVectorOrFragmentUri(value)) return false
  return (
    value.includes('/processed/json-ld/ancient-book/') ||
    value.includes('/heluo/ancient-books/')
  )
}

function isPoemPrimaryUri(uri) {
  const value = String(uri || '').toLowerCase()
  if (!value || isLikelyVectorOrFragmentUri(value)) return false
  return (
    value.includes('/processed/json-ld/poem/') ||
    value.includes('/heluo/poems') ||
    value.includes('/poem/')
  )
}

function inferEntityTypeFromVectorUri(uri) {
  const value = String(uri || '').toLowerCase()
  if (value.includes('/ancient-book/')) return 'ancient_book'
  if (value.includes('/person/')) return 'person'
  if (value.includes('/poem/')) return 'poem'
  if (value.includes('/book/')) return 'book'
  if (value.includes('/place/')) return 'place'
  if (value.includes('/concept/')) return 'concept'
  if (value.includes('/iiif/')) return 'iiif'
  return null
}

export function inferEntityType(uri) {
  if (isLikelyVectorOrFragmentUri(uri)) {
    return inferEntityTypeFromVectorUri(uri) || 'entity'
  }

  if (isPersonPrimaryUri(uri)) return 'person'
  if (isPoemPrimaryUri(uri)) return 'poem'
  if (isBookPrimaryUri(uri)) return 'book'
  if (isAncientBookPrimaryUri(uri)) return 'ancient_book'
  if (isPlacePrimaryUri(uri)) return 'place'
  if (isConceptPrimaryUri(uri)) return 'concept'
  return 'entity'
}

export function extractCandidateUris(raw, limit = 40) {
  const queue = [raw]
  const seen = new Set()
  const output = []
  while (queue.length > 0 && output.length < limit) {
    const current = queue.shift()
    if (Array.isArray(current)) {
      queue.push(...current)
      continue
    }
    if (current && typeof current === 'object') {
      queue.push(...Object.values(current))
      continue
    }
    if (typeof current !== 'string') continue
    const text = current.trim()
    if (!text || seen.has(text)) continue
    if (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('/')) {
      seen.add(text)
      output.push(text)
    }
  }
  return output
}

export function buildPossibleUris(id, type) {
  const uris = []
  switch (type) {
    case 'person':
      uris.push(
        `/processed/json-ld/person/${id}.json`,
        `/processed/json-ld/person/${id}`,
      )
      break
    case 'poem':
      uris.push(
        `/processed/json-ld/poem/set/${id}.json`,
        `/processed/json-ld/poem/set/${id}`,
        `/processed/json-ld/poem/text/${id}.json`,
        `/processed/json-ld/poem/text/${id}`,
      )
      break
    case 'book':
      uris.push(
        `/processed/json-ld/book/${id}.json`,
        `/processed/json-ld/book/${id}`,
      )
      break
    case 'place':
      uris.push(
        `/processed/json-ld/place/${id}.json`,
        `/processed/json-ld/place/${id}`,
      )
      break
    case 'concept':
      uris.push(
        `/processed/json-ld/concept/${id}.json`,
        `/processed/json-ld/concept/${id}`,
      )
      break
    case 'ancient_book':
      uris.push(
        `/processed/json-ld/ancient-book/set/book-entry/${id}.json`,
        `/processed/json-ld/ancient-book/set/book-entry/${id}`,
      )
      break
    default:
      uris.push(`/processed/json-ld/${type}/${id}.json`)
  }
  return uris
}

export function getDirectoriesForType(type) {
  const dirMap = {
    poem: [
      ...getEntityDirectories('poem'),
      '/processed/json-ld/poem/text/',
    ],
  }
  return dirMap[type] || getEntityDirectories(type)
}
