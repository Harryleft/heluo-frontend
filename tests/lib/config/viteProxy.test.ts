/**
 * Vite 开发代理配置测试
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'
import viteConfigFactory from '../../../vite.config'

describe('vite 开发代理配置', () => {
  it('应将 /iiif 代理到后端，保持 /iiif/* 访问 IIIF 网关', () => {
    const config = viteConfigFactory({ command: 'serve', mode: 'development' })
    const proxy = config.server?.proxy
    const iiifProxy: any = proxy?.['/iiif']

    expect(proxy).toBeDefined()
    expect(proxy).toHaveProperty('/iiif')
    expect(iiifProxy.target).toBe('http://127.0.0.1:9011')
    expect(iiifProxy.bypass({ url: '/iiif?a=b' })).toBe('/index.html')
    expect(iiifProxy.bypass({ url: '/iiif/manifests/303/manifest.json' })).toBeUndefined()
  })
})
