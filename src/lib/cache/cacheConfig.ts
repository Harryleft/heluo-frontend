/**
 * 前端统一缓存配置
 *
 * 将业务缓存的版本、TTL、容量集中管理，避免多处硬编码。
 */

export const FRONTEND_CACHE_VERSION = 'v1'

export const FRONTEND_CACHE_TEST_MODE_ENABLED = import.meta.env.MODE !== 'test'

export const FRONTEND_CACHE_CONFIG = {
  searchResults: {
    namespace: 'search-results',
    ttlMs: 10 * 60 * 1000,
    maxEntries: 240,
  },
  relatedResources: {
    namespace: 'related-resources',
    ttlMs: 15 * 60 * 1000,
    maxEntries: 240,
  },
  personAiIntro: {
    namespace: 'person-ai-intro',
    ttlMs: 60 * 60 * 1000,
    maxEntries: 180,
  },
  poemAiAnalysis: {
    namespace: 'poem-ai-analysis',
    ttlMs: 60 * 60 * 1000,
    maxEntries: 180,
  },
  poemTrack: {
    namespace: 'poem-track',
    ttlMs: 30 * 60 * 1000,
    maxEntries: 120,
  },
} as const
