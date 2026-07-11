/**
 * 向量搜索配置
 */

const VECTOR_CONFIG = {
  // 向量索引路径映射（每个实体类型可能对应多个向量路径）
  indexPaths: {
    person: ['/processed/vector/person/'],
    poem: ['/processed/vector/poem/set/', '/processed/vector/poem/text/'],
    book: ['/processed/vector/book/'],
    ancient_book: [
      '/processed/vector/ancient-book/set/',
      '/processed/vector/ancient-book/object/',
      '/processed/vector/ancient-book/text/',
      '/processed/vector/ancient-book/concept/',
    ],
    place: ['/processed/vector/place/'],
    concept: [
      '/processed/vector/concept/poetic-form/',
      '/processed/vector/concept/rhyme/',
    ],
    iiif: ['/processed/vector/iiif/'],
  },
  // 默认返回数量
  defaultTopK: 20,
  // 相似度阈值
  similarityThreshold: 0.3,
  // 向量维度（text2vec-base-chinese 为 768 维）
  vectorDimension: 768,
  // 是否启用向量搜索
  enabled: process.env.VECTOR_SEARCH_ENABLED !== 'false',
  // 搜索时获取的候选文档数量（用于计算相似度）
  candidatePoolSize: Number(process.env.VECTOR_CANDIDATE_POOL_SIZE) || 60,
  // 基于关键词补充的候选池大小
  lexicalCandidatePoolSize: Number(process.env.VECTOR_LEXICAL_CANDIDATE_POOL_SIZE) || 80,
  // 候选池上限，避免极端参数导致过载
  maxCandidatePoolSize: Number(process.env.VECTOR_CANDIDATE_POOL_MAX_SIZE) || 600,
  // MarkLogic 请求超时（毫秒）
  requestTimeoutMs: Number(process.env.VECTOR_MARKLOGIC_TIMEOUT_MS) || 8000,
  // 候选文档并发读取上限
  docFetchConcurrency: Number(process.env.VECTOR_DOC_FETCH_CONCURRENCY) || 12,
  // 第二阶段重补查候选放大系数（相对 topK）
  enrichTopKFactor: Number(process.env.VECTOR_ENRICH_TOPK_FACTOR) || 2,
  // 第二阶段重补查候选上限
  enrichTopNMax: Number(process.env.VECTOR_ENRICH_TOPN_MAX) || 40,
  // 文档缓存配置
  docCacheTtlMs: Number(process.env.VECTOR_DOC_CACHE_TTL_MS) || 60 * 1000,
  docCacheMaxSize: Number(process.env.VECTOR_DOC_CACHE_MAX_SIZE) || 5000,
  // 诗词详情缓存配置
  poemInfoCacheTtlMs: Number(process.env.VECTOR_POEM_INFO_CACHE_TTL_MS) || 10 * 60 * 1000,
  poemInfoCacheMaxSize: Number(process.env.VECTOR_POEM_INFO_CACHE_MAX_SIZE) || 2000,
  // 诗词全文缓存配置
  poemTextCacheTtlMs: Number(process.env.VECTOR_POEM_TEXT_CACHE_TTL_MS) || 10 * 60 * 1000,
  poemTextCacheMaxSize: Number(process.env.VECTOR_POEM_TEXT_CACHE_MAX_SIZE) || 1000,
  // 诗文分层配额（poem/set / poem/text）
  poemSetQuotaRatio: Number(process.env.VECTOR_POEM_SET_QUOTA_RATIO) || 0.4,
  poemTxtQuotaRatio: Number(process.env.VECTOR_POEM_TXT_QUOTA_RATIO) || 0.4,
}

export { VECTOR_CONFIG }
