/**
 * 链接丰富化 Hook
 *
 * 为内部链接添加摘要信息，支持：
 * - 人物链接：添加人物姓名和简介
 * - 诗文链接：添加诗文标题和内容摘要
 */

import { useCallback } from 'react'
import { fetchPersonById, fetchPoemById } from '@/lib/api/v1Api'
import { parseUriResource } from '@/features/details/utils/uriParser'
import type { InternalLinkViewModel } from '@/types/view/models'
import { TEXT, TIMEOUT } from '@/lib/config/constants'

// ============================================================================
// 常量定义
// ============================================================================

const PERSON_LINK_PREFIX = '相关人物'
const POEM_LINK_PREFIX = '相关诗文'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 丰富化后的内部链接类型（包含摘要）
 */
export type EnrichedInternalLink = InternalLinkViewModel & { summary?: string }

// ============================================================================
// 私有实现
// ============================================================================

function buildLabeledText(originalLabel: string, fallbackPrefix: string, resolvedLabel?: string): string {
  if (!resolvedLabel) return originalLabel
  const prefix = originalLabel.split('：')[0] || fallbackPrefix
  return `${prefix}：${resolvedLabel}`
}

function toDefaultEnrichedLink(item: InternalLinkViewModel): EnrichedInternalLink {
  return { ...item, summary: TEXT.EMPTY }
}

async function enrichPersonLink(item: InternalLinkViewModel, id: string): Promise<EnrichedInternalLink> {
  const person = await fetchPersonById(id)
  if (!person.success) return toDefaultEnrichedLink(item)

  return {
    ...item,
    label: buildLabeledText(item.label, PERSON_LINK_PREFIX, person.data.name),
    summary: person.data.summary || TEXT.EMPTY,
  }
}

async function enrichPoemLink(item: InternalLinkViewModel, id: string): Promise<EnrichedInternalLink> {
  const poem = await fetchPoemById(id)
  if (!poem.success) return toDefaultEnrichedLink(item)

  return {
    ...item,
    label: buildLabeledText(item.label, POEM_LINK_PREFIX, poem.data.title),
    summary: poem.data.fullText?.slice(0, TIMEOUT.LINK_SNIPPET_LENGTH) || TEXT.EMPTY,
  }
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 链接丰富化 Hook
 * @param query 搜索关键词
 * @returns enrichInternalLinks 函数
 *
 * @example
 * ```tsx
 * const enrichLinks = useEnrichLinks('杜甫')
 * const enriched = await enrichLinks(internalLinks)
 * ```
 */
export function useEnrichLinks(query: string) {
  const enrichInternalLinks = useCallback(
    async (links: InternalLinkViewModel[]): Promise<EnrichedInternalLink[]> => {
      void query
      if (!links || links.length === 0) return []

      return Promise.all(
        links.map(async (item) => {
          try {
            const resource = parseUriResource(item.uri)

            if (resource.type === 'person' && resource.id) {
              return await enrichPersonLink(item, resource.id)
            }

            if (resource.type === 'poem' && resource.id) {
              return await enrichPoemLink(item, resource.id)
            }

            return toDefaultEnrichedLink(item)
          } catch {
            return toDefaultEnrichedLink(item)
          }
        }),
      )
    },
    [query],
  )

  return enrichInternalLinks
}
