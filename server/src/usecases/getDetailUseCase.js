/**
 * 详情获取用例
 *
 * 编排详情获取：根据实体类型选择提取器 → 获取数据 → 格式化输出
 * 支持人物/诗文/书籍/地点/概念/古籍等类型
 *
 * @module server/src/usecases/getDetailUseCase
 */

import { detailConfig, cacheConfig, getEntityDirectories } from '../bootstrap/config.js'
import {
  extractPersonDetail,
  extractPoemDetail,
  buildPoemDetailForLegacy,
  extractBookDetail,
  extractPlaceDetail,
  extractConceptDetail,
  extractAncientBookDetail,
  isPoemSetUri,
  isPoemTextUri,
  isAncientBookEntryUri,
  extractVolumeHeadsFromIiifManifest,
} from '../domain/detail/index.js'
import {
  extractIdFromUri,
  normalizeText,
  extractMarkText,
  extractDocText,
  pickRowTitle,
} from '../utils/textUtils.js'

// ============================================================================
// URI 类型判断
// ============================================================================

/**
 * 判断是否为向量或片段 URI
 *
 * @param {string} uri - URI
 * @returns {boolean}
 */
function isLikelyVectorOrFragmentUri(uri) {
  const value = String(uri || '').toLowerCase()
  if (!value) return false
  return value.includes('/heluo/vector/') || value.includes('/processed/vector/')
}

function isDataJsonLdUri(uri) {
  return String(uri || '').toLowerCase().startsWith('/processed/json-ld/')
}

/**
 * 判断是否为人物主 URI
 *
 * @param {string} uri - URI
 * @returns {boolean}
 */
function isPersonPrimaryUri(uri) {
  const value = String(uri || '').toLowerCase()
  if (!value || isLikelyVectorOrFragmentUri(value)) return false
  return (
    value.includes('/heluo/persons/') ||
    value.includes('/person/') ||
    value.includes('/persons/')
  )
}

/**
 * 判断是否为书籍主 URI
 *
 * @param {string} uri - URI
 * @returns {boolean}
 */
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

/**
 * 判断是否为地点主 URI
 *
 * @param {string} uri - URI
 * @returns {boolean}
 */
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

/**
 * 判断是否为概念主 URI
 *
 * @param {string} uri - URI
 * @returns {boolean}
 */
function isConceptPrimaryUri(uri) {
  const value = String(uri || '').toLowerCase()
  if (!value || isLikelyVectorOrFragmentUri(value)) return false
  return (
    value.includes('/processed/json-ld/concept/') ||
    value.includes('/heluo/concepts/') ||
    value.includes('/concept/')
  )
}

/**
 * 判断是否为古籍主 URI
 *
 * @param {string} uri - URI
 * @returns {boolean}
 */
function isAncientBookPrimaryUri(uri) {
  const value = String(uri || '').toLowerCase()
  if (!value || isLikelyVectorOrFragmentUri(value)) return false
  return (
    value.includes('/processed/json-ld/ancient-book/') ||
    value.includes('/heluo/ancient-books/')
  )
}

/**
 * 判断是否为诗文主 URI
 *
 * @param {string} uri - URI
 * @returns {boolean}
 */
function isPoemPrimaryUri(uri) {
  const value = String(uri || '').toLowerCase()
  if (!value || isLikelyVectorOrFragmentUri(value)) return false
  return (
    value.includes('/processed/json-ld/poem/') ||
    value.includes('/heluo/poems') ||
    value.includes('/poem/')
  )
}

/**
 * 从向量 URI 路径中提取实体类型
 *
 * 向量 URI 格式示例：/processed/vector/ancient-book/xxx.json
 * 当 isLikelyVectorOrFragmentUri 为 true 时，用路径中的关键词推断类型。
 *
 * @param {string} uri - URI
 * @returns {string|null} 实体类型或 null
 */
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

/**
 * 根据 URI 推断实体类型
 *
 * @param {string} uri - URI
 * @returns {string} 实体类型
 */
function inferEntityType(uri) {
  // 向量 URI：从路径中提取实体类型
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

// ============================================================================
// URI 提取工具（业务特定）
// ============================================================================

/**
 * 从文档中提取候选 URI
 *
 * @param {object} raw - 文档对象
 * @param {number} limit - 最大数量
 * @returns {string[]} URI 列表
 */
function extractCandidateUris(raw, limit = 40) {
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

// ============================================================================
// 简单内存缓存
// ============================================================================

/**
 * 创建简单缓存
 *
 * @param {number} ttlMs - 缓存过期时间（毫秒）
 * @returns {object} 缓存对象
 */
function createSimpleCache(
  ttlMs = cacheConfig.detailCacheTtlMs,
  maxSize = Number(process.env.DETAIL_CACHE_MAX_SIZE) || 1000,
) {
  const cache = new Map()
  const safeMaxSize = Math.max(100, Number(maxSize) || 1000)

  return {
    get(key) {
      const cached = cache.get(key)
      if (cached && cached.expireAt > Date.now()) {
        // 命中后刷新 LRU 顺序
        cache.delete(key)
        cache.set(key, cached)
        return cached.payload
      }
      cache.delete(key)
      return null
    },
    set(key, payload) {
      if (cache.has(key)) {
        cache.delete(key)
      }
      // 简单 LRU 淘汰：删除最早写入的条目
      while (cache.size >= safeMaxSize) {
        const oldestKey = cache.keys().next().value
        if (!oldestKey) break
        cache.delete(oldestKey)
      }
      cache.set(key, {
        payload,
        expireAt: Date.now() + ttlMs,
      })
    },
    clear() {
      cache.clear()
    },
    size() {
      return cache.size
    },
  }
}

// ============================================================================
// 用例类
// ============================================================================

/**
 * 创建详情获取用例
 *
 * @param {object} dependencies - 依赖注入
 * @param {object} dependencies.gateways - 网关依赖
 * @param {object} dependencies.retrievers - 检索器依赖（可选，用于向量推荐）
 * @returns {object} 用例方法
 */
export function createGetDetailUseCase(dependencies) {
  const { gateways, retrievers } = dependencies
  const { mlGetDoc, mlGetJson, mlSearchByDirectory, mlSearchByCollection } = gateways

  // 详情缓存
  const detailCache = createSimpleCache(detailConfig.cacheTtlMs)

  // 创建搜索回退函数
  const searchWithFallback = createSearchWithFallback(gateways)
  const poemDetailDependencies = { mlGetDoc, searchWithFallback }
  const ancientBookGateways = {
    ...gateways,
    mlGetDoc: (uri) => mlGetDoc(uri, { allowWhenJsonLdOnly: true }),
    mlSearchByDirectory: (directory, query, pageLength) => mlSearchByDirectory(
      directory,
      query,
      pageLength,
      { allowWhenJsonLdOnly: true },
    ),
    mlSearchByCollection: (collection, query, pageLength) => mlSearchByCollection(
      collection,
      query,
      pageLength,
      { allowWhenJsonLdOnly: true },
    ),
  }

  /**
   * 获取实体详情
   *
   * @param {object} params - 查询参数
   * @param {string} params.uri - 文档 URI
   * @param {string} params.query - 关联查询（可选，用于推荐）
   * @param {boolean} params.useCache - 是否使用缓存
   * @returns {Promise<object>} 详情结果
   */
  /**
   * 将向量 URI 解析为对应的主实体 URI
   *
   * 向量文档通常包含 id 或 entity_iri 字段指向原始实体文档，
   * 从中提取主实体 URI 后可使用正确的提取器获取完整详情。
   *
   * @param {string} vectorUri - 向量 URI
   * @param {string} suggestedType - 从路径推断的实体类型
   * @returns {Promise<string|null>} 主实体 URI 或 null
   */
  async function resolveVectorToEntityUri(vectorUri, suggestedType) {
    const getDoc = suggestedType === 'ancient_book'
      ? ancientBookGateways.mlGetDoc
      : (docUri) => mlGetDoc(docUri, { allowWhenJsonLdOnly: true })

    const doc = await getDoc(vectorUri)
    if (!doc) return null

    // 从文档中提取候选主 URI（与 searchUnifiedUseCase / fusionShared 对齐）
    const candidates = [
      String(doc.entity_iri || '').trim(),
      String(doc.id || '').trim(),
      String(doc.evidence?.uri || '').trim(),
    ]

    for (const candidate of candidates) {
      if (!candidate || !candidate.startsWith('/') || isLikelyVectorOrFragmentUri(candidate)) continue
      // 验证候选 URI 的文档存在
      const candidateDoc = await getDoc(candidate)
      if (candidateDoc) return candidate
    }

    return null
  }

  async function execute(params) {
    const { uri, query = '', useCache = true } = params

    if (!uri) {
      throw new Error('URI 不能为空')
    }

    // 检查缓存
    const cacheKey = `${uri}::${query}`
    if (useCache) {
      const cached = detailCache.get(cacheKey)
      if (cached) {
        return { ...cached, _cached: true }
      }
    }

    // 向量 URI：尝试解析为实体主 URI 后递归获取
    const initialInferredType = inferEntityType(uri)
    if (isLikelyVectorOrFragmentUri(uri) && initialInferredType !== 'entity' && initialInferredType !== 'iiif') {
      const primaryUri = await resolveVectorToEntityUri(uri, initialInferredType)
      if (primaryUri) {
        return execute({ uri: primaryUri, query, useCache })
      }
    }

    // 获取文档
    const inferredType = initialInferredType
    const docOptions = isDataJsonLdUri(uri) ? { allowWhenJsonLdOnly: true } : undefined
    const doc = inferredType === 'ancient_book'
      ? await ancientBookGateways.mlGetDoc(uri)
      : await mlGetDoc(uri, docOptions)
    if (!doc) {
      return {
        uri,
        title: uri.split('/').pop() || '未命名条目',
        summary: '未读取到详情文档。',
        internalLinks: [],
        externalUris: [],
      }
    }

    // 推断实体类型
    const entityType = inferredType

    // 根据类型选择提取器
    let detail = null
    switch (entityType) {
      case 'person':
        detail = extractPersonDetail(uri, doc)
        break
      case 'poem':
        detail = await buildPoemDetailForLegacy(uri, doc, poemDetailDependencies)
        if (!detail) {
          detail = extractPoemDetail(uri, doc)
        }
        break
      case 'book':
        detail = extractBookDetail(uri, doc)
        break
      case 'place':
        detail = extractPlaceDetail(uri, doc)
        break
      case 'concept':
        detail = extractConceptDetail(uri, doc)
        break
      case 'ancient_book':
        detail = await extractAncientBookDetail(uri, doc, ancientBookGateways)
        break
      default:
        // 通用详情
        detail = {
          id: extractIdFromUri(uri),
          title: pickRowTitle({ uri }, doc),
          summary: extractMarkText(extractDocText(doc), 260) || '暂无摘要',
          uri,
        }
    }

    // 提取外部 URI
    const externalUris = Array.from(
      new Set(
        extractCandidateUris(doc, 40).filter(
          (item) => item.startsWith('http://') || item.startsWith('https://'),
        ),
      ),
    ).slice(0, 12)

    // 构建结果
    const result = {
      ...detail,
      uri,
      type: entityType,
      externalUris,
      doc,
      _cached: false,
    }

    // 写入缓存
    if (useCache) {
      detailCache.set(cacheKey, result)
    }

    return result
  }

  /**
   * 根据 ID 获取详情
   *
   * @param {object} params - 查询参数
   * @param {string} params.id - 实体 ID
   * @param {string} params.type - 实体类型
   * @returns {Promise<object>} 详情结果
   */
  async function executeById(params) {
    const { id, type = 'entity' } = params

    if (!id) {
      throw new Error('ID 不能为空')
    }

    // 构建可能的 URI 列表
    const possibleUris = buildPossibleUris(id, type)

    // 尝试每个 URI
    for (const uri of possibleUris) {
      const doc = await mlGetDoc(uri, { allowWhenJsonLdOnly: true })
      if (doc) {
        return execute({ uri, query: '' })
      }
    }

    // 如果直接查找失败，尝试搜索
    const searchData = await searchWithFallback({
      query: id,
      pageLength: 10,
      directories: getDirectoriesForType(type),
      collections: [],
    })

    const match = (searchData.results || []).find(
      (row) => String(row?.uri || '').includes(id) || extractIdFromUri(row?.uri) === id,
    )

    if (match) {
      return execute({ uri: match.uri, query: '' })
    }

    return null
  }

  /**
   * 清除缓存
   */
  function clearCache() {
    detailCache.clear()
  }

  /**
   * 获取 IIIF Manifest 的卷首列表
   *
   * @param {string} manifestUrl - Manifest URL
   * @returns {Promise<{manifest: string, volumeHeads: Array}>} 卷首列表
   */
  async function getIiifVolumeHeads(manifestUrl) {
    const parsedManifestPath = parseIiifPublicPath(manifestUrl)
    let response = null

    if (parsedManifestPath) {
      try {
        response = await getIiifDocumentByPath(parsedManifestPath)
      } catch {
        response = null
      }
    }

    if (!response) {
      response = await mlGetJson(manifestUrl, {
        headers: { accept: 'application/json' },
      })
    }
    if (!response) {
      throw new Error('IIIF manifest 拉取失败')
    }

    const volumeHeads = extractVolumeHeadsFromIiifManifest(response)
    return {
      manifest: manifestUrl,
      volumeHeads,
    }
  }

  /**
   * 按公开 IIIF 路径读取文档。
   *
   * @param {string} publicPath - 公开路径
   * @param {string} publicOrigin - 对外域名
   * @returns {Promise<object>}
   */
  async function getIiifDocumentByPath(publicPath, publicOrigin = '') {
    const normalizedPath = parseIiifPublicPath(publicPath)
    if (!normalizedPath) {
      throw new Error('IIIF 路径无效')
    }

    const document = await loadIiifDocumentFromMarkLogicByCandidates(
      buildIiifMarklogicCandidates(normalizedPath),
      mlGetDoc,
    )
    if (!document || typeof document !== 'object') {
      throw new Error('IIIF 文档不存在')
    }

    return rewriteIiifPublicDocument(document, publicOrigin)
  }

  /**
   * 搜索 IIIF manifest 文本内容。
   *
   * @param {object} params - 搜索参数
   * @param {string} params.bookId - 书籍 ID
   * @param {string} params.carrierId - 载体 ID
   * @param {string} params.query - 查询文本
   * @param {string} params.publicOrigin - 对外域名
   * @returns {Promise<object>}
   */
  async function searchIiifContent({ bookId, carrierId, query, publicOrigin = '' }) {
    const safeBookId = normalizeText(bookId)
    const safeCarrierId = normalizeText(carrierId)
    const safeQuery = normalizeText(query)

    if (!safeBookId || !safeCarrierId || !safeQuery) {
      throw new Error('IIIF 搜索参数不完整')
    }

    const manifest = await getIiifDocumentByPath(
      `/iiif/manifests/ancientBook/${safeBookId}/${safeCarrierId}/manifest.json`,
      publicOrigin,
    )
    const results = extractIiifSearchMatches(manifest, safeQuery)

    return buildIiifSearchResponse({
      query: safeQuery,
      searchUrl: `${trimTrailingSlash(publicOrigin)}/iiif/3/search/ancientBook/${safeBookId}/${safeCarrierId}`,
      results,
    })
  }

  /**
   * 列出实体列表
   *
   * @param {object} params - 查询参数
   * @param {string} params.entityType - 实体类型
   * @param {string} params.query - 查询文本
   * @param {number} params.page - 页码
   * @param {number} params.pageSize - 每页数量
   * @returns {Promise<object>} 列表结果
   */
  async function listEntities(params) {
    const { entityType = 'entity', query = '*', page = 1, pageSize = 20 } = params

    const directories = getDirectoriesForType(entityType)
    if (directories.length === 0) {
      return { items: [], total: 0, totalPages: 0 }
    }

    const start = (page - 1) * pageSize
    const searchData = await searchWithFallback({
      query,
      pageLength: start + pageSize,
      directories,
      collections: [],
    })

    const results = searchData.results || []
    const total = searchData.total || results.length
    const totalPages = Math.ceil(total / pageSize)
    const items = results.slice(start, start + pageSize).map((row) => ({
      id: extractIdFromUri(row?.uri),
      title: row?.title || row?.name || row?._label || extractIdFromUri(row?.uri),
      uri: row?.uri,
      type: entityType,
      snippet: extractMarkText(row?.fullText || row?.text || row?.content || '', 180),
    }))

    return { items, total, totalPages, page, pageSize }
  }

  return {
    execute,
    executeById,
    listEntities,
    clearCache,
    inferEntityType,
    getIiifVolumeHeads,
    getIiifDocumentByPath,
    searchIiifContent,
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 根据类型构建可能的 URI 列表
 *
 * @param {string} id - 实体 ID
 * @param {string} type - 实体类型
 * @returns {string[]} URI 列表
 */
function buildPossibleUris(id, type) {
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

/**
 * 获取类型的目录列表
 *
 * @param {string} type - 实体类型
 * @returns {string[]} 目录列表
 */
function getDirectoriesForType(type) {
  const dirMap = {
    poem: [
      ...getEntityDirectories('poem'),
      '/processed/json-ld/poem/text/',
    ],
  }
  return dirMap[type] || getEntityDirectories(type)
}

function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/g, '')
}

function parseIiifPublicPath(value) {
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

function buildIiifMarklogicCandidates(publicPath) {
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

async function loadIiifDocumentFromMarkLogicByCandidates(candidates, mlGetDoc) {
  for (const uri of candidates) {
    const document = await mlGetDoc(uri, { allowWhenJsonLdOnly: true })
    if (document) return document
  }
  return null
}

function rewriteIiifPublicDocument(document, publicOrigin) {
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

function extractIiifSearchMatches(manifest, query) {
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

function buildIiifSearchResponse({ query, searchUrl, results }) {
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

/**
 * 获取类型标签
 *
 * @param {string} type - 实体类型
 * @returns {string} 类型标签
 */
function getTypeLabel(type) {
  const labels = {
    person: '人物',
    poem: '诗文',
    book: '图书',
    ancient_book: '古籍',
    place: '地点',
    concept: '概念',
    entity: '条目',
  }
  return labels[type] || '条目'
}

/**
 * 创建带回退的搜索函数
 *
 * @param {object} gateways - 网关依赖
 * @returns {Function} 搜索函数
 */
function createSearchWithFallback(gateways) {
  const { mlSearchByDirectory, mlSearchByCollection } = gateways

  return async function searchWithFallback({ query, pageLength, directories = [], collections = [] }) {
    // 按目录搜索
    for (const directory of directories) {
      try {
        const result = await mlSearchByDirectory(directory, query, pageLength)
        if (result && result.results && result.results.length > 0) {
          return result
        }
      } catch (error) {
        console.error(`searchWithFallback: 搜索目录 ${directory} 失败:`, error.message)
      }
    }

    // 按集合搜索
    for (const collection of collections) {
      try {
        const result = await mlSearchByCollection(collection, query, pageLength)
        if (result && result.results && result.results.length > 0) {
          return result
        }
      } catch (error) {
        console.error(`searchWithFallback: 搜索集合 ${collection} 失败:`, error.message)
      }
    }

    return { results: [], total: 0 }
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  createGetDetailUseCase,
}
