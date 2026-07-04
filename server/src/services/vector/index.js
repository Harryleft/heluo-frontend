/**
 * MarkLogic 向量搜索服务
 * 使用 MarkLogic 的向量搜索功能进行语义相似度检索
 *
 * 增强功能：
 * - 对于 poem/text 结果，自动关联获取完整诗文信息
 * - 返回标题、作者、完整内容等丰富信息
 */

import { cosineSimilarity as cosineSimilarityUtil } from '../embeddingService.js'

// ========== 配置 ==========
const VECTOR_CONFIG = {
  // 向量索引路径映射（每个实体类型可能对应多个向量路径）
  indexPaths: {
    person: ['/processed/vector/person/'],
    poem: ['/processed/vector/poem/set/', '/processed/vector/poem/text/'],
    book: ['/processed/vector/book/'],
    ancient_book: [
      '/processed/vector/ancient-book/set/',
      '/processed/vector/ancient-book/object/',
      '/processed/vector/ancient-book/text/',
      '/processed/vector/ancient-book/concept/',
    ],
    place: ['/processed/vector/place/'],
    concept: [
      '/processed/vector/concept/poetic-form/',
      '/processed/vector/concept/rhyme/',
    ],
    iiif: ['/processed/vector/iiif/'],
  },
  // 默认返回数量
  defaultTopK: 20,
  // 相似度阈值
  similarityThreshold: 0.3,
  // 向量维度（text2vec-base-chinese 为 768 维）
  vectorDimension: 768,
  // 是否启用向量搜索
  enabled: process.env.VECTOR_SEARCH_ENABLED !== 'false',
  // 搜索时获取的候选文档数量（用于计算相似度）
  candidatePoolSize: Number(process.env.VECTOR_CANDIDATE_POOL_SIZE) || 60,
  // 基于关键词补充的候选池大小
  lexicalCandidatePoolSize: Number(process.env.VECTOR_LEXICAL_CANDIDATE_POOL_SIZE) || 80,
  // 候选池上限，避免极端参数导致过载
  maxCandidatePoolSize: Number(process.env.VECTOR_CANDIDATE_POOL_MAX_SIZE) || 600,
  // MarkLogic 请求超时（毫秒）
  requestTimeoutMs: Number(process.env.VECTOR_MARKLOGIC_TIMEOUT_MS) || 8000,
  // 候选文档并发读取上限
  docFetchConcurrency: Number(process.env.VECTOR_DOC_FETCH_CONCURRENCY) || 12,
  // 第二阶段重补查候选放大系数（相对 topK）
  enrichTopKFactor: Number(process.env.VECTOR_ENRICH_TOPK_FACTOR) || 2,
  // 第二阶段重补查候选上限
  enrichTopNMax: Number(process.env.VECTOR_ENRICH_TOPN_MAX) || 40,
  // 文档缓存配置
  docCacheTtlMs: Number(process.env.VECTOR_DOC_CACHE_TTL_MS) || 60 * 1000,
  docCacheMaxSize: Number(process.env.VECTOR_DOC_CACHE_MAX_SIZE) || 5000,
  // 诗词详情缓存配置
  poemInfoCacheTtlMs: Number(process.env.VECTOR_POEM_INFO_CACHE_TTL_MS) || 10 * 60 * 1000,
  poemInfoCacheMaxSize: Number(process.env.VECTOR_POEM_INFO_CACHE_MAX_SIZE) || 2000,
  // 诗词全文缓存配置
  poemTextCacheTtlMs: Number(process.env.VECTOR_POEM_TEXT_CACHE_TTL_MS) || 10 * 60 * 1000,
  poemTextCacheMaxSize: Number(process.env.VECTOR_POEM_TEXT_CACHE_MAX_SIZE) || 1000,
  // 诗文分层配额（poem/set / poem/text）
  poemSetQuotaRatio: Number(process.env.VECTOR_POEM_SET_QUOTA_RATIO) || 0.4,
  poemTxtQuotaRatio: Number(process.env.VECTOR_POEM_TXT_QUOTA_RATIO) || 0.4,
}

function createTtlCache(maxSize = 1000, ttlMs = 60 * 1000) {
  const storage = new Map()
  const safeMaxSize = Math.max(100, Number(maxSize) || 1000)
  const safeTtlMs = Math.max(1000, Number(ttlMs) || 60 * 1000)

  const get = (key) => {
    const entry = storage.get(key)
    if (!entry) return undefined
    if (entry.expiredAt <= Date.now()) {
      storage.delete(key)
      return undefined
    }
    return entry.value
  }

  const set = (key, value) => {
    if (storage.size >= safeMaxSize) {
      const oldestKey = storage.keys().next().value
      if (oldestKey) storage.delete(oldestKey)
    }
    storage.set(key, {
      value,
      expiredAt: Date.now() + safeTtlMs,
    })
  }

  return { get, set }
}

const vectorDocCache = createTtlCache(VECTOR_CONFIG.docCacheMaxSize, VECTOR_CONFIG.docCacheTtlMs)
const poemInfoCache = createTtlCache(VECTOR_CONFIG.poemInfoCacheMaxSize, VECTOR_CONFIG.poemInfoCacheTtlMs)
const poemTextCache = createTtlCache(VECTOR_CONFIG.poemTextCacheMaxSize, VECTOR_CONFIG.poemTextCacheTtlMs)

// ========== 导出配置 ==========
export { VECTOR_CONFIG }

/**
 * 解析候选池大小
 * - 默认使用配置值
 * - 至少保证 topK 的 6 倍候选，提升召回覆盖
 * - 受 maxCandidatePoolSize 限制，避免过载
 *
 * @param {object} options
 * @param {number} topK
 * @returns {number}
 */
function resolveCandidatePoolSize(options = {}, topK = VECTOR_CONFIG.defaultTopK) {
  const rawCandidatePoolSize = Number(options.candidatePoolSize) || VECTOR_CONFIG.candidatePoolSize
  const minByTopK = Math.max(Number(topK) * 4, Number(topK) + 12)
  const lowerBound = Math.max(rawCandidatePoolSize, minByTopK)
  return Math.min(Math.floor(lowerBound), VECTOR_CONFIG.maxCandidatePoolSize)
}

function clampRatio(rawValue, fallbackValue) {
  const value = Number(rawValue)
  if (!Number.isFinite(value)) return fallbackValue
  return Math.min(0.8, Math.max(0.1, value))
}

function toResultDedupKey(row) {
  return String(row?.poemId || row?.uri || '').trim()
}

function getPoemResultBucket(row) {
  const uri = String(row?.uri || '')
  if (uri.includes('/poem/set/')) return 'set'
  if (uri.includes('/poem/text/')) return 'txt'
  return 'other'
}

/**
 * 诗文分层配额：
 * - 保证 poem/set 与 poem/text 在 TopK 中都有最低占比
 * - 其余名额按全局相似度回填
 *
 * @param {Array} sortedRows
 * @param {number} topK
 * @param {object} config
 * @returns {Array}
 */
function applyPoemLayeredQuota(sortedRows = [], topK = VECTOR_CONFIG.defaultTopK, config = VECTOR_CONFIG) {
  if (!Array.isArray(sortedRows) || sortedRows.length === 0) return []
  const safeTopK = Math.max(1, Math.floor(Number(topK) || config.defaultTopK))
  const setRows = []
  const txtRows = []

  for (const row of sortedRows) {
    const bucket = getPoemResultBucket(row)
    if (bucket === 'set') setRows.push(row)
    if (bucket === 'txt') txtRows.push(row)
  }

  const setRatio = clampRatio(config.poemSetQuotaRatio, 0.4)
  const txtRatio = clampRatio(config.poemTxtQuotaRatio, 0.4)
  let setQuota = Math.min(setRows.length, Math.max(1, Math.floor(safeTopK * setRatio)))
  let txtQuota = Math.min(txtRows.length, Math.max(1, Math.floor(safeTopK * txtRatio)))

  while (setQuota + txtQuota > safeTopK) {
    if (txtQuota >= setQuota && txtQuota > 0) {
      txtQuota -= 1
    } else if (setQuota > 0) {
      setQuota -= 1
    } else {
      break
    }
  }

  const selected = []
  const seen = new Set()
  const pick = (row) => {
    const key = toResultDedupKey(row)
    if (!key || seen.has(key)) return false
    seen.add(key)
    selected.push(row)
    return true
  }

  for (const row of setRows) {
    if (setQuota <= 0) break
    if (pick(row)) setQuota -= 1
  }
  for (const row of txtRows) {
    if (txtQuota <= 0) break
    if (pick(row)) txtQuota -= 1
  }

  for (const row of sortedRows) {
    if (selected.length >= safeTopK) break
    pick(row)
  }

  return selected.slice(0, safeTopK)
}

/**
 * 归一化关键词检索文本
 *
 * @param {string} rawQueryText
 * @returns {string}
 */
function normalizeLexicalQuery(rawQueryText = '') {
  const text = String(rawQueryText || '')
    .replace(/[，。！？；：、,.!?;:]/g, ' ')
    .replace(/[“”"'‘’「」『』《》【】（）()]/g, ' ')
    .replace(/\[/g, ' ')
    .replace(/\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text || text === '*') return ''
  return text
}

function buildTimeoutError(label, timeoutMs, url) {
  const error = new Error(
    `[VectorSearch] MarkLogic 请求超时 label=${label}, timeoutMs=${timeoutMs}, url=${url}`,
  )
  error.code = 'VECTOR_MARKLOGIC_TIMEOUT'
  return error
}

async function marklogicFetchWithTimeout(
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

/**
 * 拉取关键词候选，用于补充语义候选覆盖
 *
 * @param {string} indexPath
 * @param {string} queryText
 * @param {number} pageLength
 * @param {function} marklogicFetch
 * @param {string} marklogicBaseUrl
 * @returns {Promise<Array>}
 */
async function fetchLexicalCandidates(indexPath, queryText, pageLength, marklogicFetch, marklogicBaseUrl) {
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

/**
 * 验证向量维度
 * @param {number[]} vector
 * @returns {boolean}
 */
function validateVectorDimension(vector) {
  return Array.isArray(vector) && vector.length === VECTOR_CONFIG.vectorDimension
}

function resolveVectorTypeByIndexPath(indexPath = '') {
  const path = String(indexPath || '')
  if (path.includes('/person/')) return 'person'
  if (path.includes('/book/')) return 'book'
  if (path.includes('/ancient-book/')) return 'ancient_book'
  if (path.includes('/place/')) return 'place'
  if (path.includes('/concept/')) return 'concept'
  if (path.includes('/iiif/')) return 'iiif'
  return 'poem'
}

async function mapWithConcurrency(items = [], limit = 4, iterator = async (item) => item) {
  const output = new Array(items.length)
  const queue = items.map((_, index) => index)
  const workerCount = Math.max(1, Math.min(Number(limit) || 1, queue.length || 1))

  const runWorker = async () => {
    while (queue.length) {
      const index = queue.shift()
      if (index == null) return
      output[index] = await iterator(items[index], index)
    }
  }

  await Promise.all(new Array(workerCount).fill(null).map(() => runWorker()))
  return output
}

function buildVectorResultBase({ result, doc, indexPath, similarity }) {
  const uri = String(result?.uri || '').trim()
  const uriParts = uri.split('/')
  const fileName = uriParts[uriParts.length - 1] || ''
  const entityId = fileName.replace('.json', '')
  const isSet = doc?.scope === 'poem/set'
  const isTxt = doc?.scope === 'poem/text'

  let poemId = null
  if (isSet) {
    const iriMatch = doc?.entity_iri?.match?.(/\/poems\/(\d+)/)
    poemId = iriMatch ? iriMatch[1] : entityId.replace('poem_', '')
  } else if (isTxt) {
    poemId = doc?.evidence?.poem_id
  }

  return {
    uri,
    id: entityId,
    poemId,
    score: Number(result?.score || 0),
    confidence: Number(result?.confidence || 0),
    similarity,
    title: doc?.text_norm || `实体 ${entityId}`,
    snippet: doc?.text_norm || '',
    matchedText: doc?.text_norm || '',
    type: resolveVectorTypeByIndexPath(indexPath),
    source: 'vector',
    indexPath,
    modelId: doc?.model_id,
    _isTxt: isTxt,
    _frontendUrl: String(doc?.evidence?.frontend_url || '').trim(),
  }
}

function vectorResultKey(row) {
  return String(row?.poemId || row?.uri || '').trim()
}

async function fetchDocumentJsonCached(uri, marklogicFetch, marklogicBaseUrl, label = 'vectorDoc') {
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

/**
 * 获取诗词的完整信息（从原始实体文档）
 * @param {string} poemId - 诗词 ID
 * @param {function} marklogicFetch - MarkLogic fetch 函数
 * @param {string} marklogicBaseUrl - MarkLogic 基础 URL
 * @returns {Promise<object|null>} 诗词完整信息
 */
async function getPoemFullInfo(poemId, marklogicFetch, marklogicBaseUrl) {
  const normalizedPoemId = String(poemId || '').trim()
  if (!normalizedPoemId) return null
  const cacheKey = `${marklogicBaseUrl}|${normalizedPoemId}`
  const cached = poemInfoCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }

  try {
    // 尝试多个可能的路径
    const possibleUris = [
      `/processed/json-ld/poem/set/poem_${normalizedPoemId}.json`,
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

/**
 * 获取诗词的所有文本片段（合并为完整内容）
 * @param {string} poemId - 诗词 ID
 * @param {function} marklogicFetch - MarkLogic fetch 函数
 * @param {string} marklogicBaseUrl - MarkLogic 基础 URL
 * @returns {Promise<string>} 完整文本
 */
async function getPoemFullText(poemId, marklogicFetch, marklogicBaseUrl) {
  const normalizedPoemId = String(poemId || '').trim()
  if (!normalizedPoemId) return ''
  const cacheKey = `${marklogicBaseUrl}|${normalizedPoemId}`
  const cached = poemTextCache.get(cacheKey)
  if (cached !== undefined) {
    return String(cached || '')
  }

  try {
    // 搜索该诗词的所有文本片段
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
        // 提取序号用于排序
        const segNo = doc.evidence?.seg_no || 0
        lines.push({ segNo, text: doc.text_norm })
      }
    }

    // 按序号排序并合并
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

/**
 * 执行向量相似度搜索（内部函数）
 *
 * @param {string} indexPath - 向量索引路径
 * @param {number[]} queryVector - 查询向量 (768维)
 * @param {object} options - 搜索选项
 * @param {function} marklogicFetch - MarkLogic fetch 函数
 * @param {string} marklogicBaseUrl - MarkLogic 基础 URL
 * @returns {Promise<Array>} 搜索结果
 */
export async function executeVectorSearch(indexPath, queryVector, options, marklogicFetch, marklogicBaseUrl) {
  const topK = options.topK || VECTOR_CONFIG.defaultTopK
  const candidatePoolSize = resolveCandidatePoolSize(options, topK)
  const lexicalCandidatePoolSize = Number(options.lexicalCandidatePoolSize) || VECTOR_CONFIG.lexicalCandidatePoolSize
  const docFetchConcurrency = Math.max(1, Number(options.docFetchConcurrency) || VECTOR_CONFIG.docFetchConcurrency)
  const enrichTopKFactor = Math.min(4, Math.max(1, Number(options.enrichTopKFactor) || VECTOR_CONFIG.enrichTopKFactor))
  const enrichTopNMax = Math.max(topK, Number(options.enrichTopNMax) || VECTOR_CONFIG.enrichTopNMax)
  const queryText = String(options.queryText || '').trim()

  // 确保目录路径以 '/' 结尾（MarkLogic 要求）
  const normalizedPath = indexPath.endsWith('/') ? indexPath : `${indexPath}/`

  // 步骤1：获取目录下的候选文档
  const requestBody = {
    search: {
      query: {
        queries: [
          {
            'directory-query': {
              uri: [normalizedPath],
            },
          },
        ],
      },
      options: {
        'return-results': true,
        'return-facets': false,
        'page-length': candidatePoolSize,
      },
    },
  }

  const searchResponse = await marklogicFetchWithTimeout(
    marklogicFetch,
    `${marklogicBaseUrl}/v1/search`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestBody),
    },
    `vectorCandidateSearch:${normalizedPath}`,
  )

  if (!searchResponse.ok) {
    const errorText = await searchResponse.text().catch(() => 'Unknown error')
    throw new Error(`向量搜索失败: ${searchResponse.status} - ${errorText}`)
  }

  const searchData = await searchResponse.json()
  const vectorCandidates = Array.isArray(searchData?.results) ? searchData.results : []
  let lexicalCandidates = []
  try {
    lexicalCandidates = await fetchLexicalCandidates(
      normalizedPath,
      queryText,
      lexicalCandidatePoolSize,
      marklogicFetch,
      marklogicBaseUrl,
    )
  } catch (error) {
    console.warn(
      `[VectorSearch] 关键词候选补充失败 path=${normalizedPath}: ${error?.message || String(error)}`,
    )
  }
  const mergedCandidatesMap = new Map()
  for (const row of [...vectorCandidates, ...lexicalCandidates]) {
    const uri = String(row?.uri || '').trim()
    if (!uri || mergedCandidatesMap.has(uri)) continue
    mergedCandidatesMap.set(uri, row)
  }
  const mergedCandidates = Array.from(mergedCandidatesMap.values())
  console.log(
    `[VectorSearch] 获取候选文档 path=${normalizedPath}, vector=${vectorCandidates.length}, lexical=${lexicalCandidates.length}, merged=${mergedCandidates.length}, total=${searchData.total || 0}`,
  )

  // 阶段1：并发读取文档并仅计算相似度，先完成粗排
  const stage1Rows = await mapWithConcurrency(mergedCandidates, docFetchConcurrency, async (result) => {
    try {
      const doc = await fetchDocumentJsonCached(
        result?.uri,
        marklogicFetch,
        marklogicBaseUrl,
        `vectorDoc:${normalizedPath}`,
      )
      if (!doc) return null

      const docEmbedding = doc.embedding
      if (!docEmbedding || !Array.isArray(docEmbedding)) return null

      const similarity = cosineSimilarityUtil(queryVector, docEmbedding)
      if (similarity < VECTOR_CONFIG.similarityThreshold) return null

      return buildVectorResultBase({
        result,
        doc,
        indexPath: normalizedPath,
        similarity,
      })
    } catch (error) {
      console.warn(`[VectorSearch] 获取文档 ${result?.uri || ''} 失败:`, error?.message || String(error))
      return null
    }
  })

  const dedupedStage1 = new Map()
  for (const row of stage1Rows.filter(Boolean)) {
    const key = vectorResultKey(row)
    if (!key) continue
    const existing = dedupedStage1.get(key)
    if (!existing || Number(row.similarity || 0) > Number(existing.similarity || 0)) {
      dedupedStage1.set(key, row)
    }
  }
  const coarseRanked = Array.from(dedupedStage1.values()).sort((a, b) => b.similarity - a.similarity)
  if (coarseRanked.length === 0) return []

  // 阶段2：仅对前置 TopN 候选执行详情/全文补查，避免全量重补查
  const enrichTopN = Math.min(
    coarseRanked.length,
    Math.max(topK, Math.ceil(topK * enrichTopKFactor), 1),
    enrichTopNMax,
  )
  const enrichTargets = coarseRanked.slice(0, enrichTopN)

  const enrichedTargets = await mapWithConcurrency(enrichTargets, Math.min(docFetchConcurrency, 8), async (row) => {
    const next = { ...row }
    const poemId = String(row?.poemId || '').trim()
    if (!poemId) return next

    const fullInfo = await getPoemFullInfo(poemId, marklogicFetch, marklogicBaseUrl)
    if (fullInfo) {
      next.title = fullInfo.title || next.title
      next.author = fullInfo.author
      next.dynasty = fullInfo.dynasty
      next.intro = fullInfo.intro
      if (fullInfo.fullText) {
        next.fullText = fullInfo.fullText
      }
    }

    if (next._isTxt && !next.fullText) {
      next.fullText = await getPoemFullText(poemId, marklogicFetch, marklogicBaseUrl)
    }

    if (next._frontendUrl) {
      next.frontendUrl = next._frontendUrl
    } else {
      next.frontendUrl = `/poems/${poemId}`
    }
    return next
  })

  const enrichedMap = new Map()
  for (const row of enrichedTargets) {
    const key = vectorResultKey(row)
    if (!key) continue
    enrichedMap.set(key, row)
  }

  const mergedRanked = coarseRanked.map((row) => {
    const key = vectorResultKey(row)
    if (!key || !enrichedMap.has(key)) return row
    return enrichedMap.get(key)
  })

  return mergedRanked
    .map((row) => {
      const output = { ...row }
      delete output._isTxt
      delete output._frontendUrl
      return output
    })
    .slice(0, topK)
}

/**
 * 向量搜索服务类
 */
class VectorSearchService {
  constructor() {
    this.config = VECTOR_CONFIG
  }

  /**
   * 获取实体类型对应的向量索引路径
   * @param {string} scope - 实体类型
   * @returns {string[]} 向量索引路径数组
   */
  getIndexPaths(scope) {
    return this.config.indexPaths[scope] || []
  }

  /**
   * 执行向量搜索
   * @param {string} scope - 实体类型
   * @param {number[]} queryVector - 查询向量
   * @param {object} options - 搜索选项
   * @param {function} marklogicFetch - MarkLogic fetch 函数
   * @param {string} marklogicBaseUrl - MarkLogic 基础 URL
   * @returns {Promise<Array>} 搜索结果
   */
  async search(scope, queryVector, options, marklogicFetch, marklogicBaseUrl) {
    // 检查是否启用向量搜索
    if (!this.config.enabled) {
      return []
    }

    // 验证向量维度
    if (!validateVectorDimension(queryVector)) {
      console.warn(
        `[VectorSearch] 向量维度不匹配: 期望 ${this.config.vectorDimension}, 实际 ${queryVector?.length}`,
      )
      return []
    }

    // 获取索引路径
    const indexPaths = this.getIndexPaths(scope)
    console.log(`[VectorSearch] scope=${scope}, indexPaths=${JSON.stringify(indexPaths)}`)
    if (indexPaths.length === 0) {
      console.warn(`[VectorSearch] 未知的实体类型: ${scope}`)
      return []
    }

    // 对每个路径并行搜索，避免单一路径阻塞整个 scope
    const settledResults = await Promise.all(
      indexPaths.map(async (indexPath) => {
        const startedAt = Date.now()
        try {
          const results = await executeVectorSearch(indexPath, queryVector, options, marklogicFetch, marklogicBaseUrl)
          console.log(
            `[VectorSearch] path=${indexPath} status=ok elapsedMs=${Date.now() - startedAt} size=${results.length}`,
          )
          return results
        } catch (error) {
          console.error(
            `[VectorSearch] 查询 ${indexPath} 失败 elapsedMs=${Date.now() - startedAt}:`,
            error.message,
          )
          return []
        }
      }),
    )
    const allResults = settledResults.flat()

    // 按 poemId 去重（保留相似度最高的）
    const uniqueResults = new Map()
    for (const result of allResults) {
      const key = result.poemId || result.uri
      const existing = uniqueResults.get(key)
      if (!existing || result.similarity > existing.similarity) {
        uniqueResults.set(key, result)
      }
    }

    // 按相似度排序并返回
    const topK = options.topK || this.config.defaultTopK
    const sorted = Array.from(uniqueResults.values()).sort((a, b) => b.similarity - a.similarity)

    if (scope === 'poem') {
      return applyPoemLayeredQuota(sorted, topK, this.config)
    }

    return sorted.slice(0, topK)
  }

  /**
   * 检查向量搜索是否可用
   * @returns {boolean}
   */
  isEnabled() {
    return this.config.enabled
  }

  /**
   * 获取配置
   */
  getConfig() {
    return { ...this.config }
  }
}

// ========== 导出 ==========
const vectorSearchService = new VectorSearchService()

export { VectorSearchService }

export const mlVectorSearch = (scope, queryVector, options, marklogicFetch, marklogicBaseUrl) =>
  vectorSearchService.search(scope, queryVector, options, marklogicFetch, marklogicBaseUrl)

export const isVectorSearchEnabled = () => vectorSearchService.isEnabled()

export const getVectorSearchConfig = () => vectorSearchService.getConfig()

export default vectorSearchService

