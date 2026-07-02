/**
 * 缓存管理模块
 *
 * 统一管理各类数据缓存，基于 lru-cache 实现
 * 提供 TTL 过期、LRU 淘汰、缓存命中日志等功能
 *
 * @module server/src/utils/cacheManager
 */

import { LRUCache } from 'lru-cache'
import { createHash } from 'crypto'

// ============================================================================
// 缓存工厂函数
// ============================================================================

/**
 * 创建缓存实例
 *
 * @param {object} options - 缓存配置
 * @param {string} options.name - 缓存名称（用于日志）
 * @param {number} options.max - 最大条目数
 * @param {number} options.ttlMs - 过期时间（毫秒）
 * @returns {object} 缓存操作接口
 */
export function createCache({ name, max, ttlMs }) {
  const cache = new LRUCache({
    max,
    ttl: ttlMs,
    ttlAutopurge: true, // 自动清理过期条目
  })

  return {
    /**
     * 获取缓存值
     * @param {string} key - 缓存键
     * @returns {any} 缓存值或 undefined
     */
    get: (key) => cache.get(key),

    /**
     * 设置缓存值
     * @param {string} key - 缓存键
     * @param {any} value - 缓存值
     */
    set: (key, value) => cache.set(key, value),

    /**
     * 检查缓存是否存在
     * @param {string} key - 缓存键
     * @returns {boolean}
     */
    has: (key) => cache.has(key),

    /**
     * 删除缓存条目
     * @param {string} key - 缓存键
     * @returns {boolean} 是否删除成功
     */
    delete: (key) => cache.delete(key),

    /**
     * 清空缓存
     */
    clear: () => cache.clear(),

    /**
     * 获取当前缓存大小
     * @returns {number}
     */
    size: () => cache.size,

    /**
     * 带日志的获取（用于调试）
     * @param {string} key - 缓存键
     * @param {string} logPrefix - 日志前缀
     * @returns {any} 缓存值或 undefined
     */
    getWithLog: (key, logPrefix) => {
      const value = cache.get(key)
      if (value !== undefined) {
        console.log(`[${logPrefix}] 缓存命中: ${key}`)
      } else {
        console.log(`[${logPrefix}] 缓存未命中: ${key}`)
      }
      return value
    },

    /**
     * 获取缓存统计信息
     * @returns {object}
     */
    stats: () => ({
      name,
      size: cache.size,
      max,
      ttlMs,
    }),
  }
}

// ============================================================================
// 预定义缓存实例
// ============================================================================

/**
 * 地图轨迹数据缓存
 * - TTL: 30 分钟
 * - 最大条目: 500
 */
export const poemTrackCache = createCache({
  name: 'poem-track',
  max: 500,
  ttlMs: 30 * 60 * 1000,
})

/**
 * 融合查询结果缓存
 * - TTL: 10 分钟
 * - 最大条目: 500
 */
export const fusionQueryCache = createCache({
  name: 'fusion-query',
  max: 500,
  ttlMs: 10 * 60 * 1000,
})

/**
 * LLM 回答缓存
 * - TTL: 15 分钟
 * - 最大条目: 1000
 */
export const llmAnswerCache = createCache({
  name: 'llm-answer',
  max: 1000,
  ttlMs: 15 * 60 * 1000,
})

// ============================================================================
// 缓存键生成工具
// ============================================================================

/**
 * 生成缓存键的哈希值（使用 SHA256）
 *
 * @param {string} input - 输入字符串
 * @returns {string} 哈希值（16 字符十六进制）
 */
export function hashString(input) {
  return createHash('sha256')
    .update(String(input || ''))
    .digest('hex')
    .slice(0, 16)
}

/**
 * 生成地图轨迹缓存键
 *
 * @param {string} personId - 人物 ID
 * @returns {string} 缓存键
 */
export function makePoemTrackCacheKey(personId) {
  return `poem-track:${personId}`
}

/**
 * 生成融合查询缓存键
 *
 * @param {object} params - 查询参数
 * @param {string} params.query - 查询文本
 * @param {string} params.mode - 查询模式
 * @param {string[]} params.dims - 查询维度
 * @param {number} params.topK - 返回数量
 * @param {boolean} params.includeIiif - 是否包含 IIIF
 * @returns {string} 缓存键
 */
export function makeFusionQueryCacheKey({ query, mode, dims, topK, includeIiif }) {
  const normalizedQuery = String(query || '').trim().toLowerCase()
  const normalizedMode = String(mode || 'default')
  const sortedDims = [...(dims || [])].sort().join(',')
  const rawKey = `${normalizedQuery}|${normalizedMode}|${sortedDims}|${topK}|${includeIiif ? 1 : 0}`
  return `fusion:${hashString(rawKey)}`
}

/**
 * 生成 LLM 回答缓存键
 *
 * @param {object} params - 参数
 * @param {string} params.query - 查询文本
 * @param {Array} params.entityIds - 实体 ID 列表
 * @returns {string} 缓存键
 */
export function makeLlmAnswerCacheKey({ query, entityIds }) {
  const normalizedQuery = String(query || '').trim().toLowerCase()
  // 使用 | 分隔符并对每个 ID 进行 base64 编码，避免分隔符混淆
  const idsKey = [...(entityIds || [])]
    .sort()
    .map((id) => Buffer.from(String(id)).toString('base64'))
    .join('|')
  const rawKey = `${normalizedQuery}|${idsKey}`
  return `llm:${hashString(rawKey)}`
}

// ============================================================================
// 缓存装饰器（高阶函数）
// ============================================================================

/**
 * 为异步函数添加缓存层
 *
 * @param {object} cache - 缓存实例
 * @param {function} keyGenerator - 缓存键生成函数
 * @param {function} fn - 原始异步函数
 * @param {string} logPrefix - 日志前缀
 * @returns {function} 带缓存的异步函数
 */
export function withCache(cache, keyGenerator, fn, logPrefix = 'Cache') {
  return async (...args) => {
    const key = keyGenerator(...args)

    // 尝试从缓存获取
    const cached = cache.get(key)
    if (cached !== undefined) {
      console.log(`[${logPrefix}] 命中: ${key}`)
      return cached
    }

    console.log(`[${logPrefix}] 未命中: ${key}`)

    // 执行原始函数
    const result = await fn(...args)

    // 存入缓存
    if (result !== undefined && result !== null) {
      cache.set(key, result)
    }

    return result
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  createCache,
  poemTrackCache,
  fusionQueryCache,
  llmAnswerCache,
  hashString,
  makePoemTrackCacheKey,
  makeFusionQueryCacheKey,
  makeLlmAnswerCacheKey,
  withCache,
}
