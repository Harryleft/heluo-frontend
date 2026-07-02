/**
 * /stats/entity-counts 集成测试
 * @vitest-environment node
 */

import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { app, resetMarklogicFetch, setMarklogicFetchForTest } from '../../../server/src/index.js'

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload
    },
  }
}

function createMarklogicFetchMock() {
  const collectionTotals: Record<string, number> = {
    '/heluo/persons': 101,
    '/heluo/vector/persons': 1076,

    '/heluo/poems-set': 205,
    '/heluo/vector/poems-set': 26402,

    '/heluo/books': 303,
    '/heluo/vector/books': 69,

    '/heluo/ancient-book-sets': 2,
    '/heluo/vector/ancient-book-sets': 109,
    'http://localhost:8000/graph/ancient_book': 83,

    '/heluo/places': 407,
    '/heluo/vector/places': 72,

    '/heluo/poetry/concepts': 504,
    '/heluo/api/concepts': 502,
    '/heluo/ancient-book-concepts': 501,
    '/heluo/vector/concept-rhyme': 87,
    '/heluo/ancient-book-concept-rdf': 4,
  }
  const directoryTotals: Record<string, number> = {
    '/processed/json-ld/person/': 1,
    '/processed/json-ld/poem/set/': 5,
    '/processed/json-ld/book/': 3,
    '/processed/json-ld/ancient_book/ancient_book_set/book_entry/': 2,
    '/processed/json-ld/place/': 7,
    '/processed/json-ld/concept/': 9,
  }

  return async (url: string) => {
    const parsed = new URL(String(url))
    if (parsed.pathname !== '/v1/search') {
      return jsonResponse({}, 404)
    }

    const directory = parsed.searchParams.get('directory')
    if (directory) {
      return jsonResponse({ total: directoryTotals[directory] || 0, results: [] }, 200)
    }

    const collection = parsed.searchParams.get('collection')
    if (collection) {
      return jsonResponse({ total: collectionTotals[collection] || 0, results: [] }, 200)
    }

    return jsonResponse({ total: 0, results: [] }, 200)
  }
}

function createMarklogicFetchMockWithPollutedAncientBook() {
  const collectionTotals: Record<string, number> = {
    '/heluo/persons': 101,
    '/heluo/poems-set': 205,
    '/heluo/books': 303,
    '/heluo/ancient-book-sets': 0,
    '/heluo/ancient_book_sets': 4,
    '/heluo/iiif/collections': 1,
    '/heluo/places': 407,
    '/heluo/poetry/concepts': 504,
    '/heluo/api/concepts': 502,
    '/heluo/ancient-book-concepts': 501,
  }
  const directoryTotals: Record<string, number> = {
    '/processed/json-ld/person/': 1,
    '/processed/json-ld/poem/set/': 5,
    '/processed/json-ld/book/': 3,
    '/processed/json-ld/ancient_book/ancient_book_set/book_entry/': 2,
    '/processed/json-ld/place/': 7,
    '/processed/json-ld/concept/': 9,
  }

  return async (url: string) => {
    const parsed = new URL(String(url))
    if (parsed.pathname !== '/v1/search') {
      return jsonResponse({}, 404)
    }

    const directory = parsed.searchParams.get('directory')
    if (directory) {
      return jsonResponse({ total: directoryTotals[directory] || 0, results: [] }, 200)
    }

    const collection = parsed.searchParams.get('collection')
    if (collection) {
      return jsonResponse({ total: collectionTotals[collection] || 0, results: [] }, 200)
    }

    return jsonResponse({ total: 0, results: [] }, 200)
  }
}

function createMarklogicFetchMockWithConceptCollectionFallback() {
  const collectionTotals: Record<string, number> = {
    '/heluo/poetry/concepts': 0,
    '/heluo/api/concepts': 0,
    '/heluo/ancient-book-concepts': 4,
  }
  const directoryTotals: Record<string, number> = {
    '/processed/json-ld/person/': 1,
    '/processed/json-ld/poem/set/': 5,
    '/processed/json-ld/book/': 3,
    '/processed/json-ld/ancient_book/ancient_book_set/book_entry/': 2,
    '/processed/json-ld/place/': 7,
    '/processed/json-ld/concept/': 0,
  }

  return async (url: string) => {
    const parsed = new URL(String(url))
    if (parsed.pathname !== '/v1/search') {
      return jsonResponse({}, 404)
    }

    const directory = parsed.searchParams.get('directory')
    if (directory) {
      return jsonResponse({ total: directoryTotals[directory] || 0, results: [] }, 200)
    }

    const collection = parsed.searchParams.get('collection')
    if (collection) {
      return jsonResponse({ total: collectionTotals[collection] || 0, results: [] }, 200)
    }

    return jsonResponse({ total: 0, results: [] }, 200)
  }
}

function createMarklogicFetchMockWithFailure() {
  return async () => {
    throw new Error('mock marklogic unreachable')
  }
}

describe('GET /stats/entity-counts', () => {
  let server: ReturnType<typeof app.listen>
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

  it('应按 json-ld 主目录返回统计结果，并忽略 collection 噪音', async () => {
    const response = await fetch(`${baseUrl}/stats/entity-counts`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.person).toBe(1)
    expect(result.poemSet).toBe(5)
    expect(result.book).toBe(3)
    expect(result.ancientBook).toBe(2)
    expect(result.geography).toBe(7)
    expect(result.concept).toBe(9)
  })

  it('ancientBook 统计应只计入 book_entry，不应计入 iiif/root/department', async () => {
    setMarklogicFetchForTest(createMarklogicFetchMockWithPollutedAncientBook())

    const response = await fetch(`${baseUrl}/stats/entity-counts`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.ancientBook).toBe(2)
  })

  it('concept 统计在 json-ld 目录为空时应回退到旧概念集合', async () => {
    setMarklogicFetchForTest(createMarklogicFetchMockWithConceptCollectionFallback())

    const response = await fetch(`${baseUrl}/stats/entity-counts`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.concept).toBe(4)
  })

  it('MarkLogic 不可达时应返回降级统计结果且不崩溃', async () => {
    setMarklogicFetchForTest(createMarklogicFetchMockWithFailure())

    const response = await fetch(`${baseUrl}/stats/entity-counts`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.person).toBe(0)
    expect(result.poemSet).toBe(0)
    expect(result.book).toBe(0)
    expect(result.ancientBook).toBe(0)
    expect(result.geography).toBe(0)
    expect(result.concept).toBe(0)
    expect(result.degraded).toBe(true)
  })
})
