/**
 * 候选重排序模块
 *
 * 负责对融合搜索候选结果进行重排序，
 * 结合作用域权重和来源评分。
 *
 * @module server/src/domain/fusion/candidateReranker
 */

import { rerankSearchCandidates } from '../../search/hybridSearchUtils.js'
import { searchConfig } from '../../bootstrap/config.js'
import {
  inferFusionPreferredScope,
  computeFusionScopeBoostMap,
  extractFusionSlots,
} from './queryPlanner.js'

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

function containsAny(text, tokens = []) {
  if (!text || !Array.isArray(tokens) || tokens.length === 0) return false
  return tokens.some((token) => text.includes(normalizeText(token)))
}

function containsExactTitle(title, tokens = []) {
  const normalizedTitle = normalizeText(title)
  if (!normalizedTitle || !Array.isArray(tokens) || tokens.length === 0) return false
  return tokens.some((token) => normalizedTitle === normalizeText(token))
}

// ============================================================================
// 重排序函数
// ============================================================================

/**
 * 对融合候选进行重排序
 *
 * @param {Array} candidates - 候选结果数组
 * @param {string} rankingQuery - 排序查询文本
 * @param {string} rawQuery - 原始查询文本
 * @param {number} topK - 返回数量
 * @returns {Array} 重排序后的候选数组
 */
export function rerankFusionCandidates(candidates = [], rankingQuery = '', rawQuery = '', topK = 12, plan = null) {
  const hasVectorScore = searchConfig.mode === 'vector' || searchConfig.mode === 'hybrid'
  const baseRanked = rerankSearchCandidates(candidates, rankingQuery, { hasVectorScore })
  if (!baseRanked.length) return []

  const boosts = computeFusionScopeBoostMap(rawQuery)
  const preferredScope = inferFusionPreferredScope(rawQuery)
  const slots = plan?.slots || extractFusionSlots(rawQuery, [])

  // 应用作用域加权
  const boostedRanked = baseRanked
    .map((row) => {
      const scope = String(row?._scope || '').trim().toLowerCase()
      const boost = boosts[scope] || 1
      const baseScore = Number(row?._scoreDetail?.finalScore || 0)
      const scopedScore = Number((baseScore * boost).toFixed(6))

      const searchableText = normalizeText([
        row?.title,
        row?.snippet,
        row?.uri,
        row?._graphUri,
      ].filter(Boolean).join(' '))

      const whoMatched = containsAny(searchableText, slots.who)
      const whenMatched = containsAny(searchableText, slots.when)
      const whereMatched = containsAny(searchableText, slots.where)
      const topicMatched = containsAny(searchableText, [...(slots.what || []), ...(slots.how || [])])
      const titleMatched = containsExactTitle(row?.title, slots.title)

      const whoBoost = slots.who?.length ? (whoMatched ? 0.16 : 0) : 0
      const whenBoost = slots.when?.length ? (whenMatched ? 0.08 : 0) : 0
      const whereBoost = slots.where?.length ? (whereMatched ? 0.08 : 0) : 0
      const topicBoost = (slots.what?.length || slots.how?.length) ? (topicMatched ? 0.05 : 0) : 0
      const titleBoost = slots.title?.length ? (titleMatched ? 0.3 : 0) : 0

      const driftPenalty = slots.who?.length && scope === 'person' && !whoMatched ? 0.12 : 0
      const titlePenalty = slots.title?.length && scope === 'poem' && !titleMatched ? 0.08 : 0
      const finalScore = Number(
        Math.max(0, scopedScore + whoBoost + whenBoost + whereBoost + topicBoost + titleBoost - driftPenalty - titlePenalty).toFixed(6),
      )

      return {
        ...row,
        _scoreDetail: {
          ...(row?._scoreDetail || {}),
          baseFinalScore: baseScore,
          scopeBoost: boost,
          finalScore,
          constraintBreakdown: {
            whoBoost,
            whenBoost,
            whereBoost,
            topicBoost,
            titleBoost,
            driftPenalty,
            titlePenalty,
            whoMatched,
            whenMatched,
            whereMatched,
            topicMatched,
            titleMatched,
          },
        },
      }
    })
    .sort((a, b) => {
      const scoreGap = Number(b?._scoreDetail?.finalScore || 0) - Number(a?._scoreDetail?.finalScore || 0)
      if (Math.abs(scoreGap) > 1e-9) return scoreGap
      return Number(b?._scoreDetail?.vectorRaw || 0) - Number(a?._scoreDetail?.vectorRaw || 0)
    })

  if (!preferredScope) {
    return boostedRanked.slice(0, topK)
  }

  // 意图类型保底：避免全被单一高频来源挤占
  const preferredRowsRaw = boostedRanked.filter(
    (row) => String(row?._scope || '').trim().toLowerCase() === preferredScope,
  )
  const preferredRows = [...preferredRowsRaw]

  // 针对 poem 作用域的特殊排序
  if (preferredScope === 'poem') {
    preferredRows.sort((a, b) => {
      const aUri = String(a?.uri || '')
      const bUri = String(b?.uri || '')
      const aSnippet = normalizeText(a?.snippet || '')
      const bSnippet = normalizeText(b?.snippet || '')
      const aTitle = normalizeText(a?.title || '')
      const bTitle = normalizeText(b?.title || '')

      const aRichness =
        (aUri.includes('/poems-txt/') ? 2 : 0) +
        (aSnippet && aSnippet !== aTitle ? 1 : 0)
      const bRichness =
        (bUri.includes('/poems-txt/') ? 2 : 0) +
        (bSnippet && bSnippet !== bTitle ? 1 : 0)

      if (aRichness !== bRichness) return bRichness - aRichness
      return Number(b?._scoreDetail?.finalScore || 0) - Number(a?._scoreDetail?.finalScore || 0)
    })
  }

  if (!preferredRows.length) {
    return boostedRanked.slice(0, topK)
  }

  // 确保首选作用域有最小占比
  const preferredMinCount = Math.min(Math.ceil(topK / 3), preferredRows.length)
  const selected = preferredRows.slice(0, preferredMinCount)
  const selectedUriSet = new Set(selected.map((row) => String(row?.uri || '')))

  // 补充其他结果
  for (const row of boostedRanked) {
    if (selected.length >= topK) break
    const uri = String(row?.uri || '')
    if (selectedUriSet.has(uri)) continue
    selected.push(row)
    if (uri) selectedUriSet.add(uri)
  }

  return selected.slice(0, topK)
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  rerankFusionCandidates,
}
