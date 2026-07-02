/**
 * 相关度计算工具
 *
 * 用于计算资源的相关度等级
 *
 * @module relevanceUtils
 */

import type { RelevanceConfig } from '@/features/details/types/overviewTab'
import { RELEVANCE_THRESHOLDS } from '@/features/details/constants/overviewConstants'

/**
 * 获取相关度等级配置
 *
 * @param score - 原始分数
 * @param scoreDetail - 分数详情（可选）
 * @returns 相关度配置
 */
export function getRelevanceLevel(
  score: number,
  scoreDetail?: { finalScore?: number } | null,
): RelevanceConfig {
  const rawScore = scoreDetail?.finalScore ?? score
  const normalizedScore = Math.max(0, Math.min(1, rawScore))

  for (const { min, config } of RELEVANCE_THRESHOLDS) {
    if (normalizedScore >= min) {
      return config
    }
  }

  return RELEVANCE_THRESHOLDS[RELEVANCE_THRESHOLDS.length - 1].config
}

