/**
 * IIIF Manifest 解析工具测试
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildIiifCollectionUrl,
  clearIiifManifestResolutionCache,
  isIiifPresentationManifest,
  resolveIiifManifestUrl,
} from '@/features/iiif/manifestResolver'

describe('manifestResolver', () => {
  beforeEach(() => {
    clearIiifManifestResolutionCache()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应识别标准 IIIF Manifest', () => {
    expect(isIiifPresentationManifest({
      type: 'Manifest',
      items: [{ type: 'Canvas' }],
    })).toBe(true)
  })

  it('应从短路径 manifest 推导 collection 路径', () => {
    expect(buildIiifCollectionUrl('http://localhost:8083/iiif/manifests/303/manifest.json'))
      .toBe('http://localhost:8083/iiif/manifests/303/collection.json')
  })

  it('标准 manifest 应直接返回原地址', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'Manifest',
        items: [{ type: 'Canvas', id: 'canvas-1' }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await resolveIiifManifestUrl('http://localhost:8083/iiif/manifests/304/manifest.json')

    expect(result).toBe('http://127.0.0.1:9011/iiif/manifests/304/manifest.json')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('短路径 manifest 非标准时应回退到 collection 中的真实 manifest', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          book_id: '17270',
          carrier_id: '303',
          entries: [{ id: 'entry-1' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'Collection',
          items: [
            {
              id: 'http://localhost:8083/iiif/manifests/ancientBook/303/17270_303/manifest.json',
              type: 'Manifest',
            },
          ],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const result = await resolveIiifManifestUrl('/iiif/manifests/303/manifest.json')

    expect(result).toBe('http://127.0.0.1:9011/iiif/manifests/ancientBook/303/17270_303/manifest.json')
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:9011/iiif/manifests/303/manifest.json',
      { headers: { accept: 'application/json' } },
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:9011/iiif/manifests/303/collection.json',
      { headers: { accept: 'application/json' } },
    )
  })

  it('manifest 返回 HTML 时应继续回退到 collection 中的真实 manifest', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null),
        },
        text: async () => '<!doctype html><html><body>not json</body></html>',
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
        },
        json: async () => ({
          type: 'Collection',
          items: [
            {
              id: 'http://localhost:8083/iiif/manifests/ancientBook/304/17270_304/manifest.json',
              type: 'Manifest',
            },
          ],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const result = await resolveIiifManifestUrl('/iiif/manifests/304/manifest.json')

    expect(result).toBe('http://127.0.0.1:9011/iiif/manifests/ancientBook/304/17270_304/manifest.json')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('manifest 与 collection 都返回 HTML 时应抛出可读错误', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null),
      },
      text: async () => '<!doctype html><html><body>wrong page</body></html>',
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(resolveIiifManifestUrl('/iiif/manifests/305/manifest.json')).rejects.toThrow(
      'IIIF manifest 返回了 HTML 页面，请检查 manifest 地址或后端代理配置。',
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
