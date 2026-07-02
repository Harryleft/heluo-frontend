/**
 * Embedding 缓存服务测试
 * @vitest-environment node
 */

import { describe, expect, it, beforeEach, vi } from 'vitest'
import { EmbeddingCache, EmbeddingService, EMBEDDING_CONFIG } from '../../../server/src/services/embeddingService.js'

// Mock crypto 模块以控制哈希行为（确保不同文本产生不同哈希）
vi.mock('crypto', () => ({
  default: {
    createHash: () => {
      let hashInput = ''
      return {
        update: (text: string) => {
          hashInput = text
          return {
            digest: () => {
              // 为不同输入产生不同哈希，使用简单哈希算法
              let hash = 0
              for (let i = 0; i < hashInput.length; i++) {
                const char = hashInput.charCodeAt(i)
                hash = ((hash << 5) - hash) + char
                hash = hash & hash
              }
              return Math.abs(hash).toString(16).padStart(32, '0')
            }
          }
        }
      }
    }
  }
}))

describe('EmbeddingCache', () => {
  let cache: InstanceType<typeof EmbeddingCache>

  beforeEach(() => {
    cache = new EmbeddingCache({ maxSize: 100, ttl: 3600 })
  })

  describe('基本功能', () => {
    it('应该能设置和获取缓存', () => {
      const vector = [0.1, 0.2, 0.3]
      cache.set('test-text', vector)
      const result = cache.get('test-text')
      expect(result).toEqual(vector)
    })

    it('不存在的缓存应返回 null', () => {
      const result = cache.get('non-existent')
      expect(result).toBeNull()
    })

    it('应该能清空缓存', () => {
      cache.set('text1', [0.1])
      cache.set('text2', [0.2])
      cache.clear()
      expect(cache.get('text1')).toBeNull()
      expect(cache.get('text2')).toBeNull()
    })
  })

  describe('LRU 淘汰策略', () => {
    it('应该在达到最大容量时淘汰最早的条目', () => {
      const smallCache = new EmbeddingCache({ maxSize: 3, ttl: 3600 })

      smallCache.set('text1', [1])
      smallCache.set('text2', [2])
      smallCache.set('text3', [3])
      smallCache.set('text4', [4]) // 应该淘汰 text1

      expect(smallCache.get('text1')).toBeNull()
      expect(smallCache.get('text2')).toEqual([2])
      expect(smallCache.get('text3')).toEqual([3])
      expect(smallCache.get('text4')).toEqual([4])
    })

    it('应该在访问时更新 LRU 顺序', () => {
      const smallCache = new EmbeddingCache({ maxSize: 3, ttl: 3600 })

      smallCache.set('text1', [1])
      smallCache.set('text2', [2])
      smallCache.set('text3', [3])

      // 访问 text1，使其变为最近使用
      smallCache.get('text1')

      // 添加新条目，应该淘汰 text2（而不是 text1）
      smallCache.set('text4', [4])

      expect(smallCache.get('text1')).toEqual([1]) // text1 仍存在
      expect(smallCache.get('text2')).toBeNull() // text2 被淘汰
    })
  })

  describe('命中率统计', () => {
    it('应该正确统计命中次数', () => {
      cache.set('text1', [0.1])
      cache.get('text1') // hit
      cache.get('text1') // hit

      const stats = cache.stats()
      expect(stats.hits).toBe(2)
    })

    it('应该正确统计未命中次数', () => {
      cache.get('text1') // miss
      cache.get('text2') // miss

      const stats = cache.stats()
      expect(stats.misses).toBe(2)
    })

    it('hitRate 应该返回数字类型', () => {
      cache.set('text1', [0.1])
      cache.get('text1') // hit
      cache.get('text2') // miss

      const stats = cache.stats()
      expect(typeof stats.hitRate).toBe('number')
      expect(stats.hitRate).toBe(0.5)
    })

    it('当 total 为 0 时 hitRate 应该返回 0', () => {
      const stats = cache.stats()
      expect(stats.hitRate).toBe(0)
      expect(typeof stats.hitRate).toBe('number')
    })

    it('应该正确计算高命中率', () => {
      cache.set('text1', [0.1])
      cache.get('text1') // hit
      cache.get('text1') // hit
      cache.get('text1') // hit
      cache.get('text2') // miss

      const stats = cache.stats()
      expect(stats.hitRate).toBe(0.75)
    })
  })

  describe('TTL 过期', () => {
    it('应该在 TTL 过期后返回 null 并计数 miss', async () => {
      const shortTTLCache = new EmbeddingCache({ maxSize: 100, ttl: 1 }) // 1秒

      shortTTLCache.set('text1', [0.1])

      // 验证设置成功
      expect(shortTTLCache.get('text1')).toEqual([0.1])
      expect(shortTTLCache.stats().hits).toBe(1)

      // 等待 TTL 过期
      await new Promise(resolve => setTimeout(resolve, 1100))

      // 过期后应该返回 null 并计数 miss
      expect(shortTTLCache.get('text1')).toBeNull()
      const stats = shortTTLCache.stats()
      expect(stats.misses).toBe(1)
    })

    it('未过期的缓存应该正常返回', () => {
      cache.set('text1', [0.1])
      // 立即获取，不应过期
      expect(cache.get('text1')).toEqual([0.1])
    })
  })

  describe('清空统计', () => {
    it('清空缓存时应该重置统计数据', () => {
      cache.set('text1', [0.1])
      cache.get('text1') // hit
      cache.get('text2') // miss

      cache.clear()

      const stats = cache.stats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.hitRate).toBe(0)
      expect(stats.size).toBe(0)
    })
  })

  describe('stats() 返回值完整性', () => {
    it('应该返回所有统计字段', () => {
      cache.set('text1', [0.1])
      cache.get('text1')

      const stats = cache.stats()
      expect(stats).toHaveProperty('size')
      expect(stats).toHaveProperty('maxSize')
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('misses')
      expect(stats).toHaveProperty('hitRate')
    })
  })
})

describe('EmbeddingService', () => {
  describe('配置验证', () => {
    it('默认配置应该合理', () => {
      expect(EMBEDDING_CONFIG.vectorDimension).toBe(768)
      expect(EMBEDDING_CONFIG.cache.enabled).toBe(true)
      expect(EMBEDDING_CONFIG.cache.maxSize).toBe(10000)
      expect(EMBEDDING_CONFIG.cache.ttl).toBe(3600)
      expect(EMBEDDING_CONFIG.timeout).toBe(5000)
    })
  })

  describe('输入验证', () => {
    let service: EmbeddingService

    beforeEach(() => {
      // 创建禁用缓存的服务实例以隔离测试
      service = new EmbeddingService({
        ...EMBEDDING_CONFIG,
        cache: { enabled: false, maxSize: 0, ttl: 0 },
      })
    })

    it('应该拒绝空字符串', async () => {
      await expect(service.getEmbedding('')).rejects.toThrow('输入文本不能为空')
    })

    it('应该拒绝只有空白字符的字符串', async () => {
      await expect(service.getEmbedding('   ')).rejects.toThrow('输入文本不能为空')
    })

    it('应该拒绝 null/undefined', async () => {
      await expect(service.getEmbedding(null as unknown as string)).rejects.toThrow()
      await expect(service.getEmbedding(undefined as unknown as string)).rejects.toThrow()
    })
  })

  describe('cosineSimilarity', () => {
    let service: EmbeddingService

    beforeEach(() => {
      service = new EmbeddingService()
    })

    it('应该正确计算相同向量的相似度', () => {
      const vec = [1, 0, 0]
      expect(service.cosineSimilarity(vec, vec)).toBe(1)
    })

    it('应该正确计算正交向量的相似度', () => {
      expect(service.cosineSimilarity([1, 0, 0], [0, 1, 0])).toBe(0)
    })

    it('应该正确计算相反向量的相似度', () => {
      expect(service.cosineSimilarity([1, 0, 0], [-1, 0, 0])).toBe(-1)
    })

    it('应该对非数组输入返回 0', () => {
      expect(service.cosineSimilarity(null as unknown as number[], [1])).toBe(0)
      expect(service.cosineSimilarity([1], null as unknown as number[])).toBe(0)
    })

    it('应该对不同长度向量返回 0', () => {
      expect(service.cosineSimilarity([1, 2], [1])).toBe(0)
    })
  })
})
