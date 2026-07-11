import { VECTOR_CONFIG } from './config.js'
import { normalizeLexicalQuery } from './resultUtils.js'

function buildTimeoutError(label, timeoutMs, url) {
  const error = new Error(
    `[VectorSearch] MarkLogic 请求超时 label=${label}, timeoutMs=${timeoutMs}, url=${url}`,
  )
  error.code = 'VECTOR_MARKLOGIC_TIMEOUT'
  return error
}

export async function marklogicFetchWithTimeout(
  marklogicFetch,
  url,
  init = {},
  label = 'unknown',
  timeoutMs = VECTOR_CONFIG.requestTimeoutMs,
) {
  const safeTimeoutMs = Math.max(500, Number(timeoutMs) || VECTOR_CONFIG.requestTimeoutMs)
  const canAbort = typeof globalThis.AbortController === 'function'
  const controller = canAbort ? new globalThis.AbortController() : null
  const requestInit = controller ? { ...init, signal: controller.signal } : { ...init }
  let timer = null

  try {
    return await Promise.race([
      marklogicFetch(url, requestInit),
      new Promise((_, reject) => {
        timer = globalThis.setTimeout(() => {
          if (controller) controller.abort()
          reject(buildTimeoutError(label, safeTimeoutMs, url))
        }, safeTimeoutMs)
      }),
    ])
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw buildTimeoutError(label, safeTimeoutMs, url)
    }
    throw error
  } finally {
    if (timer) globalThis.clearTimeout(timer)
  }
}

export async function fetchLexicalCandidates(indexPath, queryText, pageLength, marklogicFetch, marklogicBaseUrl) {
  const normalizedPath = indexPath.endsWith('/') ? indexPath : `${indexPath}/`
  const normalizedQuery = normalizeLexicalQuery(queryText)
  if (!normalizedQuery || pageLength <= 0) return []

  const params = new URLSearchParams({
    format: 'json',
    directory: normalizedPath,
    q: normalizedQuery,
    pageLength: String(pageLength),
  })
  const url = `${marklogicBaseUrl}/v1/search?${params.toString()}`
  const response = await marklogicFetchWithTimeout(
    marklogicFetch,
    url,
    { headers: { Accept: 'application/json' } },
    `lexicalCandidates:${normalizedPath}`,
  )
  if (!response.ok) return []

  const data = await response.json().catch(() => null)
  return Array.isArray(data?.results) ? data.results : []
}
