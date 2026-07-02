/**
 * Vite 开发代理配置测试
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'
import viteConfigFactory from '../../../vite.config'

describe('vite 开发代理配置', () => {
  it('应将 /iiif 代理到后端，避免本地 Mirador 请求命中前端 HTML', () => {
    const config = viteConfigFactory({ command: 'serve', mode: 'development' })
    const proxy = config.server?.proxy

    expect(proxy).toBeDefined()
    expect(proxy).toHaveProperty('/iiif')
    expect(proxy?.['/iiif']).toBe('http://127.0.0.1:9011')
  })
})
