/**
 * 向量检索提速回归测试
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'
import { executeVectorSearch } from '../../../server/src/services/vectorSearchService.js'

interface MockResponseShape {
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}

function createJsonResponse(body: unknown, status = 200): MockResponseShape {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body
    },
    async text() {
      return JSON.stringify(body)
    },
  }
}

function parseUriParam(urlText: string): string {
  const parsed = new URL(urlText)
  return String(parsed.searchParams.get('uri') || '')
}

function buildPoemVectorDoc(poemId: number): Record<string, unknown> {
  const rank = Math.max(1, poemId)
  const primary = Math.max(0.31, 0.95 - rank * 0.08)
  return {
    scope: 'poem/set',
    entity_iri: `http://localhost:8000/poems/${poemId}`,
    text_norm: `诗文片段-${poemId}`,
    embedding: [primary, 0.1, 0.1],
  }
}

function createMarklogicFetchMockWithCounters() {
  const counters = {
    fullInfoFetchCount: 0,
    vectorDocFetchCount: 0,
    fullTextSearchCount: 0,
  }

  const vectorCandidateResults = Array.from({ length: 6 }, (_, index) => ({
    uri: `/processed/vector/poem/set/poem_${index + 1}.json`,
    score: 1,
    confidence: 0,
  }))

  const fetchMock = async (url: string, init: RequestInit = {}): Promise<MockResponseShape> => {
    const parsed = new URL(url)
    const pathname = parsed.pathname

    // 候选检索（POST /v1/search）
    if (pathname === '/v1/search' && String(init.method || 'GET').toUpperCase() === 'POST') {
      const bodyText = String(init.body || '')
      if (bodyText.includes('/processed/vector/poem/set/')) {
        return createJsonResponse({ total: 6, results: vectorCandidateResults })
      }
      if (bodyText.includes('/processed/vector/poem/text/')) {
        counters.fullTextSearchCount += 1
        return createJsonResponse({ total: 0, results: [] })
      }
      return createJsonResponse({ total: 0, results: [] })
    }

    // 关键词补充候选（GET /v1/search?directory=...）
    if (pathname === '/v1/search' && String(init.method || 'GET').toUpperCase() === 'GET') {
      return createJsonResponse({ total: 0, results: [] })
    }

    // 文档读取（GET /v1/documents）
    if (pathname === '/v1/documents') {
      const uri = decodeURIComponent(parseUriParam(url))

      if (uri.startsWith('/processed/vector/poem/set/')) {
        counters.vectorDocFetchCount += 1
        const poemId = Number(uri.match(/poem_(\d+)\.json/)?.[1] || 0)
        return createJsonResponse(buildPoemVectorDoc(poemId))
      }

      if (uri.startsWith('/processed/json-ld/poem/set/poem_')) {
        counters.fullInfoFetchCount += 1
        const poemId = Number(uri.match(/poem_(\d+)\.json/)?.[1] || 0)
        return createJsonResponse({
          _label: `诗题-${poemId}`,
          author_name: '杜甫',
          full_text: '',
          intro: '',
        })
      }

      return createJsonResponse({}, 404)
    }

    return createJsonResponse({}, 404)
  }

  return { fetchMock, counters }
}

describe('vectorSearchService speedup regression', () => {
  it('poem 向量检索应只对前置 TopN 执行详情补查', async () => {
    const { fetchMock, counters } = createMarklogicFetchMockWithCounters()
    const result = await executeVectorSearch(
      '/processed/vector/poem/set/',
      [1, 0, 0],
      {
        topK: 2,
        queryText: '杜甫现实关怀',
      },
      fetchMock as unknown as (...args: unknown[]) => Promise<unknown>,
      'http://mock-marklogic',
    )

    expect(result.length).toBe(2)
    // 期望不是对全部候选做补查（6），最多对 topK*2 做补查
    expect(counters.fullInfoFetchCount).toBeLessThanOrEqual(4)
    expect(counters.fullTextSearchCount).toBe(0)
  })

  it('重复查询应命中文档缓存减少向量文档读取', async () => {
    const { fetchMock, counters } = createMarklogicFetchMockWithCounters()

    await executeVectorSearch(
      '/processed/vector/poem/set/',
      [1, 0, 0],
      { topK: 2, queryText: '杜甫' },
      fetchMock as unknown as (...args: unknown[]) => Promise<unknown>,
      'http://mock-marklogic',
    )
    const firstReadCount = counters.vectorDocFetchCount

    await executeVectorSearch(
      '/processed/vector/poem/set/',
      [1, 0, 0],
      { topK: 2, queryText: '杜甫' },
      fetchMock as unknown as (...args: unknown[]) => Promise<unknown>,
      'http://mock-marklogic',
    )

    // 未做缓存时第二次会再读 6 条；做缓存后增量应明显更小
    expect(counters.vectorDocFetchCount - firstReadCount).toBeLessThan(6)
  })
})
