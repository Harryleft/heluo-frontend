import { VECTOR_CONFIG } from './config.js'
import { createTtlCache } from './cache.js'
import { marklogicFetchWithTimeout } from './transport.js'

const vectorDocCache = createTtlCache(VECTOR_CONFIG.docCacheMaxSize, VECTOR_CONFIG.docCacheTtlMs)
const poemInfoCache = createTtlCache(VECTOR_CONFIG.poemInfoCacheMaxSize, VECTOR_CONFIG.poemInfoCacheTtlMs)
const poemTextCache = createTtlCache(VECTOR_CONFIG.poemTextCacheMaxSize, VECTOR_CONFIG.poemTextCacheTtlMs)

export async function fetchDocumentJsonCached(uri, marklogicFetch, marklogicBaseUrl, label = 'vectorDoc') {
  const normalizedUri = String(uri || '').trim()
  if (!normalizedUri) return null
  const cacheKey = `${marklogicBaseUrl}|${normalizedUri}`
  const cached = vectorDocCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }

  const response = await marklogicFetchWithTimeout(
    marklogicFetch,
    `${marklogicBaseUrl}/v1/documents?uri=${encodeURIComponent(normalizedUri)}`,
    { headers: { Accept: 'application/json' } },
    label,
  )
  if (!response.ok) {
    vectorDocCache.set(cacheKey, null)
    return null
  }

  const doc = await response.json().catch(() => null)
  vectorDocCache.set(cacheKey, doc || null)
  return doc || null
}

export async function getPoemFullInfo(poemId, marklogicFetch, marklogicBaseUrl) {
  const normalizedPoemId = String(poemId || '').trim()
  if (!normalizedPoemId) return null
  const cacheKey = `${marklogicBaseUrl}|${normalizedPoemId}`
  const cached = poemInfoCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }

  try {
    const possibleUris = [
      `/processed/json-ld/poem/set/poem_${normalizedPoemId}.json`,
      `/processed/json-ld/poem/set/${normalizedPoemId}.json`,
    ]

    for (const uri of possibleUris) {
      const doc = await fetchDocumentJsonCached(
        uri,
        marklogicFetch,
        marklogicBaseUrl,
        `poemFullInfo:${normalizedPoemId}`,
      )

      if (doc) {
        const output = {
          title: doc._label || doc.title || doc.text_norm || '',
          author: doc.author_name || doc.author || '',
          dynasty: doc.dynasty || '',
          fullText: doc.full_text || doc.fullText || '',
          intro: doc.intro || '',
        }
        poemInfoCache.set(cacheKey, output)
        return output
      }
    }

    poemInfoCache.set(cacheKey, null)
    return null
  } catch (e) {
    console.warn(`[VectorSearch] 获取诗词完整信息失败 poemId=${normalizedPoemId}:`, e.message)
    poemInfoCache.set(cacheKey, null)
    return null
  }
}

export async function getPoemFullText(poemId, marklogicFetch, marklogicBaseUrl) {
  const normalizedPoemId = String(poemId || '').trim()
  if (!normalizedPoemId) return ''
  const cacheKey = `${marklogicBaseUrl}|${normalizedPoemId}`
  const cached = poemTextCache.get(cacheKey)
  if (cached !== undefined) {
    return String(cached || '')
  }

  try {
    const response = await marklogicFetchWithTimeout(
      marklogicFetch,
      `${marklogicBaseUrl}/v1/search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          search: {
            query: {
              queries: [
                { 'directory-query': { uri: ['/processed/vector/poem/text/'] } },
                { 'term-query': { text: [`poem_${normalizedPoemId}_`, `/${normalizedPoemId}_`] } },
              ],
            },
            options: {
              'return-results': true,
              'page-length': 100,
            },
          },
        }),
      },
      `poemFullTextSearch:${normalizedPoemId}`,
    )

    if (!response.ok) {
      poemTextCache.set(cacheKey, '')
      return ''
    }

    const data = await response.json()
    const lines = []

    for (const result of data.results || []) {
      const doc = await fetchDocumentJsonCached(
        result?.uri,
        marklogicFetch,
        marklogicBaseUrl,
        `poemFullTextDoc:${normalizedPoemId}`,
      )

      if (doc?.text_norm) {
        const segNo = doc.evidence?.seg_no || 0
        lines.push({ segNo, text: doc.text_norm })
      }
    }

    const merged = lines
      .sort((a, b) => a.segNo - b.segNo)
      .map(l => l.text)
      .join('')
    poemTextCache.set(cacheKey, merged)
    return merged
  } catch (e) {
    console.warn(`[VectorSearch] 获取诗词全文失败 poemId=${normalizedPoemId}:`, e.message)
    poemTextCache.set(cacheKey, '')
    return ''
  }
}
