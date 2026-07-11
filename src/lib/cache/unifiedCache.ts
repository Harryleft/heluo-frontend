/**
 * 统一缓存模块
 *
 * 设计目标：
 * - L1: 内存缓存（当前会话快速命中）
 * - L2: localStorage 持久缓存（跨刷新复用）
 * - TTL 过期控制
 * - 容量上限控制（按最近更新时间淘汰）
 */

// ============================================================================
// 类型定义
// ============================================================================

interface UnifiedCacheConfig {
  ttlMs: number
  maxEntries: number
  version: string
  storagePrefix?: string
}

interface CacheRecord<T> {
  value: T
  expiresAt: number
  updatedAt: number
}

interface UnifiedCacheClient<T> {
  get: (key: string) => T | undefined
  set: (key: string, value: T) => void
  remove: (key: string) => void
  clear: () => void
  stats: () => Readonly<UnifiedCacheStats>
}

interface UnifiedCacheStats {
  hits: number
  misses: number
  sets: number
  removals: number
  clears: number
  evictions: number
}

// ============================================================================
// 常量
// ============================================================================

const DEFAULT_STORAGE_PREFIX = 'heluo-cache'

// ============================================================================
// 私有工具函数
// ============================================================================

function safeClone<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (typeof value !== 'object') return value

  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null

  const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
  if (descriptor && 'value' in descriptor) {
    return descriptor.value as Storage | null
  }

  // Node 25 exposes an experimental localStorage getter that warns unless a
  // persistence file is configured. It is not browser storage and must not be
  // used by server-side rendering or node-based tests.
  const runtime = globalThis as typeof globalThis & {
    process?: { versions?: { node?: string } }
  }
  if (runtime.process?.versions?.node) return null

  return window.localStorage
}

function safeReadStorage(key: string): string | null {
  try {
    return getBrowserStorage()?.getItem(key) ?? null
  } catch {
    return null
  }
}

function safeWriteStorage(key: string, value: string): void {
  try {
    getBrowserStorage()?.setItem(key, value)
  } catch {
    // 存储不可用或配额不足时静默降级到内存缓存
  }
}

function safeRemoveStorage(key: string): void {
  try {
    getBrowserStorage()?.removeItem(key)
  } catch {
    // 忽略存储异常
  }
}

function listStorageKeysByPrefix(prefix: string): string[] {
  try {
    const storage = getBrowserStorage()
    if (!storage) return []
    const keys: string[] = []
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key && key.startsWith(prefix)) {
        keys.push(key)
      }
    }
    return keys
  } catch {
    return []
  }
}

function decodeStorageKey(prefix: string, storageKey: string): string {
  const raw = storageKey.slice(prefix.length)
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function encodeStorageKey(prefix: string, key: string): string {
  return `${prefix}${encodeURIComponent(key)}`
}

function parseRecord<T>(raw: string | null): CacheRecord<T> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CacheRecord<T>
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.expiresAt !== 'number' || typeof parsed.updatedAt !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

// ============================================================================
// 公共工厂函数
// ============================================================================

export function createUnifiedCache<T>(
  namespace: string,
  config: UnifiedCacheConfig,
): UnifiedCacheClient<T> {
  const safeNamespace = String(namespace || '').trim() || 'default'
  const storagePrefix = `${config.storagePrefix || DEFAULT_STORAGE_PREFIX}:${safeNamespace}:${config.version}:`
  const memory = new Map<string, CacheRecord<T>>()
  const metrics: UnifiedCacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    removals: 0,
    clears: 0,
    evictions: 0,
  }

  function removeExpired(now: number): void {
    for (const [key, record] of memory.entries()) {
      if (record.expiresAt <= now) {
        memory.delete(key)
      }
    }

    const storageKeys = listStorageKeysByPrefix(storagePrefix)
    storageKeys.forEach((storageKey) => {
      const raw = safeReadStorage(storageKey)
      const record = parseRecord<T>(raw)
      if (!record || record.expiresAt <= now) {
        safeRemoveStorage(storageKey)
      }
    })
  }

  function enforceCapacity(): void {
    const candidates: Array<{ key: string; updatedAt: number }> = []

    for (const [key, record] of memory.entries()) {
      candidates.push({ key, updatedAt: record.updatedAt })
    }

    const storageKeys = listStorageKeysByPrefix(storagePrefix)
    storageKeys.forEach((storageKey) => {
      const raw = safeReadStorage(storageKey)
      const record = parseRecord<T>(raw)
      if (!record) {
        safeRemoveStorage(storageKey)
        return
      }
      const logicalKey = decodeStorageKey(storagePrefix, storageKey)
      candidates.push({ key: logicalKey, updatedAt: record.updatedAt })
    })

    // 合并去重（取更新时间更近的一条）
    const deduped = new Map<string, number>()
    candidates.forEach((item) => {
      const current = deduped.get(item.key) || 0
      if (item.updatedAt > current) {
        deduped.set(item.key, item.updatedAt)
      }
    })

    if (deduped.size <= config.maxEntries) return

    const sorted = Array.from(deduped.entries())
      .map(([key, updatedAt]) => ({ key, updatedAt }))
      .sort((a, b) => a.updatedAt - b.updatedAt)

    const removeCount = Math.max(0, sorted.length - config.maxEntries)
    for (let i = 0; i < removeCount; i += 1) {
      const key = sorted[i].key
      memory.delete(key)
      safeRemoveStorage(encodeStorageKey(storagePrefix, key))
      metrics.evictions += 1
    }
  }

  function get(key: string): T | undefined {
    const normalizedKey = String(key || '').trim()
    if (!normalizedKey) return undefined

    const now = Date.now()
    const memRecord = memory.get(normalizedKey)
    if (memRecord) {
      if (memRecord.expiresAt <= now) {
        memory.delete(normalizedKey)
      } else {
        metrics.hits += 1
        return safeClone(memRecord.value)
      }
    }

    const storageKey = encodeStorageKey(storagePrefix, normalizedKey)
    const raw = safeReadStorage(storageKey)
    const storageRecord = parseRecord<T>(raw)
    if (!storageRecord) {
      safeRemoveStorage(storageKey)
      metrics.misses += 1
      return undefined
    }
    if (storageRecord.expiresAt <= now) {
      safeRemoveStorage(storageKey)
      metrics.misses += 1
      return undefined
    }

    memory.set(normalizedKey, storageRecord)
    metrics.hits += 1
    return safeClone(storageRecord.value)
  }

  function set(key: string, value: T): void {
    const normalizedKey = String(key || '').trim()
    if (!normalizedKey) return

    metrics.sets += 1
    const now = Date.now()
    removeExpired(now)

    const record: CacheRecord<T> = {
      value: safeClone(value),
      expiresAt: now + config.ttlMs,
      updatedAt: now,
    }

    memory.set(normalizedKey, record)
    safeWriteStorage(encodeStorageKey(storagePrefix, normalizedKey), JSON.stringify(record))
    enforceCapacity()
  }

  function remove(key: string): void {
    const normalizedKey = String(key || '').trim()
    if (!normalizedKey) return
    metrics.removals += 1
    memory.delete(normalizedKey)
    safeRemoveStorage(encodeStorageKey(storagePrefix, normalizedKey))
  }

  function clear(): void {
    metrics.clears += 1
    memory.clear()
    const storageKeys = listStorageKeysByPrefix(storagePrefix)
    storageKeys.forEach((storageKey) => safeRemoveStorage(storageKey))
  }

  function stats(): Readonly<UnifiedCacheStats> {
    return { ...metrics }
  }

  return {
    get,
    set,
    remove,
    clear,
    stats,
  }
}
