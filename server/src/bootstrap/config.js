/**
 * 统一配置入口
 *
 * 集中管理所有配置常量，支持：
 * - 环境变量覆盖
 * - 默认值配置
 * - 配置分组（服务、搜索、详情、缓存等）
 *
 * @module server/src/bootstrap/config
 */

// ============================================================================
// 服务基础配置
// ============================================================================

/**
 * 服务端口配置
 */
export const serverConfig = Object.freeze({
  /** HTTP 服务端口 */
  port: Number(process.env.PORT || 9011),
  /** 是否启用端口自动回退 */
  portAutoFallback: String(process.env.PORT_AUTO_FALLBACK || 'true').trim().toLowerCase() === 'true',
  /** 端口重试上限 */
  portRetryLimit: Number(process.env.PORT_RETRY_LIMIT || 10),
})

// ============================================================================
// MarkLogic 配置
// ============================================================================

/**
 * MarkLogic 数据库配置
 */
export const marklogicConfig = Object.freeze({
  /** MarkLogic 服务基础 URL */
  baseUrl: (process.env.MARKLOGIC_BASE_URL || 'http://127.0.0.1:8003').replace(/\/+$/, ''),
  /** 认证用户名 */
  user: process.env.MARKLOGIC_USER || 'admin',
  /** 认证密码 */
  password: process.env.MARKLOGIC_PASSWORD || 'admin',
  /** 摘要认证算法 */
  algorithm: 'MD5',
})

// ============================================================================
// 搜索配置
// ============================================================================

/**
 * 搜索模式配置
 */
export const searchConfig = Object.freeze({
  /** 搜索模式：keyword | vector | hybrid */
  mode: String(process.env.HELUO_SEARCH_MODE || 'keyword').trim(),
  /** 搜索范围查询超时（毫秒） */
  scopeTimeoutMs: Number(process.env.SEARCH_SCOPE_TIMEOUT_MS) || 15000,
  /** 是否仅返回 JSON-LD 格式 */
  jsonLdOnly: !['0', 'false', 'off'].includes(
    String(process.env.HELUO_JSONLD_ONLY || '1').trim().toLowerCase(),
  ),
  /** 是否启用旧版实体路径 */
  enableLegacyEntityPaths: !['0', 'false', 'off'].includes(
    String(process.env.HELUO_ENABLE_LEGACY_ENTITY_PATHS || '1').trim().toLowerCase(),
  ),
  /** Hybrid RRF 算法 K 参数 */
  hybridRrfK: Number(process.env.HYBRID_RRF_K) || 60,
})

// ============================================================================
// 向量搜索配置
// ============================================================================

/**
 * 向量搜索配置
 */
export const vectorConfig = Object.freeze({
  /** 是否启用向量搜索 */
  enabled: process.env.VECTOR_SEARCH_ENABLED !== 'false',
  /** 默认返回数量 */
  defaultTopK: 20,
  /** 相似度阈值 */
  similarityThreshold: 0.3,
  /** 向量维度（text2vec-base-chinese 为 768 维） */
  vectorDimension: 768,
  /** 向量搜索超时时间（毫秒）- 融合问答使用 */
  searchTimeoutMs: Number(process.env.VECTOR_SEARCH_TIMEOUT_MS) || 30000,
  /** 搜索时获取的候选文档数量 */
  candidatePoolSize: Number(process.env.VECTOR_CANDIDATE_POOL_SIZE) || 60,
  /** 基于关键词补充的候选池大小 */
  lexicalCandidatePoolSize: Number(process.env.VECTOR_LEXICAL_CANDIDATE_POOL_SIZE) || 80,
  /** 候选池上限 */
  maxCandidatePoolSize: Number(process.env.VECTOR_CANDIDATE_POOL_MAX_SIZE) || 600,
  /** MarkLogic 请求超时（毫秒） */
  requestTimeoutMs: Number(process.env.VECTOR_MARKLOGIC_TIMEOUT_MS) || 8000,
  /** 候选文档并发读取上限 */
  docFetchConcurrency: Number(process.env.VECTOR_DOC_FETCH_CONCURRENCY) || 12,
  /** 第二阶段重补查候选放大系数 */
  enrichTopKFactor: Number(process.env.VECTOR_ENRICH_TOPK_FACTOR) || 2,
  /** 第二阶段重补查候选上限 */
  enrichTopNMax: Number(process.env.VECTOR_ENRICH_TOPN_MAX) || 40,
  /** 向量索引路径映射 */
  indexPaths: {
    person: ['/processed/json-ld-vector/persons/'],
    poem: ['/processed/json-ld-vector/poems-set/', '/processed/json-ld-vector/poems-txt/'],
    book: ['/processed/json-ld-vector/books/'],
    ancient_book: ['/processed/json-ld-vector/ancient-books/'],
    place: ['/processed/json-ld-vector/places/'],
    concept: ['/processed/json-ld-vector/concepts/'],
    iiif: ['/processed/json-ld-vector/iiif/'],
  },
})

// ============================================================================
// 详情页配置
// ============================================================================

/**
 * 详情接口配置
 */
export const detailConfig = Object.freeze({
  /** 详情缓存 TTL（毫秒） */
  cacheTtlMs: 10 * 60 * 1000,
  /** 总预算时间（毫秒） */
  totalBudgetMs: 4000,
  /** 关联关系预算时间（毫秒） */
  relationBudgetMs: 1200,
  /** 向量推荐预算时间（毫秒） */
  vectorBudgetMs: 2200,
  /** 序列化预留时间（毫秒） */
  serializeReserveMs: 200,
  /** 向量文档并发数 */
  vectorDocConcurrency: 6,
})

// ============================================================================
// 缓存配置
// ============================================================================

/**
 * 缓存配置
 */
export const cacheConfig = Object.freeze({
  /** 详情缓存 TTL（毫秒）- 用于 getDetailUseCase */
  detailCacheTtlMs: Number(process.env.DETAIL_CACHE_TTL_MS) || 10 * 60 * 1000,
  /** 文档缓存 TTL（毫秒） */
  docCacheTtlMs: Number(process.env.VECTOR_DOC_CACHE_TTL_MS) || 60 * 1000,
  /** 文档缓存最大条目数 */
  docCacheMaxSize: Number(process.env.VECTOR_DOC_CACHE_MAX_SIZE) || 5000,
  /** 诗词详情缓存 TTL（毫秒） */
  poemInfoCacheTtlMs: Number(process.env.VECTOR_POEM_INFO_CACHE_TTL_MS) || 10 * 60 * 1000,
  /** 诗词详情缓存最大条目数 */
  poemInfoCacheMaxSize: Number(process.env.VECTOR_POEM_INFO_CACHE_MAX_SIZE) || 2000,
  /** 诗词全文缓存 TTL（毫秒） */
  poemTextCacheTtlMs: Number(process.env.VECTOR_POEM_TEXT_CACHE_TTL_MS) || 10 * 60 * 1000,
  /** 诗词全文缓存最大条目数 */
  poemTextCacheMaxSize: Number(process.env.VECTOR_POEM_TEXT_CACHE_MAX_SIZE) || 1000,
  /** 诗文分层配额（poems-set） */
  poemSetQuotaRatio: Number(process.env.VECTOR_POEM_SET_QUOTA_RATIO) || 0.4,
  /** 诗文分层配额（poems-txt） */
  poemTxtQuotaRatio: Number(process.env.VECTOR_POEM_TXT_QUOTA_RATIO) || 0.4,
})

// ============================================================================
// URL 重写配置
// ============================================================================

/**
 * URL 重写配置
 */
export const urlRewriteConfig = Object.freeze({
  /** 源站主机白名单 */
  sourceHosts: new Set(
    String(process.env.HELUO_SOURCE_HOSTS || 'api.heluo.site')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  ),
  /** 本地服务基础 URL */
  localBaseUrl: String(process.env.HELUO_LOCAL_BASE_URL || `http://127.0.0.1:${serverConfig.port}`).trim(),
  /** 是否禁用主机重写 */
  disableHostRewrite: String(process.env.HELUO_DISABLE_HOST_REWRITE || '').trim() === '1',
})

// ============================================================================
// 实体目录配置
// ============================================================================

/**
 * 实体目录路径配置
 */
export const entityDirectoryConfig = Object.freeze({
  person: {
    primary: ['/processed/json-ld/person/', '/data/processed/json-ld/person/'],
    legacy: ['/processed/entities/person/'],
  },
  poem: {
    primary: ['/processed/json-ld/poem/set/', '/data/processed/json-ld/poem/set/'],
    legacy: ['/processed/entities/poem/set/'],
  },
  book: {
    primary: ['/processed/json-ld/book/', '/data/processed/json-ld/book/'],
    legacy: ['/processed/entities/marc/'],
  },
  ancient_book: {
    primary: [
      '/processed/json-ld/ancient_book/ancient_book_set/book_entry/',
      '/processed/json-ld/ancient_book/ancient_book_txt/book/',
      '/data/processed/json-ld/ancient_book/ancient_book_set/book_entry/',
      '/data/processed/json-ld/ancient_book/ancient_book_txt/book/',
    ],
    legacy: ['/processed/entities/ancient_book/ancient_book_txt/book/'],
  },
  place: {
    primary: ['/processed/json-ld/place/', '/data/processed/json-ld/place/'],
    legacy: ['/processed/entities/place/'],
  },
  concept: {
    primary: ['/processed/json-ld/concept/', '/data/processed/json-ld/concept/'],
    legacy: ['/processed/entities/concept/', '/processed/concept/', '/processed/api/concept/'],
  },
  iiif: {
    primary: ['/processed/json-ld-vector/iiif/'],
    legacy: [],
  },
})

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取实体目录列表
 *
 * @param {string} scope - 实体类型
 * @param {object} options - 选项
 * @param {boolean} options.includeLegacy - 是否包含旧版路径
 * @returns {string[]} 目录路径数组
 */
export function getEntityDirectories(scope, options = {}) {
  const { includeLegacy = searchConfig.enableLegacyEntityPaths && !searchConfig.jsonLdOnly } = options
  const config = entityDirectoryConfig[String(scope || '').trim().toLowerCase()]
  if (!config) return []
  const dirs = [...config.primary]
  if (includeLegacy) dirs.push(...config.legacy)
  return dirs
}

/**
 * 判断是否为 JSON-LD 目录
 *
 * @param {string} value - 目录路径
 * @returns {boolean}
 */
export function isJsonLdDirectory(value) {
  const text = String(value || '').trim()
  return text.startsWith('/processed/json-ld/') ||
    text.startsWith('/data/processed/json-ld/') ||
    text.startsWith('/processed/json-ld-vector/')
}

// ============================================================================
// 统一配置对象
// ============================================================================

/**
 * 应用程序完整配置
 */
export const config = Object.freeze({
  server: serverConfig,
  marklogic: marklogicConfig,
  search: searchConfig,
  vector: vectorConfig,
  detail: detailConfig,
  cache: cacheConfig,
  urlRewrite: urlRewriteConfig,
  entityDirectory: entityDirectoryConfig,
})

export default config
