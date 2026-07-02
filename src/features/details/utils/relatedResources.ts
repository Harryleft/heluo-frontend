/**
 * 相关资源处理工具
 *
 * 处理相关资源的搜索、 筛选和 和构建
 *
 * @module relatedResources
 */

import type { SearchResultItemV1, InternalLinkViewModel } from '@/types/api'
import type { RelatedPickContext } from '@/features/details/types/overviewTab'
import {
  MAX_RELATED_RESOURCES,
  TYPE_QUOTA,
  TYPE_BACKFILL_PRIORITY,
} from '@/features/details/constants/overviewConstants'
import { extractRelatedIsbn } from './isbnExtract'

/**
 * 规范化可比较 URI
 *
 * @param uri - 原始 URI
 * @returns 规范化后的 URI
 */
export function normalizeComparableUri(uri: string): string {
  return String(uri || '').trim().toLowerCase()
}
/**
 * 规范化相关种子文本
 *
 * @param value - 原始文本
 * @returns 规范化后的文本
 */
function normalizeRelatedSeedText(value: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}
/**
 * 构建相关搜索查询字符串
 *
 * @param title - 标题
 * @param snippet - 摘要
 * @returns 查询字符串
 */
export function buildRelatedSearchQuery(title: string, snippet: string): string {
  const titleText = normalizeRelatedSeedText(title)
  const snippetText = normalizeRelatedSeedText(snippet)
    .split(' ')
    .slice(0, 24)
    .join(' ')
  return [titleText, snippetText]
    .filter(Boolean)
    .join(' ')
    .slice(0, 240)
    .trim()
}
/**
 * 构建结果项键
 *
 * @param item - 搜索结果项
 * @returns 唯一键
 */
export function buildResultItemKey(item: SearchResultItemV1): string {
  return `${item.type}-${item.id}-${item.uri}`
}
/**
 * 规范化详情 URI
 *
 * @param rawUri - 原始 URI
 * @returns 规范化后的 URI
 */
export function normalizeDetailUri(rawUri: string): string {
  const text = String(rawUri || '').trim()
  if (!text) return ''
  if (!text.startsWith('/details?uri=')) return text
  const encodedUri = text.slice('/details?uri='.length)
  try {
    return decodeURIComponent(encodedUri)
  } catch {
    return encodedUri
  }
}
/**
 * 从 URI 推断资源类型
 *
 * @param uri - 资源 URI
 * @returns 资源类型
 */
export function inferResourceTypeFromUri(uri: string): SearchResultItemV1['type'] {
  const normalized = normalizeComparableUri(uri)
  if (normalized.includes('/person/')) return 'person'
  if (normalized.includes('/poem/')) return 'poem'
  if (normalized.includes('/book/')) return 'book'
  if (normalized.includes('/ancient_book/') || normalized.includes('/ancient-book/')) return 'ancient_book'
  if (normalized.includes('/place/')) return 'place'
  if (normalized.includes('/concept/')) return 'concept'
  return 'book'
}
/**
 * 从内部链接构建相关资源
 *
 * @param links - 内部链接数组
 * @param context - 选择上下文
 * @returns 相关资源数组
 */
export function buildRelatedFromInternalLinks(
  links: InternalLinkViewModel[],
  context: RelatedPickContext,
): SearchResultItemV1[] {
  const candidates = (links || []).map((item, index) => {
    const normalizedUri = normalizeDetailUri(item?.uri || '')
    if (!normalizedUri) return null
    const rawLabel = String(item?.label || '').trim()
    const title = rawLabel.replace(/^(相关(人物|作品|诗文|地点|图书|概念)[：:])/, '').trim() || rawLabel || '未命名条目'
    return {
      type: inferResourceTypeFromUri(normalizedUri),
      id: String(index),
      title,
      snippet: '',
      score: 0.01,
      uri: normalizedUri,
    } as SearchResultItemV1
  }).filter(Boolean) as SearchResultItemV1[]
  return pickTopRelatedResources(candidates, context)
}
/**
 * 猛选顶部相关资源
 *
 * 栞据类型配额选择相关资源， 确保多样性
 *
 * @param items - 候选项数组
 * @param context - 选择上下文
 * @returns 选中的相关资源数组
 */
export function pickTopRelatedResources(items: SearchResultItemV1[], context: RelatedPickContext): SearchResultItemV1[] {
  if (!Array.isArray(items) || items.length === 0) {
    return []
  }
  const { normalizedCurrentUri, resourceType, currentTitle, currentIsbn, currentResourceKey } = context
  const isBookResource = resourceType === 'book'
  const normalizedCurrentTitle = normalizeComparableTitle(currentTitle)
  // Step 1: 去重过滤
  const filtered: SearchResultItemV1[] = []
  const seenUris = new Set<string>()
  let keptSameTitleBook = false
  for (const item of items) {
    const uri = String(item?.uri || '').trim()
    const title = String(item?.title || '').trim()
    if (!uri || !title) continue
    const normalizedUri = normalizeComparableUri(uri)
    if (normalizedUri && normalizedUri === normalizedCurrentUri) continue
    if (seenUris.has(normalizedUri)) continue
    if (isBookResource) {
      const relatedIsbn = extractRelatedIsbn(item)
      if (currentIsbn && relatedIsbn && relatedIsbn === currentIsbn) continue
      const relatedResourceKey = extractBookResourceKey(uri)
      if (currentResourceKey && relatedResourceKey && currentResourceKey === relatedResourceKey) continue
      const isSameTitleBook = isBookType(item.type)
        && normalizedCurrentTitle
        && normalizeComparableTitle(title) === normalizedCurrentTitle
      if (isSameTitleBook) {
        if (keptSameTitleBook) continue
        keptSameTitleBook = true
      }
    }
    seenUris.add(normalizedUri)
    filtered.push(item)
  }
  // Step 2: 按类型分组并按分数排序
  const byType = new Map<string, SearchResultItemV1[]>()
  for (const item of filtered) {
    const type = item.type || 'other'
    if (!byType.has(type)) byType.set(type, [])
    byType.get(type)!.push(item)
  }
  for (const [, typeItems] of byType) {
    typeItems.sort((a, b) => (b.score || 0) - (a.score || 0))
  }
  // Step 3: 轮询选择（确保多样性）
  const result: SearchResultItemV1[] = []
  const counts: Record<string, number> = {}
  const selectedUris = new Set<string>()
  let changed = true
  while (result.length < MAX_RELATED_RESOURCES && changed) {
    changed = false
    for (const [type, typeItems] of byType) {
      if (result.length >= MAX_RELATED_RESOURCES) break
      const quota = TYPE_QUOTA[type] ?? 1
      const count = counts[type] || 0
      const pool = typeItems.filter(item => !selectedUris.has(normalizeComparableUri(item.uri)))
      if (count < quota && pool.length > 0) {
        const selected = pool[0]
        result.push(selected)
        selectedUris.add(normalizeComparableUri(selected.uri))
        counts[type] = count + 1
        changed = true
      }
    }
  }
  // Step 4: 如果未满，则回填
  if (result.length < MAX_RELATED_RESOURCES) {
    const needed = MAX_RELATED_RESOURCES - result.length
    let backfillCount = 0
    for (const priorityType of TYPE_BACKFILL_PRIORITY) {
      if (backfillCount >= needed) break
      const typeItems = byType.get(priorityType) || []
      const available = typeItems.filter(
        item => !selectedUris.has(normalizeComparableUri(item.uri)),
      )
      for (const item of available) {
        if (backfillCount >= needed) break
        result.push(item)
        selectedUris.add(normalizeComparableUri(item.uri))
        backfillCount++
      }
    }
    if (backfillCount < needed) {
      const remaining = filtered
        .filter(item => !selectedUris.has(normalizeComparableUri(item.uri)))
        .sort((a, b) => (b.score || 0) - (a.score || 0))
      result.push(...remaining.slice(0, needed - backfillCount))
    }
  }
  return result
}
/**
 * 合并相关候选
 *
 * @param primary - 主要候选
 * @param supplemental - 补充候选
 * @returns 合并后的候选数组
 */
export function mergeRelatedCandidates(
  primary: SearchResultItemV1[],
  supplemental: SearchResultItemV1[],
): SearchResultItemV1[] {
  return [...(primary || []), ...(supplemental || [])]
}
/**
 * 判断是否需要为图书资源补充多样性
 *
 * @param items - 相关资源数组
 * @param currentTitle - 当前标题
 * @returns 是否需要补充
 */
export function shouldSupplementBookRelated(items: SearchResultItemV1[], currentTitle: string): boolean {
  if (!items.length) return true
  if (items.length < 3) return true
  const normalizedCurrentTitle = normalizeComparableTitle(currentTitle)
  if (!normalizedCurrentTitle) return false
  const sameTitleCount = items.reduce((count, item) => {
    const itemTitle = normalizeComparableTitle(item.title)
    return count + (itemTitle && itemTitle === normalizedCurrentTitle ? 1 : 0)
  }, 0)
  return sameTitleCount >= Math.max(2, items.length - 1)
}
/**
 * 构建图书多样性查询
 *
 * @param title - 标题
 * @param snippet - 摘要
 * @returns 查询字符串
 */
export function buildBookDiversityQuery(title: string, snippet: string): string {
  const normalizedTitle = String(title || '').trim()
  const compactTitle = normalizedTitle.replace(/\s+/g, '')
  const withoutBiographySuffix = compactTitle.replace(/(传记|传|评传|年谱)$/u, '')
  const seed = withoutBiographySuffix || compactTitle
  if (seed) return seed
  const snippetSeed = normalizeRelatedSeedText(snippet)
    .split(' ')
    .find((segment) => segment.length >= 2)
  return snippetSeed || ''
}
/**
 * 规范化可比较标题
 *
 * @param title - 原始标题
 * @returns 规范化后的标题
 */
function normalizeComparableTitle(title: string): string {
  return String(title || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[《>"''"''`·•_:：，。,.!?！？（）()【】[\]、-]/g, '')
    .trim()
}
/**
 * 判断是否为图书类型
 *
 * @param type - 资源类型
 * @returns 是否为图书
 */
function isBookType(type: string): boolean {
  const normalized = String(type || '').trim().toLowerCase()
  return normalized === 'book' || normalized === 'ancient_book'
}
/**
 * 从 URI 中提取图书资源键
 *
 * @param uri - 资源 URI
 * @returns 资源键
 */
export function extractBookResourceKey(uri: string): string {
  const normalized = String(uri || '').trim().toLowerCase()
  if (!normalized) return ''
  const noQuery = normalized.split('?')[0]
  const noJson = noQuery.replace(/\.json$/i, '')
  const segments = noJson.split('/').filter(Boolean)
  return segments[segments.length - 1] || ''
}
