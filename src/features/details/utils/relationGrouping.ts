/**
 * 关系分组工具
 *
 * 将人物关系按原始关系类型分组展示
 *
 * @module relationGrouping
 */

import type { InternalLinkViewModel } from '@/types/api'
import type { RelationGroup } from '@/features/details/types/overviewTab'
import { RELATION_TYPE_COLORS } from '@/features/details/constants/overviewConstants'

/**
 * 从标签中提取关系类型
 *
 * @param label - 链接标签， * @returns 关系类型字符串
 */
export function extractRelationType(label: string): string {
  const match = label.match(/相关人物(?:（(.+?)）)?：/)
  if (match && match[1]) {
    return match[1].trim()
  }
  const bracketMatch = label.match(/（(.+?)）/)
  if (bracketMatch) {
    return bracketMatch[1].trim()
  }
  return '相关'
}
/**
 * 从标签中提取人物名称
 *
 * @param label - 链接标签
 * @returns 人物名称
 */
export function extractPersonName(label: string): string {
  const colonIndex = label.indexOf('：')
  if (colonIndex !== -1) {
    return label.slice(colonIndex + 1).trim()
  }
  return label
}
/**
 * 获取关系颜色主题
 *
 * @param relationType - 关系类型
 * @returns 颜色主题字符串
 */
export function getRelationColorTheme(relationType: string): string {
  if (RELATION_TYPE_COLORS[relationType]) {
    return RELATION_TYPE_COLORS[relationType]
  }
  const normalizedType = relationType.toLowerCase()
  for (const [key, color] of Object.entries(RELATION_TYPE_COLORS)) {
    if (normalizedType.includes(key.toLowerCase())) {
      return color
    }
  }
  return 'tertiary'
}
/**
 * 按关系类型分组内部链接
 *
 * @param items - 内部链接数组
 * @returns 关系分组数组
 */
export function groupByRelationType(items: InternalLinkViewModel[]): RelationGroup[] {
  const groupMap = new Map<string, InternalLinkViewModel[]>()
  for (const item of items) {
    const relationType = extractRelationType(item.label)
    if (!groupMap.has(relationType)) {
      groupMap.set(relationType, [])
    }
    groupMap.get(relationType)!.push(item)
  }
  const groups: RelationGroup[] = []
  for (const [relationType, groupItems] of groupMap) {
    groups.push({
      relationType,
      items: groupItems,
      colorTheme: getRelationColorTheme(relationType),
      defaultExpanded: false,
    })
  }
  // 按数量排序（多的在前）
  groups.sort((a, b) => b.items.length - a.items.length)
  // 默认展开前 2 个
  groups.forEach((group, index) => {
    group.defaultExpanded = index < 2
  })
  return groups
}
