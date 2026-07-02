/**
 * 搜索编排模块
 *
 * 负责搜索流程的编排，选择检索策略（keyword/vector/hybrid），
 * 并协调多种搜索模式。
 *
 * @module server/src/domain/retrieval/searchOrchestrator
 */

import { searchConfig, getEntityDirectories, isJsonLdDirectory } from '../../bootstrap/config.js'
import { mergeRowsByUri, mergeHybridRowsByRrf } from './resultMerger.js'

const LEGACY_CONCEPT_COLLECTIONS = Object.freeze([
  '/heluo/concepts',
  '/heluo/poetry/concepts',
  '/heluo/api/concepts',
  '/heluo/ancient-book-concepts',
])

// ============================================================================
// 实体来源映射
// ============================================================================

/**
 * 获取实体来源配置（目录和集合）
 *
 * @returns {object} 实体来源映射
 */
export function entitySourceMap() {
  return {
    person: {
      directories: getEntityDirectories('person'),
      collections: searchConfig.jsonLdOnly ? [] : ['/heluo/persons', '/heluo/person'],
    },
    poem: {
      directories: getEntityDirectories('poem'),
      collections: searchConfig.jsonLdOnly ? [] : ['/heluo/poems-set', '/heluo/poems_set'],
    },
    book: {
      directories: getEntityDirectories('book'),
      collections: searchConfig.jsonLdOnly ? [] : ['/heluo/books', '/heluo/marc'],
    },
    ancient_book: {
      directories: getEntityDirectories('ancient_book'),
      collections: searchConfig.jsonLdOnly ? [] : ['/heluo/ancient-book-sets', '/heluo/ancient_book_sets'],
    },
    place: {
      directories: getEntityDirectories('place'),
      collections: searchConfig.jsonLdOnly ? [] : ['/heluo/places'],
    },
    concept: {
      directories: getEntityDirectories('concept'),
      collections: LEGACY_CONCEPT_COLLECTIONS,
    },
    iiif: {
      directories: getEntityDirectories('iiif', { includeLegacy: false }),
      collections: [],
    },
  }
}

// ============================================================================
// URI 类型判断
// ============================================================================

/**
 * 判断是否为诗文集合 URI
 *
 * @param {string} uri - 文档 URI
 * @returns {boolean}
 */
export function isPoemSetUri(uri) {
  const value = String(uri || '')
  return value.startsWith('/processed/json-ld/poem/set/') ||
    value.startsWith('/data/processed/json-ld/poem/set/')
}

/**
 * 判断是否为诗文文本 URI
 *
 * @param {string} uri - 文档 URI
 * @returns {boolean}
 */
export function isPoemTextUri(uri) {
  const value = String(uri || '')
  return value.startsWith('/processed/json-ld/poem/txt/') ||
    value.startsWith('/data/processed/json-ld/poem/txt/')
}

/**
 * 判断是否为古籍条目 URI
 *
 * @param {string} uri - 文档 URI
 * @returns {boolean}
 */
export function isAncientBookEntryUri(uri) {
  const value = String(uri || '')
  if (!value) return false
  if (value.startsWith('/processed/iiif/collections/') || value.startsWith('/heluo/iiif/collections/')) return false
  if (value.includes('/ancient_book_set/department/') || value.includes('/ancient_book_set/root/')) return false
  return value.startsWith('/processed/json-ld/ancient_book/ancient_book_set/book_entry/') ||
    value.startsWith('/data/processed/json-ld/ancient_book/ancient_book_set/book_entry/') ||
    value.startsWith('/data/processed/json-ld/ancient_book/ancient_book_set/')
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 安全转换为浮点数
 *
 * @param {any} value - 输入值
 * @returns {number} 浮点数（无效值返回 0）
 */
function safeFloat(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

// ============================================================================
// 搜索策略接口
// ============================================================================

/**
 * 创建搜索策略上下文
 *
 * @param {object} gateways - 网关依赖
 * @param {object} retrievers - 检索器依赖
 * @returns {object} 搜索策略函数
 */
export function createSearchOrchestrator(gateways, retrievers) {
  const { mlSearchByDirectory, mlSearchByCollection } = gateways
  const { getEmbedding, mlVectorSearch, isVectorSearchEnabled } = retrievers

  /**
   * 带回退的搜索
   *
   * @param {object} params - 搜索参数
   * @returns {Promise<object>} 搜索结果
   */
  async function searchWithFallback({
    query,
    pageLength,
    directories = [],
    collections = [],
    directoryMode = 'all',
    allowCollectionsWhenJsonLdOnly = false,
  }) {
    const effectiveDirectories = searchConfig.jsonLdOnly
      ? directories.filter((item) => isJsonLdDirectory(item))
      : directories
    const effectiveCollections = searchConfig.jsonLdOnly && !allowCollectionsWhenJsonLdOnly ? [] : collections
    const pool = []
    let directoryTotal = 0
    let collectionTotal = 0

    for (const directory of effectiveDirectories) {
      const data = await mlSearchByDirectory(directory, query, pageLength)
      pool.push(...(data.results || []))
      directoryTotal += data.total || 0
      if (directoryMode === 'first_non_empty' && Number(data.total || 0) > 0) {
        break
      }
    }

    for (const collection of effectiveCollections) {
      const data = await mlSearchByCollection(collection, query, pageLength, {
        allowWhenJsonLdOnly: allowCollectionsWhenJsonLdOnly,
      })
      pool.push(...(data.results || []))
      collectionTotal += data.total || 0
    }

    const merged = mergeRowsByUri(pool).sort(
      (a, b) => safeFloat(b.score) + safeFloat(b.confidence) - (safeFloat(a.score) + safeFloat(a.confidence)),
    )

    return {
      directoryTotal,
      collectionTotal,
      mergedTotal: Math.max(directoryTotal, collectionTotal),
      results: merged.slice(0, pageLength),
    }
  }

  /**
   * 纯关键字搜索
   */
  async function searchScopeDataKeyword(query, scope, pageLength, source) {
    const data = await searchWithFallback({
      query,
      pageLength,
      directories: source.directories,
      collections: source.collections,
      directoryMode: scope === 'poem' ? 'first_non_empty' : 'all',
      allowCollectionsWhenJsonLdOnly: scope === 'concept',
    })

    let rows = data.results || []
    if (scope === 'poem') {
      rows = rows.filter((row) => isPoemSetUri(row?.uri))
    }
    if (scope === 'ancient_book') {
      rows = rows.filter((row) => isAncientBookEntryUri(row?.uri))
    }

    let total = Math.max(Number(data.directoryTotal || 0), Number(data.collectionTotal || 0), rows.length)
    if (scope === 'ancient_book') {
      total = Math.max(Number(data.directoryTotal || 0), rows.length)
    }

    // 标记来源
    rows = rows.map((row) => ({ ...row, source: 'keyword' }))
    return { rows, total }
  }

  /**
   * 带超时的向量搜索
   *
   * @param {string} query - 查询文本
   * @param {string} scope - 实体类型
   * @param {number} pageLength - 返回数量
   * @param {Function} marklogicFetch - MarkLogic fetch 函数
   * @param {string} marklogicBaseUrl - MarkLogic 基础 URL
   * @param {number} timeoutMs - 超时时间（毫秒），默认 30000
   * @returns {Promise<{rows: Array, total: number, degraded?: boolean}>}
   */
  async function searchScopeDataVector(query, scope, pageLength, marklogicFetch, marklogicBaseUrl, timeoutMs = 30000) {
    // 参数校验：确保超时参数有效
    const effectiveTimeout = Math.max(100, Number(timeoutMs) || 30000)

    // 内部执行向量搜索
    const doVectorSearch = async () => {
      // 1. 获取查询向量
      const queryVector = await getEmbedding(query)
      if (!queryVector || queryVector.length === 0) {
        console.warn(`[VectorSearch] 无法获取查询向量: ${query}`)
        return { rows: [], total: 0, degraded: true, reason: 'no_embedding' }
      }

      // 2. 执行向量搜索
      const vectorResults = await mlVectorSearch(
        scope,
        queryVector,
        { topK: pageLength, queryText: query },
        marklogicFetch,
        marklogicBaseUrl,
      )

      // 3. 转换为统一格式
      const rows = vectorResults.map((result) => ({
        uri: result.uri,
        id: result.uri,
        title: result.title,
        name: result.title,
        _label: result.title,
        snippet: result.snippet,
        type: result.type,
        score: result.score,
        confidence: result.confidence,
        similarity: result.similarity,
        vectorScore: result.similarity,
        source: 'vector',
      }))

      return { rows, total: rows.length }
    }

    // 使用可清理的超时模式（避免内存泄漏）
    let timeoutId = null
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Vector search timeout after ${effectiveTimeout}ms`)),
        effectiveTimeout
      )
    })

    try {
      const result = await Promise.race([doVectorSearch(), timeoutPromise])
      return result
    } catch (error) {
      console.error('[VectorSearch] 向量搜索失败:', error.message)
      // 返回降级标记，由调用方决定是否降级
      return { rows: [], total: 0, degraded: true, reason: error.message }
    } finally {
      // 确保定时器始终被清理，避免内存泄漏
      if (timeoutId) clearTimeout(timeoutId)
    }
  }

  /**
   * 混合搜索（关键字 + 向量）
   *
   * @param {string} query - 查询文本
   * @param {string} scope - 实体类型
   * @param {number} pageLength - 返回数量
   * @param {object} source - 实体源配置
   * @param {Function} marklogicFetch - MarkLogic fetch 函数
   * @param {string} marklogicBaseUrl - MarkLogic 基础 URL
   * @param {number} vectorTimeoutMs - 向量搜索超时时间（毫秒）
   */
  async function searchScopeDataHybrid(query, scope, pageLength, source, marklogicFetch, marklogicBaseUrl, vectorTimeoutMs = 30000) {
    try {
      // 并行执行两种搜索
      const [keywordResult, vectorResult] = await Promise.all([
        searchScopeDataKeyword(query, scope, pageLength * 2, source),
        searchScopeDataVector(query, scope, pageLength * 2, marklogicFetch, marklogicBaseUrl, vectorTimeoutMs),
      ])

      const rows = mergeHybridRowsByRrf(keywordResult.rows || [], vectorResult.rows || [], pageLength, scope)
      const total = Math.max(keywordResult.total, vectorResult.total, rows.length)
      return { rows, total }
    } catch (error) {
      console.error('[HybridSearch] 混合搜索失败:', error.message)
      // 降级为关键字搜索
      return await searchScopeDataKeyword(query, scope, pageLength, source)
    }
  }

  /**
   * 作用域搜索（支持多种搜索模式）
   *
   * @param {string} query - 查询文本
   * @param {string} scope - 实体类型
   * @param {number} pageLength - 返回数量
   * @param {object} options - 额外选项
   * @param {string} options.searchMode - 搜索模式（keyword/vector/hybrid）
   * @param {Function} options.marklogicFetch - MarkLogic fetch 函数
   * @param {string} options.marklogicBaseUrl - MarkLogic 基础 URL
   * @param {number} options.vectorTimeoutMs - 向量搜索超时时间（毫秒）
   * @returns {Promise<{rows: Array, total: number, degraded?: boolean}>}
   */
  async function searchScopeData(query, scope, pageLength, options = {}) {
    const { searchMode = 'keyword', marklogicFetch, marklogicBaseUrl, vectorTimeoutMs = 30000 } = options
    const source = entitySourceMap()[scope]
    if (!source) return { rows: [], total: 0 }

    // 统一降级函数：当向量搜索失败时降级到关键词搜索
    const fallbackToKeyword = async (reason) => {
      console.warn(`[SearchScope] 降级到 keyword: scope=${scope}, reason=${reason}`)
      const result = await searchScopeDataKeyword(query, scope, pageLength, source)
      return { ...result, degraded: true, fallbackReason: reason }
    }

    // 模式1: 纯关键字搜索（默认，保持向后兼容）
    if (searchMode === 'keyword' || !isVectorSearchEnabled()) {
      return await searchScopeDataKeyword(query, scope, pageLength, source)
    }

    // 模式2: 纯向量搜索（带降级）
    if (searchMode === 'vector') {
      const result = await searchScopeDataVector(query, scope, pageLength, marklogicFetch, marklogicBaseUrl, vectorTimeoutMs)
      // 当向量搜索降级或返回空结果时，尝试关键词搜索兜底
      if (result.degraded || result.rows.length === 0) {
        const keywordResult = await searchScopeDataKeyword(query, scope, pageLength, source)
        // 如果关键词搜索有结果，使用关键词结果；否则保持向量结果
        if (keywordResult.rows.length > 0) {
          return { ...keywordResult, degraded: true, fallbackReason: result.reason || 'vector_empty' }
        }
      }
      return result
    }

    // 模式3: 混合搜索（关键字 + 向量）
    if (searchMode === 'hybrid') {
      try {
        return await searchScopeDataHybrid(query, scope, pageLength, source, marklogicFetch, marklogicBaseUrl, vectorTimeoutMs)
      } catch (error) {
        return await fallbackToKeyword(error.message)
      }
    }

    // 默认：关键字搜索
    return await searchScopeDataKeyword(query, scope, pageLength, source)
  }

  return {
    searchWithFallback,
    searchScopeData,
    searchScopeDataKeyword,
    searchScopeDataVector,
    searchScopeDataHybrid,
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  entitySourceMap,
  isPoemSetUri,
  isPoemTextUri,
  isAncientBookEntryUri,
  createSearchOrchestrator,
}
