/**
 * 同名诗作比较证据回归测试
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'

describe('fusion poem compare evidence', () => {
  it('应将“几首《望岳》之间有何区别”识别为同名诗作比较题', async () => {
    const { buildFusionQueryPlan } = await import('../../server/src/domain/fusion/queryPlanner.js')

    const plan = buildFusionQueryPlan('几首《望岳》之间有何区别？', 'hybrid', ['poem'])

    expect(plan.compareSpec).toEqual({
      intent: 'poem_compare_by_title',
      title: '望岳',
    })
  })

  it('单首诗解读问题不应命中同名诗作比较意图', async () => {
    const { buildFusionQueryPlan } = await import('../../server/src/domain/fusion/queryPlanner.js')

    const plan = buildFusionQueryPlan('望岳这首诗讲了什么？', 'hybrid', ['poem'])

    expect(plan.compareSpec).toBeNull()
  })

  it('比较题应构建多首同题诗的正文优先主证据池', async () => {
    const { prepareFusionEvidence } = await import('../../server/src/usecases/fusionShared.js')

    const mockRows = [
      {
        uri: '/processed/json-ld/poem/set/wangyue-1.json',
        title: '望岳',
        fullText: '岱宗夫如何，齐鲁青未了。造化钟神秀，阴阳割昏晓。',
        author: '杜甫',
        dynasty: '唐',
        intro: '青年时期登临东岳所作。',
        score: 0.96,
        confidence: 0.96,
      },
      {
        uri: '/processed/json-ld/poem/set/wangyue-2.json',
        title: '望岳',
        fullText: '西岳崚嶒竦处尊，诸峰罗立似儿孙。',
        author: '杜甫',
        dynasty: '唐',
        intro: '晚年咏西岳华山所作。',
        score: 0.95,
        confidence: 0.95,
      },
      {
        uri: '/processed/json-ld/poem/set/wangyue-3.json',
        title: '望岳',
        fullText: '南岳配朱鸟，秩礼自百王。',
        author: '杜甫',
        dynasty: '唐',
        intro: '咏南岳衡山所作。',
        score: 0.94,
        confidence: 0.94,
      },
      {
        uri: '/processed/json-ld/poem/set/wangyue-1-copy.json',
        title: '望岳',
        fullText: '',
        author: '杜甫',
        dynasty: '唐',
        intro: '重复命中但缺少正文。',
        score: 0.93,
        confidence: 0.93,
      },
      {
        uri: '/processed/json-ld/poem/set/chunwang.json',
        title: '春望',
        fullText: '国破山河在，城春草木深。',
        author: '杜甫',
        dynasty: '唐',
        intro: '安史之乱背景下所作。',
        score: 0.9,
        confidence: 0.9,
      },
    ]

    const result = await prepareFusionEvidence({
      query: '几首《望岳》之间有何区别？',
      mode: 'hybrid',
      requestedDims: ['poem'],
      topK: 12,
      includeIiif: false,
      searchMode: 'hybrid',
      marklogicFetch: async () => ({ ok: true, json: async () => ({}) }),
      marklogicBaseUrl: 'http://127.0.0.1:8003',
      searchScopeData: async (queryText, scope) => {
        if (scope !== 'poem') return { rows: [] }
        return {
          rows: mockRows.map((item) => ({
            ...item,
            _scope: 'poem',
            _queryText: queryText,
          })),
        }
      },
      mlGetDoc: async () => ({}),
      settleVariants: false,
    })

    expect(result.queryPlan.compareSpec).toEqual({
      intent: 'poem_compare_by_title',
      title: '望岳',
    })
    expect(result.comparePoemEvidence).toHaveLength(3)
    expect(result.comparePoemEvidence.map((item) => item.uri)).toEqual([
      '/processed/json-ld/poem/set/wangyue-1.json',
      '/processed/json-ld/poem/set/wangyue-2.json',
      '/processed/json-ld/poem/set/wangyue-3.json',
    ])
    expect(result.comparePoemEvidence.every((item) => item.title === '望岳')).toBe(true)
    expect(result.comparePoemEvidence.every((item) => item.poemText && item.poemText.length > 0)).toBe(true)
  })
})
