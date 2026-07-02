/**
 * ISBN 提取工具
 *
 * 从实体数据中提取 ISBN 信息
 *
 * @module isbnExtract
 */

import { normalizeIsbn } from '@/lib/api/services/isbnCoverService'

/**
 * 从实体数据中提取 ISBN
 *
 * @param entity - 实体数据
 * @returns ISBN 字符串或空字符串
 */
export function extractBookIsbn(entity?: Record<string, unknown>): string {
  if (!entity || typeof entity !== 'object') return ''

  const entityRecord = entity as Record<string, unknown>
  const identifiedBy: unknown[] = Array.isArray(entityRecord.identified_by)
    ? entityRecord.identified_by
    : []

  for (const node of identifiedBy) {
    if (!node || typeof node !== 'object') continue
    const record = node as Record<string, unknown>
    const typeLabel = extractTextCandidates(record.classified_as).join(' ').toLowerCase()
    const contentCandidates = extractTextCandidates(record.content || record.value || record._label || '')
    const rawCandidate = contentCandidates.join(' ')

    if (typeLabel.includes('isbn')) {
      const matched = pickIsbnCandidate(rawCandidate)
      if (matched) return matched
    }

    const fallback = pickIsbnCandidate(rawCandidate)
    if (fallback) return fallback
  }

  return ''
}

/**
 * 从相关资源项中提取 ISBN
 *
 * @param item - 搜索结果项
 * @returns ISBN 字符串或空字符串
 */
export function extractRelatedIsbn(item: { uri?: string; id?: string; title?: string }): string {
  const candidates = [item.uri, item.id, item.title].map((value) => String(value || ''))
  for (const candidate of candidates) {
    const matches = candidate.match(/97[89][0-9Xx-]{10,20}|[0-9]{9}[0-9Xx]/g) || []
    for (const matched of matches) {
    const normalized = normalizeIsbn(matched)
    if (normalized.length === 13 || normalized.length === 10) {
      return normalized
    }
  }
  }
  return ''
}

/**
 * 从 URI 中提取资源键
 *
 * @param uri - 资源 URI
 * @returns 资源键或空字符串
 */
export function extractBookResourceKey(uri: string): string {
  const normalized = String(uri || '').trim().toLowerCase()
  if (!normalized) return ''
  const noQuery = normalized.split('?')[0]
  const noJson = noQuery.replace(/\.json$/i, '')
  const segments = noJson.split('/').filter(Boolean)
  return segments[segments.length - 1] || ''
}

/**
 * 从候选文本中选择 ISBN
 *
 * @param raw - 原始文本
 * @returns ISBN 字符串或空字符串
 */
function pickIsbnCandidate(raw: string): string {
  const text = String(raw || '').trim()
  if (!text) return ''

  const matches = text.match(/97[89][0-9Xx-]{10,20}|[0-9]{9}[0-9Xx]/g) || []
  for (const item of matches) {
    const normalized = normalizeIsbn(item)
    if (normalized.length === 13 || normalized.length === 10) {
      return item.trim()
    }
  }
  return ''
}

/**
 * 从节点中提取文本候选
 *
 * @param node - 任意节点
 * @returns 文本候选数组
 */
function extractTextCandidates(node: unknown): string[] {
  if (!node) return []
  if (typeof node === 'string' || typeof node === 'number') {
    const value = String(node).trim()
    return value ? [value] : []
  }
  if (Array.isArray(node)) {
    return node.flatMap((item) => extractTextCandidates(item))
  }
  if (typeof node === 'object') {
    const record = node as Record<string, unknown>
    return [
      ...extractTextCandidates(record._label),
      ...extractTextCandidates(record.content),
      ...extractTextCandidates(record.value),
      ...extractTextCandidates(record.label),
    ]
  }
  return []
}
