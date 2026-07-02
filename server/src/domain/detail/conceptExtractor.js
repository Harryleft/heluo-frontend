/**
 * 概念详情提取模块
 *
 * 从 JSON-LD 文档中提取概念实体详细信息。
 *
 * @module server/src/domain/detail/conceptExtractor
 */

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 规范化文本
 *
 * @param {any} value - 输入值
 * @returns {string} 规范化后的文本
 */
function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

/**
 * 从 URI 提取资源 ID
 *
 * @param {string} uri - 文档 URI
 * @returns {string} 资源 ID
 */
function extractIdFromUri(uri) {
  if (!uri) return ''
  const segments = uri.split('/')
  const lastSegment = segments[segments.length - 1] || ''
  return lastSegment.replace(/\.json$/i, '')
}

/**
 * 提取标记文本（带截断）
 *
 * @param {any} raw - 原始值
 * @param {number} limit - 最大长度
 * @returns {string} 截断后的文本
 */
function extractMarkText(raw, limit = 180) {
  return normalizeText(raw).slice(0, limit)
}

/**
 * 从节点中提取标签
 *
 * @param {object|string} node - 节点对象或字符串
 * @returns {string} 标签文本
 */
function pickNodeLabel(node) {
  if (typeof node === 'string') return node.trim()
  if (!node || typeof node !== 'object') return ''
  for (const key of ['_label', 'content', 'label', 'name', 'title', '@value', 'value']) {
    const value = node[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  const identified = Array.isArray(node.identified_by) ? node.identified_by : []
  for (const row of identified) {
    if (row && typeof row === 'object' && typeof row.content === 'string' && row.content.trim()) {
      return row.content.trim()
    }
  }
  return ''
}

/**
 * 从文档中提取文本内容
 *
 * @param {object} doc - 文档对象
 * @returns {string} 提取的文本
 */
function extractDocText(doc) {
  if (!doc || typeof doc !== 'object') return ''
  const pickText = (value) => {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (Array.isArray(value)) {
      for (const item of value) {
        const text = pickText(item)
        if (text) return text
      }
    }
    if (value && typeof value === 'object') {
      for (const key of ['content', '_label', '@value', 'value', 'label', 'name', 'title']) {
        const text = pickText(value[key])
        if (text) return text
      }
    }
    return ''
  }
  for (const key of ['content', 'text_norm_zh', 'text_norm', 'text', 'description', 'title', 'name']) {
    const text = pickText(doc[key])
    if (text) return text
  }
  for (const key of ['identified_by', 'referred_to_by']) {
    const text = pickText(doc[key])
    if (text) return text
  }
  return ''
}

/**
 * 选取行标题
 *
 * @param {object} row - 搜索结果行
 * @param {object} doc - 文档对象
 * @returns {string} 标题
 */
function pickRowTitle(row, doc = null) {
  const blocked = new Set(['person', 'place', 'type', 'name', 'group', 'event', 'object', 'concept', 'set', 'work'])
  const normalize = (value) => {
    const text = normalizeText(value)
    if (!text) return ''
    if (blocked.has(text.toLowerCase().replace(/\s+/g, ''))) return ''
    return text
  }
  const extract = (value) => {
    if (!value || typeof value !== 'object') return ''
    for (const key of ['content', '_label', '@value', 'value', 'label', 'name', 'title', 'person_name', 'author_name']) {
      const text = normalize(value[key])
      if (text) return text
    }
    return ''
  }
  for (const source of [doc || {}, row || {}]) {
    for (const key of ['_label', 'title', 'name', 'label', 'person_name', 'author_name']) {
      const value = source[key]
      const direct = normalize(value)
      if (direct) return direct
      if (Array.isArray(value) && value.length > 0) {
        const first = typeof value[0] === 'string' ? normalize(value[0]) : extract(value[0])
        if (first) return first
      }
    }
    for (const key of ['identified_by', 'referred_to_by']) {
      const nested = source[key]
      if (Array.isArray(nested)) {
        for (const item of nested) {
          const text = extract(item)
          if (text) return text
        }
      } else {
        const text = extract(nested)
        if (text) return text
      }
    }
  }
  const uri = String(row?.uri || '')
  const stem = uri.split('/').pop()?.replace(/\.json$/i, '') || ''
  return stem || '未命名条目'
}

// ============================================================================
// 概念详情提取
// ============================================================================

/**
 * 从文档中提取概念详细信息（API v1 格式）
 *
 * @param {string} uri - 文档 URI
 * @param {object} doc - 文档对象
 * @returns {object|null} 概念详情对象或 null
 */
export function extractConceptDetail(uri, doc) {
  if (!doc) return null

  const title = pickRowTitle({ uri }, doc)

  // 提取概念类型
  let type = 'other'
  const classifiedAs = Array.isArray(doc.classified_as) ? doc.classified_as : [doc.classified_as]
  for (const item of classifiedAs) {
    if (item && typeof item === 'object') {
      const typeId = String(item.id || '')
      if (typeId.includes('rhyme') || typeId.includes('yun')) {
        type = 'rhyme'
      } else if (typeId.includes('form') || typeId.includes('ti')) {
        type = 'poetic_form'
      } else if (typeId.includes('ancient') || typeId.includes('gu')) {
        type = 'ancient_book_concept'
      }
    }
  }

  // 提取定义
  const definition = extractMarkText(extractDocText(doc), 300) || undefined

  // 提取上位概念 (broader)
  const broader = []
  const broaderNodes = Array.isArray(doc.broader) ? doc.broader : [doc.broader]
  for (const node of broaderNodes) {
    if (node && typeof node === 'object' && node.id) {
      broader.push({
        id: extractIdFromUri(node.id),
        label: pickNodeLabel(node) || extractIdFromUri(node.id),
        uri: node.id,
      })
    }
  }

  // 提取下位概念 (narrower)
  const narrower = []
  const narrowerNodes = Array.isArray(doc.narrower) ? doc.narrower : [doc.narrower]
  for (const node of narrowerNodes) {
    if (node && typeof node === 'object' && node.id) {
      narrower.push({
        id: extractIdFromUri(node.id),
        label: pickNodeLabel(node) || extractIdFromUri(node.id),
        uri: node.id,
      })
    }
  }

  return {
    id: extractIdFromUri(uri),
    label: title || '未命名概念',
    type,
    definition,
    broader: broader.length > 0 ? broader : undefined,
    narrower: narrower.length > 0 ? narrower : undefined,
    doc: doc && typeof doc === 'object' ? doc : {},
    uri,
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  extractConceptDetail,
}
