/**
 * iiif 配置工具测试
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'
import { buildManifestUrl, buildMiradorViewerUrl } from '@/lib/config/iiif'

const TEST_ORIGIN = 'http://localhost'

describe('iiif config utils', () => {
  it('应将相对 manifest 路径转换为完整 URL', () => {
    const url = buildManifestUrl('/iiif/manifests/303/manifest.json')
    expect(url).toBe('http://127.0.0.1:9011/iiif/manifests/303/manifest.json')
  })

  it('应在 viewer URL 中透传 canvas 参数', () => {
    const manifest = 'http://localhost:8083/iiif/manifests/303/manifest.json'
    const canvas = 'http://localhost:8083/iiif/3/canvas/ancientBook/303/17270_303/p9'

    const viewerUrl = buildMiradorViewerUrl(manifest, canvas)
    const parsed = new URL(viewerUrl, TEST_ORIGIN)

    expect(parsed.pathname).toBe('/mirador')
    expect(parsed.searchParams.get('manifest')).toBe('http://127.0.0.1:9011/iiif/manifests/303/manifest.json')
    expect(parsed.searchParams.get('canvas')).toBe(canvas)
  })

  it('未传 canvas 时不应追加 canvas 参数', () => {
    const manifest = 'http://localhost:8083/iiif/manifests/304/manifest.json'
    const viewerUrl = buildMiradorViewerUrl(manifest)
    const parsed = new URL(viewerUrl, TEST_ORIGIN)

    expect(parsed.pathname).toBe('/mirador')
    expect(parsed.searchParams.get('manifest')).toBe('http://127.0.0.1:9011/iiif/manifests/304/manifest.json')
    expect(parsed.searchParams.has('canvas')).toBe(false)
  })

  it('viewer URL 应为相对 manifest 透传可访问的完整地址', () => {
    const viewerUrl = buildMiradorViewerUrl('/iiif/manifests/304/manifest.json')
    const parsed = new URL(viewerUrl, TEST_ORIGIN)

    expect(parsed.pathname).toBe('/mirador')
    expect(parsed.searchParams.get('manifest')).toBe('http://127.0.0.1:9011/iiif/manifests/304/manifest.json')
  })

  it('应将旧 8083 的长 manifest 地址改写到 9011', () => {
    const url = buildManifestUrl('http://localhost:8083/iiif/manifests/ancientBook/303/17270_303/manifest.json')
    expect(url).toBe('http://127.0.0.1:9011/iiif/manifests/ancientBook/303/17270_303/manifest.json')
  })

  describe('向量索引 URI 转换', () => {
    it('应将向量索引 URI 转换为正确的 IIIF manifest 路径', () => {
      const url = buildManifestUrl('/processed/vector/iiif/manifest/17270_304_766_1.json')
      expect(url).toBe('http://127.0.0.1:9011/iiif/manifests/304/manifest.json')
    })

    it('应将绝对路径的向量索引 URI 也正确转换', () => {
      const url = buildManifestUrl('http://127.0.0.1:9011/processed/vector/iiif/manifest/17270_303_766_2.json')
      expect(url).toBe('http://127.0.0.1:9011/iiif/manifests/303/manifest.json')
    })

    it('不应影响正常的 IIIF manifest 路径', () => {
      const url = buildManifestUrl('/iiif/manifests/304/manifest.json')
      expect(url).toBe('http://127.0.0.1:9011/iiif/manifests/304/manifest.json')
    })

    it('不应影响正常的实体详情路径', () => {
      const url = buildManifestUrl('/processed/json-ld/person/person_123.json')
      expect(url).toBe('http://127.0.0.1:9011/processed/json-ld/person/person_123.json')
    })
  })
})
