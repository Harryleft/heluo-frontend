/**
 * 实体字段工具函数
 *
 * 重新导出统一的工具函数，保持 API 兼容性
 */

// 从统一模块重新导出
export { normalizeText, isLikelyUrl, forceArray as asArray, asRecord, uniq } from '@/lib/utils/text'

// ============================================================================
// 本地专用工具
// ============================================================================

import { normalizeText, asRecord, forceArray } from '@/lib/utils/text'

/**
 * 从节点中提取文本
 */
export function pickNodeText(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string' || typeof value === 'number') {
    return normalizeText(value)
  }

  const record = asRecord(value)
  const candidates = [
    record._label,
    record.content,
    record.value,
    record.label,
    record.name,
    record.title,
    record['@value'],
  ]

  for (const candidate of candidates) {
    const text = normalizeText(candidate)
    if (text) return text
  }

  const identifiedBy = forceArray(record.identified_by)
  for (const item of identifiedBy) {
    const text = pickNodeText(item)
    if (text) return text
  }

  return ''
}

/**
 * 解析 POINT WKT 格式的坐标
 */
export function parsePointWkt(value: unknown): string {
  const text = normalizeText(value)
  if (!text) return ''
  const match = text.match(/POINT\s*\(\s*([\d.-]+)\s+([\d.-]+)\s*\)/i)
  if (!match) return ''
  return `${match[2]}, ${match[1]}`
}
