/**
 * 文本嵌入服务
 * 将文本转换为向量表示，用于语义搜索
 *
 * 本地版本：调用 bge-large-zh 模型服务
 * 模型路径：~/.cache/heluo/models/bge-large-zh
 */

import crypto from 'crypto'

// ========== 配置 ==========
const EMBEDDING_CONFIG = {
  // 模型服务地址（使用 127.0.0.1 避免 IPv6 问题）
  modelBaseUrl: process.env.EMBEDDING_SERVICE_URL || 'http://127.0.0.1:8080',
  // 模型名称
  modelName: 'text2vec-base-chinese',
  // 向量维度（text2vec-base-chinese 为 768 维）
  vectorDimension: 768,
  // 缓存配置
  cache: {
    enabled: process.env.EMBEDDING_CACHE_ENABLED !== 'false',
    maxSize: Number(process.env.EMBEDDING_CACHE_SIZE) || 10000,
    ttl: Number(process.env.EMBEDDING_CACHE_TTL) || 3600,
  },
  // 超时配置（毫秒）
  timeout: Number(process.env.EMBEDDING_TIMEOUT) || 5000,
}

// ========== 缓存实现 ==========
class EmbeddingCache {
  constructor(config) {
    this.cache = new Map()
    this.maxSize = config.maxSize
    this.ttl = config.ttl
    // 命中率统计
    this.hits = 0
    this.misses = 0
  }

  /**
   * 生成缓存键（使用组合策略降低碰撞概率）
   * 格式: 长度:前缀哈希:完整哈希
   */
  hash(text) {
    const len = text.length
    const prefix = len > 16 ? text.slice(0, 16) : text
    const prefixHash = crypto.createHash('md5').update(prefix).digest('hex').slice(0, 8)
    const fullHash = crypto.createHash('md5').update(text).digest('hex')
    return `${len}:${prefixHash}:${fullHash}`
  }

  /**
   * 获取缓存（LRU：访问时移动到末尾）
   */
  get(text) {
    const key = this.hash(text)
    const entry = this.cache.get(key)

    if (!entry) {
      this.misses++
      return null
    }

    // 检查过期
    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      this.misses++ // 过期也属于缓存未命中
      return null
    }

    // LRU：删除后重新插入，移动到末尾（最近使用）
    this.cache.delete(key)
    this.cache.set(key, entry)
    this.hits++
    return entry.vector
  }

  /**
   * 设置缓存
   */
  set(text, vector) {
    // LRU 淘汰：当达到最大容量时，删除最早的条目（Map 保持插入顺序）
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    const key = this.hash(text)
    this.cache.set(key, {
      vector,
      expiry: Date.now() + this.ttl * 1000,
    })
  }

  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  /**
   * 获取缓存统计（含命中率）
   */
  stats() {
    const total = this.hits + this.misses
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Number((this.hits / total).toFixed(4)) : 0,
    }
  }
}

// ========== 核心服务 ==========
class EmbeddingService {
  constructor(config = EMBEDDING_CONFIG) {
    this.config = config
    this.cache = new EmbeddingCache(config.cache)
    this.inFlight = new Map()
  }

  /**
   * 获取单个文本的嵌入向量
   * @param {string} text - 输入文本
   * @returns {Promise<number[]>} 嵌入向量（维度由配置决定，默认768维）
   */
  async getEmbedding(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('输入文本不能为空')
    }

    const trimmedText = text.trim()
    if (!trimmedText) {
      throw new Error('输入文本不能为空')
    }

    // 1. 检查缓存
    if (this.config.cache.enabled) {
      const cached = this.cache.get(trimmedText)
      if (cached) {
        return cached
      }
    }

    const pending = this.inFlight.get(trimmedText)
    if (pending) return pending

    // 2. 调用模型服务
    const task = this.callModelService([trimmedText])
      .then((vectors) => {
        if (this.config.cache.enabled && vectors[0]) {
          this.cache.set(trimmedText, vectors[0])
        }
        return vectors[0]
      })
      .finally(() => this.inFlight.delete(trimmedText))

    this.inFlight.set(trimmedText, task)
    return task
  }

  /**
   * 批量获取嵌入向量
   * @param {string[]} texts - 文本数组
   * @returns {Promise<number[][]>} 向量数组
   */
  async getEmbeddings(texts) {
    if (!Array.isArray(texts) || texts.length === 0) {
      return []
    }

    const results = new Array(texts.length)
    const toFetch = []
    const toFetchIndices = []

    // 1. 检查缓存
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i]?.trim()
      if (!text) {
        results[i] = null
        continue
      }

      if (this.config.cache.enabled) {
        const cached = this.cache.get(text)
        if (cached) {
          results[i] = cached
          continue
        }
      }

      toFetch.push(text)
      toFetchIndices.push(i)
    }

    // 2. 批量获取未缓存的向量
    if (toFetch.length > 0) {
      const vectors = await this.callModelService(toFetch)

      // 3. 存入缓存并填充结果
      for (let i = 0; i < toFetch.length; i++) {
        const vector = vectors[i]
        if (vector && this.config.cache.enabled) {
          this.cache.set(toFetch[i], vector)
        }
        results[toFetchIndices[i]] = vector
      }
    }

    return results
  }

  /**
   * 调用模型服务
   * @param {string[]} texts - 文本数组
   * @returns {Promise<number[][]>} 向量数组
   */
  async callModelService(texts) {
    // 使用 AbortController 实现超时控制
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const response = await fetch(`${this.config.modelBaseUrl}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: texts,
          model: this.config.modelName,
          normalize: true, // L2 归一化
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        throw new Error(`Embedding 服务错误: ${response.status} - ${errorText}`)
      }

      const data = await response.json()

      if (!data.embeddings || !Array.isArray(data.embeddings)) {
        throw new Error('Embedding 服务返回格式错误')
      }

      return data.embeddings
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Embedding 服务超时 (${this.config.timeout}ms)`)
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * 计算两个向量的余弦相似度
   * @param {number[]} vec1
   * @param {number[]} vec2
   * @returns {number} 相似度 (-1 到 1)
   */
  cosineSimilarity(vec1, vec2) {
    if (!Array.isArray(vec1) || !Array.isArray(vec2)) {
      return 0
    }
    if (vec1.length !== vec2.length) {
      return 0
    }

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i]
      norm1 += vec1[i] * vec1[i]
      norm2 += vec2[i] * vec2[i]
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2)
    if (denominator === 0) {
      return 0
    }

    return dotProduct / denominator
  }

  /**
   * 获取配置信息
   */
  getConfig() {
    return { ...this.config }
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.cache.stats()
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.cache.clear()
  }
}

// ========== 导出 ==========
const embeddingService = new EmbeddingService()

export { EmbeddingService, EmbeddingCache, EMBEDDING_CONFIG }

export const getEmbedding = (text) => embeddingService.getEmbedding(text)
export const getEmbeddings = (texts) => embeddingService.getEmbeddings(texts)
export const cosineSimilarity = (v1, v2) => embeddingService.cosineSimilarity(v1, v2)
export const getEmbeddingConfig = () => embeddingService.getConfig()
export const getEmbeddingCacheStats = () => embeddingService.getCacheStats()
export const clearEmbeddingCache = () => embeddingService.clearCache()

export default embeddingService
