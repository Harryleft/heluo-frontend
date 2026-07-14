/**
 * /api/v1/search 集成测试
 * @vitest-environment node
 */

import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { app, resetMarklogicFetch, setMarklogicFetchForTest } from '../../../server/src/index.js'

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload
    },
  }
}

function createMarklogicFetchMock(options?: { collectionOnly?: boolean }) {
  const collectionOnly = options?.collectionOnly === true

  const personRows = [
    { uri: '/processed/json-ld/person/17270.json', score: 0.22, confidence: 0.03 },
    { uri: '/processed/json-ld/person/20000.json', score: 0.2, confidence: 0.02 },
    { uri: '/processed/json-ld/person/30000.json', score: 0.18, confidence: 0.02 },
  ]
  const poemRows = [
    { uri: '/processed/json-ld/poem/set/poem_001.json', score: 0.95, confidence: 0.04 },
    { uri: '/processed/json-ld/poem/set/poem_002.json', score: 0.9, confidence: 0.03 },
  ]
  const bookCollectionRows = [
    { uri: '/processed/json-ld/book/978-7-5470-5738-4.json', score: 0.5, confidence: 0.2 },
  ]
  const conceptCollectionRows = [
    { uri: '/processed/json-ld/concept/rhyme/11.json', score: 0.61, confidence: 0.08 },
  ]
  const legacyConceptCollectionRows = [
    { uri: '/heluo/concepts/11', score: 0.63, confidence: 0.09 },
  ]
  const ancientRows = [
    { uri: '/processed/json-ld/ancient-book/set/book-entry/18804_1523.json', score: 0.66, confidence: 0.04 },
  ]

  const docs = {
    '/processed/json-ld/person/17270.json': { title: '杜甫', description: '唐代诗人' },
    '/processed/json-ld/person/20000.json': { title: '杜审言', description: '唐代诗人' },
    '/processed/json-ld/person/30000.json': { title: '李白', description: '唐代诗人' },
    '/processed/json-ld/poem/set/poem_001.json': { title: '春望', description: '国破山河在' },
    '/processed/json-ld/poem/set/poem_002.json': { title: '登高', description: '无边落木萧萧下' },
    '/processed/json-ld/book/978-7-5470-5738-4.json': { title: '杜甫诗集', description: '图书条目' },
    '/processed/json-ld/concept/rhyme/11.json': { title: '平水韵', description: '概念条目' },
    '/heluo/concepts/11': { title: '四部分类法', description: '古籍编目概念条目' },
    '/processed/json-ld/ancient-book/set/book-entry/18804_1523.json': {
      title: '白孔六帖',
      description: '古籍合集条目',
    },
  }

  return async (url) => {
    const parsed = new URL(String(url))
    const pathname = parsed.pathname
    if (pathname === '/v1/search') {
      const directory = parsed.searchParams.get('directory')
      if (directory === '/processed/json-ld/person/') {
        return jsonResponse({ total: collectionOnly ? 0 : 3, results: collectionOnly ? [] : personRows })
      }
      if (directory === '/processed/json-ld/poem/set/') {
        return jsonResponse({ total: collectionOnly ? 0 : 2, results: collectionOnly ? [] : poemRows })
      }
      if (directory === '/processed/json-ld/book/') {
        return jsonResponse({ total: collectionOnly ? 0 : 1, results: collectionOnly ? [] : bookCollectionRows })
      }
      if (directory === '/processed/json-ld/concept/') {
        return jsonResponse({ total: collectionOnly ? 0 : 1, results: collectionOnly ? [] : conceptCollectionRows })
      }
      if (directory === '/processed/json-ld/ancient-book/set/book-entry/') {
        return jsonResponse({ total: collectionOnly ? 0 : 1, results: collectionOnly ? [] : ancientRows })
      }
      const collection = parsed.searchParams.get('collection')
      if (collectionOnly && collection === '/heluo/concepts') {
        return jsonResponse({ total: 1, results: legacyConceptCollectionRows })
      }
      return jsonResponse({ total: 0, results: [] })
    }

    if (pathname === '/v1/documents') {
      const uri = parsed.searchParams.get('uri') || ''
      return jsonResponse(docs[uri] || {})
    }

    return jsonResponse({}, 404)
  }
}

function createAncientBookScopePollutedMock() {
  const rows = [
    { uri: '/processed/json-ld/ancient-book/set/book-entry/17270_303.json', score: 0.8, confidence: 0.1 },
    { uri: '/processed/json-ld/ancient-book/set/book-entry/17270_304.json', score: 0.79, confidence: 0.1 },
    { uri: '/processed/json-ld/ancient-book/set/department/jibu.json', score: 0.4, confidence: 0.1 },
    { uri: '/processed/json-ld/ancient-book/set/root/siku.json', score: 0.39, confidence: 0.1 },
  ]
  const iiifRows = [{ uri: '/processed/iiif/collections/17270/collection.json', score: 0.95, confidence: 0.03 }]
  const docs = {
    '/processed/json-ld/ancient-book/set/book-entry/17270_303.json': { title: '杜诗捃' },
    '/processed/json-ld/ancient-book/set/book-entry/17270_304.json': { title: '杜诗详注' },
    '/processed/iiif/collections/17270/collection.json': { label: { zh: ['杜甫 (Person 17270)'] } },
  }

  return async (url) => {
    const parsed = new URL(String(url))
    if (parsed.pathname === '/v1/search') {
      const directory = parsed.searchParams.get('directory')
      if (directory === '/processed/json-ld/ancient-book/set/book-entry/') {
        return jsonResponse({ total: 4, results: rows })
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

function createPrimaryEntityUriNormalizationMock() {
  const personRows = [{ uri: '/processed/vector/person/17270.json', score: 0.62, confidence: 0.06 }]
  const poemRows = [{ uri: '/processed/json-ld/poem/set/poem_001.json', score: 0.58, confidence: 0.05 }]
  const bookRows = [{ uri: '/processed/vector/book/978-7-5470-5738-4.json', score: 0.57, confidence: 0.05 }]
  const placeRows = [{ uri: '/processed/vector/place/CN510922.json', score: 0.56, confidence: 0.05 }]
  const conceptRows = [{ uri: '/processed/vector/concepts/11.json', score: 0.55, confidence: 0.04 }]
  const ancientRows = [{ uri: '/processed/json-ld/ancient-book/set/book-entry/17270_303.json', score: 0.54, confidence: 0.04 }]

  const docs = {
    '/processed/json-ld/person/17270.json': { title: '杜甫' },
    '/processed/json-ld/poem/set/poem_001.json': { title: '春望' },
    '/processed/json-ld/book/978-7-5470-5738-4.json': { title: '杜甫诗集' },
    '/processed/json-ld/place/CN510922.json': { title: '射洪' },
    '/processed/json-ld/concept/11.json': { title: '平水韵' },
    '/processed/json-ld/ancient-book/set/book-entry/17270_303.json': { title: '白孔六帖' },
  }

  return async (url) => {
    const parsed = new URL(String(url))
    if (parsed.pathname === '/v1/search') {
      const directory = parsed.searchParams.get('directory')
      if (directory === '/processed/json-ld/person/') {
        return jsonResponse({ total: 1, results: personRows })
      }
      if (directory === '/processed/json-ld/poem/set/') {
        return jsonResponse({ total: 1, results: poemRows })
      }
      if (directory === '/processed/json-ld/book/') {
        return jsonResponse({ total: 1, results: bookRows })
      }
      if (directory === '/processed/json-ld/place/') {
        return jsonResponse({ total: 1, results: placeRows })
      }
      if (directory === '/processed/json-ld/concept/') {
        return jsonResponse({ total: 1, results: conceptRows })
      }
      if (directory === '/processed/json-ld/ancient-book/set/book-entry/') {
        return jsonResponse({ total: 1, results: ancientRows })
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

function createUriLikeTitleFallbackMock() {
  const personRows = [{ uri: '/processed/vector/person/17170_chunk_01.json', score: 0.62, confidence: 0.06 }]
  const docs = {
    '/processed/json-ld/person/17170.json': {
      title: '/person/17170',
      id: '/person/17170',
      identified_by: [{ content: '杜甫传主角' }],
    },
  }

  return async (url) => {
    const parsed = new URL(String(url))
    if (parsed.pathname === '/v1/search') {
      const directory = parsed.searchParams.get('directory')
      if (directory === '/processed/json-ld/person/') {
        return jsonResponse({ total: 1, results: personRows })
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

describe('GET /api/v1/search 集成测试', () => {
  let server
  let baseUrl = ''

  beforeAll(async () => {
    server = app.listen(0)
    const address = server.address()
    const port = (address as AddressInfo).port
    baseUrl = `http://127.0.0.1:${port}`
  })

  beforeEach(() => {
    setMarklogicFetchForTest(createMarklogicFetchMock())
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

  it('应将精确命中排在高向量分之前', async () => {
    const response = await fetch(`${baseUrl}/api/v1/search?q=杜甫&type=person,poem&page=1&pageSize=2`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.items[0].id).toBe('17270')
    expect(result.data.items[0].scoreDetail.exact).toBe(1)
  })

  it('应返回稳定总量与深分页结果', async () => {
    const response = await fetch(`${baseUrl}/api/v1/search?q=杜甫&type=person,poem&page=2&pageSize=2`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.total).toBe(5)
    expect(result.data.counts.person).toBe(3)
    expect(result.data.counts.poem).toBe(2)
    expect(result.data.items.length).toBe(2)
  })

  it('缺省查询词时应执行全量检索', async () => {
    const response = await fetch(`${baseUrl}/api/v1/search?type=person&page=1&pageSize=2`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.query).toBe('*')
    expect(result.data.total).toBe(3)
    expect(result.data.counts.person).toBe(3)
    expect(result.data.items.length).toBe(2)
  })

  it('显式 mode=keyword 时应返回 keyword 模式标识', async () => {
    const marklogicFetchSpy = vi.fn(createMarklogicFetchMock())
    setMarklogicFetchForTest(marklogicFetchSpy)

    const response = await fetch(`${baseUrl}/api/v1/search?q=杜甫&type=person&mode=keyword&page=1&pageSize=2`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.mode).toBe('keyword')

    const hasVectorDirectoryRequest = marklogicFetchSpy.mock.calls
      .map(([url]) => String(url || ''))
      .some((url) => url.includes('/processed/vector/'))
    expect(hasVectorDirectoryRequest).toBe(false)
  })

  it('ancient_book 检索应仅返回 json-ld book_entry 目录结果', async () => {
    const response = await fetch(`${baseUrl}/api/v1/search?q=白孔&type=ancient_book&page=1&pageSize=5`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.items.length).toBe(1)
    expect(result.data.items[0].uri).toContain('/processed/json-ld/ancient-book/set/book-entry/')
  })

  it('person 检索在 json-ld only 模式下目录无数据时返回空结果', async () => {
    setMarklogicFetchForTest(createMarklogicFetchMock({ collectionOnly: true }))

    const response = await fetch(`${baseUrl}/api/v1/search?q=杜甫&type=person&page=1&pageSize=2`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.total).toBe(0)
    expect(result.data.items.length).toBe(0)
  })

  it('检索后端不可用时应返回 503，而不是伪装成空结果', async () => {
    setMarklogicFetchForTest(async () => {
      throw new Error('MarkLogic offline')
    })

    const response = await fetch(`${baseUrl}/api/v1/search?q=杜甫&type=person&page=1&pageSize=2`)
    const result = await response.json()

    expect(response.status).toBe(503)
    expect(result.success).toBe(false)
    expect(result.error.code).toBe('SEARCH_BACKEND_UNAVAILABLE')
    expect(result.error.message).toBe('检索服务暂不可用')
  })

  it('ancient_book 检索在 json-ld only 模式下目录无数据时返回空结果', async () => {
    setMarklogicFetchForTest(createMarklogicFetchMock({ collectionOnly: true }))

    const response = await fetch(`${baseUrl}/api/v1/search?q=白孔&type=ancient_book&page=1&pageSize=5`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.total).toBe(0)
    expect(result.data.items.length).toBe(0)
  })

  it('poem 检索在 json-ld only 模式下目录无数据时返回空结果', async () => {
    setMarklogicFetchForTest(createMarklogicFetchMock({ collectionOnly: true }))

    const response = await fetch(`${baseUrl}/api/v1/search?q=春望&type=poem&page=1&pageSize=5`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.total).toBe(0)
    expect(result.data.items.length).toBe(0)
  })

  it('book 检索在 json-ld only 模式下目录无数据时返回空结果', async () => {
    setMarklogicFetchForTest(createMarklogicFetchMock({ collectionOnly: true }))

    const response = await fetch(`${baseUrl}/api/v1/search?q=杜甫&type=book&page=1&pageSize=5`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.total).toBe(0)
    expect(result.data.items.length).toBe(0)
  })

  it('concept 检索在 json-ld only 模式下目录无数据时返回空结果', async () => {
    setMarklogicFetchForTest(createMarklogicFetchMock({ collectionOnly: true }))

    const response = await fetch(`${baseUrl}/api/v1/search?q=韵&type=concept&page=1&pageSize=5`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.total).toBe(0)
    expect(result.data.items.length).toBe(0)
  })

  it('ancient_book 检索应排除 iiif collection 与非 book_entry 文档', async () => {
    setMarklogicFetchForTest(createAncientBookScopePollutedMock())

    const response = await fetch(`${baseUrl}/api/v1/search?type=ancient_book&page=1&pageSize=10`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.total).toBe(4)
    expect(result.data.items.length).toBe(2)
    expect(result.data.items.every((item) => String(item.uri).includes('/book-entry/'))).toBe(true)
  })

  it('检索命中分片文档时应回写主实体 URI（先人物，再覆盖其他实体）', async () => {
    setMarklogicFetchForTest(createPrimaryEntityUriNormalizationMock())

    const response = await fetch(`${baseUrl}/api/v1/search?q=杜甫&type=person,poem,book,ancient_book,place,concept&page=1&pageSize=12`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)

    const byType = Object.fromEntries(result.data.items.map((item) => [item.type, item.uri]))
    const titleByType = Object.fromEntries(result.data.items.map((item) => [item.type, item.title]))

    // 1) 先验证人物主实体归一化
    expect(String(byType.person)).toContain('/processed/json-ld/person/17270')
    expect(String(byType.person)).not.toContain('/processed/vector/')

    // 2) 再验证其他实体也已归一到主实体路径
    expect(String(byType.poem)).toContain('/processed/json-ld/poem/set/')
    expect(String(byType.book)).toContain('/processed/json-ld/book/')
    expect(String(byType.place)).toContain('/processed/json-ld/place/CN510922')
    expect(String(byType.concept)).toContain('/processed/json-ld/concept/')
    expect(String(byType.ancient_book)).toContain('/book-entry/')

    // 3) 标题应使用实体标题，而不是分片标题
    expect(String(titleByType.person)).toBe('杜甫')
    expect(String(titleByType.poem)).toBe('春望')
    expect(String(titleByType.book)).toBe('杜甫诗集')
    expect(String(titleByType.place)).toBe('射洪')
    expect(String(titleByType.concept)).toBe('平水韵')
    expect(String(titleByType.ancient_book)).toBe('白孔六帖')
  })

  it('标题为 URI 样式时应继续反查实体名称，避免回显链接文本', async () => {
    setMarklogicFetchForTest(createUriLikeTitleFallbackMock())

    const response = await fetch(`${baseUrl}/api/v1/search?q=杜甫&type=person&page=1&pageSize=3`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.items.length).toBe(1)
    expect(String(result.data.items[0].title)).toBe('未命名条目')
    expect(String(result.data.items[0].title)).not.toContain('/person/')
  })
})
