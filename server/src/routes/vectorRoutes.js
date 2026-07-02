/**
 * 向量搜索路由
 *
 * 提供向量搜索相关的测试端点：
 * - /api/v1/vector/status (只读，生产环境可用)
 * - /api/v1/vector/cache (GET 只读，DELETE 需要调试模式)
 * - /api/v1/vector/test (需要调试模式)
 *
 * 注意：这些端点目前需要特殊依赖注入，因为它们依赖于
 * app.js 中的内部函数。后续需要重构到控制器层。
 *
 * @module server/src/routes/vectorRoutes
 */

import { getEmbeddingCacheStats, clearEmbeddingCache, getEmbeddingConfig } from '../services/embeddingService.js'

// 调试模式开关（生产环境应禁用）
const isDebugEnabled = process.env.VECTOR_DEBUG_ENABLED === 'true'

/**
 * 注册向量搜索路由
 *
 * @param {object} app - Express 应用实例
 * @param {object} deps - 依赖注入
 * @param {object} deps.vectorService - 向量搜索服务
 * @param {object} deps.config - 配置
 */
export function registerVectorRoutes(app, deps) {
  const { vectorService, config } = deps
  const { isVectorSearchEnabled, getEmbedding, mlVectorSearch } = vectorService
  const { searchMode, vectorConfig, marklogicFetch, marklogicBaseUrl } = config

  /**
   * GET /api/v1/vector/status
   * 检查向量搜索服务状态（只读，生产环境可用）
   */
  app.get('/api/v1/vector/status', (_req, res) => {
    const cacheStats = getEmbeddingCacheStats()
    res.json({
      enabled: isVectorSearchEnabled(),
      searchMode: searchMode,
      config: {
        vectorDimension: vectorConfig.vectorDimension,
        defaultTopK: vectorConfig.defaultTopK,
        similarityThreshold: vectorConfig.similarityThreshold,
      },
      cache: {
        enabled: getEmbeddingConfig().cache.enabled,
        size: cacheStats.size,
        maxSize: cacheStats.maxSize,
        hitRate: cacheStats.hitRate,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
      },
    })
  })

  /**
   * GET /api/v1/vector/cache
   * 获取 Embedding 缓存统计
   */
  app.get('/api/v1/vector/cache', (_req, res) => {
    const stats = getEmbeddingCacheStats()
    const config = getEmbeddingConfig()
    res.json({
      enabled: config.cache.enabled,
      ttl: config.cache.ttl,
      ...stats,
    })
  })

  /**
   * DELETE /api/v1/vector/cache
   * 清空 Embedding 缓存（需要调试模式）
   */
  app.delete('/api/v1/vector/cache', (_req, res) => {
    if (!isDebugEnabled) {
      return res.status(403).json({ error: '调试模式未启用，禁止清空缓存' })
    }
    clearEmbeddingCache()
    res.json({ success: true, message: '缓存已清空' })
  })

  /**
   * POST /api/v1/vector/test
   * 测试向量搜索功能（需要调试模式）
   *
   * Body: { query: string, scope?: string, topK?: number }
   */
  app.post('/api/v1/vector/test', async (req, res) => {
    if (!isDebugEnabled) {
      return res.status(403).json({ error: '调试模式未启用，禁止使用测试端点' })
    }
    try {
      const query = String(req.body?.query || '').trim()
      if (!query) {
        return res.status(400).json({ error: 'query 不能为空' })
      }

      const scope = String(req.body?.scope || 'person').trim()
      // 使用更明确的判断，避免 topK=0 时意外使用默认值
      const topK = req.body?.topK != null ? Math.max(1, Number(req.body.topK)) : vectorConfig.defaultTopK

      // 1. 获取查询向量
      const startTime = Date.now()
      const queryVector = await getEmbedding(query)
      const embeddingTime = Date.now() - startTime

      if (!queryVector || queryVector.length === 0) {
        return res.status(500).json({ error: '无法获取查询向量' })
      }

      // 2. 执行向量搜索
      const searchStartTime = Date.now()
      const results = await mlVectorSearch(
        scope,
        queryVector,
        { topK, queryText: query },
        marklogicFetch,
        marklogicBaseUrl,
      )
      const searchTime = Date.now() - searchStartTime

      // 3. 获取更新后的缓存统计
      const cacheStats = getEmbeddingCacheStats()

      res.json({
        query,
        scope,
        vectorDimension: queryVector.length,
        timing: {
          embeddingMs: embeddingTime,
          searchMs: searchTime,
          totalMs: Date.now() - startTime,
        },
        cache: cacheStats,
        results: results.slice(0, topK),
        total: results.length,
      })
    } catch (error) {
      console.error('[VectorTest] 测试失败:', error)
      res.status(500).json({ error: error.message })
    }
  })
}

export default registerVectorRoutes
