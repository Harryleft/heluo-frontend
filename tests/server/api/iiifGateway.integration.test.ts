/**
 * IIIF MarkLogic 网关集成测试
 * @vitest-environment node
 */

import type { AddressInfo } from 'node:net'
import fetch from 'node-fetch'
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

function createIiifGatewayFetchMock() {
  const manifest303 = {
    '@context': ['https://iiif.io/api/presentation/3/context.json'],
    type: 'Manifest',
    id: 'http://localhost:8083/iiif/manifests/ancientBook/303/17270_303/manifest.json',
    label: { zh: ['杜诗捃'] },
    service: [
      {
        id: 'http://localhost:8083/iiif/3/search/ancientBook/303/17270_303',
        type: 'SearchService1',
      },
    ],
    items: [
      {
        id: 'http://localhost:8083/iiif/3/canvas/ancientBook/303/17270_303/p1',
        type: 'Canvas',
        label: { none: ['第1页 (提要-1a)'] },
        annotations: [
          {
            id: 'http://localhost:8083/iiif/3/annotation-page/ancientBook/303/17270_303/p1/supplementing',
            items: [
              {
                id: 'http://localhost:8083/iiif/3/annotation/ancientBook/303/17270_303/p1/supplementing',
                motivation: 'supplementing',
                body: { value: '欽定四庫全書 杜詩攟 提要' },
              },
            ],
          },
        ],
      },
      {
        id: 'http://localhost:8083/iiif/3/canvas/ancientBook/303/17270_303/p2',
        type: 'Canvas',
        label: { none: ['第2页 (卷一-1a)'] },
        annotations: [
          {
            id: 'http://localhost:8083/iiif/3/annotation-page/ancientBook/303/17270_303/p2/supplementing',
            items: [
              {
                id: 'http://localhost:8083/iiif/3/annotation/ancientBook/303/17270_303/p2/supplementing',
                motivation: 'supplementing',
                body: { value: '蘇軾而申宋敏求宛馬總肥秦苜蓿句正用' },
              },
            ],
          },
        ],
      },
      {
        id: 'http://localhost:8083/iiif/3/canvas/ancientBook/303/17270_303/p3',
        type: 'Canvas',
        label: { none: ['第3页 (卷二-1a)'] },
        annotations: [],
      },
    ],
  }

  const collection303 = {
    '@context': ['https://iiif.io/api/presentation/3/context.json'],
    id: 'http://localhost:8083/iiif/3/collection/ancientBook/303',
    type: 'Collection',
    label: { zh: ['杜诗捃'] },
    items: [
      {
        id: 'http://localhost:8083/iiif/manifests/ancientBook/303/17270_303/manifest.json',
        type: 'Manifest',
        label: { zh: ['杜诗捃'] },
      },
    ],
  }

  return async (url: unknown) => {
    const parsed = new URL(String(url))
    if (parsed.pathname !== '/v1/documents') {
      return jsonResponse({}, 404)
    }

    const uri = String(parsed.searchParams.get('uri') || '')
    if (uri === '/iiif/manifests/303/manifest.json') {
      return jsonResponse(manifest303, 200)
    }
    if (uri === '/iiif/manifests/303/collection.json') {
      return jsonResponse(collection303, 200)
    }

    return jsonResponse({}, 404)
  }
}

describe('IIIF MarkLogic 网关', () => {
  let server: ReturnType<typeof app.listen>
  let baseUrl = ''

  beforeAll(async () => {
    server = app.listen(0)
    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  beforeEach(() => {
    setMarklogicFetchForTest(createIiifGatewayFetchMock())
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

  it('应返回重写后的公开 manifest', async () => {
    const response = await fetch(`${baseUrl}/iiif/manifests/303/manifest.json`)
    const result = await response.json() as {
      id: string
      service?: Array<{ id: string }>
    }

    expect(response.status).toBe(200)
    expect(result.id).toBe(`${baseUrl}/iiif/manifests/ancientBook/303/17270_303/manifest.json`)
    expect(result.service?.[0]?.id).toBe(`${baseUrl}/iiif/3/search/ancientBook/303/17270_303`)
  })

  it('应返回重写后的公开 collection', async () => {
    const response = await fetch(`${baseUrl}/iiif/manifests/303/collection.json`)
    const result = await response.json() as {
      id: string
      items?: Array<{ id: string }>
    }

    expect(response.status).toBe(200)
    expect(result.id).toBe(`${baseUrl}/iiif/3/collection/ancientBook/303`)
    expect(result.items?.[0]?.id).toBe(`${baseUrl}/iiif/manifests/ancientBook/303/17270_303/manifest.json`)
  })

  it('应返回可用于 Mirador 的 IIIF 搜索结果', async () => {
    const query = encodeURIComponent('蘇軾而申宋敏求宛馬總肥秦苜蓿句正用')
    const response = await fetch(`${baseUrl}/iiif/3/search/ancientBook/303/17270_303?q=${query}`)
    const result = await response.json() as {
      hits?: Array<{ annotations: string[] }>
      resources?: Array<{ on: string }>
    }

    expect(response.status).toBe(200)
    expect(result.resources?.[0]?.on).toBe('http://localhost:8083/iiif/3/canvas/ancientBook/303/17270_303/p2')
    expect(result.hits?.length).toBe(1)
  })

  it('volume-heads 应兼容新的同源 manifest 地址', async () => {
    const manifest = encodeURIComponent(`${baseUrl}/iiif/manifests/303/manifest.json`)
    const response = await fetch(`${baseUrl}/api/v1/iiif/volume-heads?manifest=${manifest}`)
    const result = await response.json() as {
      success: boolean
      data?: {
        volumeHeads?: Array<{ volumeLabel: string; pageIndex: number }>
      }
    }

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data?.volumeHeads?.map((item) => item.volumeLabel)).toEqual(['卷一', '卷二'])
    expect(result.data?.volumeHeads?.map((item) => item.pageIndex)).toEqual([2, 3])
  })
})
