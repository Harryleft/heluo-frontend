/**
 * 混合检索器
 *
 * 融合关键词检索和向量检索的结果，使用 RRF (Reciprocal Rank Fusion) 算法进行排序。
 *
 * @module server/src/infra/retrievers/hybridRetriever
 */

import { BaseRetriever } from './baseRetriever.js'
import { KeywordRetriever } from './keywordRetriever.js'
import { VectorRetriever } from './vectorRetriever.js'

// ============================================================================
// RRF 融合辅助函数
// ============================================================================

/**
 * 提取诗词合并 ID
 *
 * @param {object} row - 结果行
 * @returns {string} 合并 ID
 */
function extractPoemMergeId(row) {
  const poemId = String(row?.poemId || '').trim()
  if (poemId && /^\d+$/.test(poemId)) {
    return `poem_${poemId}`
  }

  const id = String(row?.id || '').trim()
  const idMatch = id.match(/poem_(\d+)(?:_\d+)?$/i)
  if (idMatch) {
    return `poem_${idMatch[1]}`
  }

  const uri = String(row?.uri || '').trim()
  const uriMatch = uri.match(/poem_(\d+)(?:_\d+)?\.json$/i)
  if (uriMatch) {
    return `poem_${uriMatch[1]}`
  }

  return ''
}

/**
 * 构建混合合并键
 *
 * @param {object} row - 结果行
 * @param {string} scope - 实体类型
 * @returns {string} 合并键
 */
function buildHybridMergeKey(row, scope = '') {
  const normalizedScope = String(scope || '').trim().toLowerCase()

  // 诗词类型使用 poemId 作为合并键
  if (normalizedScope === 'poem') {
    const poemMergeId = extractPoemMergeId(row)
    if (poemMergeId) return `poem:${poemMergeId}`
  }

  // 其他类型使用 URI 或 ID
  const uri = String(row?.uri || '').trim()
  if (uri) return `uri:${uri}`

  const id = String(row?.id || '').trim()
  if (id) return `id:${id}`

  return ''
}

/**
 * 计算关键词基础分数
 *
 * @param {object} row - 结果行
 * @returns {number} 分数
 */
function toKeywordBaseScore(row) {
  return Number(row?.score || 0) + Number(row?.confidence || 0)
}

/**
 * 使用 RRF 算法合并关键词和向量结果
 *
 * RRF (Reciprocal Rank Fusion) 公式: score = 1 / (k + rank)
 * 其中 k 通常为 60
 *
 * @param {Array} keywordRows - 关键词结果
 * @param {Array} vectorRows - 向量结果
 * @param {number} pageLength - 返回数量
 * @param {string} scope - 实体类型
 * @param {number} rrfK - RRF K 参数
 * @returns {Array} 合并后的结果
 */
function mergeHybridRowsByRrf(keywordRows = [], vectorRows = [], pageLength = 20, scope = '', rrfK = 60) {
  const merged = new Map()
  const safeRrfK = Math.max(1, rrfK)

  // 处理关键词结果
  keywordRows
    .slice()
    .sort((a, b) => toKeywordBaseScore(b) - toKeywordBaseScore(a))
    .forEach((row, index) => {
      const mergeKey = buildHybridMergeKey(row, scope)
      if (!mergeKey) return

      const rank = index + 1
      const rrf = 1 / (safeRrfK + rank)
      const keywordScore = toKeywordBaseScore(row) / 2
      const existing = merged.get(mergeKey)

      if (!existing) {
        merged.set(mergeKey, {
          ...row,
          keywordScore,
          vectorScore: 0,
          keywordRank: rank,
          vectorRank: 0,
          rrfScore: rrf,
          source: 'keyword',
        })
        return
      }

      existing.keywordScore = Math.max(Number(existing.keywordScore || 0), keywordScore)
      existing.keywordRank = existing.keywordRank || rank
      existing.rrfScore = Number(existing.rrfScore || 0) + rrf
      existing.source = 'hybrid'
    })

  // 处理向量结果
  vectorRows
    .slice()
    .sort((a, b) => Number(b?.vectorScore || b?.similarity || 0) - Number(a?.vectorScore || a?.similarity || 0))
    .forEach((row, index) => {
      const mergeKey = buildHybridMergeKey(row, scope)
      if (!mergeKey) return

      const rank = index + 1
      const rrf = 1 / (safeRrfK + rank)
      const vectorScore = Number(row?.vectorScore || row?.similarity || 0)
      const existing = merged.get(mergeKey)

      if (!existing) {
        merged.set(mergeKey, {
          ...row,
          keywordScore: 0,
          vectorScore,
          keywordRank: 0,
          vectorRank: rank,
          rrfScore: rrf,
          source: 'vector',
        })
        return
      }

      existing.vectorScore = Math.max(Number(existing.vectorScore || 0), vectorScore)
      existing.vectorRank = existing.vectorRank || rank
      existing.rrfScore = Number(existing.rrfScore || 0) + rrf
      existing.source = 'hybrid'

      // 补充缺失的字段
      if (!existing.title && row.title) existing.title = row.title
      if (!existing.snippet && row.snippet) existing.snippet = row.snippet
    })

  // 排序并返回
  return Array.from(merged.values())
    .map((row) => ({
      ...row,
      score: Number((row.rrfScore || 0).toFixed(6)),
      confidence: 0,
      hybridScore: Number((row.rrfScore || 0).toFixed(6)),
    }))
    .sort((a, b) => {
      // 主排序：RRF 分数
      const rrfGap = Number(b.rrfScore || 0) - Number(a.rrfScore || 0)
      if (Math.abs(rrfGap) > 1e-12) return rrfGap

      // 次排序：向量分数
      const vectorGap = Number(b.vectorScore || 0) - Number(a.vectorScore || 0)
      if (Math.abs(vectorGap) > 1e-12) return vectorGap

      // 最后排序：关键词分数
      return Number(b.keywordScore || 0) - Number(a.keywordScore || 0)
    })
    .slice(0, pageLength)
}

// ============================================================================
// 混合检索器类
// ============================================================================

/**
 * 混合检索器
 *
 * 并行执行关键词和向量检索，使用 RRF 算法融合结果。
 */
export class HybridRetriever extends BaseRetriever {
  /**
   * @param {object} gateways - 网关依赖
   * @param {object} gateways.marklogic - MarkLogic 网关
   * @param {object} gateways.embedding - Embedding 网关
   * @param {object} config - 配置对象
   * @param {number} [config.rrfK=60] - RRF K 参数
   */
  constructor(gateways, config) {
    super(gateways, config)
    this.name = 'hybrid'
    this.rrfK = config.rrfK || 60

    // 创建内部检索器
    this.keywordRetriever = new KeywordRetriever(gateways, config)
    this.vectorRetriever = new VectorRetriever(gateways, config)
  }

  /**
   * 执行混合搜索
   *
   * 并行执行关键词和向量搜索，然后使用 RRF 融合结果。
   *
   * @param {string} query - 查询文本
   * @param {string} scope - 实体类型
   * @param {object} options - 搜索选项
   * @param {number} [options.pageLength=20] - 每页结果数
   * @returns {Promise<{rows: Array, total: number}>} 搜索结果
   */
  async search(query, scope, options = {}) {
    const { pageLength = 20 } = options

    try {
      // 并行执行两种搜索（获取 2 倍结果用于融合）
      const [keywordResult, vectorResult] = await Promise.all([
        this.keywordRetriever.search(query, scope, { pageLength: pageLength * 2 }),
        this.vectorRetriever.search(query, scope, { pageLength: pageLength * 2 }),
      ])

      // 使用 RRF 融合结果
      const rows = mergeHybridRowsByRrf(
        keywordResult.rows || [],
        vectorResult.rows || [],
        pageLength,
        scope,
        this.rrfK,
      )

      const total = Math.max(keywordResult.total, vectorResult.total, rows.length)

      return { rows, total }
    } catch (error) {
      console.error('[HybridRetriever] 混合搜索失败:', error.message)
      // 降级为关键词搜索
      return this.keywordRetriever.search(query, scope, { pageLength })
    }
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default HybridRetriever
