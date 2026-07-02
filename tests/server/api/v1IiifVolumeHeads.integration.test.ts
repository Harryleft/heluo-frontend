/**
 * /api/v1/iiif/volume-heads 集成测试
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

function createManifestFetchMock() {
  const manifest303 = {
    id: 'http://localhost:8083/iiif/manifests/303/manifest.json',
    type: 'Manifest',
    items: [
      { id: 'http://localhost:8083/iiif/3/canvas/ancientBook/303/17270_303/p1', label: { none: ['第1页 (提要-1a)'] } },
      { id: 'http://localhost:8083/iiif/3/canvas/ancientBook/303/17270_303/p2', label: { none: ['第2页 (卷一-1a)'] } },
      { id: 'http://localhost:8083/iiif/3/canvas/ancientBook/303/17270_303/p3', label: { none: ['第3页 (卷一-1b)'] } },
      { id: 'http://localhost:8083/iiif/3/canvas/ancientBook/303/17270_303/p4', label: { none: ['第4页 (卷二-1a)'] } },
    ],
  }
  const manifestEmpty = {
    id: 'http://localhost:8083/iiif/manifests/empty/manifest.json',
    type: 'Manifest',
    items: [
      { id: 'http://localhost:8083/iiif/3/canvas/empty/p1', label: { none: ['第1页 (提要-1a)'] } },
      { id: 'http://localhost:8083/iiif/3/canvas/empty/p2', label: { none: ['第2页 (目录)'] } },
    ],
  }

  return async (url: unknown) => {
    const parsed = new URL(String(url))
    if (parsed.pathname === '/iiif/manifests/303/manifest.json') {
      return jsonResponse(manifest303, 200)
    }
    if (parsed.pathname === '/iiif/manifests/empty/manifest.json') {
      return jsonResponse(manifestEmpty, 200)
    }
    return jsonResponse({}, 404)
  }
}

describe('GET /api/v1/iiif/volume-heads', () => {
  let server: ReturnType<typeof app.listen>
  let baseUrl = ''

  beforeAll(async () => {
    server = app.listen(0)
    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  beforeEach(() => {
    setMarklogicFetchForTest(createManifestFetchMock())
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

  it('应返回卷首 canvas 列表', async () => {
    const manifest = encodeURIComponent('http://localhost:8083/iiif/manifests/303/manifest.json')
    const response = await fetch(`${baseUrl}/api/v1/iiif/volume-heads?manifest=${manifest}`)
    const result = await response.json() as {
      success: boolean
      data: {
        volumeHeads?: Array<{ volumeLabel: string; canvasId: string; pageIndex: number }>
      }
    }

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.volumeHeads?.map((item) => item.volumeLabel)).toEqual(['卷一', '卷二'])
    expect(result.data.volumeHeads?.map((item) => item.pageIndex)).toEqual([2, 4])
    expect(result.data.volumeHeads?.[0]?.canvasId).toContain('/p2')
  })

  it('未解析到卷次时应返回空数组', async () => {
    const manifest = encodeURIComponent('http://localhost:8083/iiif/manifests/empty/manifest.json')
    const response = await fetch(`${baseUrl}/api/v1/iiif/volume-heads?manifest=${manifest}`)
    const result = await response.json() as {
      success: boolean
      data: {
        volumeHeads?: Array<{ volumeLabel: string }>
      }
    }

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.volumeHeads).toEqual([])
  })

  it('manifest 参数缺失时应返回 400', async () => {
    const response = await fetch(`${baseUrl}/api/v1/iiif/volume-heads`)
    const result = await response.json() as {
      success: boolean
      error?: { code: string }
    }

    expect(response.status).toBe(400)
    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('INVALID_PARAMS')
  })
})

