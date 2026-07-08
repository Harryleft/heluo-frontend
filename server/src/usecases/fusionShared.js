/**
 * Fusion 共用核心
 *
 * 收敛 query / stream 两条链路共用的检索与证据构建逻辑，
 * 避免同一套规则在多个 usecase 中重复维护。
 *
 * @module server/src/usecases/fusionShared
 */

import { mergeRowsByUri } from '../domain/retrieval/index.js'
import {
  buildFusionQueryPlan,
  applyFusionDimsPolicy,
  rerankFusionCandidates,
  buildFusionPoemContext,
  createFusionDetailLink,
  createFusionIiifOpenUrl,
  buildFusionSidebarItems,
} from '../domain/fusion/index.js'
import { marklogicConfig, urlRewriteConfig } from '../bootstrap/config.js'
import {
  extractIdFromUri,
  extractMarkText,
  extractDocText,
  pickRowTitle,
  normalizeText,
} from '../utils/textUtils.js'

const LOCAL_PUBLIC_BASE_URL = String(urlRewriteConfig.localBaseUrl || 'http://127.0.0.1:9011').replace(/\/+$/, '')
const MARKLOGIC_BASE_URL = String(marklogicConfig.baseUrl || 'http://localhost:8003').replace(/\/+$/, '')

function normalizeIiifUrl(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.startsWith('/iiif/')) return text
  try {
    const parsed = new URL(text)
    if (parsed.pathname.startsWith('/iiif/')) {
      return `${parsed.pathname}${parsed.search || ''}`
    }
  } catch {
    return ''
  }
  return ''
}

function rewriteLegacyIiifUrl(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  const normalized = text
    .replace(
      /^https?:\/\/localhost:8083\/iiif\/manifests\/ancientBook\/([^/]+)\/([^/]+)\/manifest\.json$/i,
      '/iiif/manifests/$1/manifest.json',
    )
    .replace(
      /^https?:\/\/localhost:8083\/iiif\/manifests\/([^/]+)\/manifest\.json$/i,
      '/iiif/manifests/$1/manifest.json',
    )
    .replace(
      /^https?:\/\/localhost:8083\/iiif\/manifests\/([^/]+)\/collection\.json$/i,
      '/iiif/manifests/$1/collection.json',
    )
  return normalizeIiifUrl(normalized) || normalized
}

function buildPublicIiifUrl(pathOrUrl) {
  const normalized = rewriteLegacyIiifUrl(pathOrUrl)
  if (!normalized) return ''
  if (/^https?:\/\//i.test(normalized)) return normalized
  if (!normalized.startsWith('/iiif/')) return ''
  return `${LOCAL_PUBLIC_BASE_URL}${normalized}`
}

function extractBookIdFromCarrierId(carrierId) {
  const match = String(carrierId || '').trim().match(/_(\d+)$/)
  return match?.[1] || ''
}

function deriveIiifManifestPath(row) {
  const doc = row?._doc && typeof row._doc === 'object' ? row._doc : {}
  const evidence = doc?.evidence && typeof doc.evidence === 'object' ? doc.evidence : {}
  const candidates = [
    evidence?.uri,
    evidence?.manifest,
    doc?.entity_iri,
    doc?.id,
  ]

  for (const candidate of candidates) {
    const text = String(candidate || '').trim()
    if (!text) continue

    const rewritten = rewriteLegacyIiifUrl(text)
    if (/^\/iiif\/manifests\/\d+\/manifest\.json$/i.test(rewritten)) {
      return rewritten
    }

    const longMatch = text.match(/\/iiif\/manifests\/ancientBook\/([^/]+)\/([^/]+)\/manifest\.json$/i)
    if (longMatch) {
      return `/iiif/manifests/${longMatch[1]}/manifest.json`
    }

    const processedMatch = text.match(/\/processed\/entities\/ancient_book\/iiif\/manifests\/ancientBook\/([^/]+)\/([^/]+)\/manifest\.json$/i)
    if (processedMatch) {
      return `/iiif/manifests/${processedMatch[1]}/manifest.json`
    }
  }

  const manifestId = String(doc?.evidence?.manifest_id || '').trim()
  const manifestBookId = extractBookIdFromCarrierId(manifestId)
  if (manifestBookId) {
    return `/iiif/manifests/${manifestBookId}/manifest.json`
  }

  const uriMatch = String(row?.uri || '').trim().match(/\/processed\/vector\/iiif\/manifest\/(\d+)_(\d+)_\d+_\d+\.json$/i)
  if (uriMatch) {
    return `/iiif/manifests/${uriMatch[2]}/manifest.json`
  }

  return ''
}

function deriveIiifManifestDocUri(row) {
  const doc = row?._doc && typeof row._doc === 'object' ? row._doc : {}
  const evidence = doc?.evidence && typeof doc.evidence === 'object' ? doc.evidence : {}
  const candidates = [
    evidence?.uri,
    doc?.entity_iri,
  ]

  for (const candidate of candidates) {
    const text = String(candidate || '').trim()
    if (!text) continue

    const longMatch = text.match(/\/iiif\/manifests\/ancientBook\/([^/]+)\/([^/]+)\/manifest\.json$/i)
    if (longMatch) {
      return `/processed/iiif/manifests/${longMatch[1]}/manifest.json`
    }

    const shortMatch = text.match(/\/iiif\/manifests\/([^/]+)\/manifest\.json$/i)
    if (shortMatch) {
      return `/processed/iiif/manifests/${shortMatch[1]}/manifest.json`
    }
  }

  const uriMatch = String(row?.uri || '').trim().match(/\/processed\/vector\/iiif\/manifest\/(\d+)_(\d+)_\d+_\d+\.json$/i)
  if (!uriMatch) return ''
  return `/processed/iiif/manifests/${uriMatch[2]}/manifest.json`
}

function deriveIiifCanvasId(row) {
  const doc = row?._doc && typeof row._doc === 'object' ? row._doc : {}
  const evidence = doc?.evidence && typeof doc.evidence === 'object' ? doc.evidence : {}
  const rawCanvasId = String(evidence?.canvas_id || doc?.canvas_id || '').trim()
  if (rawCanvasId) return rawCanvasId

  const rawText = String(row?._rawUri || row?.uri || '').trim()
  const uriMatch = rawText.match(/\/processed\/vector\/iiif\/manifest\/(\d+)_(\d+)_(\d+)_\d+\.json$/i)
  if (!uriMatch) return ''
  const carrierId = `${uriMatch[1]}_${uriMatch[2]}`
  return `http://localhost:8083/iiif/3/canvas/ancientBook/${uriMatch[2]}/${carrierId}/p${uriMatch[3]}`
}

function normalizeCanvasId(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  try {
    const parsed = new URL(text)
    return parsed.pathname
  } catch {
    return text
  }
}

function pickIiifText(row) {
  const doc = row?._doc && typeof row._doc === 'object' ? row._doc : {}
  const candidates = [
    doc?.text_norm_zh,
    doc?.text_norm,
    doc?.text,
    doc?.content,
    doc?.description,
    row?.snippet,
    row?.description,
    row?.title,
  ]
  for (const candidate of candidates) {
    const text = String(candidate || '').trim()
    if (text) return text
  }
  return ''
}

function pickIiifCanvasLabel(manifest, canvasId) {
  const normalizedCanvasId = normalizeCanvasId(canvasId)
  if (!normalizedCanvasId) return ''
  const canvases = Array.isArray(manifest?.items) ? manifest.items : []
  const matchedCanvas = canvases.find((item) => normalizeCanvasId(item?.id) === normalizedCanvasId)
  if (!matchedCanvas) return ''
  const label = matchedCanvas?.label
  if (Array.isArray(label?.none) && label.none[0]) return String(label.none[0]).trim()
  if (typeof label === 'string') return label.trim()
  return ''
}

function pickIiifManifestLabel(manifest) {
  return normalizeText(
    manifest?._label
    || manifest?.name
    || manifest?.title
    || manifest?.label?.none?.[0]
    || manifest?.label?.zh?.[0],
  )
}

function extractIiifVolumeLabel(canvasLabel) {
  const text = normalizeText(canvasLabel)
  if (!text) return ''
  const matched = text.match(/卷[^)\s\-、，。,；;]*/)
  return normalizeText(matched?.[0] || '')
}

function isUriLikeTitle(value) {
  const text = normalizeText(value)
  if (!text) return false
  return text.startsWith('/') || /^https?:\/\//i.test(text)
}

function isChunkLikeTitle(value) {
  const text = normalizeText(value)
  if (!text) return false
  return /(?:^|[_-])(chunk|seg|part)(?:[_-]?\d+)?$/i.test(text)
}

function isIiifIdLikeTitle(value) {
  const text = normalizeText(value)
  if (!text) return false
  return /^\d+(?:_\d+){2,}$/.test(text)
}

function isUnusableIiifTitle(value) {
  const text = normalizeText(value)
  if (!text) return true
  if (text === '未命名条目' || text === 'IIIF 注释文本') return true
  return isUriLikeTitle(text) || isChunkLikeTitle(text) || isIiifIdLikeTitle(text)
}

async function fetchJsonDocument(url, marklogicFetch) {
  if (!url) return null
  const fetcher = typeof marklogicFetch === 'function' ? marklogicFetch : globalThis.fetch
  if (typeof fetcher !== 'function') return null
  try {
    const response = await fetcher(url)
    if (!response?.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

async function fetchMarklogicDocument(uri, marklogicFetch, marklogicBaseUrl) {
  const normalizedUri = String(uri || '').trim()
  if (!normalizedUri || typeof marklogicFetch !== 'function') return null
  const params = new URLSearchParams({ uri: normalizedUri, format: 'json' })
  const url = `${String(marklogicBaseUrl || MARKLOGIC_BASE_URL).replace(/\/+$/, '')}/v1/documents?${params.toString()}`
  return fetchJsonDocument(url, marklogicFetch)
}

async function fetchIiifManifestDocument(row, options = {}) {
  const { marklogicFetch, marklogicBaseUrl, mlGetDoc } = options
  const manifestDocUri = deriveIiifManifestDocUri(row)
  if (manifestDocUri) {
    const manifestDoc = typeof mlGetDoc === 'function'
      ? await mlGetDoc(manifestDocUri, { allowWhenJsonLdOnly: true })
      : await fetchMarklogicDocument(manifestDocUri, marklogicFetch, marklogicBaseUrl)
    if (manifestDoc) return manifestDoc
  }
  const manifest = deriveIiifManifestPath(row)
  if (!manifest) return null
  return fetchJsonDocument(buildPublicIiifUrl(manifest), marklogicFetch)
}

async function resolveIiifDisplayTitle(row, doc, options = {}) {
  const preferredTitle = normalizeText(pickRowTitle(row, doc || {}))
  if (!isUnusableIiifTitle(preferredTitle)) return preferredTitle

  const manifestDocument = await fetchIiifManifestDocument(row, options)
  const manifestLabel = pickIiifManifestLabel(manifestDocument)
  const canvasLabel = pickIiifCanvasLabel(manifestDocument, deriveIiifCanvasId(row))
  const volumeLabel = extractIiifVolumeLabel(canvasLabel)

  if (manifestLabel && volumeLabel) return `${manifestLabel}·${volumeLabel}`
  if (manifestLabel) return manifestLabel
  if (volumeLabel) return volumeLabel
  return preferredTitle || 'IIIF 注释文本'
}

/**
 * 解析主实体 URI
 *
 * @param {string} scope - 实体类型
 * @param {string} rawUri - 原始 URI
 * @param {object} doc - 文档对象
 * @returns {string} 主 URI
 */
export function resolvePrimaryEntityUri(scope, rawUri, doc) {
  const uri = String(rawUri || '').trim()
  if (!uri) return ''

  // 古籍：向量 URI → 从文档元数据提取主实体 URI
  if (scope === 'ancient_book' && uri.includes('/processed/vector/')) {
    const candidateUris = [
      doc?.id,
      doc?.entity_iri,
    ]
    for (const candidate of candidateUris) {
      const text = String(candidate || '').trim()
      if (!text || text.includes('/processed/vector/')) continue
      // 支持 http:// 开头的 URL，提取 pathname
      let path = text
      try {
        if (text.startsWith('http://') || text.startsWith('https://')) {
          path = new URL(text).pathname
        }
      } catch { continue }
      const legacyIiifMatch = path.match(/^\/iiif\/manifests\/ancientBook\/([^/]+)\/([^/]+)\/manifest\.json$/i)
      if (legacyIiifMatch) return `/iiif/manifests/${legacyIiifMatch[1]}/manifest.json`
      const canonicalIiifMatch = path.match(/^\/iiif\/manifests\/([^/]+)\/manifest\.json$/i)
      if (canonicalIiifMatch) return `/iiif/manifests/${canonicalIiifMatch[1]}/manifest.json`
      if (path.startsWith('/') && path.length > 1) return path
    }
  }

  if (scope === 'poem' && uri.includes('/poem/text/')) {
    const memberId = doc?.member_of?.id || doc?.member_of?.[0]?.id
    if (memberId) {
      const stem = String(memberId).split('/').pop()?.replace(/\.json$/i, '') || ''
      if (stem) return `/processed/json-ld/poem/set/${stem}.json`
    }
  }
  return uri
}

/**
 * 构建图谱 IRI 候选列表
 *
 * @param {object} params - 参数
 * @returns {string[]} IRI 候选列表
 */
export function buildGraphIriCandidates({ uri, id, type, doc }) {
  const candidates = [uri]
  if (id && id !== extractIdFromUri(uri)) {
    candidates.push(`/${type}/${id}`)
  }
  const docId = doc?.id
  if (docId && typeof docId === 'string' && !candidates.includes(docId)) {
    candidates.push(docId)
  }
  return [...new Set(candidates.filter(Boolean))]
}

/**
 * 解析融合查询的 IIIF 匹配
 *
 * @param {Array} ranked - 排序后的候选列表
 * @param {boolean} includeIiif - 是否包含 IIIF
 * @param {object} options - 额外选项
 * @returns {Promise<Array>} IIIF 匹配列表
 */
export async function resolveFusionIiifMatches(ranked, includeIiif, options = {}) {
  if (!includeIiif || !ranked.length) return []
  const { marklogicFetch, marklogicBaseUrl, mlGetDoc } = options
  const manifestCache = new Map()
  const iiifRows = ranked
    .filter((row) => row?.uri?.includes('/iiif/') || row?._scope === 'iiif')
    .slice(0, 6)

  const matches = []
  for (const row of iiifRows) {
    const manifest = deriveIiifManifestPath(row)
    const segmentText = pickIiifText(row)
    if (!manifest || !segmentText) continue

    const canvasId = deriveIiifCanvasId(row)
    let canvasLabel = ''
    if (canvasId) {
      if (!manifestCache.has(manifest)) {
        manifestCache.set(manifest, (async () => {
          const manifestDoc = await fetchIiifManifestDocument(row, { marklogicFetch, marklogicBaseUrl, mlGetDoc })
          if (manifestDoc) return manifestDoc
          return fetchJsonDocument(buildPublicIiifUrl(manifest), marklogicFetch)
        })())
      }
      const manifestDocument = await manifestCache.get(manifest)
      canvasLabel = pickIiifCanvasLabel(manifestDocument, canvasId)
      if (!canvasLabel) continue
    }

    matches.push({
      uri: row?.uri || '',
      title: await resolveIiifDisplayTitle(
        row,
        row?._doc && typeof row._doc === 'object' ? row._doc : {},
        { marklogicFetch, marklogicBaseUrl, mlGetDoc },
      ),
      segmentText,
      canvasId,
      canvasLabel,
      manifest,
      openUrl: createFusionIiifOpenUrl(manifest, canvasId),
    })
  }

  return matches
}

/**
 * 多查询结果按 RRF 融合（同一作用域内）
 *
 * @param {Array<{queryText:string,queryIndex:number,rows:Array}>} variantResults - 变体检索结果
 * @param {number} pageLength - 返回条数
 * @returns {Array} 融合后的候选
 */
export function mergeVariantRowsByRrf(variantResults = [], pageLength = 20) {
  const rrfK = 60
  const merged = new Map()

  const scoreRow = (row) => Number(row?.score || 0) + Number(row?.confidence || 0)

  for (const variant of variantResults) {
    const sortedRows = (variant?.rows || [])
      .slice()
      .sort((a, b) => scoreRow(b) - scoreRow(a))

    sortedRows.forEach((row, index) => {
      const uri = String(row?.uri || '').trim()
      if (!uri) return
      const rank = index + 1
      const rrfScore = 1 / (rrfK + rank)
      const existed = merged.get(uri)
      if (!existed) {
        merged.set(uri, {
          ...row,
          _queryText: variant?.queryText,
          _queryIndex: Number(variant?.queryIndex || 0),
          _rrfScore: rrfScore,
          _merge_score: scoreRow(row),
        })
        return
      }
      existed._rrfScore = Number(existed._rrfScore || 0) + rrfScore
      const currentMergeScore = Number(existed._merge_score || 0)
      const candidateMergeScore = scoreRow(row)
      if (candidateMergeScore > currentMergeScore) {
        Object.assign(existed, row, {
          _queryText: variant?.queryText,
          _queryIndex: Number(variant?.queryIndex || 0),
          _merge_score: candidateMergeScore,
        })
      }
    })
  }

  return Array.from(merged.values())
    .sort((a, b) => {
      const rrfGap = Number(b?._rrfScore || 0) - Number(a?._rrfScore || 0)
      if (Math.abs(rrfGap) > 1e-12) return rrfGap
      const mergeGap = Number(b?._merge_score || 0) - Number(a?._merge_score || 0)
      if (Math.abs(mergeGap) > 1e-12) return mergeGap
      return Number(b?.vectorScore || b?.similarity || 0) - Number(a?.vectorScore || a?.similarity || 0)
    })
    .slice(0, pageLength)
}

/**
 * 构建模板答案
 *
 * @param {string} query - 查询文本
 * @param {Array} entities - 实体列表
 * @param {string[]} dims - 查询维度
 * @returns {string} 模板答案
 */
export function buildTemplateAnswer(query, entities, dims) {
  if (!entities.length) {
    return '未找到与您的问题直接相关的资料，请尝试更具体的描述。'
  }

  const topEntities = entities.slice(0, 3)
  const entitySummaries = topEntities.map((item) => {
    const typeLabel = getTypeLabel(item.type)
    return `${typeLabel}「${item.title}」`
  })

  const hasPoem = dims.includes('poem') && entities.some((item) => item.type === 'poem')
  const hasPerson = dims.includes('person') || entities.some((item) => item.type === 'person')

  let answer = `根据检索结果，关于"${query}"，我们找到了以下相关内容：\n\n`
  answer += entitySummaries.join('、') + '等资料。\n\n'

  if (hasPoem) {
    answer += '在诗文方面，检索到了相关的诗歌作品，您可以点击查看详情了解更多。'
  }
  if (hasPerson) {
    answer += '在人物方面，检索到了相关的历史人物资料。'
  }

  return answer
}

/**
 * 获取类型标签
 *
 * @param {string} type - 实体类型
 * @returns {string} 类型标签
 */
export function getTypeLabel(type) {
  const labels = {
    person: '人物',
    poem: '诗文',
    book: '图书',
    ancient_book: '古籍',
    place: '地点',
    concept: '概念',
  }
  return labels[type] || '条目'
}

/**
 * 构建同名诗作比较题的正文优先主证据池
 *
 * @param {Array} rankedRows - 重排后的候选列表
 * @param {object|null} compareSpec - 比较规格
 * @returns {Array} 比较主证据列表
 */
function buildComparePoemEvidence(rankedRows = [], compareSpec = null) {
  if (compareSpec?.intent !== 'poem_compare_by_title') return []

  const targetTitle = normalizeText(compareSpec?.title)
  if (!targetTitle) return []

  const output = []
  const seenUris = new Set()

  for (const row of rankedRows) {
    const scope = normalizeText(row?._scope || row?.type).toLowerCase()
    const title = normalizeText(row?.title)
    const uri = String(row?.uri || '').trim()
    if (scope !== 'poem' || title !== targetTitle || !uri || seenUris.has(uri)) continue

    const poemContext = buildFusionPoemContext(row)
    if (!poemContext?.poemText) continue

    seenUris.add(uri)
    output.push({
      title: row?.title || targetTitle,
      uri,
      poemText: poemContext.poemText,
      poemAuthor: poemContext.poemAuthor || '',
      poemDynasty: poemContext.poemDynasty || '',
      poemIntro: poemContext.poemIntro || '',
      score: Number((row?._scoreDetail?.finalScore || row?.score || 0).toFixed(4)),
    })

    if (output.length >= 4) break
  }

  return output.length >= 2 ? output : []
}

/**
 * 构建单个 scope 的检索结果
 *
 * @param {object} params - 参数
 * @returns {Promise<object>} scope 结果
 */
async function buildScopeResult({
  scope,
  queryPlan,
  perScopeCandidateSize,
  searchMode,
  marklogicFetch,
  marklogicBaseUrl,
  searchScopeData,
  settleVariants,
}) {
  if (!settleVariants) {
    const variantResults = await Promise.all(
      queryPlan.ragQueries.map(async (queryText, queryIndex) => {
        const result = await searchScopeData(queryText, scope, perScopeCandidateSize, {
          searchMode,
          marklogicFetch,
          marklogicBaseUrl,
        })
        return {
          queryText,
          queryIndex,
          rows: result.rows || [],
        }
      }),
    )

    const rows = mergeVariantRowsByRrf(variantResults, perScopeCandidateSize)
      .map((row) => ({ ...row, _scope: scope }))
    const primaryHitCount = Number(variantResults[0]?.rows?.length || 0)
    const fallbackUsed = primaryHitCount === 0 && rows.length > 0
    return {
      scope,
      rows,
      fallbackUsed,
      failedCount: 0,
      timeoutCount: 0,
      degradedCount: 0,
      successCount: variantResults.length,
    }
  }

  const variantSettledResults = await Promise.allSettled(
    queryPlan.ragQueries.map(async (queryText, queryIndex) => {
      const result = await searchScopeData(queryText, scope, perScopeCandidateSize, {
        searchMode,
        marklogicFetch,
        marklogicBaseUrl,
      })
      return {
        queryText,
        queryIndex,
        rows: result.rows || [],
        degraded: Boolean(result?.degraded),
        fallbackReason: String(result?.fallbackReason || result?.reason || ''),
      }
    }),
  )

  const variantResults = []
  let failedCount = 0
  let timeoutCount = 0
  let degradedCount = 0

  for (const settledItem of variantSettledResults) {
    if (settledItem.status === 'fulfilled') {
      variantResults.push(settledItem.value)
      if (settledItem.value?.degraded) degradedCount += 1
      continue
    }
    failedCount += 1
    const reasonText = String(settledItem.reason?.message || settledItem.reason || '')
    if (settledItem.reason?.code === 'TIMEOUT' || /timeout|timed out/i.test(reasonText)) {
      timeoutCount += 1
    }
  }

  const rows = mergeVariantRowsByRrf(variantResults, perScopeCandidateSize)
    .map((row) => ({ ...row, _scope: scope }))
  const primaryVariant = variantResults.find((item) => item.queryIndex === 0) || variantResults[0]
  const primaryHitCount = Number(primaryVariant?.rows?.length || 0)
  const fallbackUsed = primaryHitCount === 0 && rows.length > 0

  return {
    scope,
    rows,
    fallbackUsed,
    failedCount,
    timeoutCount,
    degradedCount,
    successCount: variantResults.length,
  }
}

/**
 * 构建 Fusion 检索与证据结果
 *
 * @param {object} params - 参数
 * @returns {Promise<object>} 共用证据结果
 */
export async function prepareFusionEvidence(params) {
  const {
    query,
    mode,
    requestedDims,
    topK,
    includeIiif,
    searchMode,
    marklogicFetch,
    marklogicBaseUrl,
    searchScopeData,
    mlGetDoc,
    settleVariants = false,
  } = params

  const dims = applyFusionDimsPolicy(query, requestedDims)
  const queryPlan = buildFusionQueryPlan(query, mode, dims)
  const perScopeCandidateSize = Math.min(120, Math.max(topK * 2, 12))
  const rankWindowSize = Math.min(200, Math.max(topK * 4, 40))

  const scopeResults = await Promise.all(
    dims.map((scope) => buildScopeResult({
      scope,
      queryPlan,
      perScopeCandidateSize,
      searchMode,
      marklogicFetch,
      marklogicBaseUrl,
      searchScopeData,
      settleVariants,
    })),
  )

  queryPlan.fallbackUsed = scopeResults.some((item) => item.fallbackUsed)

  const pool = []
  for (const { scope, rows } of scopeResults) {
    for (const row of rows) {
      pool.push({ ...row, _scope: scope })
    }
  }

  const merged = mergeRowsByUri(pool).slice(0, rankWindowSize)
  const rankingCandidates = await Promise.all(
    merged.map(async (row) => {
      const rawUri = String(row?.uri || '').trim()
      let doc = rawUri ? await mlGetDoc(rawUri) : null
      if (!doc && rawUri.startsWith('/processed/vector/')) {
        doc = await mlGetDoc(rawUri, { allowWhenJsonLdOnly: true })
      }
      const uri = resolvePrimaryEntityUri(row?._scope || '', rawUri, doc || {})
      const graphUriCandidates = buildGraphIriCandidates({
        uri,
        id: extractIdFromUri(uri),
        type: row?._scope || '',
        doc: doc || {},
      })
      const title = row?._scope === 'iiif'
        ? await resolveIiifDisplayTitle(row, doc, { marklogicFetch, marklogicBaseUrl, mlGetDoc })
        : pickRowTitle(row, doc || {})
      const snippetSource = String(row?.fullText || extractDocText(doc || row) || '')
      const snippet = extractMarkText(snippetSource, 180) || '暂无摘要'
      return {
        ...row,
        id: extractIdFromUri(uri),
        uri,
        _rawUri: rawUri,
        title,
        snippet,
        _graphUriCandidates: graphUriCandidates,
        _graphUri: graphUriCandidates[0] || uri,
        _doc: doc || null,
      }
    }),
  )

  const rankingQuery = queryPlan.ragQueries[0] || query
  const ranked = rerankFusionCandidates(rankingCandidates, rankingQuery, query, topK, queryPlan)
  const compareRankedPool = queryPlan.compareSpec
    ? rerankFusionCandidates(rankingCandidates, rankingQuery, query, Math.max(topK * 2, 24), queryPlan)
    : []
  const comparePoemEvidence = buildComparePoemEvidence(compareRankedPool, queryPlan.compareSpec)

  const entities = ranked.map((row) => ({
    ...buildFusionPoemContext(row),
    id: row?.id || extractIdFromUri(row?.uri),
    type: row?._scope || 'entity',
    title: row?.title || '未命名条目',
    uri: row?.uri || '',
    graphUri: row?._graphUri || row?.uri || '',
    graphUriCandidates: row?._graphUriCandidates || [],
    score: Number((row?._scoreDetail?.finalScore || 0).toFixed(4)),
    snippet: row?.snippet || '暂无摘要',
    detailLink: createFusionDetailLink(row?.uri || '', query),
  }))

  const citations = ranked.map((row, index) => ({
    ...buildFusionPoemContext(row),
    citationId: `citation-${index + 1}`,
    sourceType: row?._scope || 'entity',
    uri: row?.uri || '',
    title: row?.title || '未命名条目',
    snippet: row?.snippet || '暂无摘要',
    scoreDetail: row?._scoreDetail || null,
    anchors: {
      chunkId: row?.id || extractIdFromUri(row?.uri),
    },
  }))

  const iiifMatches = await resolveFusionIiifMatches(ranked, includeIiif, { marklogicFetch, marklogicBaseUrl, mlGetDoc })

  // 用已验证的 iiifMatches 回填 entities 的 detailLink
  // resolveFusionIiifMatches 已过滤掉 manifest 不存在的条目，因此仅有效的 IIIF 链接会被回填
  const iiifOpenUrlByEntityUri = new Map()
  for (const match of iiifMatches) {
    if (match.uri) iiifOpenUrlByEntityUri.set(match.uri, match.openUrl)
  }
  for (let i = 0; i < entities.length; i++) {
    const iiifUrl = iiifOpenUrlByEntityUri.get(entities[i].uri)
    if (iiifUrl) {
      entities[i] = { ...entities[i], detailLink: iiifUrl }
    }
  }

  const sidebarItems = buildFusionSidebarItems(citations, iiifMatches)

  return {
    dims,
    queryPlan,
    scopeResults,
    ranked,
    entities,
    citations,
    iiifMatches,
    sidebarItems,
    comparePoemEvidence,
  }
}

export default {
  resolvePrimaryEntityUri,
  buildGraphIriCandidates,
  resolveFusionIiifMatches,
  mergeVariantRowsByRrf,
  buildTemplateAnswer,
  getTypeLabel,
  prepareFusionEvidence,
}
