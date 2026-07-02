/**
 * 文本处理工具模块
 *
 * 提供统一的文本处理函数，避免在多个文件中重复定义。
 * 从 app.js 重构迁移时提取的公共函数。
 *
 * @module server/src/utils/textUtils
 */

// ============================================================================
// 文本规范化
// ============================================================================

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
 * 提取标记文本（带截断）
 *
 * @param {any} raw - 原始值
 * @param {number} limit - 最大长度，默认 180
 * @returns {string} 截断后的文本
 */
export function extractMarkText(raw, limit = 180) {
  return normalizeText(raw).slice(0, limit)
}

// ============================================================================
// URI 处理
// ============================================================================

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

// ============================================================================
// 文档处理
// ============================================================================

/**
 * 提取文档文本内容
 *
 * @param {object} doc - 文档对象
 * @returns {string} 文本内容
 */
export function extractDocText(doc) {
  if (!doc || typeof doc !== 'object') return ''

  const textSources = ['text_norm_zh', 'text_norm', 'text', 'content', 'description', '_label']

  for (const key of textSources) {
    const value = doc[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (Array.isArray(value)) {
      const lines = value.map((item) => String(item || '').trim()).filter(Boolean)
      if (lines.length) return lines.join('\n')
    }
  }
  return ''
}

/**
 * 获取行标题
 *
 * @param {object} row - 行数据
 * @param {object} doc - 文档数据
 * @returns {string} 标题
 */
export function pickRowTitle(row, doc = null) {
  // 优先从文档获取标题
  const docTitle = doc?._label || doc?.label || doc?.name || doc?.title
  if (typeof docTitle === 'string' && docTitle.trim()) return docTitle.trim()

  // 其次从行数据获取
  const rowTitle = row?.title || row?.name || row?._label
  if (typeof rowTitle === 'string' && rowTitle.trim()) return rowTitle.trim()

  // 最后从 URI 提取
  const uri = String(row?.uri || '')
  if (uri) {
    const lastSegment = uri.split('/').pop() || ''
    return lastSegment.replace(/\.json$/i, '') || uri
  }
  return '未命名条目'
}

// ============================================================================
// 节点标签提取
// ============================================================================

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

  // 检查 identified_by 数组
  const identified = Array.isArray(node.identified_by) ? node.identified_by : []
  for (const row of identified) {
    if (row && typeof row === 'object' && typeof row.content === 'string' && row.content.trim()) {
      return row.content.trim()
    }
  }
  return ''
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  normalizeText,
  extractMarkText,
  extractIdFromUri,
  extractDocText,
  pickRowTitle,
  pickNodeLabel,
}
