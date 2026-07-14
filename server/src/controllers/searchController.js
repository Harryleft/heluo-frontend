/**
 * 搜索接口控制器
 *
 * 处理 /api/v1/search 请求
 * 负责参数解析、调用 UseCase、响应格式化
 *
 * @module server/src/controllers/searchController
 */

import { apiV1Response, apiV1Error } from './healthController.js'

// ============================================================================
// 参数解析工具
// ============================================================================

/**
 * 解析分页参数
 *
 * @param {object} query - 查询参数
 * @param {number} defaultPageSize - 默认每页大小
 * @param {number} maxPageSize - 最大每页大小
 * @returns {{page: number, pageSize: number}}
 */
export function parsePaginationParams(query, defaultPageSize = 12, maxPageSize = 30) {
  const page = Math.max(1, Math.floor(Number(query.page || 1)))
  const pageSize = Math.max(1, Math.min(Math.floor(Number(query.pageSize || defaultPageSize)), maxPageSize))
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
// 控制器工厂
// ============================================================================

/**
 * 创建搜索控制器
 *
 * @param {object} dependencies - 依赖注入
 * @param {object} dependencies.useCases - 用例依赖
 * @param {object} dependencies.config - 配置依赖
 * @param {Function} dependencies.marklogicFetch - MarkLogic fetch 函数
 * @param {string} dependencies.marklogicBaseUrl - MarkLogic 基础 URL
 * @returns {object} 控制器方法
 */
export function createSearchController(dependencies) {
  const { useCases, config, marklogicFetch, marklogicBaseUrl } = dependencies
  const { searchUnified } = useCases
  const { searchMode: defaultSearchMode, scopeTimeoutMs } = config

  return {
    /**
     * GET /api/v1/search
     * 统一搜索接口（支持混合搜索模式）
     *
     * @param {object} req - Express 请求对象
     * @param {object} res - Express 响应对象
     */
    async search(req, res) {
      try {
        const qRaw = String(req.query.q || '').trim()
        const q = qRaw || '*'
        const requestId = `search-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

        const typeStr = String(req.query.type || 'all').trim()
        const types = parseTypeFilter(typeStr)
        const { page, pageSize } = parsePaginationParams(req.query, 12, 30)

        // 优先使用请求参数 mode，其次回退环境变量
        const searchMode = parseSearchMode(req.query.mode, defaultSearchMode)

        console.log(
          `[SearchV1] requestId=${requestId} start q=${JSON.stringify(q === '*' ? '*' : q.slice(0, 64))} type=${typeStr} mode=${searchMode} page=${page} pageSize=${pageSize} scopeTimeoutMs=${scopeTimeoutMs}`
        )

        // 调用 UseCase
        const result = await searchUnified.execute({
          query: q,
          type: typeStr,
          mode: searchMode,
          page,
          pageSize,
        }, {
          requestId,
          scopeTimeoutMs,
          marklogicFetch,
          marklogicBaseUrl,
        })

        console.log(
          `[SearchV1] requestId=${requestId} done total=${result.total} merged=${result.items?.length || 0}`
        )

        res.json(
          apiV1Response(
            {
              query: q,
              type: typeStr,
              mode: searchMode,
              total: result.total,
              items: result.items,
              counts: result.counts,
            },
            { total: result.total, page, pageLength: pageSize }
          )
        )
      } catch (error) {
        if (error.response) {
          return res.status(error.statusCode).json(error.response)
        }
        if (error.code === 'SEARCH_BACKEND_UNAVAILABLE') {
          const serviceError = apiV1Error(
            'SEARCH_BACKEND_UNAVAILABLE',
            '检索服务暂不可用',
            error.details || null,
            503,
          )
          return res.status(serviceError.statusCode).json(serviceError.response)
        }
        console.error('Error in GET /api/v1/search:', error)
        res.status(500).json(apiV1Error('INTERNAL_ERROR', '服务器内部错误', String(error), 500).response)
      }
    },

  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  createSearchController,
  parsePaginationParams,
  parseTypeFilter,
  parseSearchMode,
}
