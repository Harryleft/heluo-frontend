/**
 * JSON-LD 解析器
 *
 * 用于解析 JSON-LD 格式的实体数据，提取可读字段：
 * - 标题提取（支持多语言）
 * - 摘要提取
 * - 人物介绍结构化解析
 */

import { AAT } from './constants'
import { EntityParser } from './EntityParser'
import { collectLiteralTexts, pickReadableText } from './helper'
import { parseBiographyFromReferredToBy, parseBiographyContent, type BiographyData } from './biographyParser'

// ============================================================================
// 常量定义
// ============================================================================

const JSONLD_ESM_URL = 'https://cdn.jsdelivr.net/npm/jsonld@8.3.3/+esm'
const jsonldModulePromise = import(/* @vite-ignore */ JSONLD_ESM_URL).catch(() => null)

// ============================================================================
// 类型定义
// ============================================================================

export interface ParsedReadableFields {
  title: string
  snippet: string
  /** 结构化的人物介绍数据 */
  biography?: BiographyData
}

// ============================================================================
// 私有实现
// ============================================================================

function normalizeReferredToByItem(item: unknown): Record<string, unknown> | null {
  if (!item || typeof item !== 'object') return null
  return item as Record<string, unknown>
}

function extractContentFromItem(item: Record<string, unknown>): string | null {
  const content = item.content
  if (typeof content === 'string') {
    return content
  }
  return null
}

// ============================================================================
// 公共 API
// ============================================================================

export async function parseJsonLdReadableFields(doc: Record<string, unknown>): Promise<ParsedReadableFields> {
  if (!doc || typeof doc !== 'object') return { title: '', snippet: '' }

  const parser = new EntityParser(doc)
  const literalTexts: string[] = []
  collectLiteralTexts(doc, literalTexts)

  let title = pickReadableText([
    parser.getPrimaryName(AAT.LANG_ZH),
    parser.getPrimaryName(),
    doc._label,
    doc.title,
    doc.name,
    doc.label,
    doc.description,
    ...literalTexts,
  ])

  let snippet = pickReadableText([
    parser.getDescription(),
    doc.description,
    doc.content,
    doc.text,
    doc.abstract,
    ...literalTexts,
  ])

  // 解析人物介绍结构化数据
  let biography: BiographyData | undefined
  if (parser.isPerson()) {
    const referredToBy = doc.referred_to_by
    if (Array.isArray(referredToBy)) {
      biography = parseBiographyFromReferredToBy(referredToBy)
    } else if (referredToBy && typeof referredToBy === 'object') {
      // 处理单个对象的情况
      const normalizedItem = normalizeReferredToByItem(referredToBy)
      if (normalizedItem) {
        const content = extractContentFromItem(normalizedItem)
        if (content) {
          biography = parseBiographyContent(content)
        }
      }
    }

    // 如果有结构化的 biography 数据，生成简短摘要替代完整 snippet
    // 避免 snippet 包含整个 referred_to_by.content 导致重复展示
    if (biography?.hasStructuredData && biography.sources.length > 0) {
      const firstSource = biography.sources[0]
      // 优先使用第一个来源的介绍，截取前 150 字符作为摘要
      const introText = firstSource.introduction || firstSource.rawContent || ''
      if (introText) {
        // 移除 HTML 标签，只保留纯文本
        const plainText = introText.replace(/<[^>]+>/g, '').trim()
        // 截取前 150 字符作为摘要
        snippet = plainText.length > 150 ? plainText.slice(0, 150) + '...' : plainText
      }
    }
  }

  const jsonldModule = await jsonldModulePromise
  const jsonld = (jsonldModule as { default?: { flatten?: (_d: unknown) => Promise<unknown> } } | null)?.default || jsonldModule
  if (jsonld && typeof (jsonld as { flatten?: (_d: unknown) => Promise<unknown> }).flatten === 'function') {
    try {
      const flattened = await (jsonld as { flatten: (_d: unknown) => Promise<unknown> }).flatten(doc)
      const flattenTexts: string[] = []
      collectLiteralTexts(flattened, flattenTexts)
      if (!title) title = pickReadableText(flattenTexts, title)
      if (!snippet) snippet = pickReadableText(flattenTexts, snippet)
    } catch {
      // ignore
    }
  }

  return { title: title || '', snippet: snippet || '', biography }
}
