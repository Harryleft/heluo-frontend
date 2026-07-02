/**
 * /api/v1/ancient-books/:id 集成测试
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

function createFetchMock(options?: {
  withText?: boolean
  withVectorText?: boolean
  useJsonLdObjectOnly?: boolean
  withManifestAnnotationText?: boolean
}) {
  const withText = options?.withText !== false
  const withVectorText = options?.withVectorText === true
  const useJsonLdObjectOnly = options?.useJsonLdObjectOnly === true
  const withManifestAnnotationText = options?.withManifestAnnotationText === true
  const targetUri = '/processed/entities/ancient_book/ancient_book_object/volume/17270_2263_15.json'
  const jsonLdTargetUri = '/processed/json-ld/ancient_book/ancient_book_object/volume/17270_2263_15.json'
  const txtBookUri = '/processed/entities/ancient_book/ancient_book_txt/book/17270_2263.json'
  const txtVolumeUri = '/processed/entities/ancient_book/ancient_book_txt/volume/17270_2263_15.json'
  const txtVolumeUri2 = '/processed/entities/ancient_book/ancient_book_txt/volume/17270_2263_16.json'
  const objectVolumeUri2 = '/processed/entities/ancient_book/ancient_book_object/volume/17270_2263_16.json'
  const jsonLdObjectVolumeUri2 = '/processed/json-ld/ancient_book/ancient_book_object/volume/17270_2263_16.json'
  const vectorUri = '/heluo/vector/iiif/manifests/17270_2263_1068_1.json'
  const publicManifestPath = '/iiif/manifests/2263/manifest.json'
  const targetDoc = {
    _label: '集千家注杜工部诗集·卷十五',
    identified_by: [{ content: '集千家注杜工部诗集·卷十五' }],
    ...(withText ? { text_norm_zh: '国风雅颂，述而不作。卷十五正文示例。' } : {}),
  }
  const txtBookDoc = {
    _label: '集千家注杜工部诗集',
    digitally_carried_by: [
      {
        access_point: [
          { id: 'https://api.heluo.site/iiif/3/manifest/ancientBook/2263/17270_2263' },
        ],
      },
    ],
  }
  const manifestDoc = {
    id: `http://127.0.0.1:9011${publicManifestPath}`,
    items: [
      {
        id: 'http://127.0.0.1:9011/iiif/3/canvas/ancientBook/2263/17270_2263/p1',
        label: { none: ['卷十四'] },
        annotations: [],
      },
      {
        id: 'http://127.0.0.1:9011/iiif/3/canvas/ancientBook/2263/17270_2263/p2',
        label: { none: ['卷十五'] },
        annotations: withManifestAnnotationText
          ? [
              {
                id: 'http://127.0.0.1:9011/iiif/3/annotation-page/ancientBook/2263/17270_2263/p2/supplementing',
                items: [
                  {
                    id: 'http://127.0.0.1:9011/iiif/3/annotation/ancientBook/2263/17270_2263/p2/supplementing',
                    motivation: 'supplementing',
                    body: {
                      type: 'TextualBody',
                      value: '卷十五注释正文，来自 manifest supplementing 注释。',
                    },
                  },
                ],
              },
            ]
          : [],
      },
    ],
  }

  return async (url) => {
    const parsed = new URL(String(url))

    if (parsed.pathname === publicManifestPath) {
      return jsonResponse(manifestDoc, 200)
    }

    if (parsed.pathname === '/v1/documents') {
      const uri = parsed.searchParams.get('uri') || ''
      if (uri === targetUri) {
        return jsonResponse(targetDoc, 200)
      }
      if (uri === jsonLdTargetUri) {
        return jsonResponse(targetDoc, 200)
      }
      if (uri === txtBookUri) {
        return jsonResponse(txtBookDoc, 200)
      }
      if (
        uri === txtVolumeUri ||
        uri === txtVolumeUri2 ||
        uri === objectVolumeUri2 ||
        uri === jsonLdObjectVolumeUri2
      ) {
        return jsonResponse({ _label: uri.includes('_16') ? '卷十六' : '卷十五' }, 200)
      }
      if (uri === vectorUri && withVectorText) {
        return jsonResponse({
          text_norm_zh: '九家集注杜诗巻十五 卷十五向量文本示例。',
          evidence: {
            frontend_url: '/iiif/manifests/17270_2263?page=1068',
          },
        }, 200)
      }
      return jsonResponse({}, 404)
    }

    if (parsed.pathname === '/v1/search') {
      const directory = parsed.searchParams.get('directory')
      if (directory === '/processed/entities/ancient_book/ancient_book_txt/book/') {
        return jsonResponse({ total: 1, results: [{ uri: txtBookUri, score: 1, confidence: 1 }] }, 200)
      }
      if (directory === '/processed/entities/ancient_book/ancient_book_txt/volume/') {
        return jsonResponse({ total: 2, results: [{ uri: txtVolumeUri, score: 1, confidence: 1 }, { uri: txtVolumeUri2, score: 1, confidence: 1 }] }, 200)
      }
      if (directory === '/processed/entities/ancient_book/ancient_book_object/volume/') {
        if (useJsonLdObjectOnly) {
          return jsonResponse({ total: 0, results: [] }, 200)
        }
        return jsonResponse({ total: 2, results: [{ uri: targetUri, score: 1, confidence: 1 }, { uri: objectVolumeUri2, score: 1, confidence: 1 }] }, 200)
      }
      if (directory === '/processed/json-ld/ancient_book/ancient_book_txt/volume/') {
        return jsonResponse({ total: 0, results: [] }, 200)
      }
      if (directory === '/processed/json-ld/ancient_book/ancient_book_object/volume/') {
        if (!useJsonLdObjectOnly) {
          return jsonResponse({ total: 0, results: [] }, 200)
        }
        return jsonResponse({
          total: 2,
          results: [
            { uri: jsonLdTargetUri, score: 1, confidence: 1 },
            { uri: jsonLdObjectVolumeUri2, score: 1, confidence: 1 },
          ],
        }, 200)
      }
      if (directory === '/heluo/vector/iiif/manifests/' && withVectorText) {
        return jsonResponse({ total: 1, results: [{ uri: vectorUri, score: 1, confidence: 1 }] }, 200)
      }
      return jsonResponse({ total: 0, results: [] }, 200)
    }

    return jsonResponse({}, 404)
  }
}

describe('GET /api/v1/ancient-books/:id', () => {
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

  it('应支持通过 query.uri 定位古籍详情', async () => {
    const uri = encodeURIComponent('/processed/entities/ancient_book/ancient_book_object/volume/17270_2263_15.json')
    const response = await fetch(`${baseUrl}/api/v1/ancient-books/17270_2263_15?uri=${uri}`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.id).toBe('17270_2263_15')
    expect(result.data.title).toContain('卷十五')
    expect(result.data.texts?.length).toBe(2)
    expect(result.data.texts?.[0]?.iiifUri).toContain('/iiif/3/manifest/')
    expect(result.data.manifests?.[0]).toContain('/iiif/3/manifest/')
    expect(result.data.manifests?.[0]).toContain('http://127.0.0.1:')
    expect(result.data.volumeText).toContain('卷十五正文示例')
    expect(result.data.volumeTextStatus).toBe('available')
    expect(result.data.volumeLabel).toContain('卷十五')
  })

  it('卷详情无正文时应返回 missing 状态与提示', async () => {
    setMarklogicFetchForTest(createFetchMock({ withText: false }))

    const uri = encodeURIComponent('/processed/entities/ancient_book/ancient_book_object/volume/17270_2263_15.json')
    const response = await fetch(`${baseUrl}/api/v1/ancient-books/17270_2263_15?uri=${uri}`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.volumeText).toBeUndefined()
    expect(result.data.volumeTextStatus).toBe('missing')
    expect(result.data.volumeTextMessage).toContain('暂无可解析文本')
  })

  it('卷详情无正文时应回退到 IIIF 向量文本', async () => {
    setMarklogicFetchForTest(createFetchMock({ withText: false, withVectorText: true }))

    const uri = encodeURIComponent('/processed/entities/ancient_book/ancient_book_object/volume/17270_2263_15.json')
    const response = await fetch(`${baseUrl}/api/v1/ancient-books/17270_2263_15?uri=${uri}`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.volumeText).toContain('卷十五向量文本示例')
    expect(result.data.volumeTextStatus).toBe('available')
    expect(result.data.volumeTextSourceUri).toContain('/iiif/manifests/')
  })

  it('卷详情无正文时应回退到 manifest 注释文本', async () => {
    setMarklogicFetchForTest(createFetchMock({ withText: false, withManifestAnnotationText: true }))

    const uri = encodeURIComponent('/processed/entities/ancient_book/ancient_book_object/volume/17270_2263_15.json')
    const response = await fetch(`${baseUrl}/api/v1/ancient-books/17270_2263_15?uri=${uri}`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.volumeText).toContain('manifest supplementing 注释')
    expect(result.data.volumeTextStatus).toBe('available')
    expect(result.data.volumeTextSourceUri).toContain('/iiif/manifests/2263/manifest.json')
  })


  it('书目详情应兼容 json-ld object 目录并返回 objectUri', async () => {
    const entryUri = '/processed/json-ld/ancient_book/ancient_book_set/book_entry/17270_303.json'
    const txtBookUri = '/processed/json-ld/ancient_book/ancient_book_txt/book/17270_303.json'
    const txtVolumeUri = '/processed/json-ld/ancient_book/ancient_book_txt/volume/17270_303_1.json'
    const objectVolumeUri = '/processed/json-ld/ancient_book/ancient_book_object/volume/17270_303_1.json'

    setMarklogicFetchForTest(async (url) => {
      const parsed = new URL(String(url))

      if (parsed.pathname === '/v1/documents') {
        const target = parsed.searchParams.get('uri') || ''
        if (target === entryUri) {
          return jsonResponse({
            _label: '杜诗捃',
            id: 'http://localhost:8000/set/ancient_book/siku/jibu/303',
          })
        }
        if (target === txtBookUri) {
          return jsonResponse({
            _label: '杜诗捃',
            created_by: {
              _label: '唐元竑创作',
              carried_out_by: [{ _label: '唐元竑' }],
            },
          })
        }
        if (target === txtVolumeUri) {
          return jsonResponse({ _label: '杜诗捃·卷一' })
        }
        if (target === objectVolumeUri) {
          return jsonResponse({
            _label: '杜诗捃·卷一',
            produced_by: {
              _label: '唐元竑（明）创作',
              carried_out_by: [{ _label: '唐元竑' }],
              timespan: [{ _label: '明' }],
            },
          })
        }
        return jsonResponse({}, 404)
      }

      if (parsed.pathname === '/v1/search') {
        const directory = parsed.searchParams.get('directory')
        if (directory === '/processed/entities/ancient_book/ancient_book_txt/book/') {
          return jsonResponse({ total: 0, results: [] }, 200)
        }
        if (directory === '/processed/json-ld/ancient_book/ancient_book_txt/book/') {
          return jsonResponse({ total: 1, results: [{ uri: txtBookUri, score: 1, confidence: 1 }] }, 200)
        }
        if (directory === '/processed/entities/ancient_book/ancient_book_txt/volume/') {
          return jsonResponse({ total: 0, results: [] }, 200)
        }
        if (directory === '/processed/json-ld/ancient_book/ancient_book_txt/volume/') {
          return jsonResponse({ total: 1, results: [{ uri: txtVolumeUri, score: 1, confidence: 1 }] }, 200)
        }
        if (directory === '/processed/entities/ancient_book/ancient_book_object/volume/') {
          return jsonResponse({ total: 0, results: [] }, 200)
        }
        if (directory === '/processed/json-ld/ancient_book/ancient_book_object/volume/') {
          return jsonResponse({ total: 1, results: [{ uri: objectVolumeUri, score: 1, confidence: 1 }] }, 200)
        }
        return jsonResponse({ total: 0, results: [] }, 200)
      }

      return jsonResponse({}, 404)
    })

    const uri = encodeURIComponent(entryUri)
    const response = await fetch(`${baseUrl}/api/v1/ancient-books/17270_303?uri=${uri}`)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.texts?.[0]?.objectUri).toBe(objectVolumeUri)
    expect(result.data.texts?.[0]?.textUri).toBe(txtVolumeUri)
  })
})
