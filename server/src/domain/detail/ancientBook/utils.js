/**
 * 古籍详情提取工具函数
 *
 * 提供通用的文本处理、ID 提取、标签选取等工具函数
 *
 * @module server/src/domain/detail/ancientBook/utils
 */

/**
 * 规范化文本
 *
 * @param {any} value - 输入值
 * @returns {string} 规范化后的文本
 */
export function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

/**
 * 从 URI 提取资源 ID
 *
 * @param {string} uri - 文档 URI
 * @returns {string} 资源 ID
 */
export function extractIdFromUri(uri) {
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
export function extractMarkText(raw, limit = 180) {
  return normalizeText(raw).slice(0, limit)
}

/**
 * 从节点中提取标签
 *
 * @param {object|string} node - 节点对象或字符串
 * @returns {string} 标签文本
 */
export function pickNodeLabel(node) {
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
export function extractDocText(doc) {
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
export function pickRowTitle(row, doc = null) {
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

/**
 * 从文档中提取候选 URI
 *
 * @param {object} raw - 文档对象
 * @param {number} limit - 最大数量
 * @returns {string[]} URI 数组
 */
export function extractCandidateUris(raw, limit = 40) {
  const queue = [raw]
  const seen = new Set()
  const output = []
  while (queue.length > 0 && output.length < limit) {
    const current = queue.shift()
    if (Array.isArray(current)) {
      queue.push(...current)
      continue
    }
    if (current && typeof current === 'object') {
      queue.push(...Object.values(current))
      continue
    }
    if (typeof current !== 'string') continue
    const text = current.trim()
    if (!text || seen.has(text)) continue
    if (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('/')) {
      seen.add(text)
      output.push(text)
    }
  }
  return output
}
