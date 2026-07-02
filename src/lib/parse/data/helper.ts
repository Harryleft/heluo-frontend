/**
 * 解析器辅助函数
 *
 * 提供实体解析过程中使用的通用工具函数：
 * - 数组处理
 * - 文本归一化
 * - 名称提取
 * - 标签提取
 */

import { AAT, BLOCKED_TEXTS } from './constants'
import { normalizeText, isLikelyUrl, forceArray } from '@/lib/utils/text'

// 从统一模块重新导出
export { normalizeText, isLikelyUrl, forceArray }

// ============================================================================
// 数组与文本处理
// ============================================================================

/** 递归收集节点中的所有文本值 */
export function collectLiteralTexts(node: unknown, output: string[]): void {
  if (node == null) return
  if (typeof node === 'string') {
    const text = normalizeText(node)
    if (text) output.push(text)
    return
  }
  if (typeof node === 'number') {
    output.push(String(node))
    return
  }
  if (Array.isArray(node)) {
    node.forEach((item) => collectLiteralTexts(item, output))
    return
  }
  if (typeof node === 'object') {
    const objectNode = node as Record<string, unknown>
    if (typeof objectNode['@value'] === 'string') {
      output.push(normalizeText(objectNode['@value']))
    }
    Object.values(objectNode).forEach((value) => collectLiteralTexts(value, output))
  }
}

// ============================================================================
// 名称提取
// ============================================================================

function getEquivalentFromClassifiedAsArray(classifiedAs: unknown): string[] {
  const output: string[] = []
  forceArray(classifiedAs as Record<string, unknown>[]).forEach((item) => {
    if (!item || typeof item !== 'object') return
    forceArray((item as Record<string, unknown>).equivalent as Record<string, unknown>[])
      .forEach((eq) => {
        if (eq && typeof eq.id === 'string') output.push(eq.id)
      })
  })
  return output
}

/** 从标识符数组中提取名称（优先主名称和语言匹配） */
export function getName(identifiers: unknown, validatingLanguage = ''): string {
  const matchingNames: string[] = []
  const classificationMatches: string[] = []
  const languageMatches: string[] = []
  const alternativeNames: string[] = []
  const unclassifiedNames: string[] = []

  forceArray(identifiers as Record<string, unknown>[]).forEach((identifier) => {
    if (!identifier || typeof identifier !== 'object') return
    if (identifier.type !== 'Name') return
    const content = normalizeText(identifier.content)
    if (!content) return

    const equivalentIds = getEquivalentFromClassifiedAsArray(identifier.classified_as)
    const isPrimaryName = equivalentIds.includes(AAT.PRIMARY_NAME)
    const langIds = forceArray(identifier.language as Record<string, unknown>[])
      .map((item) => String(item?.id || ''))
      .filter(Boolean)
    const isLanguageMatched = validatingLanguage ? langIds.includes(validatingLanguage) : false

    if (isPrimaryName && isLanguageMatched) matchingNames.push(content)
    else if (isPrimaryName) classificationMatches.push(content)
    else if (isLanguageMatched) languageMatches.push(content)
    else if (equivalentIds.length > 0) alternativeNames.push(content)
    else unclassifiedNames.push(content)
  })

  return [...matchingNames, ...classificationMatches, ...languageMatches, ...alternativeNames, ...unclassifiedNames][0] || ''
}

/** 从文本数组中选择第一个可读文本（过滤 URL 和无效值） */
export function pickReadableText(texts: unknown[], fallback = ''): string {
  for (const text of texts) {
    const normalized = normalizeText(text)
    if (!normalized) continue
    if (isLikelyUrl(normalized)) continue
    if (BLOCKED_TEXTS.has(normalized.toLowerCase().replace(/\s+/g, ''))) continue
    if (normalized.length < 2) continue
    return normalized
  }
  return fallback
}

// ============================================================================
// 标签与实体信息提取
// ============================================================================

/**
 * 从对象中提取标签
 * 优先级：_label > label > identified_by (Name 类型)
 */
export function extractLabel(obj: unknown): string {
  if (!obj || typeof obj !== 'object') return ''
  const record = obj as Record<string, unknown>

  // 优先使用 _label
  if (record._label && typeof record._label === 'string') {
    return normalizeText(record._label)
  }
  // 其次使用 label
  if (record.label && typeof record.label === 'string') {
    return normalizeText(record.label)
  }
  // 最后尝试从 identified_by 提取
  if (record.identified_by) {
    const name = getName(record.identified_by)
    if (name) return name
  }
  return ''
}

/**
 * 从关系对象中提取实体信息
 */
export function extractEntityInfo(relation: unknown): { label: string; uri: string } {
  if (!relation || typeof relation !== 'object') {
    return { label: '', uri: '' }
  }
  const record = relation as Record<string, unknown>

  const label = extractLabel(record)
  const uri = record.id && typeof record.id === 'string' ? record.id : ''

  return { label, uri }
}
