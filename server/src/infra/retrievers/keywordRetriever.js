/**
 * 关键词检索器
 *
 * 基于 MarkLogic 全文搜索实现关键词检索。
 * 支持多目录/集合搜索、分页和结果过滤。
 *
 * @module server/src/infra/retrievers/keywordRetriever
 */

import { BaseRetriever } from './baseRetriever.js'
import { mlSearchByDirectory, mlSearchByCollection } from '../gateways/marklogicGateway.js'
import { isJsonLdDirectory, getEntityDirectories } from '../../bootstrap/config.js'

// ============================================================================
// URI 过滤辅助函数
// ============================================================================

/**
 * 判断 URI 是否为诗词集合类型
 *
 * @param {string} uri - 文档 URI
 * @returns {boolean} 是否为诗词集合 URI
 */
function isPoemSetUri(uri) {
  const value = String(uri || '')
  return value.startsWith('/processed/json-ld/poem/set/') ||
    value.startsWith('/data/processed/json-ld/poem/set/')
}

/**
 * 判断 URI 是否为古籍条目类型
 *
 * @param {string} uri - 文档 URI
 * @returns {boolean} 是否为古籍条目 URI
 */
function isAncientBookEntryUri(uri) {
  const value = String(uri || '')
  if (!value) return false
  if (value.startsWith('/processed/iiif/collections/') || value.startsWith('/heluo/iiif/collections/')) return false
  if (value.includes('/ancient_book_set/department/') || value.includes('/ancient_book_set/root/')) return false
  return value.startsWith('/processed/json-ld/ancient_book/ancient_book_set/book_entry/') ||
    value.startsWith('/data/processed/json-ld/ancient_book/ancient_book_set/book_entry/')
}

// ============================================================================
// 结果合并辅助函数
// ============================================================================

/**
 * 按 URI 合并去重结果
 *
 * @param {Array} rows - 原始结果列表
 * @returns {Array} 合并后的结果列表
 */
function mergeRowsByUri(rows = []) {
  const merged = new Map()
  for (const row of rows) {
    const uri = String(row?.uri || '').trim()
    if (!uri) continue
    const score = Number(row?.score || 0) + Number(row?.confidence || 0)
    const current = merged.get(uri)
    if (!current || score > Number(current._merge_score || 0)) {
      merged.set(uri, { ...row, _merge_score: score })
    }
  }
  return Array.from(merged.values())
}

// ============================================================================
// 实体源映射
// ============================================================================

/**
 * 获取实体源映射（目录和集合）
 *
 * @param {object} config - 配置对象
 * @returns {Function} 返回获取源映射的函数
 */
function createEntitySourceMap(config) {
  const { jsonLdOnly, enableLegacyEntityPaths } = config

  return function entitySourceMap() {
    return {
      person: {
        directories: getEntityDirectories('person', { includeLegacy: enableLegacyEntityPaths && !jsonLdOnly }),
        collections: jsonLdOnly ? [] : ['/heluo/persons', '/heluo/person'],
      },
      poem: {
        directories: getEntityDirectories('poem', { includeLegacy: enableLegacyEntityPaths && !jsonLdOnly }),
        collections: jsonLdOnly ? [] : ['/heluo/poems-set', '/heluo/poems_set'],
      },
      book: {
        directories: getEntityDirectories('book', { includeLegacy: enableLegacyEntityPaths && !jsonLdOnly }),
        collections: jsonLdOnly ? [] : ['/heluo/books', '/heluo/marc'],
      },
      ancient_book: {
        directories: getEntityDirectories('ancient_book', { includeLegacy: enableLegacyEntityPaths && !jsonLdOnly }),
        collections: jsonLdOnly ? [] : ['/heluo/ancient-book-sets', '/heluo/ancient_book_sets'],
      },
      place: {
        directories: getEntityDirectories('place', { includeLegacy: enableLegacyEntityPaths && !jsonLdOnly }),
        collections: jsonLdOnly ? [] : ['/heluo/places'],
      },
      concept: {
        directories: getEntityDirectories('concept', { includeLegacy: enableLegacyEntityPaths && !jsonLdOnly }),
        collections: jsonLdOnly
          ? []
          : ['/heluo/concepts', '/heluo/poetry/concepts', '/heluo/api/concepts', '/heluo/ancient-book-concepts'],
      },
      iiif: {
        directories: getEntityDirectories('iiif', { includeLegacy: false }),
        collections: [],
      },
    }
  }
}

// ============================================================================
// 关键词检索器类
// ============================================================================

/**
 * 关键词检索器
 *
 * 使用 MarkLogic 全文搜索进行关键词检索。
 */
export class KeywordRetriever extends BaseRetriever {
  /**
   * @param {object} gateways - 网关依赖（本检索器不使用）
   * @param {object} config - 配置对象
   * @param {boolean} config.jsonLdOnly - 是否仅返回 JSON-LD
   * @param {boolean} config.enableLegacyEntityPaths - 是否启用旧版实体路径
   */
  constructor(gateways, config) {
    super(gateways, config)
    this.name = 'keyword'
    this.entitySourceMap = createEntitySourceMap({
      jsonLdOnly: config.jsonLdOnly,
      enableLegacyEntityPaths: config.enableLegacyEntityPaths,
    })
  }

  /**
   * 执行带回退策略的搜索
   *
   * 依次搜索多个目录和集合，合并结果。
   *
   * @param {object} params - 搜索参数
   * @param {string} params.query - 查询文本
   * @param {number} params.pageLength - 每页结果数
   * @param {string[]} params.directories - 目录列表
   * @param {string[]} params.collections - 集合列表
   * @param {string} params.directoryMode - 目录搜索模式: 'all' | 'first_non_empty'
   * @returns {Promise<{directoryTotal: number, collectionTotal: number, mergedTotal: number, results: Array}>}
   */
  async searchWithFallback({ query, pageLength, directories = [], collections = [], directoryMode = 'all' }) {
    const { jsonLdOnly } = this.config
    const effectiveDirectories = jsonLdOnly ? directories.filter((item) => isJsonLdDirectory(item)) : directories
    const effectiveCollections = jsonLdOnly ? [] : collections

    const pool = []
    let directoryTotal = 0
    let collectionTotal = 0

    // 搜索目录
    for (const directory of effectiveDirectories) {
      const data = await mlSearchByDirectory(directory, query, pageLength)
      pool.push(...(data.results || []))
      directoryTotal += data.total || 0
      // 首个非空目录模式：找到结果后立即停止
      if (directoryMode === 'first_non_empty' && Number(data.total || 0) > 0) {
        break
      }
    }

    // 搜索集合
    for (const collection of effectiveCollections) {
      const data = await mlSearchByCollection(collection, query, pageLength)
      pool.push(...(data.results || []))
      collectionTotal += data.total || 0
    }

    // 合并去重并排序
    const merged = mergeRowsByUri(pool).sort(
      (a, b) => this.safeFloat(b.score) + this.safeFloat(b.confidence) - (this.safeFloat(a.score) + this.safeFloat(a.confidence)),
    )

    return {
      directoryTotal,
      collectionTotal,
      mergedTotal: Math.max(directoryTotal, collectionTotal),
      results: merged.slice(0, pageLength),
    }
  }

  /**
   * 执行关键词搜索
   *
   * @param {string} query - 查询文本
   * @param {string} scope - 实体类型
   * @param {object} options - 搜索选项
   * @param {number} [options.pageLength=20] - 每页结果数
   * @returns {Promise<{rows: Array, total: number}>} 搜索结果
   */
  async search(query, scope, options = {}) {
    const { pageLength = 20 } = options
    const source = this.entitySourceMap()[scope]

    if (!source) {
      return { rows: [], total: 0 }
    }

    const data = await this.searchWithFallback({
      query,
      pageLength,
      directories: source.directories,
      collections: source.collections,
      directoryMode: scope === 'poem' ? 'first_non_empty' : 'all',
    })

    let rows = data.results || []

    // 诗词范围过滤：仅保留诗词集合类型
    if (scope === 'poem') {
      rows = rows.filter((row) => isPoemSetUri(row?.uri))
    }

    // 古籍范围过滤：仅保留古籍条目类型
    if (scope === 'ancient_book') {
      rows = rows.filter((row) => isAncientBookEntryUri(row?.uri))
    }

    // 计算总数
    let total = Math.max(Number(data.directoryTotal || 0), Number(data.collectionTotal || 0), rows.length)
    if (scope === 'ancient_book') {
      total = Math.max(Number(data.directoryTotal || 0), rows.length)
    }

    // 标记来源
    rows = rows.map((row) => ({ ...row, source: 'keyword' }))

    return { rows, total }
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default KeywordRetriever
