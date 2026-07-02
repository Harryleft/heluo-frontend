/**
 * 结果合并模块
 *
 * 负责多来源搜索结果的合并、去重和排序。
 * 支持 RRF (Reciprocal Rank Fusion) 算法进行混合搜索结果合并。
 *
 * @module server/src/domain/retrieval/resultMerger
 */

import { searchConfig } from '../../bootstrap/config.js'

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 安全转换为浮点数
 *
 * @param {any} value - 输入值
 * @returns {number} 浮点数（无效值返回 0）
 */
function safeFloat(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

/**
 * 规范化文本（移除多余空白）
 *
 * @param {any} value - 输入值
 * @returns {string} 规范化后的文本
 */
function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

/**
 * 规范化实体 ID
 *
 * @param {string} value - 输入值
 * @returns {string} 规范化后的 ID
 */
function normalizeEntityId(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('/')) {
    return text.split('/').pop()?.replace(/\.json$/i, '') || ''
  }
  return text.replace(/\.json$/i, '')
}

// ============================================================================
// 合并键生成
// ============================================================================

/**
 * 提取诗文的合并 ID
 *
 * @param {object} row - 搜索结果行
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
 * 构建混合搜索的合并键
 *
 * @param {object} row - 搜索结果行
 * @param {string} scope - 实体类型
 * @returns {string} 合并键
 */
export function buildHybridMergeKey(row, scope = '') {
  const normalizedScope = String(scope || '').trim().toLowerCase()
  if (normalizedScope === 'poem') {
    const poemMergeId = extractPoemMergeId(row)
    if (poemMergeId) return `poem:${poemMergeId}`
  }

  const uri = String(row?.uri || '').trim()
  if (uri) return `uri:${uri}`

  const id = String(row?.id || '').trim()
  if (id) return `id:${id}`

  return ''
}

// ============================================================================
// 合并算法
// ============================================================================

/**
 * 计算 keyword 模式下的基础分数
 *
 * @param {object} row - 搜索结果行
 * @returns {number} 基础分数
 */
function toKeywordBaseScore(row) {
  return Number(row?.score || 0) + Number(row?.confidence || 0)
}

/**
 * 按 URI 合并搜索结果行
 *
 * @param {Array} rows - 搜索结果行数组
 * @returns {Array} 合并后的结果数组
 */
export function mergeRowsByUri(rows = []) {
  const merged = new Map()
  for (const row of rows) {
    const uri = String(row?.uri || '').trim()
    if (!uri) continue
    const score = safeFloat(row?.score) + safeFloat(row?.confidence)
    const current = merged.get(uri)
    if (!current || score > safeFloat(current._merge_score)) {
      merged.set(uri, { ...row, _merge_score: score })
    }
  }
  return Array.from(merged.values())
}

/**
 * 使用 RRF 算法合并关键字和向量搜索结果
 *
 * RRF (Reciprocal Rank Fusion) 是一种简单高效的混合搜索合并算法：
 * - 对每个列表中的结果按排名计算 RRF 分数
 * - 同一结果在多个列表中出现时，RRF 分数累加
 * - 最终按累加后的 RRF 分数排序
 *
 * @param {Array} keywordRows - 关键字搜索结果
 * @param {Array} vectorRows - 向量搜索结果
 * @param {number} pageLength - 返回结果数量
 * @param {string} scope - 实体类型
 * @returns {Array} 合并后的结果数组
 */
export function mergeHybridRowsByRrf(keywordRows = [], vectorRows = [], pageLength = 20, scope = '') {
  const merged = new Map()
  const safeRrfK = Math.max(1, searchConfig.hybridRrfK)

  // 处理关键字搜索结果
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

  // 处理向量搜索结果
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
      const rrfGap = Number(b.rrfScore || 0) - Number(a.rrfScore || 0)
      if (Math.abs(rrfGap) > 1e-12) return rrfGap
      const vectorGap = Number(b.vectorScore || 0) - Number(a.vectorScore || 0)
      if (Math.abs(vectorGap) > 1e-12) return vectorGap
      return Number(b.keywordScore || 0) - Number(a.keywordScore || 0)
    })
    .slice(0, pageLength)
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  buildHybridMergeKey,
  mergeRowsByUri,
  mergeHybridRowsByRrf,
}
