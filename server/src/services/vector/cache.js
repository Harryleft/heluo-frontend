/**
 * 向量服务使用的轻量 TTL 缓存
 */

export function createTtlCache(maxSize = 1000, ttlMs = 60 * 1000) {
  const storage = new Map()
  const safeMaxSize = Math.max(100, Number(maxSize) || 1000)
  const safeTtlMs = Math.max(1000, Number(ttlMs) || 60 * 1000)

  const get = (key) => {
    const entry = storage.get(key)
    if (!entry) return undefined
    if (entry.expiredAt <= Date.now()) {
      storage.delete(key)
      return undefined
    }
    return entry.value
  }

  const set = (key, value) => {
    if (storage.size >= safeMaxSize) {
      const oldestKey = storage.keys().next().value
      if (oldestKey) storage.delete(oldestKey)
    }
    storage.set(key, {
      value,
      expiredAt: Date.now() + safeTtlMs,
    })
  }

  return { get, set }
}
