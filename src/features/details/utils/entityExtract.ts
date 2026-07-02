/**
 * 实体数据提取工具
 *
 * 从实体对象中提取各种数据
 *
 * @module entityExtract
 */

import type { PlaceParentLinkView } from '@/features/details/types/overviewTab'
import { buildDetailsRouteFromUri } from '@/lib/url/heluoUrl'
/**
 * 从实体数据中提取地点上级链接
 *
 * @param entity - 实体数据对象
 * @returns 上级链接数组
 */
export function extractPlaceParentLinks(entity?: Record<string, unknown>): PlaceParentLinkView[] {
  if (!entity || typeof entity !== 'object') return []
  const partOf = Array.isArray((entity as Record<string, unknown>).part_of)
    ? (entity as Record<string, unknown>).part_of as unknown[]
    : []
  const links: PlaceParentLinkView[] = []
  const dedupe = new Set<string>()
  partOf.forEach((item) => {
    if (!item || typeof item !== 'object') return
    const record = item as Record<string, unknown>
    const route = [record.id, record.uri, record['@id']]
      .map((value) => buildDetailsRouteFromUri(String(value || '')))
      .find(Boolean) || ''
    if (!route) return
    const name = pickEntityNodeLabel(item)
    if (!name) return
    const key = `${name}::${route}`
    if (dedupe.has(key)) return
    dedupe.add(key)
    links.push({ name, route })
  })
  return links
}
/**
 * 从节点中提取标签文本
 *
 * @param node - 任意节点
 * @returns 标签字符串
 */
export function pickEntityNodeLabel(node: unknown): string {
  if (!node) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node).trim()
  if (Array.isArray(node)) {
    for (const item of node) {
      const text = pickEntityNodeLabel(item)
      if (text) return text
    }
    return ''
  }
  if (typeof node === 'object') {
    const record = node as Record<string, unknown>
    const candidates = [record._label, record.content, record.value, record.label, record.name]
    for (const candidate of candidates) {
      const text = pickEntityNodeLabel(candidate)
      if (text) return text
    }
  }
  return ''
}
/**
 * 从节点中提取内容值
 *
 * @param node - 任意节点
 * @returns 内容值数组
 */
export function extractContentValue(node: unknown): string[] {
  if (!node) return []
  if (typeof node === 'string') {
    const text = node.trim()
    return text ? [text] : []
  }
  if (Array.isArray(node)) {
    return node.flatMap((item) => extractContentValue(item))
  }
  if (typeof node === 'object') {
    const record = node as Record<string, unknown>
    return extractContentValue(record.content)
  }
  return []
}
/**
 * 按路径收集节点
 *
 * @param root - 根节点
 * @param path - 路径数组
 * @returns 收集到的节点数组
 */
export function collectNodesByPath(root: Record<string, unknown>, path: string[]): unknown[] {
  let nodes: unknown[] = [root]
  for (const segment of path) {
    const next: unknown[] = []
    nodes.forEach((node) => {
      if (!node || typeof node !== 'object') return
      const value = (node as Record<string, unknown>)[segment]
      if (Array.isArray(value)) {
        next.push(...value)
        return
      }
      if (value != null) next.push(value)
    })
    nodes = next
  }
  return nodes
}
/**
 * 从文档数据中提取诗词创作时间
 *
 * @param doc - 文档数据
 * @returns 创作时间字符串
 */
export function extractPoemCreationTime(doc?: Record<string, unknown>): string {
  if (!doc || typeof doc !== 'object') return ''
  const preferredPaths = [
    ['created_by', 'timespan', '_label'],
    ['created_by', 'timespan', 'label'],
    ['created_by', 'timespan', 'content'],
    ['created_by', 'timespan', 'value'],
  ]
  for (const path of preferredPaths) {
    const nodes = collectNodesByPath(doc, path)
    for (const node of nodes) {
      const text = String(node || '').trim()
      if (text) return text
    }
  }

  const candidateValues: string[] = []
  const paths = [
    ['created_by', 'timespan', 'begin_of_the_begin'],
    ['created_by', 'timespan', 'end_of_the_end'],
  ]
  paths.forEach((path) => {
    const nodes = collectNodesByPath(doc, path)
    nodes.forEach((node) => {
      const text = String(node || '').trim()
      if (text) candidateValues.push(text)
    })
  })
  return Array.from(new Set(candidateValues)).slice(0, 2).join(' / ')
}
/**
 * 从相关地点中提取地理上下文
 *
 * @param places - 相关地点数组
 * @returns 地理上下文字符串
 */
export function extractPoemGeoContext(
  places?: Array<{ label: string; uri: string }>,
): string {
  if (!Array.isArray(places)) return ''
  const labels = places
    .map((item) => String(item?.label || '').trim())
    .filter(Boolean)
  return Array.from(new Set(labels)).slice(0, 6).join('、')
}
/**
 * 从实体数据中提取人物引用内容
 *
 * @param entity - 实体数据
 * @returns 引用内容数组
 */
export function extractPersonReferredContentsFromEntity(entity?: Record<string, unknown>): string[] {
  if (!entity || typeof entity !== 'object') return []
  const contents = extractContentValue((entity as Record<string, unknown>).referred_to_by)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return Array.from(new Set(contents)).slice(0, 24)
}
/**
 * 获取资源类型标签
 *
 * @param type - 资源类型
 * @returns 类型标签
 */
export function getResourceTypeLabel(type: string): string {
  const normalized = String(type || '').trim().toLowerCase()
  switch (normalized) {
    case 'person':
      return '人物'
    case 'book':
      return '图书'
    case 'poem':
      return '诗文'
    case 'place':
      return '地点'
    case 'concept':
      return '概念'
    case 'ancient_book':
      return '古籍'
    default:
      return '其他'
  }
}
