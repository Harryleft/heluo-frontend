/**
 * V1 API 兼容层
 *
 * 对外保留 v1Api 的函数签名，内部转调 repository / service。
 * 作为外观模式（Facade），简化上层调用，隐藏内部实现细节。
 */

import type {
  PersonDetailApiResponse,
  PersonListParamsV1,
  PersonListResponseV1,
  PoemDetailApiResponse,
  PoemDetailParamsV1,
  PoemListParamsV1,
  PoemListResponseV1,
  SearchModeV1,
  UnifiedSearchParamsV1,
  UnifiedSearchApiResponse,
} from '@/types/contracts/apiContracts'
import {
  fetchEntityCountsRepo,
  fetchPersonByIdRepo,
  fetchPersonsRepo,
  fetchPoemByIdRepo,
  fetchPoemsRepo,
} from '@/lib/api/repositories/v1Repository'
import {
  searchRelatedResourcesService,
  __resetRelatedResourceCacheForTest,
} from '@/lib/api/services/searchService'

// ============================================================================
// 常量定义
// ============================================================================

const ENTITY_COUNT_ALIASES = {
  person: ['person', 'persons'],
  poemSet: ['poemSet', 'poem', 'poems', 'poemCount'],
  book: ['book', 'books'],
  ancientBook: ['ancientBook', 'ancient_book', 'ancientBooks'],
  geography: ['geography', 'place', 'places'],
  concept: ['concept', 'concepts', 'conceptCount'],
} as const

// ============================================================================
// 私有实现 - Entity Counts 归一化
// ============================================================================

function normalizeCountValue(value: unknown): number {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function readFirstValidCount(source: Record<string, unknown>, keys: readonly string[]): number {
  for (const key of keys) {
    if (!(key in source)) continue
    return normalizeCountValue(source[key])
  }
  return 0
}

function normalizeEntityCounts(raw: unknown): Record<string, number> {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  return {
    person: readFirstValidCount(source, ENTITY_COUNT_ALIASES.person),
    poemSet: readFirstValidCount(source, ENTITY_COUNT_ALIASES.poemSet),
    book: readFirstValidCount(source, ENTITY_COUNT_ALIASES.book),
    ancientBook: readFirstValidCount(source, ENTITY_COUNT_ALIASES.ancientBook),
    geography: readFirstValidCount(source, ENTITY_COUNT_ALIASES.geography),
    concept: readFirstValidCount(source, ENTITY_COUNT_ALIASES.concept),
  }
}

// ============================================================================
// 公共 API
// ============================================================================

/** 获取人物列表 */
export async function fetchPersons(params?: PersonListParamsV1): Promise<PersonListResponseV1> {
  return fetchPersonsRepo(params)
}

/** 根据 ID 获取人物详情 */
export async function fetchPersonById(id: string): Promise<PersonDetailApiResponse> {
  return fetchPersonByIdRepo(id)
}

/** 获取诗文列表 */
export async function fetchPoems(params?: PoemListParamsV1): Promise<PoemListResponseV1> {
  return fetchPoemsRepo(params)
}

/** 根据 ID 获取诗文详情 */
export async function fetchPoemById(
  id: string,
  params?: PoemDetailParamsV1,
): Promise<PoemDetailApiResponse> {
  return fetchPoemByIdRepo(id, params)
}

/** 统一搜索（带缓存和降级策略） */
export async function searchUnified(
  query: string,
  type?: string,
  mode?: SearchModeV1,
  pagination?: Pick<UnifiedSearchParamsV1, 'page' | 'pageSize'>,
): Promise<UnifiedSearchApiResponse> {
  return searchRelatedResourcesService(query, type, mode, pagination)
}

/** 重置相关资源缓存（仅用于测试） */
export { __resetRelatedResourceCacheForTest }

/** 获取各类实体统计数量 */
export async function fetchEntityCounts(): Promise<Record<string, number>> {
  const result = await fetchEntityCountsRepo()
  return normalizeEntityCounts(result)
}
