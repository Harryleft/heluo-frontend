/**
 * URI 资源解析器
 *
 * 用于解析实体 URI，提取资源类型和 ID 信息。
 * 支持的资源类型：诗文、人物、古籍、图书、地点、概念
 */

import type { ResourceType } from '@/types/contracts/apiContracts'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * URI 资源类型（基于 ResourceType 扩展）
 * - 排除 'iiif'（详情页不支持）
 * - 添加 'unknown'（用于无法识别的 URI）
 */
export type DetailResourceType = Exclude<ResourceType, 'iiif'> | 'unknown'

/**
 * 概念子类型
 */
export type ConceptSubType = 'rhyme' | 'poetic_form' | 'ancient_book'

/**
 * 解析后的 URI 资源信息
 */
export interface ParsedUriResource {
  /** 资源类型 */
  type: DetailResourceType
  /** 资源 ID */
  id: string
  /** 诗文/古籍格式（仅 poem 和 ancient_book 类型有效） */
  format?: 'set' | 'txt' | 'object'
  /** 概念子类型（仅 concept 类型有效） */
  conceptType?: ConceptSubType
}

// ============================================================================
// 常量定义
// ============================================================================

const UNKNOWN_RESOURCE: ParsedUriResource = { type: 'unknown', id: '' }
const POEM_SET_PATTERNS = ['/poem/set/']
const POEM_TXT_PATTERNS = ['/poem/text/']
const PERSON_PATTERNS = ['/person/', '/persons/']
const ANCIENT_BOOK_PATTERNS = ['/ancient-book/', '/ancient-books/', '/ancient-book-']
const ANCIENT_BOOK_SET_PATTERNS = ['/set/', '/sets/', '-sets/']
const ANCIENT_BOOK_TXT_PATTERNS = ['/text/', '/texts/', '-texts/']
const ANCIENT_BOOK_OBJECT_PATTERNS = ['/object/', '/objects/', '-objects/']
const BOOK_PATTERNS = ['/book/', '/books/', '/marc/']
const PLACE_PATTERNS = ['/place/', '/places/']
const CONCEPT_PATTERNS = ['/concept/', '/concepts/']
const RHYME_PATTERNS = ['/rhyme', 'rhyme']
const POETIC_FORM_PATTERNS = ['/poetic_form', 'poetic-form']
const ANCIENT_BOOK_CONCEPT_PATTERNS = ['/concept/ancient-book', '/ancient-book/concept']

// ============================================================================
// 私有实现
// ============================================================================

function includesAny(source: string, patterns: string[]): boolean {
  return patterns.some((pattern) => source.includes(pattern))
}

function parsePoemFormat(normalized: string): 'set' | 'txt' {
  return includesAny(normalized, POEM_TXT_PATTERNS) ? 'txt' : 'set'
}

function parseAncientBookFormat(normalized: string): ParsedUriResource['format'] {
  if (includesAny(normalized, ANCIENT_BOOK_SET_PATTERNS)) return 'set'
  if (includesAny(normalized, ANCIENT_BOOK_TXT_PATTERNS)) return 'txt'
  if (includesAny(normalized, ANCIENT_BOOK_OBJECT_PATTERNS)) return 'object'
  return undefined
}

function parseConceptType(normalized: string): ConceptSubType | undefined {
  if (includesAny(normalized, RHYME_PATTERNS)) return 'rhyme'
  if (includesAny(normalized, POETIC_FORM_PATTERNS)) return 'poetic_form'
  if (includesAny(normalized, ANCIENT_BOOK_CONCEPT_PATTERNS)) return 'ancient_book'
  return undefined
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 解析 URI 资源信息
 * @param uri 实体 URI
 * @returns 解析后的资源信息
 *
 * @example
 * ```ts
 * parseUriResource('/poem/set/abc.json')
 * // => { type: 'poem', id: 'abc', format: 'set' }
 *
 * parseUriResource('/person/123')
 * // => { type: 'person', id: '123' }
 *
 * parseUriResource('/book/001')
 * // => { type: 'book', id: '001' }
 *
 * parseUriResource('/place/changan')
 * // => { type: 'place', id: 'changan' }
 * ```
 */
export function parseUriResource(uri: string): ParsedUriResource {
  const normalized = String(uri || '').trim()
  if (!normalized) return UNKNOWN_RESOURCE

  const fileName = normalized.split(/[?#]/, 1)[0].split('/').pop() || ''
  const id = fileName.replace(/\.json$/i, '')

  // 检测诗文类型
  if (includesAny(normalized, [...POEM_SET_PATTERNS, ...POEM_TXT_PATTERNS])) {
    return { type: 'poem', id, format: parsePoemFormat(normalized) }
  }

  // 检测人物类型
  if (includesAny(normalized, PERSON_PATTERNS)) {
    return { type: 'person', id }
  }

  // 检测古籍类型（支持 /ancient_book/ 和 /ancient-book/ 路径）
  if (includesAny(normalized, ANCIENT_BOOK_PATTERNS)) {
    const format = parseAncientBookFormat(normalized)
    return format ? { type: 'ancient_book', id, format } : { type: 'ancient_book', id }
  }

  // 检测图书类型（支持 /marc/ 路径）
  if (includesAny(normalized, BOOK_PATTERNS)) {
    return { type: 'book', id }
  }

  // 检测地点类型
  if (includesAny(normalized, PLACE_PATTERNS)) {
    return { type: 'place', id }
  }

  // 检测概念类型
  if (includesAny(normalized, CONCEPT_PATTERNS)) {
    const conceptType = parseConceptType(normalized)
    return conceptType ? { type: 'concept', id, conceptType } : { type: 'concept', id }
  }

  return { type: 'unknown', id }
}
