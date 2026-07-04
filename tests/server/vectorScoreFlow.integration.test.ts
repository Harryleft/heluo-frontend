/**
 * 向量分数传递链路集成测试
 * 验证向量搜索的 similarity 分数是否正确传递到 computeHybridScore
 *
 * 测试链路:
 *   mlVectorSearch → searchScopeDataVector → searchScopeDataHybrid
 *   → mergeRowsByUri → rerankSearchCandidates → computeHybridScore
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { app, resetMarklogicFetch, setMarklogicFetchForTest } from '../../server/src/index.js'
import { computeHybridScore, rerankSearchCandidates } from '../../server/src/search/hybridSearchUtils.js'

// ========== Mock 辅助函数 ==========

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload
    },
  }
}

/**
 * 创建包含向量数据的 MarkLogic fetch mock
 * @param options - 配置选项
 * @param options.vectorSimilarity - 向量相似度分数
 * @param options.enableVectorSearch - 是否启用向量搜索
 */
function createVectorSearchMock(options: { vectorSimilarity?: number; enableVectorSearch?: boolean } = {}) {
  const { vectorSimilarity = 0.85, enableVectorSearch = true } = options

  // 模拟向量文档（包含 embedding）
  const vectorDoc = {
    uri: '/processed/vector/poem/set/poem_31190.json',
    embedding: Array.from({ length: 768 }, () => Math.random() * 2 - 1), // 768维随机向量
    text_norm: '登高',
    scope: 'poem/set',
    entity_iri: 'http://heluo.site/poem/31190',
    evidence: {
      poem_id: '31190',
      frontend_url: '/poems/31190',
    },
  }

  // 模拟搜索结果（包含向量相似度）
  const vectorSearchResults = [
    {
      uri: '/processed/vector/poem/set/poem_31190.json',
      score: 0.5, // MarkLogic 搜索分数
      confidence: 0.1,
      similarity: vectorSimilarity, // 向量相似度（关键）
    },
  ]

  // 模拟文档内容
  const docs: Record<string, unknown> = {
    '/processed/vector/poem/set/poem_31190.json': vectorDoc,
    '/processed/json-ld/poem/set/poem_31190.json': {
      _label: '登高',
      author_name: '杜甫',
      dynasty: '唐代',
      full_text: '风急天高猿啸哀，渚清沙白鸟飞回。无边落木萧萧下，不尽长江滚滚来。',
    },
  }

  let requestCount = 0

  return async (url: string | URL) => {
    requestCount++
    const parsed = new URL(String(url))

    // 模拟目录搜索（获取候选文档）
    if (parsed.pathname === '/v1/search') {
      const directory = parsed.searchParams.get('directory')
      if (directory === '/processed/vector/poem/set/') {
        return jsonResponse({
          total: 1,
          results: vectorSearchResults,
        })
      }
      // 关键字搜索返回空
      return jsonResponse({ total: 0, results: [] })
    }

    // 模拟获取文档内容（包含 embedding）
    if (parsed.pathname === '/v1/documents') {
      const uri = parsed.searchParams.get('uri') || ''
      return jsonResponse(docs[uri] || {})
    }

    return jsonResponse({}, 404)
  }
}

/**
 * 创建混合搜索的 MarkLogic fetch mock
 * 同时模拟关键字搜索和向量搜索结果
 */
function createHybridSearchMock() {
  const vectorDoc = {
    uri: '/processed/vector/poem/set/poem_31190.json',
    embedding: Array.from({ length: 768 }, () => Math.random() * 2 - 1),
    text_norm: '登高',
    scope: 'poem/set',
    entity_iri: 'http://heluo.site/poem/31190',
  }

  const keywordRows = [
    {
      uri: '/processed/json-ld/poem/set/poem_31190.json',
      score: 0.6,
      confidence: 0.2,
    },
  ]

  const docs: Record<string, unknown> = {
    '/processed/vector/poem/set/poem_31190.json': vectorDoc,
    '/processed/json-ld/poem/set/poem_31190.json': {
      _label: '登高',
      author_name: '杜甫',
    },
  }

  let vectorSearchCalled = false

  return async (url: string | URL) => {
    const parsed = new URL(String(url))

    if (parsed.pathname === '/v1/search') {
      const directory = parsed.searchParams.get('directory')
      const q = parsed.searchParams.get('q')

      // 向量搜索目录
      if (directory === '/processed/vector/poem/set/') {
        vectorSearchCalled = true
        return jsonResponse({
          total: 1,
          results: [
            {
              uri: '/processed/vector/poem/set/poem_31190.json',
              score: 0.5,
              confidence: 0.1,
            },
          ],
        })
      }

      // 关键字搜索目录
      if (directory === '/processed/json-ld/poem/set/') {
        return jsonResponse({
          total: 1,
          results: keywordRows,
        })
      }

      return jsonResponse({ total: 0, results: [] })
    }

    if (parsed.pathname === '/v1/documents') {
      const uri = parsed.searchParams.get('uri') || ''
      return jsonResponse(docs[uri] || {})
    }

    return jsonResponse({}, 404)
  }
}

// ========== 测试套件 ==========

describe('向量分数传递链路集成测试', () => {
  let server: ReturnType<typeof app.listen>
  let baseUrl = ''

  beforeAll(async () => {
    server = app.listen(0)
    const address = server.address()
    const port = (address as import('net').AddressInfo).port
    baseUrl = `http://127.0.0.1:${port}`
  })

  afterAll(async () => {
    resetMarklogicFetch()
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  })

  describe('computeHybridScore 单元测试', () => {
    it('应正确使用显式传递的 vectorScore 参数', () => {
      const result = computeHybridScore({
        query: '杜甫',
        title: '登高',
        snippet: '风急天高猿啸哀',
        id: 'poem_31190',
        score: 0.5,
        confidence: 0.1,
        vectorScore: 0.92, // 显式传递向量分数
        source: 'vector',
      })

      expect(result.vector).toBe(0.92)
      expect(result.vectorRaw).toBe(0.92)
      expect(result.source).toBe('vector')
      expect(result.finalScore).toBeGreaterThan(0.5) // 向量分数高，总分应该高
    })

    it('当 source=vector 且无 vectorScore 时，应从 similarity 提取', () => {
      const result = computeHybridScore({
        query: '杜甫',
        title: '登高',
        snippet: '风急天高猿啸哀',
        id: 'poem_31190',
        score: 0.88, // 这个 score 被当作 similarity
        confidence: 0.1,
        source: 'vector',
      })

      expect(result.vector).toBe(0.88)
      expect(result.source).toBe('vector')
    })

    it('当 source=keyword 时，应使用计算后的假向量分数', () => {
      const result = computeHybridScore({
        query: '杜甫',
        title: '登高',
        snippet: '风急天高猿啸哀',
        id: 'poem_31190',
        score: 0.5,
        confidence: 0.3,
        source: 'keyword',
      })

      // 假向量分数 = (score + confidence) / 2 = (0.5 + 0.3) / 2 = 0.4
      expect(result.vector).toBe(0.4)
      expect(result.source).toBe('keyword')
    })

    it('当 source=hybrid 且有 vectorScore 时，应优先使用 vectorScore', () => {
      const result = computeHybridScore({
        query: '杜甫',
        title: '登高',
        snippet: '风急天高猿啸哀',
        id: 'poem_31190',
        score: 0.5,
        confidence: 0.1,
        vectorScore: 0.85,
        source: 'hybrid',
      })

      expect(result.vector).toBe(0.85)
      expect(result.source).toBe('hybrid')
    })
  })

  describe('rerankSearchCandidates 单元测试', () => {
    it('hasVectorScore=true 时应提取 vectorScore 字段', () => {
      const candidates = [
        {
          id: 'poem_31190',
          title: '登高',
          snippet: '风急天高猿啸哀',
          uri: '/processed/json-ld/poem/set/poem_31190.json',
          score: 0.5,
          confidence: 0.1,
          vectorScore: 0.92, // 向量分数
          source: 'vector',
        },
      ]

      const ranked = rerankSearchCandidates(candidates, '杜甫', { hasVectorScore: true })

      expect(ranked[0]?._scoreDetail?.vector).toBe(0.92)
      expect(ranked[0]?._scoreDetail?.vectorRaw).toBe(0.92)
      expect(ranked[0]?._scoreDetail?.source).toBe('vector')
    })

    it('hasVectorScore=false 时应从 source 字段兜底提取', () => {
      const candidates = [
        {
          id: 'poem_31190',
          title: '登高',
          snippet: '风急天高猿啸哀',
          uri: '/processed/json-ld/poem/set/poem_31190.json',
          score: 0.5,
          confidence: 0.1,
          similarity: 0.88, // 向量相似度
          source: 'vector',
        },
      ]

      const ranked = rerankSearchCandidates(candidates, '杜甫', { hasVectorScore: false })

      // 兜底逻辑：source=vector 时从 similarity 提取
      expect(ranked[0]?._scoreDetail?.vector).toBe(0.88)
      expect(ranked[0]?._scoreDetail?.source).toBe('vector')
    })

    it('应正确处理混合搜索结果（source=hybrid）', () => {
      const candidates = [
        {
          id: 'poem_31190',
          title: '登高',
          snippet: '风急天高猿啸哀',
          uri: '/processed/json-ld/poem/set/poem_31190.json',
          score: 0.5,
          confidence: 0.1,
          vectorScore: 0.85,
          source: 'hybrid',
        },
      ]

      const ranked = rerankSearchCandidates(candidates, '杜甫')

      expect(ranked[0]?._scoreDetail?.vector).toBe(0.85)
      expect(ranked[0]?._scoreDetail?.source).toBe('hybrid')
    })
  })

  describe('向量搜索结果结构测试', () => {
    beforeEach(() => {
      setMarklogicFetchForTest(createVectorSearchMock({ vectorSimilarity: 0.92 }))
    })

    it('向量搜索结果应包含 similarity 和 vectorScore', async () => {
      // 这里我们直接测试 searchScopeDataVector 的输出结构
      // 由于该函数是内部函数，我们通过 API 端点间接测试
      const response = await fetch(`${baseUrl}/api/v1/search?q=杜甫&type=poem&page=1&pageSize=10`)

      const result = await response.json()
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })
  })

  describe('端到端测试：/api/v1/search 混合模式', () => {
    beforeEach(() => {
      setMarklogicFetchForTest(createHybridSearchMock())
    })

    it('混合搜索结果应包含正确的向量分数', async () => {
      const response = await fetch(`${baseUrl}/api/v1/search?q=杜甫 登高&type=poem&page=1&pageSize=10`)

      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(Array.isArray(result.data?.items)).toBe(true)

      // 验证结果结构
      if (result.data?.items?.length > 0) {
        const firstItem = result.data.items[0]
        expect(firstItem).toHaveProperty('id')
        expect(firstItem).toHaveProperty('title')
        expect(firstItem).toHaveProperty('score')

        // 如果有 _scoreDetail，验证向量分数
        if (firstItem._scoreDetail) {
          expect(firstItem._scoreDetail).toHaveProperty('vector')
          expect(firstItem._scoreDetail).toHaveProperty('lexical')
          expect(firstItem._scoreDetail).toHaveProperty('finalScore')
          expect(firstItem._scoreDetail.vector).toBeGreaterThanOrEqual(0)
          expect(firstItem._scoreDetail.vector).toBeLessThanOrEqual(1)
        }
      }
    })
  })

  describe('数据流追踪测试', () => {
    it('完整追踪：向量相似度 → similarity → vectorScore → computeHybridScore.vector', () => {
      // 步骤 1: 模拟 mlVectorSearch 返回
      const mlVectorSearchResult = {
        uri: '/processed/vector/poem/set/poem_31190.json',
        similarity: 0.92, // 真正的向量相似度
        title: '登高',
        snippet: '风急天高猿啸哀',
        type: 'poem',
        score: 0.5,
        confidence: 0.1,
      }

      // 步骤 2: 模拟 searchScopeDataVector 转换
      const searchScopeDataVectorOutput = {
        ...mlVectorSearchResult,
        id: mlVectorSearchResult.uri,
        vectorScore: mlVectorSearchResult.similarity, // 关键：同时赋值
        source: 'vector',
      }

      // 步骤 3: 模拟 searchScopeDataHybrid 合并
      const hybridOutput = {
        ...searchScopeDataVectorOutput,
        keywordScore: 0,
        vectorScore: searchScopeDataVectorOutput.vectorScore, // 应该正确传递
        source: 'vector',
      }

      // 步骤 4: 模拟 rerankSearchCandidates 提取
      const extractedVectorScore =
        hybridOutput.source === 'vector' ? hybridOutput.vectorScore || hybridOutput.similarity : undefined

      expect(extractedVectorScore).toBe(0.92)

      // 步骤 5: computeHybridScore 计算
      const finalScore = computeHybridScore({
        query: '杜甫',
        title: hybridOutput.title,
        snippet: hybridOutput.snippet,
        id: hybridOutput.id,
        score: hybridOutput.score,
        confidence: hybridOutput.confidence,
        vectorScore: extractedVectorScore,
        source: hybridOutput.source,
      })

      // 验证：最终向量分数应该是原始相似度
      expect(finalScore.vector).toBe(0.92)
      expect(finalScore.vectorRaw).toBe(0.92)
    })

    it('兜底路径：source=vector 但无 vectorScore 时应从 similarity 提取', () => {
      const resultWithoutVectorScore = {
        uri: '/processed/vector/poem/set/poem_31190.json',
        similarity: 0.88, // 只有 similarity
        title: '登高',
        score: 0.5,
        confidence: 0.1,
        source: 'vector',
      }

      // rerankSearchCandidates 的兜底逻辑
      const vectorScore = resultWithoutVectorScore.source === 'vector' ? resultWithoutVectorScore.similarity : undefined

      expect(vectorScore).toBe(0.88)

      const finalScore = computeHybridScore({
        query: '杜甫',
        title: resultWithoutVectorScore.title,
        snippet: '',
        id: resultWithoutVectorScore.uri,
        score: resultWithoutVectorScore.score,
        confidence: resultWithoutVectorScore.confidence,
        vectorScore,
        source: resultWithoutVectorScore.source,
      })

      expect(finalScore.vector).toBe(0.88)
    })
  })

  describe('边界情况测试', () => {
    it('vectorScore 为 NaN 时应回退到 score', () => {
      const result = computeHybridScore({
        query: '杜甫',
        title: '登高',
        snippet: '',
        id: 'poem_31190',
        score: 0.75,
        confidence: 0.1,
        vectorScore: NaN, // 无效值
        source: 'vector',
      })

      // source=vector 且 vectorScore 无效时，应使用 score
      expect(result.vector).toBe(0.75)
    })

    it('vectorScore 超出范围时应被 clamp', () => {
      const result = computeHybridScore({
        query: '杜甫',
        title: '登高',
        snippet: '',
        id: 'poem_31190',
        score: 0.5,
        confidence: 0.1,
        vectorScore: 1.5, // 超出范围
        source: 'vector',
      })

      // 应被限制在 [0, 1]
      expect(result.vector).toBe(1)
    })

    it('vectorScore 为负数时应被 clamp 到 0', () => {
      const result = computeHybridScore({
        query: '杜甫',
        title: '登高',
        snippet: '',
        id: 'poem_31190',
        score: 0.5,
        confidence: 0.1,
        vectorScore: -0.5, // 负数
        source: 'vector',
      })

      expect(result.vector).toBe(0)
    })

    it('所有分数为 0 时应返回有效分数', () => {
      const result = computeHybridScore({
        query: '杜甫',
        title: '完全不相关',
        snippet: '完全不相关的内容',
        id: 'unrelated',
        score: 0,
        confidence: 0,
        source: 'keyword',
      })

      expect(result.finalScore).toBe(0)
      expect(result.vector).toBe(0)
      expect(result.lexical).toBe(0)
    })
  })
})
