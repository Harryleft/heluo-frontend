/**
 * 答案构建模块
 *
 * 负责构建融合查询的答案和侧边栏数据，
 * 包含模板答案生成与引用项构建。
 *
 * @module server/src/domain/fusion/answerBuilder
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

// ============================================================================
// 详情链接构建
// ============================================================================

/**
 * 创建融合详情链接
 *
 * @param {string} uri - 文档 URI
 * @param {string} query - 查询文本
 * @returns {string} 详情页 URL
 */
export function createFusionDetailLink(uri, query) {
  const params = new URLSearchParams({ uri: String(uri || '') })
  const safeQuery = String(query || '').trim()
  if (safeQuery) params.set('q', safeQuery)
  return `/details?${params.toString()}`
}

/**
 * 创建 IIIF 开放链接
 *
 * @param {string} manifest - Manifest URL
 * @param {string} canvasId - Canvas ID
 * @returns {string} IIIF 查看器 URL
 */
export function createFusionIiifOpenUrl(manifest, canvasId = '') {
  const params = new URLSearchParams({ manifest: String(manifest || '') })
  if (canvasId) params.set('canvas', canvasId)
  return `/iiif?${params.toString()}`
}

// ============================================================================
// 文本处理
// ============================================================================

/**
 * 为 LLM 截断文本
 *
 * @param {string} value - 原始文本
 * @param {number} maxLength - 最大长度
 * @returns {string} 截断后的文本
 */
export function trimFusionTextForLlm(value, maxLength = 1200) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}……`
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
 * 构建融合诗文上下文
 *
 * @param {object} row - 搜索结果行
 * @returns {object} 诗文上下文对象
 */
export function buildFusionPoemContext(row) {
  const type = normalizeText(row?._scope || row?.type || '').toLowerCase()
  const doc = row?._doc && typeof row._doc === 'object' ? row._doc : null

  const rawPoemText = String(row?.fullText || '').trim()
  const rawPoemAuthor = String(row?.author || row?.author_name || doc?.author_name || doc?.author || '').trim()
  const rawPoemDynasty = String(row?.dynasty || doc?.dynasty || '').trim()
  const rawPoemIntro = String(row?.intro || doc?.intro || '').trim()

  if (type !== 'poem' && !rawPoemText) {
    return {}
  }

  const output = {}
  if (rawPoemText) output.poemText = trimFusionTextForLlm(rawPoemText, 1600)
  if (rawPoemAuthor) output.poemAuthor = trimFusionTextForLlm(rawPoemAuthor, 80)
  if (rawPoemDynasty) output.poemDynasty = trimFusionTextForLlm(rawPoemDynasty, 40)
  if (rawPoemIntro) output.poemIntro = trimFusionTextForLlm(rawPoemIntro, 400)
  return output
}

// ============================================================================
// 答案文本构建
// ============================================================================

/**
 * 构建融合答案文本
 *
 * @param {string} query - 查询文本
 * @param {Array} entities - 实体数组
 * @param {string[]} dims - 维度数组
 * @returns {string} 答案文本
 */
export function buildFusionAnswerText(query, entities, dims) {
  if (!entities.length) return '当前未命中稳定证据，请尝试更具体的问题。'
  const topTitles = entities
    .slice(0, 3)
    .map((item) => item.title || '未命名条目')
    .join('、')
  const dimText = dims.join('、')
  return `围绕"${query}"在 ${dimText} 维度共命中 ${entities.length} 条候选，重点线索包括：${topTitles}。`
}

/**
 * 构建融合侧边栏项目
 *
 * @param {Array} citations - 引用数组
 * @param {Array} iiifMatches - IIIF 匹配数组
 * @returns {Array} 侧边栏项目数组
 */
export function buildFusionSidebarItems(citations = [], iiifMatches = []) {
  const citationItems = citations.slice(0, 6).map((item, index) => ({
    itemId: `citation-${index + 1}`,
    itemType: 'citation',
    title: item.title || '未命名证据',
    snippet: item.snippet || '暂无摘要',
    link: createFusionDetailLink(item.uri, ''),
  }))

  const iiifItems = iiifMatches.slice(0, 3).map((item, index) => ({
    itemId: `iiif-${index + 1}`,
    itemType: 'iiif',
    title: item.canvasLabel || 'IIIF Canvas',
    snippet: item.segmentText || '命中相关影像片段',
    link: item.openUrl,
  }))

  return [...citationItems, ...iiifItems]
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  createFusionDetailLink,
  createFusionIiifOpenUrl,
  trimFusionTextForLlm,
  buildFusionPoemContext,
  buildFusionAnswerText,
  buildFusionSidebarItems,
}
