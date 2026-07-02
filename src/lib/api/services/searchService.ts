/**
 * 搜索服务层
 *
 * 提供统一的搜索功能，包括：
 * - 统一搜索（跨类型）
 * - 多维度搜索（并行）
 * - 融合查询（RAG/GraphRAG）
 * - 相关资源搜索（带缓存、降级、可用性校验）
 */

import type {
  FusionModeV1,
  FusionQueryApiResponse,
  FusionQueryParamsV1,
  ResourceType,
  SearchModeV1,
  SearchResultItemV1,
  UnifiedSearchParamsV1,
  UnifiedSearchApiResponse,
} from '@/types/contracts/apiContracts'
import { queryFusionRepo, searchUnifiedRepo, fetchPersonByIdRepo } from '@/lib/api/repositories/v1Repository'
import { buildDetailsRouteFromUri } from '@/lib/url/heluoUrl'
import { FRONTEND_CACHE_CONFIG, FRONTEND_CACHE_VERSION } from '@/lib/cache/cacheConfig'
import { createUnifiedCache } from '@/lib/cache/unifiedCache'

// ============================================================================
// 常量定义
// ============================================================================

const EMPTY_QUERY_FALLBACK = '*'

const RELATED_RESOURCE_VECTOR_MODE: SearchModeV1 = 'vector'
const RELATED_RESOURCE_KEYWORD_MODE: SearchModeV1 = 'keyword'
const RELATED_RESOURCE_PAGE = 1
const RELATED_RESOURCE_PAGE_SIZE = 6
const UNTITLED_ENTRY = '未命名条目'

const TYPE_LABELS: Record<string, string> = {
  person: '人物',
  poem: '诗文',
  book: '图书',
  ancient_book: '古籍',
  place: '地点',
  concept: '概念',
}

// ============================================================================
// 相关资源缓存 — 基于 createUnifiedCache + in-flight 去重
// ============================================================================

const relatedResourceCache = createUnifiedCache<UnifiedSearchApiResponse>(
  FRONTEND_CACHE_CONFIG.relatedResources.namespace,
  {
    ttlMs: FRONTEND_CACHE_CONFIG.relatedResources.ttlMs,
    maxEntries: FRONTEND_CACHE_CONFIG.relatedResources.maxEntries,
    version: FRONTEND_CACHE_VERSION,
  },
)

const relatedResourceInFlight = new Map<string, Promise<UnifiedSearchApiResponse>>()

function buildRelatedResourceCacheKey(
  query: string,
  type: string | undefined,
  mode: SearchModeV1 | undefined,
  pagination?: Pick<UnifiedSearchParamsV1, 'page' | 'pageSize'>,
): string {
  const page = pagination?.page || RELATED_RESOURCE_PAGE
  const pageSize = pagination?.pageSize || RELATED_RESOURCE_PAGE_SIZE
  return JSON.stringify({
    query: String(query || '').trim(),
    type: type || '',
    mode: mode || '',
    page,
    pageSize,
  })
}

function getRelatedResourceCache(key: string): UnifiedSearchApiResponse | undefined {
  return relatedResourceCache.get(key)
}

function setRelatedResourceCache(key: string, response: UnifiedSearchApiResponse): void {
  if (!hasRelatedItems(response)) return
  relatedResourceCache.set(key, response)
}

// ============================================================================
// 私有实现 - 参数归一化
// ============================================================================

function normalizeSearchQuery(query: string): string {
  const normalized = String(query || '').trim()
  return normalized || EMPTY_QUERY_FALLBACK
}

function normalizeSearchType(type?: string): string | undefined {
  const normalized = String(type || '').trim()
  return normalized || undefined
}

function normalizeSearchMode(mode?: SearchModeV1): SearchModeV1 | undefined {
  const normalized = String(mode || '').trim() as SearchModeV1
  if (normalized === 'keyword' || normalized === 'vector' || normalized === 'hybrid') {
    return normalized
  }
  return undefined
}

function normalizeSearchPagination(
  pagination?: Pick<UnifiedSearchParamsV1, 'page' | 'pageSize'>,
): Pick<UnifiedSearchParamsV1, 'page' | 'pageSize'> | undefined {
  const page = Number.isFinite(Number(pagination?.page)) ? Math.max(1, Math.floor(Number(pagination?.page))) : undefined
  const pageSize = Number.isFinite(Number(pagination?.pageSize))
    ? Math.max(1, Math.floor(Number(pagination?.pageSize)))
    : undefined

  if (!page && !pageSize) return undefined
  return {
    ...(page && { page }),
    ...(pageSize && { pageSize }),
  }
}

function normalizeFusionDims(dims?: ResourceType[]): ResourceType[] | undefined {
  if (!Array.isArray(dims) || dims.length === 0) return undefined
  return dims.map((dim) => String(dim || '').trim() as ResourceType).filter(Boolean)
}

function normalizeFusionMode(mode?: FusionModeV1): FusionModeV1 {
  return mode || 'hybrid'
}

// ============================================================================
// 私有实现 - 相关资源 URI 解析
// ============================================================================

function normalizeUri(value: string): string {
  return String(value || '').trim().toLowerCase()
}

function extractUriId(uri: string): string {
  const normalized = String(uri || '').trim()
  if (!normalized) return ''
  const lastSegment = normalized.split('/').pop() || ''
  let id = lastSegment.replace(/\.json$/i, '').trim()

  if (normalized.includes('/person/') || normalized.includes('/persons/')) {
    id = id.replace(/^person_/i, '')
  }

  return id
}

function inferTypeByUri(uri: string): string {
  const normalized = normalizeUri(uri)
  if (normalized.includes('/person/')) return 'person'
  if (normalized.includes('/poem/')) return 'poem'
  if (normalized.includes('/marc/') || normalized.includes('/book/')) return 'book'
  if (normalized.includes('/ancient_book') || normalized.includes('/ancient-book')) return 'ancient_book'
  if (normalized.includes('/place/')) return 'place'
  if (normalized.includes('/concept/') || normalized.includes('/rhyme/') || normalized.includes('/poetic_form/')) return 'concept'
  return ''
}

function isSupportedDetailUri(uri: string): boolean {
  const normalized = String(uri || '').trim()
  if (!normalized) return false
  return Boolean(buildDetailsRouteFromUri(normalized))
}

function resolveItemTitle(item: SearchResultItemV1): string {
  const rawTitle = String(item.title || '').trim()
  if (rawTitle && rawTitle !== UNTITLED_ENTRY) return rawTitle

  const inferredType = inferTypeByUri(item.uri)
  const typeLabel = TYPE_LABELS[inferredType] || TYPE_LABELS[item.type] || '资源'
  const uriId = extractUriId(item.uri)
  return uriId ? `${typeLabel} ${uriId}` : typeLabel
}

function normalizeRelatedSearchItems(items: SearchResultItemV1[]): SearchResultItemV1[] {
  const deduplicated = new Map<string, SearchResultItemV1>()
  for (const item of items || []) {
    const uri = String(item?.uri || '').trim()
    if (!isSupportedDetailUri(uri)) continue

    const normalizedUri = normalizeUri(uri)
    if (!normalizedUri || deduplicated.has(normalizedUri)) continue

    deduplicated.set(normalizedUri, {
      ...item,
      title: resolveItemTitle(item),
    })
  }
  return Array.from(deduplicated.values())
}

function hasRelatedItems(response: UnifiedSearchApiResponse): boolean {
  return Boolean(response.success && response.data.items && response.data.items.length > 0)
}

// ============================================================================
// 私有实现 - 相关资源搜索条件判断
// ============================================================================

function shouldNormalizeRelatedSearch(
  type: string | undefined,
  mode: SearchModeV1 | undefined,
  pagination?: Pick<UnifiedSearchParamsV1, 'page' | 'pageSize'>,
): boolean {
  if (type) return false
  if (mode !== RELATED_RESOURCE_VECTOR_MODE) return false
  const page = pagination?.page || RELATED_RESOURCE_PAGE
  const pageSize = pagination?.pageSize || 0
  return page === RELATED_RESOURCE_PAGE && pageSize === RELATED_RESOURCE_PAGE_SIZE
}

function normalizeRelatedSearchResponse(
  response: UnifiedSearchApiResponse,
  type: string | undefined,
  mode: SearchModeV1 | undefined,
  pagination?: Pick<UnifiedSearchParamsV1, 'page' | 'pageSize'>,
): UnifiedSearchApiResponse {
  if (!response.success) return response
  if (!shouldNormalizeRelatedSearch(type, mode, pagination)) return response

  return {
    ...response,
    data: {
      ...response.data,
      items: normalizeRelatedSearchItems(response.data.items || []),
    },
  }
}

function normalizeResponseItemsAsRelated(response: UnifiedSearchApiResponse): UnifiedSearchApiResponse {
  if (!response.success) return response
  return {
    ...response,
    data: {
      ...response.data,
      items: normalizeRelatedSearchItems(response.data.items || []),
    },
  }
}

// ============================================================================
// 私有实现 - 相关资源搜索降级
// ============================================================================

function buildFallbackRelatedQuery(query: string): string {
  const normalized = String(query || '').trim()
  if (!normalized) return ''

  const sentenceHead = normalized.split(/[，,。！？!?；;\n]/)[0]?.trim() || ''
  if (sentenceHead && sentenceHead !== normalized) {
    return sentenceHead
  }

  const segments = normalized.split(/\s+/).filter(Boolean)
  if (segments.length > 1) {
    return segments[0]
  }

  return ''
}

async function markUnavailableRelatedItems(items: SearchResultItemV1[]): Promise<SearchResultItemV1[]> {
  const personExistsCache = new Map<string, boolean>()

  const results = await Promise.all(
    (items || []).map(async (item) => {
      const inferredType = inferTypeByUri(item.uri)
      if (inferredType !== 'person') {
        return { ...item, available: true }
      }

      const personId = extractUriId(item.uri)
      if (!personId) {
        return { ...item, available: false }
      }

      if (personExistsCache.has(personId)) {
        return { ...item, available: personExistsCache.get(personId) || false }
      }

      try {
        const response = await fetchPersonByIdRepo(personId)
        const exists = Boolean(response.success)
        personExistsCache.set(personId, exists)
        return { ...item, available: exists }
      } catch {
        personExistsCache.set(personId, false)
        return { ...item, available: false }
      }
    }),
  )

  return results
}

async function enforceRelatedItemAvailability(response: UnifiedSearchApiResponse): Promise<UnifiedSearchApiResponse> {
  if (!response.success) return response
  return {
    ...response,
    data: {
      ...response.data,
      items: await markUnavailableRelatedItems(response.data.items || []),
    },
  }
}

async function searchRelatedWithFallback(
  query: string,
  normalizedType: string | undefined,
  normalizedMode: SearchModeV1 | undefined,
  normalizedPagination?: Pick<UnifiedSearchParamsV1, 'page' | 'pageSize'>,
): Promise<UnifiedSearchApiResponse> {
  const response = await searchUnifiedService(
    query,
    normalizedType,
    normalizedMode,
    normalizedPagination,
  )
  let normalizedResponse = normalizeRelatedSearchResponse(response, normalizedType, normalizedMode, normalizedPagination)
  normalizedResponse = await enforceRelatedItemAvailability(normalizedResponse)

  if (hasRelatedItems(normalizedResponse)) {
    return normalizedResponse
  }

  const fallbackQuery = buildFallbackRelatedQuery(query)
  if (fallbackQuery) {
    const fallbackResponse = await searchUnifiedService(
      fallbackQuery,
      normalizedType,
      normalizedMode,
      normalizedPagination,
    )
    let normalizedFallback = normalizeRelatedSearchResponse(
      fallbackResponse,
      normalizedType,
      normalizedMode,
      normalizedPagination,
    )
    normalizedFallback = await enforceRelatedItemAvailability(normalizedFallback)
    if (hasRelatedItems(normalizedFallback)) {
      return normalizedFallback
    }
  }

  const keywordSeedQuery = fallbackQuery || String(query || '').trim()
  if (keywordSeedQuery) {
    const keywordFallbackResponse = await searchUnifiedService(
      keywordSeedQuery,
      'person',
      RELATED_RESOURCE_KEYWORD_MODE,
      { page: RELATED_RESOURCE_PAGE, pageSize: RELATED_RESOURCE_PAGE_SIZE },
    )
    let normalizedKeywordFallback = normalizeResponseItemsAsRelated(keywordFallbackResponse)
    normalizedKeywordFallback = await enforceRelatedItemAvailability(normalizedKeywordFallback)
    if (hasRelatedItems(normalizedKeywordFallback)) {
      return normalizedKeywordFallback
    }
  }

  return normalizedResponse
}

// ============================================================================
// 私有实现 - 错误处理
// ============================================================================

function createDimErrorResponse(dim: string, reason: unknown): UnifiedSearchApiResponse {
  return {
    success: false,
    error: {
      code: 'UPSTREAM_ERROR',
      message: `维度 ${dim} 检索失败：${String(reason)}`,
      details: { dim },
    },
  }
}

// ============================================================================
// 公共 API
// ============================================================================

/** 统一搜索服务 */
export async function searchUnifiedService(
  query: string,
  type?: string,
  mode?: SearchModeV1,
  pagination?: Pick<UnifiedSearchParamsV1, 'page' | 'pageSize'>,
): Promise<UnifiedSearchApiResponse> {
  const normalizedQuery = normalizeSearchQuery(query)

  if (pagination !== undefined) {
    return searchUnifiedRepo(normalizedQuery, type, mode, pagination)
  }
  if (mode !== undefined) {
    return searchUnifiedRepo(normalizedQuery, type, mode)
  }
  if (type !== undefined) {
    return searchUnifiedRepo(normalizedQuery, type)
  }
  return searchUnifiedRepo(normalizedQuery)
}

/** 相关资源搜索（带缓存 + 降级 + 可用性校验） */
export async function searchRelatedResourcesService(
  query: string,
  type?: string,
  mode?: SearchModeV1,
  pagination?: Pick<UnifiedSearchParamsV1, 'page' | 'pageSize'>,
): Promise<UnifiedSearchApiResponse> {
  const normalizedType = normalizeSearchType(type)
  const normalizedMode = normalizeSearchMode(mode)
  const normalizedPagination = normalizeSearchPagination(pagination)

  if (!shouldNormalizeRelatedSearch(normalizedType, normalizedMode, normalizedPagination)) {
    const response = await searchUnifiedService(query, normalizedType, normalizedMode, normalizedPagination)
    return normalizeRelatedSearchResponse(response, normalizedType, normalizedMode, normalizedPagination)
  }

  const cacheKey = buildRelatedResourceCacheKey(query, normalizedType, normalizedMode, normalizedPagination)
  const cachedResponse = getRelatedResourceCache(cacheKey)
  if (cachedResponse) {
    return cachedResponse
  }

  const inFlight = relatedResourceInFlight.get(cacheKey)
  if (inFlight) {
    return inFlight
  }

  const task = (async () => {
    const relatedResponse = await searchRelatedWithFallback(
      query,
      normalizedType,
      normalizedMode,
      normalizedPagination,
    )
    setRelatedResourceCache(cacheKey, relatedResponse)
    return relatedResponse
  })()

  relatedResourceInFlight.set(cacheKey, task)
  try {
    return await task
  } finally {
    relatedResourceInFlight.delete(cacheKey)
  }
}

/** 重置相关资源缓存（仅用于测试） */
export function __resetRelatedResourceCacheForTest(): void {
  relatedResourceCache.clear()
  relatedResourceInFlight.clear()
}

/** 按多个维度并行搜索 */
export async function searchByDimsService(
  query: string,
  dims: string[],
): Promise<Record<string, UnifiedSearchApiResponse>> {
  const normalizedQuery = normalizeSearchQuery(query)
  const normalizedDims = dims.map((dim) => String(dim || '').trim())
  const settledResults = await Promise.allSettled(
    normalizedDims.map(async (dim) => {
      const result = await searchUnifiedRepo(normalizedQuery, dim)
      return [dim, result] as const
    }),
  )

  const output: Record<string, UnifiedSearchApiResponse> = {}
  settledResults.forEach((settled, index) => {
    const dim = normalizedDims[index]
    if (settled.status === 'fulfilled') {
      const [key, value] = settled.value
      output[key] = value
      return
    }

    output[dim] = createDimErrorResponse(dim, settled.reason)
  })

  return output
}

/** 融合问答服务（RAG/GraphRAG） */
export async function queryFusionService(params: FusionQueryParamsV1): Promise<FusionQueryApiResponse> {
  const safeQuery = normalizeSearchQuery(params.query)
  return queryFusionRepo({
    query: safeQuery,
    mode: normalizeFusionMode(params.mode),
    dims: normalizeFusionDims(params.dims),
    topK: params.topK,
    includeIiif: params.includeIiif,
    conversationHistory: params.conversationHistory,
    skipCache: params.skipCache ?? true,
  })
}
