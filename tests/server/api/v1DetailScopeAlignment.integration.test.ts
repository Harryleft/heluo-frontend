/**
 * /api/v1 details 口径对齐集成测试
 * @vitest-environment node
 */

import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
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

function createFetchMock(options = {}) {
  const includeTxtManifest = options.includeTxtManifest !== false
  const personUri = '/processed/json-ld/person/17270.json'
  const dataPersonUri = '/processed/json-ld/person/15188.json'
  const poemUri = '/processed/json-ld/poem/set/poem_31848.json'
  const dataDufuPoemUri = '/processed/json-ld/poem/set/poem_30546.json'
  const poemTextUri1 = '/processed/json-ld/poem/text/poem_31848_01.json'
  const poemTextUri2 = '/processed/json-ld/poem/text/poem_31848_02.json'
  const bookUri = '/processed/json-ld/book/978-7-5470-5738-4.json'
  const placeUri = '/processed/json-ld/place/CN510922.json'
  const dataDufuPlaceUri = '/processed/json-ld/place/CN500236.json'
  const ancientUri = '/processed/json-ld/ancient-book/set/book-entry/17270_303.json'
  const ancientTxtBookUri = '/processed/json-ld/ancient-book/text/book/17270_303.json'

  const poemRows = [{ uri: poemUri, score: 0.91, confidence: 0.05 }]
  const bookRows = [{ uri: bookUri, score: 0.8, confidence: 0.1 }]
  const placeRows = [{ uri: placeUri, score: 0.85, confidence: 0.07 }]
  const ancientRows = [{ uri: ancientUri, score: 0.88, confidence: 0.06 }]

  const docs = {
    [personUri]: {
      id: 'https://api.heluo.site/person/17270',
      _label: '杜甫',
    },
    [dataPersonUri]: {
      id: 'https://api.heluo.site/person/15188',
      _label: '李白',
    },
    [poemUri]: {
      id: 'https://api.heluo.site/poem/set/poem_31848',
      _label: '登岳阳楼',
      created_by: {
        carried_out_by: [{ _label: '杜甫', id: 'https://api.heluo.site/person/17270' }],
      },
    },
    [dataDufuPoemUri]: {
      id: 'https://api.heluo.site/poem/set/poem_30546',
      _label: '入宅三首',
      created_by: {
        timespan: { _label: '767年' },
        carried_out_by: [{ _label: '杜甫', id: 'http://localhost:8003/person/17270' }],
        took_place_at: [{ _label: '奉节县', id: 'http://localhost:8003/place/CN500236' }],
      },
    },
    [poemTextUri1]: {
      id: 'https://api.heluo.site/poem/text/poem_31848_01',
      text_norm_zh: '昔闻洞庭水，今上岳阳楼。',
      member_of: [{ id: 'https://api.heluo.site/poem/set/poem_31848' }],
    },
    [poemTextUri2]: {
      id: 'https://api.heluo.site/poem/text/poem_31848_02',
      text_norm_zh: '吴楚东南坼，乾坤日夜浮。',
      member_of: [{ id: 'https://api.heluo.site/poem/set/poem_31848' }],
    },
    [bookUri]: {
      id: 'https://api.heluo.site/book/978-7-5470-5738-4',
      _label: '杜甫诗选',
      created_by: {
        carried_out_by: [{ _label: '上海古籍出版社' }],
      },
    },
    [placeUri]: {
      id: 'https://api.heluo.site/place/CN510922',
      _label: '射洪',
      defined_by: 'POINT (105.38131 30.87123)',
    },
    [dataDufuPlaceUri]: {
      id: 'https://api.heluo.site/place/CN500236',
      _label: '奉节县',
      defined_by: 'POINT(109.470533 31.024561)',
    },
    [ancientUri]: {
      id: 'http://localhost:8000/set/ancient_book/siku/jibu/303',
      _label: '白孔六帖',
      created_by: {
        carried_out_by: [{ _label: '白居易' }],
      },
    },
    [ancientTxtBookUri]: {
      id: 'https://api.heluo.site/txt/ancient_book/303',
      _label: '白孔六帖',
      ...(includeTxtManifest
        ? {
          digitally_carried_by: [
            {
              type: 'DigitalObject',
              access_point: [
                {
                  id: 'http://localhost:8083/iiif/manifests/ancientBook/303/17270_303/manifest.json',
                },
              ],
              conforms_to: [
                {
                  id: 'http://iiif.io/api/presentation/',
                },
              ],
            },
          ],
        }
        : {}),
    },
  }

  return async (url) => {
    const parsed = new URL(String(url))
    if (parsed.pathname === '/v1/search') {
      const directory = parsed.searchParams.get('directory')
      if (directory) {
        if (directory === '/processed/json-ld/poem/text/') {
          const query = parsed.searchParams.get('q') || ''
          if (query === '31848') {
            return jsonResponse({
              total: 2,
              results: [
                { uri: poemTextUri1, score: 0.9, confidence: 0.1 },
                { uri: poemTextUri2, score: 0.88, confidence: 0.1 },
              ],
            }, 200)
          }
          return jsonResponse({ total: 0, results: [] }, 200)
        }
        if (directory === '/processed/json-ld/ancient-book/text/book/') {
          const query = parsed.searchParams.get('q') || ''
          if (query === '303') {
            return jsonResponse({
              total: 1,
              results: [{ uri: ancientTxtBookUri, score: 0.83, confidence: 0.12 }],
            }, 200)
          }
          return jsonResponse({ total: 0, results: [] }, 200)
        }
        if (directory === '/processed/json-ld/poem/set/') {
          const query = parsed.searchParams.get('q') || ''
          if (query === '17270') {
            return jsonResponse({
              total: 1,
              results: [{ uri: dataDufuPoemUri, score: 0.91, confidence: 0.05 }],
            }, 200)
          }
          return jsonResponse({ total: 0, results: [] }, 200)
        }
        return jsonResponse({ total: 0, results: [] }, 200)
      }

      const collection = parsed.searchParams.get('collection')
      if (collection === '/heluo/poems/sets') {
        return jsonResponse({ total: 1, results: poemRows }, 200)
      }
      if (collection === '/heluo/books') {
        return jsonResponse({ total: 1, results: bookRows }, 200)
      }
      if (collection === '/heluo/places') {
        return jsonResponse({ total: 1, results: placeRows }, 200)
      }
      if (collection === '/heluo/ancient-books/sets') {
        return jsonResponse({ total: 1, results: ancientRows }, 200)
      }
      if (collection === '/heluo/ancient-books/sets') {
        return jsonResponse({ total: 0, results: [] }, 200)
      }
      return jsonResponse({ total: 0, results: [] }, 200)
    }

    if (parsed.pathname === '/v1/documents') {
      const uri = parsed.searchParams.get('uri') || ''
      if (Object.prototype.hasOwnProperty.call(docs, uri)) {
        return jsonResponse(docs[uri], 200)
      }
      return jsonResponse({}, 404)
    }

    return jsonResponse({}, 404)
  }
}

describe('GET /api/v1 details 口径对齐', () => {
  let server
  let baseUrl = ''

  beforeAll(async () => {
    server = app.listen(0)
    const address = server.address()
    const port = (address as AddressInfo).port
    baseUrl = `http://127.0.0.1:${port}`
  })

  beforeEach(() => {
    setMarklogicFetchForTest(createFetchMock())
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

  it('poem search 结果进入 details 不应 404', async () => {
    const response = await fetch(`${baseUrl}/api/v1/poems/poem_31848?format=set`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.id).toBe('poem_31848')
  })

  it('poem details 应能回填 json-ld 文本正文', async () => {
    const response = await fetch(`${baseUrl}/api/v1/poems/poem_31848?format=set`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.fullText).toContain('昔闻洞庭水')
    expect(result.data.fullText).toContain('吴楚东南坼')
    expect(result.data.textUri).toBe('/processed/json-ld/poem/text/poem_31848_01.json')
  })

  it('person search 结果进入 details 不应 404', async () => {
    const response = await fetch(`${baseUrl}/api/v1/persons/17270`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.id).toBe('17270')
  })

  it('person details 应支持 data 前缀的 json-ld 路径', async () => {
    const response = await fetch(`${baseUrl}/api/v1/persons/15188`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.id).toBe('15188')
    expect(result.data.name).toBe('李白')
  })

  it('person poem-track 应支持 data 前缀的人物文档', async () => {
    const response = await fetch(`${baseUrl}/api/v1/persons/15188/poem-track`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.personId).toBe('15188')
    expect(result.data.personName).toBe('李白')
    expect(result.error).toBe(null)
  })

  it('person poem-track 应支持 data 前缀的诗文和地点', async () => {
    const response = await fetch(`${baseUrl}/api/v1/persons/17270/poem-track`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.stats.totalPoems).toBe(1)
    expect(result.data.trackPoints).toHaveLength(1)
    expect(result.data.trackPoints[0].place.label).toBe('奉节县')
  })

  it('book search 结果进入 details 不应 404', async () => {
    const response = await fetch(`${baseUrl}/api/v1/books/978-7-5470-5738-4`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.id).toBe('978-7-5470-5738-4')
  })

  it('place search 结果进入 details 不应 404', async () => {
    const response = await fetch(`${baseUrl}/api/v1/places/CN510922`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.id).toBe('CN510922')
  })

  it('ancient_book search 结果进入 details 不应 404', async () => {
    const uri = encodeURIComponent('/processed/json-ld/ancient-book/set/book-entry/17270_303.json')
    const response = await fetch(`${baseUrl}/api/v1/ancient-books/17270_303?uri=${uri}`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.id).toBe('17270_303')
  })

  it('ancient_book details 应能回填 IIIF manifests', async () => {
    const uri = encodeURIComponent('/processed/json-ld/ancient-book/set/book-entry/17270_303.json')
    const response = await fetch(`${baseUrl}/api/v1/ancient-books/17270_303?uri=${uri}`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(Array.isArray(result.data.manifests)).toBe(true)
    expect(result.data.manifests[0]).toContain('/iiif/manifests/303/manifest.json')
  })

  it('ancient_book details 缺少显式 IIIF 时应回填 collection manifest', async () => {
    setMarklogicFetchForTest(createFetchMock({ includeTxtManifest: false }))
    const uri = encodeURIComponent('/processed/json-ld/ancient-book/set/book-entry/17270_303.json')
    const response = await fetch(`${baseUrl}/api/v1/ancient-books/17270_303?uri=${uri}`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(Array.isArray(result.data.manifests)).toBe(true)
    expect(result.data.manifests[0]).toContain('/iiif/manifests/303/manifest.json')
  })

  it('未知 ID 时各 v1 详情接口应返回 404（而非 500）', async () => {
    const targets = [
      '/api/v1/persons/not-exist',
      '/api/v1/poems/not-exist',
      '/api/v1/books/not-exist',
      '/api/v1/places/not-exist',
      '/api/v1/concepts/not-exist',
      '/api/v1/ancient-books/not-exist',
    ]

    for (const path of targets) {
      const response = await fetch(`${baseUrl}${path}`)
      const result = await response.json()
      expect(response.status).toBe(404)
      expect(result.success).toBe(false)
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })
})
