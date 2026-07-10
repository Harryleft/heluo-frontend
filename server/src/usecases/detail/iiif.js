import { normalizeText } from '../../utils/textUtils.js'

export function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/g, '')
}

export function parseIiifPublicPath(value) {
  const text = normalizeText(value)
  if (!text) return ''
  if (text.startsWith('/iiif/')) return text

  try {
    const parsed = new URL(text)
    return parsed.pathname
  } catch {
    return ''
  }
}

export function buildIiifMarklogicCandidates(publicPath) {
  const path = normalizeText(publicPath)
  if (!path) return []

  const shortManifestMatch = path.match(/^\/iiif\/manifests\/([^/]+)\/(manifest|collection)\.json$/i)
  if (shortManifestMatch?.[1] && shortManifestMatch?.[2]) {
    return [
      `/processed/iiif/manifests/${shortManifestMatch[1]}/${shortManifestMatch[2]}.json`,
      `/iiif/manifests/${shortManifestMatch[1]}/${shortManifestMatch[2]}.json`,
    ]
  }

  const longManifestMatch = path.match(/^\/iiif\/manifests\/ancientBook\/([^/]+)\/([^/]+)\/manifest\.json$/i)
  if (longManifestMatch?.[1]) {
    return [
      `/processed/iiif/manifests/${longManifestMatch[1]}/manifest.json`,
      `/iiif/manifests/${longManifestMatch[1]}/manifest.json`,
    ]
  }

  const v3ManifestMatch = path.match(/^\/iiif\/3\/manifest\/ancientBook\/([^/]+)\/([^/?#]+)$/i)
  if (v3ManifestMatch?.[1]) {
    return [
      `/processed/iiif/manifests/${v3ManifestMatch[1]}/manifest.json`,
      `/iiif/manifests/${v3ManifestMatch[1]}/manifest.json`,
    ]
  }

  const ancientBookCollectionMatch = path.match(/^\/iiif\/3\/collection\/ancientBook\/([^/?#]+)$/i)
  if (ancientBookCollectionMatch?.[1]) {
    return [
      `/processed/iiif/manifests/${ancientBookCollectionMatch[1]}/collection.json`,
      `/iiif/manifests/${ancientBookCollectionMatch[1]}/collection.json`,
    ]
  }

  const personCollectionMatch = path.match(/^\/iiif\/3\/collection\/person\/([^/?#]+)$/i)
  if (personCollectionMatch?.[1]) {
    return [`/processed/iiif/collections/${personCollectionMatch[1]}/collection.json`]
  }

  return []
}

export async function loadIiifDocumentFromMarkLogicByCandidates(candidates, mlGetDoc) {
  for (const uri of candidates) {
    const document = await mlGetDoc(uri, { allowWhenJsonLdOnly: true })
    if (document) return document
  }
  return null
}

export function rewriteIiifPublicDocument(document, publicOrigin) {
  const origin = trimTrailingSlash(publicOrigin)
  if (!origin) return document

  const rewriteString = (value) => {
    const text = String(value || '')
    if (!text) return text

    return text
      .replace(
        /^https?:\/\/localhost:8083\/iiif\/manifests\/ancientBook\/([^/]+)\/([^/]+)\/manifest\.json$/i,
        `${origin}/iiif/manifests/ancientBook/$1/$2/manifest.json`,
      )
      .replace(
        /^https?:\/\/localhost:8083\/iiif\/manifests\/([^/]+)\/manifest\.json$/i,
        `${origin}/iiif/manifests/$1/manifest.json`,
      )
      .replace(
        /^https?:\/\/localhost:8083\/iiif\/manifests\/([^/]+)\/collection\.json$/i,
        `${origin}/iiif/manifests/$1/collection.json`,
      )
      .replace(
        /^https?:\/\/localhost:8083\/iiif\/3\/collection\/ancientBook\/([^/?#]+)$/i,
        `${origin}/iiif/3/collection/ancientBook/$1`,
      )
      .replace(
        /^https?:\/\/localhost:8083\/iiif\/3\/collection\/person\/([^/?#]+)$/i,
        `${origin}/iiif/3/collection/person/$1`,
      )
      .replace(
        /^https?:\/\/localhost:8083\/iiif\/3\/search\/ancientBook\/([^/]+)\/([^/?#]+)$/i,
        `${origin}/iiif/3/search/ancientBook/$1/$2`,
      )
  }

  const deepRewrite = (value) => {
    if (Array.isArray(value)) return value.map((item) => deepRewrite(item))
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, deepRewrite(child)]),
      )
    }
    if (typeof value === 'string') return rewriteString(value)
    return value
  }

  return deepRewrite(document)
}

function extractCanvasText(canvas) {
  const annotationPages = Array.isArray(canvas?.annotations) ? canvas.annotations : []
  for (const page of annotationPages) {
    const items = Array.isArray(page?.items) ? page.items : []
    for (const annotation of items) {
      if (normalizeText(annotation?.motivation) !== 'supplementing') continue
      const body = annotation?.body
      if (typeof body?.value === 'string' && body.value.trim()) {
        return body.value
      }
    }
  }
  return ''
}

export function extractIiifSearchMatches(manifest, query) {
  const items = Array.isArray(manifest?.items) ? manifest.items : []
  const needle = normalizeText(query).toLowerCase()
  if (!needle) return []

  const matches = []
  for (const canvas of items) {
    const canvasText = extractCanvasText(canvas)
    const haystack = normalizeText(canvasText)
    if (!haystack) continue
    const hitIndex = haystack.toLowerCase().indexOf(needle)
    if (hitIndex < 0) continue

    const contextStart = Math.max(0, hitIndex - 50)
    const contextEnd = Math.min(haystack.length, hitIndex + needle.length + 50)
    let context = haystack.slice(contextStart, contextEnd)
    if (contextStart > 0) context = `...${context}`
    if (contextEnd < haystack.length) context = `${context}...`

    matches.push({
      canvasId: normalizeText(canvas?.id),
      context,
    })
  }

  return matches
}

export function buildIiifSearchResponse({ query, searchUrl, results }) {
  const resources = []
  const hits = []

  results.forEach((result, index) => {
    const annotationId = `${searchUrl}/annotation/${index + 1}`
    resources.push({
      '@id': annotationId,
      '@type': 'oa:Annotation',
      motivation: 'sc:painting',
      resource: {
        '@type': 'cnt:ContentAsText',
        chars: result.context,
      },
      on: result.canvasId,
    })
    hits.push({
      '@type': 'search:Hit',
      annotations: [annotationId],
      match: result.context.slice(0, 100),
    })
  })

  return {
    '@context': [
      'http://iiif.io/api/presentation/2/context.json',
      'http://iiif.io/api/search/1/context.json',
    ],
    '@id': `${searchUrl}?q=${encodeURIComponent(query)}`,
    '@type': 'sc:AnnotationList',
    resources,
    hits,
  }
}
