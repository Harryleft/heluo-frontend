/**
 * 统一搜索用例
 *
 * 编排搜索流程：解析参数 → 选择策略 → 调用检索器 → 格式化结果
 * 支持 keyword/vector/hybrid 三种模式
 *
 * @module server/src/usecases/searchUnifiedUseCase
 */

import { searchConfig } from '../bootstrap/config.js'
import { createSearchOrchestrator, mergeRowsByUri } from '../domain/retrieval/index.js'
import { rerankSearchCandidates } from '../search/hybridSearchUtils.js'
import {
  extractIdFromUri,
  normalizeText,
  extractMarkText,
  extractDocText,
  pickRowTitle,
} from '../utils/textUtils.js'

// ============================================================================
// 参数解析工具
// ============================================================================

/**
 * 解析分页参数
 *
 * @param {object} params - 请求参数
 * @param {number} defaultSize - 默认每页大小
 * @param {number} maxSize - 最大每页大小
 * @returns {{page: number, pageSize: number}}
 */
export function parsePaginationParams(params, defaultSize = 12, maxSize = 30) {
  const page = Math.max(1, Math.floor(Number(params.page || 1)))
  const pageSize = Math.max(1, Math.min(Math.floor(Number(params.pageSize || defaultSize)), maxSize))
  return { page, pageSize }
}

/**
 * 解析类型过滤器
 *
 * @param {string} typeStr - 类型字符串（逗号分隔）
 * @returns {string[]} 类型数组
 */
export function parseTypeFilter(typeStr) {
  const allowedTypes = ['person', 'poem', 'book', 'ancient_book', 'place', 'concept']
  if (!typeStr || typeStr === 'all') {
    return [...allowedTypes]
  }
  return typeStr
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => allowedTypes.includes(item))
}

/**
 * 解析搜索模式
 *
 * @param {string} modeParam - 请求中的模式参数
 * @param {string} defaultMode - 默认模式
 * @returns {string} 搜索模式
 */
export function parseSearchMode(modeParam, defaultMode = 'keyword') {
  const allowedModes = ['keyword', 'vector', 'hybrid']
  const mode = String(modeParam || '').trim().toLowerCase()
  return allowedModes.includes(mode) ? mode : (allowedModes.includes(defaultMode) ? defaultMode : 'keyword')
}

// ============================================================================
// URI 解析工具（业务特定）
// ============================================================================

/**
 * 解析主实体 URI
 *
 * @param {string} scope - 实体类型
 * @param {string} rawUri - 原始 URI
 * @param {object} doc - 文档对象
 * @returns {string} 主 URI
 */
function resolvePrimaryEntityUri(scope, rawUri, doc) {
  const uri = String(rawUri || '').trim()
  if (!uri) return ''

  const normalizedScope = String(scope || '').trim().toLowerCase()
  const fileId = extractIdFromUri(uri)

  const candidateUris = []
  const pushCandidate = (value) => {
    const text = String(value || '').trim()
    if (!text) return
    if (!candidateUris.includes(text)) candidateUris.push(text)
  }

  // 优先使用文档中的主实体标识，避免分片 URI 直接透出到前端
  pushCandidate(doc?.entity_iri)
  pushCandidate(doc?.id)
  pushCandidate(doc?.evidence?.uri)
  pushCandidate(doc?.member_of?.id)
  pushCandidate(doc?.member_of?.[0]?.id)

  // 对于诗文文本类型，尝试获取集合 URI
  if (scope === 'poem' && uri.includes('/poem/text/')) {
    const memberId = doc?.member_of?.id || doc?.member_of?.[0]?.id
    if (memberId) {
      const stem = String(memberId).split('/').pop()?.replace(/\.json$/i, '') || ''
      if (stem) return `/processed/json-ld/poem/set/${stem}.json`
    }
  }

  const primaryByDoc = candidateUris.find((value) => value.includes('/processed/json-ld/'))
  if (primaryByDoc) return primaryByDoc

  // 向量分片 URI 兜底归一化：统一回写到主实体路径
  if (uri.includes('/processed/vector/')) {
    if (!fileId) return uri

    const stripVectorChunkSuffix = (value) => String(value || '').replace(/_(chunk|seg|part)[_-]?\d+$/i, '')

    if (normalizedScope === 'person') {
      // 处理向量索引中的文件名格式（如 person_17170 -> 17170）
      const personId = stripVectorChunkSuffix(fileId.replace(/^person_/i, ''))
      return `/processed/json-ld/person/${personId}.json`
    }
    if (normalizedScope === 'poem') {
      if (uri.includes('/poem/set/')) {
        return `/processed/json-ld/poem/set/${fileId}.json`
      }
      if (uri.includes('/poem/text/')) {
        const poemBaseId = fileId.replace(/_(chunk|seg|part)[_-]?\d+$/i, '')
        return `/processed/json-ld/poem/set/${poemBaseId}.json`
      }
      return `/processed/json-ld/poem/set/${fileId}.json`
    }
    if (normalizedScope === 'book') {
      return `/processed/json-ld/book/${fileId}.json`
    }
    if (normalizedScope === 'ancient_book') {
      return `/processed/json-ld/ancient-book/set/book-entry/${fileId}.json`
    }
    if (normalizedScope === 'place') {
      return `/processed/json-ld/place/${fileId}.json`
    }
    if (normalizedScope === 'concept') {
      return `/processed/json-ld/concept/${fileId}.json`
    }
  }

  return uri
}

/**
 * 判断标题是否为 URI/URL 形式
 *
 * @param {string} value - 标题文本
 * @returns {boolean}
 */
function isUriLikeTitle(value) {
  const text = normalizeText(value)
  if (!text) return false
  return text.startsWith('/') || /^https?:\/\//i.test(text)
}

/**
 * 判断标题是否为分片噪音（如 17170_chunk_01）
 *
 * @param {string} value - 标题文本
 * @returns {boolean}
 */
function isChunkLikeTitle(value) {
  const text = normalizeText(value)
  if (!text) return false
  return /(?:^|[_-])(chunk|seg|part)(?:[_-]?\d+)?$/i.test(text)
}

/**
 * 规范化搜索结果标题，避免向前端透出 URI 或分片噪音
 *
 * @param {string} rawTitle - 原始标题
 * @returns {string}
 */
function normalizeSearchResultTitle(rawTitle) {
  const title = normalizeText(rawTitle)
  if (!title) return '未命名条目'
  if (isUriLikeTitle(title) || isChunkLikeTitle(title)) return '未命名条目'
  return title
}

/**
 * concept 资源在 json-ld 缺失期允许读取旧路径文档。
 *
 * @param {string} scope - 实体类型
 * @param {string} uri - 文档 URI
 * @returns {boolean}
 */
function shouldAllowLegacyDocFetch(scope, uri) {
  const normalizedScope = String(scope || '').trim().toLowerCase()
  const normalizedUri = String(uri || '').trim().toLowerCase()
  return normalizedScope === 'concept' || normalizedUri.includes('/concept/')
}

// ============================================================================
// 用例类
// ============================================================================

/**
 * 创建统一搜索用例
 *
 * @param {object} dependencies - 依赖注入
 * @param {object} dependencies.gateways - 网关依赖
 * @param {object} dependencies.retrievers - 检索器依赖
 * @returns {object} 用例方法
 */
export function createSearchUnifiedUseCase(dependencies) {
  const { gateways, retrievers } = dependencies
  const { mlGetDoc } = gateways
  const searchOrchestrator = createSearchOrchestrator(gateways, retrievers)

  /**
   * 执行统一搜索
   *
   * @param {object} params - 搜索参数
   * @param {string} params.query - 搜索查询
   * @param {string} params.type - 实体类型（all 或逗号分隔的类型）
   * @param {string} params.mode - 搜索模式（keyword/vector/hybrid）
   * @param {number} params.page - 页码
   * @param {number} params.pageSize - 每页大小
   * @param {object} options - 额外选项
   * @returns {Promise<object>} 搜索结果
   */
  async function execute(params, options = {}) {
    const {
      query = '*',
      type = 'all',
      mode = searchConfig.mode,
      page = 1,
      pageSize = 12,
    } = params

    const { timeoutMs = searchConfig.scopeTimeoutMs, marklogicFetch, marklogicBaseUrl } = options

    // 解析参数
    const types = parseTypeFilter(type)
    const searchMode = parseSearchMode(mode, searchConfig.mode)
    const { page: pageNum, pageSize: pageSizeNum } = parsePaginationParams({ page, pageSize })
    const perScopeCandidateSize = Math.min(120, Math.max(pageNum * pageSizeNum * 2, pageSizeNum))
    const rankWindowSize = Math.min(200, Math.max(pageNum * pageSizeNum * 4, 40))

    // 并行搜索各类型
    const pool = []
    const counts = {}

    const scopeResults = await Promise.all(
      types.map(async (scope) => {
        try {
          const result = await searchOrchestrator.searchScopeData(query, scope, perScopeCandidateSize, {
            searchMode,
            marklogicFetch,
            marklogicBaseUrl,
          })
          const rows = Array.isArray(result?.rows) ? result.rows : []
          const total = Number(result?.total || rows.length || 0)
          return { scope, rows, total, status: 'ok' }
        } catch (error) {
          console.error(`[SearchUnified] scope=${scope} error:`, error.message)
          return { scope, rows: [], total: 0, status: 'error', error: error.message }
        }
      }),
    )

    if (scopeResults.length > 0 && scopeResults.every((result) => result.status === 'error')) {
      const error = new Error('All requested search scopes failed')
      error.code = 'SEARCH_BACKEND_UNAVAILABLE'
      error.details = scopeResults.map(({ scope, error: reason }) => ({ scope, reason }))
      throw error
    }

    // 合并结果
    for (const { scope, rows, total } of scopeResults) {
      counts[scope] = total
      for (const row of rows) {
        pool.push({ ...row, _scope: scope })
      }
    }

    const merged = mergeRowsByUri(pool).slice(0, rankWindowSize)

    // 获取文档详情并构建候选列表
    const rankingCandidates = await Promise.all(
      merged.map(async (row) => {
        const rawUri = String(row?.uri || '').trim()
        const scope = String(row?._scope || '').trim().toLowerCase()
        const allowLegacyDocFetch = shouldAllowLegacyDocFetch(scope, rawUri)
        let doc = rawUri ? await mlGetDoc(rawUri, { allowWhenJsonLdOnly: allowLegacyDocFetch }) : null
        const uri = resolvePrimaryEntityUri(scope, rawUri, doc || {})

        // 归一化到主实体 URI 后，优先读取主实体文档，保证标题与摘要稳定
        if (uri && uri !== rawUri) {
          const primaryDoc = await mlGetDoc(uri, {
            allowWhenJsonLdOnly: shouldAllowLegacyDocFetch(scope, uri),
          })
          if (primaryDoc && typeof primaryDoc === 'object') {
            doc = primaryDoc
          }
        }

        const title = normalizeSearchResultTitle(pickRowTitle({ ...row, uri }, doc || {}))
        const snippet = extractMarkText(extractDocText(doc || row), 160) || '暂无摘要'
        return {
          ...row,
          id: extractIdFromUri(uri),
          uri,
          title,
          snippet,
          _doc: doc || null,
        }
      }),
    )

    // 根据搜索模式判断是否包含向量分数
    const hasVectorScore = searchMode === 'vector' || searchMode === 'hybrid'
    const ranked = rerankSearchCandidates(rankingCandidates, query, { hasVectorScore })
    const paged = ranked.slice((pageNum - 1) * pageSizeNum, pageNum * pageSizeNum)

    // 构建返回结果
    const items = paged.map((row) => ({
      type: row?._scope || 'entity',
      id: row?.id || extractIdFromUri(row?.uri),
      title: row?.title || '未命名条目',
      snippet: row?.snippet || '暂无摘要',
      score: Number((row?._scoreDetail?.finalScore || 0).toFixed(4)),
      scoreDetail: row?._scoreDetail || null,
      uri: row?.uri || '',
    }))

    const total = Object.values(counts).reduce((acc, value) => acc + Number(value || 0), 0)

    return {
      query,
      type,
      mode: searchMode,
      total,
      items,
      counts,
      meta: {
        page: pageNum,
        pageLength: pageSizeNum,
      },
    }
  }

  return {
    execute,
    parsePaginationParams,
    parseTypeFilter,
    parseSearchMode,
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  createSearchUnifiedUseCase,
  parsePaginationParams,
  parseTypeFilter,
  parseSearchMode,
}
