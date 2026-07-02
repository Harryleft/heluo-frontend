/**
 * iiif.ts 运行时配置覆盖测试
 * @vitest-environment node
 *
 * 验证 buildManifestUrl 在运行时配置存在时使用动态后端地址，
 * 而不是构建时烘焙的 import.meta.env 常量。
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

// vi.hoisted 确保 mock 函数在 vi.mock 工厂（被提升到文件顶部）执行时已存在
const { getRuntimeBackendBaseUrl } = vi.hoisted(() => ({
  getRuntimeBackendBaseUrl: vi.fn<() => string>(),
}))

vi.mock('@/lib/runtime/runtimeConfig', () => ({
  getRuntimeBackendBaseUrl,
}))

describe('iiif 运行时配置覆盖', () => {
  afterEach(() => {
    vi.resetModules()
    getRuntimeBackendBaseUrl.mockReset()
  })

  it('应在运行时配置存在时使用运行时后端 URL 构造 manifest 地址', async () => {
    getRuntimeBackendBaseUrl.mockReturnValue('https://api.heluo.site/')

    const { buildManifestUrl } = await import('@/lib/config/iiif')

    const url = buildManifestUrl('/iiif/manifests/303/manifest.json')
    expect(url).toBe('https://api.heluo.site/iiif/manifests/303/manifest.json')
  })

  it('应在运行时配置为空时回退到构建时默认值', async () => {
    getRuntimeBackendBaseUrl.mockReturnValue('')

    const { buildManifestUrl } = await import('@/lib/config/iiif')

    const url = buildManifestUrl('/iiif/manifests/303/manifest.json')
    expect(url).toBe('http://127.0.0.1:9011/iiif/manifests/303/manifest.json')
  })

  it('应在运行时配置变更后立即反映到后续调用', async () => {
    getRuntimeBackendBaseUrl.mockReturnValue('https://first.heluo.site/')

    const { buildManifestUrl } = await import('@/lib/config/iiif')

    const url1 = buildManifestUrl('/iiif/manifests/303/manifest.json')
    expect(url1).toBe('https://first.heluo.site/iiif/manifests/303/manifest.json')

    // 模拟运行时配置变更（热切换后端）
    getRuntimeBackendBaseUrl.mockReturnValue('https://second.heluo.site/')

    const url2 = buildManifestUrl('/iiif/manifests/303/manifest.json')
    expect(url2).toBe('https://second.heluo.site/iiif/manifests/303/manifest.json')
  })
})
