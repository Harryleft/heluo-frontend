import { cacheConfig } from '../../bootstrap/config.js'

export function createSimpleCache(
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
