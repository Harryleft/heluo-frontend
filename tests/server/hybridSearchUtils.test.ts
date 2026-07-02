import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SEARCH_TYPES,
  computeHybridScore,
  parseSearchTypes,
  rerankSearchCandidates,
} from '../../server/src/search/hybridSearchUtils.js'

describe('hybridSearchUtils', () => {
  describe('parseSearchTypes', () => {
    it('type=all 时返回完整类型列表', () => {
      expect(parseSearchTypes('all')).toEqual(DEFAULT_SEARCH_TYPES)
    })

    it('空字符串时返回完整类型列表', () => {
      expect(parseSearchTypes('')).toEqual(DEFAULT_SEARCH_TYPES)
    })

    it('过滤非法类型并保留合法类型顺序', () => {
      expect(parseSearchTypes('poem,invalid,person')).toEqual(['poem', 'person'])
    })
  })

  describe('computeHybridScore', () => {
    it('标题精确命中应得到更高综合分', () => {
      const exact = computeHybridScore({
        query: '杜甫',
        title: '杜甫',
        snippet: '唐代诗人',
        id: '17270',
        score: 0.35,
        confidence: 0.05,
      })

      const vectorOnly = computeHybridScore({
        query: '杜甫',
        title: '山居秋暝',
        snippet: '王维代表作',
        id: 'poem_001',
        score: 0.95,
        confidence: 0.05,
      })

      expect(exact.finalScore).toBeGreaterThan(vectorOnly.finalScore)
    })

    it('空文本输入时不应抛错并返回可比较分数', () => {
      const result = computeHybridScore({
        query: '杜甫',
        title: '',
        snippet: '',
        id: '',
        score: 0,
        confidence: 0,
      })

      expect(result.finalScore).toBeGreaterThanOrEqual(0)
      expect(result.finalScore).toBeLessThanOrEqual(1)
    })
  })

  describe('rerankSearchCandidates', () => {
    it('应按混合分数降序排序', () => {
      const ranked = rerankSearchCandidates(
        [
          {
            id: 'poem_001',
            title: '春望',
            snippet: '国破山河在',
            score: 0.95,
            confidence: 0.04,
          },
          {
            id: '17270',
            title: '杜甫',
            snippet: '唐代伟大的现实主义诗人',
            score: 0.35,
            confidence: 0.02,
          },
        ],
        '杜甫',
      )

      expect(ranked[0]?.id).toBe('17270')
      expect(ranked[0]?._scoreDetail?.finalScore).toBeGreaterThanOrEqual(ranked[1]?._scoreDetail?.finalScore ?? 0)
    })
  })
})
