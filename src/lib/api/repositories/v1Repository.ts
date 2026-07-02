/**
 * V1 数据仓库层
 *
 * 负责与后端 API 进行实际通信，提供：
 * - 自动重试机制（指数退避）
 * - 统一的 HTTP 请求封装
 * - 类型安全的响应处理
 */

import axios from 'axios'
import type {
  AncientBookDetailApiResponse,
  BookDetailApiResponse,
  ConceptDetailApiResponse,
  FusionQueryApiResponse,
  FusionQueryParamsV1,
  PersonDetailApiResponse,
  PersonListParamsV1,
  PersonListResponseV1,
  PlaceDetailApiResponse,
  PoemDetailApiResponse,
  PoemDetailParamsV1,
  PoemListParamsV1,
  PoemListResponseV1,
  SearchModeV1,
  UnifiedSearchParamsV1,
  UnifiedSearchApiResponse,
} from '@/types/contracts/apiContracts'
import { http } from '@/lib/api/http'

// ============================================================================
// 常量定义
// ============================================================================

const DEFAULT_MAX_RETRIES = 3
const DEFAULT_RETRY_DELAY = 1000
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504]

// ============================================================================
// 类型定义
// ============================================================================

type EntityCountsResponse = {
  person: number
  poemSet: number
  book: number
  ancientBook: number
  geography: number
  concept: number
}

// ============================================================================
// 私有实现 - 重试机制
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function calculateRetryDelay(attempt: number): number {
  return DEFAULT_RETRY_DELAY * Math.pow(2, attempt)
}

function isRetryableError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return true
    }
    return RETRYABLE_STATUS_CODES.includes(error.response.status)
  }
  return false
}

async function withRetry<T>(requestFn: () => Promise<T>, maxRetries = DEFAULT_MAX_RETRIES): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn()
    } catch (error) {
      lastError = error

      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error
      }

      const retryDelay = calculateRetryDelay(attempt)
      await delay(retryDelay)
    }
  }

  throw lastError
}

// ============================================================================
// 私有实现 - HTTP 请求封装
// ============================================================================

async function getWithRetry<T>(url: string, params?: unknown): Promise<T> {
  return withRetry(async () => {
    const response = await http.get<T>(url, params ? { params } : undefined)
    return response.data
  })
}

async function postWithRetry<T>(url: string, body?: unknown): Promise<T> {
  return withRetry(async () => {
    const response = await http.post<T>(url, body || {})
    return response.data
  })
}

// ============================================================================
// 公共 API - 实体查询
// ============================================================================

/** 获取人物列表 */
export async function fetchPersonsRepo(params?: PersonListParamsV1): Promise<PersonListResponseV1> {
  return getWithRetry<PersonListResponseV1>('/api/v1/persons', params)
}

/** 根据 ID 获取人物详情 */
export async function fetchPersonByIdRepo(id: string): Promise<PersonDetailApiResponse> {
  return getWithRetry<PersonDetailApiResponse>(`/api/v1/persons/${id}`)
}

/** 获取诗文列表 */
export async function fetchPoemsRepo(params?: PoemListParamsV1): Promise<PoemListResponseV1> {
  return getWithRetry<PoemListResponseV1>('/api/v1/poems', params)
}

/** 根据 ID 获取诗文详情 */
export async function fetchPoemByIdRepo(
  id: string,
  params?: PoemDetailParamsV1,
): Promise<PoemDetailApiResponse> {
  return getWithRetry<PoemDetailApiResponse>(`/api/v1/poems/${id}`, params)
}

/** 根据 ID 获取图书详情 */
export async function fetchBookByIdRepo(id: string): Promise<BookDetailApiResponse> {
  return getWithRetry<BookDetailApiResponse>(`/api/v1/books/${id}`)
}

/** 根据 ID 获取地点详情 */
export async function fetchPlaceByIdRepo(id: string): Promise<PlaceDetailApiResponse> {
  return getWithRetry<PlaceDetailApiResponse>(`/api/v1/places/${id}`)
}

/** 根据 ID 获取概念详情 */
export async function fetchConceptByIdRepo(id: string): Promise<ConceptDetailApiResponse> {
  return getWithRetry<ConceptDetailApiResponse>(`/api/v1/concepts/${id}`)
}

/** 根据 ID 获取古籍详情，可选指定 URI */
export async function fetchAncientBookByIdRepo(id: string, uri?: string): Promise<AncientBookDetailApiResponse> {
  const params = uri ? { uri } : undefined
  return getWithRetry<AncientBookDetailApiResponse>(`/api/v1/ancient-books/${id}`, params)
}

// ============================================================================
// 公共 API - 搜索与统计
// ============================================================================

/** 统一搜索，支持类型、模式和分页过滤 */
export async function searchUnifiedRepo(
  query: string,
  type?: string,
  mode?: SearchModeV1,
  pagination?: Pick<UnifiedSearchParamsV1, 'page' | 'pageSize'>,
): Promise<UnifiedSearchApiResponse> {
  const page = Number.isFinite(Number(pagination?.page)) ? Math.max(1, Math.floor(Number(pagination?.page))) : undefined
  const pageSize = Number.isFinite(Number(pagination?.pageSize))
    ? Math.max(1, Math.floor(Number(pagination?.pageSize)))
    : undefined

  const params = {
    q: query,
    ...(type && { type }),
    ...(mode && { mode }),
    ...(page && { page }),
    ...(pageSize && { pageSize }),
  }
  return getWithRetry<UnifiedSearchApiResponse>('/api/v1/search', params)
}

/** 融合问答查询 */
export async function queryFusionRepo(params: FusionQueryParamsV1): Promise<FusionQueryApiResponse> {
  return postWithRetry<FusionQueryApiResponse>('/api/v1/fusion/query', params)
}

/** 获取各类实体统计数量 */
export async function fetchEntityCountsRepo(): Promise<Record<string, number>> {
  return getWithRetry<EntityCountsResponse>('/stats/entity-counts')
}
