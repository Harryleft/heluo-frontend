/**
 * 混合搜索工具模块
 *
 * 提供搜索结果的混合评分和重排序功能：
 * - 向量相似度评分
 * - 词法匹配评分
 * - 精确匹配加分
 * - 前缀匹配加分
 */

// ============================================================================
// 常量定义
// ============================================================================

export const DEFAULT_SEARCH_TYPES = Object.freeze([
  'person',
  'poem',
  'book',
  'ancient_book',
  'place',
  'concept',
  'iiif',
])

const TYPE_SET = new Set(DEFAULT_SEARCH_TYPES)

// ============================================================================
// 私有实现 - 工具函数
// ============================================================================

function clamp(value, min = 0, max = 1) {
  const num = Number(value)
  if (!Number.isFinite(num)) return min
  return Math.min(max, Math.max(min, num))
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function tokenizeQuery(query) {
  const normalized = normalizeText(query)
  if (!normalized) return []
  const tokens = normalized.split(' ').map((item) => item.trim()).filter(Boolean)
  if (tokens.length > 0) return tokens
  return [normalized]
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 解析搜索类型参数。
 */
export function parseSearchTypes(typeStr) {
  const normalized = String(typeStr || '').trim()
  if (!normalized || normalized === 'all') return [...DEFAULT_SEARCH_TYPES]
  const types = normalized
    .split(',')
    .map((item) => item.trim())
    .filter((item) => TYPE_SET.has(item))
  return types.length > 0 ? types : [...DEFAULT_SEARCH_TYPES]
}

/**
 * 计算单条候选的混合分数。
 *
 * 修正：支持真正的向量相似度分数
 * @param {object} params - 评分参数
 * @param {string} params.query - 查询文本
 * @param {string} params.title - 文档标题
 * @param {string} params.snippet - 文档摘要
 * @param {string} params.id - 文档ID
 * @param {number} params.score - 关键字相关性分数
 * @param {number} params.confidence - 置信度
 * @param {number} params.vectorScore - 真正的向量相似度分数 (0-1)，可选
 * @param {string} params.source - 结果来源 ('keyword' | 'vector' | 'hybrid')
 */
export function computeHybridScore({ query, title, snippet, id, score, confidence, vectorScore, source }) {
  const queryText = normalizeText(query)
  const titleText = normalizeText(title)
  const snippetText = normalizeText(snippet)
  const idText = normalizeText(id)
  const mergedText = `${titleText} ${snippetText} ${idText}`.trim()

  // 修正：根据数据来源确定向量分数
  let vector = 0
  if (typeof vectorScore === 'number' && Number.isFinite(vectorScore)) {
    // 如果提供了真正的向量相似度，优先使用
    vector = clamp(vectorScore)
  } else if (source === 'vector') {
    // 来自向量搜索，使用 score 作为相似度
    vector = clamp(Number(score || 0))
  } else {
    // 来自关键字搜索，使用传统计算方式（向后兼容）
    const vectorRaw = Number(score || 0) + Number(confidence || 0)
    vector = clamp(vectorRaw / 2)
  }

  const exact = queryText && (titleText === queryText || idText === queryText) ? 1 : 0
  const prefix = queryText && (titleText.startsWith(queryText) || idText.startsWith(queryText)) ? 1 : 0

  let lexical = 0
  if (queryText) {
    if (titleText.includes(queryText)) lexical += 0.6
    if (snippetText.includes(queryText)) lexical += 0.25
    if (idText.includes(queryText)) lexical += 0.15
  }

  const tokens = tokenizeQuery(queryText)
  if (tokens.length > 0 && mergedText) {
    const matchedCount = tokens.filter((token) => mergedText.includes(token)).length
    const tokenCoverage = matchedCount / tokens.length
    lexical = Math.max(lexical, tokenCoverage)
  }
  lexical = clamp(lexical)

  const finalScore = Number((0.55 * vector + 0.25 * lexical + 0.15 * exact + 0.05 * prefix).toFixed(6))
  return {
    finalScore,
    vector,
    lexical,
    exact,
    prefix,
    vectorRaw: Number(vector.toFixed(6)),
    source: source || 'keyword',
  }
}

/**
 * 对候选结果进行混合重排。
 *
 * 修正：支持向量搜索结果
 * @param {Array} candidates - 候选结果
 * @param {string} query - 查询文本
 * @param {object} options - 选项
 * @param {boolean} options.hasVectorScore - 是否包含真正的向量分数
 */
export function rerankSearchCandidates(candidates, query, options = {}) {
  const rows = Array.isArray(candidates) ? candidates : []
  const { hasVectorScore = false } = options

  return rows
    .map((row) => {
      // 确定向量分数和来源
      let vectorScore = undefined
      let source = 'keyword'

      if (hasVectorScore && typeof row?.vectorScore === 'number') {
        vectorScore = row.vectorScore
        source = row?.source || 'vector'
      } else if (row?.source === 'vector') {
        // 来自向量搜索，similarity 是真正的向量相似度
        vectorScore = row?.similarity
        source = 'vector'
      } else if (row?.source === 'hybrid') {
        // 来自混合搜索，vectorScore 是真正的向量相似度
        source = 'hybrid'
        vectorScore = row?.vectorScore
      }

      const scoreDetail = computeHybridScore({
        query,
        title: row?.title || row?._label || row?.name || '',
        snippet: row?.snippet || '',
        id: row?.id || '',
        score: row?.score,
        confidence: row?.confidence,
        vectorScore,
        source,
      })
      return {
        ...row,
        _scoreDetail: scoreDetail,
      }
    })
    .sort((a, b) => {
      const scoreGap = (b?._scoreDetail?.finalScore || 0) - (a?._scoreDetail?.finalScore || 0)
      if (Math.abs(scoreGap) > 1e-9) return scoreGap
      // 分数相同时，优先向量来源
      if ((a?.source === 'vector') !== (b?.source === 'vector')) {
        return a?.source === 'vector' ? -1 : 1
      }
      return (b?._scoreDetail?.vectorRaw || 0) - (a?._scoreDetail?.vectorRaw || 0)
    })
}
